/**
 * ============================================================================
 * ROTAS DE BARBEARIA — KYTTO ERP v4.0
 * ============================================================================
 * API completa para agenda inteligente, fila eletrônica, histórico de
 * clientes, avaliações e notificações.
 *
 * Contexto de autenticação obrigatório:
 * - req.empresaId (UUID)
 * - req.lojaId (UUID)
 * - req.usuario (usuario_id, role, empresa_id, loja_id)
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

// ============================================================================
// MIDDLEWARE: Validação de contexto de empresa
// ============================================================================

async function validarEmpresa(req, res, next) {
  try {
    const empresa = await dbPg.query(
      'SELECT id FROM empresas WHERE id = $1 AND ativa = true',
      [req.empresaId]
    );
    if (empresa.rows.length === 0) {
      return res.status(403).json({ erro: 'Empresa não encontrada ou inativa', codigo: 'EMPRESA_INVALIDA' });
    }
    next();
  } catch (error) {
    console.error('Erro ao validar empresa:', error);
    res.status(500).json({ erro: 'Erro ao validar contexto' });
  }
}

// ============================================================================
// 1. CLIENTES DE BARBEARIA
// ============================================================================

/**
 * GET /barbearia/clientes
 * Listar clientes da barbearia com filtro por nome, CPF ou telefone
 */
router.get('/clientes', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const { busca, limite = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM clientes_barbearia WHERE empresa_id = $1';
    const params = [req.empresaId];
    let paramIndex = 2;

    if (busca) {
      sql += ` AND (
        nome ILIKE $${paramIndex} OR
        cpf ILIKE $${paramIndex} OR
        telefone ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`;
      params.push(`%${busca}%`);
      paramIndex++;
    }

    sql += ` ORDER BY ultima_visita DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limite, offset);

    const result = await dbPg.query(sql, params);
    const countResult = await dbPg.query(
      `SELECT COUNT(*) as total FROM clientes_barbearia WHERE empresa_id = $1${busca ? ` AND (nome ILIKE $2 OR cpf ILIKE $2 OR telefone ILIKE $2 OR email ILIKE $2)` : ''}`,
      busca ? [req.empresaId, `%${busca}%`] : [req.empresaId]
    );

    res.json({
      sucesso: true,
      clientes: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limite: parseInt(limite, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

/**
 * GET /barbearia/clientes/:id
 * Obter detalhes de um cliente específico
 */
router.get('/clientes/:id', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const cliente = await dbPg.query(
      'SELECT * FROM clientes_barbearia WHERE id = $1 AND empresa_id = $2',
      [req.params.id, req.empresaId]
    );

    if (cliente.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json({ sucesso: true, cliente: cliente.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar cliente' });
  }
});

/**
 * POST /barbearia/clientes
 * Criar novo cliente
 */
router.post('/clientes', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const { nome, cpf, telefone, email, preferencias } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ erro: 'Nome e telefone são obrigatórios' });
    }

    const result = await dbPg.query(
      `INSERT INTO clientes_barbearia (empresa_id, nome, cpf, telefone, email, preferencias)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.empresaId, nome, cpf || null, telefone, email || null, JSON.stringify(preferencias || {})]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'clientes_barbearia',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, cliente: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'CPF ou telefone já cadastrado' });
    }
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

/**
 * PATCH /barbearia/clientes/:id
 * Atualizar dados de um cliente
 */
router.patch('/clientes/:id', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const { nome, email, preferencias } = req.body;
    const updates = {};

    if (nome) updates.nome = nome;
    if (email) updates.email = email;
    if (preferencias) updates.preferencias = JSON.stringify(preferencias);
    updates.data_atualizacao = new Date();

    const result = await dbPg.query(
      `UPDATE clientes_barbearia SET ${Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${Object.keys(updates).length + 1} AND empresa_id = $${Object.keys(updates).length + 2}
       RETURNING *`,
      [...Object.values(updates), req.params.id, req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'clientes_barbearia',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ sucesso: true, cliente: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ erro: 'Erro ao atualizar cliente' });
  }
});

// ============================================================================
// 2. BLOQUEIOS DE AGENDA
// ============================================================================

/**
 * GET /barbearia/bloqueios
 * Listar bloqueios de agenda
 */
router.get('/bloqueios', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const { profissional_id, data_inicio, data_fim } = req.query;
    let sql = 'SELECT * FROM agendamentos_bloqueios WHERE empresa_id = $1 AND ativo = true';
    const params = [req.empresaId];
    let paramIndex = 2;

    if (profissional_id) {
      sql += ` AND usuario_profissional_id = $${paramIndex++}`;
      params.push(profissional_id);
    }

    if (data_inicio && data_fim) {
      sql += ` AND data_inicio >= $${paramIndex} AND data_fim <= $${paramIndex + 1}`;
      params.push(data_inicio, data_fim);
      paramIndex += 2;
    }

    sql += ' ORDER BY data_inicio ASC';

    const result = await dbPg.query(sql, params);
    res.json({ sucesso: true, bloqueios: result.rows });
  } catch (error) {
    console.error('Erro ao listar bloqueios:', error);
    res.status(500).json({ erro: 'Erro ao listar bloqueios' });
  }
});

