import {
  duplicateLines,
  finiteNonNegative,
  isoInstant,
  rowResult,
  safeId,
  safeUuid,
} from './avec-import-governance-common.js';

const AGENDA_TIMEZONE = 'America/Cuiaba';
const AGENDA_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_INTERVAL_MINUTES = 480;
const ACTIVE_STATUSES = new Set(['scheduled', 'confirmed']);
const IGNORED_STATUSES = new Set(['canceled', 'no_show']);
const SOURCE_ID_FIELDS = Object.freeze([
  ['sourceAppointmentId', 'SOURCE_APPOINTMENT_ID_INVALID'],
  ['sourceClientId', 'SOURCE_CLIENT_ID_INVALID'],
  ['sourceProfessionalId', 'SOURCE_PROFESSIONAL_ID_INVALID'],
  ['sourceServiceId', 'SOURCE_SERVICE_ID_INVALID'],
]);

// Ordinal, page and row numbers are not stable source identifiers and cannot be mapped.
const ORDINAL_OR_PAGE_ID = /^(?:page|pagina|página|row|linha|line|index|idx|offset|(?:page|pagina|página|row|linha|line|index|idx|offset)[ _:/-]*\d+(?:[ _:/-]*(?:of|de)[ _:/-]*\d+)?)$/iu;

function isOrdinalOrPageId(value) {
  return ORDINAL_OR_PAGE_ID.test(value);
}

function sourceIdentifier(value, originalIdsVerified) {
  const normalized = safeId(value);
  if (!normalized || isOrdinalOrPageId(normalized)) return null;
  if (/^\d+$/.test(normalized) && originalIdsVerified !== true) return null;
  return normalized;
}

function hasOwn(row, field) {
  return Object.prototype.hasOwnProperty.call(row, field);
}

function parseAgendaInstant(value) {
  const milliseconds = isoInstant(value);
  if (milliseconds === null) return { milliseconds: null, reason: 'INSTANT_INVALID' };
  // Cuiabá uses UTC-04:00; Z is accepted as the unambiguous UTC representation.
  const suffix = value.endsWith('Z') ? 'Z' : value.slice(-6);
  if (suffix !== 'Z' && suffix !== '-04:00') return { milliseconds: null, reason: 'TIMEZONE_OFFSET_INVALID' };
  return { milliseconds, reason: null };
}

function intervalForRow(row, reasons) {
  const start = parseAgendaInstant(row.startAt);
  if (start.reason === 'INSTANT_INVALID') reasons.push('START_AT_INVALID');
  else if (start.reason) reasons.push(start.reason);

  const hasEnd = hasOwn(row, 'endAt') && row.endAt !== null && row.endAt !== undefined && row.endAt !== '';
  const hasDuration = hasOwn(row, 'durationMinutes') && row.durationMinutes !== null && row.durationMinutes !== undefined && row.durationMinutes !== '';
  const durationValid = hasDuration
    && finiteNonNegative(row.durationMinutes)
    && Number.isInteger(row.durationMinutes)
    && row.durationMinutes >= 1
    && row.durationMinutes <= MAX_INTERVAL_MINUTES;
  if (hasDuration && !durationValid) reasons.push('DURATION_INVALID');

  let end = { milliseconds: null, reason: null };
  if (hasEnd) {
    end = parseAgendaInstant(row.endAt);
    if (end.reason === 'INSTANT_INVALID') reasons.push('END_AT_INVALID');
    else if (end.reason) reasons.push(end.reason);
  }
  if (!hasEnd && !hasDuration) reasons.push('END_OR_DURATION_REQUIRED');

  if (start.milliseconds === null || (hasEnd && end.milliseconds === null)) {
    return { startMilliseconds: start.milliseconds, endMilliseconds: null, valid: false };
  }
  if (!hasEnd && !durationValid) return { startMilliseconds: start.milliseconds, endMilliseconds: null, valid: false };

  const endMilliseconds = hasEnd ? end.milliseconds : start.milliseconds + row.durationMinutes * 60 * 1000;
  if (endMilliseconds <= start.milliseconds) reasons.push('INTERVAL_NOT_POSITIVE');
  const intervalMilliseconds = endMilliseconds - start.milliseconds;
  if (intervalMilliseconds > MAX_INTERVAL_MINUTES * 60 * 1000) reasons.push('INTERVAL_TOO_LONG');
  if (hasEnd && hasDuration && endMilliseconds - start.milliseconds !== row.durationMinutes * 60 * 1000) {
    reasons.push('END_DURATION_MISMATCH');
  }
  return {
    startMilliseconds: start.milliseconds,
    endMilliseconds,
    valid: endMilliseconds > start.milliseconds && intervalMilliseconds <= MAX_INTERVAL_MINUTES * 60 * 1000,
  };
}

function rowScopeReasons(row, scopeLojaId, scopeValid) {
  const reasons = [];
  const rowLojaId = safeUuid(row.lojaId);
  if (!scopeValid) reasons.push('SCOPE_INVALID');
  if (!rowLojaId) reasons.push('ROW_LOJA_ID_INVALID');
  else if (scopeLojaId && rowLojaId !== scopeLojaId) reasons.push('ROW_SCOPE_MISMATCH');
  return { reasons, rowLojaId };
}

