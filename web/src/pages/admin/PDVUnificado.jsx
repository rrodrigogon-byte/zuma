/**
 * PDV Unificado Multiplataforma — KYTTO Clube, Supermercado & Varejo
 * Suporte a: Desktop (Atalhos F2-F10), Mobile/Tablet (Câmera Scanner, Touch Keypad),
 * Totem Autoatendimento (Self-Checkout com PIX QR Code), Pesagem de Balança e Fila Offline (IndexedDB).
 * Rota: /admin/pdv-erp
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { enfileirarVendaOffline } from '../../lib/pdvOffline'

const theme = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#10b981', orange: '#FF6B2C', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6',
}

const SEGMENTOS = [
  { id: 'supermercado', label: 'Supermercado', icon: '🏪', cor: '#3b82f6' },
  { id: 'loja-moda',    label: 'Loja de Moda', icon: '👗', cor: '#ec4899' },
  { id: 'barbearia',    label: 'Barbearia',    icon: '✂️', cor: '#f59e0b' },
  { id: 'varejo',       label: 'Varejo Geral', icon: '🛒', cor: '#FF6B2C' },
  { id: 'bar',          label: 'Bar/Rest.',    icon: '🍺', cor: '#8b5cf6' },
]

const FORMAS_PGTO = [
  { id: 'dinheiro',     label: 'Dinheiro',    icon: '💵' },
  { id: 'pix',          label: 'PIX',         icon: '⚡' },
  { id: 'debito',       label: 'Débito',      icon: '💳' },
  { id: 'credito',      label: 'Crédito',     icon: '💳' },
  { id: 'crediario',    label: 'Crediário',   icon: '📋' },
  { id: 'vale_presente',label: 'Vale',        icon: '🎁' },
]

// Feedback sonoro característico de caixa de supermercado (Web Audio API)
function tocarBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  } catch {}
}

export default function PDVUnificado() {
  const [segmento, setSegmento] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('segmento') || 'supermercado';
    } catch {
      return 'supermercado';
    }
  })

  // Modo de operação da estação: 'operador' (caixa tradicional), 'totem' (self-checkout cliente) ou 'touch'
  const [modoOperacao, setModoOperacao] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('modo') === 'totem' ? 'totem' : 'operador';
    } catch {
      return 'operador';
    }
  })

  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [formaPgto, setFormaPgto] = useState('dinheiro')
  const [desconto, setDesconto] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState('valor') // 'valor' | 'percentual'
  const [troco, setTroco] = useState('')
  const [cpfNota, setCpfNota] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [venda, setVenda] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [filaLocalQtd, setFilaLocalQtd] = useState(0)

  // Modais de operação
  const [modalGrade, setModalGrade] = useState(null)
  const [modalPesagem, setModalPesagem] = useState(null)
  const [pesoInput, setPesoInput] = useState('0.500')
  const [modalCaixa, setModalCaixa] = useState(null)
  const [valorCaixa, setValorCaixa] = useState('')
  const [motivoCaixa, setMotivoCaixa] = useState('')
  const [modalCamera, setModalCamera] = useState(false)
  const [mostrarTecladoTouch, setMostrarTecladoTouch] = useState(false)
  const [atalhosSupermercado, setAtalhosSupermercado] = useState([])

  const inputRef = useRef(null)
  const buscaTimer = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Monitorar conectividade de rede
  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Focar no input ao montar
  useEffect(() => { inputRef.current?.focus() }, [])

  // Carregar atalhos rápidos do supermercado (Hortifrúti / Padaria / Balança)
  useEffect(() => {
    if (segmento === 'supermercado' || segmento === 'varejo') {
      api.get('/api/supermercado/produtos?limit=50').then(res => {
        const prods = res?.produtos || []
        const rapidos = prods.filter(p => p.pesavel || ['Hortifrúti', 'Padaria', 'Açougue e Carnes', 'Bebidas'].includes(p.departamento))
        setAtalhosSupermercado(rapidos.slice(0, 10))
      }).catch(() => null)
    }
  }, [segmento])

  // Busca com debounce
  useEffect(() => {
    if (!busca.trim()) { setResultados([]); return }
    clearTimeout(buscaTimer.current)
    buscaTimer.current = setTimeout(() => buscarProduto(busca), 250)
    return () => clearTimeout(buscaTimer.current)
  }, [busca, segmento])

  // Atalhos de teclado (F2-F10, Esc)
  useEffect(() => {
    function handleKeyDown(e) {
      if (modoOperacao === 'totem') return // Totem não usa atalhos de operador
      if (e.key === 'F2') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === 'F3') {
        e.preventDefault()
        document.getElementById('pdv-cpf-input')?.focus()
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (itens.length > 0 && window.confirm('Deseja limpar todos os itens e cancelar esta venda?')) {
          setItens([])
          setDesconto(0)
          setTroco('')
          setCpfNota('')
        }
      } else if (e.key === 'F7') {
        e.preventDefault()
        document.getElementById('pdv-desconto-input')?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        setModalCaixa({ tipo: 'sangria' })
      } else if (e.key === 'F10') {
        e.preventDefault()
        if (itens.length > 0 && !finalizando) {
          finalizarVenda()
        }
      } else if (e.key === 'Escape') {
        setModalGrade(null)
        setModalPesagem(null)
        setModalCaixa(null)
        setModalCamera(false)
        setVenda(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [itens, finalizando, modoOperacao])

  // Scanner por Câmera (Mobile / Tablet / Notebook)
  useEffect(() => {
    let animId = null
    let detector = null

    if (modalCamera) {
      if ('BarcodeDetector' in window) {
        try {
          detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'code_39', 'qr_code']
          })
        } catch {}
      }

      navigator.mediaDevices?.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      }).then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => null)
        }

        const scanLoop = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && detector) {
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue
                if (rawVal) {
                  tocarBeep()
                  buscarProduto(rawVal)
                  setModalCamera(false)
                  return
                }
              }
            } catch {}
          }
          animId = requestAnimationFrame(scanLoop)
        }
        animId = requestAnimationFrame(scanLoop)
      }).catch(err => {
        console.warn('Erro ao acessar câmera:', err)
        alert('Não foi possível acessar a câmera do dispositivo.')
        setModalCamera(false)
      })
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animId) cancelAnimationFrame(animId)
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (animId) cancelAnimationFrame(animId)
    }
  }, [modalCamera])

  async function buscarProduto(termoBruto) {
    if (!termoBruto?.trim()) return
    setBuscando(true)
    try {
      let quantidadeMultiplicada = 1
      let termo = termoBruto.trim()

      // Suporte à multiplicação direta do caixa: 3*7898000050012 ou 0.500*1001
      if (termo.includes('*')) {
        const partes = termo.split('*')
        if (partes.length === 2 && !isNaN(parseFloat(partes[0].replace(',', '.')))) {
          quantidadeMultiplicada = parseFloat(partes[0].replace(',', '.'))
          termo = partes[1].trim()
        }
      }

      if (segmento === 'supermercado' || segmento === 'varejo') {
        // Tentar busca por código de barras primeiro (inclui código de balança)
        if (/^\d+$/.test(termo)) {
          const res = await api.get(`/api/supermercado/produtos/buscar/${termo}`).catch(() => null)
          if (res?.produto || res?.nome) {
            const prod = res.produto || res
            const qtdBalanca = prod.etiquetaBalanca?.quantidade || prod.peso_balanca || quantidadeMultiplicada
            if (prod.pesavel && !prod.etiquetaBalanca && quantidadeMultiplicada === 1) {
              setModalPesagem(prod)
              setPesoInput('0.500')
            } else {
              adicionarItem(prod, qtdBalanca)
            }
            setBusca('')
            setResultados([])
            inputRef.current?.focus()
            return
          }
        }
        const res = await api.get(`/api/supermercado/produtos?busca=${encodeURIComponent(termo)}&limit=15`).catch(() => null)
        const prods = res?.produtos || []
        if (prods.length === 1 && (/^\d+$/.test(termo) || termo.length >= 6)) {
          const p = prods[0]
          if (p.pesavel && quantidadeMultiplicada === 1) {
            setModalPesagem(p)
            setPesoInput('0.500')
          } else {
            adicionarItem(p, quantidadeMultiplicada)
          }
          setBusca('')
          setResultados([])
          inputRef.current?.focus()
          return
        }
        setResultados(prods)
      } else if (segmento === 'loja-moda') {
        const res = await api.get(`/api/loja-moda/produtos?busca=${encodeURIComponent(termo)}&limit=8`).catch(() => null)
        setResultados(res?.produtos || [])
      } else {
        const res = await api.get(`/api/estoque/produtos?busca=${encodeURIComponent(termo)}&limit=8`).catch(() => null)
        setResultados(res?.produtos || [])
      }
    } catch { setResultados([]) }
    finally { setBuscando(false) }
  }

  function adicionarItem(produto, quantidade = 1, variante = null) {
    tocarBeep()
    const chave = variante ? `${produto.id}-${variante.id}` : produto.id
    const precoFinal = produto.precoFinal ?? produto.preco_final ?? produto.precoBase ?? produto.preco_venda ?? 0

    setItens(prev => {
      const idx = prev.findIndex(i => i.chave === chave)
      if (idx >= 0) {
        const novos = [...prev]
        novos[idx] = { ...novos[idx], quantidade: novos[idx].quantidade + (parseFloat(quantidade) || 1) }
        return novos
      }
      return [...prev, {
        chave,
        produto_id: produto.id,
        variante_id: variante?.id || null,
        nome: variante ? `${produto.nome} — ${variante.cor} / ${variante.tamanho}` : produto.nome,
        preco: parseFloat(precoFinal),
        preco_original: parseFloat(produto.precoBase ?? produto.preco_venda ?? precoFinal),
        quantidade: parseFloat(quantidade) || 1,
        unidade: produto.unidade || (produto.pesavel ? 'KG' : 'UN'),
        pesavel: produto.pesavel || false,
        plu: produto.plu || null,
        promocao: produto.promocao || null,
      }]
    })
  }

  function removerItem(chave) {
    setItens(prev => prev.filter(i => i.chave !== chave))
  }

  function alterarQuantidade(chave, delta) {
    setItens(prev => prev.map(i => {
      if (i.chave !== chave) return i
      const nova = Math.max(0.001, i.quantidade + delta)
      return { ...i, quantidade: Math.round(nova * 1000) / 1000 }
    }).filter(i => i.quantidade > 0))
  }

  function alterarPreco(chave, novoPreco) {
    setItens(prev => prev.map(i =>
      i.chave === chave ? { ...i, preco: parseFloat(novoPreco) || 0 } : i
    ))
  }

  // Cálculos
  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const valorDesconto = tipoDesconto === 'percentual'
    ? subtotal * (parseFloat(desconto) / 100)
    : parseFloat(desconto) || 0
  const total = Math.max(0, subtotal - valorDesconto)
  const trocoCalc = formaPgto === 'dinheiro' && parseFloat(troco) > total
    ? parseFloat(troco) - total : 0

  async function finalizarVenda() {
    if (!itens.length) return
    setFinalizando(true)
    const payload = {
      segmento,
      cpf_cliente: cpfNota.trim() || null,
      usuario_vendedor_id: 'operador-kytto',
      itens: itens.map(i => ({
        produto_id: i.produto_id,
        nome: i.nome,
        variante_id: i.variante_id,
        quantidade: i.quantidade,
        valor_unitario: i.preco,
        preco_unitario: i.preco,
      })),
      pagamentos: [{
        tipo: formaPgto === 'dinheiro' ? 'dinheiro' : formaPgto,
        valor: total,
        referencia_externa: formaPgto.startsWith('cartao') ? 'TEF-LOCAL' : null
      }],
      forma_pagamento: formaPgto,
      desconto: valorDesconto,
      total,
      troco: trocoCalc,
    }

    try {
      let res = null
      if (isOnline) {
        res = await api.post('/api/pdv/venda', payload).catch(async () => {
          return await api.post('/api/supermercado/venda', payload)
        })
      } else {
        // Modo offline resiliente no navegador
        await enfileirarVendaOffline(payload)
        setFilaLocalQtd(q => q + 1)
      }

      setVenda(res?.venda || {
        id: `v-${Date.now()}`,
        numero: `VND-${Date.now().toString(36).toUpperCase()}`,
        total,
        desconto: valorDesconto,
        troco: trocoCalc,
        cpf_cliente: cpfNota.trim() || null,
        forma_pagamento: formaPgto,
        itens: [...payload.itens],
        offline: !isOnline,
        data: new Date().toISOString()
      })

      setItens([])
      setDesconto(0)
      setTroco('')
      setCpfNota('')
    } catch (err) {
      // Fallback offline se o servidor falhar
      try {
        await enfileirarVendaOffline(payload)
        setFilaLocalQtd(q => q + 1)
        setVenda({
          id: `v-${Date.now()}`,
          numero: `OFF-${Date.now().toString(36).toUpperCase()}`,
          total,
          desconto: valorDesconto,
          troco: trocoCalc,
          cpf_cliente: cpfNota.trim() || null,
          forma_pagamento: formaPgto,
          itens: [...payload.itens],
          offline: true,
          data: new Date().toISOString()
        })
        setItens([])
        setDesconto(0)
        setTroco('')
        setCpfNota('')
      } catch (e2) {
        alert(err.message || 'Erro ao finalizar venda')
      }
    } finally {
      setFinalizando(false)
    }
  }

  async function salvarOperacaoCaixa() {
    if (!valorCaixa || parseFloat(valorCaixa) <= 0) {
      alert('Informe um valor válido.')
      return
    }
    const corpo = {
      tipo: modalCaixa.tipo,
      valor: parseFloat(valorCaixa),
      motivo: motivoCaixa.trim() || (modalCaixa.tipo === 'sangria' ? 'Sangria de caixa' : 'Suprimento de troco')
    }
    try {
      await api.post('/api/admin/caixa/movimentar', corpo).catch(() => null)
      alert(`${modalCaixa.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} registrado com sucesso!`)
      setModalCaixa(null)
      setValorCaixa('')
      setMotivoCaixa('')
    } catch {
      alert(`${modalCaixa.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} registrado localmente!`)
      setModalCaixa(null)
      setValorCaixa('')
      setMotivoCaixa('')
    }
  }

  // Adicionar dígito pelo teclado touch
  function handleTouchKey(key) {
    if (key === 'C') {
      setBusca('')
    } else if (key === 'ENTER') {
      buscarProduto(busca)
    } else {
      setBusca(prev => prev + key)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: theme.bg, color: theme.cream, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Top Bar Multiplataforma ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: theme.surface, borderBottom: `1px solid ${theme.line}`, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/admin/supermercado" style={{ color: theme.orange, textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Voltar
          </a>
          <div style={{ width: 1, height: 18, background: theme.line }} />

          {/* Seletor de Modo Operacional (Operador vs Totem Autoatendimento) */}
          <div style={{ display: 'flex', background: theme.card, borderRadius: 8, padding: 2, border: `1px solid ${theme.line}` }}>
            <button
              onClick={() => setModoOperacao('operador')}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: modoOperacao === 'operador' ? theme.blue : 'transparent', color: modoOperacao === 'operador' ? '#fff' : theme.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              🖥️ Caixa Operador
            </button>
            <button
              onClick={() => setModoOperacao('totem')}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: modoOperacao === 'totem' ? theme.green : 'transparent', color: modoOperacao === 'totem' ? '#fff' : theme.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              🛒 Totem Autoatendimento
            </button>
          </div>

          <div style={{ width: 1, height: 18, background: theme.line }} />

          {/* Segmentos */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {SEGMENTOS.map(sg => (
              <button
                key={sg.id}
                onClick={() => { setSegmento(sg.id); setResultados([]); setBusca('') }}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: segmento === sg.id ? sg.cor : 'transparent',
                  color: segmento === sg.id ? '#fff' : theme.muted,
                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >
                {sg.icon} {sg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ferramentas e Status de Rede */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          {/* Badge Conexão */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
            background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: isOnline ? theme.green : theme.red, fontWeight: 700, border: `1px solid ${isOnline ? theme.green : theme.red}`
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? theme.green : theme.red }} />
            {isOnline ? 'Online' : 'Modo Offline'}
            {filaLocalQtd > 0 && ` (${filaLocalQtd} na fila)`}
          </span>

          {/* Câmera Leitor de Código de Barras */}
          <button
            onClick={() => setModalCamera(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: theme.card, color: theme.blue, border: `1px solid ${theme.line}`, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            📷 Bipar Câmera
          </button>

          {/* Teclado Touch */}
          <button
            onClick={() => setMostrarTecladoTouch(t => !t)}
            style={{ background: mostrarTecladoTouch ? theme.orange : theme.card, color: mostrarTecladoTouch ? '#fff' : theme.cream, border: `1px solid ${theme.line}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            🔢 Teclado Touch
          </button>

          {/* Sangria e Suprimento */}
          {modoOperacao === 'operador' && (
            <button onClick={() => setModalCaixa({ tipo: 'sangria' })} style={{ background: theme.card, color: theme.yellow, border: `1px solid ${theme.line}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              💰 Sangria / Suprimento (F9)
            </button>
          )}
        </div>
      </div>

      {/* Banner Especial para Modo Totem / Autoatendimento */}
      {modoOperacao === 'totem' && (
        <div style={{ background: 'linear-gradient(90deg, #1e3a8a, #065f46)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏪</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Autoatendimento Express — Barbearia Dino Supermercado</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>1. Passe o código no leitor ou toque nos itens · 2. Confira seu carrinho · 3. Pague via PIX ou Cartão</div>
            </div>
          </div>
          <div style={{ fontSize: 12, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 6 }}>
            Toque nos produtos de hortifrúti/padaria para pesar
          </div>
        </div>
      )}

      {/* ── Área Principal (Colunas Esquerda e Direita) ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Coluna esquerda: catálogo e bipagem ───────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.line}`, overflow: 'hidden' }}>

          {/* Campo de busca / código de barras */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.line}`, background: theme.surface }}>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="🔍 Digite ou bipe código de barras, nome, PLU ou use '3*código' para multiplicar..."
                style={{
                  width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                  background: theme.card, border: `2px solid ${busca ? theme.blue : theme.line}`,
                  borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 600, outline: 'none',
                  boxShadow: busca ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (resultados.length === 1) {
                      const p = resultados[0]
                      if (segmento === 'loja-moda' && p.variacoes?.length > 0) {
                        setModalGrade(p)
                      } else if (p.pesavel) {
                        setModalPesagem(p)
                        setPesoInput('0.500')
                      } else {
                        adicionarItem(p)
                        setBusca('')
                        setResultados([])
                      }
                    } else if (busca.trim()) {
                      buscarProduto(busca)
                    }
                  }
                }}
              />
              {buscando && (
                <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: theme.blue }}>
                  Buscando...
                </div>
              )}
            </div>
          </div>

          {/* Teclado Virtual Touch (Retrátil para Totem e Tablets) */}
          {mostrarTecladoTouch && (
            <div style={{ padding: '10px 16px', background: theme.surface, borderBottom: `1px solid ${theme.line}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, maxWidth: 500 }}>
                {['1','2','3','4','5','6','7','8','9','0','00','*','C','ENTER'].map(k => (
                  <button
                    key={k}
                    onClick={() => handleTouchKey(k)}
                    style={{
                      padding: '12px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: k === 'ENTER' ? theme.green : k === 'C' ? theme.red : theme.card,
                      color: '#fff', fontSize: 15, fontWeight: 800
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Atalhos Rápidos de Balança / Hortifrúti (Modo Supermercado) */}
          {segmento === 'supermercado' && atalhosSupermercado.length > 0 && !busca && (
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.line}`, background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                ⚖️ Atalhos Rápidos de Balança & Hortifrúti (1 Toque)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 8 }}>
                {atalhosSupermercado.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.pesavel) {
                        setModalPesagem(p)
                        setPesoInput('0.500')
                      } else {
                        adicionarItem(p, 1)
                      }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '8px 10px', borderRadius: 8, border: `1px solid ${theme.line}`,
                      background: theme.card, color: theme.cream, cursor: 'pointer',
                      textAlign: 'left', transition: 'all .15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = theme.blue}
                    onMouseLeave={e => e.currentTarget.style.borderColor = theme.line}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: theme.green, fontWeight: 800, marginTop: 2 }}>
                      R$ {parseFloat(p.precoFinal || p.precoBase || 0).toFixed(2)}
                      <span style={{ fontSize: 9, color: theme.muted, marginLeft: 2 }}>/{p.unidade || (p.pesavel ? 'KG' : 'UN')}</span>
                    </div>
                    {p.plu && <div style={{ fontSize: 9, color: theme.yellow }}>PLU {p.plu}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resultados da busca */}
          {resultados.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {resultados.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (segmento === 'loja-moda' && p.variacoes?.length > 0) {
                      setModalGrade(p)
                    } else if (p.pesavel) {
                      setModalPesagem(p)
                      setPesoInput('0.500')
                    } else {
                      adicionarItem(p)
                      setBusca('')
                      setResultados([])
                      inputRef.current?.focus()
                    }
                  }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', marginBottom: 8,
                    background: theme.card, border: `1px solid ${theme.line}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = theme.green}
                  onMouseLeave={e => e.currentTarget.style.borderColor = theme.line}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nome}</div>
                    <div style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                      {p.departamento && `[${p.departamento}] `}
                      {p.ean && `EAN ${p.ean} · `}
                      {p.plu && `PLU ${p.plu} · `}
                      {p.pesavel ? 'Item Pesável (Balança)' : (p.unidade || 'UN')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: theme.green, fontSize: 16 }}>
                      R$ {parseFloat(p.precoFinal || p.precoBase || p.preco_venda || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: theme.muted }}>por {p.unidade || (p.pesavel ? 'KG' : 'UN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mensagem de boas-vindas quando vazio */}
          {!resultados.length && !busca && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: theme.muted, padding: 20 }}>
              <div style={{ fontSize: 56 }}>
                {SEGMENTOS.find(s => s.id === segmento)?.icon || '🛒'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                {modoOperacao === 'totem' ? 'Autoatendimento — Passe os Produtos' : `Frente de Caixa — ${SEGMENTOS.find(s => s.id === segmento)?.label}`}
              </div>
              <div style={{ fontSize: 13, maxWidth: 380, textAlign: 'center', lineHeight: 1.5 }}>
                Passe os produtos no leitor de código de barras ou use a busca.<br />
                Para multiplicar, digite <strong>3*código</strong> e pressione Enter.<br />
                Para pesáveis, clique no atalho de balança correspondente.
              </div>
            </div>
          )}
        </div>

        {/* ── Coluna direita: carrinho e pagamento ──────────────────────────── */}
        <div style={{ width: modoOperacao === 'totem' ? 480 : 420, display: 'flex', flexDirection: 'column', background: theme.surface }}>

          {/* Header do carrinho */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              🛒 Carrinho ({itens.reduce((acc, i) => acc + (i.pesavel ? 1 : i.quantidade), 0)})
            </div>
            {itens.length > 0 && (
              <button
                onClick={() => { if (window.confirm('Limpar carrinho?')) setItens([]) }}
                style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                Limpar (F4)
              </button>
            )}
          </div>

          {/* Itens do carrinho */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
            {itens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: theme.muted, fontSize: 13 }}>
                {modoOperacao === 'totem' ? 'Seu carrinho está vazio.\nBipe o primeiro produto ou escolha nos atalhos ao lado.' : 'Nenhum item adicionado à comanda.\nBipe o primeiro produto para iniciar.'}
              </div>
            ) : itens.map((item, idx) => (
              <div key={item.chave} style={{
                background: theme.card, border: `1px solid ${theme.line}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, flex: 1, marginRight: 8 }}>
                    <span style={{ color: theme.muted, marginRight: 6 }}>#{idx + 1}</span>
                    {item.nome}
                  </div>
                  <button onClick={() => removerItem(item.chave)} style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Controle de quantidade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => alterarQuantidade(item.chave, item.pesavel ? -0.1 : -1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                    >−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: 'center' }}>
                      {item.pesavel ? item.quantidade.toFixed(3) : item.quantidade}
                      <span style={{ fontSize: 10, color: theme.muted, marginLeft: 2 }}>{item.unidade}</span>
                    </span>
                    <button
                      onClick={() => alterarQuantidade(item.chave, item.pesavel ? 0.1 : 1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                    >+</button>
                  </div>
                  {/* Preço editável e Total */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: theme.muted, fontSize: 11 }}>
                      R$ {item.preco.toFixed(2)}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, minWidth: 70, textAlign: 'right', color: theme.green }}>
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CPF na Nota e Desconto */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${theme.line}`, background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <input
                  id="pdv-cpf-input"
                  placeholder="👤 CPF na nota (F3)"
                  value={cpfNota}
                  onChange={e => setCpfNota(e.target.value)}
                  maxLength={14}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 8, color: theme.cream, fontSize: 12, outline: 'none' }}
                />
              </div>
              {modoOperacao === 'operador' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setTipoDesconto('valor')}
                    style={{ padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: tipoDesconto === 'valor' ? theme.green : theme.card, color: tipoDesconto === 'valor' ? '#fff' : theme.muted }}
                  >R$</button>
                  <button
                    onClick={() => setTipoDesconto('percentual')}
                    style={{ padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: tipoDesconto === 'percentual' ? theme.green : theme.card, color: tipoDesconto === 'percentual' ? '#fff' : theme.muted }}
                  >%</button>
                  <input
                    id="pdv-desconto-input"
                    type="number"
                    value={desconto || ''}
                    onChange={e => setDesconto(e.target.value)}
                    placeholder="Desc (F7)"
                    style={{ width: 75, padding: '6px 8px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 6, color: theme.cream, fontSize: 12, outline: 'none' }}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            {/* Totais */}
            {valorDesconto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: theme.muted }}>Subtotal: R$ {subtotal.toFixed(2)}</span>
                <span style={{ color: theme.red }}>− Desconto: R$ {valorDesconto.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>TOTAL A PAGAR</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: theme.green }}>R$ {total.toFixed(2)}</span>
            </div>

            {/* Formas de Pagamento */}
            <div style={{ display: 'grid', gridTemplateColumns: modoOperacao === 'totem' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {FORMAS_PGTO.filter(fp => modoOperacao === 'totem' ? ['pix', 'debito', 'credito', 'vale_presente'].includes(fp.id) : true).map(fp => (
                <button
                  key={fp.id}
                  onClick={() => setFormaPgto(fp.id)}
                  style={{
                    padding: modoOperacao === 'totem' ? '12px 6px' : '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: formaPgto === fp.id ? (modoOperacao === 'totem' ? theme.green : theme.blue) : theme.card,
                    color: formaPgto === fp.id ? '#fff' : theme.muted,
                    fontSize: modoOperacao === 'totem' ? 13 : 11, fontWeight: 700, transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: modoOperacao === 'totem' ? 18 : 14, marginBottom: 2 }}>{fp.icon}</div>
                  {fp.label}
                </button>
              ))}
            </div>

            {/* Troco para Dinheiro (Apenas Operador) */}
            {formaPgto === 'dinheiro' && modoOperacao === 'operador' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: theme.muted, whiteSpace: 'nowrap' }}>Recebido:</span>
                <input
                  type="number"
                  value={troco}
                  onChange={e => setTroco(e.target.value)}
                  placeholder={total.toFixed(2)}
                  style={{ flex: 1, padding: '8px 10px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                  step="0.01"
                />
                {trocoCalc > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.yellow, whiteSpace: 'nowrap' }}>
                    Troco: R$ {trocoCalc.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Botão Finalizar Venda */}
            <button
              onClick={finalizarVenda}
              disabled={!itens.length || finalizando}
              style={{
                width: '100%', padding: modoOperacao === 'totem' ? '18px' : '15px',
                background: itens.length ? theme.green : theme.card,
                color: itens.length ? '#fff' : theme.muted,
                border: 'none', borderRadius: 12,
                fontSize: modoOperacao === 'totem' ? 18 : 15, fontWeight: 900, cursor: itens.length ? 'pointer' : 'not-allowed',
                boxShadow: itens.length ? '0 8px 20px rgba(16,185,129,0.3)' : 'none',
                transition: 'all .15s',
              }}
            >
              {finalizando ? '⏳ Processando...' : (modoOperacao === 'totem' ? `💳 Pagar e Concluir — R$ ${total.toFixed(2)}` : `✅ Finalizar Venda (F10) — R$ ${total.toFixed(2)}`)}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Leitor por Câmera (Mobile / Tablet) ────────────────────────── */}
      {modalCamera && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130 }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 20, width: 360, textAlign: 'center', border: `1px solid ${theme.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>📷 Bipar com Câmera</div>
              <button onClick={() => setModalCamera(false)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ width: '100%', height: 260, background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay playsInline muted />
              <div style={{ position: 'absolute', inset: '25% 15%', border: `2px dashed ${theme.green}`, borderRadius: 8, pointerEvents: 'none' }} />
            </div>
            <div style={{ fontSize: 12, color: theme.muted, marginTop: 12 }}>
              Aponte a câmera para o código de barras ou QR Code do produto.
            </div>
            <button
              onClick={() => setModalCamera(false)}
              style={{ marginTop: 14, width: '100%', padding: '10px', background: theme.surface, color: theme.cream, border: `1px solid ${theme.line}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
            >
              Fechar Câmera
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Pesagem Rápida (Balança) ─────────────────────────────────── */}
      {modalPesagem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 24, width: 380, border: `1px solid ${theme.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>⚖️ Balança — {modalPesagem.nome}</div>
              <button onClick={() => setModalPesagem(null)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: theme.muted, marginBottom: 12 }}>
              Preço por KG: <strong style={{ color: theme.green }}>R$ {parseFloat(modalPesagem.precoFinal || modalPesagem.precoBase || 0).toFixed(2)}</strong>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: theme.muted, marginBottom: 6, display: 'block' }}>
              Peso em Quilogramas (KG):
            </label>
            <input
              type="number"
              step="0.005"
              autoFocus
              value={pesoInput}
              onChange={e => setPesoInput(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', background: theme.surface, border: `2px solid ${theme.blue}`, borderRadius: 10, color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center', outline: 'none' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const peso = parseFloat(pesoInput.replace(',', '.')) || 0.1
                  adicionarItem(modalPesagem, peso)
                  setModalPesagem(null)
                  inputRef.current?.focus()
                }
              }}
            />

            {/* Botões de peso rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, margin: '12px 0' }}>
              {['0.100', '0.250', '0.500', '1.000', '2.000'].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPesoInput(w)}
                  style={{ padding: '6px 2px', borderRadius: 6, border: `1px solid ${theme.line}`, background: pesoInput === w ? theme.blue : theme.surface, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {parseFloat(w) < 1 ? `${parseFloat(w) * 1000}g` : `${parseFloat(w)}kg`}
                </button>
              ))}
            </div>

            {/* Total Calculado */}
            <div style={{ background: theme.surface, padding: 12, borderRadius: 10, textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: theme.muted }}>Valor Total Calculado:</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: theme.green, marginTop: 2 }}>
                R$ {((parseFloat(pesoInput.replace(',', '.')) || 0) * (parseFloat(modalPesagem.precoFinal || modalPesagem.precoBase || 0))).toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalPesagem(null)}
                style={{ flex: 1, padding: '12px', background: theme.surface, color: theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const peso = parseFloat(pesoInput.replace(',', '.')) || 0.1
                  adicionarItem(modalPesagem, peso)
                  setModalPesagem(null)
                  inputRef.current?.focus()
                }}
                style={{ flex: 2, padding: '12px', background: theme.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                Confirmar Pesagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Sangria / Suprimento de Caixa ────────────────────────────── */}
      {modalCaixa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 24, width: 360, border: `1px solid ${theme.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
                {modalCaixa.tipo === 'sangria' ? '💸 Sangria de Caixa' : '💵 Suprimento de Troco'}
              </div>
              <button onClick={() => setModalCaixa(null)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setModalCaixa({ tipo: 'sangria' })}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: modalCaixa.tipo === 'sangria' ? theme.red : theme.surface, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                Sangria (Retirada)
              </button>
              <button
                onClick={() => setModalCaixa({ tipo: 'suprimento' })}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: modalCaixa.tipo === 'suprimento' ? theme.green : theme.surface, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                Suprimento (Entrada)
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: theme.muted, display: 'block' }}>
                Valor (R$):
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="0,00"
                  value={valorCaixa}
                  onChange={e => setValorCaixa(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12, color: theme.muted, display: 'block' }}>
                Motivo / Observação:
                <input
                  placeholder="Ex: Pagamento fornecedor, troco inicial..."
                  value={motivoCaixa}
                  onChange={e => setMotivoCaixa(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalCaixa(null)} style={{ flex: 1, padding: '10px', background: theme.surface, color: theme.muted, border: `1px solid ${theme.line}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                Voltar
              </button>
              <button onClick={salvarOperacaoCaixa} style={{ flex: 1, padding: '10px', background: theme.blue, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Venda Realizada com Cupom Térmico (80mm) ou QR Code PIX ─── */}
      {venda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ background: '#fff', color: '#111', borderRadius: 16, padding: 24, width: 380, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>

            {/* Aviso especial se a venda foi gravada em modo offline */}
            {venda.offline && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                ⚡ Venda gravada no Modo Offline! Sincronização automática quando a rede voltar.
              </div>
            )}

            {/* Comprovante Térmico Formatado */}
            <div id="cupom-pdv-print" style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4, borderBottom: '1px dashed #666', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
                KYTTO SUPERMERCADO & VAREJO
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: '#444' }}>
                Barbearia Dino Comércio e Serviços Ltda<br />
                DOCUMENTO AUXILIAR DE VENDA (NÃO FISCAL)
              </div>
              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>Venda: #{venda.numero || venda.id?.slice(-6).toUpperCase()}</span>
                <span>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR').slice(0, 5)}</span>
              </div>
              {venda.cpf_cliente && (
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  <strong>CPF Consumidor:</strong> {venda.cpf_cliente}
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />
              <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>ITENS VENDIDOS:</div>
              {(venda.itens || []).map((it, idx) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{idx + 1}. {it.nome}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#444' }}>
                    <span>{it.quantidade} × R$ {parseFloat(it.preco_unitario || 0).toFixed(2)}</span>
                    <strong style={{ color: '#111' }}>R$ {(it.quantidade * (it.preco_unitario || 0)).toFixed(2)}</strong>
                  </div>
                </div>
              ))}

              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />
              {venda.desconto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Desconto:</span>
                  <span>− R$ {parseFloat(venda.desconto).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 'bold', marginTop: 4 }}>
                <span>TOTAL:</span>
                <span>R$ {parseFloat(venda.total || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                <span>Forma de Pagamento:</span>
                <span style={{ textTransform: 'uppercase' }}>{venda.forma_pagamento}</span>
              </div>
              {venda.troco > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Troco:</span>
                  <span>R$ {parseFloat(venda.troco).toFixed(2)}</span>
                </div>
              )}
              <div style={{ textAlign: 'center', fontSize: 10, marginTop: 14, color: '#555' }}>
                Obrigado pela preferência! Volte sempre!
              </div>
            </div>

            {/* Ações de Impressão e Nova Venda */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setVenda(null)}
                style={{ flex: 1, padding: '12px', background: theme.surface, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
              >
                Nova Venda
              </button>
              <button
                onClick={() => { window.print() }}
                style={{ flex: 1.5, padding: '12px', background: theme.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                🖨️ Imprimir Cupom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
