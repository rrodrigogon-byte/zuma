import { calcularComissoesEstado } from './barbearia-erp-kytto.js';
import { historicoAvecVigente, canonizarRegistroAvec } from './dino-historico-avec.js';
import { profissionalKyttoDoAvec } from './dino-vinculos-avec.js';

const TIME_ZONE = 'America/Cuiaba';
const MAX_DAYS = 93;
// Histórico completo (Avec + operação): até ~10 anos, com série mensal.
const MAX_DAYS_HISTORY = 3660;
export const UNATTRIBUTED_PROFESSIONAL_ID = '__sem_profissional__';
const DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' });
const HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cuiaba', hour: '2-digit', hourCycle: 'h23' });
const DAY_MS = 86_400_000;
const PERIOD_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMISSION_STATUSES = new Set(['paga', 'em_conta']);

const list = (value) => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []);
const text = (value) => String(value ?? '').trim();
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) => Number(num(value).toFixed(2));
const pct = (value) => Number(num(value).toFixed(1));

function warnOnce(warnings, message) {
  if (message && !warnings.includes(message)) warnings.push(message);
}

function companyMatches(item, empresaId) {
  if (!item || typeof item !== 'object') return false;
  return item.empresaId !== undefined && item.empresaId !== null && item.empresaId !== '' && String(item.empresaId) === String(empresaId);
}

function idOf(item) {
  return text(item?.id);
}

function unitOf(item) {
  return text(item?.lojaId ?? item?.loja_id);
}

function exactUnit(item, lojaId) {
  return Boolean(unitOf(item) && unitOf(item) === String(lojaId));
}

function parseDateOnly(value) {
  const raw = text(value);
  if (!PERIOD_RE.test(raw)) throw Object.assign(new Error('Período deve usar AAAA-MM-DD.'), { code: 'PERIOD_INVALID' });
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw) {
    throw Object.assign(new Error('Data de período inválida.'), { code: 'PERIOD_INVALID' });
  }
  return date;
}

function validatePeriod(options = {}) {
  const inicio = text(options.inicio);
  const fim = text(options.fim);
  const start = parseDateOnly(inicio);
  const end = parseDateOnly(fim);
  const days = Math.round((end - start) / DAY_MS) + 1;
  if (start > end) throw Object.assign(new Error('O início do período deve ser menor ou igual ao fim.'), { code: 'PERIOD_INVALID' });
  const maxDays = options.historico ? MAX_DAYS_HISTORY : MAX_DAYS;
  if (days > maxDays) throw Object.assign(new Error(`O período máximo é de ${maxDays} dias.`), { code: 'PERIOD_INVALID' });
  const previousEnd = new Date(start.valueOf() - DAY_MS);
  const previousStart = new Date(previousEnd.valueOf() - (days - 1) * DAY_MS);
  return {
    inicio,
    fim,
    days,
    timeZone: TIME_ZONE,
    previousInicio: previousStart.toISOString().slice(0, 10),
    previousFim: previousEnd.toISOString().slice(0, 10),
  };
}

function dateOnlyFrom(value) {
  const raw = text(value);
  if (PERIOD_RE.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) return '';
  return DAY_FORMATTER.format(date);
}

function dateInPeriod(value, period) {
  const date = dateOnlyFrom(value);
  return Boolean(date && date >= period.inicio && date <= period.fim);
}

function dayIndex(date) {
  if (!PERIOD_RE.test(date)) return null;
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function localHour(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.valueOf())) return null;
  return Number(HOUR_FORMATTER.format(date));
}

function cloneRecord(item) {
  if (!item || typeof item !== 'object') return item;
  const cloned = { ...item };
  if (cloned.lojaId === undefined && cloned.loja_id !== undefined) cloned.lojaId = cloned.loja_id;
  return cloned;
}

function recordsForCompany(value, empresaId) {
  return list(value).filter((item) => companyMatches(item, empresaId)).map(cloneRecord);
}

// O extrato financeiro do Avec da Dino foi gravado no cadastro legado (emp-kytto-001 /
// dino-web-estoque). Aqui ele é somado ao canônico, com os ids convertidos e sem repetir
// lançamento que já exista no canônico (mesmo id, chave de idempotência ou impressão).
function lancamentosComCadastroLegado(root, financeCompany, empresaId) {
  const proprios = list(financeCompany.lancamentos);
  const ids = new Set(proprios.map(idOf).filter(Boolean));
  const chaves = new Set(proprios.map((item) => item?.chaveIdempotencia).filter(Boolean));
  const impressoes = new Set(proprios.map((item) => item?.fingerprint).filter(Boolean));
  const extras = [];
  for (const [chave, store] of Object.entries(root?.financeiroKytto?.empresas || {})) {
    if (chave === String(empresaId)) continue;
    for (const item of list(store?.lancamentos)) {
      const canonico = canonizarRegistroAvec(item);
      if (!canonico || String(canonico.empresaId) !== String(empresaId) || String(item.empresaId) === String(empresaId)) continue;
      if (ids.has(idOf(item)) || (item.chaveIdempotencia && chaves.has(item.chaveIdempotencia)) || (item.fingerprint && impressoes.has(item.fingerprint))) continue;
      extras.push({ ...canonico, somenteLeitura: true, fonteCadastro: 'legado' });
    }
  }
  return [...proprios, ...extras];
}

