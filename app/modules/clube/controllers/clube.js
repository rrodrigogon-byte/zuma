/**
 * ============================================================================
 * MÓDULO CLUBE - EVENTOS, MEMBROS E MENSALIDADES
 * ============================================================================
 * Arquivo: modules/clube/controllers/clube.js
 * Descrição: Gerenciar membros, eventos, mensalidades e reservas
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar membro
 */
export async function criarMembro(req, res) {
  try {
    const {
      empresa_id,
      nome,
      cpf,
      email,
      telefone,
      endereco,
      plano_id,
      data_inicio
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO membros_clube (
        empresa_id, nome, cpf, email, telefone, endereco,
        plano_id, data_inicio, status, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [empresa_id, nome, cpf, email, telefone, endereco, plano_id, data_inicio, 'ativo']
    );

    // Registrar primeira mensalidade
    const planoResult = await dbPg.query(
      `SELECT valor FROM planos_clube WHERE id = $1`,
      [plano_id]
    );

    if (planoResult.rows.length > 0) {
      await dbPg.query(
        `INSERT INTO mensalidades_clube (membro_id, valor, data_vencimento, status)
         VALUES ($1, $2, $3, $4)`,
        [result.rows[0].id, planoResult.rows[0].valor, data_inicio, 'pendente']
      );
    }

    res.json({
      sucesso: true,
      membro: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Atualizar membro
 */
export async function atualizarMembro(req, res) {
  try {
    const { membro_id } = req.params;
    const { nome, email, telefone, endereco, plano_id } = req.body;

    const result = await dbPg.query(
      `UPDATE membros_clube SET nome = $1, email = $2, telefone = $3, endereco = $4, plano_id = $5
       WHERE id = $6
       RETURNING *`,
      [nome, email, telefone, endereco, plano_id, membro_id]
    );

    res.json({
      sucesso: true,
      membro: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Cancelar membro
 */
export async function cancelarMembro(req, res) {
  try {
    const { membro_id, motivo } = req.body;

    const result = await dbPg.query(
      `UPDATE membros_clube SET status = 'cancelado', motivo_cancelamento = $1, data_cancelamento = NOW()
       WHERE id = $2
       RETURNING *`,
      [motivo, membro_id]
    );

    res.json({
      sucesso: true,
      membro: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Pagar mensalidade
 */
export async function pagarMensalidade(req, res) {
  try {
    const { mensalidade_id, forma_pagamento, data_pagamento } = req.body;

    const result = await dbPg.query(
      `UPDATE mensalidades_clube SET status = 'paga', forma_pagamento = $1, data_pagamento = $2
       WHERE id = $3
       RETURNING *`,
      [forma_pagamento, data_pagamento || new Date(), mensalidade_id]
    );

    res.json({
      sucesso: true,
      mensalidade: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar membros
 */
export async function listarMembros(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status } = req.query;

    let query = `SELECT m.*, p.nome as plano_nome
                 FROM membros_clube m
                 JOIN planos_clube p ON m.plano_id = p.id
                 WHERE m.empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND m.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY m.nome`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      membros: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar evento
 */
export async function criarEvento(req, res) {
  try {
    const {
      empresa_id,
      nome,
      descricao,
      data_evento,
      hora_inicio,
      hora_fim,
      local,
      capacidade_maxima,
      valor_entrada
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO eventos_clube (
        empresa_id, nome, descricao, data_evento, hora_inicio, hora_fim,
        local, capacidade_maxima, valor_entrada, status, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        empresa_id,
        nome,
        descricao,
        data_evento,
        hora_inicio,
        hora_fim,
        local,
        capacidade_maxima,
        valor_entrada,
        'planejado'
      ]
    );

    res.json({
      sucesso: true,
      evento: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Inscrever membro em evento
 */
export async function inscreverMembro(req, res) {
  try {
    const { evento_id, membro_id } = req.body;

    // Verificar capacidade
    const eventoResult = await dbPg.query(
      `SELECT COUNT(*) as total FROM inscricoes_evento WHERE evento_id = $1`,
      [evento_id]
    );

    const capacidadeResult = await dbPg.query(
      `SELECT capacidade_maxima FROM eventos_clube WHERE id = $1`,
      [evento_id]
    );

    if (eventoResult.rows[0].total >= capacidadeResult.rows[0].capacidade_maxima) {
      return res.status(400).json({ sucesso: false, erro: 'Evento lotado' });
    }

    const result = await dbPg.query(
      `INSERT INTO inscricoes_evento (evento_id, membro_id, data_inscricao, status)
       VALUES ($1, $2, NOW(), $3)
       RETURNING *`,
      [evento_id, membro_id, 'confirmada']
    );

    res.json({
      sucesso: true,
      inscricao: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Cancelar inscrição
 */
export async function cancelarInscricao(req, res) {
  try {
    const { inscricao_id } = req.body;

    const result = await dbPg.query(
      `UPDATE inscricoes_evento SET status = 'cancelada', data_cancelamento = NOW()
       WHERE id = $1
       RETURNING *`,
      [inscricao_id]
    );

    res.json({
      sucesso: true,
      inscricao: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar eventos
 */
export async function listarEventos(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status } = req.query;

    let query = `SELECT e.*, COUNT(ie.id) as total_inscritos
                 FROM eventos_clube e
                 LEFT JOIN inscricoes_evento ie ON e.id = ie.evento_id
                 WHERE e.empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND e.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` GROUP BY e.id ORDER BY e.data_evento DESC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      eventos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter inscritos em evento
 */
export async function obterInscritos(req, res) {
  try {
    const { evento_id } = req.params;

    const result = await dbPg.query(
      `SELECT ie.*, m.nome, m.email, m.telefone
       FROM inscricoes_evento ie
       JOIN membros_clube m ON ie.membro_id = m.id
       WHERE ie.evento_id = $1 AND ie.status = 'confirmada'
       ORDER BY ie.data_inscricao`,
      [evento_id]
    );

    res.json({
      sucesso: true,
      inscritos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar reserva de espaço
 */
export async function criarReserva(req, res) {
  try {
    const {
      empresa_id,
      membro_id,
      espaco_id,
      data_inicio,
      data_fim,
      observacoes
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO reservas_espaco (
        empresa_id, membro_id, espaco_id, data_inicio, data_fim,
        status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [empresa_id, membro_id, espaco_id, data_inicio, data_fim, 'confirmada', observacoes]
    );

    res.json({
      sucesso: true,
      reserva: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Cancelar reserva
 */
export async function cancelarReserva(req, res) {
  try {
    const { reserva_id, motivo } = req.body;

    const result = await dbPg.query(
      `UPDATE reservas_espaco SET status = 'cancelada', motivo_cancelamento = $1, data_cancelamento = NOW()
       WHERE id = $2
       RETURNING *`,
      [motivo, reserva_id]
    );

    res.json({
      sucesso: true,
      reserva: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar reservas
 */
export async function listarReservas(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data_inicio, data_fim } = req.query;

    let query = `SELECT r.*, m.nome as membro_nome, e.nome as espaco_nome
                 FROM reservas_espaco r
                 JOIN membros_clube m ON r.membro_id = m.id
                 JOIN espacos_clube e ON r.espaco_id = e.id
                 WHERE r.empresa_id = $1`;
    const params = [empresa_id];

    if (data_inicio) {
      query += ` AND r.data_inicio >= $${params.length + 1}`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND r.data_fim <= $${params.length + 1}`;
      params.push(data_fim);
    }

    query += ` ORDER BY r.data_inicio DESC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      reservas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarMembro,
  atualizarMembro,
  cancelarMembro,
  pagarMensalidade,
  listarMembros,
  criarEvento,
  inscreverMembro,
  cancelarInscricao,
  listarEventos,
  obterInscritos,
  criarReserva,
  cancelarReserva,
  listarReservas
};
