#!/usr/bin/env node
/**
 * Importa o catálogo e o histórico da loja JSON para o Commerce Core.
 *
 * Segurança operacional:
 * - sem --apply, somente lê o JSON e produz um plano/dry-run;
 * - --apply exige COMMERCE_IMPORT_CONFIRM=IMPORT_LEGACY_TO_COMMERCE;
 * - exige empresa e storefront informados explicitamente;
 * - cada entidade é registrada em commerce_legacy_imports e pode ser reexecutada;
 * - não migra senhas, cartões, secrets ou pagamentos como pagos.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../core/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = process.env.LEGACY_DB_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const SOURCE = 'legacy-json-store';

function arg(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find(value => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

function hasFlag(name) { return process.argv.includes(`--${name}`); }
function text(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function slug(value) {
  const result = text(value, 180).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return result || `legacy-${crypto.randomBytes(5).toString('hex')}`;
}
function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}
function integer(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
function readJson(file) {
  return fs.readFile(file, 'utf8').then(raw => JSON.parse(raw));
}
function legacyProducts(data) {
  return Array.isArray(data.loja) ? data.loja : Array.isArray(data.produtos) ? data.produtos : [];
}
function legacyOrders(data) { return Array.isArray(data.pedidosLoja) ? data.pedidosLoja : []; }
function legacyStatus(value) {
  return ({ pendente: 'pending_payment', preparando: 'processing', pronto: 'ready', entregue: 'completed', cancelado: 'cancelled' })[String(value || '').toLowerCase()] || 'pending_payment';
}
function normalizeCustomer(raw = {}) {
  return { nome: text(raw.nome || raw.name || 'Cliente legado', 300) || 'Cliente legado', email: text(raw.email, 320).toLowerCase() || null, telefone: text(raw.tel || raw.telefone || raw.phone, 40) || null };
}

function summarize(data) {
  const products = legacyProducts(data);
  const orders = legacyOrders(data);
  const categories = [...new Set(products.map(product => text(product.cat || product.categoria || 'Produto', 180)).filter(Boolean))];
  return {
    source: SOURCE,
    products: products.length,
    orders: orders.length,
    categories: categories.length,
    stockUnits: products.reduce((sum, product) => sum + integer(product.estoque), 0),
    orderValue: orders.reduce((sum, order) => sum + money(order.total), 0),
    statuses: orders.reduce((result, order) => { const key = legacyStatus(order.status); result[key] = (result[key] || 0) + 1; return result; }, {}),
  };
}

async function ensureTenant(trx, empresaId, storefrontId) {
  const storefront = await trx.query(
    `SELECT s.id, s.empresa_id, s.loja_id, s.moeda, s.status
       FROM commerce_storefronts s
      WHERE s.empresa_id = $1 AND s.id = $2 AND s.status = 'active'
      LIMIT 1`,
    [empresaId, storefrontId],
  );
  if (!storefront.rows[0]) throw new Error('storefront não encontrado, inativo ou fora da empresa informada');
  return storefront.rows[0];
}

async function importProduct(trx, { empresaId, storefront, product, categoryCache, priceListId, locationId }) {
  const legacyKey = text(product.id ?? product.cod ?? product.nome, 180);
  if (!legacyKey) throw new Error('produto legado sem id/código/nome');
  const payloadHash = hash(product);
  const prior = await trx.query(
    `SELECT target_id, payload_hash FROM commerce_legacy_imports
      WHERE empresa_id = $1 AND source = $2 AND entity = 'product' AND legacy_key = $3
      LIMIT 1`,
    [empresaId, SOURCE, legacyKey],
  );
  if (prior.rows[0] && prior.rows[0].payload_hash === payloadHash) {
    const variant = await trx.query(`SELECT id FROM commerce_product_variants WHERE empresa_id = $1 AND product_id = $2 ORDER BY criado_em ASC LIMIT 1`, [empresaId, prior.rows[0].target_id]);
    return { id: prior.rows[0].target_id, variantId: variant.rows[0]?.id || null, reused: true };
  }

  const categoryName = text(product.cat || product.categoria || 'Produto', 180) || 'Produto';
  const categorySlug = slug(categoryName);
  let categoryId = categoryCache.get(categorySlug);
  if (!categoryId) {
    const category = await trx.query(
      `INSERT INTO commerce_categories (empresa_id, slug, nome, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ativo = true, atualizado_em = CURRENT_TIMESTAMP
       RETURNING id`,
      [empresaId, categorySlug, categoryName],
    );
    categoryId = category.rows[0].id;
    categoryCache.set(categorySlug, categoryId);
  }

  const name = text(product.nome || product.name || `Produto ${legacyKey}`, 300);
  const productSlug = `${slug(product.cod || name)}-${slug(legacyKey).slice(0, 40)}`.slice(0, 180);
  const productResult = await trx.query(
    `INSERT INTO commerce_products (empresa_id, category_id, slug, nome, tipo, status, descricao, descricao_curta, seo)
     VALUES ($1, $2, $3, $4, 'physical', 'active', $5, $6, $7::jsonb)
     ON CONFLICT (empresa_id, slug) DO UPDATE SET category_id = EXCLUDED.category_id, nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
       descricao_curta = EXCLUDED.descricao_curta, status = 'active', atualizado_em = CURRENT_TIMESTAMP
     RETURNING id`,
    [empresaId, categoryId, productSlug, name, text(product.descricao, 10000) || null, text(product.descricao, 500) || null, JSON.stringify({ legacyKey })],
  );
  const productId = productResult.rows[0].id;
  const sku = text(product.cod || `LEGACY-${legacyKey}`, 100).toUpperCase();
  const variantResult = await trx.query(
    `INSERT INTO commerce_product_variants (empresa_id, product_id, sku, nome, atributos, ativo)
     VALUES ($1, $2, $3, $4, $5::jsonb, true)
     ON CONFLICT (empresa_id, sku) DO UPDATE SET product_id = EXCLUDED.product_id, nome = EXCLUDED.nome, ativo = true, atualizado_em = CURRENT_TIMESTAMP
     RETURNING id`,
    [empresaId, productId, sku, name, JSON.stringify({ legacyId: product.id ?? null, legacyCategory: categoryName })],
  );
  const variantId = variantResult.rows[0].id;
  const original = money(product.precoOriginal ?? product.preco);
  const promotional = product.precoPromocional == null || product.precoPromocional === '' ? null : money(product.precoPromocional);
  const validPromotional = promotional != null && promotional < original ? promotional : null;
  await trx.query(
    `UPDATE commerce_variant_prices SET vigencia_fim = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND price_list_id = $2 AND variant_id = $3 AND vigencia_fim IS NULL`,
    [empresaId, priceListId, variantId],
  );
  await trx.query(
    `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco, preco_promocional, vigencia_inicio)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [empresaId, priceListId, variantId, original, validPromotional],
  );
  await trx.query(
    `INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (empresa_id, storefront_id, product_id) DO UPDATE SET price_list_id = EXCLUDED.price_list_id, publicado = true, atualizado_em = CURRENT_TIMESTAMP`,
    [empresaId, storefront.id, productId, priceListId],
  );
  await trx.query(
    `INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, location_id, variant_id) DO UPDATE SET disponivel = EXCLUDED.disponivel, atualizado_em = CURRENT_TIMESTAMP`,
    [empresaId, locationId, variantId, integer(product.estoque)],
  );
  if (product.imagem) {
    await trx.query(
      `INSERT INTO commerce_product_media (empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text)
       SELECT $1, $2, $3, $4, $4, 'image/*', $5
       WHERE NOT EXISTS (SELECT 1 FROM commerce_product_media WHERE empresa_id = $1 AND product_id = $2 AND public_url = $4)`,
      [empresaId, productId, variantId, text(product.imagem, 1000), name],
    );
  }
  await trx.query(
    `INSERT INTO commerce_legacy_imports (empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash, metadata)
     VALUES ($1, $2, $3, 'product', $4, $5, $6, $7::jsonb)
     ON CONFLICT (empresa_id, source, entity, legacy_key) DO UPDATE SET target_id = EXCLUDED.target_id, payload_hash = EXCLUDED.payload_hash, imported_at = CURRENT_TIMESTAMP, metadata = EXCLUDED.metadata`,
    [empresaId, storefront.loja_id || null, SOURCE, legacyKey, productId, payloadHash, JSON.stringify({ sku, category: categoryName })],
  );
  return { id: productId, variantId, reused: false };
}

async function findVariant(trx, empresaId, item, productMap) {
  const legacyKey = text(item.produtoId ?? item.id ?? item.cod ?? item.nome, 180);
  const mapped = productMap.get(legacyKey);
  if (mapped) return mapped;
  const result = await trx.query(
    `SELECT v.id FROM commerce_product_variants v
      JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
     WHERE v.empresa_id = $1 AND (v.sku = $2 OR lower(p.nome) = lower($3)) LIMIT 1`,
    [empresaId, text(item.cod, 100).toUpperCase(), text(item.nome, 300)],
  );
  return result.rows[0]?.id || null;
}

async function importOrder(trx, { empresaId, storefront, order, productMap }) {
  const legacyKey = text(order.codigo || order.id, 180);
  if (!legacyKey) throw new Error('pedido legado sem código/id');
  const payloadHash = hash(order);
  const prior = await trx.query(`SELECT target_id, payload_hash FROM commerce_legacy_imports WHERE empresa_id = $1 AND source = $2 AND entity = 'order' AND legacy_key = $3 LIMIT 1`, [empresaId, SOURCE, legacyKey]);
  if (prior.rows[0] && prior.rows[0].payload_hash === payloadHash) return { id: prior.rows[0].target_id, reused: true };
  const customer = normalizeCustomer(order.cliente);
  let customerId = null;
  if (customer.email) {
    const found = await trx.query(`SELECT id FROM commerce_customers WHERE empresa_id = $1 AND lower(email) = lower($2) LIMIT 1`, [empresaId, customer.email]);
    customerId = found.rows[0]?.id || null;
  }
  if (!customerId) {
    const created = await trx.query(`INSERT INTO commerce_customers (empresa_id, nome, email, telefone, consentimentos) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`, [empresaId, customer.nome, customer.email, customer.telefone, JSON.stringify({ legacyImport: true })]);
    customerId = created.rows[0].id;
  }
  const code = text(order.codigo || `LEGACY-${order.id}`, 40).toUpperCase();
  const lines = Array.isArray(order.itens) ? order.itens : [];
  const normalized = [];
  for (const item of lines) {
    const variantId = await findVariant(trx, empresaId, item, productMap);
    normalized.push({ variantId, nome: text(item.nome || 'Item legado', 300), quantidade: Math.max(1, integer(item.qtd || item.quantidade) || 1), preco: money(item.preco), subtotal: money(item.subtotal ?? money(item.preco) * Math.max(1, integer(item.qtd || item.quantidade) || 1)) });
  }
  const subtotal = normalized.reduce((sum, item) => sum + item.subtotal, 0);
  const total = money(order.total || subtotal);
  const orderResult = await trx.query(
    `INSERT INTO commerce_orders (empresa_id, storefront_id, customer_id, public_code, status, origem, moeda, subtotal, total, endereco_entrega, observacao, criado_em, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, 'web', 'BRL', $6, $7, $8::jsonb, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), COALESCE($10::timestamptz, CURRENT_TIMESTAMP))
     ON CONFLICT (empresa_id, public_code) DO UPDATE SET customer_id = EXCLUDED.customer_id, status = EXCLUDED.status, subtotal = EXCLUDED.subtotal, total = EXCLUDED.total, endereco_entrega = EXCLUDED.endereco_entrega, observacao = EXCLUDED.observacao, atualizado_em = CURRENT_TIMESTAMP
     RETURNING id`,
    [empresaId, storefront.id, customerId, code, legacyStatus(order.status), subtotal, total, JSON.stringify(order.entrega || null), text(order.observacao, 1000) || null, order.criadoEm || null],
  );
  const orderId = orderResult.rows[0].id;
  await trx.query(`DELETE FROM commerce_order_items WHERE empresa_id = $1 AND order_id = $2`, [empresaId, orderId]);
  for (const item of normalized) {
    await trx.query(
      `INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, nome_snapshot, quantidade, preco_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [empresaId, orderId, item.variantId, item.nome, item.quantidade, item.preco, item.subtotal],
    );
  }
  await trx.query(
    `INSERT INTO commerce_order_events (empresa_id, order_id, para_status, origem, payload_resumido)
     VALUES ($1, $2, $3, 'legacy_import', $4::jsonb)`,
    [empresaId, orderId, legacyStatus(order.status), JSON.stringify({ legacyKey, payment: order.pagamento || 'unknown' })],
  );
  await trx.query(
    `INSERT INTO commerce_legacy_imports (empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash, metadata)
     VALUES ($1, $2, $3, 'order', $4, $5, $6, $7::jsonb)
     ON CONFLICT (empresa_id, source, entity, legacy_key) DO UPDATE SET target_id = EXCLUDED.target_id, payload_hash = EXCLUDED.payload_hash, imported_at = CURRENT_TIMESTAMP, metadata = EXCLUDED.metadata`,
    [empresaId, storefront.loja_id || null, SOURCE, legacyKey, orderId, payloadHash, JSON.stringify({ publicCode: code, legacyPayment: order.pagamento || null })],
  );
  return { id: orderId, reused: false };
}

async function loadContext(trx, empresaId, storefrontId, locationId) {
  const storefront = await ensureTenant(trx, empresaId, storefrontId);
  const priceList = await trx.query(`SELECT id FROM commerce_price_lists WHERE empresa_id = $1 AND codigo = 'web-default' LIMIT 1`, [empresaId]);
  if (!priceList.rows[0]) throw new Error('price list web-default não encontrada; aplique a migration 019 antes da importação');
  const location = await trx.query(`SELECT id FROM commerce_inventory_locations WHERE empresa_id = $1 AND id = $2 AND (loja_id = $3 OR loja_id IS NULL) AND ativo = true LIMIT 1`, [empresaId, locationId, storefront.loja_id]);
  if (!location.rows[0]) throw new Error('local de estoque não encontrado ou fora do escopo da loja');
  return { storefront, priceListId: priceList.rows[0].id, locationId: location.rows[0].id };
}

async function apply(data, options) {
  return db.transaction(async trx => {
    const context = await loadContext(trx, options.empresaId, options.storefrontId, options.locationId);
    const categoryCache = new Map();
    const productMap = new Map();
    let products = 0;
    for (const product of legacyProducts(data)) {
      const result = await importProduct(trx, { empresaId: options.empresaId, storefront: context.storefront, product, categoryCache, priceListId: context.priceListId, locationId: context.locationId });
      const key = text(product.id ?? product.cod ?? product.nome, 180);
      if (result.variantId) productMap.set(key, result.variantId);
      products += 1;
    }
    let orders = 0;
    for (const order of legacyOrders(data)) {
      await importOrder(trx, { empresaId: options.empresaId, storefront: context.storefront, order, productMap });
      orders += 1;
    }
    return { products, orders, empresaId: options.empresaId, storefrontId: context.storefront.id, locationId: context.locationId };
  });
}

async function main() {
  const data = await readJson(arg('source') || SOURCE_PATH);
  const summary = summarize(data);
  console.log(JSON.stringify({ mode: hasFlag('apply') ? 'apply' : 'dry-run', source: arg('source') || SOURCE_PATH, summary }, null, 2));
  if (!hasFlag('apply')) {
    console.log('Dry-run concluído. Nenhum dado foi escrito. Use --apply com COMMERCE_IMPORT_CONFIRM=IMPORT_LEGACY_TO_COMMERCE e IDs explícitos para executar.');
    return;
  }
  if (process.env.COMMERCE_IMPORT_CONFIRM !== 'IMPORT_LEGACY_TO_COMMERCE') throw new Error('confirmação ausente: defina COMMERCE_IMPORT_CONFIRM=IMPORT_LEGACY_TO_COMMERCE');
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_HOST) throw new Error('conexão PostgreSQL ausente');
  const empresaId = arg('empresa-id') || process.env.COMMERCE_EMPRESA_ID;
  const storefrontId = arg('storefront-id') || process.env.COMMERCE_STOREFRONT_ID;
  const locationId = arg('location-id') || process.env.COMMERCE_LOCATION_ID;
  if (!empresaId || !storefrontId || !locationId) throw new Error('empresa-id, storefront-id e location-id são obrigatórios para --apply');
  const result = await apply(data, { empresaId, storefrontId, locationId });
  console.log(JSON.stringify({ imported: result }, null, 2));
}

const SOURCE_PATH = arg('source') || DEFAULT_SOURCE;
if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(`Importação não executada: ${error.message}`); process.exit(1); });
export { summarize };
