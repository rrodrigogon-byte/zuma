const ALLOWED_PERIODS = new Set([1, 7, 30, 90]);
const DAY_MS = 86_400_000;
const TIME_ZONE = 'America/Cuiaba';

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => Number(num(value).toFixed(2));
const list = (value) => Array.isArray(value) ? value : [];

function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.valueOf()) ? null : date;
}

function timestamp(item = {}) {
  return dateValue(item.pagoEm || item.finalizadoEm || item.atualizadoEm || item.criadoEm || item.dataHora || item.dataAgenda || item.data);
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((item) => item.type !== 'literal').map((item) => [item.type, Number(item.value)]));
}

function zoneOffset(date, timeZone = TIME_ZONE) {
  const value = zonedParts(date, timeZone);
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) - date.getTime();
}

function localMidnightUtc(date, timeZone = TIME_ZONE) {
  const value = zonedParts(date, timeZone);
  const approximate = new Date(Date.UTC(value.year, value.month - 1, value.day));
  return new Date(approximate.getTime() - zoneOffset(approximate, timeZone));
}

function dayKey(value, timeZone = TIME_ZONE) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value);
  const date = dateValue(value);
  if (!date) return '';
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function inWindow(item, window) {
  const date = timestamp(item);
  return Boolean(date && date >= window.fromDate && date < window.toDate);
}

function pct(current, previous) {
  if (previous <= 0) return { value: null, available: false };
  return { value: Number((((current - previous) / previous) * 100).toFixed(1)), available: true };
}

export function dashboardPeriod(value, now = new Date(), timeZone = TIME_ZONE) {
  const parsed = Number.parseInt(String(value || '30'), 10);
  const days = ALLOWED_PERIODS.has(parsed) ? parsed : 30;
  const currentDay = localMidnightUtc(dateValue(now) || new Date(), timeZone);
  const fromDate = new Date(currentDay.getTime() - (days - 1) * DAY_MS);
  const toDate = dateValue(now) || new Date();
  const previousToDate = fromDate;
  const previousFromDate = new Date(fromDate.getTime() - days * DAY_MS);
  return {
    days, timeZone,
    from: fromDate.toISOString(), to: toDate.toISOString(),
    previousFrom: previousFromDate.toISOString(), previousTo: previousToDate.toISOString(),
    fromDate, toDate, previousFromDate, previousToDate,
  };
}

function zeroSeries(window) {
  const output = [];
  for (let cursor = new Date(window.fromDate); cursor < window.toDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
    output.push({ day: dayKey(cursor, window.timeZone), commerce: 0, barbershop: 0, retail: 0, total: 0, appointments: 0 });
  }
  return output;
}

function legacyRevenue(input, window) {
  const retail = list(input.retailSales)
    .filter((item) => item.status === 'pago' && !item.comandaId && inWindow(item, window));
  const commands = list(input.commands)
    .filter((item) => item.status === 'paga' && inWindow(item, window));
  return {
    retail,
    commands,
    total: money(retail.reduce((sum, item) => sum + num(item.total), 0) + commands.reduce((sum, item) => sum + num(item.totalPago || item.total), 0)),
    transactions: retail.length + commands.length,
  };
}

function paymentBreakdown(input, window) {
  const totals = new Map();
  const add = (method, value) => {
    const key = String(method || 'não informado').trim().toLowerCase() || 'não informado';
    totals.set(key, money((totals.get(key) || 0) + num(value)));
  };
  for (const sale of list(input.retailSales).filter((item) => item.status === 'pago' && !item.comandaId && inWindow(item, window))) {
    add(sale.pagamento?.meioPagamento || sale.meioPagamento, sale.total);
  }
  for (const command of list(input.commands).filter((item) => item.status === 'paga' && inWindow(item, window))) {
    const payments = list(command.pagamentos);
    if (payments.length) payments.forEach((payment) => add(payment.meioPagamento || payment.meio, payment.valor));
    else add(command.meioPagamento, command.totalPago || command.total);
  }
  return [...totals.entries()].map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
}

function saleItems(input, window) {
  const rows = [];
  for (const sale of list(input.retailSales).filter((item) => item.status === 'pago' && !item.comandaId && inWindow(item, window))) {
    for (const item of list(sale.itens)) rows.push({ name: item.nome || item.produtoNome || 'Produto', category: item.categoria || 'Revenda', quantity: num(item.quantidade || 1), revenue: num(item.subtotal || (num(item.precoUnitario) * num(item.quantidade || 1))) });
  }
  for (const command of list(input.commands).filter((item) => item.status === 'paga' && inWindow(item, window))) {
    for (const item of list(command.itens)) rows.push({ name: item.nome || item.descricao || 'Serviço', category: item.tipo === 'produto' ? 'Revenda' : (item.categoria || 'Serviços'), quantity: num(item.quantidade || 1), revenue: num(item.subtotal || item.total || (num(item.valorUnitario) * num(item.quantidade || 1))) });
  }
  return rows;
}

