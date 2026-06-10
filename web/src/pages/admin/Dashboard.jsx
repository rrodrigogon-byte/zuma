import { useState, useEffect } from 'react'
import { api, fmtR } from '../../lib/api'
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
}

export default function Dashboard() {
  const { toast } = useToast()
  const [info, setInfo] = useState(null)
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/api/info'), api.get('/api/admin/dashboard')])
      .then(([infoRes, dashRes]) => {
        setInfo(infoRes)
        setDash(dashRes)
      })
      .catch(() => toast('Erro ao carregar dashboard', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const maxFat = dash
    ? Math.max(...(dash.faturamento || []).map((f) => f.total), 1)
    : 1

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
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
              {info.evento || info.nome}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {info.nome} · v{info.versao}
            </div>
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
          />
          <KPI
            label="Receita do Dia"
            value={fmtR(dash.indicadores.receita ?? 0)}
            icon="💰"
            color="#C9A656"
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
          />
          <KPI
            label="Comandas Abertas"
            value={dash.indicadores.comandasAbertas ?? '—'}
            icon="📋"
            color="#8FD64A"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Gráfico faturamento */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#fff' }}>
            Faturamento — últimos 7 dias
          </h2>
          {dash?.faturamento?.length ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                height: 160,
              }}
            >
              {dash.faturamento.map((f) => {
                const pct = maxFat > 0 ? (f.total / maxFat) * 100 : 0
                return (
                  <div
                    key={f.data}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtR(f.total)}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(pct, 4)}%`,
                        background:
                          pct === 100
                            ? 'var(--green)'
                            : 'linear-gradient(to top, #5FB335, #8FD64A)',
                        borderRadius: '4px 4px 0 0',
                        minHeight: 6,
                        transition: 'height 0.3s',
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
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem dados de faturamento.</p>
          )}
        </div>

        {/* Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
              Alertas
            </h2>
            {dash?.alertas?.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dash.alertas.map((a, i) => {
                  const tb = TIPO_BADGE[a.tipo] || TIPO_BADGE.info
                  return (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
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
      </div>

      {/* Links rápidos */}
      <div style={{ marginTop: 28 }}>
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

function KPI({ label, value, icon, color }) {
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
    </div>
  )
}
