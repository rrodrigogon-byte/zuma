import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { requireCommercePermission } from './commerce-identity-bridge.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const USUARIO = '33333333-3333-4333-8333-333333333333';
const ROLE = '44444444-4444-4444-8444-444444444444';

function request(overrides = {}) {
  return {
    headers: { 'x-empresa-id': EMPRESA, 'x-loja-id': LOJA },
    user: { email: 'gestor.dino@example.local', empresaId: EMPRESA, lojaId: LOJA },
    ...overrides,
  };
}

async function withQueryReadStub(handler, callback) {
  const original = db.queryRead;
  db.queryRead = handler;
  try { return await callback(); }
  finally { db.queryRead = original; }
}

test('autoriza reports.read somente depois de validar membership da empresa e loja', async () => {
  const calls = [];
  const context = await withQueryReadStub(async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: USUARIO, empresa_id: EMPRESA, loja_id: LOJA, role_id: ROLE }] };
    if (sql.includes('commerce_role_permissions')) return { rows: [{ ok: 1 }] };
    throw new Error('consulta inesperada');
  }, () => requireCommercePermission(request(), 'reports.read'));
  assert.equal(context.empresaId, EMPRESA);
  assert.equal(context.lojaId, LOJA);
  assert.equal(context.usuarioId, USUARIO);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].values, [EMPRESA, 'reports.read', USUARIO, LOJA]);
});

test('nega métricas quando a role não possui reports.read', async () => {
  await withQueryReadStub(async sql => {
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: USUARIO, empresa_id: EMPRESA, loja_id: LOJA, role_id: ROLE }] };
    if (sql.includes('commerce_role_permissions')) return { rows: [] };
    throw new Error('consulta inesperada');
  }, async () => {
    await assert.rejects(
      () => requireCommercePermission(request(), 'reports.read'),
      error => error?.code === 'PERMISSION_DENIED' && /permissão insuficiente/.test(error.message),
    );
  });
});

test('não aceita empresa enviada no cabeçalho sem membership correspondente', async () => {
  let permissionQueryExecuted = false;
  await withQueryReadStub(async sql => {
    if (sql.includes('FROM usuarios u')) return { rows: [] };
    if (sql.includes('commerce_role_permissions')) permissionQueryExecuted = true;
    return { rows: [] };
  }, async () => {
    await assert.rejects(
      () => requireCommercePermission(request(), 'reports.read'),
      error => error?.code === 'TENANT_CONTEXT_REQUIRED',
    );
  });
  assert.equal(permissionQueryExecuted, false);
});
