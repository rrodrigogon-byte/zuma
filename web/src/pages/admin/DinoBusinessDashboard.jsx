import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate, fmtR } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { GoalsPanel, WhatsappAlert } from './dino/GoalsPanel'
import StrategicRevenueMix from './dino/StrategicRevenueMix'
import './customer360.css'
import './dino/dino-admin.css'
import './dino-dashboard.css'

const PERIODS = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']]
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

function erpPath(area, tab, extra = {}) {
  const query = new URLSearchParams({ area, tab, ...extra })
  return `/admin/barbearia-erp?${query.toString()}`
}

const DASHBOARD_TIME_ZONE = 'America/Cuiaba'

function localDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const safe = Number.isNaN(date.valueOf()) ? new Date() : date
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(safe)
  const pick = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function plusDays(day, amount) {
  const date = new Date(`${day}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function analyticsRange(periodData, fallbackDays) {
  const end = localDay(periodData?.to || new Date())
  return { inicio: periodData?.from ? localDay(periodData.from) : plusDays(end, -(fallbackDays - 1)), fim: end }
}

function reportPath(section, range) {
  return erpPath('gestao', 'Relatórios', { secao: section, de: range.inicio, ate: range.fim })
}

const PATHS = {
  agenda: erpPath('operacao', 'Agenda'),
  atendimento: erpPath('operacao', 'Atendimento'),
  retail: erpPath('catalogo', 'Vendas de revenda'),
  stock: erpPath('catalogo', 'Estoque de revenda'),
  plans: erpPath('catalogo', 'Planos e assinaturas'),
  performance: erpPath('gestao', 'Desempenho da equipe'),
  goals: erpPath('gestao', 'Ocupação e metas'),
  customers: '/admin/clientes-360',
  finance: '/admin/financeiro',
  commerce: '/admin/ecommerce?tab=overview',
  commerceCatalog: '/admin/ecommerce?tab=catalog',
  commercePayments: '/admin/ecommerce?tab=payments',
}

function kpiDestination(id, range) {
  const destinations = {
    revenue: { to: reportPath('financeiro', range), label: 'Ver receita e fontes' },
    profit: { to: reportPath('financeiro', range), label: 'Ver resultado estimado' },
    ticket: { to: reportPath('financeiro', range), label: 'Ver ticket e transações' },
    newCustomers: { to: reportPath('clientes', range), label: 'Ver base e recorrência' },
    appointments: { to: PATHS.agenda, label: 'Abrir agenda' },
    conversion: { to: reportPath('visao', range), label: 'Ver visão executiva', unavailableLabel: 'Ver cobertura do funil' },
  }
  return destinations[id] || { to: reportPath('visao', range), label: 'Ver análise no BI' }
}

function quickLinks(range) {
  return [
    { to: reportPath('visao', range), title: 'BI e relatórios', detail: 'Faturamento, fontes e cobertura' },
    { to: PATHS.agenda, title: 'Agenda', detail: 'Horários, status e comparecimento' },
    { to: PATHS.customers, title: 'Clientes', detail: 'Carteira e relacionamento' },
    { to: reportPath('produtos', range), title: 'Serviços e produtos', detail: 'Ranking, receita e margem' },
    { to: PATHS.stock, title: 'Revenda e estoque', detail: 'Saldo presencial e vendas' },
    { to: PATHS.plans, title: 'Planos', detail: 'Assinaturas e recorrência' },
    { to: PATHS.performance, title: 'Equipe e metas', detail: 'Desempenho e capacidade' },
    { to: PATHS.commerce, title: 'Commerce', detail: 'Pedidos, pagamentos e loja' },
  ]
}

const ACTIVITY_DESTINATIONS = {
  appointment: { to: PATHS.agenda, label: 'Abrir agenda' },
  retail: { to: PATHS.retail, label: 'Abrir revenda' },
  command: { to: PATHS.atendimento, label: 'Abrir atendimento' },
}

function channelDestination(id, range) {
  const destinations = {
    commerce: { to: PATHS.commerce, label: 'Abrir Commerce' },
    barbershop: { to: reportPath('operacao', range), label: 'Ver operação no BI' },
    retail: { to: PATHS.retail, label: 'Abrir revenda' },
    'historical-avec': { to: reportPath('financeiro', range), label: 'Ver fontes no BI' },
  }
  return destinations[id] || { to: reportPath('visao', range), label: 'Ver fonte no BI' }
}

function formatValue(value, format) {
  if (value == null) return 'Indisponível'
  if (format === 'currency') return fmtR(Number(value || 0))
  if (format === 'percent') return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return Number(value || 0).toLocaleString('pt-BR')
}

function Sparkline({ values = [], unavailable = false }) {
  const points = useMemo(() => {
    const clean = values.map(Number).filter(Number.isFinite)
    if (clean.length < 2) return ''
    const max = Math.max(...clean, 1)
    const min = Math.min(...clean, 0)
    const span = Math.max(1, max - min)
    return clean.map((value, index) => `${(index / (clean.length - 1)) * 100},${32 - ((value - min) / span) * 26}`).join(' ')
  }, [values])
  if (unavailable || !points) return <div className="dino-sparkline unavailable" aria-hidden="true" />
  return <svg className="dino-sparkline" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>
}

function KpiCard({ item, series, range }) {
  const tone = item.available ? (item.trendAvailable && item.trendPct < 0 ? 'negative' : 'positive') : 'muted'
  const destination = kpiDestination(item.id, range)
  const actionLabel = item.available ? destination.label : (destination.unavailableLabel || 'Ver cobertura do indicador')
  return <Link
    to={destination.to}
    className={`dino-kpi-card ${item.available ? '' : 'unavailable'}`}
    title={actionLabel}
    aria-label={`${item.label}: ${formatValue(item.value, item.format)}. ${actionLabel}.`}
  >
    <div className="dino-kpi-top"><span>{item.label}</span>{item.available && item.trendAvailable ? <b className={tone}>{item.trendPct >= 0 ? '↗' : '↘'} {Math.abs(item.trendPct)}%</b> : <b className="muted">{item.available ? 'sem comparação' : 'indisponível'}</b>}</div>
    <strong>{formatValue(item.value, item.format)}</strong>
    <Sparkline values={series} unavailable={!item.available} />
    {!item.available && <small>{item.reason}</small>}
    {item.available && item.id === 'profit' && item.margin != null && <small title={item.reason}>Margem {String(item.margin).replace('.', ',')}% · após comissões, custos e despesas</small>}
    <span className="dino-kpi-action">{actionLabel} <span aria-hidden="true">→</span></span>
  </Link>
}

function PanelLink({ to, children }) {
  return <Link className="dino-panel-link" to={to}>{children} <span aria-hidden="true">→</span></Link>
}

function RevenueChart({ rows = [] }) {
  const visible = rows.length > 30 ? rows.slice(-30) : rows
  const max = Math.max(...visible.map((item) => Number(item.total || 0)), 1)
  const accessibleSummary = visible.map((item) => `${String(item.day).split('-').reverse().join('/')}: ${fmtR(Number(item.total || 0))}`).join('. ')
  return <div className="dino-revenue-chart">
    <div className="dino-revenue-bars" role="img" aria-label={`Valor registrado por dia. ${accessibleSummary}`}>
      {visible.map((item, index) => <div key={item.day} className={index === visible.length - 1 ? 'is-latest' : ''} title={`${String(item.day).split('-').reverse().join('/')}: ${fmtR(Number(item.total || 0))}`}><i style={{ height: `${Math.max(Number(item.total || 0) > 0 ? 4 : 1, Number(item.total || 0) / max * 100)}%` }} /><span>{visible.length <= 7 || index === 0 || index === visible.length - 1 || index % Math.ceil(visible.length / 6) === 0 ? String(item.day).slice(5).split('-').reverse().join('/') : ''}</span></div>)}
      {!visible.some((item) => Number(item.total) > 0) && <div className="dino-chart-empty">Nenhum valor registrado neste período.</div>}
    </div>
  </div>
}

function HorizontalBars({ items = [], valueKey = 'revenue', empty = 'Sem dados no período.' }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1)
  if (!items.length) return <div className="dino-panel-empty">{empty}</div>
  return <div className="dino-bars">{items.map((item, index) => <div className="dino-bar-row" key={`${item.name}-${index}`}><div><span>{item.name}</span><strong>{valueKey === 'revenue' ? fmtR(Number(item[valueKey] || 0)) : Number(item[valueKey] || 0).toLocaleString('pt-BR')}</strong></div><i aria-hidden="true"><b style={{ width: `${Math.max(3, Number(item[valueKey] || 0) / max * 100)}%`, background: COLORS[index % COLORS.length] }} /></i></div>)}</div>
}

function PaymentDonut({ items = [], caption = 'recebido', empty = 'Sem pagamentos registrados.' }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0)
  let angle = 0
  const gradient = items.length ? `conic-gradient(${items.map((item, index) => { const start = angle; angle += total ? Number(item.value || 0) / total * 360 : 0; return `${COLORS[index % COLORS.length]} ${start}deg ${angle}deg` }).join(',')})` : 'var(--surface-2)'
  const detail = items.map((item) => `${item.method}: ${fmtR(item.value)}`).join('. ')
  return <div className="dino-donut-layout"><div className="dino-donut" style={{ background: gradient }} role="img" aria-label={`Total ${caption}: ${fmtR(total)}. ${detail}`}><div><strong>{fmtR(total)}</strong><span>{caption}</span></div></div><div className="dino-donut-legend">{items.length ? items.map((item, index) => <div key={item.method}><i style={{ background: COLORS[index % COLORS.length] }}/><span>{item.method}</span><strong>{fmtR(item.value)}</strong></div>) : <div className="dino-panel-empty">{empty}</div>}</div></div>
}

function HistoricalAvecPanel({ data, range }) {
  const services = data?.services || { count: 0, value: 0 }
  const commands = data?.commands || { count: 0, value: 0 }
  const finance = data?.finance || { entries: 0, paidRevenue: 0, paidExpenses: 0, pendingExpenses: 0 }
  if (!services.count && !commands.count && !finance.entries) return null
  return <article className="dino-chart-panel dino-history-panel">
    <header><div><span>Origem Avec</span><h3>Histórico importado — auditável</h3></div><PanelLink to={reportPath('financeiro', range)}>Ver fontes no BI</PanelLink></header>
    <div className="dino-history-grid">
      <Link to={reportPath('operacao', range)}><strong>{services.count.toLocaleString('pt-BR')}</strong><span>atendimentos detalhados</span><small>{fmtR(services.value)} em valores informados</small></Link>
      <Link to={reportPath('visao', range)}><strong>{commands.count.toLocaleString('pt-BR')}</strong><span>cabeçalhos de comanda</span><small>{fmtR(commands.value)} em totais de origem</small></Link>
      <Link to={reportPath('clientes', range)}><strong>{(data.uniqueClients || 0).toLocaleString('pt-BR')}</strong><span>clientes relacionados</span><small>identidades encontradas no recorte</small></Link>
      <Link to={PATHS.finance}><strong>{(finance.entries || 0).toLocaleString('pt-BR')}</strong><span>lançamentos financeiros</span><small>{fmtR(finance.paidRevenue)} em receitas pagas</small></Link>
      <Link to={PATHS.finance}><strong>{fmtR(finance.paidExpenses)}</strong><span>despesas pagas</span><small>{fmtR(finance.pendingExpenses)} em despesas pendentes</small></Link>
    </div>
    <p className="dino-history-note">{finance.note || data.note || 'Os serviços e comandas permanecem como evidência histórica. As receitas e despesas pagas importadas entram nos valores consolidados e no livro financeiro com origem Avec; não são novas vendas operacionais.'}</p>
  </article>
}

function Funnel({ rows = [] }) {
  const available = rows.filter((item) => item.available && item.value != null)
  const max = Math.max(...available.map((item) => Number(item.value || 0)), 1)
  return <div className="dino-funnel">{rows.map((item) => <div key={item.id} className={item.available ? '' : 'unavailable'}><span>{item.label}</span><i aria-hidden="true"><b style={{ width: item.available ? `${Math.max(4, Number(item.value || 0) / max * 100)}%` : '100%' }}/></i><strong>{item.available ? Number(item.value || 0).toLocaleString('pt-BR') : 'tracking pendente'}</strong></div>)}</div>
}

function Heatmap({ cells = [] }) {
  const days = [['mon', 'Seg'], ['tue', 'Ter'], ['wed', 'Qua'], ['thu', 'Qui'], ['fri', 'Sex'], ['sat', 'Sáb'], ['sun', 'Dom']]
  const hours = Array.from({ length: 13 }, (_, index) => index + 8)
  const values = new Map(cells.map((item) => [`${item.weekday}-${item.hour}`, Number(item.value || 0)]))
  const max = Math.max(...cells.map((item) => Number(item.value || 0)), 1)
  return <div className="dino-heatmap-wrap"><div className="dino-heatmap" style={{ '--heatmap-cols': hours.length + 1 }} role="grid" aria-label="Horários mais movimentados por dia"><span />{hours.map((hour) => <span key={hour} role="columnheader">{hour}h</span>)}{days.flatMap(([day, label]) => [<strong key={`${day}-label`} role="rowheader">{label}</strong>, ...hours.map((hour) => { const value = values.get(`${day}-${hour}`) || 0; return <i key={`${day}-${hour}`} role="gridcell" aria-label={`${label}, ${hour} horas: ${value} agendamento(s)`} style={{ opacity: value ? .2 + value / max * .8 : .06 }} /> })])}</div></div>
}

function ChannelList({ items = [], range }) {
  const max = Math.max(...items.map((item) => Number(item.revenue || 0)), 1)
  return <div className="dino-channel-list">{items.map((item, index) => {
    const destination = channelDestination(item.id, range)
    return <Link key={item.id} to={destination.to} className={item.available ? '' : 'unavailable'} aria-label={`${item.label}: ${item.available ? fmtR(item.revenue) : 'indisponível'}. ${destination.label}.`}><span><i style={{ background: COLORS[index % COLORS.length] }}/>{item.label}</span><strong>{item.available ? fmtR(item.revenue) : 'indisponível'}</strong><small>{item.transactions || 0} transações · {destination.label}</small><b aria-hidden="true"><i style={{ width: `${Number(item.revenue || 0) / max * 100}%`, background: COLORS[index % COLORS.length] }}/></b></Link>
  })}</div>
}

function MiniKpi({ to, label, value, note, action }) {
  return <Link to={to} className="dino-mini-kpi"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}<b>{action} <span aria-hidden="true">→</span></b></Link>
}

export default function DinoBusinessDashboard() {
  const { user } = useAuth()
  const canEditGoals = ['admin', 'organizador'].includes(String(user?.role || ''))
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(await api.get(`/api/admin/barbearia/analytics?period=${period}`)) }
    catch (err) { setError(err.message || 'Não foi possível carregar os indicadores.') }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const revenueSeries = data?.charts?.revenueDaily?.map((item) => Number(item.total || 0)) || []
  const appointmentSeries = data?.charts?.appointmentsDaily?.map((item) => Number(item.value || 0)) || []
  const reportRange = analyticsRange(data?.period, period)
  const mixDestinations = {
    overview: { to: reportPath('financeiro', reportRange), label: 'Abrir relatório consolidado' },
    services: { to: reportPath('produtos', reportRange), label: 'Ver serviços no BI' },
    products: { to: reportPath('produtos', reportRange), label: 'Ver produtos no BI' },
    plans: { to: PATHS.plans, label: 'Abrir planos e assinaturas' },
    unclassified: { to: reportPath('financeiro', reportRange), label: 'Ver fontes e cobertura' },
  }

  if (loading && !data) return <section className="dino-dashboard-loading" aria-busy="true">Carregando indicadores reais…</section>

  return <section className="dino-business-dashboard" aria-label="Dashboard do negócio Dino" aria-busy={loading}>
    <header className="dino-dashboard-header"><div><span>Visão do negócio</span><h2>Central Dino</h2><p>Barbearia, perfumaria e relacionamento no mesmo recorte operacional.</p></div><div className="dino-period-switch" aria-label="Período do dashboard">{PERIODS.map(([value, label]) => <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)} aria-pressed={period === value}>{label}</button>)}<button type="button" onClick={load}>Atualizar</button></div></header>
    <p className="dino-dashboard-status" role="status">{loading ? 'Atualizando indicadores…' : `Indicadores atualizados para ${PERIODS.find(([value]) => value === period)?.[1] || 'o período selecionado'}.`}</p>
    {error && <div className="dino-dashboard-error" role="alert">{error}</div>}
    <WhatsappAlert />
    {data && <>
      <nav className="dino-access-hub" aria-label="Atalhos para indicadores e operação"><div className="dino-access-hub-heading"><span>Ir direto ao ponto</span><strong>Indicadores, operação e análise</strong></div><div className="dino-access-links">{quickLinks(reportRange).map((item) => <Link key={item.title} to={item.to}><strong>{item.title}</strong><small>{item.detail}</small><b aria-hidden="true">→</b></Link>)}</div></nav>
      <section aria-label="KPIs prioritários"><div className="dino-kpi-grid">{(data.kpis || []).map((item) => <KpiCard key={item.id} item={item} range={reportRange} series={item.id === 'revenue' || item.id === 'ticket' ? revenueSeries : item.id === 'appointments' ? appointmentSeries : []} />)}</div><p className="dino-kpi-context">Os KPIs consolidam operação, histórico financeiro Avec pago e e-commerce conforme o período. Para conferir a origem de cada valor, abra a análise correspondente.</p></section>
      <section className="dino-mini-kpis" aria-label="Indicadores operacionais complementares">
        <MiniKpi to={PATHS.finance} label="Contas a receber operacionais" value={fmtR(data.miniKpis?.receivables || 0)} action="Abrir financeiro" />
        <article className="dino-mini-kpi dino-stock-kpi"><Link to={PATHS.stock}><span>Estoque baixo</span><strong>{data.miniKpis?.lowStock?.total || 0}</strong><small>{data.miniKpis?.lowStock?.retail || 0} revenda · {data.miniKpis?.lowStock?.commerce || 0} Commerce</small><b>Ver estoque de revenda <span aria-hidden="true">→</span></b></Link><Link className="dino-stock-commerce-link" to={PATHS.commerceCatalog}>Abrir catálogo Commerce <span aria-hidden="true">→</span></Link></article>
        <MiniKpi to={PATHS.plans} label="MRR" value={fmtR(data.miniKpis?.mrr || 0)} note="Consulte assinaturas ativas e sua cobertura." action="Abrir planos" />
      </section>
      <HistoricalAvecPanel data={{ ...data.historicalAvec, finance: data.historicalFinance }} range={reportRange} />
      <StrategicRevenueMix mix={data.strategicMix} periodLabel={`recorte de ${data.period?.days || period} dia(s)`} destinations={mixDestinations} />
      <div className="dino-dashboard-grid wide-left"><article className="dino-chart-panel"><header><div><span>Valor dos pedidos e vendas</span><h3>Movimento registrado</h3></div><PanelLink to={reportPath('visao', reportRange)}>Ver série no BI</PanelLink></header><strong className="dino-panel-value">{formatValue(data.kpis?.find((item) => item.id === 'revenue')?.value, 'currency')}</strong><RevenueChart rows={data.charts?.revenueDaily || []} /></article><article className="dino-chart-panel"><header><div><span>Barbearia e revenda</span><h3>Pagamentos registrados</h3></div><PanelLink to={reportPath('financeiro', reportRange)}>Ver meios no BI</PanelLink></header><PaymentDonut items={data.charts?.paymentMethods || []} empty="Sem pagamentos conciliados no período." /><div className="dino-panel-subhead"><h4>Capturas do e-commerce</h4><PanelLink to={PATHS.commercePayments}>Abrir pagamentos</PanelLink></div><PaymentDonut items={data.charts?.commercePaymentMethods || []} caption="capturado" empty="Sem capturas no período." /><p className="dino-panel-empty">Capturas registradas no Commerce no período. Não representam liquidação bancária.</p></article></div>
      <div className="dino-dashboard-grid"><article className="dino-chart-panel"><header><div><span>Receita</span><h3>Categorias</h3></div><PanelLink to={reportPath('produtos', reportRange)}>Ver detalhamento</PanelLink></header><HorizontalBars items={data.charts?.categorySales || []} /></article><article className="dino-chart-panel"><header><div><span>Desempenho</span><h3>Produtos e serviços</h3></div><PanelLink to={reportPath('produtos', reportRange)}>Ver ranking no BI</PanelLink></header><HorizontalBars items={data.charts?.topProducts || []} /></article><article className="dino-chart-panel"><header><div><span>Jornada</span><h3>Funil de conversão</h3></div><PanelLink to={reportPath('visao', reportRange)}>Ver cobertura</PanelLink></header><Funnel rows={data.charts?.funnel || []} /></article></div>
      <div className="dino-dashboard-grid two"><article className="dino-chart-panel"><header><div><span>Capacidade</span><h3>Horários mais movimentados</h3></div><PanelLink to={PATHS.agenda}>Abrir agenda</PanelLink></header><Heatmap cells={data.charts?.scheduleHeatmap || []} /></article><article className="dino-chart-panel"><header><div><span>Origem registrada</span><h3>Canais de venda</h3></div><PanelLink to={reportPath('visao', reportRange)}>Ver composição</PanelLink></header><ChannelList items={data.charts?.channels || []} range={reportRange} /></article></div>
      <div className="dino-dashboard-grid two"><article className="dino-chart-panel"><header><div><span>Próximos compromissos</span><h3>Agenda</h3></div><PanelLink to={PATHS.agenda}>Abrir agenda</PanelLink></header>{data.upcomingAppointments?.length ? <div className="dino-event-list">{data.upcomingAppointments.map((item) => <div key={item.id}><time>{new Date(item.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: data.period?.timeZone })}</time><span><strong>{item.customerId ? <Link to={`/admin/clientes-360/${encodeURIComponent(`dino:${item.customerId}`)}`} className="dino-customer-link">{item.customer}</Link> : item.customer}</strong><small>{item.service} · {item.professional}</small></span></div>)}</div> : <div className="dino-panel-empty">Nenhum atendimento futuro registrado.</div>}</article><article className="dino-chart-panel"><header><div><span>Eventos persistidos</span><h3>Atividade recente</h3></div><PanelLink to={reportPath('visao', reportRange)}>Ver indicadores</PanelLink></header>{data.activity?.length ? <div className="dino-event-list dino-activity-list">{data.activity.map((item, index) => { const destination = ACTIVITY_DESTINATIONS[item.type] || { to: reportPath('visao', reportRange), label: 'Ver indicadores' }; return <Link key={`${item.type}-${item.at}-${index}`} to={destination.to} aria-label={`${item.title}. ${item.detail}. ${destination.label}.`}><i className={`type-${item.type}`} /><span><strong>{item.title}</strong><small>{item.detail} · {fmtDate(item.at)}</small></span><em>{destination.label} <span aria-hidden="true">→</span></em></Link> })}</div> : <div className="dino-panel-empty">Nenhuma atividade registrada.</div>}</article></div>
      <GoalsPanel goals={data.goals} canEdit={canEditGoals} onSaved={load} />
      <details className="dino-data-quality"><summary>Qualidade e cobertura dos dados</summary><p>{(data.dataQuality?.notes || []).join(' ')}</p><PanelLink to={reportPath('visao', reportRange)}>Ver fontes e definições no BI</PanelLink></details>
    </>}
  </section>
}
