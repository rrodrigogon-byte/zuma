const MAX_COUNT = Number.MAX_SAFE_INTEGER
const EVENT_STALE_AFTER_MS = 24 * 60 * 60 * 1000
const EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000
const HEARTBEAT_RECENT_AFTER_MS = 3 * 60 * 1000

const SESSION_KEYS = new Set(['ativo', 'humano', 'encerrado', 'pausado', 'pendente', 'aguardando'])
// The integration worker uses pendente/processando/concluida/falha/cancelada;
// erro is accepted for older providers that expose that equivalent label.
const TASK_KEYS = new Set([
  'pendente', 'pending', 'queued', 'enfileirada', 'processando', 'processing', 'retrying', 'aguardando',
  'falha', 'failed', 'erro', 'error', 'blocked', 'bloqueada', 'concluida', 'completed', 'processado',
  'cancelada', 'cancelled', 'deadLetter',
])
const DELIVERY_KEYS = new Set(['prepared', 'sending', 'started', 'sent', 'delivered', 'read', 'failed', 'skipped', 'legacy', 'unknown', 'pending', 'queued'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeCount(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_COUNT) return null
  return value
}

function normalizeCountMap(value, allowedKeys) {
  if (!isRecord(value)) return { known: false, counts: {}, unclassified: 0 }
  const counts = Object.fromEntries([...allowedKeys].map((key) => [key, 0]))
  let unclassified = 0
  for (const [key, rawCount] of Object.entries(value)) {
    const count = safeCount(rawCount)
    if (count == null) return { known: false, counts: {}, unclassified: 0 }
    if (allowedKeys.has(key)) counts[key] = count
    else {
      // Keep an observable, neutral bucket instead of silently turning a new
      // backend status into zero or exposing its raw code in the UI.
      unclassified += count
    }
  }
  return { known: true, counts, unclassified }
}

function normalizeTimestamp(value, now, kind = 'event') {
  if (value == null || value === '') return { state: 'missing', value: null }
  if (typeof value !== 'string' && typeof value !== 'number') return { state: 'invalid', value: null }
  const date = new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time)) return { state: 'invalid', value: null }
  if (kind === 'lease') return { state: time <= now ? 'expired' : 'valid', value: date.toISOString() }
  if (kind === 'heartbeat') {
    if (time > now) return { state: 'future', value: date.toISOString() }
    if (time < now - HEARTBEAT_RECENT_AFTER_MS) return { state: 'stale', value: date.toISOString() }
    return { state: 'current', value: date.toISOString() }
  }
  if (time > now + EVENT_FUTURE_SKEW_MS) return { state: 'future', value: date.toISOString() }
  if (time < now - EVENT_STALE_AFTER_MS) return { state: 'stale', value: date.toISOString() }
  return { state: 'current', value: date.toISOString() }
}

function normalizeProvider(value) {
  if (!isRecord(value)) return { known: false, total: null, success: null, failed: null, avgLatencyMs: null, toolCalls: null }
  const fields = ['total', 'success', 'failed', 'avgLatencyMs', 'toolCalls']
  const output = {}
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) return { known: false, total: null, success: null, failed: null, avgLatencyMs: null, toolCalls: null }
    output[field] = safeCount(value[field])
    if (output[field] == null) return { known: false, total: null, success: null, failed: null, avgLatencyMs: null, toolCalls: null }
  }
  return { known: true, ...output, latencyLabel: output.total === 0 ? 'sem execuções' : null }
}

function normalizeChannel(value, now) {
  const empty = { lastEventAt: normalizeTimestamp(null, now), lastSyncAt: normalizeTimestamp(null, now), aiCircuitOpen: null, aiConsecutiveFailures: null }
  if (value === null) return { known: true, configured: false, status: null, ...empty }
  if (!isRecord(value)) return { known: false, configured: false, status: null, ...empty }
  if (['status', 'lastEventAt', 'lastSyncAt'].some((field) => !Object.prototype.hasOwnProperty.call(value, field))) return { known: false, configured: false, status: null, ...empty }
  const aiCircuitOpen = Object.prototype.hasOwnProperty.call(value, 'aiCircuitOpen') ? value.aiCircuitOpen : null
  const aiConsecutiveFailures = Object.prototype.hasOwnProperty.call(value, 'aiConsecutiveFailures') ? safeCount(value.aiConsecutiveFailures) : null
  if ((aiCircuitOpen !== null && typeof aiCircuitOpen !== 'boolean') || (Object.prototype.hasOwnProperty.call(value, 'aiConsecutiveFailures') && aiConsecutiveFailures == null)) return { known: false, configured: false, status: null, ...empty }
  const status = ['ativo', 'rascunho', 'pausado'].includes(value.status) ? value.status : null
  return {
    known: true,
    configured: true,
    status,
    lastEventAt: normalizeTimestamp(value.lastEventAt, now),
    lastSyncAt: normalizeTimestamp(value.lastSyncAt, now),
    aiCircuitOpen,
    aiConsecutiveFailures,
  }
}

