import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCommerceAdminRouter, createCommercePublicRouter, createCommerceWebhookRouter, parsePagination, publicCommercePolicy, sanitizePublicOrderInput } from './commerce-routes.js';
import { fulfillmentReport } from './commerce-reports.js';
import { paymentProviders } from './payment-adapters.js';
import { db } from './database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const storefrontId = '33333333-3333-4333-8333-333333333333';
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
function mediaPreviewHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/catalog/media/:id');
  const handler = layer?.route?.stack?.at(-1)?.handle;
  assert.ok(handler, 'rota de prévia administrativa de mídia não encontrada');
  return handler;
}
test('prévia administrativa de mídia é protegida por rota própria', () => {
  assert.equal(typeof mediaPreviewHandler(), 'function');
});
function catalogProductsHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/catalog/products' && item.route.methods.get);
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de listagem de produtos não encontrada');
  return layer.route.stack[0].handle;
}
function publicOrderHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de pedido não encontrada');
  return layer.route.stack[0].handle;
}

function publicOrderCreateHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders' && item.route.methods.post);
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de criação de pedido não encontrada');
  return layer.route.stack[0].handle;
}

function publicContextHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/context');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de contexto não encontrada');
  return layer.route.stack[0].handle;
}

function publicPaymentHandler() {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === '/orders/:publicCode/payments');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota pública de pagamento não encontrada');
  return layer.route.stack[0].handle;
}

function paymentWebhookHandler() {
  const router = createCommerceWebhookRouter();
  const layer = router.stack.find(item => item.route?.path === '/:provider/payments');
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota de webhook financeiro não encontrada');
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

function shippingLabelReconcileHandler() {
  const router = createCommerceAdminRouter();
  const layer = router.stack.find(item => item.route?.path === '/fulfillments/:id/reconcile-label' && item.route.methods.post);
  assert.ok(layer?.route?.stack?.[0]?.handle, 'rota administrativa de reconciliação de etiqueta não encontrada');
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
      headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId },
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

function publicResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invokePublicOrderCreate({ body = {}, headers = {}, transaction } = {}) {
  const original = db.transaction;
  db.transaction = transaction || original;
  const response = publicResponse();
  try {
    await publicOrderCreateHandler()({
      publicResolvedStorefront: { id: '33333333-3333-4333-8333-333333333333', empresa_id: empresaId, loja_id: lojaId, status: 'active', moeda: 'BRL' },
      headers,
      body,
      requestId: 'route-test',
    }, response);
    return response;
  } finally {
    db.transaction = original;
  }
}

test('catálogo com empresa, loja, storefront e local não envia parâmetro solto ao COUNT', async () => {
  const locationId = '44444444-4444-4444-8444-444444444444';
  const calls = [];
  const response = await invoke(catalogProductsHandler(), async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
    if (sql.includes('FROM commerce_inventory_locations')) return { rows: [{ id: locationId }] };
    if (sql.includes('COUNT(*)::int AS total FROM commerce_products')) return { rows: [{ total: 0 }] };
    if (sql.includes('FROM commerce_products p')) return { rows: [] };
    throw new Error('consulta inesperada no GET de catálogo');
  }, { locationId, limit: '20', offset: '10' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.pagination, { limit: 20, offset: 10, total: 0, hasMore: false });
  const count = calls.find(call => call.sql.includes('COUNT(*)::int AS total FROM commerce_products'));
  const list = calls.find(call => call.sql.includes('SELECT p.id, p.slug'));
  assert.ok(count && list);
  assert.deepEqual(count.params, [empresaId, lojaId, storefrontId]);
  assert.match(list.sql, /il.location_id = \$4/);
  assert.match(list.sql, /LIMIT \$5 OFFSET \$6/);
  assert.deepEqual(list.params, [empresaId, lojaId, storefrontId, locationId, 20, 10]);
  assert.equal(calls.some(call => /\b(INSERT|UPDATE|DELETE)\b/i.test(call.sql)), false);
});

test('catálogo rejeita local de outra loja antes de consultar produtos', async () => {
  const calls = [];
  const response = await invoke(catalogProductsHandler(), async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
    if (sql.includes('FROM commerce_inventory_locations')) return { rows: [] };
    throw new Error('consulta indevida após rejeição de local');
  }, { locationId: '44444444-4444-4444-8444-444444444444' });
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'INVENTORY_LOCATION_SCOPE_MISMATCH');
  assert.equal(calls.some(call => call.sql.includes('FROM commerce_products p')), false);
  assert.equal(calls.some(call => /\b(INSERT|UPDATE|DELETE)\b/i.test(call.sql)), false);
});

