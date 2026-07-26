/**
 * ============================================================================
 * MÓDULO LOJA - PDV, VENDAS E COMISSÕES
 * ============================================================================
 * Arquivo: modules/loja/controllers/loja.js
 * Descrição: Gerenciar vendas, comissões e operadores
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar venda
 */
export async function criarVenda(req, res) {
  try {
    const { empresa_id, operador_id, itens, desconto, acrescimo } = req.body;

    let valor_total = 0;

    // Calcular valor total
    for (const item of itens) {
      const produtoResult = await dbPg.query(
        `SELECT preco FROM produtos WHERE id = $1`,
        [item.produto_id]
      );

      const preco = produtoResult.rows[0].preco;
      valor_total += preco * item.quantidade;
    }

    // Aplicar desconto e acréscimo
    valor_total = valor_total - (desconto || 0) + (acrescimo || 0);

    const result = await dbPg.query(
      `INSERT INTO vendas (empresa_id, operador_id, valor_total, desconto, acrescimo, status, data_venda)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [empresa_id, operador_id, valor_total, desconto || 0, acrescimo || 0, 'aberta']
    );

    const venda_id = result.rows[0].id;

    // Adicionar itens
    for (const item of itens) {
      const produtoResult = await dbPg.query(
        `SELECT preco FROM produtos WHERE id = $1`,
        [item.produto_id]
      );

      const preco = produtoResult.rows[0].preco;
      const item_total = preco * item.quantidade;

      await dbPg.query(
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, valor_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [venda_id, item.produto_id, item.quantidade, preco, item_total]
      );

      // Descontar do estoque
      await dbPg.query(
        `UPDATE estoque SET quantidade = quantidade - $1 WHERE produto_id = $2`,
        [item.quantidade, item.produto_id]
      );
    }

    res.json({
      sucesso: true,
      venda: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Fechar venda
 */
export async function fecharVenda(req, res) {
  try {
    const { venda_id, pagamentos } = req.body;

    const result = await dbPg.query(
      `UPDATE vendas SET status = 'fechada', data_fechamento = NOW()
       WHERE id = $1
       RETURNING *`,
      [venda_id]
    );

    // Registrar pagamentos
    for (const pagamento of pagamentos) {
      await dbPg.query(
        `INSERT INTO pagamentos (venda_id, forma, valor, status)
         VALUES ($1, $2, $3, $4)`,
        [venda_id, pagamento.forma, pagamento.valor, 'confirmado']
      );
    }

    // Calcular comissão
    const venda = result.rows[0];
    const comissaoResult = await dbPg.query(
      `SELECT percentual_comissao FROM operadores WHERE id = $1`,
      [venda.operador_id]
    );

    if (comissaoResult.rows.length > 0) {
      const percentual = comissaoResult.rows[0].percentual_comissao;
      const valor_comissao = venda.valor_total * (percentual / 100);

      await dbPg.query(
        `INSERT INTO comissoes (venda_id, operador_id, valor_comissao, percentual, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [venda_id, venda.operador_id, valor_comissao, percentual, 'pendente']
      );
    }

    res.json({
      sucesso: true,
      venda: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Cancelar venda
 */
export async function cancelarVenda(req, res) {
  try {
    const { venda_id, motivo } = req.body;

    // Obter itens da venda
    const itensResult = await dbPg.query(
      `SELECT * FROM itens_venda WHERE venda_id = $1`,
      [venda_id]
    );

    // Devolver ao estoque
    for (const item of itensResult.rows) {
      await dbPg.query(
        `UPDATE estoque SET quantidade = quantidade + $1 WHERE produto_id = $2`,
        [item.quantidade, item.produto_id]
      );
    }

    // Atualizar status da venda
    const result = await dbPg.query(
      `UPDATE vendas SET status = 'cancelada', motivo_cancelamento = $1, data_cancelamento = NOW()
       WHERE id = $2
       RETURNING *`,
      [motivo, venda_id]
    );

    res.json({
      sucesso: true,
      venda: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar vendas
 */
export async function listarVendas(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data_inicio, data_fim, operador_id } = req.query;

    let query = `SELECT v.*, o.nome as operador_nome
                 FROM vendas v
                 JOIN operadores o ON v.operador_id = o.id
                 WHERE v.empresa_id = $1`;
    const params = [empresa_id];

    if (data_inicio) {
      query += ` AND v.data_venda >= $${params.length + 1}`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND v.data_venda <= $${params.length + 1}`;
      params.push(data_fim);
    }

    if (operador_id) {
      query += ` AND v.operador_id = $${params.length + 1}`;
      params.push(operador_id);
    }

    query += ` ORDER BY v.data_venda DESC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      vendas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter comissões do operador
 */
export async function obterComissoes(req, res) {
  try {
    const { operador_id } = req.params;
    const { mes, ano } = req.query;

    let query = `SELECT c.*, v.data_venda
                 FROM comissoes c
                 JOIN vendas v ON c.venda_id = v.id
                 WHERE c.operador_id = $1`;
    const params = [operador_id];

    if (mes && ano) {
      query += ` AND EXTRACT(MONTH FROM v.data_venda) = $${params.length + 1}
                 AND EXTRACT(YEAR FROM v.data_venda) = $${params.length + 2}`;
      params.push(mes, ano);
    }

    query += ` ORDER BY v.data_venda DESC`;

    const result = await dbPg.query(query, params);

    // Calcular total
    let total = 0;
    for (const comissao of result.rows) {
      total += comissao.valor_comissao;
    }

    res.json({
      sucesso: true,
      comissoes: result.rows,
      total
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Pagar comissão
 */
export async function pagarComissao(req, res) {
  try {
    const { comissao_id, data_pagamento } = req.body;

    const result = await dbPg.query(
      `UPDATE comissoes SET status = 'paga', data_pagamento = $1
       WHERE id = $2
       RETURNING *`,
      [data_pagamento || new Date(), comissao_id]
    );

    res.json({
      sucesso: true,
      comissao: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Relatório de vendas
 */
export async function relatorioVendas(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data_inicio, data_fim } = req.query;

    const result = await dbPg.query(
      `SELECT
        DATE(v.data_venda) as data,
        o.nome as operador,
        COUNT(v.id) as total_vendas,
        SUM(v.valor_total) as valor_total,
        SUM(v.desconto) as total_desconto,
        SUM(v.acrescimo) as total_acrescimo
       FROM vendas v
       JOIN operadores o ON v.operador_id = o.id
       WHERE v.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3
       GROUP BY DATE(v.data_venda), o.nome
       ORDER BY DATE(v.data_venda) DESC`,
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
  criarVenda,
  fecharVenda,
  cancelarVenda,
  listarVendas,
  obterComissoes,
  pagarComissao,
  relatorioVendas
};
