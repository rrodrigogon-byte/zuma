import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveGraph } from './dino-grafo-executivo.js';

const NOW = new Date('2026-10-22T18:00:00Z');
const PERIOD = {
  days: 30, from: '2026-09-22T18:00:00.000Z', to: NOW.toISOString(),
  scope: { empresaId: '33333333-3333-4333-8333-333333333333', lojaId: '44444444-4444-4444-8444-444444444444' },
};
const fullQuality = {
  graph: { status: 'ok', records: 5 }, appointments: { status: 'ok', records: 10 },
  finance: { status: 'ok', records: 3 }, receivables: { status: 'ok', records: 3 }, cash: { status: 'ok', records: 1 },
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
  assert.equal(result.quality.sources.receivables.status, 'ok');
  assert.equal(result.network.nodes.find((node) => node.id === 'metric:finance-overdue').window.kind, 'current_overdue_position');
  assert.equal(result.network.nodes.find((node) => node.id === 'metric:finance-overdue-amount').window.asOf, NOW.toISOString());
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

test('saldo ausente permanece desconhecido e não vira estoque esgotado nem gera sinal', () => {
  const result = buildExecutiveGraph({
    ...PERIOD, now: NOW,
    graph: { clientes: 0, emRisco: 0 }, schedule: { total: 0 }, finance: [], cash: [],
    commerce: { inventory: [
      { name: 'Produto sem saldo informado', minimum: 2, sold: 4 },
      { name: 'Produto com saldo corrompido', available: 'abc', minimum: '2', sold: 1 },
    ] },
    quality: fullQuality,
  });
  assert.equal(result.metrics.inventory.lowStock, 0);
  assert.equal(result.metrics.inventory.outOfStock, 0);
  assert.equal(result.metrics.inventory.unknownBalances, 2);
  assert.equal(result.quality.sources.inventory.status, 'limitado');
  assert.equal(result.signals.some((signal) => signal.id === 'stock-demand'), false);
  assert.equal(result.network.nodes.find((node) => node.id === 'metric:inventory-low-stock').value, null);
});

test('recebível pendente sem vencimento não vira atraso e limita só a cobertura de vencidos', () => {
  const result = buildExecutiveGraph({
    ...PERIOD, now: NOW, graph: { clientes: 0, emRisco: 0 }, schedule: { total: 0 }, cash: [],
    finance: [
      { tipo: 'receita', status: 'pago', valor: 100, pagoEm: '2026-10-01T00:00:00Z' },
      { tipo: 'receita', status: 'pendente', valor: 20 },
    ],
    quality: fullQuality,
  });
  assert.equal(result.metrics.finance.paidIncome, 100);
  assert.equal(result.metrics.finance.overdueCount, null);
  assert.equal(result.metrics.finance.overdueAmount, null);
  assert.equal(result.quality.sources.finance.status, 'ok');
  assert.equal(result.quality.sources.receivables.status, 'limitado');
  assert.match(result.quality.sources.receivables.detail, /sem vencimento válido/);
  assert.equal(result.signals.some((signal) => signal.id === 'finance-overdue'), false);
  const overdueNode = result.network.nodes.find((node) => node.id === 'metric:finance-overdue');
  assert.equal(overdueNode.value, null);
  assert.equal(overdueNode.status, 'limitado');
});

test('fonte indisponível não vira zero nem gera alerta de ausência de risco', () => {
  const result = buildExecutiveGraph({
    ...PERIOD, graph: { clientes: 0, emRisco: 0 }, schedule: { total: 0 }, finance: [], cash: [],
    commerce: { ordersByStatus: [], inventory: [] },
    quality: {
      graph: { status: 'indisponivel' }, appointments: { status: 'indisponivel' },
      finance: { status: 'indisponivel' }, cash: { status: 'indisponivel' },
      orders: { status: 'indisponivel' }, payments: { status: 'indisponivel' }, inventory: { status: 'indisponivel' },
      localInventory: { status: 'indisponivel' }, offers: { status: 'indisponivel' },
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

test('fontes limitadas ou desconhecidas não geram zeros nem sinais com certeza falsa', () => {
  const result = buildExecutiveGraph({
    ...PERIOD,
    graph: { clientes: 12, emRisco: 4 },
    graphModel: { customers: new Map(), edges: [] },
    schedule: { total: 20, faltas: 5, cancelados: 8 },
    finance: [{ tipo: 'receita', status: 'pago', valor: 100, pagoEm: '2026-10-01T00:00:00Z' }],
    cash: [{ status: 'fechado', data: '2026-10-01', divergencia: 8 }],
    commerce: {
      ordersByStatus: [{ status: 'paid', total: 3 }],
      inventory: [{ id: 'commerce:product-1', name: 'Produto', available: 0, minimum: 2, sold: 8 }],
    },
    offers: [{ name: 'Produto', type: 'produto', count: 4 }],
    quality: {
      graph: { status: 'limitado' }, appointments: { status: 'limitado' },
      finance: { status: 'desconhecido' }, cash: { status: 'indisponivel' },
      orders: { status: 'limitado' }, payments: { status: 'desconhecido' },
      inventory: { status: 'desconhecido' }, localInventory: { status: 'indisponivel' },
      offers: { status: 'limitado' },
    },
  });
  assert.equal(result.metrics.customers.total, null);
  assert.equal(result.metrics.operations.total, null);
  assert.equal(result.metrics.finance.paidIncome, null);
  assert.equal(result.metrics.finance.cashDiscrepancyCount, null);
  assert.equal(result.metrics.commerce.ordersTotal, null);
  assert.equal(result.metrics.inventory.products, null);
  assert.equal(result.signals.length, 0);
  assert.ok(result.network.nodes.filter((node) => node.status !== 'ok' && node.type !== 'business').every((node) => node.value === null && node.severity === 'unknown'));
});
