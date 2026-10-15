export const WHATSAPP_AI_PROVIDER_LATENCY_WINDOW = '24h'
export const WHATSAPP_AI_PROVIDER_LATENCY_SCOPE = 'unit'
// Zero is also the current recorder fallback for absent duration. Exclude it
// from new percentiles without changing the legacy average expression.
export const WHATSAPP_AI_PROVIDER_RUNS_24H_SQL = `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'success')::int AS success,
              COUNT(*) FILTER (WHERE status IN ('failed','blocked'))::int AS failed,
              COALESCE(ROUND(AVG(latency_ms)), 0)::int AS avg_latency_ms,
              COALESCE(SUM(tool_calls), 0)::int AS tool_calls,
              COUNT(*) FILTER (WHERE latency_ms IS NOT NULL AND latency_ms > 0)::int AS latency_sample_size,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)
                FILTER (WHERE latency_ms IS NOT NULL AND latency_ms > 0) AS p50_latency_ms,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
                FILTER (WHERE latency_ms IS NOT NULL AND latency_ms > 0) AS p95_latency_ms
         FROM whatsapp_ai_provider_runs
        WHERE empresa_id = $1 AND loja_id = $2
          AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND criado_em <= CURRENT_TIMESTAMP`

export const WHATSAPP_AI_PROVIDER_RUNS_24H_CHANNEL_SQL = `${WHATSAPP_AI_PROVIDER_RUNS_24H_SQL}
          AND canal_id IN (SELECT id FROM canais_integracao
                             WHERE empresa_id = $1 AND loja_id = $2
                               AND provedor = 'whatsapp' AND tipo_canal = $3)`

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function finiteLatency(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Maps the PostgreSQL aggregate without exposing driver values or converting
 * unavailable percentiles into zero. A missing aggregate row keeps legacy
 * status payloads possible; a malformed aggregate is represented as an
 * unavailable metric, never as a fabricated latency.
 */
export function mapWhatsappAiProviderLatency24h(row, total) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'latency_sample_size')) return null
  const totalCount = safeInteger(total)
  const sampleSize = safeInteger(row.latency_sample_size)
  const base = {
    window: WHATSAPP_AI_PROVIDER_LATENCY_WINDOW,
    scope: WHATSAPP_AI_PROVIDER_LATENCY_SCOPE,
    sampleSize,
    p50Ms: null,
    p95Ms: null,
  }
  if (totalCount == null || sampleSize == null || sampleSize > totalCount) return { ...base, sampleSize: null }
  if (sampleSize === 0) return base
  const p50Ms = finiteLatency(row.p50_latency_ms)
  const p95Ms = finiteLatency(row.p95_latency_ms)
  if (p50Ms == null || p95Ms == null || p95Ms < p50Ms) return base
  return { ...base, p50Ms, p95Ms }
}