function aggregate(rows, keyName) {
  const totals = new Map();
  for (const row of rows) {
    const key = String(row[keyName] || 'Sem categoria');
    const current = totals.get(key) || { name: key, quantity: 0, revenue: 0 };
    current.quantity += num(row.quantity);
    current.revenue += num(row.revenue);
    totals.set(key, current);
  }
  return [...totals.values()].map((item) => ({ ...item, revenue: money(item.revenue) })).sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
}

function scheduleHeatmap(appointments, window) {
  const cells = new Map();
  for (const item of appointments.filter((entry) => !['cancelado', 'nao_compareceu'].includes(entry.status) && inWindow(entry, window))) {
    const date = timestamp(item);
    if (!date) continue;
    const parts = zonedParts(date, window.timeZone);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: window.timeZone, weekday: 'short' }).format(date).toLowerCase();
    const key = `${weekday}-${parts.hour}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  return [...cells.entries()].map(([key, value]) => {
    const [weekday, hour] = key.split('-');
    return { weekday, hour: Number(hour), value };
  });
}

function upcomingAppointments(appointments, now, timeZone) {
  return appointments
    .map((item) => ({ item, date: timestamp(item) }))
    .filter(({ item, date }) => date && date >= now && !['cancelado', 'nao_compareceu', 'concluido'].includes(item.status))
    .sort((a, b) => a.date - b.date)
    .slice(0, 8)
    .map(({ item, date }) => ({ id: item.id, at: date.toISOString(), day: dayKey(date, timeZone), customerId: item.clienteId || '', customer: item.clienteNome || item.cliente_nome || 'Cliente', service: item.servicoNome || item.servico_nome || 'Serviço', professional: item.profissionalNome || item.profissional_nome || 'A definir', status: item.status || 'agendado' }));
}

function activityFeed(input, now) {
  const rows = [
    ...list(input.appointments).map((item) => ({ type: 'appointment', at: timestamp(item), title: item.clienteNome || item.cliente_nome || 'Agendamento', detail: item.servicoNome || item.servico_nome || item.status || 'Agenda' })),
    ...list(input.retailSales).map((item) => ({ type: 'retail', at: timestamp(item), title: item.clienteNome || 'Venda de revenda', detail: item.status || 'Venda' })),
    ...list(input.commands).map((item) => ({ type: 'command', at: timestamp(item), title: item.clienteNome || 'Comanda', detail: item.status || 'Atendimento' })),
  ];
  return rows.filter((item) => item.at && item.at <= now).sort((a, b) => b.at - a.at).slice(0, 12).map((item) => ({ ...item, at: item.at.toISOString() }));
}

export function buildDinoDashboardAnalytics(input = {}, options = {}) {
  const now = dateValue(options.now) || new Date();
  const window = dashboardPeriod(options.period, now, options.timeZone || TIME_ZONE);
  const previousWindow = { ...window, fromDate: window.previousFromDate, toDate: window.previousToDate };
  const commerceCurrent = input.commerceCurrent || {};
  const commercePrevious = input.commercePrevious || {};
  const legacyCurrent = legacyRevenue(input, window);
  const legacyPrevious = legacyRevenue(input, previousWindow);
  const commerceRevenue = num(commerceCurrent.sales?.summary?.gross_total);
  const commercePreviousRevenue = num(commercePrevious.sales?.summary?.gross_total);
  const commerceOrders = num(commerceCurrent.sales?.summary?.orders_non_cancelled ?? commerceCurrent.sales?.summary?.orders);
  const commercePreviousOrders = num(commercePrevious.sales?.summary?.orders_non_cancelled ?? commercePrevious.sales?.summary?.orders);
  const commerceOrdersTotal = num(commerceCurrent.sales?.summary?.orders_total ?? commerceCurrent.sales?.summary?.orders);
  const commerceCapturedRevenue = list(commerceCurrent.sales?.capturedPayments).reduce((sum, item) => sum + num(item.value), 0);
  const revenue = money(commerceRevenue + legacyCurrent.total);
  const previousRevenue = money(commercePreviousRevenue + legacyPrevious.total);
  const transactions = commerceOrders + legacyCurrent.transactions;
  const previousTransactions = commercePreviousOrders + legacyPrevious.transactions;
  const appointments = list(input.appointments);
  const currentAppointments = appointments.filter((item) => inWindow(item, window));
  const previousAppointments = appointments.filter((item) => inWindow(item, previousWindow));
  // cliente novo = cadastrado no período (criadoEm), sem o cliente padrão e sem os trazidos por
  // importação; atualizar um cadastro antigo (consentimento, telefone) não o torna novo
  // A carga do AVEC (09/10/2026) marcou os 3.327 clientes trazidos com "Origem AVEC (carga …)" na observação.
  const importado = (item) => Boolean(item.importadoEm)
    || /import|avec|\(carga/i.test(`${item.origem || ''} ${item.origemCadastro || ''}`)
    || /^origem\s+\S+.*\(carga|importa[cç][aã]o|importado/i.test(String(item.observacao || ''));
  const customers = list(input.customers).filter((item) => !item.padrao && !importado(item));
  const createdIn = (item, w) => { const date = dateValue(item.criadoEm); return Boolean(date && date >= w.fromDate && date < w.toDate); };
  const currentNewCustomers = customers.filter((item) => createdIn(item, window)).length + num(commerceCurrent.customers?.summary?.new_customers);
  const previousNewCustomers = customers.filter((item) => createdIn(item, previousWindow)).length + num(commercePrevious.customers?.summary?.new_customers);
  const daily = zeroSeries(window);
  const byDay = new Map(daily.map((item) => [item.day, item]));
  for (const item of list(commerceCurrent.sales?.daily)) {
    const row = byDay.get(dayKey(item.day, window.timeZone));
    if (row) row.commerce = money(row.commerce + num(item.total));
  }
  for (const item of legacyCurrent.retail) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.retail = money(row.retail + num(item.total));
  }
  for (const item of legacyCurrent.commands) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.barbershop = money(row.barbershop + num(item.totalPago || item.total));
  }
  for (const item of currentAppointments) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.appointments += 1;
  }
  daily.forEach((row) => { row.total = money(row.commerce + row.barbershop + row.retail); });
  const receivables = money(list(input.financeEntries).filter((item) => !['pago', 'paga', 'cancelado', 'cancelada'].includes(String(item.status || '').toLowerCase()) && String(item.tipo || '').toLowerCase() === 'receita').reduce((sum, item) => sum + num(item.valor), 0));
  const retailLowStock = list(input.inventory).filter((item) => item.ativo !== false && num(item.estoqueAtual) <= num(item.estoqueMinimo)).length;
  const commerceLowStock = list(commerceCurrent.inventory?.items).filter((item) => item.low_stock === true || item.low_stock === 'true').length;
  const subscriptions = list(input.subscriptions).filter((item) => item.status === 'ativa');
  const mrr = money(subscriptions.reduce((sum, item) => sum + num(item.valorMensal || item.preco || item.valor), 0));
  const currentTicket = transactions ? money(revenue / transactions) : 0;
  const previousTicket = previousTransactions ? money(previousRevenue / previousTransactions) : 0;
  const trendRevenue = pct(revenue, previousRevenue);
  const trendTicket = pct(currentTicket, previousTicket);
  const trendCustomers = pct(currentNewCustomers, previousNewCustomers);
  const trendAppointments = pct(currentAppointments.length, previousAppointments.length);
  const items = saleItems(input, window);
  const commerceAvailable = Boolean(input.commerceAvailable);
  const profitCurrent = input.profit?.current || null;
  const profitPrevious = input.profit?.previous || null;
  const profitAvailable = Boolean(profitCurrent);
  const trendProfit = profitAvailable && profitPrevious ? pct(profitCurrent.resultado, profitPrevious.resultado) : { value: null, available: false };
  const funnelCurrent = input.funnel?.current || null;
  const funnelPrevious = input.funnel?.previous || null;
  const funnelAvailable = Boolean(funnelCurrent && num(funnelCurrent.visit) > 0);
  const conversion = funnelAvailable ? Number(((commerceOrders / num(funnelCurrent.visit)) * 100).toFixed(2)) : null;
  const previousConversion = funnelPrevious && num(funnelPrevious.visit) > 0 ? Number(((commercePreviousOrders / num(funnelPrevious.visit)) * 100).toFixed(2)) : null;
  const trendConversion = conversion != null && previousConversion ? pct(conversion, previousConversion) : { value: null, available: false };
  return {
    period: { days: window.days, from: window.from, to: window.to, previousFrom: window.previousFrom, previousTo: window.previousTo, timeZone: window.timeZone },
    kpis: [
      { id: 'revenue', label: 'Valor bruto registrado', value: revenue, previousValue: previousRevenue, trendPct: trendRevenue.value, trendAvailable: trendRevenue.available, available: true, format: 'currency' },
      profitAvailable
        ? { id: 'profit', label: 'Lucro estimado', value: profitCurrent.resultado, previousValue: profitPrevious?.resultado ?? null, trendPct: trendProfit.value, trendAvailable: trendProfit.available, available: true, format: 'currency', margin: profitCurrent.margem, breakdown: { receita: profitCurrent.receita, comissoes: profitCurrent.comissoes, cmvRevenda: profitCurrent.cmvRevenda, despesasPagas: profitCurrent.despesasPagas }, reason: (profitCurrent.notas || []).join(' ') }
        : { id: 'profit', label: 'Lucro', value: null, previousValue: null, trendPct: null, trendAvailable: false, available: false, format: 'currency', reason: 'Custos completos não estão disponíveis para todo o recorte.' },
      { id: 'ticket', label: 'Ticket médio bruto', value: currentTicket, previousValue: previousTicket, trendPct: trendTicket.value, trendAvailable: trendTicket.available, available: true, format: 'currency' },
      { id: 'newCustomers', label: 'Novos clientes', value: currentNewCustomers, previousValue: previousNewCustomers, trendPct: trendCustomers.value, trendAvailable: trendCustomers.available, available: true, format: 'number' },
      { id: 'appointments', label: 'Agendamentos', value: currentAppointments.length, previousValue: previousAppointments.length, trendPct: trendAppointments.value, trendAvailable: trendAppointments.available, available: true, format: 'number' },
      funnelAvailable
        ? { id: 'conversion', label: 'Conversão da loja', value: conversion, previousValue: previousConversion, trendPct: trendConversion.value, trendAvailable: trendConversion.available, available: true, format: 'percent', reason: 'Pedidos da loja online ÷ visitas únicas por dia.' }
        : { id: 'conversion', label: 'Conversão', value: null, previousValue: null, trendPct: null, trendAvailable: false, available: false, format: 'percent', reason: input.funnel ? 'Ainda sem visitas registradas na loja neste período.' : 'Tracking de visita e checkout ainda não está disponível.' },
    ],
    miniKpis: { receivables, lowStock: { total: retailLowStock + commerceLowStock, commerce: commerceLowStock, retail: retailLowStock }, mrr },
    charts: {
      revenueDaily: daily,
      appointmentsDaily: daily.map((item) => ({ day: item.day, value: item.appointments })),
      paymentMethods: paymentBreakdown(input, window),
      commercePaymentMethods: list(commerceCurrent.sales?.capturedPayments).map(item => ({ method: item.method, value: num(item.value) })),
      categorySales: aggregate(items, 'category').slice(0, 8),
      topProducts: aggregate(items, 'name').slice(0, 8),
      funnel: [
        { id: 'visits', label: 'Visitas', value: funnelCurrent ? num(funnelCurrent.visit) : null, available: Boolean(funnelCurrent) },
        { id: 'cart', label: 'Carrinho', value: funnelCurrent ? num(funnelCurrent.cart) : null, available: Boolean(funnelCurrent) },
        { id: 'checkout', label: 'Checkout', value: funnelCurrent ? num(funnelCurrent.checkout) : null, available: Boolean(funnelCurrent) },
        { id: 'orders', label: 'Pedidos', value: commerceOrdersTotal, available: commerceAvailable },
      ],
      scheduleHeatmap: scheduleHeatmap(appointments, window),
      channels: [
        { id: 'commerce', label: 'E-commerce', revenue: money(commerceRevenue), grossValue: money(commerceRevenue), capturedRevenue: money(commerceCapturedRevenue), pendingValue: money(commerceCurrent.sales?.summary?.pending_total), transactions: commerceOrders, ordersTotal: commerceOrdersTotal, pendingOrders: num(commerceCurrent.sales?.summary?.pending_orders), cancelledOrders: num(commerceCurrent.sales?.summary?.cancelled_orders), refundedOrders: num(commerceCurrent.sales?.summary?.refunded_orders), capturedTransactions: list(commerceCurrent.sales?.capturedPayments).reduce((sum, item) => sum + num(item.transactions), 0), available: commerceAvailable },
        { id: 'barbershop', label: 'Barbearia', revenue: money(legacyCurrent.commands.reduce((sum, item) => sum + num(item.totalPago || item.total), 0)), transactions: legacyCurrent.commands.length, available: true },
        { id: 'retail', label: 'Revenda', revenue: money(legacyCurrent.retail.reduce((sum, item) => sum + num(item.total), 0)), transactions: legacyCurrent.retail.length, available: true },
      ],
    },
    goals: input.goals || { configured: false, items: [] },
    activity: activityFeed(input, now),
    upcomingAppointments: upcomingAppointments(appointments, now, window.timeZone),
    dataQuality: {
      commerceAvailable,
      combinedRevenueAvailable: true,
      profitAvailable,
      funnelAvailable,
      notes: [
        profitAvailable ? 'Lucro estimado = receita da barbearia e revenda − comissões − custo da revenda − despesas pagas no Financeiro.' : 'Lucro indisponível até que todos os custos do recorte estejam persistidos.',
        funnelAvailable ? 'Funil da loja com visitas, carrinhos e checkouts únicos por sessão/dia.' : 'Funil parcial até a loja registrar visitas no período.',
        'Estoques Commerce e revenda são contados separadamente.',
      ],
    },
  };
}
