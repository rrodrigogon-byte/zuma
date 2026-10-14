import crypto from 'node:crypto';
import { CommerceError, assertUuid } from './commerce-core.js';
import { db } from './database.js';

export const AVEC_SOURCE = 'avec';
export const MAX_AVEC_ITEMS = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,99}$/;
const BARCODE_PATTERN = /^\d{8,14}$/;
const NCM_PATTERN = /^\d{8}$/;
const FORMULA_PATTERN = /^[=+\-@]/;
const VALID_UNITS = new Set(['UN', 'UND', 'KG', 'G', 'MG', 'L', 'ML', 'M', 'CM', 'CX', 'FD', 'PCT', 'PC', 'PAR', 'DZ', 'KIT', 'SC', 'RL', 'TB', 'FR', 'GL', 'TON']);

function text(value, max = 240) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function hasFormulaPrefix(value) {
  return FORMULA_PATTERN.test(String(value ?? '').trim());
}

function safeText(value, field, max = 240) {
  if (String(value ?? '').trim().replace(/\s+/g, ' ').length > max) throw new CommerceError(`${field} excede o tamanho permitido; não será truncado`, 'AVEC_FIELD_TOO_LONG');
  const result = text(value, max);
  if (result && hasFormulaPrefix(result)) {
    throw new CommerceError(`${field} contém prefixo de fórmula CSV`, 'AVEC_FORMULA_CELL');
  }
  return result || null;
}

function firstValue(row, fields) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(row || {}, field) && row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== '') return row[field];
  }
  return null;
}

