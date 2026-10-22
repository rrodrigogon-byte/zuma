import crypto from 'node:crypto';

const REQUEST_ID_MAX = 160;
const WEBHOOK_SCOPE_MAX = 60;
const SECRET_KEY = /(?:secret|token|password|authorization|cookie|credential|api.?key|signature|phone|email|name|cpf|document|address|payload)/i;

function rateLimitError(message, code = 'PUBLIC_RATE_LIMIT_UNAVAILABLE') {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 503;
  return error;
}

function fingerprint(value) {
  const configuredSecret = process.env.PUBLIC_RATE_LIMIT_SECRET || process.env.JWT_SECRET;
  if (!configuredSecret) {
    const error = new Error('PUBLIC_RATE_LIMIT_SECRET ou JWT_SECRET é obrigatório.');
    error.code = 'PUBLIC_RATE_LIMIT_SECRET_REQUIRED';
    throw error;
  }
  return crypto.createHmac('sha256', configuredSecret).update(String(value || 'unknown')).digest('hex');
}

export function publicRequestFingerprint(req) {
  const address = req.ip || req.socket?.remoteAddress || 'unknown';
  return fingerprint(address);
}

/**
 * Request correlation is deliberately independent of provider headers: an
 * untrusted value is only used as a bounded correlation key and never as a
 * secret or SQL identifier.
 */
export function webhookRequestId(req = {}) {
  const candidate = req.requestId || req.headers?.['x-request-id'] || req.headers?.['x-correlation-id'];
  return String(candidate || crypto.randomUUID()).replace(/[^A-Za-z0-9._:-]/g, '').slice(0, REQUEST_ID_MAX) || crypto.randomUUID();
}

export function webhookPayloadHash(req = {}, payload = req.body || {}) {
  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : typeof req.rawBody === 'string'
      ? Buffer.from(req.rawBody, 'utf8')
      : Buffer.from(JSON.stringify(payload ?? {}), 'utf8');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function redactedWebhookMetadata(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => redactedWebhookMetadata(item, depth + 1));
  if (typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 300) : value;
  return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key, item]) => [
    key,
    SECRET_KEY.test(key) ? '[REDACTED]' : redactedWebhookMetadata(item, depth + 1),
  ]));
}

function safeErrorCode(value) {
  const code = String(value || '').trim().replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 120);
  return code || null;
}

/**
 * Optional adapter for migration 083. It stores only bounded operational
 * metadata (never the raw request or secrets) and compares hashes before a
 * replay can be accepted. Deployments may inject a forwarding adapter.
 */
export function createWebhookAuditAdapter({ db } = {}) {
  return {
    async record(input = {}) {
      const queryable = input.trx || db;
      if (!queryable || typeof queryable.query !== 'function') throw rateLimitError('adapter de auditoria sem PostgreSQL');
      const provider = String(input.provider || '').trim().slice(0, 80);
      const providerAccountId = String(input.providerAccountId || input.accountId || '').trim().slice(0, 180);
      const providerEventId = String(input.providerEventId || input.eventId || '').trim().slice(0, 180);
      const eventHash = String(input.payloadHash || '').trim().toLowerCase();
      if (!provider || !providerAccountId || !providerEventId || !/^[a-f0-9]{64}$/.test(eventHash)) {
        throw rateLimitError('identidade/hash incompletos para auditoria de webhook', 'WEBHOOK_AUDIT_INPUT_INVALID');
      }
      const existing = await queryable.query(
        `SELECT event_hash, status FROM dino_webhook_events
          WHERE provider = $1 AND provider_account_id = $2 AND provider_event_id = $3
            AND empresa_id IS NOT DISTINCT FROM $4::uuid AND loja_id IS NOT DISTINCT FROM $5::uuid
          ORDER BY recebido_em DESC LIMIT 1`,
        [provider, providerAccountId, providerEventId, input.empresaId || null, input.lojaId || null],
      );
      if (existing.rows[0] && String(existing.rows[0].event_hash).toLowerCase() !== eventHash) {
        const error = rateLimitError('webhook repetido com payload divergente', 'WEBHOOK_PAYLOAD_CONFLICT');
        error.statusCode = 409;
        throw error;
      }
      if (existing.rows[0]) return { duplicate: true, status: existing.rows[0].status };
      const metadata = redactedWebhookMetadata(input.metadata || {});
      await queryable.query(
        `INSERT INTO dino_webhook_events
          (provider, provider_account_id, provider_event_id, event_hash, status,
           request_payload_sanitizado, request_headers_sanitizados, correlation_id,
           empresa_id, loja_id, erro, processado_em)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11,
                 CASE WHEN $5 IN ('processed', 'failed', 'ignored', 'quarantined') THEN CURRENT_TIMESTAMP ELSE NULL END)
         ON CONFLICT (provider, provider_account_id, provider_event_id, event_hash) DO NOTHING`,
        [provider, providerAccountId, providerEventId, eventHash, String(input.status || 'received').slice(0, 24),
          JSON.stringify(metadata), JSON.stringify(redactedWebhookMetadata(input.headers || {})), String(input.requestId || '').slice(0, 180) || null,
          input.empresaId || null, input.lojaId || null, safeErrorCode(input.errorCode)],
      );
      return { duplicate: false };
    },
    async update(input = {}) {
      const queryable = input.trx || db;
      if (!queryable || typeof queryable.query !== 'function') throw rateLimitError('adapter de auditoria sem PostgreSQL');
      const status = String(input.status || '').trim().slice(0, 24);
      const provider = String(input.provider || '').trim().slice(0, 80);
      const providerAccountId = String(input.providerAccountId || input.accountId || '').trim().slice(0, 180);
      const providerEventId = String(input.providerEventId || input.eventId || '').trim().slice(0, 180);
      const eventHash = String(input.payloadHash || '').trim().toLowerCase();
      if (!provider || !providerAccountId || !providerEventId || !/^[a-f0-9]{64}$/.test(eventHash) || !/^(received|processing|processed|failed|ignored|quarantined)$/.test(status)) {
        throw rateLimitError('identidade/status/hash incompletos para atualização de auditoria', 'WEBHOOK_AUDIT_INPUT_INVALID');
      }
      const result = await queryable.query(
        `UPDATE dino_webhook_events
            SET status = $5, erro = $6, request_payload_sanitizado = request_payload_sanitizado || $7::jsonb,
                processado_em = CASE WHEN $5 IN ('processed', 'failed', 'ignored', 'quarantined') THEN CURRENT_TIMESTAMP ELSE processado_em END
          WHERE provider = $1 AND provider_account_id = $2 AND provider_event_id = $3 AND event_hash = $4
            AND empresa_id IS NOT DISTINCT FROM $8::uuid AND loja_id IS NOT DISTINCT FROM $9::uuid`,
        [provider, providerAccountId, providerEventId, eventHash, status, safeErrorCode(input.errorCode), JSON.stringify(redactedWebhookMetadata(input.metadata || {})), input.empresaId || null, input.lojaId || null],
      );
      return { updated: Number(result.rowCount || 0) > 0 };
    },
  };
}

