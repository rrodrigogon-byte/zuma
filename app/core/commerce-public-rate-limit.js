import crypto from 'node:crypto';

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

export async function consumePublicRateLimit(trx, context, { scope, subject = '', fingerprintValue, limit, windowSeconds }) {
  const empresaId = context?.empresaId;
  const storefrontId = context?.storefrontId;
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