function evaluateRow(row, line, input, scopeLojaId, scopeValid) {
  const scoped = rowScopeReasons(row, scopeLojaId, scopeValid);
  if (scoped.reasons.length) return { result: rowResult(line, scoped.reasons), candidate: null };
  // Rows explicitly excluded by the approved policy never need creation data.
  // This is classification only; a declared status is not proof of source authenticity.
  if (IGNORED_STATUSES.has(row.status)) {
    return { result: rowResult(line, [row.status === 'canceled' ? 'STATUS_CANCELED_IGNORED' : 'STATUS_NO_SHOW_IGNORED'], true), candidate: null };
  }
  const reasons = [...scoped.reasons];
  const sourceIds = {};
  for (const [field, reason] of SOURCE_ID_FIELDS) {
    const normalized = sourceIdentifier(row[field], row.originalIdsVerified);
    sourceIds[field] = normalized;
    if (!normalized) reasons.push(reason);
  }
  if (hasOwn(row, 'sourceSeriesId') && row.sourceSeriesId !== null && row.sourceSeriesId !== undefined && row.sourceSeriesId !== '') {
    if (!sourceIdentifier(row.sourceSeriesId, row.originalIdsVerified)) reasons.push('SOURCE_SERIES_ID_INVALID');
  }

  if (row.timezone !== AGENDA_TIMEZONE) reasons.push('TIMEZONE_INVALID');
  const statusValid = ACTIVE_STATUSES.has(row.status) || IGNORED_STATUSES.has(row.status);
  if (!statusValid) reasons.push('STATUS_INVALID');
  if (row.individualEventVerified !== true) reasons.push('INDIVIDUAL_EVENT_UNVERIFIED');

  const interval = intervalForRow(row, reasons);
  if (reasons.length) return { result: rowResult(line, reasons), candidate: null };

  if (IGNORED_STATUSES.has(row.status)) {
    return {
      result: rowResult(line, [row.status === 'canceled' ? 'STATUS_CANCELED_IGNORED' : 'STATUS_NO_SHOW_IGNORED'], true),
      candidate: null,
    };
  }

  const cutoff = isoInstant(input?.cutoff);
  if (cutoff === null) {
    return { result: rowResult(line, ['CUTOFF_INVALID']), candidate: null };
  }
  if (interval.startMilliseconds < cutoff || interval.startMilliseconds >= cutoff + AGENDA_WINDOW_MS) {
    return { result: rowResult(line, ['OUTSIDE_AGENDA_WINDOW'], true), candidate: null };
  }

  return {
    result: rowResult(line),
    candidate: {
      line,
      sourceAppointmentId: sourceIds.sourceAppointmentId,
      sourceClientId: sourceIds.sourceClientId,
      sourceProfessionalId: sourceIds.sourceProfessionalId,
      lojaId: scoped.rowLojaId,
      startMilliseconds: interval.startMilliseconds,
      endMilliseconds: interval.endMilliseconds,
    },
  };
}

function rangesOverlap(left, right) {
  return left.startMilliseconds < right.endMilliseconds && right.startMilliseconds < left.endMilliseconds;
}

/**
 * Analyze only the structure of an AVEC agenda export. Validation of the outer
 * governance envelope is intentionally performed by validateGovernanceInput.
 */
export function analyzeAvecAgenda(input = {}, scope = {}) {
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const scopeLojaId = safeUuid(scope?.lojaId);
  const scopeValid = Boolean(safeUuid(scope?.empresaId) && scopeLojaId);
  const evaluated = rows.map((row, index) => evaluateRow(row, index + 1, input, scopeLojaId, scopeValid));
  const candidates = evaluated
    .map((entry, index) => (entry.candidate ? { ...entry.candidate, index } : null))
    .filter(Boolean);

  const duplicateCandidateLines = duplicateLines(candidates, candidate => candidate.sourceAppointmentId);
  for (const localIndex of duplicateCandidateLines) {
    evaluated[candidates[localIndex].index].result = rowResult(
      candidates[localIndex].line,
      [...evaluated[candidates[localIndex].index].result.reasons, 'DUPLICATE_SOURCE_APPOINTMENT_ID'],
    );
  }

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (left.lojaId !== right.lojaId || !rangesOverlap(left, right)) continue;
      const reasonsForLeft = [];
      const reasonsForRight = [];
      if (left.sourceProfessionalId === right.sourceProfessionalId) {
        reasonsForLeft.push('SOURCE_PROFESSIONAL_OVERLAP');
        reasonsForRight.push('SOURCE_PROFESSIONAL_OVERLAP');
      }
      if (left.sourceClientId === right.sourceClientId) {
        reasonsForLeft.push('SOURCE_CLIENT_OVERLAP');
        reasonsForRight.push('SOURCE_CLIENT_OVERLAP');
      }
      if (reasonsForLeft.length) {
        evaluated[left.index].result = rowResult(left.line, [...evaluated[left.index].result.reasons, ...reasonsForLeft]);
        evaluated[right.index].result = rowResult(right.line, [...evaluated[right.index].result.reasons, ...reasonsForRight]);
      }
    }
  }

  return evaluated.map(entry => entry.result);
}
