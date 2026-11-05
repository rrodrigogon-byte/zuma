import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Barcode,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  Percent,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Scale,
  Search,
  ShoppingCart,
  Sliders,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  UploadCloud,
  XCircle
} from 'lucide-react'
import { api, fmtDate, fmtDateOnly, fmtQtd, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'
import './Supermercado.css'

const DEPARTAMENTOS_PADRAO = [
  'Açougue e Carnes',
  'Hortifrúti',
  'Mercearia',
  'Bebidas',
  'Frios e Laticínios',
  'Padaria e Confeitaria',
  'Limpeza',
  'Higiene e Perfumaria',
  'Congelados',
  'Bazar e Utilidades'
]

const TABS = [
  { id: 'dashboard', label: 'Dashboard & KPIs', icone: Layers },
  { id: 'produtos', label: 'Produtos & Mix', icone: ShoppingCart },
  { id: 'pdv', label: 'Frente de Caixa (PDV)', icone: DollarSign },
  { id: 'lotes', label: 'Lotes & Validade (FEFO)', icone: Clock },
  { id: 'promocoes', label: 'Promoções & Ofertas', icone: Tag },
  { id: 'etiquetas', label: 'Etiquetas & Balança', icone: Printer },
  { id: 'transferencias', label: 'Transferências', icone: ArrowLeftRight },
  { id: 'fornecedores', label: 'Fornecedores & Compras', icone: Truck },
  { id: 'margem', label: 'Margens & Curva ABC', icone: TrendingUp },
]

export default function Supermercado() {
  const toast = useToast()

  // ── Contexto Multiempresa & Multiloja ──
  const [empresas, setEmpresas] = useState([])
  const [empresaAtivaId, setEmpresaAtivaId] = useState('')
  const [lojas, setLojas] = useState([])
  const [lojaAtivaId, setLojaAtivaId] = useState('')
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)

  // ── Navegação ──
  const [tab, setTab] = useState('dashboard')

  // ── Estados de Dados ──
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [promocoes, setPromocoes] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [fornecedoresData, setFornecedoresData] = useState({ fornecedores: [], sugestoesCompra: [] })
  const [margemData, setMargemData] = useState({ resumo: {}, itens: [] })
  const [vendasHistorico, setVendasHistorico] = useState([])
  const [balancaConfig, setBalancaConfig] = useState({ prefixo: '2', digitosPlu: 4, tipoValor: 'preco' })

  // ── Filtros ──
  const [busca, setBusca] = useState('')
  const [deptoFiltro, setDeptoFiltro] = useState('')
  const [apenasPesaveis, setApenasPesaveis] = useState(false)
  const [apenasRuptura, setApenasRuptura] = useState(false)
  const [filtroLoteStatus, setFiltroLoteStatus] = useState('todos')

  // ── Modais ──
  const [modalNovoProd, setModalNovoProd] = useState(false)
  const [modalEditarProd, setModalEditarProd] = useState(null)
  const [modalPrecoLoja, setModalPrecoLoja] = useState(null)
  const [modalNovoLote, setModalNovoLote] = useState(false)
  const [modalBaixaLote, setModalBaixaLote] = useState(null)
  const [modalNovaPromo, setModalNovaPromo] = useState(false)
  const [modalNovaTransf, setModalNovaTransf] = useState(false)
  const [modalNovoForn, setModalNovoForn] = useState(false)
  const [modalConsulta, setModalConsulta] = useState(false)
  const [modalNfce, setModalNfce] = useState(null)

  // ── Formulários ──
  const [formProd, setFormProd] = useState({
    nome: '',
    sku: '',
    ean: '',
    plu: '',
    departamento: 'Mercearia',
    categoria: '',
    unidade: 'UN',
    precoCusto: '',
    precoVenda: '',
    saldoInicial: '',
    estoqueMinimo: '10',
    pesavel: false,
    controlaLote: false
  })

  const [formPrecoLoja, setFormPrecoLoja] = useState({ precoUnidade: '' })
  const [formLote, setFormLote] = useState({ itemId: '', lote: '', validade: '', quantidade: '' })
  const [formBaixa, setFormBaixa] = useState({ quantidade: '', motivo: 'Vencimento' })
  const [formPromo, setFormPromo] = useState({
    nome: '',
    tipo: 'percentual',
    percentual: '15',
    valorDesconto: '',
    precoFixo: '',
    leve: '',
    pague: '',
    inicio: new Date().toISOString().slice(0, 16),
    fim: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 16),
    itens: []
  })
  const [formTransf, setFormTransf] = useState({ destinoLojaId: '', observacao: '', itens: [] })
  const [formForn, setFormForn] = useState({ nome: '', cnpj: '', email: '', telefone: '', condicaoPagamento: '30 dias' })
  const [consultaCodigoInput, setConsultaCodigoInput] = useState('')
  const [consultaResultado, setConsultaResultado] = useState(null)

  // ── Frente de Caixa (PDV) ──
  const [carrinho, setCarrinho] = useState([])
  const [leitorInput, setLeitorInput] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [valorRecebido, setValorRecebido] = useState('')
  const [descontoPdv, setDescontoPdv] = useState('0')
  const [finalizandoVenda, setFinalizandoVenda] = useState(false)

  // ── Etiquetas ──
  const [formatoEtiqueta, setFormatoEtiqueta] = useState('gondola_100x40')
  const [itensEtiquetas, setItensEtiquetas] = useState([])

  // ── Simulador de Margem ──
  const [simDepto, setSimDepto] = useState('Todos')
  const [simPct, setSimPct] = useState(5)

  // ── Carregar Empresas da Plataforma ──
  useEffect(() => {
    async function carregarEmpresas() {
      try {
        setCarregandoEmpresas(true)
        const res = await api.get('/api/admin/a2/empresas-plataforma')
        const lista = res?.empresas || []
        setEmpresas(lista)

        const atual = res?.empresaAtualId || lista[0]?.id || ''
        setEmpresaAtivaId(atual)

        if (atual) {
          carregarLojas(atual)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
        // Fallback Barbearia Dino
        const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
        setEmpresas([{ id: dinoId, nome: 'Barbearia Dino' }])
        setEmpresaAtivaId(dinoId)
        carregarLojas(dinoId)
      } finally {
        setCarregandoEmpresas(false)
      }
    }
    carregarEmpresas()
  }, [])

  async function carregarLojas(empId) {
    try {
      const res = await api.get(`/api/lojas?empresaId=${empId}`, {
        headers: { 'x-empresa-id': empId }
      }).catch(() => null)
      const lista = res?.lojas || (Array.isArray(res) ? res : [])
      setLojas(lista)
      if (lista.length > 0 && !lojaAtivaId) {
        setLojaAtivaId(lista[0].id)
      }
    } catch {
      setLojas([])
    }
  }

  // ── Headers com contexto da empresa e loja selecionadas ──
  const reqHeaders = useMemo(() => {
    const h = {}
    if (empresaAtivaId) h['x-empresa-id'] = empresaAtivaId
    if (lojaAtivaId) h['x-loja-id'] = lojaAtivaId
    return h
  }, [empresaAtivaId, lojaAtivaId])

  // ── Carregar Dados Principais ──
  const carregarTudo = useCallback(async () => {
    if (!empresaAtivaId) return
    setLoading(true)
    try {
      const [dashRes, prodRes, lotesRes, promoRes, transfRes, fornRes, margRes, vendRes, balRes] = await Promise.all([
        api.get('/api/supermercado/resumo-dashboard', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/produtos', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/lotes', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/promocoes', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/transferencias', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/fornecedores', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/margem', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/vendas?limit=30', { headers: reqHeaders }).catch(() => null),
        api.get('/api/supermercado/balanca/config', { headers: reqHeaders }).catch(() => null)
      ])

      if (dashRes) setDashboard(dashRes)
      if (prodRes?.produtos) setProdutos(prodRes.produtos)
      if (lotesRes?.lotes) setLotes(lotesRes.lotes)
      if (promoRes?.promocoes) setPromocoes(promoRes.promocoes)
      if (transfRes?.transferencias) setTransferencias(transfRes.transferencias)
      if (fornRes) setFornecedoresData({ fornecedores: fornRes.fornecedores || [], sugestoesCompra: fornRes.sugestoesCompra || [] })
      if (margRes) setMargemData({ resumo: margRes.resumo || {}, itens: margRes.itens || [] })
      if (vendRes?.vendas) setVendasHistorico(vendRes.vendas)
      if (balRes) setBalancaConfig(balRes)

      // Inicializar etiquetas com os primeiros 12 produtos
      if (prodRes?.produtos && itensEtiquetas.length === 0) {
        setItensEtiquetas(prodRes.produtos.slice(0, 12).map(p => ({
          itemId: p.id,
          nome: p.nome,
          preco: p.precoFinal || p.precoBase,
          ean: p.ean || p.plu || p.sku,
          unidade: p.unidade,
          quantidade: 1
        })))
      }
    } catch (err) {
      console.error('Erro ao atualizar supermercado:', err)
      toast?.show?.('Erro ao sincronizar dados do supermercado', 'error')
    } finally {
      setLoading(false)
    }
  }, [empresaAtivaId, reqHeaders, toast])

  useEffect(() => {
    carregarTudo()
  }, [carregarTudo])

  // ── Ação: Popular Carga de Mix Oficial de Supermercado ──
  async function popularMixOficial() {
    if (!confirm('Deseja popular a loja com a Carga Oficial de Supermercado (25 itens típicos brasileiros de hortifrúti, mercearia, bebidas, carnes e limpeza)?')) return
    setLoading(true)
    try {
      const res = await api.post('/api/supermercado/catalogo/popular-oficial', {}, { headers: reqHeaders })
      toast?.show?.(`Catálogo oficial carregado com sucesso! ${res?.criados || 25} produtos adicionados.`, 'success')
      await carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao popular catálogo: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Ação: Salvar Novo Produto ──
  async function salvarNovoProduto(e) {
    e.preventDefault()
    try {
      await api.post('/api/supermercado/produtos', formProd, { headers: reqHeaders })
      toast?.show?.('Produto cadastrado com sucesso!', 'success')
      setModalNovoProd(false)
      setFormProd({
        nome: '',
        sku: '',
        ean: '',
        plu: '',
        departamento: 'Mercearia',
        categoria: '',
        unidade: 'UN',
        precoCusto: '',
        precoVenda: '',
        saldoInicial: '',
        estoqueMinimo: '10',
        pesavel: false,
        controlaLote: false
      })
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao salvar: ${err.message}`, 'error')
    }
  }

  // ── Ação: Salvar Edição de Produto ──
  async function salvarEdicaoProduto(e) {
    e.preventDefault()
    if (!modalEditarProd) return
    try {
      await api.patch(`/api/supermercado/produtos/${modalEditarProd.id}`, {
        precoBase: modalEditarProd.precoBase,
        departamento: modalEditarProd.departamento,
        plu: modalEditarProd.plu,
        pesavel: modalEditarProd.pesavel,
        controlaLote: modalEditarProd.controlaLote
      }, { headers: reqHeaders })
      toast?.show?.('Produto atualizado com sucesso!', 'success')
      setModalEditarProd(null)
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao editar: ${err.message}`, 'error')
    }
  }

  // ── Ação: Salvar Preço Específico da Filial/Loja ──
  async function salvarPrecoLoja(e) {
    e.preventDefault()
    if (!modalPrecoLoja) return
    try {
      await api.patch(`/api/supermercado/produtos/${modalPrecoLoja.id}`, {
        precoUnidade: formPrecoLoja.precoUnidade === '' ? null : formPrecoLoja.precoUnidade,
        lojaId: lojaAtivaId
      }, { headers: reqHeaders })
      toast?.show?.('Preço da filial configurado com sucesso!', 'success')
      setModalPrecoLoja(null)
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao configurar preço da loja: ${err.message}`, 'error')
    }
  }

  // ── Ação: Inativar / Excluir Produto ──
  async function inativarProduto(prod) {
    if (!confirm(`Tem certeza que deseja inativar o produto "${prod.nome}"?`)) return
    try {
      await api.delete(`/api/supermercado/produtos/${prod.id}`, { headers: reqHeaders })
      toast?.show?.('Produto removido da gôndola com sucesso.', 'success')
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao inativar: ${err.message}`, 'error')
    }
  }

  // ── Ação: Registrar Novo Lote ──
  async function salvarNovoLote(e) {
    e.preventDefault()
    try {
      await api.post('/api/supermercado/lotes', formLote, { headers: reqHeaders })
      toast?.show?.('Entrada de lote registrada com sucesso!', 'success')
      setModalNovoLote(false)
      setFormLote({ itemId: '', lote: '', validade: '', quantidade: '' })
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao registrar lote: ${err.message}`, 'error')
    }
  }

  // ── Ação: Baixa por Perda / Vencimento de Lote ──
  async function confirmarBaixaLote(e) {
    e.preventDefault()
    if (!modalBaixaLote) return
    try {
      await api.post(`/api/supermercado/lotes/${modalBaixaLote.id}/baixar`, formBaixa, { headers: reqHeaders })
      toast?.show?.(`Baixa de ${formBaixa.quantidade} unidades confirmada por motivo: ${formBaixa.motivo}.`, 'success')
      setModalBaixaLote(null)
      setFormBaixa({ quantidade: '', motivo: 'Vencimento' })
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro na baixa: ${err.message}`, 'error')
    }
  }

  // ── Ação: Liquidação Relâmpago de Lote ──
  async function criarLiquidacaoLote(lote) {
    const nomePromo = `Queima Relâmpago — ${lote.itemNome || 'Lote'}`
    try {
      await api.post('/api/supermercado/promocoes', {
        nome: nomePromo,
        tipo: 'percentual',
        percentual: 35,
        inicio: new Date().toISOString(),
        fim: new Date(Date.now() + 7 * 864e5).toISOString(),
        itens: [lote.itemId]
      }, { headers: reqHeaders })
      toast?.show?.(`Promoção de liquidação relâmpago de 35% criada com sucesso!`, 'success')
      setTab('promocoes')
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao criar promoção: ${err.message}`, 'error')
    }
  }

  // ── Ação: Criar Nova Promoção ──
  async function salvarNovaPromocao(e) {
    e.preventDefault()
    if (formPromo.itens.length === 0) {
      toast?.show?.('Selecione pelo menos um produto para a promoção', 'warning')
      return
    }
    try {
      await api.post('/api/supermercado/promocoes', formPromo, { headers: reqHeaders })
      toast?.show?.('Promoção cadastrada e ativada com sucesso!', 'success')
      setModalNovaPromo(false)
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao criar promoção: ${err.message}`, 'error')
    }
  }

  // ── Ação: Toggle Status Promoção ──
  async function toggleStatusPromo(promo) {
    const novoStatus = promo.status === 'ativa' ? 'pausada' : 'ativa'
    try {
      await api.patch(`/api/supermercado/promocoes/${promo.id}/status`, { status: novoStatus }, { headers: reqHeaders })
      toast?.show?.(`Promoção alterada para ${novoStatus}!`, 'success')
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro: ${err.message}`, 'error')
    }
  }

  // ── Ação: Salvar Novo Fornecedor ──
  async function salvarNovoFornecedor(e) {
    e.preventDefault()
    try {
      await api.post('/api/supermercado/fornecedores', formForn, { headers: reqHeaders })
      toast?.show?.('Fornecedor cadastrado com sucesso!', 'success')
      setModalNovoForn(false)
      setFormForn({ nome: '', cnpj: '', email: '', telefone: '', condicaoPagamento: '30 dias' })
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro: ${err.message}`, 'error')
    }
  }

  // ── Ação: Exportar Carga de Balança ──
  function exportarBalanca() {
    const url = `/api/supermercado/balanca/exportar?lojaId=${lojaAtivaId || ''}`
    window.open(url, '_blank')
    toast?.show?.('Download da carga de PLUs iniciado.', 'info')
  }

  // ── PDV: Adicionar Produto ao Carrinho ──
  function adicionarAoCarrinho(produto, qtd = 1) {
    const unitPrice = Number(produto.precoFinal || produto.precoBase || 0)
    setCarrinho(prev => {
      const idx = prev.findIndex(item => item.produto_id === produto.id)
      if (idx >= 0) {
        const novo = [...prev]
        const nQtd = novo[idx].quantidade + qtd
        novo[idx] = {
          ...novo[idx],
          quantidade: Math.round(nQtd * 1000) / 1000,
          precoTotal: Math.round(nQtd * unitPrice * 100) / 100
        }
        return novo
      }
      return [...prev, {
        id: `pdv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        produto_id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade || 'UN',
        pesavel: produto.pesavel,
        quantidade: qtd,
        precoUnitario: unitPrice,
        precoTotal: Math.round(qtd * unitPrice * 100) / 100
      }]
    })
  }

  // ── PDV: Ler Código / Balança ──
  async function processarLeituraCodigo(e) {
    e?.preventDefault?.()
    const raw = String(leitorInput || '').trim()
    if (!raw) return

    try {
      const res = await api.get(`/api/supermercado/produtos/codigo/${encodeURIComponent(raw)}`, { headers: reqHeaders })
      if (res?.produto) {
        const prod = res.produto
        let qtd = 1
        // Se for balança peso ou preço
        if (res.balanca?.pesavel && res.balanca?.quantidade) {
          qtd = Number(res.balanca.quantidade)
        } else if (res.balanca?.precoTotal && prod.precoFinal) {
          qtd = Math.round((Number(res.balanca.precoTotal) / Number(prod.precoFinal)) * 1000) / 1000
        }
        adicionarAoCarrinho(prod, qtd)
        setLeitorInput('')
        toast?.show?.(`${prod.nome} adicionado ao caixa (${qtd} ${prod.unidade || 'UN'})`, 'success')
      } else {
        toast?.show?.('Código não encontrado no mix ativo.', 'warning')
      }
    } catch {
      toast?.show?.('Código não cadastrado ou erro na leitura.', 'warning')
    }
  }

  // ── PDV: Totais do Carrinho ──
  const subtotalPdv = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + it.precoTotal, 0)
  }, [carrinho])

  const totalFinalPdv = useMemo(() => {
    const desc = parseFloat(descontoPdv) || 0
    return Math.max(0, Math.round((subtotalPdv - desc) * 100) / 100)
  }, [subtotalPdv, descontoPdv])

  const trocoCalculado = useMemo(() => {
    if (formaPagamento !== 'dinheiro') return 0
    const rec = parseFloat(valorRecebido) || 0
    return Math.max(0, Math.round((rec - totalFinalPdv) * 100) / 100)
  }, [formaPagamento, valorRecebido, totalFinalPdv])

  // ── PDV: Finalizar Venda & Emitir NFC-e ──
  async function finalizarVendaPDV() {
    if (carrinho.length === 0) {
      toast?.show?.('O carrinho de compras está vazio.', 'warning')
      return
    }

    setFinalizandoVenda(true)
    try {
      const payload = {
        total: totalFinalPdv,
        desconto: parseFloat(descontoPdv) || 0,
        troco: trocoCalculado,
        forma_pagamento: formaPagamento,
        itens: carrinho.map(it => ({
          produto_id: it.produto_id,
          nome: it.nome,
          quantidade: it.quantidade,
          preco_unitario: it.precoUnitario,
          preco_total: it.precoTotal
        }))
      }

      const res = await api.post('/api/supermercado/venda', payload, { headers: reqHeaders })
      toast?.show?.(`Venda #${res?.venda?.numero || 'Concluída'} finalizada com sucesso!`, 'success')

      // Abre comprovante / NFC-e
      setModalNfce(res?.venda)
      setCarrinho([])
      setValorRecebido('')
      setDescontoPdv('0')
      carregarTudo()
    } catch (err) {
      toast?.show?.(`Erro ao finalizar venda: ${err.message}`, 'error')
    } finally {
      setFinalizandoVenda(false)
    }
  }

  // ── Filtros Aplicados no Catálogo de Produtos ──
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const q = busca.toLowerCase()
      const matchBusca = !q ||
        (p.nome && p.nome.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.ean && p.ean.toLowerCase().includes(q)) ||
        (p.plu && String(p.plu).includes(q)) ||
        (p.departamento && p.departamento.toLowerCase().includes(q))

      const matchDepto = !deptoFiltro || p.departamento === deptoFiltro
      const matchPesavel = !apenasPesaveis || p.pesavel
      const matchRuptura = !apenasRuptura || Number(p.saldo) <= Number(p.estoqueMinimo || 0)

      return matchBusca && matchDepto && matchPesavel && matchRuptura
    })
  }, [produtos, busca, deptoFiltro, apenasPesaveis, apenasRuptura])

  // ── Filtros Aplicados nos Lotes ──
  const lotesFiltrados = useMemo(() => {
    return lotes.filter(l => {
      if (filtroLoteStatus === 'todos') return true
      return l.situacao === filtroLoteStatus
    })
  }, [lotes, filtroLoteStatus])

  // ── Consulta de Balança Rápida ──
  async function testarConsultaCodigo() {
    if (!consultaCodigoInput) return
    try {
      const res = await api.get(`/api/supermercado/produtos/codigo/${encodeURIComponent(consultaCodigoInput)}`, { headers: reqHeaders })
      setConsultaResultado(res)
    } catch (err) {
      setConsultaResultado({ erro: err.message || 'Código não encontrado' })
    }
  }

  return (
    <div className="super-page-container fade-in">
      {/* ═══════════════ HEADER CORPORATIVO ═══════════════ */}
      <div className="super-header-card">
        <div className="super-header-info">
          <h1>
            <Store className="text-blue-600" size={32} />
            Kytto Supermercado & Varejo Alimentar
          </h1>
          <p>
            <span>Gestão completa de gôndola, frente de caixa PDV, pesáveis de balança, validade FEFO e NFC-e integrada.</span>
            <span className="super-tenant-pill">
              🏢 <strong>Empresa:</strong> {empresas.find(e => e.id === empresaAtivaId)?.nome || 'Carregando...'}
            </span>
          </p>
        </div>

        <div className="super-header-controls">
          {/* Seletor de Empresa */}
          {empresas.length > 1 && (
            <select
              className="super-select"
              value={empresaAtivaId}
              onChange={e => {
                setEmpresaAtivaId(e.target.value)
                setLojaAtivaId('')
                carregarLojas(e.target.value)
              }}
              title="Alternar Empresa da Plataforma"
            >
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          )}

          {/* Seletor de Loja / Filial */}
          <select
            className="super-select"
            value={lojaAtivaId}
            onChange={e => setLojaAtivaId(e.target.value)}
            title="Selecionar Loja / Unidade Operacional"
          >
            <option value="">Todas as Lojas (Matriz)</option>
            {lojas.map(lj => (
              <option key={lj.id} value={lj.id}>{lj.nome || lj.codigo || lj.id}</option>
            ))}
          </select>

          <button
            className="super-btn super-btn-secondary"
            onClick={carregarTudo}
            disabled={loading}
            title="Atualizar dados operacionais"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            className="super-btn super-btn-primary"
            onClick={() => setTab('pdv')}
          >
            <ShoppingCart size={16} />
            Abrir PDV
          </button>
        </div>
      </div>

      {/* ═══════════════ NAVEGAÇÃO POR ABAS ═══════════════ */}
      <div className="super-tabs-bar">
        {TABS.map(t => {
          const Icone = t.icone
          const isActive = tab === t.id
          let badgeCount = null
          if (t.id === 'produtos') badgeCount = produtos.length
          if (t.id === 'lotes' && dashboard?.lotesCriticos > 0) badgeCount = dashboard.lotesCriticos
          if (t.id === 'promocoes') badgeCount = promocoes.filter(p => p.status === 'ativa').length
          if (t.id === 'fornecedores' && dashboard?.totalRupturas > 0) badgeCount = dashboard.totalRupturas

          return (
            <button
              key={t.id}
              className={`super-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icone size={18} />
              {t.label}
              {badgeCount !== null && (
                <span className="super-tab-badge">{badgeCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════ ABA 1: DASHBOARD & KPIS ═══════════════ */}
      {tab === 'dashboard' && (
        <div className="fade-in">
          {/* Grid de 4 Cards de KPIs */}
          <div className="super-kpi-grid">
            <div className="super-kpi-card green">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Faturamento Hoje</span>
                <div className="super-kpi-icon"><DollarSign size={20} /></div>
              </div>
              <div className="super-kpi-value">{fmtR(dashboard?.faturamentoHoje || 0)}</div>
              <div className="super-kpi-sub">
                <strong>{dashboard?.vendasHoje || 0}</strong> vendas realizadas • Ticket médio: {fmtR(dashboard?.ticketMedioHoje || 0)}
              </div>
            </div>

            <div className="super-kpi-card blue">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Mix de Gôndola</span>
                <div className="super-kpi-icon"><ShoppingCart size={20} /></div>
              </div>
              <div className="super-kpi-value">{dashboard?.totalProdutos || produtos.length} itens</div>
              <div className="super-kpi-sub">
                <strong>{dashboard?.totalPesaveis || 0}</strong> pesáveis de balança • {fmtQtd(dashboard?.saldoTotalEstoque || 0)} un. estocadas
              </div>
            </div>

            <div className="super-kpi-card amber">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Prevenção de Perdas</span>
                <div className="super-kpi-icon"><Clock size={20} /></div>
              </div>
              <div className="super-kpi-value">{dashboard?.lotesCriticos || 0} lotes críticos</div>
              <div className="super-kpi-sub">
                <span className="text-red-600 font-bold">{dashboard?.lotesVencidos || 0} vencidos</span> • {dashboard?.lotesAtencao || 0} em atenção ≤30d
              </div>
            </div>

            <div className="super-kpi-card purple">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Rentabilidade & Rupturas</span>
                <div className="super-kpi-icon"><Percent size={20} /></div>
              </div>
              <div className="super-kpi-value">{dashboard?.margemMedia || 0}% margem</div>
              <div className="super-kpi-sub">
                <strong>{dashboard?.totalRupturas || 0}</strong> itens abaixo do mínimo • {dashboard?.promocoesAtivas || 0} ofertas ativas
              </div>
            </div>
          </div>

          {/* Gráfico de Distribuição por Departamento */}
          <div className="super-section-card">
            <h2 className="super-section-title">
              <Layers size={20} className="text-blue-600" />
              Distribuição do Mix e Valor de Estoque por Departamento
            </h2>

            {dashboard?.departamentos?.length > 0 ? (
              dashboard.departamentos.map(d => {
                const maxVal = Math.max(...dashboard.departamentos.map(x => x.valorTotal)) || 1
                const pct = Math.round((d.valorTotal / maxVal) * 100)
                return (
                  <div key={d.departamento} className="super-dept-bar-row">
                    <span className="super-dept-name">{d.departamento}</span>
                    <div className="super-dept-track">
                      <div className="super-dept-fill" style={{ width: `${Math.max(pct, 5)}%` }} />
                    </div>
                    <span className="super-dept-val">{fmtR(d.valorTotal)} <small className="text-gray-400 font-normal">({d.itens} itens)</small></span>
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p>Nenhum dado por departamento registrado ainda.</p>
                <button className="super-btn super-btn-primary mt-3" onClick={popularMixOficial}>
                  Carregar Mix Oficial de Supermercado
                </button>
              </div>
            )}
          </div>

          {/* Ações Rápidas & Alertas Imediatos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="super-section-card">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                Alertas Operacionais & Prevenção
              </h3>
              <div className="space-y-2">
                {dashboard?.lotesVencidos > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                    <div>
                      <strong className="text-red-700 block text-sm">Existem {dashboard.lotesVencidos} lotes com data de validade vencida!</strong>
                      <span className="text-xs text-red-600">Necessário baixa de perda ou recolhimento de gôndola.</span>
                    </div>
                    <button className="super-btn super-btn-sm super-btn-danger" onClick={() => setTab('lotes')}>
                      Ver Lotes
                    </button>
                  </div>
                )}

                {dashboard?.totalRupturas > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                    <div>
                      <strong className="text-amber-800 block text-sm">{dashboard.totalRupturas} produtos estão em risco de ruptura de gôndola</strong>
                      <span className="text-xs text-amber-700">Saldo atual está igual ou abaixo do estoque mínimo.</span>
                    </div>
                    <button className="super-btn super-btn-sm super-btn-secondary" onClick={() => setTab('fornecedores')}>
                      Reposição
                    </button>
                  </div>
                )}

                {dashboard?.lotesVencidos === 0 && dashboard?.totalRupturas === 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>Nenhuma ruptura crítica ou lote vencido detectado na operação.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="super-section-card">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Sliders size={18} className="text-blue-600" />
                Ações Rápidas de Supermercado
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="super-btn super-btn-secondary justify-start text-xs" onClick={() => setTab('produtos')}>
                  <Plus size={14} /> Novo Produto
                </button>
                <button className="super-btn super-btn-secondary justify-start text-xs" onClick={() => setTab('pdv')}>
                  <DollarSign size={14} /> Frente de Caixa
                </button>
                <button className="super-btn super-btn-secondary justify-start text-xs" onClick={exportarBalanca}>
                  <Download size={14} /> Carga Balança
                </button>
                <button className="super-btn super-btn-secondary justify-start text-xs" onClick={() => setTab('etiquetas')}>
                  <Printer size={14} /> Imprimir Etiquetas
                </button>
                <button className="super-btn super-btn-secondary justify-start text-xs" onClick={() => setTab('promocoes')}>
                  <Tag size={14} /> Nova Promoção
                </button>
                <button className="super-btn super-btn-primary justify-start text-xs" onClick={popularMixOficial}>
                  <UploadCloud size={14} /> Mix Oficial (25)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 2: PRODUTOS & MIX DE GÔNDOLA ═══════════════ */}
      {tab === 'produtos' && (
        <div className="fade-in">
          <div className="super-toolbar">
            <div className="super-toolbar-left">
              <div className="relative">
                <input
                  type="text"
                  className="super-input-search"
                  placeholder="Buscar por nome, EAN, SKU ou PLU..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <select
                className="super-select"
                value={deptoFiltro}
                onChange={e => setDeptoFiltro(e.target.value)}
              >
                <option value="">Todos os Departamentos</option>
                {DEPARTAMENTOS_PADRAO.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasPesaveis}
                  onChange={e => setApenasPesaveis(e.target.checked)}
                />
                <Scale size={14} className="text-blue-600" />
                Apenas Pesáveis (Balança)
              </label>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasRuptura}
                  onChange={e => setApenasRuptura(e.target.checked)}
                />
                <AlertTriangle size={14} className="text-amber-500" />
                Abaixo do Mínimo
              </label>
            </div>

            <div className="super-toolbar-right">
              <button className="super-btn super-btn-secondary" onClick={() => setModalConsulta(true)}>
                <Barcode size={16} />
                Consultar Código
              </button>
              <button className="super-btn super-btn-secondary" onClick={popularMixOficial}>
                <UploadCloud size={16} />
                Carga Mix Oficial
              </button>
              <button className="super-btn super-btn-primary" onClick={() => setModalNovoProd(true)}>
                <Plus size={16} />
                Novo Produto
              </button>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Código / SKU</th>
                  <th>EAN-13 / PLU</th>
                  <th>Produto & Departamento</th>
                  <th>Un.</th>
                  <th>Custo Médio</th>
                  <th>Preço Gôndola</th>
                  <th>Margem</th>
                  <th>Saldo Atual</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.length > 0 ? (
                  produtosFiltrados.map(p => {
                    const preco = Number(p.precoFinal || p.precoBase || 0)
                    const custo = Number(p.custoMedio || 0)
                    const saldo = Number(p.saldo || 0)
                    const min = Number(p.estoqueMinimo || 0)
                    const isRuptura = saldo <= min

                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="font-mono text-xs font-bold text-gray-600">{p.sku || '-'}</span>
                        </td>
                        <td>
                          <div className="font-mono text-xs text-gray-700">
                            {p.ean ? <div>{p.ean}</div> : null}
                            {p.plu ? <span className="super-badge blue">PLU: {p.plu}</span> : null}
                          </div>
                        </td>
                        <td>
                          <div className="font-bold text-gray-900">{p.nome}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span>{p.departamento || 'Geral'}</span>
                            {p.pesavel && <span className="super-badge amber"><Scale size={10} /> Pesável</span>}
                            {p.controlaLote && <span className="super-badge purple"><Clock size={10} /> FEFO</span>}
                            {p.promocao && <span className="super-badge green"><Tag size={10} /> {p.promocao.texto}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="font-bold text-xs text-gray-700">{p.unidade || 'UN'}</span>
                        </td>
                        <td>{fmtR(custo)}</td>
                        <td>
                          <div className="font-extrabold text-gray-900">{fmtR(preco)}</div>
                          {p.precoDaUnidade && (
                            <div className="text-xs text-blue-600">Filial: {fmtR(p.precoDaUnidade)}</div>
                          )}
                        </td>
                        <td>
                          <span className={`font-bold text-xs ${p.margem >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {p.margem || 0}%
                          </span>
                        </td>
                        <td>
                          <div className={`font-bold ${isRuptura ? 'text-red-600' : 'text-gray-900'}`}>
                            {fmtQtd(saldo)}
                          </div>
                          <div className="text-xs text-gray-400">mín: {min}</div>
                        </td>
                        <td>
                          {isRuptura ? (
                            <span className="super-badge red">Reposição</span>
                          ) : (
                            <span className="super-badge green">Disponível</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="super-btn super-btn-sm super-btn-secondary"
                              onClick={() => {
                                setModalPrecoLoja(p)
                                setFormPrecoLoja({ precoUnidade: p.precoDaUnidade || '' })
                              }}
                              title="Configurar preço desta filial"
                            >
                              Filial
                            </button>
                            <button
                              className="super-btn super-btn-sm super-btn-secondary"
                              onClick={() => setModalEditarProd({ ...p })}
                              title="Editar Produto"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              className="super-btn super-btn-sm super-btn-danger"
                              onClick={() => inativarProduto(p)}
                              title="Inativar Produto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">
                      Nenhum produto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 3: FRENTE DE CAIXA (PDV) ═══════════════ */}
      {tab === 'pdv' && (
        <div className="fade-in">
          <div className="super-pdv-grid">
            {/* Lado Esquerdo: Scanner, Busca & Atalhos */}
            <div>
              <div className="super-pdv-scanner-box">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Barcode size={16} /> Leitor de Código de Barras / Balança
                  </span>
                  <span className="text-xs text-gray-400">Pressione Enter após escanear</span>
                </div>

                <form onSubmit={processarLeituraCodigo} className="flex gap-2">
                  <input
                    type="text"
                    className="super-pdv-input-scan"
                    placeholder="Passe o leitor ou digite o EAN-13 / PLU..."
                    value={leitorInput}
                    onChange={e => setLeitorInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="super-btn super-btn-primary px-6">
                    Bipar
                  </button>
                </form>
              </div>

              {/* Atalhos Rápidos de Alto Giro */}
              <div className="super-section-card">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                  <ShoppingCart size={16} className="text-blue-600" />
                  Itens Rápidos de Alto Giro (Clique para adicionar)
                </h3>

                <div className="super-quick-items-grid">
                  {produtos.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      className="super-quick-item-btn"
                      onClick={() => adicionarAoCarrinho(p, 1)}
                    >
                      <span className="text-xs font-bold text-gray-800 line-clamp-2">{p.nome}</span>
                      <span className="text-xs font-extrabold text-blue-600 mt-1">
                        {fmtR(p.precoFinal || p.precoBase)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Histórico das Últimas Vendas */}
              <div className="super-section-card">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                  <Clock size={16} className="text-gray-500" />
                  Últimas Vendas Finalizadas
                </h3>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {vendasHistorico.length > 0 ? (
                    vendasHistorico.map(v => (
                      <div key={v.id} className="p-2 border border-gray-100 rounded flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <strong className="text-gray-800">{v.numero}</strong> • {fmtDate(v.data)}
                          <div className="text-gray-500">{v.itens?.length || 0} itens • Pagto: {v.formaPagamento}</div>
                        </div>
                        <div className="text-right">
                          <strong className="text-emerald-700 block text-sm">{fmtR(v.total)}</strong>
                          <button
                            className="text-blue-600 hover:underline text-xs"
                            onClick={() => setModalNfce(v)}
                          >
                            Ver Recibo
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 p-3 text-center">Nenhuma venda registrada ainda no turno.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lado Direito: Cupom Fiscal / Carrinho */}
            <div className="super-ticket-box">
              <div className="super-ticket-header">
                <h2 className="text-lg font-black text-gray-900 tracking-wider">CUPOM FISCAL DE VENDA</h2>
                <div className="text-xs text-gray-500 mt-0.5">
                  Supermercado Kytto • Terminal PDV 01 • {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>

              {/* Lista dos Itens */}
              <div className="super-ticket-list">
                {carrinho.length > 0 ? (
                  carrinho.map((item, idx) => (
                    <div key={item.id} className="super-ticket-item">
                      <div>
                        <div className="font-bold text-gray-800">
                          {idx + 1}. {item.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.quantidade} {item.unidade} × {fmtR(item.precoUnitario)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong className="text-gray-900">{fmtR(item.precoTotal)}</strong>
                        <button
                          className="text-red-500 hover:text-red-700 p-1"
                          onClick={() => setCarrinho(prev => prev.filter(x => x.id !== item.id))}
                          title="Remover item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 p-12">
                    <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                    <p>Caixa livre. Bipe ou selecione produtos ao lado.</p>
                  </div>
                )}
              </div>

              {/* Rodapé do Ticket */}
              <div className="super-ticket-footer">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <strong>{fmtR(subtotalPdv)}</strong>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600 mt-1">
                  <span>Desconto (R$):</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 text-right p-1 border rounded text-xs"
                    value={descontoPdv}
                    onChange={e => setDescontoPdv(e.target.value)}
                  />
                </div>

                <div className="super-ticket-total-row">
                  <span>TOTAL:</span>
                  <span className="text-emerald-700">{fmtR(totalFinalPdv)}</span>
                </div>

                {/* Forma de Pagamento */}
                <div className="mt-4 pt-3 border-t">
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Forma de Pagamento:</label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold mb-3">
                    {[
                      { id: 'dinheiro', label: '💵 Dinheiro' },
                      { id: 'pix', label: '📱 Pix' },
                      { id: 'debito', label: '💳 Débito' },
                      { id: 'credito', label: '💳 Crédito' },
                      { id: 'vale', label: '🥗 Vale Alim.' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className={`p-2 rounded border text-center transition ${formaPagamento === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => setFormaPagamento(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {formaPagamento === 'dinheiro' && (
                    <div className="p-2.5 bg-gray-50 border rounded-lg mb-3">
                      <div className="flex justify-between items-center text-xs">
                        <span>Valor Recebido em Dinheiro:</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-28 p-1 text-right border rounded font-bold"
                          placeholder="Ex: 50.00"
                          value={valorRecebido}
                          onChange={e => setValorRecebido(e.target.value)}
                        />
                      </div>
                      {trocoCalculado > 0 && (
                        <div className="flex justify-between items-center text-xs font-bold text-emerald-700 mt-1.5 pt-1.5 border-t">
                          <span>Troco a devolver:</span>
                          <span className="text-sm">{fmtR(trocoCalculado)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="super-btn super-btn-success w-full py-3 text-base justify-center font-black tracking-wide"
                    disabled={carrinho.length === 0 || finalizandoVenda}
                    onClick={finalizarVendaPDV}
                  >
                    {finalizandoVenda ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        FINALIZAR VENDA & EMITIR NFC-E
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 4: LOTES & VALIDADE (FEFO) ═══════════════ */}
      {tab === 'lotes' && (
        <div className="fade-in">
          {/* Alertas de Situação */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <button
              className={`p-3 rounded-lg border text-left cursor-pointer transition ${filtroLoteStatus === 'todos' ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}
              onClick={() => setFiltroLoteStatus('todos')}
            >
              <span className="text-xs font-semibold text-gray-500">Todos os Lotes</span>
              <div className="text-xl font-bold text-gray-800">{lotes.length}</div>
            </button>
            <button
              className={`p-3 rounded-lg border text-left cursor-pointer transition ${filtroLoteStatus === 'vencido' ? 'border-red-600 bg-red-50' : 'bg-white'}`}
              onClick={() => setFiltroLoteStatus('vencido')}
            >
              <span className="text-xs font-semibold text-red-600">🚨 Vencidos</span>
              <div className="text-xl font-bold text-red-700">{dashboard?.lotesVencidos || 0}</div>
            </button>
            <button
              className={`p-3 rounded-lg border text-left cursor-pointer transition ${filtroLoteStatus === 'critico' ? 'border-amber-600 bg-amber-50' : 'bg-white'}`}
              onClick={() => setFiltroLoteStatus('critico')}
            >
              <span className="text-xs font-semibold text-amber-700">⚠️ Críticos (≤ 7 dias)</span>
              <div className="text-xl font-bold text-amber-800">{lotes.filter(l => l.situacao === 'critico').length}</div>
            </button>
            <button
              className={`p-3 rounded-lg border text-left cursor-pointer transition ${filtroLoteStatus === 'atencao' ? 'border-yellow-600 bg-yellow-50' : 'bg-white'}`}
              onClick={() => setFiltroLoteStatus('atencao')}
            >
              <span className="text-xs font-semibold text-yellow-700">🕒 Atenção (≤ 30 dias)</span>
              <div className="text-xl font-bold text-yellow-800">{dashboard?.lotesAtencao || 0}</div>
            </button>
          </div>

          <div className="super-toolbar">
            <div className="super-toolbar-left">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Clock size={16} className="text-blue-600" />
                Rastreabilidade de Validade & Prevenção de Perdas (FEFO: First Expire, First Out)
              </span>
            </div>
            <div className="super-toolbar-right">
              <button className="super-btn super-btn-primary" onClick={() => setModalNovoLote(true)}>
                <Plus size={16} />
                + Entrada de Lote
              </button>
            </div>
          </div>

          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lote</th>
                  <th>Data de Validade</th>
                  <th>Dias Restantes</th>
                  <th>Quantidade</th>
                  <th>Situação FEFO</th>
                  <th style={{ textAlign: 'right' }}>Ações de Perda / Prevenção</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.length > 0 ? (
                  lotesFiltrados.map(l => (
                    <tr key={l.id} className={l.situacao === 'vencido' ? 'vencido' : (l.situacao === 'critico' ? 'critico' : '')}>
                      <td>
                        <strong className="text-gray-900">{l.itemNome || l.itemId}</strong>
                      </td>
                      <td>
                        <span className="font-mono font-bold text-xs bg-gray-100 px-2 py-0.5 rounded">{l.lote}</span>
                      </td>
                      <td>{fmtDateOnly(l.validade)}</td>
                      <td>
                        <span className={`font-bold ${l.diasParaVencer < 0 ? 'text-red-700' : (l.diasParaVencer <= 7 ? 'text-amber-700' : 'text-gray-700')}`}>
                          {l.diasParaVencer < 0 ? `Vencido há ${Math.abs(l.diasParaVencer)} dias` : `${l.diasParaVencer} dias`}
                        </span>
                      </td>
                      <td><strong>{l.quantidade}</strong></td>
                      <td>
                        {l.situacao === 'vencido' && <span className="super-badge red">Vencido</span>}
                        {l.situacao === 'critico' && <span className="super-badge red">Crítico (≤7d)</span>}
                        {l.situacao === 'atencao' && <span className="super-badge amber">Atenção (≤30d)</span>}
                        {l.situacao === 'normal' && <span className="super-badge green">Adequado</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5">
                          {['critico', 'atencao'].includes(l.situacao) && (
                            <button
                              className="super-btn super-btn-sm super-btn-primary"
                              onClick={() => criarLiquidacaoLote(l)}
                              title="Criar promoção de queima relâmpago"
                            >
                              <Tag size={12} /> Liquidar
                            </button>
                          )}
                          <button
                            className="super-btn super-btn-sm super-btn-danger"
                            onClick={() => {
                              setModalBaixaLote(l)
                              setFormBaixa({ quantidade: l.quantidade, motivo: 'Vencimento' })
                            }}
                            title="Baixar lote por perda ou vencimento"
                          >
                            <Trash2 size={12} /> Baixa Perda
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      Nenhum lote registrado para esta condição.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 5: PROMOÇÕES & OFERTAS ═══════════════ */}
      {tab === 'promocoes' && (
        <div className="fade-in">
          <div className="super-toolbar">
            <div className="super-toolbar-left">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Tag size={16} className="text-blue-600" />
                Campanhas Promocionais, Leve X Pague Y e Ofertas de Gôndola
              </span>
            </div>
            <div className="super-toolbar-right">
              <button className="super-btn super-btn-primary" onClick={() => setModalNovaPromo(true)}>
                <Plus size={16} />
                Nova Promoção
              </button>
            </div>
          </div>

          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Mecânica Promocional</th>
                  <th>Vigência (Início - Fim)</th>
                  <th>Produtos Vinculados</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {promocoes.length > 0 ? (
                  promocoes.map(pr => (
                    <tr key={pr.id}>
                      <td>
                        <strong className="text-gray-900 block">{pr.nome}</strong>
                        <span className="text-xs text-gray-500">ID: {pr.id.slice(0, 8)}</span>
                      </td>
                      <td>
                        {pr.tipo === 'percentual' && <span className="super-badge green font-extrabold">{pr.percentual}% OFF</span>}
                        {pr.tipo === 'valor' && <span className="super-badge green font-extrabold">R$ {pr.valorDesconto} OFF</span>}
                        {pr.tipo === 'preco_fixo' && <span className="super-badge blue font-extrabold">Preço Fixo {fmtR(pr.precoFixo)}</span>}
                        {pr.tipo === 'leve_pague' && <span className="super-badge purple font-extrabold">Leve {pr.leve} Pague {pr.pague}</span>}
                      </td>
                      <td>
                        <div className="text-xs">
                          <div><strong>De:</strong> {fmtDate(pr.inicio)}</div>
                          <div><strong>Até:</strong> {fmtDate(pr.fim)}</div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded">
                          {pr.itens?.length || 0} produtos
                        </span>
                      </td>
                      <td>
                        {pr.status === 'ativa' ? (
                          <span className="super-badge green">Ativa</span>
                        ) : (
                          <span className="super-badge gray">Pausada</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`super-btn super-btn-sm ${pr.status === 'ativa' ? 'super-btn-secondary' : 'super-btn-success'}`}
                          onClick={() => toggleStatusPromo(pr)}
                        >
                          {pr.status === 'ativa' ? 'Pausar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Nenhuma promoção ativa cadastrada. Clique no botão acima para criar uma oferta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 6: ETIQUETAS & BALANÇA ═══════════════ */}
      {tab === 'etiquetas' && (
        <div className="fade-in">
          <div className="super-section-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Printer size={18} className="text-blue-600" />
                  Gerador & Impressor de Etiquetas de Gôndola e Balança
                </h2>
                <p className="text-xs text-gray-500">
                  Formato A4 pronto para impressoras laser/jato ou impressoras térmicas (Zebra, Argox, Toledo).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="super-select"
                  value={formatoEtiqueta}
                  onChange={e => setFormatoEtiqueta(e.target.value)}
                >
                  <option value="gondola_100x40">Gôndola Padrão (100 × 40 mm)</option>
                  <option value="gondola_60x30">Gôndola Compacta (60 × 30 mm)</option>
                  <option value="adesivo_40x25">Adesivo Embalagem (40 × 25 mm)</option>
                  <option value="oferta_amarela">Etiqueta Amarela de Oferta</option>
                </select>

                <button className="super-btn super-btn-primary" onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir Etiquetas
                </button>

                <button className="super-btn super-btn-secondary" onClick={exportarBalanca}>
                  <Scale size={16} /> Exportar Arquivo Balança (.csv)
                </button>
              </div>
            </div>

            {/* Configuração de Balança Toledo/Filizola */}
            <div className="p-3 bg-gray-50 border rounded-lg mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Scale size={20} className="text-blue-600" />
                <div>
                  <strong>Configuração da Balança de Frente / Checkout:</strong>
                  <div className="text-gray-500">
                    Prefixo: <strong>{balancaConfig.prefixo}</strong> • Dígitos PLU: <strong>{balancaConfig.digitosPlu}</strong> • Tipo: <strong>{balancaConfig.tipoValor}</strong>
                  </div>
                </div>
              </div>

              <span className="super-badge green">Protocolo Toledo / Prix / Filizola Ativo</span>
            </div>

            {/* Pré-visualização da Folha de Etiquetas */}
            <div className="super-etiquetas-preview-grid">
              {itensEtiquetas.map((item, idx) => {
                const isOferta = formatoEtiqueta === 'oferta_amarela'
                return (
                  <div key={idx} className={`super-etiqueta-card ${isOferta ? 'oferta' : ''}`}>
                    <div>
                      {isOferta && (
                        <div className="bg-red-600 text-white font-black text-center text-xs py-0.5 rounded mb-1 tracking-wider">
                          OFERTA ESPECIAL
                        </div>
                      )}
                      <div className="super-etiqueta-nome">{item.nome}</div>
                      <div className="super-etiqueta-meta">
                        <span>UN: {item.unidade || 'UN'}</span>
                        <span>COD: {item.ean || '1001'}</span>
                      </div>
                    </div>

                    <div>
                      <div className="super-etiqueta-preco">{fmtR(item.preco)}</div>
                      <div className="super-etiqueta-barcode">
                        ||||| | |||| ||| ||||||| ||| |||
                        <div>{item.ean || '7898000010015'}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 7: TRANSFERÊNCIAS & LOGÍSTICA ═══════════════ */}
      {tab === 'transferencias' && (
        <div className="fade-in">
          <div className="super-toolbar">
            <div className="super-toolbar-left">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <ArrowLeftRight size={16} className="text-blue-600" />
                Transferências entre Matriz / Centro de Distribuição e Filiais
              </span>
            </div>
            <div className="super-toolbar-right">
              <button className="super-btn super-btn-primary" onClick={() => setModalNovaTransf(true)}>
                <Plus size={16} />
                + Nova Transferência
              </button>
            </div>
          </div>

          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Nº Carga</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Total Itens</th>
                  <th>Status</th>
                  <th>Data Envio</th>
                  <th style={{ textAlign: 'right' }}>Ações de Conferência</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.length > 0 ? (
                  transferencias.map(tr => (
                    <tr key={tr.id}>
                      <td><strong className="text-gray-900 font-mono">{tr.numero || tr.id.slice(0, 8)}</strong></td>
                      <td>Matriz / CD Central</td>
                      <td>{tr.destinoLojaId || 'Filial 01'}</td>
                      <td><strong>{tr.itens?.length || 0}</strong> itens</td>
                      <td>
                        {tr.status === 'rascunho' && <span className="super-badge gray">Rascunho</span>}
                        {tr.status === 'em_transito' && <span className="super-badge blue">Em Trânsito</span>}
                        {tr.status === 'recebida' && <span className="super-badge green">Recebida</span>}
                      </td>
                      <td>{fmtDate(tr.enviadaEm || tr.criadaEm)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {tr.status === 'rascunho' && (
                          <button
                            className="super-btn super-btn-sm super-btn-primary"
                            onClick={async () => {
                              await api.post(`/api/supermercado/transferencias/${tr.id}/enviar`, {}, { headers: reqHeaders })
                              toast?.show?.('Carga despachada com sucesso!', 'success')
                              carregarTudo()
                            }}
                          >
                            Despachar Carga
                          </button>
                        )}
                        {tr.status === 'em_transito' && (
                          <button
                            className="super-btn super-btn-sm super-btn-success"
                            onClick={async () => {
                              await api.post(`/api/supermercado/transferencias/${tr.id}/receber`, {}, { headers: reqHeaders })
                              toast?.show?.('Recebimento e entrada no estoque da filial confirmados!', 'success')
                              carregarTudo()
                            }}
                          >
                            Confirmar Entrada
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      Nenhuma transferência registrada recentemente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 8: FORNECEDORES & COMPRAS ═══════════════ */}
      {tab === 'fornecedores' && (
        <div className="fade-in">
          {/* Painel de Sugestão Automática de Compra */}
          <div className="super-section-card border-amber-200 bg-amber-50/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-extrabold text-amber-900 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600" />
                  Sugestão Automática de Compra & Reposição de Gôndola
                </h3>
                <p className="text-xs text-amber-700">
                  Itens cujo saldo atual está abaixo do estoque mínimo. Cálculo baseado no lote econômico e prazo do fornecedor.
                </p>
              </div>

              <button
                className="super-btn super-btn-sm super-btn-secondary"
                onClick={() => {
                  const csv = [
                    'SKU,Produto,Departamento,Saldo Atual,Estoque Minimo,Qtd Sugerida,Custo Unitario,Total Estimado',
                    ...fornecedoresData.sugestoesCompra.map(s =>
                      `"${s.sku}","${s.nome}","${s.departamento}",${s.saldoAtual},${s.estoqueMinimo},${s.quantidadeSugerida},${s.custoUnitario},${s.valorEstimadoTotal}`
                    )
                  ].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const link = document.createElement('a')
                  link.href = URL.createObjectURL(blob)
                  link.download = `sugestao-compras-${new Date().toISOString().slice(0, 10)}.csv`
                  link.click()
                }}
              >
                <Download size={14} /> Exportar Pedido (CSV)
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {fornecedoresData.sugestoesCompra.length > 0 ? (
                fornecedoresData.sugestoesCompra.map(s => (
                  <div key={s.itemId} className="p-2.5 bg-white border border-amber-200 rounded flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-gray-900">{s.nome}</strong> • <span className="text-gray-500">{s.departamento}</span>
                      <div className="text-amber-700">Saldo: {s.saldoAtual} un. | Mínimo: {s.estoqueMinimo} un.</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-blue-700 text-sm">Comprar: +{s.quantidadeSugerida} {s.unidade}</div>
                      <div className="text-gray-500">Estimado: {fmtR(s.valorEstimadoTotal)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-emerald-700 p-3 bg-emerald-50 rounded">
                  ✓ Todos os produtos estão com saldo superior ao estoque mínimo de segurança.
                </p>
              )}
            </div>
          </div>

          <div className="super-toolbar">
            <div className="super-toolbar-left">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Truck size={16} className="text-blue-600" />
                Distribuidores & Fornecedores Homologados
              </span>
            </div>
            <div className="super-toolbar-right">
              <button className="super-btn super-btn-primary" onClick={() => setModalNovoForn(true)}>
                <Plus size={16} />
                + Novo Fornecedor
              </button>
            </div>
          </div>

          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Razão Social / Nome</th>
                  <th>CNPJ</th>
                  <th>Contato</th>
                  <th>Telefone / WhatsApp</th>
                  <th>E-mail</th>
                  <th>Prazo Pagto</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fornecedoresData.fornecedores.length > 0 ? (
                  fornecedoresData.fornecedores.map(f => (
                    <tr key={f.id}>
                      <td><strong className="text-gray-900">{f.nome}</strong></td>
                      <td><span className="font-mono text-xs">{f.cnpj || '-'}</span></td>
                      <td>{f.contato || 'Representante Comercial'}</td>
                      <td>{f.telefone || '-'}</td>
                      <td>{f.email || '-'}</td>
                      <td><span className="super-badge blue">{f.condicao_pagamento || '30 dias'}</span></td>
                      <td><span className="super-badge green">Ativo</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      Nenhum fornecedor registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ ABA 9: MARGENS, MARKUP & CURVA ABC ═══════════════ */}
      {tab === 'margem' && (
        <div className="fade-in">
          {/* Resumo Financeiro da Margem */}
          <div className="super-kpi-grid">
            <div className="super-kpi-card green">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Margem Média da Gôndola</span>
                <div className="super-kpi-icon"><Percent size={20} /></div>
              </div>
              <div className="super-kpi-value">{margemData.resumo?.margemMedia || 0}%</div>
              <div className="super-kpi-sub">Calculada sobre o preço de venda</div>
            </div>

            <div className="super-kpi-card blue">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Markup Médio</span>
                <div className="super-kpi-icon"><TrendingUp size={20} /></div>
              </div>
              <div className="super-kpi-value">{margemData.resumo?.markupMedio || 0}%</div>
              <div className="super-kpi-sub">Multiplicador sobre custo médio</div>
            </div>

            <div className="super-kpi-card purple">
              <div className="super-kpi-top">
                <span className="super-kpi-label">Curva ABC (Mix)</span>
                <div className="super-kpi-icon"><Layers size={20} /></div>
              </div>
              <div className="super-kpi-value">{margemData.resumo?.classeA || 0} Classe A</div>
              <div className="super-kpi-sub">
                {margemData.resumo?.classeB || 0} Classe B • {margemData.resumo?.classeC || 0} Classe C
              </div>
            </div>
          </div>

          {/* Simulador de Reajuste de Preços */}
          <div className="super-section-card bg-blue-50/40 border-blue-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                  <Sliders size={18} className="text-blue-600" />
                  Simulador de Reajuste & Impacto de Margem
                </h3>
                <p className="text-xs text-blue-700">
                  Simule o impacto de um reajuste de preço por departamento no faturamento e lucro bruto estimado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="super-select text-xs"
                  value={simDepto}
                  onChange={e => setSimDepto(e.target.value)}
                >
                  <option value="Todos">Todos os Departamentos</option>
                  {DEPARTAMENTOS_PADRAO.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1 bg-white p-1 border rounded text-xs">
                  <span>Reajuste:</span>
                  <input
                    type="number"
                    className="w-16 p-1 border rounded text-right font-bold"
                    value={simPct}
                    onChange={e => setSimPct(Number(e.target.value))}
                  />
                  <span>%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Produtos com Rentabilidade */}
          <div className="super-table-wrapper">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Departamento</th>
                  <th>Custo Médio</th>
                  <th>Preço Venda</th>
                  <th>Lucro Unitário</th>
                  <th>Margem (%)</th>
                  <th>Markup (%)</th>
                  <th>Curva ABC</th>
                </tr>
              </thead>
              <tbody>
                {margemData.itens?.length > 0 ? (
                  margemData.itens.map(it => (
                    <tr key={it.id}>
                      <td><strong className="text-gray-900">{it.nome}</strong></td>
                      <td>{it.departamento}</td>
                      <td>{fmtR(it.custoMedio)}</td>
                      <td><strong>{fmtR(it.precoVenda)}</strong></td>
                      <td className="text-emerald-700 font-extrabold">{fmtR(it.lucroUnitario)}</td>
                      <td>
                        <span className={`font-bold ${it.margemPercentual >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {it.margemPercentual}%
                        </span>
                      </td>
                      <td>{it.markupPercentual}%</td>
                      <td>
                        {it.curva === 'A' && <span className="super-badge green">Curva A (80%)</span>}
                        {it.curva === 'B' && <span className="super-badge blue">Curva B (15%)</span>}
                        {it.curva === 'C' && <span className="super-badge gray">Curva C (5%)</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      Nenhum dado financeiro calculado para o mix.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: NOVO PRODUTO ═══════════════ */}
      {modalNovoProd && (
        <Modal
          title="Cadastrar Novo Produto de Supermercado"
          onClose={() => setModalNovoProd(false)}
          width={680}
        >
          <form onSubmit={salvarNovoProduto} className="p-4 space-y-4">
            <div className="super-form-grid">
              <div className="super-form-group col-span-2">
                <label className="super-form-label">Nome Completo do Produto *</label>
                <input
                  type="text"
                  required
                  className="super-form-input"
                  placeholder="Ex: Arroz Nobre Tipo 1 Pacote 5kg"
                  value={formProd.nome}
                  onChange={e => setFormProd({ ...formProd, nome: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Departamento</label>
                <select
                  className="super-form-select"
                  value={formProd.departamento}
                  onChange={e => setFormProd({ ...formProd, departamento: e.target.value })}
                >
                  {DEPARTAMENTOS_PADRAO.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Unidade de Medida</label>
                <select
                  className="super-form-select"
                  value={formProd.unidade}
                  onChange={e => setFormProd({ ...formProd, unidade: e.target.value })}
                >
                  <option value="UN">UN (Unidade)</option>
                  <option value="KG">KG (Quilograma - Balança)</option>
                  <option value="PCT">PCT (Pacote)</option>
                  <option value="L">L (Litro)</option>
                  <option value="CX">CX (Caixa)</option>
                </select>
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Código EAN-13 (Código de Barras)</label>
                <input
                  type="text"
                  className="super-form-input font-mono"
                  placeholder="789..."
                  value={formProd.ean}
                  onChange={e => setFormProd({ ...formProd, ean: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Código PLU (Balança / Rápido)</label>
                <input
                  type="text"
                  className="super-form-input font-mono"
                  placeholder="Ex: 1001"
                  value={formProd.plu}
                  onChange={e => setFormProd({ ...formProd, plu: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Preço de Custo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="super-form-input"
                  placeholder="0.00"
                  value={formProd.precoCusto}
                  onChange={e => setFormProd({ ...formProd, precoCusto: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Preço de Venda / Gôndola (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="super-form-input font-bold"
                  placeholder="0.00"
                  value={formProd.precoVenda}
                  onChange={e => setFormProd({ ...formProd, precoVenda: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Saldo Inicial em Estoque</label>
                <input
                  type="number"
                  step="0.001"
                  className="super-form-input"
                  placeholder="Ex: 50"
                  value={formProd.saldoInicial}
                  onChange={e => setFormProd({ ...formProd, saldoInicial: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Estoque Mínimo de Segurança</label>
                <input
                  type="number"
                  className="super-form-input"
                  placeholder="10"
                  value={formProd.estoqueMinimo}
                  onChange={e => setFormProd({ ...formProd, estoqueMinimo: e.target.value })}
                />
              </div>

              <div className="super-form-group col-span-2 flex gap-6 pt-2">
                <label className="super-form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formProd.pesavel}
                    onChange={e => setFormProd({ ...formProd, pesavel: e.target.checked })}
                  />
                  <span>⚖️ Produto Pesável (Emite na Balança de Gôndola/Checkout)</span>
                </label>

                <label className="super-form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formProd.controlaLote}
                    onChange={e => setFormProd({ ...formProd, controlaLote: e.target.checked })}
                  />
                  <span>⏳ Controla Lote e Data de Validade (FEFO)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalNovoProd(false)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-primary">
                Salvar Produto
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: EDITAR PRODUTO ═══════════════ */}
      {modalEditarProd && (
        <Modal
          title={`Editar Produto — ${modalEditarProd.nome}`}
          onClose={() => setModalEditarProd(null)}
          width={560}
        >
          <form onSubmit={salvarEdicaoProduto} className="p-4 space-y-4">
            <div className="super-form-group">
              <label className="super-form-label">Preço Base de Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                className="super-form-input font-bold"
                value={modalEditarProd.precoBase || ''}
                onChange={e => setModalEditarProd({ ...modalEditarProd, precoBase: e.target.value })}
              />
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Departamento</label>
              <select
                className="super-form-select"
                value={modalEditarProd.departamento || ''}
                onChange={e => setModalEditarProd({ ...modalEditarProd, departamento: e.target.value })}
              >
                {DEPARTAMENTOS_PADRAO.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Código PLU</label>
              <input
                type="text"
                className="super-form-input font-mono"
                value={modalEditarProd.plu || ''}
                onChange={e => setModalEditarProd({ ...modalEditarProd, plu: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <label className="super-form-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!modalEditarProd.pesavel}
                  onChange={e => setModalEditarProd({ ...modalEditarProd, pesavel: e.target.checked })}
                />
                <span>Pesável (Balança)</span>
              </label>

              <label className="super-form-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!modalEditarProd.controlaLote}
                  onChange={e => setModalEditarProd({ ...modalEditarProd, controlaLote: e.target.checked })}
                />
                <span>Controla Lote</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalEditarProd(null)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-primary">
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: PREÇO POR FILIAL/LOJA ═══════════════ */}
      {modalPrecoLoja && (
        <Modal
          title={`Preço da Filial — ${modalPrecoLoja.nome}`}
          onClose={() => setModalPrecoLoja(null)}
          width={480}
        >
          <form onSubmit={salvarPrecoLoja} className="p-4 space-y-4">
            <p className="text-xs text-gray-500">
              Configure um preço diferenciado para esta unidade/filial. Deixe em branco para usar o preço base da matriz ({fmtR(modalPrecoLoja.precoBase)}).
            </p>

            <div className="super-form-group">
              <label className="super-form-label">Preço de Venda nesta Filial (R$)</label>
              <input
                type="number"
                step="0.01"
                className="super-form-input font-bold"
                placeholder={`Padrão: ${fmtR(modalPrecoLoja.precoBase)}`}
                value={formPrecoLoja.precoUnidade}
                onChange={e => setFormPrecoLoja({ precoUnidade: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalPrecoLoja(null)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-primary">
                Salvar Preço da Filial
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: ENTRADA DE LOTE ═══════════════ */}
      {modalNovoLote && (
        <Modal
          title="Registrar Entrada de Lote (Controle FEFO)"
          onClose={() => setModalNovoLote(false)}
          width={520}
        >
          <form onSubmit={salvarNovoLote} className="p-4 space-y-4">
            <div className="super-form-group">
              <label className="super-form-label">Selecione o Produto *</label>
              <select
                required
                className="super-form-select"
                value={formLote.itemId}
                onChange={e => setFormLote({ ...formLote, itemId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.sku || p.id.slice(0, 6)})</option>
                ))}
              </select>
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Código do Lote *</label>
              <input
                type="text"
                required
                className="super-form-input font-mono"
                placeholder="Ex: LOT-2026-X1"
                value={formLote.lote}
                onChange={e => setFormLote({ ...formLote, lote: e.target.value })}
              />
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Data de Validade (Vencimento) *</label>
              <input
                type="date"
                required
                className="super-form-input font-bold"
                value={formLote.validade}
                onChange={e => setFormLote({ ...formLote, validade: e.target.value })}
              />
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Quantidade de Unidades no Lote *</label>
              <input
                type="number"
                step="0.001"
                required
                className="super-form-input font-bold"
                placeholder="Ex: 50"
                value={formLote.quantidade}
                onChange={e => setFormLote({ ...formLote, quantidade: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalNovoLote(false)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-primary">
                Registrar Lote
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: BAIXA DE LOTE ═══════════════ */}
      {modalBaixaLote && (
        <Modal
          title={`Baixa de Lote — ${modalBaixaLote.lote}`}
          onClose={() => setModalBaixaLote(null)}
          width={480}
        >
          <form onSubmit={confirmarBaixaLote} className="p-4 space-y-4">
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
              Atenção: A baixa de lote reduz permanentemente o estoque auditado e registra a justificativa nos relatórios de perdas.
            </p>

            <div className="super-form-group">
              <label className="super-form-label">Quantidade a Baixar (Disponível: {modalBaixaLote.quantidade})</label>
              <input
                type="number"
                step="0.001"
                required
                className="super-form-input font-bold"
                value={formBaixa.quantidade}
                onChange={e => setFormBaixa({ ...formBaixa, quantidade: e.target.value })}
              />
            </div>

            <div className="super-form-group">
              <label className="super-form-label">Motivo da Baixa</label>
              <select
                className="super-form-select"
                value={formBaixa.motivo}
                onChange={e => setFormBaixa({ ...formBaixa, motivo: e.target.value })}
              >
                <option value="Vencimento">Data de Validade Expirada (Vencido)</option>
                <option value="Avaria de Embalagem">Avaria de Embalagem / Quebra</option>
                <option value="Deterioracao">Deterioração Natural (Hortifrúti/Açougue)</option>
                <option value="Furto / Extravio">Extravio / Divergência de Inventário</option>
                <option value="Consumo Interno">Consumo Interno / Amostra</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalBaixaLote(null)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-danger">
                Confirmar Baixa
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: NOVA PROMOÇÃO ═══════════════ */}
      {modalNovaPromo && (
        <Modal
          title="Nova Campanha Promocional"
          onClose={() => setModalNovaPromo(false)}
          width={640}
        >
          <form onSubmit={salvarNovaPromocao} className="p-4 space-y-4">
            <div className="super-form-group">
              <label className="super-form-label">Nome da Promoção / Oferta *</label>
              <input
                type="text"
                required
                className="super-form-input"
                placeholder="Ex: Quarta do Hortifrúti — 20% OFF"
                value={formPromo.nome}
                onChange={e => setFormPromo({ ...formPromo, nome: e.target.value })}
              />
            </div>

            <div className="super-form-grid">
              <div className="super-form-group">
                <label className="super-form-label">Tipo de Promoção</label>
                <select
                  className="super-form-select"
                  value={formPromo.tipo}
                  onChange={e => setFormPromo({ ...formPromo, tipo: e.target.value })}
                >
                  <option value="percentual">Percentual (% de Desconto)</option>
                  <option value="valor">Desconto em Dinheiro (R$)</option>
                  <option value="preco_fixo">Preço Promocional Fixo (R$)</option>
                  <option value="leve_pague">Leve X Pague Y</option>
                </select>
              </div>

              {formPromo.tipo === 'percentual' && (
                <div className="super-form-group">
                  <label className="super-form-label">Percentual de Desconto (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="super-form-input font-bold"
                    placeholder="Ex: 15"
                    value={formPromo.percentual}
                    onChange={e => setFormPromo({ ...formPromo, percentual: e.target.value })}
                  />
                </div>
              )}

              {formPromo.tipo === 'valor' && (
                <div className="super-form-group">
                  <label className="super-form-label">Valor do Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="super-form-input font-bold"
                    placeholder="Ex: 5.00"
                    value={formPromo.valorDesconto}
                    onChange={e => setFormPromo({ ...formPromo, valorDesconto: e.target.value })}
                  />
                </div>
              )}

              {formPromo.tipo === 'preco_fixo' && (
                <div className="super-form-group">
                  <label className="super-form-label">Preço Promocional Final (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="super-form-input font-bold"
                    placeholder="Ex: 19.90"
                    value={formPromo.precoFixo}
                    onChange={e => setFormPromo({ ...formPromo, precoFixo: e.target.value })}
                  />
                </div>
              )}

              {formPromo.tipo === 'leve_pague' && (
                <div className="super-form-group flex gap-2">
                  <div>
                    <label className="super-form-label">Leve</label>
                    <input
                      type="number"
                      className="super-form-input font-bold"
                      placeholder="3"
                      value={formPromo.leve}
                      onChange={e => setFormPromo({ ...formPromo, leve: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="super-form-label">Pague</label>
                    <input
                      type="number"
                      className="super-form-input font-bold"
                      placeholder="2"
                      value={formPromo.pague}
                      onChange={e => setFormPromo({ ...formPromo, pague: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="super-form-group">
                <label className="super-form-label">Início da Vigência</label>
                <input
                  type="datetime-local"
                  className="super-form-input text-xs"
                  value={formPromo.inicio}
                  onChange={e => setFormPromo({ ...formPromo, inicio: e.target.value })}
                />
              </div>

              <div className="super-form-group">
                <label className="super-form-label">Fim da Vigência</label>
                <input
                  type="datetime-local"
                  className="super-form-input text-xs"
                  value={formPromo.fim}
                  onChange={e => setFormPromo({ ...formPromo, fim: e.target.value })}
                />
              </div>
            </div>

            {/* Seleção de Produtos da Promoção */}
            <div className="super-form-group">
              <label className="super-form-label">
                Produtos Participantes ({formPromo.itens.length} selecionados):
              </label>
              <div className="max-h-40 overflow-y-auto border p-2 rounded bg-gray-50 space-y-1">
                {produtos.map(p => {
                  const checked = formPromo.itens.includes(p.id)
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormPromo({ ...formPromo, itens: [...formPromo.itens, p.id] })
                          } else {
                            setFormPromo({ ...formPromo, itens: formPromo.itens.filter(x => x !== p.id) })
                          }
                        }}
                      />
                      <span className="font-semibold text-gray-800">{p.nome}</span>
                      <span className="text-gray-400">({p.departamento} • {fmtR(p.precoBase)})</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" className="super-btn super-btn-secondary" onClick={() => setModalNovaPromo(false)}>
                Cancelar
              </button>
              <button type="submit" className="super-btn super-btn-primary">
                Salvar & Ativar Oferta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════ MODAL: COMPROVANTE NFC-E ═══════════════ */}
      {modalNfce && (
        <Modal
          title={`Cupom Fiscal NFC-e #${modalNfce.numero || 'Venda'}`}
          onClose={() => setModalNfce(null)}
          width={500}
        >
          <div className="p-4 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <strong>NFC-e Autorizada pela SEFAZ com Sucesso!</strong>
                <div>Protocolo: {modalNfce.nfce_protocolo || modalNfce.nfceProtocolo || '15126000049281'}</div>
              </div>
            </div>

            <div className="border p-3 rounded-lg font-mono text-xs space-y-1.5 bg-gray-50">
              <div className="text-center font-bold border-b pb-2">
                <div>KYTTO SUPERMERCADO LTDA</div>
                <div className="text-gray-500 font-normal">CNPJ: 14.592.834/0001-90</div>
              </div>

              <div className="py-2 border-b space-y-1">
                {(modalNfce.itens || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{it.nome || it.produto_id} ({it.quantidade}x)</span>
                    <strong>{fmtR(it.preco_total || it.precoUnitario * it.quantidade)}</strong>
                  </div>
                ))}
              </div>

              <div className="pt-1 flex justify-between font-bold text-sm">
                <span>TOTAL PAGO:</span>
                <span className="text-emerald-700">{fmtR(modalNfce.total)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Forma: {modalNfce.forma_pagamento || modalNfce.formaPagamento}</span>
                {modalNfce.troco > 0 && <span>Troco: {fmtR(modalNfce.troco)}</span>}
              </div>

              <div className="pt-2 text-center text-xs text-gray-400 break-all border-t">
                Chave de Acesso:
                <div className="font-bold text-gray-700 mt-0.5">{modalNfce.nfce_chave || modalNfce.nfceChave}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="super-btn super-btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir Cupom Térmico
              </button>
              <button className="super-btn super-btn-primary" onClick={() => setModalNfce(null)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════ MODAL: CONSULTA DE CÓDIGO / BALANÇA ═══════════════ */}
      {modalConsulta && (
        <Modal
          title="Consulta Rápida de Código / Balança"
          onClose={() => {
            setModalConsulta(false)
            setConsultaResultado(null)
            setConsultaCodigoInput('')
          }}
          width={520}
        >
          <div className="p-4 space-y-4">
            <p className="text-xs text-gray-500">
              Digite ou bipe o código de barras (EAN-13), PLU da balança ou etiqueta pesável iniciada com 2 (ex: 200001000500).
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                className="super-form-input font-mono font-bold"
                placeholder="Ex: 7898000010015 ou 200001000500"
                value={consultaCodigoInput}
                onChange={e => setConsultaCodigoInput(e.target.value)}
              />
              <button className="super-btn super-btn-primary" onClick={testarConsultaCodigo}>
                Consultar
              </button>
            </div>

            {consultaResultado && (
              <div className="p-3 border rounded bg-gray-50 text-xs space-y-1.5">
                {consultaResultado.erro ? (
                  <span className="text-red-600 font-bold">{consultaResultado.erro}</span>
                ) : (
                  <>
                    <div className="font-bold text-gray-900 text-sm">{consultaResultado.produto?.nome}</div>
                    <div className="text-gray-600">Departamento: {consultaResultado.produto?.departamento}</div>
                    <div className="text-gray-600">Preço Base: {fmtR(consultaResultado.produto?.precoBase)}</div>
                    {consultaResultado.balanca?.pesavel && (
                      <div className="p-2 bg-blue-50 text-blue-800 rounded font-bold">
                        ⚖️ Etiqueta de Balança Decodificada: Peso {consultaResultado.balanca.quantidade} kg • Total: {fmtR(consultaResultado.balanca.precoTotal)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
