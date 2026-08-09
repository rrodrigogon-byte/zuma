/**
 * Módulo de Métricas Canônicas — Setpoint Kytto
 * Fonte Única de Verdade (SSOT) para estoque, comandas abertas e faturamento
 * Versão: 1.0.0
 * Data: 2026-08-09
 *
 * Este módulo centraliza o cálculo de métricas operacionais consumidas por
 * Dashboard, BI, Estoque, Relatórios e Financeiro. Garante que todos os painéis
 * mostrem os mesmos números para os mesmos recortes de tempo.
 */

// ============================================================================
// ESTOQUE — STATUS CANÔNICO
// ============================================================================

/**
 * Calcula o status de um item de estoque segundo regra unificada
 * @param {object} item - Ficha de estoque com { qtd, minimo, ... }
 * @returns {object} { saldoAtual, minimo, status: 'OK'|'BAIXO'|'SEM_ESTOQUE' }
 */
export function getStockStatus(item) {
  if (!item) return { saldoAtual: 0, minimo: 0, status: 'SEM_ESTOQUE' }

  const saldo = Number(item.qtd || 0)
  // Suporta o campo legado `min` e a nomenclatura canônica `minimo`.
  // A compatibilidade evita divergências enquanto os registros existentes são migrados.
  const minimo = Number(item.minimo ?? item.min ?? 0)

  // Regra clara:
  // - SEM_ESTOQUE: saldo <= 0
  // - BAIXO: minimo > 0 && saldo <= minimo
  // - OK: caso contrário
  // Nota: minimo = 0 NÃO classifica como BAIXO

  if (saldo <= 0) {
    return { saldoAtual: saldo, minimo, status: 'SEM_ESTOQUE' }
  }

  if (minimo > 0 && saldo <= minimo) {
    return { saldoAtual: saldo, minimo, status: 'BAIXO' }
  }

  return { saldoAtual: saldo, minimo, status: 'OK' }
}

/**
 * Conta itens de estoque por status (agregação para painéis)
 * @param {array} itens - Array de fichas de estoque
 * @returns {object} { total, ok, baixo, semEstoque }
 */
export function contarEstoquesPorStatus(itens = []) {
  const contadores = { total: 0, ok: 0, baixo: 0, semEstoque: 0 }

  for (const item of itens) {
    if (item.ativo === false) continue
    contadores.total++
    const { status } = getStockStatus(item)
    if (status === 'OK') contadores.ok++
    else if (status === 'BAIXO') contadores.baixo++
    else if (status === 'SEM_ESTOQUE') contadores.semEstoque++
  }

  return contadores
}

/**
 * Valor total em estoque (custo médio × quantidade)
 * @param {array} itens - Array de fichas de estoque
 * @returns {number} Valor total em reais
 */
export function calcularValorEstoque(itens = []) {
  return itens
    .filter(item => item.ativo !== false)
    .reduce((total, item) => {
      const qtd = Number(item.qtd || 0)
      const custo = Number(item.custoMedioPonderado || item.custo || 0)
      return total + qtd * custo
    }, 0)
}

// ============================================================================
// COMANDAS ABERTAS — CONTAGEM E VALOR
// ============================================================================

/**
 * Calcula o total de uma comanda (soma de itens × preço)
 * @param {object} comanda - Comanda com { itens: [{preco, qtd}, ...] }
 * @returns {number} Total em reais
 */
export function calcularTotalComanda(comanda) {
  if (!comanda || !Array.isArray(comanda.itens)) return 0
  return Number(
    comanda.itens
      .reduce((soma, item) => soma + (Number(item.preco || 0) * Number(item.qtd || 0)), 0)
      .toFixed(2)
  ) || 0
}

/**
 * Retorna comandas abertas (status 'aberta' ou 'conta') de uma empresa
 * @param {array} todasAsComandas - Array de todas as comandas da empresa
 * @returns {array} Comandas com status ativo
 */
export function filtrarComandasAbertas(todasAsComandas = []) {
  return todasAsComandas.filter(cmd => ['aberta', 'conta'].includes(cmd.status))
}

