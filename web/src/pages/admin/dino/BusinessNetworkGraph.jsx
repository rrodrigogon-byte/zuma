import { useEffect, useMemo, useState } from 'react'
import {
  AREA_COLOR,
  AREA_LABEL,
  SOURCE_STATUS_LABEL,
  buildBusinessNetworkLayout,
  isClientNode,
  redactDisplayText,
} from './businessNetworkLayout'
import './BusinessNetworkGraph.css'

const STATUS_COLOR = { ok: '#2e9e7b', limitado: '#c18a21', indisponivel: '#b45145', desconhecido: '#77838d' }
const RELATION_COLOR = { COMPROU: '#5967bb', AGENDOU: '#2e9e7b', ATENDIDO_POR: '#7c8494', INDICOU: '#8a6fc2', PERGUNTOU: '#d96a5b', INTERESSE: '#d96a5b' }
const statusRank = { indisponivel: 3, limitado: 2, desconhecido: 1, ok: 0 }
const statusLabel = (status) => SOURCE_STATUS_LABEL[status] || SOURCE_STATUS_LABEL.desconhecido
const sourceStatus = (source) => {
  const candidate = typeof source === 'object' && source !== null ? source.status : source
  return ['ok', 'limitado', 'indisponivel', 'desconhecido'].includes(String(candidate || '').toLowerCase()) ? String(candidate).toLowerCase() : 'desconhecido'
}
const sourceItems = (sources, fallback = 'desconhecido') => {
  if (Array.isArray(sources)) return sources.map((source) => ({
    label: typeof source === 'string' ? redactDisplayText(source) : redactDisplayText(source?.name || source?.label, 'Fonte'),
    status: typeof source === 'string' || source?.status == null ? fallback : sourceStatus(source),
  })).slice(0, 8)
  if (sources && typeof sources === 'object') return Object.entries(sources).slice(0, 8).map(([label, value]) => ({ label: redactDisplayText(label, 'Fonte'), status: value?.status == null ? fallback : sourceStatus(value) }))
  return []
}
const bestStatus = (values) => values.reduce((best, value) => (statusRank[value] > statusRank[best] ? value : best), 'ok')
const formatWeight = (weight) => (weight == null ? '' : `×${Number(weight).toLocaleString('pt-BR')}`)
const formatWindow = (window) => redactDisplayText(window, 'Janela não informada.')
const relationDisplay = (link) => String(link?.relation || '').toUpperCase() === 'INTERESSE' || String(link?.relation || '').toUpperCase() === 'PERGUNTOU' ? 'Interesse agregado' : link?.label || link?.relation || 'Relação observada'

function SourceChips({ sources, status }) {
  const items = sourceItems(sources, status)
  const all = items.length ? items : [{ label: 'Estado da fonte', status }]
  return <span className="business-network__legend" aria-label="Estado das fontes">{all.map((item, index) => <span className="business-network__status-chip" data-status={item.status} style={{ '--status-color': STATUS_COLOR[item.status] }} key={`${item.label}-${index}`}>{item.label}: {statusLabel(item.status).replace('Fonte ', '')}</span>)}</span>
}

function DetailPanel({ node, link, onOpenCustomer }) {
  if (!node && !link) return <aside className="business-network__details" aria-label="Detalhes da seleção"><h3>Selecione uma relação</h3><p>Escolha um nó ou aresta para ver medida, evidência e janela. Os identificadores de cliente permanecem protegidos nesta visão.</p></aside>
  if (node) {
    const client = isClientNode(node)
    return <aside className="business-network__details" aria-label="Detalhes do nó selecionado" aria-live="polite">
      <h3>{node.label}</h3>
      <p>{client ? 'Cliente anonimizado' : 'Entidade observada'} · {AREA_LABEL[node.area] || 'Área não informada'}{node.contextOnly ? ' · Contexto do filtro' : ''}</p>
      <dl className="business-network__detail-list">
        <div><dt>Tipo</dt><dd>{node.type || '—'}</dd></div>
        <div><dt>Valor</dt><dd>{node.value ?? '—'}</dd></div>
        <div><dt>Detalhe</dt><dd>{node.detail || 'Detalhe não informado.'}</dd></div>
        <div><dt>Janela</dt><dd>{formatWindow(node.window)}</dd></div>
        <div><dt>Fontes</dt><dd><SourceChips sources={node.sources} status={node.status} /></dd></div>
      </dl>
      {client && node.customerRef && <div className="business-network__details-actions"><button type="button" className="c360-btn primary" onClick={() => onOpenCustomer?.(node.customerRef)}>Abrir ligações autorizadas</button></div>}
    </aside>
  }
  return <aside className="business-network__details" aria-label="Detalhes da relação selecionada" aria-live="polite">
    <h3>{relationDisplay(link)}</h3>
    <p>Relação agregada entre entidades observadas</p>
    <dl className="business-network__detail-list">
      <div><dt>Intensidade</dt><dd>{link.structural ? 'Vínculo estrutural para organizar o mapa; não representa uma ocorrência.' : link.weight == null ? 'Contagem desconhecida nesta cobertura.' : `${formatWeight(link.weight)} ocorrência(s) observada(s)`}</dd></div>
      <div><dt>Janela</dt><dd>{formatWindow(link.window)}</dd></div>
      {(link.observedFrom || link.observedTo) && <div><dt>Observada entre</dt><dd>{formatWindow([link.observedFrom, link.observedTo].filter(Boolean).join(' → '))}</dd></div>}
      <div><dt>Fontes</dt><dd><SourceChips sources={link.sources} status={link.status} /></dd></div>
    </dl>
  </aside>
}

