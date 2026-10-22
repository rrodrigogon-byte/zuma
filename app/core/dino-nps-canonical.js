import { createHash, randomUUID } from 'node:crypto';
import pgDb from '../db-pg.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
let runtimeReadiness = { ready: false, code: 'DINO_NPS_SCHEMA_NOT_READY' };

/**
 * O servidor atualiza esta marca depois de comparar o ledger de migrations.
 * Ela não aplica schema e começa fechada para que a flag canônica nunca
 * habilite gravações implicitamente.
 */
export function setDinoNpsSchemaReadiness(ready, code = '') {
  runtimeReadiness = ready
    ? { ready: true, code: '' }
    : { ready: false, code: code || 'DINO_NPS_SCHEMA_NOT_READY' };
  return runtimeReadiness;
}

export function getDinoNpsSchemaReadiness() {
  return { ...runtimeReadiness };
}

export class DinoNpsError extends Error {
  constructor(message, statusCode = 400, code = 'DINO_NPS_ERROR') {
    super(message);
    this.name = 'DinoNpsError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function value(input, ...keys) {
  for (const key of keys) {
    if (input?.[key] !== undefined && input?.[key] !== null && input[key] !== '') return input[key];
  }
  return null;
}

function requiredUuid(input, field) {
  const result = String(input || '').trim();
  if (!UUID.test(result)) throw new DinoNpsError(`${field} inválido.`, 400, 'INVALID_SCOPE');
  return result;
}

function scopeOf(context = {}) {
  return {
    empresaId: requiredUuid(value(context, 'empresaId', 'empresa_id'), 'empresaId'),
    lojaId: requiredUuid(value(context, 'lojaId', 'loja_id'), 'lojaId'),
  };
}

function cleanText(input, max) {
  const result = String(input ?? '').trim();
  return result ? result.slice(0, max) : null;
}

function normalizePhone(input) {
  return String(input ?? '').replace(/\D/g, '');
}

function parseDate(input, field) {
  const date = new Date(input);
  if (!input || Number.isNaN(date.getTime())) throw new DinoNpsError(`${field} inválido.`, 400, 'INVALID_DATE');
  return date;
}

function score(input) {
  const number = Number(input);
  if (!Number.isInteger(number) || number < 0 || number > 10) {
    throw new DinoNpsError('A nota NPS deve ser um inteiro entre 0 e 10.', 400, 'NPS_SCORE_INVALID');
  }
  return number;
}

function fingerprintFor(payload, supplied) {
  if (supplied !== undefined && supplied !== null && supplied !== '') {
    const fingerprint = String(supplied).trim().toLowerCase();
    if (!HEX64.test(fingerprint)) throw new DinoNpsError('Fingerprint inválido.', 400, 'FINGERPRINT_INVALID');
    return fingerprint;
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function mutationIdentity(context, payload) {
  const actionId = value(context, 'actionId', 'action_id');
  const idempotencyKey = value(context, 'idempotencyKey', 'idempotency_key');
  if (actionId !== null && !UUID.test(String(actionId))) {
    throw new DinoNpsError('actionId inválido.', 400, 'ACTION_ID_INVALID');
  }
  const key = idempotencyKey === null ? null : String(idempotencyKey).trim();
  if (key !== null && !/^[A-Za-z0-9:_-]{16,255}$/.test(key)) {
    throw new DinoNpsError('Chave de idempotência inválida.', 400, 'IDEMPOTENCY_KEY_INVALID');
  }
  return {
    actionId: actionId || randomUUID(),
    idempotencyKey: key || `dino-nps:${payload.agendamentoId}`,
    fingerprint: fingerprintFor(payload, value(context, 'fingerprint'), payload),
  };
}

async function withTransaction(resource, work) {
  const db = resource || pgDb;
  if (typeof db.transaction === 'function') return db.transaction(work);
  if (typeof db.beginTransaction === 'function') {
    const client = await db.beginTransaction();
    const trx = {
      query: (sql, params) => typeof db.queryInTransaction === 'function'
        ? db.queryInTransaction(client, sql, params)
        : client.query(sql, params),
    };
    try {
      const result = await work(trx);
      if (typeof db.commit === 'function') await db.commit(client);
      return result;
    } catch (error) {
      if (typeof db.rollback === 'function') await db.rollback(client);
      throw error;
    }
  }
  if (typeof db.query !== 'function') throw new DinoNpsError('Conexão PostgreSQL não configurada.', 500, 'NPS_DB_UNAVAILABLE');
  return work(db);
}

async function query(trx, sql, params = []) {
  const result = await trx.query(sql, params);
  return result || { rows: [] };
}

function publicResponse(row, { replay = false } = {}) {
  return {
    id: row?.id || null,
    empresaId: row?.empresa_id || row?.empresaId || null,
    lojaId: row?.loja_id || row?.lojaId || null,
    agendamentoId: row?.agendamento_id || row?.agendamentoId || null,
    nota: Number(row?.nota),
    respondidoEm: row?.respondido_em || row?.respondidoEm || null,
    fingerprint: row?.fingerprint || null,
    replay,
    canonical: true,
  };
}

function sameNpsPayload(row, payload) {
  if (!row) return false;
  if (row.fingerprint && String(row.fingerprint).toLowerCase() === payload.fingerprint.toLowerCase()) return true;
  return Number(row.nota) === payload.nota
    && String(row.agendamento_id || row.agendamentoId) === payload.agendamentoId
    && String(row.comentario || '') === String(payload.comentario || '');
}

async function loadAppointment(trx, empresaId, appointmentId) {
  const result = await query(trx, `
    SELECT a.id, a.empresa_id, a.status, a.data_agendamento, a.cliente_nome, a.cliente_telefone,
           to_jsonb(a)->>'loja_id' AS loja_id,
           to_jsonb(a)->>'cliente_id' AS cliente_id,
           to_jsonb(a)->>'codigo_confirmacao' AS codigo_confirmacao,
           to_jsonb(a)->>'concluido_em' AS concluido_em
      FROM agendamentos a
     WHERE a.id = $1 AND a.empresa_id = $2
     FOR UPDATE`, [appointmentId, empresaId]);
  return rows(result)[0] || null;
}

function validateAppointment(appointment, scope, input, submittedAt) {
  if (!appointment) throw new DinoNpsError('Atendimento não encontrado na empresa ativa.', 404, 'APPOINTMENT_NOT_FOUND');
  if (appointment.loja_id && String(appointment.loja_id) !== scope.lojaId) {
    throw new DinoNpsError('Atendimento fora do escopo da loja.', 409, 'STORE_SCOPE_MISMATCH');
  }
  if (!appointment.loja_id) {
    throw new DinoNpsError('Atendimento sem loja canônica foi colocado em quarentena.', 409, 'NPS_STORE_QUARANTINED');
  }
  if (!['concluido', 'concluída', 'concluida', 'completed', 'finalizado', 'atendido'].includes(String(appointment.status || '').toLowerCase())) {
    throw new DinoNpsError('NPS somente após atendimento concluído.', 409, 'APPOINTMENT_NOT_COMPLETED');
  }
  const completedAt = parseDate(appointment.concluido_em || appointment.data_agendamento, 'data do atendimento');
  const age = submittedAt.getTime() - completedAt.getTime();
  if (age < 0 || age > WINDOW_MS) {
    throw new DinoNpsError('A resposta NPS está fora da janela de 30 dias.', 409, 'NPS_WINDOW_EXPIRED');
  }
  const clienteId = value(input, 'clienteId', 'cliente_id');
  if (clienteId && appointment.cliente_id && String(clienteId) !== String(appointment.cliente_id)) {
    throw new DinoNpsError('Cliente não corresponde ao atendimento.', 409, 'NPS_CUSTOMER_MISMATCH');
  }
  const telefone = value(input, 'telefone', 'clienteTelefone', 'cliente_telefone');
  if (telefone && appointment.cliente_telefone && normalizePhone(telefone) !== normalizePhone(appointment.cliente_telefone)) {
    throw new DinoNpsError('Telefone não corresponde ao atendimento.', 409, 'NPS_PHONE_MISMATCH');
  }
  const codigo = value(input, 'codigo', 'codigoConfirmacao', 'codigo_confirmacao');
  if (codigo && appointment.codigo_confirmacao && String(codigo).trim().toUpperCase() !== String(appointment.codigo_confirmacao).trim().toUpperCase()) {
    throw new DinoNpsError('Código não corresponde ao atendimento.', 409, 'NPS_CODE_MISMATCH');
  }
}

export async function recordDinoNpsResponse(context = {}, input = {}, dbOverride = null) {
  const scope = scopeOf(context);
  const appointmentId = requiredUuid(value(input, 'appointmentId', 'appointment_id', 'agendamentoId', 'agendamento_id'), 'appointmentId');
  const nota = score(value(input, 'nota', 'score', 'nps'));
  const submittedAt = parseDate(value(input, 'respondedAt', 'respondidoEm', 'respondido_em') || new Date(), 'respondidoEm');
  const comentario = cleanText(value(input, 'comentario', 'comment'), 2000);
  const payload = { empresaId: scope.empresaId, lojaId: scope.lojaId, agendamentoId: appointmentId, nota, comentario };
  const identity = mutationIdentity(context, payload);
  return withTransaction(dbOverride, async trx => {
    const appointment = await loadAppointment(trx, scope.empresaId, appointmentId);
    validateAppointment(appointment, scope, input, submittedAt);
    const existing = await query(trx, `
      SELECT id, empresa_id, loja_id, agendamento_id, nota, comentario, fingerprint, respondido_em
        FROM dino_nps_responses
       WHERE empresa_id = $1 AND loja_id = $2 AND agendamento_id = $3
       FOR UPDATE`, [scope.empresaId, scope.lojaId, appointmentId]);
    const previous = rows(existing)[0];
    if (previous) {
      if (!sameNpsPayload(previous, { ...payload, fingerprint: identity.fingerprint })) {
        throw new DinoNpsError('A resposta NPS já existe com outro payload.', 409, 'NPS_RESPONSE_CONFLICT');
      }
      return publicResponse(previous, { replay: true });
    }
    try {
      const inserted = await query(trx, `
        INSERT INTO dino_nps_responses
          (empresa_id, loja_id, agendamento_id, nota, comentario, fingerprint, correlation_id, respondido_em)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, empresa_id, loja_id, agendamento_id, nota, fingerprint, respondido_em`,
      [scope.empresaId, scope.lojaId, appointmentId, nota, comentario, identity.fingerprint,
        cleanText(value(context, 'correlationId', 'correlation_id'), 180), submittedAt.toISOString()]);
      return publicResponse(rows(inserted)[0] || {
        empresa_id: scope.empresaId, loja_id: scope.lojaId, agendamento_id: appointmentId,
        nota, fingerprint: identity.fingerprint, respondido_em: submittedAt.toISOString(),
      });
    } catch (error) {
      if (error?.code !== '23505') throw error;
      const concurrent = await query(trx, `
        SELECT id, empresa_id, loja_id, agendamento_id, nota, comentario, fingerprint, respondido_em
          FROM dino_nps_responses
         WHERE empresa_id = $1 AND loja_id = $2 AND agendamento_id = $3`, [scope.empresaId, scope.lojaId, appointmentId]);
      const row = rows(concurrent)[0];
      if (sameNpsPayload(row, { ...payload, fingerprint: identity.fingerprint })) return publicResponse(row, { replay: true });
      throw new DinoNpsError('A resposta NPS já existe com outro payload.', 409, 'NPS_RESPONSE_CONFLICT');
    }
  });
}

export async function getDinoNpsOverview(context = {}, filters = {}, dbOverride = null) {
  const scope = scopeOf(context);
  const from = filters.from || filters.de || null;
  const to = filters.to || filters.ate || null;
  if (from) parseDate(from, 'from');
  if (to) parseDate(to, 'to');
  const result = await withTransaction(dbOverride || pgDb, trx => query(trx, `
    SELECT nota, respondido_em
      FROM dino_nps_responses
     WHERE empresa_id = $1 AND loja_id = $2
       AND ($3::timestamptz IS NULL OR respondido_em >= $3::timestamptz)
       AND ($4::timestamptz IS NULL OR respondido_em <= $4::timestamptz)
     ORDER BY respondido_em DESC`, [scope.empresaId, scope.lojaId, from, to]));
  const source = rows(result);
  const total = source.reduce((sum, row) => sum + (row.nota === undefined ? Number(row.total || 0) : 1), 0);
  const promotores = source.some(row => row.nota === undefined)
    ? Number(source[0]?.promotores ?? source[0]?.promoters ?? 0)
    : source.filter(row => Number(row.nota) >= 9).length;
  const neutros = source.some(row => row.nota === undefined)
    ? Number(source[0]?.neutros ?? source[0]?.passives ?? 0)
    : source.filter(row => Number(row.nota) >= 7 && Number(row.nota) <= 8).length;
  const detratores = source.some(row => row.nota === undefined)
    ? Number(source[0]?.detratores ?? source[0]?.detractors ?? 0)
    : source.filter(row => Number(row.nota) <= 6).length;
  return {
    empresaId: scope.empresaId,
    lojaId: scope.lojaId,
    total,
    promotores,
    neutros,
    detratores,
    nps: total ? Math.round(((promotores - detratores) / total) * 100) : 0,
  };
}

function processingIdentity(context, input) {
  const responseId = requiredUuid(value(input, 'responseId', 'response_id', 'id'), 'responseId');
  const payload = { responseId, effect: 'nps.process' };
  const suppliedKey = value(context, 'idempotencyKey', 'idempotency_key') || `dino-nps-process:${responseId}`;
  const suppliedAction = value(context, 'actionId', 'action_id') || responseId;
  const fingerprint = fingerprintFor(payload, value(context, 'fingerprint'));
  if (!UUID.test(String(suppliedAction))) throw new DinoNpsError('actionId inválido.', 400, 'ACTION_ID_INVALID');
  if (!/^[A-Za-z0-9:_-]{16,255}$/.test(String(suppliedKey))) throw new DinoNpsError('Chave de idempotência inválida.', 400, 'IDEMPOTENCY_KEY_INVALID');
  return { responseId, actionId: suppliedAction, idempotencyKey: String(suppliedKey), fingerprint, payload };
}

async function findProcessing(trx, scope, identity) {
  const result = await query(trx, `
    SELECT id, action_id, fingerprint, status, payload_sanitizado, financial_entry_id, erro
      FROM dino_effect_outbox
     WHERE empresa_id = $1 AND loja_id = $2 AND efeito = $3 AND idempotency_key = $4
     FOR UPDATE`, [scope.empresaId, scope.lojaId, 'nps.process', identity.idempotencyKey]);
  return rows(result)[0] || null;
}

function processingPublic(row, identity, replay = false) {
  return {
    id: row?.id || null,
    responseId: identity.responseId,
    actionId: row?.action_id || identity.actionId,
    idempotencyKey: identity.idempotencyKey,
    fingerprint: row?.fingerprint || identity.fingerprint,
    status: row?.status || 'pending',
    replay,
  };
}

export async function queueDinoNpsProcessing(context = {}, input = {}, dbOverride = null) {
  const scope = scopeOf(context);
  const identity = processingIdentity(context, input);
  return withTransaction(dbOverride, async trx => {
    const previous = await findProcessing(trx, scope, identity);
    if (previous) {
      if (String(previous.fingerprint).toLowerCase() !== identity.fingerprint.toLowerCase()
        || String(previous.action_id) !== identity.actionId) {
        throw new DinoNpsError('A fila NPS já existe com payload divergente.', 409, 'NPS_PROCESSING_CONFLICT');
      }
      return processingPublic(previous, identity, true);
    }
    const inserted = await query(trx, `
      INSERT INTO dino_effect_outbox
        (empresa_id, loja_id, efeito, idempotency_key, fingerprint, payload_sanitizado, status, action_id, correlation_id)
      VALUES ($1, $2, 'nps.process', $3, $4, $5::jsonb, 'pending', $6, $7)
      ON CONFLICT (empresa_id, loja_id, idempotency_key) DO NOTHING
      RETURNING id, action_id, fingerprint, status`,
    [scope.empresaId, scope.lojaId, identity.idempotencyKey, identity.fingerprint,
      JSON.stringify(identity.payload), identity.actionId, cleanText(value(context, 'correlationId', 'correlation_id'), 180)]);
    if (rows(inserted)[0]) return processingPublic(rows(inserted)[0], identity, false);
    const race = await findProcessing(trx, scope, identity);
    if (!race) throw new DinoNpsError('Não foi possível enfileirar o NPS.', 409, 'NPS_PROCESSING_RACE');
    if (String(race.fingerprint).toLowerCase() !== identity.fingerprint.toLowerCase()) {
      throw new DinoNpsError('A fila NPS já existe com payload divergente.', 409, 'NPS_PROCESSING_CONFLICT');
    }
    return processingPublic(race, identity, true);
  });
}

export async function markDinoNpsProcessing(context = {}, input = {}, dbOverride = null) {
  const scope = scopeOf(context);
  const identity = processingIdentity(context, input);
  const status = String(value(input, 'status') || 'succeeded');
  if (!['pending', 'processing', 'succeeded', 'failed', 'cancelled'].includes(status)) {
    throw new DinoNpsError('Status de processamento inválido.', 400, 'NPS_PROCESSING_STATUS_INVALID');
  }
  const errorText = cleanText(value(input, 'erro', 'error'), 1000);
  return withTransaction(dbOverride, async trx => {
    const current = await findProcessing(trx, scope, identity);
    if (!current) throw new DinoNpsError('Fila NPS não encontrada.', 404, 'NPS_PROCESSING_NOT_FOUND');
    if (String(current.fingerprint).toLowerCase() !== identity.fingerprint.toLowerCase()) {
      throw new DinoNpsError('A fila NPS já existe com payload divergente.', 409, 'NPS_PROCESSING_CONFLICT');
    }
    const updated = await query(trx, `
      UPDATE dino_effect_outbox
         SET status = $1, erro = $2, atualizado_em = CURRENT_TIMESTAMP,
             lease_token = NULL, lease_until = NULL
       WHERE empresa_id = $3 AND loja_id = $4 AND efeito = 'nps.process' AND idempotency_key = $5
       RETURNING id, action_id, fingerprint, status`,
    [status, errorText, scope.empresaId, scope.lojaId, identity.idempotencyKey]);
    return processingPublic(rows(updated)[0] || { ...current, status }, identity, false);
  });
}

export const queueDinoNpsResponseProcessing = queueDinoNpsProcessing;
export const markDinoNpsResponseProcessing = markDinoNpsProcessing;

export default {
  recordDinoNpsResponse,
  getDinoNpsOverview,
  queueDinoNpsProcessing,
  markDinoNpsProcessing,
};
