import assert from 'node:assert/strict';
import test from 'node:test';
import { automationGraphScope } from './ai-brain-scheduler.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

test('scheduler sinaliza explicitamente a empresa/unidade Commerce ativa ao carregar o legado', () => {
  assert.deepEqual(automationGraphScope({ empresa_id: COMPANY, loja_id: STORE }), {
    legacyEmpresaId: COMPANY,
    legacyLojaId: STORE,
    empresaId: COMPANY,
    commerceLojaId: STORE,
    legacyScopeVerified: true,
  });
});

test('scheduler rejeita vínculo legado ausente ou diferente da loja do canal', () => {
  assert.equal(automationGraphScope({ empresa_id: COMPANY, loja_id: null }), null);
  assert.equal(automationGraphScope({ empresa_id: COMPANY, loja_id: STORE, legacy_empresa_id: OTHER }), null);
  assert.equal(automationGraphScope({ empresa_id: COMPANY, loja_id: STORE, legacy_loja_id: OTHER }), null);
});
