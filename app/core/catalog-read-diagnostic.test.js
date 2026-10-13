import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommonCatalogRead, compareScopedCatalog, moneyToCents, readScopedCatalogDiagnostic } from './catalog-read-diagnostic.js';

const TENANT = 'tenant-a';
const STORE = 'store-a';
const STOREFRONT = '10000000-0000-4000-8000-000000000001';
const scope = { empresaId: TENANT, lojaId: STORE, storefrontId: STOREFRONT };
const source = (item) => [{ name: 'legacy', items: [{ empresaId: TENANT, lojaId: STORE, ...item }] }];
const core = (row = {}) => [{ empresa_id: TENANT, loja_id: STORE, legacy_key: row.legacy_key || 'legacy-1', variant_id: row.variant_id || 'variant-1', sku: row.sku || 'SKU-1', core_unit: row.core_unit ?? 'un', core_product_status: row.core_product_status ?? 'active', core_variant_active: row.core_variant_active ?? true, core_published: row.core_published ?? true, core_price: row.core_price ?? '10.50', core_available: row.core_available ?? 2, ...row }];
const compare = (item, rows = core()) => compareScopedCatalog({ sources: source(item), coreRows: rows, scope });
const commonCore = (row = {}) => core({ core_storefront_id: STOREFRONT, ...row });

function first(result) {
  const item = result.items.find(item => item.source !== 'commerce-core');
  assert.ok(item);
  return item;
}

test('moneyToCents preserva centavos sem aritmética float', () => {
  assert.equal(moneyToCents('10,50'), 1050);
  assert.equal(moneyToCents('0.05'), 5);
  assert.equal(moneyToCents(12.3), 1230);
  assert.equal(moneyToCents('1000'), 100000);
  assert.equal(moneyToCents('10.555'), null);
  assert.equal(moneyToCents('1.000,50'), null);
});

