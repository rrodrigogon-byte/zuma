import { useState, useEffect, useRef } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

// ── Componentes de gráfico ───────────────────────────────────────────────────
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

// ── Linha do tempo simples (sparkline horizontal) ─────────────────────────────
function LineChart({ items, color = '#5FB335', valueKey = 'valor', labelKey = 'label', fmt = (v) => v }) {
  if (!items || items.length < 2) return null
  const max = Math.max(...items.map(i => i[valueKey]), 1)
  const W = 100, H = 50
  const points = items.map((item, i) => {
    const x = (i / (items.length - 1)) * W
    const y = H - (item[valueKey] / max) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, overflow: 'visible' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {items.map((item, i) => {
          const x = (i / (items.length - 1)) * W
          const y = H - (item[valueKey] / max) * H
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={2} fill={color} />
              <text x={x} y={H + 10} textAnchor="middle" fontSize="5" fill="var(--muted)">
                {item[labelKey]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Utilitário CSV ────────────────────────────────────────────────────────────
function exportCSV(rows, headers, filename) {
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      const v = r[h] ?? ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(';') || s.includes('\n') ? `"${s}"` : s
    }).join(';')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Página BI ────────────────────────────────────────────────────────────────
export default function BI() {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [periodoAtivo, setPeriodoAtivo] = useState('mes') // 'hoje'|'semana'|'mes'|'ano'
  const intervalRef = useRef(null)

  async function fetchData() {
    try {
      const bi = await api.get(`/api/analytics/resumo?periodo=${encodeURIComponent(periodoAtivo)}`)
      setData(bi)
      setDashData(null)
      setLastUpdate(new Date())
    } catch {
      toast('Erro ao carregar indicadores gerenciais', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [periodoAtivo])

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 30000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh])

  // ── Exportar CSV completo ──
  function handleExportCSV() {
    if (!data) return
    const op = data.operacao || {}
    const bm = data.benchmarks || {}
    const faturSerie = op.faturamentoSerie || []
    const dist = op.distribuicao || []
    const desp = op.despesasSerie || []

    if (faturSerie.length > 0) {
      exportCSV(
        faturSerie.map(r => ({ Período: r.data, 'Faturamento (R$)': r.faturamento })),
        ['Período', 'Faturamento (R$)'],
        'bi_faturamento_serie.csv'
      )
    }
    if (dist.length > 0) {
      setTimeout(() => {
        exportCSV(
          dist.map(r => ({ Produto: r.nome, 'Valor (R$)': r.valor })),
          ['Produto', 'Valor (R$)'],
          'bi_distribuicao_receita.csv'
        )
      }, 300)
    }
    toast('CSV exportado com sucesso!')
  }

  const S = {
    page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
    btnGroup: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    btnSm: (active) => ({
      padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)',
      background: active ? 'var(--green)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--muted)',
      cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
      transition: 'all .15s',
    }),
    lastUpdate: { fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 8 },
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
  const faturamentoSerie = op.faturamentoSerie || []
  const despesasSerie = op.despesasSerie || []
  const estoque = data.estoque || {}
  const pedidos = data.pedidos || {}
  const fiscal = data.fiscal || {}
  const previsao = data.previsao?.proximosSeteDias || []
  const demandaProdutos = data.previsao?.demandaProdutos || []
  const alertas = data.alertas || []

  // KPIs extras do dashboard
  const dash = dashData || {}
  const ind = dash.indicadores || {}
  const reservasHoje = ind.reservasHoje ?? ind.reservas ?? null
  const comandasAbertas = ind.comandasAbertas ?? ind.mesas ?? null

  return (
    <div style={S.page}>
      {/* Header com controles */}
      <div style={S.headerRow}>
        <h1 style={S.h1}>📉 Business Intelligence</h1>
        <div style={S.btnGroup}>
          {lastUpdate && (
            <span style={S.lastUpdate}>
              atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button style={S.btnSm(autoRefresh)} onClick={() => setAutoRefresh(a => !a)}>
            {autoRefresh ? '⏸ Auto' : '▶ Auto'}
          </button>
          <button style={S.btnSm(false)} onClick={fetchData}>🔄 Atualizar</button>
          <button style={{ ...S.btnSm(false), background: '#0E2E1C', color: '#8FD64A', borderColor: '#5FB335' }}
            onClick={handleExportCSV}>⬇ CSV</button>
        </div>
      </div>

      {/* Filtro de período */}
      <div style={{ display:'flex', gap:6, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>Período:</span>
        {[
          { key:'hoje', label:'Hoje' },
          { key:'semana', label:'7 dias' },
          { key:'mes', label:'30 dias' },
          { key:'ano', label:'12 meses' },
        ].map(p => (
          <button key={p.key} onClick={() => setPeriodoAtivo(p.key)} style={{
            padding:'4px 14px', borderRadius:20, border:`1.5px solid ${periodoAtivo===p.key ? 'var(--green)' : 'var(--line)'}`,
            background: periodoAtivo===p.key ? 'rgba(95,179,53,.15)' : 'transparent',
            color: periodoAtivo===p.key ? 'var(--green)' : 'var(--muted)',
            cursor:'pointer', fontSize:12, fontWeight:700,
          }}>{p.label}</button>
        ))}
        <span style={{ fontSize:11, color:'var(--muted)', marginLeft:6 }}>
          {periodoAtivo==='hoje' ? 'Dados do dia atual' : periodoAtivo==='semana' ? 'Últimos 7 dias' : periodoAtivo==='mes' ? 'Últimos 30 dias' : 'Últimos 12 meses'}
        </span>
      </div>

      {/* KPIs principais */}
      <div style={S.kpiRow}>
        <div style={S.kpi('#5FB335')}>
          <div style={S.kpiLabel}>Faturamento</div>
          <div style={S.kpiValue('#5FB335')}>{fmtR(op.faturamento ?? 0)}</div>
          {op.faturamentoPeriodoAnterior != null && (
            <div style={S.muted}>período anterior: {fmtR(op.faturamentoPeriodoAnterior)} · {op.variacaoFaturamentoPercentual >= 0 ? '▲' : '▼'} {Math.abs(op.variacaoFaturamentoPercentual || 0).toFixed(1)}%</div>
          )}
        </div>
        <div style={S.kpi('#C9A656')}>
          <div style={S.kpiLabel}>Ticket Médio</div>
          <div style={S.kpiValue('#C9A656')}>{fmtR(op.ticketMedio ?? 0)}</div>
          {op.ticketMedioPeriodoAnterior != null && (
            <div style={S.muted}>período anterior: {fmtR(op.ticketMedioPeriodoAnterior)} · {op.variacaoTicketMedioPercentual >= 0 ? '▲' : '▼'} {Math.abs(op.variacaoTicketMedioPercentual || 0).toFixed(1)}%</div>
          )}
        </div>
        <div style={S.kpi('#8FD64A')}>
          <div style={S.kpiLabel}>Margem Bruta</div>
          <div style={S.kpiValue('#8FD64A')}>{(op.margemBrutaPercentual ?? 0).toFixed(1)}%</div>
          <div style={S.muted}>resultado bruto: {fmtR(op.margemBruta ?? 0)}</div>
        </div>
        {op.numeroVendas != null && (
          <div style={S.kpi('#0E2E1C')}>
            <div style={S.kpiLabel}>Transações</div>
                          <div style={S.kpiValue('#5FB335')}>{op.numeroVendas.toLocaleString('pt-BR')}</div>

          </div>
        )}
      </div>

      {/* KPIs extras — reservas e comandas (vêm do endpoint de dashboard) */}
      {(reservasHoje != null || comandasAbertas != null) && (
        <div style={S.kpiRow}>
          {reservasHoje != null && (
            <div style={S.kpi('#5FB335')}>
              <div style={S.kpiLabel}>Reservas Hoje</div>
              <div style={S.kpiValue('#5FB335')}>{reservasHoje}</div>
              <div style={S.muted}>quadras reservadas</div>
            </div>
          )}
          {comandasAbertas != null && (
            <div style={S.kpi('#C9A656')}>
              <div style={S.kpiLabel}>Comandas Abertas</div>
              <div style={S.kpiValue('#C9A656')}>{comandasAbertas}</div>
              <div style={S.muted}>mesas / comandas ativas</div>
            </div>
          )}
          {ind.atletas != null && (
            <div style={S.kpi('#8FD64A')}>
              <div style={S.kpiLabel}>Atletas</div>
              <div style={S.kpiValue('#8FD64A')}>{ind.atletas}</div>
              <div style={S.muted}>inscritos na plataforma</div>
            </div>
          )}
          {ind.inscricoes != null && (
            <div style={S.kpi('#0E2E1C')}>
              <div style={S.kpiLabel}>Inscrições</div>
              <div style={S.kpiValue('#5FB335')}>{ind.inscricoes}</div>
              <div style={S.muted}>no torneio atual</div>
            </div>
          )}
        </div>
      )}

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

        {/* Evolução do faturamento — linha do tempo */}
        {faturamentoSerie.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              <span style={S.dot('#5FB335')} />
              Evolução do Faturamento
            </div>
            <LineChart items={faturamentoSerie} color="#5FB335" valueKey="faturamento" labelKey="data" fmt={fmtR} />
            <div style={{ marginTop: 12 }}>
              <BarChart items={faturamentoSerie} color="#5FB335" valueKey="faturamento" labelKey="data" fmt={fmtR} />
            </div>
          </div>
        )}

        {/* Distribuição de receita */}
        {op.distribuicao && op.distribuicao.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              <span style={S.dot('#8FD64A')} />
              Distribuição de Receita
            </div>
            <BarChart items={op.distribuicao} color="#8FD64A" valueKey="valor" labelKey="nome" fmt={fmtR} />
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

      {/* Operação, previsão e alertas derivados dos dados reais da loja */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}><span style={S.dot('#C9A656')} />Operação Omnichannel</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div><div style={S.kpiLabel}>Pedidos abertos</div><div style={S.kpiValue('#C9A656')}>{pedidos.abertos ?? 0}</div></div>
            <div><div style={S.kpiLabel}>Em preparo</div><div style={S.kpiValue('#5FB335')}>{pedidos.emPreparo ?? 0}</div></div>
            <div><div style={S.kpiLabel}>Tempo médio</div><div style={{ ...S.kpiValue('#0E2E1C'), fontSize: '1.25rem' }}>{(pedidos.tempoMedioConclusaoMinutos ?? 0).toFixed(1)} min</div></div>
            <div><div style={S.kpiLabel}>Cancelados</div><div style={{ ...S.kpiValue('#e05c5c'), fontSize: '1.25rem' }}>{pedidos.canceladosPeriodo ?? 0}</div></div>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}><span style={S.dot('#8FD64A')} />Estoque e Fiscal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div><div style={S.kpiLabel}>Sem estoque</div><div style={{ ...S.kpiValue('#e05c5c'), fontSize: '1.25rem' }}>{estoque.semEstoque ?? 0}</div></div>
            <div><div style={S.kpiLabel}>No mínimo</div><div style={{ ...S.kpiValue('#C9A656'), fontSize: '1.25rem' }}>{estoque.estoqueCritico ?? 0}</div></div>
            <div><div style={S.kpiLabel}>Fiscal em contingência</div><div style={{ ...S.kpiValue('#e05c5c'), fontSize: '1.25rem' }}>{fiscal.documentosContingencia ?? 0}</div></div>
            <div><div style={S.kpiLabel}>Fiscal com erro</div><div style={{ ...S.kpiValue('#e05c5c'), fontSize: '1.25rem' }}>{fiscal.documentosComErro ?? 0}</div></div>
          </div>
        </div>
      </div>

      {(previsao.length > 0 || demandaProdutos.length > 0) && (
        <div style={{ ...S.grid2, marginBottom: '1rem' }}>
          {previsao.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}><span style={S.dot('#5FB335')} />Previsão de Faturamento — Próximos 7 Dias</div>
              <LineChart items={previsao} color="#C9A656" valueKey="faturamento_previsto" labelKey="data" fmt={fmtR} />
              <p style={{ ...S.muted, marginTop: 10 }}>Média móvel ponderada com tendência linear, calculada exclusivamente do histórico fechado da loja.</p>
            </div>
          )}
          {demandaProdutos.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}><span style={S.dot('#C9A656')} />Demanda Estimada por Produto — 7 Dias</div>
              <BarChart
                items={demandaProdutos}
                color="#C9A656"
                valueKey="demanda_prevista_7_dias"
                labelKey="nome"
                fmt={(valor) => `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un.`}
              />
              <p style={{ ...S.muted, marginTop: 10 }}>Use como apoio à reposição; valide estoque físico, sazonalidade e promoções antes de comprar.</p>
            </div>
          )}
        </div>
      )}

      {alertas.length > 0 && (
        <div style={{ ...S.card, marginBottom: '1rem' }}>
          <div style={S.cardTitle}><span style={S.dot('#e05c5c')} />Alertas Operacionais</div>
          <div style={{ display: 'grid', gap: 9 }}>
            {alertas.map((alerta, indice) => (
              <div key={`${alerta.categoria}-${indice}`} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: alerta.severidade === 'critica' ? 'rgba(224,92,92,.10)' : 'var(--surface2)' }}>
                <strong style={{ color: alerta.severidade === 'critica' || alerta.severidade === 'alta' ? '#e05c5c' : '#C9A656', fontSize: '0.82rem', textTransform: 'uppercase' }}>{alerta.categoria}</strong>
                <div style={{ marginTop: 3, color: 'var(--fg)', fontSize: '0.86rem' }}>{alerta.mensagem}</div>
                <div style={{ ...S.muted, marginTop: 3 }}>{alerta.acao}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicadores adicionais (NPS, Churn, LTV) */}
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

      <p style={S.muted}>
        {autoRefresh ? '🔄 Auto-refresh ativo — dados atualizados a cada 30s.' : '⏸ Auto-refresh pausado.'}{' '}
        Clique em "Atualizar" para forçar recarga manual. Clique em "CSV" para exportar os dados.
      </p>
    </div>
  )
}
