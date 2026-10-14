import crypto from 'node:crypto';
import { CommerceError, assertUuid, withCommerceTransaction } from './commerce-core.js';
import { db } from './database.js';
import { AVEC_SOURCE, normalizeAvecInput, validateAvecScope } from './avec-catalog-preview.js';

/**
 * Writer oficial, porém deliberadamente sem rota: nenhuma integração o chama
 * enquanto não existir o boundary de RBAC/CB que injete capabilities verificadas.
 * A única origem aceite é AVEC e a única evidência de identidade é o ledger
 * commerce_legacy_imports; nomes, SKU/EAN soltos e flags do cliente não mapeiam.
 */
export const AVEC_ENRICHMENT_MODE = 'backend-function-inactive-no-route';
export const AVEC_ENRICHMENT_SCOPE = 'avec.catalog.enrichment.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const STABLE_SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/;
const ALLOWED_ITEM_KEYS = new Set([
  'sourceId', 'source_id', 'idOrigem', 'id_origem', 'avecId', 'avec_id',
  'sku', 'codigo', 'cod', 'codigoProduto', 'codigo_produto',
  'ean', 'gtin', 'barcode', 'codigoBarras', 'codigo_barras',
  'ncm', 'NCM', 'custo', 'custoUnitario', 'custo_unitario', 'cost',
  'unidade', 'unidadeMedida', 'unidade_medida', 'unit',
  'nome', 'produto', 'descricao', 'description',
  'empresaId', 'empresa_id', 'tenantId', 'tenant_id',
  'lojaId', 'loja_id', 'storeId', 'store_id',
]);

