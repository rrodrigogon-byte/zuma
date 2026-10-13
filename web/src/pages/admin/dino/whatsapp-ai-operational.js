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

// Deterministic operational guidance, not a diagnosis generated by a model.
// Receives only the allowlisted view above and never copies backend strings.
export function whatsappOperationalSummary(status) {
  const unverifiable = { state: 'unverifiable', conditions: [], conditionCount: null, title: 'Leitura não verificável', nextStep: 'Confirme o contexto e atualize a leitura. Não conclua que há zero pendências.' }
  if (status?.kind !== 'valid' || !status.channel || !status.worker || !status.provider24h || !status.humanQueue
    || !status.tasks?.known || !status.sessions?.known || !status.deliveries?.known) return unverifiable
  const conditions = []
  const add = (code, title, nextStep, severity = 'attention', scope = 'unit') => conditions.push({ code, title, nextStep, severity, scope })
  if (status.channel.aiCircuitOpen === true) add('CIRCUIT_OPEN', 'Circuito da IA aberto', 'Revisar a causa com a equipe responsável e manter atendimento humano. Não ativar nem reenviar automaticamente.', 'critical')
  if (status.humanQueue.unassigned > 0) add('HUMAN_UNASSIGNED', 'Há atendimento humano sem responsável', 'Encaminhar à equipe autorizada da unidade para definir o responsável. Esta leitura não faz atribuição.', 'critical')
  if ((status.tasks.counts.deadLetter || 0) > 0) add('DEAD_LETTER', 'Há registros em dead-letter', 'Revisar o diagnóstico protegido e preservar a evidência. Não reprocessar uma entrega de estado incerto.', 'critical')
  if (sumCounts(status.tasks, operationalStatusKeys.taskFailed) > 0) add('TASK_FAILURES', 'Há tarefas com falha', 'Conferir a causa operacional antes de qualquer nova tentativa.', 'critical')
  if ((status.deliveries.counts.failed || 0) > 0) add('DELIVERY_FAILURES', 'Há falhas de entrega registradas', 'Conferir o estado oficial no provedor antes de decidir um reenvio.', 'critical')
  if ((status.deliveries.counts.unknown || 0) > 0) add('DELIVERY_UNKNOWN', 'Há entrega de estado desconhecido', 'Conferir no provedor; ausência de confirmação não autoriza duplicar o envio.', 'critical')
  if (status.provider24h.failed > 0) add('PROVIDER_FAILURES', 'Há falhas do provedor em 24 horas', 'Revisar a causa com a equipe responsável; o total não representa disponibilidade contínua.', 'critical')
  if (!status.featureEnabled) add('FEATURE_DISABLED', 'IA desativada no servidor', 'Confirmar a decisão operacional antes de solicitar ativação.')
  if (!status.channel.configured) add('CHANNEL_MISSING', 'Canal não configurado nesta unidade', 'Revisar o vínculo autorizado. Não reutilizar a linha de outra empresa.')
  else if (status.channel.status !== 'ativo') add('CHANNEL_NOT_ACTIVE', 'Canal não ativo ou estado não verificável', 'Confirmar com a equipe se o canal deve permanecer pausado ou em preparação.')
  if (status.worker.verifiable !== true || status.worker.active !== true) add('GLOBAL_WORKER', 'Worker compartilhado sem atividade verificável', 'Conferir a operação global. Este indicador não é exclusivo da Dino e não prova a causa nesta unidade.', 'attention', 'global')
  if (sumCounts(status.tasks, operationalStatusKeys.taskPending) > 0) add('TASK_PENDING', 'Há tarefas pendentes ou em processamento', 'Acompanhar a fila desta unidade. Não criar outra tentativa enquanto o resultado estiver incerto.')
  if ((status.tasks.unclassified || 0) > 0 || (status.sessions.unclassified || 0) > 0 || (status.deliveries.unclassified || 0) > 0
    || sumCounts(status.deliveries, ['skipped', 'legacy']) > 0) add('UNCLASSIFIED', 'Há registros que exigem classificação', 'Revisar o contrato ou a origem dos registros sem presumir sucesso ou falha.')
  if (status.channel.configured && status.channel.lastEventAt?.state !== 'current') add('EVENT_NOT_RECENT', 'Evento recente não demonstrado', 'Conferir origem e horário do último evento. A atualização do painel não é atividade de atendimento.')
  if (status.provider24h.total === 0) add('NO_PROVIDER_RUNS', 'Sem execuções do provedor em 24 horas', 'Ausência de registros não equivale a atendimento saudável nem falha comprovada.')
  const first = conditions[0]
  return { state: first ? 'attention' : 'observed', conditions, conditionCount: conditions.length,
    title: first?.title || 'Nenhum alerta classificado nesta leitura',
    nextStep: first?.nextStep || 'Acompanhe os registros e valide uma jornada autorizada. Esta leitura não comprova atendimento ponta a ponta.' }
}
