import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const LINKS = [
  { label: 'Atletas', href: '/admin/atletas', icon: '🎾' },
  { label: 'Chaves', href: '/admin/chaves', icon: '🏆' },
  { label: 'PDV / Comandas', href: '/admin/pdv', icon: '🍺' },
  { label: 'Cardápio', href: '/admin/cardapio', icon: '🍽️' },
  { label: 'Usuários', href: '/admin/usuarios', icon: '👤' },
  { label: 'Financeiro', href: '/admin/financeiro', icon: '💰' },
]

const TIPO_BADGE = {
  estoque: { label: 'Estoque', color: '#C9A656' },
  pagamento: { label: 'Pagamento', color: '#e05c5c' },
  info: { label: 'Info', color: '#5FB335' },
  mesa: { label: 'Mesa', color: '#8FD64A' },
}

// CSS-pure pie chart using conic-gradient
function PieChart({ data }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados.</p>
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
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: `conic-gradient(${gradient})`,
          flexShrink: 0,
          boxShadow: '0 0 0 4px #0E2E1C',
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

// Bar chart with tooltip on hover
function BarChart({ data, maxVal }) {
  const [hovered, setHovered] = useState(null)
  if (!data?.length) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados de faturamento.</p>

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
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0E2E1C',
                    border: '1px solid var(--green)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    pointerEvents: 'none',
                    marginBottom: 4,
                  }}
                >
                  {fmtR(f.total)}
                </div>
              )}
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(pct, 4)}%`,
                  background: isHov
                    ? 'linear-gradient(to top, #C9A656, #e8c97a)'
                    : pct === 100
                    ? 'var(--green)'
                    : 'linear-gradient(to top, #5FB335, #8FD64A)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: 6,
                  transition: 'height 0.3s, background 0.15s',
                  cursor: 'default',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--muted)',
                  transform: 'rotate(-30deg)',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.data}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { toast } = useToast()
  const [info, setInfo] = useState(null)
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([api.get('/api/info'), api.get('/api/admin/dashboard')])
      .then(([infoRes, dashRes]) => {
        setInfo(infoRes)
        setDash(dashRes)
        setLastUpdate(new Date())
      })
      .catch(() => toast('Erro ao carregar dashboard', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const maxFat = dash ? Math.max(...(dash.faturamento || []).map((f) => f.total), 1) : 1

  // Build payment distribution data for pie chart
  const paymentPie = useMemo(() => {
    if (!dash?.pagamentos_meio) return []
    const colors = { Pix: '#5FB335', Cartao: '#C9A656', Dinheiro: '#8FD64A', Outros: '#6b7280' }
    return Object.entries(dash.pagamentos_meio).map(([label, valor]) => ({
      label,
      valor,
      color: colors[label] || '#6b7280',
    }))
  }, [dash])

  // KPI trending helper
  const trend = (curr, prev) => {
    if (prev == null || prev === 0) return null
    const pct = ((curr - prev) / prev) * 100
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
  }

  if (loading) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Banner do evento */}
      {info && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #0E2E1C 60%, #1a4228)',
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
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={fetchData}
              disabled={loading}
            >
              🔄 Atualizar
            </button>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      <h1 className="page-title">Dashboard</h1>

      {/* KPIs */}
      {dash?.indicadores && (
        <div className="grid4" style={{ marginBottom: 32 }}>
          <KPI
            label="Inscritos"
            value={dash.indicadores.inscritos ?? '—'}
            icon="🎾"
            color="var(--green)"
            trend={trend(dash.indicadores.inscritos, dash.indicadores.inscritos_ontem)}
          />
          <KPI
            label="Receita do Dia"
            value={fmtR(dash.indicadores.receita ?? 0)}
            icon="💰"
            color="#C9A656"
            trend={trend(dash.indicadores.receita, dash.indicadores.receita_ontem)}
          />
          <KPI
            label="Mesas Ocupadas"
            value={
              dash.indicadores.mesasOcupadas != null
                ? `${dash.indicadores.mesasOcupadas} / ${dash.indicadores.totalMesas}`
                : '—'
            }
            icon="🍺"
            color="#5FB335"
            trend={trend(dash.indicadores.mesasOcupadas, dash.indicadores.mesasOcupadas_ontem)}
          />
          <KPI
            label="Comandas Abertas"
            value={dash.indicadores.comandasAbertas ?? '—'}
            icon="📋"
            color="#8FD64A"
            trend={trend(dash.indicadores.comandasAbertas, dash.indicadores.comandasAbertas_ontem)}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 24 }}>
        {/* Gráfico faturamento */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#fff' }}>
            Faturamento — últimos 7 dias
          </h2>
          <BarChart data={dash?.faturamento} maxVal={maxFat} />
        </div>

        {/* Alertas em tempo real */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
            ⚠️ Alertas em tempo real
          </h2>
          {dash?.alertas?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dash.alertas.map((a, i) => {
                const tb = TIPO_BADGE[a.tipo] || TIPO_BADGE.info
                return (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                    <span
                      className="badge"
                      style={{
                        background: tb.color + '22',
                        color: tb.color,
                        border: `1px solid ${tb.color}44`,
                        flexShrink: 0,
                      }}
                    >
                      {tb.label}
                    </span>
                    <span style={{ color: '#ddd', lineHeight: 1.4 }}>{a.msg}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum alerta. ✅</p>
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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '8px 10px',
                    background: '#0E2E1C55',
                    borderRadius: 8,
                    borderLeft: '3px solid var(--green)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {j.horario ? fmtDate(j.horario) : '—'} · {j.quadra || 'Quadra TBD'}
                  </span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                    {j.atleta1 || '?'} <span style={{ color: 'var(--muted)' }}>vs</span> {j.atleta2 || '?'}
                  </span>
                  {j.categoria && (
                    <span style={{ fontSize: 11, color: '#8FD64A' }}>{j.categoria}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma partida agendada.</p>
          )}
        </div>
      </div>

      {/* Links rápidos */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#fff' }}>
          Acesso Rápido
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                textDecoration: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                transition: 'border-color 0.2s',
                border: '1px solid #1e4a2e',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--green)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e4a2e')}
            >
              <span style={{ fontSize: 20 }}>{l.icon}</span>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, icon, color, trend }) {
  return (
    <div
      className="card kpi"
      style={{ borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span style={{ color: trend.up ? '#5FB335' : '#e05c5c', fontWeight: 700 }}>
            {trend.up ? '↑' : '↓'} {trend.pct}%
          </span>
          <span style={{ color: 'var(--muted)' }}>vs ontem</span>
        </div>
      )}
    </div>
  )
}
