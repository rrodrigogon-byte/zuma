import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmtR } from '../lib/api'
import { useToast } from '../hooks/useToast'

const S = {
  page: { minHeight: '100vh', background: 'var(--bg, #091a0f)', color: '#f4f6ef', fontFamily: 'inherit' },
  banner: { background: 'linear-gradient(90deg,#1a4a20,#2d6e35)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bannerStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  bannerLabel: { fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 },
  bannerVal: { fontSize: 22, fontWeight: 700, color: '#8FD64A' },
  section: { padding: '18px 16px 8px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8FD64A', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 },
  card: (status) => ({
    background: status === 'ocupada' ? '#132b1b' : status === 'conta' ? '#3a2800' : status === 'livre' ? '#0d1f12' : '#132b1b',
    border: `1.5px solid ${status === 'conta' ? '#C9A656' : status === 'ocupada' ? '#5FB335' : '#1e4029'}`,
    borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', position: 'relative',
    transition: 'transform .15s, box-shadow .15s',
    animation: status === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none',
  }),
  cardNum: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  cardType: { fontSize: 10, opacity: 0.55, marginTop: 2 },
  cardTotal: { fontSize: 13, fontWeight: 700, color: '#8FD64A', marginTop: 4 },
  cardFire: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  virtualList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vcard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  vcardLeft: { display: 'flex', flexDirection: 'column' },
  vcardName: { fontWeight: 700, fontSize: 14 },
  vcardSub: { fontSize: 11, opacity: 0.55 },
  vcardTotal: { fontSize: 15, fontWeight: 700, color: '#8FD64A' },
  sheet: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1f12', borderTop: '2px solid #1e4029', borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom,0)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', zIndex: 100 },
  sheetHeader: { padding: '14px 18px 10px', borderBottom: '1px solid #1e4029', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#8FD64A', fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #1a3020' },
  itemQty: { minWidth: 26, height: 26, borderRadius: 6, background: '#1e4029', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#8FD64A' },
  itemName: { flex: 1, fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: 600, color: '#C9A656' },
  itemStatus: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e4029', color: '#8FD64A' },
  sheetActions: { padding: '10px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1e4029' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0d1f12', border: '1.5px solid #1e4029', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  payBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  payBtn: (active) => ({ padding: '18px 10px', borderRadius: 10, border: `2px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : '#132b1b', color: '#f4f6ef', cursor: 'pointer', fontSize: 20, textAlign: 'center', transition: 'all .15s' }),
  payBtnLabel: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 10 },
  catBtn: (active) => ({ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : 'transparent', color: active ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }),
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, overflowY: 'auto', maxHeight: '45vh' },
  prodCard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 10px 8px', position: 'relative' },
  prodName: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  prodPrice: { fontSize: 13, color: '#C9A656', fontWeight: 700 },
  addBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 6, background: '#5FB335', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  input: { width: '100%', background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 8, padding: '9px 12px', color: '#f4f6ef', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' },
  contaBox: { marginBottom: 16 },
  contaRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 },
  contaTotal: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 17, fontWeight: 800, borderTop: '1px solid #1e4029', marginTop: 6 },
  serviceToggle: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 13, cursor: 'pointer' },
}

const PAY_OPTIONS = [
  { key: 'pix', icon: '📲', label: 'Pix' },
  { key: 'cartao', icon: '💳', label: 'Cartão' },
  { key: 'dinheiro', icon: '💵', label: 'Dinheiro' },
  { key: 'carteira', icon: '👛', label: 'Carteira' },
]

