import crypto from 'node:crypto';
import { adjustInventory, CommerceError, createCatalogProduct, publishCatalogProduct, setVariantPrice, updateCatalogProduct } from './commerce-core.js';
import { db } from './database.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,99}$/;
const MAX_IMPORT_ITEMS = 500;

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function uuid(value, field) {
  const normalized = text(value, 64);
  if (!UUID_PATTERN.test(normalized)) throw new CommerceError(`${field} inválido`, 'CATALOG_IMPORT_SCOPE_INVALID');
  return normalized;
}

function slugify(value) {
  return text(value, 180)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto';
}

function money(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string'
    ? value.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
    : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new CommerceError('preço inválido no catálogo', 'CATALOG_IMPORT_PRICE_INVALID');
  return Number(number.toFixed(2));
}

function stock(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new CommerceError('estoque deve ser inteiro e não negativo', 'CATALOG_IMPORT_STOCK_INVALID');
  return number;
}

function normalizeItem(item = {}, index = 0) {
  const sku = text(item.sku || item.skuProposto, 100).toUpperCase();
  if (!SKU_PATTERN.test(sku)) throw new CommerceError(`SKU inválido na linha ${index + 1}`, 'CATALOG_IMPORT_SKU_INVALID');
  const name = text(item.nome || item.produto, 300);
  if (!name) throw new CommerceError(`produto sem nome na linha ${index + 1}`, 'CATALOG_IMPORT_PRODUCT_INVALID');
  const category = text(item.categoria || 'Sem categoria', 180);
  const price = money(item.preco ?? item.precoBrl);
  const targetStock = stock(item.estoque ?? item.quantidade ?? item.quantidadeTotal);
  const requestedAction = text(item.acao || item.acaoProposta || 'draft', 20).toLowerCase();
  const publishable = requestedAction === 'publish' || requestedAction === 'publicar';
  const action = publishable && price !== null && price > 0 && targetStock !== null && targetStock > 0 ? 'publish' : 'draft';
  return {
    sku,
    name,
    slug: slugify(item.slug || name),
    category,
    categorySlug: slugify(category),
    price,
    targetStock,
    action,
    pendingReason: text(item.pendencia || item.pendingReason, 500),
    source: text(item.fonte || item.source, 500),
  };
}

function normalizeImportInput(input = {}) {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length || items.length > MAX_IMPORT_ITEMS) {
    throw new CommerceError(`a importação deve conter entre 1 e ${MAX_IMPORT_ITEMS} itens`, 'CATALOG_IMPORT_SIZE_INVALID');
  }
  const normalized = items.map(normalizeItem);
  const seen = new Set();
  for (const item of normalized) {
    if (seen.has(item.sku)) throw new CommerceError(`SKU duplicado no arquivo: ${item.sku}`, 'CATALOG_IMPORT_DUPLICATE_SKU');
    seen.add(item.sku);
  }
  const canonical = normalized.map(item => ({
    sku: item.sku, name: item.name, slug: item.slug, category: item.category,
    price: item.price, targetStock: item.targetStock, action: item.action,
  }));
  const hash = crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  const storefrontId = uuid(input.storefrontId, 'storefrontId');
  const locationId = uuid(input.locationId, 'locationId');
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ hash, storefrontId, locationId })).digest('hex');
  return {
    items: normalized,
    hash,
    requestHash,
    storefrontId,
    locationId,
    sourceLabel: text(input.sourceLabel || 'importação administrativa', 240),
    idempotencyKey: text(input.idempotencyKey, 180),
    previewHash: text(input.previewHash, 128),
    confirmImport: input.confirmImport === true,
  };
}

