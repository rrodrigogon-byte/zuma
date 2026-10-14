import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAvecPreview, normalizeAvecInput, readCandidates, validateAvecScope } from './avec-catalog-preview.js';

const SCOPE = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  storefrontId: '33333333-3333-4333-8333-333333333333',
  locationId: '44444444-4444-4444-8444-444444444444',
};

function payload(items) {
  return normalizeAvecInput({ source: 'avec', items });
}

test('normaliza EAN como string, preserva zero e distingue custo zero de ausente', () => {
  const result = normalizeAvecInput({
    source: 'avec',
    items: [
      { idOrigem: 'AV-001', sku: 'DINO-001', ean: '0012345678905', ncm: '22030000', custo: '0,00', unidade: 'UN' },
      { idOrigem: 'AV-002', sku: 'DINO-002', ean: '7891234567890', ncm: '22030000', unidade: 'UN' },
    ],
  });
  assert.equal(result.items[0].barcode, '0012345678905');
  assert.equal(result.items[0].costCents, 0);
  assert.equal(result.items[0].costPresent, true);
  assert.equal(result.items[1].costCents, null);
  assert.equal(result.items[1].costPresent, false);
});

test('protege célula CSV com fórmula e marca EAN numérico como conflito', () => {
  assert.throws(
    () => normalizeAvecInput({ source: 'avec', items: [{ sku: '=DINO-001', unidade: 'UN' }] }),
    error => error?.code === 'AVEC_FORMULA_CELL',
  );
  const result = payload([{ sku: 'DINO-001', ean: 7891234567890, unidade: 'UN' }]);
  assert.ok(result.items[0].errors.includes('EAN_NUMERIC_INPUT'));
});

test('só propõe correspondência exata e nunca usa nome', () => {
  const result = buildAvecPreview(payload([
    { idOrigem: 'AV-001', sku: 'DINO-001', ean: '0012345678905', ncm: '22030000', custo: '10,00', unidade: 'UN', nome: 'Produto de origem' },
    { idOrigem: 'AV-002', sku: 'DINO-002', ean: '7891234567890', ncm: '22030000', custo: '12,00', unidade: 'UN', nome: 'Mesmo nome' },
  ]), [
    { variant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sku: 'DINO-001', barcode: '0012345678905', ncm: null, cost_cents: 900, unit: 'UN', source_id: 'AV-001' },
    { variant_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', product_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', sku: 'OUTRO-SKU', barcode: '7891234567891', ncm: null, cost_cents: null, unit: 'UN', source_id: null },
  ], SCOPE);
  assert.equal(result.summary.proposable, 1);
  assert.equal(result.items[0].status, 'proposable');
  assert.deepEqual(result.items[0].proposal.changes, ['custo', 'ncm']);
  assert.equal(result.items[1].status, 'absent');
  assert.ok(result.items[1].reasons.includes('NO_EXACT_MATCH'));
});

test('marca unidade divergente, conflito, ambiguidade e não cria writer', () => {
  const result = buildAvecPreview(payload([
    { idOrigem: 'AV-001', sku: 'DINO-001', unidade: 'KG', custo: '10,00' },
    { idOrigem: 'AV-002', sku: 'DINO-002', unidade: 'UN', custo: '0,00' },
    { idOrigem: 'AV-003', sku: 'DINO-003', unidade: 'UN', custo: '1,00' },
  ]), [
    { variant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sku: 'DINO-001', barcode: null, ncm: null, cost_cents: 1000, unit: 'UN', source_id: 'AV-001' },
    { variant_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', product_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', sku: 'DINO-002', barcode: null, ncm: null, cost_cents: 0, unit: 'UN', source_id: 'AV-002' },
    { variant_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', product_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', sku: 'DINO-003', barcode: null, ncm: null, cost_cents: 100, unit: 'UN', source_id: 'AV-003' },
    { variant_id: '99999999-9999-4999-8999-999999999999', product_id: '88888888-8888-4888-8888-888888888888', sku: 'DINO-003', barcode: null, ncm: null, cost_cents: 200, unit: 'UN', source_id: 'AV-003' },
  ], SCOPE);
  assert.equal(result.items[0].status, 'conflict');
  assert.ok(result.items[0].reasons.includes('UNIT_MISMATCH'));
  assert.equal(result.items[1].status, 'proposable');
  assert.equal(result.items[1].custoCents, 0);
  assert.equal(result.items[2].status, 'ambiguous');
  assert.ok(result.items[2].reasons.includes('AMBIGUOUS_MATCH'));
  assert.equal(result.write.performed, false);
});

