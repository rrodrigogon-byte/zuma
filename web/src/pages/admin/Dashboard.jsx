import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import { isDinoBrandContext } from '../../lib/brand'
import DinoBusinessDashboard from './DinoBusinessDashboard'

const LINKS = [
  { label: 'Atletas', href: '/admin/atletas', icon: '🎾' },
  { label: 'Chaves', href: '/admin/chaves', icon: '🏆' },
  { label: 'PDV / Comandas', href: '/admin/pdv', icon: '🍺' },
  { label: 'Cardápio', href: '/admin/cardapio', icon: '🍽️' },
  { label: 'Usuários', href: '/admin/usuarios', icon: '👤' },
  { label: 'Financeiro', href: '/admin/financeiro', icon: '💰' },
  { label: 'CRM', href: '/admin/crm', icon: '📈' },
  { label: 'Loja', href: '/admin/loja', icon: '🛍️' },
  { label: 'Estoque', href: '/admin/estoque', icon: '📦' },
  { label: 'Agenda', href: '/admin/agenda', icon: '📅' },
  { label: 'Auditoria', href: '/admin/auditoria', icon: '🔍' },
  { label: 'Configurações', href: '/admin/configuracoes', icon: '⚙️' },
]

const TIPO_BADGE = {
  estoque: { label: 'Estoque', color: '#FF6B2C', icon: '📦' },
  pagamento: { label: 'Pagamento', color: '#e05c5c', icon: '💳' },
  info: { label: 'Info', color: '#FF6B2C', icon: 'ℹ️' },
  mesa: { label: 'Mesa', color: '#FF9B72', icon: '🍺' },
}

const ALERT_ACTIONS = {
  estoque: { label: 'Ver Estoque', href: '/admin/cardapio' },
  pagamento: { label: 'Ver Financeiro', href: '/admin/financeiro' },
  mesa: { label: 'Ver Mesas', href: '/admin/pdv' },
  info: null,
}

// ── Shimmer skeleton blocks ──────────────────────────────────────────────────

const shimmerStyle = {
  background: 'linear-gradient(90deg,var(--card2) 25%,var(--line) 50%,var(--card2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 6,
}

function SkeletonBar() {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 8, height: 180, padding: 16 }}>
      <div style={{ ...shimmerStyle, height: 12, marginBottom: 16, width: '40%' }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
        {[40, 70, 50, 90, 60, 80, 45].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              ...shimmerStyle,
              borderRadius: '4px 4px 0 0',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function SkeletonKPI() {
  return (
    <div className="card kpi" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...shimmerStyle, height: 12, width: '50%' }} />
        <div style={{ ...shimmerStyle, height: 22, width: 22, borderRadius: '50%' }} />
      </div>
      <div style={{ ...shimmerStyle, height: 32, width: '60%' }} />
      <div style={{ ...shimmerStyle, height: 10, width: '35%' }} />
    </div>
  )
}

function SkeletonCard({ height = 160 }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 8, height, padding: 16 }}>
      <div style={{ ...shimmerStyle, height: 12, width: '45%', marginBottom: 20 }} />
      <div style={{ ...shimmerStyle, height: 12, width: '80%', marginBottom: 10 }} />
      <div style={{ ...shimmerStyle, height: 12, width: '65%', marginBottom: 10 }} />
      <div style={{ ...shimmerStyle, height: 12, width: '72%' }} />
    </div>
  )
}

// ── Charts ───────────────────────────────────────────────────────────────────

