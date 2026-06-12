import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtR = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const mesLabel = s => { const [y, m] = s.split('-'); return `${m}/${y}` }

const CAT_RECEITA = ['Mensalidade','Inscrição Torneio','Ingresso Evento','Bar/Lanchonete','Loja','Aula/Escola','Patrocínio','Aluguel de Quadra','Outros']
const CAT_DESPESA = ['Pessoal/RH','Manutenção','Utilities (Água/Luz)','Material Esportivo','Alimentação/Bebidas','Marketing','Equipamentos','Impostos/Taxas','Serviços Terceiros','Outros']

/* ── CSV export ── */
function exportCSV(rows, filename) {
  if (!rows?.length) return
  const keys = Object.keys(rows[0])
  const lines = [keys.join(';'), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(';'))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const S = {
  page:   { padding:'24px 28px', maxWidth:1100 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 },
  title:  { fontSize:22, fontWeight:800, color:'var(--cream)' },
  cards:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))', gap:12, marginBottom:24 },
  card:   { background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'14px 18px' },
  cNum:   { fontSize:22, fontWeight:800, color:'var(--green)', marginBottom:2 },
  cLbl:   { fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px' },
  table:  { width:'100%', borderCollapse:'collapse', background:'var(--surface)', borderRadius:10, overflow:'hidden', border:'1px solid var(--line)' },
  th:     { padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', borderBottom:'1px solid var(--line)', background:'rgba(0,0,0,.03)' },
  td:     { padding:'10px 14px', fontSize:13, borderBottom:'1px solid var(--line)' },
  btn:    { padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:12 },
  bar:    { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
  inp:    { padding:'7px 12px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface)', color:'var(--cream)', fontSize:13 },
}

/* ── Badge status ── */
function Badge({ status, vencimento }) {
  const hoje = new Date().toISOString().slice(0,10)
  if (status === 'pago')      return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#d1fae5', color:'#065f46' }}>Pago</span>
  if (status === 'cancelado') return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#f3f4f6', color:'#6b7280' }}>Cancelado</span>
  if (vencimento && vencimento < hoje) return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>Vencido</span>
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fef3c7', color:'#92400e' }}>Pendente</span>
}

/* ── Fluxo de Caixa 12 meses ── */
function FluxoChart({ dados }) {
  const [hov, setHov] = useState(null)
  if (!dados?.length) return null
  const maxVal = Math.max(...dados.map(d => Math.max(d.receitas, d.despesas)), 1)
  const H = 130
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'16px 20px', marginBottom:24 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--cream)', marginBottom:14 }}>📊 Fluxo de Caixa — 12 meses</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:H+28, overflowX:'auto' }}>
        {dados.map((d, i) => {
          const hRec  = Math.round((d.receitas / maxVal) * H)
          const hDesp = Math.round((d.despesas / maxVal) * H)
          const saldo = d.receitas - d.despesas
          return (
            <div key={d.mes} style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:48, flex:1, position:'relative' }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {hov === i && (
                <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)', background:'#0E2E1C', border:'1px solid var(--green)', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#fff', whiteSpace:'nowrap', zIndex:10, marginBottom:4 }}>
                  <div style={{ color:'var(--green)' }}>↑ {fmtR(d.receitas)}</div>
                  <div style={{ color:'#ef4444' }}>↓ {fmtR(d.despesas)}</div>
                  <div style={{ color: saldo >= 0 ? 'var(--lime)' : '#fbbf24', borderTop:'1px solid #1e4a2e', marginTop:3, paddingTop:3 }}>= {fmtR(saldo)}</div>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:H }}>
                <div title={`Receitas: ${fmtR(d.receitas)}`} style={{ width:14, height:hRec || 2, background:'var(--green)', borderRadius:'3px 3px 0 0', transition:'height .3s' }} />
                <div title={`Despesas: ${fmtR(d.despesas)}`} style={{ width:14, height:hDesp || 2, background:'#ef4444', borderRadius:'3px 3px 0 0', transition:'height .3s' }} />
              </div>
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:4, whiteSpace:'nowrap' }}>{mesLabel(d.mes)}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--muted)' }}>
          <div style={{ width:10, height:10, background:'var(--green)', borderRadius:2 }} /> Receitas
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--muted)' }}>
          <div style={{ width:10, height:10, background:'#ef4444', borderRadius:2 }} /> Despesas
        </div>
      </div>
    </div>
  )
}

