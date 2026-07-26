/**
 * Controllers do Módulo BARBEARIA - Serviço
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

/**
 * Listar serviços
 */
export const listarServicos = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT * FROM servicos
      WHERE estabelecimento_id = $1 AND ativo = true
      ORDER BY nome
      `,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar serviços:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar serviço
 */
export const criarServico = async (req, res) => {
  try {
    const {
      nome,
      descricao,
      preco,
      duracao_minutos,
      categoria,
    } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      INSERT INTO servicos (
        estabelecimento_id, nome, descricao, preco, duracao_minutos, categoria, ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
      `,
      [tenantId, nome, descricao || null, preco, duracao_minutos, categoria || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar serviço
 */
export const atualizarServico = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, preco, duracao_minutos, categoria, ativo } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE servicos
      SET nome = COALESCE($1, nome),
          descricao = COALESCE($2, descricao),
          preco = COALESCE($3, preco),
          duracao_minutos = COALESCE($4, duracao_minutos),
          categoria = COALESCE($5, categoria),
          ativo = COALESCE($6, ativo),
          atualizado_em = NOW()
      WHERE id = $7 AND estabelecimento_id = $8
      RETURNING *
      `,
      [nome || null, descricao || null, preco || null, duracao_minutos || null, categoria || null, ativo !== undefined ? ativo : null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Deletar serviço
 */
export const deletarServico = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE servicos
      SET ativo = false, atualizado_em = NOW()
      WHERE id = $1 AND estabelecimento_id = $2
      RETURNING *
      `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    res.json({ mensagem: 'Serviço deletado' });
  } catch (error) {
    console.error('Erro ao deletar serviço:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  listarServicos,
  criarServico,
  atualizarServico,
  deletarServico,
};
