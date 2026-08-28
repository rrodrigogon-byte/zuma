/**
 * BI Dashboard Completo — KYTTO Clube
 * DRE, Curva ABC, Fluxo de Caixa, KPIs por Segmento, Ranking Vendedores
 * Rota: /admin/bi-erp
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

const T = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#FF6B2C', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff',
  purple: '#9b59b6',
}

const fmtR = (v) => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN = (v) => parseFloat(v || 0).toLocaleString('pt-BR')
const fmtPct = (v) => `${parseFloat(v || 0).toFixed(1)}%`

// ─── Componentes de gráfico ───────────────────────────────────────────────────

function BarH({ items = [], colorKey, labelKey = 'label', valueKey = 'valor', fmt = fmtR, maxItems = 10 }) {
  const data = items.slice(0, maxItems)
  const max = Math.max(...data.map(i => parseFloat(i[valueKey]) || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.map((item, i) => {
        const pct = (parseFloat(item[valueKey]) / max) * 100
        const cor = item[colorKey] || T.green
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 120, color: T.muted, fontSize: 11, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item[labelKey]}
            </div>
            <div style={{ flex: 1, background: T.surface, borderRadius: 4, height: 22, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: cor, borderRadius: 4, transition: 'width .5s ease' }} />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: pct > 25 ? '#fff' : T.cream }}>
                {fmt(item[valueKey])}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LineSparkline({ data = [], color = T.green, height = 60 }) {
  if (data.length < 2) return <div style={{ height, background: T.surface, borderRadius: 8 }} />
  const W = 400, H = height
  const vals = data.map(d => parseFloat(d.valor) || 0)
  const min = Math.min(...vals)
  const max = Math.max(...vals, min + 1)
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / (max - min)) * (H - 10) - 5
    return `${x},${y}`
  }).join(' ')
  const area = `0,${H} ${pts} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * W
        const y = H - ((v - min) / (max - min)) * (H - 10) - 5
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
      })}
    </svg>
  )
}

function DonutChart({ items = [], size = 120 }) {
  const total = items.reduce((s, i) => s + parseFloat(i.valor || 0), 0)
  if (!total) return null
  const R = 40, cx = size / 2, cy = size / 2
  let angle = -90
  const slices = items.map(item => {
    const pct = parseFloat(item.valor) / total
    const start = angle
    angle += pct * 360
    return { ...item, pct, startAngle: start, endAngle: angle }
  })

  function arcPath(startDeg, endDeg) {
    const toRad = d => (d * Math.PI) / 180
    const x1 = cx + R * Math.cos(toRad(startDeg))
    const y1 = cy + R * Math.sin(toRad(startDeg))
    const x2 = cx + R * Math.cos(toRad(endDeg))
    const y2 = cy + R * Math.sin(toRad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => (
          <path key={i} d={arcPath(s.startAngle, s.endAngle)} fill={s.cor || T.green} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={R * 0.55} fill={T.card} />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.cor || T.green, flexShrink: 0 }} />
            <span style={{ color: T.muted }}>{item.label}</span>
            <span style={{ fontWeight: 700, marginLeft: 4 }}>{fmtPct((parseFloat(item.valor) / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KPICard({ label, valor, variacao, icon, cor = T.green, fmt = fmtR }) {
  const positivo = parseFloat(variacao) >= 0
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
        <div style={{ fontSize: 20 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: cor, marginBottom: 4 }}>{fmt(valor)}</div>
      {variacao !== undefined && (
        <div style={{ fontSize: 11, color: positivo ? T.green : T.red, fontWeight: 700 }}>
          {positivo ? '▲' : '▼'} {Math.abs(parseFloat(variacao)).toFixed(1)}% vs mês anterior
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
const ABAS = ['Visão Geral', 'DRE', 'Fluxo de Caixa', 'Curva ABC', 'Vendedores', 'Segmentos']

export default function BIDashboard() {
  const [aba, setAba] = useState(0)
  const [periodo, setPeriodo] = useState('mes_atual')
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await api.get(`/api/bi/dashboard?periodo=${periodo}`)
      setDados(res)
    } catch (e) {
      setDados(null)
      setErro(e?.message || 'Não foi possível carregar os dados reais do BI.')
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.muted }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div>Carregando dados...</div>
      </div>
    </div>
  )

  if (erro) return (
    <div style={{ padding: '48px 24px', color: T.cream, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Dados reais indisponíveis</h1>
        <p style={{ color: T.muted, lineHeight: 1.5, margin: '0 0 18px' }}>{erro}</p>
        <button type="button" onClick={carregar} style={{ background: T.green, color: T.deep, border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>Tentar novamente</button>
      </div>
    </div>
  )

  const d = dados || {}

  return (
    <div style={{ padding: '20px 24px', color: T.cream, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>📊 Business Intelligence</h1>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Análise completa do negócio em tempo real</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['hoje', 'semana', 'mes_atual', 'mes_anterior', 'trimestre', 'ano'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: periodo === p ? T.green : T.card,
                color: periodo === p ? '#fff' : T.muted,
              }}
            >
              {{ hoje: 'Hoje', semana: '7 dias', mes_atual: 'Este mês', mes_anterior: 'Mês ant.', trimestre: 'Trimestre', ano: 'Ano' }[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${T.line}`, paddingBottom: 0 }}>
        {ABAS.map((a, i) => (
          <button
            key={i}
            onClick={() => setAba(i)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: aba === i ? T.green : T.muted,
              borderBottom: aba === i ? `2px solid ${T.green}` : '2px solid transparent',
              transition: 'all .15s',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* ── Aba 0: Visão Geral ─────────────────────────────────────────────── */}
      {aba === 0 && (
        <div>
          {/* KPIs principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KPICard label="Faturamento" valor={d.faturamento_total} variacao={d.var_faturamento} icon="💰" cor={T.green} />
            <KPICard label="Ticket Médio" valor={d.ticket_medio} variacao={d.var_ticket} icon="🎫" cor={T.blue} />
            <KPICard label="Margem Bruta" valor={d.margem_bruta_pct} variacao={d.var_margem} icon="📈" cor={T.yellow} fmt={fmtPct} />
            <KPICard label="Clientes Ativos" valor={d.clientes_ativos} variacao={d.var_clientes} icon="👥" cor={T.purple} fmt={fmtN} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <KPICard label="Vendas Hoje" valor={d.vendas_hoje} icon="🛒" cor={T.green} />
            <KPICard label="A Receber" valor={d.a_receber} icon="📋" cor={T.yellow} />
            <KPICard label="A Pagar" valor={d.a_pagar} icon="💸" cor={T.red} />
            <KPICard label="Saldo Caixa" valor={d.saldo_caixa} icon="🏦" cor={d.saldo_caixa >= 0 ? T.green : T.red} />
          </div>

          {/* Gráfico de evolução + mix de vendas */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>📈 Evolução do Faturamento</div>
              <div style={{ color: T.muted, fontSize: 11, marginBottom: 16 }}>Últimos 12 meses</div>
              <LineSparkline data={d.evolucao_mensal || []} height={80} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                {(d.evolucao_mensal || []).map((m, i) => (
                  <div key={i} style={{ fontSize: 9, color: T.muted, textAlign: 'center' }}>{m.label}</div>
                ))}
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>🥧 Mix de Vendas</div>
              <DonutChart items={d.mix_segmentos || []} size={110} />
            </div>
          </div>

          {/* Top produtos + Formas de pagamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>🏆 Top 10 Produtos</div>
              <BarH items={d.top_produtos || []} labelKey="nome" valueKey="faturamento" />
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>💳 Formas de Pagamento</div>
              <BarH
                items={d.formas_pagamento || []}
                labelKey="forma"
                valueKey="total"
                colorKey="cor"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Aba 1: DRE ────────────────────────────────────────────────────── */}
      {aba === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>📋 DRE — Demonstrativo de Resultado</div>
            {[
              { label: '(+) Receita Bruta', valor: d.dre?.receita_bruta, destaque: true, cor: T.green },
              { label: '(-) Deduções e Impostos', valor: d.dre?.deducoes, negativo: true },
              { label: '(=) Receita Líquida', valor: d.dre?.receita_liquida, destaque: true, cor: T.blue },
              { label: '(-) CMV / CPV', valor: d.dre?.cmv, negativo: true },
              { label: '(=) Lucro Bruto', valor: d.dre?.lucro_bruto, destaque: true, cor: T.green },
              { label: '(-) Despesas Operacionais', valor: d.dre?.despesas_operacionais, negativo: true },
              { label: '  • Pessoal', valor: d.dre?.desp_pessoal, indent: true },
              { label: '  • Aluguel', valor: d.dre?.desp_aluguel, indent: true },
              { label: '  • Energia/Água', valor: d.dre?.desp_energia, indent: true },
              { label: '  • Marketing', valor: d.dre?.desp_marketing, indent: true },
              { label: '  • Outras', valor: d.dre?.desp_outras, indent: true },
              { label: '(=) EBITDA', valor: d.dre?.ebitda, destaque: true, cor: T.yellow },
              { label: '(-) Depreciação/Amortização', valor: d.dre?.depreciacao, negativo: true },
              { label: '(-) Resultado Financeiro', valor: d.dre?.resultado_financeiro, negativo: true },
              { label: '(=) LAIR', valor: d.dre?.lair, destaque: true },
              { label: '(-) IRPJ / CSLL', valor: d.dre?.irpj_csll, negativo: true },
              { label: '(=) Lucro Líquido', valor: d.dre?.lucro_liquido, destaque: true, cor: d.dre?.lucro_liquido >= 0 ? T.green : T.red, grande: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: row.destaque ? '10px 12px' : '6px 12px',
                background: row.destaque ? 'rgba(255,255,255,.04)' : 'transparent',
                borderRadius: 8, marginBottom: 2,
                borderLeft: row.destaque ? `3px solid ${row.cor || T.muted}` : '3px solid transparent',
              }}>
                <span style={{ fontSize: row.grande ? 14 : 12, fontWeight: row.destaque ? 800 : 400, color: row.indent ? T.muted : T.cream, paddingLeft: row.indent ? 12 : 0 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: row.grande ? 15 : 12, fontWeight: row.destaque ? 800 : 600, color: row.cor || (row.negativo ? T.red : T.cream) }}>
                  {row.valor !== undefined ? fmtR(row.valor) : '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Margem por linha */}
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📊 Indicadores de Margem</div>
              {[
                { label: 'Margem Bruta', valor: d.dre?.margem_bruta_pct, meta: 40 },
                { label: 'Margem EBITDA', valor: d.dre?.margem_ebitda_pct, meta: 20 },
                { label: 'Margem Líquida', valor: d.dre?.margem_liquida_pct, meta: 10 },
              ].map((ind, i) => {
                const pct = parseFloat(ind.valor) || 0
                const cor = pct >= ind.meta ? T.green : pct >= ind.meta * 0.7 ? T.yellow : T.red
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: T.muted, fontWeight: 700 }}>{ind.label}</span>
                      <span style={{ fontWeight: 800, color: cor }}>{fmtPct(pct)}</span>
                    </div>
                    <div style={{ background: T.surface, borderRadius: 6, height: 10, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, background: cor, borderRadius: 6 }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${ind.meta}%`, width: 2, background: T.yellow, opacity: .6 }} />
                    </div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>Meta: {ind.meta}%</div>
                  </div>
                )
              })}
            </div>

            {/* DRE comparativo meses */}
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📅 Comparativo Mensal (Lucro Líquido)</div>
              <LineSparkline data={d.dre_mensal || []} color={T.green} height={70} />
            </div>
          </div>
        </div>
      )}

      {/* ── Aba 2: Fluxo de Caixa ─────────────────────────────────────────── */}
      {aba === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>💰 Fluxo de Caixa</div>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 20 }}>Projetado vs Realizado — próximos 30 dias</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(d.fluxo_caixa || []).map((dia, i) => {
                const saldo = parseFloat(dia.saldo_acumulado) || 0
                const cor = saldo >= 0 ? T.green : T.red
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderRadius: 8 }}>
                    <div style={{ width: 60, fontSize: 11, color: T.muted, flexShrink: 0 }}>{dia.data}</div>
                    <div style={{ flex: 1, display: 'flex', gap: 8, fontSize: 11 }}>
                      <span style={{ color: T.green }}>+{fmtR(dia.entradas)}</span>
                      <span style={{ color: T.red }}>-{fmtR(dia.saidas)}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: cor, minWidth: 90, textAlign: 'right' }}>
                      {fmtR(saldo)}
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📊 Resumo do Período</div>
              {[
                { label: 'Total Entradas', valor: d.total_entradas, cor: T.green },
                { label: 'Total Saídas', valor: d.total_saidas, cor: T.red },
                { label: 'Saldo Final', valor: d.saldo_final, cor: parseFloat(d.saldo_final) >= 0 ? T.green : T.red },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? `1px solid ${T.line}` : 'none' }}>
                  <span style={{ color: T.muted, fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontWeight: 800, color: item.cor, fontSize: 14 }}>{fmtR(item.valor)}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>⚠️ Contas a Vencer (7 dias)</div>
              {(d.contas_vencer || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.descricao}</div>
                    <div style={{ color: T.muted, fontSize: 10 }}>{c.vencimento}</div>
                  </div>
                  <span style={{ color: T.red, fontWeight: 800 }}>{fmtR(c.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Aba 3: Curva ABC ──────────────────────────────────────────────── */}
      {aba === 3 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { curva: 'A', label: 'Curva A', desc: '80% do faturamento', cor: T.green, qtd: d.curva_a_qtd, fat: d.curva_a_fat },
              { curva: 'B', label: 'Curva B', desc: '15% do faturamento', cor: T.yellow, qtd: d.curva_b_qtd, fat: d.curva_b_fat },
              { curva: 'C', label: 'Curva C', desc: '5% do faturamento', cor: T.red, qtd: d.curva_c_qtd, fat: d.curva_c_fat },
            ].map(c => (
              <div key={c.curva} style={{ background: T.card, border: `2px solid ${c.cor}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: c.cor }}>{c.curva}</div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{c.label}</div>
                <div style={{ color: T.muted, fontSize: 12, marginBottom: 12 }}>{c.desc}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{fmtN(c.qtd)} produtos</div>
                <div style={{ color: c.cor, fontWeight: 700, fontSize: 13, marginTop: 4 }}>{fmtR(c.fat)}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>📦 Ranking de Produtos por Faturamento</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(d.curva_abc || []).map((p, i) => {
                const cor = p.curva === 'A' ? T.green : p.curva === 'B' ? T.yellow : T.red
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: T.surface, borderRadius: 10, borderLeft: `3px solid ${cor}` }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{p.nome}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{fmtPct(p.percentual)} do total</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: cor }}>{fmtR(p.faturamento)}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>Curva {p.curva}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Aba 4: Vendedores ─────────────────────────────────────────────── */}
      {aba === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>🏆 Ranking de Vendedores</div>
            {(d.ranking_vendedores || []).map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.line}` }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? '#f5a623' : i === 1 ? '#8a8fa8' : i === 2 ? '#cd7f32' : T.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 14, color: i < 3 ? '#fff' : T.muted,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{v.nome}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{fmtN(v.total_vendas)} vendas · Ticket médio {fmtR(v.ticket_medio)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: T.green, fontSize: 14 }}>{fmtR(v.faturamento)}</div>
                  <div style={{ fontSize: 11, color: T.yellow }}>Comissão: {fmtR(v.comissao)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>📊 Performance por Vendedor</div>
            <BarH items={d.ranking_vendedores || []} labelKey="nome" valueKey="faturamento" />
          </div>
        </div>
      )}

      {/* ── Aba 5: Segmentos ──────────────────────────────────────────────── */}
      {aba === 5 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {(d.kpis_segmentos || []).map((seg, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{seg.icon} {seg.nome}</div>
                <div style={{ fontSize: 10, padding: '3px 8px', background: 'rgba(255,107,44,.15)', color: T.green, borderRadius: 20, fontWeight: 700 }}>
                  {fmtPct(seg.participacao)}
                </div>
              </div>
              {[
                { label: 'Faturamento', valor: fmtR(seg.faturamento) },
                { label: 'Transações', valor: fmtN(seg.transacoes) },
                { label: 'Ticket Médio', valor: fmtR(seg.ticket_medio) },
                { label: 'Margem Bruta', valor: fmtPct(seg.margem_bruta_pct) },
              ].map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: j < 3 ? `1px solid ${T.line}` : 'none', fontSize: 12 }}>
                  <span style={{ color: T.muted }}>{item.label}</span>
                  <span style={{ fontWeight: 700 }}>{item.valor}</span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <LineSparkline data={seg.evolucao || []} color={seg.cor || T.green} height={40} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
