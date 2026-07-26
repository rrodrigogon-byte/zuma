/**
 * ============================================================================
 * MÓDULO FINANCEIRO - DRE, BALANÇO E RELATÓRIOS
 * ============================================================================
 * Arquivo: modules/financeiro/controllers/relatorios-financeiros.js
 * Descrição: Gerar DRE, balanço patrimonial e relatórios financeiros
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Gerar DRE (Demonstração de Resultado do Exercício)
 */
export async function gerarDRE(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim } = req.body;

    // Receitas
    const receitasResult = await dbPg.query(
      `SELECT
        SUM(CASE WHEN status = 'paga' THEN valor_recebido ELSE 0 END) as receita_bruta,
        SUM(CASE WHEN status = 'paga' THEN juros ELSE 0 END) as juros_recebidos,
        SUM(CASE WHEN status = 'paga' THEN desconto ELSE 0 END) as descontos_concedidos
       FROM contas_receber
       WHERE empresa_id = $1
       AND data_pagamento >= $2
       AND data_pagamento <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    // Despesas operacionais
    const despesasResult = await dbPg.query(
      `SELECT
        SUM(CASE WHEN status = 'paga' THEN valor_pago ELSE 0 END) as despesas_operacionais,
        SUM(CASE WHEN status = 'paga' THEN juros ELSE 0 END) as juros_pagos
       FROM contas_pagar
       WHERE empresa_id = $1
       AND data_pagamento >= $2
       AND data_pagamento <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    // Custo de vendas
    const custoResult = await dbPg.query(
      `SELECT
        SUM(iv.quantidade * iv.preco_unitario) as custo_vendas
       FROM itens_venda iv
       JOIN vendas v ON iv.venda_id = v.id
       WHERE v.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    const receitas = receitasResult.rows[0];
    const despesas = despesasResult.rows[0];
    const custo = custoResult.rows[0];

    const receita_bruta = receitas.receita_bruta || 0;
    const custo_vendas = custo.custo_vendas || 0;
    const lucro_bruto = receita_bruta - custo_vendas;
    const despesas_operacionais = despesas.despesas_operacionais || 0;
    const lucro_operacional = lucro_bruto - despesas_operacionais;
    const resultado_financeiro = (receitas.juros_recebidos || 0) - (despesas.juros_pagos || 0);
    const lucro_liquido = lucro_operacional + resultado_financeiro;

    res.json({
      sucesso: true,
      dre: {
        periodo: { data_inicio, data_fim },
        receita_bruta,
        descontos_concedidos: receitas.descontos_concedidos || 0,
        receita_liquida: receita_bruta - (receitas.descontos_concedidos || 0),
        custo_vendas,
        lucro_bruto,
        despesas_operacionais,
        lucro_operacional,
        resultado_financeiro,
        lucro_liquido
      }
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Gerar balanço patrimonial
 */
export async function gerarBalanco(req, res) {
  try {
    const { empresa_id, data_referencia } = req.body;

    // Ativo circulante
    const caixaResult = await dbPg.query(
      `SELECT SUM(valor) as saldo FROM movimentacoes_caixa
       WHERE empresa_id = $1 AND tipo = 'entrada' AND data_movimento <= $2`,
      [empresa_id, data_referencia]
    );

    const estoqueResult = await dbPg.query(
      `SELECT SUM(quantidade * valor_medio) as valor_estoque FROM estoque
       WHERE produto_id IN (SELECT id FROM produtos WHERE empresa_id = $1)`,
      [empresa_id]
    );

    const contasReceberResult = await dbPg.query(
      `SELECT SUM(valor) as total FROM contas_receber
       WHERE empresa_id = $1 AND status IN ('pendente', 'parcialmente_paga')
       AND data_vencimento <= $2`,
      [empresa_id, data_referencia]
    );

    // Passivo circulante
    const contasPagarResult = await dbPg.query(
      `SELECT SUM(valor) as total FROM contas_pagar
       WHERE empresa_id = $1 AND status IN ('pendente', 'parcialmente_paga')
       AND data_vencimento <= $2`,
      [empresa_id, data_referencia]
    );

    const ativo_circulante = (caixaResult.rows[0].saldo || 0) +
                             (estoqueResult.rows[0].valor_estoque || 0) +
                             (contasReceberResult.rows[0].total || 0);

    const passivo_circulante = contasPagarResult.rows[0].total || 0;
    const patrimonio_liquido = ativo_circulante - passivo_circulante;

    res.json({
      sucesso: true,
      balanco: {
        data_referencia,
        ativo: {
          circulante: {
            caixa: caixaResult.rows[0].saldo || 0,
            estoque: estoqueResult.rows[0].valor_estoque || 0,
            contas_receber: contasReceberResult.rows[0].total || 0,
            total: ativo_circulante
          }
        },
        passivo: {
          circulante: {
            contas_pagar: passivo_circulante,
            total: passivo_circulante
          }
        },
        patrimonio_liquido
      }
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Relatório de vendas por período
 */
export async function relatorioVendasPeriodo(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim } = req.body;

    const result = await dbPg.query(
      `SELECT
        DATE(v.data_venda) as data,
        COUNT(v.id) as total_vendas,
        SUM(v.valor_total) as valor_total,
        AVG(v.valor_total) as ticket_medio,
        SUM(v.desconto) as total_desconto,
        SUM(v.acrescimo) as total_acrescimo
       FROM vendas v
       WHERE v.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3
       GROUP BY DATE(v.data_venda)
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

/**
 * Relatório de produtos mais vendidos
 */
export async function relatorioProdutosMaisVendidos(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim, limite = 10 } = req.body;

    const result = await dbPg.query(
      `SELECT
        p.id,
        p.nome,
        SUM(iv.quantidade) as quantidade_vendida,
        SUM(iv.valor_total) as valor_total,
        AVG(iv.preco_unitario) as preco_medio
       FROM itens_venda iv
       JOIN produtos p ON iv.produto_id = p.id
       JOIN vendas v ON iv.venda_id = v.id
       WHERE p.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3
       GROUP BY p.id, p.nome
       ORDER BY SUM(iv.quantidade) DESC
       LIMIT $4`,
      [empresa_id, data_inicio, data_fim, limite]
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
 * Relatório de clientes com maior faturamento
 */
export async function relatorioClientesMaiorFaturamento(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim, limite = 10 } = req.body;

    const result = await dbPg.query(
      `SELECT
        c.id,
        c.nome,
        COUNT(DISTINCT cr.venda_id) as total_compras,
        SUM(cr.valor) as valor_total,
        AVG(cr.valor) as ticket_medio,
        SUM(CASE WHEN cr.status = 'atrasada' THEN 1 ELSE 0 END) as pagamentos_atrasados
       FROM contas_receber cr
       JOIN clientes c ON cr.cliente_id = c.id
       WHERE c.empresa_id = $1
       AND cr.data_vencimento >= $2
       AND cr.data_vencimento <= $3
       GROUP BY c.id, c.nome
       ORDER BY SUM(cr.valor) DESC
       LIMIT $4`,
      [empresa_id, data_inicio, data_fim, limite]
    );

    res.json({
      sucesso: true,
      clientes: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Relatório de contas a receber vencidas
 */
export async function relatorioContasVencidas(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT
        cr.id,
        c.nome as cliente,
        cr.valor,
        cr.data_vencimento,
        (NOW()::date - cr.data_vencimento::date) as dias_vencimento,
        cr.status
       FROM contas_receber cr
       JOIN clientes c ON cr.cliente_id = c.id
       WHERE cr.empresa_id = $1
       AND cr.status IN ('pendente', 'atrasada')
       AND cr.data_vencimento < NOW()
       ORDER BY cr.data_vencimento ASC`,
      [empresa_id]
    );

    let total_vencido = 0;
    for (const conta of result.rows) {
      total_vencido += conta.valor;
    }

    res.json({
      sucesso: true,
      contas: result.rows,
      total_vencido
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Indicadores financeiros
 */
export async function obterIndicadoresFinanceiros(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim } = req.body;

    // Margem bruta
    const margemResult = await dbPg.query(
      `SELECT
        SUM(v.valor_total) as receita,
        SUM(iv.quantidade * iv.preco_unitario) as custo
       FROM vendas v
       LEFT JOIN itens_venda iv ON v.id = iv.venda_id
       WHERE v.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    const receita = margemResult.rows[0].receita || 0;
    const custo = margemResult.rows[0].custo || 0;
    const margem_bruta = receita > 0 ? ((receita - custo) / receita) * 100 : 0;

    // Rotatividade de estoque
    const rotatividadeResult = await dbPg.query(
      `SELECT
        SUM(iv.quantidade * iv.preco_unitario) as custo_vendas,
        SUM(e.quantidade * e.valor_medio) as estoque_medio
       FROM itens_venda iv
       JOIN vendas v ON iv.venda_id = v.id
       JOIN estoque e ON iv.produto_id = e.produto_id
       WHERE v.empresa_id = $1
       AND v.data_venda >= $2
       AND v.data_venda <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    const estoque_medio = rotatividadeResult.rows[0].estoque_medio || 1;
    const rotatividade = (custo / estoque_medio) || 0;

    // Prazo médio de recebimento
    const prazoPagamentoResult = await dbPg.query(
      `SELECT
        AVG(CASE WHEN status = 'paga' THEN (data_pagamento::date - data_vencimento::date) ELSE 0 END) as prazo_medio
       FROM contas_receber
       WHERE empresa_id = $1
       AND data_vencimento >= $2
       AND data_vencimento <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    res.json({
      sucesso: true,
      indicadores: {
        margem_bruta: parseFloat(margem_bruta.toFixed(2)),
        rotatividade_estoque: parseFloat(rotatividade.toFixed(2)),
        prazo_medio_recebimento: prazoPagamentoResult.rows[0].prazo_medio || 0
      }
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  gerarDRE,
  gerarBalanco,
  relatorioVendasPeriodo,
  relatorioProdutosMaisVendidos,
  relatorioClientesMaiorFaturamento,
  relatorioContasVencidas,
  obterIndicadoresFinanceiros
};
