import crypto from 'node:crypto';
import { db as defaultDb } from './database.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_RE = /^[0-9a-f]{64}$/i;
const MAX_BATCH = 100;
const DEFAULT_LIMIT = 10;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 6;
const MAX_LEASE_SECONDS = 3600;
const MAX_ERROR_LENGTH = 1000;
const MAX_WORKER_ID_LENGTH = 120;

const SECRET_KEY_RE = /(?:password|passwd|passcode|secret|token|api[_-]?key|apikey|authorization|cookie|credential|private[_-]?key|client[_-]?secret|refresh[_-]?token|access[_-]?token|bearer|jwt|signature|webhook[_-]?secret|encryption[_-]?key)/i;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

/**
 * Erro de domínio exposto pelas operações do outbox. O código é estável para
 * que a camada HTTP/observabilidade não precise interpretar mensagens.
 */
export class DinoOperationalError extends Error {
  constructor(message, { code = 'DINO_OPERATIONAL_ERROR', status = 400, retryable, details } = {}) {
    super(message);
    this.name = 'DinoOperationalError';
    this.code = code;
    this.status = status;
    this.statusCode = status;
    if (retryable !== undefined) this.retryable = retryable;
    if (details !== undefined) this.details = details;
  }
}

// Alias semântico para consumidores que usam o nome outbox.
export const DinoOutboxError = DinoOperationalError;
export const DinoOperationalOutboxError = DinoOperationalError;

function fail(message, code, status = 400, extra = {}) {
  throw new DinoOperationalError(message, { code, status, ...extra });
}

function isDatabase(value) {
  return Boolean(value && typeof value.query === 'function' && typeof value.transaction === 'function');
}

function isQueryDatabase(value) {
  return Boolean(value && typeof value.query === 'function');
}

function resolveDatabase(value, { transaction = true } = {}) {
  const database = value || defaultDb;
  if (!isQueryDatabase(database) || (transaction && !isDatabase(database))) {
    fail('banco de dados inválido', 'DINO_DATABASE_INVALID', 500);
  }
  return database;
}

function readField(value, ...names) {
  for (const name of names) {
    if (value && value[name] !== undefined && value[name] !== null) return value[name];
  }
  return undefined;
}

function requireUuid(value, code, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value.trim())) {
    fail(`${label} inválida`, code);
  }
  return value.trim();
}

function requireText(value, code, label, maxLength) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength || CONTROL_RE.test(value)) {
    CONTROL_RE.lastIndex = 0;
    fail(`${label} inválido`, code);
  }
  CONTROL_RE.lastIndex = 0;
  return value.trim();
}

function optionalText(value, code, label, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, code, label, maxLength);
}

function normalizeContext(context) {
  const empresaId = readField(context, 'empresaId', 'empresa_id');
  const lojaId = readField(context, 'lojaId', 'loja_id');
  return {
    empresaId: requireUuid(empresaId, 'DINO_EMPRESA_ID_INVALID', 'empresaId'),
    lojaId: requireUuid(lojaId, 'DINO_LOJA_ID_INVALID', 'lojaId'),
  };
}

