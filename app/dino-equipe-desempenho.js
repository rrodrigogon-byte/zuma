import { calcularComissoesEstado } from './barbearia-erp-kytto.js';

const TIME_ZONE = 'America/Cuiaba';
const MAX_DAYS = 93;
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
  if (days > MAX_DAYS) throw Object.assign(new Error('O período máximo é de 93 dias.'), { code: 'PERIOD_INVALID' });
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
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
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
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(date));
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
    configuracao: { ...(barbearia.configuracao || {}), taxasPagamento: { ...(barbearia.configuracao?.taxasPagamento || {}) } },
  };
  const financial = recordsForCompany(financeCompany.lancamentos, empresaId);
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
    });
  }
  return rows;
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

function dailySeries(period, serviceRows, productRows) {
  const days = [];
  const start = new Date(`${period.inicio}T12:00:00.000Z`);
  for (let index = 0; index < period.days; index += 1) {
    const date = new Date(start.valueOf() + index * DAY_MS).toISOString().slice(0, 10);
    const services = serviceRows.filter((row) => row.date === date);
    const products = productRows.filter((row) => row.date === date);
    days.push({ date, revenue: money([...services, ...products].reduce((sum, row) => sum + row.revenue, 0)), services: money(services.reduce((sum, row) => sum + row.quantity, 0)) });
  }
  return days;
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

function buildPeriodData(snapshot, period, previousPeriod) {
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
  const previousCommissions = calcularComissoesEstado(commissionState, snapshot.empresaId, commissionOptions(previousPeriod));
  const serviceRows = canonicalServiceRows(commissions, servicesById, commandsById, appointmentsById, materialWarnings);
  const productRows = canonicalProductRows(commissionState, commissions, period, materialWarnings);
  const previousRevenue = new Map(previousCommissions.porProfissional.map((row) => [row.profissionalId, money(row.bruto)]));
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
    productRows,
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

export function buildEquipeDesempenho(root, options = {}) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new TypeError('Snapshot raiz inválido.');
  const empresaId = text(options.empresaId);
  const lojaId = text(options.lojaId);
  const profissionalId = text(options.profissionalId);
  if (!empresaId || !lojaId) throw Object.assign(new Error('empresaId e lojaId explícitos são obrigatórios.'), { code: 'EXPLICIT_SCOPE_REQUIRED' });
  const period = validatePeriod(options);
  const previousPeriod = validatePeriod({ inicio: period.previousInicio, fim: period.previousFim });
  const snapshot = normalizeRoot(root, empresaId, lojaId);
  const current = buildPeriodData(snapshot, period, previousPeriod);
  if (profissionalId && !snapshot.professionalIds.has(profissionalId)) {
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
  const employeeCatalog = Object.values(snapshot.strict.profissionais).filter((item) => !profissionalId || idOf(item) === profissionalId);
  const employeeRows = employeeCatalog.map((professional) => {
    const id = idOf(professional);
    const commission = current.commissions.porProfissional.find((row) => row.profissionalId === id) || {};
    const services = current.serviceRows.filter((row) => row.professionalId === id);
    const products = current.productRows.filter((row) => row.professionalId === id);
    const appointments = current.appointments.filter((item) => text(item.profissionalId) === id);
    const completed = appointments.filter((item) => item.status === 'concluido').length;
    const canceled = appointments.filter((item) => item.status === 'cancelado').length;
    const noShow = appointments.filter((item) => item.status === 'nao_compareceu').length;
    const servicesQuantity = money(services.reduce((sum, row) => sum + row.quantity, 0));
    const productsQuantity = money(products.reduce((sum, row) => sum + row.quantity, 0));
    const revenue = money(num(commission.bruto));
    const previousRevenue = money(current.previousRevenue.get(id) || 0);
    const attendanceDenominator = completed + noShow;
    const heatmap = activityHeatmap(id, services, current.appointmentHeatmapRows, period);
    const metrics = {
      revenue,
      services: servicesQuantity,
      products: productsQuantity,
      appointments: appointments.length,
      completed,
      canceled,
      noShow,
      attendanceRate: attendanceDenominator ? pct(completed * 100 / attendanceDenominator) : null,
      ticketAverage: servicesQuantity ? money(num(commission.brutoServicos) / servicesQuantity) : null,
      topServices: topServices(services),
      previousRevenue,
      revenueTrendPct: previousRevenue ? pct((revenue - previousRevenue) * 100 / previousRevenue) : null,
      peak: peakObservation(heatmap),
      hasActivity: Boolean(revenue || services.length || products.length || appointments.length),
    };
    const advice = recommendations(metrics);
    return {
      id,
      name: text(professional.nome) || 'Profissional',
      active: professional.ativo !== false,
      hasActivity: metrics.hasActivity,
      revenue,
      serviceRevenue: money(commission.brutoServicos),
      productRevenue: money(commission.brutoProdutos),
      commission: money(commission.repasse),
      serviceCommission: money(commission.comissaoServicos),
      productCommission: money(commission.comissaoProdutos),
      paidTransfers: current.transfers.available ? money(current.transfers.byProfessional.get(id) || 0) : null,
      services: servicesQuantity,
      products: productsQuantity,
      appointments: appointments.length,
      completed,
      canceled,
      noShow,
      attendanceRate: metrics.attendanceRate,
      ticketAverage: metrics.ticketAverage,
      previousRevenue,
      revenueTrendPct: metrics.revenueTrendPct,
      topServices: metrics.topServices,
      heatmap,
      daily: dailySeries(period, services, products),
      strengths: advice.strengths,
      attention: advice.attention,
      suggestions: advice.suggestions,
    };
  });
  const summaryCommission = money(current.commissions.porProfissional.reduce((sum, row) => sum + num(row.repasse), 0));
  const quality = {
    unscopedExcluded: buildUnscopedExcluded(snapshot.raw, period, empresaId),
    unattributedEvents: buildAttributionCount(current, snapshot.professionalIds),
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
    summary: {
      revenue: money(serviceRevenue + productRevenue),
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
    ],
  };
}

export const EQUIPE_DESEMPENHO_TIME_ZONE = TIME_ZONE;
export const EQUIPE_DESEMPENHO_MAX_DAYS = MAX_DAYS;
