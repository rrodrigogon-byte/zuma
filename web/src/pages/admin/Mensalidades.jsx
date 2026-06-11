import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtR = v => `R$ ${Number(v||0).toFixed(2).replace('.',',')}`
const fmtData = s => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : '—'
const mesLabel = s => { const [y,m]=s.split('-'); return `${m}/${y}` }

const STATUS_COLOR = {
  pendente: { bg:'#fef3c7', color:'#92400e', label:'Pendente' },
  pago:     { bg:'#d1fae5', color:'#065f46', label:'Pago' },
  vencido:  { bg:'#fee2e2', color:'#991b1b', label:'Vencido' },
  cancelado:{ bg:'#f3f4f6', color:'#6b7280', label:'Cancelado' },
}

function statusReal(m) {
  if(m.status==='pago') return 'pago'
  if(m.status==='cancelado') return 'cancelado'
  const hoje = new Date().toISOString().slice(0,10)
  if(m.vencimento < hoje) return 'vencido'
  return 'pendente'
}

const S = {
  page:   { padding: '24px 28px', maxWidth: 1100 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 },
  title:  { fontSize:22, fontWeight:800, color:'var(--cream)' },
  cards:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:24 },
  card:   { background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'14px 18px' },
  cNum:   { fontSize:26, fontWeight:800, color:'var(--green)', marginBottom:2 },
  cLbl:   { fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px' },
  bar:    { display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' },
  table:  { width:'100%', borderCollapse:'collapse', background:'var(--surface)', borderRadius:10, overflow:'hidden', border:'1px solid var(--line)' },
  th:     { padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', borderBottom:'1px solid var(--line)', background:'rgba(0,0,0,.03)' },
  td:     { padding:'10px 14px', fontSize:13, borderBottom:'1px solid var(--line)' },
  badge:  (st)=> ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700,
    background:(STATUS_COLOR[st]||STATUS_COLOR.pendente).bg, color:(STATUS_COLOR[st]||STATUS_COLOR.pendente).color }),
  btn:    { padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:12 },
}

