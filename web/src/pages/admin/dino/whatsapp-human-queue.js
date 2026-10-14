const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const HUMAN_QUEUE_PATH = '/api/admin/commerce/whatsapp-ai/sessions'
export const HUMAN_QUEUE_LIMIT = 100
export const UUID_RE = UUID_PATTERN

const ALLOWED_HANDOFF_LABELS = new Set([
  'equipe respondendo pelo celular',
  'cliente pediu uma pessoa',
  'cliente não entendeu',
  'cadastro a confirmar',
  'entrega incerta',
  'mensagem não enviada',
  'IA indisponível',
  'dado sensível enviado',
  'segurança',
  'falha de envio',
  'revisão humana',
])

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function nullableTimestamp(value) {
  if (value !== null && typeof value !== 'string') return false
  if (value === null) return true
  return value.length > 0 && Number.isFinite(Date.parse(value))
}

export function shortQueueRef(id) {
  return isUuid(id) ? id.slice(0, 8) : 'sem referência'
}

/** Nunca devolve o telefone recebido sem mascaramento. */
export function maskQueuePhone(value, id) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (/^\*{3}\d{4}$/.test(text)) return text
  const digits = text.replace(/\D/g, '')
  if (digits.length >= 4) return `***${digits.slice(-4)}`
  return `Mensagem/Conversa ${shortQueueRef(id)}`
}

function safeHandoffLabel(value) {
  if (typeof value !== 'string') return 'revisão humana'
  const label = value.trim()
  if (ALLOWED_HANDOFF_LABELS.has(label)) return label
  if (/^IA indisponível \(GEMINI_[A-Z_]+\)$/.test(label)) return label
  return 'revisão humana'
}

function validItem(item, index, ids) {
  if (!isRecord(item)) throw new Error(`item inválido na posição ${index}`)
  if (!isUuid(item.id)) throw new Error(`id inválido na posição ${index}`)
  if (ids.has(item.id)) throw new Error('itens duplicados na fila')
  ids.add(item.id)
  if (typeof item.telefone !== 'string') throw new Error(`telefone inválido na posição ${index}`)
  if (item.status !== 'humano') throw new Error(`status inválido na posição ${index}`)
  if (typeof item.assigned !== 'boolean' || typeof item.isMine !== 'boolean') throw new Error(`atribuição inválida na posição ${index}`)
  if (!nullableTimestamp(item.assigned_at) || !nullableTimestamp(item.handoff_requested_at) || !nullableTimestamp(item.ultima_interacao_em)) throw new Error(`data inválida na posição ${index}`)
  if (typeof item.handoff_label !== 'string') throw new Error(`motivo inválido na posição ${index}`)
  if (typeof item.priority !== 'number' || !Number.isFinite(item.priority)) throw new Error(`prioridade inválida na posição ${index}`)
  return Object.freeze({
    id: item.id,
    telefone: maskQueuePhone(item.telefone, item.id),
    status: 'humano',
    assigned: item.assigned,
    isMine: item.isMine,
    assigned_at: item.assigned_at,
    handoff_requested_at: item.handoff_requested_at,
    ultima_interacao_em: item.ultima_interacao_em,
    handoff_label: safeHandoffLabel(item.handoff_label),
    priority: item.priority,
  })
}

/**
 * Valida e reduz a resposta para a allowlist renderizável. Nenhum campo bruto
 * de sessão é carregado para a UI.
 */
export function validateHumanQueueResponse(payload, context = {}) {
  const empresaId = String(context.empresaId || '')
  const lojaId = String(context.lojaId || '')
  if (!isRecord(payload) || !Array.isArray(payload.items) || payload.items.length > HUMAN_QUEUE_LIMIT) throw new Error('resposta da fila humana inválida')
  if (typeof payload.canClaim !== 'boolean' || !isRecord(payload.selection)) throw new Error('seleção da fila humana inválida')
  const selection = payload.selection
  if (!isUuid(selection.empresaId) || selection.empresaId !== empresaId) throw new Error('empresa da fila não corresponde ao contexto')
  if (typeof selection.requestedLojaId !== 'string' || selection.requestedLojaId !== lojaId) throw new Error('unidade da fila não corresponde ao contexto')
  if (!isUuid(selection.canonicalLojaId) || selection.inferred !== false) throw new Error('seleção canônica da fila inválida')
  const ids = new Set()
  const items = payload.items.map((item, index) => validItem(item, index, ids))
  return Object.freeze({
    items: Object.freeze(items),
    canClaim: payload.canClaim,
    selection: Object.freeze({
      empresaId: selection.empresaId,
      requestedLojaId: selection.requestedLojaId,
      canonicalLojaId: selection.canonicalLojaId,
      inferred: false,
    }),
  })
}

export function validateClaimResponse(payload, sessionId) {
  if (!isRecord(payload) || payload.id !== sessionId || payload.status !== 'humano') throw new Error('confirmação da atribuição inválida')
  return Object.freeze({ id: sessionId, status: 'humano' })
}

export function queueUrl(assignment) {
  const value = assignment === 'all' ? 'all' : 'unassigned'
  return `${HUMAN_QUEUE_PATH}?status=humano&assignment=${value}&limit=${HUMAN_QUEUE_LIMIT}`
}

export function queueWaitLabel(value, now = Date.now()) {
  if (typeof value !== 'string') return 'não disponível'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp > now) return 'não disponível'
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000))
  if (minutes < 1) return 'há menos de 1 min'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return `há ${days} d`
}

export function queueDateLabel(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'não disponível'
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function queueErrorMessage(error) {
  if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return ''
  if (error?.status === 401) return 'Sua sessão expirou. Atualize a página para entrar novamente.'
  if (error?.status === 403) return 'Você não tem permissão para consultar a fila humana.'
  if (error?.status === 503) return 'A fila humana está indisponível agora. Tente atualizar.'
  if (error?.uncertain === true || error?.status === 408 || error?.status === 504) return 'Não foi possível confirmar com segurança. Atualize a fila antes de tentar novamente.'
  return 'A fila humana não pôde ser validada. Atualize para tentar novamente.'
}

export function isUncertainClaimError(error) {
  return Boolean(error?.uncertain) || error?.status === 408 || error?.status === 504 || (!error?.status && error?.name !== 'AbortError')
}
