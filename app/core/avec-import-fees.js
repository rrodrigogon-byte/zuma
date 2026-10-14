import {
  duplicateLines,
  finiteNonNegative,
  isoInstant,
  rowResult,
  safeId,
  safeUuid,
} from './avec-import-governance-common.js';

const CARD_METHODS = new Map([
  ['credit', 'credit'],
  ['credit_card', 'credit'],
  ['credito', 'credit'],
  ['crédito', 'credit'],
  ['credito_cartao', 'credit'],
  ['crédito_cartão', 'credit'],
  ['debit', 'debit'],
  ['debit_card', 'debit'],
  ['debito', 'debit'],
  ['débito', 'debit'],
  ['debito_cartao', 'debit'],
  ['débito_cartão', 'debit'],
]);

const NON_CARD_METHODS = new Set([
  'boleto',
  'cash',
  'dinheiro',
  'other',
  'outros',
  'pix',
  'transfer',
  'transferencia',
  'transferência',
  'voucher',
  'wallet',
]);

const ANTICIPATION_MODES = new Set(['none', 'separate']);
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function hasOwn(row, key) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function present(row, key) {
  return hasOwn(row, key) && row[key] !== null && row[key] !== undefined;
}

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function normalizedMethod(value) {
  const text = normalizedText(value);
  if (!text) return null;
  return CARD_METHODS.get(text) || (NON_CARD_METHODS.has(text) ? text : null);
}

function dateOnly(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY_RE.exec(value);
  if (!match || Number(match[1]) < 1) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  const canonical = new Date(parsed).toISOString().slice(0, 10);
  return canonical === value ? { value, day: Math.trunc(parsed / 86400000) } : null;
}

function cutoffDay(input) {
  const instant = isoInstant(input?.cutoff);
  if (instant === null) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const value = type => parts.find(part => part.type === type).value;
  return dateOnly(`${value('year')}-${value('month')}-${value('day')}`).day;
}

function validSafeId(row, key, reason, reasons) {
  const value = safeId(row[key]);
  if (!value) reasons.push(reason);
  return value;
}

function validMoneyCents(row, reasons) {
  if (!present(row, 'fixedCents')) return null;
  const value = row.fixedCents;
  if (!finiteNonNegative(value) || !Number.isSafeInteger(value)) {
    reasons.push('FIXED_CENTS_INVALID');
    return null;
  }
  return value;
}

function validPercent(row, reasons) {
  if (!present(row, 'percent')) return null;
  const value = row.percent;
  if (!finiteNonNegative(value) || value > 100) {
    reasons.push('PERCENT_INVALID');
    return null;
  }
  return value;
}

function validInstallments(row, method, reasons) {
  if (method !== 'credit' && method !== 'debit') return null;
  const value = row.installments;
  if (!finiteNonNegative(value) || !Number.isSafeInteger(value) || value < 1 || value > 24 || (method === 'debit' && value !== 1)) {
    reasons.push('INSTALLMENTS_INVALID');
    return null;
  }
  return value;
}

