import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const enabled = Boolean(process.env.DINO_CATALOG_FIXTURE && process.env.DINO_CATALOG_FIXTURE_MARKER);
const BIN = '/usr/lib/postgresql/16/bin';

function fixtureContext() {
  const manifestPath = realpathSync(process.env.DINO_CATALOG_FIXTURE);
  const fixtureDir = dirname(manifestPath);
  const fixture = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(fixture.marker, process.env.DINO_CATALOG_FIXTURE_MARKER);
  assert.ok(fixtureDir.startsWith(join(realpathSync(tmpdir()), 'dino-catalog-pg-')));
  assert.equal(realpathSync(fixture.socket), join(fixtureDir, 'socket'));
  assert.equal(fixture.database, 'dino_catalog_test');
  assert.equal(fixture.owner, 'dino_catalog_fixture_owner');
  assert.equal(fixture.reader, 'dino_catalog_readonly');
  assert.equal(fixture.port, 55433);
  return { fixture, fixtureDir };
}

function psql(fixture, role, sql, { file = false } = {}) {
  const args = ['-h', fixture.socket, '-p', String(fixture.port), '-U', role, '-d', fixture.database, '-v', 'ON_ERROR_STOP=1'];
  if (file) args.push('-f', sql);
  else args.push('-At', '-c', sql);
  const result = spawnSync('/usr/bin/psql', args, { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, TZ: process.env.TZ } });
  if (result.status !== 0) throw new Error(`psql falhou (${role}): ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function queryRead(fixture, sql, values = []) {
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i);
  const substituted = sql.replace(/\$(\d+)/g, (_, n) => {
    const index = Number(n) - 1;
    if (index < 0 || index >= values.length) throw new Error(`parâmetro ausente para $${n}`);
    const value = values[index];
    if (value === null || value === undefined) return 'NULL';
    if (Array.isArray(value)) return `'${JSON.stringify(value).replace(/^\[/, '{').replace(/\]$/, '}').replaceAll("'", "''")}'`;
    return `'${String(value).replaceAll("'", "''")}'`;
  });
  const wrapped = `SELECT COALESCE(json_agg(q), '[]'::json) FROM (${substituted}) AS q;`;
  const args = ['-h', fixture.socket, '-p', String(fixture.port), '-U', fixture.reader, '-d', fixture.database, '-v', 'ON_ERROR_STOP=1'];
  args.push('-At', '-c', wrapped);
  const result = spawnSync('/usr/bin/psql', args, { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, TZ: process.env.TZ } });
  if (result.status !== 0) throw new Error(`queryRead SELECT-only falhou: ${result.stderr || result.stdout}`);
  return { rows: JSON.parse(result.stdout.trim() || '[]') };
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const A2 = '44444444-4444-4444-8444-444444444444';
const B1 = '55555555-5555-4555-8555-555555555555';
const SF_A1 = '66666666-6666-4666-8666-666666666666';
const SF_A2 = '77777777-7777-4777-8777-777777777777';
const SF_B1 = '88888888-8888-4888-8888-888888888888';
const PRICE_A = '99999999-9999-4999-8999-999999999991';
const PRICE_B = '99999999-9999-4999-8999-999999999992';
const LOC_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const LOC_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const LOC_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const PRODUCT_ALIGNED = 'c0000000-0000-4000-8000-000000000001';
const PRODUCT_NOPRICE = 'c0000000-0000-4000-8000-000000000002';
const PRODUCT_NOSTOCK = 'c0000000-0000-4000-8000-000000000003';
const PRODUCT_AMBIGUOUS = 'c0000000-0000-4000-8000-000000000004';
const PRODUCT_SECRET_A2 = 'c0000000-0000-4000-8000-000000000005';
const PRODUCT_SECRET_B = 'c0000000-0000-4000-8000-000000000006';
const VAR_ALIGNED = 'd0000000-0000-4000-8000-000000000001';
const VAR_NOPRICE = 'd0000000-0000-4000-8000-000000000002';
const VAR_NOSTOCK = 'd0000000-0000-4000-8000-000000000003';
const VAR_AMBIGUOUS_A = 'd0000000-0000-4000-8000-000000000004';
const VAR_AMBIGUOUS_B = 'd0000000-0000-4000-8000-000000000005';
const VAR_SECRET_A2 = 'd0000000-0000-4000-8000-000000000006';
const VAR_SECRET_B = 'd0000000-0000-4000-8000-000000000007';
const READER = 'dino_catalog_readonly';

