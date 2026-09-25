import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate, fmtR } from '../../lib/api'
import './dino-dashboard.css'

const PERIODS = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']]
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

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

function KpiCard({ item, series }) {
  const tone = item.available ? (item.trendAvailable && item.trendPct < 0 ? 'negative' : 'positive') : 'muted'
  return <article className={`dino-kpi-card ${item.available ? '' : 'unavailable'}`}>
    <div className="dino-kpi-top"><span>{item.label}</span>{item.available && item.trendAvailable ? <b className={tone}>{item.trendPct >= 0 ? '↗' : '↘'} {Math.abs(item.trendPct)}%</b> : <b className="muted">{item.available ? 'sem comparação' : 'indisponível'}</b>}</div>
    <strong>{formatValue(item.value, item.format)}</strong>
    <Sparkline values={series} unavailable={!item.available} />
    {!item.available && <small>{item.reason}</small>}
  </article>
}

function RevenueChart({ rows = [] }) {
  const visible = rows.length > 30 ? rows.slice(-30) : rows
  const max = Math.max(...visible.map((item) => Number(item.total || 0)), 1)
  return <div className="dino-revenue-chart">
    <div className="dino-revenue-bars" role="img" aria-label="Faturamento diário no período">
      {visible.map((item, index) => <div key={item.day} className={index === visible.length - 1 ? 'is-latest' : ''} title={`${String(item.day).split('-').reverse().join('/')}: ${fmtR(Number(item.total || 0))}`}><i style={{ height: `${Math.max(Number(item.total || 0) > 0 ? 4 : 1, Number(item.total || 0) / max * 100)}%` }} /><span>{visible.length <= 7 || index === 0 || index === visible.length - 1 || index % Math.ceil(visible.length / 6) === 0 ? String(item.day).slice(5).split('-').reverse().join('/') : ''}</span></div>)}
      {!visible.some((item) => Number(item.total) > 0) && <div className="dino-chart-empty">Nenhum faturamento registrado neste período.</div>}
    </div>
  </div>
}

function HorizontalBars({ items = [], valueKey = 'revenue', empty = 'Sem dados no período.' }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1)
  if (!items.length) return <div className="dino-panel-empty">{empty}</div>
  return <div className="dino-bars">{items.map((item, index) => <div className="dino-bar-row" key={`${item.name}-${index}`}><div><span>{item.name}</span><strong>{valueKey === 'revenue' ? fmtR(Number(item[valueKey] || 0)) : Number(item[valueKey] || 0).toLocaleString('pt-BR')}</strong></div><i><b style={{ width: `${Math.max(3, Number(item[valueKey] || 0) / max * 100)}%`, background: COLORS[index % COLORS.length] }} /></i></div>)}</div>
}

function PaymentDonut({ items = [] }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0)
  let angle = 0
  const gradient = items.length ? `conic-gradient(${items.map((item, index) => { const start = angle; angle += total ? Number(item.value || 0) / total * 360 : 0; return `${COLORS[index % COLORS.length]} ${start}deg ${angle}deg` }).join(',')})` : 'var(--surface-2)'
  return <div className="dino-donut-layout"><div className="dino-donut" style={{ background: gradient }}><div><strong>{fmtR(total)}</strong><span>recebido</span></div></div><div className="dino-donut-legend">{items.length ? items.map((item, index) => <div key={item.method}><i style={{ background: COLORS[index % COLORS.length] }}/><span>{item.method}</span><strong>{fmtR(item.value)}</strong></div>) : <div className="dino-panel-empty">Sem pagamentos registrados.</div>}</div></div>
}

function Funnel({ rows = [] }) {
  const available = rows.filter((item) => item.available && item.value != null)
  const max = Math.max(...available.map((item) => Number(item.value || 0)), 1)
  return <div className="dino-funnel">{rows.map((item) => <div key={item.id} className={item.available ? '' : 'unavailable'}><span>{item.label}</span><i><b style={{ width: item.available ? `${Math.max(4, Number(item.value || 0) / max * 100)}%` : '100%' }}/></i><strong>{item.available ? Number(item.value || 0).toLocaleString('pt-BR') : 'tracking pendente'}</strong></div>)}</div>
}

function Heatmap({ cells = [] }) {
  const days = [['mon','Seg'], ['tue','Ter'], ['wed','Qua'], ['thu','Qui'], ['fri','Sex'], ['sat','Sáb'], ['sun','Dom']]
  const hours = Array.from({ length: 13 }, (_, index) => index + 8)
  const values = new Map(cells.map((item) => [`${item.weekday}-${item.hour}`, Number(item.value || 0)]))
  const max = Math.max(...cells.map((item) => Number(item.value || 0)), 1)
  return <div className="dino-heatmap-wrap"><div className="dino-heatmap" style={{ '--heatmap-cols': hours.length + 1 }}><span />{hours.map((hour) => <span key={hour}>{hour}h</span>)}{days.flatMap(([day, label]) => [<strong key={`${day}-label`}>{label}</strong>, ...hours.map((hour) => { const value = values.get(`${day}-${hour}`) || 0; return <i key={`${day}-${hour}`} title={`${label} ${hour}h: ${value}`} style={{ opacity: value ? .2 + value / max * .8 : .06 }} /> })])}</div></div>
}