/**
 * POST /barbearia/bloqueios
 * Criar novo bloqueio de agenda
 */
router.post('/bloqueios', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const { usuario_profissional_id, data_inicio, data_fim, motivo, descricao, recorrente } = req.body;

    if (!usuario_profissional_id || !data_inicio || !data_fim || !motivo) {
      return res.status(400).json({ erro: 'Campos obrigatórios: usuario_profissional_id, data_inicio, data_fim, motivo' });
    }

    const result = await dbPg.query(
      `INSERT INTO agendamentos_bloqueios
       (empresa_id, usuario_profissional_id, data_inicio, data_fim, motivo, descricao, recorrente, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.empresaId, usuario_profissional_id, data_inicio, data_fim, motivo, descricao || null, recorrente || false, req.usuario.usuario_id]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'agendamentos_bloqueios',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, bloqueio: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar bloqueio:', error);
    res.status(500).json({ erro: 'Erro ao criar bloqueio' });
  }
});

/**
 * DELETE /barbearia/bloqueios/:id
 * Remover bloqueio de agenda
 */
router.delete('/bloqueios/:id', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      'UPDATE agendamentos_bloqueios SET ativo = false WHERE id = $1 AND empresa_id = $2 RETURNING *',
      [req.params.id, req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Bloqueio não encontrado' });
    }

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'agendamentos_bloqueios',
      operacao: 'DELETE',
      registro_id: req.params.id,
      dados_novo: { ativo: false },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ sucesso: true, mensagem: 'Bloqueio removido' });
  } catch (error) {
    console.error('Erro ao remover bloqueio:', error);
    res.status(500).json({ erro: 'Erro ao remover bloqueio' });
  }
});

// ============================================================================
// 3. FILA DE ATENDIMENTO
// ============================================================================

/**
 * GET /barbearia/fila
 * Listar fila de atendimento em tempo real
 */
router.get('/fila', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const { status = 'aguardando' } = req.query;

    const result = await dbPg.query(
      `SELECT f.*, a.data_agendamento, a.servico_id, a.usuario_profissional_id, a.cliente_nome
       FROM fila_atendimento f
       JOIN agendamentos a ON f.agendamento_id = a.id
       WHERE f.empresa_id = $1 AND f.status = $2
       ORDER BY f.posicao ASC`,
      [req.empresaId, status]
    );

    res.json({ sucesso: true, fila: result.rows });
  } catch (error) {
    console.error('Erro ao listar fila:', error);
    res.status(500).json({ erro: 'Erro ao listar fila' });
  }
});

/**
 * POST /barbearia/fila/:agendamento_id/entrar
 * Cliente entra na fila
 */
router.post('/fila/:agendamento_id/entrar', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const { agendamento_id } = req.params;

    // Buscar próxima posição
    const maxPosicao = await dbPg.query(
      'SELECT COALESCE(MAX(posicao), 0) as max_posicao FROM fila_atendimento WHERE empresa_id = $1 AND status IN (\'aguardando\', \'chamado\')',
      [req.empresaId]
    );

    const posicao = maxPosicao.rows[0].max_posicao + 1;

    const result = await dbPg.query(
      `INSERT INTO fila_atendimento (empresa_id, agendamento_id, posicao, chegou_em)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [req.empresaId, agendamento_id, posicao]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'fila_atendimento',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, fila: result.rows[0] });
  } catch (error) {
    console.error('Erro ao entrar na fila:', error);
    res.status(500).json({ erro: 'Erro ao entrar na fila' });
  }
});

/**
 * PATCH /barbearia/fila/:id/chamar
 * Chamar próximo cliente da fila
 */
router.patch('/fila/:id/chamar', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      `UPDATE fila_atendimento SET status = 'chamado', chamado_em = NOW()
       WHERE id = $1 AND empresa_id = $2
       RETURNING *`,
      [req.params.id, req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Fila não encontrada' });
    }

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'fila_atendimento',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ sucesso: true, fila: result.rows[0] });
  } catch (error) {
    console.error('Erro ao chamar cliente:', error);
    res.status(500).json({ erro: 'Erro ao chamar cliente' });
  }
});

/**
 * PATCH /barbearia/fila/:id/concluir
 * Concluir atendimento
 */
router.patch('/fila/:id/concluir', autenticar, autorizar('admin', 'gerente', 'barbeiro'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      `UPDATE fila_atendimento SET status = 'concluido', concluido_em = NOW(),
       tempo_espera_minutos = EXTRACT(EPOCH FROM (NOW() - chegou_em)) / 60
       WHERE id = $1 AND empresa_id = $2
       RETURNING *`,
      [req.params.id, req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Fila não encontrada' });
    }

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'fila_atendimento',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ sucesso: true, fila: result.rows[0] });
  } catch (error) {
    console.error('Erro ao concluir atendimento:', error);
    res.status(500).json({ erro: 'Erro ao concluir atendimento' });
  }
});

// ============================================================================
// 4. AVALIAÇÕES DE SERVIÇO
// ============================================================================