function PieChart({ data }) {
  if (!data || data.length === 0)
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados.</p>
  const total = data.reduce((s, d) => s + d.valor, 0)
  if (total === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados.</p>

  let acc = 0
  const segments = data.map((d) => {
    const pct = (d.valor / total) * 100
    const from = acc
    acc += pct
    return { ...d, from, to: acc, pct }
  })
  const gradient = segments
    .map((s) => `${s.color} ${s.from.toFixed(1)}% ${s.to.toFixed(1)}%`)
    .join(', ')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div
        style={{
          width: 110, height: 110, borderRadius: '50%',
          background: `conic-gradient(${gradient})`,
          flexShrink: 0, boxShadow: '0 0 0 4px #12283F',
        }}
      />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s) => (
          <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#ddd' }}>{s.label}</span>
            <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{s.pct.toFixed(0)}%</span>
            <span style={{ color: '#fff', fontWeight: 600, marginLeft: 4 }}>{fmtR(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BarChart({ data, maxVal }) {
  const [hovered, setHovered] = useState(null)
  if (!data?.length)
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados de faturamento.</p>

  const max = maxVal || Math.max(...data.map((f) => f.total), 1)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
        {data.map((f, idx) => {
          const pct = max > 0 ? (f.total / max) * 100 : 0
          const isHov = hovered === idx
          return (
            <div
              key={f.data}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHov && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: '#12283F', border: '1px solid var(--green)', borderRadius: 6,
                  padding: '4px 8px', fontSize: 11, color: '#fff', whiteSpace: 'nowrap',
                  zIndex: 10, pointerEvents: 'none', marginBottom: 4,
                }}>
                  {fmtR(f.total)}
                </div>
              )}
              <div style={{
                width: '100%', height: `${Math.max(pct, 4)}%`,
                background: isHov
                  ? 'linear-gradient(to top, #FF6B2C, #e8c97a)'
                  : pct === 100
                  ? 'var(--green)'
                  : 'linear-gradient(to top, #FF6B2C, #FF9B72)',
                borderRadius: '4px 4px 0 0', minHeight: 6,
                transition: 'height 0.3s, background 0.15s', cursor: 'default',
              }} />
              <span style={{ fontSize: 10, color: 'var(--muted)', transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>
                {f.data}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Refresh button with spin animation ───────────────────────────────────────

function RefreshButton({ onClick, loading }) {
  return (
    <button
      className="btn btn-secondary"
      style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
      onClick={onClick}
      disabled={loading}
      title="Atualizar dashboard"
    >
      <span
        style={{
          display: 'inline-block',
          animation: loading ? 'spin 0.8s linear infinite' : 'none',
        }}
      >
        🔄
      </span>
      {loading ? 'Atualizando…' : 'Atualizar'}
    </button>
  )
}

// ── Rich alert item ───────────────────────────────────────────────────────────

function AlertItem({ alerta }) {
  const tb = TIPO_BADGE[alerta.tipo] || TIPO_BADGE.info
  const action = ALERT_ACTIONS[alerta.tipo]
  return (
    <li style={{
      display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
      background: 'var(--card2)', borderRadius: 8,
      borderLeft: `3px solid ${tb.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{tb.icon}</span>
        <span
          className="badge"
          style={{
            background: tb.color + '22', color: tb.color,
            border: `1px solid ${tb.color}44`, flexShrink: 0,
          }}
        >
          {tb.label}
        </span>
      </div>
      <span style={{ color: '#ddd', lineHeight: 1.4, fontSize: 13 }}>{alerta.msg}</span>
      {action && (
        <a
          href={action.href}
          style={{
            alignSelf: 'flex-start', fontSize: 12, color: tb.color, fontWeight: 700,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {action.label} →
        </a>
      )}
    </li>
  )
}

// ── News widget ───────────────────────────────────────────────────────────────

function NewsWidget({ noticias }) {
  if (!noticias?.length) return null

  const catColors = {
    evento: '#FF6B2C', resultado: '#FF6B2C', inscricao: '#FF9B72',
    geral: '#6b7280', comunicado: '#e05c5c',
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
        📰 Últimas Novidades
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {noticias.slice(0, 3).map((n, i) => {
          const cat = (n.categoria || 'geral').toLowerCase()
          const cor = catColors[cat] || '#6b7280'
          return (
            <li
              key={n.id ?? i}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '8px 10px', background: '#12283F55',
                borderRadius: 8, borderLeft: `3px solid ${cor}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="badge"
                  style={{
                    background: cor + '22', color: cor,
                    border: `1px solid ${cor}44`, fontSize: 10, textTransform: 'capitalize',
                  }}
                >
                  {n.categoria || 'Geral'}
                </span>
                {n.data_publicacao && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {new Date(n.data_publicacao).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.4 }}>
                {n.titulo}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPI({ label, value, icon, color, trend, sub }) {
  return (
    <div className="card kpi" style={{ borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#FF6B2C', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span style={{ color: trend.up ? '#FF6B2C' : '#e05c5c', fontWeight: 700 }}>
            {trend.up ? '↑' : '↓'} {trend.pct}%
          </span>
          <span style={{ color: 'var(--muted)' }}>vs ontem</span>
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginTop: -2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function EventDashboard() {
  const { toast } = useToast()
  const [info, setInfo] = useState(null)
  const [dash, setDash] = useState(null)
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get('/api/info'),
      api.get('/api/admin/dashboard'),
      api.get('/api/noticias?publicado=1&limit=3').catch(() => []),
      api.get('/api/mesas').catch(() => ({ fisicas: [], virtuais: [] })),
      api.get('/api/admin/metricas/operacional').catch(() => ({})),
    ])
      .then(([infoRes, dashRes, noticiasRes, mesasRes, metricasRes]) => {
        setInfo(infoRes)
        // Normaliza campos do dashboard para o formato esperado pelos KPIs
        const ind = dashRes?.indicadores || {}
        const metricas = metricasRes?.ok ? metricasRes : {}
        const fisicas = mesasRes?.fisicas || []
        const mesasOcupadas = fisicas.filter(m => m.status !== 'livre').length
        const totalMesas = fisicas.length
        const normalizado = {
          ...dashRes,
          indicadores: {
            ...ind,
            // Mapeia inscricoes → inscritos
            inscritos: ind.inscricoes ?? ind.atletas ?? 0,
            inscritos_ontem: null,
            // Fonte única de verdade: faturamento de comandas fechadas no período canônico.
            receita: metricas.faturamento?.total ?? ind.fatTotal ?? ind.faturamentoBar ?? ind.receitaPagamentos ?? 0,
            fatBar: metricas.faturamento?.total ?? ind.faturamentoBar ?? 0,
            fatLoja: ind.fatLoja ?? 0,
            fatInsc: ind.fatInsc ?? 0,
            receita_ontem: null,
            // Mesas em tempo real
            mesasOcupadas,
            totalMesas,
            mesasOcupadas_ontem: null,
            // Fonte única de verdade: mesma métrica consumida por BI e Relatórios.
            comandasAbertas: metricas.comandas?.abertas ?? ind.comandasAbertas ?? 0,
            estoqueSemEstoque: metricas.estoque?.semEstoque ?? 0,
            estoqueBaixo: metricas.estoque?.baixo ?? 0,
            comandasAbertas_ontem: null,
          },
          // Normaliza alertas (servidor usa nivel/txt, dashboard usa tipo/msg)
          alertas: (dashRes?.alertas || []).map(a => ({
            tipo: a.nivel === 'aten' ? 'pagamento' : a.nivel === 'info' ? 'info' : 'info',
            msg: a.txt || a.msg || '',
          })).filter(a => !a.msg.includes('Tudo em dia')),
          // Dados de faturamento para o gráfico
          faturamento: dashRes?.faturamento || [],
          // Pagamentos por meio
          pagamentos_meio: dashRes?.pagamentos_meio || {},
          // Próximos jogos
          proximos_jogos: dashRes?.proximos_jogos || [],
        }
        setDash(normalizado)
        setNoticias(Array.isArray(noticiasRes) ? noticiasRes : noticiasRes?.noticias ?? [])
        setLastUpdate(new Date())
      })
      .catch(() => toast('Erro ao carregar dashboard', 'error'))
      .finally(() => setLoading(false))
  }

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const maxFat = dash ? Math.max(...(dash.faturamento || []).map((f) => f.total), 1) : 1

  const paymentPie = useMemo(() => {
    if (!dash?.pagamentos_meio) return []
    const colors = { Pix: '#FF6B2C', Cartao: '#FF6B2C', Dinheiro: '#FF9B72', Outros: '#6b7280' }
    return Object.entries(dash.pagamentos_meio).map(([label, valor]) => ({
      label, valor, color: colors[label] || '#6b7280',
    }))
  }, [dash])

  const trend = (curr, prev) => {
    if (prev == null || prev === 0) return null
    const pct = ((curr - prev) / prev) * 100
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
  }

  // ── Skeleton layout while loading ──────────────────────────────────────────
  if (loading && !dash) {
    return (
      <div className="page">
        {/* Banner skeleton */}
        <div className="card" style={{ marginBottom: 24, height: 80, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ ...shimmerStyle, width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...shimmerStyle, height: 14, width: '40%' }} />
            <div style={{ ...shimmerStyle, height: 10, width: '25%' }} />
          </div>
        </div>

        <div style={{ ...shimmerStyle, height: 28, width: 160, marginBottom: 24, borderRadius: 8 }} />

        {/* KPI skeletons */}
        <div className="grid4" style={{ marginBottom: 32 }}>
          {[0, 1, 2, 3].map((i) => <SkeletonKPI key={i} />)}
        </div>

        {/* Chart skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 24 }}>
          <SkeletonBar />
          <SkeletonCard />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
          <SkeletonCard height={180} />
          <SkeletonCard height={180} />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Banner do evento */}
      {info && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #12283F 60%, #12283F)',
            borderLeft: '4px solid var(--green)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 32 }}>🎾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
              {info.evento || info.nome}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {info.nome} · v{info.versao}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <RefreshButton onClick={fetchData} loading={loading} />
            {lastUpdate && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Atualizado às{' '}
                {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      <h1 className="page-title">Dashboard</h1>

      {/* KPIs — Linha 1: operacional */}
      {dash?.indicadores && (
        <>
          <div className="grid4" style={{ marginBottom: 12 }}>
            <KPI
              label="Inscrições"
              value={dash.indicadores.inscritos ?? '—'}
              icon="🎾"
              color="var(--green)"
              trend={trend(dash.indicadores.inscritos, dash.indicadores.inscritos_ontem)}
            />
            <KPI
              label="Faturamento Total"
              value={fmtR(dash.indicadores.receita ?? 0)}
              icon="💰"
              color="#FF6B2C"
              trend={trend(dash.indicadores.receita, dash.indicadores.receita_ontem)}
              sub={[
                dash.indicadores.fatBar   > 0 && `Bar: ${fmtR(dash.indicadores.fatBar)}`,
                dash.indicadores.fatLoja  > 0 && `Loja: ${fmtR(dash.indicadores.fatLoja)}`,
                dash.indicadores.fatInsc  > 0 && `Inscrições: ${fmtR(dash.indicadores.fatInsc)}`,
              ].filter(Boolean).join('  ·  ')}
            />
            <KPI
              label="Mesas Ocupadas"
              value={
                dash.indicadores.mesasOcupadas != null
                  ? `${dash.indicadores.mesasOcupadas} / ${dash.indicadores.totalMesas}`
                  : '—'
              }
              icon="🍺"
              color="#FF6B2C"
              trend={trend(dash.indicadores.mesasOcupadas, dash.indicadores.mesasOcupadas_ontem)}
            />
            <KPI
              label="Comandas Abertas"
              value={dash.indicadores.comandasAbertas ?? '—'}
              icon="📋"
              color="#FF9B72"
              trend={trend(dash.indicadores.comandasAbertas, dash.indicadores.comandasAbertas_ontem)}
            />
          </div>
          {/* KPIs — Linha 2: estrutural */}
          <div className="grid4" style={{ marginBottom: 32 }}>
            <KPI
              label="Atletas Cadastrados"
              value={dash.indicadores.atletas ?? '—'}
              icon="👤"
              color="#FF9B72"
            />
            <KPI
              label="Sócios Ativos"
              value={dash.indicadores.socios ?? '—'}
              icon="🤝"
              color="#FF6B2C"
            />
            <KPI
              label="Torneios"
              value={dash.indicadores.torneios ?? '—'}
              icon="🏆"
              color="#FF6B2C"
            />
            <KPI
              label="Reservas Hoje"
              value={dash.indicadores.reservasHoje ?? '—'}
              icon="📅"
              color="var(--green)"
            />
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 24 }}>
        {/* Gráfico faturamento */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#fff' }}>
            Faturamento — últimos 7 dias
          </h2>
          <BarChart data={dash?.faturamento} maxVal={maxFat} />
        </div>

        {/* Alertas ricos */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
            ⚠️ Alertas em tempo real
          </h2>
          {dash?.alertas?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dash.alertas.map((a, i) => (
                <AlertItem key={i} alerta={a} />
              ))}
            </ul>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 0', gap: 8,
            }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <span style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                Nenhum alerta no momento
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {/* Distribuição por meio de pagamento */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
            Pagamentos por meio
          </h2>
          <PieChart data={paymentPie} />
        </div>

        {/* Próximos jogos */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
            🎾 Próximas partidas
          </h2>
          {dash?.proximos_jogos?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dash.proximos_jogos.slice(0, 3).map((j, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '8px 10px', background: '#12283F55',
                    borderRadius: 8, borderLeft: '3px solid var(--green)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {j.horario ? fmtDate(j.horario) : '—'} · {j.quadra || 'Quadra TBD'}
                  </span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                    {j.atleta1 || '?'} <span style={{ color: 'var(--muted)' }}>vs</span> {j.atleta2 || '?'}
                  </span>
                  {j.categoria && (
                    <span style={{ fontSize: 11, color: '#FF9B72' }}>{j.categoria}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 0', gap: 8,
            }}>
              <span style={{ fontSize: 28 }}>📅</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma partida agendada</span>
            </div>
          )}
        </div>
      </div>

      {/* Pendências + Novidades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {/* Pendências resumo */}
        {dash?.pendencias && (
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#fff' }}>⚡ Pendências</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Inscrições aguardando', val: dash.pendencias.inscPend, href: '/admin/inscricoes', cor: '#FF6B2C' },
                { label: 'Pagamentos pendentes', val: dash.pendencias.pagPend, href: '/admin/pagamentos', cor: '#e05c5c' },
                { label: 'Faturas sócios abertas', val: dash.pendencias.faturasAbertas, href: '/admin/socios', cor: '#FF6B2C' },
                { label: 'Placares não confirmados', val: dash.pendencias.placaresNaoConf, href: '/admin/agenda', cor: '#FF6B2C' },
                { label: 'Reservas hoje', val: dash.pendencias.reservasHoje, href: '/admin/agenda', cor: '#FF9B72' },
              ].map(({ label, val, href, cor }) => (
                <a key={label} href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: val > 0 ? cor + '11' : 'transparent', borderRadius: 8, border: `1px solid ${val > 0 ? cor + '44' : '#12283F'}` }}>
                  <span style={{ fontSize: 13, color: '#ccc' }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: val > 0 ? cor : 'var(--muted)' }}>{val ?? '—'}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Novidades do sistema */}
        {noticias.length > 0 ? (
          <NewsWidget noticias={noticias} />
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>📰 Novidades</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma notícia publicada.</p>
          </div>
        )}
      </div>

      {/* Links rápidos */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#fff' }}>
          Acesso Rápido
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', textDecoration: 'none',
                color: '#fff', fontSize: 13, fontWeight: 500,
                transition: 'border-color 0.2s, background 0.2s', border: '1px solid #12283F',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = '#1a3a2233' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#12283F'; e.currentTarget.style.background = '' }}
            >
              <span style={{ fontSize: 18 }}>{l.icon}</span>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}


// Abas do Central Dino alcançadas pelos atalhos do painel do negócio.
const DINO_TAB_AREA = {
  Agenda: 'operacao',
  'Caixa e fechamento': 'operacao',
  Clientes: 'relacionamento',
  'Estoque de revenda': 'catalogo',
  'Planos e assinaturas': 'catalogo',
  Relatórios: 'gestao',
}

export default function Dashboard() {
  const { empresaAtiva, lojaAtiva, user } = useAuth()
  const isDino = isDinoBrandContext(empresaAtiva, user?.empresaAtiva, user?.empresa, user?.tenant)
  const scopeKey = `${empresaAtiva?.id || 'empresa'}:${lojaAtiva?.id || 'todas'}`
  const navigate = useNavigate()
  const openDinoTab = (tab) => navigate(`/admin/barbearia-erp?area=${DINO_TAB_AREA[tab] || 'operacao'}&tab=${encodeURIComponent(tab)}`)
  return isDino ? <DinoBusinessDashboard key={scopeKey} onOpenTab={openDinoTab} /> : <EventDashboard />
}
