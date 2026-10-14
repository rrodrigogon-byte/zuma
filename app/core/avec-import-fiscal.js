import {
  duplicateLines,
  finiteNonNegative,
  isoInstant,
  rowResult,
  safeId,
  safeUuid,
} from './avec-import-governance-common.js';

export const schemaId = 'fiscal';

export const AVEC_FISCAL_REASONS = Object.freeze({
  CUTOFF_INVALID: 'CUTOFF_INVALID',
  ROW_COUNT_INVALID: 'ROW_COUNT_INVALID',
  ROW_FORMAT_INVALID: 'ROW_FORMAT_INVALID',
  CNPJ_FORMAT_INVALID: 'CNPJ_FORMAT_INVALID',
  CNPJ_DV_INVALID: 'CNPJ_DV_INVALID',
  REQUIRED_FIELD_INVALID: 'REQUIRED_FIELD_INVALID',
  SOURCE_REF_INVALID: 'SOURCE_REF_INVALID',
  FISCAL_REVIEW_UNCONFIRMED: 'FISCAL_REVIEW_UNCONFIRMED',
  REVIEW_SCOPE_REQUIRED: 'REVIEW_SCOPE_REQUIRED',
  REVIEW_SCOPE_INVALID: 'REVIEW_SCOPE_INVALID',
  SCOPE_INVALID: 'SCOPE_INVALID',
  LOJA_ID_INVALID: 'LOJA_ID_INVALID',
  LOJA_SCOPE_MISMATCH: 'LOJA_SCOPE_MISMATCH',
  EMPRESA_SCOPE_MISMATCH: 'EMPRESA_SCOPE_MISMATCH',
  REGIME_INVALID: 'REGIME_INVALID',
  INSCRIPTION_REQUIRED: 'INSCRIPTION_REQUIRED',
  INSCRIPTION_FORMAT_INVALID: 'INSCRIPTION_FORMAT_INVALID',
  ADDRESS_INVALID: 'ADDRESS_INVALID',
  DATA_FORMAT_REQUIRED: 'DATA_FORMAT_REQUIRED',
  DATA_FORMAT_INVALID: 'DATA_FORMAT_INVALID',
  DOCUMENTS_INVALID: 'DOCUMENTS_INVALID',
  DUPLICATE_CNPJ: 'DUPLICATE_CNPJ',
  DUPLICATE_SOURCE_REF: 'DUPLICATE_SOURCE_REF',
});

const REASON = AVEC_FISCAL_REASONS;
const REGIMES = new Set(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']);
const REGIME_MAPPING = 'simples->simples_nacional';
const INSCRIPTION_STATES = new Set(['provided', 'exempt', 'not_applicable']);
const BRAZILIAN_UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);
const REVIEW_SCOPE_NAMES = new Set(['fiscal', 'fiscal_only', 'empresa_loja', 'loja']);
const DOCUMENT_SENSITIVE_KEY = /^(?:password|senha|token|secret|certificates?|certificados?|credentials?|credenciais?|privateKey|chavePrivada|csc|cookie|authorization|cpf|nomeCliente|clientName|telefone|phone|email)$/i;

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function text(value) {
  return safeId(value) !== null;
}

function cnpjCheckDigit(base, weights) {
  const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? '0' : String(11 - remainder);
}

function cnpjReason(value) {
  if (typeof value !== 'string' || !/^\d{14}$/.test(value)) return REASON.CNPJ_FORMAT_INVALID;
  if (/^(\d)\1{13}$/.test(value)) return REASON.CNPJ_DV_INVALID;
  const first = cnpjCheckDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjCheckDigit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.slice(12) === first + second ? null : REASON.CNPJ_DV_INVALID;
}

function inscriptionReason(value) {
  if (!isRecord(value) || !hasOwn(value, 'state') || !hasOwn(value, 'value')) return REASON.INSCRIPTION_FORMAT_INVALID;
  if (!INSCRIPTION_STATES.has(value.state)) return REASON.INSCRIPTION_FORMAT_INVALID;
  if (value.state === 'provided') return text(value.value) ? null : REASON.INSCRIPTION_REQUIRED;
  return value.value === null || value.value === '' ? null : REASON.INSCRIPTION_FORMAT_INVALID;
}

function addressNumberValid(value) {
  if (typeof value === 'number') return finiteNonNegative(value) && Number.isSafeInteger(value);
  return text(value);
}

function addressValid(value) {
  if (!isRecord(value)) return false;
  if (typeof value.cep !== 'string' || !/^(?:\d{8}|\d{5}-\d{3})$/.test(value.cep)) return false;
  return text(value.logradouro)
    && addressNumberValid(value.numero)
    && text(value.bairro)
    && text(value.cidade)
    && typeof value.uf === 'string'
    && BRAZILIAN_UFS.has(value.uf);
}

function declaredRegimeValid(value, row) {
  if (typeof value === 'string') {
    if (REGIMES.has(value)) return true;
    if (value !== 'simples') return false;
    const mapping = row.regimeMapping;
    return mapping === REGIME_MAPPING || (
      isRecord(mapping)
      && mapping.from === 'simples'
      && mapping.to === 'simples_nacional'
      && mapping.declared === true
    );
  }
  return isRecord(value)
    && value.from === 'simples'
    && value.to === 'simples_nacional'
    && value.declared === true;
}

