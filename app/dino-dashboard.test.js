import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDinoDashboardAnalytics, dashboardPeriod, filterDashboardRowsToStore, historicalCommandSlot } from './dino-dashboard.js';

const now = new Date('2026-09-01T16:00:00.000Z');

function baseInput() {
  return {
    commerceAvailable: true,
    commerceCurrent: {
      sales: { summary: { gross_total: '250', confirmed_total: '250', orders: 2, confirmed_orders: 2 }, daily: [{ day: '2026-09-01', total: '250', confirmed_total: '250' }] },
      customers: { summary: { new_customers: 1 } },
      inventory: { items: [{ low_stock: true }, { low_stock: false }] },
    },
    commercePrevious: {
      sales: { summary: { gross_total: '100', confirmed_total: '100', orders: 1, confirmed_orders: 1 }, daily: [] },
      customers: { summary: { new_customers: 0 } },
    },
    appointments: [
      { id: 'a1', dataHora: '2026-09-01T14:00:00.000Z', status: 'agendado', clienteNome: 'Cliente', servicoNome: 'Corte' },
      { id: 'a0', dataHora: '2026-08-31T14:00:00.000Z', status: 'concluido' },
      { id: 'old', dataHora: '2026-08-20T14:00:00.000Z', status: 'concluido' },
    ],
    retailSales: [{ id: 'v1', status: 'pago', total: 50, criadoEm: '2026-09-01T13:00:00.000Z', pagamento: { meioPagamento: 'pix' }, itens: [{ nome: 'Pomada', categoria: 'Cabelo', quantidade: 1, subtotal: 50 }] }],
    commands: [{ id: 'c1', status: 'paga', total: 100, atualizadoEm: '2026-09-01T15:00:00.000Z', pagamentos: [{ meioPagamento: 'cartao', valor: 100 }], itens: [{ nome: 'Corte', tipo: 'servico', quantidade: 1, subtotal: 100 }] }],
    customers: [{ id: 'l1', criadoEm: '2026-09-01T12:00:00.000Z' }],
    financeEntries: [{ tipo: 'receita', status: 'pendente', valor: 80 }],
    inventory: [{ ativo: true, estoqueAtual: 1, estoqueMinimo: 2 }],
    subscriptions: [{ status: 'ativa', valorMensal: 79.9 }],
  };
}

test('dashboardPeriod aceita somente 1, 7, 30 ou 90 dias', () => {
  assert.equal(dashboardPeriod(1, now).days, 1);
  assert.equal(dashboardPeriod(7, now).days, 7);
  assert.equal(dashboardPeriod(90, now).days, 90);
  assert.equal(dashboardPeriod(365, now).days, 30);
});

test('dashboard agrega apenas fontes reais e mantém lucro e funil indisponíveis', () => {
  const result = buildDinoDashboardAnalytics(baseInput(), { period: 7, now });
  assert.equal(result.kpis.find((item) => item.id === 'revenue').value, 400);
  assert.equal(result.kpis.find((item) => item.id === 'ticket').value, 100);
  assert.equal(result.kpis.find((item) => item.id === 'ticket').trendPct, 0);
  assert.equal(result.kpis.find((item) => item.id === 'newCustomers').value, 2);
  assert.equal(result.kpis.find((item) => item.id === 'profit').available, false);
  assert.equal(result.kpis.find((item) => item.id === 'conversion').available, false);
  assert.equal(result.miniKpis.receivables, 80);
  assert.deepEqual(result.miniKpis.lowStock, { total: 2, commerce: 1, retail: 1 });
  assert.equal(result.miniKpis.mrr, 79.9);
  assert.equal(result.charts.channels.find((item) => item.id === 'commerce').revenue, 250);
  assert.equal(result.charts.revenueDaily.find((item) => item.day === '2026-09-01').commerce, 250);
  assert.equal(result.charts.appointmentsDaily.reduce((sum, item) => sum + item.value, 0), 2);
  assert.equal(result.charts.paymentMethods.length, 2);
  assert.equal(result.charts.categorySales[0].name, 'Serviços');
});

