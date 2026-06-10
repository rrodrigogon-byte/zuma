import { useState, useEffect } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const SEG_COLOR = ['#5FB335', '#C9A656', '#8FD64A', '#e05c5c', '#888', '#0E2E1C']

export default function CRM() {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/crm')
      .then(setData)
      .catch(() => toast('Erro ao carregar CRM', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const S = {
    page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: '0 0 1.5rem 0' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' },
    kpiCard: (color) => ({
      background: 'var(--surface)',
      border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '1rem 1.25rem',
    }),
    kpiLabel: { color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
    kpiValue: (color) => ({ color, fontSize: '2rem', fontWeight: 800, lineHeight: 1.1, margin: '0.3rem 0 0' }),
    section: { marginBottom: '2rem' },
    h2: { color: 'var(--fg)', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 },
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
    bar: (pct, color) => ({
      height: 6, borderRadius: 3,
      background: `linear-gradient(90deg, ${color} ${pct}%, var(--border) ${pct}%)`,
      marginTop: 4,
    }),
    badge: (color) => ({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 12, background: color + '22', color, fontSize: '0.75rem', fontWeight: 700 }),
    empty: { color: 'var(--muted)', fontSize: '0.9rem', padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 8 },
  }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!data) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Sem dados disponíveis.</p></div>

  const { totais = {}, segmentos = [] } = data
  const maxQtd = Math.max(...segmentos.map(s => s.qtd), 1)

  return (
    <div style={S.page}>
      <h1 style={S.h1}>CRM — Base de Clientes</h1>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#5FB335')}>
          <div style={S.kpiLabel}>Total de Clientes</div>
          <div style={S.kpiValue('#5FB335')}>{(totais.clientes ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        <div style={S.kpiCard('#C9A656')}>
          <div style={S.kpiLabel}>Clientes Ativos</div>
          <div style={S.kpiValue('#C9A656')}>{(totais.ativos ?? 0).toLocaleString('pt-BR')}</div>
          {totais.clientes > 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
              {((totais.ativos / totais.clientes) * 100).toFixed(0)}% da base
            </div>
          )}
        </div>
        <div style={S.kpiCard('#8FD64A')}>
          <div style={S.kpiLabel}>Novos (30 dias)</div>
          <div style={S.kpiValue('#8FD64A')}>{(totais.novos ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        {totais.ticketMedio != null && (
          <div style={S.kpiCard('#0E2E1C')}>
            <div style={S.kpiLabel}>Ticket Médio</div>
            <div style={S.kpiValue('#5FB335')}>{fmtR(totais.ticketMedio)}</div>
          </div>
        )}
      </div>

      {/* Segmentos */}
      <div style={S.section}>
        <h2 style={S.h2}>
          <span style={{ background: '#5FB335', borderRadius: 4, width: 4, height: 18, display: 'inline-block' }} />
          Segmentação de Clientes
        </h2>
        {segmentos.length === 0 ? (
          <div style={S.empty}>Sem dados de segmentação disponíveis.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                {['Segmento', 'Clientes', 'Participação', 'Valor Médio'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segmentos.map((seg, i) => {
                const color = SEG_COLOR[i % SEG_COLOR.length]
                const pct = totais.clientes > 0 ? ((seg.qtd / totais.clientes) * 100).toFixed(1) : 0
                return (
                  <tr key={seg.nome}>
                    <td style={S.td}>
                      <span style={S.badge(color)}>{seg.nome}</span>
                    </td>
                    <td style={S.td}><strong>{seg.qtd.toLocaleString('pt-BR')}</strong></td>
                    <td style={{ ...S.td, minWidth: 140 }}>
                      <span style={{ fontSize: '0.85rem' }}>{pct}%</span>
                      <div style={S.bar(parseFloat(pct), color)} />
                    </td>
                    <td style={S.td}>
                      {seg.valorMedio != null ? fmtR(seg.valorMedio) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
        Dados consolidados em tempo real. Atualizar a página para recarregar.
      </p>
    </div>
  )
}