/* ── DRE Simplificado ── */
function DRE({ resumo }) {
  if (!resumo) return null
  const rb = (resumo.recMes || 0)
  const desp = (resumo.despMes || 0)
  const resultado = rb - desp
  const margem = rb > 0 ? ((resultado / rb) * 100).toFixed(1) : 0

  const linha = (label, val, color, bold) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--line)', fontSize:13 }}>
      <span style={{ color: bold ? 'var(--cream)' : 'var(--muted)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight:700, color: color || 'var(--cream)' }}>{fmtR(val)}</span>
    </div>
  )

  return (
    <div style={{ ...S.card, marginTop:16 }}>
      <div style={{ fontWeight:800, color:'var(--cream)', marginBottom:14, fontSize:14 }}>📋 DRE Simplificado — Mês Atual</div>
      {linha('(+) Receita Bruta', rb, 'var(--green)', false)}
      {linha('  Mensalidades Recebidas', resumo.mensRecebidas, 'var(--green)', false)}
      {linha('  Inscrições Confirmadas', resumo.inscRec, 'var(--green)', false)}
      {linha('  Bar / Comandas', resumo.recBar, 'var(--green)', false)}
      {linha('(-) Despesas Operacionais', desp, '#ef4444', false)}
      {linha('Mensalidades Pendentes', resumo.mensPendentes, '#fbbf24', false)}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', fontSize:15 }}>
        <span style={{ fontWeight:800, color:'var(--cream)' }}>= Resultado Líquido</span>
        <span style={{ fontWeight:900, fontSize:17, color: resultado >= 0 ? 'var(--green)' : '#ef4444' }}>{fmtR(resultado)}</span>
      </div>
      <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background: margem >= 0 ? 'rgba(95,179,53,.1)' : 'rgba(239,68,68,.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--muted)' }}>Margem operacional</span>
        <span style={{ fontSize:16, fontWeight:800, color: margem >= 0 ? 'var(--lime)' : '#ef4444' }}>{margem}%</span>
      </div>
    </div>
  )
}