function ChannelList({ items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.revenue || 0)), 1)
  return <div className="dino-channel-list">{items.map((item, index) => <div key={item.id} className={item.available ? '' : 'unavailable'}><span><i style={{ background: COLORS[index % COLORS.length] }}/>{item.label}</span><strong>{item.available ? fmtR(item.revenue) : 'indisponível'}</strong><small>{item.transactions || 0} transações</small><b><i style={{ width: `${Number(item.revenue || 0) / max * 100}%`, background: COLORS[index % COLORS.length] }}/></b></div>)}</div>
}

export default function DinoBusinessDashboard({ onOpenTab = () => {} }) {
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

  if (loading && !data) return <section className="dino-dashboard-loading" aria-busy="true">Carregando indicadores reais…</section>

  return <section className="dino-business-dashboard" aria-label="Dashboard do negócio Dino">
    <header className="dino-dashboard-header"><div><span>Visão do negócio</span><h2>Central Dino</h2><p>Barbearia, perfumaria e relacionamento no mesmo recorte operacional.</p></div><div className="dino-period-switch" aria-label="Período do dashboard">{PERIODS.map(([value, label]) => <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)} aria-pressed={period === value}>{label}</button>)}<button type="button" onClick={load}>Atualizar</button></div></header>
    {error && <div className="dino-dashboard-error" role="alert">{error}</div>}
    {data && <>
      <div className="dino-kpi-grid">{(data.kpis || []).map((item) => <KpiCard key={item.id} item={item} series={item.id === 'revenue' || item.id === 'ticket' ? revenueSeries : item.id === 'appointments' ? appointmentSeries : []} />)}</div>
      <div className="dino-mini-kpis"><button type="button" onClick={() => onOpenTab('Caixa e fechamento')}><span>Contas a receber</span><strong>{fmtR(data.miniKpis?.receivables || 0)}</strong></button><button type="button" onClick={() => onOpenTab('Estoque de revenda')}><span>Estoque baixo</span><strong>{data.miniKpis?.lowStock?.total || 0}</strong><small>{data.miniKpis?.lowStock?.commerce || 0} loja · {data.miniKpis?.lowStock?.retail || 0} revenda</small></button><button type="button" onClick={() => onOpenTab('Planos e assinaturas')}><span>MRR</span><strong>{fmtR(data.miniKpis?.mrr || 0)}</strong></button></div>
      <div className="dino-dashboard-grid wide-left"><article className="dino-chart-panel"><header><div><span>Receita por dia</span><h3>Faturamento</h3></div><strong>{formatValue(data.kpis?.find((item) => item.id === 'revenue')?.value, 'currency')}</strong></header><RevenueChart rows={data.charts?.revenueDaily || []} /></article><article className="dino-chart-panel"><header><div><span>Distribuição real</span><h3>Pagamentos</h3></div></header><PaymentDonut items={data.charts?.paymentMethods || []} /></article></div>
      <div className="dino-dashboard-grid"><article className="dino-chart-panel"><header><div><span>Receita</span><h3>Categorias</h3></div></header><HorizontalBars items={data.charts?.categorySales || []} /></article><article className="dino-chart-panel"><header><div><span>Desempenho</span><h3>Produtos e serviços</h3></div></header><HorizontalBars items={data.charts?.topProducts || []} /></article><article className="dino-chart-panel"><header><div><span>Jornada</span><h3>Funil de conversão</h3></div></header><Funnel rows={data.charts?.funnel || []} /></article></div>
      <div className="dino-dashboard-grid two"><article className="dino-chart-panel"><header><div><span>Capacidade</span><h3>Horários mais movimentados</h3></div></header><Heatmap cells={data.charts?.scheduleHeatmap || []} /></article><article className="dino-chart-panel"><header><div><span>Origem registrada</span><h3>Canais de venda</h3></div></header><ChannelList items={data.charts?.channels || []} /></article></div>
      <div className="dino-dashboard-grid two"><article className="dino-chart-panel"><header><div><span>Próximos compromissos</span><h3>Agenda</h3></div><button type="button" onClick={() => onOpenTab('Agenda')}>Abrir agenda</button></header>{data.upcomingAppointments?.length ? <div className="dino-event-list">{data.upcomingAppointments.map((item) => <div key={item.id}><time>{new Date(item.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: data.period?.timeZone })}</time><span><strong>{item.customerId ? <Link to={`/admin/clientes-360/${encodeURIComponent(`dino:${item.customerId}`)}`} className="dino-customer-link">{item.customer}</Link> : item.customer}</strong><small>{item.service} · {item.professional}</small></span></div>)}</div> : <div className="dino-panel-empty">Nenhum atendimento futuro registrado.</div>}</article><article className="dino-chart-panel"><header><div><span>Eventos persistidos</span><h3>Atividade recente</h3></div></header>{data.activity?.length ? <div className="dino-event-list">{data.activity.map((item, index) => <div key={`${item.type}-${item.at}-${index}`}><i className={`type-${item.type}`} /><span><strong>{item.title}</strong><small>{item.detail} · {fmtDate(item.at)}</small></span></div>)}</div> : <div className="dino-panel-empty">Nenhuma atividade registrada.</div>}</article></div>
      <article className="dino-chart-panel dino-goals"><header><div><span>Metas</span><h3>Acompanhamento</h3></div></header>{data.goals?.configured ? <HorizontalBars items={data.goals.items} valueKey="progress" /> : <div className="dino-panel-empty"><strong>Nenhuma meta configurada</strong><span>Metas não são inferidas. Cadastre objetivos quando a política comercial estiver definida.</span></div>}</article>
      <details className="dino-data-quality"><summary>Qualidade e cobertura dos dados</summary><p>{(data.dataQuality?.notes || []).join(' ')}</p></details>
    </>}
  </section>
}