async function setupFixture(fixture, fixtureDir) {
  const setupPath = join(fixtureDir, 'catalog-fixture.sql');
  const sql = `
INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio) VALUES
  ('${A}', 'Fixture tenant A', '11111111000101', 'Fixture tenant A LTDA', 'outro'),
  ('${B}', 'Fixture tenant B', '22222222000102', 'Fixture tenant B LTDA', 'outro');
INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES
  ('${A1}', '${A}', 'a1', 'Unidade A1'),
  ('${A2}', '${A}', 'a2', 'Unidade A2'),
  ('${B1}', '${B}', 'b1', 'Unidade B1');
INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, status) VALUES
  ('${SF_A1}', '${A}', '${A1}', 'sf-a1', 'Storefront A1', 'active'),
  ('${SF_A2}', '${A}', '${A2}', 'sf-a2', 'Storefront A2', 'active'),
  ('${SF_B1}', '${B}', '${B1}', 'sf-b1', 'Storefront B1', 'active');
INSERT INTO commerce_price_lists (id, empresa_id, codigo, nome, canal) VALUES
  ('${PRICE_A}', '${A}', 'web-a', 'Tabela Web A', 'web'),
  ('${PRICE_B}', '${B}', 'web-b', 'Tabela Web B', 'web');
INSERT INTO commerce_products (id, empresa_id, slug, nome, tipo, status) VALUES
  ('${PRODUCT_ALIGNED}', '${A}', 'produto-aligned', 'Produto alinhado sem medida', 'physical', 'active'),
  ('${PRODUCT_NOPRICE}', '${A}', 'produto-no-price', 'Produto sem preço', 'physical', 'active'),
  ('${PRODUCT_NOSTOCK}', '${A}', 'produto-no-stock', 'Produto sem saldo', 'physical', 'active'),
  ('${PRODUCT_AMBIGUOUS}', '${A}', 'produto-ambiguous', 'Produto com variantes múltiplas', 'physical', 'active'),
  ('${PRODUCT_SECRET_A2}', '${A}', 'produto-secret-a2', 'Produto de outra unidade', 'physical', 'active'),
  ('${PRODUCT_SECRET_B}', '${B}', 'produto-secret-b', 'Produto de outro tenant', 'physical', 'active');
INSERT INTO commerce_product_variants (id, empresa_id, product_id, sku, nome) VALUES
  ('${VAR_ALIGNED}', '${A}', '${PRODUCT_ALIGNED}', 'SKU-ALIGNED', 'Único'),
  ('${VAR_NOPRICE}', '${A}', '${PRODUCT_NOPRICE}', 'SKU-NOPRICE', 'Único'),
  ('${VAR_NOSTOCK}', '${A}', '${PRODUCT_NOSTOCK}', 'SKU-NOSTOCK', 'Único'),
  ('${VAR_AMBIGUOUS_A}', '${A}', '${PRODUCT_AMBIGUOUS}', 'SKU-AMB-A', 'Variante A'),
  ('${VAR_AMBIGUOUS_B}', '${A}', '${PRODUCT_AMBIGUOUS}', 'SKU-AMB-B', 'Variante B'),
  ('${VAR_SECRET_A2}', '${A}', '${PRODUCT_SECRET_A2}', 'SKU-SECRET-A2', 'Segredo unidade A2'),
  ('${VAR_SECRET_B}', '${B}', '${PRODUCT_SECRET_B}', 'SKU-SECRET-B', 'Segredo tenant B');
INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado) VALUES
  ('${A}', '${SF_A1}', '${PRODUCT_ALIGNED}', '${PRICE_A}', true),
  ('${A}', '${SF_A1}', '${PRODUCT_NOPRICE}', '${PRICE_A}', true),
  ('${A}', '${SF_A1}', '${PRODUCT_NOSTOCK}', '${PRICE_A}', true),
  ('${A}', '${SF_A1}', '${PRODUCT_AMBIGUOUS}', '${PRICE_A}', true),
  ('${A}', '${SF_A2}', '${PRODUCT_SECRET_A2}', '${PRICE_A}', true),
  ('${B}', '${SF_B1}', '${PRODUCT_SECRET_B}', '${PRICE_B}', true);
INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco, preco_promocional) VALUES
  ('${A}', '${PRICE_A}', '${VAR_ALIGNED}', 10.50, 9.50),
  ('${A}', '${PRICE_A}', '${VAR_NOSTOCK}', 20.00, NULL),
  ('${A}', '${PRICE_A}', '${VAR_AMBIGUOUS_A}', 30.00, NULL),
  ('${A}', '${PRICE_A}', '${VAR_AMBIGUOUS_B}', 31.00, NULL),
  ('${A}', '${PRICE_A}', '${VAR_SECRET_A2}', 40.00, NULL),
  ('${B}', '${PRICE_B}', '${VAR_SECRET_B}', 50.00, NULL);
INSERT INTO commerce_inventory_locations (id, empresa_id, loja_id, codigo, nome, tipo, ativo) VALUES
  ('${LOC_A1}', '${A}', '${A1}', 'loc-a1', 'Estoque A1', 'store', true),
  ('${LOC_A2}', '${A}', '${A2}', 'loc-a2', 'Estoque A2', 'store', true),
  ('${LOC_B1}', '${B}', '${B1}', 'loc-b1', 'Estoque B1', 'store', true);
INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel, reservado, comprometido) VALUES
  ('${A}', '${LOC_A1}', '${VAR_ALIGNED}', 2, 4, 3),
  ('${A}', '${LOC_A2}', '${VAR_SECRET_A2}', 8, 0, 0),
  ('${B}', '${LOC_B1}', '${VAR_SECRET_B}', 9, 0, 0);
INSERT INTO commerce_legacy_imports (empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash) VALUES
  ('${A}', '${A1}', 'fixture', 'product', 'legacy-aligned', '${PRODUCT_ALIGNED}', 'hash-aligned'),
  ('${A}', '${A1}', 'fixture', 'product', 'legacy-no-price', '${PRODUCT_NOPRICE}', 'hash-no-price'),
  ('${A}', '${A1}', 'fixture', 'product', 'legacy-no-stock', '${PRODUCT_NOSTOCK}', 'hash-no-stock'),
  ('${A}', '${A1}', 'fixture', 'product', 'legacy-ambiguous', '${PRODUCT_AMBIGUOUS}', 'hash-ambiguous'),
  ('${A}', '${A2}', 'fixture', 'product', 'legacy-secret-a2', '${PRODUCT_SECRET_A2}', 'hash-secret-a2'),
  ('${B}', '${B1}', 'fixture', 'product', 'legacy-secret-b', '${PRODUCT_SECRET_B}', 'hash-secret-b');
CREATE ROLE ${READER} LOGIN;
GRANT CONNECT ON DATABASE ${fixture.database} TO ${READER};
GRANT USAGE ON SCHEMA public TO ${READER};
GRANT SELECT ON commerce_storefronts, commerce_legacy_imports, commerce_products, commerce_product_variants, commerce_product_channels, commerce_variant_prices, commerce_inventory_levels, commerce_inventory_locations TO ${READER};
`;
  writeFileSync(setupPath, sql, { mode: 0o600 });
  try { psql(fixture, fixture.owner, setupPath, { file: true }); } finally { unlinkSync(setupPath); }
}

