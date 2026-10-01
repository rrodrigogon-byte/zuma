import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after } from 'node:test';
import pg from 'pg';
import {
  archiveCatalogProduct,
  createCatalogMedia,
  createCatalogVariant,
  deleteCatalogMedia,
  saveCatalogProductWorkspace,
  setVariantPrice,
  updateCatalogProduct,
  updateCatalogVariant,
} from './commerce-core.js';
import { executeCatalogImport, previewCatalogImport } from './commerce-catalog-import.js';

const { Pool } = pg;
const connectionString = process.env.COMMERCE_PRODUCT_ADMIN_TEST_DATABASE_URL || '';
const enabled = Boolean(connectionString);
const pool = enabled ? new Pool({ connectionString, ssl: false, max: 8 }) : null;

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (sql, values = []) => client.query(sql, values) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fixture() {
  const ids = {
    empresa: crypto.randomUUID(),
    loja: crypto.randomUUID(),
    outraLoja: crypto.randomUUID(),
    usuario: crypto.randomUUID(),
    storefront: crypto.randomUUID(),
    outroStorefront: crypto.randomUUID(),
    location: crypto.randomUUID(),
    outraLocation: crypto.randomUUID(),
  };
  const suffix = ids.empresa.replaceAll('-', '').slice(0, 12);
  await pool.query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio)
     VALUES ($1, 'Catálogo Teste', $2, 'Catálogo Teste', 'loja')`,
    [ids.empresa, `91${suffix}`.slice(0, 14)],
  );
  await pool.query(
    `INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES
       ($1, $3, 'MATRIZ', 'Matriz'),
       ($2, $3, 'OUTRA', 'Outra')`,
    [ids.loja, ids.outraLoja, ids.empresa],
  );
  await pool.query(
    `INSERT INTO usuarios (id, empresa_id, email, senha_hash, nome_completo, role)
     VALUES ($1, $2, $3, 'not-a-real-hash', 'Catálogo Teste', 'admin')`,
    [ids.usuario, ids.empresa, `catalog-${suffix}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, status) VALUES
       ($1, $3, $4, 'web-test', 'Web Teste', 'active'),
       ($2, $3, $4, 'web-outro', 'Web Outro', 'active')`,
    [ids.storefront, ids.outroStorefront, ids.empresa, ids.loja],
  );
  await pool.query(
    `INSERT INTO commerce_inventory_locations (id, empresa_id, loja_id, codigo, nome) VALUES
       ($1, $3, $4, 'matriz-estoque', 'Matriz · Estoque'),
       ($2, $3, $5, 'outra-estoque', 'Outra · Estoque')`,
    [ids.location, ids.outraLocation, ids.empresa, ids.loja, ids.outraLoja],
  );
  return { ids, context: { empresaId: ids.empresa, lojaId: ids.loja, usuarioId: ids.usuario, capabilities: ['catalog.write', 'catalog.publish', 'inventory.write'] } };
}

if (pool) after(async () => { await pool.end(); });
const pgTest = (name, fn) => test(name, { skip: !enabled }, async () => fn(await fixture()));

function payload(ids, overrides = {}) {
  return {
    idempotencyKey: 'catalog-save-1',
    storefrontId: ids.storefront,
    locationId: ids.location,
    product: { nome: 'Produto Transacional', tipo: 'physical', status: 'active', descricaoCurta: 'Teste real' },
    variant: { sku: 'CAT-001' },
    price: 29.9,
    promotionalPrice: 24.9,
    targetStock: 7,
    published: true,
    ...overrides,
  };
}

async function counts(ids) {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_products WHERE empresa_id=$1) AS products,
       (SELECT COUNT(*)::int FROM commerce_product_variants WHERE empresa_id=$1) AS variants,
       (SELECT COUNT(*)::int FROM commerce_variant_prices WHERE empresa_id=$1) AS prices,
       (SELECT COUNT(*)::int FROM commerce_product_channels WHERE empresa_id=$1) AS channels,
       (SELECT COUNT(*)::int FROM commerce_inventory_movements WHERE empresa_id=$1) AS movements,
       (SELECT COALESCE(SUM(disponivel),0)::int FROM commerce_inventory_levels WHERE empresa_id=$1 AND location_id=$2) AS stock`,
    [ids.empresa, ids.location],
  );
  return result.rows[0];
}