function normalizeHumanQueue(value) {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'unassigned')) return { known: false, unassigned: null }
  const unassigned = safeCount(value.unassigned)
  return { known: unassigned !== null, unassigned }
}

function normalizeWorker(value, now) {
  const empty = { active: null, leaseExpiresAt: normalizeTimestamp(null, now, 'lease'), lastHeartbeatAt: normalizeTimestamp(null, now, 'heartbeat'), verifiable: false }
  if (!isRecord(value) || ['active', 'leaseExpiresAt', 'lastHeartbeatAt'].some((field) => !Object.prototype.hasOwnProperty.call(value, field))) return { known: false, ...empty }
  const active = typeof value.active === 'boolean' ? value.active : null
  const leaseExpiresAt = normalizeTimestamp(value.leaseExpiresAt, now, 'lease')
  const lastHeartbeatAt = normalizeTimestamp(value.lastHeartbeatAt, now, 'heartbeat')
  return {
    known: active !== null,
    active,
    leaseExpiresAt,
    lastHeartbeatAt,
    // A worker is verifiable only with a recent, non-future heartbeat. The
    // lease remains explicitly global and is never attributed to this unit.
    verifiable: active !== null && lastHeartbeatAt.state === 'current' && (active ? leaseExpiresAt.state === 'valid' : ['expired', 'missing'].includes(leaseExpiresAt.state)),
  }
}

export function normalizeWhatsappAiOperationalStatus(payload, { now = Date.now() } = {}) {
  if (!isRecord(payload)) return { kind: 'unverifiable', reason: 'malformed' }
  const required = ['featureEnabled', 'channel', 'sessions', 'humanQueue', 'tasks', 'deliveries', 'provider24h', 'worker']
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(payload, key))) return { kind: 'unverifiable', reason: 'missing' }
  if (typeof payload.featureEnabled !== 'boolean') return { kind: 'unverifiable', reason: 'malformed' }
  const channel = normalizeChannel(payload.channel, now)
  const sessions = normalizeCountMap(payload.sessions, SESSION_KEYS)
  const humanQueue = normalizeHumanQueue(payload.humanQueue)
  const tasks = normalizeCountMap(payload.tasks, TASK_KEYS)
  const deliveries = normalizeCountMap(payload.deliveries, DELIVERY_KEYS)
  const provider24h = normalizeProvider(payload.provider24h)
  const worker = normalizeWorker(payload.worker, now)
  if ([channel, sessions, humanQueue, tasks, deliveries, provider24h, worker].some((item) => item.known === false)) return { kind: 'unverifiable', reason: 'malformed' }
  return {
    kind: 'valid',
    featureEnabled: payload.featureEnabled,
    channel,
    sessions,
    humanQueue,
    tasks,
    deliveries,
    provider24h,
    // This lease is intentionally represented as global/shared, never as Dino activity.
    worker: { scope: 'global', ...worker },
  }
}

export function sumCounts(counts, keys) {
  if (!counts?.known) return null
  return keys.reduce((total, key) => total + (safeCount(counts.counts?.[key]) || 0), 0)
}

export function timestampStateLabel(timestamp, { missing = 'sem registro' } = {}) {
  if (!timestamp || timestamp.state === 'missing') return missing
  if (timestamp.state === 'invalid' || timestamp.state === 'future') return 'não verificável'
  if (timestamp.state === 'stale') return 'leitura antiga'
  if (timestamp.state === 'expired') return 'expirado'
  return 'registrado'
}

export const operationalStatusKeys = Object.freeze({
  sessionHuman: ['humano'],
  taskPending: ['pendente', 'pending', 'queued', 'enfileirada', 'processando', 'processing', 'retrying', 'aguardando'],
  taskFailed: ['falha', 'failed', 'erro', 'error', 'blocked', 'bloqueada'],
})
