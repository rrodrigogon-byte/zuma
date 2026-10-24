import { mixForPeriod } from './core/avec-revenue-mix.js';
const ALLOWED_PERIODS = new Set([1, 7, 30, 90]);
const DAY_MS = 86_400_000;
const TIME_ZONE = 'America/Cuiaba';
const dateFormatters = new Map();

function dateFormatter(timeZone, weekdayOnly = false) {
  const key = JSON.stringify([timeZone, weekdayOnly]);
  if (!dateFormatters.has(key)) {
    const options = weekdayOnly ? { timeZone, weekday: 'short' } : {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    };
    // Intl mantém recursos nativos; reutilize-os sem acumular fusos indefinidamente.
    const formatter = new Intl.DateTimeFormat('en-US', options);
    if (dateFormatters.size >= 8) dateFormatters.delete(dateFormatters.keys().next().value);
    dateFormatters.set(key, formatter);
  }
  return dateFormatters.get(key);
}

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => Number(num(value).toFixed(2));
const list = (value) => Array.isArray(value) ? value : [];
const EXCLUDED_APPOINTMENT_STATUSES = new Set(['cancelado', 'cancelada', 'canceled', 'cancelled', 'cancelado_falta_confirmacao', 'cancelado_por_cliente', 'cancelado_cliente', 'nao_compareceu', 'faltou', 'falta', 'no_show', 'noshow', 'ausente', 'missed', 'remarcado', 'reagendado']);

function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.valueOf()) ? null : date;
}

function timestamp(item = {}) {
  return dateValue(item.pagoEm || item.dataOperacao || item.finalizadoEm || item.atualizadoEm || item.criadoEm || item.dataHora || item.dataAgenda || item.data);
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = dateFormatter(timeZone).formatToParts(date);
  return Object.fromEntries(parts.filter((item) => item.type !== 'literal').map((item) => [item.type, Number(item.value)]));
}

function zoneOffset(date, timeZone = TIME_ZONE) {
  const value = zonedParts(date, timeZone);
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) - date.getTime();
}

function localWallTimeToUtc(day, time, timeZone = TIME_ZONE) {
  const dateMatch = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, date] = dateMatch.map(Number);
  const [, hour, minute, second = '0'] = timeMatch;
  const wall = Date.UTC(year, month - 1, date, Number(hour), Number(minute), Number(second));
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== date) return null;
  let instant = wall;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = wall - zoneOffset(new Date(instant), timeZone);
    if (candidate === instant) break;
    instant = candidate;
  }
  const result = new Date(instant);
  const local = zonedParts(result, timeZone);
  if (local.year !== year || local.month !== month || local.day !== date || local.hour !== Number(hour) || local.minute !== Number(minute)) return null;
  return result;
}

function appointmentTimestamp(item = {}, timeZone = TIME_ZONE) {
  const raw = item.dataHora || item.data_hora || item.scheduledAt || item.scheduled_at;
  if (raw) {
    const value = String(raw).trim();
    const localMatch = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
    if (localMatch) return localWallTimeToUtc(localMatch[1], localMatch[2] + (localMatch[3] ? `:${localMatch[3]}` : ''), timeZone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = dateValue(value);
      if (parsed) return parsed;
    }
  }
  const day = String(item.dataAgenda || item.data_agenda || raw || '').slice(0, 10);
  const hour = String(item.horaLocal || item.hora_local || item.horaMarcada || item.hora_marcada || item.hora || '').slice(0, 5);
  return localWallTimeToUtc(day, hour, timeZone);
}

function normalizedAppointmentStatus(status) {
  return String(status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
}

function excludedAppointmentStatus(status) {
  return EXCLUDED_APPOINTMENT_STATUSES.has(normalizedAppointmentStatus(status));
}

function appointmentDayWindow(window, now) {
  const today = zonedParts(now, window.timeZone);
  const windowEnd = zonedParts(new Date(window.toDate.getTime() - 1), window.timeZone);
  const endIsToday = today.year === windowEnd.year && today.month === windowEnd.month && today.day === windowEnd.day;
  if (!endIsToday && window.toDate.valueOf() !== now.valueOf()) return window;
  const nextDay = new Date(Date.UTC(today.year, today.month - 1, today.day + 1)).toISOString().slice(0, 10);
  return { ...window, toDate: localWallTimeToUtc(nextDay, '00:00', window.timeZone) || window.toDate };
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

function inAppointmentWindow(item, window) {
  const date = appointmentTimestamp(item, window.timeZone);
  return Boolean(date && date >= window.fromDate && date < window.toDate);
}

export function filterDashboardRowsToStore(items, lojaId = '') {
  const rows = list(items);
  if (!lojaId) return rows;
  return rows.filter((item) => String(item?.lojaId || item?.loja_id || '') === String(lojaId));
}

function historicalDate(item = {}) {
  const raw = item.dataAgenda || item.dataComandaIso || item.dataFinalizacaoOriginal || item.data;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ''))) return localWallTimeToUtc(String(raw), '00:00');
  return dateValue(raw);
}

