/**
 * ============================================================================
 * MÓDULO ESTOQUE AVANÇADO - ENTRADA NF-e/MANUAL, FIFO, LOTES, VALIDADE
 * ============================================================================
 * Arquivo: modules/estoque/controllers/estoque-avancado.js
 * Descrição: Gerenciar entrada de estoque via NF-e ou manual com FIFO e lotes
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar entrada de estoque via NF-e
 */
export async function criarEntradaNfe(req, res) {
  try {
    const {
      empresa_id,
      numero_nfe,
      serie_nfe,
      fornecedor_id,
      data_emissao,
      itens,
      observacoes
    } = req.body;

    // Criar entrada
    const entradaResult = await dbPg.query(
      `INSERT INTO entradas_estoque (
        empresa_id, numero_nfe, serie_nfe, fornecedor_id, data_emissao,
        tipo_entrada, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [empresa_id, numero_nfe, serie_nfe, fornecedor_id, data_emissao, 'nfe', 'recebida', observacoes]
    );

    const entrada_id = entradaResult.rows[0].id;

    // Processar itens
    for (const item of itens) {
      await processarItemEntrada(entrada_id, item);
    }

    res.json({
      sucesso: true,
      entrada: entradaResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar entrada de estoque manual
 */
export async function criarEntradaManual(req, res) {
  try {
    const {
      empresa_id,
      motivo,
      itens,
      observacoes
    } = req.body;

    // Criar entrada
    const entradaResult = await dbPg.query(
      `INSERT INTO entradas_estoque (
        empresa_id, tipo_entrada, motivo, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [empresa_id, 'manual', motivo, 'confirmada', observacoes]
    );

    const entrada_id = entradaResult.rows[0].id;

    // Processar itens
    for (const item of itens) {
      await processarItemEntrada(entrada_id, item);
    }

    res.json({
      sucesso: true,
      entrada: entradaResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Processar item de entrada (FIFO + lotes)
 */
async function processarItemEntrada(entrada_id, item) {
  const {
    produto_id,
    quantidade,
    preco_unitario,
    lote,
    data_validade,
    numero_serie
  } = item;

  const valor_total = quantidade * preco_unitario;

  // Criar item de entrada
  const itemResult = await dbPg.query(
    `INSERT INTO itens_entrada_estoque (
      entrada_id, produto_id, quantidade, preco_unitario, valor_total,
      lote, data_validade, numero_serie
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [entrada_id, produto_id, quantidade, preco_unitario, valor_total, lote, data_validade, numero_serie]
  );

  // Atualizar estoque com FIFO
  await atualizarEstoqueComFifo(produto_id, quantidade, preco_unitario, lote, data_validade);

  return itemResult.rows[0];
}

/**
 * Atualizar estoque com método FIFO
 */
async function atualizarEstoqueComFifo(produto_id, quantidade, preco_unitario, lote, data_validade) {
  // Buscar ou criar registro de estoque
  const estoqueResult = await dbPg.query(
    `SELECT * FROM estoque WHERE produto_id = $1`,
    [produto_id]
  );

  if (estoqueResult.rows.length === 0) {
    // Criar novo registro
    await dbPg.query(
      `INSERT INTO estoque (produto_id, quantidade, valor_medio, data_atualizacao)
       VALUES ($1, $2, $3, NOW())`,
      [produto_id, quantidade, preco_unitario]
    );
  } else {
    // Atualizar quantidade e valor médio (FIFO)
    const estoque_atual = estoqueResult.rows[0];
    const novo_valor_medio = (
      (estoque_atual.quantidade * estoque_atual.valor_medio) +
      (quantidade * preco_unitario)
    ) / (estoque_atual.quantidade + quantidade);

    await dbPg.query(
      `UPDATE estoque SET
        quantidade = quantidade + $1,
        valor_medio = $2,
        data_atualizacao = NOW()
       WHERE produto_id = $3`,
      [quantidade, novo_valor_medio, produto_id]
    );
  }

  // Registrar lote
  if (lote) {
    await dbPg.query(
      `INSERT INTO lotes_estoque (produto_id, numero_lote, quantidade, data_validade, data_entrada)
       VALUES ($1, $2, $3, $4, NOW())`,
      [produto_id, lote, quantidade, data_validade]
    );
  }
}

/**
 * Saída de estoque (FIFO)
 */
export async function criarSaidaEstoque(req, res) {
  try {
    const {
      empresa_id,
      motivo,
      itens,
      observacoes
    } = req.body;

    // Criar saída
    const saidaResult = await dbPg.query(
      `INSERT INTO saidas_estoque (
        empresa_id, motivo, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [empresa_id, motivo, 'confirmada', observacoes]
    );

    const saida_id = saidaResult.rows[0].id;

    // Processar itens com FIFO
    for (const item of itens) {
      await processarItemSaidaComFifo(saida_id, item);
    }

    res.json({
      sucesso: true,
      saida: saidaResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Processar saída com FIFO (primeiro a entrar, primeiro a sair)
 */
async function processarItemSaidaComFifo(saida_id, item) {
  const { produto_id, quantidade } = item;

  // Buscar lotes ordenados por data de entrada (FIFO)
  const lotesResult = await dbPg.query(
    `SELECT * FROM lotes_estoque
     WHERE produto_id = $1 AND quantidade > 0
     ORDER BY data_entrada ASC`,
    [produto_id]
  );

  let quantidade_restante = quantidade;
  const lotes_utilizados = [];

  for (const lote of lotesResult.rows) {
    if (quantidade_restante <= 0) break;

    const quantidade_lote = Math.min(lote.quantidade, quantidade_restante);

    // Registrar utilização do lote
    lotes_utilizados.push({
      lote_id: lote.id,
      quantidade: quantidade_lote,
      numero_lote: lote.numero_lote
    });

    // Atualizar lote
    await dbPg.query(
      `UPDATE lotes_estoque SET quantidade = quantidade - $1 WHERE id = $2`,
      [quantidade_lote, lote.id]
    );

    quantidade_restante -= quantidade_lote;
  }

  if (quantidade_restante > 0) {
    throw new Error(`Quantidade insuficiente em estoque. Faltam ${quantidade_restante} unidades.`);
  }

  // Criar item de saída
  const itemResult = await dbPg.query(
    `INSERT INTO itens_saida_estoque (saida_id, produto_id, quantidade, lotes_utilizados)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [saida_id, produto_id, quantidade, JSON.stringify(lotes_utilizados)]
  );

  // Atualizar estoque
  await dbPg.query(
    `UPDATE estoque SET quantidade = quantidade - $1, data_atualizacao = NOW()
     WHERE produto_id = $2`,
    [quantidade, produto_id]
  );

  return itemResult.rows[0];
}

/**
 * Listar estoque com detalhes de lotes
 */
export async function listarEstoqueDetalhado(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT
        e.id,
        p.id as produto_id,
        p.nome,
        p.codigo_barras,
        e.quantidade,
        e.valor_medio,
        COUNT(DISTINCT l.id) as total_lotes,
        MIN(l.data_validade) as proxima_validade,
        SUM(CASE WHEN l.data_validade < NOW() THEN l.quantidade ELSE 0 END) as quantidade_vencida
       FROM estoque e
       JOIN produtos p ON e.produto_id = p.id
       LEFT JOIN lotes_estoque l ON e.produto_id = l.produto_id
       WHERE p.empresa_id = $1
       GROUP BY e.id, p.id, p.nome, p.codigo_barras, e.quantidade, e.valor_medio
       ORDER BY p.nome`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      estoque: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter detalhes de lotes de um produto
 */
export async function obterLotesProduto(req, res) {
  try {
    const { produto_id } = req.params;

    const result = await dbPg.query(
      `SELECT *,
        CASE
          WHEN data_validade < NOW() THEN 'vencido'
          WHEN data_validade < NOW() + INTERVAL '30 days' THEN 'proximo_vencimento'
          ELSE 'ok'
        END as status_validade
       FROM lotes_estoque
       WHERE produto_id = $1 AND quantidade > 0
       ORDER BY data_validade ASC`,
      [produto_id]
    );

    res.json({
      sucesso: true,
      lotes: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar produtos com validade próxima
 */
export async function listarProdutosProximosVencimento(req, res) {
  try {
    const { empresa_id } = req.params;
    const { dias = 30 } = req.query;

    const result = await dbPg.query(
      `SELECT
        p.id,
        p.nome,
        l.numero_lote,
        l.quantidade,
        l.data_validade,
        (l.data_validade - NOW())::integer as dias_para_vencer
       FROM lotes_estoque l
       JOIN produtos p ON l.produto_id = p.id
       WHERE p.empresa_id = $1
       AND l.data_validade BETWEEN NOW() AND NOW() + ($2::integer || ' days')::INTERVAL
       AND l.quantidade > 0
       ORDER BY l.data_validade ASC`,
      [empresa_id, dias]
    );

    res.json({
      sucesso: true,
      produtos: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Ajuste de estoque (inventário)
 */
export async function ajustarEstoque(req, res) {
  try {
    const {
      empresa_id,
      produto_id,
      quantidade_atual,
      quantidade_contada,
      motivo,
      observacoes
    } = req.body;

    const diferenca = quantidade_contada - quantidade_atual;

    // Registrar ajuste
    const ajusteResult = await dbPg.query(
      `INSERT INTO ajustes_estoque (
        empresa_id, produto_id, quantidade_atual, quantidade_contada,
        diferenca, motivo, observacoes, data_ajuste
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [empresa_id, produto_id, quantidade_atual, quantidade_contada, diferenca, motivo, observacoes]
    );

    // Atualizar estoque
    await dbPg.query(
      `UPDATE estoque SET quantidade = $1, data_atualizacao = NOW()
       WHERE produto_id = $2`,
      [quantidade_contada, produto_id]
    );

    res.json({
      sucesso: true,
      ajuste: ajusteResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarEntradaNfe,
  criarEntradaManual,
  criarSaidaEstoque,
  listarEstoqueDetalhado,
  obterLotesProduto,
  listarProdutosProximosVencimento,
  ajustarEstoque
};