function fail(message, code, details = undefined) {
  throw new CommerceError(message, code, details);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

async function requireCapabilities(client, context, required) {
  // Mesma autoridade de membership/roles do Commerce, consultada pelo servidor.
  // Arrays de capabilities e callbacks fornecidos pelo chamador não autorizam.
  const result = await client.query(
    `SELECT DISTINCT p.codigo
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = $1 OR r.empresa_id IS NULL)
       JOIN commerce_role_permissions rp ON rp.role_id = r.id
       JOIN commerce_permissions p ON p.id = rp.permission_id AND p.codigo = ANY($2::text[])
      WHERE m.empresa_id = $1 AND m.usuario_id = $3 AND m.ativo = true
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND (m.loja_id IS NULL OR m.loja_id = $4)`,
    [context.empresaId, required, context.usuarioId, context.lojaId],
  );
  const present = new Set(result.rows.map(row => row.codigo));
  const missing = required.filter(capability => !present.has(capability));
  if (!missing.length) return;
  fail('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission: missing[0] });
}

function assertAuthenticatedContext(context) {
  const empresaId = assertUuid(context?.empresaId, 'empresaId');
  const lojaId = assertUuid(context?.lojaId, 'lojaId');
  const usuarioId = assertUuid(context?.usuarioId, 'usuarioId');
  return { empresaId, lojaId, usuarioId };
}

function explicitSourceId(raw) {
  if (!raw || typeof raw !== 'object') return null;
  for (const key of ['sourceId', 'source_id', 'idOrigem', 'id_origem', 'avecId', 'avec_id']) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') return raw[key];
  }
  return null;
}

function normalizeStrictInput(input = {}) {
  const rows = Array.isArray(input.items) ? input.items : (Array.isArray(input.rows) ? input.rows : []);
  if (!rows.length) fail('a carga AVEC deve conter itens completos', 'AVEC_SIZE_INVALID');
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('item AVEC inválido', 'AVEC_ITEM_INVALID');
    const unknown = Object.keys(raw).filter(key => !ALLOWED_ITEM_KEYS.has(key));
    if (unknown.length) fail('item AVEC contém campo não permitido', 'AVEC_UNKNOWN_ITEM_KEY');
    if (explicitSourceId(raw) === null) fail('cada item AVEC precisa de sourceId estável explícito', 'AVEC_SOURCE_ID_REQUIRED');
  }
  const payload = normalizeAvecInput(input);
  for (const item of payload.items) {
    if (item.errors.length) fail('item AVEC inválido ou duplicado; lote bloqueado', 'AVEC_ITEM_INVALID');
    if (!item.sourceId || !STABLE_SOURCE_ID.test(item.sourceId)) fail('sourceId AVEC não tem formato estável aceito', 'AVEC_SOURCE_ID_INVALID');
    if (!item.sku) fail('cada item AVEC precisa do SKU da única variante alvo', 'AVEC_SKU_REQUIRED');
    if (!item.unitPresent || !item.unit) fail('cada item AVEC precisa de unidade explícita', 'AVEC_UNIT_REQUIRED');
    if (item.barcode) {
      const digits = String(item.barcode);
      const sum = [...digits.slice(0, -1)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
      if (![8, 12, 13, 14].includes(digits.length) || (10 - sum % 10) % 10 !== Number(digits.at(-1))) {
        fail('dígito verificador GTIN inválido', 'AVEC_EAN_INVALID');
      }
    }
    if (item.ncm === '00000000') fail('NCM inválido; classificação exige revisão fiscal', 'AVEC_NCM_INVALID');
    if (item.costPresent && (item.costCents === null || item.costCents <= 0)) {
      fail('custo ausente/inválido ou zero é bloqueado neste escopo', item.costCents === 0 ? 'AVEC_COST_ZERO_BLOCKED' : 'AVEC_COST_INVALID');
    }
  }
  return payload;
}

function scopeInput(input) {
  return {
    storefrontId: assertUuid(input?.storefrontId, 'storefrontId'),
    locationId: assertUuid(input?.locationId, 'locationId'),
  };
}

async function validateEnrichmentScope(client, context, input) {
  const identity = assertAuthenticatedContext(context);
  const ids = scopeInput(input);
  // Reusa o preflight consistente existente; as consultas abaixo apertam as
  // regras deste writer (loja exata, sem storefront/local global e exatamente 1).
  await validateAvecScope(client, identity, ids);
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM lojas l
         WHERE l.empresa_id = $1 AND l.id = $2 AND l.ativa = true) AS loja_count,
       (SELECT count(*)::int FROM usuarios u
         WHERE u.empresa_id = $1 AND u.id = $5 AND u.ativo = true) AS usuario_count,
       (SELECT count(*)::int FROM commerce_storefronts s
         WHERE s.empresa_id = $1 AND s.id = $3 AND s.loja_id = $2 AND s.status = 'active') AS storefront_count,
       (SELECT count(*)::int FROM commerce_inventory_locations l
         WHERE l.empresa_id = $1 AND l.id = $4 AND l.loja_id = $2 AND l.ativo = true) AS location_count`,
    [identity.empresaId, identity.lojaId, ids.storefrontId, ids.locationId, identity.usuarioId],
  );
  const row = result.rows[0] || {};
  if (Number(row.loja_count) !== 1 || Number(row.usuario_count) !== 1 || Number(row.storefront_count) !== 1 || Number(row.location_count) !== 1) {
    fail('loja, storefront e local precisam ser únicos, ativos e da mesma unidade', 'AVEC_SCOPE_MISMATCH');
  }
  return { ...identity, ...ids };
}

/**
 * Leitura estrita: só retorna produto ligado por ledger AVEC+product+loja
 * exatos. Não há fallback por nome, SKU ou EAN. A linha inclui a forma atual
 * necessária para stale-check e para o preview local.
 */
export async function readMappedAvecCandidates(client, scope, payload) {
  const sourceIds = payload.items.map(item => item.sourceId);
  const result = await client.query(
    `WITH variant_shape AS (
       SELECT empresa_id, product_id, count(*)::int AS variant_count
         FROM commerce_product_variants
        WHERE empresa_id = $1
        GROUP BY empresa_id, product_id
     ), channel_shape AS (
       SELECT empresa_id, product_id,
              count(*)::int AS channel_count,
              count(DISTINCT price_list_id)::int AS price_list_count,
              bool_or(storefront_id <> $4) AS has_outside_channel
         FROM commerce_product_channels
        WHERE empresa_id = $1
        GROUP BY empresa_id, product_id
     )
     SELECT v.id AS variant_id, v.product_id, v.sku, v.barcode,
            v.atributos->>'unidade_medida' AS unit,
            p.dados_fiscais->>'ncm' AS ncm,
            p.dados_fiscais AS fiscal_data,
            link.legacy_key AS source_id,
            link.loja_id AS link_loja_id,
            vs.variant_count,
            cs.channel_count,
            cs.price_list_count,
            COALESCE(cs.has_outside_channel, false) AS has_outside_channel,
            channel.id AS channel_id,
            channel.price_list_id,
            COALESCE(current_price.current_count, 0)::int AS current_price_count,
            current_price.current_price_ids,
            current_price.cost_cents,
            COALESCE(barcode_use.other_ids, ARRAY[]::text[]) AS barcode_other_ids
       FROM commerce_legacy_imports link
       JOIN commerce_products p
         ON p.empresa_id = link.empresa_id AND p.id = link.target_id
       JOIN commerce_product_variants v
         ON v.empresa_id = p.empresa_id AND v.product_id = p.id
       JOIN variant_shape vs
         ON vs.empresa_id = v.empresa_id AND vs.product_id = v.product_id
       JOIN commerce_product_channels channel
         ON channel.empresa_id = p.empresa_id AND channel.product_id = p.id
        AND channel.storefront_id = $4
       JOIN channel_shape cs
         ON cs.empresa_id = p.empresa_id AND cs.product_id = p.id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS current_count,
                array_agg(vp.id::text ORDER BY vp.vigencia_inicio DESC, vp.id::text) AS current_price_ids,
                ROUND(max(vp.custo) * 100)::bigint AS cost_cents
           FROM commerce_variant_prices vp
          WHERE vp.empresa_id = v.empresa_id
            AND vp.variant_id = v.id
            AND vp.price_list_id = channel.price_list_id
            AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
       ) current_price ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(other.id::text ORDER BY other.id::text) AS other_ids
           FROM commerce_product_variants other
          WHERE other.empresa_id = v.empresa_id
            AND other.barcode = ANY($5::text[])
            AND other.id <> v.id
       ) barcode_use ON true
      WHERE link.empresa_id = $1
        AND link.loja_id = $2
        AND link.loja_id IS NOT NULL
        AND link.source = 'avec'
        AND link.entity = 'product'
        AND link.legacy_key = ANY($3::text[])
      ORDER BY link.legacy_key, v.id`,
    [scope.empresaId, scope.lojaId, sourceIds, scope.storefrontId, payload.items.map(item => item.barcode).filter(Boolean)],
  );
  return result.rows;
}

function candidateRowsForItem(item, rows) {
  return rows.filter(row => row.source_id === item.sourceId);
}

function currentNcm(row) { return row.ncm === null || row.ncm === undefined ? null : String(row.ncm); }
function currentCost(row) { return row.cost_cents === null || row.cost_cents === undefined ? null : Number(row.cost_cents); }
function targetUnit(row) { return String(row.unit || '').trim().toUpperCase() || null; }

function itemReasons(item, row, allRows, barcodeConflict = false) {
  const reasons = [];
  const sourceRows = candidateRowsForItem(item, allRows);
  if (sourceRows.length > 1) return ['AMBIGUOUS_MAPPING'];
  if (!row) return ['UNMAPPED_SOURCE_ID'];
  if (sourceRows.length !== 1) reasons.push('AMBIGUOUS_MAPPING');
  if (row.sku !== item.sku) reasons.push('SKU_TARGET_MISMATCH');
  if (Number(row.variant_count) !== 1) reasons.push('PRODUCT_HAS_OTHER_VARIANT');
  if (Number(row.channel_count) !== 1 || Number(row.price_list_count) !== 1 || row.has_outside_channel === true) reasons.push('PRODUCT_SHARED_SCOPE');
  if (!row.channel_id || !row.price_list_id) reasons.push('PRICE_LIST_MISSING');
  if (Number(row.current_price_count) !== 1) reasons.push('CURRENT_PRICE_NOT_UNIQUE');
  if (!row.current_price_ids?.length) reasons.push('CURRENT_PRICE_MISSING');
  if (!item.unit || item.unit !== targetUnit(row)) reasons.push('UNIT_MISMATCH');
  if (item.barcode && item.barcode !== (row.barcode ? String(row.barcode) : null) && (barcodeConflict || row.barcode_other_ids?.length)) reasons.push('BARCODE_SHARED_CONFLICT');
  return [...new Set(reasons)];
}

function createPreview(payload, rows, scope, barcodeConflicts = new Set()) {
  const items = payload.items.map(item => {
    const candidates = candidateRowsForItem(item, rows);
    const row = candidates.length === 1 ? candidates[0] : null;
    const reasons = itemReasons(item, row, rows, item.barcode ? barcodeConflicts.has(item.barcode) : false);
    const changes = row && reasons.length === 0 ? [
      item.costPresent && item.costCents !== currentCost(row) ? 'custo' : null,
      item.barcode && item.barcode !== (row.barcode ? String(row.barcode) : null) ? 'ean' : null,
      item.ncm && item.ncm !== currentNcm(row) ? 'ncm' : null,
    ].filter(Boolean) : [];
    if (row && reasons.length === 0 && !changes.length) reasons.push('NO_CHANGE');
    const status = reasons.includes('AMBIGUOUS_MAPPING') ? 'ambiguous' : reasons.filter(reason => reason !== 'NO_CHANGE').length ? 'conflict' : 'proposable';
    return {
      line: item.line,
      sourceId: item.sourceId,
      sku: item.sku,
      ean: item.barcode,
      ncm: item.ncm,
      custoCents: item.costCents,
      custoInformado: item.costPresent,
      unidade: item.unit,
      status,
      reasons: [...new Set(reasons)],
      proposal: row ? {
        target: { productId: row.product_id, variantId: row.variant_id },
        matchedBy: ['ledger_source_id', 'sku'],
        current: { costCents: currentCost(row), barcode: row.barcode ? String(row.barcode) : null, ncm: currentNcm(row), unit: targetUnit(row) },
        changes,
        fields: { costCents: item.costPresent ? item.costCents : null, barcode: item.barcode, ncm: item.ncm, unit: item.unit },
      } : null,
    };
  });
  const summary = {
    total: items.length,
    proposable: items.filter(item => item.status === 'proposable').length,
    conflict: items.filter(item => item.status === 'conflict').length,
    ambiguous: items.filter(item => item.status === 'ambiguous').length,
    absent: items.filter(item => item.reasons.includes('UNMAPPED_SOURCE_ID')).length,
    noChange: items.filter(item => item.reasons.includes('NO_CHANGE')).length,
    costMissing: items.filter(item => !item.custoInformado).length,
    costZero: 0,
  };
  const baseline = {
    source: AVEC_SOURCE,
    scope: { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId },
    fields: payload.items.map(item => ({ sourceId: item.sourceId, sku: item.sku, costCents: item.costPresent ? item.costCents : null, costPresent: item.costPresent, barcode: item.barcode, ncm: item.ncm, unit: item.unit })),
    targets: items.map(item => item.proposal ? {
      productId: item.proposal.target.productId,
      variantId: item.proposal.target.variantId,
      channelId: rows.find(row => row.source_id === item.sourceId)?.channel_id,
      priceListId: rows.find(row => row.source_id === item.sourceId)?.price_list_id,
      currentPriceIds: rows.find(row => row.source_id === item.sourceId)?.current_price_ids,
      current: item.proposal.current,
      changes: item.proposal.changes,
      reasons: item.reasons,
    } : { sourceId: item.sourceId, reasons: item.reasons }),
  };
  const previewHash = sha256(baseline);
  return {
    mode: AVEC_ENRICHMENT_MODE,
    source: AVEC_SOURCE,
    datasetHash: payload.datasetHash,
    previewHash,
    scope: baseline.scope,
    summary,
    items,
    write: { performed: false, endpoint: null, note: 'Prévia local somente; não publicado/não executado.' },
    pipeline: { active: false, route: null, note: 'Função backend isolada sem rota ou integração ativa.' },
    _baseline: baseline,
  };
}

async function readBarcodeConflicts(client, scope, payload) {
  const barcodes = payload.items.map(item => item.barcode).filter(Boolean);
  if (!barcodes.length) return new Set();
  const result = await client.query(
    `SELECT barcode, array_agg(id::text ORDER BY id::text) AS ids
       FROM commerce_product_variants
      WHERE empresa_id = $1 AND barcode = ANY($2::text[])
      GROUP BY barcode`,
    [scope.empresaId, barcodes],
  );
  return new Set(result.rows.filter(row => row.ids?.length).map(row => String(row.barcode)));
}

async function buildGovernedPreview(client, context, input, { requireWriteCapability = false } = {}) {
  const identity = assertAuthenticatedContext(context);
  await requireCapabilities(client, identity, requireWriteCapability ? ['reports.read', 'catalog.write'] : ['reports.read']);
  const payload = normalizeStrictInput(input);
  const scope = await validateEnrichmentScope(client, identity, input);
  const rows = await readMappedAvecCandidates(client, scope, payload);
  const barcodeConflicts = await readBarcodeConflicts(client, scope, payload);
  const preview = createPreview(payload, rows, scope, barcodeConflicts);
  return { payload, scope, rows, preview };
}

export async function previewAvecCatalogEnrichment(context, input = {}, options = {}) {
  const client = options.readClient || { query: (sql, values) => db.queryRead(sql, values) };
  const { preview, ...internal } = await buildGovernedPreview(client, context, input, options);
  // Internal rows/baseline never leave the function, avoiding payload/PII logs.
  void internal;
  return preview;
}

function assertExecutionInput(input) {
  if (input?.confirmExecution !== true) fail('confirmExecution=true é obrigatório; aprovação do cliente não é evidência', 'AVEC_CONFIRMATION_REQUIRED');
  if (!HASH.test(String(input?.previewHash || ''))) fail('previewHash baseline exato é obrigatório', 'AVEC_PREVIEW_HASH_REQUIRED');
  const key = String(input?.idempotencyKey || '').trim();
  if (!key || key.length > 180) fail('idempotencyKey é obrigatória', 'AVEC_IDEMPOTENCY_REQUIRED');
  return { key, previewHash: String(input.previewHash).toLowerCase() };
}

function requestHash(scope, payload, previewHash) {
  return sha256({
    scope: { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId },
    source: AVEC_SOURCE,
    fields: payload.items.map(item => ({ sourceId: item.sourceId, sku: item.sku, costCents: item.costPresent ? item.costCents : null, costPresent: item.costPresent, barcode: item.barcode, ncm: item.ncm, unit: item.unit })),
    previewHash,
  });
}

function idempotencyScope(scope) {
  // Coluna histórica scope: VARCHAR(120). O hash inclui todo o escopo explícito;
  // empresa_id continua sendo parte da chave do ledger, sem alterar o schema.
  return `${AVEC_ENRICHMENT_SCOPE}:${sha256({ lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId })}`;
}

async function lockDeterministic(trx, scope, rows, payload) {
  const productIds = [...new Set(rows.map(row => row.product_id))].sort();
  const variantIds = [...new Set(rows.map(row => row.variant_id))].sort();
  const priceListIds = [...new Set(rows.map(row => row.price_list_id))].sort();
  await trx.query("SELECT id FROM commerce_legacy_imports WHERE empresa_id = $1 AND loja_id = $2 AND source = 'avec' AND entity = 'product' AND legacy_key = ANY($3::text[]) ORDER BY legacy_key FOR UPDATE", [scope.empresaId, scope.lojaId, payload.items.map(item => item.sourceId).sort()]);
  if (productIds.length) await trx.query('SELECT id FROM commerce_products WHERE empresa_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE', [scope.empresaId, productIds]);
  if (variantIds.length) await trx.query('SELECT id FROM commerce_product_variants WHERE empresa_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE', [scope.empresaId, variantIds]);
  if (productIds.length) await trx.query('SELECT id FROM commerce_product_channels WHERE empresa_id = $1 AND product_id = ANY($2::uuid[]) ORDER BY id FOR UPDATE', [scope.empresaId, productIds]);
  // Trava inclusive linhas futuras/históricas. FOR UPDATE da variante também
  // bloqueia INSERT concorrente de preço via FK/KEY SHARE, sem lock global.
  if (variantIds.length) await trx.query('SELECT id FROM commerce_variant_prices WHERE empresa_id = $1 AND variant_id = ANY($2::uuid[]) AND price_list_id = ANY($3::uuid[]) ORDER BY id FOR UPDATE', [scope.empresaId, variantIds, priceListIds]);
}

async function readIdempotency(trx, scope, key, hash) {
  const result = await trx.query(
    `SELECT request_hash, response_body
       FROM commerce_idempotency_keys
      WHERE empresa_id = $1 AND scope = $2 AND key = $3
      FOR UPDATE`,
    [scope.empresaId, idempotencyScope(scope), key],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.request_hash !== hash) fail('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
  return row.response_body || null;
}

async function insertIdempotency(trx, scope, key, hash) {
  await trx.query(
    `INSERT INTO commerce_idempotency_keys
      (empresa_id, scope, key, request_hash, expires_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
    [scope.empresaId, idempotencyScope(scope), key, hash],
  );
}

