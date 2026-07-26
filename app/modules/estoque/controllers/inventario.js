/**
 * Controllers do Módulo ESTOQUE - Inventário
 * SetPoint Ultra - Contagem cíclica, divergências, auditoria
 */

import { db } from '../../../core/database.js';

// ============================================================================
// INVENTÁRIO
// ============================================================================

/**
 * Criar novo inventário
 */
export const criarInventario = async (req, res) => {
  try {
    const { tipo, data_inicio, observacoes, produtos_selecionados } = req.body;
    const tenantId = req.tenantId;

    // Criar inventário
    const inventarioResult = await db.query(
      `
      INSERT INTO inventarios (
        estabelecimento_id, tipo, data_inicio, status, observacoes
      )
      VALUES ($1, $2, $3, 'em_progresso', $4)
      RETURNING *
      `,
      [tenantId, tipo || 'completo', data_inicio || new Date(), observacoes]
    );

    const inventario = inventarioResult.rows[0];

    // Selecionar produtos para contar
    let query = `
      SELECT id, nome, estoque_atual FROM produtos
      WHERE estabelecimento_id = $1 AND ativo = true
    `;

    const values = [tenantId];

    if (produtos_selecionados && produtos_selecionados.length > 0) {
      query += ` AND id = ANY($2)`;
      values.push(produtos_selecionados);
    }

    const produtosResult = await db.query(query, values);

    // Inserir itens do inventário
    for (const produto of produtosResult.rows) {
      await db.query(
        `
        INSERT INTO itens_inventario (
          inventario_id, produto_id, estoque_sistema, estoque_contado
        )
        VALUES ($1, $2, $3, NULL)
        `,
        [inventario.id, produto.id, produto.estoque_atual]
      );
    }

    res.status(201).json({
      inventario,
      total_produtos: produtosResult.rows.length,
    });
  } catch (error) {
    console.error('Erro ao criar inventário:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Registrar contagem de item
 */
export const registrarContagem = async (req, res) => {
  try {
    const { inventario_id, produto_id, estoque_contado } = req.body;
    const tenantId = req.tenantId;

    // Obter item do inventário
    const itemResult = await db.query(
      `
      SELECT ii.*, i.estabelecimento_id
      FROM itens_inventario ii
      JOIN inventarios i ON ii.inventario_id = i.id
      WHERE ii.inventario_id = $1 AND ii.produto_id = $2
      `,
      [inventario_id, produto_id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const item = itemResult.rows[0];

    // Calcular divergência
    const divergencia = estoque_contado - item.estoque_sistema;
    const percentual_divergencia = (Math.abs(divergencia) / item.estoque_sistema) * 100;

    // Atualizar item
    const result = await db.query(
      `
      UPDATE itens_inventario
      SET estoque_contado = $1,
          divergencia = $2,
          percentual_divergencia = $3,
          data_contagem = NOW(),
          contado = true
      WHERE inventario_id = $4 AND produto_id = $5
      RETURNING *
      `,
      [estoque_contado, divergencia, percentual_divergencia, inventario_id, produto_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao registrar contagem:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Finalizar inventário
 */
export const finalizarInventario = async (req, res) => {
  try {
    const { inventario_id } = req.params;
    const tenantId = req.tenantId;

    // Obter inventário
    const inventarioResult = await db.query(
      `
      SELECT * FROM inventarios
      WHERE id = $1 AND estabelecimento_id = $2
      `,
      [inventario_id, tenantId]
    );

    if (inventarioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inventário não encontrado' });
    }

    // Calcular divergências
    const divergenciasResult = await db.query(
      `
      SELECT 
        COUNT(*) as total_itens,
        SUM(CASE WHEN divergencia != 0 THEN 1 ELSE 0 END) as itens_com_divergencia,
        SUM(ABS(divergencia)) as total_divergencia,
        AVG(percentual_divergencia) as percentual_medio
      FROM itens_inventario
      WHERE inventario_id = $1
      `,
      [inventario_id]
    );

    const divergencias = divergenciasResult.rows[0];

    // Atualizar estoque com base na contagem
    const itensResult = await db.query(
      `
      SELECT * FROM itens_inventario
      WHERE inventario_id = $1 AND contado = true
      `,
      [inventario_id]
    );

    for (const item of itensResult.rows) {
      await db.query(
        `
        UPDATE produtos
        SET estoque_atual = $1
        WHERE id = $2
        `,
        [item.estoque_contado, item.produto_id]
      );
    }

    // Finalizar inventário
    const result = await db.query(
      `
      UPDATE inventarios
      SET status = 'finalizado',
          data_finalizacao = NOW(),
          total_itens = $1,
          itens_com_divergencia = $2,
          total_divergencia = $3
      WHERE id = $4
      RETURNING *
      `,
      [divergencias.total_itens, divergencias.itens_com_divergencia, divergencias.total_divergencia, inventario_id]
    );

    res.json({
      inventario: result.rows[0],
      divergencias,
    });
  } catch (error) {
    console.error('Erro ao finalizar inventário:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter divergências
 */
export const obterDivergencias = async (req, res) => {
  try {
    const { inventario_id } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT ii.*, p.nome as produto_nome, p.sku
      FROM itens_inventario ii
      JOIN produtos p ON ii.produto_id = p.id
      WHERE ii.inventario_id = $1
        AND ii.divergencia != 0
      ORDER BY ABS(ii.divergencia) DESC
      `,
      [inventario_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter divergências:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  criarInventario,
  registrarContagem,
  finalizarInventario,
  obterDivergencias,
};