/**
 * POST /barbearia/avaliacoes
 * Registrar avaliação pós-atendimento
 */
router.post('/avaliacoes', autenticar, autorizar('admin', 'gerente', 'barbeiro', 'cliente'), validarEmpresa, async (req, res) => {
  try {
    const { agendamento_id, cliente_barbearia_id, nota_geral, nota_atendimento, nota_pontualidade, nota_limpeza, comentario, recomendaria } = req.body;

    if (!agendamento_id || !nota_geral) {
      return res.status(400).json({ erro: 'agendamento_id e nota_geral são obrigatórios' });
    }

    const result = await dbPg.query(
      `INSERT INTO avaliacoes_servico
       (empresa_id, agendamento_id, cliente_barbearia_id, nota_geral, nota_atendimento, nota_pontualidade, nota_limpeza, comentario, recomendaria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.empresaId, agendamento_id, cliente_barbearia_id || null, nota_geral, nota_atendimento || null, nota_pontualidade || null, nota_limpeza || null, comentario || null, recomendaria || null]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'avaliacoes_servico',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, avaliacao: result.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar avaliação:', error);
    res.status(500).json({ erro: 'Erro ao registrar avaliação' });
  }
});

/**
 * GET /barbearia/avaliacoes/nps
 * Relatório de NPS e satisfação
 */
router.get('/avaliacoes/nps', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT
        COUNT(*) as total_avaliacoes,
        AVG(nota_geral) as media_geral,
        AVG(nota_atendimento) as media_atendimento,
        AVG(nota_pontualidade) as media_pontualidade,
        AVG(nota_limpeza) as media_limpeza,
        SUM(CASE WHEN recomendaria = true THEN 1 ELSE 0 END) as recomendariam,
        SUM(CASE WHEN recomendaria = false THEN 1 ELSE 0 END) as nao_recomendariam
       FROM avaliacoes_servico
       WHERE empresa_id = $1 AND data_avaliacao >= CURRENT_DATE - INTERVAL '30 days'`,
      [req.empresaId]
    );

    const stats = result.rows[0];
    const nps = stats.total_avaliacoes > 0
      ? ((stats.recomendariam - stats.nao_recomendariam) / stats.total_avaliacoes) * 100
      : 0;

    res.json({
      sucesso: true,
      nps: Math.round(nps),
      ...stats,
    });
  } catch (error) {
    console.error('Erro ao calcular NPS:', error);
    res.status(500).json({ erro: 'Erro ao calcular NPS' });
  }
});

// ============================================================================
// 5. NOTIFICAÇÕES
// ============================================================================

/**
 * POST /barbearia/notificacoes
 * Criar notificação (SMS, WhatsApp, email, push)
 */
router.post('/notificacoes', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const { agendamento_id, cliente_barbearia_id, tipo, canal, conteudo, destinatario } = req.body;

    if (!agendamento_id || !tipo || !canal || !conteudo || !destinatario) {
      return res.status(400).json({ erro: 'Campos obrigatórios: agendamento_id, tipo, canal, conteudo, destinatario' });
    }

    const result = await dbPg.query(
      `INSERT INTO notificacoes_barbearia
       (empresa_id, agendamento_id, cliente_barbearia_id, tipo, canal, conteudo, destinatario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.empresaId, agendamento_id, cliente_barbearia_id || null, tipo, canal, conteudo, destinatario]
    );

    // TODO: Integrar com Twilio, AWS SNS ou serviço de notificação real
    // Por enquanto, apenas registrar no banco
    console.log(`[NOTIFICAÇÃO] ${canal.toUpperCase()} para ${destinatario}: ${conteudo}`);

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'notificacoes_barbearia',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, notificacao: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    res.status(500).json({ erro: 'Erro ao criar notificação' });
  }
});

/**
 * GET /barbearia/notificacoes/pendentes
 * Listar notificações pendentes de envio
 */
router.get('/notificacoes/pendentes', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT * FROM notificacoes_barbearia
       WHERE empresa_id = $1 AND status = 'pendente'
       ORDER BY data_criacao ASC
       LIMIT 100`,
      [req.empresaId]
    );

    res.json({ sucesso: true, notificacoes: result.rows });
  } catch (error) {
    console.error('Erro ao listar notificações pendentes:', error);
    res.status(500).json({ erro: 'Erro ao listar notificações' });
  }
});

/**
 * PATCH /barbearia/notificacoes/:id/marcar-enviado
 * Marcar notificação como enviada
 */
router.patch('/notificacoes/:id/marcar-enviado', autenticar, autorizar('admin', 'gerente'), validarEmpresa, async (req, res) => {
  try {
    const result = await dbPg.query(
      `UPDATE notificacoes_barbearia SET status = 'enviado', enviado_em = NOW()
       WHERE id = $1 AND empresa_id = $2
       RETURNING *`,
      [req.params.id, req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Notificação não encontrada' });
    }

    res.json({ sucesso: true, notificacao: result.rows[0] });
  } catch (error) {
    console.error('Erro ao marcar notificação como enviada:', error);
    res.status(500).json({ erro: 'Erro ao atualizar notificação' });
  }
});

export default router;
