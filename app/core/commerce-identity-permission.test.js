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
    if (sql.includes('FROM commerce_operational_invites')) return { rows: [] };
    if (sql.includes('SELECT u.id FROM usuarios u')) return { rows: [{ id: USUARIO }] };
    if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: USUARIO, empresa_id: EMPRESA, loja_id: LOJA, role_id: ROLE }] };
    if (sql.includes('commerce_role_permissions')) return { rows: [{ ok: 1 }] };
    throw new Error('consulta inesperada');
  }, () => requireCommercePermission(request(), 'reports.read'));
  assert.equal(context.empresaId, EMPRESA);
  assert.equal(context.lojaId, LOJA);
  assert.equal(context.usuarioId, USUARIO);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[3].values, [EMPRESA, 'reports.read', USUARIO, LOJA]);
});

test('nega métricas quando a role não possui reports.read', async () => {
  await withQueryReadStub(async sql => {
    if (sql.includes('FROM commerce_operational_invites')) return { rows: [] };
    if (sql.includes('SELECT u.id FROM usuarios u')) return { rows: [{ id: USUARIO }] };
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
    if (sql.includes('FROM commerce_operational_invites')) return { rows: [] };
    if (sql.includes('SELECT u.id FROM usuarios u')) return { rows: [{ id: USUARIO }] };
    if (sql.includes('FROM usuarios u')) return { rows: [] };
    if (sql.includes('commerce_role_permissions')) permissionQueryExecuted = true;
    return { rows: [] };
  }, async () => {
    await assert.rejects(
      () => requireCommercePermission(request(), 'reports.read'),
      error => error?.code === 'STORE_SCOPE_MISMATCH',
    );
  });
  assert.equal(permissionQueryExecuted, false);
});

test('mesmo e-mail de dois IDs SQL não pode escolher tenant por header legado', async () => {
  let membershipQueried = false;
  await withQueryReadStub(async sql => {
    if (sql.includes('FROM commerce_operational_invites')) return { rows: [] };
    if (sql.includes('SELECT u.id FROM usuarios u')) return { rows: [{ id: USUARIO }, { id: 'another-sql-id' }] };
    membershipQueried = true;
    throw new Error('membership não deve ser consultada para identidade ambígua');
  }, async () => {
    for (const tenant of [EMPRESA, 'another-tenant']) {
      await assert.rejects(
        () => requireCommercePermission(request({ headers: { 'x-empresa-id': tenant } }), 'reports.read'),
        error => error?.code === 'IDENTITY_AMBIGUOUS',
      );
    }
  });
  assert.equal(membershipQueried, false);
});

test('admin principal validado pelo servidor conserva membership própria diante de e-mail SQL homônimo', async () => {
  const context = await withQueryReadStub(async () => {
    throw new Error('a sessão assinada não deve buscar identidade por e-mail');
  }, () => requireCommercePermission(request({ user: { id: USUARIO, email: 'gestor.dino@example.local', mainAdmin: true } }), 'reports.read'));
  assert.equal(context.usuarioId, USUARIO);
  assert.equal(context.empresaId, EMPRESA);
});

test('sessão operacional SQL nunca pode administrar usuários nem consultar banco para users.write', async () => {
  await withQueryReadStub(async () => { throw new Error('consulta proibida'); }, async () => {
    await assert.rejects(
      () => requireCommercePermission(request({ user: { pgOperational: true, id: USUARIO, empresaId: EMPRESA } }), 'users.write'),
      error => error?.code === 'PERMISSION_DENIED',
    );
  });
});