function sourceItems() {
  return [{
    name: 'legacy-fixture',
    items: [
      { empresaId: A, lojaId: A1, id: 'legacy-aligned', sku: 'SKU-ALIGNED', unidade: 'un', precoVenda: '10.50', estoqueAtual: 2 },
      { empresaId: A, lojaId: A1, id: 'legacy-no-price', sku: 'SKU-NOPRICE', unidade: 'un', precoVenda: '12.00', estoqueAtual: 0 },
      { empresaId: A, lojaId: A1, id: 'legacy-no-stock', sku: 'SKU-NOSTOCK', unidade: 'un', precoVenda: '20.00', estoqueAtual: 0 },
      { empresaId: A, lojaId: A1, id: 'legacy-ambiguous', sku: 'SKU-AMB-A', unidade: 'un', precoVenda: '30.00', estoqueAtual: 1 },
      { empresaId: A, lojaId: A2, id: 'legacy-secret-a2', sku: 'SKU-SECRET-A2', unidade: 'un', precoVenda: '40.00', estoqueAtual: 8 },
      { empresaId: B, lojaId: B1, id: 'legacy-secret-b', sku: 'SKU-SECRET-B', unidade: 'un', precoVenda: '50.00', estoqueAtual: 9 },
    ],
  }];
}