async function updateCostOnly(trx, scope, row, item) {
  if (!item.costPresent || item.costCents === currentCost(row)) return false;
  const priceId = row.current_price_ids?.[0];
  const result = await trx.query(
    `UPDATE commerce_variant_prices
        SET custo = $5::numeric / 100
      WHERE empresa_id = $1 AND id = $2 AND variant_id = $3 AND price_list_id = $4
        AND ROUND(custo * 100)::bigint IS NOT DISTINCT FROM $6
        AND vigencia_inicio <= CURRENT_TIMESTAMP
        AND (vigencia_fim IS NULL OR vigencia_fim > CURRENT_TIMESTAMP)
      RETURNING id`,
    [scope.empresaId, priceId, row.variant_id, row.price_list_id, item.costCents, currentCost(row)],
  );
  if (result.rowCount !== 1) fail('custo mudou durante o preflight; nenhuma alteração aplicada', 'AVEC_STALE_BASELINE');
  return true;
}

async function updateBarcodeOnly(trx, scope, row, item) {
  if (!item.barcode || item.barcode === (row.barcode ? String(row.barcode) : null)) return false;
  const result = await trx.query(
    `UPDATE commerce_product_variants
        SET barcode = $4, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND product_id = $3
        AND barcode IS NOT DISTINCT FROM $5
      RETURNING id`,
    [scope.empresaId, row.variant_id, row.product_id, item.barcode, row.barcode ? String(row.barcode) : null],
  );
  if (result.rowCount !== 1) fail('barcode mudou durante o preflight; nenhuma alteração aplicada', 'AVEC_STALE_BASELINE');
  return true;
}

