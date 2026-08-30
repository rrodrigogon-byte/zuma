import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommerceAdminRouter, createCommercePublicRouter, parsePagination } from './commerce-routes.js';
import { fulfillmentReport } from './commerce-reports.js';
import { db } from './database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const usuarioId = '66666666-6666-4666-8666-666666666666';

function providerHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/payments/providers');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de provedores não encontrada');
  return layer.route.stack[0].handle;
}

function paymentSyncHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/payments/:id/sync');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de reconciliação não encontrada');
  return layer.route.stack[0].handle;
}

function auditHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/audit');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de auditoria não encontrada');
  return layer.route.stack[0].handle;
}

function healthHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/operations/health');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de saúde não encontrada');
  return layer.route.stack[0].handle;
}

function publicOrderHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de pedido não encontrada');
  return layer.route.stack[0].handle;
}

async function invoke(handler, dbQuery, query = {}) {
  const original = db.query;
  db.query = dbQuery;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await handler({
      user: { email: 'admin@example.com' },
      headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId },
      query,
    }, response);
    return response;
  } finally {
    db.query = original;
  }
}

async function invokePublicOrder(dbQuery) {
  const original = db.query;
  db.query = dbQuery;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await publicOrderHandler()({ hostname: 'loja.kytto.com.br', headers: {}, params: { publicCode: 'KC-TEST' } }, response);
    return response;
  } finally {
    db.query = original;
  }
}

test('endpoint de reconciliação rejeita sessão sem membership antes do gateway', async () => {
  const response = await invoke(paymentSyncHandler(), async () => ({ rows: [] }));
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'TENANT_CONTEXT_REQUIRED');
});

test('endpoint de provedores rejeita sessão sem membership efetiva', async () => {
  const response = await invoke(providerHandler(), async () => ({ rows: [] }));
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'TENANT_CONTEXT_REQUIRED');
});

test('endpoint de provedores rejeita membership sem payments.read', async () => {
  let count = 0;
  const response = await invoke(providerHandler(), async () => {
    count += 1;
    if (count === 1) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    return { rows: [] };
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'PERMISSION_DENIED');
});

test('endpoint autorizado retorna apenas contrato público do provedor', async () => {
  let count = 0;
  const response = await invoke(providerHandler(), async () => {
    count += 1;
    if (count === 1) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    return { rows: [{ ok: 1 }] };
  });
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.body.items));
  assert.equal(response.body.items.some(item => 'secretRefs' in item), false);
});

