/**
 * Routes Públicas: Agendamento Online
 * SetPoint Ultra — Sem autenticação, acessível via link público
 * Rota base: /api/publico/agendamento/:slug
 */
import { Router } from 'express';
import { db } from '../../core/database.js';
import {
  notificarConfirmacaoAgendamento
} from '../../core/whatsapp.js';

const router = Router();

// ── Carregar dados do estabelecimento pelo slug ───────────────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Buscar tenant pelo slug
    const tenantResult = await db.query(
      `SELECT id, nome, slug, whatsapp, endereco, emoji, configuracoes
       FROM tenants
       WHERE slug = $1 AND ativo = TRUE`,
      [slug]
    );

    if (!tenantResult.rows.length) {
      return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado' });
    }

    const tenant = tenantResult.rows[0];

    // Buscar profissionais ativos
    const profResult = await db.query(
      `SELECT id, nome, especialidade, foto_emoji
       FROM barbearia_profissionais
       WHERE tenant_id = $1 AND ativo = TRUE AND aceita_agendamento_online = TRUE
       ORDER BY nome`,
      [tenant.id]
    );

    // Buscar serviços ativos com agendamento online habilitado
    const servResult = await db.query(
      `SELECT id, nome, descricao, preco, duracao_min
       FROM barbearia_servicos
       WHERE tenant_id = $1 AND ativo = TRUE AND disponivel_online = TRUE
       ORDER BY nome`,
      [tenant.id]
    );

    res.json({
      ok: true,
      estabelecimento: {
        nome: tenant.nome,
        slug: tenant.slug,
        whatsapp: tenant.whatsapp,
        endereco: tenant.endereco,
        emoji: tenant.emoji || '✂️',
      },
      profissionais: profResult.rows,
      servicos: servResult.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Horários disponíveis ──────────────────────────────────────────────────────
router.get('/:slug/horarios', async (req, res) => {
  try {
    const { slug } = req.params;
    const { profissional_id, data, duracao } = req.query;

    if (!data || !duracao) {
      return res.status(400).json({ ok: false, error: 'data e duracao são obrigatórios' });
    }

    // Buscar tenant
    const tenantResult = await db.query(
      'SELECT id FROM tenants WHERE slug = $1 AND ativo = TRUE',
      [slug]
    );
    if (!tenantResult.rows.length) {
      return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado' });
    }
    const tenantId = tenantResult.rows[0].id;

    // Buscar horários de funcionamento (padrão: 8h-18h, intervalo 30min)
    const diasSemana = new Date(data + 'T12:00').getDay(); // 0=Dom, 6=Sab
    const horarioAbertura = '08:00';
    const horarioFechamento = diasSemana === 6 ? '13:00' : '18:00';
    const intervaloMin = 30;
    const duracaoMin = parseInt(duracao) || 30;

    // Gerar slots
    const slots = [];
    let hora = parseInt(horarioAbertura.split(':')[0]);
    let minuto = parseInt(horarioAbertura.split(':')[1]);
    const [hFim, mFim] = horarioFechamento.split(':').map(Number);

    while (hora * 60 + minuto + duracaoMin <= hFim * 60 + mFim) {
      slots.push(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`);
      minuto += intervaloMin;
      if (minuto >= 60) { hora++; minuto -= 60; }
    }

    // Buscar agendamentos já existentes nessa data
    const agendadosResult = await db.query(
      `SELECT horario, duracao_min
       FROM agendamentos
       WHERE tenant_id = $1
         AND DATE(data_hora) = $2
         AND ($3::uuid IS NULL OR profissional_id = $3::uuid)
         AND status NOT IN ('cancelado', 'nao_compareceu')`,
      [tenantId, data, profissional_id === 'qualquer' ? null : profissional_id || null]
    );

    const agendados = agendadosResult.rows.map(a => a.horario);

    // Marcar disponibilidade
    const horarios = slots.map(h => ({
      horario: h,
      disponivel: !agendados.includes(h),
    }));

    res.json({ ok: true, horarios });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Confirmar agendamento ─────────────────────────────────────────────────────
router.post('/:slug/confirmar', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      servico_id, profissional_id, data, horario,
      cliente_nome, cliente_telefone, observacoes
    } = req.body;

    if (!servico_id || !data || !horario || !cliente_nome || !cliente_telefone) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios faltando' });
    }

    // Buscar tenant
    const tenantResult = await db.query(
      'SELECT id, nome, whatsapp FROM tenants WHERE slug = $1 AND ativo = TRUE',
      [slug]
    );
    if (!tenantResult.rows.length) {
      return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado' });
    }
    const tenant = tenantResult.rows[0];

    // Buscar serviço
    const servicoResult = await db.query(
      'SELECT * FROM barbearia_servicos WHERE id = $1 AND tenant_id = $2',
      [servico_id, tenant.id]
    );
    if (!servicoResult.rows.length) {
      return res.status(404).json({ ok: false, error: 'Serviço não encontrado' });
    }
    const servico = servicoResult.rows[0];

    // Verificar se horário ainda está disponível
    const conflito = await db.query(
      `SELECT id FROM agendamentos
       WHERE tenant_id = $1 AND DATE(data_hora) = $2 AND horario = $3
         AND ($4::uuid IS NULL OR profissional_id = $4::uuid)
         AND status NOT IN ('cancelado', 'nao_compareceu')`,
      [tenant.id, data, horario, profissional_id === 'qualquer' ? null : profissional_id || null]
    );

    if (conflito.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'Horário não está mais disponível. Por favor, escolha outro.' });
    }

    // Gerar código de confirmação
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Inserir ou buscar cliente
    let clienteId = null;
    const clienteExist = await db.query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND telefone = $2 LIMIT 1',
      [tenant.id, cliente_telefone]
    );
    if (clienteExist.rows.length) {
      clienteId = clienteExist.rows[0].id;
    } else {
      const novoCliente = await db.query(
        `INSERT INTO clientes (tenant_id, nome, telefone, origem)
         VALUES ($1,$2,$3,'agendamento_online') RETURNING id`,
        [tenant.id, cliente_nome, cliente_telefone]
      );
      clienteId = novoCliente.rows[0].id;
    }

    // Criar agendamento
    const agResult = await db.query(
      `INSERT INTO agendamentos
        (tenant_id, cliente_id, servico_id, profissional_id,
         data_hora, horario, duracao_min, status,
         cliente_nome, cliente_telefone, observacoes, codigo_confirmacao, origem)
       VALUES ($1,$2,$3,$4,
         ($5::date + $6::time)::timestamp,
         $6, $7, 'confirmado',
         $8, $9, $10, $11, 'online')
       RETURNING id, codigo_confirmacao`,
      [
        tenant.id, clienteId, servico_id,
        profissional_id === 'qualquer' ? null : profissional_id || null,
        data, horario, servico.duracao_min,
        cliente_nome, cliente_telefone, observacoes || null, codigo
      ]
    );

    const agendamento = agResult.rows[0];

    // Buscar nome do profissional
    let profissionalNome = 'A definir';
    if (profissional_id && profissional_id !== 'qualquer') {
      const profResult = await db.query(
        'SELECT nome FROM barbearia_profissionais WHERE id = $1',
        [profissional_id]
      );
      profissionalNome = profResult.rows[0]?.nome || 'A definir';
    }

    // Enviar WhatsApp de confirmação (não bloqueia a resposta)
    notificarConfirmacaoAgendamento(tenant, {
      cliente_nome,
      cliente_telefone,
      servico: servico.nome,
      profissional: profissionalNome,
      data,
      horario,
      codigo,
    }).catch(err => console.error('[WhatsApp] Falha ao enviar confirmação:', err.message));

    res.status(201).json({
      ok: true,
      agendamento: {
        id: agendamento.id,
        codigo: agendamento.codigo_confirmacao,
      },
    });
  } catch (err) {
    console.error('[Agendamento Online] Erro:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