async function updateNcmOnly(trx, scope, row, item) {
  if (!item.ncm || item.ncm === currentNcm(row)) return false;
  const result = await trx.query(
    `UPDATE commerce_products
        SET dados_fiscais = COALESCE(dados_fiscais, '{}'::jsonb) || jsonb_build_object('ncm', $4::text), atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND dados_fiscais->>'ncm' IS NOT DISTINCT FROM $3
      RETURNING id`,
    [scope.empresaId, row.product_id, currentNcm(row), item.ncm],
  );
  if (result.rowCount !== 1) fail('NCM mudou durante o preflight; nenhuma alteração aplicada', 'AVEC_STALE_BASELINE');
  return true;
}

async function auditEnrichment(trx, context, scope, row, item, changes, previewHash, key) {
  const metadata = { source: AVEC_SOURCE, sourceId: item.sourceId, variantId: row.variant_id, priceId: row.current_price_ids[0], priceListId: row.price_list_id, channelId: row.channel_id, previewHash, idempotencyKey: key };
  const before = { ...metadata, fields: {} };
  const after = { ...metadata, fields: {} };
  if (changes.includes('custo')) { before.fields.costCents = currentCost(row); after.fields.costCents = item.costCents; }
  if (changes.includes('ean')) { before.fields.barcode = row.barcode ?? null; after.fields.barcode = item.barcode; }
  if (changes.includes('ncm')) { before.fields.ncm = currentNcm(row); after.fields.ncm = item.ncm; }
  await trx.query(
    `INSERT INTO commerce_audit_logs
      (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id)
     VALUES ($1, $2, $3, 'product', $4, 'avec_enriched', $5::jsonb, $6::jsonb, $7)`,
    [scope.empresaId, scope.lojaId, context.usuarioId, row.product_id,
      JSON.stringify(before), JSON.stringify(after), previewHash],
  );
}