async function catalogStateHash(empresaId) {
  const result = await pool.query(
    `SELECT md5(jsonb_build_object(
       'products', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_products WHERE empresa_id=$1) x),
       'variants', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_product_variants WHERE empresa_id=$1) x),
       'media', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_product_media WHERE empresa_id=$1) x),
       'prices', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_variant_prices WHERE empresa_id=$1) x),
       'channels', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_product_channels WHERE empresa_id=$1) x),
       'levels', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_inventory_levels WHERE empresa_id=$1) x),
       'movements', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_inventory_movements WHERE empresa_id=$1) x),
       'audit', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_audit_logs WHERE empresa_id=$1) x),
       'idempotency', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_idempotency_keys WHERE empresa_id=$1) x)
     )::text) AS state_hash`,
    [empresaId],
  );
  return result.rows[0].state_hash;
}

pgTest('save do workspace cria produto, preço, canal e estoque na mesma transação', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  assert.equal(saved.status, 'active');
  assert.equal(saved.published, true);
  assert.equal(saved.inventory.disponivel, 7);
  assert.deepEqual(await counts(ids), { products: 1, variants: 1, prices: 1, channels: 1, movements: 1, stock: 7 });
});

pgTest('replay e duas submissões concorrentes da mesma chave não duplicam produto ou estoque', async ({ ids, context }) => {
  const [first, second] = await Promise.all([
    transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids))),
    transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids))),
  ]);
  assert.equal(first.productId, second.productId);
  assert.deepEqual(await counts(ids), { products: 1, variants: 1, prices: 1, channels: 1, movements: 1, stock: 7 });
  const replay = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  assert.equal(replay.productId, first.productId);
  assert.deepEqual(await counts(ids), { products: 1, variants: 1, prices: 1, channels: 1, movements: 1, stock: 7 });
});

pgTest('mesma chave com payload diferente retorna IDEMPOTENCY_CONFLICT e preserva o estado', async ({ ids, context }) => {
  await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { targetStock: 8 }))),
    error => error.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.deepEqual(await counts(ids), { products: 1, variants: 1, prices: 1, channels: 1, movements: 1, stock: 7 });
});

pgTest('local de outra loja é rejeitado antes de criar produto', async ({ ids, context }) => {
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { idempotencyKey: 'scope-test', locationId: ids.outraLocation }))),
    error => error.code === 'INVENTORY_LOCATION_SCOPE_MISMATCH',
  );
  assert.deepEqual(await counts(ids), { products: 0, variants: 0, prices: 0, channels: 0, movements: 0, stock: 0 });
});