test('upload de mídia retorna replay idempotente tenant-scoped sem acessar o bucket', async () => {
  const original = db.query;
  const originalTransaction = db.transaction;
  const productId = '88888888-8888-4888-8888-888888888888';
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('FROM commerce_products p')) return { rows: [{ id: productId, status: 'active' }] };
    return { rows: [] };
  };
  db.transaction = async callback => callback({ query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM commerce_product_media')) return { rows: [{ id: '55555555-5555-5555-8555-555555555555', product_id: productId, public_url: '/api/storefront/media/55555555-5555-5555-8555-555555555555' }] };
    throw new Error(`query inesperada: ${sql}`);
  } });
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await mediaUploadHandler()({ user: { email: 'admin@example.com' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId, 'x-idempotency-key': 'catalog-enrichment-test', 'content-type': 'image/png' }, params: { id: productId }, body: Buffer.from('não deve ser enviado') }, response);
  } finally {
    db.query = original;
    db.transaction = originalTransaction;
  }
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.idempotentReplay, true);
  const existingQuery = calls.find(call => call.sql.includes('FROM commerce_product_media'));
  assert.deepEqual(existingQuery.params.slice(0, 2), [empresaId, productId]);
});

test('dois uploads concorrentes com a mesma chave produzem uma mídia e preservam o blob vencedor', async () => {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const originalMediaDir = process.env.COMMERCE_MEDIA_DIR;
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), 'commerce-media-race-'));
  const productId = '88888888-8888-4888-8888-888888888888';
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  let mediaRow = null;
  let mediaInserts = 0;
  let queue = Promise.resolve();
  process.env.COMMERCE_MEDIA_DIR = mediaRoot;
  db.query = async sql => {
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('FROM commerce_products p')) return { rows: [{ id: productId, status: 'active' }] };
    return { rows: [] };
  };
  db.transaction = async callback => {
    let release;
    const predecessor = queue;
    queue = new Promise(resolve => { release = resolve; });
    await predecessor;
    try {
      return await callback({ query: async (sql, values = []) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('FROM commerce_product_media') && sql.includes('id = $3')) return { rows: mediaRow ? [mediaRow] : [] };
        if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, status: 'active' }] };
        if (sql.includes('EXISTS (') && sql.includes('authorized_channel')) return { rows: [{ id: productId, status: 'active', authorized_channel: true, outside_selected_channel: false }] };
        if (sql.includes('SELECT id, status FROM commerce_products')) return { rows: [{ id: productId, status: 'active' }] };
        if (sql.includes('INSERT INTO commerce_product_media')) {
          mediaInserts += 1;
          mediaRow = { id: values[0], product_id: values[2], variant_id: values[3], storage_key: values[4], public_url: values[5], mime_type: values[6], alt_text: values[7], ordem: values[8] };
          return { rows: [mediaRow] };
        }
        if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
        throw new Error(`query inesperada: ${sql}`);
      } });
    } finally { release(); }
  };
  const invokeUpload = async () => {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await mediaUploadHandler()({ user: { email: 'admin@example.com' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId, 'x-idempotency-key': 'catalog-media-race', 'content-type': 'image/png' }, params: { id: productId }, body: png }, response);
    return response;
  };
  try {
    const [first, second] = await Promise.all([invokeUpload(), invokeUpload()]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.body.id, second.body.id);
    assert.equal(mediaInserts, 1);
    const relative = mediaRow.storage_key.replace(/^commerce-local\//, '');
    const stored = await stat(path.join(mediaRoot, relative));
    assert.ok(stored.size > 0);
  } finally {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (originalMediaDir === undefined) delete process.env.COMMERCE_MEDIA_DIR;
    else process.env.COMMERCE_MEDIA_DIR = originalMediaDir;
    await rm(mediaRoot, { recursive: true, force: true });
  }
});