async function resolveScope(client, context, payload) {
  const empresaId = uuid(context?.empresaId, 'empresaId');
  const usuarioId = uuid(context?.usuarioId, 'usuarioId');
  const lojaId = context?.lojaId ? uuid(context.lojaId, 'lojaId') : null;
  const storefront = await client.query(
    `SELECT id, empresa_id, loja_id, codigo, status
       FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2
        AND ($3::uuid IS NULL OR loja_id = $3)
      LIMIT 1`,
    [empresaId, payload.storefrontId, lojaId],
  );
  if (!storefront.rows[0]) throw new CommerceError('storefront não pertence ao tenant/loja autorizados', 'CATALOG_IMPORT_SCOPE_MISMATCH');
  const location = await client.query(
    `SELECT id, empresa_id, loja_id, codigo, ativo
       FROM commerce_inventory_locations
      WHERE empresa_id = $1 AND id = $2 AND ativo = true
        AND ($3::uuid IS NULL OR loja_id = $3)
      LIMIT 1`,
    [empresaId, payload.locationId, lojaId],
  );
  if (!location.rows[0]) throw new CommerceError('local de estoque não pertence ao tenant/loja autorizados', 'CATALOG_IMPORT_SCOPE_MISMATCH');
  if (storefront.rows[0].loja_id && location.rows[0].loja_id && storefront.rows[0].loja_id !== location.rows[0].loja_id) {
    throw new CommerceError('storefront e estoque pertencem a lojas diferentes', 'CATALOG_IMPORT_SCOPE_MISMATCH');
  }
  return {
    empresaId,
    usuarioId,
    lojaId,
    corporateAccess: context?.corporateAccess === true,
    capabilities: context?.capabilities,
    storefront: storefront.rows[0],
    location: location.rows[0],
  };
}

async function existingBySku(client, scope, items, lock = false) {
  const result = await client.query(
    `SELECT v.sku, v.id AS variant_id, v.ativo AS variant_active,
            p.id AS product_id, p.nome, p.slug, p.status, p.category_id,
            c.nome AS category_name,
            COALESCE((SELECT vp.preco FROM commerce_variant_prices vp
              WHERE vp.empresa_id = v.empresa_id AND vp.variant_id = v.id AND vp.vigencia_fim IS NULL
              ORDER BY vp.vigencia_inicio DESC LIMIT 1), NULL) AS price,
            COALESCE((SELECT il.disponivel FROM commerce_inventory_levels il
              WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id AND il.location_id = $2
              LIMIT 1), 0) AS available,
            COALESCE((SELECT pc.publicado FROM commerce_product_channels pc
              WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.storefront_id = $3
              LIMIT 1), false) AS published
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
       LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
      WHERE v.empresa_id = $1 AND v.sku = ANY($4::text[])
      ${lock ? 'FOR UPDATE OF v, p' : ''}`,
    [scope.empresaId, scope.location.id, scope.storefront.id, items.map(item => item.sku)],
  );
  return new Map(result.rows.map(row => [String(row.sku).toUpperCase(), row]));
}

function classify(item, existing) {
  if (!existing) return { operation: 'create', changes: ['produto', 'variante', ...(item.price !== null ? ['preço'] : []), ...(item.targetStock !== null ? ['estoque'] : []), ...(item.action === 'publish' ? ['publicação'] : [])] };
  const changes = [];
  if (existing.nome !== item.name || existing.slug !== item.slug || existing.category_name !== item.category || existing.status !== (item.action === 'publish' ? 'active' : 'draft')) changes.push('produto');
  if (item.price !== null && Number(existing.price) !== item.price) changes.push('preço');
  if (item.targetStock !== null && Number(existing.available) !== item.targetStock) changes.push('estoque');
  if (Boolean(existing.published) !== (item.action === 'publish')) changes.push('publicação');
  return { operation: changes.length ? 'update' : 'unchanged', changes };
}

function previewFingerprint(payload, scope, existing) {
  const baseline = payload.items.map(item => {
    const row = existing.get(item.sku);
    return {
      sku: item.sku,
      ...classify(item, row),
      before: row ? {
        productId: row.product_id,
        status: row.status,
        category: row.category_name || null,
        price: row.price == null ? null : Number(row.price),
        available: Number(row.available || 0),
        published: Boolean(row.published),
      } : null,
    };
  });
  return crypto.createHash('sha256').update(JSON.stringify({ datasetHash: payload.hash, empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefront.id, locationId: scope.location.id, baseline })).digest('hex');
}

