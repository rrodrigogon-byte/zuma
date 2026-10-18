/**
 * GarcomView.jsx — Modo Garçom v2
 * Redesign completo: bottom-sheet moderno, grid de produtos com categorias visuais,
 * cart temporário (múltiplos itens antes de confirmar), badges de setor (bar/chapa/cozinha),
 * estoque em tempo real, busca instantânea com highlight, obs rápidas inline.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api, fmtR } from '../lib/api'
import { barPath } from '../lib/bar-api'
import { useToast } from '../hooks/useToast'

/* ─── emojis por categoria ─────────────────────────────────────── */
const CAT_EMOJI = {
  'Bebidas': '🍺',
  'Porções': '🍟',
  'Espetos': '🍢',
  'Burgers': '🍔',
  'Tudo': '🔍',
}
const catEmoji = (c) => CAT_EMOJI[c] || '📦'

/* ─── cores de setor ────────────────────────────────────────────── */
const SETOR_COLOR = {
  bar:     { bg: '#0e2a3a', border: '#3498db', text: '#3498db', label: 'Bar' },
  chapa:   { bg: '#3a2000', border: '#e67e22', text: '#e67e22', label: 'Chapa' },
  cozinha: { bg: '#2a0000', border: '#e05c5c', text: '#e05c5c', label: 'Cozinha' },
}
const setorStyle = (s) => SETOR_COLOR[s] || { bg: '#1a1a2e', border: '#555', text: '#aaa', label: s || '?' }