test('cleanup de upload falho aguarda o concorrente e não apaga blob que ganhou referência', async () => {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const originalMediaDir = process.env.COMMERCE_MEDIA_DIR;
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), 'commerce-media-cleanup-race-'));
  const productId = '88888888-8888-4888-8888-888888888888';
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  let mediaRow = null;
  let mediaInsertAttempts = 0;
  let transactionCalls = 0;
  let cleanupChecks = 0;
  let queue = Promise.resolve();
  process.env.COMMERCE_MEDIA_DIR = mediaRoot;
  db.query = async sql => {
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('FROM commerce_products p')) return { rows: [{ id: productId, status: 'active' }] };
    return { rows: [] };
  };
  db.transaction = async callback => {
    transactionCalls += 1;
    let release;
    const predecessor = queue;
    queue = new Promise(resolve => { release = resolve; });
    await predecessor;
    try {
      return await callback({ query: async (sql, values = []) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('SELECT 1 FROM commerce_product_media')) { cleanupChecks += 1; return { rows: mediaRow ? [{ '?column?': 1 }] : [] }; }
        if (sql.includes('FROM commerce_product_media') && sql.includes('id = $3')) return { rows: mediaRow ? [mediaRow] : [] };
        if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, status: 'active' }] };
        if (sql.includes('EXISTS (') && sql.includes('authorized_channel')) return { rows: [{ id: productId, status: 'active', authorized_channel: true, outside_selected_channel: false }] };
        if (sql.includes('SELECT id, status FROM commerce_products')) return { rows: [{ id: productId, status: 'active' }] };
        if (sql.includes('INSERT INTO commerce_product_media')) {
          mediaInsertAttempts += 1;
          if (mediaInsertAttempts === 1) throw new Error('falha simulada depois do upload');
          mediaRow = { id: values[0], product_id: values[2], variant_id: values[3], storage_key: values[4], public_url: values[5], mime_type: values[6], alt_text: values[7], ordem: values[8] };
          return { rows: [mediaRow] };
        }
        if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
        throw new Error(`query inesperada: ${sql}`);
      } });
    } finally { release(); }
  };
  const invokeUpload = async () => {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await mediaUploadHandler()({ user: { email: 'admin@example.com' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId, 'x-idempotency-key': 'catalog-media-cleanup-race', 'content-type': 'image/png' }, params: { id: productId }, body: png }, response);
    return response;
  };
  try {
    const [first, second] = await Promise.all([invokeUpload(), invokeUpload()]);
    assert.equal([first.statusCode, second.statusCode].includes(201), true);
    assert.equal(mediaInsertAttempts, 2);
    assert.equal(transactionCalls, 3);
    assert.equal(cleanupChecks, 1);
    const relative = mediaRow.storage_key.replace(/^commerce-local\//, '');
    const stored = await stat(path.join(mediaRoot, relative));
    assert.ok(stored.size > 0);
  } finally {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (originalMediaDir === undefined) delete process.env.COMMERCE_MEDIA_DIR;
    else process.env.COMMERCE_MEDIA_DIR = originalMediaDir;
    await rm(mediaRoot, { recursive: true, force: true });
  }
});

test('upload de mídia rejeita produto arquivado antes de acessar mídia ou bucket', async () => {
  const original = db.query;
  const productId = '88888888-8888-4888-8888-888888888888';
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('FROM commerce_products p')) return { rows: [{ id: productId, status: 'archived' }] };
    return { rows: [] };
  };
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await mediaUploadHandler()({ user: { email: 'admin@example.com' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId, 'x-idempotency-key': 'catalog-archived-test', 'content-type': 'image/png' }, params: { id: productId }, body: Buffer.from('não deve ser enviado') }, response);
  } finally {
    db.query = original;
  }
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'PRODUCT_ARCHIVED');
  assert.equal(calls.some(call => call.sql.includes('commerce_product_media')), false);
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

test('retorno público InfinitePay não persiste identificadores antes da verificação autoritativa', () => {
  const source = readFileSync(new URL('./commerce-routes.js', import.meta.url), 'utf8');
  const handler = source.split("router.post('/orders/:publicCode/payments/return'")[1].split("router.post('/orders'")[0];
  assert.match(handler, /reconcilePaymentByIdentifiers/);
  assert.match(handler, /source: 'public_return'/);
  assert.match(handler, /p\.provider_payment_id = \$3/);
  assert.match(handler, /p\.provider_payment_id IS NULL AND p\.metadata->'checkout'->>'slug' = \$4/);
  assert.doesNotMatch(handler, /ORDER BY p\.criado_em DESC LIMIT 1/);
  assert.doesNotMatch(handler, /UPDATE commerce_payments/);
});

