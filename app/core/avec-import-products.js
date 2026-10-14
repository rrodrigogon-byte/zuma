import { normalizeAvecItem } from './avec-catalog-preview.js';
import {
  duplicateLines,
  finiteNonNegative,
  isoInstant,
  rowResult,
  safeId,
  safeUuid,
} from './avec-import-governance-common.js';

const COST_NATURES = new Set([
  'declared_purchase',
  'declared_registration',
  'confirmed_zero',
]);
const COST_NATURES_REQUIRING_AMOUNT = new Set([
  'declared_purchase',
  'declared_registration',
]);
const OUT_OF_SCOPE_FIELDS = Object.freeze([
  'preco',
  'price',
  'estoque',
  'stock',
  'publicado',
  'statusPublicacao',
]);
const NORMALIZER_ERROR_CODES = new Set([
  'AVEC_FORMULA_CELL',
  'AVEC_FIELD_TOO_LONG',
]);
const NORMALIZER_ROW_ERRORS = new Set([
  'IDENTIFIER_MISSING',
  'SKU_INVALID',
  'EAN_INVALID',
  'EAN_NUMERIC_INPUT',
  'NCM_INVALID',
  'COST_INVALID',
  'UNIT_INVALID',
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function normalizeErrorReason(error) {
  if (NORMALIZER_ERROR_CODES.has(error?.code)) {
    return error.code === 'AVEC_FORMULA_CELL' ? 'FORMULA_CELL_REJECTED' : 'FIELD_TOO_LONG';
  }
  return 'ROW_NORMALIZATION_INVALID';
}

function normalizeRow(raw, line) {
  try {
    const item = normalizeAvecItem(raw, line - 1);
    return { item, reasons: item.errors.filter(reason => NORMALIZER_ROW_ERRORS.has(reason)) };
  } catch (error) {
    return { item: null, reasons: [normalizeErrorReason(error)] };
  }
}

function duplicateReasonSets(rows) {
  return {
    sourceId: duplicateLines(rows, row => row.item?.sourceId || null),
    sku: duplicateLines(rows, row => row.item?.sku || null),
    ean: duplicateLines(rows, row => row.item?.barcode || null),
  };
}

function appendScopeReasons(reasons, item, scope) {
  const empresaId = safeUuid(scope?.empresaId);
  const lojaId = safeUuid(scope?.lojaId);
  if (!empresaId || !lojaId) reasons.push('SCOPE_INVALID');

  if (!item) return;
  if (item.empresaId) {
    const rowEmpresaId = safeUuid(item.empresaId);
    if (!rowEmpresaId) reasons.push('TENANT_SCOPE_INVALID');
    else if (empresaId && rowEmpresaId !== empresaId) reasons.push('TENANT_SCOPE_MISMATCH');
  }
  if (item.lojaId) {
    const rowLojaId = safeUuid(item.lojaId);
    if (!rowLojaId) reasons.push('STORE_SCOPE_INVALID');
    else if (lojaId && rowLojaId !== lojaId) reasons.push('STORE_SCOPE_MISMATCH');
  }
}

function appendProductReasons(reasons, raw, item, cutoffMs) {
  if (!cutoffMs) reasons.push('CUTOFF_INVALID');

  if (OUT_OF_SCOPE_FIELDS.some(field => hasOwn(raw, field))) {
    reasons.push('PRICE_STOCK_PUBLICATION_OUT_OF_SCOPE');
  }

  const custoNature = raw?.custoNature;
  if (typeof custoNature !== 'string' || !COST_NATURES.has(custoNature)) {
    reasons.push('COST_NATURE_REQUIRED');
  } else {
    if ((!item?.costPresent && COST_NATURES_REQUIRING_AMOUNT.has(custoNature))
      || (!item?.costPresent && custoNature === 'confirmed_zero')) {
      reasons.push('COST_MISSING');
    }
    if (custoNature === 'confirmed_zero' && item?.costPresent && item.costCents !== 0) {
      reasons.push('COST_NATURE_MISMATCH');
    }
  }

  if (!item) return;

  if (item.sourceId && !safeId(item.sourceId)) reasons.push('SOURCE_ID_INVALID');
  if (!item.sourceId && !item.sku && !item.barcode) reasons.push('IDENTIFIER_MISSING');
  if (!item.unitPresent) reasons.push('UNIT_MISSING');
  if (item.costPresent && !finiteNonNegative(item.costCents)) reasons.push('COST_INVALID');
}

/**
 * Analisa uma carga de produtos AVEC sem consultar, escrever ou propor dados do destino.
 * A validação estrutural de input/scope é responsabilidade do orquestrador comum.
 */
export function analyzeAvecProducts(input, scope) {
  const rawRows = Array.isArray(input?.rows) ? input.rows : [];
  const cutoffMs = isoInstant(input?.cutoff);
  const normalizedRows = rawRows.map((raw, index) => ({
    line: index + 1,
    raw,
    ...normalizeRow(raw, index + 1),
  }));
  const duplicates = duplicateReasonSets(normalizedRows);

  return normalizedRows.map(({ line, raw, item, reasons: normalizationReasons }, index) => {
    const reasons = [...normalizationReasons];
    appendProductReasons(reasons, raw, item, cutoffMs);
    appendScopeReasons(reasons, item, scope);

    if (duplicates.sourceId.has(index)) reasons.push('DUPLICATE_SOURCE_ID');
    if (duplicates.sku.has(index)) reasons.push('DUPLICATE_SOURCE_SKU');
    if (duplicates.ean.has(index)) reasons.push('DUPLICATE_SOURCE_EAN');

    return rowResult(line, reasons);
  });
}