function itemFor(report, identifier) {
  const item = report.items.find(row => row.identifier === identifier);
  assert.ok(item, `item ${identifier} ausente em ${JSON.stringify(report)}`);
  return item;
}

test('PostgreSQL real: diagnóstico de catálogo é read-only, tenant/store scoped e fail-closed', { skip: enabled ? false : 'Execute npm run test:catalog-pg-real; somente cluster PostgreSQL 16 efêmero por socket é permitido' }, async () => {
  const { fixture, fixtureDir } = fixtureContext();
  await setupFixture(fixture, fixtureDir);
  const { readScopedCatalogDiagnostic } = await import('./catalog-read-diagnostic.js');
  const scope = { empresaId: A, lojaId: A1, storefrontId: SF_A1 };
  const calls = [];
  const result = await readScopedCatalogDiagnostic({
    queryRead: async (sql, values) => {
      calls.push({ sql, values });
      return queryRead(fixture, sql, values);
    },
    sources: sourceItems(),
    scope,
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.values), [[A, SF_A1, A1], [A, A1, SF_A1]]);
  assert.match(calls[1].sql, /commerce_product_channels/);
  assert.match(calls[1].sql, /pc\.price_list_id/);
  assert.match(calls[1].sql, /commerce_variant_prices/);
  assert.match(calls[1].sql, /commerce_inventory_levels/);
  assert.match(calls[1].sql, /commerce_inventory_locations/);
  assert.match(calls[1].sql, /li\.loja_id = \$2/);

  assert.equal(result.summary.sourceItems, 4);
  assert.equal(result.summary.outOfScope, 2);
  assert.equal(result.summary.mapped, 4);
  assert.equal(result.summary.ambiguous, 1);
  assert.equal(result.summary.notVerified, 3);
  assert.equal(result.summary.unmapped, 0);
  assert.equal(result.items.some(item => item.identifier === 'legacy-secret-a2' || item.identifier === 'legacy-secret-b'), false);
  assert.doesNotMatch(JSON.stringify(result), /SKU-SECRET|secret-a2|secret-b|produto-secret/);
  assert.equal(result.commonRead.mode, 'read-only-common-catalog');
  assert.equal(result.commonRead.summary.sourceItems, 4);
  assert.equal(result.commonRead.summary.available, 0, 'core_unit NULL não é convertido em un');
  assert.equal(result.commonRead.summary.blocked, 4);
  assert.equal(result.commonRead.summary.outOfScope, 2);
  assert.ok(result.commonRead.summary.reasonCounts.UNIT_NOT_COMPARABLE >= 3);
  assert.ok(result.commonRead.items.every(item => item.status === 'blocked' && item.sku === null && item.variantId === null && item.priceCents === null && item.stockAvailable === null));

  const alignedWithMissingMeasure = itemFor(result, 'legacy-aligned');
  assert.equal(alignedWithMissingMeasure.status, 'not_verified');
  assert.ok(alignedWithMissingMeasure.reasons.includes('UNIT_NOT_COMPARABLE'));
  assert.equal(alignedWithMissingMeasure.price.compared, 'not-comparable');
  assert.equal(alignedWithMissingMeasure.price.legacyCents, null);
  assert.equal(alignedWithMissingMeasure.price.coreCents, null);
  assert.equal(alignedWithMissingMeasure.stock.compared, 'not-comparable');
  assert.equal(alignedWithMissingMeasure.stock.coreAvailable, null);

  const noPrice = itemFor(result, 'legacy-no-price');
  assert.equal(noPrice.status, 'not_verified');
  assert.ok(noPrice.reasons.includes('CORE_PRICE_MISSING'));
  assert.equal(noPrice.price.coreCents, null);

  const noStock = itemFor(result, 'legacy-no-stock');
  assert.equal(noStock.status, 'not_verified');
  assert.ok(noStock.reasons.includes('CORE_AVAILABLE_MISSING'));
  assert.equal(noStock.stock.coreAvailable, null);

  const ambiguous = itemFor(result, 'legacy-ambiguous');
  assert.equal(ambiguous.status, 'ambiguous');
  assert.ok(ambiguous.reasons.includes('AMBIGUOUS_MAPPING'));
  assert.equal(ambiguous.sku, null);
  assert.equal(ambiguous.variantId, null);
  assert.equal(ambiguous.price.coreCents, null);
  assert.equal(ambiguous.stock.coreReserved, null);

  await assert.rejects(
    () => readScopedCatalogDiagnostic({
      queryRead: async (sql, values) => queryRead(fixture, sql, values),
      sources: [{ name: 'legacy-fixture', error: 'source unavailable', items: [] }],
      scope,
    }),
    error => error.code === 'SOURCE_READ_FAILED',
  );
  await assert.rejects(
    () => readScopedCatalogDiagnostic({
      queryRead: async (sql, values) => queryRead(fixture, sql, values),
      sources: sourceItems(),
      scope: { empresaId: A, lojaId: A1, storefrontId: SF_A2 },
    }),
    error => error.code === 'STORE_SCOPE_MISMATCH',
  );

  // The reader has SELECT only. Any accidental DML in the diagnostic would fail
  // with permission denied; the owner-side fixture remains unchanged.
  const fixtureCounts = JSON.parse(psql(fixture, fixture.owner, `SELECT json_build_object(
    'legacy', (SELECT count(*) FROM commerce_legacy_imports),
    'products', (SELECT count(*) FROM commerce_products),
    'levels', (SELECT count(*) FROM commerce_inventory_levels)
  );`));
  assert.deepEqual(fixtureCounts, { legacy: 6, products: 6, levels: 3 });

  // Nova prévia AVEC executa sua SQL real com o mesmo papel SELECT-only.
  const { normalizeAvecInput, validateAvecScope, readCandidates, buildAvecPreview } = await import('./avec-catalog-preview.js');
  psql(fixture, fixture.owner, `
    UPDATE commerce_product_variants SET atributos = '{"unidade_medida":"UN"}', barcode = '0012345678905' WHERE id = '${VAR_ALIGNED}';
    UPDATE commerce_variant_prices SET custo = 1.25 WHERE variant_id = '${VAR_ALIGNED}' AND price_list_id = '${PRICE_A}';
    INSERT INTO commerce_legacy_imports (empresa_id,loja_id,source,entity,legacy_key,target_id,payload_hash) VALUES ('${A}','${A1}','avec','product','AVEC-LOCAL-1','${PRODUCT_ALIGNED}','fixture-hash');
  `);
  const readOnlyClient = { query: async (sql, values) => queryRead(fixture, sql, values) };
  const avecScope = await validateAvecScope(readOnlyClient, scope, { storefrontId: SF_A1, locationId: LOC_A1 });
  const avecInput = normalizeAvecInput({ items: [{ sourceId: 'AVEC-LOCAL-1', sku: 'SKU-ALIGNED', ean: '0012345678905', unidade: 'UN', custo: '2.00', ncm: '22030000' }, { sku: 'SKU-SECRET-A2', unidade: 'UN' }, { sku: 'SKU-SECRET-B', unidade: 'UN' }] });
  const levelsBefore = psql(fixture, fixture.owner, 'SELECT md5(json_agg(t ORDER BY variant_id)::text) FROM commerce_inventory_levels t');
  const rows = await readCandidates(readOnlyClient, avecScope, avecInput);
  const avecPreview = buildAvecPreview(avecInput, rows, avecScope);
  assert.equal(avecPreview.items[0].proposal.current.costCents, 125);
  assert.equal(avecPreview.items[0].status, 'proposable');
  assert.ok(avecPreview.items[0].proposal.matchedBy.includes('source_id'));
  assert.equal(avecPreview.items[1].status, 'absent');
  assert.equal(avecPreview.items[2].status, 'absent');
  assert.equal(avecPreview.write.performed, false);
  assert.equal(psql(fixture, fixture.owner, 'SELECT md5(json_agg(t ORDER BY variant_id)::text) FROM commerce_inventory_levels t'), levelsBefore);
  await assert.rejects(() => validateAvecScope(readOnlyClient, scope, { storefrontId: SF_A2, locationId: LOC_A2 }), error => error.code === 'AVEC_SCOPE_MISMATCH');

});
