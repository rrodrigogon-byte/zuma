/**
 * Service: Business Intelligence e Relatórios
 * SetPoint Ultra — KPIs em Tempo Real, DRE, Curva ABC, Dashboards
 */
import { db } from '../../core/database.js';

// ============================================================================
// DASHBOARD PRINCIPAL (KPIs EM TEMPO REAL)
// ============================================================================

export async function obterDashboard(tenantId) {
  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const [faturamentoHoje, faturamentoMes, ocupacaoQuadras, topProdutos, inadimplencia] = await Promise.all([
    // Faturamento do dia
    db.query(
      `SELECT
         COALESCE(SUM(valor_total), 0) AS total,
         COUNT(*) AS num_transacoes,
         COALESCE(AVG(valor_total), 0) AS ticket_medio
       FROM vendas
       WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status = 'finalizada'`,
      [tenantId, hoje]
    ),
    // Faturamento do mês
    db.query(
      `SELECT
         COALESCE(SUM(valor_total), 0) AS total,
         COUNT(*) AS num_transacoes
       FROM vendas
       WHERE tenant_id = $1 AND DATE(created_at) >= $2 AND status = 'finalizada'`,
      [tenantId, inicioMes]
    ),
    // Taxa de ocupação das quadras hoje
    db.query(
      `SELECT
         COUNT(*) AS total_reservas,
         COUNT(*) FILTER (WHERE status = 'confirmada') AS confirmadas
       FROM reservas
       WHERE tenant_id = $1 AND DATE(data_hora_inicio) = $2`,
      [tenantId, hoje]
    ),
    // Top 5 produtos mais vendidos hoje
    db.query(
      `SELECT
         p.nome, SUM(vi.quantidade) AS qtd_vendida, SUM(vi.valor_total) AS receita
       FROM venda_itens vi
       JOIN produtos p ON p.id = vi.produto_id
       JOIN vendas v ON v.id = vi.venda_id
       WHERE v.tenant_id = $1 AND DATE(v.created_at) = $2 AND v.status = 'finalizada'
       GROUP BY p.id, p.nome
       ORDER BY receita DESC LIMIT 5`,
      [tenantId, hoje]
    ),
    // Inadimplência (crediário)
    db.query(
      `SELECT
         COUNT(*) AS parcelas_vencidas,
         COALESCE(SUM(valor), 0) AS valor_total_vencido
       FROM loja_crediario_parcelas p
       JOIN loja_crediario_vendas v ON v.id = p.venda_id
       JOIN loja_crediario_clientes c ON c.id = v.crediario_cliente_id
       WHERE c.tenant_id = $1 AND p.status = 'aberta' AND p.data_vencimento < CURRENT_DATE`,
      [tenantId]
    )
  ]);

  return {
    faturamento_hoje: {
      total: Number(faturamentoHoje.rows[0].total),
      num_transacoes: parseInt(faturamentoHoje.rows[0].num_transacoes),
      ticket_medio: Number(faturamentoHoje.rows[0].ticket_medio)
    },
    faturamento_mes: {
      total: Number(faturamentoMes.rows[0].total),
      num_transacoes: parseInt(faturamentoMes.rows[0].num_transacoes)
    },
    ocupacao_quadras: {
      total_reservas: parseInt(ocupacaoQuadras.rows[0]?.total_reservas || 0),
      confirmadas: parseInt(ocupacaoQuadras.rows[0]?.confirmadas || 0)
    },
    top_produtos: topProdutos.rows,
    inadimplencia: {
      parcelas_vencidas: parseInt(inadimplencia.rows[0].parcelas_vencidas),
      valor_total: Number(inadimplencia.rows[0].valor_total_vencido)
    },
    gerado_em: new Date().toISOString()
  };
}

// ============================================================================
// DRE — DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO
// ============================================================================

export async function gerarDRE(tenantId, mes, ano) {
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0]; // último dia do mês

  const [receitas, custos, despesas] = await Promise.all([
    // Receitas brutas por categoria
    db.query(
      `SELECT
         COALESCE(categoria, 'Outros') AS categoria,
         SUM(valor_total) AS valor
       FROM vendas
       WHERE tenant_id = $1
         AND DATE(created_at) BETWEEN $2 AND $3
         AND status = 'finalizada'
       GROUP BY categoria
       ORDER BY valor DESC`,
      [tenantId, dataInicio, dataFim]
    ),
    // Custo das mercadorias vendidas
    db.query(
      `SELECT COALESCE(SUM(vi.quantidade * p.preco_custo), 0) AS cmv
       FROM venda_itens vi
       JOIN produtos p ON p.id = vi.produto_id
       JOIN vendas v ON v.id = vi.venda_id
       WHERE v.tenant_id = $1
         AND DATE(v.created_at) BETWEEN $2 AND $3
         AND v.status = 'finalizada'`,
      [tenantId, dataInicio, dataFim]
    ),
    // Despesas operacionais
    db.query(
      `SELECT
         categoria,
         SUM(valor) AS valor
       FROM lancamentos_financeiros
       WHERE tenant_id = $1
         AND tipo = 'despesa'
         AND DATE(data_lancamento) BETWEEN $2 AND $3
       GROUP BY categoria
       ORDER BY valor DESC`,
      [tenantId, dataInicio, dataFim]
    )
  ]);

  const receitaBruta = receitas.rows.reduce((s, r) => s + Number(r.valor), 0);
  const cmv = Number(custos.rows[0]?.cmv || 0);
  const lucroBruto = receitaBruta - cmv;
  const totalDespesas = despesas.rows.reduce((s, d) => s + Number(d.valor), 0);
  const lucroLiquido = lucroBruto - totalDespesas;

  return {
    periodo: { mes, ano, inicio: dataInicio, fim: dataFim },
    receita_bruta: Number(receitaBruta.toFixed(2)),
    receitas_por_categoria: receitas.rows,
    cmv: Number(cmv.toFixed(2)),
    lucro_bruto: Number(lucroBruto.toFixed(2)),
    margem_bruta_percentual: receitaBruta > 0 ? Number((lucroBruto / receitaBruta * 100).toFixed(2)) : 0,
    despesas_operacionais: despesas.rows,
    total_despesas: Number(totalDespesas.toFixed(2)),
    lucro_liquido: Number(lucroLiquido.toFixed(2)),
    margem_liquida_percentual: receitaBruta > 0 ? Number((lucroLiquido / receitaBruta * 100).toFixed(2)) : 0
  };
}

