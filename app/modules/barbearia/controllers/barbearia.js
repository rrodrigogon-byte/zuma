/**
 * ============================================================================
 * MÓDULO BARBEARIA - AGENDAMENTOS E SERVIÇOS
 * ============================================================================
 * Arquivo: modules/barbearia/controllers/barbearia.js
 * Descrição: Gerenciar agendamentos, serviços e clientes
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar agendamento
 */
export async function criarAgendamento(req, res) {
  try {
    const {
      empresa_id,
      cliente_nome,
      cliente_telefone,
      barbeiro_id,
      servico_id,
      data_agendamento,
      hora_agendamento,
      observacoes
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO agendamentos (
        empresa_id, cliente_nome, cliente_telefone, barbeiro_id, servico_id,
        data_agendamento, hora_agendamento, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        empresa_id,
        cliente_nome,
        cliente_telefone,
        barbeiro_id,
        servico_id,
        data_agendamento,
        hora_agendamento,
        'agendado',
        observacoes
      ]
    );

    res.json({
      sucesso: true,
      agendamento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Confirmar agendamento
 */
export async function confirmarAgendamento(req, res) {
  try {
    const { agendamento_id } = req.body;

    const result = await dbPg.query(
      `UPDATE agendamentos SET status = 'confirmado', data_confirmacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [agendamento_id]
    );

    res.json({
      sucesso: true,
      agendamento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Iniciar atendimento
 */
export async function iniciarAtendimento(req, res) {
  try {
    const { agendamento_id } = req.body;

    const result = await dbPg.query(
      `UPDATE agendamentos SET status = 'em_atendimento', data_inicio = NOW()
       WHERE id = $1
       RETURNING *`,
      [agendamento_id]
    );

    res.json({
      sucesso: true,
      agendamento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Finalizar atendimento
 */
export async function finalizarAtendimento(req, res) {
  try {
    const { agendamento_id, valor_servico, forma_pagamento } = req.body;

    const result = await dbPg.query(
      `UPDATE agendamentos SET status = 'finalizado', data_fim = NOW(), valor_servico = $1
       WHERE id = $2
       RETURNING *`,
      [valor_servico, agendamento_id]
    );

    // Registrar pagamento
    await dbPg.query(
      `INSERT INTO pagamentos (agendamento_id, forma, valor, status)
       VALUES ($1, $2, $3, $4)`,
      [agendamento_id, forma_pagamento, valor_servico, 'confirmado']
    );

    res.json({
      sucesso: true,
      agendamento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Cancelar agendamento
 */
export async function cancelarAgendamento(req, res) {
  try {
    const { agendamento_id, motivo } = req.body;

    const result = await dbPg.query(
      `UPDATE agendamentos SET status = 'cancelado', motivo_cancelamento = $1, data_cancelamento = NOW()
       WHERE id = $2
       RETURNING *`,
      [motivo, agendamento_id]
    );

    res.json({
      sucesso: true,
      agendamento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar agendamentos
 */
export async function listarAgendamentos(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data, barbeiro_id, status } = req.query;

    let query = `SELECT a.*, s.nome as servico_nome, s.duracao, b.nome as barbeiro_nome
                 FROM agendamentos a
                 JOIN servicos s ON a.servico_id = s.id
                 JOIN barbeiros b ON a.barbeiro_id = b.id
                 WHERE a.empresa_id = $1`;
    const params = [empresa_id];

    if (data) {
      query += ` AND DATE(a.data_agendamento) = $${params.length + 1}`;
      params.push(data);
    }

    if (barbeiro_id) {
      query += ` AND a.barbeiro_id = $${params.length + 1}`;
      params.push(barbeiro_id);
    }

    if (status) {
      query += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY a.data_agendamento, a.hora_agendamento`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      agendamentos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar serviço
 */
export async function criarServico(req, res) {
  try {
    const { empresa_id, nome, descricao, preco, duracao_minutos } = req.body;

    const result = await dbPg.query(
      `INSERT INTO servicos (empresa_id, nome, descricao, preco, duracao_minutos)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [empresa_id, nome, descricao, preco, duracao_minutos]
    );

    res.json({
      sucesso: true,
      servico: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar serviços
 */
export async function listarServicos(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT * FROM servicos WHERE empresa_id = $1 ORDER BY nome`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      servicos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter agenda do barbeiro
 */
export async function obterAgendaBarbeiro(req, res) {
  try {
    const { barbeiro_id } = req.params;
    const { data } = req.query;

    const result = await dbPg.query(
      `SELECT a.*, s.nome as servico_nome, s.duracao
       FROM agendamentos a
       JOIN servicos s ON a.servico_id = s.id
       WHERE a.barbeiro_id = $1
       AND DATE(a.data_agendamento) = $2
       AND a.status IN ('agendado', 'confirmado', 'em_atendimento')
       ORDER BY a.hora_agendamento`,
      [barbeiro_id, data]
    );

    res.json({
      sucesso: true,
      agendamentos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Relatório de faturamento
 */
export async function relatorioFaturamento(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data_inicio, data_fim } = req.query;

    const result = await dbPg.query(
      `SELECT
        DATE(a.data_fim) as data,
        b.nome as barbeiro,
        COUNT(a.id) as total_atendimentos,
        SUM(a.valor_servico) as faturamento
       FROM agendamentos a
       JOIN barbeiros b ON a.barbeiro_id = b.id
       WHERE a.empresa_id = $1
       AND a.status = 'finalizado'
       AND a.data_fim >= $2
       AND a.data_fim <= $3
       GROUP BY DATE(a.data_fim), b.nome
       ORDER BY DATE(a.data_fim) DESC`,
      [empresa_id, data_inicio, data_fim]
    );

    res.json({
      sucesso: true,
      relatorio: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarAgendamento,
  confirmarAgendamento,
  iniciarAtendimento,
  finalizarAtendimento,
  cancelarAgendamento,
  listarAgendamentos,
  criarServico,
  listarServicos,
  obterAgendaBarbeiro,
  relatorioFaturamento
};
