/**
 * ============================================================================
 * MÓDULO SUPERMERCADO - AUTOATENDIMENTO E PESAGEM
 * ============================================================================
 * Arquivo: modules/supermercado/controllers/supermercado.js
 * Descrição: Gerenciar autoatendimento, pesagem e promoções
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Iniciar sessão de autoatendimento
 */
export async function iniciarSessaoAutoatendimento(req, res) {
  try {
    const { empresa_id, caixa_id } = req.body;

    const result = await dbPg.query(
      `INSERT INTO sessoes_autoatendimento (empresa_id, caixa_id, status, data_inicio)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [empresa_id, caixa_id, 'ativa']
    );

    res.json({
      sucesso: true,
      sessao: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Adicionar item via código de barras
 */
export async function adicionarItemPorCodigoBarras(req, res) {
  try {
    const { sessao_id, codigo_barras, quantidade } = req.body;

    // Buscar produto
    const produtoResult = await dbPg.query(
      `SELECT * FROM produtos WHERE codigo_barras = $1`,
      [codigo_barras]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Produto não encontrado' });
    }

    const produto = produtoResult.rows[0];
    const valor_total = produto.preco * quantidade;

    const result = await dbPg.query(
      `INSERT INTO itens_autoatendimento (sessao_id, produto_id, quantidade, preco_unitario, valor_total)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sessao_id, produto.id, quantidade, produto.preco, valor_total]
    );

    // Atualizar total da sessão
    await atualizarTotalSessao(sessao_id);

    res.json({
      sucesso: true,
      item: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Adicionar item pesado
 */
export async function adicionarItemPesado(req, res) {
  try {
    const { sessao_id, produto_id, peso_kg } = req.body;

    // Buscar produto
    const produtoResult = await dbPg.query(
      `SELECT * FROM produtos WHERE id = $1`,
      [produto_id]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Produto não encontrado' });
    }

    const produto = produtoResult.rows[0];
    const valor_total = produto.preco_kg * peso_kg;

    const result = await dbPg.query(
      `INSERT INTO itens_autoatendimento (sessao_id, produto_id, quantidade, peso_kg, preco_unitario, valor_total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sessao_id, produto_id, 1, peso_kg, produto.preco_kg, valor_total]
    );

    // Atualizar total da sessão
    await atualizarTotalSessao(sessao_id);

    res.json({
      sucesso: true,
      item: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Remover item
 */
export async function removerItem(req, res) {
  try {
    const { item_id, sessao_id } = req.body;

    await dbPg.query(
      `DELETE FROM itens_autoatendimento WHERE id = $1`,
      [item_id]
    );

    // Atualizar total da sessão
    await atualizarTotalSessao(sessao_id);

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Aplicar cupom de desconto
 */
export async function aplicarCupom(req, res) {
  try {
    const { sessao_id, codigo_cupom } = req.body;

    // Buscar cupom
    const cupomResult = await dbPg.query(
      `SELECT * FROM cupons WHERE codigo = $1 AND status = 'ativo'`,
      [codigo_cupom]
    );

    if (cupomResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Cupom inválido' });
    }

    const cupom = cupomResult.rows[0];

    // Atualizar sessão
    const result = await dbPg.query(
      `UPDATE sessoes_autoatendimento SET cupom_id = $1, desconto_cupom = $2
       WHERE id = $3
       RETURNING *`,
      [cupom.id, cupom.valor_desconto, sessao_id]
    );

    // Atualizar total
    await atualizarTotalSessao(sessao_id);

    res.json({
      sucesso: true,
      sessao: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Finalizar compra
 */
export async function finalizarCompra(req, res) {
  try {
    const { sessao_id, forma_pagamento } = req.body;

    // Obter sessão
    const sessaoResult = await dbPg.query(
      `SELECT * FROM sessoes_autoatendimento WHERE id = $1`,
      [sessao_id]
    );

    if (sessaoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Sessão não encontrada' });
    }

    const sessao = sessaoResult.rows[0];

    // Criar venda
    const vendaResult = await dbPg.query(
      `INSERT INTO vendas (empresa_id, operador_id, valor_total, desconto, status, data_venda)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [sessao.empresa_id, sessao.caixa_id, sessao.valor_total, sessao.desconto_cupom || 0, 'fechada']
    );

    const venda_id = vendaResult.rows[0].id;

    // Copiar itens para venda
    const itensResult = await dbPg.query(
      `SELECT * FROM itens_autoatendimento WHERE sessao_id = $1`,
      [sessao_id]
    );

    for (const item of itensResult.rows) {
      await dbPg.query(
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, valor_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [venda_id, item.produto_id, item.quantidade, item.preco_unitario, item.valor_total]
      );
    }

    // Registrar pagamento
    await dbPg.query(
      `INSERT INTO pagamentos (venda_id, forma, valor, status)
       VALUES ($1, $2, $3, $4)`,
      [venda_id, forma_pagamento, sessao.valor_total, 'confirmado']
    );

    // Finalizar sessão
    await dbPg.query(
      `UPDATE sessoes_autoatendimento SET status = 'finalizada', data_fim = NOW()
       WHERE id = $1`,
      [sessao_id]
    );

    res.json({
      sucesso: true,
      venda: vendaResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar promoções
 */
export async function listarPromocoes(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT * FROM promocoes
       WHERE empresa_id = $1 AND status = 'ativa'
       AND data_inicio <= NOW() AND data_fim >= NOW()
       ORDER BY data_inicio DESC`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      promocoes: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter sessão com itens
 */
export async function obterSessao(req, res) {
  try {
    const { sessao_id } = req.params;

    const sessaoResult = await dbPg.query(
      `SELECT * FROM sessoes_autoatendimento WHERE id = $1`,
      [sessao_id]
    );

    if (sessaoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Sessão não encontrada' });
    }

    const itensResult = await dbPg.query(
      `SELECT ia.*, p.nome, p.descricao FROM itens_autoatendimento ia
       JOIN produtos p ON ia.produto_id = p.id
       WHERE ia.sessao_id = $1`,
      [sessao_id]
    );

    res.json({
      sucesso: true,
      sessao: sessaoResult.rows[0],
      itens: itensResult.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Atualizar total da sessão
 */
async function atualizarTotalSessao(sessao_id) {
  const result = await dbPg.query(
    `SELECT SUM(valor_total) as total FROM itens_autoatendimento WHERE sessao_id = $1`,
    [sessao_id]
  );

  const total = result.rows[0].total || 0;
  const desconto = (await dbPg.query(
    `SELECT desconto_cupom FROM sessoes_autoatendimento WHERE id = $1`,
    [sessao_id]
  )).rows[0]?.desconto_cupom || 0;

  const valor_final = total - desconto;

  await dbPg.query(
    `UPDATE sessoes_autoatendimento SET valor_total = $1 WHERE id = $2`,
    [valor_final, sessao_id]
  );
}

export default {
  iniciarSessaoAutoatendimento,
  adicionarItemPorCodigoBarras,
  adicionarItemPesado,
  removerItem,
  aplicarCupom,
  finalizarCompra,
  listarPromocoes,
  obterSessao
};
