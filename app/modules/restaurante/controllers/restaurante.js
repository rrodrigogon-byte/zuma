/**
 * ============================================================================
 * MÓDULO RESTAURANTE - COMANDA, MESAS E DELIVERY
 * ============================================================================
 * Arquivo: modules/restaurante/controllers/restaurante.js
 * descrição: Gerenciar mesas, comandas, delivery e pedidos
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar mesa
 */
export async function criarMesa(req, res) {
  try {
    const { empresa_id, numero, capacidade, localizacao } = req.body;

    const result = await dbPg.query(
      `INSERT INTO mesas (empresa_id, numero, capacidade, localizacao, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [empresa_id, numero, capacidade, localizacao, 'disponivel']
    );

    res.json({
      sucesso: true,
      mesa: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Ocupar mesa
 */
export async function ocuparMesa(req, res) {
  try {
    const { mesa_id, garcom_id, numero_pessoas } = req.body;

    const result = await dbPg.query(
      `UPDATE mesas SET status = 'ocupada', garcom_id = $1, numero_pessoas = $2, data_ocupacao = NOW()
       WHERE id = $3
       RETURNING *`,
      [garcom_id, numero_pessoas, mesa_id]
    );

    res.json({
      sucesso: true,
      mesa: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Liberar mesa
 */
export async function liberarMesa(req, res) {
  try {
    const { mesa_id } = req.body;

    const result = await dbPg.query(
      `UPDATE mesas SET status = 'disponivel', garcom_id = NULL, numero_pessoas = 0, data_liberacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [mesa_id]
    );

    res.json({
      sucesso: true,
      mesa: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar pedido de delivery
 */
export async function criarPedidoDelivery(req, res) {
  try {
    const {
      empresa_id,
      cliente_nome,
      cliente_telefone,
      cliente_endereco,
      itens,
      observacoes,
      taxa_entrega
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO pedidos_delivery (
        empresa_id, cliente_nome, cliente_telefone, cliente_endereco,
        status, observacoes, taxa_entrega, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [empresa_id, cliente_nome, cliente_telefone, cliente_endereco, 'recebido', observacoes, taxa_entrega]
    );

    const pedido_id = result.rows[0].id;

    // Adicionar itens
    let valor_total = taxa_entrega || 0;

    for (const item of itens) {
      const produtoResult = await dbPg.query(
        `SELECT preco FROM produtos WHERE id = $1`,
        [item.produto_id]
      );

      const preco = produtoResult.rows[0].preco;
      const item_total = preco * item.quantidade;

      await dbPg.query(
        `INSERT INTO itens_pedido_delivery (pedido_id, produto_id, quantidade, preco_unitario, valor_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido_id, item.produto_id, item.quantidade, preco, item_total]
      );

      valor_total += item_total;
    }

    // Atualizar valor total
    await dbPg.query(
      `UPDATE pedidos_delivery SET valor_total = $1 WHERE id = $2`,
      [valor_total, pedido_id]
    );

    res.json({
      sucesso: true,
      pedido: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Atualizar status do pedido de delivery
 */
export async function atualizarStatusPedidoDelivery(req, res) {
  try {
    const { pedido_id, status } = req.body;

    const result = await dbPg.query(
      `UPDATE pedidos_delivery SET status = $1, data_atualizacao = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, pedido_id]
    );

    res.json({
      sucesso: true,
      pedido: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar mesas
 */
export async function listarMesas(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT m.*, COUNT(ic.id) as total_itens, SUM(ic.valor_total) as valor_total
       FROM mesas m
       LEFT JOIN comandas c ON m.id = c.mesa_id
       LEFT JOIN itens_comanda ic ON c.id = ic.comanda_id
       WHERE m.empresa_id = $1
       GROUP BY m.id
       ORDER BY m.numero`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      mesas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar pedidos de delivery
 */
export async function listarPedidosDelivery(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status } = req.query;

    let query = `SELECT * FROM pedidos_delivery WHERE empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY data_criacao DESC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      pedidos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter pedido com itens
 */
export async function obterPedidoDelivery(req, res) {
  try {
    const { pedido_id } = req.params;

    const pedidoResult = await dbPg.query(
      `SELECT * FROM pedidos_delivery WHERE id = $1`,
      [pedido_id]
    );

    if (pedidoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Pedido não encontrado' });
    }

    const itensResult = await dbPg.query(
      `SELECT ipd.*, p.nome FROM itens_pedido_delivery ipd
       JOIN produtos p ON ipd.produto_id = p.id
       WHERE ipd.pedido_id = $1`,
      [pedido_id]
    );

    res.json({
      sucesso: true,
      pedido: pedidoResult.rows[0],
      itens: itensResult.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarMesa,
  ocuparMesa,
  liberarMesa,
  criarPedidoDelivery,
  atualizarStatusPedidoDelivery,
  listarMesas,
  listarPedidosDelivery,
  obterPedidoDelivery
};