// ============================================================================
// CURVA ABC DE PRODUTOS
// ============================================================================

export async function gerarCurvaABC(tenantId, dataInicio, dataFim) {
  const result = await db.query(
    `SELECT
       p.id, p.nome, p.categoria,
       SUM(vi.quantidade) AS qtd_vendida,
       SUM(vi.valor_total) AS receita_total,
       SUM(vi.valor_total) / SUM(SUM(vi.valor_total)) OVER () * 100 AS percentual_receita
     FROM venda_itens vi
     JOIN produtos p ON p.id = vi.produto_id
     JOIN vendas v ON v.id = vi.venda_id
     WHERE v.tenant_id = $1
       AND DATE(v.created_at) BETWEEN $2 AND $3
       AND v.status = 'finalizada'
     GROUP BY p.id, p.nome, p.categoria
     ORDER BY receita_total DESC`,
    [tenantId, dataInicio, dataFim]
  );

  // Classificar em A (0-80%), B (80-95%), C (95-100%)
  let acumulado = 0;
  const produtos = result.rows.map(p => {
    acumulado += Number(p.percentual_receita);
    const classe = acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C';
    return { ...p, acumulado: Number(acumulado.toFixed(2)), classe };
  });

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    total_produtos: produtos.length,
    classe_a: produtos.filter(p => p.classe === 'A').length,
    classe_b: produtos.filter(p => p.classe === 'B').length,
    classe_c: produtos.filter(p => p.classe === 'C').length,
    produtos
  };
}

// ============================================================================
// FLUXO DE CAIXA PROJETADO
// ============================================================================

export async function gerarFluxoCaixa(tenantId, diasProjecao = 30) {
  const hoje = new Date().toISOString().split('T')[0];
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + diasProjecao);
  const dataFimStr = dataFim.toISOString().split('T')[0];

  const [contasReceber, contasPagar] = await Promise.all([
    db.query(
      `SELECT data_vencimento, SUM(valor) AS total
       FROM loja_crediario_parcelas p
       JOIN loja_crediario_vendas v ON v.id = p.venda_id
       JOIN loja_crediario_clientes c ON c.id = v.crediario_cliente_id
       WHERE c.tenant_id = $1 AND p.status = 'aberta'
         AND p.data_vencimento BETWEEN $2 AND $3
       GROUP BY data_vencimento ORDER BY data_vencimento`,
      [tenantId, hoje, dataFimStr]
    ),
    db.query(
      `SELECT data_vencimento, SUM(valor) AS total
       FROM lancamentos_financeiros
       WHERE tenant_id = $1 AND tipo = 'despesa'
         AND status = 'pendente'
         AND data_vencimento BETWEEN $2 AND $3
       GROUP BY data_vencimento ORDER BY data_vencimento`,
      [tenantId, hoje, dataFimStr]
    )
  ]);

  const totalReceber = contasReceber.rows.reduce((s, r) => s + Number(r.total), 0);
  const totalPagar = contasPagar.rows.reduce((s, r) => s + Number(r.total), 0);

  return {
    periodo_dias: diasProjecao,
    total_a_receber: Number(totalReceber.toFixed(2)),
    total_a_pagar: Number(totalPagar.toFixed(2)),
    saldo_projetado: Number((totalReceber - totalPagar).toFixed(2)),
    contas_receber: contasReceber.rows,
    contas_pagar: contasPagar.rows
  };
}

// ============================================================================
// PERFORMANCE DE VENDEDORES
// ============================================================================

export async function rankingVendedores(tenantId, dataInicio, dataFim) {
  const result = await db.query(
    `SELECT
       u.id, u.nome,
       COUNT(v.id) AS total_vendas,
       SUM(v.valor_total) AS faturamento,
       AVG(v.valor_total) AS ticket_medio,
       SUM(v.valor_total * COALESCE(v.percentual_comissao, 0) / 100) AS comissao_total
     FROM vendas v
     JOIN usuarios u ON u.id = v.vendedor_id
     WHERE v.tenant_id = $1
       AND DATE(v.created_at) BETWEEN $2 AND $3
       AND v.status = 'finalizada'
     GROUP BY u.id, u.nome
     ORDER BY faturamento DESC`,
    [tenantId, dataInicio, dataFim]
  );
  return result.rows;
}
