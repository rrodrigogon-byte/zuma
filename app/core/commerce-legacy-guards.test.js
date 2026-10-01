import assert from 'node:assert/strict';
import test from 'node:test';
import { compareLegacyAndCoreInventory, createDestructiveAdminGuard, createLegacyCommerceMutationGuard, createLegacyPaymentMutationGuard } from './commerce-legacy-guards.js';

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function invoke(guard) {
  const res = response();
  let nextCalled = false;
  guard({ method: 'POST', path: '/test', requestId: 'request-test' }, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('guard destrutivo bloqueia toda mutação em produção sem flag de bypass', () => {
  const { res, nextCalled } = invoke(createDestructiveAdminGuard({ NODE_ENV: 'production' }));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'DESTRUCTIVE_OPERATION_DISABLED_IN_PRODUCTION');
});

test('guard destrutivo permite ambiente não produtivo', () => {
  const { res, nextCalled } = invoke(createDestructiveAdminGuard({ NODE_ENV: 'test' }));
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('guard financeiro legado bloqueia quando o Commerce Core está ativo', () => {
  const { res, nextCalled } = invoke(createLegacyPaymentMutationGuard({ COMMERCE_CORE_ENABLED: '1' }));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.code, 'LEGACY_PAYMENT_MUTATION_DISABLED');
  assert.equal(res.body.replacement, '/api/storefront/orders/:publicCode/payments');
});

test('guard financeiro legado preserva fallback somente quando o Core está desligado', () => {
  const { nextCalled } = invoke(createLegacyPaymentMutationGuard({ COMMERCE_CORE_ENABLED: '0' }));
  assert.equal(nextCalled, true);
});

test('guard Commerce legado bloqueia fail-closed sem executar o writer', () => {
  let mutations = 0;
  const res = response();
  createLegacyCommerceMutationGuard({ COMMERCE_CORE_ENABLED: '1' })(
    { method: 'PATCH', path: '/api/admin/loja/1', requestId: 'request-test' },
    res,
    () => { mutations += 1; },
  );
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.code, 'LEGACY_COMMERCE_MUTATION_DISABLED');
  assert.equal(mutations, 0);
});

for (const value of ['0', '', undefined, 'UNKNOWN']) {
  test(`guard Commerce legado preserva runtime não ativo (${String(value)})`, () => {
    const { nextCalled } = invoke(createLegacyCommerceMutationGuard({ COMMERCE_CORE_ENABLED: value }));
    assert.equal(nextCalled, true);
  });
}

test('comparação read-only identifica alinhado, divergente e não mapeado sem mutar entradas', () => {
  const legacyProducts = [
    { id: 1, cod: 'SKU-1', nome: 'Produto 1', estoque: 5 },
    { id: 2, cod: 'SKU-2', nome: 'Produto 2', estoque: 7 },
    { id: 3, cod: 'SKU-3', nome: 'Produto 3', estoque: 2 },
  ];
  const coreMappings = [
    { legacy_key: '1', product_name: 'Produto 1', core_available: 5 },
    { legacy_key: '2', product_name: 'Produto 2', core_available: 4 },
    { legacy_key: 'legacy-only', product_name: 'Sem legado atual', core_available: 8 },
  ];
  const snapshot = JSON.stringify({ legacyProducts, coreMappings });
  const result = compareLegacyAndCoreInventory({ legacyProducts, coreMappings });
  assert.deepEqual(result.summary, { legacyProducts: 3, mapped: 2, unmapped: 1, divergent: 1, legacyMissing: 1 });
  assert.equal(result.sourceOfTruth, 'commerce-core-postgresql');
  assert.equal(result.items.find(item => item.legacyKey === '2').delta, 3);
  assert.equal(result.items.find(item => item.legacyKey === 'SKU-3').status, 'unmapped');
  assert.equal(JSON.stringify({ legacyProducts, coreMappings }), snapshot);
});