function inHistoricalWindow(item, window) {
  const date = historicalDate(item);
  return Boolean(date && date >= window.fromDate && date < window.toDate);
}

function historicalAvecSummary(input, window) {
  const services = list(input.historicalAppointments).filter((item) => inHistoricalWindow(item, window));
  const commands = list(input.historicalCommands).filter((item) => inHistoricalWindow(item, window));
  const identities = new Set();
  for (const item of [...services, ...commands]) {
    const identity = item.clienteId || item.clienteTelefone || item.clienteNome || item.cliente;
    if (identity) identities.add(String(identity).trim().toLowerCase());
  }
  return {
    services: { count: services.length, value: money(services.reduce((sum, item) => sum + num(item.valor), 0)) },
    commands: { count: commands.length, value: money(commands.reduce((sum, item) => sum + num(item.total), 0)) },
    uniqueClients: identities.size,
    reconciled: false,
    note: 'Histórico Avec preservado para conferência; não comprova pagamento, itemização conciliada ou conta a receber.',
  };
}

function historicalFinanceSummary(input, window) {
  const entries = list(input.financeEntries).filter(isHistoricalAvecFinance);
  const inPeriod = entries.filter((item) => inWindow(item, window));
  const paid = inPeriod.filter((item) => item.status === 'pago');
  const paidRevenueEntries = paid.filter((item) => item.tipo === 'receita');
  const paidExpenseEntries = paid.filter((item) => item.tipo === 'despesa');
  const paidRevenue = paidRevenueEntries.reduce((sum, item) => sum + num(item.valor), 0);
  const paidExpenses = paidExpenseEntries.reduce((sum, item) => sum + num(item.valor), 0);
  const pendingRevenue = inPeriod.filter((item) => item.tipo === 'receita' && item.status === 'pendente').reduce((sum, item) => sum + num(item.valor), 0);
  const pendingExpenses = inPeriod.filter((item) => item.tipo === 'despesa' && item.status === 'pendente').reduce((sum, item) => sum + num(item.valor), 0);
  return {
    entries: inPeriod.length,
    paidRevenueEntries: paidRevenueEntries.length,
    paidExpenseEntries: paidExpenseEntries.length,
    paidRevenue: money(paidRevenue),
    paidExpenses: money(paidExpenses),
    netPaid: money(paidRevenue - paidExpenses),
    pendingRevenue: money(pendingRevenue),
    pendingExpenses: money(pendingExpenses),
    includedInKpis: true,
    note: 'Receitas e despesas pagas do extrato Avec entram nos valores consolidados do período e permanecem identificadas no Financeiro como histórico; não são novas vendas operacionais.',
  };
}

function isHistoricalAvecFinance(item = {}) {
  return item.metadata?.historicoAvec === true || item.origem === 'avec-import-financeiro-20261022';
}

function historicalPaymentBreakdown(input, window) {
  const totals = new Map();
  for (const item of list(input.financeEntries).filter((entry) => isHistoricalAvecFinance(entry) && entry.tipo === 'receita' && entry.status === 'pago' && inWindow(entry, window))) {
    const method = String(item.meioPagamento || 'não informado').trim().toLowerCase() || 'não informado';
    const key = `Histórico Avec · ${method}`;
    totals.set(key, money((totals.get(key) || 0) + num(item.valor)));
  }
  return [...totals.entries()].map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
}