async function previewWithClient(client, context, input = {}) {
  const payload = normalizeImportInput(input);
  const scope = await resolveScope(client, context, payload);
  const existing = await existingBySku(client, scope, payload.items, false);
  const items = payload.items.map(item => ({ ...item, ...classify(item, existing.get(item.sku)) }));
  return {
    datasetHash: payload.hash,
    previewHash: previewFingerprint(payload, scope, existing),
    sourceLabel: payload.sourceLabel,
    scope: { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefront.id, locationId: scope.location.id },
    summary: {
      total: items.length,
      create: items.filter(item => item.operation === 'create').length,
      update: items.filter(item => item.operation === 'update').length,
      unchanged: items.filter(item => item.operation === 'unchanged').length,
      publish: items.filter(item => item.action === 'publish').length,
      draft: items.filter(item => item.action === 'draft').length,
      stockUnits: items.reduce((sum, item) => sum + (item.action === 'publish' ? Number(item.targetStock || 0) : 0), 0),
    },
    items,
  };
}

async function ensureCategory(trx, empresaId, item) {
  const result = await trx.query(
    `INSERT INTO commerce_categories (empresa_id, slug, nome, ativo, ordem)
     VALUES ($1, $2, $3, true, 0)
     ON CONFLICT (empresa_id, slug)
     DO UPDATE SET nome = EXCLUDED.nome, ativo = true, atualizado_em = CURRENT_TIMESTAMP
     RETURNING id`,
    [empresaId, item.categorySlug, item.category],
  );
  return result.rows[0].id;
}

async function currentProductPrice(trx, empresaId, variantId) {
  const result = await trx.query(
    `SELECT preco FROM commerce_variant_prices
      WHERE empresa_id = $1 AND variant_id = $2 AND vigencia_fim IS NULL
      ORDER BY vigencia_inicio DESC LIMIT 1`,
    [empresaId, variantId],
  );
  return result.rows[0] ? Number(result.rows[0].preco) : null;
}

async function currentStock(trx, empresaId, locationId, variantId) {
  const result = await trx.query(
    `SELECT disponivel FROM commerce_inventory_levels
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3
      LIMIT 1`,
    [empresaId, locationId, variantId],
  );
  return Number(result.rows[0]?.disponivel || 0);
}

export async function previewCatalogImport(context, input = {}) {
  return previewWithClient({ query: db.queryRead }, context, input);
}

