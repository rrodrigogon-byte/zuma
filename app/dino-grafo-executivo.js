import { buildBusinessNetwork } from './dino-grafo-rede.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_STATUSES = new Set(['ok', 'limitado', 'indisponivel', 'desconhecido']);
const list = (value) => (Array.isArray(value) ? value : []);
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value) => Math.round(num(value) * 100) / 100;
const CONFIRMED_ORDER_STATUSES = new Set(['paid', 'processing', 'ready', 'shipped', 'ready_for_pickup', 'delivered', 'picked_up', 'completed']);

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dateOnly(value) {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? '' : value.toISOString().slice(0, 10);
  const day = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day : '';
}

function inWindow(value, from, to) {
  const date = asDate(value);
  return Boolean(date && date >= from && date < to);
}

function dateInWindow(value, fromDay, toDay) {
  const day = String(value || '').slice(0, 10);
  return Boolean(day && day >= fromDay && day <= toDay);
}

function todayInCuiaba(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function normalizeSource(source) {
  const input = source && typeof source === 'object' ? source : {};
  const candidate = input.status === 'unavailable' ? 'indisponivel' : input.status;
  const status = SOURCE_STATUSES.has(candidate) ? candidate : 'desconhecido';
  const rawRecords = input.records ?? input.registros;
  const records = rawRecords == null || !Number.isFinite(Number(rawRecords)) ? null : Number(rawRecords);
  return {
    status,
    records,
    ...(input.detail || input.detalhe ? { detail: String(input.detail || input.detalhe).slice(0, 220) } : {}),
  };
}

function qualityView(quality = {}, graph = {}) {
  const sources = quality.sources || quality;
  const graphSources = graph?.qualidade?.fontes || {};
  const graphStates = Object.values(graphSources).map((source) => SOURCE_STATUSES.has(source?.status) ? source.status : 'desconhecido');
  const inferredGraphStatus = graphStates.length === 0 || graphStates.every((status) => status === 'desconhecido')
    ? 'desconhecido'
    : graphStates.every((status) => status === 'indisponivel')
      ? 'indisponivel'
      : graphStates.some((status) => status !== 'ok') ? 'limitado' : 'ok';
  const entries = {
    graph: sources.graph || { status: inferredGraphStatus, records: graph?.clientes ?? null },
    offers: sources.offers,
    appointments: sources.appointments || graphSources.appointments,
    finance: sources.finance,
    receivables: sources.receivables || sources.finance,
    cash: sources.cash,
    orders: sources.orders,
    payments: sources.payments,
    inventory: sources.inventory,
    localInventory: sources.localInventory,
  };
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, normalizeSource(value)]));
}

function commerceOrderMetrics(commerce = {}) {
  const rows = list(commerce.ordersByStatus || commerce.orderStatuses || commerce.orders);
  const count = (status) => rows
    .filter((row) => String(row.status || '').toLowerCase() === status)
    .reduce((sum, row) => sum + num(row.total ?? row.count), 0);
  const countAny = (statuses) => rows
    .filter((row) => statuses.includes(String(row.status || '').toLowerCase()))
    .reduce((sum, row) => sum + num(row.total ?? row.count), 0);
  const payments = commerce.payments || {};
  const ordersTotal = rows.reduce((sum, row) => sum + num(row.total ?? row.count), 0);
  const confirmedOrders = rows
    .filter((row) => CONFIRMED_ORDER_STATUSES.has(String(row.status || '').toLowerCase()))
    .reduce((sum, row) => sum + num(row.total ?? row.count), 0);
  return {
    ordersTotal,
    confirmedOrders,
    unconfirmedOrders: Math.max(0, ordersTotal - confirmedOrders),
    pendingOrders: count('pending_payment'),
    cancelledOrders: count('cancelled'),
    refundedOrders: countAny(['refunded', 'partially_refunded']),
    capturedTransactions: num(payments.transactions ?? payments.capturedTransactions),
    capturedAmount: round(payments.amount ?? payments.capturedAmount),
  };
}

