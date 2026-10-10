import test from 'node:test';
import assert from 'node:assert/strict';
import { grantPlatformAdministrator } from './commerce-platform-grants.js';

const targetId = '74000000-0000-4000-8000-000000000001';
const input = { sourceUserId: targetId, confirmGlobal: true, expiresAt: null };

test('concessão global exige transação e confirmação explícita', async () => {
  const actor = { id: 'legacy-test', role: 'admin', platformAdmin: true };
  await assert.rejects(grantPlatformAdministrator(actor, input, { database: { query() {} } }), { code: 'TRANSACTION_REQUIRED' });
  let began = false;
  const database = { transaction: async () => { began = true; } };
  await assert.rejects(grantPlatformAdministrator(actor, { ...input, confirmGlobal: false }, { database }), { code: 'GLOBAL_CONFIRMATION_REQUIRED' });
  assert.equal(began, false);
});

test('flags forjadas de operador ou conta SQL sem grant ativo não permitem DML nem lookup da fonte', async () => {
  for (const actor of [
    { id: targetId, role: 'admin', platformAdmin: true, pgOperational: true },
    { id: targetId, role: 'admin', mainAdmin: true, pgOperational: true },
    { id: targetId, role: 'admin', platformAdmin: true, pgPlatformAdmin: true, pgAccount: true },
    { id: targetId, role: 'admin' },
  ]) {
    const statements = [];
    const database = { transaction: async callback => callback({ query: async sql => { statements.push(sql); return { rows: [] }; } }) };
    await assert.rejects(grantPlatformAdministrator(actor, input, { database }), { code: 'PERMISSION_DENIED' });
    assert.equal(statements.some(sql => /\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql)), false);
    assert.equal(statements.some(sql => /FROM usuarios/i.test(sql)), false);
  }
});