function normalizeRoot(root, empresaId, lojaId) {
  const barbearia = root?.barbearias?.[empresaId] || root?.barbearias?.[String(empresaId)] || {};
  const financeCompany = root?.financeiroKytto?.empresas?.[empresaId] || root?.financeiroKytto?.empresas?.[String(empresaId)] || {};
  const repasseRoot = root?.barbeariaRepasses?.[empresaId] || root?.barbeariaRepasses?.[String(empresaId)] || {};
  const raw = {
    // The raw catalogue stays private. Unit-specific material baselines require explicit scope.
    profissionais: recordsForCompany(barbearia.profissionais, empresaId),
    servicos: recordsForCompany(barbearia.servicos, empresaId),
    produtosRevenda: recordsForCompany(barbearia.produtosRevenda, empresaId),
    agendamentos: recordsForCompany(barbearia.agendamentos, empresaId),
    comandas: recordsForCompany(barbearia.comandas, empresaId),
    vendasRevenda: recordsForCompany(barbearia.vendasRevenda, empresaId),
    // Histórico Avec vigente, com os ids legados da Dino convertidos para os canônicos.
    historicoAtendimentos: recordsForCompany(historicoAvecVigente(barbearia.historicoAtendimentos), empresaId),
    configuracao: { ...(barbearia.configuracao || {}), taxasPagamento: { ...(barbearia.configuracao?.taxasPagamento || {}) } },
  };
  const financial = recordsForCompany(lancamentosComCadastroLegado(root, financeCompany, empresaId), empresaId).filter((item) => exactUnit(item, lojaId));
  const professionals = raw.profissionais.filter((item) => !unitOf(item) || exactUnit(item, lojaId));
  const professionalIds = new Set(professionals.map(idOf).filter(Boolean));
  const strict = {
    profissionais: Object.fromEntries(professionals.map((item) => [idOf(item), item]).filter(([id]) => id)),
    // Never infer a unit's material cost from a different unit or a legacy unscoped row.
    servicos: Object.fromEntries(raw.servicos.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    produtosRevenda: Object.fromEntries(raw.produtosRevenda.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    agendamentos: Object.fromEntries(raw.agendamentos.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    comandas: Object.fromEntries(raw.comandas.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    vendasRevenda: Object.fromEntries(raw.vendasRevenda.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    historicoAtendimentos: Object.fromEntries(raw.historicoAtendimentos.filter((item) => exactUnit(item, lojaId)).map((item) => [idOf(item), item]).filter(([id]) => id)),
    configuracao: raw.configuracao,
  };
  // The repasse store is already partitioned by barbeariaRepasses[empresaId].
  // Legacy rows normally omit empresaId; an explicitly different empresaId is rejected.
  const repasses = list(repasseRoot?.repasses ?? repasseRoot)
    .filter((item) => !item?.empresaId || String(item.empresaId) === String(empresaId))
    .map(cloneRecord);
  return { raw, strict, financial, repasses, professionalIds, empresaId, lojaId };
}

function capturedAgendaReceipt(index, empresaId, appointment) {
  if (!appointment || appointment.status !== 'concluido' || !text(appointment.financeiroLancamentoId)) return null;
  const entry = index.get(text(appointment.financeiroLancamentoId));
  const expectedKey = `barbearia_atendimento:${empresaId}:${idOf(appointment)}`;
  if (!entry || entry.tipo !== 'receita' || entry.status !== 'pago' || entry.origem !== 'barbearia_atendimento' || entry.chaveIdempotencia !== expectedKey || num(entry.valor) <= 0) return null;
  if (!exactUnit(entry, unitOf(appointment))) return null;
  return entry;
}

function quantityOf(item, fallback = 1) {
  const raw = item?.quantidade ?? item?.qtd ?? item?.quantity;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function canonicalServiceRows(commissions, servicesById, commandsById, appointmentsById, warnings) {
  const rows = [];
  for (const item of commissions.atendimentosConsolidados || []) {
    const quantity = quantityOf(item);
    if (quantity === null) {
      warnOnce(warnings, 'Quantidade inválida em serviço; linha excluída sem inventar unidade ou valor financeiro.');
      continue;
    }
    const originId = text(item.origemId || item.id);
    const command = commandsById.get(originId);
    const appointmentId = text(command?.agendamentoId);
    const appointment = appointmentsById.get(appointmentId);
    const timestamp = item.dataHora || appointment?.dataHora || null;
    rows.push({
      id: originId,
      professionalId: text(item.profissionalId),
      serviceId: text(item.servicoId),
      name: text(item.nomeItem || item.servicoNome || servicesById.get(text(item.servicoId))?.nome) || 'Serviço',
      quantity,
      revenue: money(item.valorRecebido ?? item.valor),
      date: dateOnlyFrom(item.dataRef),
      timestamp,
      kind: item.origemTipo,
      client: text(item.clienteNome || command?.clienteNome || appointment?.clienteNome),
      group: text(servicesById.get(text(item.servicoId))?.categoria),
    });
  }
  return rows;
}

function historicalServiceRows(strict, period, professionalIds) {
  return historicalServiceRowsAll(strict, period).filter((item) => professionalIds.has(item.professionalId));
}

function historicalServiceRowsAll(strict, period) {
  // Uma equipe só: quem tem vínculo no cadastro do Avec aparece no próprio cadastro do Kytto.
  const equipe = Object.values(strict.profissionais || {});
  const vinculos = new Map();
  const vinculado = (item) => {
    const nome = text(item.profissionalNome);
    if (!vinculos.has(nome)) vinculos.set(nome, profissionalKyttoDoAvec(nome, equipe)?.id || null);
    return vinculos.get(nome) || text(item.profissionalId);
  };
  return Object.values(strict.historicoAtendimentos || {})
    .filter((item) => item.somenteHistorico === true && item.status === 'concluido')
    .filter((item) => dateInPeriod(item.dataAgenda || item.dataOriginal, period))
    .map((item) => ({
      id: idOf(item),
      professionalId: vinculado(item),
      serviceId: text(item.servicoId),
      name: text(item.servicoNome) || 'Serviço histórico Avec',
      quantity: quantityOf(item),
      revenue: money(item.valor ?? item.total),
      date: dateOnlyFrom(item.dataAgenda || item.dataOriginal),
      // O relatório Avec não fornece horário confiável; não criar um horário para o mapa.
      timestamp: null,
      kind: 'historico_avec',
      client: text(item.clienteNome),
      group: text(item.frenteAtuacao),
      sourceProfessional: text(item.profissionalNome),
    }))
    .filter((item) => item.quantity !== null);
}

function isHistoricalFinance(item = {}) {
  return item.metadata?.historicoAvec === true || item.origem === 'avec-import-financeiro-20261022';
}

function historicalFinanceTotals(financial, period) {
  const entries = financial.filter((item) => isHistoricalFinance(item) && item.status === 'pago' && dateInPeriod(item.pagoEm || item.dataOperacao, period));
  return {
    revenue: money(entries.filter((item) => item.tipo === 'receita').reduce((sum, item) => sum + num(item.valor), 0)),
    expenses: money(entries.filter((item) => item.tipo === 'despesa').reduce((sum, item) => sum + num(item.valor), 0)),
    revenueEntries: entries.filter((item) => item.tipo === 'receita').length,
    expenseEntries: entries.filter((item) => item.tipo === 'despesa').length,
  };
}

function saleCommandReference(sale) {
  return text(sale?.comandaId ?? sale?.comanda_id ?? sale?.commandId ?? sale?.origemComandaId);
}

function commandSaleReferences(command) {
  return [command?.vendaRevendaId, command?.vendaId, command?.vendaIdRevenda, command?.saleId].map(text).filter(Boolean);
}

function sanitizeTransactionItems(strict, warnings) {
  const sanitize = (record) => {
    const items = list(record.itens);
    let invalid = false;
    const validItems = items.filter((item) => {
      const raw = item?.quantidade ?? item?.qtd ?? item?.quantity;
      if (raw === undefined || raw === null || raw === '') return true;
      const quantity = Number(raw);
      if (Number.isFinite(quantity) && quantity > 0) return true;
      invalid = true;
      return false;
    });
    if (!invalid) return record;
    warnOnce(warnings, 'Quantidade inválida em transação; item excluído sem inventar unidade ou valor financeiro.');
    const clone = { ...record, itens: validItems };
    if (Object.prototype.hasOwnProperty.call(clone, 'total')) {
      clone.total = validItems.reduce((sum, item) => sum + (num(item.subtotal) || num(item.precoUnitario) * (num(item.quantidade) || 1)), 0);
    }
    return clone;
  };
  return {
    ...strict,
    comandas: Object.fromEntries(Object.entries(strict.comandas || {}).map(([id, item]) => [id, sanitize(item)])),
    vendasRevenda: Object.fromEntries(Object.entries(strict.vendasRevenda || {}).map(([id, item]) => [id, sanitize(item)])),
  };
}

function deduplicatedCommissionState(strict, warnings) {
  const sanitized = sanitizeTransactionItems(strict, warnings);
  const eligible = Object.values(sanitized.comandas || {}).filter(item => COMMISSION_STATUSES.has(item.status));
  const appointmentCounts = new Map();
  for (const command of eligible) {
    const appointmentId = text(command.agendamentoId);
    if (appointmentId) appointmentCounts.set(appointmentId, (appointmentCounts.get(appointmentId) || 0) + 1);
  }
  const ambiguousAppointments = new Set([...appointmentCounts].filter(([, count]) => count > 1).map(([id]) => id));
  const ambiguousCommands = new Set(eligible.filter(item => ambiguousAppointments.has(text(item.agendamentoId))).map(idOf));
  if (ambiguousCommands.size) warnOnce(warnings, `${ambiguousCommands.size} comandas ligadas a atendimentos com vínculo financeiro ambíguo foram excluídas da apuração. Receita e comissão são parciais até revisão; nenhuma comanda foi escolhida, mesclada ou alterada automaticamente.`);
  const commands = Object.values(sanitized.comandas || {}).filter(item => !ambiguousCommands.has(idOf(item)));
  const byId = new Map(commands.map((item) => [idOf(item), item]));
  const linkedSales = new Set();
  for (const sale of Object.values(sanitized.vendasRevenda || {})) {
    const commandId = saleCommandReference(sale);
    const command = byId.get(commandId);
    if (ambiguousCommands.has(commandId) || command && COMMISSION_STATUSES.has(command.status)) linkedSales.add(idOf(sale));
  }
  for (const command of eligible) {
    if (!COMMISSION_STATUSES.has(command.status)) continue;
    for (const saleId of commandSaleReferences(command)) {
      if (sanitized.vendasRevenda?.[saleId]) linkedSales.add(saleId);
    }
  }
  const vendasRevenda = Object.fromEntries(Object.entries(sanitized.vendasRevenda || {}).filter(([id]) => !linkedSales.has(id)));
  const comandas = Object.fromEntries(commands.map(item => [idOf(item), item]));
  // Ambiguous appointments still appear in operational counts, but not as a fallback financial receipt.
  const agendamentos = Object.fromEntries(Object.entries(sanitized.agendamentos || {}).map(([id, item]) => [id, ambiguousAppointments.has(idOf(item)) ? { ...item, financeiroLancamentoId: null } : item]));
  return { ...sanitized, comandas, agendamentos, vendasRevenda, ambiguousCommandsExcluded: ambiguousCommands.size };
}

function validProductItem(item, warnings) {
  const quantity = quantityOf(item, null);
  if (quantity === null) {
    warnOnce(warnings, 'Quantidade inválida em produto; linha excluída sem inventar unidade ou valor financeiro.');
    return null;
  }
  const subtotal = num(item.subtotal) || num(item.precoUnitario) * quantity;
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    warnOnce(warnings, 'Valor inválido em produto; linha excluída sem inventar valor financeiro.');
    return null;
  }
  return { item, quantity, subtotal };
}

function canonicalProductRows(strict, commissions, period, warnings) {
  const rows = [];
  const commandsById = new Map(Object.values(strict.comandas || {}).map((item) => [idOf(item), item]));
  for (const source of commissions.vendas || []) {
    const command = commandsById.get(idOf(source));
    const isCommandProduct = Boolean(command && !Array.isArray(source.itens));
    const sourceItems = isCommandProduct ? list(command.itens).filter((item) => item.tipo === 'produto') : list(source.itens);
    const validItems = sourceItems.map((item) => validProductItem(item, warnings)).filter(Boolean);
    if (!validItems.length) continue;
    const sourceDate = source.criadoEm;
    if (!dateInPeriod(sourceDate, period)) continue;
    const originalSubtotal = sourceItems.reduce((sum, item) => sum + (num(item.subtotal) || num(item.precoUnitario) * num(item.quantidade)), 0);
    const validSubtotal = validItems.reduce((sum, line) => sum + line.subtotal, 0);
    const sourceTotal = num(source.total);
    const validTotal = originalSubtotal > 0 ? sourceTotal * validSubtotal / originalSubtotal : sourceTotal;
    for (const line of validItems) {
      rows.push({
        id: idOf(source),
        professionalId: text(source.profissionalId),
        productId: text(line.item.produtoId),
        name: text(line.item.nome) || 'Produto',
        quantity: line.quantity,
        revenue: money(validSubtotal > 0 ? validTotal * (line.subtotal / validSubtotal) : 0),
        date: dateOnlyFrom(sourceDate),
        timestamp: sourceDate || null,
        kind: isCommandProduct ? 'comanda' : 'venda',
        product: true,
        client: text(source.clienteNome || command?.clienteNome),
      });
    }
  }
  return rows;
}

function appointmentRows(root, period, professionalIds, coveredAppointmentIds = new Set()) {
  return list(root.agendamentos ?? root.appointments)
    .filter((item) => dateInPeriod(item.dataAgenda || item.dataHora, period))
    .filter((item) => item.status === 'concluido')
    .filter((item) => professionalIds.has(text(item.profissionalId)))
    .filter((item) => !coveredAppointmentIds.has(idOf(item)))
    .map((item) => ({
      id: idOf(item), professionalId: text(item.profissionalId), serviceId: text(item.servicoId), quantity: 1,
      revenue: 0, date: dateOnlyFrom(item.dataAgenda || item.dataHora), timestamp: item.dataHora || null, kind: 'agendamento',
    }));
}

function activityHeatmap(employeeId, serviceRows, appointments, period) {
  const cells = Array.from({ length: 7 * 24 }, (_, index) => ({ day: Math.floor(index / 24), hour: index % 24, quantity: 0, revenue: 0 }));
  const add = (row) => {
    if (row.professionalId !== employeeId) return;
    const startDate = dateOnlyFrom(row.timestamp);
    const day = dayIndex(startDate);
    const hour = localHour(row.timestamp);
    // The day is the local calendar day of the confirmed start, never the closing date.
    if (day === null || hour === null || !dateInPeriod(startDate, period)) return;
    const cell = cells[day * 24 + hour];
    cell.quantity += row.quantity;
    cell.revenue += row.revenue;
  };
  serviceRows.forEach(add);
  appointments.forEach(add);
  return cells.map((cell) => ({ ...cell, quantity: money(cell.quantity), revenue: money(cell.revenue) }));
}

function topServices(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.serviceId || row.name;
    const current = map.get(key) || { id: row.serviceId || null, name: row.name, quantity: 0, revenue: 0 };
    current.quantity += row.quantity;
    current.revenue += row.revenue;
    map.set(key, current);
  }
  return [...map.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 5)
    .map((row) => ({ ...row, quantity: money(row.quantity), revenue: money(row.revenue) }));
}

function seriesGranularity(period) {
  return period.days > MAX_DAYS ? 'month' : 'day';
}

// Agrupa uma única vez (O(n)); para históricos longos a série vira mensal.
function dailySeries(period, serviceRows, productRows) {
  const monthly = seriesGranularity(period) === 'month';
  const keyOf = (date) => (monthly ? date.slice(0, 7) : date);
  const buckets = new Map();
  const bucket = (date) => { const key = keyOf(date); let current = buckets.get(key); if (!current) { current = { revenue: 0, services: 0 }; buckets.set(key, current); } return current; };
  for (const row of serviceRows) { if (!row.date) continue; const current = bucket(row.date); current.revenue += row.revenue; current.services += row.quantity; }
  for (const row of productRows) { if (!row.date) continue; bucket(row.date).revenue += row.revenue; }
  const keys = [];
  if (monthly) {
    let [year, month] = period.inicio.slice(0, 7).split('-').map(Number);
    const last = period.fim.slice(0, 7);
    for (let guard = 0; guard < 200; guard += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      keys.push(key);
      if (key >= last) break;
      month += 1; if (month > 12) { month = 1; year += 1; }
    }
  } else {
    const start = new Date(`${period.inicio}T12:00:00.000Z`);
    for (let index = 0; index < period.days; index += 1) keys.push(new Date(start.valueOf() + index * DAY_MS).toISOString().slice(0, 10));
  }
  return keys.map((date) => { const current = buckets.get(date) || { revenue: 0, services: 0 }; return { date, revenue: money(current.revenue), services: money(current.services) }; });
}

function groupByProfessional(rows, idFn = (row) => row.professionalId) {
  const map = new Map();
  for (const row of rows) { const id = text(idFn(row)); let current = map.get(id); if (!current) { current = []; map.set(id, current); } current.push(row); }
  return map;
}

function earliestActivityDate(snapshot) {
  let min = '';
  const consider = (value) => { const date = dateOnlyFrom(value); if (date && date >= '2000-01-01' && (!min || date < min)) min = date; };
  for (const item of Object.values(snapshot.strict.historicoAtendimentos || {})) if (item.somenteHistorico === true && item.status === 'concluido') consider(item.dataAgenda || item.dataOriginal);
  for (const item of Object.values(snapshot.strict.comandas || {})) if (COMMISSION_STATUSES.has(item.status)) consider(item.fechadaEm || item.atualizadoEm);
  for (const item of Object.values(snapshot.strict.agendamentos || {})) consider(item.dataAgenda || item.dataHora);
  for (const item of Object.values(snapshot.strict.vendasRevenda || {})) if (item.status === 'pago') consider(item.criadoEm);
  for (const item of snapshot.financial || []) if (isHistoricalFinance(item) && item.status === 'pago') consider(item.pagoEm || item.dataOperacao);
  return min;
}

// Linhas enxutas para o detalhamento (drill-down) por ano/mês/dia/atendimento.
function drillRows(services, products) {
  return [...services, ...products]
    .filter((row) => row.date)
    .map((row) => ({
      date: row.date,
      hour: row.timestamp ? localHour(row.timestamp) : null,
      type: row.product ? 'produto' : 'servico',
      origin: row.kind,
      name: row.name || (row.product ? 'Produto' : 'Serviço'),
      group: row.group || '',
      client: row.client || '',
      quantity: money(row.quantity),
      revenue: money(row.revenue),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.revenue - a.revenue));
}

function peakObservation(heatmap) {
  const peak = heatmap.filter((cell) => cell.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.day - b.day || a.hour - b.hour)[0];
  return peak ? { day: peak.day, hour: peak.hour, quantity: peak.quantity, revenue: peak.revenue } : null;
}

function recommendations(metrics) {
  const strengths = [];
  const attention = [];
  const suggestions = [];
  if (metrics.services > 0 && metrics.revenue > 0) strengths.push({ code: 'captured_service_sales', text: `${metrics.services} serviço(s) com receita apurada no período.` });
  if (metrics.topServices[0]) strengths.push({ code: 'service_mix', text: `Serviço mais registrado: ${metrics.topServices[0].name} (${metrics.topServices[0].quantity}).` });
  if (metrics.services > 0 && metrics.ticketAverage !== null) strengths.push({ code: 'service_ticket_observed', text: `Ticket médio de serviço observado: R$ ${metrics.ticketAverage.toFixed(2)} em ${metrics.services} serviço(s).` });
  if (metrics.services > 0) strengths.push({ code: 'service_volume_observed', text: `Volume observado de ${metrics.services} serviço(s); a leitura é descritiva, sem benchmark externo.` });
  if (metrics.attendanceRate !== null && metrics.attendanceRate >= 80) strengths.push({ code: 'attendance_observation', text: `Comparecimento registrado em ${metrics.attendanceRate}%, sem atribuir causa individual.` });
  if (!strengths.length && metrics.hasActivity) strengths.push({ code: 'activity_registered', text: 'Há atividade operacional registrada no período.' });
  if (!metrics.hasActivity) attention.push({ code: 'no_movement', text: 'Sem movimento registrado nesta unidade no período; não há base para concluir desempenho.' });
  if (metrics.revenue === 0 && metrics.completed > 0) attention.push({ code: 'capture_review', text: 'Há atendimento(s) concluído(s) sem receita apurada no recorte; conferir o vínculo do recebimento.' });
  if (metrics.canceled + metrics.noShow > 0) attention.push({ code: 'schedule_variation', text: `${metrics.canceled + metrics.noShow} ocorrência(s) de cancelamento ou falta; o painel não atribui causa ao profissional.` });
  if (metrics.services > 0 && metrics.services < 3) suggestions.push({ code: 'small_sample', text: 'Amostra pequena de serviços; use a comparação apenas como leitura descritiva.', evidence: `${metrics.services} serviço(s) registrado(s) no período.` });
  if (metrics.previousRevenue > 0 && metrics.revenueTrendPct !== null) suggestions.push({ code: 'period_comparison', text: `Receita variou ${metrics.revenueTrendPct.toFixed(1)}% contra o período anterior de mesma duração.`, evidence: `Receita atual R$ ${metrics.revenue.toFixed(2)}; período anterior R$ ${metrics.previousRevenue.toFixed(2)}.` });
  if (metrics.peak) suggestions.push({ code: 'peak_hour_observed', text: `Maior concentração observada às ${String(metrics.peak.hour).padStart(2, '0')}h, com ${metrics.peak.quantity} serviço(s) iniciado(s).`, evidence: `Célula observada: dia ${metrics.peak.day}, hora ${metrics.peak.hour}, ${metrics.peak.quantity} serviço(s).` });
  if (metrics.products === 0 && metrics.hasActivity) suggestions.push({ code: 'product_observation', text: 'Nenhuma venda de produto foi registrada no recorte; isso não permite concluir resultado ou falha.', evidence: 'Quantidade de produtos registrada: 0.' });
  if (metrics.services > 0 && metrics.topServices.length === 1) suggestions.push({ code: 'service_mix_coaching', text: 'Revisar a apresentação de serviços complementares como leitura operacional, sem meta disciplinar.', evidence: `Um serviço distinto foi registrado; quantidade total ${metrics.services}.` });
  return { strengths, attention, suggestions };
}

function transferData(repasses, period, lojaId, professionalIds) {
  const relevant = repasses.filter((item) => item.status === 'pago' && dateInPeriod(item.pagoEm, period));
  const relevantExact = relevant.filter((item) => exactUnit(item, lojaId));
  const unscoped = relevant.filter(item => !unitOf(item)).length;
  // Other-unit and legacy rows without lojaId never prove availability for this unit.
  if (!relevantExact.length || unscoped) return { available: false, total: null, byProfessional: new Map(), unscoped };
  const byProfessional = new Map();
  for (const item of relevantExact) {
    const professionalId = text(item.profissionalId);
    if (!professionalIds.has(professionalId)) continue;
    byProfessional.set(professionalId, money((byProfessional.get(professionalId) || 0) + num(item.valorPago ?? item.valor)));
  }
  return { available: true, total: money(relevantExact.reduce((sum, item) => sum + num(item.valorPago ?? item.valor), 0)), byProfessional, unscoped };
}

function buildUnscopedExcluded(raw, period, empresaId) {
  const candidates = [...list(raw.agendamentos), ...list(raw.comandas), ...list(raw.vendasRevenda)]
    .filter((item) => companyMatches(item, empresaId));
  return candidates.filter((item) => !unitOf(item) && dateInPeriod(item.dataAgenda || item.dataAtendimento || item.dataHora || item.fechadaEm || item.pagoEm || item.criadoEm, period)).length;
}

function buildAttributionCount(data, professionalIds) {
  return (data.commissions.atendimentosConsolidados || []).filter((item) => !professionalIds.has(text(item.profissionalId))).length
    + (data.commissions.vendas || []).filter((item) => !professionalIds.has(text(item.profissionalId))).length;
}

function commissionWarnings(commissions, warnings, materialWarnings) {
  const result = [...warnings, ...materialWarnings];
  if (commissions.meiosSemTaxaConfigurada?.length) {
    result.push(`Taxa de pagamento não configurada para: ${commissions.meiosSemTaxaConfigurada.join(', ')}; comissão permanece indicativa.`);
  }
  if (!commissions.taxasConfiguradas) result.push('Configuração de taxas de pagamento ausente; comissão permanece indicativa e nenhuma taxa foi inventada.');
  if (commissions.taxasConfiguradas) result.push('Taxas de pagamento vêm da configuração da empresa, sem prova específica desta unidade; comissão permanece indicativa.');
  return [...new Set(result)];
}

function buildPeriodData(snapshot, period, previousPeriod, { skipPrevious = false } = {}) {
  const { strict, financial, repasses, professionalIds } = snapshot;
  const servicesById = new Map(Object.values(strict.servicos).map((item) => [idOf(item), item]));
  const commandsById = new Map(Object.values(strict.comandas).map((item) => [idOf(item), item]));
  const appointmentsById = new Map(Object.values(strict.agendamentos).map((item) => [idOf(item), item]));
  const financeIndex = new Map(financial.map((item) => [idOf(item), item]));
  const materialWarnings = [];
  const receipt = (appointment) => capturedAgendaReceipt(financeIndex, snapshot.empresaId, appointment);
  const commissionOptions = (targetPeriod) => ({
    inicio: targetPeriod.inicio,
    fim: targetPeriod.fim,
    lojaId: snapshot.lojaId,
    detalhar: true,
    strictUnit: true,
    capturedOnly: false,
    recebimentoAgendamento: receipt,
    custoMaterialServicoFn: (serviceId) => {
      const service = servicesById.get(text(serviceId));
      if (!service) {
        warnOnce(materialWarnings, 'Custo de material sem cadastro comprovado nesta unidade; o cálculo não usou custos de outras unidades e permanece indicativo.');
        return 0;
      }
      if (service.custoMaterial !== null && service.custoMaterial !== undefined && Number.isFinite(Number(service.custoMaterial))) return money(service.custoMaterial);
      const consumption = list(service.consumoInterno);
      if (!consumption.length) {
        warnOnce(materialWarnings, 'Custo de material não configurado em serviço da unidade; comissão permanece indicativa.');
        return 0;
      }
      let total = 0;
      for (const input of consumption) {
        const product = strict.produtosRevenda[text(input.produtoId)];
        const unitCost = product?.custoUnitario == null || product?.custoUnitario === '' ? NaN : Number(product.custoUnitario);
        if (!product || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(Number(input.quantidade)) || Number(input.quantidade) <= 0) {
          warnOnce(materialWarnings, 'Composição de material sem custo/quantidade comprovados nesta unidade; comissão permanece indicativa.');
          continue;
        }
        total += num(input.quantidade) * unitCost;
      }
      return money(total);
    },
  });
  const commissionState = deduplicatedCommissionState(strict, materialWarnings);
  const commissions = calcularComissoesEstado(commissionState, snapshot.empresaId, commissionOptions(period));
  // Histórico completo não tem período anterior comparável: evita um segundo cálculo inteiro.
  const previousCommissions = skipPrevious ? { porProfissional: [] } : calcularComissoesEstado(commissionState, snapshot.empresaId, commissionOptions(previousPeriod));
  const allHistoricalRows = historicalServiceRowsAll(strict, period);
  const serviceRows = [
    ...canonicalServiceRows(commissions, servicesById, commandsById, appointmentsById, materialWarnings),
    ...allHistoricalRows.filter((row) => professionalIds.has(row.professionalId)),
  ];
  const unattributedHistoricalRows = allHistoricalRows.filter((row) => !professionalIds.has(row.professionalId));
  const previousHistoricalRows = skipPrevious ? [] : historicalServiceRows(strict, previousPeriod, professionalIds);
  const productRows = canonicalProductRows(commissionState, commissions, period, materialWarnings);
  const previousRevenue = new Map(previousCommissions.porProfissional.map((row) => [row.profissionalId, money(row.bruto)]));
  for (const row of previousHistoricalRows) previousRevenue.set(row.professionalId, money((previousRevenue.get(row.professionalId) || 0) + row.revenue));
  const transfers = transferData(repasses, { ...period, lojaId: snapshot.lojaId }, snapshot.lojaId, professionalIds);
  if (transfers.unscoped) warnOnce(materialWarnings, 'Há repasses pagos sem unidade comprovada no recorte; valores de repasse estão indisponíveis até revisão, sem inferir o total desta unidade.');
  // Only starts represented in this heatmap cover the operational appointment.
  // A later financial closing must not erase a service that took place in this period.
  const coveredAppointmentIds = new Set();
  for (const row of serviceRows) {
    if (!row.timestamp || !dateInPeriod(row.timestamp, period)) continue;
    const appointmentId = row.kind === 'agendamento' ? row.id : text(commandsById.get(row.id)?.agendamentoId);
    if (appointmentId) coveredAppointmentIds.add(appointmentId);
  }
  return {
    commissions,
    previousCommissions,
    serviceRows,
    unattributedHistoricalRows,
    previousHistoricalRows,
    productRows,
    historicalFinance: historicalFinanceTotals(financial, period),
    previousRevenue,
    transfers,
    appointments: Object.values(strict.agendamentos).filter((item) => dateInPeriod(item.dataAgenda || item.dataHora, period)),
    servicesById,
    coveredAppointmentIds,
    appointmentHeatmapRows: appointmentRows(strict, period, professionalIds, coveredAppointmentIds),
    ambiguousCommandsExcluded: commissionState.ambiguousCommandsExcluded,
    warnings: commissionWarnings(commissions, [], materialWarnings),
  };
}

function prepareContext(root, options) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new TypeError('Snapshot raiz inválido.');
  const empresaId = text(options.empresaId);
  const lojaId = text(options.lojaId);
  const historico = options.historico === true;
  if (!empresaId || !lojaId) throw Object.assign(new Error('empresaId e lojaId explícitos são obrigatórios.'), { code: 'EXPLICIT_SCOPE_REQUIRED' });
  const snapshot = normalizeRoot(root, empresaId, lojaId);
  let period;
  if (historico) {
    const fim = text(options.fim) || dateOnlyFrom(new Date().toISOString());
    parseDateOnly(fim);
    const earliest = earliestActivityDate(snapshot);
    period = { ...validatePeriod({ inicio: earliest && earliest < fim ? earliest : fim, fim, historico: true }), historico: true };
  } else {
    period = validatePeriod(options);
  }
  const previousPeriod = historico
    ? { inicio: period.previousInicio, fim: period.previousFim, days: period.days }
    : validatePeriod({ inicio: period.previousInicio, fim: period.previousFim });
  return { empresaId, lojaId, historico, snapshot, period, previousPeriod };
}

// ── Visões por item: o que está sendo vendido (serviços/produtos), para quem e em que categoria ──
export const ITEM_VIEWS = ['servicos', 'clientes', 'categorias'];
const normKey = (value) => text(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
const ITEM_GROUPERS = {
  servicos: (row) => { const type = row.type; return { key: `${type}:${normKey(row.name) || '-'}`, label: row.name || (type === 'produto' ? 'Produto' : 'Serviço'), type }; },
  clientes: (row) => ({ key: normKey(row.client) || '-', label: row.client || 'Cliente não informado', type: 'cliente' }),
  categorias: (row) => { const label = row.type === 'produto' ? 'Produtos (revenda)' : (row.group || 'Sem categoria'); return { key: normKey(label), label, type: row.type === 'produto' ? 'produto' : 'categoria' }; },
};

function itemRows(snapshot, data) {
  const names = new Map(Object.values(snapshot.strict.profissionais).map((item) => [idOf(item), text(item.nome) || 'Profissional']));
  const categories = new Map(snapshot.raw.servicos.map((item) => [idOf(item), text(item.categoria)]));
  const lines = [
    ...data.serviceRows.filter((row) => snapshot.professionalIds.has(row.professionalId)),
    ...data.unattributedHistoricalRows,
    ...data.productRows.filter((row) => snapshot.professionalIds.has(row.professionalId)),
  ];
  return lines.filter((row) => row.date).map((row) => ({
    date: row.date,
    hour: row.timestamp ? localHour(row.timestamp) : null,
    type: row.product ? 'produto' : 'servico',
    origin: row.kind,
    name: row.name || (row.product ? 'Produto' : 'Serviço'),
    group: row.group || categories.get(row.serviceId) || '',
    client: row.client || '',
    professionalId: snapshot.professionalIds.has(row.professionalId) ? row.professionalId : UNATTRIBUTED_PROFESSIONAL_ID,
    professionalName: names.get(row.professionalId) || 'Sem profissional atribuído',
    quantity: money(row.quantity),
    revenue: money(row.revenue),
  }));
}

function groupItems(rows, grouper) {
  const map = new Map();
  for (const row of rows) {
    const { key, label, type } = grouper(row);
    let group = map.get(key);
    if (!group) { group = { key, label, type, revenue: 0, serviceRevenue: 0, services: 0, products: 0, records: 0, professionals: new Map(), clients: new Set(), firstDate: row.date, lastDate: row.date }; map.set(key, group); }
    group.revenue += row.revenue;
    group.records += 1;
    if (row.type === 'produto') group.products += row.quantity; else { group.services += row.quantity; group.serviceRevenue += row.revenue; }
    group.professionals.set(row.professionalName, (group.professionals.get(row.professionalName) || 0) + row.revenue);
    if (row.client) group.clients.add(normKey(row.client));
    if (row.date < group.firstDate) group.firstDate = row.date;
    if (row.date > group.lastDate) group.lastDate = row.date;
  }
  return map;
}

export function buildEquipeItens(root, options = {}) {
  const view = text(options.visao);
  if (!ITEM_VIEWS.includes(view)) throw Object.assign(new Error('Visão inválida.'), { code: 'PERFORMANCE_QUERY_INVALID' });
  const ctx = prepareContext(root, options);
  const current = buildPeriodData(ctx.snapshot, ctx.period, ctx.previousPeriod, { skipPrevious: true });
  const rows = itemRows(ctx.snapshot, current);
  const grouper = ITEM_GROUPERS[view];
  const groups = groupItems(rows, grouper);
  // Comparação com o período anterior de mesma duração (só fora do histórico completo).
  let previous = null;
  if (!ctx.historico) {
    const prevPrev = validatePeriod({ inicio: ctx.previousPeriod.previousInicio, fim: ctx.previousPeriod.previousFim });
    previous = groupItems(itemRows(ctx.snapshot, buildPeriodData(ctx.snapshot, ctx.previousPeriod, prevPrev, { skipPrevious: true })), grouper);
  }
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const chave = text(options.chave);
  const list = [...groups.values()].map((group) => {
    const top = [...group.professionals.entries()].sort((a, b) => b[1] - a[1])[0];
    const qty = group.services + group.products;
    const before = previous?.get(group.key)?.revenue || 0;
    return {
      key: group.key, label: group.label, type: group.type,
      revenue: money(group.revenue), services: money(group.services), products: money(group.products), records: group.records,
      share: total ? pct(group.revenue * 100 / total) : 0,
      ticket: qty ? money(group.revenue / qty) : null,
      professionals: group.professionals.size, clients: group.clients.size,
      topProfessional: top ? { name: top[0], revenue: money(top[1]) } : null,
      firstDate: group.firstDate, lastDate: group.lastDate,
      previousRevenue: previous ? money(before) : null,
      trendPct: previous && before ? pct((group.revenue - before) * 100 / before) : null,
    };
  }).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label, 'pt-BR'));
  if (chave && !groups.has(chave)) throw Object.assign(new Error('Item não encontrado no recorte.'), { code: 'PROFESSIONAL_NOT_FOUND' });
  const clients = new Set(rows.map((row) => normKey(row.client)).filter(Boolean));
  const servicesQty = rows.filter((row) => row.type === 'servico').reduce((sum, row) => sum + row.quantity, 0);
  const productsQty = rows.filter((row) => row.type === 'produto').reduce((sum, row) => sum + row.quantity, 0);
  const productRevenue = rows.filter((row) => row.type === 'produto').reduce((sum, row) => sum + row.revenue, 0);
  return {
    ok: true,
    readOnly: true,
    writePerformed: false,
    scope: { empresaId: ctx.empresaId, lojaId: ctx.lojaId },
    period: ctx.period,
    seriesGranularity: seriesGranularity(ctx.period),
    view,
    summary: {
      revenue: money(total),
      groups: list.length,
      services: money(servicesQty),
      products: money(productsQty),
      productShare: total ? pct(productRevenue * 100 / total) : 0,
      clients: clients.size,
      ticket: servicesQty + productsQty ? money(total / (servicesQty + productsQty)) : null,
    },
    groups: chave ? list.filter((group) => group.key === chave) : list,
    ...(chave ? { rows: rows.filter((row) => grouper(row).key === chave).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.revenue - a.revenue)) } : {}),
  };
}

export function buildEquipeDesempenho(root, options = {}) {
  const profissionalId = text(options.profissionalId);
  // lean: lista sem mapa/série/recomendações por pessoa — o detalhe é buscado sob demanda.
  const lean = options.lean === true && !profissionalId;
  const { empresaId, lojaId, historico, snapshot, period, previousPeriod } = prepareContext(root, options);
  const current = buildPeriodData(snapshot, period, previousPeriod, { skipPrevious: historico });
  const commerceCurrent = options.commerceCurrent || {};
  const commerceRevenue = money(commerceCurrent.revenue);
  const commerceOrders = Math.max(0, Math.round(num(commerceCurrent.orders)));
  const wantsUnattributed = profissionalId === UNATTRIBUTED_PROFESSIONAL_ID;
  if (profissionalId && !wantsUnattributed && !snapshot.professionalIds.has(profissionalId)) {
    throw Object.assign(new Error('Profissional não encontrado no escopo da unidade.'), { code: 'PROFESSIONAL_NOT_FOUND' });
  }
  const schedule = {
    appointments: current.appointments.length,
    completed: current.appointments.filter((item) => item.status === 'concluido').length,
    canceled: current.appointments.filter((item) => item.status === 'cancelado').length,
    noShow: current.appointments.filter((item) => item.status === 'nao_compareceu').length,
  };
  const serviceRevenue = current.serviceRows.reduce((sum, row) => sum + row.revenue, 0);
  const productRevenue = current.productRows.reduce((sum, row) => sum + row.revenue, 0);
  const historicalAttributedServiceRevenue = current.serviceRows.filter((row) => row.kind === 'historico_avec').reduce((sum, row) => sum + row.revenue, 0);
  const operationalAttributedRevenue = serviceRevenue - historicalAttributedServiceRevenue + productRevenue;
  // Índices por profissional (uma passada) em vez de filtrar a base inteira para cada pessoa.
  const servicesByProfessional = groupByProfessional(current.serviceRows);
  const productsByProfessional = groupByProfessional(current.productRows);
  const appointmentsByProfessional = groupByProfessional(current.appointments, (item) => item.profissionalId);
  const commissionByProfessional = new Map(current.commissions.porProfissional.map((row) => [row.profissionalId, row]));
  const buildRow = (identity, services, products, appointments, commission) => {
    const id = identity.id;
    const completed = appointments.filter((item) => item.status === 'concluido').length;
    const canceled = appointments.filter((item) => item.status === 'cancelado').length;
    const noShow = appointments.filter((item) => item.status === 'nao_compareceu').length;
    const servicesQuantity = money(services.reduce((sum, row) => sum + row.quantity, 0));
    const productsQuantity = money(products.reduce((sum, row) => sum + row.quantity, 0));
    const historicalServiceRevenue = services.filter((row) => row.kind === 'historico_avec').reduce((sum, row) => sum + row.revenue, 0);
    const revenue = money(num(commission.bruto) + historicalServiceRevenue);
    const previousRevenue = identity.synthetic ? 0 : money(current.previousRevenue.get(id) || 0);
    const attendanceDenominator = completed + noShow;
    const hasActivity = Boolean(revenue || services.length || products.length || appointments.length);
    const registeredActive = identity.active !== false;
    const row = {
      id,
      name: identity.name,
      // Quem tem movimento/valor no período aparece como ativo no painel, mesmo inativo no cadastro.
      active: registeredActive || hasActivity,
      registeredActive,
      activeByMovement: !registeredActive && hasActivity,
      synthetic: identity.synthetic === true,
      hasActivity,
      revenue,
      serviceRevenue: money(num(commission.brutoServicos) + historicalServiceRevenue),
      historicalServiceRevenue: money(historicalServiceRevenue),
      productRevenue: money(commission.brutoProdutos),
      commission: money(commission.repasse),
      serviceCommission: money(commission.comissaoServicos),
      productCommission: money(commission.comissaoProdutos),
      metasServico: commission.metasServico || null,
      metasProduto: commission.metasProduto || null,
      paidTransfers: identity.synthetic || !current.transfers.available ? null : money(current.transfers.byProfessional.get(id) || 0),
      services: servicesQuantity,
      historicalServices: services.filter((item) => item.kind === 'historico_avec').reduce((sum, item) => sum + item.quantity, 0),
      products: productsQuantity,
      appointments: appointments.length,
      completed,
      canceled,
      noShow,
      attendanceRate: attendanceDenominator ? pct(completed * 100 / attendanceDenominator) : null,
      ticketAverage: servicesQuantity ? money((num(commission.brutoServicos) + historicalServiceRevenue) / servicesQuantity) : null,
      previousRevenue,
      revenueTrendPct: previousRevenue ? pct((revenue - previousRevenue) * 100 / previousRevenue) : null,
      lastActivity: [...services, ...products].reduce((max, item) => (item.date && item.date > max ? item.date : max), '') || null,
    };
    if (lean) return row;
    const heatmap = activityHeatmap(id, services, identity.synthetic ? [] : current.appointmentHeatmapRows, period);
    const top = topServices(services);
    const advice = recommendations({ ...row, topServices: top, peak: peakObservation(heatmap) });
    return {
      ...row,
      topServices: top,
      heatmap,
      daily: dailySeries(period, services, products),
      strengths: advice.strengths,
      attention: advice.attention,
      suggestions: advice.suggestions,
      ...(profissionalId ? { rows: drillRows(services, products) } : {}),
    };
  };
  const employeeCatalog = wantsUnattributed ? [] : Object.values(snapshot.strict.profissionais).filter((item) => !profissionalId || idOf(item) === profissionalId);
  const employeeRows = employeeCatalog.map((professional) => {
    const id = idOf(professional);
    return buildRow({ id, name: text(professional.nome) || 'Profissional', active: professional.ativo !== false },
      servicesByProfessional.get(id) || [], productsByProfessional.get(id) || [], appointmentsByProfessional.get(id) || [], commissionByProfessional.get(id) || {});
  });
  // Histórico Avec sem vínculo de profissional: aparece como linha própria (sem comissão) para não sumir valor.
  if (current.unattributedHistoricalRows.length && (!profissionalId || wantsUnattributed)) {
    employeeRows.push(buildRow({ id: UNATTRIBUTED_PROFESSIONAL_ID, name: 'Sem profissional atribuído (histórico Avec)', active: true, synthetic: true }, current.unattributedHistoricalRows, [], [], {}));
  }
  const summaryCommission = money(current.commissions.porProfissional.reduce((sum, row) => sum + num(row.repasse), 0));
  const quality = {
    unscopedExcluded: buildUnscopedExcluded(snapshot.raw, period, empresaId),
    unattributedEvents: buildAttributionCount(current, snapshot.professionalIds),
    unattributedHistoricalServices: current.serviceRows.filter((row) => row.kind === 'historico_avec' && !row.professionalId).length,
    ambiguousCommandsExcluded: current.ambiguousCommandsExcluded,
    transfersAvailable: current.transfers.available,
    commissionEstimated: true,
    commissionWarnings: current.warnings,
  };
  return {
    ok: true,
    readOnly: true,
    writePerformed: false,
    scope: { empresaId, lojaId },
    period,
    seriesGranularity: seriesGranularity(period),
    // Evolução da equipe inteira (atribuído + histórico sem vínculo), para o gráfico do topo.
    teamSeries: dailySeries(period, [...current.serviceRows.filter((row) => snapshot.professionalIds.has(row.professionalId)), ...current.unattributedHistoricalRows], current.productRows.filter((row) => snapshot.professionalIds.has(row.professionalId))),
    summary: {
      unattributedHistoricalRevenue: money(current.unattributedHistoricalRows.reduce((sum, row) => sum + row.revenue, 0)),
      activeByMovement: employeeRows.filter((row) => row.activeByMovement).length,
      withValues: employeeRows.filter((row) => row.hasActivity).length,
      revenue: money(operationalAttributedRevenue + current.historicalFinance.revenue + commerceRevenue),
      operationalAttributedRevenue: money(operationalAttributedRevenue),
      historicalFinanceRevenue: current.historicalFinance.revenue,
      historicalFinanceExpenses: current.historicalFinance.expenses,
      historicalAttributedServiceRevenue: money(historicalAttributedServiceRevenue),
      commerceRevenue,
      commerceOrders,
      commission: summaryCommission,
      services: money(current.serviceRows.reduce((sum, row) => sum + row.quantity, 0)),
      products: money(current.productRows.reduce((sum, row) => sum + row.quantity, 0)),
      paidTransfers: current.transfers.available ? current.transfers.total : null,
      appointments: schedule.appointments,
      completed: schedule.completed,
      canceled: schedule.canceled,
      noShow: schedule.noShow,
    },
    employees: employeeRows,
    quality,
    definitions: [
      'Receita APURADA considera serviços e produtos no escopo exato: comanda paga ou em_conta, e atendimento concluído com lançamento receita pago, origem barbearia_atendimento e chave de idempotência correta; em_conta é apurada, mas explicitamente NÃO capturada/recebida.',
      'Comissão é CANÔNICA INDICATIVA: usa o cálculo existente com desconto proporcional, taxas configuradas, material e comissão por serviço; ausências são avisadas e não recebem taxa inventada.',
      'Repasses pagos só entram quando o próprio registro prova lojaId exato. Sem registros comprovados nesta unidade, o valor é indisponível; nunca se infere unidade pelo profissional.',
      'Profissionais vêm exclusivamente do catálogo da empresa e da unidade quando há lojaId, sem inferir contas/usuários e sem incluir contatos de clientes; profissionais sem movimento permanecem no catálogo.',
      'Horas são a hora de início do serviço em America/Cuiaba, não ponto ou jornada. O painel não é nota de RH e não atribui causa ou culpa por cancelamentos e faltas.',
      'O período é calendárico inclusivo em America/Cuiaba, com no máximo 93 dias; comparação usa o mesmo número de dias imediatamente anterior e não calcula percentual sobre base anterior zero.',
      'O mapa usa início confirmado de serviço; a série diária usa a data canônica de apuração (fechamento de comanda, criação de revenda paga, ou dia do atendimento com recebimento verificado). Produtos não entram no mapa de serviços. Não há NPS ou ocupação inferidos.',
      'Custos de materiais só são usados com cadastro de serviço e insumo da unidade exata. Sem essa prova, a comissão fica indicativa e o custo real não é afirmado como zero.',
      'Múltiplas comandas faturadas com o mesmo agendamento são ambíguas: ficam fora da receita/comissão deste relatório até revisão, sem alterar os registros. O atendimento concluído permanece na agenda e no mapa operacional.',
      'Serviços históricos detalhados do Avec entram na atribuição por profissional quando o vínculo foi importado; como o extrato financeiro histórico já contém o total pago, eles são apresentados como atribuição analítica e não são somados novamente ao total consolidado.',
      'O total consolidado soma receita operacional atribuída, lançamentos financeiros pagos do histórico Avec e receita bruta do e-commerce. Pedidos Commerce sem profissional comprovado ficam no total da loja e não são imputados a alguém.',
    ],
  };
}

export const EQUIPE_DESEMPENHO_TIME_ZONE = TIME_ZONE;
export const EQUIPE_DESEMPENHO_MAX_DAYS = MAX_DAYS;
export const EQUIPE_DESEMPENHO_MAX_DAYS_HISTORY = MAX_DAYS_HISTORY;

// Linhas canônicas de um período (mesma apuração do Desempenho da equipe), para
// outros painéis de leitura reaproveitarem os números sem recalcular regras próprias.
export function linhasCanonicasDoPeriodo(root, options = {}) {
  const ctx = prepareContext(root, options);
  const current = buildPeriodData(ctx.snapshot, ctx.period, ctx.previousPeriod, { skipPrevious: true });
  return { ...ctx, current };
}