test('dashboard separa serviços, produtos e pagamentos de planos sem classificar receita histórica por suposição', () => {
  const input = baseInput();
  input.subscriptionPayments = [
    { valor: 75, registradoEm: '2026-09-01T13:30:00.000Z' },
    { valor: 99, registradoEm: '2026-08-10T13:30:00.000Z' },
  ];
  const result = buildDinoDashboardAnalytics(input, { period: 7, now });
  const mix = result.strategicMix;
  assert.equal(mix.total, 225);
  assert.deepEqual(mix.items.map((item) => [item.id, item.value, item.percentage]), [
    ['services', 100, 44.4],
    ['products', 50, 22.2],
    ['plans', 75, 33.3],
  ]);
  assert.equal(mix.unclassifiedConsolidatedRevenue, 250, 'o valor do Commerce não deve ser alocado como serviço, produto ou plano sem itemização');
  assert.equal(mix.planPaymentsAvailable, true);
});

test('dashboard omite pagamentos de planos no escopo de uma unidade sem identificação de loja', () => {
  const input = baseInput();
  input.subscriptionPaymentsAvailable = false;
  input.subscriptionPaymentsReason = 'Receitas de planos são exibidas apenas no agregado da empresa.';
  input.subscriptionPayments = [{ valor: 75, registradoEm: '2026-09-01T13:30:00.000Z' }];
  const result = buildDinoDashboardAnalytics(input, { period: 7, now });
  const plans = result.strategicMix.items.find((item) => item.id === 'plans');
  assert.equal(plans.value, 0);
  assert.equal(plans.available, false, 'sem escopo de unidade, zero não significa ausência de receita');
  assert.equal(plans.coverageReason, 'Receitas de planos são exibidas apenas no agregado da empresa.');
  assert.equal(result.strategicMix.planPaymentsAvailable, false);
  assert.equal(result.strategicMix.planPaymentsReason, 'Receitas de planos são exibidas apenas no agregado da empresa.');
});

test('dashboard respeita uma janela customizada já validada pelo BI', () => {
  const window = {
    days: 14, timeZone: 'America/Cuiaba',
    fromDate: new Date('2026-08-19T04:00:00.000Z'), toDate: new Date('2026-09-02T04:00:00.000Z'),
    previousFromDate: new Date('2026-08-05T04:00:00.000Z'), previousToDate: new Date('2026-08-19T04:00:00.000Z'),
    from: '2026-08-19T04:00:00.000Z', to: '2026-09-02T04:00:00.000Z',
    previousFrom: '2026-08-05T04:00:00.000Z', previousTo: '2026-08-19T04:00:00.000Z',
  };
  const result = buildDinoDashboardAnalytics(baseInput(), { now, window });
  assert.equal(result.period.days, 14);
  assert.equal(result.period.from, '2026-08-19T04:00:00.000Z');
  assert.equal(result.kpis.find((item) => item.id === 'revenue').value, 400);
});

test('dashboard preenche os dias sem evento com zero e não inventa tendência', () => {
  const result = buildDinoDashboardAnalytics({}, { period: 7, now });
  assert.equal(result.charts.revenueDaily.length, 7);
  assert.ok(result.charts.revenueDaily.every((item) => item.total === 0));
  const revenue = result.kpis.find((item) => item.id === 'revenue');
  assert.equal(revenue.value, 0);
  assert.equal(revenue.trendAvailable, false);
  assert.equal(result.charts.funnel.find((item) => item.id === 'visits').available, false);
});

test('dashboard não duplica venda de revenda já vinculada a comanda', () => {
  const input = baseInput();
  input.retailSales.push({ id: 'duplicada', comandaId: 'c1', status: 'pago', total: 100, criadoEm: '2026-09-01T15:00:00.000Z' });
  const result = buildDinoDashboardAnalytics(input, { period: 7, now });
  assert.equal(result.kpis.find((item) => item.id === 'revenue').value, 400);
});