export async function consumePublicRateLimit(trx, context, { scope, subject = '', fingerprintValue, limit, windowSeconds }) {
  const empresaId = context?.empresaId;
  const storefrontId = context?.storefrontId;
  if (!empresaId || !storefrontId) throw rateLimitError('escopo tenant/storefront obrigatório para rate limit');
  const normalizedScope = String(scope || '').trim().slice(0, 60);
  const normalizedSubject = String(subject || '').trim().toUpperCase().slice(0, 100);
  const maxRequests = Math.max(1, Math.min(1000, Number.parseInt(String(limit), 10) || 1));
  const windowSize = Math.max(60, Math.min(86400, Number.parseInt(String(windowSeconds), 10) || 600));
  const bucketKey = fingerprint(`${fingerprintValue || 'unknown'}|${normalizedSubject}`);
  const result = await trx.query(
    `INSERT INTO commerce_public_rate_limits
      (empresa_id, storefront_id, scope, bucket_key, window_started_at, request_count, expires_at, atualizado_em)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP + ($5 * INTERVAL '1 second'), CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id, storefront_id, scope, bucket_key) DO UPDATE
       SET request_count = CASE
             WHEN commerce_public_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ($5 * INTERVAL '1 second') THEN 1
             ELSE commerce_public_rate_limits.request_count + 1
           END,
           window_started_at = CASE
             WHEN commerce_public_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ($5 * INTERVAL '1 second') THEN CURRENT_TIMESTAMP
             ELSE commerce_public_rate_limits.window_started_at
           END,
           expires_at = CASE
             WHEN commerce_public_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ($5 * INTERVAL '1 second') THEN CURRENT_TIMESTAMP + ($5 * INTERVAL '1 second')
             ELSE commerce_public_rate_limits.expires_at
           END,
           atualizado_em = CURRENT_TIMESTAMP
     RETURNING request_count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::integer AS retry_after_seconds`,
    [empresaId, storefrontId, normalizedScope, bucketKey, windowSize],
  );
  await trx.query(`DELETE FROM commerce_public_rate_limits WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'`);
  const bucket = result.rows[0] || { request_count: 1, retry_after_seconds: windowSize };
  return { allowed: Number(bucket.request_count) <= maxRequests, remaining: Math.max(0, maxRequests - Number(bucket.request_count)), retryAfterSeconds: Number(bucket.retry_after_seconds || windowSize) };
}

/**
 * Shared callback limiter. It intentionally delegates to the same atomic
 * INSERT .. ON CONFLICT counter used by public commerce routes; no in-memory
 * Map is involved. Callers must resolve the owner first and provide its
 * storefront/account scope before consulting the provider.
 */
export async function consumeWebhookRateLimit(trx, context, {
  provider,
  accountId,
  fingerprintValue = 'unknown',
  limit = 60,
  windowSeconds = 60,
} = {}) {
  if (!context?.empresaId || !context?.storefrontId || !accountId) {
    throw rateLimitError('escopo empresa/loja/storefront/account obrigatório para webhook');
  }
  const normalizedProvider = String(provider || '').trim().toLowerCase().slice(0, WEBHOOK_SCOPE_MAX);
  if (!normalizedProvider) throw rateLimitError('provedor obrigatório para webhook', 'WEBHOOK_PROVIDER_REQUIRED');
  return consumePublicRateLimit(trx, context, {
    scope: `webhook:${normalizedProvider}`.slice(0, WEBHOOK_SCOPE_MAX),
    subject: String(accountId).slice(0, 100),
    fingerprintValue: `${normalizedProvider}:${accountId}:${fingerprintValue}`,
    limit,
    windowSeconds,
  });
}
