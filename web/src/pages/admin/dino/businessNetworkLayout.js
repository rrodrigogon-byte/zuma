export const NETWORK_WIDTH = 1040
export const NETWORK_HEIGHT = 650
export const NETWORK_AREAS = ['clientes', 'operacao', 'financeiro', 'commerce', 'estoque', 'oportunidades', 'geral']

export const AREA_LABEL = {
  clientes: 'Clientes',
  operacao: 'Operação',
  financeiro: 'Financeiro',
  commerce: 'Commerce',
  estoque: 'Estoque',
  oportunidades: 'Oportunidades',
  geral: 'Geral',
}

export const AREA_COLOR = {
  clientes: '#5967bb',
  operacao: '#2e9e7b',
  financeiro: '#8a6fc2',
  commerce: '#5f78c8',
  estoque: '#d79b2e',
  oportunidades: '#d96a5b',
  geral: '#5f6c78',
}

export const SOURCE_STATUS_LABEL = {
  ok: 'Fonte disponível',
  limitado: 'Fonte limitada',
  indisponivel: 'Fonte indisponível',
  desconhecido: 'Fonte não informada',
}

const VALID_STATUS = new Set(['ok', 'limitado', 'indisponivel', 'desconhecido'])
const VALID_SEVERITY = new Set(['normal', 'low', 'medium', 'high', 'critical', 'info'])
const ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const PHONE_PATTERN = /(?<!\d)(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}(?!\d)/g
const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi
const DOCUMENT_PATTERN = /(^|[^\d])(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/g

const text = (value, fallback = '') => (value === null || value === undefined ? fallback : String(value).trim())
const keyOf = (value) => text(value)
const finite = (value, fallback = null) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}
const count = (...values) => values.map((value) => finite(value)).find((value) => value !== null)

export function redactDisplayText(value, fallback = '—') {
  const raw = text(value, fallback)
  if (!raw) return fallback
  return raw.replace(EMAIL_PATTERN, 'e-mail oculto').replace(DOCUMENT_PATTERN, '$1documento oculto')
    .replace(ID_PATTERN, 'identificador oculto').replace(PHONE_PATTERN, 'contato oculto').slice(0, 240)
}

export function isClientNode(node) {
  const area = text(node?.area).toLowerCase()
  const type = text(node?.type).toLowerCase()
  if (type === 'hub' || text(node?.id).toLowerCase().startsWith('hub:')) return false
  return area === 'clientes' || type === 'cliente' || type === 'clientes' || type === 'customer' || type === 'customers'
}

function isRootNode(node) {
  const type = text(node?.type).toLowerCase()
  const area = text(node?.area).toLowerCase()
  return area === 'geral' || ['business', 'unit', 'empresa', 'loja', 'unidade'].includes(type)
}

function inferArea(node) {
  const explicit = text(node?.area).toLowerCase()
  if (NETWORK_AREAS.includes(explicit)) return explicit
  const type = text(node?.type).toLowerCase()
  if (isClientNode(node)) return 'clientes'
  if (type.includes('oper')) return 'operacao'
  if (type.includes('finan') || type.includes('cash')) return 'financeiro'
  if (type.includes('commerce') || type.includes('order') || type.includes('pedido')) return 'commerce'
  if (type.includes('stock') || type.includes('estoque') || type.includes('inventory')) return 'estoque'
  if (type.includes('offer') || type.includes('opportun') || type.includes('oportun')) return 'oportunidades'
  return 'geral'
}

function sourceStatus(value) {
  const candidate = typeof value === 'object' && value !== null ? value.status : value
  const normalized = text(candidate).toLowerCase()
  return VALID_STATUS.has(normalized) ? normalized : 'desconhecido'
}

function severity(value) {
  const normalized = text(value).toLowerCase()
  return VALID_SEVERITY.has(normalized) ? normalized : 'normal'
}

function relationText(link) {
  const relation = text(link?.relation).toUpperCase()
  if (relation === 'INTERESSE' || relation === 'PERGUNTOU') return 'Interesse agregado'
  return redactDisplayText(link?.label || link?.relation, 'Relação observada')
}

function nodeLabel(raw, clientNumber, unitLabel) {
  if (isRootNode(raw)) return redactDisplayText(unitLabel || 'Unidade ativa', 'Unidade ativa')
  if (isClientNode(raw)) return `Cliente ${String(clientNumber).padStart(2, '0')}`
  return redactDisplayText(raw?.label || raw?.type, 'Entidade observada')
}

