import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCommerceAdminRouter, createCommercePublicRouter, parsePagination, publicCommercePolicy, sanitizePublicOrderInput } from './commerce-routes.js';
import { fulfillmentReport } from './commerce-reports.js';
import { db } from './database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const usuarioId = '66666666-6666-4666-8666-666666666666';

test('política pública distribuída cobre pedidos, frete, mídia e leituras gerais', () => {
  assert.equal(publicCommercePolicy({ method: 'POST', path: '/orders' }).scope, 'public-order-write');
  assert.equal(publicCommercePolicy({ method: 'GET', path: '/orders/KC-TEST' }).limit, 120);
  assert.equal(publicCommercePolicy({ method: 'POST', path: '/shipping/quotes/available' }).scope, 'public-shipping-quote');
  assert.equal(publicCommercePolicy({ method: 'GET', path: '/media/abc' }).limit, 600);
  assert.equal(publicCommercePolicy({ method: 'GET', path: '/products' }).scope, 'public-general-read');
});

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

function mediaUploadHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/catalog/products/:id/media/upload');
  const handler = layer?.route?.stack?.at(-1)?.handle;
  assert.ok(handler, 'rota de upload de mídia não encontrada');
  return handler;
}

function publicOrderHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de pedido não encontrada');
  return layer.route.stack[0].handle;
}

function publicPaymentHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode/payments');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de pagamento não encontrada');
  return layer.route.stack[0].handle;
}

function publicSatisfactionLayer() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode/satisfaction');
  assert.ok(layer?.route, 'rota pública de satisfação não encontrada');
  return layer.route;
}

function cartRecoveryHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/cart-recovery');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota administrativa de carrinhos não encontrada');
  return layer.route.stack[0].handle;
}

function publicCartLayer() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/cart');
  assert.ok(layer?.route, 'rota pública de sync de carrinho não encontrada');
  return layer.route;
}

function publicShippingLayer(path) {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === path);
  assert.ok(layer?.route, `rota pública de entrega não encontrada: ${path}`);
  return layer.route;
}

function shippingMethodCreateHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/shipping/methods' && item.route.methods.post);
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota administrativa de criação de método não encontrada');
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

test('upload de mídia retorna replay idempotente tenant-scoped sem acessar o bucket', async () => {
  const original = db.query;
  const productId = '88888888-8888-4888-8888-888888888888';
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (calls.length === 2) return { rows: [{ codigo: 'catalog.write' }] };
    if (sql.includes('SELECT id FROM commerce_products')) return { rows: [{ id: productId }] };
    if (sql.includes('FROM commerce_product_media')) return { rows: [{ id: '55555555-5555-5555-8555-555555555555', product_id: productId, public_url: '/api/storefront/media/55555555-5555-5555-8555-555555555555' }] };
    return { rows: [] };
  };
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await mediaUploadHandler()({ user: { email: 'admin@example.com' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-idempotency-key': 'catalog-enrichment-test', 'content-type': 'image/png' }, params: { id: productId }, body: Buffer.from('não deve ser enviado') }, response);
  } finally {
    db.query = original;
  }
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.idempotentReplay, true);
  const existingQuery = calls.find(call => call.sql.includes('FROM commerce_product_media'));
  assert.deepEqual(existingQuery.params.slice(0, 2), [empresaId, productId]);
});

test('rota pública de carrinho possui rate limit antes do handler de sync', () => {
  const route = publicCartLayer();
  assert.equal(route.methods.post, true);
  assert.equal(route.stack.length, 2);
});

test('checkout público ignora customerId do navegador e não libera crediário sem verificação', () => {
  const source = readFileSync(new URL('./commerce-routes.js', import.meta.url), 'utf8');
  const sanitized = sanitizePublicOrderInput({ customerId: 'top-level', customer: { customerId: 'nested', nome: 'Comprador' }, note: 'preservar' });
  assert.deepEqual(sanitized, { customer: { nome: 'Comprador' }, note: 'preservar' });
  assert.match(source, /delete sanitized\.customerId/);
  assert.match(source, /delete sanitized\.customer\.customerId/);
  assert.doesNotMatch(source, /req\.query\.customerId/);
  assert.doesNotMatch(source, /req\.query\.customerEmail/);
  assert.match(source, /PAYMENT_CUSTOMER_VERIFICATION_REQUIRED/);
});

test('endpoint público recusa crediário antes de criar qualquer lançamento financeiro', async () => {
  const original = db.query;
  let count = 0;
  db.query = async () => {
    count += 1;
    if (count === 1) return { rows: [{ id: '33333333-3333-4333-8333-333333333333', empresa_id: empresaId, loja_id: lojaId }] };
    if (count === 2) return { rows: [{ id: '77777777-7777-4777-8777-777777777777' }] };
    throw new Error('o bloqueio deve ocorrer antes de qualquer operação financeira');
  };
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await publicPaymentHandler()({ hostname: 'loja.kytto.com.br', headers: {}, params: { publicCode: 'KC-TEST' }, body: { provider: 'crediario', method: 'account', idempotencyKey: 'safe-test' } }, response);
  } finally {
    db.query = original;
  }
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'PAYMENT_CUSTOMER_VERIFICATION_REQUIRED');
  assert.equal(count, 2);
});

