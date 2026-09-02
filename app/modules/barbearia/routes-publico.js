import crypto from 'crypto';
import express from 'express';
import { db } from '../../db.js';
import * as barbearia from '../../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from '../../core/barbershop-appointment-notifications.js';

const router = express.Router();
const EMPRESA_PADRAO_ID = 'emp-kytto-001';

function texto(valor, limite = 160) {
  return String(valor ?? '').trim().slice(0, limite);
}

function slug(valor) {
  return texto(valor, 100)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function empresaCadastrada(estado, empresaId) {
  return estado.cadastrosMestresKytto?.empresas?.[empresaId]
    || estado.empresas?.[empresaId]
    || null;
}

function identidadePublica(slugRecebido) {
  const solicitado = slug(slugRecebido);
  if (!solicitado) return null;
  const estado = db();
  const barbearias = estado.barbearias || {};

  for (const [empresaId, dados] of Object.entries(barbearias)) {
    const configuracao = dados?.configuracao || {};
    const empresa = empresaCadastrada(estado, empresaId);
    const slugConfigurado = slug(configuracao.slugPublico || configuracao.slugAgendamento);
    const aliasDino = solicitado === 'dino' && empresaId === EMPRESA_PADRAO_ID;
    if (!aliasDino && (!slugConfigurado || slugConfigurado !== solicitado)) continue;
    if (configuracao.agendamentoPublicoAtivo === false || empresa?.ativa === false) return null;
    return {
      empresaId,
      lojaId: texto(configuracao.lojaPublicaId, 120),
      estabelecimento: {
        nome: texto(configuracao.nomePublico, 160) || (aliasDino ? 'Dino' : texto(empresa?.nomeFantasia || empresa?.nome, 160)) || 'Barbearia',
        slug: aliasDino ? 'dino' : slugConfigurado,
        whatsapp: texto(configuracao.whatsappPublico || empresa?.telefone, 30),
        endereco: texto(configuracao.enderecoPublico || empresa?.endereco, 240),
        emoji: texto(configuracao.emojiPublico, 8) || '✂️',
      },
    };
  }
  return null;
}

function servicoPublico(item) {
  return {
    id: item.id,
    nome: item.nome,
    descricao: item.descricao || '',
    preco: Number(item.preco || 0),
    duracao_min: Number(item.duracaoMinutos || 30),
  };
}

function profissionalPublico(item) {
  return {
    id: item.id,
    nome: item.nome,
    especialidade: item.especialidade || 'Barbeiro',
    foto_emoji: texto(item.fotoEmoji, 8) || '✂️',
  };
}

function erroHttp(res, erro) {
  const mensagem = texto(erro?.message || 'Não foi possível concluir o agendamento.', 240);
  const indisponivel = /indisponível|indisponivel|conflito/i.test(mensagem);
  const entradaInvalida = /obrigatóri|inválid|indisponível para agendamento online|não funciona|fora do funcionamento|não trabalha/i.test(mensagem);
  const status = indisponivel ? 409 : entradaInvalida ? 400 : 500;
  if (status === 500) console.error('[Agendamento público]', erro);
  return res.status(status).json({ ok: false, error: status === 500 ? 'Não foi possível concluir o agendamento.' : mensagem });
}

router.get('/:slug', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const profissionais = barbearia.listarProfissionais(identidade.empresaId)
      .filter((item) => item.ativo !== false)
      .map(profissionalPublico);
    const servicos = barbearia.listarServicos(identidade.empresaId)
      .filter((item) => item.ativo !== false && item.permiteAgendamentoOnline !== false)
      .map(servicoPublico);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({ ok: true, estabelecimento: identidade.estabelecimento, profissionais, servicos });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

router.get('/:slug/horarios', (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const servicoId = texto(req.query.servico_id, 100);
    if (!servicoId) return res.status(400).json({ ok: false, error: 'servico_id é obrigatório.' });
    const horarios = barbearia.listarHorariosDisponiveis(identidade.empresaId, {
      data: req.query.data,
      servicoId,
      profissionalId: req.query.profissional_id,
      lojaId: identidade.lojaId,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, horarios });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

router.post('/:slug/confirmar', async (req, res) => {
  try {
    const identidade = identidadePublica(req.params.slug);
    if (!identidade) return res.status(404).json({ ok: false, error: 'Estabelecimento não encontrado.' });
    const corpo = req.body || {};
    const nome = texto(corpo.cliente_nome, 160);
    const telefone = String(corpo.cliente_telefone || '').replace(/\D/g, '').slice(0, 13);
    const servicoId = texto(corpo.servico_id, 100);
    const profissionalId = texto(corpo.profissional_id || 'qualquer', 100);
    const data = texto(corpo.data, 10);
    const horario = texto(corpo.horario, 5);
    if (nome.length < 2) return res.status(400).json({ ok: false, error: 'Informe seu nome.' });
    if (telefone.length < 10) return res.status(400).json({ ok: false, error: 'Informe um telefone válido com DDD.' });
    if (!servicoId || !data || !horario) return res.status(400).json({ ok: false, error: 'Serviço, data e horário são obrigatórios.' });

    const disponibilidade = barbearia.resolverProfissionalDisponivel(identidade.empresaId, {
      data,
      horario,
      servicoId,
      profissionalId,
      lojaId: identidade.lojaId,
    });
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const agendamento = barbearia.criarAgendamento(identidade.empresaId, {
      clienteNome: nome,
      clienteTelefone: telefone,
      profissionalId: disponibilidade.profissional.id,
      servicoId,
      dataHora: disponibilidade.dataHora,
      dataAgenda: disponibilidade.dataAgenda,
      horaLocal: disponibilidade.horaLocal,
      lojaId: identidade.lojaId,
      observacoes: texto(corpo.observacoes, 600),
      origem: 'agendamento_online',
      status: 'agendado',
      codigoConfirmacao: codigo,
    });
    await queueAppointmentNotifications({ empresaId: identidade.empresaId, lojaId: identidade.lojaId, legacyEmpresaId: identidade.empresaId }, agendamento, 'criado').catch(() => null);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      ok: true,
      agendamento: {
        id: agendamento.id,
        codigo: agendamento.codigoConfirmacao,
        status: agendamento.status,
        profissional: disponibilidade.profissional.nome,
      },
    });
  } catch (erro) {
    return erroHttp(res, erro);
  }
});

export default router;