export default function Mensalidades() {
  const { toast } = useToast()
  const [tab, setTab] = useState('cobranças') // 'cobranças' | 'planos'
  const [mens, setMens] = useState([])
  const [planos, setPlanos] = useState([])
  const [socios, setSocios] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalGerar, setModalGerar] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [modalPlano, setModalPlano] = useState(null)
  const [form, setForm] = useState({ socioId:'', valor:'', vencimento:'', obs:'' })
  const [formPlano, setFormPlano] = useState({ nome:'', valor:'', periodicidade:'mensal', descricao:'' })
  const [formGerar, setFormGerar] = useState({ mes: new Date().toISOString().slice(0,7), planoId:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p, s] = await Promise.all([
        api.get('/api/admin/mensalidades'),
        api.get('/api/admin/mensalidades/planos'),
        api.get('/api/admin/socios'),
      ])
      setMens(m); setPlanos(p); setSocios(s)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const hoje = new Date().toISOString().slice(0,10)
  const pendentes = mens.filter(m=>m.status==='pendente')
  const vencidas  = pendentes.filter(m=>m.vencimento < hoje)
  const totalPend = pendentes.reduce((s,m)=>s+m.valor,0)
  const totalVenc = vencidas.reduce((s,m)=>s+m.valor,0)
  const totalPago = mens.filter(m=>m.status==='pago').reduce((s,m)=>s+m.valor,0)

  let listaFiltrada = mens
  if(filtroStatus) listaFiltrada = listaFiltrada.filter(m => statusReal(m)===filtroStatus)
  if(filtroMes)    listaFiltrada = listaFiltrada.filter(m => (m.vencimento||'').startsWith(filtroMes))

  async function marcarPago(id) {
    try {
      await api.patch(`/api/admin/mensalidades/${id}`, { status:'pago' })
      toast('Marcado como pago'); load()
    } catch(e) { toast(e.message, true) }
  }

  async function cancelar(id) {
    if(!confirm('Cancelar esta cobrança?')) return
    try {
      await api.patch(`/api/admin/mensalidades/${id}`, { status:'cancelado' })
      toast('Cancelada'); load()
    } catch(e) { toast(e.message, true) }
  }

  async function excluir(id) {
    if(!confirm('Excluir cobrança?')) return
    try {
      await api.delete(`/api/admin/mensalidades/${id}`)
      toast('Excluída'); load()
    } catch(e) { toast(e.message, true) }
  }

  async function salvarNova(e) {
    e.preventDefault()
    const socio = socios.find(s=>s.id==form.socioId)
    const plano = planos.find(p=>p.id==form.planoId)
    try {
      await api.post('/api/admin/mensalidades', {
        ...form, socioNome:socio?.nome||'', planoNome:plano?.nome||''
      })
      toast('Cobrança criada'); setModalNova(false); setForm({socioId:'',valor:'',vencimento:'',obs:''}); load()
    } catch(e) { toast(e.message, true) }
  }

  async function gerarLote(e) {
    e.preventDefault()
    try {
      const r = await api.post('/api/admin/mensalidades/gerar', formGerar)
      toast(`${r.geradas} cobranças geradas, ${r.puladas} já existiam`); setModalGerar(false); load()
    } catch(e) { toast(e.message, true) }
  }

  async function salvarPlano(e) {
    e.preventDefault()
    try {
      if(modalPlano?.id) {
        await api.patch(`/api/admin/mensalidades/planos/${modalPlano.id}`, formPlano)
        toast('Plano atualizado')
      } else {
        await api.post('/api/admin/mensalidades/planos', formPlano)
        toast('Plano criado')
      }
      setModalPlano(null); load()
    } catch(e) { toast(e.message, true) }
  }

  async function excluirPlano(id) {
    if(!confirm('Excluir plano?')) return
    try { await api.delete(`/api/admin/mensalidades/planos/${id}`); toast('Plano excluído'); load() }
    catch(e) { toast(e.message, true) }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>💳 Mensalidades</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button style={{ ...S.btn, background:'var(--surface)', border:'1px solid var(--line)', color:'var(--cream)' }}
            onClick={()=>setModalGerar(true)}>⚡ Gerar Lote</button>
          <button style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}
            onClick={()=>setModalNova(true)}>+ Nova Cobrança</button>
        </div>
      </div>

      {/* Cards resumo */}
      <div style={S.cards}>
        <div style={S.card}>
          <div style={S.cNum}>{fmtR(totalPago)}</div>
          <div style={S.cLbl}>Recebido</div>
        </div>
        <div style={S.card}>
          <div style={{ ...S.cNum, color:'var(--gold)' }}>{fmtR(totalPend)}</div>
          <div style={S.cLbl}>A receber</div>
        </div>
        <div style={S.card}>
          <div style={{ ...S.cNum, color:'#ef4444' }}>{fmtR(totalVenc)}</div>
          <div style={S.cLbl}>Vencido</div>
        </div>
        <div style={S.card}>
          <div style={{ ...S.cNum, color:'#ef4444' }}>{vencidas.length}</div>
          <div style={S.cLbl}>Inadimplentes</div>
        </div>
        <div style={S.card}>
          <div style={S.cNum}>{mens.length}</div>
          <div style={S.cLbl}>Total cobranças</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--line)' }}>
        {['cobranças','planos'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'8px 18px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
            background:'none', color: tab===t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab===t ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'cobranças' && (
        <>
          <div style={S.bar}>
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
              style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface)', color:'var(--cream)', fontSize:13 }}>
              <option value=''>Todos os status</option>
              <option value='pendente'>Pendente</option>
              <option value='pago'>Pago</option>
              <option value='vencido'>Vencido</option>
              <option value='cancelado'>Cancelado</option>
            </select>
            <input type='month' value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}
              style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface)', color:'var(--cream)', fontSize:13 }} />
            {(filtroStatus||filtroMes) && (
              <button onClick={()=>{setFiltroStatus('');setFiltroMes('')}}
                style={{ ...S.btn, background:'none', color:'var(--muted)', border:'1px solid var(--line)' }}>Limpar</button>
            )}
            <span style={{ marginLeft:'auto', fontSize:12, color:'var(--muted)' }}>{listaFiltrada.length} registros</span>
          </div>
          {loading ? <div style={{ color:'var(--muted)', padding:24 }}>Carregando…</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Sócio</th>
                    <th style={S.th}>Plano</th>
                    <th style={S.th}>Valor</th>
                    <th style={S.th}>Vencimento</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Pago em</th>
                    <th style={S.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.length===0 && (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'var(--muted)', padding:32 }}>Nenhuma cobrança encontrada</td></tr>
                  )}
                  {listaFiltrada.map(m=>{
                    const st=statusReal(m)
                    return (
                      <tr key={m.id}>
                        <td style={S.td}><b>{m.socioNome}</b></td>
                        <td style={{ ...S.td, color:'var(--muted)' }}>{m.planoNome||'—'}</td>
                        <td style={{ ...S.td, fontWeight:700, color:'var(--green)' }}>{fmtR(m.valor)}</td>
                        <td style={S.td}>{fmtData(m.vencimento)}</td>
                        <td style={S.td}><span style={S.badge(st)}>{STATUS_COLOR[st]?.label||st}</span></td>
                        <td style={{ ...S.td, color:'var(--muted)' }}>{m.pagoEm ? fmtData(m.pagoEm.slice(0,10)) : '—'}</td>
                        <td style={S.td}>
                          <div style={{ display:'flex', gap:6 }}>
                            {m.status==='pendente' && (
                              <button onClick={()=>marcarPago(m.id)}
                                style={{ ...S.btn, padding:'4px 10px', background:'#d1fae5', color:'#065f46', fontSize:11 }}>✓ Pago</button>
                            )}
                            {m.status==='pendente' && (
                              <button onClick={()=>cancelar(m.id)}
                                style={{ ...S.btn, padding:'4px 10px', background:'#fef3c7', color:'#92400e', fontSize:11 }}>Cancelar</button>
                            )}
                            <button onClick={()=>excluir(m.id)}
                              style={{ ...S.btn, padding:'4px 10px', background:'#fee2e2', color:'#991b1b', fontSize:11 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'planos' && (
        <>
          <div style={S.bar}>
            <button onClick={()=>{setFormPlano({nome:'',valor:'',periodicidade:'mensal',descricao:''}); setModalPlano({})}}
              style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>+ Novo Plano</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {planos.length===0 && <div style={{ color:'var(--muted)', padding:16 }}>Nenhum plano cadastrado.</div>}
            {planos.map(p=>(
              <div key={p.id} style={{ ...S.card, position:'relative' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--cream)', marginBottom:4 }}>{p.nome}</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--green)', marginBottom:4 }}>{fmtR(p.valor)}</div>
                <div style={{ fontSize:11, color:'var(--muted)', textTransform:'capitalize', marginBottom:6 }}>{p.periodicidade}</div>
                {p.descricao && <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>{p.descricao}</div>}
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>{setFormPlano({...p}); setModalPlano(p)}}
                    style={{ ...S.btn, padding:'4px 10px', background:'var(--surface)', border:'1px solid var(--line)', color:'var(--cream)', fontSize:11 }}>Editar</button>
                  <button onClick={()=>excluirPlano(p.id)}
                    style={{ ...S.btn, padding:'4px 10px', background:'#fee2e2', color:'#991b1b', fontSize:11 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal nova cobrança */}
      {modalNova && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={salvarNova} style={{ background:'var(--surface)', borderRadius:12, padding:28, width:420, maxWidth:'95vw' }}>
            <h3 style={{ marginBottom:18, color:'var(--cream)' }}>Nova Cobrança</h3>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Sócio *</span>
              <select required value={form.socioId} onChange={e=>{
                const s=socios.find(x=>x.id==e.target.value)
                const p=planos.find(x=>x.id==s?.planoId)
                setForm(f=>({...f,socioId:e.target.value,planoId:s?.planoId||'',valor:p?.valor||f.valor}))
              }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Selecione…</option>
                {socios.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Plano</span>
              <select value={form.planoId||''} onChange={e=>{
                const p=planos.find(x=>x.id==e.target.value)
                setForm(f=>({...f,planoId:e.target.value,valor:p?.valor||f.valor}))
              }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Sem plano</option>
                {planos.map(p=><option key={p.id} value={p.id}>{p.nome} — {fmtR(p.valor)}</option>)}
              </select>
            </label>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Valor (R$) *</span>
              <input required type='number' min='0.01' step='0.01' value={form.valor}
                onChange={e=>setForm(f=>({...f,valor:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <label style={{ display:'block', marginBottom:16 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Vencimento *</span>
              <input required type='date' value={form.vencimento}
                onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type='button' onClick={()=>setModalNova(false)}
                style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button type='submit' style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal gerar lote */}
      {modalGerar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={gerarLote} style={{ background:'var(--surface)', borderRadius:12, padding:28, width:380, maxWidth:'95vw' }}>
            <h3 style={{ marginBottom:6, color:'var(--cream)' }}>⚡ Gerar Cobranças em Lote</h3>
            <p style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>Gera uma cobrança para cada sócio ativo que possui plano vinculado, para o mês selecionado.</p>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Mês de referência *</span>
              <input required type='month' value={formGerar.mes} onChange={e=>setFormGerar(f=>({...f,mes:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <label style={{ display:'block', marginBottom:18 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Filtrar por plano (opcional)</span>
              <select value={formGerar.planoId} onChange={e=>setFormGerar(f=>({...f,planoId:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Todos os planos</option>
                {planos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type='button' onClick={()=>setModalGerar(false)}
                style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button type='submit' style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>Gerar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal plano */}
      {modalPlano !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={salvarPlano} style={{ background:'var(--surface)', borderRadius:12, padding:28, width:380, maxWidth:'95vw' }}>
            <h3 style={{ marginBottom:18, color:'var(--cream)' }}>{modalPlano?.id ? 'Editar Plano' : 'Novo Plano'}</h3>
            {['nome','valor','periodicidade','descricao'].map(f=>(
              <label key={f} style={{ display:'block', marginBottom:12 }}>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4, textTransform:'capitalize' }}>
                  {f}{f==='nome'||f==='valor'?' *':''}
                </span>
                {f==='periodicidade' ? (
                  <select value={formPlano[f]} onChange={e=>setFormPlano(p=>({...p,[f]:e.target.value}))}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                    <option value='mensal'>Mensal</option>
                    <option value='trimestral'>Trimestral</option>
                    <option value='semestral'>Semestral</option>
                    <option value='anual'>Anual</option>
                  </select>
                ) : (
                  <input required={f==='nome'||f==='valor'} type={f==='valor'?'number':'text'}
                    value={formPlano[f]} onChange={e=>setFormPlano(p=>({...p,[f]:e.target.value}))}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
                )}
              </label>
            ))}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
              <button type='button' onClick={()=>setModalPlano(null)}
                style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button type='submit' style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
