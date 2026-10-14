import crypto from 'node:crypto';
import { sensitiveGovernanceKey, knownGovernanceSchema } from '../../shared/avec-import-policy.js';

export const AVEC_IMPORT_VERSION = 'avec-dino-governance-v1';
export const AVEC_AGENDA_WINDOW_DAYS = 60;
export const AVEC_IMPORT_MAX_ROWS = 500;
export const AVEC_CATEGORIES = Object.freeze(['products', 'fees', 'materials', 'fiscal', 'agenda']);
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AvecGovernanceError extends Error {
  constructor(code) { super(code); this.name = 'AvecGovernanceError'; this.code = code; }
}
export function isRecord(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
export function hasValue(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
export function safeId(value, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /^[=+\-@]/.test(value.trim())) return null;
  return value.trim();
}
export function safeUuid(value) { return typeof value === 'string' && UUID_RE.test(value) ? value.toLowerCase() : null; }
export function finiteNonNegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
export function isoInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parts = value.slice(0, 19).match(/\d+/g).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const result = Date.parse(value); return Number.isFinite(result) ? result : null;
}
export function assertMinimizedPayload(value, depth = 0) {
  if (depth > 12) throw new AvecGovernanceError('AVEC_PAYLOAD_TOO_DEEP');
  if (typeof value === 'string' && value.length > 1000) throw new AvecGovernanceError('AVEC_FIELD_TOO_LONG');
  if (Array.isArray(value)) { for (const v of value) assertMinimizedPayload(v, depth + 1); return; }
  if (!isRecord(value)) return;
  for (const [key, v] of Object.entries(value)) {
    if (sensitiveGovernanceKey(key)) throw new AvecGovernanceError('AVEC_SENSITIVE_FIELD_REJECTED');
    assertMinimizedPayload(v, depth + 1);
  }
}
export function validateGovernanceInput(input, scope) {
  if (!isRecord(input) || !isRecord(scope)) throw new AvecGovernanceError('AVEC_PAYLOAD_INVALID');
  const empresaId = safeUuid(scope.empresaId), lojaId = safeUuid(scope.lojaId);
  if (!empresaId || !lojaId) throw new AvecGovernanceError('AVEC_SCOPE_REQUIRED');
  if (input.source !== 'avec' || input.contractVersion !== AVEC_IMPORT_VERSION) throw new AvecGovernanceError('AVEC_SOURCE_VERSION_INVALID');
  if (!AVEC_CATEGORIES.includes(input.category)) throw new AvecGovernanceError('AVEC_CATEGORY_INVALID');
  if (!safeId(input.sourceEstablishmentId)) throw new AvecGovernanceError('AVEC_SOURCE_ESTABLISHMENT_REQUIRED');
  if (safeUuid(input.empresaId) !== empresaId || safeUuid(input.lojaId) !== lojaId) throw new AvecGovernanceError('AVEC_SCOPE_MISMATCH');
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > AVEC_IMPORT_MAX_ROWS || input.rows.some(r => !isRecord(r))) throw new AvecGovernanceError('AVEC_ROWS_INVALID');
  if (!isoInstant(input.extractedAt) || !isoInstant(input.cutoff)) throw new AvecGovernanceError('AVEC_INSTANT_REQUIRED');
  if (input.writerEnabled === true || input.apply === true || input.execute === true) throw new AvecGovernanceError('AVEC_APPLY_DISABLED');
  assertMinimizedPayload(input);
  if (!knownGovernanceSchema(input)) throw new AvecGovernanceError('AVEC_FIELD_NOT_ALLOWED');
  return { empresaId, lojaId };
}
export function rowResult(line, reasons = [], ignored = false) {
  const codes = [...new Set(reasons)].sort();
  return { line, status: ignored ? 'ignored' : codes.length ? 'blocked' : 'ready_for_mapping', reasons: codes };
}
export function duplicateLines(rows, keyOf) {
  const seen = new Map(), duplicated = new Set();
  rows.forEach((row, index) => {
    const key = keyOf(row); if (!key) return;
    if (seen.has(key)) { duplicated.add(seen.get(key)); duplicated.add(index); } else seen.set(key, index);
  }); return duplicated;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
}
export function buildGovernanceResult(input, scope, rows) {
  const summary = { total: rows.length, readyForMapping: 0, blocked: 0, ignored: 0, readyToApply: 0 };
  for (const row of rows) { if (row.status === 'ready_for_mapping') summary.readyForMapping++; else if (row.status === 'ignored') summary.ignored++; else summary.blocked++; }
  const hash = crypto.createHash('sha256').update(JSON.stringify(stable({ version: AVEC_IMPORT_VERSION, input, scope }))).digest('hex');
  return {
    mode: 'read-only-avec-import-governance', contractVersion: AVEC_IMPORT_VERSION,
    category: input.category, scope: { empresaId: scope.empresaId, lojaId: scope.lojaId }, previewHash: hash,
    summary, rows,
    policy: { agendaWindowDays: AVEC_AGENDA_WINDOW_DAYS, timezone: 'America/Cuiaba', preservePrice: true, preserveStock: true, preserveReservations: true, preservePublication: true, ignoreCanceled: true, ignoreNoShow: true, blockConflicts: true, recurrence: 'verified_individual_events_only' },
    blockers: ['SOURCE_ESTABLISHMENT_BINDING_REQUIRED', 'DESTINATION_BASELINE_AND_MAPPING_REQUIRED', 'FINAL_LOT_APPROVAL_REQUIRED', 'OFFICIAL_WRITER_NOT_ENABLED'],
    write: { performed: false, enabled: false, endpoint: null },
    note: 'Estrutura de origem conferida; isto não comprova mapeamento, cadastro destino, ausência de conflito nem aprovação de carga.',
  };
}