test('webhook financeiro registra captura tardia como refund_required sem reabrir pedido cancelado', () => {
  const source = readFileSync(new URL('./commerce-routes.js', import.meta.url), 'utf8');
  assert.match(source, /captureNeedsRefund\(current\.status, current\.order_status, nextPaymentStatus, \{ otherCaptured:[\s\S]*recordLatePaymentCapture/);
  assert.match(source, /refundRequired: Boolean\(lateCapture\?\.refundRequired\)/);
});

test('webhook InfinitePay prioriza provider_payment_id e só usa pedido+slug para tentativa ainda não vinculada', () => {
  const source = readFileSync(new URL('./commerce-routes.js', import.meta.url), 'utf8');
  const handler = source.split("router.post('/:provider/payments'")[1].split('return router;')[0];
  assert.match(handler, /p\.provider_payment_id = \$2/);
  assert.match(handler, /p\.provider_payment_id IS NULL/);
  assert.match(handler, /\(o\.public_code = \$1 OR o\.id::text = \$1\)/);
  assert.match(handler, /p\.metadata->'checkout'->>'slug' = \$2/);
  assert.match(handler, /p\.id = \$3/);
  assert.doesNotMatch(handler, /o\.public_code = \$3\s+OR/);
});

test('webhook autoritativo registra captura tardia apesar de pagamento terminal', async t => {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  paymentProviders.register('testgateway', {
    createCheckout: async () => ({}),
    verifyWebhook: async ({ payload }) => ({ eventId: `evt-${payload.currentStatus}`, providerPaymentId: 'tx-late-webhook', status: 'captured', amount: 10, summary: {} }),
  });
  try {
    for (const { paymentStatus, orderStatus } of [
      { paymentStatus: 'cancelled', orderStatus: 'cancelled' },
      { paymentStatus: 'failed', orderStatus: 'cancelled' },
      { paymentStatus: 'refunded', orderStatus: 'cancelled' },
      { paymentStatus: 'pending', orderStatus: 'draft' },
      { paymentStatus: 'failed', orderStatus: 'payment_failed' },
    ]) {
      await t.test(`${paymentStatus}/${orderStatus}`, async () => {
        const calls = [];
        db.query = async () => ({ rows: [{ payment_id: '55555555-5555-4555-8555-555555555562', empresa_id: empresaId, payment_account_id: '44444444-4444-4444-8444-444444444444', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] });
        db.transaction = async callback => callback({ query: async (sql, values = []) => {
          calls.push({ sql, values });
          if (sql.includes('INSERT INTO commerce_payment_webhooks')) return { rows: [{ id: '99999999-9999-4999-8999-999999999999' }] };
          if (sql.includes('SELECT p.id, p.order_id, p.method')) return { rows: [{ id: '55555555-5555-4555-8555-555555555562', order_id: '55555555-5555-4555-8555-555555555555', method: 'pix', amount: '10.00', status: paymentStatus, provider_payment_id: 'tx-late-webhook', order_status: orderStatus }] };
          if (sql.includes("'{lateCapture}'")) return { rows: [{ id: '55555555-5555-4555-8555-555555555562' }] };
          return { rows: [] };
        } });
        const response = publicResponse();
        await paymentWebhookHandler()({ params: { provider: 'testgateway' }, query: {}, headers: {}, body: { transactionNsu: 'tx-late-webhook', currentStatus: paymentStatus }, rawBody: Buffer.from('{}') }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.status, 'captured');
        assert.equal(response.body.refundRequired, true);
        assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_payments') && call.values[2] === 'captured'));
        assert.ok(calls.some(call => call.sql.includes("'late_capture_review'")));
      });
    }
  } finally {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    paymentProviders.adapters.delete('testgateway');
  }
});

test('rota pública exige chave de idempotência antes de abrir transação', async () => {
  let transactions = 0;
  const response = await invokePublicOrderCreate({
    body: { items: [{ variantId: '77777777-7777-4777-8777-777777777777', quantity: 1 }], customer: { nome: 'Cliente' } },
    transaction: async () => { transactions += 1; throw new Error('não deveria abrir transação'); },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'ORDER_IDEMPOTENCY_REQUIRED');
  assert.equal(transactions, 0);
});

test('checkout com contato conflitante retorna 409 sem PII, pedido ou pagamento', async () => {
  const originalWarn = console.warn;
  const logs = [];
  let attempts = 0;
  console.warn = (...args) => logs.push(args);
  try {
    const response = await invokePublicOrderCreate({
      body: { items: [{ variantId: '77777777-7777-4777-8777-777777777777', quantity: 1 }], customer: { nome: 'Teste', email: 'private@example.invalid', telefone: '11999999999' }, shippingAddress: { modo: 'retirada' } },
      headers: { 'idempotency-key': 'contact-conflict-test' },
      transaction: async () => {
        attempts += 1;
        throw { code: 'CONTACT_CONFLICT', details: { reason: 'customer_phone_mismatch', email: 'private@example.invalid', telefone: '11999999999' } };
      },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, 'CHECKOUT_CONTACT_REVIEW');
    assert.equal(attempts, 1);
    assert.ok(logs.some(args => args[0] === 'commerce_checkout_contact_review' && JSON.parse(args[1]).reason === 'customer_phone_mismatch'));
    assert.doesNotMatch(JSON.stringify({ response: response.body, logs }), /private@example\.invalid|11999999999/);
    assert.equal('details' in response.body, false);
  } finally { console.warn = originalWarn; }
});

test('conflito após INSERT da chave idempotente cria pedido convidado sem gravar ou mesclar cliente', async () => {
  const originalWarn = console.warn;
  let attemptedKeyInsert = 0;
  let rollbacks = 0;
  let committed = 0;
  const dml = [];
  let orderInsertValues = null;
  console.warn = () => {};
  try {
    const response = await invokePublicOrderCreate({
      body: { items: [{ variantId: '77777777-7777-4777-8777-777777777777', quantity: 1 }], customer: { nome: 'Teste', email: 'test@example.invalid', telefone: '11999999999' }, shippingAddress: { modo: 'retirada' } },
      headers: { 'idempotency-key': 'contact-conflict-after-insert' },
      transaction: async callback => {
        let pendingDml = [];
        try {
          const result = await callback({ query: async (sql, values = []) => {
            if (/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)) pendingDml.push(sql);
            if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, status: 'active', moeda: 'BRL' }] };
            if (sql.includes("scope = 'order.create'") && sql.includes('FROM commerce_idempotency_keys')) return { rows: [] };
            if (sql.includes('INSERT INTO commerce_idempotency_keys')) { attemptedKeyInsert += 1; return { rows: [] }; }
            if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '77777777-7777-4777-8777-777777777777', sku: 'TEST', variant_name: 'Padrão', product_name: 'Produto', product_type: 'service', price: '10.00' }] };
            if (sql.includes('FROM commerce_customers')) throw { code: 'CONTACT_CONFLICT', details: { reason: 'identifiers_resolve_to_different_customers' } };
            if (sql.includes('INSERT INTO commerce_orders')) { orderInsertValues = values; return { rows: [] }; }
            return { rows: [] };
          } });
          dml.push(...pendingDml);
          committed += 1;
          return result;
        } catch (error) {
          pendingDml = [];
          rollbacks += 1;
          throw error;
        }
      },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.status, 'pending_payment');
    assert.equal('customerId' in response.body, false);
    assert.equal(attemptedKeyInsert, 1);
    assert.equal(rollbacks, 0);
    assert.equal(committed, 1);
    assert.ok(dml.some(sql => sql.includes('INSERT INTO commerce_orders')));
    assert.ok(orderInsertValues);
    assert.equal(orderInsertValues[4], null);
    assert.match(orderInsertValues[5], /"email":"test@example\.invalid"/);
  } finally { console.warn = originalWarn; }
});

