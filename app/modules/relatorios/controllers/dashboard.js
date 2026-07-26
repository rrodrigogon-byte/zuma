/**
 * Controllers do Módulo RELATÓRIOS - Dashboard BI
 * SetPoint Ultra - Relatórios, gráficos, previsões
 */

import { db } from '../../../core/database.js';

// ============================================================================
// DASHBOARD EXECUTIVO
// ============================================================================

/**
 * Obter resumo do dashboard
 */
export const obterResumoDashboard = async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    const dataInicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = data_fim || new Date();

    // Vendas totais
    const vendas = await db.query(
      `
      SELECT 
        COUNT(*) as total_vendas,
        SUM(total_liquido) as total_vendido,
        AVG(total_liquido) as ticket_medio,
        MAX(total_liquido) as maior_venda,
        MIN(total_liquido) as menor_venda
      FROM comandas
      WHERE estabelecimento_id = $1
        AND status = 'fechada'
        AND data_fechamento >= $2
        AND data_fechamento <= $3
      `,
      [tenantId, dataInicio, dataFim]
    );

    // Produtos mais vendidos
    const produtosMaisVendidos = await db.query(
      `
      SELECT 
        p.id, p.nome, p.sku,
        SUM(ic.quantidade) as total_quantidade,
        SUM(ic.valor_total) as total_vendido
      FROM itens_comanda ic
      JOIN produtos p ON ic.produto_id = p.id
      JOIN comandas c ON ic.comanda_id = c.id
      WHERE c.estabelecimento_id = $1
        AND c.status = 'fechada'
        AND c.data_fechamento >= $2
        AND c.data_fechamento <= $3
      GROUP BY p.id, p.nome, p.sku
      ORDER BY total_quantidade DESC
      LIMIT 10
      `,
      [tenantId, dataInicio, dataFim]
    );

    // Pagamentos por tipo
    const pagamentosPorTipo = await db.query(
      `
      SELECT 
        tipo_pagamento,
        COUNT(*) as total_transacoes,
        SUM(valor) as total_valor
      FROM pagamentos
      WHERE estabelecimento_id = $1
        AND data_pagamento >= $2
        AND data_pagamento <= $3
      GROUP BY tipo_pagamento
      `,
      [tenantId, dataInicio, dataFim]
    );

    // Estoque crítico
    const estoqueCritico = await db.query(
      `
      SELECT id, nome, sku, estoque_atual, estoque_minimo
      FROM produtos
      WHERE estabelecimento_id = $1
        AND estoque_atual <= estoque_minimo
      ORDER BY estoque_atual ASC
      LIMIT 10
      `,
      [tenantId]
    );

    res.json({
      vendas: vendas.rows[0],
      produtos_mais_vendidos: produtosMaisVendidos.rows,
      pagamentos_por_tipo: pagamentosPorTipo.rows,
      estoque_critico: estoqueCritico.rows,
      periodo: {
        data_inicio: dataInicio,
        data_fim: dataFim,
      },
    });
  } catch (error) {
    console.error('Erro ao obter resumo do dashboard:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// RELATÓRIO DE VENDAS
// ============================================================================

/**
 * Obter relatório de vendas
 */
export const obterRelatorioVendas = async (req, res) => {
  try {
    const { data_inicio, data_fim, agrupamento = 'dia' } = req.query;
    const tenantId = req.tenantId;

    const dataInicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = data_fim || new Date();

    let agrupamentoCampo = 'DATE(data_fechamento)';
    if (agrupamento === 'semana') {
      agrupamentoCampo = 'DATE_TRUNC(\'week\', data_fechamento)';
    } else if (agrupamento === 'mes') {
      agrupamentoCampo = 'DATE_TRUNC(\'month\', data_fechamento)';
    }

    const result = await db.query(
      `
      SELECT 
        ${agrupamentoCampo} as periodo,
        COUNT(*) as total_vendas,
        SUM(total_liquido) as total_vendido,
        SUM(total_desconto) as total_desconto,
        AVG(total_liquido) as ticket_medio
      FROM comandas
      WHERE estabelecimento_id = $1
        AND status = 'fechada'
        AND data_fechamento >= $2
        AND data_fechamento <= $3
      GROUP BY ${agrupamentoCampo}
      ORDER BY periodo DESC
      `,
      [tenantId, dataInicio, dataFim]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter relatório de vendas:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// RELATÓRIO DE ESTOQUE
// ============================================================================

/**
 * Obter relatório de estoque
 */
export const obterRelatorioEstoque = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT 
        id, sku, nome, categoria_id,
        estoque_atual, estoque_minimo, estoque_maximo,
        valor_custo, valor_venda,
        estoque_atual * valor_custo as valor_total_custo,
        estoque_atual * valor_venda as valor_total_venda
      FROM produtos
      WHERE estabelecimento_id = $1 AND ativo = true
      ORDER BY valor_total_custo DESC
      `,
      [tenantId]
    );

    // Calcular totais
    let totalCusto = 0;
    let totalVenda = 0;
    let totalItens = 0;

    for (const item of result.rows) {
      totalCusto += item.valor_total_custo || 0;
      totalVenda += item.valor_total_venda || 0;
      totalItens += item.estoque_atual || 0;
    }

    res.json({
      itens: result.rows,
      resumo: {
        total_itens: totalItens,
        total_custo: totalCusto,
        total_venda: totalVenda,
        margem: totalVenda - totalCusto,
      },
    });
  } catch (error) {
    console.error('Erro ao obter relatório de estoque:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// RELATÓRIO DE OPERADORES/GARÇONS
// ============================================================================

/**
 * Obter relatório de operadores
 */
export const obterRelatorioOperadores = async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    const dataInicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = data_fim || new Date();

    const result = await db.query(
      `
      SELECT 
        u.id, u.nome, u.email,
        COUNT(c.id) as total_vendas,
        SUM(c.total_liquido) as total_vendido,
        AVG(c.total_liquido) as ticket_medio,
        COUNT(DISTINCT DATE(c.data_fechamento)) as dias_trabalhados
      FROM usuarios u
      LEFT JOIN comandas c ON u.id = c.operador_id
        AND c.estabelecimento_id = $1
        AND c.status = 'fechada'
        AND c.data_fechamento >= $2
        AND c.data_fechamento <= $3
      WHERE u.tenant_id = $1 AND 'garcom' = ANY(u.roles)
      GROUP BY u.id, u.nome, u.email
      ORDER BY total_vendido DESC
      `,
      [tenantId, dataInicio, dataFim]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter relatório de operadores:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  obterResumoDashboard,
  obterRelatorioVendas,
  obterRelatorioEstoque,
  obterRelatorioOperadores,
};