function normalizePayloadValue(value, path, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`payload inválido em ${path}`, 'DINO_PAYLOAD_INVALID');
    return value;
  }
  if (typeof value !== 'object') fail(`payload não é JSON em ${path}`, 'DINO_PAYLOAD_INVALID');
  if (seen.has(value)) fail('payload cíclico não é aceito', 'DINO_PAYLOAD_INVALID');
  seen.add(value);

  let result;
  if (Array.isArray(value)) {
    result = value.map((entry, index) => normalizePayloadValue(entry, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(`payload não é um objeto JSON em ${path}`, 'DINO_PAYLOAD_INVALID');
    }
    result = {};
    for (const key of Object.keys(value).sort()) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        fail('chave de payload não permitida', 'DINO_PAYLOAD_INVALID');
      }
      if (SECRET_KEY_RE.test(key)) {
        fail('payload contém campo sensível não permitido', 'DINO_PAYLOAD_SECRET');
      }
      result[key] = normalizePayloadValue(value[key], `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
  return result;
}

/**
 * Faz uma cópia JSON determinística e fail-closed. Segredos não são
 * mascarados silenciosamente: a chamada é rejeitada antes de chegar ao banco.
 */
export function sanitizePayload(payload = {}) {
  return normalizePayloadValue(payload, '$', new Set());
}

function canonicalJson(payload) {
  if (payload === null || typeof payload !== 'object') return JSON.stringify(payload);
  if (Array.isArray(payload)) return `[${payload.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(payload).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(payload[key])}`).join(',')}}`;
}

/** Retorna o SHA-256 hexadecimal do JSON seguro, independente da ordem das chaves. */
export function fingerprintPayload(payload = {}) {
  const sanitized = sanitizePayload(payload);
  return crypto.createHash('sha256').update(canonicalJson(sanitized)).digest('hex');
}

function normalizeJsonObject(value, label) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { fail(`${label} inválido`, 'DINO_PAYLOAD_INVALID'); }
  }
  const sanitized = sanitizePayload(parsed ?? {});
  if (Array.isArray(sanitized) || sanitized === null || typeof sanitized !== 'object') {
    fail(`${label} deve ser objeto JSON`, 'DINO_PAYLOAD_INVALID');
  }
  return sanitized;
}

function jsonEqual(left, right) {
  return canonicalJson(normalizeJsonObject(left, 'payload')) === canonicalJson(normalizeJsonObject(right, 'payload'));
}

function normalizeEffectInput(input = {}) {
  const effect = readField(input, 'effect', 'efeito');
  const idempotencyKey = readField(input, 'idempotencyKey', 'idempotency_key');
  const fingerprint = readField(input, 'fingerprint');
  if (effect === undefined) fail('effect obrigatório', 'DINO_EFFECT_REQUIRED');
  if (idempotencyKey === undefined) fail('idempotencyKey obrigatório', 'DINO_IDEMPOTENCY_KEY_REQUIRED');
  if (fingerprint === undefined) fail('fingerprint obrigatório', 'DINO_FINGERPRINT_REQUIRED');
  return {
    effect: requireText(effect, 'DINO_EFFECT_INVALID', 'effect', 120),
    idempotencyKey: requireText(idempotencyKey, 'DINO_IDEMPOTENCY_KEY_INVALID', 'idempotencyKey', 255),
    fingerprint: requireText(fingerprint, 'DINO_FINGERPRINT_INVALID', 'fingerprint', 64).toLowerCase(),
    payload: normalizeJsonObject(readField(input, 'payload') ?? {}, 'payload'),
    correlationId: optionalText(readField(input, 'correlationId', 'correlation_id'), 'DINO_CORRELATION_ID_INVALID', 'correlationId', 180),
    actionId: readField(input, 'actionId', 'action_id') == null
      ? null
      : requireUuid(readField(input, 'actionId', 'action_id'), 'DINO_ACTION_ID_INVALID', 'actionId'),
    provider: optionalText(input.provider, 'DINO_PROVIDER_INVALID', 'provider', 80),
    providerAccountId: optionalText(readField(input, 'providerAccountId', 'provider_account_id'), 'DINO_PROVIDER_ACCOUNT_ID_INVALID', 'providerAccountId', 180),
    providerEventId: optionalText(readField(input, 'providerEventId', 'provider_event_id'), 'DINO_PROVIDER_EVENT_ID_INVALID', 'providerEventId', 180),
    providerInvoiceSlug: optionalText(readField(input, 'providerInvoiceSlug', 'provider_invoice_slug'), 'DINO_PROVIDER_INVOICE_INVALID', 'providerInvoiceSlug', 180),
    providerPaymentId: optionalText(readField(input, 'providerPaymentId', 'provider_payment_id'), 'DINO_PROVIDER_PAYMENT_ID_INVALID', 'providerPaymentId', 180),
    providerTransactionId: optionalText(readField(input, 'providerTransactionId', 'provider_transaction_id'), 'DINO_PROVIDER_TRANSACTION_ID_INVALID', 'providerTransactionId', 180),
    providerNsu: optionalText(readField(input, 'providerNsu', 'provider_nsu'), 'DINO_PROVIDER_NSU_INVALID', 'providerNsu', 180),
  };
}