function historicalCategoryRows(input, window) {
  return list(input.financeEntries)
    .filter((item) => isHistoricalAvecFinance(item) && item.tipo === 'receita' && item.status === 'pago' && inWindow(item, window))
    .map((item) => ({ name: 'Histórico Avec', category: `Histórico Avec · ${item.categoria || 'Receitas'}`, quantity: 1, revenue: num(item.valor) }));
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
    output.push({ day: dayKey(cursor, window.timeZone), commerce: 0, barbershop: 0, retail: 0, historicalAvec: 0, total: 0, appointments: 0 });
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
    for (const item of list(sale.itens)) rows.push({ name: item.nome || item.produtoNome || 'Produto', category: item.categoria || 'Revenda', mixCategory: 'products', quantity: num(item.quantidade || 1), revenue: num(item.subtotal || (num(item.precoUnitario) * num(item.quantidade || 1))) });
  }
  for (const command of list(input.commands).filter((item) => item.status === 'paga' && inWindow(item, window))) {
    for (const item of list(command.itens)) rows.push({ name: item.nome || item.descricao || 'Serviço', category: item.tipo === 'produto' ? 'Revenda' : item.tipo === 'loja' ? 'Loja' : (item.categoria || 'Serviços'), mixCategory: ['produto', 'loja'].includes(item.tipo) ? 'products' : 'services', quantity: num(item.quantidade || 1), revenue: num(item.subtotal || item.total || (num(item.valorUnitario) * num(item.quantidade || 1))) });
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

/**
 * O mix usa itens tipados da operação e do relatório Avec auditado.
 * Recebimentos financeiros sem itemização não são classificados por suposição.
 * No período coberto, o snapshot substitui os itens da operação para não somar
 * duas representações da mesma venda.
 */
function strategicRevenueMix(input, window, consolidatedRevenue) {
  const totals = new Map([
    ['services', { value: 0, records: 0 }],
    ['products', { value: 0, records: 0 }],
    ['plans', { value: 0, records: 0 }],
    ['tips', { value: 0, records: 0 }],
  ]);
  const add = (id, value, records = 1) => {
    const item = totals.get(id);
    if (!item) return;
    item.value += num(value);
    item.records += records;
  };

  const dayFor = date => { const p = zonedParts(date, window.timeZone); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };
  const coveredByAvec = date => { const day = date && dayFor(date); return Boolean(day && input.historicalMix && day >= input.historicalMix.summary.from && day <= input.historicalMix.summary.to); };
  // No intervalo completo exportado, o 0186 é a fonte exclusiva do mix.
  // Não somar outra vez itens operacionais/assinaturas que possam representar a mesma venda.
  const items = saleItems(input.historicalMix ? { ...input, commands: list(input.commands).filter(row => !coveredByAvec(timestamp(row))), retailSales: list(input.retailSales).filter(row => !coveredByAvec(timestamp(row))) } : input, window);
  for (const item of items) add(item.mixCategory, item.revenue);

  if (input.subscriptionPaymentsAvailable !== false) {
    for (const payment of list(input.subscriptionPayments)) {
      const paidAt = dateValue(payment.registradoEm || payment.recordedAt || payment.pagoEm);
      if (!paidAt || paidAt < window.fromDate || paidAt >= window.toDate || coveredByAvec(paidAt)) continue;
      if (num(payment.valor) <= 0) continue;
      add('plans', payment.valor);
    }
  }

  const historicalEnd = localMidnightUtc(window.toDate, window.timeZone);
  if (window.toDate > historicalEnd) historicalEnd.setTime(historicalEnd.getTime() + DAY_MS);
  const historicalDetails = mixForPeriod(input.historicalMix, dayFor(window.fromDate), dayFor(historicalEnd));
  for (const row of historicalDetails) add(row.type, row.value, row.records);
  const definitions = [
    { id: 'services', label: 'Serviços', description: 'Itens de serviço em comandas pagas' },
    { id: 'products', label: 'Produtos', description: 'Revenda direta e itens de produto em comandas pagas' },
    { id: 'plans', label: 'Planos e pacotes', description: 'Pacotes Avec e ciclos de assinatura com pagamento registrado' },
    ...(input.historicalMix ? [{ id: 'tips', label: 'Gorjetas', description: 'Caixinhas identificadas no Avec' }] : []),
  ];
  const planPaymentsAvailable = input.subscriptionPaymentsAvailable !== false;
  const total = [...totals.values()].reduce((sum, item) => sum + item.value, 0);
  const operationalItemized = items.reduce((sum, item) => sum + num(item.revenue), 0);
  const unclassifiedConsolidatedRevenue = Math.max(0, num(consolidatedRevenue) - operationalItemized);
  return {
    total: money(total),
    historical: input.historicalMix ? { reportHash: input.historicalMix.reportHash, ...input.historicalMix.summary, selectedFrom: dayFor(window.fromDate), selectedToExclusive: dayFor(historicalEnd), value: money(historicalDetails.reduce((sum, row) => sum + row.value, 0)), details: historicalDetails } : null,
    historicalMixUnavailable: input.historicalMixUnavailable === true,
    basis: input.historicalMix ? 'sold-items-and-operational-payments' : 'operational-payments',
    items: definitions.map((definition) => {
      const item = totals.get(definition.id);
      const value = money(item?.value || 0);
      const available = definition.id !== 'plans' || planPaymentsAvailable || Boolean(input.historicalMix);
      return {
        ...definition,
        value,
        records: item?.records || 0,
        percentage: available && total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
        available,
        coverageReason: available ? null : (input.subscriptionPaymentsReason || 'Os pagamentos de planos não estão disponíveis neste escopo.'),
      };
    }),
    operationalItemizedRevenue: money(operationalItemized),
    consolidatedRevenue: money(consolidatedRevenue),
    unclassifiedConsolidatedRevenue: money(unclassifiedConsolidatedRevenue),
    reconciliationDelta: money(num(consolidatedRevenue) - operationalItemized),
    planPaymentsAvailable,
    planPaymentsReason: input.subscriptionPaymentsReason || null,
    note: input.historicalMix ? 'Histórico Avec por data de venda: valor da linha menos desconto. No intervalo coberto, o 0186 substitui os demais itens do mix para evitar sobreposição. O caixa consolidado usa recebimentos e pode divergir por datas e ajustes. Estes itens não geram novos lançamentos financeiros nem movimentam estoque.' : 'A base percentual reúne apenas valores com classificação comercial rastreável. Histórico financeiro, e-commerce sem itemização e ajustes não são redistribuídos entre as categorias.',
  };
}

// O Avec não exporta a hora do atendimento. O horário confiável disponível é o de
// fechamento da comanda; só entra no mapa a comanda fechada no MESMO dia em que foi
// aberta (fechamento em outro dia não representa o horário do atendimento).
export function historicalCommandSlot(item = {}, timeZone = TIME_ZONE) {
  const day = String(item.dataComandaIso || '').slice(0, 10);
  const match = String(item.dataFinalizacaoOriginal || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !match) return null;
  if (`${match[3]}-${match[2]}-${match[1]}` !== day) return null;
  return localWallTimeToUtc(day, `${match[4]}:${match[5]}`, timeZone);
}

// A partir do primeiro dia com agenda no Kytto, os mesmos atendimentos também
// estão na agenda: o histórico Avec só preenche os dias anteriores (sem duplicar).
export function firstAgendaDay(appointments = [], timeZone = TIME_ZONE) {
  let first = '';
  for (const item of list(appointments)) {
    const date = appointmentTimestamp(item, timeZone);
    const day = date ? dayKey(date, timeZone) : String(item?.dataAgenda || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && (!first || day < first)) first = day;
  }
  return first;
}

function mergedScheduleHeatmap(appointments, historicalCommands, window) {
  const cells = new Map();
  const cutoff = firstAgendaDay(appointments, window.timeZone);
  const add = (date, field) => {
    const parts = zonedParts(date, window.timeZone);
    const weekday = dateFormatter(window.timeZone, true).format(date).toLowerCase();
    const key = `${weekday}-${parts.hour}`;
    const cell = cells.get(key) || { weekday, hour: parts.hour, value: 0, agenda: 0, historicoAvec: 0 };
    cell.value += 1;
    cell[field] += 1;
    cells.set(key, cell);
  };
  for (const item of appointments.filter((entry) => !excludedAppointmentStatus(entry.status) && inAppointmentWindow(entry, window))) {
    const date = appointmentTimestamp(item, window.timeZone);
    if (date) add(date, 'agenda');
  }
  for (const item of list(historicalCommands)) {
    const date = historicalCommandSlot(item, window.timeZone);
    if (cutoff && String(item.dataComandaIso || '').slice(0, 10) >= cutoff) continue;
    if (date && date >= window.fromDate && date < window.toDate) add(date, 'historicoAvec');
  }
  return [...cells.values()];
}

function upcomingAppointments(appointments, now, timeZone) {
  const excludedStatuses = new Set(['concluido', 'finalizado', 'em_atendimento']);
  return appointments
    .map((item) => ({ item, date: appointmentTimestamp(item, timeZone) }))
    .filter(({ item, date }) => date && date >= now && !excludedAppointmentStatus(item.status) && !excludedStatuses.has(normalizedAppointmentStatus(item.status)))
    .sort((a, b) => a.date - b.date)
    .slice(0, 8)
    .map(({ item, date }) => ({ id: item.id, at: date.toISOString(), day: dayKey(date, timeZone), customerId: item.clienteId || '', customer: item.clienteNome || item.cliente_nome || 'Cliente', service: item.servicoNome || item.servico_nome || 'Serviço', professional: item.profissionalNome || item.profissional_nome || 'A definir', status: item.status || 'agendado' }));
}

function activityFeed(input, now, window) {
  // Guarde só os 12 eventos exibidos. Empates mantêm a ordem das fontes,
  // como o sort estável anterior, sem materializar e ordenar o histórico inteiro.
  const recent = [];
  const consider = (item, type, at) => {
    if (!at || at > now || at < window.fromDate || at >= window.toDate) return;
    let index = 0;
    while (index < recent.length && recent[index].at >= at) index += 1;
    if (index >= 12) return;
    recent.splice(index, 0, { item, type, at });
    if (recent.length > 12) recent.pop();
  };
  for (const item of list(input.appointments)) consider(item, 'appointment', timestamp(item));
  for (const item of list(input.retailSales)) consider(item, 'retail', timestamp(item));
  for (const item of list(input.commands)) consider(item, 'command', timestamp(item));
  for (const item of list(input.historicalAppointments)) consider(item, 'historical-service', historicalDate(item));
  for (const item of list(input.historicalCommands)) consider(item, 'historical-command', historicalDate(item));
  for (const item of list(input.financeEntries)) consider(item, 'finance', timestamp(item));
  return recent.map(({ item, type, at }) => {
    const date = at.toISOString();
    if (type === 'appointment') return { type, at: date, title: item.clienteNome || item.cliente_nome || 'Agendamento', detail: item.servicoNome || item.servico_nome || item.status || 'Agenda' };
    if (type === 'retail') return { type, at: date, title: item.clienteNome || 'Venda de revenda', detail: item.status || 'Venda' };
    if (type === 'command') return { type, at: date, title: item.clienteNome || 'Comanda', detail: item.status || 'Atendimento' };
    if (type === 'historical-service') return { type: 'historical', at: date, title: item.clienteNome || item.cliente_nome || 'Atendimento histórico', detail: `${item.servicoNome || item.servico || 'Atendimento'} · histórico Avec` };
    if (type === 'historical-command') return { type: 'historical', at: date, title: item.clienteNome || item.cliente_nome || 'Comanda histórica', detail: 'Comanda · histórico Avec' };
    return { type, at: date, title: `Lançamento ${item.tipo || 'financeiro'}`, detail: `${item.status || 'registrado'} · ${item.categoria || 'Financeiro'}`, value: num(item.valor) };
  });
}

export function buildDinoDashboardAnalytics(input = {}, options = {}) {
  const now = dateValue(options.now) || new Date();
  // O BI pode fornecer uma janela civil explícita; assim, cards e mix usam o
  // mesmo intervalo de um relatório customizado, inclusive na comparação.
  const window = options.window || dashboardPeriod(options.period, now, options.timeZone || TIME_ZONE);
  const scopeLevel = input.scope?.level === 'unit' ? 'unit' : 'company';
  const previousWindow = { ...window, fromDate: window.previousFromDate, toDate: window.previousToDate };
  const historicalAvec = historicalAvecSummary(input, window);
  const historicalFinance = historicalFinanceSummary(input, window);
  const historicalFinancePrevious = historicalFinanceSummary(input, previousWindow);
  const commerceCurrent = input.commerceCurrent || {};
  const commercePrevious = input.commercePrevious || {};
  const legacyCurrent = legacyRevenue(input, window);
  const legacyPrevious = legacyRevenue(input, previousWindow);
  // Receita e conversão usam exclusivamente pedidos em estado confirmado.
  // Pendências e capturas permanecem métricas separadas no canal Commerce.
  const commerceRevenue = num(commerceCurrent.sales?.summary?.confirmed_total);
  const commercePreviousRevenue = num(commercePrevious.sales?.summary?.confirmed_total);
  const commerceOrders = num(commerceCurrent.sales?.summary?.confirmed_orders);
  const commercePreviousOrders = num(commercePrevious.sales?.summary?.confirmed_orders);
  const commerceOrdersTotal = num(commerceCurrent.sales?.summary?.orders_total ?? commerceCurrent.sales?.summary?.orders);
  const commerceCapturedRevenue = list(commerceCurrent.sales?.capturedPayments).reduce((sum, item) => sum + num(item.value), 0);
  const revenue = money(commerceRevenue + legacyCurrent.total + historicalFinance.paidRevenue);
  const previousRevenue = money(commercePreviousRevenue + legacyPrevious.total + historicalFinancePrevious.paidRevenue);
  const transactions = commerceOrders + legacyCurrent.transactions + historicalFinance.paidRevenueEntries;
  const previousTransactions = commercePreviousOrders + legacyPrevious.transactions + historicalFinancePrevious.paidRevenueEntries;
  const appointments = list(input.appointments);
  const currentAppointmentWindow = appointmentDayWindow(window, now);
  const currentAppointments = appointments.filter((item) => inAppointmentWindow(item, currentAppointmentWindow));
  const previousAppointments = appointments.filter((item) => inAppointmentWindow(item, previousWindow));
  // cliente novo = cadastrado no período (criadoEm), sem o cliente padrão e sem os trazidos por
  // importação; atualizar um cadastro antigo (consentimento, telefone) não o torna novo
  // A carga do AVEC (09/10/2026) marcou os 3.327 clientes trazidos com "Origem AVEC (carga …)" na observação.
  // A carga completa (22/10/2026) grava origemImportacao/sourceSystem em vez de origem/observação.
  const importado = (item) => Boolean(item.importadoEm || item.origemImportacao)
    || /^avec$/i.test(String(item.sourceSystem || ''))
    || /import|avec|\(carga/i.test(`${item.origem || ''} ${item.origemCadastro || ''}`)
    || /^origem\s+\S+.*\(carga|importa[cç][aã]o|importado/i.test(String(item.observacao || ''));
  const unitCustomerIds = new Set([
    ...appointments,
    ...list(input.retailSales),
    ...list(input.commands),
    ...list(input.historicalAppointments),
    ...list(input.historicalCommands),
  ].map((item) => String(item?.clienteId || item?.cliente_id || '')).filter(Boolean));
  const customers = list(input.customers).filter((item) => !item.padrao && !importado(item)
    && (scopeLevel !== 'unit' || unitCustomerIds.has(String(item.id || '')) || String(item.lojaId || item.loja_id || '') === String(input.scope?.unitId || '')));
  const createdIn = (item, w) => { const date = dateValue(item.criadoEm); return Boolean(date && date >= w.fromDate && date < w.toDate); };
  const currentNewCustomers = customers.filter((item) => createdIn(item, window)).length + num(commerceCurrent.customers?.summary?.new_customers);
  const previousNewCustomers = customers.filter((item) => createdIn(item, previousWindow)).length + num(commercePrevious.customers?.summary?.new_customers);
  const daily = zeroSeries(window);
  const byDay = new Map(daily.map((item) => [item.day, item]));
  for (const item of list(commerceCurrent.sales?.daily)) {
    const row = byDay.get(dayKey(item.day, window.timeZone));
    if (row) row.commerce = money(row.commerce + num(item.confirmed_total));
  }
  for (const item of legacyCurrent.retail) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.retail = money(row.retail + num(item.total));
  }
  for (const item of legacyCurrent.commands) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.barbershop = money(row.barbershop + num(item.totalPago || item.total));
  }
  for (const item of list(input.financeEntries).filter((entry) => isHistoricalAvecFinance(entry) && entry.tipo === 'receita' && entry.status === 'pago' && inWindow(entry, window))) {
    const row = byDay.get(dayKey(timestamp(item), window.timeZone));
    if (row) row.historicalAvec = money(row.historicalAvec + num(item.valor));
  }
  for (const item of currentAppointments) {
    const row = byDay.get(dayKey(appointmentTimestamp(item, window.timeZone), window.timeZone));
    if (row) row.appointments += 1;
  }
  daily.forEach((row) => { row.total = money(row.commerce + row.barbershop + row.retail + row.historicalAvec); });
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
  const items = [...saleItems(input, window), ...historicalCategoryRows(input, window)];
  const strategicMix = strategicRevenueMix(input, window, revenue);
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
  const heatmapCells = mergedScheduleHeatmap(appointments, input.historicalCommands, currentAppointmentWindow);
  const activity = activityFeed(input, now, window);
  const upcoming = upcomingAppointments(appointments, now, window.timeZone);
  const paymentMethods = [...paymentBreakdown(input, window), ...historicalPaymentBreakdown(input, window)];
  const commercePaymentMethods = list(commerceCurrent.sales?.capturedPayments).map((item) => ({ method: item.method, value: num(item.value) }));
  const heatmapAppointmentCount = heatmapCells.reduce((sum, item) => sum + item.agenda, 0);
  const heatmapHistoricalCount = heatmapCells.reduce((sum, item) => sum + item.historicoAvec, 0);
  const goals = input.goals || { configured: false, items: [] };
  const unitDataExclusions = input.unassignedRecords || {};
  const dataQualityNotes = [
    profitAvailable ? 'Resultado consolidado = operação, e-commerce com custo conhecido e histórico Avec pago − comissões − custo da revenda − despesas pagas; a origem histórica permanece identificada.' : 'Lucro indisponível até que todos os custos do recorte estejam persistidos.',
    funnelAvailable ? 'Funil da loja com visitas, carrinhos e checkouts únicos por sessão/dia.' : 'Funil parcial até a loja registrar visitas no período.',
    'Estoques Commerce e revenda são contados separadamente.',
    `Horários movimentados usam a hora marcada no fuso ${window.timeZone}; cancelamentos e faltas não entram no mapa.`,
    'Histórico Avec no mapa de horários: o Avec não exporta a hora do atendimento; usa-se a hora de fechamento das comandas fechadas no mesmo dia em que foram abertas, e só nos dias anteriores ao primeiro agendamento do Kytto (depois disso vale a agenda).',
    'A atividade recente usa a data persistida/criada/atualizada do registro; heatmap e próximos compromissos usam a data e a hora marcadas.',
  ];
  if (scopeLevel === 'unit') {
    dataQualityNotes.push('Escopo operacional: unidade ativa. Registros sem unidade identificada são omitidos, não atribuídos por suposição.');
    dataQualityNotes.push('Novos clientes são contados quando ligados a uma operação desta unidade; MRR e metas permanecem no escopo da empresa.');
    if (goals.configured) dataQualityNotes.push('O progresso das metas corporativas não é comparado ao realizado de uma única unidade.');
    const unassignedCount = num(unitDataExclusions.appointments) + num(unitDataExclusions.historicalAppointments) + num(unitDataExclusions.historicalCommands);
    if (unassignedCount) dataQualityNotes.push(`${unassignedCount.toLocaleString('pt-BR')} registro(s) de agenda/histórico sem unidade foram excluídos deste recorte.`);
  }
  if (!commerceAvailable && input.commerceUnavailableReason) dataQualityNotes.push(`Commerce indisponível neste recorte (${input.commerceUnavailableReason}); os valores restantes não incluem pedidos da loja.`);
  return {
    period: { days: window.days, from: window.from, to: window.to, previousFrom: window.previousFrom, previousTo: window.previousTo, timeZone: window.timeZone },
    scope: { level: scopeLevel, label: scopeLevel === 'unit' ? 'Unidade ativa' : 'Empresa' },
    kpis: [
      { id: 'revenue', label: 'Valor bruto registrado', value: revenue, previousValue: previousRevenue, trendPct: trendRevenue.value, trendAvailable: trendRevenue.available, available: true, format: 'currency' },
      profitAvailable
        ? { id: 'profit', label: 'Resultado consolidado', value: profitCurrent.resultado, previousValue: profitPrevious?.resultado ?? null, trendPct: trendProfit.value, trendAvailable: trendProfit.available, available: true, format: 'currency', margin: profitCurrent.margem, breakdown: { receita: profitCurrent.receita, receitaOperacional: profitCurrent.receitaOperacional, receitaHistoricaAvec: profitCurrent.receitaHistoricaAvec, comissoes: profitCurrent.comissoes, cmvRevenda: profitCurrent.cmvRevenda, despesasPagas: profitCurrent.despesasPagas, despesasHistoricasAvec: profitCurrent.despesasHistoricasAvec }, reason: (profitCurrent.notas || []).join(' ') }
        : { id: 'profit', label: 'Lucro', value: null, previousValue: null, trendPct: null, trendAvailable: false, available: false, format: 'currency', reason: 'Custos completos não estão disponíveis para todo o recorte.' },
      { id: 'ticket', label: 'Ticket médio bruto', value: currentTicket, previousValue: previousTicket, trendPct: trendTicket.value, trendAvailable: trendTicket.available, available: true, format: 'currency' },
      { id: 'newCustomers', label: scopeLevel === 'unit' ? 'Novos clientes vinculados à unidade' : 'Novos clientes', value: currentNewCustomers, previousValue: previousNewCustomers, trendPct: trendCustomers.value, trendAvailable: trendCustomers.available, available: true, format: 'number' },
      { id: 'appointments', label: 'Agendamentos', value: currentAppointments.length, previousValue: previousAppointments.length, trendPct: trendAppointments.value, trendAvailable: trendAppointments.available, available: true, format: 'number' },
      funnelAvailable
        ? { id: 'conversion', label: 'Conversão da loja', value: conversion, previousValue: previousConversion, trendPct: trendConversion.value, trendAvailable: trendConversion.available, available: true, format: 'percent', reason: 'Pedidos da loja online ÷ visitas únicas por dia.' }
        : { id: 'conversion', label: 'Conversão', value: null, previousValue: null, trendPct: null, trendAvailable: false, available: false, format: 'percent', reason: input.funnel ? 'Ainda sem visitas registradas na loja neste período.' : 'Tracking de visita e checkout ainda não está disponível.' },
    ],
    miniKpis: { receivables, lowStock: { total: retailLowStock + commerceLowStock, commerce: commerceLowStock, retail: retailLowStock }, mrr, mrrScope: 'company' },
    historicalAvec,
    historicalFinance,
    strategicMix,
    charts: {
      revenueDaily: daily,
      appointmentsDaily: daily.map((item) => ({ day: item.day, value: item.appointments })),
      paymentMethods,
      commercePaymentMethods,
      categorySales: aggregate(items, 'category').slice(0, 8),
      topProducts: aggregate(items, 'name').slice(0, 8),
      funnel: [
        { id: 'visits', label: 'Visitas', value: funnelCurrent ? num(funnelCurrent.visit) : null, available: Boolean(funnelCurrent) },
        { id: 'cart', label: 'Carrinho', value: funnelCurrent ? num(funnelCurrent.cart) : null, available: Boolean(funnelCurrent) },
        { id: 'checkout', label: 'Checkout', value: funnelCurrent ? num(funnelCurrent.checkout) : null, available: Boolean(funnelCurrent) },
        { id: 'orders', label: 'Pedidos', value: commerceOrdersTotal, available: commerceAvailable },
      ],
      scheduleHeatmap: heatmapCells,
      channels: [
        { id: 'commerce', label: 'E-commerce confirmado', revenue: money(commerceRevenue), grossValue: money(commerceRevenue), capturedRevenue: money(commerceCapturedRevenue), pendingValue: money(commerceCurrent.sales?.summary?.pending_total), transactions: commerceOrders, ordersTotal: commerceOrdersTotal, pendingOrders: num(commerceCurrent.sales?.summary?.pending_orders), cancelledOrders: num(commerceCurrent.sales?.summary?.cancelled_orders), refundedOrders: num(commerceCurrent.sales?.summary?.refunded_orders), capturedTransactions: list(commerceCurrent.sales?.capturedPayments).reduce((sum, item) => sum + num(item.transactions), 0), available: commerceAvailable },
        { id: 'barbershop', label: 'Barbearia', revenue: money(legacyCurrent.commands.reduce((sum, item) => sum + num(item.totalPago || item.total), 0)), transactions: legacyCurrent.commands.length, available: true },
        { id: 'retail', label: 'Revenda', revenue: money(legacyCurrent.retail.reduce((sum, item) => sum + num(item.total), 0)), transactions: legacyCurrent.retail.length, available: true },
        { id: 'historical-avec', label: 'Histórico Avec', revenue: historicalFinance.paidRevenue, grossValue: historicalFinance.paidRevenue, expenses: historicalFinance.paidExpenses, transactions: historicalFinance.paidRevenueEntries, available: true, historical: true },
      ],
    },
    goals,
    activity,
    upcomingAppointments: upcoming,
    dataQuality: {
      commerceAvailable,
      combinedRevenueAvailable: true,
      profitAvailable,
      funnelAvailable,
      sources: {
        agenda: { status: heatmapAppointmentCount || heatmapHistoricalCount ? 'ok' : 'empty', recordsInPeriod: currentAppointments.length, recordsInHeatmap: heatmapAppointmentCount, historicalInHeatmap: heatmapHistoricalCount, upcoming: upcoming.length, scope: scopeLevel, timeZone: window.timeZone },
        activity: { status: activity.length ? 'ok' : 'empty', recordsInPeriod: activity.length, scope: scopeLevel },
        payments: { status: paymentMethods.length ? 'ok' : 'empty', methods: paymentMethods.length, total: money(paymentMethods.reduce((sum, item) => sum + num(item.value), 0)), commerceCapturedMethods: commercePaymentMethods.length, commerceCapturedTotal: money(commercePaymentMethods.reduce((sum, item) => sum + num(item.value), 0)) },
        commerce: { status: commerceAvailable ? 'ok' : 'unavailable', reason: input.commerceUnavailableReason || null },
        goals: { status: !goals.configured ? 'empty' : goals.comparable === false ? 'limited' : 'ok', scope: 'company', comparable: goals.comparable !== false },
      },
      notes: dataQualityNotes,
    },
  };
}
