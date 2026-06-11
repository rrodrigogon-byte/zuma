import { useState, useEffect, useRef } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

/* ── helpers ── */
function today()  { return new Date().toISOString().slice(0, 10) }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function inRange(isoStr, from, to) {
  if (!isoStr) return false
  const d = isoStr.slice(0, 10)
  return (!from || d >= from) && (!to || d <= to)
}

function exportCSV(filename, rows) {
  if (!rows || rows.length === 0) return
  const keys = Object.keys(rows[0])
  const lines = [keys.join(';'), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(';'))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── CSS bar chart ── */
function BarChart({ data, valueKey, labelKey, color = 'var(--green)' }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d[labelKey]}
          </div>
          <div style={{ flex: 1, background: 'var(--line)', borderRadius: 4, height: 18, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              borderRadius: 4,
              width: `${Math.round((d[valueKey] || 0) / max * 100)}%`,
              background: color,
              transition: 'width .4s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream)', width: 70, flexShrink: 0 }}>
            {typeof d[valueKey] === 'number' && d[valueKey] > 100
              ? fmtR(d[valueKey])
              : d[valueKey]}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── section wrapper ── */
function Section({ title, children, onCSV, onPrint }) {
  return (
    <div className="section-card" style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, padding: 24, marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--cream)' }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCSV && (
            <button className="btn btn-ghost btn-sm" onClick={onCSV}>
              📥 CSV
            </button>
          )}
          {onPrint && (
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              🖨️ PDF
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function DateFilter({ from, to, onFrom, onTo, periodButtons = true }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
      {periodButtons && (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFrom(today()); onTo(today()) }}>Hoje</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFrom(daysAgo(6)); onTo(today()) }}>Semana</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFrom(daysAgo(29)); onTo(today()) }}>Mês</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFrom(''); onTo('') }}>Todos</button>
        </>
      )}
      <input className="input" type="date" style={{ maxWidth: 140 }} value={from} onChange={e => onFrom(e.target.value)} />
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>até</span>
      <input className="input" type="date" style={{ maxWidth: 140 }} value={to} onChange={e => onTo(e.target.value)} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function Relatorios() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)

  // raw data
  const [dashboard, setDashboard] = useState({})
  const [vendas, setVendas]       = useState([])
  const [inscricoes, setInscricoes] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [socios, setSocios]       = useState([])

  // filters
  const [finFrom, setFinFrom] = useState(daysAgo(29))
  const [finTo,   setFinTo]   = useState(today())
  const [insFrom, setInsFrom] = useState('')
  const [insTo,   setInsTo]   = useState('')
  const [socFrom, setSocFrom] = useState('')
  const [socTo,   setSocTo]   = useState('')

  async function load() {
    setLoading(true)
    try {
      const [dash, v, insc, pag, soc] = await Promise.all([
        api.get('/api/admin/dashboard').catch(() => ({})),
        api.get('/api/admin/vendas').catch(() => []),
        api.get('/api/admin/inscricoes').catch(() => []),
        api.get('/api/admin/pagamentos').catch(() => []),
        api.get('/api/admin/socios').catch(() => []),
      ])
      setDashboard(dash || {})
      setVendas(Array.isArray(v) ? v : v.vendas || [])
      setInscricoes(Array.isArray(insc) ? insc : insc.inscricoes || [])
      setPagamentos(Array.isArray(pag) ? pag : pag.pagamentos || [])
      setSocios(Array.isArray(soc) ? soc : soc.socios || [])
    } catch {
      toast('Erro ao carregar dados', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  /* ── Financeiro ── */
  const vendasFiltradas = vendas.filter(v => inRange(v.createdAt || v.data, finFrom, finTo))
  const receitaTotal    = vendasFiltradas.reduce((s, v) => s + (v.total || 0), 0)

  // por meio de pagamento
  const porMeio = {}
  vendasFiltradas.forEach(v => {
    const m = v.formaPagamento || v.meio || 'Outro'
    porMeio[m] = (porMeio[m] || 0) + (v.total || 0)
  })
  const porMeioArr = Object.entries(porMeio).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  // top produtos
  const prodMap = {}
  vendasFiltradas.forEach(v => {
    (v.itens || []).forEach(it => {
      const n = it.nome || it.produto || 'Produto'
      prodMap[n] = (prodMap[n] || 0) + (it.qtd || it.quantidade || 1)
    })
  })
  const topProd = Object.entries(prodMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  /* ── Inscrições ── */
  const inscFiltradas = inscricoes.filter(i => inRange(i.createdAt || i.data, insFrom, insTo))

  const porCategoria = {}
  inscFiltradas.forEach(i => {
    const c = i.categoria || 'Sem categoria'
    porCategoria[c] = (porCategoria[c] || 0) + 1
  })
  const porCatArr = Object.entries(porCategoria).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  const porStatus = {}
  inscFiltradas.forEach(i => { porStatus[i.status || 'pendente'] = (porStatus[i.status || 'pendente'] || 0) + 1 })
  const porStatusArr = Object.entries(porStatus).map(([label, value]) => ({ label, value }))

  /* ── Sócios ── */
  const mesAtual = new Date().getMonth() + 1
  const aniversariantes = socios.filter(s => {
    if (!s.nascimento) return false
    const m = parseInt((s.nascimento || '').split('-')[1] || '0')
    return m === mesAtual
  })

  const inadimplentes = socios.filter(s => s.status === 'late' || s.faturas?.some(f => f.status === 'atrasada'))
  const totalAReceber = inadimplentes.reduce((sum, s) => {
    return sum + (s.faturas || []).filter(f => f.status === 'atrasada').reduce((a, f) => a + (f.valor || 0), 0)
  }, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          nav, .hamburger, .sidebar-overlay, button { display: none !important; }
          .section-card { break-inside: avoid; page-break-inside: avoid; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--cream)' }}>📄 Relatórios</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ Imprimir Tudo</button>
        </div>

        {/* KPIs gerais do dashboard */}
        {dashboard && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            {[
              { label: 'Inscrições', value: dashboard.inscricoes ?? inscricoes.length, color: 'var(--green)' },
              { label: 'Sócios',     value: dashboard.socios ?? socios.length,         color: 'var(--gold)' },
              { label: 'Pagamentos', value: fmtR(dashboard.receitaTotal ?? 0),          color: 'var(--lime)' },
            ].map(k => (
              <div key={k.label} style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12, padding: '14px 20px', flex: 1, minWidth: 140,
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{k.label.toUpperCase()}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Relatório Financeiro ── */}
        <Section
          title="💰 Relatório Financeiro"
          onCSV={() => exportCSV('financeiro.csv', vendasFiltradas.map(v => ({
            data: fmtDate(v.createdAt || v.data),
            total: v.total,
            meio: v.formaPagamento || v.meio || '',
          })))}
          onPrint
        >
          <DateFilter from={finFrom} to={finTo} onFrom={setFinFrom} onTo={setFinTo} />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ background: 'rgba(95,179,53,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>RECEITA NO PERÍODO</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>{fmtR(receitaTotal)}</div>
            </div>
            <div style={{ background: 'rgba(201,166,86,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>VENDAS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{vendasFiltradas.length}</div>
            </div>
          </div>

          {porMeioArr.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Por meio de pagamento</div>
              <BarChart data={porMeioArr} labelKey="label" valueKey="value" color="var(--green)" />
            </>
          )}

          {topProd.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', margin: '20px 0 10px' }}>Top produtos vendidos (qtd)</div>
              <BarChart data={topProd} labelKey="label" valueKey="value" color="var(--gold)" />
            </>
          )}

          {vendasFiltradas.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhuma venda no período selecionado.</p>
          )}
        </Section>

        {/* ── Relatório de Inscrições ── */}
        <Section
          title="📋 Relatório de Inscrições"
          onCSV={() => exportCSV('inscricoes.csv', inscFiltradas.map(i => ({
            nome: i.nome,
            categoria: i.categoria,
            status: i.status,
            data: fmtDate(i.createdAt || i.data),
          })))}
          onPrint
        >
          <DateFilter from={insFrom} to={insTo} onFrom={setInsFrom} onTo={setInsTo} />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ background: 'rgba(95,179,53,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>TOTAL</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>{inscFiltradas.length}</div>
            </div>
            {porStatusArr.map(s => (
              <div key={s.label} style={{ background: 'rgba(143,214,74,.08)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--lime)', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {porCatArr.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Por categoria</div>
              <BarChart data={porCatArr} labelKey="label" valueKey="value" color="var(--lime)" />
            </>
          )}

          {inscFiltradas.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhuma inscrição no período.</p>
          )}
        </Section>

        {/* ── Relatório de Sócios ── */}
        <Section
          title="🏆 Relatório de Sócios"
          onCSV={() => exportCSV('socios.csv', socios.map(s => ({
            nome: s.nome,
            email: s.email,
            plano: s.plano,
            status: s.status,
            saldo: s.saldo,
          })))}
          onPrint
        >
          <DateFilter from={socFrom} to={socTo} onFrom={setSocFrom} onTo={setSocTo} periodButtons={false} />

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ background: 'rgba(95,179,53,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>TOTAL SÓCIOS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>{socios.length}</div>
            </div>
            <div style={{ background: 'rgba(231,76,60,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>INADIMPLENTES</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#e74c3c', marginTop: 4 }}>{inadimplentes.length}</div>
            </div>
            <div style={{ background: 'rgba(201,166,86,.1)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>A RECEBER</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{fmtR(totalAReceber)}</div>
            </div>
            <div style={{ background: 'rgba(143,214,74,.08)', borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>ANIVERSARIANTES</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--lime)', marginTop: 4 }}>{aniversariantes.length}</div>
            </div>
          </div>

          {inadimplentes.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e74c3c', marginBottom: 10 }}>Sócios Inadimplentes</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Plano</th>
                      <th>Faturas Atrasadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inadimplentes.slice(0, 20).map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.nome}</td>
                        <td>{s.plano}</td>
                        <td style={{ color: '#e74c3c' }}>
                          {(s.faturas || []).filter(f => f.status === 'atrasada').length} fatura(s)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {aniversariantes.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lime)', margin: '20px 0 10px' }}>
                🎂 Aniversariantes do Mês
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {aniversariantes.map(s => (
                  <div key={s.id} style={{
                    background: 'rgba(143,214,74,.1)', border: '1px solid rgba(143,214,74,.2)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--cream)',
                  }}>
                    🎂 {s.nome}
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>
    </>
  )
}
