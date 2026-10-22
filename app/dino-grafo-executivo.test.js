import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveGraph } from './dino-grafo-executivo.js';

const NOW = new Date('2026-10-22T18:00:00Z');
const PERIOD = { days: 30, from: '2026-09-22T18:00:00.000Z', to: NOW.toISOString() };
const fullQuality = {
  graph: { status: 'ok', records: 5 }, appointments: { status: 'ok', records: 10 },
  finance: { status: 'ok', records: 3 }, cash: { status: 'ok', records: 1 },
  orders: { status: 'ok', records: 2 }, payments: { status: 'ok', records: 1 },
  inventory: { status: 'ok', records: 2 },
};

test('agrega sinais executivos por período sem devolver identificadores de cliente', () => {
  const result = buildExecutiveGraph({
    ...PERIOD, now: NOW,
    graph: { clientes: 5, emRisco: 2, qualidade: { fontes: { appointments: { status: 'ok' } } } },
    schedule: { total: 10, concluidos: 6, cancelados: 3, faltas: 1, taxaComparecimento: 85.7, taxaCancelamento: 30 },
    finance: [
      { tipo: 'receita', status: 'pago', valor: 100, pagoEm: '2026-10-01T00:00:00Z' },
      { tipo: 'despesa', status: 'pago', valor: 30, pagoEm: '2026-10-01T00:00:00Z' },
      { tipo: 'receita', status: 'pendente', valor: 20, vencimento: '2026-09-01' },
      { tipo: 'receita', status: 'pago', valor: 999, pagoEm: '2026-08-01T00:00:00Z' },
    ],
    cash: [{ status: 'fechado', data: '2026-10-01', divergencia: -4 }],
    commerce: {
      ordersByStatus: [{ status: 'paid', total: 1 }, { status: 'refunded', total: 1 }, { status: 'partially_refunded', total: 1 }],
      payments: { transactions: 1, amount: 100 },
      inventory: [{ name: 'Pomada', available: 1, minimum: 2, sold: 3 }, { name: 'Cera', available: 0, minimum: 0, sold: 1 }],
    },
    offers: [{ name: 'Pomada', type: 'produto', count: 3 }], quality: fullQuality,
  });
  assert.equal(result.metrics.customers.total, 5);
  assert.equal(result.metrics.customers.atRisk, 2);
  assert.equal(result.metrics.operations.cancellationRate, 30);
  assert.equal(result.metrics.finance.paidIncome, 100);
  assert.equal(result.metrics.finance.paidExpenses, 30);
  assert.equal(result.metrics.finance.net, 70);
  assert.equal(result.metrics.finance.overdueCount, 1);
  assert.equal(result.metrics.finance.cashDiscrepancyCount, 1);
  assert.equal(result.metrics.finance.cashDiscrepancyGross, 4);
  assert.equal(result.metrics.commerce.ordersTotal, 3);
  assert.equal(result.metrics.commerce.confirmedOrders, 1);
  assert.equal(result.metrics.commerce.unconfirmedOrders, 2);
  assert.equal(result.metrics.commerce.refundedOrders, 2);
  assert.equal(result.metrics.inventory.lowStock, 1);
  assert.equal(result.metrics.inventory.outOfStock, 1);
  assert.ok(result.signals.some((signal) => signal.area === 'financeiro'));
  assert.ok(result.signals.some((signal) => signal.area === 'estoque'));
  assert.ok(result.signals.find((signal) => signal.id === 'commerce-refunds').detail.includes('não comprova o valor'));
  assert.ok(result.network.links.length > 0);
  assert.equal(JSON.stringify(result).includes('cliente-uuid'), false);
  assert.equal(JSON.stringify(result).includes('65999990000'), false);
});

test('fonte indisponível não vira zero nem gera alerta de ausência de risco', () => {
  const result = buildExecutiveGraph({
    ...PERIOD, graph: { clientes: 0, emRisco: 0 }, schedule: { total: 0 }, finance: [], cash: [],
    commerce: { ordersByStatus: [], inventory: [] },
    quality: {
      graph: { status: 'indisponivel' }, appointments: { status: 'indisponivel' },
      finance: { status: 'indisponivel' }, cash: { status: 'indisponivel' },
      orders: { status: 'indisponivel' }, payments: { status: 'indisponivel' }, inventory: { status: 'indisponivel' },
    },
  });
  assert.equal(result.metrics.customers.total, null);
  assert.equal(result.metrics.operations.total, null);
  assert.equal(result.metrics.finance.paidIncome, null);
  assert.equal(result.metrics.commerce.ordersTotal, null);
  assert.equal(result.metrics.inventory.products, null);
  assert.equal(result.signals.length, 0);
  assert.ok(Object.values(result.quality.sources).every((source) => source.status === 'indisponivel'));
});