test('consulta somente tabelas e colunas reais, filtra storefront e mapeia AVEC por produto exato', async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE)\b/i); return { rows: [] }; } };
  await readCandidates(client, { empresaId: SCOPE.empresaId, lojaId: SCOPE.lojaId, storefrontId: SCOPE.storefrontId, locationId: SCOPE.locationId }, payload([{ idOrigem: 'AV-001', sku: 'DINO-001', ean: '0012345678905', unidade: 'UN' }]));
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /commerce_product_channels/);
  assert.match(calls[0].sql, /channel\.storefront_id = \$4/);
  assert.match(calls[0].sql, /link\.target_id = p\.id/);
  assert.match(calls[0].sql, /vp\.price_list_id = channel\.price_list_id/);
  assert.deepEqual(calls[0].values, [SCOPE.empresaId, ['DINO-001'], ['0012345678905'], SCOPE.storefrontId, ['AV-001'], SCOPE.lojaId]);
});

test('revalida storefront e local antes de ler candidatos, sem DML', async () => {
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('commerce_storefronts')) return { rows: [{ id: SCOPE.storefrontId, loja_id: SCOPE.lojaId }] };
    if (sql.includes('commerce_inventory_locations')) return { rows: [{ id: SCOPE.locationId, loja_id: SCOPE.lojaId }] };
    throw new Error('consulta inesperada');
  } };
  const scope = await validateAvecScope(client, { empresaId: SCOPE.empresaId, lojaId: SCOPE.lojaId }, SCOPE);
  assert.deepEqual(scope, SCOPE);
  assert.equal(calls.length, 2);
  assert.equal(calls.some(call => /\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(call.sql)), false);
});

test('unidade ausente e vínculos fora do escopo bloqueiam antes de ler produtos', async () => {
  let calls = 0;
  await assert.rejects(() => validateAvecScope({ query: async () => { calls++; return { rows: [] }; } }, { empresaId: SCOPE.empresaId }, SCOPE), error => error.code === 'AVEC_SCOPE_REQUIRED');
  assert.equal(calls, 0);
  await assert.rejects(() => validateAvecScope({ query: async () => { calls++; return { rows: [] }; } }, SCOPE, SCOPE), error => error.code === 'AVEC_SCOPE_MISMATCH');
  assert.equal(calls, 1);
});

test('identificador longo não é truncado para corresponder a outro produto', () => {
  assert.throws(() => payload([{ sourceId: 'x'.repeat(181), unidade: 'UN' }]), error => error.code === 'AVEC_FIELD_TOO_LONG');
});

test('SKU e EAN de produtos diferentes resultam em ambiguidade, não associação automática', () => {
  const result = buildAvecPreview(payload([{ sku: 'SKU-A', ean: '0012345678905', unidade: 'UN' }]), [
    { product_id: 'p1', variant_id: 'v1', sku: 'SKU-A', unit: 'UN' },
    { product_id: 'p2', variant_id: 'v2', sku: 'SKU-B', barcode: '0012345678905', unit: 'UN' },
  ], SCOPE);
  assert.equal(result.items[0].status, 'ambiguous');
  assert.equal(result.items[0].proposal, null);
});
