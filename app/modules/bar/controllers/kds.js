/**
 * Controllers do Módulo BAR - Kitchen Display System (KDS)
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

// ============================================================================
// KDS - KITCHEN DISPLAY SYSTEM
// ============================================================================

/**
 * Obter pedidos para o KDS
 */
export const obterPedidos = async (req, res) => {
  try {
    const { status, limite = 50 } = req.query;
    const tenantId = req.tenantId;

    let query = `
      SELECT 
        ic.id,
        ic.comanda_id,
        ic.produto_id,
        ic.quantidade,
        ic.observacoes,
        ic.status,
        ic.data_pedido,
        p.nome as produto_nome,
        c.numero_comanda,
        m.numero_mesa,
        EXTRACT(EPOCH FROM (NOW() - ic.data_pedido)) as tempo_decorrido_segundos
      FROM itens_comanda ic
      JOIN produtos p ON ic.produto_id = p.id
      JOIN comandas c ON ic.comanda_id = c.id
      LEFT JOIN mesas m ON c.mesa_id = m.id
      WHERE c.estabelecimento_id = $1
        AND c.status = 'aberta'
        AND ic.status != 'servido'
        AND ic.status != 'cancelado'
    `;

    const values = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND ic.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    query += ` ORDER BY ic.status ASC, ic.data_pedido ASC LIMIT $${paramCount}`;
    values.push(limite);

    const result = await db.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter pedidos do KDS:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar status do pedido no KDS
 */
export const atualizarStatusPedido = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;
    const tenantId = req.tenantId;

    // Validar status
    const statusValidos = ['pendente', 'preparando', 'pronto', 'servido', 'cancelado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    // Atualizar item
    const result = await db.query(
      `
      UPDATE itens_comanda
      SET status = $1,
          data_servido = CASE WHEN $1 = 'servido' THEN NOW() ELSE data_servido END,
          atualizado_em = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter resumo de pedidos para o KDS
 */
export const obterResumoPedidos = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT 
        ic.status,
        COUNT(*) as total,
        MIN(EXTRACT(EPOCH FROM (NOW() - ic.data_pedido))) as tempo_minimo_segundos,
        MAX(EXTRACT(EPOCH FROM (NOW() - ic.data_pedido))) as tempo_maximo_segundos,
        AVG(EXTRACT(EPOCH FROM (NOW() - ic.data_pedido))) as tempo_medio_segundos
      FROM itens_comanda ic
      JOIN comandas c ON ic.comanda_id = c.id
      WHERE c.estabelecimento_id = $1
        AND c.status = 'aberta'
        AND ic.status != 'servido'
        AND ic.status != 'cancelado'
      GROUP BY ic.status
      ORDER BY ic.status
      `,
      [tenantId]
    );

    // Calcular totais
    const resumo = {
      pendente: 0,
      preparando: 0,
      pronto: 0,
      total: 0,
      detalhes: result.rows,
    };

    result.rows.forEach((row) => {
      resumo.total += row.total;
      if (row.status === 'pendente') resumo.pendente = row.total;
      if (row.status === 'preparando') resumo.preparando = row.total;
      if (row.status === 'pronto') resumo.pronto = row.total;
    });

    res.json(resumo);
  } catch (error) {
    console.error('Erro ao obter resumo de pedidos:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  obterPedidos,
  atualizarStatusPedido,
  obterResumoPedidos,
};