function minimizedDocumentTree(value, depth = 0) {
  if (depth > 8) return false;
  if (Array.isArray(value)) return value.every(item => minimizedDocumentTree(item, depth + 1));
  if (!isRecord(value)) return true;
  return Object.entries(value).every(([key, child]) => {
    if (DOCUMENT_SENSITIVE_KEY.test(key)) return false;
    return minimizedDocumentTree(child, depth + 1);
  });
}

function documentsValid(value) {
  if (value === undefined) return true;
  if (!minimizedDocumentTree(value)) return false;
  if (Array.isArray(value)) return value.length > 0 && value.every(item => isRecord(item) && item.authenticated === true);
  return isRecord(value) && value.authenticated === true;
}

function reviewScopeValid(value, scope) {
  if (typeof value === 'string') return REVIEW_SCOPE_NAMES.has(value);
  if (!isRecord(value)) return false;
  return safeUuid(value.empresaId) === scope.empresaId && safeUuid(value.lojaId) === scope.lojaId;
}

function dataFormatValid(value) {
  if (typeof value === 'string') return text(value);
  return isRecord(value) && text(value.format) && (value.version === undefined || text(value.version));
}

function duplicateIndexes(rows) {
  return {
    cnpj: duplicateLines(rows, row => (typeof row?.cnpj === 'string' && /^\d{14}$/.test(row.cnpj) ? row.cnpj : null)),
    sourceRef: duplicateLines(rows, row => safeId(row?.sourceRef)),
  };
}

function analyzeRow(row, line, input, scope, duplicates) {
  const reasons = [];
  if (isoInstant(input?.cutoff) === null) reasons.push(REASON.CUTOFF_INVALID);
  if (input?.rows?.length !== 1) reasons.push(REASON.ROW_COUNT_INVALID);
  if (!isRecord(row)) return rowResult(line, [...reasons, REASON.ROW_FORMAT_INVALID]);

  const cnpjFailure = cnpjReason(row.cnpj);
  if (cnpjFailure) reasons.push(cnpjFailure);
  if (!text(row.razaoSocial) || !text(row.nomeFantasia)) reasons.push(REASON.REQUIRED_FIELD_INVALID);
  if (!text(row.sourceRef)) reasons.push(REASON.SOURCE_REF_INVALID);
  if (row.fiscalReviewConfirmed !== true) reasons.push(REASON.FISCAL_REVIEW_UNCONFIRMED);

  if (!scope.empresaId || !scope.lojaId) reasons.push(REASON.SCOPE_INVALID);
  const rowLojaId = safeUuid(row.lojaId);
  if (!rowLojaId) reasons.push(REASON.LOJA_ID_INVALID);
  else if (scope.lojaId && rowLojaId !== scope.lojaId) reasons.push(REASON.LOJA_SCOPE_MISMATCH);
  if (hasOwn(row, 'empresaId') && safeUuid(row.empresaId) !== scope.empresaId) reasons.push(REASON.EMPRESA_SCOPE_MISMATCH);

  const reviewScope = row.reviewScope ?? row.fiscalReviewScope ?? input?.reviewScope;
  if (reviewScope === undefined) reasons.push(REASON.REVIEW_SCOPE_REQUIRED);
  else if (!reviewScopeValid(reviewScope, scope)) reasons.push(REASON.REVIEW_SCOPE_INVALID);

  if (!declaredRegimeValid(row.regime, row)) reasons.push(REASON.REGIME_INVALID);

  for (const key of ['inscricaoEstadual', 'inscricaoMunicipal']) {
    if (row[key] === undefined || row[key] === null) {
      reasons.push(REASON.INSCRIPTION_REQUIRED);
    } else {
      const failure = inscriptionReason(row[key]);
      if (failure) reasons.push(failure);
    }
  }

  if (!addressValid(row.address)) reasons.push(REASON.ADDRESS_INVALID);

  const dataFormat = row.dataFormat ?? input?.dataFormat;
  if (dataFormat === undefined) reasons.push(REASON.DATA_FORMAT_REQUIRED);
  else if (!dataFormatValid(dataFormat)) reasons.push(REASON.DATA_FORMAT_INVALID);

  if (!documentsValid(row.documents)) reasons.push(REASON.DOCUMENTS_INVALID);
  if (duplicates.cnpj.has(line - 1)) reasons.push(REASON.DUPLICATE_CNPJ);
  if (duplicates.sourceRef.has(line - 1)) reasons.push(REASON.DUPLICATE_SOURCE_REF);

  return rowResult(line, reasons);
}

/**
 * Analyze the single-row fiscal AVEC contract without producing a destination
 * payload. The governance envelope is validated by the shared orchestrator.
 */
export function analyzeAvecFiscal(input = {}, scope = {}) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const trustedScope = {
    empresaId: safeUuid(scope.empresaId),
    lojaId: safeUuid(scope.lojaId),
  };
  const duplicates = duplicateIndexes(rows);
  return rows.map((row, index) => analyzeRow(row, index + 1, input, trustedScope, duplicates));
}