function normalizeCents(value, field = 'custo') {
  if (value === null || value === undefined || String(value).trim() === '') return { cents: null, present: false };
  if (typeof value === 'string' && hasFormulaPrefix(value)) throw new CommerceError(`${field} contém prefixo de fórmula CSV`, 'AVEC_FORMULA_CELL');
  const raw = String(value).trim().replace(/^R\$/i, '').replace(/\s/g, '');
  // Do not guess a thousand separator when both separators are present.
  let normalized = raw;
  if (raw.includes('.') && raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else normalized = raw.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { cents: null, present: true };
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return { cents: Number.isSafeInteger(cents) ? cents : null, present: true };
}

function normalizeBarcode(value, field = 'ean') {
  if (value === null || value === undefined || String(value).trim() === '') return { value: null, present: false, numericInput: false };
  const numericInput = typeof value === 'number';
  const raw = String(value).trim();
  if (hasFormulaPrefix(raw)) throw new CommerceError(`${field} contém prefixo de fórmula CSV`, 'AVEC_FORMULA_CELL');
  const compact = raw.replace(/[\s.-]/g, '');
  if (!/^\d+$/.test(compact) || !BARCODE_PATTERN.test(compact)) return { value: null, present: true, numericInput };
  return { value: compact, present: true, numericInput };
}

function normalizeNcm(value) {
  if (value === null || value === undefined || String(value).trim() === '') return { value: null, present: false };
  const raw = String(value).trim();
  if (hasFormulaPrefix(raw)) throw new CommerceError('ncm contém prefixo de fórmula CSV', 'AVEC_FORMULA_CELL');
  return { value: /^\d{8}$/.test(raw) ? raw : null, present: true };
}

function normalizeUnit(value) {
  if (value === null || value === undefined || String(value).trim() === '') return { value: null, present: false };
  const raw = safeText(value, 'unidade', 20);
  const normalized = raw ? raw.toUpperCase() : null;
  return { value: normalized, present: true, valid: Boolean(normalized && VALID_UNITS.has(normalized)) };
}

function normalizeSourceId(value) {
  const result = safeText(value, 'id de origem', 180);
  return result;
}

function normalizeSku(value) {
  const result = safeText(value, 'sku', 100);
  if (!result) return { value: null, present: false, valid: false };
  const normalized = result.toUpperCase();
  return { value: normalized, present: true, valid: SKU_PATTERN.test(normalized) };
}

export function normalizeAvecItem(raw = {}, index = 0) {
  const sourceId = normalizeSourceId(firstValue(raw, ['sourceId', 'source_id', 'idOrigem', 'id_origem', 'avecId', 'avec_id', 'id']));
  const sku = normalizeSku(firstValue(raw, ['sku', 'codigo', 'cod', 'codigoProduto', 'codigo_produto']));
  const barcode = normalizeBarcode(firstValue(raw, ['ean', 'gtin', 'barcode', 'codigoBarras', 'codigo_barras']));
  const ncm = normalizeNcm(firstValue(raw, ['ncm', 'NCM']));
  const cost = normalizeCents(firstValue(raw, ['custo', 'custoUnitario', 'custo_unitario', 'cost']));
  const unit = normalizeUnit(firstValue(raw, ['unidade', 'unidadeMedida', 'unidade_medida', 'unit']));
  const name = safeText(firstValue(raw, ['nome', 'produto', 'descricao', 'description']), 'nome', 240);
  const empresaId = safeText(firstValue(raw, ['empresaId', 'empresa_id', 'tenantId', 'tenant_id']), 'empresaId', 64);
  const lojaId = safeText(firstValue(raw, ['lojaId', 'loja_id', 'storeId', 'store_id']), 'lojaId', 64);
  const errors = [];
  if (!sourceId && !sku.value && !barcode.value) errors.push('IDENTIFIER_MISSING');
  if (sku.present && !sku.valid) errors.push('SKU_INVALID');
  if (barcode.present && !barcode.value) errors.push('EAN_INVALID');
  if (barcode.numericInput) errors.push('EAN_NUMERIC_INPUT');
  if (ncm.present && !ncm.value) errors.push('NCM_INVALID');
  if (cost.present && cost.cents === null) errors.push('COST_INVALID');
  if (unit.present && !unit.valid) errors.push('UNIT_INVALID');
  return {
    line: index + 1,
    sourceId,
    sku: sku.value,
    barcode: barcode.value,
    ncm: ncm.value,
    costCents: cost.cents,
    costPresent: cost.present,
    unit: unit.value,
    unitPresent: unit.present,
    name,
    empresaId,
    lojaId,
    errors,
  };
}

export function normalizeAvecInput(input = {}) {
  const rows = Array.isArray(input.items) ? input.items : (Array.isArray(input.rows) ? input.rows : []);
  if (!rows.length || rows.length > MAX_AVEC_ITEMS) throw new CommerceError(`a prévia AVEC deve conter entre 1 e ${MAX_AVEC_ITEMS} itens`, 'AVEC_SIZE_INVALID');
  const source = text(input.source || AVEC_SOURCE, 40).toLowerCase();
  if (source !== AVEC_SOURCE) throw new CommerceError('a origem da prévia deve ser AVEC', 'AVEC_SOURCE_INVALID');
  const items = rows.map(normalizeAvecItem);
  const seenIdentifiers = new Map();
  for (const item of items) {
    for (const [kind, value] of [['sourceId', item.sourceId], ['sku', item.sku], ['barcode', item.barcode]]) {
      if (!value) continue;
      const key = `${kind}:${value}`;
      seenIdentifiers.set(key, (seenIdentifiers.get(key) || 0) + 1);
    }
  }
  for (const item of items) {
    for (const [kind, value] of [['sourceId', item.sourceId], ['sku', item.sku], ['barcode', item.barcode]]) {
      if (value && seenIdentifiers.get(`${kind}:${value}`) > 1) item.errors.push(`DUPLICATE_SOURCE_${kind.toUpperCase()}`);
    }
  }
  const canonical = items.map(({ line, ...item }) => item);
  const datasetHash = crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return { source, items, datasetHash, sourceLabel: text(input.sourceLabel || 'export AVEC', 120) };
}

function currentUnit(row) {
  return text(row.unit || row.unit_measure || row.core_unit || row.coreUnit).toUpperCase() || null;
}

function identifierKey(kind, value) {
  return value ? `${kind}:${value}` : null;
}

function uniqueCandidates(entries) {
  const byVariant = new Map();
  for (const entry of entries) {
    const key = String(entry.row.variant_id || entry.row.variantId || '');
    if (!key) continue;
    const current = byVariant.get(key) || { row: entry.row, matchedBy: new Set() };
    for (const criterion of entry.matchedBy || []) current.matchedBy.add(criterion);
    byVariant.set(key, current);
  }
  return [...byVariant.values()];
}

function rowTarget(row) {
  return { productId: row.product_id || row.productId || null, variantId: row.variant_id || row.variantId || null };
}

function candidateForItem(item, indexed) {
  const evidence = [];
  if (item.sourceId) evidence.push(...(indexed.bySource.get(item.sourceId) || []).map(row => ({ row, by: 'source_id' })));
  if (item.sku) evidence.push(...(indexed.bySku.get(item.sku) || []).map(row => ({ row, by: 'sku' })));
  if (item.barcode) evidence.push(...(indexed.byBarcode.get(item.barcode) || []).map(row => ({ row, by: 'ean' })));
  const targets = new Map();
  for (const entry of evidence) {
    const target = rowTarget(entry.row);
    const key = `${target.productId || ''}:${target.variantId || ''}`;
    const current = targets.get(key) || { row: entry.row, matchedBy: new Set() };
    current.matchedBy.add(entry.by);
    targets.set(key, current);
  }
  return [...targets.values()];
}

function proposalFor(item, selected) {
  const row = selected.row;
  const currentCost = row.cost_cents === null || row.cost_cents === undefined ? null : Number(row.cost_cents);
  const currentBarcode = row.barcode ? String(row.barcode) : null;
  const currentNcm = row.ncm ? String(row.ncm) : null;
  const targetUnit = currentUnit(row);
  const changes = [];
  if (item.costPresent && item.costCents !== currentCost) changes.push('custo');
  if (item.barcode && item.barcode !== currentBarcode) changes.push('ean');
  if (item.ncm && item.ncm !== currentNcm) changes.push('ncm');
  return {
    target: rowTarget(row),
    matchedBy: [...selected.matchedBy].sort(),
    current: { costCents: currentCost, barcode: currentBarcode, ncm: currentNcm, unit: targetUnit },
    changes,
    fields: {
      costCents: item.costPresent ? item.costCents : null,
      barcode: item.barcode,
      ncm: item.ncm,
      unit: item.unit,
    },
  };
}

function classifyItem(item, selected, candidateCount) {
  const reasons = [...item.errors];
  if (item.empresaId && !UUID_PATTERN.test(item.empresaId)) reasons.push('TENANT_INVALID');
  if (item.lojaId && !UUID_PATTERN.test(item.lojaId)) reasons.push('STORE_INVALID');
  if (item.empresaId && item.empresaId !== item.scopeEmpresaId) reasons.push('TENANT_MISMATCH');
  if (item.lojaId && item.scopeLojaId && item.lojaId !== item.scopeLojaId) reasons.push('STORE_MISMATCH');
  if (!item.unitPresent) reasons.push('UNIT_MISSING');
  if (selected && item.unit && currentUnit(selected.row) && item.unit !== currentUnit(selected.row)) reasons.push('UNIT_MISMATCH');
  if (selected && !currentUnit(selected.row)) reasons.push('CORE_UNIT_MISSING');
  if (candidateCount > 1) reasons.push('AMBIGUOUS_MATCH');
  if (!selected) reasons.push('NO_EXACT_MATCH');
  if (reasons.includes('DUPLICATE_SOURCE_ID') || reasons.includes('DUPLICATE_SOURCE_SKU') || reasons.includes('DUPLICATE_SOURCE_BARCODE') || reasons.includes('AMBIGUOUS_MATCH')) return { status: 'ambiguous', reasons };
  if (reasons.some(reason => ['TENANT_INVALID', 'STORE_INVALID', 'TENANT_MISMATCH', 'STORE_MISMATCH', 'UNIT_INVALID', 'UNIT_MISMATCH', 'CORE_UNIT_MISSING', 'SKU_INVALID', 'EAN_INVALID', 'NCM_INVALID', 'COST_INVALID', 'EAN_NUMERIC_INPUT'].includes(reason))) return { status: 'conflict', reasons };
  if (!selected || reasons.includes('IDENTIFIER_MISSING') || reasons.includes('UNIT_MISSING')) return { status: 'absent', reasons };
  return { status: 'proposable', reasons };
}

function scopeError(message, code) {
  throw new CommerceError(message, code);
}

export async function validateAvecScope(client, context, input) {
  const empresaId = assertUuid(context?.empresaId, 'empresaId');
  if (!context?.lojaId) scopeError('selecione uma unidade explícita para a prévia AVEC', 'AVEC_SCOPE_REQUIRED');
  const lojaId = assertUuid(context.lojaId, 'lojaId');
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  const locationId = assertUuid(input.locationId, 'locationId');
  const storefront = await client.query(
    `SELECT id, empresa_id, loja_id, status FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2 AND status = 'active'
        AND ($3::uuid IS NULL OR loja_id = $3) LIMIT 1`,
    [empresaId, storefrontId, lojaId],
  );
  if (!storefront.rows[0]) scopeError('storefront fora do tenant/unidade autorizados', 'AVEC_SCOPE_MISMATCH');
  const location = await client.query(
    `SELECT id, empresa_id, loja_id, ativo FROM commerce_inventory_locations
      WHERE empresa_id = $1 AND id = $2 AND ativo = true
        AND ($3::uuid IS NULL OR loja_id = $3) LIMIT 1`,
    [empresaId, locationId, lojaId],
  );
  if (!location.rows[0]) scopeError('local de estoque fora do tenant/unidade autorizados', 'AVEC_SCOPE_MISMATCH');
  if (storefront.rows[0].loja_id && location.rows[0].loja_id && storefront.rows[0].loja_id !== location.rows[0].loja_id) scopeError('storefront e local de estoque pertencem a unidades diferentes', 'AVEC_SCOPE_MISMATCH');
  return { empresaId, lojaId, storefrontId, locationId };
}

async function readCandidates(client, scope, payload) {
  const skus = payload.items.map(item => item.sku).filter(Boolean);
  const barcodes = payload.items.map(item => item.barcode).filter(Boolean);
  const sourceIds = payload.items.map(item => item.sourceId).filter(Boolean);
  const result = await client.query(
    `SELECT DISTINCT v.id AS variant_id, v.product_id, v.sku, v.barcode,
            v.atributos->>'unidade_medida' AS unit,
            p.dados_fiscais->>'ncm' AS ncm,
            latest_price.custo AS cost_cents,
            link.legacy_key AS source_id
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
       JOIN commerce_product_channels channel
         ON channel.empresa_id = p.empresa_id AND channel.product_id = p.id
        AND channel.storefront_id = $4
       LEFT JOIN LATERAL (
         SELECT ROUND(vp.custo * 100)::bigint AS custo
           FROM commerce_variant_prices vp
          WHERE vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
            AND vp.price_list_id = channel.price_list_id
            AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
          ORDER BY vp.vigencia_inicio DESC LIMIT 1
       ) latest_price ON true
       LEFT JOIN commerce_legacy_imports link
         ON link.empresa_id = v.empresa_id AND link.entity = 'product'
        AND link.source = 'avec' AND link.target_id = p.id
        AND link.legacy_key = ANY($5::text[])
        AND (link.loja_id IS NULL OR link.loja_id = $6::uuid)
      WHERE v.empresa_id = $1
        AND (v.sku = ANY($2::text[]) OR v.barcode = ANY($3::text[]) OR link.legacy_key IS NOT NULL)`,
    [scope.empresaId, skus, barcodes, scope.storefrontId, sourceIds, scope.lojaId],
  );
  return result.rows;
}

export function buildAvecPreview(payload, candidateRows, scope) {
  const indexed = { bySource: new Map(), bySku: new Map(), byBarcode: new Map() };
  for (const row of candidateRows) {
    for (const [map, key] of [[indexed.bySource, row.source_id], [indexed.bySku, row.sku ? String(row.sku).toUpperCase() : null], [indexed.byBarcode, row.barcode ? String(row.barcode) : null]]) {
      if (!key) continue;
      const rows = map.get(key) || [];
      rows.push(row);
      map.set(key, rows);
    }
  }
  const items = payload.items.map(rawItem => {
    const item = { ...rawItem, scopeEmpresaId: scope.empresaId, scopeLojaId: scope.lojaId };
    const candidates = uniqueCandidates(candidateForItem(item, indexed));
    const selected = candidates.length === 1 ? candidates[0] : null;
    const classification = classifyItem(item, selected, candidates.length);
    const proposal = classification.status === 'proposable' && selected ? proposalFor(item, selected) : null;
    return {
      line: item.line,
      sourceId: item.sourceId,
      sku: item.sku,
      ean: item.barcode,
      ncm: item.ncm,
      custoCents: item.costCents,
      custoInformado: item.costPresent,
      unidade: item.unit,
      nome: item.name,
      status: classification.status,
      reasons: [...new Set(classification.reasons.concat(classification.status === 'proposable' && proposal?.changes.length === 0 ? ['NO_CHANGE'] : []))],
      proposal,
    };
  });
  const summary = {
    total: items.length,
    proposable: items.filter(item => item.status === 'proposable').length,
    conflict: items.filter(item => item.status === 'conflict').length,
    ambiguous: items.filter(item => item.status === 'ambiguous').length,
    absent: items.filter(item => item.status === 'absent').length,
    noChange: items.filter(item => item.reasons.includes('NO_CHANGE')).length,
    costMissing: items.filter(item => !item.custoInformado).length,
    costZero: items.filter(item => item.custoInformado && item.custoCents === 0).length,
  };
  return {
    mode: 'read-only-avec-catalog-preview',
    source: AVEC_SOURCE,
    datasetHash: payload.datasetHash,
    scope: { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId },
    summary,
    items,
    write: { performed: false, endpoint: null, note: 'Prévia somente; nenhum INSERT, UPDATE ou movimento de estoque foi executado.' },
  };
}

export async function previewAvecCatalog(context, input = {}) {
  const payload = normalizeAvecInput(input);
  const scope = await validateAvecScope(db.queryRead, context, input);
  const rows = await readCandidates(db.queryRead, scope, payload);
  return buildAvecPreview(payload, rows, scope);
}

export { readCandidates };