test('rota pública devolve exatamente a resposta persistida no replay e rejeita payload diferente', async () => {
  const customerId = '99999999-9999-4999-8999-999999999999';
  let storedHash = null;
  let storedResponse = null;
  let orderInserts = 0;
  const transaction = async callback => callback({ query: async (sql, values = []) => {
    if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333', empresa_id: empresaId, loja_id: lojaId, status: 'active', moeda: 'BRL' }] };
    if (sql.includes("scope = 'order.create'") && sql.includes('FROM commerce_idempotency_keys')) return { rows: storedHash ? [{ request_hash: storedHash, response_body: storedResponse }] : [] };
    if (sql.includes("VALUES ($1, 'order.create'")) { storedHash = values[2]; return { rows: [] }; }
    if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '77777777-7777-4777-8777-777777777777', sku: 'SERV-1', variant_name: 'Padrão', product_name: 'Serviço', product_type: 'service', price: '15.00', promotional: false }] };
    if (sql.includes('FROM commerce_customers')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_customers')) return { rows: [{ id: customerId, nome: 'Cliente público' }] };
    if (sql.includes('INSERT INTO commerce_orders')) { orderInserts += 1; return { rows: [] }; }
    if (sql.includes("scope = 'order.create'") && sql.includes('UPDATE commerce_idempotency_keys')) { storedResponse = JSON.parse(values[2]); return { rows: [] }; }
    return { rows: [], rowCount: 1 };
  } });
  const body = { items: [{ variantId: '77777777-7777-4777-8777-777777777777', quantity: 1 }], customer: { nome: 'Cliente público' }, shippingAddress: { modo: 'retirada' } };
  const first = await invokePublicOrderCreate({ body, headers: { 'idempotency-key': 'route-replay-001' }, transaction });
  const replay = await invokePublicOrderCreate({ body: { shippingAddress: { modo: 'retirada' }, customer: { nome: 'Cliente público' }, items: [{ quantity: 1, variantId: '77777777-7777-4777-8777-777777777777' }] }, headers: { 'x-idempotency-key': 'route-replay-001' }, transaction });
  assert.equal(first.statusCode, 201);
  assert.deepEqual(replay.body, first.body);
  assert.deepEqual(storedResponse, first.body);
  assert.equal('customerId' in first.body, false);
  assert.equal('customerAddressId' in first.body, false);
  assert.equal(orderInserts, 1);

  const conflict = await invokePublicOrderCreate({ body: { ...body, items: [{ variantId: '77777777-7777-4777-8777-777777777777', quantity: 2 }] }, headers: { 'idempotency-key': 'route-replay-001' }, transaction });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(orderInserts, 1);
});

