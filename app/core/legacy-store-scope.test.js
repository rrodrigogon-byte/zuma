import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesLegacyStoreScope } from './legacy-store-scope.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';

const scope = (overrides = {}) => ({
  legacyEmpresaId: COMPANY,
  legacyLojaId: STORE,
  empresaId: COMPANY,
  commerceLojaId: STORE,
  ...overrides,
});

test('aceita somente vínculo exato e UUID válido de empresa e loja', () => {
  assert.equal(matchesLegacyStoreScope(scope()), true);
  assert.equal(matchesLegacyStoreScope(scope({ legacyEmpresaId: '33333333-3333-4333-8333-333333333333' })), false);
  assert.equal(matchesLegacyStoreScope(scope({ legacyLojaId: '33333333-3333-4333-8333-333333333333' })), false);
  assert.equal(matchesLegacyStoreScope(scope({ commerceLojaId: '' })), false);
  assert.equal(matchesLegacyStoreScope(scope({ empresaId: '' })), false);
  assert.equal(matchesLegacyStoreScope(scope({ legacyLojaId: 'store-dino-01', commerceLojaId: 'store-dino-01' })), false);
});
