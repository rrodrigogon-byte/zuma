import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { hojeAgenda } from '../../lib/barbearia-calendar'
import './dino-equipe-desempenho.css'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const UNATTRIBUTED_ID = '__sem_profissional__'
const LEAF_PAGE = 100
const DINO_COMMERCE_SCOPE = { empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' }
const DINO_LEGACY_SCOPE = { empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque' }
const amount = value => value == null ? 'Indisponível' : fmtR(value)
const count = value => value == null ? '—' : Number(value).toLocaleString('pt-BR')
const percent = value => value == null ? 'Sem base' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const share = (part, total) => total > 0 ? Math.max(0, Math.min(100, part * 100 / total)) : 0
export function shiftEquipeDate(day, delta) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
// Abre no histórico completo: a gestão quer ver tudo o que já foi carregado (Avec + operação).
const initialPeriod = () => ({ historico: true, inicio: '', fim: hojeAgenda() })
function dateLabel(value) { return String(value || '').split('-').reverse().join('/') }
function monthLabel(value) { const [year, month] = String(value || '').split('-'); return month ? `${MONTHS[Number(month) - 1] || month}/${year}` : String(value || '') }
function samePerformanceScope(requested, returned) {
  if (requested?.empresaId === returned?.empresaId && requested?.lojaId === returned?.lojaId) return true
  return (requested?.empresaId === DINO_COMMERCE_SCOPE.empresaId && requested?.lojaId === DINO_COMMERCE_SCOPE.lojaId
    && returned?.empresaId === DINO_LEGACY_SCOPE.empresaId && returned?.lojaId === DINO_LEGACY_SCOPE.lojaId)
    || (requested?.empresaId === DINO_LEGACY_SCOPE.empresaId && requested?.lojaId === DINO_LEGACY_SCOPE.lojaId
      && returned?.empresaId === DINO_COMMERCE_SCOPE.empresaId && returned?.lojaId === DINO_COMMERCE_SCOPE.lojaId)
}
function samePeriod(requested, returned) {
  if (requested.historico) return returned?.historico === true && returned?.fim === requested.fim
  return returned?.inicio === requested.inicio && returned?.fim === requested.fim
}
function validPayload(payload, scope, period) {
  return samePerformanceScope(scope, payload?.scope) && samePeriod(period, payload?.period) && payload?.readOnly === true && payload?.writePerformed === false && Array.isArray(payload?.employees)
}
function periodQuery(period, extra = {}) {
  const query = period.historico ? { historico: '1', fim: period.fim } : { inicio: period.inicio, fim: period.fim }
  return new URLSearchParams({ ...query, ...extra })
}

// ── Drill-down: profissional (1) → 3 agrupamentos (2-4) → atendimentos (5) ──
const year = row => [row.date.slice(0, 4), row.date.slice(0, 4)]
const month = row => [row.date.slice(0, 7), monthLabel(row.date.slice(0, 7))]
export const DRILL_DIMENSIONS = {
  tempo: { label: 'Ano › Mês › Dia', levels: [year, month, row => [row.date, `${dateLabel(row.date)} · ${DAYS[new Date(`${row.date}T12:00:00Z`).getUTCDay()]}`]], timeSorted: [true, true, true] },
  servico: { label: 'Serviço › Ano › Mês', levels: [row => [`${row.type}:${row.name}`, `${row.type === 'produto' ? 'Produto · ' : ''}${row.name}`], year, month], timeSorted: [false, true, true] },
  cliente: { label: 'Cliente › Ano › Mês', levels: [row => [row.client || '—', row.client || 'Cliente não informado'], year, month], timeSorted: [false, true, true] },
}
function totals(rows) {
  const result = { revenue: 0, serviceRevenue: 0, services: 0, products: 0, records: rows.length }
  for (const row of rows) {
    result.revenue += row.revenue || 0
    if (row.type === 'produto') result.products += row.quantity || 0
    else { result.services += row.quantity || 0; result.serviceRevenue += row.revenue || 0 }
  }
  return result
}
export function buildDrillTree(rows = [], dimension = 'tempo') {
  const config = DRILL_DIMENSIONS[dimension] || DRILL_DIMENSIONS.tempo
  const level = (items, depth) => {
    if (depth >= config.levels.length) return null
    const groups = new Map()
    for (const row of items) {
      const [key, label] = config.levels[depth](row)
      let group = groups.get(key)
      if (!group) { group = { key, label, rows: [] }; groups.set(key, group) }
      group.rows.push(row)
    }
    const nodes = [...groups.values()].map(group => ({ key: group.key, label: group.label, ...totals(group.rows), rows: group.rows, children: level(group.rows, depth + 1) }))
    return nodes.sort(config.timeSorted[depth] ? (a, b) => (a.key < b.key ? 1 : -1) : (a, b) => b.revenue - a.revenue || String(a.label).localeCompare(String(b.label), 'pt-BR'))
  }
  return level(rows, 0) || []
}
const ORIGIN = { historico_avec: 'Histórico Avec', comanda: 'Comanda', agendamento: 'Agenda', venda: 'Revenda' }

function Metric({ label, value, note, tone = '' }) { return <article className={`eq-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
function Notes({ title, items = [], empty, type = '' }) { return <section className={`eq-notes ${type}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item, i) => <li key={`${item.code}-${i}`}><strong>{item.text}</strong>{typeof item.evidence === 'string' && item.evidence && <small>{item.evidence}</small>}</li>)}</ul> : <p>{empty}</p>}</section> }
function ServiceBars({ items = [] }) {
  const max = Math.max(1, ...items.map(item => item.quantity || 0))
  return items.length ? <div className="eq-services">{items.map((item, i) => <div key={`${item.id}-${i}`}><div><strong>{item.name}</strong><span>{count(item.quantity)} serviços · {amount(item.revenue)}</span></div><i aria-hidden="true"><b style={{ width: `${(item.quantity || 0) / max * 100}%` }} /></i></div>)}</div> : <p className="eq-empty">Sem serviços apurados neste período.</p>
}
function DailyChart({ rows = [], monthly = false }) {
  const max = Math.max(1, ...rows.map(item => item.revenue || 0))
  const label = item => monthly ? monthLabel(item.date) : dateLabel(item.date)
  return <div className="eq-scroll"><div className="eq-daily" role="img" aria-label={`Receita apurada por ${monthly ? 'mês' : 'dia'}; detalhes na tabela abaixo`}>{rows.map(item => <div key={item.date} title={`${label(item)}: ${amount(item.revenue)} · ${count(item.services)} serviços`}><i style={{ height: `${Math.max(item.revenue > 0 ? 3 : 0, (item.revenue || 0) / max * 100)}%` }} /><small>{monthly ? item.date?.slice(5, 7) : item.date?.slice(8)}</small></div>)}</div><details><summary>Ver valores em tabela</summary><table className="eq-table"><thead><tr><th>{monthly ? 'Mês' : 'Dia'}</th><th>Receita apurada</th><th>Serviços</th></tr></thead><tbody>{rows.map(item => <tr key={item.date}><td>{label(item)}</td><td>{amount(item.revenue)}</td><td>{count(item.services)}</td></tr>)}</tbody></table></details></div>
}
function HourMap({ cells = [] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const indexed = new Map(cells.map(item => [`${item.day}:${item.hour}`, item]))
  const max = Math.max(1, ...cells.map(item => item.quantity || 0))
  const best = [...cells].filter(item => item.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 3)
  return <><div className="eq-scroll"><table className="eq-hours"><caption>Volume de serviços por dia e hora local — America/Cuiaba</caption><thead><tr><th>Dia</th>{hours.map(hour => <th key={hour}>{hour}h</th>)}</tr></thead><tbody>{DAYS.map((day, index) => <tr key={day}><th scope="row">{day}</th>{hours.map(hour => { const cell = indexed.get(`${index}:${hour}`); return <td key={hour} title={`${day}, ${hour}h: ${count(cell?.quantity || 0)} serviços · ${amount(cell?.revenue || 0)}`}><span aria-label={`${day} ${hour}h: ${count(cell?.quantity || 0)} serviços`} className={cell?.quantity ? 'is-populated' : ''} style={{ '--heat': cell?.quantity ? .15 + cell.quantity / max * .8 : 0 }}>{cell?.quantity || '·'}</span></td> })}</tr>)}</tbody></table></div><p className="eq-muted">{best.length ? `Maiores volumes: ${best.map(item => `${DAYS[item.day]} ${item.hour}h (${count(item.quantity)} serviços)`).join(' · ')}` : 'Sem horários atribuíveis no período (o histórico Avec não traz horário).'} Não representa ponto, jornada ou horas efetivamente trabalhadas.</p></>
}
function StatusBadge({ item }) {
  if (item.synthetic) return <span className="eq-badge is-muted" title="Lançamentos do histórico Avec sem profissional identificado">Sem vínculo</span>
  if (item.activeByMovement) return <span className="eq-badge is-active" title="Inativo no cadastro, mas com valores no período — exibido como ativo">Ativo · com movimento</span>
  return item.active === false ? <span className="eq-badge is-muted">Inativo</span> : <span className="eq-badge is-active">Ativo</span>
}
function ShareBar({ value, total }) {
  const pct = share(value, total)
  return <span className="eq-share" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
}

function DrillNodes({ nodes, depth, path, parentRevenue, expanded, toggle, limits, showMore }) {
  return nodes.map(node => {
    const id = `${path}/${node.key}`
    const open = expanded.has(id)
    const ticket = node.services ? node.serviceRevenue / node.services : null
    const isGroup = Array.isArray(node.children) || node.rows
    return <Fragment key={id}>
      <tr className={`eq-node lvl-${depth}${open ? ' is-open' : ''}`} style={{ '--lvl': depth - 1 }} onClick={() => toggle(id)}>
        <th scope="row"><button type="button" className="eq-toggle" aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Expandir'} ${node.label}`} onClick={event => { event.stopPropagation(); toggle(id) }}><span className="eq-caret" aria-hidden="true">{isGroup ? '▸' : ''}</span><span className="eq-node-label">{node.label}</span></button><small>Nível {depth} · {count(node.records)} registro(s)</small></th>
        <td><div className="eq-money">{amount(node.revenue)}<ShareBar value={node.revenue} total={parentRevenue} /></div></td>
        <td>{percent(share(node.revenue, parentRevenue))}</td>
        <td className="eq-dim">—</td>
        <td>{count(node.services)}</td>
        <td>{count(node.products)}</td>
        <td>{ticket == null ? '—' : amount(ticket)}</td>
        <td className="eq-dim">{depth === 4 || !node.children ? '' : `${count(node.children.length)} subitens`}</td>
      </tr>
      {open && (node.children
        ? <DrillNodes nodes={node.children} depth={depth + 1} path={id} parentRevenue={node.revenue} expanded={expanded} toggle={toggle} limits={limits} showMore={showMore} />
        : <Leaves rows={node.rows} path={id} parentRevenue={node.revenue} limit={limits[id] || LEAF_PAGE} showMore={showMore} />)}
    </Fragment>
  })
}
function Leaves({ rows, path, parentRevenue, limit, showMore }) {
  const visible = rows.slice(0, limit)
  return <>
    {visible.map((row, index) => <tr key={`${path}#${index}`} className="eq-node eq-leaf lvl-5" style={{ '--lvl': 4 }}>
      <th scope="row"><span className="eq-leaf-label">{dateLabel(row.date)}{row.hour != null ? ` · ${String(row.hour).padStart(2, '0')}h` : ''} · <strong>{row.name}</strong></span><small>Nível 5 · {row.client || 'Cliente não informado'} · {ORIGIN[row.origin] || row.origin || 'Registro'}{row.group ? ` · ${row.group}` : ''}</small></th>
      <td><div className="eq-money">{amount(row.revenue)}<ShareBar value={row.revenue} total={parentRevenue} /></div></td>
      <td>{percent(share(row.revenue, parentRevenue))}</td>
      <td className="eq-dim">—</td>
      <td>{row.type === 'produto' ? '—' : count(row.quantity)}</td>
      <td>{row.type === 'produto' ? count(row.quantity) : '—'}</td>
      <td>{row.type === 'produto' || !row.quantity ? '—' : amount(row.revenue / row.quantity)}</td>
      <td className="eq-dim">{row.type === 'produto' ? 'Produto' : 'Serviço'}</td>
    </tr>)}
    {rows.length > limit && <tr className="eq-node eq-leaf lvl-5" style={{ '--lvl': 4 }}><td colSpan={8}><button type="button" className="eq-more" onClick={() => showMore(path)}>Mostrar mais {count(Math.min(LEAF_PAGE, rows.length - limit))} de {count(rows.length - limit)} restantes</button></td></tr>}
  </>
}

export default function DinoEquipeDesempenho({ empresaId = '', lojaId = '', onOpenTab = () => {} }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('revenue')
  const [onlyWithValues, setOnlyWithValues] = useState(true)
  const [dimension, setDimension] = useState('tempo')
  const [employeeId, setEmployeeId] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [limits, setLimits] = useState({})
  const [details, setDetails] = useState({})
  const [refresh, setRefresh] = useState(0)
  const [activation, setActivation] = useState({ step: 'idle', message: '' })
  const request = useRef(0)
  const fresh = useRef(false)
  const detailRequests = useRef(new Set())
  const scopeKey = `${empresaId}:${lojaId}`
  const activeScope = useRef(scopeKey)
  activeScope.current = scopeKey
  const periodKey = period.historico ? `historico:${period.fim}` : `${period.inicio}:${period.fim}`
  const viewKey = `${scopeKey}|${periodKey}`
  const activeView = useRef(viewKey)
  activeView.current = viewKey
  useLayoutEffect(() => { request.current++; setData(null); setError(''); setEmployeeId(''); setSearch(''); setExpanded(new Set()); setLimits({}); setDetails({}); detailRequests.current = new Set() }, [scopeKey, periodKey])
  useEffect(() => {
    if (!empresaId || !lojaId) { setLoading(false); return undefined }
    const current = ++request.current
    let alive = true
    setLoading(true); setError(''); setData(null)
    const query = periodQuery(period, fresh.current ? { fresh: '1' } : {})
    fresh.current = false
    const headers = { 'X-Empresa-Id': empresaId, 'X-Loja-Id': lojaId }
    api.get(`/api/admin/barbearia/equipe/desempenho?${query}`, { headers }).then(payload => {
      if (!alive || request.current !== current || activeScope.current !== scopeKey) return
      if (!validPayload(payload, { empresaId, lojaId }, period)) throw new Error('INVALID_PERFORMANCE_SCOPE')
      setData({ ...payload, viewScope: scopeKey, viewPeriod: periodKey })
    }).catch(() => {
      if (alive && request.current === current && activeScope.current === scopeKey) { setData(null); setError('Não foi possível carregar o desempenho neste contexto. Confira a empresa, a unidade, o período e sua permissão de gestão.') }
    }).finally(() => { if (alive && request.current === current) setLoading(false) })
    return () => { alive = false }
  }, [empresaId, lojaId, scopeKey, period, periodKey, refresh])
  // Detalhe (linhas para o drill + mapa/série/recomendações) é carregado sob demanda e guardado.
  const loadDetail = useCallback(id => {
    if (!id || details[id] || detailRequests.current.has(id) || !empresaId || !lojaId) return
    detailRequests.current.add(id)
    const key = viewKey
    setDetails(value => ({ ...value, [id]: { loading: true } }))
    api.get(`/api/admin/barbearia/equipe/desempenho?${periodQuery(period, { profissionalId: id })}`, { headers: { 'X-Empresa-Id': empresaId, 'X-Loja-Id': lojaId } }).then(payload => {
      if (activeView.current !== key) return
      if (!validPayload(payload, { empresaId, lojaId }, period)) throw new Error('INVALID_PERFORMANCE_SCOPE')
      const employee = payload.employees.find(item => item.id === id)
      if (!employee) throw new Error('PROFESSIONAL_NOT_FOUND')
      setDetails(value => ({ ...value, [id]: { employee, granularity: payload.seriesGranularity } }))
    }).catch(() => {
      if (activeView.current !== key) return
      detailRequests.current.delete(id)
      setDetails(value => ({ ...value, [id]: { error: true } }))
    })
  }, [details, empresaId, lojaId, period, viewKey])
  const visible = data?.viewScope === scopeKey && data?.viewPeriod === periodKey ? data : null
  const summary = visible?.summary || {}
  const totalAttributed = useMemo(() => (visible?.employees || []).reduce((sum, item) => sum + Number(item.revenue || 0), 0), [visible])
  const employees = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR')
    return (visible?.employees || [])
      .filter(item => !onlyWithValues || item.hasActivity)
      .filter(item => String(item.name || '').toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => (sort === 'name' ? String(a.name).localeCompare(String(b.name), 'pt-BR') : Number(b[sort] || 0) - Number(a[sort] || 0) || String(a.name).localeCompare(String(b.name), 'pt-BR')))
  }, [visible, search, sort, onlyWithValues])
  const hiddenWithoutValues = (visible?.employees || []).filter(item => !item.hasActivity).length
  const toActivate = (visible?.employees || []).filter(item => item.activeByMovement && !item.synthetic)
  const trees = useMemo(() => Object.fromEntries(Object.entries(details).filter(([, value]) => value.employee).map(([id, value]) => [id, buildDrillTree(value.employee.rows || [], dimension)])), [details, dimension])
  const toggle = useCallback(id => setExpanded(value => { const next = new Set(value); if (next.has(id)) { for (const item of next) if (item === id || item.startsWith(`${id}/`)) next.delete(item) } else next.add(id); return next }), [])
  const toggleEmployee = id => { loadDetail(id); toggle(id) }
  const showMore = useCallback(path => setLimits(value => ({ ...value, [path]: (value[path] || LEAF_PAGE) + LEAF_PAGE })), [])
  const analyze = id => { loadDetail(id); setEmployeeId(id) }
  const selectedDetail = employeeId ? details[employeeId] : null
  const selected = selectedDetail?.employee || null
  const choosePeriod = days => { const fim = hojeAgenda(); setPeriod({ historico: false, inicio: shiftEquipeDate(fim, -(days - 1)), fim }) }
  const chooseHistory = () => setPeriod({ historico: true, inicio: '', fim: hojeAgenda() })
  const reload = () => { fresh.current = true; setDetails({}); detailRequests.current = new Set(); setRefresh(value => value + 1) }
  const expandAll = () => setExpanded(new Set(employees.map(item => item.id)))
  useEffect(() => { for (const id of expanded) if (!id.includes('/')) loadDetail(id) }, [expanded, loadDetail])
  const activateAll = async () => {
    setActivation({ step: 'running', message: '' })
    let ok = 0
    for (const item of toActivate) { try { await api.patch(`/api/admin/barbearia/profissionais/${encodeURIComponent(item.id)}`, { ativo: true }); ok++ } catch { /* segue para os demais */ } }
    setActivation({ step: 'done', message: `${ok} de ${toActivate.length} profissional(is) ativado(s) no cadastro.` })
    reload()
  }
  const presetActive = days => !period.historico && period.fim === hojeAgenda() && period.inicio === shiftEquipeDate(period.fim, -(days - 1))
  return <div className="eq-panel eq-full">
    <header className="eq-hero"><div><span className="eq-kicker">GESTÃO DA EQUIPE · {period.historico ? 'HISTÓRICO COMPLETO' : 'PERÍODO'} · SOMENTE LEITURA</span><h2>Desempenho da equipe</h2><p>Todo o histórico carregado (Avec + operação + e-commerce). Clique em um profissional para detalhar em até 5 níveis.</p></div><button type="button" className="eq-primary" onClick={reload} disabled={loading || !empresaId || !lojaId}>Atualizar indicadores</button></header>
    <div className="eq-filterbar">
      <div className="eq-presets" role="group" aria-label="Períodos rápidos"><button type="button" aria-pressed={period.historico} className={period.historico ? 'is-on' : ''} onClick={chooseHistory}>Todo o histórico</button>{[[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([days, label]) => <button key={days} type="button" aria-pressed={presetActive(days)} className={presetActive(days) ? 'is-on' : ''} onClick={() => choosePeriod(days)}>{label}</button>)}</div>
      <label>De<input aria-label="Início do período" type="date" value={period.historico ? (visible?.period?.inicio || '') : period.inicio} onChange={event => setPeriod(value => ({ historico: false, inicio: event.target.value, fim: value.fim }))} /></label>
      <label>Até<input aria-label="Fim do período" type="date" value={period.fim} onChange={event => setPeriod(value => ({ ...value, fim: event.target.value, inicio: value.historico ? '' : value.inicio }))} /></label>
      <span className="eq-muted">{period.historico ? 'Desde o primeiro registro · horário de Cuiabá' : 'Até 93 dias · horário de Cuiabá'}</span>
    </div>
    {(!empresaId || !lojaId) && <p className="eq-alert" role="status">Selecione a empresa e uma unidade para consultar. Nenhum relatório sem contexto será carregado.</p>}
    {loading && <div role="status" className="eq-loading"><span className="eq-skeleton" /><span className="eq-skeleton" /><span className="eq-skeleton" /><p className="eq-muted">Conferindo os indicadores da unidade…</p></div>}
    {error && <p role="alert" className="eq-alert">{error}</p>}
    {visible && <>
      <div className="eq-period">{dateLabel(visible.period.inicio)} a {dateLabel(visible.period.fim)}<small>{visible.period.historico ? `Histórico completo · ${count(visible.period.days)} dias · série ${visible.seriesGranularity === 'month' ? 'mensal' : 'diária'}` : `Comparação: ${dateLabel(visible.period.previousInicio)} a ${dateLabel(visible.period.previousFim)} · mesmo número de dias`}</small></div>
      <div className="eq-metrics">
        <Metric tone="is-hero" label="Receita consolidada" value={amount(summary.revenue)} note={visible.quality?.ambiguousCommandsExcluded ? `APURAÇÃO PARCIAL: ${count(visible.quality.ambiguousCommandsExcluded)} comandas ambíguas excluídas; equipe + histórico Avec + e-commerce` : 'Equipe atribuída + histórico Avec pago + e-commerce'} />
        <Metric label="Equipe atribuída" value={amount((summary.operationalAttributedRevenue || 0) + (summary.historicalAttributedServiceRevenue || 0))} note="Serviços e revenda por profissional" />
        <Metric label="Histórico Avec pago" value={amount(summary.historicalFinanceRevenue)} note="Lançamentos importados" />
        <Metric label="E-commerce" value={amount(summary.commerceRevenue)} note={`${count(summary.commerceOrders)} pedido(s), sem profissional imputado`} />
        <Metric label="Comissão indicativa" value={amount(summary.commission)} note={visible.quality?.ambiguousCommandsExcluded ? 'APURAÇÃO PARCIAL: exige revisão dos vínculos' : 'Regras atuais; não é folha ou pagamento'} />
        <Metric label="Serviços apurados" value={count(summary.services)} note={`${count(summary.products)} unidades de produtos`} />
        <Metric label="Profissionais com valores" value={count(summary.withValues ?? employees.length)} note={summary.activeByMovement ? `${count(summary.activeByMovement)} inativo(s) no cadastro exibidos como ativos` : 'Todos ativos no cadastro'} />
        <Metric label="Sem profissional atribuído" value={amount(summary.unattributedHistoricalRevenue || 0)} note="Histórico Avec sem vínculo — linha própria" />
      </div>
      <section className="eq-card eq-grid-card">
        <div className="eq-section-head">
          <div><h3>Todos os profissionais</h3><p>Clique na linha ou no nome para detalhar: {DRILL_DIMENSIONS[dimension].label} › atendimentos. Volume não mede sozinho a qualidade do atendimento.</p></div>
          <label>Buscar profissional<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do profissional" /></label>
          <label>Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="revenue">Receita atribuída</option><option value="commission">Comissão</option><option value="services">Serviços</option><option value="ticketAverage">Ticket / serviço</option><option value="completed">Agenda concluída</option><option value="name">Nome</option></select></label>
          <label>Detalhar por<select value={dimension} onChange={event => { setDimension(event.target.value); setExpanded(value => new Set([...value].filter(item => !item.includes('/')))) }}>{Object.entries(DRILL_DIMENSIONS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
          <label className="eq-check"><input type="checkbox" checked={onlyWithValues} onChange={event => setOnlyWithValues(event.target.checked)} /><span>Somente com valores{hiddenWithoutValues && onlyWithValues ? ` (${count(hiddenWithoutValues)} ocultos)` : ''}</span></label>
          <div className="eq-head-actions"><button type="button" onClick={expandAll} disabled={!employees.length}>Expandir todos</button><button type="button" onClick={() => setExpanded(new Set())} disabled={!expanded.size}>Recolher</button></div>
        </div>
        {toActivate.length > 0 && <div className="eq-activate" role="status">
          {activation.step === 'confirm' ? <><span>Ativar <strong>{count(toActivate.length)}</strong> profissional(is) no cadastro? Eles passam a aparecer como disponíveis na agenda.</span><button type="button" className="eq-primary" onClick={activateAll}>Confirmar ativação</button><button type="button" onClick={() => setActivation({ step: 'idle', message: '' })}>Cancelar</button></>
            : activation.step === 'running' ? <span>Ativando no cadastro…</span>
              : <><span><strong>{count(toActivate.length)}</strong> profissional(is) inativo(s) no cadastro têm valores e já aparecem aqui como ativos.</span><button type="button" onClick={() => setActivation({ step: 'confirm', message: '' })}>Ativar no cadastro</button></>}
        </div>}
        {activation.message && <p className="eq-muted" role="status">{activation.message}</p>}
        <div className="eq-scroll eq-tree-wrap"><table className="eq-table eq-employee-table eq-tree"><caption>{count(employees.length)} profissionais exibidos — clique para detalhar até o atendimento</caption>
          <thead><tr><th>Profissional / nível</th><th>Receita atribuída</th><th>Participação</th><th>Comissão indicativa</th><th>Serviços</th><th>Produtos</th><th>Ticket / serviço</th><th>{visible.period.historico ? 'Última atividade' : 'Vs. período anterior'}</th></tr></thead>
          <tbody>{employees.map(item => {
            const open = expanded.has(item.id)
            const detail = details[item.id]
            const tree = trees[item.id]
            return <Fragment key={item.id}>
              <tr className={`eq-node lvl-1${open ? ' is-open' : ''}${item.id === employeeId ? ' is-selected' : ''}`} style={{ '--lvl': 0 }} onClick={() => toggleEmployee(item.id)}>
                <th scope="row"><button type="button" className="eq-toggle" aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Detalhar'} ${item.name}`} onClick={event => { event.stopPropagation(); toggleEmployee(item.id) }}><span className="eq-caret" aria-hidden="true">▸</span><span className="eq-node-label">{item.name}</span></button><small><StatusBadge item={item} />{item.historicalServices ? ` · ${count(item.historicalServices)} históricos Avec` : ''}{!item.hasActivity ? ' · sem movimento' : ''}</small></th>
                <td><div className="eq-money">{amount(item.revenue)}<ShareBar value={item.revenue} total={totalAttributed} /></div></td>
                <td>{percent(share(item.revenue, totalAttributed))}</td>
                <td>{item.synthetic ? '—' : amount(item.commission)}</td>
                <td>{count(item.services)}</td>
                <td>{count(item.products)}</td>
                <td>{amount(item.ticketAverage)}</td>
                <td>{visible.period.historico ? (item.lastActivity ? dateLabel(item.lastActivity) : '—') : item.revenueTrendPct == null ? 'Sem base anterior' : `${item.revenueTrendPct > 0 ? '+' : ''}${percent(item.revenueTrendPct)}`}<button type="button" className="eq-analyze" onClick={event => { event.stopPropagation(); analyze(item.id) }} aria-label={`Ver desempenho de ${item.name}`} aria-pressed={item.id === employeeId}>Analisar</button></td>
              </tr>
              {open && (detail?.loading ? <tr className="eq-node lvl-2"><td colSpan={8} className="eq-dim">Carregando detalhamento de {item.name}…</td></tr>
                : detail?.error ? <tr className="eq-node lvl-2"><td colSpan={8} className="eq-dim">Não foi possível carregar o detalhe. Recolha e tente de novo.</td></tr>
                  : tree ? (tree.length ? <DrillNodes nodes={tree} depth={2} path={item.id} parentRevenue={tree.reduce((sum, node) => sum + node.revenue, 0)} expanded={expanded} toggle={toggle} limits={limits} showMore={showMore} /> : <tr className="eq-node lvl-2"><td colSpan={8} className="eq-dim">Sem lançamentos detalhados no período.</td></tr>) : null)}
            </Fragment>
          })}</tbody></table></div>
        {!employees.length && <p className="eq-empty">{onlyWithValues && hiddenWithoutValues ? 'Nenhum profissional com valores corresponde à busca. Desmarque “Somente com valores” para ver todos.' : 'Nenhum profissional corresponde à busca neste contexto.'}</p>}
      </section>
      {selected ? <section className="eq-detail" aria-label={`Detalhe de ${selected.name}`}><div className="eq-detail-head"><div><span className="eq-kicker">ANÁLISE INDIVIDUAL</span><h3>{selected.name}</h3></div><button type="button" onClick={() => setEmployeeId('')}>Fechar detalhe</button></div><div className="eq-metrics"><Metric label="Serviços" value={amount(selected.serviceRevenue)} note={`${count(selected.services)} serviços apurados`} /><Metric label="Revenda" value={amount(selected.productRevenue)} note={`${count(selected.products)} unidades vendidas`} /><Metric label="Comissão de serviços" value={amount(selected.serviceCommission)} note="Calculada, não paga automaticamente" /><Metric label="Comissão de produtos" value={amount(selected.productCommission)} note="Regra atual de revenda" /><Metric label="Comparecimento observado" value={percent(selected.attendanceRate)} note="Concluídos / (concluídos + faltas)" /></div>
        <div className="eq-agenda-stats"><span>{count(selected.completed)} concluídos</span><span>{count(selected.canceled)} cancelados</span><span>{count(selected.noShow)} faltas de clientes</span><span>{count(selected.appointments)} reservas</span></div>
        <div className="eq-two-columns"><section className="eq-card"><h3>Serviços mais vendidos</h3><p className="eq-muted">Quantidade apurada e valor atribuído após descontos; inclui histórico Avec detalhado quando disponível.</p><ServiceBars items={selected.topServices} /></section><section className="eq-card"><h3>Evolução {selectedDetail.granularity === 'month' ? 'mensal' : 'diária'}</h3><p className="eq-muted">Receita atribuída no período selecionado.</p><DailyChart rows={selected.daily} monthly={selectedDetail.granularity === 'month'} /></section></div>
        <section className="eq-card"><h3>Dias e horários de maior volume</h3><p className="eq-muted">Início do serviço, quando conhecido. Sem horário confirmado, o registro não entra no mapa.</p><HourMap cells={selected.heatmap} /></section>
        <div className="eq-coaching"><Notes title="O que funcionou" items={selected.strengths} empty="Ainda não há evidência suficiente para destacar um resultado." type="strengths" /><Notes title="Pontos de atenção" items={selected.attention} empty="Nenhum sinal relevante encontrado nas métricas disponíveis; isso não certifica ausência de problemas." type="attention" /><Notes title="Como melhorar no período" items={selected.suggestions} empty="Amplie a base de registros e revise o período com a equipe antes de definir ações." type="suggestions" /></div>
      </section> : employeeId && selectedDetail?.loading ? <p className="eq-empty" role="status">Carregando análise individual…</p>
        : employeeId && selectedDetail?.error ? <p className="eq-alert" role="alert">Não foi possível carregar a análise individual.</p>
          : <p className="eq-empty">Clique em “Analisar” para ver serviços, horários, evolução e sugestões do profissional.</p>}
      <details className="eq-quality"><summary><strong>Qualidade e limites dos dados</strong></summary><p>Equipe do cadastro operacional: com “Somente com valores” desmarcado, pessoas sem movimentos também aparecem. Inativos no cadastro com valores no período são exibidos como ativos. Contas de acesso sem vínculo operacional não recebem vendas ou comissões automaticamente.</p><p>{count(visible.quality?.unscopedExcluded)} registros sem unidade comprovada excluídos · {count(visible.quality?.unattributedEvents)} movimentos sem responsável atribuído.</p>{visible.quality?.transfersAvailable === false && <p>Repasses sem vínculo de unidade estão indisponíveis; ausência de evidência não virou valor zero.</p>}{(visible.quality?.commissionWarnings || []).filter(item => typeof item === 'string').map((warning, index) => <p key={index}>{warning}</p>)}<p>O total consolidado inclui e-commerce e histórico financeiro Avec pago. A tabela por profissional mostra apenas valores atribuíveis, incluindo serviços históricos detalhados quando há vínculo; nenhum pedido Commerce é imputado sem prova.</p><p>Faltas e cancelamentos não comprovam erro do funcionário. Sugestões são apoio à gestão, não avaliação disciplinar automática.</p></details>
      <section className="eq-card eq-definitions"><h3>Como interpretar</h3><ul>{(visible.definitions || []).map((text, i) => <li key={i}>{text}</li>)}</ul><div className="eq-actions"><button type="button" onClick={() => onOpenTab('Comissões')}>Conferir apuração de comissões</button><button type="button" onClick={() => onOpenTab('Extrato e repasses')}>Conferir extratos e repasses</button><button type="button" onClick={() => onOpenTab('Profissionais')}>Conferir cadastro da equipe</button></div><p className="eq-muted">Sem salários, gorjetas ou comissão de planos inferidos. A única gravação possível nesta tela é a ativação do cadastro, sempre com confirmação.</p></section>
    </>}
  </div>
}