test('zero é valor comparável e ausente permanece ausente', () => {
  assert.equal(moneyToCents(0), 0);
  assert.equal(moneyToCents(''), null);
  const aligned = first(compare({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 0, estoqueAtual: 0 }, core({ core_price: 0, core_available: 0 })));
  assert.equal(aligned.status, 'aligned');
  assert.equal(aligned.price.legacyCents, 0);
  assert.equal(aligned.stock.legacyAvailable, 0);
  const missing = first(compare({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', estoqueAtual: 0 }, core({ core_price: 0, core_available: 0 })));
  assert.equal(missing.status, 'not_verified');
  assert.equal(missing.price.legacyCents, null);
  assert.ok(missing.reasons.includes('LEGACY_PRICE_MISSING'));
});

test('matching é exato e não usa nome/descrição como chave', () => {
  const result = compare({ id: 'legacy-other', nome: 'Produto 1', sku: 'SKU-OTHER', unidade: 'un', precoVenda: 10.5, estoqueAtual: 2 }, core({ legacy_key: 'legacy-1', sku: 'SKU-1' }));
  assert.equal(result.summary.unmapped, 1);
  assert.equal(first(result).status, 'unmapped');
  assert.deepEqual(first(result).reasons, ['NO_EXACT_MAPPING']);
});

test('SKU duplicado não escolhe candidato nem devolve dados core como decisão', () => {
  const result = compareScopedCatalog({
    sources: source({ id: 'legacy-1', sku: 'DUP', unidade: 'un', precoVenda: 10, estoqueAtual: 1 }),
    coreRows: [
      ...core({ legacy_key: 'legacy-1', sku: 'DUP' }),
      ...core({ legacy_key: 'legacy-2', variant_id: 'variant-2', sku: 'DUP' }),
    ],
    scope,
  });
  const item = first(result);
  assert.equal(item.status, 'ambiguous');
  assert.ok(item.reasons.includes('DUPLICATE_CORE_SKU'));
  assert.equal(item.sku, null);
  assert.equal(item.variantId, null);
  assert.equal(item.price.coreCents, null);
  assert.equal(item.stock.coreAvailable, null);
});

test('mapeamento com duas variantes é ambíguo e nunca usa matches[0]', () => {
  const result = compareScopedCatalog({
    sources: source({ id: 'legacy-variant', sku: 'SKU-V', unidade: 'un', precoVenda: 10, estoqueAtual: 1 }),
    coreRows: [
      ...core({ legacy_key: 'legacy-variant', variant_id: 'variant-a', sku: 'SKU-V', core_price: 10 }),
      ...core({ legacy_key: 'legacy-variant', variant_id: 'variant-b', sku: 'SKU-V', core_price: 99 }),
    ],
    scope,
  });
  const item = first(result);
  assert.equal(item.status, 'ambiguous');
  assert.ok(item.reasons.includes('AMBIGUOUS_MAPPING'));
  assert.equal(item.sku, null);
  assert.equal(item.variantId, null);
  assert.equal(item.price.coreCents, null);
  assert.equal(item.stock.compared, 'not-comparable');
});

test('estoque global é incomparável, mesmo quando preço e unidade são válidos', () => {
  const item = first(compare(
    { id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: '10,50', estoqueAtual: 2 },
    core({ core_price: '10.50', core_available: 2, core_stock_scope: 'global' }),
  ));
  assert.equal(item.status, 'not_verified');
  assert.ok(item.reasons.includes('GLOBAL_STOCK'));
  assert.equal(item.price.legacyCents, 1050);
  assert.equal(item.price.coreCents, 1050);
  assert.equal(item.stock.compared, 'not-comparable');
  assert.equal(item.stock.coreAvailable, null);
});

test('unidade ausente não seleciona SKU/variante e não compara preço/estoque', () => {
  const item = first(compare({ id: 'legacy-1', sku: 'SKU-1', precoVenda: 10, estoqueAtual: 2 }, core()));
  assert.equal(item.status, 'not_verified');
  assert.ok(item.reasons.includes('UNIT_NOT_COMPARABLE'));
  assert.equal(item.sku, null);
  assert.equal(item.variantId, null);
  assert.equal(item.price.compared, 'not-comparable');
  assert.equal(item.stock.compared, 'not-comparable');
});

test('empresa/unidade fora do escopo é descartada sem identificador ou contagem de item', () => {
  const result = compareScopedCatalog({
    sources: [{ name: 'legacy', items: [{ empresaId: 'tenant-secret', lojaId: 'store-secret', id: 'SECRET-SKU', sku: 'SECRET-SKU' }] }],
    coreRows: [{ empresa_id: 'tenant-secret', loja_id: 'store-secret', legacy_key: 'SECRET-SKU', variant_id: 'secret-v', sku: 'SECRET-SKU', core_available: 8 }],
    scope,
  });
  assert.equal(result.summary.sourceItems, 0);
  assert.equal(result.summary.outOfScope, 1);
  assert.equal(result.items.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /SECRET-SKU|secret-v/);
});

test('fonte sem empresa só entra pela correspondência exata autorizada do tenant', () => {
  const result = compareScopedCatalog({
    sources: [{ name: 'legacy', items: [{ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }] }],
    coreRows: core({ legacy_key: 'legacy-1', sku: 'SKU-1', core_price: 10, core_available: 2 }),
    scope,
  });
  assert.equal(result.summary.mapped, 1);
  assert.equal(first(result).status, 'not_verified');
  assert.equal(first(result).stock.compared, 'not-comparable');
});

test('helper sem tenant ou storefront falha antes de processar e não produz informação', () => {
  assert.throws(
    () => compareScopedCatalog({ sources: [{ name: 'legacy', items: [{ id: 'SECRET', sku: 'SECRET' }] }], coreRows: [], scope: { lojaId: STORE } }),
    error => error.code === 'TENANT_CONTEXT_REQUIRED',
  );
  assert.throws(
    () => compareScopedCatalog({ sources: [{ name: 'legacy', items: [{ id: 'SECRET', sku: 'SECRET' }] }], coreRows: [], scope: { empresaId: TENANT, lojaId: STORE } }),
    error => error.code === 'STOREFRONT_REQUIRED',
  );
});

test('falha explícita da fonte não vira diagnóstico vazio', () => {
  assert.throws(
    () => compareScopedCatalog({ sources: [{ name: 'legacy', error: 'read failed', items: [] }], coreRows: [], scope }),
    error => error.code === 'SOURCE_READ_FAILED',
  );
  assert.throws(
    () => compareScopedCatalog({ sources: [{ name: 'legacy', items: null }], coreRows: [], scope }),
    error => error.code === 'SOURCE_READ_FAILED',
  );
});

test('readScopedCatalogDiagnostic usa shape real com price_list_id e joins de variante/estoque, sem DML', async () => {
  const calls = [];
  const result = await readScopedCatalogDiagnostic({
    queryRead: async (sql, values) => {
      calls.push({ sql, values });
      assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE)\b/i);
      if (sql.trimStart().startsWith('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: STOREFRONT, loja_id: STORE }] };
      assert.match(sql, /commerce_product_variants/);
      assert.match(sql, /commerce_product_channels/);
      assert.match(sql, /pc\.price_list_id/);
      assert.match(sql, /commerce_variant_prices/);
      assert.match(sql, /commerce_inventory_levels/);
      assert.match(sql, /core_stock_scope/);
      return { rows: [core({ legacy_key: 'legacy-1', sku: 'SKU-1', core_unit: null })[0]] };
    },
    sources: source({ id: 'legacy-1', sku: 'SKU-1', precoVenda: 10, estoqueAtual: 2 }),
    scope,
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].values, [TENANT, STOREFRONT, STORE]);
  assert.equal(result.summary.notVerified, 1);
  assert.equal(result.items[0].sku, null);
  assert.equal(result.items[0].variantId, null);
});

test('readScopedCatalogDiagnostic revalida storefront antes de ler catálogo', async () => {
  let calls = 0;
  await assert.rejects(
    () => readScopedCatalogDiagnostic({
      queryRead: async () => { calls += 1; return { rows: [] }; },
      sources: source({ id: 'secret', sku: 'secret' }),
      scope,
    }),
    error => error.code === 'STORE_SCOPE_MISMATCH',
  );
  assert.equal(calls, 1);
});

test('entradas não autorizadas de core não viram core_only nem vazam SKU', () => {
  const result = compareScopedCatalog({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: [
      ...core({ legacy_key: 'legacy-1', sku: 'SKU-1' }),
      { empresa_id: 'tenant-secret', loja_id: 'store-secret', legacy_key: 'secret', variant_id: 'secret-v', sku: 'SECRET-SKU', core_available: 9 },
    ],
    scope,
  });
  assert.equal(result.summary.coreOnly, 0);
  assert.doesNotMatch(JSON.stringify(result), /SECRET-SKU|secret-v/);
});

import { readFileSync } from 'node:fs';

test('SKU case-sensitive não cria vínculo automático nem busca por nome', () => {
  const result = compare({ id: 'nao-mapeado', sku: 'sku-1', nome: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }, core({ legacy_key: 'SKU-1' }));
  assert.equal(first(result).status, 'unmapped');
})

test('fonte Commerce ausente ou resposta incompleta falha sem retornar vazio', async () => {
  assert.throws(() => compareScopedCatalog({ sources: [], coreRows: null, scope }), error => error.code === 'SOURCE_READ_FAILED');
  await assert.rejects(() => readScopedCatalogDiagnostic({ queryRead: async sql => sql.trimStart().startsWith('SELECT id, loja_id FROM commerce_storefronts') ? { rows: [{ id: STOREFRONT, loja_id: STORE }] } : {}, scope }), error => error.code === 'SOURCE_READ_FAILED');
})

test('tipos booleanos e strings brancas de estoque não são zero e reservas não são disponíveis', () => {
  for (const estoqueAtual of [false, '   ', {}]) {
    const item = first(compare({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10.5, estoqueAtual }));
    assert.equal(item.status, 'not_verified');
    assert.equal(item.stock.legacyAvailable, null);
  }
  const item = first(compare({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10.5, estoqueAtual: 2 }, core({ core_reserved: 4, core_committed: 3 })));
  assert.equal(item.stock.coreAvailable, 2);
  assert.equal(item.stock.coreReserved, 4);
  assert.equal(item.stock.reservedComparable, false);
})

test('contrato da rota continua GET/reports.read; diagnóstico novo é opt-in e exige unidade', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = server.indexOf("app.get('/api/admin/commerce/operations/inventory-divergence'");
  assert.ok(start > 0);
  const route = server.slice(start, server.indexOf("app.use('/api/admin/commerce'", start));
  assert.match(route, /requireCommercePermission\(req, 'reports.read'\)/);
  assert.match(route, /if \(!context.lojaId\)/);
  assert.match(route, /compareLegacyAndCoreInventory/);
  assert.match(route, /if \(storefrontId\) \{[\s\S]*report.catalogDiagnostic/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(route, /queryWrite|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  assert.ok(route.indexOf('SELECT id, loja_id FROM commerce_storefronts') < route.indexOf('const mapped'));
})

test('guard de UUID da rota rejeita seletores malformados antes da leitura PostgreSQL', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = server.indexOf("app.get('/api/admin/commerce/operations/inventory-divergence'");
  const route = server.slice(start, server.indexOf("app.use('/api/admin/commerce'", start));
  const literal = route.match(/if \(!\/(.+)\/i\.test\(storefrontId\)\)/);
  assert.ok(literal, 'o guard explícito precede a consulta');
  const valid = new RegExp(literal[1], 'i');
  assert.ok(valid.test(STOREFRONT));
  assert.ok(valid.test(STOREFRONT.toUpperCase()));
  for (const invalid of ['a'.repeat(36), '-'.repeat(36), STOREFRONT.replace(/-/g, ''), STOREFRONT + 'a', 'not-a-uuid']) {
    assert.equal(valid.test(invalid), false);
  }
  assert.ok(route.indexOf(literal[0]) < route.indexOf('SELECT id, loja_id FROM commerce_storefronts'));
});

test('leitor comum expõe variante, SKU, preço e estoque somente por ID/SKU exato unívoco', () => {
  const result = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: '10,50', estoqueAtual: 2 }),
    coreRows: commonCore({ core_price: '10.50', core_promotional_price: null, core_available: 2 }),
    scope,
  });
  assert.deepEqual(result.summary, { sourceItems: 1, available: 1, blocked: 0, unavailable: 0, outOfScope: 0, reasonCounts: {} });
  assert.deepEqual(result.items[0], {
    source: 'legacy', status: 'available', reasons: [], matchedBy: 'id', mappingKey: 'legacy-1',
    variantId: 'variant-1', sku: 'SKU-1', priceCents: 1050, stockAvailable: 2, sourceStockAvailable: 2,
    price: { cents: 1050, baseCents: 1050, promotionalCents: null },
    stock: { available: 2, sourceAvailable: 2 },
    scope,
  });
});