test('storefront público ativo sem loja operacional é recusado antes de consultar capacidades', async () => {
  const originalQuery = db.query;
  let queries = 0;
  db.query = async () => { queries += 1; return { rows: [] }; };
  const response = publicResponse();
  try {
    await publicContextHandler()({ publicResolvedStorefront: { id: '33333333-3333-4333-8333-333333333333', empresa_id: empresaId, loja_id: null, status: 'active' }, headers: {} }, response);
  } finally {
    db.query = originalQuery;
  }
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
  assert.equal(queries, 0);
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

test('reconciliação de etiqueta rejeita sessão sem membership antes de qualquer mutação', async () => {
  const response = await invoke(shippingLabelReconcileHandler(), async () => ({ rows: [] }));
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
  const response = await invoke(providerHandler(), async sql => {
    count += 1;
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    return { rows: [] };
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
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
    return { rows: [{ id: '77777777-7777-4777-8777-777777777777', loja_id: lojaId, entidade: 'payment', acao: 'status_reconciled', depois: { status: 'captured' } }] };
  }, { limit: '20', offset: '40', entity: 'payment', action: 'status_reconciled' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.pagination.limit, 20);
  assert.equal(response.body.pagination.offset, 40);
  assert.equal(response.body.pagination.total, 1);
  assert.equal(response.body.pagination.hasMore, false);
  assert.equal(response.body.items[0].depois.status, 'captured');
  const countQuery = calls.find(call => call.sql.includes('COUNT(*)') && call.sql.includes('FROM commerce_audit_logs'));
  const listQuery = calls.find(call => call.sql.includes('SELECT id, loja_id, usuario_id') && call.sql.includes('FROM commerce_audit_logs'));
  assert.match(countQuery.sql, /loja_id = \$2/);
  assert.match(countQuery.sql, /entidade = \$3/);
  assert.match(listQuery.sql, /LIMIT \$5 OFFSET \$6/);
  assert.deepEqual(listQuery.params, [empresaId, lojaId, 'payment', 'status_reconciled', 20, 40]);
});


test('painel de saúde retorna contagens tenant-aware sem payloads externos', async () => {
  let count = 0;
  const response = await invoke(healthHandler(), async sql => {
    count += 1;
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: usuarioId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
    if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
    if (sql.includes('commerce_payments')) return { rows: [{ status: 'pending', total: 2 }] };
    if (sql.includes('commerce_fulfillments')) return { rows: [{ status: 'failed', total: 1 }] };
    return { rows: [] };
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.payments.pending, 2);
  assert.equal(response.body.fulfillments.failed, 1);
  assert.deepEqual(response.body.webhooks, { available: false, reason: 'storefront_correlation_unavailable' });
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