/**
 * Calcula métricas de comandas abertas (quantidade e valor em aberto)
 * @param {array} todasAsComandas - Array de todas as comandas da empresa
 * @returns {object} { quantidade, valorEmAberto }
 */
export function getOpenTabs(todasAsComandas = []) {
  const abertas = filtrarComandasAbertas(todasAsComandas)
  const quantidade = abertas.length
  const valorEmAberto = Number(
    abertas
      .reduce((soma, cmd) => soma + calcularTotalComanda(cmd), 0)
      .toFixed(2)
  )

  return { quantidade, valorEmAberto, abertas }
}

// ============================================================================
// FATURAMENTO — ORIGEM ÚNICA
// ============================================================================

/**
 * Converte um instante para o dia operacional no fuso oficial do Kytto.
 * Evita que uma venda no início/fim do dia seja atribuída ao período errado.
 */
export function dataOperacionalCuiaba(valor) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return String(valor).slice(0, 10)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(data)
  const obter = (tipo) => partes.find(parte => parte.type === tipo)?.value || ''
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}

/**
 * Filtra comandas fechadas (vendas efetivadas) por período
 * @param {array} todasAsComandas - Array de todas as comandas da empresa
 * @param {string} dataInicio - Data ISO (YYYY-MM-DD) ou vazio para sem limite
 * @param {string} dataFim - Data ISO (YYYY-MM-DD) ou vazio para sem limite
 * @returns {array} Comandas com status 'fechada' no período
 */
export function filtrarVendasPorPeriodo(todasAsComandas = [], dataInicio = '', dataFim = '') {
  return todasAsComandas.filter(cmd => {
    if (cmd.status !== 'fechada') return false

    const dataCmd = dataOperacionalCuiaba(cmd.fechadaEm || cmd.atualizadaEm || cmd.abertaEm)

    if (dataInicio && dataCmd < dataInicio) return false
    if (dataFim && dataCmd > dataFim) return false

    return true
  })
}

/**
 * Calcula faturamento total (origem: comandas fechadas)
 * @param {array} todasAsComandas - Array de todas as comandas da empresa
 * @param {string} dataInicio - Data ISO (YYYY-MM-DD)
 * @param {string} dataFim - Data ISO (YYYY-MM-DD)
 * @returns {object} { total, quantidade, vendas: [...] }
 */
export function getRevenue(todasAsComandas = [], dataInicio = '', dataFim = '') {
  const vendas = filtrarVendasPorPeriodo(todasAsComandas, dataInicio, dataFim)

  const total = Number(
    vendas
      .reduce((soma, cmd) => {
        const valor = Number(cmd.totalPago ?? calcularTotalComanda(cmd) ?? 0)
        return soma + valor
      }, 0)
      .toFixed(2)
  )

  return {
    total,
    quantidade: vendas.length,
    vendas,
    periodo: { inicio: dataInicio, fim: dataFim },
  }
}

/**
 * Calcula faturamento por método de pagamento
 * @param {array} vendas - Array de comandas fechadas
 * @returns {object} { pix, cartao, dinheiro, mercadopago, ... }
 */
export function faturamentoPorMetodo(vendas = []) {
  const resultado = {}

  for (const venda of vendas) {
    const metodos = venda.pagamentos || []
    for (const pag of metodos) {
      const meio = String(pag.meio || 'dinheiro').toLowerCase()
      resultado[meio] = (resultado[meio] || 0) + Number(pag.valor || 0)
    }
    // Se não há pagamentos registrados, usa o campo legado 'pagamento'
    if (metodos.length === 0 && venda.pagamento) {
      const meio = String(venda.pagamento).toLowerCase()
      resultado[meio] = (resultado[meio] || 0) + calcularTotalComanda(venda)
    }
  }

  return resultado
}

// ============================================================================
// CMV E MARGEM (Custo Médio Ponderado)
// ============================================================================