/* ── Main ── */
export default function Financeiro() {
  const { toast } = useToast()
  const [tab, setTab] = useState('resumo')
  const [lancs, setLancs] = useState([])
  const [fluxo, setFluxo] = useState([])
  const [resumo, setResumo] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroAte, setFiltroAte] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalForm, setModalForm] = useState(null)
  const [form, setForm] = useState({ tipo:'receita', categoria:'Outros', descricao:'', valor:'', vencimento:'', obs:'' })
  const hoje = new Date().toISOString().slice(0,10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, f, r] = await Promise.all([
        api.get('/api/admin/financeiro/lancamentos'),
        api.get('/api/admin/financeiro/fluxo'),
        api.get('/api/admin/financeiro/resumo'),
      ])
      setLancs(l); setFluxo(f); setResumo(r)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  /* filtros */
  let lista = lancs
  if (filtroTipo)       lista = lista.filter(l => l.tipo === filtroTipo)
  if (filtroStatus)     lista = lista.filter(l => l.status === filtroStatus)
  if (filtroCategoria)  lista = lista.filter(l => l.categoria === filtroCategoria)
  if (filtroQ)          lista = lista.filter(l => l.descricao?.toLowerCase().includes(filtroQ.toLowerCase()))
  if (filtroDe)         lista = lista.filter(l => l.vencimento >= filtroDe)
  if (filtroAte)        lista = lista.filter(l => l.vencimento <= filtroAte)

  const listaTabFiltrada = lista.filter(l => tab === 'todos' || l.tipo === (tab === 'receitas' ? 'receita' : 'despesa'))

  function limparFiltros() {
    setFiltroTipo(''); setFiltroStatus(''); setFiltroCategoria('')
    setFiltroQ(''); setFiltroDe(''); setFiltroAte('')
  }

  const temFiltro = filtroTipo || filtroStatus || filtroCategoria || filtroQ || filtroDe || filtroAte

  /* CRUD */
  async function salvar(e) {
    e.preventDefault()
    try {
      if (modalForm?.id) {
        await api.patch(`/api/admin/financeiro/lancamentos/${modalForm.id}`, form)
        toast('Atualizado')
      } else {
        await api.post('/api/admin/financeiro/lancamentos', form)
        toast('Lançamento criado')
      }
      setModalForm(null)
      setForm({ tipo:'receita', categoria:'Outros', descricao:'', valor:'', vencimento:'', obs:'' })
      load()
    } catch(e) { toast(e.message, true) }
  }

  async function marcarPago(id) {
    try { await api.patch(`/api/admin/financeiro/lancamentos/${id}`, { status:'pago' }); toast('Marcado como pago'); load() }
    catch(e) { toast(e.message, true) }
  }

  async function excluir(id) {
    if (!confirm('Excluir lançamento?')) return
    try { await api.delete(`/api/admin/financeiro/lancamentos/${id}`); toast('Excluído'); load() }
    catch(e) { toast(e.message, true) }
  }

  function abrirEdicao(l) {
    setForm({ tipo:l.tipo, categoria:l.categoria, descricao:l.descricao, valor:l.valor, vencimento:l.vencimento, obs:l.obs || '' })
    setModalForm(l)
  }

  function abrirNovo() {
    setForm({ tipo:'receita', categoria:'Outros', descricao:'', valor:'', vencimento:hoje, obs:'' })
    setModalForm({})
  }

  const cats = form.tipo === 'receita' ? CAT_RECEITA : CAT_DESPESA
  const catsDisponiveis = tab === 'receitas' ? CAT_RECEITA : tab === 'despesas' ? CAT_DESPESA : [...CAT_RECEITA, ...CAT_DESPESA]

  function handleExportCSV() {
    exportCSV(listaTabFiltrada.map(l => ({
      tipo: l.tipo,
      descricao: l.descricao,
      categoria: l.categoria,
      valor: l.valor,
      vencimento: l.vencimento,
      status: l.status,
      obs: l.obs || '',
    })), `lancamentos_${tab}_${hoje}.csv`)
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>💰 Financeiro</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={abrirNovo} style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>+ Novo Lançamento</button>
        </div>
      </div>

      {/* Cards KPI */}
      {resumo && (
        <div style={S.cards}>
          <div style={S.card}>
            <div style={{ ...S.cNum, color: resumo.saldo >= 0 ? 'var(--green)' : '#ef4444' }}>{fmtR(resumo.saldo)}</div>
            <div style={S.cLbl}>Saldo total</div>
          </div>
          <div style={S.card}>
            <div style={S.cNum}>{fmtR(resumo.aReceber)}</div>
            <div style={S.cLbl}>A receber</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.cNum, color:'#ef4444' }}>{fmtR(resumo.aPagar)}</div>
            <div style={S.cLbl}>A pagar</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.cNum, color:'var(--green)' }}>{fmtR(resumo.recMes)}</div>
            <div style={S.cLbl}>Rec. este mês</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.cNum, color:'#ef4444' }}>{fmtR(resumo.despMes)}</div>
            <div style={S.cLbl}>Desp. este mês</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.cNum, color: (resumo.recMes - resumo.despMes) >= 0 ? 'var(--lime)' : '#ef4444' }}>
              {fmtR(resumo.recMes - resumo.despMes)}
            </div>
            <div style={S.cLbl}>Resultado mês</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.cNum, color:'#ef4444' }}>{resumo.inadimplentes}</div>
            <div style={S.cLbl}>Inadimplentes</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--line)' }}>
        {['resumo','receitas','despesas','todos'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 16px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
            background:'none', color: tab === t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {tab === 'resumo' && (
        <>
          <FluxoChart dados={fluxo} />
          {resumo && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div style={S.card}>
                  <div style={{ fontWeight:700, color:'var(--cream)', marginBottom:12 }}>Receitas por fonte</div>
                  {[
                    { label:'Bar / Comandas', val:resumo.recBar },
                    { label:'Mensalidades recebidas', val:resumo.mensRecebidas },
                    { label:'Inscrições confirmadas', val:resumo.inscRec },
                    { label:'Lançamentos este mês', val:resumo.recMes },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--line)', fontSize:13 }}>
                      <span style={{ color:'var(--muted)' }}>{r.label}</span>
                      <span style={{ fontWeight:700, color:'var(--green)' }}>{fmtR(r.val)}</span>
                    </div>
                  ))}
                </div>
                <div style={S.card}>
                  <div style={{ fontWeight:700, color:'var(--cream)', marginBottom:12 }}>Situação das mensalidades</div>
                  {[
                    { label:'Recebidas', val:resumo.mensRecebidas, color:'var(--green)' },
                    { label:'Pendentes', val:resumo.mensPendentes, color:'var(--gold)' },
                    { label:'Vencidas', val:resumo.mensVencidas, color:'#ef4444' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--line)', fontSize:13 }}>
                      <span style={{ color:'var(--muted)' }}>{r.label}</span>
                      <span style={{ fontWeight:700, color:r.color }}>{fmtR(r.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <DRE resumo={resumo} />
            </>
          )}
        </>
      )}

      {/* Tab: Receitas / Despesas / Todos */}
      {(tab === 'receitas' || tab === 'despesas' || tab === 'todos') && (
        <>
          {/* Filtros */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
              {tab === 'todos' && (
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={S.inp}>
                  <option value=''>Tipo: Todos</option>
                  <option value='receita'>↑ Receitas</option>
                  <option value='despesa'>↓ Despesas</option>
                </select>
              )}
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={S.inp}>
                <option value=''>Status: Todos</option>
                <option value='pendente'>Pendente</option>
                <option value='pago'>Pago</option>
                <option value='cancelado'>Cancelado</option>
              </select>
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={S.inp}>
                <option value=''>Categoria: Todas</option>
                {catsDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type='text' placeholder='🔍 Descrição…' value={filtroQ} onChange={e => setFiltroQ(e.target.value)}
                style={{ ...S.inp, minWidth:140 }} />
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <label style={{ fontSize:12, color:'var(--muted)' }}>De:</label>
              <input type='date' value={filtroDe} onChange={e => setFiltroDe(e.target.value)} style={S.inp} />
              <label style={{ fontSize:12, color:'var(--muted)' }}>Até:</label>
              <input type='date' value={filtroAte} onChange={e => setFiltroAte(e.target.value)} style={S.inp} />
              {temFiltro && (
                <button onClick={limparFiltros} style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>✕ Limpar</button>
              )}
              <span style={{ marginLeft:'auto', fontSize:12, color:'var(--muted)' }}>{listaTabFiltrada.length} lançamentos</span>
              <button onClick={handleExportCSV} style={{ ...S.btn, background:'rgba(95,179,53,.15)', color:'var(--green)', border:'1px solid var(--green)' }}>
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Totais rápidos */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            {(() => {
              const rec  = listaTabFiltrada.filter(l => l.tipo === 'receita').reduce((s,l) => s + (l.valor||0), 0)
              const desp = listaTabFiltrada.filter(l => l.tipo === 'despesa').reduce((s,l) => s + (l.valor||0), 0)
              const pgos = listaTabFiltrada.filter(l => l.status === 'pago').reduce((s,l) => s + (l.valor||0), 0)
              const pendts = listaTabFiltrada.filter(l => l.status !== 'pago' && l.status !== 'cancelado').reduce((s,l) => s + (l.valor||0), 0)
              return [
                tab !== 'despesas' && { label:'↑ Receitas', val:rec, color:'var(--green)' },
                tab !== 'receitas' && { label:'↓ Despesas', val:desp, color:'#ef4444' },
                { label:'✓ Pagos', val:pgos, color:'var(--lime)' },
                { label:'⏳ Pendente', val:pendts, color:'var(--gold)' },
              ].filter(Boolean).map(k => (
                <div key={k.label} style={{ ...S.card, padding:'10px 14px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:3 }}>{k.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:k.color }}>{fmtR(k.val)}</div>
                </div>
              ))
            })()}
          </div>

          {loading ? <div style={{ color:'var(--muted)', padding:24 }}>Carregando…</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Tipo</th>
                    <th style={S.th}>Descrição</th>
                    <th style={S.th}>Categoria</th>
                    <th style={S.th}>Valor</th>
                    <th style={S.th}>Vencimento</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaTabFiltrada.map(l => {
                    const vencido = l.status !== 'pago' && l.status !== 'cancelado' && l.vencimento < hoje
                    return (
                      <tr key={l.id} style={{ background: vencido ? 'rgba(239,68,68,.04)' : undefined }}>
                        <td style={S.td}>
                          <span style={{ fontWeight:700, color: l.tipo === 'receita' ? 'var(--green)' : '#ef4444', fontSize:12, textTransform:'uppercase' }}>
                            {l.tipo === 'receita' ? '↑ Rec' : '↓ Desp'}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontWeight:600, color:'var(--cream)' }}>{l.descricao}</td>
                        <td style={{ ...S.td, color:'var(--muted)', fontSize:12 }}>{l.categoria}</td>
                        <td style={{ ...S.td, fontWeight:700, color: l.tipo === 'receita' ? 'var(--green)' : '#ef4444' }}>{fmtR(l.valor)}</td>
                        <td style={{ ...S.td, color: vencido ? '#ef4444' : undefined }}>{fmtData(l.vencimento)}</td>
                        <td style={S.td}><Badge status={l.status} vencimento={l.vencimento} /></td>
                        <td style={S.td}>
                          <div style={{ display:'flex', gap:6 }}>
                            {l.status === 'pendente' && (
                              <button onClick={() => marcarPago(l.id)}
                                style={{ ...S.btn, padding:'4px 9px', background:'#d1fae5', color:'#065f46', fontSize:11 }}>✓ Pago</button>
                            )}
                            <button onClick={() => abrirEdicao(l)}
                              style={{ ...S.btn, padding:'4px 9px', background:'var(--surface)', border:'1px solid var(--line)', color:'var(--cream)', fontSize:11 }}>✎</button>
                            <button onClick={() => excluir(l.id)}
                              style={{ ...S.btn, padding:'4px 9px', background:'#fee2e2', color:'#991b1b', fontSize:11 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {listaTabFiltrada.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'var(--muted)', padding:32 }}>Nenhum lançamento encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal lançamento */}
      {modalForm !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={salvar} style={{ background:'var(--surface)', borderRadius:12, padding:28, width:440, maxWidth:'95vw' }}>
            <h3 style={{ marginBottom:18, color:'var(--cream)' }}>{modalForm?.id ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <label>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Tipo *</span>
                <select required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo:e.target.value, categoria:'Outros' }))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                  <option value='receita'>↑ Receita</option>
                  <option value='despesa'>↓ Despesa</option>
                </select>
              </label>
              <label>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Categoria *</span>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria:e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Descrição *</span>
              <input required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao:e.target.value }))}
                placeholder='Ex: Pagamento de energia elétrica'
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <label>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Valor (R$) *</span>
                <input required type='number' min='0.01' step='0.01' value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor:e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
              </label>
              <label>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Vencimento *</span>
                <input required type='date' value={form.vencimento}
                  onChange={e => setForm(f => ({ ...f, vencimento:e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
              </label>
            </div>
            <label style={{ display:'block', marginBottom:18 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Observações</span>
              <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs:e.target.value }))} rows={2}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)', resize:'vertical' }} />
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type='button' onClick={() => setModalForm(null)}
                style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button type='submit' style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