test('leitor comum permite SKU exato sem ID, mas não usa nome nem diferença de caixa', () => {
  const matched = buildCommonCatalogRead({
    sources: source({ id: 'legacy-unknown', sku: 'SKU-1', nome: 'Nome diferente', unidade: 'un', precoVenda: 10.5, estoqueAtual: 2 }),
    coreRows: commonCore({ legacy_key: 'legacy-other' }),
    scope,
  });
  assert.equal(matched.items[0].status, 'available');
  assert.equal(matched.items[0].matchedBy, 'sku');
  const caseChanged = buildCommonCatalogRead({
    sources: source({ id: 'legacy-unknown', sku: 'sku-1', nome: 'SKU-1', unidade: 'un', precoVenda: 10.5, estoqueAtual: 2 }),
    coreRows: commonCore({ legacy_key: 'legacy-other' }),
    scope,
  });
  assert.equal(caseChanged.items[0].status, 'unavailable');
  assert.deepEqual(caseChanged.items[0].reasons, ['NO_EXACT_MAPPING']);
});

test('leitor comum bloqueia duplicado, preço/estoque divergente e escopo incompleto sem fallback silencioso', () => {
  const duplicate = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: [...commonCore(), ...commonCore({ variant_id: 'variant-2', sku: 'SKU-1' })],
    scope,
  });
  assert.equal(duplicate.items[0].status, 'blocked');
  assert.ok(duplicate.items[0].reasons.includes('DUPLICATE_CORE_SKU'));
  assert.equal(duplicate.items[0].variantId, null);
  const divergent = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 11, estoqueAtual: 3 }),
    coreRows: commonCore({ core_available: 2 }),
    scope,
  });
  assert.equal(divergent.items[0].status, 'blocked');
  assert.ok(divergent.items[0].reasons.includes('PRICE_DIVERGENCE'));
  assert.ok(divergent.items[0].reasons.includes('STOCK_DIVERGENCE'));
  assert.equal(divergent.items[0].priceCents, null);
  const noStorefront = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: core(),
    scope,
  });
  assert.equal(noStorefront.items[0].status, 'blocked');
  assert.ok(noStorefront.items[0].reasons.includes('STOREFRONT_MISSING'));
});