function analyzeRow(row, line, cutoff) {
  const reasons = [];
  const sourceId = validSafeId(row, 'sourceId', 'SOURCE_ID_INVALID', reasons);
  const acquirer = validSafeId(row, 'acquirer', 'ACQUIRER_INVALID', reasons);
  const contractRef = validSafeId(row, 'contractRef', 'CONTRACT_REF_INVALID', reasons);

  const methodValue = safeId(row.method);
  const method = normalizedMethod(row.method);
  if (!methodValue || !method) reasons.push('METHOD_INVALID');

  const isCard = method === 'credit' || method === 'debit';
  let brand = null;
  if (isCard) {
    brand = safeId(row.brand);
    if (!brand) reasons.push('BRAND_INVALID');
  }
  const installments = validInstallments(row, method, reasons);

  const percent = validPercent(row, reasons);
  const fixedCents = validMoneyCents(row, reasons);
  if (!present(row, 'percent') && !present(row, 'fixedCents')) reasons.push('FEE_COMPONENT_REQUIRED');

  let anticipationMode = null;
  if (!present(row, 'anticipationMode')) {
    reasons.push('ANTICIPATION_MODE_REQUIRED');
  } else {
    const rawAnticipation = normalizedText(row.anticipationMode);
    if (rawAnticipation === 'unknown') reasons.push('ANTICIPATION_UNKNOWN');
    else if (!ANTICIPATION_MODES.has(rawAnticipation)) reasons.push('ANTICIPATION_MODE_INVALID');
    else anticipationMode = rawAnticipation;
  }

  const settlementDays = row.settlementDays;
  if (!finiteNonNegative(settlementDays) || !Number.isSafeInteger(settlementDays) || settlementDays > 365) {
    reasons.push('SETTLEMENT_DAYS_INVALID');
  }

  const from = dateOnly(row.validFrom);
  const to = dateOnly(row.validTo);
  if (!from) reasons.push('VALID_FROM_INVALID');
  if (!to) reasons.push('VALID_TO_INVALID');
  if (from && to && from.day > to.day) reasons.push('VALIDITY_INVALID');
  if (from && to && from.day <= to.day && (cutoff === null || cutoff < from.day || cutoff > to.day)) {
    reasons.push('VALIDITY_NOT_COVERING_CUTOFF');
  }

  const rowLojaId = safeUuid(row.lojaId);
  if (!rowLojaId) reasons.push('LOJA_ID_INVALID');

  const structurallyValid = reasons.length === 0;
  return {
    line,
    reasons,
    sourceId,
    acquirer,
    contractRef,
    method,
    brand: brand ? normalizedText(brand) : null,
    installments,
    percent,
    fixedCents,
    anticipationMode,
    settlementDays: Number.isSafeInteger(settlementDays) ? settlementDays : null,
    from,
    to,
    structurallyValid,
    key: structurallyValid
      ? [acquirer.toLowerCase(), method, brand ? normalizedText(brand) : '', installments ?? '', anticipationMode].join('|')
      : null,
    terms: structurallyValid
      ? [percent, fixedCents, settlementDays].join('|')
      : null,
  };
}

function addReason(reasonSets, index, reason) {
  reasonSets[index].add(reason);
}

function markOverlappingKeys(parsed, reasonSets) {
  const repeated = duplicateLines(parsed, entry => entry.key);
  if (!repeated.size) return;

  const byKey = new Map();
  for (const index of repeated) {
    const entry = parsed[index];
    const indexes = byKey.get(entry.key) || [];
    indexes.push(index);
    byKey.set(entry.key, indexes);
  }

  for (const indexes of byKey.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const a = parsed[indexes[left]];
        const b = parsed[indexes[right]];
        if (a.from.day > b.to.day || b.from.day > a.to.day) continue;
        const reason = a.terms === b.terms ? 'DUPLICATE_FEE' : 'FEE_CONFLICT';
        addReason(reasonSets, indexes[left], reason);
        addReason(reasonSets, indexes[right], reason);
      }
    }
  }
}

/**
 * Analisa somente a estrutura de uma previsão de taxas AVEC.
 * A validação do envelope (incluindo o limite de 500 linhas) ocorre antes desta função.
 */
export function analyzeAvecFees(input, scope) {
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const cutoff = cutoffDay(input);
  const scopeLojaId = safeUuid(scope?.lojaId);
  const reasonSets = rows.map(() => new Set());
  const parsed = rows.map((row, index) => {
    const analyzed = analyzeRow(row, index + 1, cutoff);
    const rowLojaId = safeUuid(row.lojaId);
    if (!scopeLojaId) addReason(reasonSets, index, 'SCOPE_INVALID');
    else if (!rowLojaId || rowLojaId !== scopeLojaId) {
      addReason(reasonSets, index, 'LOJA_ID_MISMATCH');
      analyzed.key = null;
    }
    if (!scopeLojaId) analyzed.key = null;
    return analyzed;
  });

  markOverlappingKeys(parsed, reasonSets);

  return parsed.map((entry, index) => rowResult(entry.line, [...entry.reasons, ...reasonSets[index]], false));
}
