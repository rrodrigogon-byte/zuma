/**
 * PDV Unificado Multiplataforma — KYTTO Clube, Supermercado & Varejo
 * Suporte a:
 * 1. Promoções Automáticas (Leve & Pague, Oferta Clube, Desconto no Carrinho)
 * 2. Fechamento Cego de Caixa & Redução Z (Conferência de gaveta, quebra e relatório)
 * 3. Auto-sincronização de Fila Offline em Background (IndexedDB + Eventos Internos)
 * 4. Emissão de NFC-e Fiscal Direta com Chave de Acesso e QR Code SEFAZ
 * 5. Balança Comercial via Web Serial API (Toledo / Filizola) & Teclado Touch
 * Rota: /admin/pdv-erp
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { enfileirarVendaOffline, listarEventosOffline, removerEventosOffline, resumoFilaOffline } from '../../lib/pdvOffline'

const theme = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#10b981', orange: '#FF6B2C', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6',
}

const SEGMENTOS = [
  { id: 'supermercado', label: 'Supermercado', icon: '🏪', cor: '#3b82f6' },
  { id: 'stallone',     label: 'Stallone Nutre Sport', icon: '🏋️', cor: '#e11d48' },
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

  // Modo de operação da estação: 'operador' (caixa tradicional) ou 'totem' (self-checkout cliente)
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
  const [descontoManual, setDescontoManual] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState('valor') // 'valor' | 'percentual'
  const [troco, setTroco] = useState('')
  const [cpfNota, setCpfNota] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [emitindoNfce, setEmitindoNfce] = useState(false)
  const [venda, setVenda] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [filaLocalQtd, setFilaLocalQtd] = useState(0)
  const [avisoSync, setAvisoSync] = useState('')

  // Promoções ativas da unidade
  const [promocoes, setPromocoes] = useState([])

  // Modais de operação
  const [modalGrade, setModalGrade] = useState(null)
  const [modalPesagem, setModalPesagem] = useState(null)
  const [pesoInput, setPesoInput] = useState('0.500')
  const [lendoBalanca, setLendoBalanca] = useState(false)
  const [modalCaixa, setModalCaixa] = useState(null) // { tipo: 'sangria' | 'suprimento' }
  const [valorCaixa, setValorCaixa] = useState('')
  const [motivoCaixa, setMotivoCaixa] = useState('')
  const [modalFechamentoCego, setModalFechamentoCego] = useState(false)
  const [valoresCego, setValoresCego] = useState({ dinheiro: '', moedas: '', debito: '', credito: '', pix: '', outros: '' })
  const [reducaoZ, setReducaoZ] = useState(null)
  const [modalCamera, setModalCamera] = useState(false)
  const [mostrarTecladoTouch, setMostrarTecladoTouch] = useState(false)
  const [atalhosSupermercado, setAtalhosSupermercado] = useState([])
  // Vendas & Comandas anteriores / Reabertura e Cancelamento
  const [modalVendas, setModalVendas] = useState(false)
  const [vendasHistorico, setVendasHistorico] = useState([])
  const [carregandoVendas, setCarregandoVendas] = useState(false)
  const [vendaReabertaInfo, setVendaReabertaInfo] = useState(null)
  const [modalSenhaGerente, setModalSenhaGerente] = useState(null) // { acao: 'reabrir' | 'cancelar', venda }
  const [senhaGerenteInput, setSenhaGerenteInput] = useState('')
  const [erroGerente, setErroGerente] = useState('')
  const [toastPdv, setToastPdv] = useState('')

  const exibirToast = (msg) => {
    setToastPdv(msg)
    setTimeout(() => setToastPdv(''), 4500)
  }

  // Estoque Multicanal Integrado (Stallone Nutre Sport & E-commerce VIP Club)
  const [modalEstoqueMulticanal, setModalEstoqueMulticanal] = useState(false)
  const [catalogoStallone, setCatalogoStallone] = useState([])
  const [resumoEstoqueMulticanal, setResumoEstoqueMulticanal] = useState(null)
  const [carregandoEstoque, setCarregandoEstoque] = useState(false)
  const [sincronizandoEstoque, setSincronizandoEstoque] = useState(false)
  const [modalAjusteItem, setModalAjusteItem] = useState(null) // { item, novoEstoqueFisico, motivo }
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  const abrirModalVendas = async () => {
    setModalVendas(true)
    setCarregandoVendas(true)
    try {
      const res = await api.get('/api/pdv/vendas?limit=30').catch(async () => {
        return await api.get('/api/admin/varejo/vendas?limit=30')
      })
      setVendasHistorico(res?.vendas || [])
    } catch (err) {
      console.warn('Erro ao carregar vendas:', err.message)
    } finally {
      setCarregandoVendas(false)
    }
  }

  const confirmarReaberturaVenda = (venda) => {
    setModalSenhaGerente({ acao: 'reabrir', venda })
    setSenhaGerenteInput('')
    setErroGerente('')
  }

  const confirmarCancelamentoVenda = (venda) => {
    setModalSenhaGerente({ acao: 'cancelar', venda })
    setSenhaGerenteInput('')
    setErroGerente('')
  }

  const executarAcaoGerente = async () => {
    if (!modalSenhaGerente) return
    const { acao, venda } = modalSenhaGerente
    try {
      if (acao === 'reabrir') {
        const res = await api.post(`/api/pdv/vendas/${venda.id}/reabrir`, { senha: senhaGerenteInput }).catch(async () => {
          return await api.post(`/api/admin/varejo/vendas/${venda.id}/reabrir`, { senha: senhaGerenteInput })
        })
        const dadosVenda = res?.venda || venda
        setItens((dadosVenda.itens || []).map(it => ({
          produto_id: it.produto_id || it.item_id || it.id,
          nome: it.nome,
          preco: Number(it.preco || it.preco_unitario || 0),
          quantidade: Number(it.quantidade || 1),
          unidade: it.unidade || 'UN',
          sku: it.sku || ''
        })))
        setVendaReabertaInfo(dadosVenda)
        setModalSenhaGerente(null)
        setModalVendas(false)
        exibirToast(`🔄 Venda ${venda.numero} reaberta! Altere itens e aperte F10 para refinalizar.`)
        inputRef.current?.focus()
      } else if (acao === 'cancelar') {
        await api.post(`/api/pdv/vendas/${venda.id}/cancelar`, { senha: senhaGerenteInput, motivo: 'Cancelamento autorizado pelo gerente' }).catch(async () => {
          return await api.post(`/api/admin/varejo/vendas/${venda.id}/cancelar`, { senha: senhaGerenteInput, motivo: 'Cancelamento autorizado pelo gerente' })
        })
        setModalSenhaGerente(null)
        exibirToast(`❌ Venda ${venda.numero} cancelada com sucesso!`)
        abrirModalVendas()
      }
    } catch (err) {
      setErroGerente(err?.response?.data?.error || err.message || 'Senha de gerente incorreta')
    }
  }

  const inputRef = useRef(null)
  const buscaTimer = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // ── Sincronização Automática da Fila Offline em Background ─────────────────
  const sincronizarFilaOffline = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const eventos = await listarEventosOffline({ limite: 50 })
      const pendentes = eventos.filter(e => e.status === 'pendente' || e.status === 'falha')
      if (pendentes.length === 0) {
        setFilaLocalQtd(0)
        return
      }
      const res = await api.post('/api/supermercado/sync-offline', { eventos: pendentes }).catch(async () => {
        return await api.post('/api/admin/varejo/sync-offline', { eventos: pendentes })
      })
      if (res?.aceitos?.length) {
        await removerEventosOffline(res.aceitos)
        setFilaLocalQtd(q => Math.max(0, q - res.aceitos.length))
        setAvisoSync(`✅ Fila Offline: ${res.aceitos.length} venda(s) sincronizada(s) com o servidor!`)
        setTimeout(() => setAvisoSync(''), 5000)
      }
    } catch (err) {
      console.warn('Sincronização em background aguardando:', err?.message)
    }
  }, [])

  // Monitorar conectividade de rede e disparar sync automático ao reconectar
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      sincronizarFilaOffline()
    }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Checagem inicial de fila offline
    resumoFilaOffline().then(res => {
      setFilaLocalQtd(res.pendente || 0)
      if (res.pendente > 0 && navigator.onLine) {
        sincronizarFilaOffline()
      }
    }).catch(() => null)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sincronizarFilaOffline])

  // Focar no input ao montar
  useEffect(() => { inputRef.current?.focus() }, [])

  // Carregar catálogo de estoque multicanal da Stallone Nutre Sport
  const carregarEstoqueStallone = useCallback(async () => {
    try {
      setCarregandoEstoque(true)
      const [resCat, resResumo] = await Promise.all([
        api.get('/api/stallone-club/estoque/catalogo').catch(() => null),
        api.get('/api/stallone-club/estoque/resumo').catch(() => null)
      ])
      if (resCat?.produtos) {
        setCatalogoStallone(resCat.produtos)
      }
      if (resResumo) {
        setResumoEstoqueMulticanal(resResumo)
      }
    } catch (err) {
      console.warn('Erro ao carregar estoque multicanal:', err.message)
    } finally {
      setCarregandoEstoque(false)
    }
  }, [])

  useEffect(() => {
    if (segmento === 'stallone') {
      carregarEstoqueStallone()
    }
  }, [segmento, carregarEstoqueStallone])

  // Carregar atalhos rápidos e promoções do supermercado
  useEffect(() => {
    if (segmento === 'supermercado' || segmento === 'varejo') {
      api.get('/api/supermercado/produtos?limit=50').then(res => {
        const prods = res?.produtos || []
        const rapidos = prods.filter(p => p.pesavel || ['Hortifrúti', 'Padaria', 'Açougue e Carnes', 'Bebidas'].includes(p.departamento))
        setAtalhosSupermercado(rapidos.slice(0, 10))
      }).catch(() => null)

      api.get('/api/supermercado/promocoes?ativas=true').then(res => {
        setPromocoes(res?.promocoes || [])
      }).catch(() => {
        api.get('/api/admin/varejo/promocoes').then(r2 => setPromocoes(r2?.promocoes || [])).catch(() => null)
      })
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
      if (modoOperacao === 'totem') return
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
          setDescontoManual(0)
          setTroco('')
          setCpfNota('')
        }
      } else if (e.key === 'F6') {
        e.preventDefault()
        abrirModalVendas()
      } else if (e.key === 'F7') {
        e.preventDefault()
        document.getElementById('pdv-desconto-input')?.focus()
      } else if (e.key === 'F8') {
        e.preventDefault()
        setModalFechamentoCego(true)
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
        setModalFechamentoCego(false)
        setReducaoZ(null)
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

  // Leitura Direta de Balança Comercial via Web Serial API (Toledo / Filizola / Urano)
  async function lerBalancaSerial() {
    if (!('serial' in navigator)) {
      alert('Seu navegador não suporta a Web Serial API. Para conectar balanças diretamente via USB/Serial, utilize o Google Chrome, Edge ou Opera em um computador.')
      return
    }
    setLendoBalanca(true)
    try {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      const reader = port.readable.getReader()
      const { value } = await reader.read()
      reader.releaseLock()
      await port.close()
      if (value) {
        const text = new TextDecoder().decode(value)
        const match = text.match(/(\d+[.,]\d+)/)
        if (match) {
          setPesoInput(match[1].replace(',', '.'))
          tocarBeep()
        }
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        alert('Aviso da balança: ' + (err.message || 'Não foi possível ler dados seriais.'))
      }
    } finally {
      setLendoBalanca(false)
    }
  }

  // ── Cálculo Automático de Promoções no Carrinho ─────────────────────────────
  function calcularDescontoPromocao(item, qtd) {
    if (!promocoes.length) return null
    const promo = promocoes.find(p => {
      if (p.status !== 'ativa' && p.status !== 'ativo') return false
      const itensPromo = Array.isArray(p.itens) ? p.itens : (p.produto_ids || [])
      return itensPromo.includes(item.produto_id)
    })
    if (!promo) return null

    // 1. Regra Leve e Pague (Ex: Leve 3 Pague 2)
    if (promo.tipo === 'leve_pague' && promo.quantidade_leve && promo.quantidade_pague) {
      const leve = Number(promo.quantidade_leve)
      const pague = Number(promo.quantidade_pague)
      if (qtd >= leve && leve > pague) {
        const pacotes = Math.floor(qtd / leve)
        const itensGratis = pacotes * (leve - pague)
        const desconto = itensGratis * item.preco
        return {
          tipo: 'leve_pague',
          nome: promo.nome || `Leve ${leve} Pague ${pague}`,
          desconto,
        }
      }
    }
    // 2. Regra Percentual (%)
    else if (promo.tipo === 'percentual' && promo.percentual_desconto) {
      const perc = Number(promo.percentual_desconto)
      const desconto = (item.preco * qtd) * (perc / 100)
      return {
        tipo: 'percentual',
        nome: promo.nome || `${perc}% OFF`,
        desconto,
      }
    }
    // 3. Preço Fixo Promocional
    else if (promo.tipo === 'preco_fixo' && promo.preco_fixo) {
      const fixo = Number(promo.preco_fixo)
      if (item.preco > fixo) {
        const desconto = (item.preco - fixo) * qtd
        return {
          tipo: 'preco_fixo',
          nome: promo.nome || `Oferta R$ ${fixo.toFixed(2)}`,
          desconto,
        }
      }
    }
    return null
  }

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
      } else if (segmento === 'stallone') {
        const res = await api.get(`/api/stallone-club/estoque/catalogo?busca=${encodeURIComponent(termo)}`).catch(() => null)
        const prods = (res?.produtos || []).map(p => ({
          ...p,
          precoFinal: p.preco,
          precoBase: p.preco,
          unidade: 'UN',
          pesavel: false
        }))
        if (prods.length === 1 && (/^\d+$/.test(termo) || termo.length >= 6 || termo.toUpperCase().startsWith('STL-'))) {
          const p = prods[0]
          if (p.estoque_disponivel_balcao <= 0) {
            exibirToast(`⚠️ Atenção: ${p.nome} sem saldo livre no balcão (${p.estoque_online_reservado} un reservadas online).`)
          }
          adicionarItem(p, quantidadeMultiplicada)
          setBusca('')
          setResultados([])
          inputRef.current?.focus()
          return
        }
        setResultados(prods)
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

    if (produto.estoque_disponivel_balcao !== undefined) {
      const itemExistente = itens.find(i => i.chave === chave || i.produto_id === produto.id)
      const qtdAtual = itemExistente ? itemExistente.quantidade : 0
      const qtdNova = qtdAtual + (parseFloat(quantidade) || 1)
      if (qtdNova > produto.estoque_disponivel_balcao) {
        exibirToast(`⚠️ Alerta Multicanal: ${produto.nome} possui apenas ${produto.estoque_disponivel_balcao} un livres no balcão (${produto.estoque_online_reservado || 0} un reservadas para Loja Online).`)
      }
    }

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

  // Cálculos com Promoções Automáticas
  const subtotalBruto = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descontoPromocoes = itens.reduce((soma, item) => {
    const promo = calcularDescontoPromocao(item, item.quantidade)
    return soma + (promo?.desconto || 0)
  }, 0)
  const subtotalComPromos = Math.max(0, subtotalBruto - descontoPromocoes)

  const valorDescontoManual = tipoDesconto === 'percentual'
    ? subtotalComPromos * (parseFloat(descontoManual) / 100)
    : parseFloat(descontoManual) || 0

  const total = Math.max(0, subtotalComPromos - valorDescontoManual)
  const totalDescontos = descontoPromocoes + valorDescontoManual
  const trocoCalc = formaPgto === 'dinheiro' && parseFloat(troco) > total
    ? parseFloat(troco) - total : 0

  async function finalizarVenda() {
    if (!itens.length) return
    setFinalizando(true)
    const payload = {
      segmento,
      cpf_cliente: cpfNota.trim() || null,
      usuario_vendedor_id: 'operador-kytto',
      itens: itens.map(i => {
        const promo = calcularDescontoPromocao(i, i.quantidade)
        return {
          produto_id: i.produto_id,
          nome: i.nome,
          variante_id: i.variante_id,
          quantidade: i.quantidade,
          valor_unitario: i.preco,
          preco_unitario: i.preco,
          desconto_promocao: promo?.desconto || 0,
          regra_promocao: promo?.nome || null,
        }
      }),
      pagamentos: [{
        tipo: formaPgto === 'dinheiro' ? 'dinheiro' : formaPgto,
        valor: total,
        referencia_externa: formaPgto.startsWith('cartao') ? 'TEF-LOCAL' : null
      }],
      forma_pagamento: formaPgto,
      desconto: totalDescontos,
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
        await enfileirarVendaOffline(payload)
        setFilaLocalQtd(q => q + 1)
      }

      setVenda(res?.venda || {
        id: `v-${Date.now()}`,
        numero: `VND-${Date.now().toString(36).toUpperCase()}`,
        total,
        desconto: totalDescontos,
        troco: trocoCalc,
        cpf_cliente: cpfNota.trim() || null,
        forma_pagamento: formaPgto,
        itens: [...payload.itens],
        offline: !isOnline,
        data: new Date().toISOString()
      })

      setItens([])
      setDescontoManual(0)
      setTroco('')
      setCpfNota('')

      if (segmento === 'stallone') {
        for (const it of payload.itens) {
          api.post('/api/stallone-club/estoque/baixar-pdv', {
            itemId: it.produto_id,
            quantidade: it.quantidade,
            vendaId: res?.venda?.id || `VND-${Date.now()}`
          }).catch(() => null)
        }
        carregarEstoqueStallone()
      }
    } catch (err) {
      try {
        await enfileirarVendaOffline(payload)
        setFilaLocalQtd(q => q + 1)
        setVenda({
          id: `v-${Date.now()}`,
          numero: `OFF-${Date.now().toString(36).toUpperCase()}`,
          total,
          desconto: totalDescontos,
          troco: trocoCalc,
          cpf_cliente: cpfNota.trim() || null,
          forma_pagamento: formaPgto,
          itens: [...payload.itens],
          offline: true,
          data: new Date().toISOString()
        })
        setItens([])
        setDescontoManual(0)
        setTroco('')
        setCpfNota('')
      } catch (e2) {
        alert(err.message || 'Erro ao finalizar venda')
      }
    } finally {
      setFinalizando(false)
    }
  }

  // ── Emissão Direta de NFC-e Fiscal ──────────────────────────────────────────
  async function emitirNfce() {
    if (!venda) return
    setEmitindoNfce(true)
    try {
      const res = await api.post('/api/supermercado/emitir-nfce', {
        vendaId: venda.id,
        cpf_cliente: venda.cpf_cliente,
        total: venda.total,
        itens: venda.itens,
        forma_pagamento: venda.forma_pagamento
      }).catch(async () => {
        return await api.post('/api/admin/varejo/emitir-nfce', {
          vendaId: venda.id,
          cpf_cliente: venda.cpf_cliente,
          total: venda.total,
          itens: venda.itens,
          forma_pagamento: venda.forma_pagamento
        })
      })

      if (res?.nfce) {
        setVenda(v => ({ ...v, nfce: res.nfce }))
        tocarBeep()
      } else {
        alert('A NFC-e foi processada em contingência.')
      }
    } catch (err) {
      alert('Aviso NFC-e: ' + (err.message || 'Erro ao conectar à SEFAZ. O documento foi registrado em contingência.'))
    } finally {
      setEmitindoNfce(false)
    }
  }

  // ── Fechamento Cego de Caixa ───────────────────────────────────────────────
  async function executarFechamentoCego() {
    try {
      const res = await api.post('/api/supermercado/caixa/fechamento-cego', {
        valores: valoresCego,
        operador: 'Operador de Caixa'
      }).catch(async () => {
        return await api.post('/api/admin/varejo/caixa/fechamento-cego', {
          valores: valoresCego,
          operador: 'Operador de Caixa'
        })
      })

      if (res?.reducaoZ) {
        setReducaoZ(res.reducaoZ)
        setModalFechamentoCego(false)
      } else {
        alert('Fechamento de caixa concluído com sucesso!')
        setModalFechamentoCego(false)
      }
    } catch (err) {
      alert('Erro no fechamento: ' + err.message)
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

  async function executarSincronizacaoEstoque() {
    setSincronizandoEstoque(true)
    try {
      const res = await api.post('/api/stallone-club/estoque/sincronizar')
      if (res?.resumo) {
        setResumoEstoqueMulticanal(res.resumo)
      }
      await carregarEstoqueStallone()
      exibirToast('✅ Estoque físico e Loja Online (Stallone VIP Club) sincronizados com sucesso!')
    } catch (err) {
      exibirToast('❌ Erro na sincronização: ' + (err.message || 'Falha de rede'))
    } finally {
      setSincronizandoEstoque(false)
    }
  }

  async function salvarAjusteEstoque() {
    if (!modalAjusteItem) return
    setSalvandoAjuste(true)
    try {
      const { item, novoEstoqueFisico, motivo } = modalAjusteItem
      const res = await api.post('/api/stallone-club/estoque/ajustar', {
        itemId: item.id || item.sku,
        novoEstoqueFisico: Number(novoEstoqueFisico),
        motivo: motivo || 'Ajuste manual via Frente de Caixa PDV'
      })
      if (res?.sucesso) {
        exibirToast(`✅ Estoque de ${item.nome} atualizado para ${novoEstoqueFisico} un!`)
        setModalAjusteItem(null)
        await carregarEstoqueStallone()
      } else {
        alert(res?.erro || 'Erro ao ajustar estoque.')
      }
    } catch (err) {
      alert('Erro ao salvar ajuste: ' + (err.message || 'Falha de conexão'))
    } finally {
      setSalvandoAjuste(false)
    }
  }

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

      {/* Alerta de Sincronização em Background */}
      {avisoSync && (
        <div style={{ background: theme.green, color: '#fff', padding: '6px 14px', fontSize: 12, fontWeight: 800, textAlign: 'center', transition: 'all .3s' }}>
          {avisoSync}
        </div>
      )}

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
          {/* Badge Conexão e Auto-sync */}
          <button
            onClick={sincronizarFilaOffline}
            title={filaLocalQtd > 0 ? 'Clique para forçar sincronização offline' : 'Conexão sincronizada'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
              background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: isOnline ? theme.green : theme.red, fontWeight: 700, border: `1px solid ${isOnline ? theme.green : theme.red}`,
              cursor: 'pointer'
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? theme.green : theme.red }} />
            {isOnline ? 'Online' : 'Modo Offline'}
            {filaLocalQtd > 0 && ` (${filaLocalQtd} na fila)`}
          </button>

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

          {/* Vendas & Comandas (F6) */}
          <button
            onClick={abrirModalVendas}
            style={{ background: theme.card, color: '#38bdf8', border: `1px solid ${theme.line}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            title="Histórico de vendas e comandas, reabertura e cancelamento com gerente"
          >
            📋 Vendas & Comandas (F6)
          </button>

          {/* Estoque Multicanal Integrado (Física + Loja Online) */}
          <button
            onClick={() => { setModalEstoqueMulticanal(true); carregarEstoqueStallone(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: segmento === 'stallone' ? 'linear-gradient(135deg, #e11d48, #9f1239)' : theme.card,
              color: '#fff', border: `1px solid ${segmento === 'stallone' ? '#f43f5e' : theme.line}`,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              boxShadow: segmento === 'stallone' ? '0 0 10px rgba(225, 29, 72, 0.4)' : 'none'
            }}
            title="Gestão de Estoque Multicanal Integrado (Balcão Físico + Loja Online Stallone VIP Club)"
          >
            📦 Estoque Multicanal
          </button>

          {/* Fechamento Cego e Redução Z */}
          {modoOperacao === 'operador' && (
            <button
              onClick={() => setModalFechamentoCego(true)}
              style={{ background: theme.card, color: theme.red, border: `1px solid ${theme.line}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            >
              🔒 Fechamento Cego (F8)
            </button>
          )}

          {/* Sangria e Suprimento */}
          {modoOperacao === 'operador' && (
            <button onClick={() => setModalCaixa({ tipo: 'sangria' })} style={{ background: theme.card, color: theme.yellow, border: `1px solid ${theme.line}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              💰 Sangria / Suprimento (F9)
            </button>
          )}
        </div>
      </div>

      {/* Toast de Notificação */}
      {toastPdv && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: 8, fontWeight: 800, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔔</span> {toastPdv}
        </div>
      )}
      {/* Banner de Edição / Reabertura de Venda */}
      {vendaReabertaInfo && (
        <div style={{ background: '#7c3aed', color: '#fff', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700, borderBottom: '2px solid #a78bfa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <span>MODO DE EDIÇÃO ATIVO: Venda <strong>{vendaReabertaInfo.numero}</strong> — Altere itens, preços e finalize novamente (F10) para atualizar o faturamento!</span>
          </div>
          <button
            onClick={() => { setVendaReabertaInfo(null); setItens([]); }}
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            ✕ Cancelar Edição
          </button>
        </div>
      )}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 540 }}>
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

          {/* Atalhos Rápidos — Stallone Nutre Sport (Estoque Multicanal Integrado) */}
          {segmento === 'stallone' && catalogoStallone.length > 0 && !busca && (
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.line}`, background: 'rgba(225, 29, 72, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🏋️</span> SUPLEMENTOS MESTRES STALLONE · ESTOQUE MULTICANAL INTEGRADO
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: theme.muted }}>
                    Balcão: <strong style={{ color: theme.green }}>{resumoEstoqueMulticanal?.total_estoque_disponivel_balcao ?? 179} un</strong> · E-commerce Reservado: <strong style={{ color: '#38bdf8' }}>{resumoEstoqueMulticanal?.total_estoque_online_reservado ?? 68} un</strong>
                  </span>
                  <button
                    onClick={() => { setModalEstoqueMulticanal(true); carregarEstoqueStallone(); }}
                    style={{ padding: '4px 10px', background: 'rgba(225, 29, 72, 0.15)', border: '1px solid #e11d48', color: '#fda4af', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    📦 Ver Painel Completo
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {catalogoStallone.map(p => {
                  const esgotado = p.estoque_disponivel_balcao <= 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (esgotado) {
                          exibirToast(`⚠️ Atenção: ${p.nome} sem estoque livre no balcão (${p.estoque_online_reservado} un reservadas online).`)
                        }
                        adicionarItem({
                          ...p,
                          precoFinal: p.preco,
                          precoBase: p.preco,
                          unidade: 'UN',
                          pesavel: false
                        }, 1)
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        padding: '10px 12px', borderRadius: 10, border: `1px solid ${p.status_estoque === 'vermelho' ? '#ef4444' : p.status_estoque === 'amarelo' ? '#f59e0b' : theme.line}`,
                        background: theme.card, color: theme.cream, cursor: 'pointer',
                        textAlign: 'left', transition: 'all .15s', position: 'relative', overflow: 'hidden'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#e11d48'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = p.status_estoque === 'vermelho' ? '#ef4444' : p.status_estoque === 'amarelo' ? '#f59e0b' : theme.line}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', marginBottom: 2 }}>{p.categoria}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', color: theme.cream }}>{p.nome}</div>
                      <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>SKU: {p.sku}</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%', marginTop: 6 }}>
                        <div style={{ fontSize: 13, color: theme.green, fontWeight: 900 }}>
                          R$ {Number(p.preco || 0).toFixed(2)}
                        </div>
                        {p.preco_clube && (
                          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                            VIP R$ {Number(p.preco_clube).toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', width: '100%' }}>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: theme.muted }}>
                          Físico: <strong>{p.estoque_fisico}</strong>
                        </span>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }} title="Reservado para pedidos da loja online">
                          Online: <strong>{p.estoque_online_reservado}</strong>
                        </span>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: esgotado ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: esgotado ? theme.red : theme.green, fontWeight: 800 }}>
                          Balcão: <strong>{p.estoque_disponivel_balcao}</strong>
                        </span>
                      </div>

                      {p.previsao_ruptura_dias !== null && p.previsao_ruptura_dias !== undefined && (
                        <div style={{ fontSize: 9, color: p.previsao_ruptura_dias <= 7 ? theme.red : p.previsao_ruptura_dias <= 15 ? theme.yellow : theme.muted, marginTop: 4, fontWeight: 600 }}>
                          ⚡ Ruptura KyttoIA: ~{p.previsao_ruptura_dias}d
                        </div>
                      )}
                    </button>
                  )
                })}
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
                    {p.estoque_disponivel_balcao !== undefined && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: theme.muted }}>Físico: <strong>{p.estoque_fisico}</strong></span>
                        <span style={{ fontSize: 10, color: '#38bdf8' }}>Online Reservado: <strong>{p.estoque_online_reservado}</strong></span>
                        <span style={{ fontSize: 10, color: p.estoque_disponivel_balcao > 0 ? theme.green : theme.red, fontWeight: 700 }}>
                          Balcão Livre: <strong>{p.estoque_disponivel_balcao}</strong>
                        </span>
                      </div>
                    )}
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
                Promoções como <em>Leve & Pague</em> e <em>Ofertas</em> são calculadas automaticamente no carrinho.
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
            ) : itens.map((item, idx) => {
              const promo = calcularDescontoPromocao(item, item.quantidade)
              const totalItemLiquido = (item.preco * item.quantidade) - (promo?.desconto || 0)

              return (
                <div key={item.chave} style={{
                  background: theme.card, border: `1px solid ${promo ? theme.green : theme.line}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, flex: 1, marginRight: 8 }}>
                      <span style={{ color: theme.muted, marginRight: 6 }}>#{idx + 1}</span>
                      {item.nome}
                    </div>
                    <button onClick={() => removerItem(item.chave)} style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>

                  {/* Destaque Promocional Automático */}
                  {promo && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.15)', color: theme.green, padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                      🏷️ {promo.nome}: − R$ {promo.desconto.toFixed(2)}
                    </div>
                  )}

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

                    {/* Preço e Total com Desconto */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: theme.muted, fontSize: 11 }}>
                        R$ {item.preco.toFixed(2)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, minWidth: 70, textAlign: 'right', color: theme.green }}>
                        R$ {totalItemLiquido.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* CPF na Nota e Desconto Manual */}
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
                    value={descontoManual || ''}
                    onChange={e => setDescontoManual(e.target.value)}
                    placeholder="Desc (F7)"
                    style={{ width: 75, padding: '6px 8px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 6, color: theme.cream, fontSize: 12, outline: 'none' }}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            {/* Totais com Promoções e Descontos */}
            {totalDescontos > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: theme.muted }}>Subtotal: R$ {subtotalBruto.toFixed(2)}</span>
                <span style={{ color: theme.green, fontWeight: 700 }}>
                  − Promoções/Descontos: R$ {totalDescontos.toFixed(2)}
                </span>
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

      {/* ── Modal: Pesagem Rápida & Leitura Balança Web Serial ──────────────── */}
      {modalPesagem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 24, width: 380, border: `1px solid ${theme.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>⚖️ Balança — {modalPesagem.nome}</div>
              <button onClick={() => setModalPesagem(null)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: theme.muted }}>
                Preço por KG: <strong style={{ color: theme.green }}>R$ {parseFloat(modalPesagem.precoFinal || modalPesagem.precoBase || 0).toFixed(2)}</strong>
              </div>
              <button
                type="button"
                onClick={lerBalancaSerial}
                disabled={lendoBalanca}
                style={{ padding: '4px 8px', borderRadius: 6, background: theme.blue, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {lendoBalanca ? 'Lendo...' : '🔌 Ler USB/Serial'}
              </button>
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

      {/* ── Modal: Fechamento Cego de Caixa (Conferência de Gaveta) ──────────── */}
      {modalFechamentoCego && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 125 }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 24, width: 420, border: `1px solid ${theme.line}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>🔒 Fechamento Cego de Caixa</div>
              <button onClick={() => setModalFechamentoCego(false)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
              Conte o valor físico presente na gaveta e nos comprovantes de cartão/PIX. O sistema comparará os valores informados com os lançamentos apurados para gerar a Redução Z.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: theme.muted }}>
                💵 Dinheiro (Cédulas R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.dinheiro}
                  onChange={e => setValoresCego({ ...valoresCego, dinheiro: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: theme.muted }}>
                🪙 Moedas (R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.moedas}
                  onChange={e => setValoresCego({ ...valoresCego, moedas: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: theme.muted }}>
                💳 Cartão Débito (R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.debito}
                  onChange={e => setValoresCego({ ...valoresCego, debito: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: theme.muted }}>
                💳 Cartão Crédito (R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.credito}
                  onChange={e => setValoresCego({ ...valoresCego, credito: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: theme.muted }}>
                ⚡ PIX Conferido (R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.pix}
                  onChange={e => setValoresCego({ ...valoresCego, pix: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: theme.muted }}>
                🎁 Outros / Vales (R$):
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valoresCego.outros}
                  onChange={e => setValoresCego({ ...valoresCego, outros: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', marginTop: 4 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalFechamentoCego(false)}
                style={{ flex: 1, padding: '12px', background: theme.surface, color: theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={executarFechamentoCego}
                style={{ flex: 1.5, padding: '12px', background: theme.red, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                Conferir e Fechar Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Redução Z / Relatório de Fechamento de Caixa ─────────────── */}
      {reducaoZ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130 }}>
          <div style={{ background: '#fff', color: '#111', borderRadius: 16, padding: 24, width: 380, maxHeight: '90vh', overflowY: 'auto' }}>
            <div id="reducao-z-print" style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4, borderBottom: '1px dashed #666', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
                RELATÓRIO DE FECHAMENTO — REDUÇÃO Z
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: '#444' }}>
                KYTTO SUPERMERCADO & VAREJO<br />
                {reducaoZ.numero} · {new Date(reducaoZ.dataFechamento).toLocaleDateString('pt-BR')} {new Date(reducaoZ.dataFechamento).toLocaleTimeString('pt-BR')}
              </div>
              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>Operador:</span>
                <strong>{reducaoZ.operador}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
                <span>Situação:</span>
                <strong style={{ color: reducaoZ.resumo.divergenciaGaveta === 0 ? '#059669' : '#dc2626' }}>
                  {reducaoZ.resumo.situacao}
                </strong>
              </div>

              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />
              <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>MOVIMENTAÇÃO DE GAVETA:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>(+) Fundo de Troco Inicial:</span>
                <span>R$ {reducaoZ.resumo.abertura.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>(+) Suprimentos de Caixa:</span>
                <span>R$ {reducaoZ.resumo.suprimentos.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>(−) Sangrias Efetuadas:</span>
                <span>R$ {reducaoZ.resumo.sangrias.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>(+) Vendas em Dinheiro:</span>
                <span>R$ {reducaoZ.resumo.vendasDinheiro.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                <span>(=) Valor Esperado na Gaveta:</span>
                <span>R$ {reducaoZ.resumo.valorEsperadoGaveta.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold' }}>
                <span>Valor Contado pelo Operador:</span>
                <span>R$ {reducaoZ.resumo.dinheiroInformado.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 'bold', color: reducaoZ.resumo.divergenciaGaveta === 0 ? '#059669' : '#dc2626', marginTop: 4 }}>
                <span>Diferença / Quebra:</span>
                <span>R$ {reducaoZ.resumo.divergenciaGaveta.toFixed(2)}</span>
              </div>

              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />
              <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>TOTAIS POR FORMA DE PAGAMENTO:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>💵 Dinheiro:</span>
                <span>R$ {reducaoZ.resumo.vendasDinheiro.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>💳 Cartão de Débito:</span>
                <span>R$ {reducaoZ.resumo.vendasDebito.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>💳 Cartão de Crédito:</span>
                <span>R$ {reducaoZ.resumo.vendasCredito.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>⚡ PIX:</span>
                <span>R$ {reducaoZ.resumo.vendasPix.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                <span>TOTAL VENDAS TURNO:</span>
                <span>R$ {reducaoZ.resumo.totalVendas.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setReducaoZ(null)}
                style={{ flex: 1, padding: '12px', background: theme.surface, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Concluir
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ flex: 1.5, padding: '12px', background: theme.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                🖨️ Imprimir Redução Z
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Venda Realizada com Cupom Térmico (80mm) ou NFC-e SEFAZ ─── */}
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
                {venda.nfce ? 'DANFE NFC-e — NOTA FISCAL DE CONSUMIDOR ELETRÔNICA' : 'DOCUMENTO AUXILIAR DE VENDA (NÃO FISCAL)'}
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
                  {it.regra_promocao && (
                    <div style={{ fontSize: 10, color: '#059669', fontStyle: 'italic' }}>
                      🏷️ Promoção: {it.regra_promocao} (−R$ {parseFloat(it.desconto_promocao || 0).toFixed(2)})
                    </div>
                  )}
                </div>
              ))}

              <div style={{ borderBottom: '1px dashed #666', margin: '8px 0' }} />
              {venda.desconto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Descontos/Promoções:</span>
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

              {/* Informações Oficiais NFC-e SEFAZ */}
              {venda.nfce ? (
                <div style={{ marginTop: 12, borderTop: '1px dashed #666', paddingTop: 8, textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 11 }}>NFC-e Nº {venda.nfce.numero} Série {venda.nfce.serie}</div>
                  <div style={{ fontSize: 9, color: '#333', wordBreak: 'break-all', margin: '4px 0' }}>
                    CHAVE DE ACESSO:<br />
                    {venda.nfce.chaveAcesso.match(/.{1,4}/g)?.join(' ')}
                  </div>
                  <div style={{ fontSize: 9, color: '#333' }}>
                    Protocolo de Autorização: {venda.nfce.protocolo}
                  </div>
                  <div style={{ margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
                    {/* QR Code Oficial SEFAZ */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(venda.nfce.qrCodeUrl)}`}
                      alt="QR Code SEFAZ"
                      style={{ width: 110, height: 110, display: 'block' }}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: '#555' }}>
                    Consulte pela Chave de Acesso em:<br />
                    www.sefaz.mt.gov.br/nfce/consultanfce
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 10, marginTop: 14, color: '#555' }}>
                  Obrigado pela preferência! Volte sempre!
                </div>
              )}
            </div>

            {/* Ações de Impressão e Emissão NFC-e */}
            <div style={{ display: 'grid', gridTemplateColumns: venda.nfce ? '1fr 1.5fr' : '1fr 1fr 1.5fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setVenda(null)}
                style={{ padding: '12px 6px', background: theme.surface, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}
              >
                Nova Venda
              </button>

              {!venda.nfce && (
                <button
                  type="button"
                  onClick={emitirNfce}
                  disabled={emitindoNfce}
                  style={{ padding: '12px 6px', background: theme.blue, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}
                >
                  {emitindoNfce ? 'Emitindo...' : '⚡ NFC-e Fiscal'}
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                style={{ padding: '12px 6px', background: theme.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL HISTÓRICO DE VENDAS & COMANDAS (F6) */}
      {modalVendas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, width: '100%', maxWidth: 840, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: theme.cream }}>📋 Vendas & Comandas Faturadas</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.muted }}>Histórico de vendas, reabertura, correção de itens e cancelamento com autorização de gerência</p>
              </div>
              <button onClick={() => setModalVendas(false)} style={{ background: 'transparent', border: 'none', color: theme.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {carregandoVendas ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.muted }}>Carregando vendas...</div>
              ) : vendasHistorico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.muted }}>Nenhuma venda registrada até o momento nesta empresa.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {vendasHistorico.map((v) => (
                    <div key={v.id} style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 14, color: theme.cream }}>{v.numero}</strong>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: v.status === 'cancelada' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: v.status === 'cancelada' ? theme.red : theme.green, fontWeight: 700 }}>
                            {v.status === 'cancelada' ? 'Cancelada' : 'Finalizada'}
                          </span>
                          <span style={{ fontSize: 11, color: theme.muted }}>
                            {v.data ? new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                          {v.itens?.length || 0} item(ns) · {v.formaPagamento || 'dinheiro'} {v.nfceChave ? '· NFC-e Emitida' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: theme.green }}>R$ {(v.total || 0).toFixed(2)}</div>
                          {v.desconto > 0 && <div style={{ fontSize: 11, color: theme.muted }}>Desc: R$ {(v.desconto || 0).toFixed(2)}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {v.status !== 'cancelada' && (
                            <>
                              <button
                                onClick={() => confirmarReaberturaVenda(v)}
                                style={{ background: 'rgba(124, 58, 237, 0.2)', border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                title="Reabrir no carrinho do PDV para adicionar, remover ou corrigir itens"
                              >
                                🔄 Reabrir / Corrigir
                              </button>
                              <button
                                onClick={() => confirmarCancelamentoVenda(v)}
                                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                title="Cancelar venda e estornar estoque com senha de gerente"
                              >
                                ❌ Cancelar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setVenda(v); setModalVendas(false); }}
                            style={{ background: theme.surface, border: `1px solid ${theme.line}`, color: theme.cream, borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            🖨️ Cupom
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalVendas(false)} style={{ background: theme.surface, border: `1px solid ${theme.line}`, color: theme.cream, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTORIZAÇÃO DE GERENTE (JHENYFFER / ADMIN) */}
      {modalSenhaGerente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, width: '100%', maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>🛡️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: theme.cream }}>Autorização de Gerência</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.muted }}>
                  {modalSenhaGerente.acao === 'reabrir' ? 'Reabertura e correção de venda' : 'Cancelamento de cupom e estorno'}
                </p>
              </div>
            </div>
            <div style={{ background: theme.card, borderRadius: 8, padding: 12, marginBottom: 16, border: `1px solid ${theme.line}` }}>
              <div style={{ fontSize: 12, color: theme.muted }}>Venda Selecionada:</div>
              <strong style={{ fontSize: 15, color: theme.cream }}>{modalSenhaGerente.venda?.numero}</strong>
              <div style={{ fontSize: 13, color: theme.green, marginTop: 2 }}>Valor: R$ {(modalSenhaGerente.venda?.total || 0).toFixed(2)}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: theme.muted, marginBottom: 6 }}>
                Digite a Senha da Gerente (Jhenyffer Andrade ou Admin):
              </label>
              <input
                type="password"
                value={senhaGerenteInput}
                onChange={(e) => setSenhaGerenteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executarAcaoGerente()}
                autoFocus
                placeholder="Senha de gerente..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.line}`, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
              />
              {erroGerente && (
                <div style={{ color: theme.red, fontSize: 12, marginTop: 6, fontWeight: 700 }}>⚠️ {erroGerente}</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalSenhaGerente(null)}
                style={{ padding: '10px', background: 'transparent', border: `1px solid ${theme.line}`, color: theme.muted, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarAcaoGerente}
                style={{ padding: '10px', background: modalSenhaGerente.acao === 'reabrir' ? '#7c3aed' : theme.red, border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}
              >
                {modalSenhaGerente.acao === 'reabrir' ? '🔄 Autorizar e Reabrir' : '❌ Autorizar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTÃO DE ESTOQUE MULTICANAL INTEGRADO (STALLONE NUTRE SPORT) */}
      {modalEstoqueMulticanal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, width: '100%', maxWidth: 960, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
            
            {/* Header do Modal */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, rgba(225,29,72,0.1), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: theme.cream, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Estoque Multicanal Integrado — Stallone Nutre Sport
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(225,29,72,0.2)', color: '#fda4af', border: '1px solid #e11d48', fontWeight: 700 }}>
                      Física ⇄ Loja Online VIP
                    </span>
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: theme.muted }}>
                    Sincronização atômica em tempo real entre a Frente de Caixa (Balcão) e a Loja Online (Stallone VIP Club)
                  </p>
                </div>
              </div>
              <button onClick={() => setModalEstoqueMulticanal(false)} style={{ background: 'transparent', border: 'none', color: theme.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Faixa KyttoIA */}
            <div style={{ background: 'linear-gradient(90deg, #1e1b4b, #31104b)', padding: '8px 20px', borderBottom: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c4b5fd' }}>
                <span>⚡</span>
                <span><strong>Motor KyttoIA 2.5 Flash:</strong> Predição preditiva de ruptura de estoque e blindagem contra vendas concorrentes online/física.</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={carregarEstoqueStallone}
                  disabled={carregandoEstoque}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {carregandoEstoque ? 'Atualizando...' : '🔄 Atualizar'}
                </button>
                <button
                  onClick={executarSincronizacaoEstoque}
                  disabled={sincronizandoEstoque}
                  style={{ background: '#e11d48', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                >
                  {sincronizandoEstoque ? 'Sincronizando...' : '⚡ Forçar Sincronização E-commerce'}
                </button>
              </div>
            </div>

            {/* 4 Cards de Métricas */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: theme.muted, textTransform: 'uppercase', fontWeight: 700 }}>🏢 Estoque Físico Total</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: theme.cream, marginTop: 4 }}>
                  {resumoEstoqueMulticanal?.total_estoque_fisico ?? 247} <span style={{ fontSize: 13, color: theme.muted, fontWeight: 500 }}>un</span>
                </div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Armazém central + loja física</div>
              </div>
              <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>🌐 Reservado Loja Online</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                  {resumoEstoqueMulticanal?.total_estoque_online_reservado ?? 68} <span style={{ fontSize: 13, color: theme.muted, fontWeight: 500 }}>un</span>
                </div>
                <div style={{ fontSize: 11, color: '#7dd3fc', marginTop: 2 }}>Pedidos em separação / envio</div>
              </div>
              <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: theme.green, textTransform: 'uppercase', fontWeight: 700 }}>🟢 Disponível Balcão PDV</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: theme.green, marginTop: 4 }}>
                  {resumoEstoqueMulticanal?.total_estoque_disponivel_balcao ?? 179} <span style={{ fontSize: 13, color: theme.muted, fontWeight: 500 }}>un</span>
                </div>
                <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>Livre para faturamento presencial</div>
              </div>
              <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', fontWeight: 700 }}>⚠️ Alertas Ruptura KyttoIA</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {resumoEstoqueMulticanal?.produtos_em_alerta_ruptura ?? 2} <span style={{ fontSize: 13, color: theme.muted, fontWeight: 500 }}>produtos</span>
                </div>
                <div style={{ fontSize: 11, color: '#fde68a', marginTop: 2 }}>Risco de esgotamento &lt; 10 dias</div>
              </div>
            </div>

            {/* Tabela de Produtos */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {catalogoStallone.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.muted }}>
                  {carregandoEstoque ? 'Carregando catálogo de estoque...' : 'Nenhum produto cadastrado no catálogo Stallone.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {catalogoStallone.map((p) => {
                    const esgotado = p.estoque_disponivel_balcao <= 0
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: theme.card,
                          border: `1px solid ${p.status_estoque === 'vermelho' ? 'rgba(239,68,68,0.4)' : p.status_estoque === 'amarelo' ? 'rgba(245,158,11,0.4)' : theme.line}`,
                          borderRadius: 10,
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <div style={{ flex: 1.5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(225,29,72,0.15)', color: '#fda4af' }}>
                              {p.sku}
                            </span>
                            <strong style={{ fontSize: 14, color: theme.cream }}>{p.nome}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                            Categoria: {p.categoria} · EAN: {p.ean || '7898950001018'} · NCM: {p.ncm || '2106.90.30'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: 110 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: theme.green }}>R$ {Number(p.preco || 0).toFixed(2)}</div>
                          {p.preco_clube && (
                            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>VIP R$ {Number(p.preco_clube).toFixed(2)}</div>
                          )}
                        </div>

                        {/* Pilha de Estoque Multicanal */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ textAlign: 'center', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', minWidth: 64 }}>
                            <div style={{ fontSize: 9, color: theme.muted, textTransform: 'uppercase' }}>Físico</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: theme.cream }}>{p.estoque_fisico}</div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '6px 10px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.1)', minWidth: 64 }}>
                            <div style={{ fontSize: 9, color: '#38bdf8', textTransform: 'uppercase' }}>Online</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>{p.estoque_online_reservado}</div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '6px 10px', borderRadius: 6, background: esgotado ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', minWidth: 64 }}>
                            <div style={{ fontSize: 9, color: esgotado ? theme.red : theme.green, textTransform: 'uppercase', fontWeight: 700 }}>Balcão</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: esgotado ? theme.red : theme.green }}>{p.estoque_disponivel_balcao}</div>
                          </div>
                        </div>

                        {/* Previsão de Ruptura KyttoIA */}
                        <div style={{ minWidth: 120, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: theme.muted }}>Previsão Ruptura</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: p.previsao_ruptura_dias <= 7 ? theme.red : p.previsao_ruptura_dias <= 15 ? theme.yellow : theme.green }}>
                            {p.previsao_ruptura_dias !== null ? `~${p.previsao_ruptura_dias} dias` : 'Estável'}
                          </div>
                        </div>

                        {/* Ações */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              adicionarItem({
                                ...p,
                                precoFinal: p.preco,
                                precoBase: p.preco,
                                unidade: 'UN',
                                pesavel: false
                              }, 1)
                              exibirToast(`🛒 ${p.nome} adicionado à Frente de Caixa!`)
                            }}
                            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#6ee7b7', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            title="Adicionar 1 unidade ao cupom do PDV"
                          >
                            +1 no PDV
                          </button>
                          <button
                            onClick={() => setModalAjusteItem({ item: p, novoEstoqueFisico: p.estoque_fisico, motivo: 'Ajuste manual via Frente de Caixa' })}
                            style={{ background: theme.surface, border: `1px solid ${theme.line}`, color: theme.cream, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            title="Ajustar saldo de estoque físico / inventário"
                          >
                            ⚙️ Ajustar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: theme.muted }}>
                🔄 Sincronização por evento interno ativa: Vendas no PDV e pedidos no Stallone VIP Club atualizam os saldos em tempo real.
              </div>
              <button onClick={() => setModalEstoqueMulticanal(false)} style={{ background: theme.surface, border: `1px solid ${theme.line}`, color: theme.cream, borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE MANUAL DE ESTOQUE FÍSICO */}
      {modalAjusteItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 26 }}>⚙️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: theme.cream }}>Ajuste de Estoque Físico</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.muted }}>{modalAjusteItem.item?.nome}</p>
              </div>
            </div>

            <div style={{ background: theme.card, borderRadius: 8, padding: 12, marginBottom: 16, border: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: theme.muted }}>Físico Atual</div>
                <strong style={{ fontSize: 15, color: theme.cream }}>{modalAjusteItem.item?.estoque_fisico} un</strong>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#38bdf8' }}>Online Reservado</div>
                <strong style={{ fontSize: 15, color: '#38bdf8' }}>{modalAjusteItem.item?.estoque_online_reservado} un</strong>
              </div>
              <div>
                <div style={{ fontSize: 10, color: theme.green }}>Balcão Atual</div>
                <strong style={{ fontSize: 15, color: theme.green }}>{modalAjusteItem.item?.estoque_disponivel_balcao} un</strong>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: theme.muted, marginBottom: 6 }}>
                Novo Saldo Físico Total (unidades):
              </label>
              <input
                type="number"
                value={modalAjusteItem.novoEstoqueFisico}
                onChange={(e) => setModalAjusteItem({ ...modalAjusteItem, novoEstoqueFisico: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.line}`, color: '#fff', fontSize: 16, fontWeight: 800, boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                Novo saldo livre no balcão será: <strong>{Math.max(0, (Number(modalAjusteItem.novoEstoqueFisico) || 0) - (modalAjusteItem.item?.estoque_online_reservado || 0))} un</strong>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: theme.muted, marginBottom: 6 }}>
                Motivo do Ajuste / Entrada / Inventário:
              </label>
              <input
                type="text"
                value={modalAjusteItem.motivo}
                onChange={(e) => setModalAjusteItem({ ...modalAjusteItem, motivo: e.target.value })}
                placeholder="Ex: Recebimento NF Fornecedor, Conferência de Inventário..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.line}`, color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalAjusteItem(null)}
                style={{ padding: '10px', background: 'transparent', border: `1px solid ${theme.line}`, color: theme.muted, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarAjusteEstoque}
                disabled={salvandoAjuste}
                style={{ padding: '10px', background: '#e11d48', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}
              >
                {salvandoAjuste ? 'Gravando...' : '💾 Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
