import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtR = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const mesLabel = s => { const [y, m] = s.split('-'); return `${m}/${y}` }

const STATUS_COLOR = {
  pendente:  { bg:'#fef3c7', color:'#92400e', label:'Pendente' },
  pago:      { bg:'#d1fae5', color:'#065f46', label:'Pago' },
  vencido:   { bg:'#fee2e2', color:'#991b1b', label:'Vencido' },
  cancelado: { bg:'#f3f4f6', color:'#6b7280', label:'Cancelado' },
}

function statusReal(m) {
  if (m.status === 'pago')      return 'pago'
  if (m.status === 'cancelado') return 'cancelado'
  const hoje = new Date().toISOString().slice(0, 10)
  if (m.vencimento < hoje) return 'vencido'
  return 'pendente'
}

function exportCSV(lista, hoje) {
  const headers = ['Sócio','Plano','Valor','Vencimento','Status','Pago Em']
  const rows = lista.map(m => {
    const st = m.status === 'pago' ? 'Pago' : m.status === 'cancelado' ? 'Cancelado' : m.vencimento < hoje ? 'Vencido' : 'Pendente'
    return [m.socioNome, m.planoNome||'—', fmtR(m.valor), fmtData(m.vencimento), st, m.pagoEm ? fmtData(m.pagoEm.slice(0,10)) : '—']
  })
  const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=`mensalidades_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const S = {
  page:   { padding:'24px 28px', maxWidth:1100 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 },
  title:  { fontSize:22, fontWeight:800, color:'var(--cream)' },
  cards:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))', gap:12, marginBottom:24 },
  card:   { background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'14px 18px' },
  cNum:   { fontSize:24, fontWeight:800, color:'var(--green)', marginBottom:2 },
  cLbl:   { fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px' },
  bar:    { display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
  table:  { width:'100%', borderCollapse:'collapse', background:'var(--surface)', borderRadius:10, overflow:'hidden', border:'1px solid var(--line)' },
  th:     { padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', borderBottom:'1px solid var(--line)', background:'rgba(0,0,0,.03)' },
  td:     { padding:'10px 14px', fontSize:13, borderBottom:'1px solid var(--line)' },
  badge:  (st) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700,
    background:(STATUS_COLOR[st] || STATUS_COLOR.pendente).bg, color:(STATUS_COLOR[st] || STATUS_COLOR.pendente).color }),
  btn:    { padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:12 },
}

/* ── Chip de filtro rápido ── */
function FilterChip({ label, active, onClick, count, color }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 14px', borderRadius:20, border:`1.5px solid ${active ? (color || 'var(--green)') : 'var(--line)'}`,
      background: active ? (color ? color + '22' : 'rgba(255,107,44,.15)') : 'transparent',
      color: active ? (color || 'var(--green)') : 'var(--muted)',
      cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
    }}>
      {label}
      {count !== undefined && (
        <span style={{ background: active ? (color || 'var(--green)') : 'var(--line)', color: active ? '#fff' : 'var(--muted)', borderRadius:10, padding:'1px 6px', fontSize:10 }}>
          {count}
        </span>
      )}
    </button>
  )
}

/* ── Modal WhatsApp Cobrar ── */
function ModalWpp({ mens, onClose, toast }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [selecionados, setSelecionados] = useState(() => {
    return mens.filter(m => {
      const st = statusReal(m)
      return st === 'vencido' || st === 'pendente'
    }).map(m => m.id)
  })
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const pendentesVencidos = mens.filter(m => {
    const st = statusReal(m)
    return st === 'vencido' || st === 'pendente'
  })

  function toggle(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function enviar() {
    if (selecionados.length === 0) return toast('Selecione ao menos um sócio', true)
    setEnviando(true)
    try {
      const r = await api.post('/api/admin/whatsapp/cobrar', { ids: selecionados })
      setResultado(r)
      toast(`✅ ${r.enviados} mensagens enviadas de ${r.total}`)
    } catch(e) {
      toast(e.message || 'Erro ao enviar', true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:14, padding:28, width:540, maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ margin:0, color:'var(--cream)', fontSize:17 }}>📱 WhatsApp — Cobrar Mensalidades</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {resultado ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>
              {resultado.enviados === resultado.total ? '✅' : '⚠️'}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--cream)', marginBottom:8 }}>
              {resultado.enviados} de {resultado.total} mensagens enviadas
            </div>
            {resultado.resultados?.slice(0, 8).map((r, i) => (
              <div key={i} style={{ fontSize:12, color: r.ok ? 'var(--green)' : '#ef4444', marginBottom:3 }}>
                {r.ok ? '✓' : '✗'} {r.nome || r.id}
              </div>
            ))}
            <button onClick={onClose} style={{ ...S.btn, background:'var(--green)', color:'var(--deep)', marginTop:20 }}>Fechar</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
              Selecione os sócios para enviar lembretes de mensalidade via WhatsApp.
            </p>
            <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
              <button onClick={() => setSelecionados(pendentesVencidos.map(m => m.id))}
                style={{ ...S.btn, padding:'4px 10px', background:'rgba(255,107,44,.15)', color:'var(--green)', fontSize:11 }}>
                Selecionar todos ({pendentesVencidos.length})
              </button>
              <button onClick={() => setSelecionados([])}
                style={{ ...S.btn, padding:'4px 10px', background:'none', border:'1px solid var(--line)', color:'var(--muted)', fontSize:11 }}>
                Limpar
              </button>
            </div>
            <div style={{ overflowY:'auto', flex:1, marginBottom:16 }}>
              {pendentesVencidos.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>Nenhuma cobrança pendente ou vencida.</div>
              ) : pendentesVencidos.map(m => {
                const st = statusReal(m)
                const sel = selecionados.includes(m.id)
                return (
                  <div key={m.id} onClick={() => toggle(m.id)} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8, marginBottom:6, cursor:'pointer',
                    background: sel ? 'rgba(255,107,44,.08)' : 'transparent', border:`1px solid ${sel ? 'var(--green)' : 'var(--line)'}`,
                  }}>
                    <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${sel ? 'var(--green)' : 'var(--line)'}`,
                      background: sel ? 'var(--green)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--deep)', flexShrink:0 }}>
                      {sel && '✓'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:'var(--cream)', fontSize:13 }}>{m.socioNome}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{m.planoNome || '—'} · Vence {fmtData(m.vencimento)}</div>
                    </div>
                    <div style={{ fontWeight:700, color: st === 'vencido' ? '#ef4444' : 'var(--gold)', fontSize:13 }}>{fmtR(m.valor)}</div>
                    <span style={S.badge(st)}>{STATUS_COLOR[st]?.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:12, borderTop:'1px solid var(--line)' }}>
              <button onClick={onClose} style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando || selecionados.length === 0}
                style={{ ...S.btn, background: selecionados.length === 0 ? 'var(--line)' : '#25D366', color:'#fff', opacity: enviando ? 0.7 : 1 }}>
                {enviando ? 'Enviando…' : `📱 Enviar (${selecionados.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function Mensalidades() {
  const { toast } = useToast()
  const [tab, setTab] = useState('cobranças')
  const [mens, setMens] = useState([])
  const [planos, setPlanos] = useState([])
  const [socios, setSocios] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [buscaSocio, setBuscaSocio] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalGerar, setModalGerar] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [modalPlano, setModalPlano] = useState(null)
  const [modalWpp, setModalWpp] = useState(false)
  const [form, setForm] = useState({ socioId:'', valor:'', vencimento:'', obs:'' })
  const [formPlano, setFormPlano] = useState({ nome:'', valor:'', periodicidade:'mensal', descricao:'' })
  const [formGerar, setFormGerar] = useState({ mes: new Date().toISOString().slice(0, 7), planoId:'' })

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

  const hoje = new Date().toISOString().slice(0, 10)

  /* KPI derivados */
  const pagas     = mens.filter(m => m.status === 'pago')
  const pendentes = mens.filter(m => m.status !== 'pago' && m.status !== 'cancelado')
  const vencidas  = pendentes.filter(m => m.vencimento < hoje)
  const aPrazo    = pendentes.filter(m => m.vencimento >= hoje)
  const totalPago = pagas.reduce((s, m) => s + m.valor, 0)
  const totalPend = pendentes.reduce((s, m) => s + m.valor, 0)
  const totalVenc = vencidas.reduce((s, m) => s + m.valor, 0)
  const inadTaxa  = mens.length > 0 ? ((vencidas.length / mens.length) * 100).toFixed(1) : 0

  /* Filtros */
  const listaFiltrada = useMemo(() => {
    let base = mens
    if (filtroStatus) base = base.filter(m => statusReal(m) === filtroStatus)
    if (filtroMes)    base = base.filter(m => (m.vencimento || '').startsWith(filtroMes))
    if (buscaSocio)   base = base.filter(m => (m.socioNome||'').toLowerCase().includes(buscaSocio.toLowerCase()))
    return base
  }, [mens, filtroStatus, filtroMes, buscaSocio])

  /* CRUD */
  async function marcarPago(id) {
    try { await api.patch(`/api/admin/mensalidades/${id}`, { status:'pago' }); toast('Marcado como pago'); load() }
    catch(e) { toast(e.message, true) }
  }

  async function cancelar(id) {
    if (!confirm('Cancelar esta cobrança?')) return
    try { await api.patch(`/api/admin/mensalidades/${id}`, { status:'cancelado' }); toast('Cancelada'); load() }
    catch(e) { toast(e.message, true) }
  }

  async function excluir(id) {
    if (!confirm('Excluir cobrança?')) return
    try { await api.delete(`/api/admin/mensalidades/${id}`); toast('Excluída'); load() }
    catch(e) { toast(e.message, true) }
  }

  async function salvarNova(e) {
    e.preventDefault()
    const socio = socios.find(s => s.id == form.socioId)
    const plano = planos.find(p => p.id == form.planoId)
    try {
      await api.post('/api/admin/mensalidades', { ...form, socioNome:socio?.nome || '', planoNome:plano?.nome || '' })
      toast('Cobrança criada'); setModalNova(false); setForm({ socioId:'', valor:'', vencimento:'', obs:'' }); load()
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
      if (modalPlano?.id) {
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
    if (!confirm('Excluir plano?')) return
    try { await api.delete(`/api/admin/mensalidades/planos/${id}`); toast('Plano excluído'); load() }
    catch(e) { toast(e.message, true) }
  }

  /* chips count */
  const counts = {
    '': listaFiltrada.length,
    pago: mens.filter(m => statusReal(m) === 'pago').length,
    pendente: mens.filter(m => statusReal(m) === 'pendente').length,
    vencido: mens.filter(m => statusReal(m) === 'vencido').length,
    cancelado: mens.filter(m => statusReal(m) === 'cancelado').length,
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>💳 Mensalidades</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button style={{ ...S.btn, background:'rgba(255,107,44,.15)', color:'var(--green)', border:'1px solid var(--green)' }}
            onClick={() => exportCSV(listaFiltrada, hoje)}>📥 CSV</button>
          <button style={{ ...S.btn, background:'#25D366', color:'#fff' }}
            onClick={() => setModalWpp(true)}>
            📱 WhatsApp Cobrar
          </button>
          <button style={{ ...S.btn, background:'var(--surface)', border:'1px solid var(--line)', color:'var(--cream)' }}
            onClick={() => setModalGerar(true)}>⚡ Gerar Lote</button>
          <button style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}
            onClick={() => setModalNova(true)}>+ Nova Cobrança</button>
        </div>
      </div>

      {/* KPI cards detalhados */}
      <div style={S.cards}>
        <div style={{ ...S.card, borderTop:'3px solid var(--green)' }}>
          <div style={{ ...S.cNum, color:'var(--green)' }}>{fmtR(totalPago)}</div>
          <div style={S.cLbl}>Recebido</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{pagas.length} cobranças pagas</div>
        </div>
        <div style={{ ...S.card, borderTop:'3px solid var(--gold)' }}>
          <div style={{ ...S.cNum, color:'var(--gold)' }}>{fmtR(totalPend)}</div>
          <div style={S.cLbl}>Pendente</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{aPrazo.length} no prazo · {vencidas.length} vencidas</div>
        </div>
        <div style={{ ...S.card, borderTop:'3px solid #ef4444' }}>
          <div style={{ ...S.cNum, color:'#ef4444' }}>{fmtR(totalVenc)}</div>
          <div style={S.cLbl}>Vencido (a receber)</div>
          <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{vencidas.length} inadimplentes</div>
        </div>
        <div style={{ ...S.card, borderTop:'3px solid #ef4444' }}>
          <div style={{ ...S.cNum, color: parseFloat(inadTaxa) > 20 ? '#ef4444' : 'var(--gold)' }}>{inadTaxa}%</div>
          <div style={S.cLbl}>Taxa Inadimplência</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>meta: &lt;20%</div>
        </div>
        <div style={{ ...S.card }}>
          <div style={S.cNum}>{mens.length}</div>
          <div style={S.cLbl}>Total cobranças</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{pagas.length} pagas / {pendentes.length} pendentes</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--line)' }}>
        {['cobranças','planos'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 18px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
            background:'none', color: tab === t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'cobranças' && (
        <>
          {/* Busca por sócio */}
          <div style={{ marginBottom:10 }}>
            <input value={buscaSocio} onChange={e => setBuscaSocio(e.target.value)}
              placeholder="🔍 Buscar por nome do sócio…"
              style={{ width:'100%', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--line)',
                borderRadius:8, color:'var(--cream)', fontSize:13, boxSizing:'border-box' }} />
          </div>
          {/* Filter chips rápidos */}
          <div style={S.bar}>
            <FilterChip label="Todos" active={filtroStatus === ''} onClick={() => setFiltroStatus('')} count={counts['']} />
            <FilterChip label="✓ Pagos" active={filtroStatus === 'pago'} onClick={() => setFiltroStatus('pago')} count={counts.pago} color='#065f46' />
            <FilterChip label="⏳ Pendentes" active={filtroStatus === 'pendente'} onClick={() => setFiltroStatus('pendente')} count={counts.pendente} color='#92400e' />
            <FilterChip label="🔴 Vencidos" active={filtroStatus === 'vencido'} onClick={() => setFiltroStatus('vencido')} count={counts.vencido} color='#991b1b' />
            <FilterChip label="✕ Cancelados" active={filtroStatus === 'cancelado'} onClick={() => setFiltroStatus('cancelado')} count={counts.cancelado} color='#6b7280' />
            <input type='month' value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
              style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface)', color:'var(--cream)', fontSize:12, marginLeft:8 }} />
            {filtroMes && (
              <button onClick={() => setFiltroMes('')} style={{ ...S.btn, padding:'4px 8px', background:'none', color:'var(--muted)', border:'1px solid var(--line)', fontSize:11 }}>✕</button>
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
                  {listaFiltrada.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'var(--muted)', padding:32 }}>Nenhuma cobrança encontrada</td></tr>
                  )}
                  {listaFiltrada.map(m => {
                    const st = statusReal(m)
                    const isVencida = st === 'vencido'
                    return (
                      <tr key={m.id} style={{
                        background: isVencida ? 'rgba(239,68,68,.06)' : undefined,
                        borderLeft: isVencida ? '3px solid #ef4444' : undefined,
                      }}>
                        <td style={S.td}><b style={{ color: isVencida ? '#ef4444' : 'var(--cream)' }}>{m.socioNome}</b></td>
                        <td style={{ ...S.td, color:'var(--muted)' }}>{m.planoNome || '—'}</td>
                        <td style={{ ...S.td, fontWeight:700, color: isVencida ? '#ef4444' : 'var(--green)' }}>{fmtR(m.valor)}</td>
                        <td style={{ ...S.td, color: isVencida ? '#ef4444' : undefined, fontWeight: isVencida ? 700 : 400 }}>
                          {fmtData(m.vencimento)}
                          {isVencida && <span style={{ fontSize:10, display:'block', color:'#ef4444' }}>
                            {Math.floor((new Date() - new Date(m.vencimento + 'T12:00:00')) / 86400000)}d atrasado
                          </span>}
                        </td>
                        <td style={S.td}><span style={S.badge(st)}>{STATUS_COLOR[st]?.label || st}</span></td>
                        <td style={{ ...S.td, color:'var(--muted)' }}>{m.pagoEm ? fmtData(m.pagoEm.slice(0, 10)) : '—'}</td>
                        <td style={S.td}>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {m.status === 'pendente' && (
                              <button onClick={() => marcarPago(m.id)}
                                style={{ ...S.btn, padding:'4px 10px', background:'#d1fae5', color:'#065f46', fontSize:11 }}>✓ Pago</button>
                            )}
                            {m.status === 'pendente' && (
                              <button onClick={() => cancelar(m.id)}
                                style={{ ...S.btn, padding:'4px 10px', background:'#fef3c7', color:'#92400e', fontSize:11 }}>Cancelar</button>
                            )}
                            <button onClick={() => excluir(m.id)}
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
            <button onClick={() => { setFormPlano({ nome:'', valor:'', periodicidade:'mensal', descricao:'' }); setModalPlano({}) }}
              style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>+ Novo Plano</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {planos.length === 0 && <div style={{ color:'var(--muted)', padding:16 }}>Nenhum plano cadastrado.</div>}
            {planos.map(p => (
              <div key={p.id} style={S.card}>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--cream)', marginBottom:4 }}>{p.nome}</div>
                <div style={{ fontSize:26, fontWeight:900, color:'var(--green)', marginBottom:4 }}>{fmtR(p.valor)}</div>
                <div style={{ fontSize:11, color:'var(--muted)', textTransform:'capitalize', marginBottom:6 }}>{p.periodicidade}</div>
                {p.descricao && <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>{p.descricao}</div>}
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setFormPlano({ ...p }); setModalPlano(p) }}
                    style={{ ...S.btn, padding:'4px 10px', background:'var(--surface)', border:'1px solid var(--line)', color:'var(--cream)', fontSize:11 }}>Editar</button>
                  <button onClick={() => excluirPlano(p.id)}
                    style={{ ...S.btn, padding:'4px 10px', background:'#fee2e2', color:'#991b1b', fontSize:11 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal WhatsApp */}
      {modalWpp && <ModalWpp mens={mens} onClose={() => setModalWpp(false)} toast={toast} />}

      {/* Modal nova cobrança */}
      {modalNova && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={salvarNova} style={{ background:'var(--surface)', borderRadius:12, padding:28, width:420, maxWidth:'95vw' }}>
            <h3 style={{ marginBottom:18, color:'var(--cream)' }}>Nova Cobrança</h3>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Sócio *</span>
              <select required value={form.socioId} onChange={e => {
                const s = socios.find(x => x.id == e.target.value)
                const p = planos.find(x => x.id == s?.planoId)
                setForm(f => ({ ...f, socioId:e.target.value, planoId:s?.planoId || '', valor:p?.valor || f.valor }))
              }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Selecione…</option>
                {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Plano</span>
              <select value={form.planoId || ''} onChange={e => {
                const p = planos.find(x => x.id == e.target.value)
                setForm(f => ({ ...f, planoId:e.target.value, valor:p?.valor || f.valor }))
              }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Sem plano</option>
                {planos.map(p => <option key={p.id} value={p.id}>{p.nome} — {fmtR(p.valor)}</option>)}
              </select>
            </label>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Valor (R$) *</span>
              <input required type='number' min='0.01' step='0.01' value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor:e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <label style={{ display:'block', marginBottom:16 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Vencimento *</span>
              <input required type='date' value={form.vencimento}
                onChange={e => setForm(f => ({ ...f, vencimento:e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type='button' onClick={() => setModalNova(false)}
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
            <p style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>Gera uma cobrança para cada sócio ativo com plano vinculado no mês selecionado.</p>
            <label style={{ display:'block', marginBottom:12 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Mês de referência *</span>
              <input required type='month' value={formGerar.mes} onChange={e => setFormGerar(f => ({ ...f, mes:e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
            </label>
            <label style={{ display:'block', marginBottom:18 }}>
              <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4 }}>Filtrar por plano (opcional)</span>
              <select value={formGerar.planoId} onChange={e => setFormGerar(f => ({ ...f, planoId:e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                <option value=''>Todos os planos</option>
                {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type='button' onClick={() => setModalGerar(false)}
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
            {['nome','valor','periodicidade','descricao'].map(f => (
              <label key={f} style={{ display:'block', marginBottom:12 }}>
                <span style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4, textTransform:'capitalize' }}>
                  {f}{f === 'nome' || f === 'valor' ? ' *' : ''}
                </span>
                {f === 'periodicidade' ? (
                  <select value={formPlano[f]} onChange={e => setFormPlano(p => ({ ...p, [f]:e.target.value }))}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }}>
                    <option value='mensal'>Mensal</option>
                    <option value='trimestral'>Trimestral</option>
                    <option value='semestral'>Semestral</option>
                    <option value='anual'>Anual</option>
                  </select>
                ) : (
                  <input required={f === 'nome' || f === 'valor'} type={f === 'valor' ? 'number' : 'text'}
                    value={formPlano[f]} onChange={e => setFormPlano(p => ({ ...p, [f]:e.target.value }))}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--cream)' }} />
                )}
              </label>
            ))}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
              <button type='button' onClick={() => setModalPlano(null)}
                style={{ ...S.btn, background:'none', border:'1px solid var(--line)', color:'var(--muted)' }}>Cancelar</button>
              <button type='submit' style={{ ...S.btn, background:'var(--green)', color:'var(--deep)' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