test('leitor comum exige unidade explícita igual e preserva o escopo selecionado', () => {
  const missing = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: commonCore({ core_unit: null }),
    scope,
  });
  assert.equal(missing.items[0].status, 'blocked');
  assert.ok(missing.items[0].reasons.includes('CORE_UNIT_MISSING'));
  assert.ok(missing.items[0].reasons.includes('UNIT_NOT_COMPARABLE'));
  assert.equal(missing.items[0].sku, null);
  const different = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'kg', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: commonCore({ core_unit: 'un' }),
    scope,
  });
  assert.equal(different.items[0].status, 'blocked');
  assert.ok(different.items[0].reasons.includes('UNIT_MISMATCH'));
  const available = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10.5, estoqueAtual: 2 }),
    coreRows: commonCore(),
    scope,
  });
  assert.deepEqual(available.items[0].scope, scope);
  assert.equal(available.items[0].variantId, 'variant-1');
});

test('promoção raw inválida bloqueia e não faz fallback ao preço base', () => {
  const result = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: commonCore({ core_promotional_price: 'PROMO-INVALIDA' }),
    scope,
  });
  assert.equal(result.items[0].status, 'blocked');
  assert.ok(result.items[0].reasons.includes('PROMOTIONAL_PRICE_INVALID'));
  assert.ok(result.items[0].reasons.includes('STOREFRONT_PRICE_MISSING'));
  assert.equal(result.items[0].priceCents, null);
  assert.equal(result.items[0].price.cents, null);
});

