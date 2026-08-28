import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommerceAdminRouter, parsePagination } from './commerce-routes.js';
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