test('dashboard mantém capturas Commerce separadas dos pedidos e do caixa legado', () => {
  const input = baseInput();
  input.commerceCurrent.sales.summary = {
    orders_total: 4,
    orders_non_cancelled: 2,
    pending_orders: 1,
    cancelled_orders: 1,
    refunded_orders: 1,
    gross_total: '13206.00',
    confirmed_orders: 1,
    confirmed_total: '6.00',
    pending_total: '13200.00',
  };
  input.commerceCurrent.sales.capturedPayments = [{method:'pix',transactions:1,value:'6.00'}];
  const result = buildDinoDashboardAnalytics(input, {period:7,now});
  assert.equal(result.kpis.find(item=>item.id==='revenue').label, 'Valor bruto registrado');
  assert.equal(result.kpis.find(item=>item.id==='revenue').value, 156);
  assert.deepEqual(result.charts.commercePaymentMethods,[{method:'pix',value:6}]);
  assert.equal(result.charts.paymentMethods.reduce((sum,item)=>sum+item.value,0),150);
  const commerce = result.charts.channels.find(item=>item.id==='commerce');
  assert.equal(commerce.grossValue, 6);
  assert.equal(commerce.pendingValue, 13200);
  assert.equal(commerce.capturedRevenue, 6);
  assert.equal(commerce.ordersTotal, 4);
  assert.equal(commerce.transactions, 1);
  assert.equal(commerce.pendingOrders, 1);
  assert.equal(commerce.cancelledOrders, 1);
  assert.equal(commerce.refundedOrders, 1);
  assert.equal(commerce.capturedTransactions, 1);
});

test('dashboard consolida histórico Avec nos valores e o identifica separadamente', () => {
  const input = {
    historicalAppointments: [{ dataAgenda: '2026-09-01', clienteNome: 'Ana', valor: 90 }],
    historicalCommands: [{ dataComandaIso: '2026-09-01T15:00:00.000Z', clienteNome: 'Ana', total: 90 }],
    financeEntries: [
      { origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, tipo: 'receita', status: 'pago', valor: 150, pagoEm: '2026-09-01T12:00:00.000Z' },
      { origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, tipo: 'despesa', status: 'pago', valor: 40, pagoEm: '2026-09-01T12:00:00.000Z' },
      { origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, tipo: 'despesa', status: 'pendente', valor: 20, dataOperacao: '2026-09-01T12:00:00.000Z' },
    ],
  };
  const result = buildDinoDashboardAnalytics(input, { period: 7, now });
  assert.deepEqual(result.historicalAvec.services, { count: 1, value: 90 });
  assert.deepEqual(result.historicalAvec.commands, { count: 1, value: 90 });
  assert.equal(result.historicalAvec.uniqueClients, 1);
  assert.equal(result.historicalAvec.reconciled, false);
  assert.deepEqual(result.historicalFinance, { entries: 3, paidRevenueEntries: 1, paidExpenseEntries: 1, paidRevenue: 150, paidExpenses: 40, netPaid: 110, pendingRevenue: 0, pendingExpenses: 20, includedInKpis: true, note: 'Receitas e despesas pagas do extrato Avec entram nos valores consolidados do período e permanecem identificadas no Financeiro como histórico; não são novas vendas operacionais.' });
  assert.equal(result.kpis.find(item => item.id === 'revenue').value, 150);
  assert.equal(result.charts.paymentMethods.length, 1);
  assert.equal(result.charts.paymentMethods[0].value, 150);
  assert.equal(result.miniKpis.receivables, 0);
});

test('novos clientes: só cadastro no período; atualização, importação e cliente padrão não contam', () => {
  const input = baseInput();
  input.customers = [
    { id: 'novo', criadoEm: '2026-09-01T12:00:00.000Z' },
    { id: 'antigo-atualizado', criadoEm: '2025-01-10T12:00:00.000Z', atualizadoEm: '2026-09-01T10:00:00.000Z' },
    { id: 'importado', criadoEm: '2026-09-01T09:00:00.000Z', observacao: 'Origem AVEC (carga 09/10/2026)' },
    { id: 'agenda', criadoEm: '2026-09-01T09:30:00.000Z', observacao: 'Cadastro automático (agenda) por x', origemCadastro: 'agenda' },
    { id: 'padrao', criadoEm: '2026-09-01T08:00:00.000Z', padrao: true },
  ];
  const r = buildDinoDashboardAnalytics(input, { now, period: 1 });
  const kpi = r.kpis.find((item) => item.id === 'newCustomers');
  assert.equal(kpi.value, 3, '2 do cadastro (novo e o da agenda) + 1 do Commerce; o importado do AVEC não conta');
});