function assertFingerprint(value) {
  if (typeof value !== 'string' || !HEX_64_RE.test(value.trim())) fail('fingerprint inválido', 'DINO_FINGERPRINT_INVALID');
  return value.trim().toLowerCase();
}

function resultRows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function rowCount(result) {
  return Number(result?.rowCount ?? resultRows(result).length ?? 0);
}

function decorateReplay(row, replayed) {
  return row ? { ...row, replayed: Boolean(replayed), idempotent: Boolean(replayed) } : null;
}

/**
 * Insere um efeito uma única vez no escopo empresa+loja+idempotency_key.
 * A consulta com DO NOTHING seguida de SELECT FOR UPDATE também fecha a
 * janela de corrida entre dois produtores concorrentes.
 */
export async function enqueueDinoEffect(context, input, dbOverride) {
  const scope = normalizeContext(context);
  const effect = normalizeEffectInput(input);
  effect.fingerprint = assertFingerprint(effect.fingerprint);
  const database = resolveDatabase(dbOverride);
  const payloadJson = JSON.stringify(effect.payload);
  const insertValues = [
    scope.empresaId,
    scope.lojaId,
    effect.effect,
    effect.idempotencyKey,
    effect.fingerprint,
    payloadJson,
    effect.correlationId,
    effect.actionId,
    effect.provider,
    effect.providerAccountId,
    effect.providerEventId,
    effect.providerInvoiceSlug,
    effect.providerPaymentId,
    effect.providerTransactionId,
    effect.providerNsu,
  ];

  return database.transaction(async trx => {
    const inserted = await trx.query(
      `INSERT INTO dino_effect_outbox
        (empresa_id, loja_id, efeito, idempotency_key, fingerprint, payload_sanitizado,
         status, correlation_id, action_id, provider, provider_account_id, provider_event_id,
         provider_invoice_slug, provider_payment_id, provider_transaction_id, provider_nsu)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7, $8::uuid, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (empresa_id, loja_id, idempotency_key) DO NOTHING
       RETURNING *`,
      insertValues,
    );
    if (rowCount(inserted) > 0) return decorateReplay(resultRows(inserted)[0], false);

    const existingResult = await trx.query(
      `SELECT * FROM dino_effect_outbox
        WHERE empresa_id = $1 AND loja_id = $2 AND idempotency_key = $3
        FOR UPDATE`,
      [scope.empresaId, scope.lojaId, effect.idempotencyKey],
    );
    const existing = resultRows(existingResult)[0];
    if (!existing) fail('efeito idempotente não localizado', 'DINO_OUTBOX_CONFLICT', 409);
    const existingFingerprint = String(existing.fingerprint || '').toLowerCase();
    const existingPayload = existing.payload_sanitizado ?? existing.payloadSanitizado ?? {};
    if (existingFingerprint !== effect.fingerprint || !jsonEqual(existingPayload, effect.payload)) {
      fail('idempotency key já usada com efeito divergente', 'DINO_OUTBOX_CONFLICT', 409, { details: { empresaId: scope.empresaId, lojaId: scope.lojaId } });
    }
    return decorateReplay(existing, true);
  });
}

function normalizePositive(value, fallback, maximum, label, code = 'DINO_PARAMETER_INVALID') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) fail(`${label} inválido`, code);
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}

function normalizeWorkerId(value) {
  return requireText(value, 'DINO_WORKER_ID_INVALID', 'workerId', MAX_WORKER_ID_LENGTH);
}

/** Backoff em segundos: previsível, exponencial e com teto operacional. */
export function retryDelay(attempt) {
  const normalized = Math.max(1, Math.floor(Number(attempt) || 1));
  return Math.min(1800, (10 * (2 ** Math.min(10, normalized - 1))) + Math.min(20, normalized * 2));
}

