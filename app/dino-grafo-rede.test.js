import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessNetwork, scopedCustomerRef } from './dino-grafo-rede.js';
import { customerToken } from './dino-grafo.js';

const NOW = new Date('2026-10-22T18:00:00.000Z');
const PERIOD = { days: 30, from: '2026-09-22T18:00:00.000Z', to: NOW.toISOString() };
const CUSTOMER_PHONE = '5565999990001';
const ORDER_UUID = '11111111-1111-4111-8111-111111111111';
const PROFESSIONAL_UUID = '22222222-2222-4222-8222-222222222222';
const COMPANY_UUID = '33333333-3333-4333-8333-333333333333';
const STORE_UUID = '44444444-4444-4444-8444-444444444444';

function quality(overrides = {}) {
  return {
    sources: {
      graph: { status: 'ok' }, appointments: { status: 'ok' }, finance: { status: 'ok' }, cash: { status: 'ok' },
      receivables: { status: 'ok' }, orders: { status: 'ok' }, payments: { status: 'ok' }, inventory: { status: 'ok' },
      localInventory: { status: 'ok' }, offers: { status: 'ok' }, ...overrides,
    },
  };
}

function graphFixture() {
  return {
    customers: new Map([
      [CUSTOMER_PHONE, {
        nome: 'Nome de cliente que não pode sair', visits: ['2026-10-01T10:00:00Z'], interval: 10, daysSince: 20,
        interests: [{ categoria: 'produto_interesse', valor: 'telefone 5565999990001' }],
      }],
      ['customer-two-internal', { visits: [] }],
    ]),
    edges: [
      { from: `c:${CUSTOMER_PHONE}`, rel: 'COMPROU', to: `p:commerce:${ORDER_UUID}`, at: '2026-10-01T10:00:00Z', weight: 99 },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'COMPROU', to: `p:commerce:${ORDER_UUID}`, at: '2026-10-02T10:00:00Z', weight: 1 },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'AGENDOU', to: 's:corte premium', at: '2026-10-03T10:00:00Z' },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'ATENDIDO_POR', to: `f:${PROFESSIONAL_UUID}`, at: '2026-10-03T10:00:00Z' },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'INDICOU', to: 'c:customer-two-internal', at: '2026-10-04T10:00:00Z' },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'PERGUNTOU', to: 'i:telefone 5565999990001' },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'INTERESSE', to: 'i:texto livre com telefone 5565999990001' },
      { from: `c:${CUSTOMER_PHONE}`, rel: 'IGNORAR', to: 'p:nao-deve-aparecer' },
    ],
    productNames: new Map([[`commerce:${ORDER_UUID}`, 'Pomada premium']]),
    serviceNames: new Map([['service-id', 'Corte premium']]),
    professionalNames: new Map([[PROFESSIONAL_UUID, 'Profissional autorizado']]),
  };
}

test('referência de cliente é opaca e exige empresa/unidade UUID válidas', () => {
  const ref = scopedCustomerRef({ empresaId: COMPANY_UUID, lojaId: STORE_UUID }, CUSTOMER_PHONE);
  assert.equal(ref, customerToken(`business-network|${COMPANY_UUID}|${STORE_UUID}|${CUSTOMER_PHONE}`));
  assert.notEqual(ref, customerToken(CUSTOMER_PHONE));
  assert.equal(scopedCustomerRef({ empresaId: COMPANY_UUID, lojaId: 'loja-sem-uuid' }, CUSTOMER_PHONE), null);
});

