/**
 * web/src/pages/admin/LojaModa.jsx
 * Suíte Completa de Gestão para Loja de Moda, Calçados & Vestuário com IA Integrada — KYTTO Commerce
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import {
  Sparkles, Shirt, Scissors, ShoppingBag, Tag, CreditCard, Gift, Trophy,
  TrendingUp, Bot, Send, Copy, Check, Plus, Minus, RefreshCw, AlertTriangle,
  Layers, Search, FileText, Phone, ArrowRight, ChevronRight
} from 'lucide-react'
import './loja-moda.css'

const TABS = [
  { id: 'visao_geral', label: 'Visão Geral & KPIs', icon: TrendingUp },
  { id: 'catalogo', label: 'Catálogo & Lookbook', icon: Shirt },
  { id: 'grade', label: 'Matriz Grade (Cor × Tam)', icon: Layers },
  { id: 'ia_stylist', label: 'Fashion AI Stylist', icon: Sparkles, destaque: true },
  { id: 'condicional', label: 'Condicional (Malinha)', icon: ShoppingBag },
  { id: 'crediario', label: 'Crediário & Carnês', icon: CreditCard },
  { id: 'vales', label: 'Vales-Presente', icon: Gift },
  { id: 'comissoes', label: 'Comissões & Equipe', icon: Trophy },
  { id: 'ia_diagnostico', label: 'Diagnóstico IA de Giro', icon: Bot, destaque: true }
]

const PALETA_CORES = [
  { nome: 'Preto', hex: '#111111', contraste: '#ffffff' },
  { nome: 'Branco', hex: '#ffffff', contraste: '#111111' },
  { nome: 'Off-White', hex: '#f8f6f0', contraste: '#111111' },
  { nome: 'Azul Marinho', hex: '#0f172a', contraste: '#ffffff' },
  { nome: 'Azul Céu', hex: '#38bdf8', contraste: '#0f172a' },
  { nome: 'Areia / Bege', hex: '#d6c7b2', contraste: '#1f2937' },
  { nome: 'Terracota', hex: '#c2410c', contraste: '#ffffff' },
  { nome: 'Verde Militar', hex: '#3f6212', contraste: '#ffffff' },
  { nome: 'Verde Sage', hex: '#84a98c', contraste: '#111111' },
  { nome: 'Cinza Chumbo', hex: '#334155', contraste: '#ffffff' },
  { nome: 'Caramelo', hex: '#b45309', contraste: '#ffffff' },
  { nome: 'Bordô / Vinho', hex: '#831843', contraste: '#ffffff' }
]

const TAMANHOS_CONFIG = {
  adulto: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '3G'],
  calca_alfaiataria: ['36', '38', '40', '42', '44', '46', '48'],
  calcado: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
  infantil: ['2', '4', '6', '8', '10', '12', '14', '16']
}

const OCASIOES_MODA = [
  'Casual Chic', 'Alfaiataria Moderna', 'Trabalho / Reunião',
  'Casamento Diurno', 'Sunset Party', 'Jantar Romântico', 'Resort / Praia Fina'
]

export default function LojaModa() {
  const { toast } = useToast()
  const [tab, setTab] = useState('visao_geral')
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState(false)

  // Estados dos Dados
  const [resumo, setResumo] = useState({ kpis: {}, alertas: [] })
  const [produtos, setProdutos] = useState([])
  const [condicionais, setCondicionais] = useState([])
  const [crediarioClientes, setCrediarioClientes] = useState([])
  const [vales, setVales] = useState([])
  const [comissoes, setComissoes] = useState([])
  const [diagnosticoIA, setDiagnosticoIA] = useState(null)

  // Filtros de Catálogo
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroGenero, setFiltroGenero] = useState('todos')

  // Seletor de Produto na Matriz de Grade
  const [produtoGradeSelecionado, setProdutoGradeSelecionado] = useState(null)

  // Modais de Criação e IA
  const [modal, setModal] = useState(null) // 'nova-grade' | 'novo-crediario' | 'nova-condicional' | 'novo-vale' | 'look-ia' | 'copy-ia' | 'whats-ia'
  const [copiado, setCopiado] = useState(false)

  // Estados de IA
  const [lookGerado, setLookGerado] = useState(null)
  const [copyGerada, setCopyGerada] = useState(null)
  const [mensagemWhats, setMensagemWhats] = useState(null)
  const [carregandoIA, setCarregandoIA] = useState(false)
  const [ocasiaoLook, setOcasiaoLook] = useState('Casual Chic')
  const [pecaBaseLook, setPecaBaseLook] = useState('')

  // Formulário de Nova Grade
  const [formGrade, setFormGrade] = useState({
    produto_nome: '',
    referencia: '',
    categoria: 'Camisaria',
    genero: 'masculino',
    estilo: 'Casual Chic',
    tecido: '100% Linho Puro',
    preco_custo: '',
    preco_venda: '',
    tipo_grade: 'adulto',
    cores: ['Branco', 'Azul Marinho'],
    tamanhos: ['P', 'M', 'G', 'GG'],
    estoque_inicial_por_celula: 4,
    imagem_url: ''
  })

  // Formulário de Crediário
  const [formCrediario, setFormCrediario] = useState({
    cliente_nome: '',
    cliente_cpf: '',
    cliente_telefone: '',
    valor_total: '',
    entrada: '',
    num_parcelas: 3,
    dia_vencimento: 10,
    limite_credito: 2000
  })

  // Formulário de Condicional (Malinha)
  const [formCondicional, setFormCondicional] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    vendedor_nome: '',
    prazo_devolucao_dias: 3,
    observacoes: '',
    itens: []
  })

  // Formulário de Vale-Presente
  const [formVale, setFormVale] = useState({
    valor: 200,
    comprador_nome: '',
    destinatario_nome: ''
  })

  // Carregar dados principais
  const carregarDados = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setAtualizando(true)
    try {
      const [resResumo, resProd, resCred, resCond, resVales, resCom, resDiag] = await Promise.all([
        api.get('/api/v1/loja-moda/resumo').catch(() => ({ kpis: {}, alertas: [] })),
        api.get('/api/v1/loja-moda/produtos').catch(() => ({ produtos: [] })),
        api.get('/api/v1/loja-moda/crediario').catch(() => ({ clientes: [] })),
        api.get('/api/v1/loja-moda/condicionais').catch(() => ({ condicionais: [] })),
        api.get('/api/v1/loja-moda/vales').catch(() => ({ vales: [] })),
        api.get('/api/v1/loja-moda/comissoes').catch(() => ({ comissoes: [] })),
        api.post('/api/v1/loja-moda/ai/diagnostico-grade', {}).catch(() => ({ diagnostico: null }))
      ])

      setResumo(resResumo)
      setProdutos(resProd.produtos || [])
      setCrediarioClientes(resCred.clientes || [])
      setCondicionais(resCond.condicionais || [])
      setVales(resVales.vales || [])
      setComissoes(resCom.comissoes || [])
      setDiagnosticoIA(resDiag.diagnostico || null)

      if (resProd.produtos && resProd.produtos.length > 0 && !produtoGradeSelecionado) {
        setProdutoGradeSelecionado(resProd.produtos[0])
      }
    } catch (e) {
      toast(e.message || 'Erro ao carregar Loja de Moda', 'error')
    } finally {
      setLoading(false)
      setAtualizando(false)
    }
  }, [produtoGradeSelecionado, toast])

  useEffect(() => {
    carregarDados()
  }, [])

  // Sincronizar produto selecionado quando a lista de produtos é atualizada
  useEffect(() => {
    if (produtoGradeSelecionado && produtos.length > 0) {
      const atualizado = produtos.find(p => p.id === produtoGradeSelecionado.id)
      if (atualizado) setProdutoGradeSelecionado(atualizado)
    }
  }, [produtos])

  // Produtos filtrados na vitrine
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = !filtroBusca ||
        p.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        (p.referencia && p.referencia.toLowerCase().includes(filtroBusca.toLowerCase())) ||
        (p.tecido && p.tecido.toLowerCase().includes(filtroBusca.toLowerCase()))
      const matchCat = filtroCategoria === 'todas' || p.categoria.toLowerCase() === filtroCategoria.toLowerCase()
      const matchGen = filtroGenero === 'todos' || p.genero === filtroGenero
      return matchBusca && matchCat && matchGen
    })
  }, [produtos, filtroBusca, filtroCategoria, filtroGenero])

  // ==========================================================================
  // OPERAÇÕES DE GRADE
  // ==========================================================================
  async function salvarNovaGrade(e) {
    e.preventDefault()
    if (!formGrade.produto_nome || formGrade.cores.length === 0 || formGrade.tamanhos.length === 0) {
      return toast('Preencha o nome do produto e selecione pelo menos 1 cor e 1 tamanho', 'error')
    }
    try {
      const res = await api.post('/api/v1/loja-moda/grade', formGrade)
      toast(`Grade criada com sucesso! ${res.produto?.variantes?.length || 0} variantes geradas.`, 'success')
      setModal(null)
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao criar grade', 'error')
    }
  }

  async function ajustarEstoqueVariante(varianteId, delta) {
    try {
      await api.patch(`/api/v1/loja-moda/grades/${varianteId}/estoque`, {
        quantidade: Math.abs(delta),
        operacao: delta > 0 ? 'adicionar' : 'remover'
      })
      toast('Estoque atualizado!', 'success')
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao ajustar estoque', 'error')
    }
  }

  // ==========================================================================
  // OPERAÇÕES DE CONDICIONAL (MALINHA VIP)
  // ==========================================================================
  async function finalizarMalinha(id, acao) {
    try {
      await api.post(`/api/v1/loja-moda/condicionais/${id}/finalizar`, { acao })
      toast(acao === 'converter_venda' ? 'Peças faturadas e convertidas em venda!' : 'Devolução registrada no estoque!', 'success')
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao finalizar condicional', 'error')
    }
  }

  async function salvarNovaMalinha(e) {
    e.preventDefault()
    if (!formCondicional.cliente_nome) return toast('Informe o nome da cliente', 'error')
    try {
      await api.post('/api/v1/loja-moda/condicionais', formCondicional)
      toast('Malinha condicional registrada!', 'success')
      setModal(null)
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao registrar malinha', 'error')
    }
  }

  // ==========================================================================
  // OPERAÇÕES DE CREDIÁRIO
  // ==========================================================================
  async function receberParcela(clienteId) {
    try {
      await api.post(`/api/v1/loja-moda/crediario/${clienteId}/pagar`, {})
      toast('Parcela do crediário recebida e baixada com sucesso!', 'success')
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao receber parcela', 'error')
    }
  }

  async function salvarNovoCrediario(e) {
    e.preventDefault()
    if (!formCrediario.cliente_nome || !formCrediario.valor_total) {
      return toast('Informe o cliente e o valor da compra', 'error')
    }
    try {
      await api.post('/api/v1/loja-moda/crediario', formCrediario)
      toast('Crediário aberto e carnê gerado!', 'success')
      setModal(null)
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao cadastrar crediário', 'error')
    }
  }

  // ==========================================================================
  // OPERAÇÕES DE VALE-PRESENTE
  // ==========================================================================
  async function salvarNovoVale(e) {
    e.preventDefault()
    if (!formVale.valor) return toast('Informe o valor do vale-presente', 'error')
    try {
      const res = await api.post('/api/v1/loja-moda/vales', formVale)
      toast(`Vale ${res.vale?.codigo} emitido com sucesso!`, 'success')
      setModal(null)
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao emitir vale', 'error')
    }
  }

  async function utilizarVale(id) {
    try {
      await api.post(`/api/v1/loja-moda/vales/${id}/utilizar`, {})
      toast('Vale-presente baixado no caixa!', 'success')
      carregarDados(true)
    } catch (err) {
      toast(err.message || 'Erro ao utilizar vale', 'error')
    }
  }

  // ==========================================================================
  // RECURSOS DE INTELIGÊNCIA ARTIFICIAL (FASHION AI SUITE)
  // ==========================================================================
  async function acionarLookIA(pecaId, ocasiao = ocasiaoLook) {
    setCarregandoIA(true)
    try {
      const res = await api.post('/api/v1/loja-moda/ai/look', { pecaId, ocasiao })
      setLookGerado(res.look)
      setModal('look-ia')
    } catch (err) {
      toast(err.message || 'Erro ao gerar look com IA', 'error')
    } finally {
      setCarregandoIA(false)
    }
  }

  async function acionarCopyIA(produtoId) {
    setCarregandoIA(true)
    try {
      const res = await api.post('/api/v1/loja-moda/ai/copy', { produtoId })
      setCopyGerada(res.copy)
      setModal('copy-ia')
    } catch (err) {
      toast(err.message || 'Erro ao gerar copy de moda com IA', 'error')
    } finally {
      setCarregandoIA(false)
    }
  }

  async function acionarWhatsIA(tipo, clienteNome, dados = {}) {
    setCarregandoIA(true)
    try {
      const res = await api.post('/api/v1/loja-moda/ai/whatsapp', { tipo, clienteNome, dados })
      setMensagemWhats({ ...res.mensagem, clienteNome, telefone: dados.telefone })
      setModal('whats-ia')
    } catch (err) {
      toast(err.message || 'Erro ao gerar mensagem de WhatsApp', 'error')
    } finally {
      setCarregandoIA(false)
    }
  }

  function copiarParaTransferencia(texto) {
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    toast('Texto copiado com sucesso!', 'success')
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="moda-container">
      {/* Header com Identidade Visual de Moda & IA */}
      <div className="moda-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>👗</span>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
              Loja de Moda & Vestuário
            </h1>
            <span style={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px',
              borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1
            }}>
              Fashion Suite Pro
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--muted, #94a3b8)', fontSize: 14 }}>
            Matriz de Grade Cor × Tamanho, Malinha Condicional VIP, Crediário Próprio e Inteligência Artificial Stylist
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn-ai-sparkle"
            onClick={() => {
              if (produtos.length > 0) acionarLookIA(produtos[0].id)
              else toast('Cadastre produtos para utilizar o Fashion AI', 'error')
            }}
          >
            <Sparkles size={16} /> Stylist IA (Montar Look)
          </button>
          <button
            className="btn-primary"
            style={{ background: '#f43f5e', border: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setModal('nova-grade')}
          >
            <Plus size={16} /> Nova Grade (Produto)
          </button>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--line, rgba(255,255,255,0.1))', background: 'var(--card, #1e293b)', color: 'var(--fg, #e2e8f0)', cursor: 'pointer' }}
            onClick={() => carregarDados(true)}
            title="Recarregar dados"
          >
            <RefreshCw size={15} className={atualizando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Barra de KPIs Executivos */}
      <div className="moda-kpi-grid">
        <div className="moda-kpi-card">
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Peças em Grade</span>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
            {resumo.kpis?.estoquePecas || 0} <span style={{ fontSize: 14, fontWeight: 400 }}>un</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Distribuídas em {resumo.kpis?.totalProdutos || 0} produtos</span>
        </div>

        <div className="moda-kpi-card">
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Valor Estoque (Venda)</span>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
            {fmtR(resumo.kpis?.valorEstoqueVenda || 0)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Potencial bruto de liquidação</span>
        </div>

        <div className="moda-kpi-card">
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Malinhas em Trânsito</span>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
            {resumo.kpis?.malinhasEmAberto || 0} <span style={{ fontSize: 14, fontWeight: 400 }}>({fmtR(resumo.kpis?.valorEmMalinhas || 0)})</span>
          </div>
          <span style={{ fontSize: 11, color: '#f59e0b' }}>Provador externo na casa do cliente</span>
        </div>

        <div className="moda-kpi-card">
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Crediário em Aberto</span>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f43f5e' }}>
            {fmtR(resumo.kpis?.saldoDevedorCrediario || 0)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {resumo.kpis?.inadimplentesCount > 0 ? `⚠️ ${resumo.kpis.inadimplentesCount} em atraso` : '✓ 100% em dia'}
          </span>
        </div>

        <div className="moda-kpi-card">
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Giro Médio de Grade</span>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#a855f7' }}>
            {resumo.kpis?.giroMedioGrade || '4.2x'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ticket Médio: {fmtR(resumo.kpis?.ticketMedio || 385.50)}</span>
        </div>
      </div>

      {/* Alertas Inteligentes da IA */}
      {resumo.alertas && resumo.alertas.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          {resumo.alertas.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#f59e0b' }}>
              <AlertTriangle size={15} />
              <span><strong>Atenção Operacional:</strong> {a.texto}</span>
            </div>
          ))}
        </div>
      )}

      {/* Navegação por Abas Especializadas */}
      <div className="moda-tabs-bar">
        {TABS.map(t => {
          const Icon = t.icon
          const ativa = tab === t.id
          return (
            <button
              key={t.id}
              className={`moda-tab-btn ${ativa ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={16} />
              {t.label}
              {t.destaque && (
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontWeight: 800
                }}>
                  IA
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Conteúdo das Abas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px', display: 'block' }} />
          Carregando acervo de moda e inteligência artificial...
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* ABA 1: VISÃO GERAL */}
          {/* ================================================================= */}
          {tab === 'visao_geral' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Lookbook em Destaque */}
                <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shirt size={20} color="#f43f5e" /> Peças em Destaque na Coleção
                    </h3>
                    <button
                      className="btn-link"
                      style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                      onClick={() => setTab('catalogo')}
                    >
                      Ver Catálogo Completo →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {produtos.slice(0, 3).map(p => (
                      <div key={p.id} style={{ background: 'var(--card2, #0f172a)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                        <img src={p.imagem_url} alt={p.nome} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                        <div style={{ padding: 12 }}>
                          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{p.categoria}</span>
                          <div style={{ fontWeight: 700, fontSize: 14, margin: '2px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.nome}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#10b981' }}>{fmtR(p.preco_venda)}</span>
                            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10 }}>
                              {p.estoque_total} un
                            </span>
                          </div>
                          <button
                            className="btn-ai-sparkle"
                            style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
                            onClick={() => acionarLookIA(p.id)}
                          >
                            <Sparkles size={13} /> Look com IA
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Malinhas Condicionais Urgentes */}
                <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShoppingBag size={20} color="#f59e0b" /> Malinhas Condicionais em Trânsito
                    </h3>
                    <button
                      className="btn-link"
                      style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                      onClick={() => setTab('condicional')}
                    >
                      Gerenciar Todas →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {condicionais.filter(c => c.status === 'em_aberto').map(c => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'var(--card2, #0f172a)',
                          borderRadius: 10,
                          border: c.dias_restantes < 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--line, rgba(255,255,255,0.05))'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.cliente_nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {c.total_pecas} peças · {fmtR(c.valor_total)} · Consultora: {c.vendedor_nome}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`badge-condicional ${c.dias_restantes < 0 ? 'atrasado' : 'em_aberto'}`}>
                            {c.dias_restantes < 0 ? `⚠️ ${Math.abs(c.dias_restantes)}d atrasado` : `⏱️ ${c.dias_restantes}d restantes`}
                          </span>
                          <button
                            style={{
                              background: '#25D366', color: '#fff', border: 'none', padding: '6px 12px',
                              borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                            }}
                            onClick={() => acionarWhatsIA('lembrete_malinha', c.cliente_nome, { telefone: c.cliente_telefone })}
                          >
                            <Phone size={13} /> WhatsApp IA
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coluna Lateral: Resumo de Curva ABC e Atendimento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Recomendações Estratégicas da IA */}
                <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Bot size={22} color="#a855f7" />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Insights do Copilot de Moda</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(diagnosticoIA?.recomendacoesEstrategicasIA || []).map((rec, i) => (
                      <div key={i} style={{ fontSize: 13, lineHeight: 1.5, background: 'rgba(168, 85, 247, 0.08)', padding: 10, borderRadius: 8, borderLeft: '3px solid #a855f7' }}>
                        {rec}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-ai-sparkle"
                    style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                    onClick={() => setTab('ia_diagnostico')}
                  >
                    Ver Diagnóstico Completo de Giro →
                  </button>
                </div>

                {/* Resumo Rápido de Crediário */}
                <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={18} color="#f43f5e" /> Crediário Próprio
                  </h3>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                    {crediarioClientes.length} clientes com limite ativo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {crediarioClientes.slice(0, 2).map(cli => (
                      <div key={cli.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line, rgba(255,255,255,0.05))' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{cli.cliente_nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Saldo: {fmtR(cli.saldo_devedor)}</div>
                        </div>
                        <button
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => receberParcela(cli.id)}
                        >
                          Receber
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 2: CATÁLOGO & LOOKBOOK */}
          {/* ================================================================= */}
          {tab === 'catalogo' && (
            <div>
              {/* Barra de Filtros */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nome, referência (LMR-101) ou tecido..."
                    value={filtroBusca}
                    onChange={e => setFiltroBusca(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10,
                      background: 'var(--card, #1e293b)', border: '1px solid var(--line, rgba(255,255,255,0.1))',
                      color: 'var(--fg, #e2e8f0)', fontSize: 14
                    }}
                  />
                </div>

                <select
                  value={filtroCategoria}
                  onChange={e => setFiltroCategoria(e.target.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, background: 'var(--card, #1e293b)',
                    border: '1px solid var(--line, rgba(255,255,255,0.1))', color: 'var(--fg, #e2e8f0)', fontSize: 13
                  }}
                >
                  <option value="todas">Todas as Categorias</option>
                  <option value="Camisaria">Camisaria</option>
                  <option value="Calças">Calças & Bermudas</option>
                  <option value="Casacos & Blazers">Casacos & Blazers</option>
                  <option value="Vestidos">Vestidos</option>
                  <option value="Básicos & T-Shirts">Básicos & T-Shirts</option>
                  <option value="Calçados">Calçados Nobres</option>
                </select>

                <select
                  value={filtroGenero}
                  onChange={e => setFiltroGenero(e.target.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, background: 'var(--card, #1e293b)',
                    border: '1px solid var(--line, rgba(255,255,255,0.1))', color: 'var(--fg, #e2e8f0)', fontSize: 13
                  }}
                >
                  <option value="todos">Todos os Gêneros</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="unissex">Unissex</option>
                </select>
              </div>

              {/* Grid de Cards de Alta Moda */}
              <div className="moda-grid-catalogo">
                {produtosFiltrados.map(prod => (
                  <div key={prod.id} className="moda-product-card">
                    <div style={{ position: 'relative' }}>
                      <img src={prod.imagem_url} alt={prod.nome} />
                      <span style={{
                        position: 'absolute', top: 12, left: 12, background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 700,
                        padding: '4px 8px', borderRadius: 6
                      }}>
                        {prod.referencia}
                      </span>
                      <span style={{
                        position: 'absolute', top: 12, right: 12, background: 'rgba(244, 63, 94, 0.9)',
                        color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20
                      }}>
                        {prod.colecao}
                      </span>
                    </div>

                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#f43f5e', fontWeight: 700, textTransform: 'uppercase' }}>
                          {prod.categoria} · {prod.estilo}
                        </div>
                        <h4 style={{ margin: '4px 0 6px', fontSize: 16, fontWeight: 700 }}>{prod.nome}</h4>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Tag size={13} /> {prod.tecido}
                        </div>
                      </div>

                      {/* Swatches de Cores Reais */}
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Cores disponíveis:</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(prod.cores || []).map(corNome => {
                            const corConfig = PALETA_CORES.find(c => c.nome.toLowerCase() === corNome.toLowerCase()) || { hex: '#475569' }
                            return (
                              <span key={corNome} className="swatch-pill" title={corNome}>
                                <span className="swatch-circulo" style={{ background: corConfig.hex }} />
                                {corNome}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Tamanhos da Grade */}
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Grade:</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(prod.tamanhos || []).map(tam => (
                            <span key={tam} style={{
                              padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)',
                              fontSize: 11, fontWeight: 700
                            }}>
                              {tam}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Preço e Estoque */}
                      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Preço Venda</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmtR(prod.preco_venda)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total Grade</div>
                          <span style={{
                            padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                            background: prod.estoque_total > 5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: prod.estoque_total > 5 ? '#10b981' : '#f87171'
                          }}>
                            {prod.estoque_total} un
                          </span>
                        </div>
                      </div>

                      {/* Ações Inteligentes de IA e Grade */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                        <button
                          className="btn-ai-sparkle"
                          style={{ justifyContent: 'center' }}
                          onClick={() => acionarLookIA(prod.id)}
                        >
                          <Sparkles size={13} /> Look IA
                        </button>
                        <button
                          style={{
                            background: 'rgba(255,255,255,0.08)', color: 'var(--fg)', border: 'none',
                            padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                          onClick={() => acionarCopyIA(prod.id)}
                        >
                          <FileText size={13} /> Copy IA
                        </button>
                      </div>

                      <button
                        style={{
                          width: '100%', background: 'transparent', border: '1px solid var(--line, rgba(255,255,255,0.15))',
                          color: 'var(--fg)', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                        onClick={() => {
                          setProdutoGradeSelecionado(prod)
                          setTab('grade')
                        }}
                      >
                        📐 Ver Matriz de Grade Completa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 3: MATRIZ DE GRADE (COR × TAMANHO) */}
          {/* ================================================================= */}
          {tab === 'grade' && (
            <div>
              {/* Seletor de Peça */}
              <div style={{
                background: 'var(--card, #1e293b)', borderRadius: 16, padding: 20,
                border: '1px solid var(--line, rgba(255,255,255,0.08))', marginBottom: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14
              }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Selecione o Produto para Visualizar a Grade:
                  </label>
                  <select
                    value={produtoGradeSelecionado?.id || ''}
                    onChange={e => {
                      const p = produtos.find(item => item.id === e.target.value)
                      if (p) setProdutoGradeSelecionado(p)
                    }}
                    style={{
                      padding: '10px 14px', borderRadius: 8, background: 'var(--card2, #0f172a)',
                      color: 'var(--fg, #e2e8f0)', border: '1px solid var(--line, rgba(255,255,255,0.15))',
                      fontSize: 14, minWidth: 320, fontWeight: 600
                    }}
                  >
                    {produtos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.referencia} — {p.nome} ({p.estoque_total} un em grade)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ background: '#f43f5e', border: 'none', padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => setModal('nova-grade')}
                  >
                    + Adicionar Novo Produto à Grade
                  </button>
                </div>
              </div>

              {/* Tabela Matriz Bidimensional */}
              {produtoGradeSelecionado && (
                <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                        {produtoGradeSelecionado.nome} — Matriz de Cores & Tamanhos
                      </h3>
                      <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                        Referência: {produtoGradeSelecionado.referencia} · Preço: {fmtR(produtoGradeSelecionado.preco_venda)} · Tecido: {produtoGradeSelecionado.tecido}
                      </p>
                    </div>
                    <span style={{ background: '#10b98122', color: '#10b981', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                      Estoque Consolidado: {produtoGradeSelecionado.estoque_total} peças
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="matriz-grade-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', minWidth: 160 }}>Cor / Tamanho</th>
                          {(produtoGradeSelecionado.tamanhos || []).map(tam => (
                            <th key={tam} style={{ minWidth: 100 }}>{tam}</th>
                          ))}
                          <th style={{ minWidth: 110 }}>Total Cor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(produtoGradeSelecionado.cores || []).map(corNome => {
                          const corConfig = PALETA_CORES.find(c => c.nome.toLowerCase() === corNome.toLowerCase()) || { hex: '#475569' }
                          let totalDaCor = 0

                          return (
                            <tr key={corNome}>
                              <td style={{ textAlign: 'left', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="swatch-circulo" style={{ background: corConfig.hex }} />
                                {corNome}
                              </td>

                              {(produtoGradeSelecionado.tamanhos || []).map(tam => {
                                const v = (produtoGradeSelecionado.variantes || []).find(item => item.cor === corNome && item.tamanho === tam)
                                const qtd = v ? v.estoque : 0
                                totalDaCor += qtd
                                const nivel = qtd <= 1 ? 'baixo' : 'otimo'

                                return (
                                  <td key={tam}>
                                    {v ? (
                                      <div className={`celula-estoque ${nivel}`}>
                                        <button
                                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
                                          onClick={() => ajustarEstoqueVariante(v.id, -1)}
                                          title="Diminuir estoque"
                                        >
                                          <Minus size={12} />
                                        </button>
                                        <span style={{ fontWeight: 800, fontSize: 13, minWidth: 20, textAlign: 'center' }}>
                                          {qtd}
                                        </span>
                                        <button
                                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
                                          onClick={() => ajustarEstoqueVariante(v.id, 1)}
                                          title="Adicionar estoque"
                                        >
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                                    )}
                                  </td>
                                )
                              })}

                              <td style={{ fontWeight: 800, color: '#38bdf8' }}>
                                {totalDaCor} un
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Detalhes de SKUs e Códigos de Barras */}
                  <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
                      Etiquetas, SKUs e Códigos de Barras EAN-13 gerados para esta grade:
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                      {(produtoGradeSelecionado.variantes || []).slice(0, 6).map(v => (
                        <div key={v.id} style={{ background: 'var(--card2, #0f172a)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 700 }}>{v.cor} — Tam {v.tamanho}</div>
                          <div style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>SKU: {v.sku}</div>
                          <div style={{ color: '#10b981', fontSize: 11 }}>EAN: {v.ean}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 4: FASHION AI STYLIST (LOOK BUILDER) */}
          {/* ================================================================= */}
          {tab === 'ia_stylist' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
              {/* Painel de Configuração do Look */}
              <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Sparkles size={22} color="#ec4899" />
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Simulador Fashion AI</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      Escolha a Peça Principal:
                    </label>
                    <select
                      value={pecaBaseLook || produtos[0]?.id || ''}
                      onChange={e => setPecaBaseLook(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        background: 'var(--card2, #0f172a)', color: 'var(--fg)',
                        border: '1px solid var(--line, rgba(255,255,255,0.15))', fontSize: 13
                      }}
                    >
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({fmtR(p.preco_venda)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      Ocasião de Uso:
                    </label>
                    <select
                      value={ocasiaoLook}
                      onChange={e => setOcasiaoLook(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        background: 'var(--card2, #0f172a)', color: 'var(--fg)',
                        border: '1px solid var(--line, rgba(255,255,255,0.15))', fontSize: 13
                      }}
                    >
                      {OCASIOES_MODA.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <button
                    className="btn-ai-sparkle"
                    style={{ justifyContent: 'center', padding: '12px', marginTop: 10 }}
                    disabled={carregandoIA}
                    onClick={() => acionarLookIA(pecaBaseLook || produtos[0]?.id, ocasiaoLook)}
                  >
                    <Sparkles size={16} /> {carregandoIA ? 'A IA está estilizando...' : 'Gerar Look Completo & Argumentos'}
                  </button>
                </div>
              </div>

              {/* Resultado do Look Gerado */}
              <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                {lookGerado ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#ec4899', fontWeight: 800, textTransform: 'uppercase' }}>
                          Look Coordenado por IA · {lookGerado.ocasiao}
                        </span>
                        <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>{lookGerado.nomeLook}</h3>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Valor do Combo:</span>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{fmtR(lookGerado.valorTotalLook)}</div>
                      </div>
                    </div>

                    {/* Grid das Peças do Look */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                      <div style={{ background: 'var(--card2, #0f172a)', borderRadius: 10, padding: 12, border: '2px solid #ec4899' }}>
                        <span style={{ fontSize: 10, background: '#ec4899', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          PEÇA PRINCIPAL
                        </span>
                        <h5 style={{ margin: '6px 0 4px', fontSize: 13, fontWeight: 700 }}>{lookGerado.pecaPrincipal?.nome}</h5>
                        <div style={{ fontWeight: 800, color: '#10b981', fontSize: 13 }}>{fmtR(lookGerado.pecaPrincipal?.preco)}</div>
                      </div>

                      {(lookGerado.pecasComplementares || []).map((c, i) => (
                        <div key={i} style={{ background: 'var(--card2, #0f172a)', borderRadius: 10, padding: 12, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            {c.papelNoLook}
                          </span>
                          <h5 style={{ margin: '6px 0 4px', fontSize: 13, fontWeight: 700 }}>{c.nome}</h5>
                          <div style={{ fontWeight: 800, color: '#10b981', fontSize: 13 }}>{fmtR(c.preco)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Dica de Styling da IA */}
                    <div style={{ background: 'rgba(168, 85, 247, 0.08)', borderRadius: 12, padding: 16, borderLeft: '4px solid #a855f7', marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#c084fc', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} /> Dica de Styling da Consultoria IA:
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--fg)' }}>
                        {lookGerado.dicaStylingIA}
                      </p>
                    </div>

                    {/* Argumento de Venda no Balcão */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: 12, padding: 16, borderLeft: '4px solid #10b981' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        💬 Argumento Pronto para a Equipe de Vendas:
                      </div>
                      <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--fg)' }}>
                        {lookGerado.argumentoVendaBalcao}
                      </p>
                      <button
                        style={{ marginTop: 10, background: 'none', border: '1px solid #10b981', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => copiarParaTransferencia(lookGerado.argumentoVendaBalcao)}
                      >
                        {copiado ? '✓ Copiado!' : 'Copiar Argumento'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                    <Sparkles size={40} color="#ec4899" style={{ margin: '0 auto 16px', display: 'block' }} />
                    <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>Nenhum Look Gerado Ainda</h4>
                    <p style={{ margin: 0, fontSize: 13 }}>
                      Selecione uma peça e clique em "Gerar Look Completo" para ver a IA criar combinações perfeitas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 5: CONDICIONAL (MALINHA VIP) */}
          {/* ================================================================= */}
          {tab === 'condicional' && (
            <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShoppingBag size={20} color="#f59e0b" /> Gestão de Malinhas Condicionais
                  </h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                    Controle de peças em prova na residência da cliente com contagem regressiva e conversão rápida
                  </p>
                </div>
                <button
                  className="btn-primary"
                  style={{ background: '#f59e0b', border: 'none', padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setModal('nova-condicional')}
                >
                  + Nova Malinha Condicional
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--card2, #0f172a)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }}>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Cliente VIP</th>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Consultora</th>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Data Saída</th>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Prazo & Dias</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Valor Total</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {condicionais.map(c => {
                      const vencido = c.dias_restantes < 0
                      return (
                        <tr key={c.id} style={{ borderTop: '1px solid var(--line, rgba(255,255,255,0.05))', background: vencido ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700 }}>{c.cliente_nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</div>
                          </td>
                          <td style={{ padding: '14px 18px' }}>{c.vendedor_nome}</td>
                          <td style={{ padding: '14px 18px', color: 'var(--muted)' }}>{fmtDate(c.data_saida)}</td>
                          <td style={{ padding: '14px 18px' }}>
                            <div>{fmtDate(c.data_devolucao_prevista)}</div>
                            <span className={`badge-condicional ${vencido ? 'atrasado' : c.status === 'em_aberto' ? 'em_aberto' : 'convertido'}`}>
                              {c.status !== 'em_aberto' ? 'Finalizado' : vencido ? `⚠️ ${Math.abs(c.dias_restantes)}d atrasado` : `⏱️ ${c.dias_restantes}d restantes`}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                            {fmtR(c.valor_total)}
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{c.total_pecas} peças</div>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: c.status === 'convertido_venda' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'devolvido' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: c.status === 'convertido_venda' ? '#10b981' : c.status === 'devolvido' ? '#94a3b8' : '#f59e0b'
                            }}>
                              {c.status === 'convertido_venda' ? 'Convertido em Venda' : c.status === 'devolvido' ? 'Devolvido' : 'Em Prova'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            {c.status === 'em_aberto' ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  onClick={() => finalizarMalinha(c.id, 'converter_venda')}
                                  title="Converter todas as peças em venda faturada"
                                >
                                  Converter Venda
                                </button>
                                <button
                                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line, rgba(255,255,255,0.15))', background: 'transparent', color: 'var(--fg)', fontSize: 11, cursor: 'pointer' }}
                                  onClick={() => finalizarMalinha(c.id, 'devolver')}
                                  title="Retornar peças ao estoque da loja"
                                >
                                  Devolver
                                </button>
                                <button
                                  style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#25D366', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                                  onClick={() => acionarWhatsIA('lembrete_malinha', c.cliente_nome, { telefone: c.cliente_telefone })}
                                  title="Disparar mensagem cordial via WhatsApp IA"
                                >
                                  <Phone size={13} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Concluído</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 6: CREDIÁRIO PRÓPRIO & CARNÊS */}
          {/* ================================================================= */}
          {tab === 'crediario' && (
            <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={20} color="#f43f5e" /> Carteira de Crediário Próprio
                  </h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                    Parcelamento de compras sem maquininha, emissão de carnês digitais e régua de cobrança
                  </p>
                </div>
                <button
                  className="btn-primary"
                  style={{ background: '#f43f5e', border: 'none', padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setModal('novo-crediario')}
                >
                  + Novo Crediário
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--card2, #0f172a)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }}>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Cliente</th>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Score Risco</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Total Venda</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Valor Pago</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Saldo Devedor</th>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Próx. Vencimento</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crediarioClientes.map(cli => {
                      const atrasado = (cli.dias_atraso || 0) > 0
                      return (
                        <tr key={cli.id} style={{ borderTop: '1px solid var(--line, rgba(255,255,255,0.05))', background: atrasado ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700 }}>{cli.cliente_nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>CPF: {cli.cliente_cpf || 'Não inf.'} · {cli.cliente_telefone}</div>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: atrasado ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                              color: atrasado ? '#ef4444' : '#10b981'
                            }}>
                              {cli.score_risco || 'A'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>{fmtR(cli.valor_total)}</td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmtR(cli.valor_pago)}</td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: cli.saldo_devedor > 0 ? '#f43f5e' : '#10b981' }}>
                            {fmtR(cli.saldo_devedor)}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <div>{cli.proximo_vencimento ? fmtDate(cli.proximo_vencimento) : 'Quitado'}</div>
                            {atrasado && (
                              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                                ({cli.dias_atraso}d em atraso)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            {cli.saldo_devedor > 0 ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  onClick={() => receberParcela(cli.id)}
                                >
                                  Receber Parcela
                                </button>
                                <button
                                  style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#25D366', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                                  onClick={() => acionarWhatsIA('cobranca_delicada', cli.cliente_nome, { valor: cli.saldo_devedor, telefone: cli.cliente_telefone })}
                                  title="Enviar lembrete amigável no WhatsApp"
                                >
                                  <Phone size={13} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>Quitado ✓</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 7: VALES-PRESENTE */}
          {/* ================================================================= */}
          {tab === 'vales' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎁 Vales-Presente (Gift Cards)</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Emissão e baixa de créditos para presentear</p>
                </div>
                <button
                  className="btn-primary"
                  style={{ background: '#a855f7', border: 'none', padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setModal('novo-vale')}
                >
                  + Emitir Novo Vale
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {vales.map(v => (
                  <div key={v.id} style={{ background: 'var(--card, #1e293b)', borderRadius: 14, padding: 20, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <Gift size={28} color="#a855f7" />
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: v.status === 'ativo' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: v.status === 'ativo' ? '#10b981' : '#94a3b8'
                      }}>
                        {v.status === 'ativo' ? 'Saldo Ativo' : 'Utilizado'}
                      </span>
                    </div>

                    <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: '#f8fafc' }}>
                      {v.codigo}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', margin: '8px 0' }}>
                      {fmtR(v.valor)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                      Presenteado(a): <strong>{v.destinatario_nome}</strong>
                    </div>

                    {v.status === 'ativo' ? (
                      <button
                        style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                        onClick={() => utilizarVale(v.id)}
                      >
                        Baixar no Caixa / Resgatar
                      </button>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Resgatado ✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 8: COMISSÕES & EQUIPE */}
          {/* ================================================================= */}
          {tab === 'comissoes' && (
            <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={20} color="#eab308" /> Metas & Comissões dos Consultores de Estilo
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  Ranking de vendas e comissionamento progressivo (4% a 7% por superação de metas)
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--card2, #0f172a)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }}>
                      <th style={{ padding: '12px 18px', textAlign: 'left' }}>Consultor(a)</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Total Vendas</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Meta Mensal</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Atingimento</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>% Comissão</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Comissão a Pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comissoes.map((c, idx) => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--line, rgba(255,255,255,0.05))' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                          {c.vendedor_nome}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800 }}>{fmtR(c.total_vendas)}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--muted)' }}>{fmtR(c.meta_mes)}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800,
                            background: c.atingimento_pct >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: c.atingimento_pct >= 100 ? '#10b981' : '#eab308'
                          }}>
                            {c.atingimento_pct}%
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700 }}>{c.percentual_comissao}%</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: 15 }}>
                          {fmtR(c.valor_comissao)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA 9: DIAGNÓSTICO IA DE GIRO & CURVA ABC */}
          {/* ================================================================= */}
          {tab === 'ia_diagnostico' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Card de Curva ABC de Tamanhos */}
              <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={20} color="#10b981" /> Curva ABC de Saída por Tamanho
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(diagnosticoIA?.tamanhosMaisVendidos || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card2, #0f172a)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#10b981' : '#38bdf8',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontWeight: 700 }}>Tamanho {t.tamanho}</span>
                      </div>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>{t.percentualSaida} das vendas</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Furos de Grade & Ações de Remarcação */}
              <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, padding: 24, border: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={20} color="#f43f5e" /> Furos de Grade & Alertas Críticos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(diagnosticoIA?.furosDeGrade || []).map((f, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{f.produto}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Variante: <strong>{f.variante}</strong> · Estoque: {f.estoqueAtual} un · {f.gravidade}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NOVA GRADE DE PRODUTO */}
      {/* ===================================================================== */}
      {modal === 'nova-grade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--line, rgba(255,255,255,0.1))', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>+ Criar Novo Produto com Matriz Grade</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }} onClick={() => setModal(null)}>✕</button>
            </div>

            <form onSubmit={salvarNovaGrade} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome da Peça / Produto:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Camisa Linho Riviera Manga Longa"
                  value={formGrade.produto_nome}
                  onChange={e => setFormGrade({ ...formGrade, produto_nome: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Referência:</label>
                  <input
                    type="text"
                    placeholder="Ex: LMR-101"
                    value={formGrade.referencia}
                    onChange={e => setFormGrade({ ...formGrade, referencia: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Categoria:</label>
                  <select
                    value={formGrade.categoria}
                    onChange={e => setFormGrade({ ...formGrade, categoria: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  >
                    <option value="Camisaria">Camisaria</option>
                    <option value="Calças">Calças</option>
                    <option value="Casacos & Blazers">Casacos & Blazers</option>
                    <option value="Vestidos">Vestidos</option>
                    <option value="Básicos & T-Shirts">Básicos & T-Shirts</option>
                    <option value="Calçados">Calçados</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Preço de Custo (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="120.00"
                    value={formGrade.preco_custo}
                    onChange={e => setFormGrade({ ...formGrade, preco_custo: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Preço de Venda (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="299.90"
                    value={formGrade.preco_venda}
                    onChange={e => setFormGrade({ ...formGrade, preco_venda: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
              </div>

              {/* Seletor de Cores da Grade */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Selecione as Cores da Grade:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PALETA_CORES.map(c => {
                    const sel = formGrade.cores.includes(c.nome)
                    return (
                      <button
                        type="button"
                        key={c.nome}
                        onClick={() => {
                          const nov = sel ? formGrade.cores.filter(x => x !== c.nome) : [...formGrade.cores, c.nome]
                          setFormGrade({ ...formGrade, cores: nov })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                          background: sel ? '#f43f5e' : 'var(--card2, #0f172a)', color: sel ? '#fff' : 'var(--fg)',
                          border: sel ? '1px solid #f43f5e' : '1px solid var(--line)', fontSize: 11, cursor: 'pointer'
                        }}
                      >
                        <span className="swatch-circulo" style={{ background: c.hex }} />
                        {c.nome}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Seletor de Tamanhos */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Tamanhos da Grade:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TAMANHOS_CONFIG[formGrade.tipo_grade || 'adulto'].map(t => {
                    const sel = formGrade.tamanhos.includes(t)
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => {
                          const nov = sel ? formGrade.tamanhos.filter(x => x !== t) : [...formGrade.tamanhos, t]
                          setFormGrade({ ...formGrade, tamanhos: nov })
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: 8, background: sel ? '#f43f5e' : 'var(--card2, #0f172a)',
                          color: sel ? '#fff' : 'var(--fg)', border: '1px solid var(--line)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, fontSize: 13, color: '#38bdf8' }}>
                Total estimado: <strong>{formGrade.cores.length * formGrade.tamanhos.length} variantes</strong> de Cor × Tamanho serão criadas com controle de estoque e SKUs exclusivos.
              </div>

              <button
                type="submit"
                style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#f43f5e', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Salvar Produto & Gerar Matriz Grade
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NOVA MALINHA CONDICIONAL */}
      {/* ===================================================================== */}
      {modal === 'nova-condicional' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 500, border: '1px solid var(--line)', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>🛍️ Registrar Malinha Condicional VIP</h3>
            <form onSubmit={salvarNovaMalinha} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome da Cliente:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Camila Siqueira"
                  value={formCondicional.cliente_nome}
                  onChange={e => setFormCondicional({ ...formCondicional, cliente_nome: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="(14) 99888-7766"
                    value={formCondicional.cliente_telefone}
                    onChange={e => setFormCondicional({ ...formCondicional, cliente_telefone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Consultora:</label>
                  <input
                    type="text"
                    placeholder="Ex: Letícia"
                    value={formCondicional.vendedor_nome}
                    onChange={e => setFormCondicional({ ...formCondicional, vendedor_nome: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Prazo de Devolução (Dias):</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={formCondicional.prazo_devolucao_dias}
                  onChange={e => setFormCondicional({ ...formCondicional, prazo_devolucao_dias: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Registrar Malinha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NOVO CREDIÁRIO */}
      {/* ===================================================================== */}
      {modal === 'novo-crediario' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 500, border: '1px solid var(--line)', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>💳 Abrir Crediário Próprio & Gerar Carnê</h3>
            <form onSubmit={salvarNovoCrediario} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome do Cliente:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Juliana Mendes"
                  value={formCrediario.cliente_nome}
                  onChange={e => setFormCrediario({ ...formCrediario, cliente_nome: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>CPF:</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={formCrediario.cliente_cpf}
                    onChange={e => setFormCrediario({ ...formCrediario, cliente_cpf: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Telefone / WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="(14) 99745-8899"
                    value={formCrediario.cliente_telefone}
                    onChange={e => setFormCrediario({ ...formCrediario, cliente_telefone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Valor Total da Venda:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="900.00"
                    value={formCrediario.valor_total}
                    onChange={e => setFormCrediario({ ...formCrediario, valor_total: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Entrada (Opcional):</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="300.00"
                    value={formCrediario.entrada}
                    onChange={e => setFormCrediario({ ...formCrediario, entrada: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Número de Parcelas:</label>
                  <select
                    value={formCrediario.num_parcelas}
                    onChange={e => setFormCrediario({ ...formCrediario, num_parcelas: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Dia de Vencimento:</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formCrediario.dia_vencimento}
                    onChange={e => setFormCrediario({ ...formCrediario, dia_vencimento: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#f43f5e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Criar Crediário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EMITIR VALE-PRESENTE */}
      {/* ===================================================================== */}
      {modal === 'novo-vale' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 440, border: '1px solid var(--line)', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>🎁 Emitir Vale-Presente (Gift Card)</h3>
            <form onSubmit={salvarNovoVale} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Valor do Vale (R$):</label>
                <input
                  type="number"
                  step="10"
                  required
                  placeholder="200.00"
                  value={formVale.valor}
                  onChange={e => setFormVale({ ...formVale, valor: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)', fontSize: 16, fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome do Comprador:</label>
                <input
                  type="text"
                  placeholder="Ex: Lucas Albuquerque"
                  value={formVale.comprador_nome}
                  onChange={e => setFormVale({ ...formVale, comprador_nome: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome da Pessoa Presenteada:</label>
                <input
                  type="text"
                  placeholder="Ex: Marina Salles"
                  value={formVale.destinatario_nome}
                  onChange={e => setFormVale({ ...formVale, destinatario_nome: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Emitir Vale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: COPYWRITER IA (DESCRIÇÃO & INSTAGRAM) */}
      {/* ===================================================================== */}
      {modal === 'copy-ia' && copyGerada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--line)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} color="#ec4899" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Fashion Copywriter IA</h3>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }} onClick={() => setModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Título de E-commerce & Vitrine:</label>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{copyGerada.tituloEcom}</div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Descrição Curta de Caimento:</label>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{copyGerada.descricaoCurta}</div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Detalhes Técnicos & Cuidados:</label>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' }}>
                  {(copyGerada.detalhesTecnicos || []).map((dt, i) => <li key={i}>{dt}</li>)}
                </ul>
              </div>

              <div style={{ background: 'var(--card2)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ec4899' }}>📸 Post Pronto para Instagram:</span>
                  <button
                    style={{ background: 'none', border: 'none', color: '#ec4899', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => copiarParaTransferencia(copyGerada.postInstagram)}
                  >
                    <Copy size={13} /> Copiar Post
                  </button>
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>
                  {copyGerada.postInstagram}
                </pre>
              </div>

              <div style={{ background: 'rgba(37, 211, 102, 0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(37, 211, 102, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>💬 Abordagem VIP de Vendedora (WhatsApp):</span>
                  <button
                    style={{ background: 'none', border: 'none', color: '#25D366', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => copiarParaTransferencia(copyGerada.mensagemVendedoraWhatsApp)}
                  >
                    <Copy size={13} /> Copiar
                  </button>
                </div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--fg)', lineHeight: 1.5 }}>
                  "{copyGerada.mensagemVendedoraWhatsApp}"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: MENSAGEM WHATSAPP IA */}
      {/* ===================================================================== */}
      {modal === 'whats-ia' && mensagemWhats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--card, #1e293b)', borderRadius: 16, width: '100%', maxWidth: 500, border: '1px solid var(--line)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={20} color="#25D366" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Mensagem VIP para {mensagemWhats.clienteNome}</h3>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }} onClick={() => setModal(null)}>✕</button>
            </div>

            <div style={{ background: 'rgba(37, 211, 102, 0.08)', borderRadius: 12, padding: 16, border: '1px solid rgba(37, 211, 102, 0.25)', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>
                {mensagemWhats.texto}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => copiarParaTransferencia(mensagemWhats.texto)}
              >
                <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar Texto'}
              </button>
              <a
                href={`https://wa.me/55${String(mensagemWhats.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent(mensagemWhats.texto)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#25D366',
                  color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, textDecoration: 'none', fontSize: 13
                }}
              >
                <Send size={14} /> Abrir no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