/* ─── highlight de texto ────────────────────────────────────────── */
function Highlight({ text, query }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FF6B2C', color: '#000', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/* ─── Ticker de auto-refresh ────────────────────────────────────── */
function RefreshTicker({ interval = 15, lastUpdate, onManual }) {
  const [sec, setSec] = useState(interval)
  useEffect(() => {
    setSec(interval)
    const t = setInterval(() => setSec(s => s <= 1 ? interval : s - 1), 1000)
    return () => clearInterval(t)
  }, [lastUpdate, interval])
  return (
    <button onClick={onManual} style={{
      background: '#294F6C', border: 'none', borderRadius: 8,
      color: sec <= 5 ? '#FF6B2C' : '#FF9B72',
      padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, minWidth: 48,
    }}>↺ {sec}s</button>
  )
}

/* ─── CartBadge: bolinha flutuante com contagem do cart ─────────── */
function CartBadge({ count, total, onClick }) {
  if (!count) return null
  return (
    <button onClick={onClick} style={{
      position: 'fixed', bottom: 24, right: 20, zIndex: 300,
      background: '#FF6B2C', border: 'none', borderRadius: 50, color: '#fff',
      padding: '14px 20px', cursor: 'pointer', fontWeight: 800, fontSize: 15,
      boxShadow: '0 4px 24px rgba(255,107,44,.5)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'pop-in .25s ease',
    }}>
      🛒 {count} {count === 1 ? 'item' : 'itens'} · {fmtR(total)}
    </button>
  )
}

/* ─── QtyControl ───────────────────────────────────────────────── */
function QtyControl({ qty, onDec, onInc, mini = false }) {
  const sz = mini ? 22 : 28
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mini ? 4 : 6 }}>
      <button onClick={onDec} style={{
        width: sz, height: sz, borderRadius: 6, border: '1.5px solid #3A6687',
        background: '#17354F', color: '#FF9B72', cursor: 'pointer',
        fontWeight: 800, fontSize: mini ? 13 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>−</button>
      <span style={{ minWidth: mini ? 18 : 22, textAlign: 'center', fontWeight: 800, fontSize: mini ? 13 : 15 }}>
        {qty}
      </span>
      <button onClick={onInc} style={{
        width: sz, height: sz, borderRadius: 6, border: '1.5px solid #3A6687',
        background: '#294F6C', color: '#FF9B72', cursor: 'pointer',
        fontWeight: 800, fontSize: mini ? 13 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>+</button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */

const S = {
  page: { minHeight: '100vh', background: '#0B1C2D', color: '#FFF4EC', fontFamily: 'inherit' },
  header: {
    background: '#10283F', borderBottom: '2px solid #294F6C',
    padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 20,
  },
  title: { fontSize: 18, fontWeight: 800, color: '#FF6B2C' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
    zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    background: '#142F49', borderTop: '2px solid #294F6C', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
  },
  sheetHandle: {
    width: 40, height: 4, background: '#3A6687', borderRadius: 4,
    margin: '10px auto 0', flexShrink: 0,
  },
  sheetHeader: {
    padding: '12px 18px 10px', borderBottom: '1px solid #294F6C',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#FF9B72', fontSize: 22, cursor: 'pointer', padding: 4 },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  sheetActions: { padding: '10px 16px 20px', display: 'flex', gap: 8, borderTop: '1px solid #294F6C', flexShrink: 0 },
  input: {
    width: '100%', background: '#17354F', border: '1.5px solid #294F6C',
    borderRadius: 10, padding: '10px 14px', color: '#FFF4EC', fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  },
  section: { padding: '12px 16px 4px' },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#FF9B72', marginBottom: 10 },
  card: (s) => ({
    background: s === 'ocupada' ? '#17354F' : s === 'conta' ? '#3a2800' : '#142F49',
    border: `2px solid ${s === 'conta' ? '#FF6B2C' : s === 'ocupada' ? '#FF6B2C' : '#294F6C'}`,
    borderRadius: 12, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
    animation: s === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none',
    transition: 'transform .12s',
  }),
}

export default function GarcomView() {
  const { toast } = useToast()

  /* ── state principal ── */
  const [mesas, setMesas]       = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [comanda, setComanda]   = useState(null)
  const [sheet, setSheet]       = useState(null)   // { tipo, num?, id? }
  const [overlay, setOverlay]   = useState(null)   // null | 'comanda' | 'cardapio' | 'cart' | 'nova'
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [loading, setLoading]   = useState(false)
  const autoRef = useRef(null)

  /* ── state do cardápio / busca ── */
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [busca, setBusca]         = useState('')
  const [setor, setSetor]         = useState('todos')

  /* ── cart temporário ── */
  const [cart, setCart] = useState([])  // [{ prod, qty, obs }]
  const [obsAberta, setObsAberta] = useState(null) // id do prod com obs expandida

  /* ── nova comanda / lançamento em conta ── */
  const [nomeMesa, setNomeMesa] = useState('')
  const [clientesConta, setClientesConta] = useState([])
  const [clienteContaId, setClienteContaId] = useState('')

  /* ── loaders ── */
  const loadMesas = useCallback(async (quiet = false) => {
    try {
      setMesas(await api.get(barPath('/mesas')))
      setLastUpdate(Date.now())
    } catch { if (!quiet) toast('Erro ao carregar mesas', true) }
  }, [])

  const loadCardapio = useCallback(async () => {
    try {
      const data = await api.get(barPath('/cardapio'))
      setCardapio(Array.isArray(data) ? data : [])
    } catch { /* silencioso */ }
  }, [])

  const loadClientesConta = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/clientes')
      const elegiveis = (data?.clientes || []).filter(cliente => !cliente.padrao && cliente.status !== 'deletado')
      setClientesConta(elegiveis)
      setClienteContaId(atual => atual && elegiveis.some(cliente => cliente.id === atual) ? atual : (elegiveis[0]?.id || ''))
    } catch { setClientesConta([]) }
  }, [])

  const loadComanda = useCallback(async (id) => {
    if (!id) return
    try { setComanda(await api.get(barPath(`/comanda/${id}`))) }
    catch { toast('Erro ao carregar comanda', true) }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    loadClientesConta()
    autoRef.current = setInterval(() => loadMesas(true), 8000)
    return () => clearInterval(autoRef.current)
  }, [loadMesas, loadCardapio, loadClientesConta])

  useEffect(() => {
    if (!sheet?.id) return undefined
    const sincronizador = setInterval(() => loadComanda(sheet.id), 6000)
    return () => clearInterval(sincronizador)
  }, [sheet?.id, loadComanda])

  /* ── dados derivados ── */
  const abertas  = useMemo(() => [...(mesas.fisicas || []), ...(mesas.virtuais || [])].filter(m => m.status !== 'livre'), [mesas])
  const pendentes = useMemo(() => abertas.filter(m => m.status === 'conta').length, [abertas])
  const prontos   = comanda?.itens?.filter(it => it.status === 'pronto').length || 0

  const cats = useMemo(() => ['Tudo', ...Array.from(new Set(cardapio.map(p => p.cat).filter(Boolean)))], [cardapio])
  const setores = useMemo(() => ['todos', ...Array.from(new Set(cardapio.map(p => p.setor).filter(Boolean)))], [cardapio])

  const prods = useMemo(() => cardapio
    .filter(p => catFiltro === 'Tudo' || p.cat === catFiltro)
    .filter(p => setor === 'todos' || p.setor === setor)
    .filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
  , [cardapio, catFiltro, setor, busca])

  const cartTotal = useMemo(() => cart.reduce((s, ci) => s + (ci.prod.preco * ci.qty), 0), [cart])
  const cartCount = useMemo(() => cart.reduce((s, ci) => s + ci.qty, 0), [cart])

  /* ── helpers de cart ── */
  const cartQty = (prodId) => cart.find(c => c.prod.id === prodId)?.qty || 0

  const setQty = (prod, qty) => {
    if (qty <= 0) {
      setCart(c => c.filter(ci => ci.prod.id !== prod.id))
    } else {
      setCart(c => {
        const ex = c.find(ci => ci.prod.id === prod.id)
        if (ex) return c.map(ci => ci.prod.id === prod.id ? { ...ci, qty } : ci)
        return [...c, { prod, qty, obs: '' }]
      })
    }
  }

  const addOne = (prod) => {
    if (prod.estoque !== undefined && prod.estoque !== null && prod.estoque <= 0) return
    setQty(prod, cartQty(prod.id) + 1)
  }

  const setObs = (prodId, obs) => {
    setCart(c => c.map(ci => ci.prod.id === prodId ? { ...ci, obs } : ci))
  }

  /* ── confirmar pedido (cart → API) ── */
  const confirmarPedido = async () => {
    if (!cart.length || !sheet?.id) return
    setLoading(true)
    try {
      const itens = cart.map(ci => ({ produtoId: ci.prod.id, qtd: ci.qty, obs: ci.obs || undefined }))
      const resposta = await api.post(barPath(`/comanda/${sheet.id}/adicionar`), { itens })
      if (resposta?.offlineQueued) {
        toast(`✓ ${cartCount} item(s) salvo(s) offline; sincronização automática ao reconectar.`)
        setCart([]); setOverlay('comanda'); return
      }
      await loadComanda(sheet.id)
      await loadMesas(true)
      toast(`✓ ${cartCount} item(s) adicionado(s)!`)
      setCart([])
      setOverlay('comanda')
    } catch (e) {
      toast(e.message || 'Erro ao adicionar itens', true)
    } finally { setLoading(false) }
  }

  /* ── pedir conta ── */
  const pedirConta = async () => {
    if (!sheet?.id) return
    setLoading(true)
    try {
      await api.post(barPath(`/comanda/${sheet.id}/conta`), {})
      await loadComanda(sheet.id)
      await loadMesas(true)
      toast('🧾 Conta solicitada!')
      setOverlay('comanda')
    } catch (e) { toast(e.message || 'Erro', true) }
    finally { setLoading(false) }
  }

  /* ── modificar itens da comanda (editar qtd / remover) ── */
  const mudarQtdItem = async (idx, novaQtd) => {
    if (!sheet?.id) return
    if (novaQtd < 1) return removerItem(idx)
    setLoading(true)
    try {
      await api.patch(barPath(`/comanda/${sheet.id}/item/${idx}`), { qtd: novaQtd })
      await loadComanda(sheet.id)
      await loadMesas(true)
    } catch (e) { toast(e.message || 'Erro ao alterar quantidade', true) }
    finally { setLoading(false) }
  }

  const removerItem = async (idx) => {
    if (!sheet?.id) return
    if (!window.confirm('Remover este item da comanda?')) return
    setLoading(true)
    try {
      await api.post(barPath(`/comanda/${sheet.id}/cancelar-item`), { idx })
      await loadComanda(sheet.id)
      await loadMesas(true)
      toast('Item removido')
    } catch (e) { toast(e.message || 'Erro ao remover item', true) }
    finally { setLoading(false) }
  }

  /* ── encerrar comanda (fecha + registra pagamento) ── */
  const encerrarComanda = async (meio, clienteId = '') => {
    if (!sheet?.id) return
    setLoading(true)
    try {
      const r = await api.post(barPath(`/comanda/${sheet.id}/pagar`), { meio, ...(clienteId ? { clienteId } : {}) })
      const emConta = meio === 'conta'
      toast(emConta ? `✓ Lançado em conta · ${fmtR(r.total || 0)}` : `✓ Comanda encerrada · ${fmtR(r.total || 0)}`)
      fechar()
      await loadMesas(true)
    } catch (e) { toast(e.message || 'Erro ao encerrar comanda', true) }
    finally { setLoading(false) }
  }

  /* ── iniciar comanda ── */
  const iniciarComanda = async () => {
    if (!sheet?.num) return
    setLoading(true)
    try {
      await api.post(barPath(`/mesa/${sheet.num}/pedir`), { itens: [], nome: nomeMesa || undefined })
      const mesasData = await api.get(barPath('/mesas'))
      setMesas(mesasData)
      const m = mesasData.fisicas.find(x => x.num === sheet.num)
      if (m?.comandaId) {
        setSheet(s => ({ ...s, id: m.comandaId }))
        await loadComanda(m.comandaId)
      }
      setOverlay('comanda')
      setNomeMesa('')
    } catch (e) {
      toast(e.message || 'Erro ao abrir comanda', true)
    } finally { setLoading(false) }
  }

  const handleMesaClick = async (mesa) => {
    if (mesa.status === 'livre') {
      setNomeMesa('')
      setSheet({ tipo: 'fisica', num: mesa.num })
      setOverlay('nova')
    } else {
      setSheet({ tipo: 'fisica', num: mesa.num, id: mesa.comandaId })
      await loadComanda(mesa.comandaId)
      setOverlay('comanda')
    }
  }

  const abrirCardapio = () => {
    setBusca(''); setCatFiltro('Tudo'); setSetor('todos')
    setOverlay('cardapio')
  }

  const fechar = () => { setOverlay(null); setSheet(null); setComanda(null); setCart([]) }

  /* ════════════════════ RENDER ════════════════════════════════════ */
  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,107,44,.5); }
          50%      { box-shadow: 0 0 0 8px rgba(255,107,44,0); }
        }
        @keyframes pop-in {
          from { transform: scale(.85) translateY(20px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        .mesa-card:hover { transform: translateY(-2px) scale(1.02); }
        .prod-card:active { transform: scale(.97); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #294F6C; border-radius: 4px; }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.title}>👨‍🍳 Modo Garçom</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendentes > 0 && (
            <span style={{ background: '#FF6B2C', color: '#000', borderRadius: 20, padding: '3px 10px', fontWeight: 800, fontSize: 12 }}>
              🧾 {pendentes} conta{pendentes > 1 ? 's' : ''}
            </span>
          )}
          <span style={{ background: abertas.length > 0 ? '#294F6C' : '#345B77', color: '#FF9B72', borderRadius: 20, padding: '3px 12px', fontWeight: 800, fontSize: 13 }}>
            {abertas.length} abertas
          </span>
          <RefreshTicker interval={15} lastUpdate={lastUpdate} onManual={() => loadMesas()} />
        </div>
      </div>

      {/* ── Mesas Físicas ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Mesas Físicas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, padding: '0 0 8px' }}>
          {(mesas.fisicas || []).map(m => {
            const s = m.status
            return (
              <div key={m.num}
                className="mesa-card"
                style={{ ...S.card(s), transition: 'transform .12s, box-shadow .12s' }}
                onClick={() => handleMesaClick(m)}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: s === 'conta' ? '#FF6B2C' : s === 'ocupada' ? '#FF9B72' : '#5B839D' }}>
                  {m.num}
                </div>
                <div style={{ fontSize: 9, marginTop: 3, padding: '2px 5px', borderRadius: 4, display: 'inline-block',
                  background: s === 'conta' ? '#FF6B2C' : s === 'ocupada' ? '#294F6C' : '#142F49',
                  color: s === 'conta' ? '#000' : s === 'ocupada' ? '#FF9B72' : '#62839A',
                  fontWeight: 700, textTransform: 'uppercase' }}>
                  {s === 'livre' ? 'livre' : s === 'conta' ? 'conta 🧾' : 'aberta'}
                </div>
                {s !== 'livre' && (
                  <div style={{ fontSize: 11, color: '#FF6B2C', fontWeight: 700, marginTop: 3 }}>
                    {fmtR(m.total || 0)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Comandas Virtuais ── */}
      {(mesas.virtuais || []).length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Comandas Virtuais</div>
          {mesas.virtuais.map(v => (
            <div key={v.id}
              style={{ background: '#17354F', border: '1px solid #294F6C', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={async () => {
                setSheet({ tipo: 'virtual', id: v.id })
                await loadComanda(v.id)
                setOverlay('comanda')
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{v.nome || `#${v.id}`}</div>
                {v.aguardandoCozinha > 0 && <div style={{ fontSize: 11, color: '#e67e22' }}>🍳 {v.aguardandoCozinha} na cozinha</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FF9B72', fontWeight: 800, fontSize: 15 }}>{fmtR(v.total || 0)}</div>
                {v.status === 'conta' && <div style={{ fontSize: 10, color: '#FF6B2C', fontWeight: 700 }}>🧾 conta</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Espaço para o botão flutuante não cobrir conteúdo ── */}
      {overlay === 'cardapio' && cartCount > 0 && <div style={{ height: 80 }} />}

      {/* ════════ OVERLAYS ════════ */}

      {/* ── Overlay: Comanda ── */}
      {overlay === 'comanda' && sheet && comanda && (
        <div style={S.overlay} onClick={fechar}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>
                  {sheet.tipo === 'fisica' ? `🍽️ Mesa ${sheet.num}` : (comanda.mesa || `Comanda #${comanda.id}`)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                  #{comanda.id} · {(comanda.itens || []).length} itens · <span style={{ color: '#FF6B2C' }}>{fmtR(comanda.total || 0)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {prontos > 0 && (
                  <span style={{ background: '#FF6B2C', color: '#000', borderRadius: 20, padding: '3px 10px', fontWeight: 800, fontSize: 12, animation: 'pulse-gold 1s infinite' }}>
                    ✓ {prontos} pronto{prontos > 1 ? 's' : ''}
                  </span>
                )}
                <button style={S.sheetClose} onClick={fechar}>✕</button>
              </div>
            </div>

            <div style={S.sheetBody}>
              {(!comanda.itens || comanda.itens.length === 0) ? (
                <div style={{ textAlign: 'center', opacity: 0.4, padding: '32px 0', fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
                  Nenhum item ainda — toque em Adicionar
                </div>
              ) : (
                <div>
                  {comanda.itens.map((it, i) => {
                    const statusColor = {
                      pronto: '#FF6B2C', em_preparo: '#FF6B2C', preparando: '#3498db',
                      entregue: '#555', novo: '#888', pendente: '#888',
                    }
                    const editavel = comanda.status !== 'conta' && comanda.status !== 'fechada'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #1F405C' }}>
                        {editavel ? (
                          <QtyControl
                            qty={it.qtd}
                            mini
                            onDec={() => mudarQtdItem(i, it.qtd - 1)}
                            onInc={() => mudarQtdItem(i, it.qtd + 1)}
                          />
                        ) : (
                          <div style={{ minWidth: 28, height: 28, borderRadius: 8, background: '#294F6C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#FF9B72' }}>
                            {it.qtd}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{it.nome}</div>
                          {it.obs && <div style={{ fontSize: 10, color: '#FF9B72', opacity: .7, marginTop: 1 }}>📝 {it.obs}</div>}
                        </div>
                        {it.status && (
                          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: 'transparent', border: `1px solid ${statusColor[it.status] || '#555'}`, color: statusColor[it.status] || '#555' }}>
                            {it.status.replace('_', ' ')}
                          </span>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6B2C', whiteSpace: 'nowrap' }}>
                          {fmtR((it.preco || 0) * (it.qtd || 1))}
                        </div>
                        {editavel && (
                          <button
                            onClick={() => removerItem(i)}
                            aria-label={`Remover ${it.nome}`}
                            title="Remover item"
                            style={{ background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: 15, padding: '2px 4px', flexShrink: 0 }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    )
                  })}

                  {/* Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 4px', fontWeight: 800 }}>
                    <span style={{ color: '#FF9B72' }}>Total</span>
                    <span style={{ color: '#FF6B2C', fontSize: 18 }}>{fmtR(comanda.total || 0)}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...S.sheetActions, flexDirection: 'column' }}>
              <button
                onClick={abrirCardapio}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #3A6687', background: '#17354F', color: '#FF9B72', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                ➕ Adicionar item
              </button>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                {comanda.status !== 'conta' ? (
                  <button
                    onClick={pedirConta}
                    disabled={loading || !comanda.itens?.length}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #FF6B2C', background: 'transparent', color: comanda.itens?.length ? '#FF6B2C' : '#555', cursor: comanda.itens?.length ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 14 }}>
                    🧾 Pedir conta
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,107,44,.1)', border: '1px solid #FF6B2C', color: '#FF6B2C', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                    ⏳ Conta pedida
                  </div>
                )}
                <button
                  onClick={() => setOverlay('encerrar')}
                  disabled={loading || !comanda.itens?.length}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: comanda.itens?.length ? '#FF6B2C' : '#12283F', color: comanda.itens?.length ? '#fff' : '#555', cursor: comanda.itens?.length ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 14 }}>
                  ✅ Encerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: Cardápio / Adicionar itens ── */}
      {overlay === 'cardapio' && (
        <div style={S.overlay} onClick={() => setOverlay('comanda')}>
          <div style={{ ...S.sheet, maxHeight: '94vh' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div style={S.sheetTitle}>🛒 Adicionar itens</div>
              <button style={S.sheetClose} onClick={() => setOverlay('comanda')}>✕</button>
            </div>

            {/* Busca */}
            <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: .5 }}>🔍</span>
                <input
                  style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }}
                  placeholder="Buscar produto…"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  autoFocus
                />
                {busca && (
                  <button onClick={() => setBusca('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#FF9B72', cursor: 'pointer', fontSize: 16, padding: 2 }}>✕</button>
                )}
              </div>
            </div>

            {/* Filtros: categorias + setores */}
            <div style={{ flexShrink: 0 }}>
              {/* Categorias */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px 0', scrollbarWidth: 'none' }}>
                {cats.map(c => {
                  const active = catFiltro === c
                  return (
                    <button key={c}
                      onClick={() => { setCatFiltro(c); setBusca('') }}
                      style={{
                        padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer',
                        border: active ? '1.5px solid #FF6B2C' : '1.5px solid #294F6C',
                        background: active ? '#254B6A' : 'transparent',
                        color: active ? '#FF9B72' : '#aaa',
                        fontWeight: active ? 800 : 500, fontSize: 12,
                        flexShrink: 0,
                      }}>
                      {catEmoji(c)} {c}
                    </button>
                  )
                })}
              </div>

              {/* Setores (bar/chapa/cozinha) — só mostra se tem mais de 1 */}
              {setores.length > 2 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 16px 4px', scrollbarWidth: 'none' }}>
                  {setores.map(s => {
                    const active = setor === s
                    const sc = s !== 'todos' ? setorStyle(s) : null
                    return (
                      <button key={s}
                        onClick={() => setSetor(s)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer',
                          border: active && sc ? `1.5px solid ${sc.border}` : active ? '1.5px solid #FF6B2C' : '1.5px solid #294F6C',
                          background: active && sc ? sc.bg : active ? '#254B6A' : 'transparent',
                          color: active && sc ? sc.text : active ? '#FF9B72' : '#666',
                          fontWeight: active ? 800 : 500, fontSize: 11, flexShrink: 0,
                        }}>
                        {s === 'todos' ? '🔀 Todos' : `${s === 'bar' ? '🍺' : s === 'chapa' ? '🔥' : '👨‍🍳'} ${setorStyle(s).label}`}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Contador de resultados */}
              <div style={{ padding: '4px 16px 8px', fontSize: 11, color: '#62839A' }}>
                {prods.length} produto{prods.length !== 1 ? 's' : ''} {busca && `para "${busca}"`}
              </div>
            </div>

            {/* Grid de produtos */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 8px' }}>
              {prods.length === 0 ? (
                <div style={{ textAlign: 'center', opacity: .4, padding: 32, fontSize: 13 }}>
                  Nenhum produto encontrado
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 8 }}>
                  {prods.map(p => {
                    const sem = p.estoque !== null && p.estoque !== undefined && p.estoque <= 0
                    const baixo = p.estoque !== null && p.estoque !== undefined && p.estoque > 0 && p.estoque <= 3
                    const qty = cartQty(p.id)
                    const sc = setorStyle(p.setor)
                    const obsOpen = obsAberta === p.id
                    return (
                      <div key={p.id}
                        className="prod-card"
                        style={{
                          background: qty > 0 ? '#12324A' : '#10273D',
                          border: qty > 0 ? '2px solid #FF6B2C' : sem ? '1.5px solid #2a1010' : '1.5px solid #294F6C',
                          borderRadius: 12, padding: '10px 10px 8px',
                          opacity: sem ? 0.45 : 1,
                          transition: 'border .15s, background .15s',
                          cursor: sem ? 'not-allowed' : 'default',
                          position: 'relative',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>

                        {/* Badge de setor */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.text, fontWeight: 700, background: sc.bg }}>
                            {p.setor === 'bar' ? '🍺' : p.setor === 'chapa' ? '🔥' : p.setor === 'cozinha' ? '👨‍🍳' : '📦'} {sc.label}
                          </span>
                          {baixo && <span style={{ fontSize: 9, color: '#e67e22', fontWeight: 700 }}>⚠️ {p.estoque} rest.</span>}
                          {sem && <span style={{ fontSize: 9, color: '#e05c5c', fontWeight: 700 }}>ESGOTADO</span>}
                        </div>

                        {/* Nome */}
                        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, flex: 1 }}>
                          <Highlight text={p.nome} query={busca} />
                        </div>

                        {/* Preço */}
                        <div style={{ fontSize: 14, color: '#FF6B2C', fontWeight: 800 }}>{fmtR(p.preco)}</div>

                        {/* Controle de quantidade */}
                        {!sem && (
                          qty === 0 ? (
                            <button
                              onClick={() => addOne(p)}
                              style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: '#294F6C', color: '#FF9B72', cursor: 'pointer', fontWeight: 800, fontSize: 14, marginTop: 2 }}>
                              + Adicionar
                            </button>
                          ) : (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <QtyControl
                                  qty={qty}
                                  mini
                                  onDec={() => setQty(p, qty - 1)}
                                  onInc={() => setQty(p, qty + 1)}
                                />
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#FF6B2C' }}>{fmtR(p.preco * qty)}</span>
                              </div>
                              {/* Obs rápida toggle */}
                              <button
                                onClick={() => setObsAberta(obsOpen ? null : p.id)}
                                style={{ width: '100%', padding: '4px 0', borderRadius: 6, border: '1px solid #3A6687', background: 'transparent', color: '#47799E', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                                📝 {cart.find(c => c.prod.id === p.id)?.obs || 'obs…'}
                              </button>
                              {obsOpen && (
                                <input
                                  autoFocus
                                  style={{ ...S.input, marginTop: 4, fontSize: 11, padding: '6px 10px' }}
                                  placeholder="Ex: sem gelo, bem gelado…"
                                  value={cart.find(c => c.prod.id === p.id)?.obs || ''}
                                  onChange={e => setObs(p.id, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') setObsAberta(null) }}
                                />
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer quando cart tem itens */}
            {cartCount > 0 && (
              <div style={{ padding: '10px 16px 20px', borderTop: '1px solid #294F6C', background: '#10283F', flexShrink: 0 }}>
                <button
                  onClick={() => setOverlay('cart')}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#FF6B2C', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  🛒 Ver pedido ({cartCount} item{cartCount !== 1 ? 's' : ''}) · {fmtR(cartTotal)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Overlay: Revisão do Cart ── */}
      {overlay === 'cart' && (
        <div style={S.overlay} onClick={() => setOverlay('cardapio')}>
          <div style={{ ...S.sheet, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>📋 Revisar pedido</div>
                <div style={{ fontSize: 11, opacity: .5, marginTop: 2 }}>
                  {sheet?.tipo === 'fisica' ? `Mesa ${sheet.num}` : 'Comanda'}
                </div>
              </div>
              <button style={S.sheetClose} onClick={() => setOverlay('cardapio')}>← Voltar</button>
            </div>

            <div style={S.sheetBody}>
              {cart.map((ci, i) => {
                const sc = setorStyle(ci.prod.setor)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #1F405C' }}>
                    {/* Setor badge */}
                    <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {ci.prod.setor === 'bar' ? '🍺' : ci.prod.setor === 'chapa' ? '🔥' : '👨‍🍳'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ci.prod.nome}</div>
                      {ci.obs && <div style={{ fontSize: 11, color: '#FF9B72', opacity: .7 }}>📝 {ci.obs}</div>}
                      <div style={{ fontSize: 12, color: '#FF6B2C', marginTop: 2 }}>{fmtR(ci.prod.preco)} × {ci.qty}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#FF6B2C' }}>{fmtR(ci.prod.preco * ci.qty)}</div>
                      <QtyControl
                        qty={ci.qty}
                        mini
                        onDec={() => setQty(ci.prod, ci.qty - 1)}
                        onInc={() => setQty(ci.prod, ci.qty + 1)}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 4px', fontWeight: 900 }}>
                <span style={{ fontSize: 15, color: '#FF9B72' }}>Total do pedido</span>
                <span style={{ fontSize: 20, color: '#FF6B2C' }}>{fmtR(cartTotal)}</span>
              </div>

              {/* Agrupamento por setor — aviso visual */}
              <div style={{ background: '#10283F', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#62839A', marginBottom: 6 }}>DESTINO DOS PEDIDOS</div>
                {['bar', 'chapa', 'cozinha'].map(s => {
                  const itens = cart.filter(ci => ci.prod.setor === s)
                  if (!itens.length) return null
                  const sc = setorStyle(s)
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: sc.text, fontWeight: 700, minWidth: 70 }}>
                        {s === 'bar' ? '🍺 Bar' : s === 'chapa' ? '🔥 Chapa' : '👨‍🍳 Cozinha'}
                      </span>
                      <span style={{ fontSize: 11, color: '#aaa' }}>
                        {itens.map(ci => `${ci.qty}× ${ci.prod.nome}`).join(', ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={S.sheetActions}>
              <button
                onClick={() => setOverlay('cardapio')}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #3A6687', background: 'transparent', color: '#FF9B72', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                ← Continuar
              </button>
              <button
                onClick={confirmarPedido}
                disabled={loading}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FF6B2C', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 15 }}>
                {loading ? '⏳ Enviando…' : `✓ Confirmar ${cartCount} item${cartCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: Encerrar comanda (escolha de pagamento) ── */}
      {overlay === 'encerrar' && sheet && comanda && (
        <div style={S.overlay} onClick={() => setOverlay('comanda')}>
          <div style={{ ...S.sheet, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>✅ Encerrar comanda</div>
                <div style={{ fontSize: 11, opacity: .5, marginTop: 2 }}>
                  {comanda.mesa || comanda.nome || `#${comanda.id}`} · {(comanda.itens || []).length} itens
                </div>
              </div>
              <button style={S.sheetClose} onClick={() => setOverlay('comanda')}>✕</button>
            </div>
            <div style={{ padding: '8px 18px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 16px' }}>
                <span style={{ color: '#FF9B72', fontWeight: 700 }}>Total a pagar</span>
                <span style={{ color: '#FF6B2C', fontWeight: 900, fontSize: 26 }}>{fmtR(comanda.total || 0)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#62839A', fontWeight: 700, marginBottom: 8 }}>FORMA DE PAGAMENTO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { meio: 'dinheiro', label: 'Dinheiro', emoji: '💵' },
                  { meio: 'pix',      label: 'Pix',      emoji: '📱' },
                  { meio: 'cartao',   label: 'Cartão',   emoji: '💳' },
                  { meio: 'conta',    label: 'Na conta', emoji: '📒' },
                ].map(m => (
                  <button key={m.meio}
                    onClick={() => m.meio === 'conta' ? setOverlay('conta-cliente') : encerrarComanda(m.meio)}
                    disabled={loading}
                    style={{ padding: '16px 0', borderRadius: 12, border: '1.5px solid #3A6687', background: m.meio === 'conta' ? '#3a2800' : '#17354F', color: '#FF9B72', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 24 }}>{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.sheetActions}>
              <button
                onClick={() => setOverlay('comanda')}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #294F6C', background: 'transparent', color: '#aaa', cursor: 'pointer', fontWeight: 700 }}>
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: lançamento em conta de cliente ── */}
      {overlay === 'conta-cliente' && sheet && comanda && (
        <div style={S.overlay} onClick={() => setOverlay('encerrar')}>
          <div style={{ ...S.sheet, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>📒 Lançar em conta</div>
                <div style={{ fontSize: 11, opacity: .55, marginTop: 2 }}>A pendência será criada em Contas a Receber.</div>
              </div>
              <button style={S.sheetClose} onClick={() => setOverlay('encerrar')}>✕</button>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontWeight: 800 }}>
                <span style={{ color: '#FF9B72' }}>Total da comanda</span>
                <span style={{ color: '#FF6B2C', fontSize: 18 }}>{fmtR(comanda.total || 0)}</span>
              </div>
              {clientesConta.length ? (
                <>
                  <label style={{ display: 'block', fontSize: 11, color: '#62839A', fontWeight: 700, marginBottom: 6 }}>CLIENTE CADASTRADO</label>
                  <select
                    value={clienteContaId}
                    onChange={e => setClienteContaId(e.target.value)}
                    style={{ ...S.input, cursor: 'pointer' }}
                  >
                    {clientesConta.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                  </select>
                  <div style={{ marginTop: 10, color: '#FF9B72', fontSize: 11, lineHeight: 1.45 }}>
                    O valor ficará pendente no cadastro do cliente e poderá ser acompanhado em Contas a Receber.
                  </div>
                </>
              ) : (
                <div style={{ background: '#3a2800', border: '1px solid #FF6B2C', borderRadius: 10, padding: 12, color: '#FF9B72', fontSize: 13 }}>
                  Cadastre primeiro um cliente nominal em Cadastros Mestres para lançar uma venda em conta.
                </div>
              )}
            </div>
            <div style={S.sheetActions}>
              <button onClick={() => setOverlay('encerrar')} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #294F6C', background: 'transparent', color: '#aaa', cursor: 'pointer', fontWeight: 700 }}>← Voltar</button>
              <button
                onClick={() => encerrarComanda('conta', clienteContaId)}
                disabled={loading || !clienteContaId}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: clienteContaId ? '#FF6B2C' : '#12283F', color: clienteContaId ? '#fff' : '#555', cursor: clienteContaId ? 'pointer' : 'not-allowed', fontWeight: 800 }}
              >
                📒 Confirmar em conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: Nova comanda ── */}
      {overlay === 'nova' && (
        <div style={S.overlay} onClick={() => { setOverlay(null); setSheet(null) }}>
          <div style={{ ...S.sheet, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
              <div style={S.sheetTitle}>🆕 Mesa {sheet?.num} — Nova comanda</div>
              <button style={S.sheetClose} onClick={() => { setOverlay(null); setSheet(null) }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: '#FF9B72', marginBottom: 14, opacity: .7 }}>
                Informe o nome do cliente ou grupo (opcional)
              </div>
              <input
                style={S.input}
                placeholder="Nome do cliente ou mesa (ex: João, Família Silva…)"
                value={nomeMesa}
                onChange={e => setNomeMesa(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && iniciarComanda()}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setOverlay(null); setSheet(null) }}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #294F6C', background: 'transparent', color: '#aaa', cursor: 'pointer', fontWeight: 700 }}>
                  Cancelar
                </button>
                <button
                  onClick={iniciarComanda}
                  disabled={loading}
                  style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#FF6B2C', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 15 }}>
                  {loading ? '⏳' : '✓ Abrir comanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