function CoverageNotice({ layout, hasData, hasRawData, query, area }) {
  if (!hasData && hasRawData && (query || area !== 'todas')) {
    return <div className="business-network__notice is-empty" role="status">
      <strong>{hasRawData && (query || area !== 'todas') ? 'Nenhuma relação encontrada neste recorte' : 'Sem dados observados nesta rede'}</strong>
      <span>{hasRawData && (query || area !== 'todas') ? 'Ajuste a pesquisa ou a área. A ausência neste recorte não confirma ausência na fonte.' : 'Fontes indisponíveis ou sem cobertura não são convertidas em zero.'}</span>
    </div>
  }
  if (layout.quality.unavailable) return <div className="business-network__notice is-unavailable" role="status"><span><strong>Fonte indisponível.</strong> Esta rede não permite avaliar a ausência de relações nesta leitura.</span></div>
  if (layout.quality.limited) return <div className="business-network__notice" role="status"><span><strong>Fonte limitada.</strong> Esta leitura é parcial e não confirma ausência de registros.</span></div>
  if (layout.quality.unknown) return <div className="business-network__notice" role="status"><span><strong>Cobertura não informada.</strong> O estado desconhecido não é tratado como fonte vazia.</span></div>
  if (!hasData) {
    return <div className="business-network__notice is-empty" role="status">
      <strong>Sem dados observados nesta rede</strong>
      <span>Fontes indisponíveis ou sem cobertura não são convertidas em zero.</span>
    </div>
  }
  return null
}

function polygonPoints(node, radius, sides = 6, offset = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = offset + (index / sides) * Math.PI * 2
    return `${node.x + Math.cos(angle) * radius},${node.y + Math.sin(angle) * radius}`
  }).join(' ')
}

function nodeShape(node, radius) {
  const props = { className: 'business-network__node-shape', 'data-status': node.status }
  if (node.anchor) return <circle {...props} cx={node.x} cy={node.y} r={radius} />
  if (node.type === 'hub') return <polygon {...props} points={polygonPoints(node, radius, 6)} />
  if (node.type === 'metric' || node.type === 'order_status') {
    return <rect {...props} x={node.x - radius - 4} y={node.y - radius * 0.78} width={(radius + 4) * 2} height={radius * 1.56} rx="6" />
  }
  if (node.type === 'offer') return <polygon {...props} points={polygonPoints(node, radius, 4, -Math.PI / 4)} />
  return <circle {...props} cx={node.x} cy={node.y} r={radius} />
}

