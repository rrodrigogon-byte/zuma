import {
  duplicateLines,
  finiteNonNegative,
  isoInstant,
  rowResult,
  safeId,
  safeUuid,
} from './avec-import-governance-common.js';

const UNITS = Object.freeze(new Set(['un', 'g', 'kg', 'ml', 'l']));
const UNIT_FAMILY = Object.freeze({
  un: 'count',
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
});

// These are deliberately fixed codes: row output never contains source values.
const MATERIAL_REASONS = Object.freeze({
  SCOPE_INVALID: 'SCOPE_INVALID',
  CUTOFF_INVALID: 'CUTOFF_INVALID',
  SOURCE_ID_INVALID: 'SOURCE_ID_INVALID',
  SOURCE_SERVICE_ID_INVALID: 'SOURCE_SERVICE_ID_INVALID',
  SOURCE_PRODUCT_ID_INVALID: 'SOURCE_PRODUCT_ID_INVALID',
  QUANTITY_INVALID: 'QUANTITY_INVALID',
  REFERENCE_QUANTITY_INVALID: 'REFERENCE_QUANTITY_INVALID',
  CONSUMPTION_UNIT_INVALID: 'CONSUMPTION_UNIT_INVALID',
  REFERENCE_UNIT_INVALID: 'REFERENCE_UNIT_INVALID',
  UNIT_FAMILY_MISMATCH: 'UNIT_FAMILY_MISMATCH',
  COST_CENTS_MISSING: 'COST_CENTS_MISSING',
  COST_CENTS_INVALID: 'COST_CENTS_INVALID',
  COST_EVIDENCE_MISSING: 'COST_EVIDENCE_MISSING',
  STORE_ID_MISSING: 'STORE_ID_MISSING',
  STORE_ID_INVALID: 'STORE_ID_INVALID',
  STORE_SCOPE_MISMATCH: 'STORE_SCOPE_MISMATCH',
  SERVICE_UNIT_UNCONFIRMED: 'SERVICE_UNIT_UNCONFIRMED',
  DUPLICATE_SOURCE_ID: 'DUPLICATE_SOURCE_ID',
});

const hasOwn = (value, key) => Boolean(
  value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key),
);

function hasSafeId(value) {
  return safeId(value) !== null;
}

function hasPositiveFiniteNumber(value) {
  return finiteNonNegative(value) && value > 0;
}

function hasExplicitCost(row) {
  return hasOwn(row, 'costCents') && row.costCents !== null && row.costCents !== undefined;
}

function classifyMaterialRow(row, line, scopeLojaId, scopeValid, cutoffValid, duplicate) {
  const reasons = [];

  if (!scopeValid) reasons.push(MATERIAL_REASONS.SCOPE_INVALID);
  if (!cutoffValid) reasons.push(MATERIAL_REASONS.CUTOFF_INVALID);

  if (!hasSafeId(row?.sourceId)) reasons.push(MATERIAL_REASONS.SOURCE_ID_INVALID);
  if (!hasSafeId(row?.sourceServiceId)) reasons.push(MATERIAL_REASONS.SOURCE_SERVICE_ID_INVALID);
  if (!hasSafeId(row?.sourceProductId)) reasons.push(MATERIAL_REASONS.SOURCE_PRODUCT_ID_INVALID);

  if (!hasPositiveFiniteNumber(row?.quantity)) reasons.push(MATERIAL_REASONS.QUANTITY_INVALID);
  if (!hasPositiveFiniteNumber(row?.referenceQuantity)) reasons.push(MATERIAL_REASONS.REFERENCE_QUANTITY_INVALID);

  const consumptionUnitValid = typeof row?.consumptionUnit === 'string' && UNITS.has(row.consumptionUnit);
  const referenceUnitValid = typeof row?.referenceUnit === 'string' && UNITS.has(row.referenceUnit);
  if (!consumptionUnitValid) reasons.push(MATERIAL_REASONS.CONSUMPTION_UNIT_INVALID);
  if (!referenceUnitValid) reasons.push(MATERIAL_REASONS.REFERENCE_UNIT_INVALID);
  if (
    consumptionUnitValid
    && referenceUnitValid
    && UNIT_FAMILY[row.consumptionUnit] !== UNIT_FAMILY[row.referenceUnit]
  ) {
    reasons.push(MATERIAL_REASONS.UNIT_FAMILY_MISMATCH);
  }

  if (!hasExplicitCost(row)) {
    reasons.push(MATERIAL_REASONS.COST_CENTS_MISSING);
  } else if (!Number.isSafeInteger(row.costCents) || !finiteNonNegative(row.costCents)) {
    reasons.push(MATERIAL_REASONS.COST_CENTS_INVALID);
  }
  if (typeof row?.costEvidence !== 'string' || row.costEvidence.trim() === '') {
    reasons.push(MATERIAL_REASONS.COST_EVIDENCE_MISSING);
  }

  if (row?.lojaId === undefined || row?.lojaId === null || row.lojaId === '') {
    reasons.push(MATERIAL_REASONS.STORE_ID_MISSING);
  } else {
    const rowLojaId = safeUuid(row.lojaId);
    if (!rowLojaId) reasons.push(MATERIAL_REASONS.STORE_ID_INVALID);
    else if (scopeLojaId === null || rowLojaId !== scopeLojaId) reasons.push(MATERIAL_REASONS.STORE_SCOPE_MISMATCH);
  }

  if (row?.serviceUnitConfirmed !== true) reasons.push(MATERIAL_REASONS.SERVICE_UNIT_UNCONFIRMED);
  if (duplicate) reasons.push(MATERIAL_REASONS.DUPLICATE_SOURCE_ID);

  return rowResult(line, reasons);
}

/**
 * Analyze AVEC material rows without mapping, calculating, mutating, or writing.
 * The caller is responsible for running validateGovernanceInput first.
 */
export function analyzeAvecMaterials(input = {}, scope = {}) {
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const empresaId = safeUuid(scope?.empresaId);
  const lojaId = safeUuid(scope?.lojaId);
  const scopeValid = empresaId !== null && lojaId !== null;
  // validateGovernanceInput guarantees this in normal orchestration; checking it here
  // keeps direct calls deterministic and avoids any dependency on the current date.
  const cutoffValid = isoInstant(input?.cutoff) !== null;
  const duplicateIndexes = duplicateLines(rows, row => safeId(row?.sourceId));

  return rows.map((row, index) => classifyMaterialRow(
    row,
    index + 1,
    lojaId,
    scopeValid,
    cutoffValid,
    duplicateIndexes.has(index),
  ));
}
