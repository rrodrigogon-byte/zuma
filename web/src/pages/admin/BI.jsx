import { useState, useEffect } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function BarChart({ items, color = '#5FB335', valueKey = 'valor', labelKey = 'label', fmt = (v) => v }) {
  const max = Math.max(...items.map(i => i[valueKey]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const pct = (item[valueKey] / max) * 100
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 110, color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'right', flexShrink: 0 }}>
              {item[labelKey]}
            </div>
            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, height: 22, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`, background: color, borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
              <span style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.78rem', fontWeight: 600, color: pct > 30 ? '#fff' : 'var(--fg)',
              }}>
                {fmt(item[valueKey])}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GaugeBar({ label, atual, benchmark, color = '#5FB335' }) {
  const max = Math.max(atual, benchmark, 1)
  const pctAtual = (atual / max) * 100
  const pctBench = (benchmark / max) * 100
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>benchmark: {fmtR(benchmark)}</span>
      </div>
      <div style={{ background: 'var(--surface2)', borderRadius: 6, height: 26, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pctAtual}%`, background: color, borderRadius: 6,
          transition: 'width 0.4s ease',
        }} />
        {/* benchmark marker */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${pctBench}%`, width: 2, background: '#C9A656',
        }} />
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: '0.82rem', fontWeight: 700, color: pctAtual > 30 ? '#fff' : 'var(--fg)',
        }}>
          {fmtR(atual)}
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
        {atual >= benchmark
          ? <span style={{ color: '#5FB335' }}>▲ acima do benchmark</span>
          : <span style={{ color: '#e05c5c' }}>▼ abaixo do benchmark</span>
        }
      </div>
    </div>
  )
}

export default function BI() {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/bi')
      .then(setData)
      .catch(() => toast('Erro ao carregar BI', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const S = {
    page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: '0 0 1.5rem 0' },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: '2rem' },
    card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' },
    cardTitle: { color: 'var(--fg)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 },
    dot: (color) => ({ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }),
    kpiRow: { display: 'flex', gap: 16, marginBottom: '1.5rem', flexWrap: 'wrap' },
    kpi: (color) => ({
      flex: 1, minWidth: 140,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderTop: `3px solid ${color}`, borderRadius: 8, padding: '0.9rem 1rem',
    }),
    kpiLabel: { color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' },
    kpiValue: (color) => ({ color, fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }),
    muted: { color: 'var(--muted)', fontSize: '0.78rem' },
  }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!data) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Sem dados disponíveis.</p></div>

  const op = data.operacao || {}
  const bm = data.benchmarks || {}

  // Normalizar dados de séries temporais
  const faturamentoSerie = op.faturamentoSerie || []
  const despesasSerie = op.despesasSerie || []

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Business Intelligence</h1>

      {/* KPIs principais */}
      <div style={S.kpiRow}>
        <div style={S.kpi('#5FB335')}>
          <div style={S.kpiLabel}>Faturamento</div>
          <div style={S.kpiValue('#5FB335')}>{fmtR(op.faturamento ?? 0)}</div>
          {op.faturamentoMesAnterior != null && (
            <div style={S.muted}>mês anterior: {fmtR(op.faturamentoMesAnterior)}</div>
          )}
        </div>
        <div style={S.kpi('#C9A656')}>
          <div style={S.kpiLabel}>Ticket Médio</div>
          <div style={S.kpiValue('#C9A656')}>{fmtR(op.ticketMedio ?? 0)}</div>
          {bm.ticketMedio != null && (
            <div style={S.muted}>benchmark: {fmtR(bm.ticketMedio)}</div>
          )}
        </div>
        <div style={S.kpi('#8FD64A')}>
          <div style={S.kpiLabel}>Margem Bruta</div>
          <div style={S.kpiValue('#8FD64A')}>{((op.margemBruta ?? 0) * 100).toFixed(1)}%</div>
          {bm.margemBruta != null && (
            <div style={S.muted}>benchmark: {(bm.margemBruta * 100).toFixed(1)}%</div>
          )}
        </div>
        {op.nTransacoes != null && (
          <div style={S.kpi('#0E2E1C')}>
            <div style={S.kpiLabel}>Transações</div>
            <div style={S.kpiValue('#5FB335')}>{op.nTransacoes.toLocaleString('pt-BR')}</div>
          </div>
        )}
      </div>

      <div style={S.grid2}>
        {/* Comparativo com benchmarks */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span style={S.dot('#C9A656')} />
            Comparativo com Benchmarks
          </div>
          {op.faturamento != null && bm.faturamento != null && (
            <GaugeBar label="Faturamento" atual={op.faturamento} benchmark={bm.faturamento} color="#5FB335" />
          )}
          {op.ticketMedio != null && bm.ticketMedio != null && (
            <GaugeBar label="Ticket Médio" atual={op.ticketMedio} benchmark={bm.ticketMedio} color="#C9A656" />
          )}
          {op.receitaRecorrente != null && bm.receitaRecorrente != null && (
            <GaugeBar label="Receita Recorrente" atual={op.receitaRecorrente} benchmark={bm.receitaRecorrente} color="#8FD64A" />
          )}
          {op.custoAquisicao != null && bm.custoAquisicao != null && (
            <GaugeBar label="Custo de Aquisição" atual={op.custoAquisicao} benchmark={bm.custoAquisicao} color="#e05c5c" />
          )}
          <p style={{ ...S.muted, marginTop: 8 }}>
            Linha amarela = benchmark do setor. Barra colorida = valor atual.
          </p>
        </div>

        {/* Faturamento por período */}
        {faturamentoSerie.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              <span style={S.dot('#5FB335')} />
              Faturamento por Período
            </div>
            <BarChart items={faturamentoSerie} color="#5FB335" valueKey="valor" labelKey="label" fmt={fmtR} />
          </div>
        )}

        {/* Distribuição de receita */}
        {op.distribuicao && op.distribuicao.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              <span style={S.dot('#8FD64A')} />
              Distribuição de Receita
            </div>
            <BarChart items={op.distribuicao} color="#8FD64A" valueKey="valor" labelKey="categoria" fmt={fmtR} />
          </div>
        )}

        {/* Despesas por categoria */}
        {despesasSerie.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              <span style={S.dot('#e05c5c')} />
              Despesas por Categoria
            </div>
            <BarChart items={despesasSerie} color="#e05c5c" valueKey="valor" labelKey="label" fmt={fmtR} />
          </div>
        )}
      </div>

      {/* Indicadores adicionais */}
      {(op.nps != null || op.churnRate != null || op.ltv != null) && (
        <div style={{ ...S.card, marginBottom: '1rem' }}>
          <div style={S.cardTitle}>
            <span style={S.dot('#C9A656')} />
            Indicadores Adicionais
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {op.nps != null && (
              <div>
                <div style={S.kpiLabel}>NPS</div>
                <div style={{ ...S.kpiValue(op.nps >= 50 ? '#5FB335' : op.nps >= 0 ? '#C9A656' : '#e05c5c'), fontSize: '1.4rem' }}>{op.nps}</div>
              </div>
            )}
            {op.churnRate != null && (
              <div>
                <div style={S.kpiLabel}>Churn Rate</div>
                <div style={{ ...S.kpiValue('#e05c5c'), fontSize: '1.4rem' }}>{(op.churnRate * 100).toFixed(1)}%</div>
              </div>
            )}
            {op.ltv != null && (
              <div>
                <div style={S.kpiLabel}>LTV</div>
                <div style={{ ...S.kpiValue('#8FD64A'), fontSize: '1.4rem' }}>{fmtR(op.ltv)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <p style={S.muted}>Dados consolidados em tempo real. Atualizar a página para recarregar.</p>
    </div>
  )
}