function NetworkSvg({ layout, selection, collapsedAreas, zoom, onNode, onLink }) {
  const collapsed = collapsedAreas || new Set()
  const nodes = layout.nodes.filter((node) => !collapsed.has(node.area) || node.anchor)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const visibleLinks = layout.links.filter((link) => nodeIds.has(link.from) && nodeIds.has(link.to))
  const selectedNodeId = selection?.nodeId || ''
  const selectedLinkId = selection?.linkId || ''
  const neighborIds = new Set()
  if (selectedNodeId) {
    neighborIds.add(selectedNodeId)
    layout.links.forEach((link) => {
      if (link.from === selectedNodeId) neighborIds.add(link.to)
      if (link.to === selectedNodeId) neighborIds.add(link.from)
    })
  }
  const transform = `translate(${layout.width / 2 * (1 - zoom)} ${layout.height / 2 * (1 - zoom)}) scale(${zoom})`
  const selectWithKeyboard = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback()
    }
  }
  return <svg className="business-network__canvas" viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-labelledby="business-network-map-title business-network-map-description">
    <title id="business-network-map-title">Mapa de relações observadas</title>
    <desc id="business-network-map-description">Clusters por área. Nós e relações podem ser selecionados para consultar detalhe e vizinhança.</desc>
    <rect className="business-network__canvas-bg" x="0" y="0" width={layout.width} height={layout.height} />
    <g transform={transform}>
      <g className="business-network__clusters" aria-hidden="true">
        {layout.groups.filter((group) => !collapsed.has(group.area)).map((group) => <g key={group.area} style={{ '--cluster-color': group.color }}>
          <circle cx={group.x} cy={group.y} r={Math.min(160, 88 + group.count * 10)} />
          <text className="business-network__cluster-label" x={group.x} y={group.y - 72}>{group.label}</text>
          <text className="business-network__cluster-count" x={group.x} y={group.y - 57}>{group.count} nó(s)</text>
        </g>)}
      </g>
      <g className="business-network__edges">
        {visibleLinks.map((link) => {
          const from = layout.nodes.find((node) => node.id === link.from)
          const to = layout.nodes.find((node) => node.id === link.to)
          if (!from || !to) return null
          const isSelected = selectedLinkId === link.id
          const dim = Boolean(selection) && !isSelected && !(selectedNodeId && (link.from === selectedNodeId || link.to === selectedNodeId))
          const color = RELATION_COLOR[String(link.relation || '').toUpperCase()] || '#8c98a2'
          return <g key={link.id}>
            <line className={`business-network__edge${dim ? ' is-dim' : ''}${isSelected ? ' is-selected' : ''}`} data-status={link.status} data-structural={link.structural ? 'true' : undefined} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={link.weight == null ? 1.3 : Math.min(10, 1.3 + Math.sqrt(link.weight) * 1.7)} role="button" tabIndex="0" aria-pressed={isSelected} aria-label={`Selecionar relação ${relationDisplay(link)}${link.structural ? ', vínculo de agrupamento, não ocorrência' : link.weight == null ? ', intensidade desconhecida' : `, ${formatWeight(link.weight)}`}`} onClick={() => onLink(link)} onKeyDown={(event) => selectWithKeyboard(event, () => onLink(link))} />
            <text className="business-network__edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}>{relationDisplay(link)}{formatWeight(link.weight) ? ` ${formatWeight(link.weight)}` : ''}</text>
          </g>
        })}
      </g>
      <g className="business-network__nodes">
        {nodes.map((node) => {
          const selected = selectedNodeId === node.id
          const neighbor = neighborIds.has(node.id)
          const dim = Boolean(selection) && !selected && !neighbor
          const radius = node.anchor ? 30 : node.type === 'hub' ? 24 : node.type === 'metric' || node.type === 'order_status' ? 18 : 22
          return <g key={node.id} className={`business-network__node${node.anchor ? ' is-anchor' : ''}${node.contextOnly ? ' is-context' : ''}${selected ? ' is-selected' : ''}${neighbor && !selected ? ' is-neighbor' : ''}${dim ? ' is-dim' : ''}`} data-severity={node.severity} style={{ '--node-color': AREA_COLOR[node.area] || AREA_COLOR.geral }} role="button" tabIndex="0" aria-pressed={selected} aria-label={`Selecionar ${node.label}${node.contextOnly ? ', contexto relacionado' : ''}${node.value === '—' ? ', valor desconhecido' : `, ${node.value}`}`} onClick={() => onNode(node)} onKeyDown={(event) => selectWithKeyboard(event, () => onNode(node))}>
            {nodeShape(node, radius)}
            <text className="business-network__node-label" x={node.x} y={node.y + radius + 17}>{node.label}</text>
            <text className="business-network__node-value" x={node.x} y={node.y + radius + 31}>{node.value}</text>
          </g>
        })}
      </g>
    </g>
  </svg>
}