export async function claimDinoEffects({ workerId, limit = DEFAULT_LIMIT, leaseSeconds = DEFAULT_LEASE_SECONDS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}, dbOverride) {
  const normalizedWorkerId = normalizeWorkerId(workerId);
  const normalizedLimit = normalizePositive(limit, DEFAULT_LIMIT, MAX_BATCH, 'limit');
  const normalizedLease = normalizePositive(leaseSeconds, DEFAULT_LEASE_SECONDS, MAX_LEASE_SECONDS, 'leaseSeconds');
  const normalizedMaxAttempts = normalizePositive(maxAttempts, DEFAULT_MAX_ATTEMPTS, 1000, 'maxAttempts');
  const database = resolveDatabase(dbOverride);
  // workerId não possui coluna própria na migration; ele permanece no contrato
  // do chamador e nos logs do worker, enquanto o lease_token identifica a posse.
  void normalizedWorkerId;
  return database.transaction(async trx => {
    const result = await trx.query(
      `WITH candidates AS (
         SELECT id
           FROM dino_effect_outbox
          WHERE attempts < $1
            AND (
              (status IN ('pending', 'failed')
               AND dead_letter = false AND manual_required = false
               AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP))
              OR
              (status = 'processing' AND lease_until IS NOT NULL AND lease_until <= CURRENT_TIMESTAMP)
            )
          ORDER BY criado_em ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE dino_effect_outbox t
          SET status = 'processing',
              attempts = t.attempts + 1,
              next_retry_at = NULL,
              lease_token = gen_random_uuid(),
              lease_until = CURRENT_TIMESTAMP + ($3::text || ' seconds')::interval,
              atualizado_em = CURRENT_TIMESTAMP
         FROM candidates c
        WHERE t.id = c.id
       RETURNING t.*`,
      [normalizedMaxAttempts, normalizedLimit, normalizedLease],
    );
    return resultRows(result);
  });
}

function parseTask(task) {
  if (!task || typeof task !== 'object') fail('tarefa inválida', 'DINO_TASK_INVALID');
  const id = requireUuid(readField(task, 'id'), 'DINO_EFFECT_ID_INVALID', 'id');
  const empresaId = requireUuid(readField(task, 'empresaId', 'empresa_id'), 'DINO_EMPRESA_ID_INVALID', 'empresaId');
  const lojaId = requireUuid(readField(task, 'lojaId', 'loja_id'), 'DINO_LOJA_ID_INVALID', 'lojaId');
  const token = requireUuid(readField(task, 'leaseToken', 'lease_token'), 'DINO_LEASE_TOKEN_INVALID', 'leaseToken');
  const status = readField(task, 'status');
  if (status !== 'processing') fail('tarefa não está em processing', 'DINO_OUTBOX_STATUS_INVALID', 409);
  return { id, empresaId, lojaId, token, status };
}

function normalizeLeaseOptions(value, dbMaybe) {
  if (isQueryDatabase(value)) return { options: {}, database: value };
  const options = value && typeof value === 'object' ? value : {};
  return { options, database: dbMaybe || options.db || options.dbOverride || defaultDb };
}

export async function heartbeatDinoEffect(task, optionsOrDb, dbOverride) {
  const parsed = parseTask(task);
  const { options, database: rawDatabase } = normalizeLeaseOptions(optionsOrDb, dbOverride);
  const leaseSeconds = normalizePositive(options.leaseSeconds ?? task.leaseSeconds ?? DEFAULT_LEASE_SECONDS, DEFAULT_LEASE_SECONDS, MAX_LEASE_SECONDS, 'leaseSeconds');
  const database = resolveDatabase(rawDatabase, { transaction: false });
  const result = await database.query(
    `UPDATE dino_effect_outbox
        SET lease_until = CURRENT_TIMESTAMP + ($5::text || ' seconds')::interval,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        AND status = 'processing' AND lease_token = $4::uuid
      RETURNING *`,
    [parsed.id, parsed.empresaId, parsed.lojaId, parsed.token, leaseSeconds],
  );
  if (!rowCount(result)) fail('lease do efeito expirou antes do heartbeat', 'DINO_OUTBOX_LEASE_LOST', 409, { retryable: true });
  return resultRows(result)[0];
}

