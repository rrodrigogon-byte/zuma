import { useState, useEffect, useRef, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { barAdminPath } from '../../lib/bar-api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const STATUS_COLOR = {
  livre:    { bg:'rgba(255,107,44,.12)',   text:'#FF6B2C', label:'Livre' },
  ocupada:  { bg:'rgba(255,107,44,.15)',  text:'var(--gold)',  label:'Ocupada' },
  fechando: { bg:'rgba(52,152,219,.15)',  text:'#3498db',      label:'Fechando' },
}

const ITEM_STATUS = {
  novo:       { bg:'#fef3c7', color:'#92400e', label:'Novo' },
  pendente:   { bg:'#fef3c7', color:'#92400e', label:'Pendente' },
  preparando: { bg:'#dbeafe', color:'#1e40af', label:'Preparando' },
  pronto:     { bg:'#FFF9F5', color:'#12283F', label:'Pronto' },
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
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [mesaModal, setMesaModal]   = useState(null)
  const [mesaForm, setMesaForm]     = useState({ numero:'', nome:'', apelido:'', contaNome:'', contaId:'', observacao:'' })
  const [salvandoMesa, setSalvandoMesa] = useState(false)
  const [qrModal, setQrModal] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [pedidoPublicoConfig, setPedidoPublicoConfig] = useState({ confirmarGarcom: false, minutosSessao: 120, limiteItensPorPedido: 20 })
  const [salvandoPedidoPublico, setSalvandoPedidoPublico] = useState(false)
  const autoRef = useRef(null)

  /* ── Load ── */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [mesas, cfg, pedidoPublico] = await Promise.all([
        api.get(barAdminPath('/mesas')),
        api.get(barAdminPath('/mesas/config')),
        api.get(barAdminPath('/pedidos-publicos/config')),
      ])
      setFisicas(mesas.fisicas || [])
      setVirtuais(mesas.virtuais || [])
      setConfig(cfg)
      setPedidoPublicoConfig(pedidoPublico?.configuracao || { confirmarGarcom: false, minutosSessao: 120, limiteItensPorPedido: 20 })
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
      await api.post(barAdminPath('/mesas/config'), { mesasFisicas:n })
      toast('Configuração salva'); load()
    } catch { toast('Erro ao salvar configuração', true) }
    finally { setSavingCfg(false) }
  }

  async function salvarPedidoPublico() {
    setSalvandoPedidoPublico(true)
    try {
      const resposta = await api.patch(barAdminPath('/pedidos-publicos/config'), pedidoPublicoConfig)
      setPedidoPublicoConfig(resposta.configuracao || pedidoPublicoConfig); toast('Configuração do autoatendimento salva')
    } catch (erro) { toast(erro.message || 'Não foi possível salvar o autoatendimento', true) }
    finally { setSalvandoPedidoPublico(false) }
  }

  async function abrirQrMesa(mesa) {
    setQrLoading(true)
    try { const qr = await api.get(barAdminPath(`/mesas/${mesa.num}/qr`)); setQrModal({ mesa, ...qr }) }
    catch (erro) { toast(erro.message || 'Não foi possível gerar o QR Code', true) }
    finally { setQrLoading(false) }
  }

  async function rotacionarQrMesa() {
    if (!qrModal?.mesa || !confirm(`Rotacionar o QR Code da Mesa ${qrModal.mesa.num}? O código atualmente impresso deixará de funcionar.`)) return
    setQrLoading(true)
    try { await api.post(barAdminPath(`/mesas/${qrModal.mesa.num}/qr/rotacionar`), {}); toast('QR Code anterior invalidado. Gerando novo código…'); await abrirQrMesa(qrModal.mesa) }
    catch (erro) { toast(erro.message || 'Não foi possível rotacionar o QR Code', true) }
    finally { setQrLoading(false) }
  }

  function baixarQrMesa() {
    if (!qrModal?.dataUrl) return
    const link = document.createElement('a'); link.href = qrModal.dataUrl; link.download = `kytto-qr-mesa-${qrModal.mesa.num}.png`; link.click()
  }

  function abrirNovaMesa() {
    const proximo = fisicas.length ? Math.max(...fisicas.map(mesa => Number(mesa.num) || 0)) + 1 : 1
    setMesaForm({ numero: String(proximo), nome: `Mesa ${proximo}`, apelido:'', contaNome:'', contaId:'', observacao:'' })
    setMesaModal({ modo:'nova' })
  }

  function editarMesa(mesa) {
    setMesaForm({ numero:String(mesa.num), nome:mesa.nome || '', apelido:mesa.apelido || '', contaNome:mesa.contaNome || '', contaId:mesa.contaId || '', observacao:mesa.observacao || '' })
    setMesaModal({ modo:'editar', mesa })
  }

  async function salvarMesa() {
    const numero = Number(mesaForm.numero)
    if (!Number.isInteger(numero) || numero < 1) return toast('Informe um número de mesa válido', true)
    setSalvandoMesa(true)
    try {
      if (mesaModal?.modo === 'nova') {
        await api.post(barAdminPath('/mesas'), { ...mesaForm, numero })
        toast(`Mesa ${numero} cadastrada`)
      } else {
        await api.patch(barAdminPath(`/mesas/${mesaModal.mesa?.id || numero}`), { ...mesaForm, numero })
        toast(`Mesa ${numero} atualizada`)
      }
      setMesaModal(null)
      load()
    } catch (error) {
      toast(error.message || 'Erro ao salvar mesa', true)
    } finally {
      setSalvandoMesa(false)
    }
  }

  async function excluirMesa(mesa) {
    if (!confirm(`Remover a mesa ${mesa.num} do mapa? Só mesas livres podem ser removidas.`)) return
    try {
      await api.delete(barAdminPath(`/mesas/${mesa.id || mesa.num}`))
      toast(`Mesa ${mesa.num} removida`)
      setMesaModal(null)
      load()
    } catch (error) {
      toast(error.message || 'Não foi possível remover a mesa', true)
    }
  }

  /* ── Abrir comanda ── */
  async function abrirComanda(mesa) {
    if (!mesa.comandaId) return
    try {
      const data = await api.get(barAdminPath(`/comanda/${mesa.comandaId}`))
      setComanda({ mesa, data })
    } catch { toast('Erro ao carregar comanda', true) }
  }

  /* ── Fechar forçado ── */
  async function fecharForcado(num) {
    if (!confirm(`Fechar forçado a Mesa ${num}? Isso encerrará a comanda ativa.`)) return
    try {
      await api.post(barAdminPath(`/mesas/${num}/fechar`))
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
      const data = await api.get(barAdminPath(`/comanda/${comanda.mesa.comandaId}`))
      setComanda(c => ({ ...c, data }))
      load(true)
    } catch (e) {
      toast(e?.message || `Não foi possível transferir o item "${item.nome}"`, true)
      setTransferindo(null)
    }
  }

  /* ── KPIs ── */
  const ocupadas       = fisicas.filter(m => m.status !== 'livre').length
  const livres         = fisicas.filter(m => m.status === 'livre').length
  const totalReceber   = fisicas.reduce((s, m) => s + (m.total || 0), 0)
  const itensCozinha   = fisicas.reduce((s, m) => s + (m.aguardandoCozinha || 0), 0)
  const taxaOcupacao   = fisicas.length ? Math.round((ocupadas / fisicas.length) * 100) : 0
  const ocBarColor     = taxaOcupacao >= 90 ? '#e05c5c' : taxaOcupacao >= 70 ? '#FF6B2C' : '#FF6B2C'
  const totalComandas  = virtuais.length
  const mesaMaior      = fisicas.reduce((acc, m) => (m.total || 0) > (acc?.total || 0) ? m : acc, null)

  /* ── Mesas filtradas para o grid ── */
  const fisicasFiltradas = fisicas.filter(m => {
    const passaStatus = filtroStatus === 'todos' || m.status === filtroStatus
    const term = busca.toLowerCase()
    const passaBusca = !term || String(m.num).includes(term) || (m.nome || '').toLowerCase().includes(term)
    return passaStatus && passaBusca
  })

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
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={abrirNovaMesa}>+ Nova mesa</button>
          <RefreshTicker lastUpdate={lastUpdate} onManual={() => load()} />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        {/* Total */}
        <div className="kpi" style={{ borderLeft:'4px solid #FF6B2C' }}>
          <div className="kpi-label">Total Mesas</div>
          <div className="kpi-value">{fisicas.length}</div>
        </div>
        {/* Ocupadas */}
        <div className="kpi" style={{ borderLeft:'4px solid var(--gold)' }}>
          <div className="kpi-label">Ocupadas</div>
          <div className="kpi-value" style={{ color:'var(--gold)' }}>{ocupadas}</div>
        </div>
        {/* Livres */}
        <div className="kpi" style={{ borderLeft:'4px solid #FF9B72' }}>
          <div className="kpi-label">Livres</div>
          <div className="kpi-value" style={{ color:'#FF9B72' }}>{livres}</div>
        </div>
        {/* Taxa de ocupação */}
        <div className="kpi" style={{ borderLeft:`4px solid ${ocBarColor}` }}>
          <div className="kpi-label">Ocupação</div>
          <div className="kpi-value" style={{ color:ocBarColor }}>{taxaOcupacao}%</div>
          <div style={{ height:6, borderRadius:3, background:'var(--line)', marginTop:8 }}>
            <div style={{ height:'100%', borderRadius:3, background:ocBarColor, width:`${taxaOcupacao}%`, transition:'width .4s' }} />
          </div>
        </div>
        {/* Total a receber */}
        <div className="kpi" style={{ borderLeft:'4px solid #FFB703' }}>
          <div className="kpi-label">Faturamento Aberto</div>
          <div className="kpi-value" style={{ color:'#FFB703', fontSize:20 }}>{fmtR(totalReceber)}</div>
        </div>
        {/* Comandas virtuais */}
        {totalComandas > 0 && (
          <div className="kpi" style={{ borderLeft:'4px solid #3498db' }}>
            <div className="kpi-label">Comandas Virtuais</div>
            <div className="kpi-value" style={{ color:'#3498db' }}>{totalComandas}</div>
          </div>
        )}
        {/* Mesa top */}
        {mesaMaior && mesaMaior.total > 0 && (
          <div className="kpi" style={{ borderLeft:'4px solid var(--gold)' }}>
            <div className="kpi-label">🏆 Mesa Top</div>
            <div className="kpi-value" style={{ fontSize:16, color:'var(--gold)' }}>
              #{mesaMaior.num} · {fmtR(mesaMaior.total)}
            </div>
          </div>
        )}
        {/* Cozinha */}
        {itensCozinha > 0 && (
          <div className="kpi" style={{ borderLeft:'4px solid #e05c5c' }}>
            <div className="kpi-label">🍳 Aguardando Cozinha</div>
            <div className="kpi-value" style={{ color:'#e05c5c' }}>{itensCozinha}</div>
          </div>
        )}
      </div>

      {/* Configuração */}
      <div className="card" style={{ marginBottom:24 }}>
        <p className="section-title">Configuração</p>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:'0 0 220px' }}>
            <label style={{ fontSize:12, color:'var(--muted)', fontWeight:700, display:'block', marginBottom:6 }}>
              Criar mesas sequenciais até o número informado
            </label>
            <input type="number" min="1" value={cfgEdit}
              onChange={e => setCfgEdit(e.target.value)} style={{ maxWidth:120 }} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop:18 }}
            onClick={salvarConfig} disabled={savingCfg}>
            {savingCfg ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
        <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--line)' }}>
          <div style={{ fontWeight:800, color:'var(--cream)', marginBottom:8 }}>Autoatendimento por QR Code</div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'end' }}>
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, color:'var(--text)', cursor:'pointer' }}><input type="checkbox" checked={!!pedidoPublicoConfig.confirmarGarcom} onChange={e => setPedidoPublicoConfig(configuracao => ({ ...configuracao, confirmarGarcom:e.target.checked }))} /> Exigir confirmação da equipe antes de enviar ao KDS</label>
            <label style={{ fontSize:12, color:'var(--muted)' }}>Sessão (minutos)<input type="number" min="15" max="480" value={pedidoPublicoConfig.minutosSessao || 120} onChange={e => setPedidoPublicoConfig(configuracao => ({ ...configuracao, minutosSessao:e.target.value }))} style={{ display:'block', width:105, marginTop:5 }} /></label>
            <label style={{ fontSize:12, color:'var(--muted)' }}>Máximo de itens/pedido<input type="number" min="1" max="100" value={pedidoPublicoConfig.limiteItensPorPedido || 20} onChange={e => setPedidoPublicoConfig(configuracao => ({ ...configuracao, limiteItensPorPedido:e.target.value }))} style={{ display:'block', width:120, marginTop:5 }} /></label>
            <button className="btn btn-secondary btn-sm" onClick={salvarPedidoPublico} disabled={salvandoPedidoPublico}>{salvandoPedidoPublico ? 'Salvando…' : 'Salvar autoatendimento'}</button>
          </div>
          <p style={{ margin:'8px 0 0', color:'var(--muted)', fontSize:11 }}>Os QR Codes são exclusivos por mesa, usam sessão temporária e podem ser rotacionados a qualquer momento.</p>
        </div>
      </div>

      {/* Busca + Filtro de status */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
        <input
          className="input"
          type="search"
          placeholder="🔍 Buscar mesa (nº ou nome)…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ maxWidth:220 }}
        />
        {['todos','livre','ocupada','fechando'].map(s => {
          const labels = { todos:'Todas', livre:'Livres', ocupada:'Ocupadas', fechando:'Fechando conta' }
          const colors = { todos:'var(--muted)', livre:'#FF6B2C', ocupada:'#FFB703', fechando:'#3498db' }
          const active  = filtroStatus === s
          return (
            <button key={s}
              onClick={() => setFiltroStatus(s)}
              style={{
                padding:'5px 14px', borderRadius:20, border: active ? `1.5px solid ${colors[s]}` : '1.5px solid var(--line)',
                background: active ? `${colors[s]}22` : 'var(--surface)',
                color: active ? colors[s] : 'var(--muted)',
                cursor:'pointer', fontWeight: active ? 800 : 600, fontSize:12, transition:'all .15s',
              }}>
              {labels[s]}
            </button>
          )
        })}
        {(busca || filtroStatus !== 'todos') && (
          <button onClick={() => { setBusca(''); setFiltroStatus('todos') }}
            style={{ fontSize:12, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
            limpar
          </button>
        )}
        <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>
          {fisicasFiltradas.length} de {fisicas.length} mesa(s)
        </span>
      </div>

      {/* Grid de mesas físicas */}
      <p className="section-title">Mesas Físicas</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:32 }}>
        {fisicasFiltradas.map(m => {
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
              {m.apelido && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{m.apelido}</div>}
              {m.contaNome && <div style={{ fontSize:11, color:'#FFB703', marginTop:4 }}>👤 {m.contaNome}</div>}
              {m.total > 0 && <div style={{ fontSize:13, color:'var(--cream)', marginTop:6, fontWeight:700 }}>{fmtR(m.total)}</div>}
              {m.bloqueadaPorReserva && <div style={{ fontSize:11, color:'#e05c5c', marginTop:5, fontWeight:800 }}>🔒 Reservada agora</div>}
              {!m.bloqueadaPorReserva && m.proximaReserva && <div style={{ fontSize:11, color:'#FFB703', marginTop:5, fontWeight:800 }}>📅 Reserva {new Intl.DateTimeFormat('pt-BR', { hour:'2-digit', minute:'2-digit', timeZone:'America/Cuiaba' }).format(new Date(m.proximaReserva.inicioEm))}</div>}
              {m.aguardandoCozinha > 0 && (
                <div style={{ fontSize:11, color:'var(--gold)', marginTop:4 }}>🍳 {m.aguardandoCozinha} item(s)</div>
              )}
              <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:8 }}><button onClick={(event) => { event.stopPropagation(); editarMesa(m) }} className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'3px 8px' }}>Editar</button><button onClick={(event) => { event.stopPropagation(); abrirQrMesa(m) }} className="btn btn-ghost btn-sm" disabled={qrLoading} style={{ fontSize:11, padding:'3px 8px' }}>QR</button></div>
            </div>
          )
        })}
        {fisicas.length === 0 && <p style={{ color:'var(--muted)', gridColumn:'1/-1' }}>Nenhuma mesa cadastrada.</p>}
        {fisicas.length > 0 && fisicasFiltradas.length === 0 && (
          <p style={{ color:'var(--muted)', gridColumn:'1/-1' }}>Nenhuma mesa encontrada com os filtros aplicados.</p>
        )}
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

      {/* Modal: cadastro e vínculo de conta */}
      {mesaModal && (
        <Modal title={mesaModal.modo === 'nova' ? 'Cadastrar mesa' : `Editar mesa ${mesaForm.numero}`} onClose={() => setMesaModal(null)}>
          <div style={{ padding:'4px 0 8px' }}>
            <p style={{ marginTop:0, color:'var(--muted)', fontSize:13 }}>Defina um nome de referência e associe, se necessário, uma conta ou cliente. A conta pode ser alterada a qualquer momento.</p>
            <div className="form-row">
              <div className="form-group"><label>Número da mesa *</label><input type="number" min="1" disabled={mesaModal.modo === 'editar'} value={mesaForm.numero} onChange={e => setMesaForm(f => ({ ...f, numero:e.target.value }))} /></div>
              <div className="form-group"><label>Nome de exibição *</label><input value={mesaForm.nome} onChange={e => setMesaForm(f => ({ ...f, nome:e.target.value }))} placeholder="Ex.: Varanda 01" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Apelido / localização</label><input value={mesaForm.apelido} onChange={e => setMesaForm(f => ({ ...f, apelido:e.target.value }))} placeholder="Ex.: Deck externo" /></div>
              <div className="form-group"><label>Conta ou cliente associado</label><input value={mesaForm.contaNome} onChange={e => setMesaForm(f => ({ ...f, contaNome:e.target.value }))} placeholder="Nome da conta" /></div>
            </div>
            <div className="form-group"><label>ID da conta (opcional)</label><input value={mesaForm.contaId} onChange={e => setMesaForm(f => ({ ...f, contaId:e.target.value }))} placeholder="Identificador interno" /></div>
            <div className="form-group"><label>Observação</label><textarea value={mesaForm.observacao} onChange={e => setMesaForm(f => ({ ...f, observacao:e.target.value }))} placeholder="Informações operacionais da mesa" rows="3" /></div>
            <div style={{ display:'flex', gap:8, justifyContent:'space-between', marginTop:10 }}>
              <div>{mesaModal.modo === 'editar' && <button className="btn btn-danger btn-sm" onClick={() => excluirMesa(mesaModal.mesa)}>Remover mesa</button>}</div>
              <div style={{ display:'flex', gap:8 }}><button className="btn btn-ghost btn-sm" onClick={() => setMesaModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={salvandoMesa} onClick={salvarMesa}>{salvandoMesa ? 'Salvando…' : 'Salvar mesa'}</button></div>
            </div>
          </div>
        </Modal>
      )}

      {qrModal && <Modal title={`QR Code — Mesa ${qrModal.mesa.num}`} onClose={() => setQrModal(null)} width={480}><div style={{ textAlign:'center', padding:'4px 0 10px' }}><p style={{ color:'var(--muted)', fontSize:13, marginTop:0 }}>Imprima este código e deixe-o visível na mesa. Cada leitura abre uma sessão temporária e isolada desta mesa.</p><img src={qrModal.dataUrl} alt={`QR Code da Mesa ${qrModal.mesa.num}`} style={{ width:260, height:260, maxWidth:'100%', background:'#fff', padding:8, borderRadius:10 }} /><a href={qrModal.url} target="_blank" rel="noreferrer" style={{ display:'block', margin:'10px 0', color:'#FF6B2C', overflowWrap:'anywhere', fontSize:12 }}>{qrModal.url}</a><div style={{ display:'flex', justifyContent:'center', gap:8, flexWrap:'wrap' }}><button className="btn btn-primary" onClick={baixarQrMesa}>Baixar PNG</button><button className="btn btn-danger" onClick={rotacionarQrMesa} disabled={qrLoading}>{qrLoading ? 'Gerando…' : 'Rotacionar QR'}</button></div><p style={{ color:'var(--muted)', fontSize:11, marginBottom:0 }}>Ao rotacionar, o QR Code anterior é invalidado imediatamente.</p></div></Modal>}

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
                { label:'✅ Prontos', val:itensProntos, color:'#12283F' },
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
                        color:'#FF6B2C', flexShrink:0 }}>
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
              <div style={{ background:'rgba(255,107,44,.1)', border:'1px solid var(--gold)', borderRadius:10, padding:14, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--gold)', marginBottom:10 }}>
                  ↔️ Transferir "{transferindo.nome}" para mesa:
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {fisicas.filter(f => f.status !== 'livre' && f.num !== comanda.mesa.num).map(f => (
                    <button key={f.num} onClick={() => transferirItem(transferindo, f.num)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--gold)',
                        background:'rgba(255,107,44,.15)', color:'var(--gold)', cursor:'pointer', fontWeight:700, fontSize:13 }}>
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
                <strong style={{ color:'#FFB703', fontSize:18 }}>
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
