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
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function dateOf(value) {
  const date = value instanceof Date ? value : new Date(value || '');
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
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { weekday: WEEKDAYS[index < 0 ? 0 : index], hour };
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

/** Produtos de revenda vendidos (avulsos ou dentro de comanda) com custo unitário do cadastro. */
export function retailSold({ commands = [], retailSales = [], products = [] }, window) {
  const cost = new Map(list(products).map((item) => [item.id, num(item.custoUnitario)]));
  const rows = [];
  for (const sale of list(retailSales)) {
    if (sale.status !== 'pago' || sale.comandaId || !inWindow(sale.pagoEm || sale.criadoEm, window)) continue;
    for (const item of list(sale.itens)) {
      const quantidade = num(item.quantidade || 1);
      rows.push({ produtoId: item.produtoId, nome: item.nome || item.produtoNome || 'Produto', quantidade, receita: num(item.subtotal || num(item.precoUnitario) * quantidade), custo: (cost.get(item.produtoId) ?? num(item.custoUnitario)) * quantidade, profissionalId: sale.profissionalId || '' });
    }
  }
  for (const command of list(commands)) {
    if (command.status !== 'paga' || !inWindow(commandDate(command), window)) continue;
    for (const item of list(command.itens).filter((entry) => entry.tipo === 'produto')) {
      const quantidade = num(item.quantidade || 1);
      rows.push({ produtoId: item.produtoId, nome: item.nome || 'Produto', quantidade, receita: num(item.subtotal), custo: (cost.get(item.produtoId) ?? 0) * quantidade, profissionalId: item.profissionalId || command.profissionalId || '' });
    }
  }
  return rows;
}

export function paymentMix({ commands = [], retailSales = [] }, window) {
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
  return item.metadata?.historicoAvec === true || item.origem === 'avec-import-financeiro-20261022';
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
  const despesasHistoricasAvec = includeHistoricalFinance ? historicoPago.filter((item) => item.tipo === 'despesa').reduce((s, item) => s + num(item.valor), 0) : 0;
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

export function buildBarbershopBi(input = {}, window) {
  const services = servicesPerformed(input, window);
  const retail = retailSold(input, window);
  const professionals = professionalRanking({ services, retail, professionals: input.professionals });
  const result = estimateResult({ services, retail, professionals: input.professionals, financeEntries: input.financeEntries, commerce: input.commerce, includeHistoricalFinance: true }, window);
  const financeiroPeriodo = list(input.financeEntries).filter((item) => item.status === 'pago' && inWindow(item.pagoEm || item.dataOperacao, window));
  const receitasLancadas = financeiroPeriodo.filter((item) => item.tipo === 'receita').reduce((s, item) => s + num(item.valor), 0);
  const despesasLancadas = financeiroPeriodo.filter((item) => item.tipo === 'despesa').reduce((s, item) => s + num(item.valor), 0);
  const despesasPorCategoria = new Map();
  financeiroPeriodo.filter((item) => item.tipo === 'despesa').forEach((item) => {
    const key = item.categoria || 'Outros';
    despesasPorCategoria.set(key, num(despesasPorCategoria.get(key)) + num(item.valor));
  });
  return {
    periodo: { de: window.fromDate.toISOString(), ate: window.toDate.toISOString(), dias: window.days || null },
    resultado: result,
    servicos: rankBy(services, 'servicoId').slice(0, 15),
    revenda: rankBy(retail, 'produtoId').slice(0, 15),
    profissionais: professionals,
    pagamentos: paymentMix(input, window),
    agenda: scheduleStats(input.appointments, window),
    clientes: customerStats(services, { customers: input.customers, window }),
    financeiro: {
      receitasPagas: money(receitasLancadas),
      despesasPagas: money(despesasLancadas),
      saldo: money(receitasLancadas - despesasLancadas),
      despesasPorCategoria: [...despesasPorCategoria.entries()].map(([categoria, valor]) => ({ categoria, valor: money(valor) })).sort((a, b) => b.valor - a.valor),
    },
    lojaOnline: input.commerce ? {
      disponivel: true,
      receita: money(input.commerce.revenue),
      pedidos: num(input.commerce.orders),
      topProdutos: list(input.commerce.topProducts).slice(0, 10),
    } : { disponivel: false },
  };
}
