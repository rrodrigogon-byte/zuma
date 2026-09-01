import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDinoDashboardAnalytics, dashboardPeriod } from './dino-dashboard.js';

const now = new Date('2026-09-01T16:00:00.000Z');

function baseInput() {
  return {
    commerceAvailable: true,
    commerceCurrent: {
      sales: { summary: { gross_total: '250', orders: 2 }, daily: [{ day: '2026-09-01', total: '250' }] },
      customers: { summary: { new_customers: 1 } },
      inventory: { items: [{ low_stock: true }, { low_stock: false }] },
    },
    commercePrevious: {
      sales: { summary: { gross_total: '100', orders: 1 }, daily: [] },
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