export async function executeCatalogImport(context, input = {}) {
  const normalized = normalizeImportInput(input);
  if (!normalized.confirmImport) throw new CommerceError('confirme explicitamente a importação do catálogo', 'CATALOG_IMPORT_CONFIRMATION_REQUIRED');
  if (!normalized.idempotencyKey) throw new CommerceError('chave de idempotência é obrigatória', 'CATALOG_IMPORT_IDEMPOTENCY_REQUIRED');
  if (!normalized.previewHash) throw new CommerceError('gere um preview antes de executar a importação', 'CATALOG_IMPORT_PREVIEW_REQUIRED');
  return db.transaction(async trx => {
    const scope = await resolveScope(trx, context, normalized);
    await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`catalog-import:${scope.empresaId}:${normalized.idempotencyKey}`]);
    const idem = await trx.query(
      `SELECT request_hash, response_body FROM commerce_idempotency_keys
        WHERE empresa_id = $1 AND scope = 'catalog.import' AND key = $2
        FOR UPDATE`,
      [scope.empresaId, normalized.idempotencyKey],
    );
    if (idem.rows[0]) {
      if (idem.rows[0].request_hash !== normalized.requestHash) throw new CommerceError('chave de importação reutilizada com dataset ou escopo diferente', 'IDEMPOTENCY_CONFLICT');
      if (idem.rows[0].response_body) return idem.rows[0].response_body;
    } else {
      await trx.query(
        `INSERT INTO commerce_idempotency_keys (empresa_id, scope, key, request_hash, expires_at)
         VALUES ($1, 'catalog.import', $2, $3, CURRENT_TIMESTAMP + INTERVAL '30 days')`,
        [scope.empresaId, normalized.idempotencyKey, normalized.requestHash],
      );
    }

    const existing = await existingBySku(trx, scope, normalized.items, true);
    if (previewFingerprint(normalized, scope, existing) !== normalized.previewHash) {
      throw new CommerceError('o catálogo mudou desde o preview; gere uma nova pré-visualização', 'CATALOG_IMPORT_PREVIEW_STALE');
    }
    const result = { created: 0, updated: 0, unchanged: 0, published: 0, drafts: 0, stockUnits: 0 };
    const details = [];
    for (const item of normalized.items) {
      const before = existing.get(item.sku);
      const categoryId = await ensureCategory(trx, scope.empresaId, item);
      let productId;
      let variantId;
      if (!before) {
        const created = await createCatalogProduct(trx, scope, {
          nome: item.name,
          slug: item.slug,
          categoryId,
          storefrontId: scope.storefront.id,
          status: item.action === 'publish' ? 'active' : 'draft',
          publicado: item.action === 'publish',
          preco: item.price,
          variant: { sku: item.sku, atributos: { source: normalized.sourceLabel } },
          descricaoCurta: item.pendingReason || undefined,
        });
        productId = created.id;
        variantId = created.variant.id;
        if (item.action !== 'publish') {
          await publishCatalogProduct(trx, scope, productId, { storefrontId: scope.storefront.id, publicado: false });
        }
        result.created += 1;
      } else {
        productId = before.product_id;
        variantId = before.variant_id;
        const classification = classify(item, before);
        if (classification.changes.includes('produto')) {
          await updateCatalogProduct(trx, scope, productId, {
            storefrontId: scope.storefront.id,
            nome: item.name,
            slug: item.slug,
            categoryId,
            status: item.action === 'publish' ? 'active' : 'draft',
            descricaoCurta: item.pendingReason || null,
          });
        }
        if (item.price !== null && await currentProductPrice(trx, scope.empresaId, variantId) !== item.price) {
          await setVariantPrice(trx, scope, productId, { storefrontId: scope.storefront.id, variantId, preco: item.price });
        }
        await publishCatalogProduct(trx, scope, productId, { storefrontId: scope.storefront.id, publicado: item.action === 'publish' });
        if (classification.operation === 'update') result.updated += 1;
        else result.unchanged += 1;
      }

      if (item.targetStock !== null) {
        const available = await currentStock(trx, scope.empresaId, scope.location.id, variantId);
        const delta = item.targetStock - available;
        if (delta !== 0) {
          await adjustInventory(trx, scope, {
            locationId: scope.location.id,
            variantId,
            delta,
            tipo: delta > 0 ? 'entrada' : 'ajuste',
            idempotencyKey: `${normalized.idempotencyKey}:${item.sku}`,
            observacao: `Importação governada: ${normalized.sourceLabel}`,
          });
        }
      }
      result[item.action === 'publish' ? 'published' : 'drafts'] += 1;
      if (item.action === 'publish') result.stockUnits += Number(item.targetStock || 0);
      details.push({ sku: item.sku, productId, variantId, action: item.action });
    }

    const response = {
      ok: true,
      datasetHash: normalized.hash,
      idempotencyKey: normalized.idempotencyKey,
      sourceLabel: normalized.sourceLabel,
      scope: { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefront.id, locationId: scope.location.id },
      summary: result,
      items: details,
    };
    await trx.query(
      `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, acao, depois)
       VALUES ($1, $2, $3, 'catalog_import', 'completed', $4::jsonb)`,
      [scope.empresaId, scope.lojaId, scope.usuarioId, JSON.stringify({ datasetHash: normalized.hash, idempotencyKey: normalized.idempotencyKey, sourceLabel: normalized.sourceLabel, summary: result })],
    );
    await trx.query(
      `UPDATE commerce_idempotency_keys
          SET response_status = 200, response_body = $3::jsonb
        WHERE empresa_id = $1 AND scope = 'catalog.import' AND key = $2`,
      [scope.empresaId, normalized.idempotencyKey, JSON.stringify(response)],
    );
    return response;
  });
}

export { MAX_IMPORT_ITEMS, normalizeImportInput };