test('auditoria aplica escopo de loja e paginação sem vazar payload sensível', async () => {
  let count = 0;
  const calls = [];
  const response = await invoke(auditHandler(), async (sql, params) => {
    count += 1;
    calls.push({ sql, params });
    if (count === 1) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (count === 2) return { rows: [{ ok: 1 }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
    return { rows: [{ id: '77777777-7777-4777-8777-777777777777', loja_id: lojaId, entidade: 'payment', acao: 'status_reconciled', depois: { status: 'captured' } }] };
  }, { limit: '20', offset: '40', entity: 'payment', action: 'status_reconciled' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.pagination.limit, 20);
  assert.equal(response.body.pagination.offset, 40);
  assert.equal(response.body.pagination.total, 1);
  assert.equal(response.body.pagination.hasMore, false);
  assert.equal(response.body.items[0].depois.status, 'captured');
  const countQuery = calls.find(call => call.sql.includes('COUNT(*)'));
  const listQuery = calls.find(call => call.sql.includes('SELECT id, loja_id, usuario_id'));
  assert.match(countQuery.sql, /loja_id = \$2/);
  assert.match(countQuery.sql, /entidade = \$3/);
  assert.match(listQuery.sql, /LIMIT \$5 OFFSET \$6/);
  assert.deepEqual(listQuery.params, [empresaId, lojaId, 'payment', 'status_reconciled', 20, 40]);
});


test('painel de saúde retorna contagens tenant-aware sem payloads externos', async () => {
  let count = 0;
  const response = await invoke(healthHandler(), async sql => {
    count += 1;
    if (count === 1) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (count === 2) return { rows: [{ codigo: 'reports.read' }] };
    if (sql.includes('commerce_payments')) return { rows: [{ status: 'pending', total: 2 }] };
    if (sql.includes('commerce_fulfillments')) return { rows: [{ status: 'failed', total: 1 }] };
    if (sql.includes('commerce_payment_webhooks')) return { rows: [{ status: 'processed', total: 5 }] };
    return { rows: [{ status: 'failed', total: 3 }] };
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.payments.pending, 2);
  assert.equal(response.body.fulfillments.failed, 1);
  assert.equal(response.body.webhooks.payments.processed, 5);
  assert.equal(response.body.webhooks.shipping.failed, 3);
  assert.equal('payload' in response.body, false);
});

test('parsePagination limita entradas inválidas e não aceita offset negativo', () => {
  assert.deepEqual(parsePagination({ query: { limit: '99999', offset: '-10' } }), { limit: 500, offset: 0 });
  assert.deepEqual(parsePagination({ query: { limit: 'abc', offset: 'xyz' } }), { limit: 100, offset: 0 });
  assert.deepEqual(parsePagination({ query: { limit: '25', offset: '50' } }), { limit: 25, offset: 50 });
});

test('resposta pública de pedido sanitiza fulfillment sem labelUrl ou providerData', async () => {
  let count = 0;
  const response = await invokePublicOrder(async sql => {
    count += 1;
    if (count === 1) return { rows: [{ id: '33333333-3333-4333-8333-333333333333', empresa_id: empresaId, loja_id: lojaId }] };
    assert.match(sql, /public_code/);
    return { rows: [{
      public_code: 'KC-TEST',
      status: 'shipped',
      shipping_option: { id: '03220', name: 'PAC', amount: 18.9, currency: 'BRL', providerDeliveryDays: 5, preparationDays: 2, deliveryDays: 7, deliveryRange: { min: 7, max: 7 }, deliveryNote: 'Prazo Correios mais 2 dias úteis de preparação e postagem', carrier: 'Correios', raw: { token: 'should-not-leak' } },
      fulfillments: [{ id: '44444444-4444-4444-8444-444444444444', status: 'shipped', trackingCode: 'AA123456789BR', trackingUrl: 'https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR', labelUrl: 'https://private.example/label.pdf', ocorrencias: [{ status: 'posted', description: 'Objeto postado', providerData: { token: 'should-not-leak' } }] }],
      timeline: [{ fromStatus: 'paid', toStatus: 'shipped', source: 'system', at: '2026-08-30T00:00:00.000Z', payload: { secret: 'should-not-leak' } }],
    }] };
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.shippingOption.providerDeliveryDays, 5);
  assert.equal(response.body.shippingOption.preparationDays, 2);
  assert.equal(response.body.shippingOption.deliveryDays, 7);
  assert.equal('raw' in response.body.shippingOption, false);
  assert.equal('shipping_option' in response.body, false);
  assert.equal(response.body.fulfillments[0].trackingCode, 'AA123456789BR');
  assert.equal(response.body.fulfillments[0].ocorrencias[0].description, 'Objeto postado');
  assert.equal('labelUrl' in response.body.fulfillments[0], false);
  assert.equal('providerData' in response.body.fulfillments[0].ocorrencias[0], false);
  assert.equal('payload' in response.body.timeline[0], false);
});

test('relatório de fulfillment aplica escopo de loja e retorna resumo/provedores/recentes', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('WITH scoped_orders')) return { rows: [{ orders: 3, active_orders: 2, gross_total: '199.90', awaiting_dispatch: 1, shipped: 1, delivered: 1, failed: 0 }] };
    if (sql.includes('COALESCE(q.provider')) return { rows: [{ provider: 'correios', fulfillments: 2, delivered: 1, pending: 1 }] };
    return { rows: [{ public_code: 'KC-TEST', order_status: 'shipped', fulfillment_status: 'shipped', provider: 'correios', tracking_code: 'AA123456789BR' }] };
  };
  let result;
  try {
    result = await fulfillmentReport({ empresaId, lojaId }, { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' });
  } finally {
    db.query = original;
  }
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].params, [empresaId, '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', lojaId]);
  assert.deepEqual(calls[2].params, [empresaId, '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', lojaId, 50]);
  assert.equal(result.summary.orders, 3);
  assert.equal(result.providers[0].provider, 'correios');
  assert.equal(result.recent[0].tracking_code, 'AA123456789BR');
});
