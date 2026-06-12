import { useState, useEffect, useRef, useCallback } from 'react'
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

const TABS_REL = [
  { key:'financeiro', label:'💰 Financeiro' },
  { key:'inscricoes', label:'📋 Inscrições' },
  { key:'socios',     label:'🏆 Sócios' },
  { key:'quadras',    label:'🎾 Quadras' },
  { key:'aulas',      label:'📚 Aulas/Matrículas' },
]

export default function Relatorios() {
  const { toast } = useToast()
  const [tabAtiva, setTabAtiva] = useState('financeiro')
  const [loading, setLoading] = useState(true)

  // raw data
  const [dashboard, setDashboard]   = useState({})
  const [vendas, setVendas]         = useState([])
  const [inscricoes, setInscricoes] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [socios, setSocios]         = useState([])
  const [reservas, setReservas]     = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [aulas, setAulas]           = useState([])

  // filters
  const [finFrom, setFinFrom] = useState(daysAgo(29))
  const [finTo,   setFinTo]   = useState(today())
  const [insFrom, setInsFrom] = useState('')
  const [insTo,   setInsTo]   = useState('')
  const [socFrom, setSocFrom] = useState('')
  const [socTo,   setSocTo]   = useState('')
  const [qFrom,   setQFrom]   = useState(daysAgo(29))
  const [qTo,     setQTo]     = useState(today())
  const [aulFrom, setAulFrom] = useState(daysAgo(29))
  const [aulTo,   setAulTo]   = useState(today())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, v, insc, pag, soc, res, mat, aul] = await Promise.all([
        api.get('/api/admin/dashboard').catch(() => ({})),
        api.get('/api/admin/vendas').catch(() => []),
        api.get('/api/admin/inscricoes').catch(() => []),
        api.get('/api/admin/pagamentos').catch(() => []),
        api.get('/api/admin/socios').catch(() => []),
        api.get('/api/admin/reservas').catch(() => []),
        api.get('/api/admin/matriculas').catch(() => []),
        api.get('/api/admin/aulas').catch(() => []),
      ])
      setDashboard(dash || {})
      setVendas(Array.isArray(v) ? v : v.vendas || [])
      setInscricoes(Array.isArray(insc) ? insc : insc.inscricoes || [])
      setPagamentos(Array.isArray(pag) ? pag : pag.pagamentos || [])
      setSocios(Array.isArray(soc) ? soc : soc.socios || [])
      setReservas(Array.isArray(res) ? res : res.reservas || [])
      setMatriculas(Array.isArray(mat) ? mat : mat.matriculas || [])
      setAulas(Array.isArray(aul) ? aul : aul.aulas || [])
    } catch {
      toast('Erro ao carregar dados', true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <div className="spinner" />
      </div>
    )
  }

  /* ── Dados derivados — Quadras ── */
  const resFiltradas = reservas.filter(r => inRange(r.data || r.createdAt, qFrom, qTo))
  const receitaQuadras = resFiltradas.reduce((s, r) => s + (r.valor || r.total || 0), 0)
  const porQuadra = {}
  resFiltradas.forEach(r => { const q = r.quadra || r.quadraNome || 'Quadra?'; porQuadra[q] = (porQuadra[q]||0)+1 })
  const porQuadraArr = Object.entries(porQuadra).map(([label,value]) => ({label,value})).sort((a,b)=>b.value-a.value)
  const porHorario = {}
  resFiltradas.forEach(r => { const h = (r.horario||r.hora||'').slice(0,2)+'h'; porHorario[h]=(porHorario[h]||0)+1 })
  const porHorarioArr = Object.entries(porHorario).map(([label,value])=>({label,value})).sort((a,b)=>a.label.localeCompare(b.label))

  /* ── Dados derivados — Aulas ── */
  const aulFiltradas = matriculas.filter(m => inRange(m.createdAt || m.data, aulFrom, aulTo))
  const receitaAulas = aulFiltradas.reduce((s, m) => s + (m.valor || 0), 0)
  const porAula = {}
  aulFiltradas.forEach(m => { const a = m.aulaNome || m.modalidade || 'Aula'; porAula[a]=(porAula[a]||0)+1 })
  const porAulaArr = Object.entries(porAula).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value)
  const porStatusAul = {}
  aulFiltradas.forEach(m => { const s = m.status||'ativo'; porStatusAul[s]=(porStatusAul[s]||0)+1 })

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

      <div style={{ padding:'24px 16px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ margin:0, fontSize:22, fontWeight:900, color:'var(--cream)' }}>📄 Relatórios</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}>↺ Atualizar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ Imprimir</button>
          </div>
        </div>

        {/* KPIs gerais */}
        {dashboard && (
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:24 }}>
            {[
              { label:'Inscrições', value: dashboard?.indicadores?.inscricoes ?? inscricoes.length, color:'var(--green)' },
              { label:'Sócios',     value: socios.length,    color:'var(--gold)' },
              { label:'Reservas',   value: reservas.length,  color:'var(--lime)' },
              { label:'Matrículas', value: matriculas.length, color:'#3498db' },
            ].map(k => (
              <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:12, padding:'14px 20px', flex:1, minWidth:120 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>{k.label.toUpperCase()}</div>
                <div style={{ fontSize:26, fontWeight:900, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Nav tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--line)', flexWrap:'wrap' }}>
          {TABS_REL.map(t => (
            <button key={t.key} onClick={() => setTabAtiva(t.key)} style={{
              padding:'8px 16px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
              background:'none', color: tabAtiva===t.key ? 'var(--green)' : 'var(--muted)',
              borderBottom: tabAtiva===t.key ? '2px solid var(--green)' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Tab: Financeiro ── */}
        {tabAtiva === 'financeiro' && (
          <Section title="💰 Relatório Financeiro"
            onCSV={() => exportCSV('financeiro.csv', vendasFiltradas.map(v => ({
              data: fmtDate(v.createdAt||v.data), total:v.total, meio:v.formaPagamento||v.meio||'',
            })))} onPrint>
            <DateFilter from={finFrom} to={finTo} onFrom={setFinFrom} onTo={setFinTo} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
              <div style={{ background:'rgba(95,179,53,.1)', borderRadius:10, padding:'12px 20px', flex:1, minWidth:130 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>RECEITA NO PERÍODO</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--green)', marginTop:4 }}>{fmtR(receitaTotal)}</div>
              </div>
              <div style={{ background:'rgba(201,166,86,.1)', borderRadius:10, padding:'12px 20px', flex:1, minWidth:130 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>VENDAS</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--gold)', marginTop:4 }}>{vendasFiltradas.length}</div>
              </div>
              <div style={{ background:'rgba(143,214,74,.08)', borderRadius:10, padding:'12px 20px', flex:1, minWidth:130 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>TICKET MÉDIO</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--lime)', marginTop:4 }}>
                  {fmtR(vendasFiltradas.length ? receitaTotal/vendasFiltradas.length : 0)}
                </div>
              </div>
            </div>
            {porMeioArr.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>Por meio de pagamento</div>
                <BarChart data={porMeioArr} labelKey="label" valueKey="value" color="var(--green)" />
              </>
            )}
            {topProd.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', margin:'20px 0 10px' }}>Top produtos vendidos (qtd)</div>
                <BarChart data={topProd} labelKey="label" valueKey="value" color="var(--gold)" />
              </>
            )}
            {vendasFiltradas.length === 0 && (
              <p style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>Nenhuma venda no período selecionado.</p>
            )}
          </Section>
        )}

        {/* ── Tab: Inscrições ── */}
        {tabAtiva === 'inscricoes' && (
          <Section title="📋 Relatório de Inscrições"
            onCSV={() => exportCSV('inscricoes.csv', inscFiltradas.map(i => ({
              nome:i.nome, categoria:i.categoria, status:i.status, data:fmtDate(i.createdAt||i.data),
            })))} onPrint>
            <DateFilter from={insFrom} to={insTo} onFrom={setInsFrom} onTo={setInsTo} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
              <div style={{ background:'rgba(95,179,53,.1)', borderRadius:10, padding:'12px 20px', flex:1, minWidth:120 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>TOTAL</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--green)', marginTop:4 }}>{inscFiltradas.length}</div>
              </div>
              {porStatusArr.map(s => (
                <div key={s.label} style={{ background:'rgba(143,214,74,.08)', borderRadius:10, padding:'12px 20px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:'var(--lime)', marginTop:4 }}>{s.value}</div>
                </div>
              ))}
            </div>
            {porCatArr.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>Por categoria</div>
                <BarChart data={porCatArr} labelKey="label" valueKey="value" color="var(--lime)" />
              </>
            )}
            {inscFiltradas.length === 0 && (
              <p style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>Nenhuma inscrição no período.</p>
            )}
          </Section>
        )}

        {/* ── Tab: Sócios ── */}
        {tabAtiva === 'socios' && (
          <Section title="🏆 Relatório de Sócios"
            onCSV={() => exportCSV('socios.csv', socios.map(s => ({
              nome:s.nome, email:s.email, plano:s.plano, status:s.status, saldo:s.saldo,
            })))} onPrint>
            <DateFilter from={socFrom} to={socTo} onFrom={setSocFrom} onTo={setSocTo} periodButtons={false} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
              {[
                { label:'TOTAL SÓCIOS', val:socios.length, color:'var(--green)', bg:'rgba(95,179,53,.1)' },
                { label:'INADIMPLENTES', val:inadimplentes.length, color:'#e74c3c', bg:'rgba(231,76,60,.1)' },
                { label:'A RECEBER', val:fmtR(totalAReceber), color:'var(--gold)', bg:'rgba(201,166,86,.1)' },
                { label:'ANIVERSARIANTES', val:aniversariantes.length, color:'var(--lime)', bg:'rgba(143,214,74,.08)' },
              ].map(k => (
                <div key={k.label} style={{ background:k.bg, borderRadius:10, padding:'12px 20px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>{k.label}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:k.color, marginTop:4 }}>{k.val}</div>
                </div>
              ))}
            </div>
            {inadimplentes.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'#e74c3c', marginBottom:10 }}>Sócios Inadimplentes</div>
                <div style={{ overflowX:'auto' }}>
                  <table className="table">
                    <thead><tr><th>Nome</th><th>Plano</th><th>Faturas Atrasadas</th></tr></thead>
                    <tbody>
                      {inadimplentes.slice(0, 20).map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight:600 }}>{s.nome}</td>
                          <td>{s.plano}</td>
                          <td style={{ color:'#e74c3c' }}>{(s.faturas||[]).filter(f=>f.status==='atrasada').length} fatura(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {aniversariantes.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--lime)', margin:'20px 0 10px' }}>🎂 Aniversariantes do Mês</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {aniversariantes.map(s => (
                    <div key={s.id} style={{ background:'rgba(143,214,74,.1)', border:'1px solid rgba(143,214,74,.2)', borderRadius:8, padding:'8px 14px', fontSize:13, color:'var(--cream)' }}>
                      🎂 {s.nome}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>
        )}

        {/* ── Tab: Quadras ── */}
        {tabAtiva === 'quadras' && (
          <Section title="🎾 Relatório de Quadras / Reservas"
            onCSV={() => exportCSV('reservas_quadras.csv', resFiltradas.map(r => ({
              quadra: r.quadra||r.quadraNome||'', data:r.data||'', horario:r.horario||'',
              cliente:r.clienteNome||r.socioNome||'', valor:r.valor||0, status:r.status||'',
            })))} onPrint>
            <DateFilter from={qFrom} to={qTo} onFrom={setQFrom} onTo={setQTo} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
              {[
                { label:'RESERVAS NO PERÍODO', val:resFiltradas.length, color:'var(--green)', bg:'rgba(95,179,53,.1)' },
                { label:'RECEITA ESTIMADA',    val:fmtR(receitaQuadras), color:'var(--lime)', bg:'rgba(143,214,74,.08)' },
                { label:'QUADRAS ATIVAS',      val:porQuadraArr.length, color:'var(--gold)', bg:'rgba(201,166,86,.1)' },
              ].map(k => (
                <div key={k.label} style={{ background:k.bg, borderRadius:10, padding:'12px 20px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>{k.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:k.color, marginTop:4 }}>{k.val}</div>
                </div>
              ))}
            </div>
            {porQuadraArr.length > 0 ? (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>Reservas por quadra</div>
                <BarChart data={porQuadraArr} labelKey="label" valueKey="value" color="var(--green)" />
                {porHorarioArr.length > 0 && (
                  <>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', margin:'20px 0 10px' }}>Horários mais reservados</div>
                    <BarChart data={porHorarioArr} labelKey="label" valueKey="value" color="var(--gold)" />
                  </>
                )}
                {/* Tabela detalhada */}
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', margin:'20px 0 10px' }}>Últimas reservas</div>
                <div style={{ overflowX:'auto' }}>
                  <table className="table">
                    <thead><tr><th>Data</th><th>Quadra</th><th>Horário</th><th>Cliente</th><th>Valor</th><th>Status</th></tr></thead>
                    <tbody>
                      {resFiltradas.slice(0, 30).map((r, i) => (
                        <tr key={i}>
                          <td>{r.data || '—'}</td>
                          <td style={{ fontWeight:600 }}>{r.quadra || r.quadraNome || '—'}</td>
                          <td>{r.horario || r.hora || '—'}</td>
                          <td>{r.clienteNome || r.socioNome || '—'}</td>
                          <td style={{ color:'var(--green)', fontWeight:700 }}>{fmtR(r.valor||0)}</td>
                          <td><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(95,179,53,.15)', color:'var(--green)', fontWeight:700 }}>{r.status||'—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>
                Nenhuma reserva no período selecionado.
                <br /><span style={{ fontSize:11 }}>Verifique se o endpoint /api/admin/reservas está disponível.</span>
              </p>
            )}
          </Section>
        )}

        {/* ── Tab: Aulas / Matrículas ── */}
        {tabAtiva === 'aulas' && (
          <Section title="📚 Aulas / Matrículas"
            onCSV={() => exportCSV('matriculas.csv', aulFiltradas.map(m => ({
              aluno:m.alunoNome||m.socioNome||'', aula:m.aulaNome||m.modalidade||'',
              status:m.status||'', valor:m.valor||0, data:m.createdAt||m.data||'',
            })))} onPrint>
            <DateFilter from={aulFrom} to={aulTo} onFrom={setAulFrom} onTo={setAulTo} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
              {[
                { label:'MATRÍCULAS NO PERÍODO', val:aulFiltradas.length, color:'var(--green)', bg:'rgba(95,179,53,.1)' },
                { label:'RECEITA',               val:fmtR(receitaAulas),  color:'var(--lime)',  bg:'rgba(143,214,74,.08)' },
                { label:'AULAS / MODALIDADES',   val:porAulaArr.length,   color:'#3498db',      bg:'rgba(52,152,219,.1)' },
                ...Object.entries(porStatusAul).map(([s, n]) => ({
                  label: s.toUpperCase(), val:n, color:'var(--gold)', bg:'rgba(201,166,86,.1)',
                })),
              ].map(k => (
                <div key={k.label} style={{ background:k.bg, borderRadius:10, padding:'12px 20px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>{k.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:k.color, marginTop:4 }}>{k.val}</div>
                </div>
              ))}
            </div>
            {porAulaArr.length > 0 ? (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>Matrículas por modalidade</div>
                <BarChart data={porAulaArr} labelKey="label" valueKey="value" color="#3498db" />
                <div style={{ fontSize:13, fontWeight:700, color:'var(--muted)', margin:'20px 0 10px' }}>Detalhamento</div>
                <div style={{ overflowX:'auto' }}>
                  <table className="table">
                    <thead><tr><th>Aluno</th><th>Modalidade / Aula</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
                    <tbody>
                      {aulFiltradas.slice(0, 30).map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{m.alunoNome || m.socioNome || '—'}</td>
                          <td>{m.aulaNome || m.modalidade || '—'}</td>
                          <td><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(95,179,53,.15)', color:'var(--green)', fontWeight:700 }}>{m.status||'ativo'}</span></td>
                          <td style={{ color:'var(--green)', fontWeight:700 }}>{fmtR(m.valor||0)}</td>
                          <td>{fmtDate(m.createdAt||m.data)||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>
                Nenhuma matrícula no período.
                <br /><span style={{ fontSize:11 }}>Verifique se os endpoints /api/admin/matriculas e /api/admin/aulas estão disponíveis.</span>
              </p>
            )}
          </Section>
        )}

      </div>
    </>
  )
}
