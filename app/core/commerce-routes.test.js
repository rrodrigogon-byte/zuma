import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommerceAdminRouter } from './commerce-routes.js';
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

async function invoke(handler, dbQuery) {
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