function extractCompletion(resultValue, financialEntryValue) {
  let result = resultValue;
  let financialEntryId = financialEntryValue;
  if (resultValue && typeof resultValue === 'object' && !Array.isArray(resultValue)) {
    if (Object.prototype.hasOwnProperty.call(resultValue, 'result')) result = resultValue.result;
    else if (Object.prototype.hasOwnProperty.call(resultValue, 'resultado')) result = resultValue.resultado;
    if (financialEntryId === undefined) financialEntryId = readField(resultValue, 'financialEntryId', 'financial_entry_id');
  }
  if (result === undefined || result === null) result = {};
  const safeResult = sanitizePayload(result);
  if (financialEntryId !== undefined && financialEntryId !== null) {
    financialEntryId = requireUuid(financialEntryId, 'DINO_FINANCIAL_ENTRY_ID_INVALID', 'financial_entry_id');
  } else {
    financialEntryId = null;
  }
  return { safeResult, financialEntryId };
}

function normalizeCompletionArgs(resultValue, financialEntryOrDb, dbOverride) {
  if (isQueryDatabase(financialEntryOrDb) && dbOverride === undefined) {
    return { resultValue, financialEntryId: undefined, database: financialEntryOrDb };
  }
  if (isQueryDatabase(dbOverride)) return { resultValue, financialEntryId: financialEntryOrDb, database: dbOverride };
  if (financialEntryOrDb && typeof financialEntryOrDb === 'object' && !Array.isArray(financialEntryOrDb)
      && (Object.prototype.hasOwnProperty.call(financialEntryOrDb, 'result')
        || Object.prototype.hasOwnProperty.call(financialEntryOrDb, 'resultado')
        || Object.prototype.hasOwnProperty.call(financialEntryOrDb, 'financialEntryId')
        || Object.prototype.hasOwnProperty.call(financialEntryOrDb, 'financial_entry_id'))) {
    return { resultValue: { ...financialEntryOrDb, result: financialEntryOrDb.result ?? financialEntryOrDb.resultado ?? resultValue }, financialEntryId: undefined, database: dbOverride || defaultDb };
  }
  return { resultValue, financialEntryId: financialEntryOrDb, database: dbOverride || defaultDb };
}

export async function completeDinoEffect(task, resultValue = {}, financialEntryOrDb, dbOverride) {
  const parsed = parseTask(task);
  const args = normalizeCompletionArgs(resultValue, financialEntryOrDb, dbOverride);
  const completion = extractCompletion(args.resultValue, args.financialEntryId);
  const database = resolveDatabase(args.database, { transaction: false });
  const result = await database.query(
    `UPDATE dino_effect_outbox
        SET status = 'succeeded', erro = NULL, next_retry_at = NULL,
            dead_letter = false, manual_required = false,
            financial_entry_id = $5::uuid, lease_token = NULL, lease_until = NULL,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        AND status = 'processing' AND lease_token = $4::uuid
      RETURNING *`,
    [parsed.id, parsed.empresaId, parsed.lojaId, parsed.token, completion.financialEntryId],
  );
  if (!rowCount(result)) fail('lease do efeito expirou antes da conclusão', 'DINO_OUTBOX_LEASE_LOST', 409, { retryable: true });
  return { ...resultRows(result)[0], resultado: completion.safeResult, financial_entry_id: completion.financialEntryId };
}

function safeErrorCode(error) {
  const raw = String(error?.code || error?.name || 'DINO_EFFECT_ERROR').toUpperCase();
  const code = raw.replace(/[^A-Z0-9_:-]/g, '_').slice(0, 80);
  return code || 'DINO_EFFECT_ERROR';
}