test('pesquisa pública aplica dois rate limits compartilhados antes do handler idempotente', () => {
  const route = publicSatisfactionLayer();
  assert.equal(route.methods.post, true);
  assert.equal(route.stack.length, 3);
  assert.match(String(route.stack[0].handle), /consumePublicRateLimit/);
  assert.match(String(route.stack[1].handle), /consumePublicRateLimit/);
});

test('CEP e cotação agregada possuem rate limit antes dos handlers públicos', () => {
  const address = publicShippingLayer('/shipping/address/:cep');
  const available = publicShippingLayer('/shipping/quotes/available');
  assert.equal(address.methods.get, true);
  assert.equal(available.methods.post, true);
  assert.equal(address.stack.length, 2);
  assert.equal(available.stack.length, 2);
});

test('cadastro de método de entrega rejeita sessão sem membership', async () => {
  const response = await invoke(shippingMethodCreateHandler(), async () => ({ rows: [] }));
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'TENANT_CONTEXT_REQUIRED');
});

test('visão administrativa de carrinhos rejeita sessão sem membership', async () => {
  const response = await invoke(cartRecoveryHandler(), async () => ({ rows: [] }));
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'TENANT_CONTEXT_REQUIRED');
});

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
    assert.match(sql, /s\.retencao_ate > CURRENT_TIMESTAMP/);
    return { rows: [{
      id: '77777777-7777-4777-8777-777777777777', empresa_id: empresaId, internal_secret: 'não deve vazar',
      public_code: 'KC-TEST',
      status: 'delivered',
      satisfaction: { submitted: true, submittedAt: '2026-08-31T00:00:00.000Z', comment: 'não deve vazar' },
      shipping_option: { id: '03220', name: 'PAC', amount: 21.17, currency: 'BRL', providerAmount: 18.9, surchargeRate: 0.12, surchargeAmount: 2.27, priceNote: 'Tarifa oficial dos Correios + 12% de operação logística', priceBreakdown: { providerAmount: 18.9, surchargeAmount: 2.27, totalAmount: 21.17 }, providerDeliveryDays: 5, preparationDays: 2, deliveryDays: 7, deliveryRange: { min: 7, max: 7 }, deliveryNote: 'Prazo Correios mais 2 dias úteis de preparação e postagem', carrier: 'Correios', raw: { token: 'should-not-leak' } },
      fulfillments: [{ id: '44444444-4444-4444-8444-444444444444', status: 'shipped', trackingCode: 'AA123456789BR', trackingUrl: 'https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR', labelUrl: 'https://private.example/label.pdf', ocorrencias: [{ status: 'posted', description: 'Objeto postado', providerData: { token: 'should-not-leak' } }] }],
      timeline: [{ fromStatus: 'paid', toStatus: 'shipped', source: 'system', at: '2026-08-30T00:00:00.000Z', payload: { secret: 'should-not-leak' } }],
    }] };
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.shippingOption.amount, 21.17);
  assert.equal(response.body.shippingOption.providerAmount, 18.9);
  assert.equal(response.body.shippingOption.surchargeRate, 0.12);
  assert.equal(response.body.shippingOption.surchargeAmount, 2.27);
  assert.deepEqual(response.body.shippingOption.priceBreakdown, { providerAmount: 18.9, surchargeAmount: 2.27, totalAmount: 21.17 });
  assert.equal(response.body.shippingOption.providerDeliveryDays, 5);
  assert.equal(response.body.shippingOption.preparationDays, 2);
  assert.equal(response.body.shippingOption.deliveryDays, 7);
  assert.equal('raw' in response.body.shippingOption, false);
  assert.equal('shipping_option' in response.body, false);
  assert.equal('id' in response.body, false);
  assert.equal('empresa_id' in response.body, false);
  assert.equal('internal_secret' in response.body, false);
  assert.equal(response.body.fulfillments[0].trackingCode, 'AA123456789BR');
  assert.equal('id' in response.body.fulfillments[0], false);
  assert.equal(response.body.fulfillments[0].ocorrencias[0].description, 'Objeto postado');
  assert.equal('labelUrl' in response.body.fulfillments[0], false);
  assert.equal('providerData' in response.body.fulfillments[0].ocorrencias[0], false);
  assert.equal('payload' in response.body.timeline[0], false);
  assert.equal(response.body.satisfactionEligible, true);
  assert.deepEqual(response.body.satisfaction, { submitted: true, submittedAt: '2026-08-31T00:00:00.000Z' });
  assert.equal('comment' in response.body.satisfaction, false);
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
