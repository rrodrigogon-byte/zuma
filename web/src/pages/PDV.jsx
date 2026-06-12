import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmtR } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../lib/auth'

const S = {
  page: { minHeight: '100vh', background: 'var(--bg, #091a0f)', color: '#f4f6ef', fontFamily: 'inherit', paddingBottom: 80 },
  banner: { background: 'linear-gradient(90deg,#1a4a20,#2d6e35)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  bannerStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 },
  bannerLabel: { fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.8 },
  bannerVal: { fontSize: 16, fontWeight: 700, color: '#8FD64A' },
  bannerValSmall: { fontSize: 13, fontWeight: 700 },
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
  sheet: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1f12', borderTop: '2px solid #1e4029', borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom,0)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', zIndex: 100 },
  sheetHeader: { padding: '14px 18px 10px', borderBottom: '1px solid #1e4029', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#8FD64A', fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #1a3020' },
  itemQty: { minWidth: 26, height: 26, borderRadius: 6, background: '#1e4029', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#8FD64A' },
  itemName: { flex: 1, fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: 600, color: '#C9A656' },
  itemStatus: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e4029', color: '#8FD64A' },
  itemDeleteBtn: { background: 'none', border: 'none', color: '#c0392b', fontSize: 15, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, opacity: 0.8 },
  sheetActions: { padding: '10px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1e4029' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0d1f12', border: '1.5px solid #1e4029', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  payBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  payBtn: (active) => ({ padding: '18px 10px', borderRadius: 10, border: `2px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : '#132b1b', color: '#f4f6ef', cursor: 'pointer', fontSize: 20, textAlign: 'center', transition: 'all .15s' }),
  payBtnLabel: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 10 },
  catBtn: (active) => ({ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : 'transparent', color: active ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }),
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, overflowY: 'auto', maxHeight: '40vh' },
  prodCard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 10px 8px', position: 'relative' },
  prodName: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  prodPrice: { fontSize: 13, color: '#C9A656', fontWeight: 700 },
  addBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 6, background: '#5FB335', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  input: { width: '100%', background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 8, padding: '9px 12px', color: '#f4f6ef', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' },
  contaBox: { marginBottom: 16 },
  contaRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 },
  contaTotal: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 17, fontWeight: 800, borderTop: '1px solid #1e4029', marginTop: 6 },
  serviceToggle: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 13, cursor: 'pointer' },
  bottomTabs: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1f12', borderTop: '1.5px solid #1e4029', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom,0)' },
  tabBtn: (active) => ({ flex: 1, padding: '10px 4px 8px', background: 'none', border: 'none', color: active ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', fontSize: 10, fontWeight: active ? 700 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: active ? 1 : 0.55 }),
  tabIcon: { fontSize: 18 },
  vendasList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vendaRow: { background: '#132b1b', border: '1px solid #1e4029', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}

const PAY_OPTIONS = [
  { key: 'pix', icon: '📲', label: 'Pix' },
  { key: 'cartao', icon: '💳', label: 'Cartão' },
  { key: 'dinheiro', icon: '💵', label: 'Dinheiro' },
  { key: 'carteira', icon: '👛', label: 'Carteira' },
]

const TABS = [
  { key: 'mesas', icon: '🍽', label: 'Mesas' },
  { key: 'vendas', icon: '📊', label: 'Vendas' },
]

export default function PDV() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [mesas, setMesas] = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [comanda, setComanda] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [payMeio, setPayMeio] = useState('pix')
  const [servico, setServico] = useState(true)
  const [novaVirtual, setNovaVirtual] = useState({ nome: '', local: '' })
  const [novaMesaNome, setNovaMesaNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('mesas')

  // Desconto
  const [descPct, setDescPct] = useState(0)

  // Sangria/Suprimento
  const [caixaMov, setCaixaMov] = useState({ tipo: 'sangria', valor: '', motivo: '' })

  // Item obs modal
  const [itemObs, setItemObs] = useState({ prod: null, obs: '' })

  // Troco
  const [valorRecebido, setValorRecebido] = useState('')

  // Divisão de conta
  const [dividir, setDividir] = useState(1)

  // Múltiplos meios de pagamento
  const [multiPag, setMultiPag] = useState([])
  const [multiPagValor, setMultiPagValor] = useState('')
  const [multiPagMeio, setMultiPagMeio] = useState('pix')
  const totalMultiPag = multiPag.reduce((s, p) => s + p.valor, 0)
  const restanteMultiPag = totalFinal - totalMultiPag

  // Vendas do dia
  const [vendas, setVendas] = useState([])
  const [vendasLoading, setVendasLoading] = useState(false)

  // Caixa stats
  const [caixaHoje, setCaixaHoje] = useState({ abertura: 0, sangrias: 0, suprimentos: 0, vendas: 0, saldo: 0 })

  // Print ref
  const printRef = useRef(null)
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

  const loadCaixaHoje = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/caixa/hoje')
      setCaixaHoje(data)
    } catch { /* silencioso */ }
  }, [])

  const loadVendas = useCallback(async () => {
    setVendasLoading(true)
    try {
      const data = await api.get('/api/admin/vendas?hoje=1')
      setVendas(Array.isArray(data) ? data : (data.vendas || []))
    } catch { /* silencioso */ }
    finally { setVendasLoading(false) }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    loadCaixaHoje()
    timerRef.current = setInterval(() => {
      loadMesas()
      loadCaixaHoje()
    }, 15000)
    return () => clearInterval(timerRef.current)
  }, [loadMesas, loadCardapio, loadCaixaHoje])

  useEffect(() => {
    if (activeTab === 'vendas') loadVendas()
  }, [activeTab, loadVendas])

  // Banner stats
  const abertas = [...(mesas.fisicas || []), ...(mesas.virtuais || [])].filter(m => m.status !== 'livre')
  const totalAberto = abertas.reduce((s, m) => s + (m.total || 0), 0)

  // Busca no cardápio
  const [buscaCardapio, setBuscaCardapio] = useState('')

  // Categorias
  const cats = ['Tudo', ...Array.from(new Set(cardapio.map(p => p.cat)))]
  const prodsFiltrados = cardapio
    .filter(p => catFiltro === 'Tudo' || p.cat === catFiltro)
    .filter(p => !buscaCardapio || p.nome.toLowerCase().includes(buscaCardapio.toLowerCase()))

  // Totais com desconto e serviço
  const subtotal = comanda?.total || 0
  const descVal = subtotal * (descPct / 100)
  const subtotalDesc = subtotal - descVal
  const servicoVal = servico ? subtotalDesc * 0.1 : 0
  const totalFinal = subtotalDesc + servicoVal

  // Troco (considera divisão)
  const totalPorPessoa = dividir > 1 ? totalFinal / dividir : totalFinal
  const trocoVal = valorRecebido ? (parseFloat(valorRecebido.replace(',', '.')) || 0) - totalPorPessoa : 0

  // Abrir mesa física
  const handleMesaClick = async (mesa) => {
    if (mesa.status === 'livre') {
      setNovaMesaNome('')
      setSheet({ tipo: 'fisica', num: mesa.num, nova: true })
      setOverlay('nova-fisica')
    } else {
      setDescPct(0)
      setSheet({ tipo: 'fisica', num: mesa.num, id: mesa.comandaId })
      await loadComanda(mesa.comandaId)
    }
  }

  // Abrir comanda virtual
  const handleVirtualClick = async (v) => {
    setDescPct(0)
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

  // Abrir modal de obs do item antes de adicionar
  const abrirObsItem = (prod) => {
    setItemObs({ prod, obs: '' })
    setOverlay('obs-item')
  }

  // Confirmar adição com obs
  const confirmarAdicionarItem = async () => {
    if (!itemObs.prod) return
    await adicionarItem(itemObs.prod.id, 1, itemObs.obs)
    setOverlay('cardapio')
    setItemObs({ prod: null, obs: '' })
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

  // Cancelar item individual
  const cancelarItem = async (idx) => {
    if (!comanda?.id) return
    if (!window.confirm('Remover este item da comanda?')) return
    try {
      await api.delete(`/api/comanda/${comanda.id}/item/${idx}`)
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item removido', 'success')
    } catch (e) {
      // fallback: tentar POST
      try {
        await api.post(`/api/comanda/${comanda.id}/cancelar-item`, { idx })
        await loadComanda(comanda.id)
        await loadMesas()
        toast('Item removido', 'success')
      } catch (e2) {
        toast(e2.message || 'Erro ao remover item', 'error')
      }
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
      // Se há múltiplos meios registrados, envia todos; senão envia o único selecionado
      const payload = multiPag.length > 0 && restanteMultiPag < 0.01
        ? {
            meios: multiPag,
            meio: multiPag[0]?.meio || payMeio,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
          }
        : {
            meio: payMeio,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
            dividir: dividir > 1 ? dividir : undefined,
          }
      await api.post(`/api/comanda/${comanda.id}/pagar`, payload)
      toast('Pagamento registrado! ✓', 'success')
      setOverlay(null)
      setSheet(null)
      setComanda(null)
      setDescPct(0)
      setValorRecebido('')
      setDividir(1)
      setMultiPag([])
      setMultiPagValor('')
      await loadMesas()
      await loadCaixaHoje()
    } catch (e) {
      toast(e.message || 'Erro ao pagar', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Sangria / Suprimento
  const registrarMovimento = async () => {
    const val = parseFloat(caixaMov.valor.replace(',', '.'))
    if (!val || val <= 0) { toast('Valor inválido', 'error'); return }
    if (!caixaMov.motivo.trim()) { toast('Informe o motivo', 'error'); return }
    setLoading(true)
    try {
      await api.post('/api/admin/caixa/movimento', {
        tipo: caixaMov.tipo,
        valor: val,
        motivo: caixaMov.motivo,
      })
      toast(`${caixaMov.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} registrado!`, 'success')
      setCaixaMov({ tipo: 'sangria', valor: '', motivo: '' })
      setOverlay(null)
      await loadCaixaHoje()
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Imprimir comanda
  const imprimirComanda = () => {
    if (!comanda) return
    const linhas = (comanda.itens || []).map(it =>
      `<tr><td>${it.qtd}× ${it.nome}${it.obs ? ` <small>(${it.obs})</small>` : ''}</td><td style="text-align:right">${fmtR((it.preco || 0) * (it.qtd || 1))}</td></tr>`
    ).join('')
    const mesa = sheet?.tipo === 'fisica' ? `Mesa ${sheet.num}` : (comanda.mesa || `Comanda #${comanda.id}`)
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Comanda #${comanda.id}</title>
      <style>
        body { font-family: monospace; font-size: 13px; max-width: 300px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; margin: 4px 0; }
        p { text-align: center; margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { padding: 4px 2px; border-bottom: 1px dashed #ccc; }
        .total { font-weight: bold; font-size: 15px; }
        .rodape { text-align: center; margin-top: 14px; font-size: 11px; color: #888; }
      </style></head><body>
      <h2>Agro Open</h2>
      <p>${mesa} — ${hora}</p>
      <table>${linhas}
        ${descPct > 0 ? `<tr><td>Desconto ${descPct}%</td><td style="text-align:right">-${fmtR(descVal)}</td></tr>` : ''}
        ${servico ? `<tr><td>Serviço 10%</td><td style="text-align:right">${fmtR(servicoVal)}</td></tr>` : ''}
        <tr class="total"><td>TOTAL</td><td style="text-align:right">${fmtR(totalFinal)}</td></tr>
      </table>
      <div class="rodape">Obrigado pela preferência!</div>
      </body></html>`
    const w = window.open('', '_blank', 'width=340,height=500')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => { w.print(); w.close() }, 400)
    }
  }

  const fecharSheet = () => {
    setSheet(null)
    setComanda(null)
    setOverlay(null)
    setDescPct(0)
    setDividir(1)
    setMultiPag([])
    setMultiPagValor('')
    setBuscaCardapio('')
  }

  const fmtMeio = (meio) => {
    const map = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro', carteira: 'Carteira' }
    return map[meio] || meio || '—'
  }

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
        @media print { body * { visibility: hidden; } }
      `}</style>

      {/* Banner resumo caixa */}
      <div style={S.banner}>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Abertura</span>
          <span style={{ ...S.bannerValSmall, color: '#f4f6ef' }}>{fmtR(caixaHoje.abertura || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Sangrias</span>
          <span style={{ ...S.bannerValSmall, color: '#e74c3c' }}>-{fmtR(caixaHoje.sangrias || 0)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f4f6ef', lineHeight: 1 }}>PDV</div>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{abertas.length} mesa{abertas.length !== 1 ? 's' : ''} abertas</div>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Vendas</span>
          <span style={{ ...S.bannerValSmall, color: '#8FD64A' }}>{fmtR(caixaHoje.vendas || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Saldo est.</span>
          <span style={{ ...S.bannerValSmall, color: '#C9A656' }}>{fmtR(caixaHoje.saldo || 0)}</span>
        </div>
        {/* Botão Sangria/Suprimento */}
        <button
          onClick={() => { setCaixaMov({ tipo: 'sangria', valor: '', motivo: '' }); setOverlay('caixa-mov') }}
          style={{ background: '#1e4029', border: '1.5px solid #5FB335', borderRadius: 8, color: '#f4f6ef', fontSize: 11, padding: '5px 9px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
          💰 Caixa
        </button>
      </div>

      {/* Conteúdo por aba */}
      {activeTab === 'mesas' && (
        <>
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
        </>
      )}

      {/* Aba Vendas */}
      {activeTab === 'vendas' && (
        <div style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={S.sectionTitle}>Vendas de Hoje</div>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={loadVendas}>↺ Atualizar</button>
          </div>
          {vendasLoading ? (
            <div style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>Carregando...</div>
          ) : vendas.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.45, textAlign: 'center', padding: 24 }}>Nenhuma venda fechada hoje</div>
          ) : (
            <div style={S.vendasList}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.55, padding: '0 4px 6px', borderBottom: '1px solid #1e4029' }}>
                <span>Total do dia</span>
                <span style={{ color: '#8FD64A', fontWeight: 700 }}>
                  {fmtR(vendas.reduce((s, v) => s + (v.total || v.valor || 0), 0))}
                </span>
              </div>
              {vendas.map((v, i) => (
                <div key={v.id || i} style={S.vendaRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.mesa || v.nome || `Comanda #${v.id}`}</div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>
                      {fmtMeio(v.meio || v.meioPagamento)} · {v.hora || v.fechadoEm ? new Date(v.fechadoEm || v.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#8FD64A' }}>{fmtR(v.total || v.valor || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom tabs */}
      <div style={S.bottomTabs}>
        {TABS.map(t => (
          <button key={t.key} style={S.tabBtn(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            <span style={S.tabIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button title="Imprimir comanda" onClick={imprimirComanda}
                  style={{ background: 'none', border: '1px solid #1e4029', borderRadius: 6, color: '#f4f6ef', fontSize: 16, cursor: 'pointer', padding: '3px 7px' }}>
                  🖨
                </button>
                <button style={S.sheetClose} onClick={fecharSheet}>✕</button>
              </div>
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
                    <button style={S.itemDeleteBtn} title="Cancelar item" onClick={() => cancelarItem(i)}>🗑</button>
                  </div>
                ))
              )}

              {/* Campo de desconto */}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e4029' }}>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Desconto (%)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {[0, 5, 10, 15, 20].map(p => (
                    <button key={p} onClick={() => setDescPct(p)}
                      style={{ padding: '4px 10px', borderRadius: 16, border: `1.5px solid ${descPct === p ? '#5FB335' : '#1e4029'}`, background: descPct === p ? '#1a4a20' : 'transparent', color: descPct === p ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {p}%
                    </button>
                  ))}
                  <input
                    type="number" min="0" max="100" placeholder="outro"
                    value={descPct || ''}
                    onChange={e => setDescPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    style={{ ...S.input, marginBottom: 0, width: 64, padding: '4px 8px', fontSize: 12 }}
                  />
                </div>
                {descPct > 0 && (
                  <div style={{ fontSize: 12, color: '#8FD64A', marginTop: 6 }}>
                    Desconto: -{fmtR(descVal)} → Subtotal: {fmtR(subtotalDesc)}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '8px 16px', borderTop: '1px solid #1e4029' }}>
              {descPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.6, marginBottom: 2 }}>
                  <span>Subtotal c/ desconto</span>
                  <span>{fmtR(subtotalDesc)}</span>
                </div>
              )}
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
                onClick={() => { setPayMeio('pix'); setValorRecebido(''); setOverlay('pagar') }}>
                💳 Pagar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Overlay: Seletor de cardápio */}
      {overlay === 'cardapio' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={{ ...S.modal, maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={S.modalTitle}>Cardápio</div>
              <button style={S.sheetClose} onClick={() => { setOverlay(null); setBuscaCardapio('') }}>✕</button>
            </div>

            {/* Campo de busca */}
            <input
              style={{ ...S.input, marginBottom: 8 }}
              placeholder="🔍 Buscar produto…"
              value={buscaCardapio}
              onChange={e => setBuscaCardapio(e.target.value)}
              autoFocus
            />

            <div style={S.catScroll}>
              {cats.map(c => (
                <button key={c} style={S.catBtn(catFiltro === c)} onClick={() => { setCatFiltro(c); setBuscaCardapio('') }}>{c}</button>
              ))}
            </div>

            <div style={S.prodGrid}>
              {prodsFiltrados.map(p => {
                const estBaixo = p.estoque !== null && p.estoque !== undefined && p.estoque <= 5
                const estZero = p.estoque !== null && p.estoque !== undefined && p.estoque <= 0
                return (
                <div key={p.id} style={{ ...S.prodCard, opacity: estZero ? 0.45 : 1, position: 'relative' }}>
                  {p.estoque !== null && p.estoque !== undefined && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4,
                      background: estZero ? '#e74c3c' : estBaixo ? '#C9A656' : '#2d4a32',
                      color: '#fff', borderRadius: 8, fontSize: 9, fontWeight: 700,
                      padding: '1px 5px', lineHeight: 1.4,
                    }}>
                      {estZero ? 'SEM' : estBaixo ? `⚠ ${p.estoque}` : p.estoque}
                    </div>
                  )}
                  <button style={S.addBtn} onClick={() => !estZero && abrirObsItem(p)} disabled={estZero}>+</button>
                  <div style={S.prodName}>{p.nome}</div>
                  <div style={S.prodPrice}>{fmtR(p.preco)}</div>
                  <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2 }}>{p.cat}</div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Obs por item */}
      {overlay === 'obs-item' && itemObs.prod && (
        <div style={S.overlay} onClick={() => setOverlay('cardapio')}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>➕ {itemObs.prod.nome}</div>
            <div style={{ fontSize: 13, color: '#C9A656', marginBottom: 14 }}>{fmtR(itemObs.prod.preco)}</div>
            <input
              style={S.input}
              placeholder="Observação (opcional, ex: sem cebola)"
              value={itemObs.obs}
              onChange={e => setItemObs(v => ({ ...v, obs: e.target.value }))}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay('cardapio')}>Voltar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmarAdicionarItem}>
                Adicionar
              </button>
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button title="Imprimir" onClick={imprimirComanda}
                  style={{ background: 'none', border: '1px solid #1e4029', borderRadius: 6, color: '#f4f6ef', fontSize: 15, cursor: 'pointer', padding: '3px 7px' }}>
                  🖨
                </button>
                <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
              </div>
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
              {descPct > 0 && (
                <div style={{ ...S.contaRow, color: '#8FD64A' }}>
                  <span>Desconto {descPct}%</span>
                  <span>-{fmtR(descVal)}</span>
                </div>
              )}
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
              onClick={() => { setValorRecebido(''); setOverlay('pagar') }}>
              💳 Ir para pagamento
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Pagamento */}
      {overlay === 'pagar' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={{ ...S.modal, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={S.modalTitle}>💳 Pagamento</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>
              {descPct > 0 && <span>Subtotal: {fmtR(subtotalDesc)} · </span>}
              Total: <strong style={{ color: '#8FD64A', fontSize: 16 }}>{fmtR(totalFinal)}</strong>
            </div>

            {/* Divisão de conta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: '#132b1b', borderRadius: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>Dividir entre:</span>
              <button onClick={() => setDividir(d => Math.max(1, d - 1))}
                style={{ background: '#1e4029', border: 'none', borderRadius: 6, color: '#8FD64A', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>-</button>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{dividir}</span>
              <button onClick={() => setDividir(d => d + 1)}
                style={{ background: '#1e4029', border: 'none', borderRadius: 6, color: '#8FD64A', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>+</button>
              {dividir > 1 && (
                <span style={{ fontSize: 13, color: '#C9A656', fontWeight: 700, marginLeft: 6 }}>
                  = {fmtR(totalFinal / dividir)}/pessoa
                </span>
              )}
            </div>

            <div style={S.payBtns}>
              {PAY_OPTIONS.map(o => (
                <div key={o.key} style={S.payBtn(payMeio === o.key)} onClick={() => { setPayMeio(o.key); setValorRecebido('') }}>
                  <div>{o.icon}</div>
                  <div style={S.payBtnLabel}>{o.label}</div>
                </div>
              ))}
            </div>

            {/* Múltiplos meios de pagamento */}
            {multiPag.length > 0 && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: '#0a1a10', borderRadius: 8, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Pagamentos registrados:</div>
                {multiPag.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{PAY_OPTIONS.find(o => o.key === p.meio)?.icon} {PAY_OPTIONS.find(o => o.key === p.meio)?.label}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#8FD64A', fontWeight: 700 }}>{fmtR(p.valor)}</span>
                      <button onClick={() => setMultiPag(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #1e4029', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Restante:</span>
                  <span style={{ color: restanteMultiPag > 0 ? '#C9A656' : '#8FD64A', fontWeight: 700 }}>{fmtR(Math.max(0, restanteMultiPag))}</span>
                </div>
              </div>
            )}

            {/* Adicionar pagamento parcial */}
            {multiPag.length > 0 && restanteMultiPag > 0.01 && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#132b1b', borderRadius: 8, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Adicionar pagamento parcial:</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="Valor"
                    value={multiPagValor}
                    onChange={e => setMultiPagValor(e.target.value)}
                    style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const v = parseFloat(multiPagValor) || 0
                      if (v > 0) {
                        setMultiPag(prev => [...prev, { meio: multiPagMeio, valor: v }])
                        setMultiPagValor('')
                      }
                    }}
                    style={{ background: '#5FB335', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontSize: 13 }}>
                    + Add
                  </button>
                </div>
              </div>
            )}

            {multiPag.length === 0 && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #1e4029', borderRadius: 8, color: '#8FD64A', padding: '6px 12px', cursor: 'pointer', fontSize: 12, marginTop: 8 }}
                onClick={() => setMultiPag([{ meio: payMeio, valor: parseFloat((totalFinal / 2).toFixed(2)) }])}>
                ➕ Dividir pagamento (2+ meios)
              </button>
            )}

            {/* Troco calculado para dinheiro */}
            {payMeio === 'dinheiro' && multiPag.length === 0 && (
              <div style={{ marginTop: 12, padding: '12px', background: '#132b1b', borderRadius: 10, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Valor recebido (R$)</div>
                <input
                  type="number" min="0" step="0.01"
                  placeholder={`mín. ${fmtR(dividir > 1 ? totalFinal / dividir : totalFinal)}`}
                  value={valorRecebido}
                  onChange={e => setValorRecebido(e.target.value)}
                  style={{ ...S.input, marginBottom: 0, fontSize: 16, fontWeight: 600 }}
                />
                {valorRecebido && (
                  <div style={{ marginTop: 8, textAlign: 'center' }}>
                    {trocoVal >= 0 ? (
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#8FD64A' }}>
                        Troco: {fmtR(trocoVal)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: '#e74c3c', fontWeight: 600 }}>
                        Valor insuficiente ({fmtR(Math.abs(trocoVal))} a menos)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 14, fontSize: 15 }}
              onClick={pagar}
              disabled={loading || (payMeio === 'dinheiro' && multiPag.length === 0 && valorRecebido && trocoVal < 0)}>
              {loading ? 'Processando...' : multiPag.length > 0 && restanteMultiPag < 0.01
                ? `✅ Confirmar — Pago (${fmtR(totalFinal)})`
                : `Confirmar — ${PAY_OPTIONS.find(o => o.key === payMeio)?.label}${dividir > 1 ? ` (${fmtR(totalFinal / dividir)}/pessoa)` : ''}`
              }
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

      {/* Overlay: Sangria / Suprimento de caixa */}
      {overlay === 'caixa-mov' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={S.modalTitle}>💰 Movimento de Caixa</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[{ key: 'sangria', label: '📤 Sangria', desc: 'Retirada' }, { key: 'suprimento', label: '📥 Suprimento', desc: 'Entrada' }].map(t => (
                <button key={t.key}
                  onClick={() => setCaixaMov(v => ({ ...v, tipo: t.key }))}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10,
                    border: `2px solid ${caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#e74c3c' : '#5FB335') : '#1e4029'}`,
                    background: caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#2d0a0a' : '#1a4a20') : '#132b1b',
                    color: '#f4f6ef', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <div style={{ fontSize: 16 }}>{t.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <input style={S.input} placeholder="Valor (R$)" type="number" min="0" step="0.01"
              value={caixaMov.valor}
              onChange={e => setCaixaMov(v => ({ ...v, valor: e.target.value }))} />
            <input style={S.input} placeholder="Motivo (ex: troco inicial, retirada gerencial)"
              value={caixaMov.motivo}
              onChange={e => setCaixaMov(v => ({ ...v, motivo: e.target.value }))} />

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={registrarMovimento} disabled={loading}>
                {loading ? '...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
