// ============================================================================
// BI DA BARBEARIA — cálculos puros (sem I/O) sobre os dados da empresa ativa.
// Entradas: agendamentos, comandas, vendas de revenda, produtos (custo),
// profissionais, lançamentos financeiros e, opcionalmente, agregados da loja
// online. Tudo é recortado pela janela { fromDate, toDate } recebida.
// ============================================================================

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) => Number(num(value).toFixed(2));
const list = (value) => (Array.isArray(value) ? value : []);
const TIME_ZONE = 'America/Cuiaba';
const localTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
});
const localDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BI_DAYS = 366;

function dateOf(value) {
  const raw = String(value || '').trim();
  // Datas sem horário são datas civis do negócio, não meia-noite UTC. Cuiabá
  // equivale atualmente a UTC-04:00; isso mantém os extremos do recorte
  // alinhados ao biPeriod e evita excluir o primeiro dia.
  const date = value instanceof Date ? value : new Date(DATE_ONLY.test(raw) ? `${raw}T04:00:00.000Z` : raw);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function inWindow(value, window) {
  const date = dateOf(value);
  return Boolean(date && date >= window.fromDate && date < window.toDate);
}

function appointmentDate(item) {
  return item.dataHora || item.dataAgenda || item.criadoEm;
}

function commandDate(item) {
  return item.fechadaEm || item.atualizadoEm || item.criadoEm;
}

function localParts(date) {
  const parts = localTimeFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { weekday: WEEKDAYS[index < 0 ? 0 : index], hour };
}

function localDay(value) {
  const raw = String(value || '').trim();
  if (DATE_ONLY.test(raw)) return raw;
  const date = dateOf(value);
  if (!date) return '';
  const parts = localDayFormatter.formatToParts(date);
  const field = (type) => parts.find((part) => part.type === type)?.value || '';
  const year = field('year'); const month = field('month'); const day = field('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function parseDateOnly(value) {
  const raw = String(value || '').trim();
  if (!DATE_ONLY.test(raw)) throw new RangeError('Informe início e fim no formato AAAA-MM-DD.');
  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw) throw new RangeError('Uma das datas do período é inválida.');
  return { raw, date };
}

/** Datas explícitas cobrem dias inteiros em Cuiabá; sem datas, preserva os atalhos publicados. */
export function biPeriod(query = {}, now = new Date()) {
  const inicio = String(query.inicio || '').trim();
  const fim = String(query.fim || '').trim();
  if (!inicio && !fim) {
    const parsed = Number.parseInt(String(query.periodo || query.period || 30), 10);
    const days = [7, 30, 90].includes(parsed) ? parsed : 30;
    const toDate = new Date(now);
    const currentDay = localDay(toDate);
    const fromDate = new Date(new Date(`${currentDay}T04:00:00.000Z`).valueOf() - (days - 1) * DAY_MS);
    const previousToDate = new Date(fromDate);
    const previousFromDate = new Date(fromDate.valueOf() - days * DAY_MS);
    return {
      days, timeZone: TIME_ZONE, custom: false,
      fromDate, toDate, previousFromDate, previousToDate,
      from: fromDate.toISOString(), to: toDate.toISOString(), previousFrom: previousFromDate.toISOString(), previousTo: previousToDate.toISOString(),
    };
  }
  if (!inicio || !fim) throw new RangeError('Informe início e fim juntos para filtrar o relatório.');
  const start = parseDateOnly(inicio); const end = parseDateOnly(fim);
  if (start.date > end.date) throw new RangeError('A data inicial deve ser anterior ou igual à final.');
  const days = Math.round((end.date - start.date) / DAY_MS) + 1;
  if (days > MAX_BI_DAYS) throw new RangeError(`O período máximo do BI é de ${MAX_BI_DAYS} dias.`);
  // Cuiabá não adota horário de verão; 04:00Z equivale à meia-noite local.
  const fromDate = new Date(`${inicio}T04:00:00.000Z`);
  const next = new Date(end.date.valueOf() + DAY_MS);
  const toDate = new Date(`${next.toISOString().slice(0, 10)}T04:00:00.000Z`);
  const previousToDate = new Date(fromDate);
  const previousFromDate = new Date(fromDate.valueOf() - days * DAY_MS);
  return {
    days, timeZone: TIME_ZONE, custom: true,
    fromDate, toDate, previousFromDate, previousToDate,
    from: fromDate.toISOString(), to: toDate.toISOString(), previousFrom: previousFromDate.toISOString(), previousTo: previousToDate.toISOString(),
  };
}

function phoneKey(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits.length >= 10 ? digits.slice(-8) : '';
}

function customerKey(item) {
  if (item.clienteId && !/padrao|balcao/i.test(item.clienteId)) return `id:${item.clienteId}`;
  const phone = phoneKey(item.clienteTelefone);
  return phone ? `tel:${phone}` : '';
}

function sortRanking(map) {
  return [...map.values()]
    .map((item) => ({ ...item, receita: money(item.receita) }))
    .sort((a, b) => b.receita - a.receita || b.quantidade - a.quantidade);
}

/**
 * Serviços executados no recorte: itens de serviço das comandas pagas mais os
 * atendimentos concluídos que não viraram comanda (evita contar duas vezes).
 */
export function servicesPerformed({ appointments = [], commands = [], financeEntries = [] }, window) {
  const paid = list(commands).filter((item) => item.status === 'paga' && inWindow(commandDate(item), window));
  const inCommand = new Set(paid.map((item) => item.agendamentoId).filter(Boolean));
  const paidEntriesById = new Map(list(financeEntries)
    .filter((entry) => entry.tipo === 'receita' && entry.status === 'pago' && entry.id)
    .map((entry) => [String(entry.id), entry]));
  const rows = [];
  for (const command of paid) {
    for (const item of list(command.itens).filter((entry) => entry.tipo === 'servico')) {
      rows.push({
        servicoId: item.servicoId, nome: item.nome || 'Serviço', quantidade: num(item.quantidade || 1),
        receita: num(item.subtotal), profissionalId: item.profissionalId || command.profissionalId || '',
        at: commandDate(command), cliente: customerKey(command),
      });
    }
  }
  for (const item of list(appointments)) {
    const recebimento = paidEntriesById.get(String(item.financeiroLancamentoId || ''));
    if (item.status !== 'concluido' || inCommand.has(item.id) || !recebimento || !inWindow(recebimento.pagoEm || recebimento.dataOperacao, window)) continue;
    rows.push({
      servicoId: item.servicoId, nome: item.servicoNome || 'Serviço', quantidade: 1,
      receita: num(recebimento.valor), profissionalId: item.profissionalId || '',
      at: recebimento.pagoEm || recebimento.dataOperacao, cliente: customerKey(item),
    });
  }
  return rows;
}

/**
 * Detalhes de serviço trazidos do Avec: servem para ranking, equipe e
 * relacionamento. O extrato financeiro histórico é a única fonte desses
 * valores no faturamento consolidado, para não contabilizar a mesma venda duas vezes.
 */
export function historicalServicesPerformed({ historicalServices = [] }, window) {
  return list(historicalServices)
    .filter((item) => item.somenteHistorico === true && item.status === 'concluido')
    .filter((item) => inWindow(item.dataAgenda || item.dataOriginal, window))
    .map((item) => {
      const quantity = num(item.quantidade || item.qtd || 1);
      return {
        servicoId: item.servicoId || item.servicoNome || 'historico-avec',
        nome: item.servicoNome || 'Serviço histórico Avec',
        quantidade: quantity > 0 ? quantity : 1,
        receita: num(item.valor ?? item.total),
        custo: 0,
        profissionalId: item.profissionalId || '',
        cliente: customerKey(item),
        at: item.dataAgenda || item.dataOriginal,
        origem: 'historico_avec',
      };
    });
}

/** Produtos de revenda vendidos (avulsos ou dentro de comanda) com custo unitário do cadastro. */
export function retailSold({ commands = [], retailSales = [], products = [] }, window) {
  const cost = new Map(list(products).map((item) => [item.id, num(item.custoUnitario)]));
  const rows = [];
  for (const sale of list(retailSales)) {
    if (sale.status !== 'pago' || sale.comandaId || !inWindow(sale.pagoEm || sale.criadoEm, window)) continue;
    for (const item of list(sale.itens)) {
      const quantidade = num(item.quantidade || 1);
      rows.push({ produtoId: item.produtoId, nome: item.nome || item.produtoNome || 'Produto', quantidade, receita: num(item.subtotal || num(item.precoUnitario) * quantidade), custo: (cost.get(item.produtoId) ?? num(item.custoUnitario)) * quantidade, profissionalId: sale.profissionalId || '', at: sale.pagoEm || sale.criadoEm });
    }
  }
  for (const command of list(commands)) {
    if (command.status !== 'paga' || !inWindow(commandDate(command), window)) continue;
    for (const item of list(command.itens).filter((entry) => entry.tipo === 'produto')) {
      const quantidade = num(item.quantidade || 1);
      rows.push({ produtoId: item.produtoId, nome: item.nome || 'Produto', quantidade, receita: num(item.subtotal), custo: (cost.get(item.produtoId) ?? 0) * quantidade, profissionalId: item.profissionalId || command.profissionalId || '', at: commandDate(command) });
    }
  }
  return rows;
}

export function paymentMix({ commands = [], retailSales = [], financeEntries = [] }, window) {
  const totals = new Map();
  const add = (method, value) => {
    const key = String(method || 'não informado').trim().toLowerCase() || 'não informado';
    totals.set(key, num(totals.get(key)) + num(value));
  };
  for (const command of list(commands)) {
    if (command.status !== 'paga' || !inWindow(commandDate(command), window)) continue;
    const payments = list(command.pagamentos);
    if (payments.length) payments.forEach((payment) => add(payment.meio || payment.meioPagamento, payment.valor));
    else add(command.pagamento || command.meioPagamento, command.totalPago || command.total);
  }
  for (const sale of list(retailSales)) {
    if (sale.status !== 'pago' || sale.comandaId || !inWindow(sale.pagoEm || sale.criadoEm, window)) continue;
    add(sale.pagamento?.meioPagamento || sale.meioPagamento, sale.total);
  }
  for (const entry of list(financeEntries)) {
    if (!isHistoricalAvecFinance(entry) || entry.tipo !== 'receita' || entry.status !== 'pago' || !inWindow(entry.pagoEm || entry.dataOperacao, window)) continue;
    const method = String(entry.meioPagamento || 'não informado').trim() || 'não informado';
    add(`Histórico Avec · ${method}`, entry.valor);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([metodo, valor]) => ({ metodo, valor: money(valor), participacao: total ? Number(((valor / total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export function scheduleStats(appointments = [], window) {
  const current = list(appointments).filter((item) => inWindow(appointmentDate(item), window));
  const count = (status) => current.filter((item) => item.status === status).length;
  const concluidos = count('concluido');
  const cancelados = count('cancelado');
  const faltas = count('nao_compareceu');
  const decididos = concluidos + faltas;
  const heat = new Map();
  for (const item of current) {
    if (['cancelado', 'nao_compareceu'].includes(item.status)) continue;
    const date = dateOf(appointmentDate(item));
    if (!date) continue;
    const { weekday, hour } = localParts(date);
    const key = `${weekday}-${hour}`;
    heat.set(key, num(heat.get(key)) + 1);
  }
  const online = current.filter((item) => item.origem === 'agendamento_online').length;
  return {
    total: current.length,
    concluidos,
    cancelados,
    faltas,
    taxaComparecimento: decididos ? Number(((concluidos / decididos) * 100).toFixed(1)) : null,
    taxaCancelamento: current.length ? Number(((cancelados / current.length) * 100).toFixed(1)) : null,
    online,
    participacaoOnline: current.length ? Number(((online / current.length) * 100).toFixed(1)) : null,
    heatmap: [...heat.entries()].map(([key, valor]) => {
      const [weekday, hour] = key.split('-');
      return { dia: weekday, hora: Number(hour), valor };
    }),
  };
}

export function customerStats(services = [], { customers = [], window } = {}) {
  const visits = new Map();
  for (const row of services) {
    if (!row.cliente) continue;
    const entry = visits.get(row.cliente) || [];
    entry.push(dateOf(row.at));
    visits.set(row.cliente, entry);
  }
  const ativos = visits.size;
  const recorrentes = [...visits.values()].filter((dates) => new Set(dates.filter(Boolean).map((d) => d.toISOString().slice(0, 10))).size >= 2).length;
  const intervals = [];
  for (const dates of visits.values()) {
    const sorted = dates.filter(Boolean).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      const days = (sorted[i] - sorted[i - 1]) / 86_400_000;
      if (days >= 1) intervals.push(days);
    }
  }
  const novos = list(customers).filter((item) => !item.padrao && !item.anonimizadoEm && inWindow(item.criadoEm, window)).length;
  const semIdentificacao = services.filter((row) => !row.cliente).length;
  return {
    ativos,
    recorrentes,
    taxaRecorrencia: ativos ? Number(((recorrentes / ativos) * 100).toFixed(1)) : null,
    novosCadastros: novos,
    intervaloMedioDias: intervals.length ? Number((intervals.reduce((s, v) => s + v, 0) / intervals.length).toFixed(1)) : null,
    atendimentosSemCliente: semIdentificacao,
  };
}

function commissionFor(professional, services, retail) {
  const pctService = num(professional?.percentualComissao);
  const pctProduct = num(professional?.percentualComissaoProduto);
  return services * pctService / 100 + retail * pctProduct / 100;
}

export function professionalRanking({ services = [], retail = [], professionals = [] }) {
  const byId = new Map(list(professionals).map((item) => [item.id, item]));
  const totals = new Map();
  const touch = (id) => {
    const key = id || 'sem-profissional';
    if (!totals.has(key)) totals.set(key, { profissionalId: id || null, nome: byId.get(id)?.nome || 'Sem profissional', atendimentos: 0, receitaServicos: 0, receitaProdutos: 0 });
    return totals.get(key);
  };
  services.forEach((row) => { const item = touch(row.profissionalId); item.atendimentos += row.quantidade; item.receitaServicos += row.receita; });
  retail.forEach((row) => { const item = touch(row.profissionalId); item.receitaProdutos += row.receita; });
  return [...totals.values()].map((item) => {
    const receita = item.receitaServicos + item.receitaProdutos;
    const comissao = item.profissionalId ? commissionFor(byId.get(item.profissionalId), item.receitaServicos, item.receitaProdutos) : 0;
    return {
      ...item,
      receitaServicos: money(item.receitaServicos),
      receitaProdutos: money(item.receitaProdutos),
      receita: money(receita),
      ticketMedio: item.atendimentos ? money(item.receitaServicos / item.atendimentos) : 0,
      comissaoEstimada: money(comissao),
    };
  }).sort((a, b) => b.receita - a.receita);
}

const EXCLUDED_EXPENSE_CATEGORIES = new Set(['comissões', 'comissoes']);

function isHistoricalAvecFinance(item = {}) {
  return item.metadata?.historicoAvec === true || item.origem === 'avec-import-financeiro-20261022' || item.origem === 'avec-import-20261022';
}

/**
 * Resultado estimado = receita (serviços + revenda [+ loja com custo]) − comissões − CMV − despesas pagas.
 * Despesas de estoque (compras) e de comissões lançadas manualmente não entram,
 * porque CMV e comissões já são descontados pelo cálculo.
 */
export function estimateResult({ services = [], retail = [], professionals = [], financeEntries = [], commerce = null, includeHistoricalFinance = false }, window) {
  const receitaServicos = services.reduce((s, row) => s + row.receita, 0);
  const receitaRevenda = retail.reduce((s, row) => s + row.receita, 0);
  const cmvRevenda = retail.reduce((s, row) => s + row.custo, 0);
  const ranking = professionalRanking({ services, retail, professionals });
  const comissoes = ranking.reduce((s, row) => s + row.comissaoEstimada, 0);
  const despesas = list(financeEntries).filter((item) => item.tipo === 'despesa' && item.status === 'pago'
    && inWindow(item.pagoEm || item.dataOperacao, window)
    && !isHistoricalAvecFinance(item)
    && item.origem !== 'estoque'
    && !EXCLUDED_EXPENSE_CATEGORIES.has(String(item.categoria || '').toLowerCase()));
  const despesasPagas = despesas.reduce((s, item) => s + num(item.valor), 0);
  const historicoPago = list(financeEntries).filter((item) => isHistoricalAvecFinance(item) && item.status === 'pago' && inWindow(item.pagoEm || item.dataOperacao, window));
  const receitaHistoricaAvec = includeHistoricalFinance ? historicoPago.filter((item) => item.tipo === 'receita').reduce((s, item) => s + num(item.valor), 0) : 0;
  const historicoDespesaPago = list(financeEntries).filter((item) => isHistoricalAvecFinance(item) && item.status === 'pago' && inWindow(item.pagoEm || item.dataOperacao, window));
  const despesasHistoricasAvec = includeHistoricalFinance ? historicoDespesaPago.filter((item) => item.tipo === 'despesa').reduce((s, item) => s + num(item.valor), 0) : 0;
  const commerceRevenue = num(commerce?.revenue);
  const commerceCost = commerce?.cost == null ? null : num(commerce.cost);
  const incluiLoja = commerceRevenue > 0 && commerceCost != null;
  const receitaOperacional = receitaServicos + receitaRevenda + (incluiLoja ? commerceRevenue : 0);
  const custosOperacionais = comissoes + cmvRevenda + despesasPagas + (incluiLoja ? commerceCost : 0);
  const receita = receitaOperacional + receitaHistoricaAvec;
  const custos = custosOperacionais + despesasHistoricasAvec;
  const produtosSemCusto = retail.filter((row) => row.custo <= 0).length;
  const notas = [];
  if (produtosSemCusto) notas.push(`${produtosSemCusto} venda(s) de revenda sem custo unitário cadastrado.`);
  if (commerceRevenue > 0 && !incluiLoja) notas.push('Loja online fora do resultado até os produtos terem custo cadastrado.');
  notas.push('Despesas consideradas: lançamentos pagos no Financeiro da empresa (exceto compras de estoque e comissões).');
  if (includeHistoricalFinance && historicoPago.length) notas.push(`Histórico Avec incluído no consolidado: ${historicoPago.length} lançamento(s) pago(s), sem ser recriado como venda operacional.`);
  return {
    receita: money(receita),
    receitaOperacional: money(receitaOperacional),
    receitaHistoricaAvec: money(receitaHistoricaAvec),
    receitaServicos: money(receitaServicos),
    receitaRevenda: money(receitaRevenda),
    receitaLojaBruta: money(commerceRevenue),
    receitaLojaIncluida: incluiLoja ? money(commerceRevenue) : 0,
    comissoes: money(comissoes),
    cmvRevenda: money(cmvRevenda),
    despesasPagas: money(despesasPagas),
    despesasHistoricasAvec: money(despesasHistoricasAvec),
    custoLoja: incluiLoja ? money(commerceCost) : 0,
    resultadoOperacional: money(receitaOperacional - custosOperacionais),
    resultado: money(receita - custos),
    margem: receita > 0 ? Number((((receita - custos) / receita) * 100).toFixed(1)) : null,
    notas,
  };
}

function rankBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const id = row[key] || row.nome;
    const item = map.get(id) || { id, nome: row.nome, quantidade: 0, receita: 0, custo: 0 };
    item.quantidade += row.quantidade;
    item.receita += row.receita;
    item.custo += num(row.custo);
    map.set(id, item);
  }
  return sortRanking(map).map((item) => ({ ...item, custo: money(item.custo), margem: item.receita > 0 && item.custo > 0 ? Number((((item.receita - item.custo) / item.receita) * 100).toFixed(1)) : null }));
}

function dailyRevenue(input, window, services, retail) {
  const rows = [];
  for (let cursor = new Date(window.fromDate); cursor < window.toDate; cursor = new Date(cursor.valueOf() + DAY_MS)) {
    rows.push({ dia: localDay(cursor), servicos: 0, revenda: 0, ecommerce: 0, historicoAvec: 0, total: 0 });
  }
  const byDay = new Map(rows.map((item) => [item.dia, item]));
  const add = (at, field, value) => {
    const row = byDay.get(localDay(at));
    if (row) row[field] = money(row[field] + num(value));
  };
  services.forEach((item) => add(item.at, 'servicos', item.receita));
  retail.forEach((item) => add(item.at, 'revenda', item.receita));
  for (const item of list(input.commerce?.daily)) add(item.day, 'ecommerce', item.total);
  for (const entry of list(input.financeEntries)) {
    if (isHistoricalAvecFinance(entry) && entry.tipo === 'receita' && entry.status === 'pago' && inWindow(entry.pagoEm || entry.dataOperacao, window)) add(entry.pagoEm || entry.dataOperacao, 'historicoAvec', entry.valor);
  }
  return rows.map((item) => ({ ...item, total: money(item.servicos + item.revenda + item.ecommerce + item.historicoAvec) }));
}

function customerProfile(customers = [], services = [], window) {
  // Perfil é uma fotografia dos clientes atendidos neste recorte; cadastros
  // antigos da unidade não devem aparecer como se fossem atendimentos atuais.
  const attendedIds = new Set(list(services).map((row) => String(row.cliente || ''))
    .filter((key) => key.startsWith('id:')).map((key) => key.slice(3)));
  const active = list(customers).filter((item) => attendedIds.has(String(item?.id || '')) && !item.padrao && !item.anonimizadoEm && item.status !== 'deletado');
  const ageBands = new Map([['Até 17', 0], ['18–24', 0], ['25–34', 0], ['35–44', 0], ['45–54', 0], ['55+', 0]]);
  const types = new Map(); const origins = new Map();
  let withBirthDate = 0;
  const at = window.toDate || new Date();
  for (const item of active) {
    const type = String(item.tipo || 'não informado').toUpperCase();
    types.set(type, (types.get(type) || 0) + 1);
    const origin = String(item.origemCadastro || item.origem || 'Não informada').trim() || 'Não informada';
    origins.set(origin, (origins.get(origin) || 0) + 1);
    const born = dateOf(item.dataNascimento);
    if (!born || born > at) continue;
    withBirthDate += 1;
    let age = at.getUTCFullYear() - born.getUTCFullYear();
    if (at.getUTCMonth() < born.getUTCMonth() || (at.getUTCMonth() === born.getUTCMonth() && at.getUTCDate() < born.getUTCDate())) age -= 1;
    const band = age < 18 ? 'Até 17' : age < 25 ? '18–24' : age < 35 ? '25–34' : age < 45 ? '35–44' : age < 55 ? '45–54' : '55+';
    ageBands.set(band, (ageBands.get(band) || 0) + 1);
  }
  const countRows = (map) => [...map.entries()].map(([nome, quantidade]) => ({ nome, quantidade, receita: quantidade })).sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    cadastrosCobertos: active.length,
    nascimentoInformado: withBirthDate,
    coberturaNascimentoPct: active.length ? Number((withBirthDate / active.length * 100).toFixed(1)) : null,
    faixasEtarias: countRows(ageBands).filter((item) => item.quantidade > 0),
    tipos: countRows(types),
    origensCadastro: countRows(origins).slice(0, 10),
    sexoDisponivel: false,
    sexoMotivo: 'O cadastro atual não possui campo estruturado de sexo; o BI não infere essa informação.',
  };
}

function compactSummary(report = {}) {
  return {
    faturamentoBruto: report.resumo?.faturamentoBruto || 0,
    ticketMedioBruto: report.resumo?.ticketMedioBruto || 0,
    transacoes: report.resumo?.transacoes || 0,
    resultado: report.resultado?.resultado || 0,
    margem: report.resultado?.margem ?? null,
    agenda: {
      total: report.agenda?.total || 0,
      taxaComparecimento: report.agenda?.taxaComparecimento ?? null,
      taxaCancelamento: report.agenda?.taxaCancelamento ?? null,
    },
    clientes: {
      ativos: report.clientes?.ativos || 0,
      recorrentes: report.clientes?.recorrentes || 0,
      taxaRecorrencia: report.clientes?.taxaRecorrencia ?? null,
    },
  };
}

export function biComparisonSummary(report) {
  return compactSummary(report);
}

export function buildBarbershopBi(input = {}, window) {
  const services = servicesPerformed(input, window);
  const historicalServices = historicalServicesPerformed(input, window);
  const retail = retailSold(input, window);
  const professionals = professionalRanking({ services: [...services, ...historicalServices], retail, professionals: input.professionals });
  const result = estimateResult({ services, retail, professionals: input.professionals, financeEntries: input.financeEntries, commerce: input.commerce, includeHistoricalFinance: true }, window);
  const commerceRevenue = num(input.commerce?.revenue);
  const commerceOrders = Math.max(0, Math.round(num(input.commerce?.orders)));
  const historicalRevenueEntries = list(input.financeEntries).filter((item) => isHistoricalAvecFinance(item) && item.tipo === 'receita' && item.status === 'pago' && inWindow(item.pagoEm || item.dataOperacao, window));
  const paidCommands = list(input.commands).filter((item) => item.status === 'paga' && inWindow(commandDate(item), window));
  const paidRetail = list(input.retailSales).filter((item) => item.status === 'pago' && !item.comandaId && inWindow(item.pagoEm || item.criadoEm, window));
  const transactions = paidCommands.length + paidRetail.length + commerceOrders + historicalRevenueEntries.length;
  const faturamentoBruto = money(result.receitaServicos + result.receitaRevenda + commerceRevenue + result.receitaHistoricaAvec);
  const operationalGross = money(result.receitaServicos + result.receitaRevenda + commerceRevenue);
  const revenueSources = [
    { id: 'servicos', nome: 'Serviços', receita: result.receitaServicos, quantidade: services.reduce((sum, item) => sum + num(item.quantidade), 0), origem: 'operacao' },
    { id: 'revenda', nome: 'Revenda', receita: result.receitaRevenda, quantidade: retail.reduce((sum, item) => sum + num(item.quantidade), 0), origem: 'operacao' },
    { id: 'ecommerce', nome: 'E-commerce confirmado', receita: money(commerceRevenue), quantidade: commerceOrders, origem: input.commerce ? 'commerce' : 'indisponivel' },
    { id: 'historico-avec', nome: 'Histórico financeiro Avec', receita: result.receitaHistoricaAvec, quantidade: historicalRevenueEntries.length, origem: 'historico' },
  ];
  const financeiroPeriodo = list(input.financeEntries).filter((item) => item.status === 'pago' && inWindow(item.pagoEm || item.dataOperacao, window) && (item.origem !== 'avec-import-financeiro-20261022' && item.origem !== 'avec-import-20261022' || true));
  const receitasLancadas = financeiroPeriodo.filter((item) => item.tipo === 'receita').reduce((s, item) => s + num(item.valor), 0);
  const despesasLancadas = financeiroPeriodo.filter((item) => item.tipo === 'despesa' || (isHistoricalAvecFinance(item) && item.tipo === 'despesa')).reduce((s, item) => s + num(item.valor), 0);
  const despesasPorCategoria = new Map();
  financeiroPeriodo.filter((item) => item.tipo === 'despesa' || (isHistoricalAvecFinance(item) && item.tipo === 'despesa')).forEach((item) => {
    const key = item.categoria || 'Outros';
    despesasPorCategoria.set(key, num(despesasPorCategoria.get(key)) + num(item.valor));
  });
  return {
    periodo: { de: window.fromDate.toISOString(), ate: window.toDate.toISOString(), dias: window.days || null, timeZone: TIME_ZONE },
    resultado: result,
    resumo: {
      faturamentoBruto,
      faturamentoOperacional: operationalGross,
      historicoFinanceiroAvec: result.receitaHistoricaAvec,
      ecommerce: money(commerceRevenue),
      capturasCommerce: money(input.commerce?.captured),
      commercePendente: money(input.commerce?.pending),
      transacoes: transactions,
      ticketMedioBruto: transactions ? money(faturamentoBruto / transactions) : 0,
      resultadoIncluiEcommerce: result.receitaLojaIncluida > 0,
      ecommerceSemCusto: commerceRevenue > 0 && result.receitaLojaIncluida === 0,
    },
    fontesReceita: revenueSources,
    serieDiaria: dailyRevenue(input, window, services, retail),
    servicos: rankBy([...services, ...historicalServices], 'servicoId').slice(0, 15),
    revenda: rankBy(retail, 'produtoId').slice(0, 15),
    profissionais: professionals,
    pagamentos: paymentMix(input, window),
    agenda: scheduleStats(input.appointments, window),
    clientes: customerStats([...services, ...historicalServices], { customers: input.customers, window }),
    perfilClientes: customerProfile(input.customers, [...services, ...historicalServices], window),
    operacao: {
      comandasPagas: paidCommands.length,
      vendasRevendaPagas: paidRetail.length,
      itensServico: services.reduce((sum, item) => sum + num(item.quantidade), 0),
      itensServicoHistoricos: historicalServices.reduce((sum, item) => sum + num(item.quantidade), 0),
      itensRevenda: retail.reduce((sum, item) => sum + num(item.quantidade), 0),
      ocupacaoDisponivel: false,
      ocupacaoMotivo: 'A ocupação exige capacidade e jornada canônicas por profissional; o BI não infere esse dado a partir de agendamentos.',
    },
    financeiro: {
      receitasPagas: money(receitasLancadas),
      despesasPagas: money(despesasLancadas),
      saldo: money(receitasLancadas - despesasLancadas),
      despesasPorCategoria: [...despesasPorCategoria.entries()].map(([categoria, valor]) => ({ categoria, valor: money(valor) })).sort((a, b) => b.valor - a.valor),
    },
    lojaOnline: input.commerce ? {
      disponivel: true,
      // Receita e pedidos abaixo são confirmados por status, na data do pedido.
      receitaConfirmada: money(input.commerce.revenue),
      pedidosConfirmados: num(input.commerce.orders),
      // Capturas são mostradas separadamente por data de liquidação e nunca são
      // somadas ao faturamento, pois podem referir-se a outro recorte de pedido.
      capturadoNoPeriodo: money(input.commerce.captured),
      capturasDiarias: list(input.commerce.capturedDaily),
      pendentePagamento: money(input.commerce.pending),
      pedidosPendentes: num(input.commerce.pendingOrders),
      brutoPedidosNaoCancelados: money(input.commerce.grossOrders),
      detalheDisponivel: input.commerce.detailAvailable === true,
      topProdutos: list(input.commerce.topProducts).slice(0, 10),
    } : { disponivel: false },
  };
}
