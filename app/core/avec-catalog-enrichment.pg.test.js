import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, userInfo } from 'node:os';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Este teste nunca usa DATABASE_URL/PG* nem o pool do aplicativo. O banco é um
// cluster PostgreSQL local, criado pelo próprio teste em um Unix socket privado.
for (const name of [
  'DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER',
  'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE', 'DB_HOST', 'DB_PORT', 'DB_NAME',
  'DB_USER', 'DB_PASSWORD', 'DB_SSL',
]) delete process.env[name];
if (process.env.NODE_ENV === 'production') throw new Error('fixture AVEC proibida em NODE_ENV=production');
process.env.NODE_ENV = 'test';

const { Client } = pg;
const { executeAvecCatalogEnrichment, previewAvecCatalogEnrichment } = await import('./avec-catalog-enrichment.js');

const PG_BIN = '/usr/lib/postgresql/16/bin';
const IDs = {
  tenantA: '11111111-1111-4111-8111-111111111111',
  storeA: '22222222-2222-4222-8222-222222222222',
  userA: '33333333-3333-4333-8333-333333333333',
  storefrontA: '44444444-4444-4444-8444-444444444444',
  locationA: '55555555-5555-4555-8555-555555555555',
  productA: '66666666-6666-4666-8666-666666666666',
  variantA: '77777777-7777-4777-8777-777777777777',
  channelA: '88888888-8888-4888-8888-888888888888',
  priceListA: '99999999-9999-4999-8999-999999999999',
  priceListAlt: '32323232-3232-4232-8232-323232323232',
  priceA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  priceAltA: '33333333-3333-4333-8333-333333333334',
  priceLockProbe: '34343434-3434-4343-8343-343434343434',
  productC: '18181818-1818-4181-8181-181818181818',
  variantC: '19191919-1919-4191-8191-191919191919',
  channelC: '20202020-2020-4202-8202-202020202020',
  priceC: '21212121-2121-4212-8212-212121212121',
  tenantB: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  storeB: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  userB: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  storefrontB: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  locationB: '12121212-1212-4121-8121-121212121212',
  productB: '13131313-1313-4131-8131-131313131313',
  variantB: '14141414-1414-4141-8141-141414141414',
  channelB: '15151515-1515-4151-8151-151515151515',
  priceListB: '16161616-1616-4161-8161-161616161616',
  priceB: '17171717-1717-4171-8171-171717171717',
  roleA: '23232323-2323-4232-8232-232323232323',
  roleB: '24242424-2424-4242-8242-242424242424',
  permissionReports: '25252525-2525-4252-8252-252525252525',
  permissionCatalog: '26262626-2626-4262-8262-262626262626',
  productD: '27272727-2727-4272-8272-272727272727',
  variantD: '28282828-2828-4282-8282-282828282828',
  channelD: '29292929-2929-4292-8292-292929292929',
  priceD: '30303030-3030-4303-8303-303030303030',
  priceHistoryA: '31313131-3131-4313-8313-313131313131',
};

const BASE_ITEM = {
  sourceId: 'AVEC-SYNTH-001',
  sku: 'DINO-SYNTH-001',
  unidade: 'UN',
  custo: '12,34',
  ean: '7891234567895',
  ncm: '33049990',
};
const CONCURRENT_ITEM = {
  sourceId: 'AVEC-SYNTH-003',
  sku: 'DINO-SYNTH-003',
  unidade: 'UN',
  custo: '21,09',
  ean: '7891234567802',
  ncm: '33049992',
};
const COLLISION_ITEM = {
  sourceId: 'AVEC-SYNTH-004',
  sku: 'DINO-SYNTH-004',
  unidade: 'UN',
  custo: '22,22',
  ean: '7891234567833',
  ncm: '33049994',
};
const contextA = {
  empresaId: IDs.tenantA,
  lojaId: IDs.storeA,
  usuarioId: IDs.userA,
  capabilities: ['reports.read', 'catalog.write'], // fabricadas; não autorizam
  authorize: () => true, // callback fabricado; não autoriza
};
const inputFor = (items, extra = {}) => ({
  source: 'avec',
  storefrontId: IDs.storefrontA,
  locationId: IDs.locationA,
  items,
  ...extra,
});