export default function PDV() {
  const { toast } = useToast()
  const [mesas, setMesas] = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [comanda, setComanda] = useState(null)
  const [sheet, setSheet] = useState(null) // { tipo:'fisica'|'virtual', num?, id? }
  const [overlay, setOverlay] = useState(null) // 'cardapio'|'conta'|'pagar'|'nova-virtual'|'nova-fisica'
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [payMeio, setPayMeio] = useState('pix')
  const [servico, setServico] = useState(true)
  const [novaVirtual, setNovaVirtual] = useState({ nome: '', local: '' })
  const [novaMesaNome, setNovaMesaNome] = useState('')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  const loadMesas = useCallback(async () => {
    try {
      const data = await api.get('/api/mesas')
      setMesas(data)
    } catch { /* silencioso */ }
  }, [])

  const loadCardapio = useCallback(async () => {
    try {
      const data = await api.get('/api/cardapio')
      setCardapio(data.filter(p => !p.indisponivel))
    } catch { /* silencioso */ }
  }, [])

  const loadComanda = useCallback(async (id) => {
    if (!id) return
    try {
      const data = await api.get(`/api/comanda/${id}`)
      setComanda(data)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    timerRef.current = setInterval(loadMesas, 15000)
    return () => clearInterval(timerRef.current)
  }, [loadMesas, loadCardapio])

  // Banner stats
  const abertas = [...(mesas.fisicas || []), ...(mesas.virtuais || [])].filter(m => m.status !== 'livre')
  const totalAberto = abertas.reduce((s, m) => s + (m.total || 0), 0)

  // Categorias
  const cats = ['Tudo', ...Array.from(new Set(cardapio.map(p => p.cat)))]
  const prodsFiltrados = catFiltro === 'Tudo' ? cardapio : cardapio.filter(p => p.cat === catFiltro)

  // Abrir mesa física
  const handleMesaClick = async (mesa) => {
    if (mesa.status === 'livre') {
      setNovaMesaNome('')
      setSheet({ tipo: 'fisica', num: mesa.num, nova: true })
      setOverlay('nova-fisica')
    } else {
      setSheet({ tipo: 'fisica', num: mesa.num, id: mesa.comandaId })
      await loadComanda(mesa.comandaId)
    }
  }

  // Abrir comanda virtual
  const handleVirtualClick = async (v) => {
    setSheet({ tipo: 'virtual', id: v.id })
    await loadComanda(v.id)
  }

  // Iniciar comanda física
  const iniciarComandaFisica = async () => {
    if (!sheet?.num) return
    setLoading(true)
    try {
      await api.post(`/api/mesa/${sheet.num}/pedir`, { itens: [], nome: novaMesaNome || undefined })
      await loadMesas()
      toast('Comanda aberta!', 'success')
      // Reabre a mesa já ocupada
      const mesasData = await api.get('/api/mesas')
      setMesas(mesasData)
      const m = mesasData.fisicas.find(x => x.num === sheet.num)
      if (m?.comandaId) {
        setSheet({ tipo: 'fisica', num: m.num, id: m.comandaId })
        const cmd = await api.get(`/api/comanda/${m.comandaId}`)
        setComanda(cmd)
      }
      setOverlay(null)
    } catch (e) {
      toast(e.message || 'Erro ao abrir comanda', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Criar comanda virtual
  const criarVirtual = async () => {
    if (!novaVirtual.nome.trim()) { toast('Nome obrigatório', 'error'); return }
    setLoading(true)
    try {
      const data = await api.post('/api/mesa-virtual', novaVirtual)
      await loadMesas()
      toast('Comanda virtual criada!', 'success')
      setSheet({ tipo: 'virtual', id: data.id })
      const cmd = await api.get(`/api/comanda/${data.id}`)
      setComanda(cmd)
      setOverlay(null)
      setNovaVirtual({ nome: '', local: '' })
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Adicionar item
  const adicionarItem = async (produtoId, qtd = 1, obs = '') => {
    if (!comanda?.id) return
    try {
      await api.post(`/api/comanda/${comanda.id}/adicionar`, { itens: [{ produtoId, qtd, obs }] })
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item adicionado!', 'success')
    } catch (e) {
      toast(e.message || 'Erro ao adicionar', 'error')
    }
  }

  // Pedir conta
  const pedirConta = async () => {
    if (!comanda?.id) return
    setLoading(true)
    try {
      await api.post(`/api/comanda/${comanda.id}/conta`, {})
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Conta solicitada!', 'success')
      setOverlay('conta')
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Pagar
  const pagar = async () => {
    if (!comanda?.id) return
    setLoading(true)
    try {
      await api.post(`/api/comanda/${comanda.id}/pagar`, { meio: payMeio })
      toast('Pagamento registrado! ✓', 'success')
      setOverlay(null)
      setSheet(null)
      setComanda(null)
      await loadMesas()
    } catch (e) {
      toast(e.message || 'Erro ao pagar', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fecharSheet = () => {
    setSheet(null)
    setComanda(null)
    setOverlay(null)
  }

  const subtotal = comanda?.total || 0
  const servicoVal = servico ? subtotal * 0.1 : 0
  const totalFinal = subtotal + servicoVal

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,166,86,.5); }
          50% { box-shadow: 0 0 0 8px rgba(201,166,86,0); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e4029; border-radius: 4px; }
      `}</style>

      {/* Banner */}
      <div style={S.banner}>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Comandas abertas</span>
          <span style={S.bannerVal}>{abertas.length}</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f4f6ef' }}>PDV</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>A receber</span>
          <span style={S.bannerVal}>{fmtR(totalAberto)}</span>
        </div>
      </div>

      {/* Mesas Físicas */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Mesas Físicas</div>
        <div style={S.grid}>
          {(mesas.fisicas || []).map(m => (
            <div key={m.num} style={S.card(m.status)} onClick={() => handleMesaClick(m)}>
              {m.aguardandoCozinha && <span style={S.cardFire}>🔥</span>}
              <div style={S.cardNum}>{m.num}</div>
              <div style={S.cardType}>{m.tipo || 'Mesa'}</div>
              {m.status !== 'livre' && (
                <div style={S.cardTotal}>{fmtR(m.total || 0)}</div>
              )}
              {m.nome && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{m.nome}</div>}
              <div style={{
                fontSize: 9, marginTop: 4, padding: '2px 6px', borderRadius: 4,
                background: m.status === 'conta' ? '#C9A656' : m.status === 'ocupada' ? '#1e4029' : '#0d1f12',
                color: m.status === 'conta' ? '#000' : '#8FD64A', display: 'inline-block'
              }}>
                {m.status === 'livre' ? 'livre' : m.status === 'conta' ? 'conta' : 'ocupada'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comandas Virtuais */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={S.sectionTitle}>Comandas Virtuais</div>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}
            onClick={() => { setNovaVirtual({ nome: '', local: '' }); setOverlay('nova-virtual') }}>
            + Nova
          </button>
        </div>
        <div style={S.virtualList}>
          {(mesas.virtuais || []).length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.45, textAlign: 'center', padding: 16 }}>Nenhuma comanda virtual aberta</div>
          )}
          {(mesas.virtuais || []).map(v => (
            <div key={v.id} style={S.vcard} onClick={() => handleVirtualClick(v)}>
              <div style={S.vcardLeft}>
                <span style={S.vcardName}>{v.nome || `Comanda #${v.id}`}</span>
                <span style={S.vcardSub}>{v.local || '—'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={S.vcardTotal}>{fmtR(v.total || 0)}</div>
                {v.aguardandoCozinha && <span style={{ fontSize: 14 }}>🔥</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sheet da comanda */}
      {sheet && !sheet.nova && comanda && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99 }} onClick={fecharSheet} />
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>
                  {sheet.tipo === 'fisica' ? `Mesa ${sheet.num}` : comanda.mesa || `Comanda #${comanda.id}`}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Comanda #{comanda.id}</div>
              </div>
              <button style={S.sheetClose} onClick={fecharSheet}>✕</button>
            </div>

            <div style={S.sheetBody}>
              {(!comanda.itens || comanda.itens.length === 0) ? (
                <div style={{ fontSize: 13, opacity: 0.4, textAlign: 'center', padding: 20 }}>Sem itens ainda</div>
              ) : (
                comanda.itens.map((it, i) => (
                  <div key={i} style={S.itemRow}>
                    <div style={S.itemQty}>{it.qtd}</div>
                    <div style={S.itemName}>
                      {it.nome}
                      {it.obs && <div style={{ fontSize: 10, opacity: 0.5 }}>{it.obs}</div>}
                    </div>
                    {it.status && <div style={S.itemStatus}>{it.status}</div>}
                    <div style={S.itemPrice}>{fmtR((it.preco || 0) * (it.qtd || 1))}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '8px 16px', borderTop: '1px solid #1e4029' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: '#8FD64A' }}>{fmtR(comanda.total || 0)}</span>
              </div>
            </div>

            <div style={S.sheetActions}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                onClick={() => setOverlay('cardapio')}>
                ➕ Adicionar
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                onClick={pedirConta} disabled={loading}>
                🧾 Conta
              </button>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
                onClick={() => { setPayMeio('pix'); setOverlay('pagar') }}>
                💳 Pagar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Overlay: Seletor de cardápio */}
      {overlay === 'cardapio' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={{ ...S.modal, maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={S.modalTitle}>Cardápio</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>

            <div style={S.catScroll}>
              {cats.map(c => (
                <button key={c} style={S.catBtn(catFiltro === c)} onClick={() => setCatFiltro(c)}>{c}</button>
              ))}
            </div>

            <div style={S.prodGrid}>
              {prodsFiltrados.map(p => (
                <div key={p.id} style={S.prodCard}>
                  <button style={S.addBtn} onClick={() => adicionarItem(p.id)}>+</button>
                  <div style={S.prodName}>{p.nome}</div>
                  <div style={S.prodPrice}>{fmtR(p.preco)}</div>
                  <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2 }}>{p.cat}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Pré-conta */}
      {overlay === 'conta' && comanda && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={S.modalTitle}>🧾 Pré-conta</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>

            <div style={S.contaBox}>
              {(comanda.itens || []).map((it, i) => (
                <div key={i} style={S.contaRow}>
                  <span>{it.qtd}× {it.nome}</span>
                  <span style={{ color: '#C9A656' }}>{fmtR((it.preco || 0) * (it.qtd || 1))}</span>
                </div>
              ))}
              <div style={S.contaRow}>
                <span>Subtotal</span>
                <span>{fmtR(subtotal)}</span>
              </div>
              <label style={S.serviceToggle}>
                <input type="checkbox" checked={servico} onChange={e => setServico(e.target.checked)} />
                10% Serviço ({fmtR(servicoVal)})
              </label>
              <div style={S.contaTotal}>
                <span>Total</span>
                <span style={{ color: '#8FD64A' }}>{fmtR(totalFinal)}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={() => setOverlay('pagar')}>
              💳 Ir para pagamento
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Pagamento */}
      {overlay === 'pagar' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={S.modalTitle}>💳 Pagamento</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>Total: <strong style={{ color: '#8FD64A' }}>{fmtR(comanda?.total || 0)}</strong></div>

            <div style={S.payBtns}>
              {PAY_OPTIONS.map(o => (
                <div key={o.key} style={S.payBtn(payMeio === o.key)} onClick={() => setPayMeio(o.key)}>
                  <div>{o.icon}</div>
                  <div style={S.payBtnLabel}>{o.label}</div>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, fontSize: 15 }}
              onClick={pagar} disabled={loading}>
              {loading ? 'Processando...' : `Confirmar — ${PAY_OPTIONS.find(o => o.key === payMeio)?.label}`}
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Nova comanda virtual */}
      {overlay === 'nova-virtual' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Nova Comanda Virtual</div>
            <input style={S.input} placeholder="Nome (ex: João da Silva)" value={novaVirtual.nome}
              onChange={e => setNovaVirtual(v => ({ ...v, nome: e.target.value }))} />
            <input style={S.input} placeholder="Local (ex: Arquibancada B)" value={novaVirtual.local}
              onChange={e => setNovaVirtual(v => ({ ...v, local: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={criarVirtual} disabled={loading}>
                {loading ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Nova comanda física */}
      {overlay === 'nova-fisica' && (
        <div style={S.overlay} onClick={() => { setOverlay(null); setSheet(null) }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Mesa {sheet?.num}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 14 }}>Iniciar nova comanda</div>
            <input style={S.input} placeholder="Nome do cliente (opcional)"
              value={novaMesaNome} onChange={e => setNovaMesaNome(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }}
                onClick={() => { setOverlay(null); setSheet(null) }}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={iniciarComandaFisica} disabled={loading}>
                {loading ? '...' : 'Abrir comanda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