function inventoryMetrics(commerce = {}) {
  const stockNumber = (value) => {
    if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const products = list(commerce.inventory).slice(0, 2000).map((item) => ({
    name: String(item.name || item.nome || 'Produto').slice(0, 100),
    available: stockNumber(item.available ?? item.estoque),
    minimum: stockNumber(item.minimum ?? item.minimo),
    sold: Math.max(0, num(item.sold ?? item.vendido)),
  }));
  const outOfStock = products.filter((item) => item.available === 0);
  const lowStock = products.filter((item) => item.available !== null && item.minimum !== null && item.available > 0 && item.available <= item.minimum);
  const actionable = products
    .filter((item) => item.available !== null && (item.available === 0 || (item.minimum !== null && item.available <= item.minimum)))
    .sort((a, b) => b.sold - a.sold || a.available - b.available || a.name.localeCompare(b.name, 'pt-BR'));
  return {
    products: products.length,
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    unknownBalances: products.filter((item) => item.available === null).length,
    lowStockProducts: actionable.slice(0, 20),
  };
}

function paidFinance(finance, from, to) {
  const paid = list(finance).filter((entry) => entry.status === 'pago'
    && inWindow(entry.pagoEm || entry.dataOperacao, from, to));
  const income = paid.filter((entry) => entry.tipo === 'receita').reduce((sum, entry) => sum + num(entry.valor), 0);
  const expenses = paid.filter((entry) => entry.tipo === 'despesa').reduce((sum, entry) => sum + num(entry.valor), 0);
  return { income: round(income), expenses: round(expenses), net: round(income - expenses) };
}

function overdueReceivables(finance, today) {
  return list(finance).filter((entry) => entry.tipo === 'receita'
    && ['pendente', 'pending', 'vencido', 'atrasado'].includes(String(entry.status || '').toLowerCase())
    && Boolean(dateOnly(entry.vencimento)) && dateOnly(entry.vencimento) < today);
}

function receivablesWithoutDueDate(finance) {
  return list(finance).filter((entry) => entry.tipo === 'receita'
    && ['pendente', 'pending', 'vencido', 'atrasado'].includes(String(entry.status || '').toLowerCase())
    && !dateOnly(entry.vencimento)).length;
}

function cashDiscrepancies(cash, fromDay, toDay) {
  return list(cash).filter((entry) => entry.status === 'fechado'
    && dateInWindow(entry.data || entry.fechadoEm || entry.fechado_em, fromDay, toDay)
    && Math.abs(num(entry.divergencia ?? entry.diferenca ?? entry.discrepancy)) >= 0.01);
}

function money(value) {
  return num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Constrói uma visão executiva a partir de dados já escopados e agregáveis. */
export function buildExecutiveGraph({
  days = 30, from, to, now = new Date(), graph = {}, graphModel = {}, graphSources = {}, schedule = {}, finance = [], cash = [], commerce = {}, offers = [], quality = {}, businessLabel = 'Unidade ativa', scope = null,
} = {}) {
  const end = asDate(to) || asDate(now) || new Date();
  const start = asDate(from) || new Date(end.valueOf() - Number(days) * DAY_MS);
  const safeDays = [30, 90].includes(Number(days)) ? Number(days) : 30;
  const fromDay = start.toISOString().slice(0, 10);
  const toDay = end.toISOString().slice(0, 10);
  const qualitySources = qualityView(quality, graph);
  const available = (name) => qualitySources[name]?.status === 'ok';
  const count = (value) => (available(value) ? Math.max(0, num(value)) : null);

  const customerTotal = count('graph') === null ? null : Math.max(0, num(graph.clientes ?? graph.customers));
  const atRisk = count('graph') === null ? null : Math.max(0, num(graph.emRisco ?? graph.atRisk));
  const offersTotal = available('graph') ? list(offers).reduce((sum, offer) => sum + Math.max(0, num(offer.count)), 0) : null;
  const scheduleTotal = available('appointments') ? Math.max(0, num(schedule.total)) : null;
  const completed = available('appointments') ? Math.max(0, num(schedule.concluidos ?? schedule.completed)) : null;
  const cancelled = available('appointments') ? Math.max(0, num(schedule.cancelados ?? schedule.cancelled)) : null;
  const noShow = available('appointments') ? Math.max(0, num(schedule.faltas ?? schedule.noShow)) : null;
  const attendanceRate = available('appointments') && schedule.taxaComparecimento != null
    ? num(schedule.taxaComparecimento) : null;
  const cancellationRate = available('appointments') && schedule.taxaCancelamento != null
    ? num(schedule.taxaCancelamento) : null;

  const financeTotals = paidFinance(finance, start, end);
  const today = todayInCuiaba(asDate(now) || new Date());
  const overdue = overdueReceivables(finance, today);
  const overdueWithoutDueDate = receivablesWithoutDueDate(finance);
  if (overdueWithoutDueDate > 0 && qualitySources.receivables.status !== 'indisponivel') {
    qualitySources.receivables = {
      ...qualitySources.receivables,
      status: 'limitado',
      detail: `${overdueWithoutDueDate} lançamento(s) pendente(s) sem vencimento válido; não foram classificados como vencidos e a posição atual é parcial.`.slice(0, 220),
    };
  }
  const periodCashDiscrepancies = available('cash') ? cashDiscrepancies(cash, fromDay, toDay) : [];
  const cashDiscrepancyCount = available('cash') ? periodCashDiscrepancies.length : null;
  const cashDiscrepancyNet = available('cash') ? round(periodCashDiscrepancies
    .reduce((sum, entry) => sum + num(entry.divergencia ?? entry.diferenca ?? entry.discrepancy), 0)) : null;
  const cashDiscrepancyGross = available('cash') ? round(periodCashDiscrepancies
    .reduce((sum, entry) => sum + Math.abs(num(entry.divergencia ?? entry.diferenca ?? entry.discrepancy)), 0)) : null;
  const financeMetrics = available('finance') ? {
    paidIncome: financeTotals.income,
    paidExpenses: financeTotals.expenses,
    net: financeTotals.net,
    overdueCount: available('receivables') ? overdue.length : null,
    overdueAmount: available('receivables') ? round(overdue.reduce((sum, entry) => sum + num(entry.valor), 0)) : null,
    cashDiscrepancyCount,
    cashDiscrepancyNet,
    cashDiscrepancyGross,
  } : {
    paidIncome: null, paidExpenses: null, net: null, overdueCount: null, overdueAmount: null,
    cashDiscrepancyCount,
    cashDiscrepancyNet,
    cashDiscrepancyGross,
  };
  const orderMetrics = commerceOrderMetrics(commerce);
  const commerceMetrics = {
    ordersTotal: available('orders') ? orderMetrics.ordersTotal : null,
    confirmedOrders: available('orders') ? orderMetrics.confirmedOrders : null,
    unconfirmedOrders: available('orders') ? orderMetrics.unconfirmedOrders : null,
    pendingOrders: available('orders') ? orderMetrics.pendingOrders : null,
    cancelledOrders: available('orders') ? orderMetrics.cancelledOrders : null,
    refundedOrders: available('orders') ? orderMetrics.refundedOrders : null,
    capturedTransactions: available('payments') ? orderMetrics.capturedTransactions : null,
    capturedAmount: available('payments') ? orderMetrics.capturedAmount : null,
  };
  const inventorySourceAvailable = available('inventory');
  const inv = inventoryMetrics(commerce);
  if (inventorySourceAvailable && inv.unknownBalances > 0) {
    qualitySources.inventory = {
      ...qualitySources.inventory,
      status: 'limitado',
      detail: `${inv.unknownBalances} produto(s) sem saldo calculável; ausência de saldo não é tratada como zero.`.slice(0, 220),
    };
  }
  const inventory = inventorySourceAvailable
    ? inv
    : { products: null, lowStock: null, outOfStock: null, unknownBalances: null, lowStockProducts: [] };
  const safeOffers = available('graph') ? list(offers).slice(0, 20).map((offer) => ({
    name: String(offer.name || 'Oferta').slice(0, 100),
    type: String(offer.type || 'produto').slice(0, 40),
    count: Math.max(0, num(offer.count)),
  })) : [];
  const metrics = {
    customers: { total: customerTotal, atRisk, customersWithOffers: offersTotal },
    operations: { total: scheduleTotal, completed, cancelled, noShow, attendanceRate, cancellationRate },
    finance: financeMetrics,
    commerce: commerceMetrics,
    inventory,
    offers: safeOffers,
  };

  const signals = [];
  const addSignal = (id, area, severity, title, detail, source) => signals.push({ id, area, severity, title, detail, source });
  if (available('graph') && atRisk > 0) {
    addSignal('customer-retention', 'clientes', 'medium', 'Clientes além do intervalo habitual', `${atRisk} cliente(s) passaram de 1,5× o intervalo habitual observado.`, 'graph');
  }
  if (available('appointments') && scheduleTotal >= 10 && noShow > 0 && noShow / scheduleTotal >= 0.1) {
    addSignal('appointment-no-show', 'operacao', 'medium', 'Faltas na agenda', `${noShow} de ${scheduleTotal} agendamentos terminaram como falta no período (${(noShow / scheduleTotal * 100).toFixed(1).replace('.', ',')}%).`, 'appointments');
  }
  if (available('appointments') && scheduleTotal >= 10 && cancelled > 0 && cancelled / scheduleTotal >= 0.2) {
    addSignal('appointment-cancel', 'operacao', 'medium', 'Cancelamentos na agenda', `${cancelled} de ${scheduleTotal} agendamentos foram cancelados no período (${(cancelled / scheduleTotal * 100).toFixed(1).replace('.', ',')}%).`, 'appointments');
  }
  if (available('receivables') && overdue.length) {
    addSignal('finance-overdue', 'financeiro', 'high', 'Receitas pendentes vencidas', `${overdue.length} lançamento(s), totalizando ${money(financeMetrics.overdueAmount)}, estão pendentes e vencidos na posição atual.`, 'receivables');
  }
  const discrepancies = periodCashDiscrepancies;
  if (discrepancies.length) {
    addSignal('cash-discrepancy', 'financeiro', 'high', 'Fechamentos de caixa com diferença', `${discrepancies.length} fechamento(s) têm divergência absoluta de pelo menos R$ 0,01; soma absoluta ${money(financeMetrics.cashDiscrepancyGross)}, diferença líquida ${money(financeMetrics.cashDiscrepancyNet)}.`, 'cash');
  }
  const lowStockWithDemand = inventory.lowStockProducts.filter((product) => product.sold > 0);
  if (available('inventory') && lowStockWithDemand.length) {
    addSignal('stock-demand', 'estoque', 'medium', 'Estoque baixo com demanda observada', `${lowStockWithDemand.length} produto(s) com saldo baixo/esgotado tiveram ocorrências em pedidos no período.`, 'inventory');
  }
  if (available('orders') && orderMetrics.refundedOrders > 0) {
    addSignal('commerce-refunds', 'commerce', 'info', 'Pedidos marcados como reembolsados', `${orderMetrics.refundedOrders} pedido(s) estão marcados como reembolsados total ou parcialmente; este estado não comprova o valor nem a liquidação financeira do reembolso.`, 'orders');
  }
  if (available('graph') && safeOffers.length) {
    addSignal('cross-sell', 'commerce', 'info', 'Oportunidades agregadas de venda', `${offersTotal} cliente(s) têm uma próxima oferta sugerida pelas regras atuais; os nomes abaixo são agregados, sem ação automática.`, 'graph');
  }
  const network = buildBusinessNetwork({
    graphModel, graphSources: { ...graphSources, commerce: { ...(graphSources?.commerce || {}), ...commerce } },
    metrics, offers: safeOffers, quality: qualitySources,
    period: { days: safeDays, from: start.toISOString(), to: end.toISOString() }, now: end,
    businessLabel, scope,
  });

  return {
    period: { days: safeDays, from: start.toISOString(), to: end.toISOString() },
    metrics,
    signals: signals.slice(0, 50),
    network,
    quality: { sources: qualitySources },
  };
}