pgTest('produto arquivado é retirado do canal e não pode ser reativado silenciosamente', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  const media = await transaction(trx => createCatalogMedia(trx, context, saved.productId, { storefrontId: ids.storefront, url: 'https://example.invalid/catalog-test.webp' }));
  await assert.rejects(
    () => transaction(trx => updateCatalogProduct(trx, context, saved.productId, { storefrontId: ids.storefront, status: 'archived' })),
    error => error.code === 'PRODUCT_ARCHIVE_REQUIRED',
  );
  await transaction(trx => archiveCatalogProduct(trx, context, saved.productId, { storefrontId: ids.storefront }));
  const channel = await pool.query('SELECT publicado FROM commerce_product_channels WHERE empresa_id=$1 AND product_id=$2', [ids.empresa, saved.productId]);
  assert.equal(channel.rows[0].publicado, false);
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { idempotencyKey: 'archived-edit', productId: saved.productId, targetStock: 9 }))),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => updateCatalogProduct(trx, context, saved.productId, { storefrontId: ids.storefront, nome: 'Tentativa incompatível' })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => createCatalogVariant(trx, context, saved.productId, { storefrontId: ids.storefront, sku: 'CAT-ARCHIVED-NEW' })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => updateCatalogVariant(trx, context, saved.variantId, { storefrontId: ids.storefront, nome: 'Tentativa incompatível' })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => setVariantPrice(trx, context, saved.productId, { storefrontId: ids.storefront, variantId: saved.variantId, preco: 99.9 })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => createCatalogMedia(trx, context, saved.productId, { storefrontId: ids.storefront, url: 'https://example.invalid/blocked.webp' })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  await assert.rejects(
    () => transaction(trx => deleteCatalogMedia(trx, context, media.id, { storefrontId: ids.storefront })),
    error => error.code === 'PRODUCT_ARCHIVED',
  );
  const stock = await pool.query('SELECT disponivel::int FROM commerce_inventory_levels WHERE empresa_id=$1 AND location_id=$2', [ids.empresa, ids.location]);
  assert.equal(stock.rows[0].disponivel, 7);
  const immutable = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_product_variants WHERE empresa_id=$1 AND product_id=$2) AS variants,
       (SELECT COUNT(*)::int FROM commerce_variant_prices WHERE empresa_id=$1 AND variant_id=$3) AS prices,
       (SELECT COUNT(*)::int FROM commerce_product_media WHERE empresa_id=$1 AND product_id=$2) AS media`,
    [ids.empresa, saved.productId, saved.variantId],
  );
  assert.deepEqual(immutable.rows[0], { variants: 1, prices: 1, media: 1 });
});

pgTest('edição preserva a lista de preços já vinculada ao storefront', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  const customPriceList = await pool.query(
    `INSERT INTO commerce_price_lists (empresa_id, codigo, nome, canal, moeda, ativo)
     VALUES ($1, 'web-custom', 'Tabela web customizada', 'web', 'BRL', true)
     RETURNING id`,
    [ids.empresa],
  );
  const priceListId = customPriceList.rows[0].id;
  await pool.query(
    'UPDATE commerce_product_channels SET price_list_id=$3 WHERE empresa_id=$1 AND product_id=$2 AND storefront_id=$4',
    [ids.empresa, saved.productId, priceListId, ids.storefront],
  );
  await pool.query(
    `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco)
     VALUES ($1, $2, $3, 29.90)`,
    [ids.empresa, priceListId, saved.variantId],
  );

  await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, {
    idempotencyKey: 'preserve-custom-price-list',
    productId: saved.productId,
    variant: { id: saved.variantId, sku: 'CAT-001' },
    price: 39.9,
  })));
  await transaction(trx => updateCatalogVariant(trx, context, saved.variantId, {
    storefrontId: ids.storefront,
    sku: 'CAT-001',
    preco: 49.9,
    precoPromocional: null,
  }));

  const channel = await pool.query(
    'SELECT price_list_id FROM commerce_product_channels WHERE empresa_id=$1 AND product_id=$2 AND storefront_id=$3',
    [ids.empresa, saved.productId, ids.storefront],
  );
  const currentPrice = await pool.query(
    `SELECT preco::numeric::float8 AS preco
       FROM commerce_variant_prices
      WHERE empresa_id=$1 AND price_list_id=$2 AND variant_id=$3 AND vigencia_fim IS NULL`,
    [ids.empresa, priceListId, saved.variantId],
  );
  assert.equal(channel.rows[0].price_list_id, priceListId);
  assert.equal(currentPrice.rows.length, 1);
  assert.equal(currentPrice.rows[0].preco, 49.9);
});

pgTest('edição rejeita produto sem vínculo com o storefront selecionado', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, {
      idempotencyKey: 'cross-storefront-edit',
      productId: saved.productId,
      storefrontId: ids.outroStorefront,
      variant: { id: saved.variantId, sku: 'CAT-001' },
      price: 99.9,
      targetStock: 12,
    }))),
    error => error.code === 'PRODUCT_STOREFRONT_SCOPE_MISMATCH',
  );
  assert.deepEqual(await counts(ids), { products: 1, variants: 1, prices: 1, channels: 1, movements: 1, stock: 7 });
});

pgTest('estoque alterado enquanto o formulário estava aberto não é sobrescrito', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  // Uma venda baixa o estoque de 7 para 6 depois que o formulário foi aberto com 7.
  await pool.query('UPDATE commerce_inventory_levels SET disponivel = 6 WHERE empresa_id=$1 AND variant_id=$2', [ids.empresa, saved.variantId]);
  const edit = (extra) => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { productId: saved.productId, variant: { id: saved.variantId, sku: 'CAT-001' }, targetStock: 10, ...extra })));
  await assert.rejects(() => edit({ idempotencyKey: 'stale-1', expectedStock: 7 }), error => error.code === 'INVENTORY_CHANGED');
  await assert.rejects(() => edit({ idempotencyKey: 'stale-2' }), error => error.code === 'INVENTORY_BASELINE_REQUIRED');
  const ok = await edit({ idempotencyKey: 'fresh-1', expectedStock: 6 });
  assert.equal(ok.inventory.disponivel ?? ok.inventory.disponivel_atual ?? 10, 10);
  const level = await pool.query('SELECT disponivel FROM commerce_inventory_levels WHERE empresa_id=$1 AND variant_id=$2', [ids.empresa, saved.variantId]);
  assert.equal(Number(level.rows[0].disponivel), 10);
});

pgTest('quem só edita catálogo não tira produto da vitrine', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  const base = { productId: saved.productId, variant: { id: saved.variantId, sku: 'CAT-001' }, expectedStock: 7 };
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { ...base, idempotencyKey: 'unpub-1', published: false, product: { nome: 'Produto Transacional', tipo: 'physical', status: 'draft' } }))),
    error => error.code === 'PERMISSION_DENIED',
  );
  const allowed = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { ...base, idempotencyKey: 'unpub-2', canPublish: true, published: false, product: { nome: 'Produto Transacional', tipo: 'physical', status: 'draft' } })));
  assert.equal(allowed.published, false);
});

pgTest('imagem só de upload da loja ou HTTPS permitido', async ({ ids, context }) => {
  for (const url of ['http://example.com/a.png', 'https://rastreador.example/pixel.gif', 'javascript:alert(1)', 'https://user:pw@storage.googleapis.com/x.png']) {
    await assert.rejects(
      () => transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { idempotencyKey: `media-${url.length}`, media: { url } }))),
      error => error.code === 'MEDIA_URL_NOT_ALLOWED', url,
    );
  }
  const ok = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids, { idempotencyKey: 'media-ok', media: { url: 'https://storage.googleapis.com/dino-media/perfume.webp', altText: 'Perfume' } })));
  assert.ok(ok.productId);
});

pgTest('importação atualiza produto e preço existentes no storefront da loja', async ({ ids, context }) => {
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, context, payload(ids)));
  const importInput = {
    storefrontId: ids.storefront,
    locationId: ids.location,
    sourceLabel: 'teste PostgreSQL de atualização',
    items: [{ sku: 'CAT-001', produto: 'Produto Atualizado pela Importação', categoria: 'Importados', preco: 44.5, estoque: 7, acao: 'publicar' }],
  };
  const preview = await previewCatalogImport(context, importInput);
  assert.equal(preview.summary.update, 1);
  const result = await executeCatalogImport(context, { ...importInput, previewHash: preview.previewHash, idempotencyKey: `catalog-import-${ids.empresa}`, confirmImport: true });
  assert.equal(result.summary.updated, 1);
  const updated = await pool.query('SELECT nome FROM commerce_products WHERE empresa_id=$1 AND id=$2', [ids.empresa, saved.productId]);
  const price = await pool.query(
    `SELECT vp.preco::numeric::float8 AS preco
       FROM commerce_variant_prices vp
       JOIN commerce_product_channels pc ON pc.empresa_id=vp.empresa_id AND pc.price_list_id=vp.price_list_id
      WHERE vp.empresa_id=$1 AND vp.variant_id=$2 AND pc.storefront_id=$3 AND vp.vigencia_fim IS NULL`,
    [ids.empresa, saved.variantId, ids.storefront],
  );
  assert.equal(updated.rows[0].nome, 'Produto Atualizado pela Importação');
  assert.equal(price.rows[0].preco, 44.5);
});

pgTest('capability ausente falha antes de qualquer DML do workspace', async ({ ids, context }) => {
  const before = await catalogStateHash(ids.empresa);
  await assert.rejects(
    () => transaction(trx => saveCatalogProductWorkspace(trx, { ...context, capabilities: [] }, payload(ids, { idempotencyKey: 'permission-denied' }))),
    error => error.code === 'PERMISSION_DENIED',
  );
  assert.equal(await catalogStateHash(ids.empresa), before);
});

pgTest('tenant B não altera produto, variante, preço, mídia, canal ou estoque do tenant A', async ({ ids: idsA, context: contextA }) => {
  const { ids: idsB, context: contextB } = await fixture();
  const saved = await transaction(trx => saveCatalogProductWorkspace(trx, contextA, payload(idsA)));
  const media = await transaction(trx => createCatalogMedia(trx, contextA, saved.productId, { storefrontId: idsA.storefront, url: 'https://example.invalid/cross-tenant.webp' }));
  const beforeA = await catalogStateHash(idsA.empresa);
  const beforeB = await catalogStateHash(idsB.empresa);
  const isolated = error => ['PRODUCT_NOT_FOUND', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH', 'VARIANT_NOT_FOUND', 'MEDIA_NOT_FOUND'].includes(error.code);

  await assert.rejects(() => transaction(trx => saveCatalogProductWorkspace(trx, contextB, payload(idsB, {
    idempotencyKey: 'cross-tenant-workspace',
    productId: saved.productId,
    variant: { id: saved.variantId, sku: 'CAT-001' },
  }))), isolated);
  await assert.rejects(() => transaction(trx => updateCatalogProduct(trx, contextB, saved.productId, { storefrontId: idsB.storefront, nome: 'Cross tenant' })), isolated);
  await assert.rejects(() => transaction(trx => createCatalogVariant(trx, contextB, saved.productId, { storefrontId: idsB.storefront, sku: 'CROSS-TENANT' })), isolated);
  await assert.rejects(() => transaction(trx => updateCatalogVariant(trx, contextB, saved.variantId, { storefrontId: idsB.storefront, nome: 'Cross tenant' })), isolated);
  await assert.rejects(() => transaction(trx => setVariantPrice(trx, contextB, saved.productId, { storefrontId: idsB.storefront, variantId: saved.variantId, preco: 199 })), isolated);
  await assert.rejects(() => transaction(trx => createCatalogMedia(trx, contextB, saved.productId, { storefrontId: idsB.storefront, url: 'https://example.invalid/blocked.webp' })), isolated);
  await assert.rejects(() => transaction(trx => deleteCatalogMedia(trx, contextB, media.id, { storefrontId: idsB.storefront })), isolated);
  await assert.rejects(() => transaction(trx => archiveCatalogProduct(trx, contextB, saved.productId, { storefrontId: idsB.storefront })), isolated);

  assert.equal(await catalogStateHash(idsA.empresa), beforeA);
  assert.equal(await catalogStateHash(idsB.empresa), beforeB);
});