test('zero real é comparável e catálogo sem registros permanece explicitamente vazio', () => {
  const zero = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 0, estoqueAtual: 0 }),
    coreRows: commonCore({ core_price: 0, core_available: 0 }),
    scope,
  });
  assert.deepEqual(zero.summary, { sourceItems: 1, available: 1, blocked: 0, unavailable: 0, outOfScope: 0, reasonCounts: {} });
  assert.equal(zero.items[0].priceCents, 0);
  assert.equal(zero.items[0].stockAvailable, 0);
  const empty = buildCommonCatalogRead({ sources: [{ name: 'legacy', items: [] }], coreRows: [], scope });
  assert.deepEqual(empty.summary, { sourceItems: 0, available: 0, blocked: 0, unavailable: 0, outOfScope: 0, reasonCounts: {} });
  assert.deepEqual(empty.items, []);
});

test('produto/variante/publicado ausentes ou inativos não declaram disponibilidade comercial', () => {
  const absentRow = commonCore();
  delete absentRow[0].core_product_status;
  delete absentRow[0].core_variant_active;
  delete absentRow[0].core_published;
  const absent = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: absentRow,
    scope,
  });
  assert.equal(absent.items[0].status, 'blocked');
  assert.ok(absent.items[0].reasons.includes('CORE_PRODUCT_STATUS_MISSING'));
  assert.ok(absent.items[0].reasons.includes('CORE_VARIANT_ACTIVE_MISSING'));
  assert.ok(absent.items[0].reasons.includes('CORE_PUBLISHED_MISSING'));
  assert.equal(absent.items[0].sku, null);
  const inactive = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: commonCore({ core_product_status: 'draft', core_variant_active: false, core_published: false }),
    scope,
  });
  assert.equal(inactive.items[0].status, 'blocked');
  assert.ok(inactive.items[0].reasons.includes('CORE_PRODUCT_NOT_ACTIVE'));
  assert.ok(inactive.items[0].reasons.includes('CORE_VARIANT_NOT_ACTIVE'));
  assert.ok(inactive.items[0].reasons.includes('CORE_NOT_PUBLISHED'));
});

test('linhas duplicadas da mesma variante com valores conflitantes são bloqueadas sem escolha silenciosa', () => {
  const result = buildCommonCatalogRead({
    sources: source({ id: 'legacy-1', sku: 'SKU-1', unidade: 'un', precoVenda: 10, estoqueAtual: 2 }),
    coreRows: [...commonCore({ core_price: 10 }), ...commonCore({ core_price: 12 })],
    scope,
  });
  assert.equal(result.items[0].status, 'blocked');
  assert.ok(result.items[0].reasons.includes('DUPLICATE_VARIANT_CONFLICT'));
  assert.equal(result.items[0].priceCents, null);
  assert.equal(result.summary.reasonCounts.DUPLICATE_VARIANT_CONFLICT, 1);
});