test('heatmap e próximos usam a hora marcada, incluem os compromissos de hoje ainda futuros e não a última edição', () => {
  const input = baseInput();
  input.appointments = [{ id: 'futuro', dataHora: '2026-09-01T22:30:00.000Z', atualizadoEm: '2026-08-01T12:00:00.000Z', status: 'confirmado', clienteNome: 'Cliente sintético' }];
  const result = buildDinoDashboardAnalytics(input, { period: 1, now });
  assert.equal(result.upcomingAppointments[0].id, 'futuro');
  assert.equal(result.upcomingAppointments[0].at, '2026-09-01T22:30:00.000Z');
  assert.equal(result.charts.scheduleHeatmap.find((cell) => cell.weekday === 'tue' && cell.hour === 18)?.value, 1);
  assert.equal(result.kpis.find((item) => item.id === 'appointments').value, 1);
});

test('agendamento antigo editado hoje entra no feed pela edição, mas não no heatmap da janela por data marcada', () => {
  const input = baseInput();
  input.appointments = [{ id: 'antigo', dataHora: '2026-07-01T19:00:00.000Z', atualizadoEm: '2026-09-01T15:00:00.000Z', status: 'agendado', clienteNome: 'Cadastro revisado' }];
  const result = buildDinoDashboardAnalytics(input, { period: 30, now });
  assert.equal(result.charts.scheduleHeatmap.length, 0);
  assert.equal(result.upcomingAppointments.length, 0);
  assert.ok(result.activity.some((item) => item.title === 'Cadastro revisado'), 'o feed recente usa o registro atualizado; mapa e próximos usam dataHora');
});

test('horário civil sem fuso e campo legado hora convertem corretamente a fronteira de dia de Cuiabá', () => {
  const input = baseInput();
  input.appointments = [
    { id: 'hora-legada', dataAgenda: '2026-09-01', hora: '23:30', status: 'agendado' },
    { id: 'data-hora-civil', dataHora: '2026-09-01T23:30:00', status: 'agendado' },
  ];
  const result = buildDinoDashboardAnalytics(input, { period: 1, now });
  assert.equal(result.charts.scheduleHeatmap.find((cell) => cell.weekday === 'tue' && cell.hour === 23)?.value, 2);
  assert.ok(result.upcomingAppointments.every((item) => item.at === '2026-09-02T03:30:00.000Z'));
  assert.ok(result.upcomingAppointments.every((item) => item.day === '2026-09-01'), 'a data civil continua sendo terça-feira em Cuiabá após virar o dia UTC');
});

test('heatmap exclui cancelamentos, faltas e remarcações; próximos exclui também concluídos', () => {
  const input = baseInput();
  input.appointments = [
    { id: 'concluido', dataHora: '2026-09-01T14:00:00.000Z', status: 'concluido' },
    { id: 'cancelado', dataHora: '2026-09-01T15:00:00.000Z', status: 'cancelado' },
    { id: 'falta', dataHora: '2026-09-01T15:30:00.000Z', status: 'faltou' },
    { id: 'no-show', dataHora: '2026-09-01T15:40:00.000Z', status: 'não compareceu' },
    { id: 'remarcado', dataHora: '2026-09-01T15:45:00.000Z', status: 'remarcado' },
    { id: 'futuro', dataHora: '2026-09-01T22:00:00.000Z', status: 'agendado' },
  ];
  const result = buildDinoDashboardAnalytics(input, { period: 1, now });
  assert.equal(result.charts.scheduleHeatmap.reduce((sum, item) => sum + item.value, 0), 2, 'concluído e agendado contam o horário; cancelamentos e exceções não');
  assert.deepEqual(result.upcomingAppointments.map((item) => item.id), ['futuro']);
});