function nodeDetail(raw) {
  if (isClientNode(raw)) return 'Relacionamento de cliente anonimizado; detalhe protegido pelo atendimento autorizado.'
  const type = text(raw?.type).toLowerCase()
  if (type.includes('interesse') || type.includes('interest')) return 'Sinal agregado; texto livre não é exibido nesta visão.'
  return redactDisplayText(raw?.detail, 'Detalhe não informado.')
}

function nodeValue(raw) {
  if (raw?.value === null || raw?.value === undefined || raw?.value === '') return '—'
  if (typeof raw.value === 'number' && Number.isFinite(raw.value)) {
    if (raw.valueFormat === 'currency') return raw.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (raw.valueFormat === 'percent') return `${raw.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    return raw.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }
  return redactDisplayText(raw.value, '—')
}

function normalizeSourceList(value, fallbackStatus = 'desconhecido') {
  const names = {
    graph: 'Grafo de relações', grafo: 'Grafo de relações', commands: 'Comandas', retailSales: 'PDV de revenda', orders: 'Pedidos Commerce',
    appointments: 'Agenda', clients: 'Cadastro de clientes', facts: 'Memória autorizada', finance: 'Financeiro / ledger',
    cash: 'Fechamentos de caixa', receivables: 'Recebíveis vencidos', payments: 'Pagamentos Commerce', inventory: 'Estoque Commerce',
    localInventory: 'Revenda local', catalog: 'Catálogo Commerce', context: 'Contexto da unidade', offers: 'Oportunidades',
  }
  const label = (value, fallback = 'Fonte') => {
    const raw = text(value)
    return names[raw] || redactDisplayText(raw, fallback)
  }
  const normalize = (item, fallback = 'Fonte') => typeof item === 'string'
    ? { label: label(item, fallback), status: fallbackStatus }
    : { label: label(item?.name || item?.label || item?.source, fallback), status: item?.status == null ? fallbackStatus : sourceStatus(item) }
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => normalize(item))
  if (value && typeof value === 'object') return Object.entries(value).slice(0, 12).map(([name, source]) => ({ ...normalize(source, name), label: label(name, 'Fonte') }))
  return value ? [{ label: label(value), status: fallbackStatus }] : []
}

function dateLabel(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : ''
}

function windowText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return redactDisplayText(value, 'Janela não informada.')
  const label = redactDisplayText(value.label || value.kind, 'Janela não informada.')
  if (value.kind === 'current_stock_snapshot' && value.capturedAt) {
    const captured = dateLabel(value.capturedAt)
    return redactDisplayText(`${label}${captured ? ` · ${captured}` : ''}`, 'Janela não informada.')
  }
  const from = dateLabel(value.from)
  const to = dateLabel(value.to)
  const range = from || to ? ` · ${from || 'início não informado'}${from && to ? ' – ' : ''}${to || ''}` : ''
  return redactDisplayText(`${label}${range}`, 'Janela não informada.')
}

function normalizedNode(raw, clientNumber, unitLabel) {
  const id = keyOf(raw?.id)
  if (!id) return null
  const status = sourceStatus(raw?.status)
  return {
    id,
    type: redactDisplayText(raw?.type, 'entidade'),
    valueFormat: ['currency', 'percent'].includes(raw?.valueFormat) ? raw.valueFormat : 'number',
    area: inferArea(raw),
    label: nodeLabel(raw, clientNumber, unitLabel),
    value: nodeValue(raw),
    detail: nodeDetail(raw),
    status,
    severity: severity(raw?.severity),
    sources: normalizeSourceList(raw?.sources, status),
    window: windowText(raw?.window),
    customerRef: isClientNode(raw) && text(raw?.customerRef) ? text(raw.customerRef) : null,
    isClient: isClientNode(raw),
    isRoot: isRootNode(raw),
  }
}

function summaryCount(summary, names) {
  const direct = count(...names.map((name) => summary?.[name]))
  if (direct !== undefined && direct !== null) return direct
  const groups = ['totals', 'total', 'totais', 'visible', 'visiveis', 'omitted', 'omitidos']
  return count(...groups.flatMap((group) => names.map((name) => summary?.[group]?.[name])))
}

function qualityFrom(network, nodes, links) {
  const candidates = [network?.status, network?.sourceStatus, network?.summary?.status, ...nodes.filter((node) => !node.isRoot).map((node) => node.status), ...links.map((link) => link.status)]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => sourceStatus(value))
  const allUnavailable = candidates.length > 0 && candidates.every((status) => status === 'indisponivel')
  const hasAvailable = candidates.some((status) => status === 'ok' || status === 'limitado')
  return {
    limited: candidates.includes('limitado') || (candidates.includes('indisponivel') && hasAvailable) || (candidates.includes('desconhecido') && hasAvailable),
    unavailable: allUnavailable,
    unknown: candidates.includes('desconhecido'),
  }
}

function selectNodesWithObservedPairs(scopedNodes, scopedLinks, maxNodeCount) {
  const byId = new Map(scopedNodes.map((node) => [node.id, node]))
  const selectedIds = new Set()
  const coreRank = (node) => node.isRoot ? 0
    : text(node.type).toLowerCase() === 'hub' ? 1
      : ['metric', 'kpi'].includes(text(node.type).toLowerCase()) ? 2 : 3
  const coreNodes = scopedNodes.filter((node) => coreRank(node) < 3)
    .slice().sort((left, right) => coreRank(left) - coreRank(right) || left.id.localeCompare(right.id, 'en'))
  for (const node of coreNodes) {
    if (selectedIds.size >= maxNodeCount) break
    selectedIds.add(node.id)
  }

  const observedCandidates = scopedLinks.filter((link) => !link.structural)
    .slice().sort((left, right) => (Number(right.weight) || 0) - (Number(left.weight) || 0)
      || left.relation.localeCompare(right.relation, 'en') || left.from.localeCompare(right.from, 'en') || left.to.localeCompare(right.to, 'en'))
  for (const link of observedCandidates) {
    const pairIds = [...new Set([link.from, link.to])].filter((id) => byId.has(id))
    const missingIds = pairIds.filter((id) => !selectedIds.has(id))
    if (selectedIds.size + missingIds.length > maxNodeCount) continue
    for (const id of missingIds) selectedIds.add(id)
  }

  for (const node of scopedNodes) {
    if (selectedIds.size >= maxNodeCount) break
    selectedIds.add(node.id)
  }
  return scopedNodes.filter((node) => selectedIds.has(node.id))
}

export function normalizeBusinessNetwork(network, { area = 'todas', query = '', maxNodes = 48, maxLinks = 90, unitLabel } = {}) {
  const rawNetwork = network && typeof network === 'object' ? network : {}
  const rawNodes = Array.isArray(rawNetwork.nodes) ? rawNetwork.nodes : []
  const rawLinks = Array.isArray(rawNetwork.links) ? rawNetwork.links : []
  const backendSummary = rawNetwork.summary && typeof rawNetwork.summary === 'object' ? rawNetwork.summary : {}
  const seen = new Set()
  let clientNumber = 0
  const nodes = rawNodes
    .map((raw) => {
      const normalized = normalizedNode(raw, isClientNode(raw) ? ++clientNumber : 0, unitLabel)
      if (!normalized || seen.has(normalized.id)) return null
      seen.add(normalized.id)
      return normalized
    })
    .filter(Boolean)

  const normalizedQuery = text(query).toLocaleLowerCase('pt-BR')
  const baseNodes = nodes.filter((node) => {
    const inArea = area === 'todas' || !area || node.area === area
    if (!inArea) return false
    if (!normalizedQuery) return true
    return [node.label, node.type, AREA_LABEL[node.area], node.detail].some((value) => text(value).toLocaleLowerCase('pt-BR').includes(normalizedQuery))
  })
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const normalizedLinks = rawLinks.map((raw) => {
    const from = keyOf(raw?.from)
    const to = keyOf(raw?.to)
    if (!from || !to || from === to || !seen.has(from) || !seen.has(to)) return null
    const structural = raw?.structural === true
    const rawWeight = raw?.weight === null || raw?.weight === undefined ? null : finite(raw.weight, null)
    const status = sourceStatus(raw?.status)
    return {
      id: `${from}|${to}|${text(raw?.relation)}|${text(raw?.label)}`,
      from,
      to,
      relation: text(raw?.relation, 'relação observada'),
      label: relationText(raw),
      structural,
      weight: structural || rawWeight === null ? null : Math.max(0, rawWeight),
      status,
      sources: normalizeSourceList(raw?.sources, status),
      window: windowText(raw?.window),
      observedFrom: redactDisplayText(raw?.observedFrom, ''),
      observedTo: redactDisplayText(raw?.observedTo, ''),
    }
  }).filter(Boolean)

  const baseIds = new Set(baseNodes.map((node) => node.id))
  const includedIds = new Set(baseIds)
  const contextIds = new Set()
  const areaActive = Boolean(area && area !== 'todas')
  const contextAreas = new Set(baseNodes.map((node) => node.area))
  if (areaActive) contextAreas.add(area)
  if (areaActive || (normalizedQuery && baseNodes.length > 0)) {
    for (const node of nodes) {
      if (node.isRoot || (node.type === 'hub' && contextAreas.has(node.area))) includedIds.add(node.id)
    }
  }
  for (const link of normalizedLinks) {
    const fromMatches = baseIds.has(link.from)
    const toMatches = baseIds.has(link.to)
    if (!fromMatches && !toMatches) continue
    const fromNode = nodeById.get(link.from)
    const toNode = nodeById.get(link.to)
    if (link.structural && (fromNode?.isRoot || toNode?.isRoot || fromNode?.type === 'hub' || toNode?.type === 'hub')) continue
    const otherId = fromMatches ? link.to : link.from
    const otherNode = nodeById.get(otherId)
    if (otherNode && !baseIds.has(otherId) && !otherNode.isRoot && otherNode.type !== 'hub') {
      contextIds.add(otherId)
      includedIds.add(otherId)
    }
  }
  const scopedNodes = nodes
    .filter((node) => includedIds.has(node.id))
    .map((node) => contextIds.has(node.id) ? { ...node, contextOnly: true } : node)
  const maxNodeCount = Math.max(1, Math.min(200, finite(maxNodes, 48)))
  const scopedLinks = normalizedLinks
    .filter((link) => includedIds.has(link.from) && includedIds.has(link.to))
    .sort((a, b) => Number(Boolean(a.structural)) - Number(Boolean(b.structural)) || `${a.from}|${a.to}|${a.relation}|${a.label}`.localeCompare(`${b.from}|${b.to}|${b.relation}|${b.label}`, 'en'))
  const visibleNodes = selectNodesWithObservedPairs(scopedNodes, scopedLinks, maxNodeCount)
  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  const links = scopedLinks.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to))
  const maxLinkCount = Math.max(1, Math.min(400, finite(maxLinks, 90)))
  const visibleLinks = links.slice(0, maxLinkCount)

  const declaredTotalNodes = summaryCount(backendSummary, ['totalNodes', 'nodesTotal', 'nodes', 'total']) || 0
  const declaredTotalLinks = summaryCount(backendSummary, ['totalLinks', 'linksTotal', 'links', 'relations', 'arestas']) || 0
  const backendOmittedNodes = Math.max(0, summaryCount(backendSummary, ['omittedNodes', 'nodesOmitted', 'omitidos', 'omitted']) || 0)
  const backendOmittedLinks = Math.max(0, summaryCount(backendSummary, ['omittedLinks', 'linksOmitted', 'arestasOmitidas']) || 0)
  const backendOmittedObservedLinks = Math.max(0, summaryCount(backendSummary, ['omittedObservedLinks', 'observedLinksOmitted']) || 0)
  const backendOmittedStructuralLinks = Math.max(0, summaryCount(backendSummary, ['omittedStructuralLinks', 'structuralLinksOmitted']) || 0)
  const totalNodes = Math.max(rawNodes.length + backendOmittedNodes, declaredTotalNodes)
  const totalLinks = Math.max(rawLinks.length + backendOmittedLinks, declaredTotalLinks)
  const uiOmittedNodes = Math.max(0, scopedNodes.length - visibleNodes.length)
  const uiOmittedObservedLinks = Math.max(0, scopedLinks.filter((link) => !link.structural).length - visibleLinks.filter((link) => !link.structural).length)
  const uiOmittedStructuralLinks = Math.max(0, scopedLinks.filter((link) => link.structural).length - visibleLinks.filter((link) => link.structural).length)
  const uiOmittedLinks = uiOmittedObservedLinks + uiOmittedStructuralLinks
  const omittedObservedLinks = backendOmittedObservedLinks + uiOmittedObservedLinks
  const omittedStructuralLinks = backendOmittedStructuralLinks + uiOmittedStructuralLinks
  const omittedNodes = backendOmittedNodes + uiOmittedNodes
  const omittedLinks = backendOmittedLinks + uiOmittedLinks
  const filteredNodes = Math.max(0, totalNodes - backendOmittedNodes - scopedNodes.length)
  const filteredLinks = Math.max(0, totalLinks - backendOmittedLinks - scopedLinks.length)
  const truncated = Boolean(backendSummary.truncated || backendSummary.truncado || backendSummary.truncamento
    || backendOmittedNodes > 0 || backendOmittedLinks > 0 || uiOmittedNodes > 0 || uiOmittedLinks > 0)
  const rawWindows = rawNetwork.windows && typeof rawNetwork.windows === 'object'
    ? rawNetwork.windows : backendSummary.windows && typeof backendSummary.windows === 'object' ? backendSummary.windows : {}
  const windows = Object.fromEntries(Object.entries(rawWindows).map(([name, value]) => [name, windowText(value)]))

  return {
    nodes: visibleNodes,
    links: visibleLinks,
    summary: {
      totalNodes,
      totalLinks,
      visibleNodes: visibleNodes.length,
      visibleLinks: visibleLinks.length,
      omittedNodes,
      omittedLinks,
      backendOmittedNodes,
      backendOmittedLinks,
      uiOmittedNodes,
      uiOmittedLinks,
      backendOmittedObservedLinks,
      backendOmittedStructuralLinks,
      uiOmittedObservedLinks,
      uiOmittedStructuralLinks,
      omittedObservedLinks,
      omittedStructuralLinks,
      filteredNodes,
      filteredLinks,
      matchedNodes: baseNodes.length,
      contextNodes: contextIds.size,
      observedNodes: scopedNodes.filter((node) => !node.isRoot && node.type !== 'hub').length,
      observedLinks: scopedLinks.filter((link) => !link.structural).length,
      rawObservedNodes: nodes.filter((node) => !node.isRoot && node.type !== 'hub').length,
      rawObservedLinks: normalizedLinks.filter((link) => !link.structural).length,
      truncated,
      rawVisibleNodes: summaryCount(backendSummary, ['visibleNodes', 'nodesVisible', 'visiveis']),
    },
    quality: qualityFrom(rawNetwork, scopedNodes, scopedLinks),
    windows,
  }
}

function anchorFor(nodes) {
  return nodes.find((node) => node.isRoot) || nodes[0] || null
}

function finitePosition(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

export function buildBusinessNetworkLayout(network, options = {}) {
  const model = normalizeBusinessNetwork(network, options)
  const nodes = model.nodes.map((node) => ({ ...node }))
  const anchor = anchorFor(nodes)
  const center = { x: NETWORK_WIDTH / 2, y: NETWORK_HEIGHT / 2 }
  const positions = new Map()
  if (anchor) positions.set(anchor.id, center)

  const areaNames = [...new Set(nodes.filter((node) => node.id !== anchor?.id).map((node) => node.area))]
    .sort((a, b) => (NETWORK_AREAS.indexOf(a) - NETWORK_AREAS.indexOf(b)) || a.localeCompare(b, 'en'))
  const groups = areaNames.map((area, groupIndex) => {
    const members = nodes.filter((node) => node.id !== anchor?.id && node.area === area)
    const angle = -Math.PI / 2 + (groupIndex / Math.max(1, areaNames.length)) * Math.PI * 2
    const groupCenter = {
      x: finitePosition(center.x + Math.cos(angle) * 250, center.x),
      y: finitePosition(center.y + Math.sin(angle) * 178, center.y),
    }
    const spread = Math.min(130, 64 + members.length * 8)
    members.forEach((node, index) => {
      const nodeAngle = members.length === 1 ? 0 : -Math.PI / 2 + (index / members.length) * Math.PI * 2
      positions.set(node.id, {
        x: finitePosition(groupCenter.x + Math.cos(nodeAngle) * spread, groupCenter.x),
        y: finitePosition(groupCenter.y + Math.sin(nodeAngle) * spread * 0.68, groupCenter.y),
      })
    })
    return {
      area,
      label: AREA_LABEL[area] || 'Área não informada',
      color: AREA_COLOR[area] || AREA_COLOR.geral,
      count: members.length,
      x: groupCenter.x,
      y: groupCenter.y,
    }
  })

  nodes.forEach((node) => {
    const point = positions.get(node.id) || center
    node.x = finitePosition(point.x, center.x)
    node.y = finitePosition(point.y, center.y)
    node.anchor = node.id === anchor?.id
  })
  const nodeIds = new Set(nodes.map((node) => node.id))
  const links = model.links.filter((link) => nodeIds.has(link.from) && nodeIds.has(link.to)).map((link) => ({ ...link }))

  return { ...model, nodes, links, groups, width: NETWORK_WIDTH, height: NETWORK_HEIGHT }
}

export const layoutBusinessNetwork = buildBusinessNetworkLayout