function NetworkTable({ layout, selection, onNode, onLink }) {
  if (!layout.nodes.length) return <p className="business-network__empty-list">Não há nós para listar neste recorte.</p>
  return <div className="business-network__table-wrap">
    <table className="c360-table business-network__table">
      <caption className="sr-only">Nós e relações observados na rede</caption>
      <thead><tr><th scope="col">Nó</th><th scope="col">Área</th><th scope="col">Valor</th><th scope="col">Fonte</th><th scope="col">Relações</th></tr></thead>
      <tbody>
        {layout.nodes.map((node) => <tr key={node.id}>
          <td><button type="button" onClick={() => onNode(node)} aria-pressed={selection?.nodeId === node.id}>{node.label}</button><small>{node.type} · {node.detail}</small></td>
          <td>{AREA_LABEL[node.area] || 'Área não informada'}</td>
          <td className="num">{node.value}</td>
          <td><SourceChips sources={node.sources} status={node.status} /></td>
          <td className="num">{layout.links.filter((link) => link.from === node.id || link.to === node.id).length}</td>
        </tr>)}
        {layout.links.map((link) => {
          const from = layout.nodes.find((node) => node.id === link.from)
          const to = layout.nodes.find((node) => node.id === link.to)
          if (!from || !to) return null
          return <tr key={`link-${link.id}`}>
            <td><button type="button" onClick={() => onLink(link)} aria-pressed={selection?.linkId === link.id}>{relationDisplay(link)}</button><small>{from.label} → {to.label}</small></td>
            <td>{AREA_LABEL[from.area] || 'Área não informada'} · {AREA_LABEL[to.area] || 'Área não informada'}</td>
            <td className="num">{link.structural ? 'Estrutural' : link.weight == null ? '—' : formatWeight(link.weight)}</td>
            <td><SourceChips sources={link.sources} status={link.status} /></td>
            <td>{formatWindow(link.window)}</td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}

export default function BusinessNetworkGraph({ network, area = 'todas', unitLabel, onOpenCustomer, maxNodes = 48, maxLinks = 90 }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState('mapa')
  const [selection, setSelection] = useState(null)
  const [collapsedAreas, setCollapsedAreas] = useState(() => new Set())
  const [zoom, setZoom] = useState(1)
  const layout = useMemo(() => buildBusinessNetworkLayout(network, { area, query, unitLabel, maxNodes, maxLinks }), [network, area, query, unitLabel, maxNodes, maxLinks])
  useEffect(() => { setSelection(null); setZoom(1) }, [network, area])
  useEffect(() => { setSelection(null) }, [query, collapsedAreas])
  const selectedNode = selection?.nodeId ? layout.nodes.find((node) => node.id === selection.nodeId) : null
  const selectedLink = selection?.linkId ? layout.links.find((link) => link.id === selection.linkId) : null
  const selectedLinkVisible = selectedLink && [selectedLink.from, selectedLink.to].every((id) => {
    const node = layout.nodes.find((item) => item.id === id)
    return node && (!collapsedAreas.has(node.area) || node.anchor)
  })
  const activeSelection = selectedNode && (!collapsedAreas.has(selectedNode.area) || selectedNode.anchor)
    ? selection : selectedLinkVisible ? selection : null
  const hasRawData = layout.summary.rawObservedNodes > 0 || layout.summary.rawObservedLinks > 0
  const toggleArea = (areaName) => setCollapsedAreas((current) => {
    const next = new Set(current)
    if (next.has(areaName)) next.delete(areaName)
    else next.add(areaName)
    return next
  })
  const selectNode = (node) => setSelection({ nodeId: node.id, linkId: null })
  const selectLink = (link) => setSelection({ nodeId: null, linkId: link.id })
  const canvasNodes = layout.nodes.filter((node) => !collapsedAreas.has(node.area) || node.anchor)
  const canvasIds = new Set(canvasNodes.map((node) => node.id))
  const canvasLinks = layout.links.filter((link) => canvasIds.has(link.from) && canvasIds.has(link.to))
  const displayedNodes = view === 'mapa' ? canvasNodes.length : layout.summary.visibleNodes
  const displayedLinks = view === 'mapa' ? canvasLinks.length : layout.summary.visibleLinks
  const summaryParts = [`Mostrando ${displayedNodes} nó(s) e ${displayedLinks} relação(ões)`]
  const omittedRelationBreakdown = [
    layout.summary.omittedObservedLinks > 0 ? `${layout.summary.omittedObservedLinks} evento(s) observado(s)` : null,
    layout.summary.omittedStructuralLinks > 0 ? `${layout.summary.omittedStructuralLinks} conexão(ões) estrutural(is)` : null,
  ].filter(Boolean)
  if (layout.summary.matchedNodes > 0) summaryParts.push(`${layout.summary.matchedNodes} resultado(s) no filtro`)
  if (layout.summary.contextNodes > 0) summaryParts.push(`${layout.summary.contextNodes} nó(s) de contexto relacionado`)
  if (layout.summary.filteredNodes + layout.summary.filteredLinks > 0) summaryParts.push(`${layout.summary.filteredNodes} nó(s) e ${layout.summary.filteredLinks} relação(ões) fora do recorte`)
  if (layout.summary.backendOmittedNodes + layout.summary.backendOmittedLinks > 0) summaryParts.push(`${layout.summary.backendOmittedNodes + layout.summary.backendOmittedLinks} omitido(s) por limite da fonte`)
  if (layout.summary.uiOmittedNodes + layout.summary.uiOmittedLinks > 0) summaryParts.push(`${layout.summary.uiOmittedNodes + layout.summary.uiOmittedLinks} omitido(s) por limite visual`)
  if (omittedRelationBreakdown.length > 0) summaryParts.push(`Relações omitidas: ${omittedRelationBreakdown.join(' · ')}`)
  if (view === 'mapa' && collapsedAreas.size > 0) summaryParts.push(`${collapsedAreas.size} área(s) recolhida(s)`)
  const summaryText = summaryParts.join(' · ')
  const windowLabels = Object.values(layout.windows || {}).filter(Boolean)

  return <div className="business-network">
    <div className="business-network__toolbar">
      <div className="dadm-filters" role="search">
        <label htmlFor="business-network-search">Pesquisar no mapa</label>
        <input id="business-network-search" className="c360-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Área, entidade ou tipo" />
      </div>
      <div className="business-network__view-toggle" role="group" aria-label="Alternativa de visualização">
        <button type="button" aria-pressed={view === 'mapa'} onClick={() => setView('mapa')}>Mapa</button>
        <button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>Lista acessível</button>
      </div>
    </div>
    <CoverageNotice layout={layout} hasData={layout.nodes.length > 0} hasRawData={hasRawData} query={query} area={area} />
    <div className="business-network__legend" aria-label="Áreas da rede">
      {layout.groups.map((group) => <span className="business-network__legend-item" key={group.area}><button type="button" onClick={() => toggleArea(group.area)} aria-expanded={!collapsedAreas.has(group.area)} aria-pressed={!collapsedAreas.has(group.area)}><i className="business-network__swatch" style={{ '--swatch': group.color }} />{group.label} · {group.count}<span className="business-network__status-chip" data-status={bestStatus(layout.nodes.filter((node) => node.area === group.area).map((node) => node.status))} style={{ '--status-color': STATUS_COLOR[bestStatus(layout.nodes.filter((node) => node.area === group.area).map((node) => node.status))] }}>{statusLabel(bestStatus(layout.nodes.filter((node) => node.area === group.area).map((node) => node.status))).replace('Fonte ', '')}</span></button></span>)}
    </div>
    <div className="business-network__type-legend" aria-label="Formas dos nós">
      <span><i data-kind="business" aria-hidden="true" />Unidade</span>
      <span><i data-kind="hub" aria-hidden="true" />Área</span>
      <span><i data-kind="metric" aria-hidden="true" />Indicador</span>
      <span><i data-kind="entity" aria-hidden="true" />Entidade</span>
      <span><i data-kind="context" aria-hidden="true" />Contexto do filtro</span>
    </div>
    <div className="business-network__summary" role="status"><strong>{summaryText}</strong>{windowLabels.length > 0 && <span className="business-network__window">{windowLabels.join(' · ')}</span>}</div>
    {view === 'mapa' ? <div className="business-network__stage">
      <div className="business-network__canvas-wrap">
        <NetworkSvg layout={layout} selection={activeSelection} collapsedAreas={collapsedAreas} zoom={zoom} onNode={selectNode} onLink={selectLink} />
        <div className="business-network__controls" aria-label="Controles do mapa">
          <button type="button" onClick={() => setZoom((value) => Math.min(1.8, Number((value + .15).toFixed(2))))} aria-label="Aumentar zoom">+</button>
          <button type="button" onClick={() => setZoom((value) => Math.max(.7, Number((value - .15).toFixed(2))))} aria-label="Reduzir zoom">−</button>
          <button type="button" onClick={() => setZoom(1)}>Ajustar</button>
          <span className="business-network__zoom">Zoom {Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <DetailPanel node={activeSelection?.nodeId ? selectedNode : null} link={activeSelection?.linkId ? selectedLink : null} onOpenCustomer={onOpenCustomer} />
    </div> : <NetworkTable layout={layout} selection={activeSelection} onNode={selectNode} onLink={selectLink} />}
  </div>
}