test('preserva centro, hubs e métricas agregadas antes de truncar clientes individuais', () => {
  const customers = new Map();
  const edges = [];
  for (let index = 0; index < 60; index += 1) {
    const key = `cliente-${index}`;
    customers.set(key, { visits: [] });
    edges.push({ from: `c:${key}`, rel: 'AGENDOU', to: 's:corte', at: '2026-10-01T10:00:00Z' });
  }
  const network = buildBusinessNetwork({
    graphModel: { customers, edges, serviceNames: new Map([['corte', 'Corte']]) },
    metrics: { customers: {}, operations: {}, finance: {}, commerce: {}, inventory: {} },
    quality: quality(), period: PERIOD, now: NOW, maxNodes: 28,
    scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  assert.equal(network.nodes[0].id, 'business');
  assert.equal(network.nodes.filter((node) => node.type === 'hub').length, 6);
  assert.ok(network.nodes.some((node) => node.id === 'metric:finance-income'));
  assert.ok(network.nodes.some((node) => node.id === 'metric:payments-captured-amount'));
  assert.equal(network.nodes.some((node) => node.type === 'customer'), false);
  assert.ok(network.summary.truncated);
});

test('agrega ocorrências reais, tipa nós e agrupa interesses sem exportar identidade', () => {
  const network = buildBusinessNetwork({
    graphModel: graphFixture(),
    graphSources: { commerce: { inventory: [{ id: `commerce:${ORDER_UUID}`, name: 'Pomada premium', available: 0, minimum: 2, updatedAt: '2026-10-20T09:30:00.000Z' }] } },
    metrics: {
      customers: { total: 2, atRisk: 1, customersWithOffers: 1 },
      operations: { total: 3, noShow: 1, cancelled: 0 },
      finance: { paidIncome: 100, paidExpenses: 20, overdueCount: 1, cashDiscrepancyCount: 0 },
      commerce: { ordersTotal: 2, capturedTransactions: 1 },
      inventory: { products: 1, lowStock: 1 },
    },
    offers: [{ name: 'Pomada premium', type: 'produto', count: 2 }],
    quality: quality(), period: PERIOD, now: NOW, businessLabel: 'Unidade Central',
    scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const purchased = network.links.find((link) => link.relation === 'COMPROU');
  assert.equal(purchased.weight, 2, 'peso é ocorrência e ignora peso/quantidade do evento');
  assert.equal(purchased.observedFrom, '2026-10-01T10:00:00.000Z');
  assert.equal(purchased.observedTo, '2026-10-02T10:00:00.000Z');
  assert.ok(network.links.filter((link) => !link.structural).every((link) => ['COMPROU', 'AGENDOU', 'ATENDIDO_POR', 'INDICOU', 'PERGUNTOU', 'INTERESSE'].includes(link.relation)));

  const customerNodes = network.nodes.filter((node) => node.type === 'customer');
  assert.equal(customerNodes.length, 2);
  assert.ok(customerNodes.some((node) => node.customerRef === customerToken(`business-network|${COMPANY_UUID}|${STORE_UUID}|${CUSTOMER_PHONE}`)));
  assert.ok(customerNodes.every((node) => /^Cliente \d+$/.test(node.label)));
  assert.equal(network.nodes.find((node) => node.type === 'product' && node.label === 'Pomada premium').area, 'commerce');
  assert.ok(network.nodes.some((node) => node.type === 'service' && node.area === 'operacao'));
  assert.ok(network.nodes.some((node) => node.type === 'professional' && node.area === 'operacao'));
  assert.ok(network.nodes.some((node) => node.type === 'interest' && node.area === 'oportunidades'));
  const business = network.nodes.find((node) => node.type === 'business');
  const hubs = network.nodes.filter((node) => node.type === 'hub');
  assert.equal(hubs.length, 6);
  assert.ok(hubs.every((hub) => network.links.some((link) => link.from === business.id && link.to === hub.id && link.structural && link.weight === null)));
  assert.deepEqual(network.links.find((link) => link.from === business.id && link.to === 'hub:commerce').sources, ['orders', 'payments']);
  assert.ok(network.links.some((link) => link.structural && link.label === 'Mesmo produto, ID confirmado' && link.weight === null));
  assert.equal(network.summary.windows.selectedPeriod.from, PERIOD.from);
  assert.equal(network.summary.windows.relationshipHistory.maxDays, 365);
  assert.equal(network.nodes.find((node) => node.id === 'metric:customers-total').window.kind, 'relationship_history');
  assert.equal(network.nodes.find((node) => node.id === 'metric:offers-total').window.kind, 'relationship_history');
  assert.equal(network.summary.windows.currentOverduePosition.kind, 'current_overdue_position');
  assert.equal(network.nodes.find((node) => node.id === 'metric:finance-overdue').window.kind, 'current_overdue_position');
  assert.equal(network.summary.windows.stockSnapshot.kind, 'current_stock_snapshot');
  assert.equal(network.summary.windows.stockSnapshot.capturedAt, null, 'não inventa que todos os saldos foram capturados em `now`');
  assert.equal(network.nodes.find((node) => node.type === 'inventory').window.capturedAt, '2026-10-20T09:30:00.000Z');
  assert.equal(network.nodes.find((node) => node.id === 'metric:finance-income').valueFormat, 'currency');
  assert.equal(network.nodes.find((node) => node.id === 'metric:operations-attendance-rate').valueFormat, 'percent');

  const serialized = JSON.stringify(network);
  assert.equal(serialized.includes(CUSTOMER_PHONE), false);
  assert.equal(serialized.includes(ORDER_UUID), false);
  assert.equal(serialized.includes(PROFESSIONAL_UUID), false);
  assert.equal(serialized.includes('Nome de cliente que não pode sair'), false);
  assert.equal(serialized.includes('texto livre com telefone'), false);
  assert.equal(serialized.includes('telefone 5565999990001'), false);
  assert.equal(serialized.includes('Barbearia Dino'), false);
});

test('a mesma pessoa recebe referências diferentes em unidades distintas e não expõe o token global', () => {
  const graphModel = graphFixture();
  const first = buildBusinessNetwork({ graphModel, quality: quality(), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID } });
  const second = buildBusinessNetwork({ graphModel, quality: quality(), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: '33333333-3333-4333-8333-333333333333' } });
  const firstCustomer = first.nodes.find((node) => node.type === 'customer');
  const secondCustomer = second.nodes.find((node) => node.type === 'customer');
  assert.ok(firstCustomer && secondCustomer);
  assert.notEqual(firstCustomer.id, secondCustomer.id);
  assert.notEqual(firstCustomer.customerRef, secondCustomer.customerRef);
  assert.notEqual(first.nodes.find((node) => node.type === 'product').id, second.nodes.find((node) => node.type === 'product').id);
  assert.equal(JSON.stringify(first).includes(customerToken(CUSTOMER_PHONE)), false);
});

test('consolida a proveniência de todas as fontes que sustentam uma relação observada', () => {
  const graphModel = graphFixture();
  let purchaseIndex = 0;
  graphModel.edges = graphModel.edges.map((edge) => edge.rel !== 'COMPROU' ? edge : {
    ...edge, source: purchaseIndex++ % 2 ? 'retailSales' : 'orders',
  });
  const network = buildBusinessNetwork({ graphModel, quality: quality(), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID } });
  const purchased = network.links.find((link) => link.relation === 'COMPROU');
  assert.deepEqual(purchased.sources, ['orders', 'retailSales']);
});

test('cobertura parcial de estoque não apaga a intensidade de evento vindo de uma fonte completa', () => {
  const graphModel = graphFixture();
  graphModel.edges = graphModel.edges.filter((edge) => edge.rel === 'COMPROU').map((edge) => ({ ...edge, source: 'commands' }));
  const network = buildBusinessNetwork({
    graphModel,
    graphSources: { quality: { fontes: { commands: { status: 'ok' }, catalogo: { status: 'limitado' } } } },
    quality: quality({ graph: { status: 'limitado' }, inventory: { status: 'limitado' } }),
    period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const purchased = network.links.find((link) => link.relation === 'COMPROU');
  assert.equal(purchased.weight, 2);
  assert.equal(purchased.status, 'ok');
});

test('texto livre redige e-mail/documento e profissional é anônimo antes de sair da API', () => {
  const graphModel = graphFixture();
  graphModel.productNames.set(`commerce:${ORDER_UUID}`, 'Pomada alice@example.com CPF 123.456.789-00');
  graphModel.professionalNames.set(PROFESSIONAL_UUID, 'Ana Silva');
  graphModel.edges = graphModel.edges.map((edge) => edge.rel === 'COMPROU' ? { ...edge, source: 'Fonte alice@example.com' } : edge);
  const network = buildBusinessNetwork({
    graphModel, quality: quality(), period: PERIOD, now: NOW,
    scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const serialized = JSON.stringify(network);
  assert.equal(serialized.includes('alice@example.com'), false);
  assert.equal(serialized.includes('123.456.789-00'), false);
  assert.equal(serialized.includes('Ana Silva'), false);
  assert.ok(serialized.includes('e-mail oculto'));
  assert.ok(serialized.includes('documento oculto'));
  assert.ok(network.nodes.some((node) => node.type === 'professional' && /^Profissional \d+$/.test(node.label)));
});

test('mantém janela de relação explícita, separa eventos sem data e descarta eventos fora de 365 dias', () => {
  const network = buildBusinessNetwork({
    graphModel: {
      customers: new Map([['cliente-interno', { visits: [] }]]),
      edges: [
        { from: 'c:cliente-interno', rel: 'COMPROU', to: 'p:commerce:produto-1', at: '2026-10-01T10:00:00Z' },
        { from: 'c:cliente-interno', rel: 'COMPROU', to: 'p:commerce:produto-1', at: null },
        { from: 'c:cliente-interno', rel: 'COMPROU', to: 'p:commerce:produto-1', at: '2025-10-01T10:00:00Z' },
        { from: 'c:cliente-interno', rel: 'COMPROU', to: 'p:commerce:produto-2', at: '2026-10-23T10:00:00Z' },
      ],
      productNames: new Map([['commerce:produto-1', 'Produto um'], ['commerce:produto-2', 'Produto dois']]),
    },
    quality: { sources: { graph: { status: 'limitado' } } }, period: PERIOD, now: NOW,
    scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const purchased = network.links.filter((link) => link.relation === 'COMPROU');
  assert.equal(purchased.length, 2);
  assert.ok(purchased.every((link) => link.weight === null && link.status === 'limitado'));
  assert.equal(purchased.filter((link) => link.window.kind === 'relationship_history').length, 1);
  assert.equal(purchased.filter((link) => link.window.kind === 'undated_relationships').length, 1);
  assert.equal(network.nodes.some((node) => node.label === 'Produto dois'), false);
  assert.equal(network.summary.windows.relationshipHistory.maxDays, 365);
});

test('truncamento de nós e links é determinístico e informa omitidos', () => {
  const customers = new Map();
  const edges = [];
  const productNames = new Map();
  for (let customer = 0; customer < 12; customer += 1) {
    const customerKey = `customer-${customer}`;
    customers.set(customerKey, { visits: [] });
    for (let product = 0; product < 12; product += 1) {
      const key = `product-${product}`;
      productNames.set(key, `Produto ${product}`);
      edges.push({ from: `c:${customerKey}`, rel: 'COMPROU', to: `p:${key}`, at: `2026-10-${String((product % 9) + 1).padStart(2, '0')}T00:00:00Z` });
    }
  }
  const input = {
    graphModel: { customers, edges, productNames }, quality: quality(), period: PERIOD, now: NOW,
    maxNodes: 30, maxLinks: 5, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  };
  const first = buildBusinessNetwork(input);
  const second = buildBusinessNetwork(input);
  assert.deepEqual(first, second);
  assert.equal(first.summary.nodesVisible, 30);
  assert.equal(first.summary.linksVisible, 5);
  assert.ok(first.summary.omittedNodes > 0);
  assert.ok(first.summary.omittedLinks > 0);
  assert.ok(first.summary.omittedObservedLinks > 0);
  assert.ok(first.summary.omittedStructuralLinks > 0);
  const visibleNodeIds = new Set(first.nodes.map((node) => node.id));
  const observed = first.links.find((link) => !link.structural);
  assert.ok(observed);
  assert.ok(visibleNodeIds.has(observed.from) && visibleNodeIds.has(observed.to), 'o limite preserva os dois extremos da ocorrência observada');
  assert.equal(first.summary.truncated, true);
});

test('limite de arestas preserva eventos observados antes de vínculos estruturais', () => {
  const network = buildBusinessNetwork({
    graphModel: graphFixture(), quality: quality(), period: PERIOD, now: NOW, maxNodes: 100, maxLinks: 1,
    scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  assert.equal(network.links.length, 1);
  assert.equal(network.links[0].structural, undefined);
  assert.ok(network.links[0].weight > 0);
  const withoutTimestamp = buildBusinessNetwork({ graphModel: graphFixture(), quality: quality(), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID } });
  assert.equal(withoutTimestamp.summary.windows.stockSnapshot.capturedAt, null);
});

test('sem empresa e loja válidas, a rede executiva não emite entidades nem relações de cliente', () => {
  const network = buildBusinessNetwork({ graphModel: graphFixture(), quality: quality(), period: PERIOD, now: NOW });
  assert.equal(network.nodes.length, 0);
  assert.equal(network.links.length, 0);
  assert.equal(network.nodes.some((node) => node.type === 'customer'), false);
  assert.equal(network.links.some((link) => !link.structural && ['COMPROU', 'AGENDOU', 'INDICOU'].includes(link.relation)), false);
});

test('fonte indisponível permanece desconhecida e não vira zero ou risco verde', () => {
  const network = buildBusinessNetwork({
    graphModel: graphFixture(),
    graphSources: { commerce: { inventory: [] } },
    metrics: {
      customers: { total: null, atRisk: null }, operations: { total: null, noShow: null },
      finance: { paidIncome: null, overdueCount: null, cashDiscrepancyCount: null },
      commerce: { ordersTotal: null, capturedTransactions: null }, inventory: { products: null, lowStock: null },
    },
    quality: quality({
      graph: { status: 'indisponivel' }, appointments: { status: 'indisponivel' }, finance: { status: 'indisponivel' },
      cash: { status: 'indisponivel' }, orders: { status: 'indisponivel' }, payments: { status: 'indisponivel' },
      inventory: { status: 'indisponivel' }, localInventory: { status: 'indisponivel' }, offers: { status: 'indisponivel' },
    }), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const unknown = network.nodes.filter((node) => node.type !== 'business');
  assert.ok(unknown.some((node) => node.status === 'indisponivel'));
  assert.ok(unknown.filter((node) => node.status === 'indisponivel').every((node) => node.value === null && node.severity === 'unknown'));
  const graphSourcedLinks = network.links.filter((link) => link.sources.includes('graph'));
  assert.ok(graphSourcedLinks.length > 0);
  assert.ok(graphSourcedLinks.every((link) => link.status !== 'ok' && link.weight === null));
});

test('saldo textual ou negativo inválido não vira zero nem sinaliza ruptura', () => {
  const network = buildBusinessNetwork({
    graphModel: { customers: new Map(), edges: [] },
    graphSources: { commerce: { inventory: [
      { id: 'bad-text', name: 'Saldo textual corrompido', available: 'abc', minimum: 2 },
      { id: 'bad-negative', name: 'Saldo negativo inválido', available: -1, minimum: 2 },
    ] } },
    metrics: { customers: {}, operations: {}, finance: {}, commerce: {}, inventory: {} },
    quality: quality(), period: PERIOD, now: NOW, scope: { empresaId: COMPANY_UUID, lojaId: STORE_UUID },
  });
  const inventory = network.nodes.filter((node) => node.type === 'inventory');
  assert.equal(inventory.length, 2);
  assert.ok(inventory.every((node) => node.value === null && node.status === 'limitado' && node.severity === 'unknown'));
});
