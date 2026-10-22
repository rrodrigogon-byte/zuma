import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarAuditoriaLoginLegado } from './legacy-admin-login-audit.js';

test('grava login legado no audit Commerce sem guardar senha, email ou IP no payload', async () => {
  const calls = [];
  const database = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: 1 };
    },
  };

  const result = await registrarAuditoriaLoginLegado(database, {
    empresaId: 'empresa-uuid',
    lojaId: 'loja-uuid',
    legacyUserId: 42,
    role: 'admin',
  });

  assert.deepEqual(result, { recorded: true, reason: null });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO commerce_audit_logs/);
  assert.deepEqual(calls[0].values, [
    'empresa-uuid',
    'loja-uuid',
    JSON.stringify({ legacyUserId: '42', role: 'admin', source: 'legacy_admin_login' }),
  ]);
  assert.doesNotMatch(calls[0].sql + JSON.stringify(calls[0].values), /password|senha|email|@|ip_address/i);
});

test('não tenta inserir auditoria sem empresa resolvida', async () => {
  let called = false;
  const result = await registrarAuditoriaLoginLegado({
    async query() { called = true; return { rowCount: 1 }; },
  }, { legacyUserId: 7, role: 'admin' });

  assert.deepEqual(result, { recorded: false, reason: 'missing_company' });
  assert.equal(called, false);
});

test('informa quando o Postgres não confirmou a inserção para acionar o fallback estruturado', async () => {
  const result = await registrarAuditoriaLoginLegado({
    async query() { return { rowCount: 0 }; },
  }, { empresaId: 'empresa-uuid', legacyUserId: 7, role: 'admin' });

  assert.deepEqual(result, { recorded: false, reason: null });
});