function safeErrorMessage(error) {
  let message = String(error?.message || error || 'erro não identificado');
  message = message.replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim();
  // Não carrega acidentalmente valores de credenciais para a evidência de erro.
  message = message.replace(/((?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
  return message.slice(0, MAX_ERROR_LENGTH) || 'erro não identificado';
}

function normalizeFailureArgs(optionsOrDb, dbOverride) {
  if (isQueryDatabase(optionsOrDb)) return { options: {}, database: optionsOrDb };
  const options = optionsOrDb && typeof optionsOrDb === 'object' ? optionsOrDb : {};
  return { options, database: dbOverride || options.db || options.dbOverride || defaultDb };
}

export async function failDinoEffect(task, error, optionsOrDb, dbOverride) {
  const parsed = parseTask(task);
  const { options, database: rawDatabase } = normalizeFailureArgs(optionsOrDb, dbOverride);
  const maxAttempts = normalizePositive(options.maxAttempts ?? task.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1000, 'maxAttempts');
  const retryable = options.retryable !== undefined ? Boolean(options.retryable) : error?.retryable !== false;
  const attempts = Number(readField(task, 'attempts') || 0);
  const exhausted = !retryable || attempts >= maxAttempts;
  const delay = retryDelay(attempts);
  const errorCode = safeErrorCode(error);
  const errorText = `${errorCode}: ${safeErrorMessage(error)}`.slice(0, MAX_ERROR_LENGTH);
  const database = resolveDatabase(rawDatabase, { transaction: false });
  const result = await database.query(
    `UPDATE dino_effect_outbox
        SET status = 'failed', erro = $6,
            dead_letter = $5::boolean, manual_required = $5::boolean,
            next_retry_at = CASE WHEN $5::boolean THEN NULL
                                 ELSE CURRENT_TIMESTAMP + ($7::text || ' seconds')::interval END,
            lease_token = NULL, lease_until = NULL,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        AND status = 'processing' AND lease_token = $4::uuid
      RETURNING *`,
    [parsed.id, parsed.empresaId, parsed.lojaId, parsed.token, exhausted, errorText, delay],
  );
  if (!rowCount(result)) fail('lease do efeito expirou antes da falha', 'DINO_OUTBOX_LEASE_LOST', 409, { retryable: true });
  return {
    ...resultRows(result)[0],
    retryable,
    exhausted,
    deadLettered: exhausted,
    errorCode,
    retryDelay: exhausted ? null : delay,
  };
}

function scopeWhere(scope, startIndex = 2) {
  if (!scope) return { clause: '', values: [] };
  return {
    clause: ` AND empresa_id = $${startIndex} AND loja_id = $${startIndex + 1}`,
    values: [scope.empresaId, scope.lojaId],
  };
}

function normalizeExpiryOptions(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const context = source.context || (source.empresaId || source.empresa_id || source.lojaId || source.loja_id ? source : null);
  const scope = context ? normalizeContext(context) : null;
  const nowValue = source.now instanceof Date ? source.now : new Date(source.now || Date.now());
  if (Number.isNaN(nowValue.getTime())) fail('now inválido', 'DINO_NOW_INVALID');
  const maxAttempts = normalizePositive(source.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1000, 'maxAttempts');
  return { scope, now: nowValue.toISOString(), maxAttempts };
}

/** Marca TTLs vencidos sem remover evidência; a segunda execução não encontra as mesmas linhas. */
export async function expireDinoOperationalRecords(options = {}, dbOverride) {
  const { scope, now, maxAttempts } = normalizeExpiryOptions(options);
  const database = resolveDatabase(dbOverride || (options && options.dbOverride));
  return database.transaction(async trx => {
    const reservationScope = scopeWhere(scope, 2);
    const reservations = await trx.query(
      `UPDATE dino_inventory_reservations
          SET status = 'expired', liberado_em = COALESCE(liberado_em, $1::timestamptz), atualizado_em = $1::timestamptz
        WHERE status = 'held' AND expires_at <= $1::timestamptz${reservationScope.clause}
        RETURNING id`,
      [now, ...reservationScope.values],
    );
    const offerScope = scopeWhere(scope, 2);
    const offers = await trx.query(
      `UPDATE dino_waitlist_offers
          SET status = 'expired', atualizado_em = $1::timestamptz
        WHERE status IN ('offered', 'held') AND expires_at <= $1::timestamptz${offerScope.clause}
        RETURNING id`,
      [now, ...offerScope.values],
    );
    const outboxScope = scopeWhere(scope, 3);
    const outbox = await trx.query(
      `UPDATE dino_effect_outbox
          SET status = 'failed',
              erro = COALESCE(erro, 'DINO_OUTBOX_LEASE_EXPIRED: lease vencido'),
              dead_letter = CASE WHEN attempts >= $2 THEN true ELSE dead_letter END,
              manual_required = CASE WHEN attempts >= $2 THEN true ELSE manual_required END,
              next_retry_at = CASE WHEN attempts >= $2 THEN NULL ELSE $1::timestamptz END,
              lease_token = NULL, lease_until = NULL, atualizado_em = $1::timestamptz
        WHERE status = 'processing' AND lease_until IS NOT NULL AND lease_until <= $1::timestamptz${outboxScope.clause}
        RETURNING id`,
      [now, maxAttempts, ...outboxScope.values],
    );
    const counts = { reservations: rowCount(reservations), offers: rowCount(offers), outbox: rowCount(outbox) };
    return { ...counts, total: counts.reservations + counts.offers + counts.outbox, now };
  });
}

export async function dinoOutboxHealth(context, dbOverride) {
  const scope = normalizeContext(context);
  const database = resolveDatabase(dbOverride, { transaction: false });
  const result = await database.query(
    `SELECT status,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE
              (status IN ('pending', 'failed') AND next_retry_at IS NOT NULL AND next_retry_at <= CURRENT_TIMESTAMP)
              OR (status = 'processing' AND lease_until IS NOT NULL AND lease_until <= CURRENT_TIMESTAMP)
            )::int AS delayed,
            COUNT(*) FILTER (WHERE dead_letter OR manual_required)::int AS dead_letter,
            AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - criado_em)))::float8 AS average_age_seconds,
            MAX(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - criado_em)))::float8 AS max_age_seconds
       FROM dino_effect_outbox
      WHERE empresa_id = $1 AND loja_id = $2
      GROUP BY status`,
    [scope.empresaId, scope.lojaId],
  );
  const byStatus = {};
  let total = 0;
  let delayed = 0;
  let deadLetter = 0;
  let weightedAge = 0;
  let maxAge = 0;
  for (const row of resultRows(result)) {
    const status = String(row.status || 'unknown');
    const count = Number(row.count || 0);
    const delayedCount = Number(row.delayed || 0);
    const deadCount = Number(row.dead_letter || row.deadLetter || 0);
    const averageAgeSeconds = Number(row.average_age_seconds ?? row.averageAgeSeconds ?? 0) || 0;
    const maxAgeSeconds = Number(row.max_age_seconds ?? row.maxAgeSeconds ?? 0) || 0;
    byStatus[status] = { count, delayed: delayedCount, deadLetter: deadCount, averageAgeSeconds, maxAgeSeconds };
    total += count;
    delayed += delayedCount;
    deadLetter += deadCount;
    weightedAge += averageAgeSeconds * count;
    maxAge = Math.max(maxAge, maxAgeSeconds);
  }
  for (const status of ['pending', 'processing', 'succeeded', 'failed', 'cancelled']) {
    if (!byStatus[status]) byStatus[status] = { count: 0, delayed: 0, deadLetter: 0, averageAgeSeconds: 0, maxAgeSeconds: 0 };
  }
  return {
    empresaId: scope.empresaId,
    lojaId: scope.lojaId,
    total,
    counts: Object.fromEntries(Object.entries(byStatus).map(([status, value]) => [status, value.count])),
    byStatus,
    delayed,
    overdue: delayed,
    deadLetter,
    deadLettered: deadLetter,
    latency: { averageAgeSeconds: total ? weightedAge / total : 0, maxAgeSeconds: maxAge },
  };
}

export default {
  DinoOperationalError,
  DinoOutboxError,
  DinoOperationalOutboxError,
  sanitizePayload,
  fingerprintPayload,
  retryDelay,
  enqueueDinoEffect,
  claimDinoEffects,
  heartbeatDinoEffect,
  completeDinoEffect,
  failDinoEffect,
  expireDinoOperationalRecords,
  dinoOutboxHealth,
};