test('feed de atividade respeita a janela selecionada mesmo quando o cadastro foi atualizado em outra data', () => {
  const input = baseInput();
  input.financeEntries = [
    { id: 'atual', tipo: 'receita', status: 'pago', valor: 10, pagoEm: '2026-09-01T15:00:00.000Z' },
    { id: 'antigo', tipo: 'receita', status: 'pago', valor: 20, pagoEm: '2026-07-01T15:00:00.000Z', atualizadoEm: '2026-09-01T15:30:00.000Z' },
  ];
  const result = buildDinoDashboardAnalytics(input, { period: 30, now });
  assert.ok(result.activity.some((item) => item.value === 10), 'lançamento dentro da janela aparece no feed');
  assert.ok(!result.activity.some((item) => item.value === 20), 'lançamento antigo continua fora da janela apesar da edição recente');
  assert.equal(result.dataQuality.sources.activity.status, 'ok');
});

test('filtro estrito de loja exclui outra unidade e registros sem loja; agregado mantém todos', () => {
  const rows = [{ id: 'a', lojaId: 'loja-a' }, { id: 'b', lojaId: 'loja-b' }, { id: 'sem-loja' }];
  assert.deepEqual(filterDashboardRowsToStore(rows, 'loja-a').map((item) => item.id), ['a']);
  assert.deepEqual(filterDashboardRowsToStore(rows).map((item) => item.id), ['a', 'b', 'sem-loja']);
});

test('qualidade distingue fonte vazia, Commerce indisponível e escopo de unidade limitado', () => {
  const empty = buildDinoDashboardAnalytics({}, { period: 1, now });
  assert.equal(empty.scope.level, 'company');
  assert.equal(empty.dataQuality.sources.agenda.status, 'empty');
  assert.equal(empty.dataQuality.sources.payments.status, 'empty');
  assert.equal(empty.dataQuality.sources.commerce.status, 'unavailable');

  const scoped = buildDinoDashboardAnalytics({
    scope: { level: 'unit', unitId: 'loja-a' }, commerceAvailable: false, commerceUnavailableReason: 'STORE_SCOPE_MISMATCH',
    goals: { configured: true, comparable: false, items: [] },
    unassignedRecords: { appointments: 2, historicalAppointments: 3, historicalCommands: 1 },
  }, { period: 1, now });
  assert.equal(scoped.scope.level, 'unit');
  assert.equal(scoped.dataQuality.sources.commerce.reason, 'STORE_SCOPE_MISMATCH');
  assert.equal(scoped.dataQuality.sources.goals.status, 'limited');
  assert.ok(scoped.dataQuality.notes.some((note) => /6 registro\(s\).*excluídos/.test(note)));
});

test('valores de pagamentos de sete dígitos são preservados no resumo agregado', () => {
  const input = baseInput();
  input.retailSales = [];
  input.commands = [{ id: 'alto', status: 'paga', dataOperacao: '2026-09-01T15:00:00.000Z', pagamentos: [{ meioPagamento: 'pix', valor: 1234567.89 }] }];
  const result = buildDinoDashboardAnalytics(input, { period: 1, now });
  assert.deepEqual(result.charts.paymentMethods, [{ method: 'pix', value: 1234567.89 }]);
  assert.equal(result.dataQuality.sources.payments.total, 1234567.89);
});


test('dashboard mantém indicadores e reutiliza formatadores em uma agenda extensa', (t) => {
  const OriginalFormatter = Intl.DateTimeFormat;
  let created = 0;
  t.mock.method(Intl, 'DateTimeFormat', function (...args) {
    created += 1;
    return new OriginalFormatter(...args);
  });
  const input = baseInput();
  input.appointments = Array.from({ length: 1631 }, (_, index) => ({
    id: `agenda-${index}`, dataAgenda: '2026-09-01', hora: '10:00', status: 'agendado',
  }));
  const result = buildDinoDashboardAnalytics(input, { period: 30, now });
  assert.equal(result.kpis.find((item) => item.id === 'appointments').value, 1631);
  assert.equal(result.charts.appointmentsDaily.reduce((sum, item) => sum + item.value, 0), 1631);
  assert.ok(created <= 2, `Agenda criou ${created} formatadores nativos em uma única leitura`);
});

