/**
 * Controllers do Módulo LOJA - PDV
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

// ============================================================================
// PDV - PONTO DE VENDA
// ============================================================================

/**
 * Obter carrinho
 */
export const obterCarrinho = async (req, res) => {
  try {
    const { sessao_id } = req.query;
    const tenantId = req.tenantId;

    // Buscar itens do carrinho em cache ou sessão
    // Para simplicidade, retornar array vazio
    res.json({
      sessao_id,
      itens: [],
      total_bruto: 0,
      total_desconto: 0,
      total_liquido: 0,
    });
  } catch (error) {
    console.error('Erro ao obter carrinho:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Adicionar item ao carrinho
 */
export const adicionarAoCarrinho = async (req, res) => {
  try {
    const { produto_id, quantidade, desconto_percentual = 0 } = req.body;
    const tenantId = req.tenantId;

    // Validar produto
    const produtoResult = await db.query(
      `
      SELECT * FROM produtos
      WHERE id = $1 AND estabelecimento_id = $2 AND ativo = true
      `,
      [produto_id, tenantId]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = produtoResult.rows[0];
    const valorTotal = quantidade * produto.valor_venda;
    const descontoValor = (valorTotal * desconto_percentual) / 100;

    res.json({
      produto_id,
      produto_nome: produto.nome,
      quantidade,
      valor_unitario: produto.valor_venda,
      valor_total: valorTotal,
      desconto_percentual,
      desconto_valor: descontoValor,
      valor_liquido: valorTotal - descontoValor,
    });
  } catch (error) {
    console.error('Erro ao adicionar ao carrinho:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar item do carrinho
 */
export const atualizarItemCarrinho = async (req, res) => {
  try {
    const { quantidade, desconto_percentual } = req.body;

    res.json({
      mensagem: 'Item atualizado',
      quantidade,
      desconto_percentual,
    });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Remover do carrinho
 */
export const removerDoCarrinho = async (req, res) => {
  try {
    res.json({ mensagem: 'Item removido do carrinho' });
  } catch (error) {
    console.error('Erro ao remover do carrinho:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Limpar carrinho
 */
export const limparCarrinho = async (req, res) => {
  try {
    res.json({ mensagem: 'Carrinho limpo' });
  } catch (error) {
    console.error('Erro ao limpar carrinho:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Finalizar venda
 */
export const finalizarVenda = async (req, res) => {
  try {
    const {
      itens,
      tipo_pagamento,
      valor_total,
      valor_desconto = 0,
      valor_acrescimo = 0,
    } = req.body;
    const tenantId = req.tenantId;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio' });
    }

    // Gerar número de venda
    const numVendaResult = await db.query(
      `
      SELECT MAX(numero_comanda) as max_numero
      FROM comandas
      WHERE estabelecimento_id = $1
      `,
      [tenantId]
    );

    const numVenda = (numVendaResult.rows[0].max_numero || 0) + 1;

    // Criar venda como comanda (compatível com estrutura existente)
    const vendaResult = await db.query(
      `
      INSERT INTO comandas (
        estabelecimento_id, numero_comanda, status, total_bruto, total_desconto, total_liquido
      )
      VALUES ($1, $2, 'fechada', $3, $4, $5)
      RETURNING *
      `,
      [tenantId, numVenda, valor_total, valor_desconto, valor_total - valor_desconto + valor_acrescimo]
    );

    const venda = vendaResult.rows[0];

    // Inserir itens da venda
    for (const item of itens) {
      await db.query(
        `
        INSERT INTO itens_comanda (
          comanda_id, produto_id, quantidade, valor_unitario, valor_total, status
        )
        VALUES ($1, $2, $3, $4, $5, 'servido')
        `,
        [venda.id, item.produto_id, item.quantidade, item.valor_unitario, item.valor_total]
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
      numero_venda: venda.numero_comanda,
      total: venda.total_liquido,
      data: venda.criado_em,
    });
  } catch (error) {
    console.error('Erro ao finalizar venda:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  obterCarrinho,
  adicionarAoCarrinho,
  atualizarItemCarrinho,
  removerDoCarrinho,
  limparCarrinho,
  finalizarVenda,
};
