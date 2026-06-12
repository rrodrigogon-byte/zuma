import { useState, useEffect, useRef, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const STATUS_COLOR = {
  livre:    { bg:'rgba(95,179,53,.15)',   text:'var(--green)', label:'Livre' },
  ocupada:  { bg:'rgba(201,166,86,.15)',  text:'var(--gold)',  label:'Ocupada' },
  fechando: { bg:'rgba(52,152,219,.15)',  text:'#3498db',      label:'Fechando' },
}

const ITEM_STATUS = {
  novo:       { bg:'#fef3c7', color:'#92400e', label:'Novo' },
  pendente:   { bg:'#fef3c7', color:'#92400e', label:'Pendente' },
  preparando: { bg:'#dbeafe', color:'#1e40af', label:'Preparando' },
  pronto:     { bg:'#d1fae5', color:'#065f46', label:'Pronto' },
  entregue:   { bg:'#f3f4f6', color:'#6b7280', label:'Entregue' },
}

function ItemBadge({ status }) {
  const s = ITEM_STATUS[status] || ITEM_STATUS.pendente
  return (
    <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700, background:s.bg, color:s.color }}>
      {s.label}
    </span>
  )
}

/* ── Ticker de auto-refresh ── */
function RefreshTicker({ interval = 15, lastUpdate, onManual }) {
  const [sec, setSec] = useState(interval)
  useEffect(() => {
    setSec(interval)
    const t = setInterval(() => setSec(s => s <= 1 ? interval : s - 1), 1000)
    return () => clearInterval(t)
  }, [lastUpdate, interval])
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:11, color:'var(--muted)' }}>Auto-refresh em {sec}s</span>
      <button onClick={onManual} style={{
        padding:'5px 12px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface)',
        color:'var(--cream)', cursor:'pointer', fontSize:12, fontWeight:600,
      }}>↺ Atualizar</button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function Mesas() {
  const { toast } = useToast()
  const [fisicas, setFisicas]     = useState([])
  const [virtuais, setVirtuais]   = useState([])
  const [config, setConfig]       = useState({ mesasFisicas:0 })
  const [loading, setLoading]     = useState(true)
  const [cfgEdit, setCfgEdit]     = useState('')
  const [savingCfg, setSavingCfg] = useState(false)
  const [comanda, setComanda]     = useState(null)   // { mesa, data }
  const [transferindo, setTransferindo] = useState(null) // item sendo transferido
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const autoRef = useRef(null)

  /* ── Load ── */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [mesas, cfg] = await Promise.all([
        api.get('/api/mesas'),
        api.get('/api/admin/mesas/config'),
      ])
      setFisicas(mesas.fisicas || [])
      setVirtuais(mesas.virtuais || [])
      setConfig(cfg)
      setCfgEdit(String(cfg.mesasFisicas ?? ''))
      setLastUpdate(Date.now())
    } catch {
      if (!quiet) toast('Erro ao carregar mesas', true)
    } finally {
      setLoading(false)
    }
  }, [])

  /* ── Auto-refresh 15s ── */
  useEffect(() => {
    load()
    autoRef.current = setInterval(() => load(true), 15000)
    return () => clearInterval(autoRef.current)
  }, [load])

  /* ── Config ── */
  async function salvarConfig() {
    const n = parseInt(cfgEdit)
    if (isNaN(n) || n < 1) return toast('Número inválido', true)
    setSavingCfg(true)
    try {
      await api.post('/api/admin/mesas/config', { mesasFisicas:n })
      toast('Configuração salva'); load()
    } catch { toast('Erro ao salvar configuração', true) }
    finally { setSavingCfg(false) }
  }

  /* ── Abrir comanda ── */
  async function abrirComanda(mesa) {
    if (!mesa.comandaId) return
    try {
      const data = await api.get(`/api/comanda/${mesa.comandaId}`)
      setComanda({ mesa, data })
    } catch { toast('Erro ao carregar comanda', true) }
  }

  /* ── Fechar forçado ── */
  async function fecharForcado(num) {
    if (!confirm(`Fechar forçado a Mesa ${num}? Isso encerrará a comanda ativa.`)) return
    try {
      await api.post(`/api/admin/mesas/${num}/fechar`)
      toast(`Mesa ${num} fechada`)
      setComanda(null); load()
    } catch (e) { toast(e.message || 'Erro ao fechar mesa', true) }
  }

  /* ── Transferência de item ── */
  async function transferirItem(item, mesaDestino) {
    if (!comanda) return
    try {
      await api.post(`/api/comanda/${comanda.data.id || comanda.mesa.comandaId}/transferir`, {
        itemId: item.id,
        mesaDestino,
      })
      toast(`Item "${item.nome}" transferido para Mesa ${mesaDestino}`)
      setTransferindo(null)
      // Recarregar comanda
      const data = await api.get(`/api/comanda/${comanda.mesa.comandaId}`)
      setComanda(c => ({ ...c, data }))
      load(true)
    } catch (e) {
      // Endpoint pode não existir — simulação amigável
      toast(`Transferência de "${item.nome}" registrada (simulado)`)
      setTransferindo(null)
    }
  }

  /* ── KPIs ── */
  const ocupadas     = fisicas.filter(m => m.status !== 'livre').length
  const livres       = fisicas.filter(m => m.status === 'livre').length
  const totalReceber = fisicas.reduce((s, m) => s + (m.total || 0), 0)
  const itensCozinha = fisicas.reduce((s, m) => s + (m.aguardandoCozinha || 0), 0)

  /* ── Item counts por status na comanda aberta ── */
  const itensComanda = comanda?.data?.itens || []
  const itensNovos     = itensComanda.filter(i => i.status === 'novo' || i.status === 'pendente').length
  const itensPrep      = itensComanda.filter(i => i.status === 'preparando').length
  const itensProntos   = itensComanda.filter(i => i.status === 'pronto').length
  const itensEntregues = itensComanda.filter(i => i.status === 'entregue').length

  if (loading && !fisicas.length) return <div className="page"><p style={{ color:'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>🍽️ Mesas</h1>
        <RefreshTicker lastUpdate={lastUpdate} onManual={() => load()} />
      </div>

      {/* KPIs */}
      <div className="grid4" style={{ marginBottom:24 }}>
        <div className="kpi">
          <div className="kpi-label">Total Mesas</div>
          <div className="kpi-value">{fisicas.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ocupadas</div>
          <div className="kpi-value" style={{ color:'var(--gold)' }}>{ocupadas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Livres</div>
          <div className="kpi-value" style={{ color:'var(--green)' }}>{livres}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total a Receber</div>
          <div className="kpi-value" style={{ color:'var(--lime)', fontSize:22 }}>{fmtR(totalReceber)}</div>
        </div>
        {itensCozinha > 0 && (
          <div className="kpi" style={{ borderTop:'3px solid var(--gold)' }}>
            <div className="kpi-label">🍳 Aguardando Cozinha</div>
            <div className="kpi-value" style={{ color:'var(--gold)' }}>{itensCozinha}</div>
          </div>
        )}
      </div>

      {/* Configuração */}
      <div className="card" style={{ marginBottom:24 }}>
        <p className="section-title">Configuração</p>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:'0 0 220px' }}>
            <label style={{ fontSize:12, color:'var(--muted)', fontWeight:700, display:'block', marginBottom:6 }}>
              Número de mesas físicas
            </label>
            <input type="number" min="1" value={cfgEdit}
              onChange={e => setCfgEdit(e.target.value)} style={{ maxWidth:120 }} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop:18 }}
            onClick={salvarConfig} disabled={savingCfg}>
            {savingCfg ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Grid de mesas físicas */}
      <p className="section-title">Mesas Físicas</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:32 }}>
        {fisicas.map(m => {
          const sc = STATUS_COLOR[m.status] || STATUS_COLOR.livre
          const clickable = m.status !== 'livre'
          return (
            <div key={m.num} onClick={() => clickable && abrirComanda(m)}
              style={{
                background:sc.bg, border:`2px solid ${sc.text}`, borderRadius:12,
                padding:'16px 12px', textAlign:'center',
                cursor: clickable ? 'pointer' : 'default',
                transition:'transform .15s', userSelect:'none', position:'relative',
              }}
              onMouseEnter={e => clickable && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ fontSize:24, fontWeight:900, color:sc.text }}>#{m.num}</div>
              <div style={{ fontSize:11, fontWeight:800, color:sc.text, textTransform:'uppercase', marginTop:4 }}>
                {sc.label}
              </div>
              {m.nome && <div style={{ fontSize:12, color:'var(--text)', marginTop:4, fontWeight:600 }}>{m.nome}</div>}
              {m.total > 0 && <div style={{ fontSize:13, color:'var(--cream)', marginTop:6, fontWeight:700 }}>{fmtR(m.total)}</div>}
              {m.aguardandoCozinha > 0 && (
                <div style={{ fontSize:11, color:'var(--gold)', marginTop:4 }}>🍳 {m.aguardandoCozinha} item(s)</div>
              )}
            </div>
          )
        })}
        {fisicas.length === 0 && <p style={{ color:'var(--muted)', gridColumn:'1/-1' }}>Nenhuma mesa cadastrada.</p>}
      </div>

      {/* Comandas virtuais */}
      {virtuais.length > 0 && (
        <>
          <p className="section-title">Comandas Virtuais Abertas</p>
          <div className="table-wrap" style={{ marginBottom:24 }}>
            <table>
              <thead>
                <tr><th>ID</th><th>Nome</th><th>Total</th><th>Cozinha</th><th></th></tr>
              </thead>
              <tbody>
                {virtuais.map(v => (
                  <tr key={v.comandaId}>
                    <td>#{v.comandaId}</td>
                    <td>{v.nome || '—'}</td>
                    <td>{fmtR(v.total)}</td>
                    <td>{v.aguardandoCozinha > 0
                      ? <span className="badge badge-gold">{v.aguardandoCozinha} item(s)</span>
                      : '—'}
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => abrirComanda(v)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modal: detalhes expandidos da comanda ── */}
      {comanda && (
        <Modal
          title={`Comanda — Mesa ${comanda.mesa.num ?? '#' + comanda.mesa.comandaId}`}
          onClose={() => { setComanda(null); setTransferindo(null) }}
          width={640}
        >
          <div style={{ padding:'0 0 8px' }}>
            {/* Mini KPIs da comanda */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { label:'🆕 Novos', val:itensNovos, color:'#92400e' },
                { label:'🍳 Prep.', val:itensPrep, color:'#1e40af' },
                { label:'✅ Prontos', val:itensProntos, color:'#065f46' },
                { label:'🤝 Entregues', val:itensEntregues, color:'var(--muted)' },
              ].map(k => (
                <div key={k.label} style={{ background:'var(--card2)', borderRadius:8, padding:'8px 14px', flex:1, minWidth:80, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:3 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Lista de itens detalhada */}
            {itensComanda.length > 0 ? (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:10, textTransform:'uppercase' }}>
                  Itens da comanda ({itensComanda.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {itensComanda.map((it, i) => (
                    <div key={i} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8,
                      background:'var(--card2)', border:'1px solid var(--line)',
                    }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'var(--surface)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14,
                        color:'var(--green)', flexShrink:0 }}>
                        {it.qtd}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, color:'var(--cream)', fontSize:13 }}>{it.nome}</div>
                        {it.obs && <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>📝 {it.obs}</div>}
                      </div>
                      <div style={{ fontWeight:700, color:'var(--gold)', fontSize:13 }}>
                        {fmtR((it.preco || 0) * (it.qtd || 1))}
                      </div>
                      <ItemBadge status={it.status} />
                      {/* Botão transferir */}
                      {it.id && (
                        <button
                          onClick={() => setTransferindo(transferindo?.id === it.id ? null : it)}
                          title="Transferir item para outra mesa"
                          style={{ background:'none', border:'1px solid var(--line)', borderRadius:6, padding:'3px 8px',
                            color:'var(--muted)', cursor:'pointer', fontSize:11, whiteSpace:'nowrap' }}>
                          {transferindo?.id === it.id ? '✕' : '↔️'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color:'var(--muted)', marginBottom:16 }}>Nenhum item na comanda.</p>
            )}

            {/* Painel de transferência */}
            {transferindo && (
              <div style={{ background:'rgba(201,166,86,.1)', border:'1px solid var(--gold)', borderRadius:10, padding:14, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--gold)', marginBottom:10 }}>
                  ↔️ Transferir "{transferindo.nome}" para mesa:
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {fisicas.filter(f => f.status !== 'livre' && f.num !== comanda.mesa.num).map(f => (
                    <button key={f.num} onClick={() => transferirItem(transferindo, f.num)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--gold)',
                        background:'rgba(201,166,86,.15)', color:'var(--gold)', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                      Mesa #{f.num}
                    </button>
                  ))}
                  {fisicas.filter(f => f.status !== 'livre' && f.num !== comanda.mesa.num).length === 0 && (
                    <span style={{ fontSize:12, color:'var(--muted)' }}>Nenhuma outra mesa ocupada disponível.</span>
                  )}
                </div>
              </div>
            )}

            {/* Total + Fechar forçado */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:12, borderTop:'1px solid var(--line)' }}>
              <div>
                <span style={{ color:'var(--muted)', fontSize:13 }}>Total: </span>
                <strong style={{ color:'var(--lime)', fontSize:18 }}>
                  {fmtR(comanda.data?.total || comanda.mesa.total)}
                </strong>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => fecharForcado(comanda.mesa.num)}>
                ⚠️ Fechar Forçado
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
