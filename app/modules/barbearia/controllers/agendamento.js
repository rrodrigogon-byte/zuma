/**
 * Controllers do Módulo BARBEARIA - Agendamento
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

// ============================================================================
// AGENDAMENTOS
// ============================================================================

/**
 * Listar agendamentos
 */
export const listarAgendamentos = async (req, res) => {
  try {
    const { data, barbeiro_id, status } = req.query;
    const tenantId = req.tenantId;

    let query = `
      SELECT a.*, u.nome as barbeiro_nome, s.nome as servico_nome, s.duracao_minutos
      FROM agendamentos a
      LEFT JOIN usuarios u ON a.barbeiro_id = u.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE a.estabelecimento_id = $1
    `;

    const values = [tenantId];
    let paramCount = 2;

    if (data) {
      query += ` AND DATE(a.data_hora) = $${paramCount}`;
      values.push(data);
      paramCount++;
    }

    if (barbeiro_id) {
      query += ` AND a.barbeiro_id = $${paramCount}`;
      values.push(barbeiro_id);
      paramCount++;
    }

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    query += ` ORDER BY a.data_hora ASC`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar agendamento
 */
export const criarAgendamento = async (req, res) => {
  try {
    const {
      cliente_nome,
      cliente_telefone,
      cliente_email,
      barbeiro_id,
      servico_id,
      data_hora,
      observacoes,
    } = req.body;
    const tenantId = req.tenantId;

    // Validar serviço
    const servicoResult = await db.query(
      `SELECT * FROM servicos WHERE id = $1 AND estabelecimento_id = $2`,
      [servico_id, tenantId]
    );

    if (servicoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    // Criar agendamento
    const result = await db.query(
      `
      INSERT INTO agendamentos (
        estabelecimento_id, cliente_nome, cliente_telefone, cliente_email,
        barbeiro_id, servico_id, data_hora, status, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'agendado', $8)
      RETURNING *
      `,
      [
        tenantId,
        cliente_nome,
        cliente_telefone,
        cliente_email,
        barbeiro_id || null,
        servico_id,
        data_hora,
        observacoes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter agendamento
 */
export const obterAgendamento = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT a.*, u.nome as barbeiro_nome, s.nome as servico_nome
      FROM agendamentos a
      LEFT JOIN usuarios u ON a.barbeiro_id = u.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE a.id = $1 AND a.estabelecimento_id = $2
      `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar agendamento
 */
export const atualizarAgendamento = async (req, res) => {
  try {
    const { id } = req.params;
    const { data_hora, barbeiro_id, observacoes } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE agendamentos
      SET data_hora = COALESCE($1, data_hora),
          barbeiro_id = COALESCE($2, barbeiro_id),
          observacoes = COALESCE($3, observacoes),
          atualizado_em = NOW()
      WHERE id = $4 AND estabelecimento_id = $5
      RETURNING *
      `,
      [data_hora || null, barbeiro_id || null, observacoes || null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Confirmar agendamento
 */
export const confirmarAgendamento = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE agendamentos
      SET status = 'confirmado', atualizado_em = NOW()
      WHERE id = $1 AND estabelecimento_id = $2
      RETURNING *
      `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancelar agendamento
 */
export const cancelarAgendamento = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE agendamentos
      SET status = 'cancelado',
          observacoes = COALESCE(observacoes || ' | ', '') || 'CANCELADO: ' || $1,
          atualizado_em = NOW()
      WHERE id = $2 AND estabelecimento_id = $3
      RETURNING *
      `,
      [motivo || 'Sem motivo', id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  listarAgendamentos,
  criarAgendamento,
  obterAgendamento,
  atualizarAgendamento,
  confirmarAgendamento,
  cancelarAgendamento,
};
