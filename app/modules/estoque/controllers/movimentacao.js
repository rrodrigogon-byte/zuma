/**
 * Controllers do Módulo ESTOQUE - Movimentação
 * SetPoint Ultra - Entrada, saída, ajuste, rastreabilidade
 */

import { db } from '../../../core/database.js';

// ============================================================================
// ENTRADA DE ESTOQUE
// ============================================================================

/**
 * Registrar entrada de estoque
 */
export const registrarEntrada = async (req, res) => {
  try {
    const {
      tipo_documento,
      numero_documento,
      fornecedor_id,
      data_entrada,
      itens,
      observacoes,
    } = req.body;
    const tenantId = req.tenantId;

    // Validar itens
    if (!itens || itens.length === 0) {
      return res.status(400).json({ error: 'Nenhum item informado' });
    }

    // Criar entrada
    const entradaResult = await db.query(
      `
      INSERT INTO movimentacoes_estoque (
        estabelecimento_id, tipo_movimentacao, tipo_documento,
        numero_documento, fornecedor_id, data_movimentacao, observacoes, status
      )
      VALUES ($1, 'entrada', $2, $3, $4, $5, $6, 'pendente')
      RETURNING *
      `,
      [tenantId, tipo_documento, numero_documento, fornecedor_id, data_entrada, observacoes]
    );

    const entrada = entradaResult.rows[0];

    // Inserir itens da entrada
    for (const item of itens) {
      await db.query(
        `
        INSERT INTO itens_movimentacao_estoque (
          movimentacao_id, produto_id, quantidade, valor_unitario,
          lote, validade, origem
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          entrada.id,
          item.produto_id,
          item.quantidade,
          item.valor_unitario,
          item.lote || null,
          item.validade || null,
          item.origem || 'fornecedor',
        ]
      );

      // Atualizar estoque do produto
      await db.query(
        `
        UPDATE produtos
        SET estoque_atual = estoque_atual + $1,
            valor_custo = $2
        WHERE id = $3
        `,
        [item.quantidade, item.valor_unitario, item.produto_id]
      );
    }

    res.status(201).json({
      entrada,
      itens_inseridos: itens.length,
    });
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// SAÍDA DE ESTOQUE
// ============================================================================

/**
 * Registrar saída de estoque
 */
export const registrarSaida = async (req, res) => {
  try {
    const {
      tipo_documento,
      numero_documento,
      itens,
      motivo,
      observacoes,
    } = req.body;
    const tenantId = req.tenantId;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ error: 'Nenhum item informado' });
    }

    // Criar saída
    const saidaResult = await db.query(
      `
      INSERT INTO movimentacoes_estoque (
        estabelecimento_id, tipo_movimentacao, tipo_documento,
        numero_documento, motivo, data_movimentacao, observacoes, status
      )
      VALUES ($1, 'saida', $2, $3, $4, NOW(), $5, 'concluida')
      RETURNING *
      `,
      [tenantId, tipo_documento, numero_documento, motivo, observacoes]
    );

    const saida = saidaResult.rows[0];

    // Inserir itens da saída
    for (const item of itens) {
      // Validar estoque
      const produtoResult = await db.query(
        `
        SELECT estoque_atual FROM produtos
        WHERE id = $1 AND estabelecimento_id = $2
        `,
        [item.produto_id, tenantId]
      );

      if (produtoResult.rows.length === 0) {
        throw new Error(`Produto ${item.produto_id} não encontrado`);
      }

      const estoque = produtoResult.rows[0].estoque_atual;
      if (estoque < item.quantidade) {
        throw new Error(
          `Estoque insuficiente para produto ${item.produto_id}. Disponível: ${estoque}`
        );
      }

      // Inserir item
      await db.query(
        `
        INSERT INTO itens_movimentacao_estoque (
          movimentacao_id, produto_id, quantidade, lote, destino
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [saida.id, item.produto_id, item.quantidade, item.lote || null, item.destino || 'venda']
      );

      // Atualizar estoque
      await db.query(
        `
        UPDATE produtos
        SET estoque_atual = estoque_atual - $1
        WHERE id = $2
        `,
        [item.quantidade, item.produto_id]
      );
    }

    res.status(201).json({
      saida,
      itens_inseridos: itens.length,
    });
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// AJUSTE DE ESTOQUE
// ============================================================================

/**
 * Registrar ajuste de estoque
 */
export const registrarAjuste = async (req, res) => {
  try {
    const { produto_id, quantidade_atual, quantidade_corrigida, motivo } = req.body;
    const tenantId = req.tenantId;

    // Obter produto
    const produtoResult = await db.query(
      `
      SELECT * FROM produtos
      WHERE id = $1 AND estabelecimento_id = $2
      `,
      [produto_id, tenantId]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = produtoResult.rows[0];
    const diferenca = quantidade_corrigida - quantidade_atual;

    // Criar ajuste
    const ajusteResult = await db.query(
      `
      INSERT INTO movimentacoes_estoque (
        estabelecimento_id, tipo_movimentacao, motivo,
        data_movimentacao, observacoes, status
      )
      VALUES ($1, 'ajuste', $2, NOW(), $3, 'concluida')
      RETURNING *
      `,
      [tenantId, motivo, `Ajuste de ${produto.nome}`]
    );

    const ajuste = ajusteResult.rows[0];

    // Inserir item do ajuste
    await db.query(
      `
      INSERT INTO itens_movimentacao_estoque (
        movimentacao_id, produto_id, quantidade
      )
      VALUES ($1, $2, $3)
      `,
      [ajuste.id, produto_id, diferenca]
    );

    // Atualizar estoque
    await db.query(
      `
      UPDATE produtos
      SET estoque_atual = $1
      WHERE id = $2
      `,
      [quantidade_corrigida, produto_id]
    );

    res.status(201).json({
      ajuste,
      diferenca,
      estoque_anterior: quantidade_atual,
      estoque_novo: quantidade_corrigida,
    });
  } catch (error) {
    console.error('Erro ao registrar ajuste:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// HISTÓRICO E RASTREABILIDADE
// ============================================================================

/**
 * Obter histórico de movimentações
 */
export const obterHistorico = async (req, res) => {
  try {
    const { produto_id, data_inicio, data_fim, tipo } = req.query;
    const tenantId = req.tenantId;

    let query = `
      SELECT me.*, p.nome as produto_nome, u.nome as usuario_nome
      FROM movimentacoes_estoque me
      LEFT JOIN itens_movimentacao_estoque ime ON me.id = ime.movimentacao_id
      LEFT JOIN produtos p ON ime.produto_id = p.id
      LEFT JOIN usuarios u ON me.usuario_id = u.id
      WHERE me.estabelecimento_id = $1
    `;

    const values = [tenantId];
    let paramCount = 2;

    if (produto_id) {
      query += ` AND ime.produto_id = $${paramCount}`;
      values.push(produto_id);
      paramCount++;
    }

    if (tipo) {
      query += ` AND me.tipo_movimentacao = $${paramCount}`;
      values.push(tipo);
      paramCount++;
    }

    if (data_inicio) {
      query += ` AND me.data_movimentacao >= $${paramCount}`;
      values.push(data_inicio);
      paramCount++;
    }

    if (data_fim) {
      query += ` AND me.data_movimentacao <= $${paramCount}`;
      values.push(data_fim);
      paramCount++;
    }

    query += ` ORDER BY me.data_movimentacao DESC LIMIT 100`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Rastrear lote de produto
 */
export const rastrearLote = async (req, res) => {
  try {
    const { produto_id, lote } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT ime.*, me.tipo_movimentacao, me.data_movimentacao,
             me.numero_documento, me.fornecedor_id
      FROM itens_movimentacao_estoque ime
      JOIN movimentacoes_estoque me ON ime.movimentacao_id = me.id
      WHERE me.estabelecimento_id = $1
        AND ime.produto_id = $2
        AND ime.lote = $3
      ORDER BY me.data_movimentacao DESC
      `,
      [tenantId, produto_id, lote]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao rastrear lote:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  registrarEntrada,
  registrarSaida,
  registrarAjuste,
  obterHistorico,
  rastrearLote,
};