export async function executeAvecCatalogEnrichment(context, input = {}, options = {}) {
  const execution = assertExecutionInput(input);
  const transaction = options.transaction || withCommerceTransaction;
  return transaction(async trx => {
    const identity = assertAuthenticatedContext(context);
    await requireCapabilities(trx, identity, ['reports.read', 'catalog.write']);
    const payload = normalizeStrictInput(input);
    const scope = await validateEnrichmentScope(trx, identity, input);
    const hash = requestHash(scope, payload, execution.previewHash);
    const idemScope = idempotencyScope(scope);
    // Advisory lock is not DML and serializes exact retries/concurrent calls.
    await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${scope.empresaId}:${idemScope}:${execution.key}`]);
    const replay = await readIdempotency(trx, scope, execution.key, hash);
    if (replay) return { ...replay, idempotentReplay: true };

    for (const barcode of [...new Set(payload.items.map(item => item.barcode).filter(Boolean))].sort()) {
      await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`avec-barcode:${scope.empresaId}:${barcode}`]);
    }
    const firstRows = await readMappedAvecCandidates(trx, scope, payload);
    const firstConflicts = await readBarcodeConflicts(trx, scope, payload);
    const firstPreview = createPreview(payload, firstRows, scope, firstConflicts);
    if (firstPreview.previewHash !== execution.previewHash) fail('baseline da prévia está desatualizado', 'AVEC_STALE_BASELINE');
    if (firstPreview.summary.conflict || firstPreview.summary.ambiguous || firstPreview.summary.absent) {
      fail('lote AVEC contém item não mapeado, ambíguo ou fora do escopo', 'AVEC_BATCH_BLOCKED', { summary: firstPreview.summary });
    }

    await lockDeterministic(trx, scope, firstRows, payload);
    const lockedRows = await readMappedAvecCandidates(trx, scope, payload);
    const lockedConflicts = await readBarcodeConflicts(trx, scope, payload);
    const lockedPreview = createPreview(payload, lockedRows, scope, lockedConflicts);
    if (lockedPreview.previewHash !== execution.previewHash) fail('baseline mudou antes do DML', 'AVEC_STALE_BASELINE');
    if (lockedPreview.summary.conflict || lockedPreview.summary.ambiguous || lockedPreview.summary.absent) {
      fail('lote AVEC contém item não mapeado, ambíguo ou fora do escopo', 'AVEC_BATCH_BLOCKED', { summary: lockedPreview.summary });
    }

    await insertIdempotency(trx, scope, execution.key, hash);
    let updated = 0;
    let unchanged = 0;
    for (const [index, item] of payload.items.entries()) {
      const row = lockedRows.find(candidate => candidate.source_id === item.sourceId);
      if (!row) fail('mapeamento AVEC desapareceu durante o preflight', 'AVEC_STALE_BASELINE');
      const previewItem = lockedPreview.items.find(candidate => candidate.sourceId === item.sourceId);
      const changes = previewItem?.proposal?.changes || [];
      if (!changes.length) { unchanged += 1; continue; }
      // These three writers are deliberately column-scoped; no price, sale
      // price, vigency, inventory, reservation, publication or slug is touched.
      await updateCostOnly(trx, scope, row, item);
      try {
        await updateBarcodeOnly(trx, scope, row, item);
      } catch (error) {
        if (error.code === '23505') fail('EAN passou a pertencer a outra variante; lote revertido', 'AVEC_BARCODE_CONFLICT');
        throw error;
      }
      await updateNcmOnly(trx, scope, row, item);
      await auditEnrichment(trx, context, scope, row, item, changes, execution.previewHash, execution.key);
      updated += 1;
    }
    const response = {
      mode: AVEC_ENRICHMENT_MODE,
      source: AVEC_SOURCE,
      performed: updated > 0,
      summary: { total: payload.items.length, updated, unchanged },
      previewHash: execution.previewHash,
      idempotentReplay: false,
      endpoint: null,
      note: 'Função backend oficial isolada; não publicado/não executado por rota.',
    };
    await trx.query(
      `UPDATE commerce_idempotency_keys SET response_status = $4, response_body = $5::jsonb
        WHERE empresa_id = $1 AND scope = $2 AND key = $3`,
      [scope.empresaId, idemScope, execution.key, 200, JSON.stringify(response)],
    );
    return response;
  });
}

// Aliases explícitos para consumidores internos futuros; nenhum deles é rota.
export const previewAvecEnrichment = previewAvecCatalogEnrichment;
export const executeAvecEnrichment = executeAvecCatalogEnrichment;