const SYNTHETIC_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE empresas (id uuid PRIMARY KEY, nome text NOT NULL);
CREATE TABLE lojas (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  codigo varchar(30) NOT NULL, nome text NOT NULL, ativa boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, codigo)
);
CREATE TABLE usuarios (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  nome text NOT NULL, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, id)
);
CREATE TABLE commerce_permissions (
  id uuid PRIMARY KEY, codigo varchar(100) NOT NULL UNIQUE, descricao varchar(255) NOT NULL
);
CREATE TABLE commerce_roles (
  id uuid PRIMARY KEY, empresa_id uuid REFERENCES empresas(id), codigo varchar(80) NOT NULL,
  nome varchar(120) NOT NULL, sistema boolean NOT NULL DEFAULT false,
  UNIQUE (empresa_id, codigo)
);
CREATE UNIQUE INDEX commerce_role_system_code_uq ON commerce_roles(codigo) WHERE empresa_id IS NULL;
CREATE TABLE commerce_role_permissions (
  role_id uuid NOT NULL REFERENCES commerce_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES commerce_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE commerce_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL, loja_id uuid, role_id uuid NOT NULL REFERENCES commerce_roles(id),
  ativo boolean NOT NULL DEFAULT true, expires_at timestamptz,
  UNIQUE (empresa_id, usuario_id, loja_id),
  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX commerce_membership_tenant_uq ON commerce_memberships(empresa_id, usuario_id) WHERE loja_id IS NULL;
CREATE UNIQUE INDEX commerce_membership_store_uq ON commerce_memberships(empresa_id, usuario_id, loja_id) WHERE loja_id IS NOT NULL;
CREATE TABLE commerce_storefronts (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  loja_id uuid, codigo varchar(80) NOT NULL, nome varchar(200) NOT NULL, status varchar(20) NOT NULL,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, codigo),
  FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE RESTRICT
);
CREATE TABLE commerce_inventory_locations (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  loja_id uuid, codigo varchar(80) NOT NULL, nome varchar(160) NOT NULL, ativo boolean NOT NULL DEFAULT true,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, codigo),
  FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE RESTRICT
);
CREATE TABLE commerce_products (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  slug varchar(180) NOT NULL, nome varchar(300) NOT NULL, tipo varchar(30) NOT NULL DEFAULT 'physical',
  status varchar(20) NOT NULL DEFAULT 'active', descricao text, descricao_curta varchar(500),
  dados_fiscais jsonb NOT NULL DEFAULT '{}'::jsonb, seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  publicado_em timestamptz, atualizado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, slug),
  CHECK (status IN ('draft', 'active', 'archived'))
);
CREATE TABLE commerce_product_variants (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), product_id uuid NOT NULL,
  sku varchar(100) NOT NULL, barcode varchar(80), nome varchar(200), atributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  peso_gramas integer, largura_cm numeric(10,2), altura_cm numeric(10,2), comprimento_cm numeric(10,2),
  ativo boolean NOT NULL DEFAULT true, atualizado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, sku),
  FOREIGN KEY (empresa_id, product_id) REFERENCES commerce_products(empresa_id, id) ON DELETE CASCADE,
  CHECK (peso_gramas IS NULL OR peso_gramas >= 0)
);
CREATE UNIQUE INDEX commerce_variant_barcode_uq ON commerce_product_variants(empresa_id, barcode) WHERE barcode IS NOT NULL;
CREATE TABLE commerce_price_lists (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id),
  codigo varchar(80) NOT NULL, nome varchar(160) NOT NULL, UNIQUE (empresa_id, id)
);
CREATE TABLE commerce_product_channels (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), storefront_id uuid NOT NULL,
  product_id uuid NOT NULL, price_list_id uuid, publicado boolean NOT NULL DEFAULT false,
  UNIQUE (empresa_id, id), UNIQUE (empresa_id, storefront_id, product_id),
  FOREIGN KEY (empresa_id, storefront_id) REFERENCES commerce_storefronts(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, product_id) REFERENCES commerce_products(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, price_list_id) REFERENCES commerce_price_lists(empresa_id, id) ON DELETE RESTRICT
);
CREATE TABLE commerce_variant_prices (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), price_list_id uuid NOT NULL,
  variant_id uuid NOT NULL, preco numeric(14,2) NOT NULL, preco_promocional numeric(14,2),
  custo numeric(14,2), vigencia_inicio timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vigencia_fim timestamptz, FOREIGN KEY (empresa_id, price_list_id) REFERENCES commerce_price_lists(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, variant_id) REFERENCES commerce_product_variants(empresa_id, id) ON DELETE CASCADE,
  CHECK (preco >= 0 AND (preco_promocional IS NULL OR (preco_promocional >= 0 AND preco_promocional <= preco)))
);
CREATE TABLE commerce_inventory_levels (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), location_id uuid NOT NULL,
  variant_id uuid NOT NULL, disponivel integer NOT NULL, reservado integer NOT NULL,
  comprometido integer NOT NULL, minimo integer NOT NULL,
  FOREIGN KEY (empresa_id, location_id) REFERENCES commerce_inventory_locations(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, variant_id) REFERENCES commerce_product_variants(empresa_id, id) ON DELETE CASCADE
);
CREATE TABLE commerce_product_media (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), product_id uuid NOT NULL,
  variant_id uuid, storage_key varchar(500) NOT NULL, public_url varchar(1000), mime_type varchar(120) NOT NULL,
  alt_text varchar(255), ordem integer NOT NULL DEFAULT 0,
  FOREIGN KEY (empresa_id, product_id) REFERENCES commerce_products(empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, variant_id) REFERENCES commerce_product_variants(empresa_id, id) ON DELETE CASCADE
);
CREATE TABLE commerce_legacy_imports (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), loja_id uuid,
  source varchar(80) NOT NULL, entity varchar(80) NOT NULL, legacy_key varchar(180) NOT NULL, target_id uuid NOT NULL,
  payload_hash varchar(128) NOT NULL, imported_by uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (empresa_id, source, entity, legacy_key),
  FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, imported_by) REFERENCES usuarios(empresa_id, id) ON DELETE RESTRICT
);
CREATE TABLE commerce_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresas(id),
  scope varchar(120) NOT NULL, key varchar(180) NOT NULL, request_hash varchar(128) NOT NULL, response_status integer,
  response_body jsonb, expires_at timestamptz, UNIQUE (empresa_id, scope, key)
);
CREATE TABLE commerce_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresas(id),
  loja_id uuid, usuario_id uuid, entidade varchar(100) NOT NULL, entidade_id uuid, acao varchar(30) NOT NULL,
  antes jsonb, depois jsonb, correlation_id varchar(160),
  FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios(empresa_id, id) ON DELETE RESTRICT
);
`;

let fixture;

function runBinary(name, args, cwd, env) {
  const result = spawnSync(join(PG_BIN, name), args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 90_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${name} falhou: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result;
}

async function createFixture() {
  if (userInfo().uid === 0) throw new Error('teste sintético deve rodar como usuário local, não root');
  for (const binary of ['initdb', 'pg_ctl', 'createdb']) {
    if (!existsSync(join(PG_BIN, binary))) throw new Error(`PostgreSQL 16 local ausente: ${binary}`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'avec-writer-pg-synthetic-'));
  const data = join(dir, 'data');
  const socket = join(dir, 'socket');
  mkdirSync(socket, { mode: 0o700 });
  const port = 55000 + (process.pid % 1000);
  const owner = 'avec_synthetic_owner';
  const database = 'avec_writer_synthetic_test';
  const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  let started = false;
  try {
    runBinary('initdb', ['-D', data, '-U', owner, '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8'], dir, env);
    runBinary('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-k ${socket} -p ${port} -c listen_addresses='' -c fsync=off`, '-w', 'start'], dir, env);
    started = true;
    runBinary('createdb', ['-h', socket, '-p', String(port), '-U', owner, database], dir, env);
    const client = new Client({ host: socket, port, database, user: owner, ssl: false });
    await client.connect();
    await client.query(SYNTHETIC_SCHEMA);
    await seedFixture(client);
    return {
      dir, data, socket, port, database, owner, env, client,
      async close() {
        await client.end();
        const stopped = spawnSync(join(PG_BIN, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env, cwd: dir, encoding: 'utf8', timeout: 30_000 });
        if (stopped.status !== 0) throw new Error(`pg_ctl stop falhou: ${stopped.stderr}`);
        rmSync(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (started) spawnSync(join(PG_BIN, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env, cwd: dir, encoding: 'utf8', timeout: 30_000 });
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

async function seedFixture(client) {
  const q = (text, values = []) => client.query(text, values);
  await q("INSERT INTO empresas (id, nome) VALUES ($1, 'tenant AVEC sintético'), ($2, 'tenant isolado sintético')", [IDs.tenantA, IDs.tenantB]);
  await q("INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES ($1, $2, 'SYN-A', 'Unidade A'), ($3, $4, 'SYN-B', 'Unidade B')", [IDs.storeA, IDs.tenantA, IDs.storeB, IDs.tenantB]);
  await q("INSERT INTO usuarios (id, empresa_id, nome) VALUES ($1, $2, 'Usuário A'), ($3, $4, 'Usuário B')", [IDs.userA, IDs.tenantA, IDs.userB, IDs.tenantB]);
  await q(`INSERT INTO commerce_permissions (id, codigo, descricao) VALUES
    ($1, 'reports.read', 'Visualizar relatórios'), ($2, 'catalog.write', 'Editar catálogo')`, [IDs.permissionReports, IDs.permissionCatalog]);
  await q(`INSERT INTO commerce_roles (id, empresa_id, codigo, nome, sistema) VALUES
    ($1, NULL, 'catalog_manager', 'Gestor de catálogo', true),
    ($2, NULL, 'reports_reader', 'Leitor de relatórios', true)`, [IDs.roleA, IDs.roleB]);
  await q(`INSERT INTO commerce_role_permissions (role_id, permission_id) VALUES
    ($1, $2), ($1, $3)`, [IDs.roleA, IDs.permissionReports, IDs.permissionCatalog]);
  await q(`INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo, expires_at)
    VALUES ($1, $2, $3, $4, true, NULL), ($5, $6, $7, $4, true, NULL)`, [
    IDs.tenantA, IDs.userA, IDs.storeA, IDs.roleA, IDs.tenantB, IDs.userB, IDs.storeB,
  ]);
  await q("INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, status) VALUES ($1, $2, $3, 'SF-A', 'Storefront A', 'active'), ($4, $5, $6, 'SF-B', 'Storefront B', 'active')", [IDs.storefrontA, IDs.tenantA, IDs.storeA, IDs.storefrontB, IDs.tenantB, IDs.storeB]);
  await q("INSERT INTO commerce_inventory_locations (id, empresa_id, loja_id, codigo, nome) VALUES ($1, $2, $3, 'LOC-A', 'Local A'), ($4, $5, $6, 'LOC-B', 'Local B')", [IDs.locationA, IDs.tenantA, IDs.storeA, IDs.locationB, IDs.tenantB, IDs.storeB]);
  await q("INSERT INTO commerce_price_lists (id, empresa_id, codigo, nome) VALUES ($1, $2, 'WEB-A', 'Preço A'), ($3, $4, 'WEB-B', 'Preço B'), ($5, $2, 'WEB-ALT-A', 'Preço alternativo A')", [IDs.priceListA, IDs.tenantA, IDs.priceListB, IDs.tenantB, IDs.priceListAlt]);
  await insertProduct(client, {
    tenant: IDs.tenantA, store: IDs.storeA, product: IDs.productA, variant: IDs.variantA,
    channel: IDs.channelA, price: IDs.priceA, priceList: IDs.priceListA, sourceId: BASE_ITEM.sourceId,
    sku: BASE_ITEM.sku, barcode: '7890000000000', ncm: '33049910', cost: 10,
  });
  await insertProduct(client, {
    tenant: IDs.tenantA, store: IDs.storeA, product: IDs.productC, variant: IDs.variantC,
    channel: IDs.channelC, price: IDs.priceC, priceList: IDs.priceListA, sourceId: CONCURRENT_ITEM.sourceId,
    sku: CONCURRENT_ITEM.sku, barcode: '7890000000017', ncm: '33049911', cost: 18,
  });
  await insertProduct(client, {
    tenant: IDs.tenantB, store: IDs.storeB, product: IDs.productB, variant: IDs.variantB,
    channel: IDs.channelB, price: IDs.priceB, priceList: IDs.priceListB, sourceId: 'AVEC-SYNTH-B',
    sku: 'DINO-SYNTH-B', barcode: '7890000000024', ncm: '33049912', cost: 11,
  });
  await insertProduct(client, {
    tenant: IDs.tenantA, store: IDs.storeA, product: IDs.productD, variant: IDs.variantD,
    channel: IDs.channelD, price: IDs.priceD, priceList: IDs.priceListA, sourceId: COLLISION_ITEM.sourceId,
    sku: COLLISION_ITEM.sku, barcode: '7890000000031', ncm: '33049913', cost: 20,
  });
  await q(`INSERT INTO commerce_variant_prices
    (id, empresa_id, price_list_id, variant_id, preco, preco_promocional, custo, vigencia_inicio, vigencia_fim)
    VALUES ($1, $2, $3, $4, 19.99, 17.99, 9.99, '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z')`,
  [IDs.priceHistoryA, IDs.tenantA, IDs.priceListA, IDs.variantA]);
  await q(`INSERT INTO commerce_variant_prices
    (id, empresa_id, price_list_id, variant_id, preco, preco_promocional, custo, vigencia_inicio, vigencia_fim)
    VALUES ($1, $2, $3, $4, 19.99, 17.99, 11.11, '2026-01-01T00:00:00Z', NULL)`,
  [IDs.priceAltA, IDs.tenantA, IDs.priceListAlt, IDs.variantA]);
}

async function insertProduct(client, data) {
  const storefront = data.storefront || (data.tenant === IDs.tenantA ? IDs.storefrontA : IDs.storefrontB);
  const location = data.location || (data.tenant === IDs.tenantA ? IDs.locationA : IDs.locationB);
  await client.query(`INSERT INTO commerce_products
    (id, empresa_id, slug, nome, status, descricao, descricao_curta, dados_fiscais, seo, publicado_em)
    VALUES ($1, $2, $3, $4, 'active', 'Descrição imutável', 'Resumo imutável', $5::jsonb, $6::jsonb, '2026-01-01T00:00:00Z')`, [
    data.product, data.tenant, `synthetic-${data.product.slice(0, 8)}`, 'Produto sintético',
    JSON.stringify({ ncm: data.ncm, origem: 'fixture' }), JSON.stringify({ title: 'SEO intacto' }),
  ]);
  await client.query(`INSERT INTO commerce_product_variants
    (id, empresa_id, product_id, sku, barcode, nome, atributos, peso_gramas, largura_cm, altura_cm, comprimento_cm)
    VALUES ($1, $2, $3, $4, $5, 'Variante sintética', $6::jsonb, 250, 2.10, 3.20, 4.30)`, [
    data.variant, data.tenant, data.product, data.sku, data.barcode,
    JSON.stringify({ unidade_medida: 'UN', cor: 'azul' }),
  ]);
  await client.query(`INSERT INTO commerce_product_channels
    (id, empresa_id, storefront_id, product_id, price_list_id, publicado)
    VALUES ($1, $2, $3, $4, $5, true)`, [data.channel, data.tenant, storefront, data.product, data.priceList]);
  await client.query(`INSERT INTO commerce_variant_prices
    (id, empresa_id, price_list_id, variant_id, preco, preco_promocional, custo, vigencia_inicio, vigencia_fim)
    VALUES ($1, $2, $3, $4, 19.99, 17.99, $5, '2026-01-01T00:00:00Z', NULL)`, [
    data.price, data.tenant, data.priceList, data.variant, data.cost,
  ]);
  await client.query(`INSERT INTO commerce_inventory_levels
    (id, empresa_id, location_id, variant_id, disponivel, reservado, comprometido, minimo)
    VALUES (gen_random_uuid(), $1, $2, $3, 42, 3, 1, 5)`, [data.tenant, location, data.variant]);
  await client.query(`INSERT INTO commerce_product_media
    (id, empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem)
    VALUES (gen_random_uuid(), $1, $2, $3, 'synthetic/media.webp', 'https://invalid.synthetic/media.webp', 'image/webp', 'mídia intacta', 1)`, [
    data.tenant, data.product, data.variant,
  ]);
  await client.query(`INSERT INTO commerce_legacy_imports
    (id, empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash)
    VALUES (gen_random_uuid(), $1, $2, 'avec', 'product', $3, $4, 'fixture-payload-hash')`, [
    data.tenant, data.store, data.sourceId, data.product,
  ]);
}

async function dbQuery(text, values = [], client = fixture.client) {
  return client.query(text, values);
}

async function inTransaction(client, callback) {
  await client.query('BEGIN');
  const trx = { query: (text, values = []) => client.query(text, values) };
  try {
    const result = await callback(trx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function execute(context, input, client = fixture.client) {
  return executeAvecCatalogEnrichment(context, input, {
    transaction: callback => inTransaction(client, callback),
  });
}

function executeWithTransaction(context, input, client, transaction) {
  return executeAvecCatalogEnrichment(context, input, { transaction: callback => transaction(client, callback) });
}

function preview(context, input, client = fixture.client) {
  return previewAvecCatalogEnrichment(context, input, {
    readClient: { query: (text, values = []) => client.query(text, values) },
  });
}

async function snapshot(productId = IDs.productA, variantId = IDs.variantA, priceId = IDs.priceA) {
  const product = await dbQuery('SELECT slug, status, descricao, descricao_curta, dados_fiscais, seo, publicado_em FROM commerce_products WHERE id = $1', [productId]);
  const variant = await dbQuery('SELECT sku, barcode, atributos, peso_gramas, largura_cm, altura_cm, comprimento_cm FROM commerce_product_variants WHERE id = $1', [variantId]);
  const price = await dbQuery('SELECT preco::text, preco_promocional::text, vigencia_inicio, vigencia_fim FROM commerce_variant_prices WHERE id = $1', [priceId]);
  const prices = await dbQuery('SELECT id, preco::text, preco_promocional::text, custo::text, vigencia_inicio, vigencia_fim FROM commerce_variant_prices WHERE variant_id = $1 ORDER BY vigencia_inicio, id', [variantId]);
  const inventory = await dbQuery('SELECT disponivel, reservado, comprometido, minimo FROM commerce_inventory_levels WHERE variant_id = $1', [variantId]);
  const media = await dbQuery('SELECT storage_key, public_url, mime_type, alt_text, ordem FROM commerce_product_media WHERE product_id = $1 ORDER BY ordem', [productId]);
  const audit = await dbQuery('SELECT count(*)::int AS count FROM commerce_audit_logs WHERE entidade_id = $1', [productId]);
  const idem = await dbQuery('SELECT count(*)::int AS count FROM commerce_idempotency_keys WHERE empresa_id = $1', [IDs.tenantA]);
  return {
    product: product.rows[0], variant: variant.rows[0], price: price.rows[0], prices: prices.rows, inventory: inventory.rows,
    media: media.rows, auditCount: audit.rows[0].count, idemCount: idem.rows[0].count,
  };
}

async function latestAudit(productId = IDs.productA) {
  const result = await dbQuery(`SELECT antes, depois, correlation_id, entidade, entidade_id, acao
    FROM commerce_audit_logs WHERE entidade_id = $1 ORDER BY id DESC LIMIT 1`, [productId]);
  return result.rows[0] || null;
}

before(async () => {
  fixture = await createFixture();
});

after(async () => {
  if (fixture) await fixture.close();
});

test('PG real: preview não faz DML e happy path grava somente custo, barcode, NCM e auditoria', async () => {
  const beforePreview = await snapshot();
  const result = await preview(contextA, inputFor([BASE_ITEM]));
  assert.equal(result.summary.proposable, 1);
  assert.deepEqual(result.items[0].proposal.changes, ['custo', 'ean', 'ncm']);
  assert.match(result.previewHash, /^[0-9a-f]{64}$/);
  assert.equal((await snapshot()).auditCount, beforePreview.auditCount);
  assert.deepEqual((await snapshot()).product, beforePreview.product);
  assert.deepEqual((await snapshot()).variant, beforePreview.variant);
  assert.deepEqual((await snapshot()).price, beforePreview.price);
  assert.deepEqual((await snapshot()).inventory, beforePreview.inventory);
  assert.deepEqual((await snapshot()).media, beforePreview.media);

  const execution = await execute(contextA, inputFor([BASE_ITEM], {
    confirmExecution: true, previewHash: result.previewHash, idempotencyKey: 'happy-synthetic-001',
  }));
  assert.deepEqual(execution.summary, { total: 1, updated: 1, unchanged: 0 });
  assert.equal(execution.performed, true);
  const afterExecution = await snapshot();
  assert.equal(afterExecution.variant.barcode, BASE_ITEM.ean);
  assert.equal(afterExecution.product.dados_fiscais.ncm, BASE_ITEM.ncm);
  assert.equal(afterExecution.price.preco, beforePreview.price.preco);
  assert.equal(afterExecution.price.preco_promocional, beforePreview.price.preco_promocional);
  assert.deepEqual(afterExecution.inventory, beforePreview.inventory);
  assert.deepEqual(afterExecution.product.slug, beforePreview.product.slug);
  assert.deepEqual(afterExecution.product.status, beforePreview.product.status);
  assert.deepEqual(afterExecution.product.publicado_em, beforePreview.product.publicado_em);
  assert.deepEqual(afterExecution.product.descricao, beforePreview.product.descricao);
  assert.deepEqual(afterExecution.product.seo, beforePreview.product.seo);
  assert.deepEqual(afterExecution.media, beforePreview.media);
  assert.equal(afterExecution.auditCount, beforePreview.auditCount + 1);
});

test('PG real: retry exato é replay idempotente e concorrência serializa uma única escrita', async () => {
  const retryDesired = { ...CONCURRENT_ITEM, custo: '21,09', ean: CONCURRENT_ITEM.ean, ncm: CONCURRENT_ITEM.ncm };
  const retryPreview = await preview(contextA, inputFor([retryDesired]));
  const retryInput = inputFor([retryDesired], {
    confirmExecution: true, previewHash: retryPreview.previewHash, idempotencyKey: 'retry-synthetic-001',
  });
  const first = await execute(contextA, retryInput);
  assert.equal(first.idempotentReplay, false);
  assert.equal(first.summary.updated, 1);
  const replay = await execute(contextA, retryInput);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.summary.updated, 1);

  const concurrentItem = { ...BASE_ITEM, custo: '12,35', ean: '7891234567895', ncm: '33049991' };
  const auditsBeforeConcurrency = (await snapshot()).auditCount;
  const concurrentPreview = await preview(contextA, inputFor([concurrentItem]));
  const client2 = new Client({ host: fixture.socket, port: fixture.port, database: fixture.database, user: fixture.owner, ssl: false });
  await client2.connect();
  try {
    const concurrentInput = inputFor([concurrentItem], {
      confirmExecution: true, previewHash: concurrentPreview.previewHash, idempotencyKey: 'concurrent-synthetic-001',
    });
    const results = await Promise.all([
      execute(contextA, concurrentInput, fixture.client),
      execute(contextA, concurrentInput, client2),
    ]);
    assert.equal(results.filter(item => item.idempotentReplay === false).length, 1);
    assert.equal(results.filter(item => item.idempotentReplay === true).length, 1);
  } finally {
    await client2.end();
  }
  const concurrentAfter = await snapshot();
  assert.equal(concurrentAfter.variant.barcode, concurrentItem.ean);
  assert.equal(concurrentAfter.product.dados_fiscais.ncm, concurrentItem.ncm);
  assert.equal(concurrentAfter.auditCount, auditsBeforeConcurrency + 1);
});

test('PG real: stale baseline e auditoria com falha fazem rollback sem efeitos residuais', async () => {
  const desired = { ...BASE_ITEM, custo: '15,55', ean: '7891234567819', ncm: '33049991' };
  const stalePreview = await preview(contextA, inputFor([desired]));
  const beforeStale = await snapshot();
  await dbQuery('UPDATE commerce_variant_prices SET custo = 16.66 WHERE id = $1', [IDs.priceA]);
  await assert.rejects(
    () => execute(contextA, inputFor([desired], {
      confirmExecution: true, previewHash: stalePreview.previewHash, idempotencyKey: 'stale-synthetic-001',
    })),
    error => error.code === 'AVEC_STALE_BASELINE',
  );
  const afterStale = await snapshot();
  assert.equal(afterStale.auditCount, beforeStale.auditCount);
  assert.equal(afterStale.idemCount, beforeStale.idemCount);
  assert.equal(afterStale.variant.barcode, beforeStale.variant.barcode);
  assert.equal(afterStale.product.dados_fiscais.ncm, beforeStale.product.dados_fiscais.ncm);
  await dbQuery('UPDATE commerce_variant_prices SET custo = 12.34 WHERE id = $1', [IDs.priceA]);

  await dbQuery(`
    CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic audit sink failure'; END; $$;
    CREATE TRIGGER synthetic_audit_failure_trigger BEFORE INSERT ON commerce_audit_logs
    FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure();
  `);
  const auditDesired = { ...BASE_ITEM, custo: '16,77', ean: '7891234567826', ncm: '33049993' };
  const auditPreview = await preview(contextA, inputFor([auditDesired]));
  const beforeAuditFailure = await snapshot();
  await assert.rejects(
    () => execute(contextA, inputFor([auditDesired], {
      confirmExecution: true, previewHash: auditPreview.previewHash, idempotencyKey: 'audit-failure-synthetic-001',
    })),
    /synthetic audit sink failure/,
  );
  const afterAuditFailure = await snapshot();
  assert.deepEqual(afterAuditFailure, beforeAuditFailure);
  await dbQuery('DROP TRIGGER synthetic_audit_failure_trigger ON commerce_audit_logs; DROP FUNCTION synthetic_audit_failure();');
});

test('PG real: no-change não altera campos de negócio e escopo impede tenant, unidade, storefront ou local cruzados', async () => {
  const currentItem = { ...BASE_ITEM, custo: '12,34', ean: BASE_ITEM.ean, ncm: '33049991' };
  const noChangePreview = await preview(contextA, inputFor([currentItem]));
  assert.equal(noChangePreview.summary.noChange, 1, JSON.stringify(noChangePreview.items[0]));
  const before = await snapshot();
  const noChange = await execute(contextA, inputFor([currentItem], {
    confirmExecution: true, previewHash: noChangePreview.previewHash, idempotencyKey: 'no-change-synthetic-001',
  }));
  assert.deepEqual(noChange.summary, { total: 1, updated: 0, unchanged: 1 });
  const after = await snapshot();
  assert.equal(after.auditCount, before.auditCount);
  assert.deepEqual(after.product, before.product);
  assert.deepEqual(after.variant, before.variant);
  assert.deepEqual(after.price, before.price);
  assert.deepEqual(after.inventory, before.inventory);
  assert.deepEqual(after.media, before.media);

  const cases = [
    [{ ...contextA, empresaId: IDs.tenantB, lojaId: IDs.storeB, usuarioId: IDs.userB }, inputFor([BASE_ITEM]), 'AVEC_SCOPE_MISMATCH'],
    [{ ...contextA, lojaId: IDs.storeB }, inputFor([BASE_ITEM]), 'PERMISSION_DENIED'],
    [contextA, { ...inputFor([BASE_ITEM]), storefrontId: IDs.storefrontB }, 'AVEC_SCOPE_MISMATCH'],
    [contextA, { ...inputFor([BASE_ITEM]), locationId: IDs.locationB }, 'AVEC_SCOPE_MISMATCH'],
    [{ ...contextA, usuarioId: IDs.userB }, inputFor([BASE_ITEM]), 'PERMISSION_DENIED'],
  ];
  for (const [context, input, code] of cases) {
    await assert.rejects(() => preview(context, input), error => error.code === code);
  }
  assert.equal((await snapshot()).auditCount, after.auditCount);
});

test('PG real: capabilities falsas não vencem membership revogada, expirada ou sem catalog.write', async () => {
  const current = { ...BASE_ITEM, custo: '13,10', ncm: '33049991' };
  const baseline = await preview(contextA, inputFor([current]));
  const before = await snapshot();
  try {
    await dbQuery('UPDATE commerce_memberships SET ativo = false WHERE empresa_id=$1 AND usuario_id=$2', [IDs.tenantA, IDs.userA]);
    await assert.rejects(() => preview(contextA, inputFor([current])), error => error.code === 'PERMISSION_DENIED');
    await dbQuery("UPDATE commerce_memberships SET ativo=true, expires_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE empresa_id=$1 AND usuario_id=$2", [IDs.tenantA, IDs.userA]);
    await assert.rejects(() => preview(contextA, inputFor([current])), error => error.code === 'PERMISSION_DENIED');
    await dbQuery('UPDATE commerce_memberships SET expires_at=NULL WHERE empresa_id=$1 AND usuario_id=$2', [IDs.tenantA, IDs.userA]);
    await dbQuery('DELETE FROM commerce_role_permissions WHERE role_id=$1 AND permission_id=$2', [IDs.roleA, IDs.permissionCatalog]);
    await assert.rejects(() => execute(contextA, inputFor([current], { confirmExecution: true, previewHash: baseline.previewHash, idempotencyKey: 'rbac-denied' })), error => error.code === 'PERMISSION_DENIED');
    assert.equal((await snapshot()).auditCount, before.auditCount);
    assert.equal((await snapshot()).idemCount, before.idemCount);
  } finally {
    await dbQuery('UPDATE commerce_memberships SET ativo=true, expires_at=NULL WHERE empresa_id=$1 AND usuario_id=$2', [IDs.tenantA, IDs.userA]);
    await dbQuery('INSERT INTO commerce_role_permissions(role_id,permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [IDs.roleA, IDs.permissionCatalog]);
  }
});

test('PG real: auditoria contém diff e IDs reais, não listas antes/depois idênticas', async () => {
  const desired = { ...COLLISION_ITEM };
  const baseline = await preview(contextA, inputFor([desired]));
  await execute(contextA, inputFor([desired], { confirmExecution: true, previewHash: baseline.previewHash, idempotencyKey: 'real-audit-diff' }));
  const audit = (await dbQuery('SELECT antes,depois,correlation_id FROM commerce_audit_logs WHERE entidade_id=$1 AND correlation_id=$2', [IDs.productD, baseline.previewHash])).rows[0];
  assert.equal(audit.antes.fields.costCents, 2000);
  assert.equal(audit.depois.fields.costCents, 2222);
  assert.notDeepEqual(audit.antes.fields, audit.depois.fields);
  assert.equal(audit.antes.variantId, IDs.variantD);
  assert.equal(audit.antes.priceId, IDs.priceD);
  assert.equal(audit.antes.channelId, IDs.channelD);
  assert.equal(audit.depois.previewHash, baseline.previewHash);
});

test('PG real: dois produtos e keys diferentes disputando um EAN gravam somente um lote', async () => {
  const barcode = '7891234567840';
  const itemC = { ...CONCURRENT_ITEM, ean: barcode, custo: '25,01' };
  const itemD = { ...COLLISION_ITEM, ean: barcode, custo: '26,02' };
  const baselineC = await preview(contextA, inputFor([itemC]));
  const baselineD = await preview(contextA, inputFor([itemD]));
  const countBefore = (await dbQuery('SELECT count(*)::int AS n FROM commerce_audit_logs WHERE empresa_id=$1', [IDs.tenantA])).rows[0].n;
  const client2 = new Client({ host: fixture.socket, port: fixture.port, database: fixture.database, user: fixture.owner, ssl: false });
  await client2.connect();
  try {
    const results = await Promise.allSettled([
      execute(contextA, inputFor([itemC], { confirmExecution:true, previewHash:baselineC.previewHash, idempotencyKey:'collision-c' }), fixture.client),
      execute(contextA, inputFor([itemD], { confirmExecution:true, previewHash:baselineD.previewHash, idempotencyKey:'collision-d' }), client2),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected');
    assert.ok(['AVEC_STALE_BASELINE','AVEC_BATCH_BLOCKED','AVEC_BARCODE_CONFLICT'].includes(rejected.reason.code));
    assert.equal((await dbQuery('SELECT count(*)::int AS n FROM commerce_product_variants WHERE empresa_id=$1 AND barcode=$2', [IDs.tenantA, barcode])).rows[0].n, 1);
    assert.equal((await dbQuery('SELECT count(*)::int AS n FROM commerce_audit_logs WHERE empresa_id=$1', [IDs.tenantA])).rows[0].n, countBefore + 1);
  } finally { await client2.end(); }
});

test('PG real: locks impedem trocar ledger e inserir preço corrente durante o trecho crítico', async () => {
  const desired = { ...BASE_ITEM, custo:'13,10', ncm:'33049991' };
  const baseline = await preview(contextA, inputFor([desired]));
  const client2 = new Client({ host: fixture.socket, port: fixture.port, database: fixture.database, user: fixture.owner, ssl: false });
  await client2.connect(); let proofs = 0;
  const blocked = async (sql, params) => {
    await client2.query('BEGIN');
    try {
      await client2.query("SET LOCAL lock_timeout='100ms'");
      await assert.rejects(() => client2.query(sql, params), error => error.code === '55P03');
      proofs += 1;
    } finally { await client2.query('ROLLBACK'); }
  };
  try {
    await executeAvecCatalogEnrichment(contextA, inputFor([desired], {
      confirmExecution:true, previewHash:baseline.previewHash, idempotencyKey:'lock-proofs',
    }), { transaction: callback => inTransaction(fixture.client, trx => callback({ query: async (sql, params) => {
      if (sql.includes('INSERT INTO commerce_idempotency_keys')) {
        await blocked("UPDATE commerce_legacy_imports SET payload_hash='concurrent-change' WHERE empresa_id=$1 AND legacy_key=$2", [IDs.tenantA, BASE_ITEM.sourceId]);
        await blocked('INSERT INTO commerce_variant_prices(id,empresa_id,price_list_id,variant_id,preco,custo,vigencia_inicio) VALUES(gen_random_uuid(),$1,$2,$3,19.99,10,CURRENT_TIMESTAMP)', [IDs.tenantA, IDs.priceListA, IDs.variantA]);
        await blocked('UPDATE commerce_variant_prices SET custo=8.88 WHERE id=$1', [IDs.priceHistoryA]);
      }
      return trx.query(sql, params);
    }})) });
    assert.equal(proofs, 3);
  } finally { await client2.end(); }
});