test('mapa de horários soma comandas Avec fechadas no mesmo dia pela hora de fechamento', () => {
  const input = baseInput();
  input.appointments = []; // período anterior à agenda do Kytto
  input.historicalCommands = [
    { id: 'c1', dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '25/08/2026 17:40' },
    { id: 'c2', dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '25/08/2026 17:05' },
    { id: 'c3', dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '29/08/2026 10:00' },
    { id: 'c4', dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '' },
  ];
  const result = buildDinoDashboardAnalytics(input, { period: 30, now });
  const cell = result.charts.scheduleHeatmap.find((item) => item.weekday === 'tue' && item.hour === 17);
  assert.deepEqual({ value: cell.value, agenda: cell.agenda, historicoAvec: cell.historicoAvec }, { value: 2, agenda: 0, historicoAvec: 2 });
  assert.equal(result.charts.scheduleHeatmap.reduce((sum, item) => sum + item.historicoAvec, 0), 2, 'fechamento em outro dia ou sem hora não entra');
  assert.equal(result.charts.scheduleHeatmap.reduce((sum, item) => sum + item.value, 0), result.charts.scheduleHeatmap.reduce((sum, item) => sum + item.agenda + item.historicoAvec, 0));
  assert.equal(result.dataQuality.sources.agenda.historicalInHeatmap, 2);
  assert.equal(result.dataQuality.sources.agenda.status, 'ok');
  assert.ok(result.dataQuality.notes.some((note) => note.includes('hora de fechamento')));
});

test('horário da comanda Avec é interpretado no fuso de Cuiabá', () => {
  assert.equal(historicalCommandSlot({ dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '25/08/2026 17:40' }).toISOString(), '2026-08-25T21:40:00.000Z');
  assert.equal(historicalCommandSlot({ dataComandaIso: '2026-08-25', dataFinalizacaoOriginal: '26/08/2026 09:00' }), null);
  assert.equal(historicalCommandSlot({}), null);
});

test('feed seleciona os 12 mais recentes e mantém ordem estável entre fontes empatadas', () => {
  const at = '2026-09-01T15:00:00Z';
  const history = Array.from({ length: 20000 }, (_, i) => ({ clienteNome: `Histórico ${i}`, dataAgenda: at, servicoNome: 'Corte' }));
  const result = buildDinoDashboardAnalytics({
    appointments: [{ clienteNome: 'Agenda', dataHora: at }],
    commands: [{ clienteNome: 'Comanda', criadoEm: at }],
    historicalAppointments: [...history, { clienteNome: 'Futuro', dataAgenda: '2030-01-01' }, { clienteNome: 'Inválido', dataAgenda: 'inválido' }],
  }, { period: 7, now });
  assert.equal(result.activity.length, 12);
  assert.deepEqual(result.activity.map(row => row.title), ['Agenda', 'Comanda', ...Array.from({ length: 10 }, (_, i) => `Histórico ${i}`)]);
});

test('mapa não soma comanda Avec a partir do primeiro dia com agenda no Kytto', async () => {
  const { firstAgendaDay } = await import('./dino-dashboard.js');
  const input = baseInput();
  const primeiro = firstAgendaDay(input.appointments);
  assert.ok(primeiro, 'a base de teste tem agenda');
  input.historicalCommands = [{ id: 'no-dia', dataComandaIso: primeiro, dataFinalizacaoOriginal: `${primeiro.slice(8, 10)}/${primeiro.slice(5, 7)}/${primeiro.slice(0, 4)} 10:00` }];
  const result = buildDinoDashboardAnalytics(input, { period: 30, now });
  assert.equal(result.dataQuality.sources.agenda.historicalInHeatmap, 0);
});