/**
 * Calcula custo médio ponderado após entrada
 * @param {number} saldoAnterior - Quantidade anterior
 * @param {number} custoAnterior - Custo unitário anterior
 * @param {number} qtdEntrada - Quantidade da entrada
 * @param {number} custoEntrada - Custo unitário da entrada
 * @returns {number} Novo custo médio ponderado
 */
export function calcularCustoMedioPonderado(saldoAnterior, custoAnterior, qtdEntrada, custoEntrada) {
  const saldo = Number(saldoAnterior || 0)
  const custo = Number(custoAnterior || 0)
  const qtd = Number(qtdEntrada || 0)
  const custoDaEntrada = Number(custoEntrada || 0)

  if (qtd <= 0) return custo // Sem entrada, mantém custo anterior

  const novoSaldo = saldo + qtd
  if (novoSaldo <= 0) return 0

  return Number(((saldo * custo + qtd * custoDaEntrada) / novoSaldo).toFixed(4))
}

/**
 * Calcula margem bruta de um produto
 * @param {number} preco - Preço de venda
 * @param {number} custo - Custo médio ponderado
 * @returns {number} Margem em % (0-100)
 */
export function calcularMargemBruta(preco, custo) {
  const p = Number(preco || 0)
  const c = Number(custo || 0)

  if (p <= 0) return 0
  if (c >= p) return 0 // Sem margem ou prejuízo

  return Number(((p - c) / p * 100).toFixed(2))
}

/**
 * Calcula CMV total de um período
 * @param {array} vendas - Comandas fechadas
 * @param {object} estoque - Mapa de { produtoId: { custoMedioPonderado, ... } }
 * @returns {number} CMV total em reais
 */
export function calcularCMV(vendas = [], estoque = {}) {
  let cmvTotal = 0

  for (const venda of vendas) {
    for (const item of venda.itens || []) {
      const produtoId = item.produtoId || item.id
      const ficha = estoque[produtoId]
      const custo = Number(ficha?.custoMedioPonderado || ficha?.custo || 0)
      const qtd = Number(item.qtd || 0)
      cmvTotal += custo * qtd
    }
  }

  return Number(cmvTotal.toFixed(2))
}

// ============================================================================
// GUARDRAILS DE CONSISTÊNCIA
// ============================================================================

/**
 * Valida que Dashboard, BI e Relatórios retornam os mesmos totais
 * Útil para detectar regressões de SSOT
 * @param {object} metricas - { dashboard, bi, relatorios, estoque, ... }
 * @returns {object} { consistente: bool, divergencias: [...] }
 */
export function validarConsistenciaMetricas(metricas = {}) {
  const divergencias = []

  // Validar faturamento
  if (metricas.dashboard?.faturamento !== metricas.bi?.faturamento) {
    divergencias.push({
      campo: 'faturamento',
      dashboard: metricas.dashboard?.faturamento,
      bi: metricas.bi?.faturamento,
    })
  }

  // Validar comandas abertas
  if (metricas.dashboard?.comandasAbertas !== metricas.bi?.comandasAbertas) {
    divergencias.push({
      campo: 'comandasAbertas',
      dashboard: metricas.dashboard?.comandasAbertas,
      bi: metricas.bi?.comandasAbertas,
    })
  }

  // Validar estoque sem/baixo
  if (metricas.estoque?.semEstoque !== metricas.relatorios?.semEstoque) {
    divergencias.push({
      campo: 'semEstoque',
      estoque: metricas.estoque?.semEstoque,
      relatorios: metricas.relatorios?.semEstoque,
    })
  }

  return {
    consistente: divergencias.length === 0,
    divergencias,
    timestamp: new Date().toISOString(),
  }
}

export default {
  getStockStatus,
  contarEstoquesPorStatus,
  calcularValorEstoque,
  calcularTotalComanda,
  filtrarComandasAbertas,
  dataOperacionalCuiaba,
  getOpenTabs,
  filtrarVendasPorPeriodo,
  getRevenue,
  faturamentoPorMetodo,
  calcularCustoMedioPonderado,
  calcularMargemBruta,
  calcularCMV,
  validarConsistenciaMetricas,
}
