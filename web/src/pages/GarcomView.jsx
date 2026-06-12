/**
 * GarcomView.jsx — Modo Garçom simplificado
 * Interface focada em: ver mesas, adicionar itens, pedir conta.
 * Sem acesso a caixa, pagamentos, configurações.
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR } from '../lib/api'
import { useToast } from '../hooks/useToast'

const S = {
  page: { minHeight: '100vh', background: '#060e08', color: '#f4f6ef', fontFamily: 'inherit' },
  header: {
    background: '#0a1a0d', borderBottom: '2px solid #1e3a24',
    padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 20,
  },
  title: { fontSize: 18, fontWeight: 800, color: '#5FB335' },
  badge: (n) => ({
    background: n > 0 ? '#e74c3c' : '#2d4a32', color: '#fff',
    borderRadius: 20, padding: '3px 12px', fontWeight: 800, fontSize: 14,
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, padding: 16 },
  card: (s) => ({
    background: s === 'ocupada' ? '#132b1b' : s === 'conta' ? '#3a2800' : '#0d1f12',
    border: `2px solid ${s === 'conta' ? '#C9A656' : s === 'ocupada' ? '#5FB335' : '#1e4029'}`,
    borderRadius: 10, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
    animation: s === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none',
  }),
  cardNum: { fontSize: 24, fontWeight: 800 },
  cardStatus: (s) => ({
    fontSize: 9, marginTop: 4, padding: '2px 6px', borderRadius: 4,
    background: s === 'conta' ? '#C9A656' : s === 'ocupada' ? '#1e4029' : '#0d1f12',
    color: s === 'conta' ? '#000' : '#8FD64A', display: 'inline-block',
  }),
  cardTotal: { fontSize: 12, color: '#8FD64A', fontWeight: 700, marginTop: 3 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: '#0d1f12', borderTop: '2px solid #1e4029', borderRadius: '18px 18px 0 0', padding: '0 0 20px', width: '100%', maxWidth: 500, maxHeight: '88vh', display: 'flex', flexDirection: 'column' },
  sheetHeader: { padding: '14px 18px 10px', borderBottom: '1px solid #1e4029', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#8FD64A', fontSize: 22, cursor: 'pointer' },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #1a3020' },
  itemQty: { minWidth: 26, height: 26, borderRadius: 6, background: '#1e4029', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#8FD64A' },
  sheetActions: { padding: '10px 16px 14px', display: 'flex', gap: 8, borderTop: '1px solid #1e4029' },
  input: { width: '100%', background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 8, padding: '9px 12px', color: '#f4f6ef', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 8 },
  catBtn: (a) => ({ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${a ? '#5FB335' : '#1e4029'}`, background: a ? '#1a4a20' : 'transparent', color: a ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }),
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 },
  prodCard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 10px 8px', position: 'relative', cursor: 'pointer' },
  prodName: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  prodPrice: { fontSize: 13, color: '#C9A656', fontWeight: 700 },
  addBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 6, background: '#5FB335', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  statusBadge: { fontSize: 9, padding: '2px 5px', borderRadius: 4, fontWeight: 700 },
  section: { padding: '12px 16px 4px' },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8FD64A', marginBottom: 10 },
}

export default function GarcomView() {
  const { toast } = useToast()
  const [mesas, setMesas] = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [comanda, setComanda] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [overlay, setOverlay] = useState(null) // null | 'comanda' | 'cardapio' | 'obs'
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [busca, setBusca] = useState('')
  const [itemObs, setItemObs] = useState({ prod: null, obs: '' })
  const [loading, setLoading] = useState(false)
  const [novaMesa, setNovaMesa] = useState('')

  const loadMesas = useCallback(async () => {
    try { setMesas(await api.get('/api/mesas')) } catch { /* silencioso */ }
  }, [])

  const loadCardapio = useCallback(async () => {
    try {
      const data = await api.get('/api/cardapio')
      setCardapio(data.filter(p => !p.indisponivel))
    } catch { /* silencioso */ }
  }, [])

  const loadComanda = useCallback(async (id) => {
    if (!id) return
    try { setComanda(await api.get(`/api/comanda/${id}`)) } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    const t = setInterval(() => loadMesas(), 15000)
    return () => clearInterval(t)
  }, [loadMesas, loadCardapio])

  const cats = ['Tudo', ...Array.from(new Set(cardapio.map(p => p.cat)))]
  const prods = cardapio
    .filter(p => catFiltro === 'Tudo' || p.cat === catFiltro)
    .filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  const abertas = [...(mesas.fisicas || []), ...(mesas.virtuais || [])].filter(m => m.status !== 'livre')
  const pendentes = abertas.filter(m => m.status === 'conta').length

  const handleMesaClick = async (mesa) => {
    if (mesa.status === 'livre') {
      setNovaMesa('')
      setSheet({ tipo: 'fisica', num: mesa.num })
      setOverlay('nova')
    } else {
      setSheet({ tipo: 'fisica', num: mesa.num, id: mesa.comandaId })
      await loadComanda(mesa.comandaId)
      setOverlay('comanda')
    }
  }

  const iniciarComanda = async () => {
    if (!sheet?.num) return
    setLoading(true)
    try {
      await api.post(`/api/mesa/${sheet.num}/pedir`, { itens: [], nome: novaMesa || undefined })
      const mesasData = await api.get('/api/mesas')
      setMesas(mesasData)
      const m = mesasData.fisicas.find(x => x.num === sheet.num)
      if (m?.comandaId) {
        setSheet(s => ({ ...s, id: m.comandaId }))
        await loadComanda(m.comandaId)
      }
      setOverlay('comanda')
    } catch (e) {
      toast(e.message || 'Erro ao abrir comanda', 'error')
    } finally { setLoading(false) }
  }

  const adicionarItem = async () => {
    if (!itemObs.prod || !sheet?.id) return
    setLoading(true)
    try {
      await api.post(`/api/comanda/${sheet.id}/adicionar`, { itens: [{ produtoId: itemObs.prod.id, qtd: 1, obs: itemObs.obs }] })
      await loadComanda(sheet.id)
      await loadMesas()
      toast('Item adicionado!', 'success')
      setOverlay('comanda')
      setItemObs({ prod: null, obs: '' })
    } catch (e) {
      toast(e.message || 'Erro ao adicionar', 'error')
    } finally { setLoading(false) }
  }

  const pedirConta = async () => {
    if (!sheet?.id) return
    setLoading(true)
    try {
      await api.post(`/api/comanda/${sheet.id}/conta`, {})
      await loadComanda(sheet.id)
      await loadMesas()
      toast('Conta solicitada! ✓', 'success')
      setOverlay('comanda')
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally { setLoading(false) }
  }

  const fechar = () => { setOverlay(null); setSheet(null); setComanda(null); setBusca('') }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,166,86,.5); }
          50% { box-shadow: 0 0 0 8px rgba(201,166,86,0); }
        }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>👨‍🍳 Modo Garçom</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={S.badge(pendentes)}>
            {pendentes > 0 ? `${pendentes} conta${pendentes > 1 ? 's' : ''}` : 'OK'}
          </span>
          <button onClick={loadMesas}
            style={{ background: '#1e4029', border: 'none', borderRadius: 8, color: '#8FD64A', padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
            ↺
          </button>
        </div>
      </div>

      {/* Mesas físicas */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Mesas Físicas</div>
        <div style={S.grid}>
          {(mesas.fisicas || []).map(m => (
            <div key={m.num} style={S.card(m.status)} onClick={() => handleMesaClick(m)}>
              <div style={S.cardNum}>{m.num}</div>
              <div style={S.cardStatus(m.status)}>
                {m.status === 'livre' ? 'livre' : m.status === 'conta' ? 'conta' : 'ocupada'}
              </div>
              {m.status !== 'livre' && <div style={S.cardTotal}>{fmtR(m.total || 0)}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Comandas Virtuais */}
      {(mesas.virtuais || []).length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Comandas Virtuais</div>
          {mesas.virtuais.map(v => (
            <div key={v.id}
              style={{ background: '#132b1b', border: '1px solid #1e4029', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={async () => {
                setSheet({ tipo: 'virtual', id: v.id })
                await loadComanda(v.id)
                setOverlay('comanda')
              }}>
              <span style={{ fontWeight: 700 }}>{v.nome || `#${v.id}`}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#8FD64A', fontWeight: 700 }}>{fmtR(v.total || 0)}</div>
                {v.status === 'conta' && <span style={{ fontSize: 10, color: '#C9A656' }}>conta</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet da comanda */}
      {overlay === 'comanda' && sheet && comanda && (
        <div style={S.overlay} onClick={fechar}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>
                  {sheet.tipo === 'fisica' ? `Mesa ${sheet.num}` : comanda.mesa || `Comanda #${comanda.id}`}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>#{comanda.id} · {fmtR(comanda.total || 0)}</div>
              </div>
              <button style={S.sheetClose} onClick={fechar}>✕</button>
            </div>

            <div style={S.sheetBody}>
              {(!comanda.itens || comanda.itens.length === 0) ? (
                <div style={{ textAlign: 'center', opacity: 0.4, padding: 20, fontSize: 13 }}>Sem itens ainda</div>
              ) : (
                comanda.itens.map((it, i) => (
                  <div key={i} style={S.itemRow}>
                    <div style={S.itemQty}>{it.qtd}</div>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      {it.nome}
                      {it.obs && <div style={{ fontSize: 10, opacity: 0.5 }}>{it.obs}</div>}
                    </div>
                    {it.status && (
                      <span style={{
                        ...S.statusBadge,
                        background: it.status === 'pronto' ? '#1a4a20' : it.status === 'em_preparo' ? '#3a2800' : '#1e4029',
                        color: it.status === 'pronto' ? '#8FD64A' : it.status === 'em_preparo' ? '#C9A656' : '#aaa',
                      }}>{it.status}</span>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#C9A656' }}>
                      {fmtR((it.preco || 0) * (it.qtd || 1))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={S.sheetActions}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                onClick={() => { setBusca(''); setOverlay('cardapio') }}>
                ➕ Adicionar item
              </button>
              {comanda.status !== 'conta' && (
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
                  onClick={pedirConta} disabled={loading || !comanda.itens?.length}>
                  🧾 Pedir conta
                </button>
              )}
              {comanda.status === 'conta' && (
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: '#3a280055', border: '1px solid #C9A656', borderRadius: 8, color: '#C9A656', fontWeight: 700, fontSize: 13 }}>
                  ⏳ Aguardando caixa
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seletor de cardápio */}
      {overlay === 'cardapio' && (
        <div style={S.overlay} onClick={() => setOverlay('comanda')}>
          <div style={{ ...S.sheet, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHeader}>
              <div style={S.sheetTitle}>Adicionar item</div>
              <button style={S.sheetClose} onClick={() => setOverlay('comanda')}>✕</button>
            </div>
            <div style={{ padding: '10px 16px 0' }}>
              <input style={S.input} placeholder="🔍 Buscar…" value={busca}
                onChange={e => setBusca(e.target.value)} autoFocus />
              <div style={S.catScroll}>
                {cats.map(c => (
                  <button key={c} style={S.catBtn(catFiltro === c)}
                    onClick={() => { setCatFiltro(c); setBusca('') }}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 16px', flex: 1 }}>
              <div style={S.prodGrid}>
                {prods.map(p => {
                  const sem = p.estoque !== null && p.estoque !== undefined && p.estoque <= 0
                  return (
                    <div key={p.id} style={{ ...S.prodCard, opacity: sem ? 0.4 : 1 }}>
                      <button style={S.addBtn} disabled={sem}
                        onClick={() => { setItemObs({ prod: p, obs: '' }); setOverlay('obs') }}>+</button>
                      <div style={S.prodName}>{p.nome}</div>
                      <div style={S.prodPrice}>{fmtR(p.preco)}</div>
                      {sem && <div style={{ fontSize: 9, color: '#e74c3c', fontWeight: 700 }}>SEM ESTOQUE</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Observação do item */}
      {overlay === 'obs' && itemObs.prod && (
        <div style={S.overlay} onClick={() => setOverlay('cardapio')}>
          <div style={{ ...S.sheet, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHeader}>
              <div style={S.sheetTitle}>➕ {itemObs.prod.nome}</div>
              <button style={S.sheetClose} onClick={() => setOverlay('cardapio')}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 15, color: '#C9A656', fontWeight: 700, marginBottom: 12 }}>{fmtR(itemObs.prod.preco)}</div>
              <input style={S.input} placeholder="Observação (ex: sem gelo, bem gelado…)"
                value={itemObs.obs}
                onChange={e => setItemObs(v => ({ ...v, obs: e.target.value }))}
                autoFocus />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay('cardapio')}>Voltar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={adicionarItem} disabled={loading}>
                  {loading ? '…' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nova comanda */}
      {overlay === 'nova' && (
        <div style={S.overlay} onClick={() => { setOverlay(null); setSheet(null) }}>
          <div style={{ ...S.sheet, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHeader}>
              <div style={S.sheetTitle}>Mesa {sheet?.num} — Nova comanda</div>
              <button style={S.sheetClose} onClick={() => { setOverlay(null); setSheet(null) }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <input style={S.input} placeholder="Nome do cliente (opcional)"
                value={novaMesa} onChange={e => setNovaMesa(e.target.value)} autoFocus />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setOverlay(null); setSheet(null) }}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={iniciarComanda} disabled={loading}>
                  {loading ? '…' : 'Abrir comanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
