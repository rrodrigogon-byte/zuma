import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '../../../lib/api'
import {
  RotateCcw,
  Download,
  Search,
  MessageSquare,
  Calendar,
  Eye,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  X,
  Filter,
  CheckSquare,
  Square,
  Calculator,
  Tag,
  Flame,
  ArrowRight,
  Send,
} from 'lucide-react'
import './DinoRecuperacaoAvecPanel.css'

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

const clientRecupCache = new Map()

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const GATILHOS_CRM = [
  {
    id: 'desconto_15',
    rotulo: '🏷️ 15% OFF de Boas-Vindas',
    texto: '\n\n🎁 Preparamos um presente especial: 15% DE DESCONTO no seu retorno válido para este mês!',
  },
  {
    id: 'essencial_45',
    rotulo: '✂️ Modelo Essencial (R$ 45)',
    texto: '\n\n💈 Temos novidade! Lançamos o Modelo Essencial com corte ágil e impecável por apenas R$ 45 com nossa equipe!',
  },
  {
    id: 'cortesia_barba',
    rotulo: '💆 Barboterapia / Hidratação Free',
    texto: '\n\n✨ Ao agendar seu corte, você ganha uma Hidratação ou Barboterapia completa como cortesia da casa!',
  },
  {
    id: 'chopp_cortesia',
    rotulo: '🍻 Chopp Artesanal Gelado',
    texto: '\n\n🍺 Sua cerveja ou chopp artesanal de cortesia já está no ponto esperando por você!',
  },
  {
    id: 'condicao_club',
    rotulo: '🦁 Condição Especial Club',
    texto: '\n\n🔄 Para os membros históricos do nosso Club, preparamos uma taxa especial de reativação sem carência!',
  },
]

export default function DinoRecuperacaoAvecPanel({ onAbrirAgenda }) {
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState({
    itens: [],
    total: 0,
    pagina: 1,
    paginas: 1,
    limite: 25,
    resumo: {
      totalAnalisados: 0,
      totalNoFiltro: 0,
      faturamentoPotencialRecuperavel: 0,
      porModelo: { essencial: 0, premium: 0, club: 0 },
      porFaixa: { atencao_30_60: 0, alerta_60_90: 0, churn_90_180: 0, perdido_180_mais: 0 },
      porProfissional: {},
    },
  })

  // Filtros
  const [busca, setBusca] = useState('')
  const debouncedBusca = useDebounced(busca, 250)
  const [deAtivo, setDeAtivo] = useState('')
  const [ateAtivo, setAteAtivo] = useState('')
  const [deAusente, setDeAusente] = useState('')
  const [ateAusente, setAteAusente] = useState('')
  const [diasSemVir, setDiasSemVir] = useState('ausentes') // padrão: ausentes há mais de 30 dias
  const [profissional, setProfissional] = useState('todos')
  const [modelo, setModelo] = useState('todos')
  const [ordem, setOrdem] = useState('diasSemVir')
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(25)

  // Seleção múltipla para ações em massa
  const [selecionados, setSelecionados] = useState(new Set())

  // Simulador de ROI
  const [mostrarRoi, setMostrarRoi] = useState(true)
  const [taxaConversao, setTaxaConversao] = useState(10)

  // Cenário de reajuste ativo?
  const isCenarioReajuste =
    deAtivo === '2026-01-01' &&
    ateAtivo === '2026-08-31' &&
    deAusente === '2026-09-01' &&
    ateAusente === '2026-10-31'

  // Modal de histórico detalhado
  const [modalCliente, setModalCliente] = useState(null)
  const [modalCampanhaCRM, setModalCampanhaCRM] = useState(false)
  const [escopoEnvio, setEscopoEnvio] = useState('filtrados')
  const [tipoMensagem, setTipoMensagem] = useState('personalizada_modelo')
  const [msgCampanha, setMsgCampanha] = useState(
    'Oi {Nome}! Notei que faz um tempinho que você não vem aqui na Barbearia Dino. Para celebrar sua volta, preparei um horário especial com o {Profissional}. Posso agendar para essa semana?\n\n👉 {Link Agendamento}'
  )
  const [resgatandoCRM, setResgatandoCRM] = useState(false)
  const [campanhaDisparada, setCampanhaDisparada] = useState(null)
  const [testeTelefone, setTesteTelefone] = useState('')
  const [testandoEnvio, setTestandoEnvio] = useState(false)
  const [testeFeedback, setTesteFeedback] = useState(null)

  const [historicoModal, setHistoricoModal] = useState([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [copiadoKey, setCopiadoKey] = useState(null)
  const [copiadoTelefones, setCopiadoTelefones] = useState(false)

  // Carregar dados da API
  const carregar = useCallback(
    async (force = false) => {
      const params = new URLSearchParams()
      if (debouncedBusca) params.set('busca', debouncedBusca)
      if (deAtivo) params.set('deAtivo', deAtivo)
      if (ateAtivo) params.set('ateAtivo', ateAtivo)
      if (deAusente) params.set('deAusente', deAusente)
      if (ateAusente) params.set('ateAusente', ateAusente)
      if (diasSemVir && diasSemVir !== 'todos') params.set('diasSemVir', diasSemVir)
      if (profissional && profissional !== 'todos') params.set('profissional', profissional)
      if (modelo && modelo !== 'todos') params.set('modelo', modelo)
      if (ordem) params.set('ordem', ordem)
      params.set('pagina', String(pagina))
      params.set('limite', String(limite))
      if (force) params.set('refresh', '1')

      const cacheKey = params.toString()
      if (!force && clientRecupCache.has(cacheKey)) {
        setDados(clientRecupCache.get(cacheKey))
        setLoading(false)
      } else {
        setLoading(true)
      }

      try {
        const res = await api.get(`/api/admin/barbearia/recuperacao-clientes?${params.toString()}`)
        if (res.ok) {
          clientRecupCache.set(cacheKey, res)
          setDados(res)
        }
      } catch (err) {
        console.error('Erro ao buscar clientes para recuperação:', err)
      } finally {
        setLoading(false)
      }
    },
    [debouncedBusca, deAtivo, ateAtivo, deAusente, ateAusente, diasSemVir, profissional, modelo, ordem, pagina, limite]
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  // Ativar ou desativar cenário do reajuste
  function toggleCenarioReajuste() {
    if (isCenarioReajuste) {
      setDeAtivo('')
      setAteAtivo('')
      setDeAusente('')
      setAteAusente('')
      setDiasSemVir('ausentes')
      setPagina(1)
    } else {
      setDeAtivo('2026-01-01')
      setAteAtivo('2026-08-31')
      setDeAusente('2026-09-01')
      setAteAusente('2026-10-31')
      setDiasSemVir('todos')
      setPagina(1)
    }
  }

  // Exportar CSV formatado
  async function baixarCsv() {
    try {
      const params = new URLSearchParams()
      if (debouncedBusca) params.set('busca', debouncedBusca)
      if (deAtivo) params.set('deAtivo', deAtivo)
      if (ateAtivo) params.set('ateAtivo', ateAtivo)
      if (deAusente) params.set('deAusente', deAusente)
      if (ateAusente) params.set('ateAusente', ateAusente)
      if (diasSemVir && diasSemVir !== 'todos') params.set('diasSemVir', diasSemVir)
      if (profissional && profissional !== 'todos') params.set('profissional', profissional)
      if (modelo && modelo !== 'todos') params.set('modelo', modelo)
      if (ordem) params.set('ordem', ordem)
      params.set('format', 'csv')

      const url = `/api/admin/barbearia/recuperacao-clientes/exportar-csv?${params.toString()}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}`,
          'X-Empresa-Id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        },
      })
      if (!res.ok) throw new Error('Falha ao exportar')

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `recuperacao-clientes-dino-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      alert('Erro ao exportar CSV: ' + err.message)
    }
  }

  // Gerenciamento de seleção
  const toggleSelecionarTodosPagina = () => {
    const todosItensKeys = (dados.itens || []).map((c) => c.key)
    const todosSelecionados = todosItensKeys.every((k) => selecionados.has(k))

    setSelecionados((prev) => {
      const proximo = new Set(prev)
      if (todosSelecionados) {
        todosItensKeys.forEach((k) => proximo.delete(k))
      } else {
        todosItensKeys.forEach((k) => proximo.add(k))
      }
      return proximo
    })
  }

  const toggleCliente = (key) => {
    setSelecionados((prev) => {
      const proximo = new Set(prev)
      if (proximo.has(key)) proximo.delete(key)
      else proximo.add(key)
      return proximo
    })
  }

  const copiarTelefonesSelecionados = () => {
    const tels = (dados.itens || [])
      .filter((c) => selecionados.has(c.key))
      .map((c) => c.telefone)
      .filter(Boolean)
    if (tels.length === 0) return
    navigator.clipboard.writeText(tels.join(', '))
    setCopiadoTelefones(true)
    setTimeout(() => setCopiadoTelefones(false), 2500)
  }

  // Disparar campanha CRM
  async function dispararCampanha() {
    try {
      setResgatandoCRM(true)
      const payload = {
        mensagem: msgCampanha,
        usarMensagemPersonalizadaPorModelo: tipoMensagem === 'personalizada_modelo',
        escopo: escopoEnvio,
      }

      if (escopoEnvio === 'selecionados') {
        payload.clientesIds = Array.from(selecionados)
      } else if (escopoEnvio === 'filtrados') {
        payload.filtros = {
          busca: debouncedBusca,
          deAtivo,
          ateAtivo,
          deAusente,
          ateAusente,
          diasSemVir,
          profissional,
          modelo,
          ordem,
        }
      } else {
        payload.clientes = dados.itens
        payload.clientesIds = dados.itens.map((c) => c.key)
      }

      const res = await api.post('/api/admin/barbearia/recuperacao-clientes/disparar', payload)
      if (res?.ok) {
        setCampanhaDisparada(res.campanha)
      } else {
        alert(res?.error || 'Erro ao iniciar campanha.')
      }
    } catch (err) {
      alert('Erro ao disparar campanha: ' + (err.message || 'Falha de comunicação'))
    } finally {
      setResgatandoCRM(false)
    }
  }

  async function enviarTesteWhatsApp() {
    const limpo = String(testeTelefone || '').replace(/\D/g, '')
    if (!limpo || limpo.length < 10) {
      alert('Informe um número de WhatsApp com DDD válido (ex: 65999998888).')
      return
    }
    try {
      setTestandoEnvio(true)
      setTesteFeedback(null)
      const res = await api.post('/api/admin/barbearia/recuperacao-clientes/disparar', {
        testeApenas: true,
        testeTelefone: limpo,
        mensagem: msgCampanha,
      })
      if (res?.ok) {
        setTesteFeedback({ tipo: 'sucesso', texto: `Mensagem de teste enviada com sucesso para ${res.destinatario}!` })
      } else {
        setTesteFeedback({ tipo: 'erro', texto: res?.error || 'Erro no envio de teste.' })
      }
    } catch (err) {
      setTesteFeedback({ tipo: 'erro', texto: err.message || 'Erro ao enviar teste.' })
    } finally {
      setTestandoEnvio(false)
    }
  }

  async function abrirHistorico(cliente) {
    setModalCliente(cliente)
    setLoadingHistorico(true)
    setHistoricoModal([])
    try {
      const res = await api.get(`/api/admin/barbearia/recuperacao-clientes/${encodeURIComponent(cliente.key)}/historico`)
      if (res.ok) {
        setHistoricoModal(res.historico || [])
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setLoadingHistorico(false)
    }
  }

  function copiarMensagem(cliente) {
    if (!cliente?.mensagemWhatsapp) return
    navigator.clipboard.writeText(cliente.mensagemWhatsapp)
    setCopiadoKey(cliente.key)
    setTimeout(() => setCopiadoKey(null), 2500)
  }

  const linkWa = (cliente) => {
    const d = String(cliente.telefone || '').replace(/\D/g, '')
    if (!d) return '#'
    const phone = d.startsWith('55') ? d : `55${d}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(cliente.mensagemWhatsapp || '')}`
  }

  const listaProfissionais = useMemo(() => {
    const profs = Object.keys(dados.resumo?.porProfissional || {})
    return profs.filter((p) => p && p !== 'Não informado').sort()
  }, [dados.resumo])

  // Métricas do Simulador de ROI
  const roiCalculado = useMemo(() => {
    const totalAlvos = dados.resumo?.totalNoFiltro || 0
    const potencialTotal = dados.resumo?.faturamentoPotencialRecuperavel || 0
    const ticketMedioBase = totalAlvos > 0 ? potencialTotal / totalAlvos : 80
    const clientesRecuperados = Math.round((totalAlvos * taxaConversao) / 100)
    const receitaMensal = Math.round(clientesRecuperados * ticketMedioBase)
    const ltvAnual = Math.round(receitaMensal * 12)
    return {
      clientesRecuperados,
      receitaMensal,
      ltvAnual,
      ticketMedioBase,
    }
  }, [dados.resumo, taxaConversao])

  // Totais das faixas de churn para a barra interativa
  const faixas = dados.resumo?.porFaixa || {}
  const totalFaixas =
    (faixas.atencao_30_60 || 0) +
    (faixas.alerta_60_90 || 0) +
    (faixas.churn_90_180 || 0) +
    (faixas.perdido_180_mais || 0) || 1

  const pctAtencao = (((faixas.atencao_30_60 || 0) / totalFaixas) * 100).toFixed(1)
  const pctAlerta = (((faixas.alerta_60_90 || 0) / totalFaixas) * 100).toFixed(1)
  const pctChurn = (((faixas.churn_90_180 || 0) / totalFaixas) * 100).toFixed(1)
  const pctCritico = (((faixas.perdido_180_mais || 0) / totalFaixas) * 100).toFixed(1)

  return (
    <div className="dino-recup-container">
      {/* CABEÇALHO */}
      <div className="dino-recup-header">
        <div className="dino-recup-title-area">
          <h2>
            <Sparkles size={24} color="#3b82f6" />
            Recuperação Estratégica & Histórico Avec
          </h2>
          <p>
            Análise consolidada de mais de 22.400 atendimentos do Avec e do novo ERP. Identifique clientes que deixaram de
            vir após os reajustes de preços e execute ações direcionadas para reativação nos modelos <strong>Essencial</strong> (mais acessível) ou <strong>Premium</strong> (VIP).
          </p>
        </div>

        <div className="dino-recup-header-actions">
          <button
            type="button"
            className="dino-recup-btn ghost"
            onClick={() => carregar(true)}
            disabled={loading}
            title="Recarregar dados atualizados"
          >
            <RotateCcw size={16} />
            Atualizar
          </button>
          <button
            type="button"
            className="dino-recup-btn primary"
            onClick={baixarCsv}
            disabled={!dados.itens?.length}
            title="Exportar planilha formatada para Excel com mensagens prontas"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO KPI */}
      <div className="dino-recup-kpis">
        <div className="dino-recup-kpi-card">
          <span className="dino-recup-kpi-label">
            <UserCheck size={14} />
            Clientes para Recuperar
          </span>
          <span className="dino-recup-kpi-value">{dados.resumo?.totalNoFiltro?.toLocaleString('pt-BR') || 0}</span>
          <span className="dino-recup-kpi-sub">de {dados.resumo?.totalAnalisados?.toLocaleString('pt-BR') || 0} clientes analisados</span>
        </div>

        <div className="dino-recup-kpi-card">
          <span className="dino-recup-kpi-label">
            <TrendingUp size={14} color="#10b981" />
            Potencial Recuperável
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#10b981' }}>
            {moeda(dados.resumo?.faturamentoPotencialRecuperavel)}
          </span>
          <span className="dino-recup-kpi-sub">estimativa de receita mensal</span>
        </div>

        <div
          className="dino-recup-kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setModelo(modelo === 'essencial' ? 'todos' : 'essencial')
            setPagina(1)
          }}
          title="Clique para filtrar apenas perfil Essencial"
        >
          <span className="dino-recup-kpi-label">
            🏷️ Perfil Modelo Essencial {modelo === 'essencial' && '✓'}
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#34d399' }}>
            {dados.resumo?.porModelo?.essencial?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">foco em corte acessível com nova equipe</span>
        </div>

        <div
          className="dino-recup-kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setModelo(modelo === 'premium' ? 'todos' : 'premium')
            setPagina(1)
          }}
          title="Clique para filtrar apenas perfil Premium"
        >
          <span className="dino-recup-kpi-label">
            ⭐ Perfil Modelo Premium {modelo === 'premium' && '✓'}
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#c084fc' }}>
            {dados.resumo?.porModelo?.premium?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">ticket alto, extras ou cliente do Dino</span>
        </div>

        <div
          className="dino-recup-kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setModelo(modelo === 'club' ? 'todos' : 'club')
            setPagina(1)
          }}
          title="Clique para filtrar apenas assinantes do Club"
        >
          <span className="dino-recup-kpi-label">
            🔄 Assinantes Club / Pacote {modelo === 'club' && '✓'}
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#fbbf24' }}>
            {dados.resumo?.porModelo?.club?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">clientes frequentes do clube para reativar</span>
        </div>
      </div>

      {/* BARRA VISUAL DE DISTRIBUIÇÃO DE CHURN (INTERATIVA) */}
      <div className="dino-recup-churn-section">
        <div className="dino-recup-churn-header">
          <div className="dino-recup-churn-title">
            <Flame size={16} color="#f59e0b" />
            Distribuição da Base por Tempo de Ausência (Clique nas faixas para filtrar)
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Total no escopo: <strong>{totalFaixas.toLocaleString('pt-BR')} clientes</strong>
          </span>
        </div>

        <div className="dino-recup-churn-bar">
          <div
            className="dino-recup-churn-segment atencao"
            style={{ width: `${Math.max(Number(pctAtencao), 4)}%` }}
            title={`Atenção (30-60d): ${faixas.atencao_30_60 || 0} clientes (${pctAtencao}%)`}
            onClick={() => {
              setDiasSemVir('30_60')
              setPagina(1)
            }}
          >
            {Number(pctAtencao) > 7 && `${pctAtencao}%`}
          </div>

          <div
            className="dino-recup-churn-segment alerta"
            style={{ width: `${Math.max(Number(pctAlerta), 4)}%` }}
            title={`Alerta (60-90d): ${faixas.alerta_60_90 || 0} clientes (${pctAlerta}%)`}
            onClick={() => {
              setDiasSemVir('60_90')
              setPagina(1)
            }}
          >
            {Number(pctAlerta) > 7 && `${pctAlerta}%`}
          </div>

          <div
            className="dino-recup-churn-segment churn"
            style={{ width: `${Math.max(Number(pctChurn), 4)}%` }}
            title={`Churn (90-180d): ${faixas.churn_90_180 || 0} clientes (${pctChurn}%)`}
            onClick={() => {
              setDiasSemVir('90_180')
              setPagina(1)
            }}
          >
            {Number(pctChurn) > 7 && `${pctChurn}%`}
          </div>

          <div
            className="dino-recup-churn-segment critico"
            style={{ width: `${Math.max(Number(pctCritico), 4)}%` }}
            title={`Crítico (+180d): ${faixas.perdido_180_mais || 0} clientes (${pctCritico}%)`}
            onClick={() => {
              setDiasSemVir('180_mais')
              setPagina(1)
            }}
          >
            {Number(pctCritico) > 7 && `${pctCritico}%`}
          </div>
        </div>

        <div className="dino-recup-churn-legend">
          <div
            className="dino-recup-churn-legend-item"
            onClick={() => {
              setDiasSemVir('30_60')
              setPagina(1)
            }}
          >
            <div className="dino-recup-churn-dot" style={{ background: '#f59e0b' }} />
            <span>
              Atenção (30 a 60d): <strong>{faixas.atencao_30_60 || 0}</strong> ({pctAtencao}%)
            </span>
          </div>

          <div
            className="dino-recup-churn-legend-item"
            onClick={() => {
              setDiasSemVir('60_90')
              setPagina(1)
            }}
          >
            <div className="dino-recup-churn-dot" style={{ background: '#f97316' }} />
            <span>
              Alerta (60 a 90d): <strong>{faixas.alerta_60_90 || 0}</strong> ({pctAlerta}%)
            </span>
          </div>

          <div
            className="dino-recup-churn-legend-item"
            onClick={() => {
              setDiasSemVir('90_180')
              setPagina(1)
            }}
          >
            <div className="dino-recup-churn-dot" style={{ background: '#ef4444' }} />
            <span>
              Churn (90 a 180d): <strong>{faixas.churn_90_180 || 0}</strong> ({pctChurn}%)
            </span>
          </div>

          <div
            className="dino-recup-churn-legend-item"
            onClick={() => {
              setDiasSemVir('180_mais')
              setPagina(1)
            }}
          >
            <div className="dino-recup-churn-dot" style={{ background: '#64748b' }} />
            <span>
              Crítico (+180d): <strong>{faixas.perdido_180_mais || 0}</strong> ({pctCritico}%)
            </span>
          </div>

          {diasSemVir !== 'todos' && diasSemVir !== 'ausentes' && (
            <button
              type="button"
              className="dino-recup-var-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setDiasSemVir('ausentes')
                setPagina(1)
              }}
            >
              Limpar filtro de faixa (Ver todos os ausentes)
            </button>
          )}
        </div>
      </div>

      {/* CALCULADORA / SIMULADOR DE ROI DA CAMPANHA */}
      <div className="dino-recup-roi-card">
        <div className="dino-recup-roi-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={18} color="#10b981" />
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--fg)' }}>
                Simulador de Retorno Financeiro & Metas de Resgate
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Estime o faturamento mensal e anual recuperado conforme a taxa de conversão da campanha
              </div>
            </div>
          </div>

          <div className="dino-recup-roi-pills">
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginRight: 4 }}>Taxa de Retorno:</span>
            {[5, 10, 15, 20, 25].map((t) => (
              <button
                key={t}
                type="button"
                className={`dino-recup-roi-pill${taxaConversao === t ? ' active' : ''}`}
                onClick={() => setTaxaConversao(t)}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>

        <div className="dino-recup-roi-metrics">
          <div className="dino-recup-roi-metric-item">
            <span>Clientes Reativados</span>
            <strong style={{ color: '#3b82f6' }}>{roiCalculado.clientesRecuperados} clientes</strong>
          </div>
          <div className="dino-recup-roi-metric-item">
            <span>Receita Mensal Recuperada</span>
            <strong style={{ color: '#10b981' }}>{moeda(roiCalculado.receitaMensal)}/mês</strong>
          </div>
          <div className="dino-recup-roi-metric-item">
            <span>LTV Projetado (12 Meses)</span>
            <strong style={{ color: '#c084fc' }}>{moeda(roiCalculado.ltvAnual)}/ano</strong>
          </div>
          <div className="dino-recup-roi-metric-item">
            <span>Ticket Médio da Base</span>
            <strong style={{ color: '#fbbf24' }}>{moeda(roiCalculado.ticketMedioBase)}</strong>
          </div>
        </div>
      </div>

      {/* BANNER DE CENÁRIO DO REAJUSTE DE PREÇOS */}
      <div className="dino-recup-cohort-box" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="dino-recup-cohort-info">
            <span className="dino-recup-cohort-icon">⚡</span>
            <div className="dino-recup-cohort-text">
              <strong>Cenário Estratégico: Abandono Pós-Reajuste de Preços</strong>
              <p>
                Filtra automaticamente quem frequentava a barbearia entre <strong>Janeiro e Agosto/2026</strong>, mas <strong>NÃO retornou em Setembro e Outubro/2026</strong>.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`dino-recup-cohort-btn${isCenarioReajuste ? ' active' : ''}`}
              onClick={toggleCenarioReajuste}
            >
              {isCenarioReajuste ? '✓ Cenário Aplicado (Limpar)' : 'Aplicar Cenário do Reajuste (766 Clientes)'}
            </button>

            <button
              type="button"
              className="dino-recup-cohort-btn"
              style={{ background: '#059669', color: '#fff', borderColor: '#059669', cursor: 'pointer' }}
              onClick={() => {
                setCampanhaDisparada(null)
                setTesteFeedback(null)
                setEscopoEnvio(selecionados.size > 0 ? 'selecionados' : 'filtrados')
                setModalCampanhaCRM(true)
              }}
            >
              <Sparkles size={14} style={{ marginRight: 4 }} />
              {selecionados.size > 0
                ? `Disparar para Selecionados (${selecionados.size})`
                : `Disparar Campanha CRM (${dados.total ? `${dados.total} clientes` : `${dados.itens.length}`})`}
            </button>
          </div>
        </div>

        {/* Filtros customizados de período de presença e ausência */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            padding: '12px 16px',
            background: 'var(--card2)',
            borderRadius: 8,
            border: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Frequentou entre:</span>
            <input
              type="date"
              value={deAtivo}
              onChange={(e) => {
                setDeAtivo(e.target.value)
                setPagina(1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--fg)',
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>e</span>
            <input
              type="date"
              value={ateAtivo}
              onChange={(e) => {
                setAteAtivo(e.target.value)
                setPagina(1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--fg)',
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ width: '1px', background: 'var(--line)', minHeight: 24, margin: '0 8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Ausente entre:</span>
            <input
              type="date"
              value={deAusente}
              onChange={(e) => {
                setDeAusente(e.target.value)
                setPagina(1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--fg)',
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>e</span>
            <input
              type="date"
              value={ateAusente}
              onChange={(e) => {
                setAteAusente(e.target.value)
                setPagina(1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--fg)',
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* BOX DE FILTROS */}
      <div className="dino-recup-filters-box">
        <div className="dino-recup-filters-grid">
          {/* BUSCA POR NOME OU TELEFONE */}
          <div className="dino-recup-input-wrap">
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
            />
            {busca && (
              <button type="button" className="dino-recup-clear-btn" onClick={() => setBusca('')}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* PROFISSIONAL PREFERIDO */}
          <select
            className="dino-recup-select"
            value={profissional}
            onChange={(e) => {
              setProfissional(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">Todos os barbeiros ({dados.resumo?.totalAnalisados || 0})</option>
            {listaProfissionais.map((p) => {
              const count = dados.resumo?.porProfissional?.[p] || 0
              return (
                <option key={p} value={p}>
                  {p} ({count})
                </option>
              )
            })}
          </select>

          {/* MODELO SUGERIDO */}
          <select
            className="dino-recup-select"
            value={modelo}
            onChange={(e) => {
              setModelo(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">Todos os modelos</option>
            <option value="essencial">Modelo Essencial (Acessível)</option>
            <option value="premium">Modelo Premium (VIP)</option>
            <option value="club">Reativação Club / Pacote</option>
          </select>

          {/* ORDENAÇÃO */}
          <select
            className="dino-recup-select"
            value={ordem}
            onChange={(e) => {
              setOrdem(e.target.value)
              setPagina(1)
            }}
          >
            <option value="diasSemVir">Mais tempo sem vir</option>
            <option value="valor">Maior valor total gasto</option>
            <option value="visitas">Mais visitas históricas</option>
            <option value="ticket">Maior ticket médio</option>
            <option value="recente">Visita mais recente</option>
            <option value="nome">Nome (A–Z)</option>
          </select>

          {/* ITENS POR PÁGINA */}
          <select
            className="dino-recup-select"
            value={limite}
            onChange={(e) => {
              setLimite(Number(e.target.value))
              setPagina(1)
            }}
          >
            <option value={25}>Exibir 25 clientes</option>
            <option value={50}>Exibir 50 clientes</option>
            <option value={100}>Exibir 100 clientes</option>
          </select>
        </div>

        {/* CHIPS RÁPIDOS */}
        <div className="dino-recup-chips-row">
          <span className="dino-recup-chips-label">Tempo sem vir:</span>
          {[
            ['ausentes', 'Ausentes (> 30d)'],
            ['30_60', '30 a 60 dias'],
            ['60_90', '60 a 90 dias'],
            ['90_180', '90 a 180 dias'],
            ['180_mais', '+180 dias'],
            ['todos', 'Todos'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`dino-recup-chip${diasSemVir === val ? ' active' : ''}`}
              onClick={() => {
                setDiasSemVir(val)
                setPagina(1)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA DE CLIENTES PARA RECUPERAÇÃO */}
      <div className="dino-recup-table-wrap">
        <table className="dino-recup-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={toggleSelecionarTodosPagina}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg)', padding: 0 }}
                  title="Selecionar todos da página atual"
                >
                  {(dados.itens || []).length > 0 &&
                  (dados.itens || []).every((c) => selecionados.has(c.key)) ? (
                    <CheckSquare size={16} color="#3b82f6" />
                  ) : (
                    <Square size={16} color="var(--muted)" />
                  )}
                </button>
              </th>
              <th>Cliente</th>
              <th>Última Visita</th>
              <th>Barbeiro Habitual</th>
              <th>Serviços Habituais</th>
              <th style={{ textAlign: 'right' }}>Histórico</th>
              <th>Modelo Sugerido</th>
              <th style={{ textAlign: 'right' }}>Ações Rápidas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Carregando análise histórica da base…
                </td>
              </tr>
            ) : dados.itens?.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              dados.itens.map((c) => {
                const estaSelecionado = selecionados.has(c.key)
                const iniciais = (c.nome || 'CL')
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()

                return (
                  <tr
                    key={c.key}
                    style={estaSelecionado ? { background: 'rgba(59, 130, 246, 0.08)' } : undefined}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggleCliente(c.key)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg)', padding: 0 }}
                      >
                        {estaSelecionado ? (
                          <CheckSquare size={16} color="#3b82f6" />
                        ) : (
                          <Square size={16} color="var(--muted)" />
                        )}
                      </button>
                    </td>

                    <td>
                      <div className="dino-recup-client-cell">
                        <div className="dino-recup-avatar">{iniciais}</div>
                        <div className="dino-recup-client-meta">
                          <span className="dino-recup-client-name">{c.nome}</span>
                          <span className="dino-recup-client-sub">
                            {c.telefoneFormatado || c.telefone || 'Sem telefone'}
                            {c.tevePacote && (
                              <span className="dino-recup-badge club" style={{ padding: '1px 5px', fontSize: '10px' }}>
                                Club
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong>{dataBR(c.ultimaVisita)}</strong>
                        <span style={{ fontSize: '12px', color: c.diasSemVir > 90 ? '#ef4444' : '#f59e0b' }}>
                          Há {c.diasSemVir} dia{c.diasSemVir === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <strong style={{ color: '#38bdf8' }}>{c.profissionalPreferido}</strong>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {c.profissionalPreferidoVisitas} atendimento{c.profissionalPreferidoVisitas === 1 ? '' : 's'}
                      </div>
                    </td>

                    <td>
                      <div style={{ maxWidth: '240px' }}>
                        {(c.servicosHabituais || []).map((s) => (
                          <span key={s} className="dino-recup-tag-service">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <strong>{moeda(c.totalGasto)}</strong>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          {c.totalVisitas} visita{c.totalVisitas === 1 ? '' : 's'} · TM {moeda(c.ticketMedio)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`dino-recup-badge ${c.modeloRecomendado}`}>
                        {c.modeloRecomendado === 'essencial' && '🏷️ Essencial (Acessível)'}
                        {c.modeloRecomendado === 'premium' && '⭐ Premium (VIP)'}
                        {c.modeloRecomendado === 'club' && '🔄 Reativar Club'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="dino-recup-actions">
                        {/* BOTÃO ENVIAR WHATSAPP */}
                        {c.telefone && (
                          <a
                            href={linkWa(c)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dino-recup-btn-wa"
                            title="Abrir WhatsApp com mensagem de resgate pronta"
                          >
                            <MessageSquare size={14} />
                            WhatsApp
                          </a>
                        )}

                        {/* COPIAR MENSAGEM */}
                        <button
                          type="button"
                          className="dino-recup-btn-icon"
                          onClick={() => copiarMensagem(c)}
                          title="Copiar mensagem personalizada de resgate"
                        >
                          {copiadoKey === c.key ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>

                        {/* AGENDAR */}
                        <button
                          type="button"
                          className="dino-recup-btn-icon"
                          onClick={() => {
                            if (onAbrirAgenda) onAbrirAgenda(c)
                            else
                              window.location.href = `/admin/barbearia?tab=Agenda&clienteId=${encodeURIComponent(
                                c.key
                              )}&clienteNome=${encodeURIComponent(c.nome)}`
                          }}
                          title="Agendar horário na agenda"
                        >
                          <Calendar size={14} />
                        </button>

                        {/* VER HISTÓRICO COMPLETO */}
                        <button
                          type="button"
                          className="dino-recup-btn-icon"
                          onClick={() => abrirHistorico(c)}
                          title="Ver todas as visitas anteriores no Avec"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* PAGINAÇÃO */}
        {dados.paginas > 1 && (
          <div className="dino-recup-pagination">
            <span>
              Página {dados.pagina} de {dados.paginas} ({dados.total} clientes no filtro)
            </span>
            <div className="dino-recup-page-controls">
              <button
                type="button"
                className="dino-recup-btn ghost"
                style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                disabled={dados.pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                ‹ Anterior
              </button>
              <button
                type="button"
                className="dino-recup-btn ghost"
                style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                disabled={dados.pagina >= dados.paginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES EM MASSA */}
      {selecionados.size > 0 && (
        <div className="dino-recup-bulk-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {selecionados.size}
            </div>
            <div>
              <strong style={{ color: '#fff', fontSize: '14px' }}>
                {selecionados.size} cliente{selecionados.size === 1 ? '' : 's'} selecionado{selecionados.size === 1 ? '' : 's'}
              </strong>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Ações em lote para o grupo selecionado
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="dino-recup-btn ghost"
              style={{ minHeight: '36px', fontSize: '12.5px' }}
              onClick={copiarTelefonesSelecionados}
            >
              <Copy size={14} />
              {copiadoTelefones ? '✓ Telefones Copiados!' : 'Copiar Telefones'}
            </button>

            <button
              type="button"
              className="dino-recup-btn primary"
              style={{ minHeight: '36px', fontSize: '12.5px', background: '#059669', borderColor: '#059669' }}
              onClick={() => {
                setCampanhaDisparada(null)
                setTesteFeedback(null)
                setEscopoEnvio('selecionados')
                setModalCampanhaCRM(true)
              }}
            >
              <Sparkles size={14} />
              Disparar CRM para Selecionados ({selecionados.size})
            </button>

            <button
              type="button"
              className="dino-recup-btn ghost"
              style={{ minHeight: '36px', fontSize: '12px', color: '#94a3b8' }}
              onClick={() => setSelecionados(new Set())}
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO COMPLETO DO AVEC */}
      {modalCliente && (
        <div className="dino-recup-modal-backdrop" onClick={() => setModalCliente(null)}>
          <div className="dino-recup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dino-recup-modal-header">
              <div>
                <h3>Histórico Completo de Visitas: {modalCliente.nome}</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {modalCliente.telefoneFormatado || modalCliente.telefone} · CPF: {modalCliente.cpf || 'Não informado'}
                </span>
              </div>
              <button type="button" className="dino-recup-modal-close" onClick={() => setModalCliente(null)}>
                ×
              </button>
            </div>

            <div className="dino-recup-modal-body">
              {/* RESUMO DO CLIENTE */}
              <div className="dino-recup-modal-summary">
                <div>
                  <span>Total de Visitas</span>
                  <strong>{modalCliente.totalVisitas} atendimentos</strong>
                </div>
                <div>
                  <span>Total Gasto</span>
                  <strong>{moeda(modalCliente.totalGasto)}</strong>
                </div>
                <div>
                  <span>Ticket Médio</span>
                  <strong>{moeda(modalCliente.ticketMedio)}</strong>
                </div>
                <div>
                  <span>Barbeiro Favorito</span>
                  <strong style={{ color: '#38bdf8' }}>{modalCliente.profissionalPreferido}</strong>
                </div>
                <div>
                  <span>Última Visita</span>
                  <strong>{dataBR(modalCliente.ultimaVisita)}</strong>
                </div>
              </div>

              {/* MENSAGEM SUGERIDA */}
              <div className="dino-recup-modal-message-box">
                <label>Mensagem de Resgate Recomendada (WhatsApp)</label>
                <textarea readOnly value={modalCliente.mensagemWhatsapp || ''} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="dino-recup-btn ghost"
                    style={{ minHeight: '34px', fontSize: '12px' }}
                    onClick={() => copiarMensagem(modalCliente)}
                  >
                    {copiadoKey === modalCliente.key ? '✓ Copiado!' : 'Copiar Texto'}
                  </button>
                  {modalCliente.telefone && (
                    <a
                      href={linkWa(modalCliente)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dino-recup-btn-wa"
                      style={{ minHeight: '34px' }}
                    >
                      <MessageSquare size={14} />
                      Enviar pelo WhatsApp Web
                    </a>
                  )}
                </div>
              </div>

              {/* LISTA DE ATENDIMENTOS ANTERIORES */}
              <div className="dino-recup-modal-table-wrap">
                <table className="dino-recup-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Serviço Realizado</th>
                      <th>Profissional</th>
                      <th>Valor (R$)</th>
                      <th>Comanda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistorico ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          Carregando histórico detalhado…
                        </td>
                      </tr>
                    ) : historicoModal.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          Nenhum registro individual encontrado.
                        </td>
                      </tr>
                    ) : (
                      historicoModal.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{dataBR(item.data)}</strong>
                          </td>
                          <td>
                            {item.servico}
                            {item.pacote && (
                              <span className="dino-recup-badge club" style={{ marginLeft: 6, padding: '1px 5px', fontSize: '10px' }}>
                                Pacote
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#38bdf8' }}>{item.profissional}</td>
                          <td>{moeda(item.valor)}</td>
                          <td style={{ color: '#94a3b8' }}>{item.comanda ? `#${item.comanda}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dino-recup-modal-footer">
              <button type="button" className="dino-recup-btn ghost" onClick={() => setModalCliente(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISPARO DA CAMPANHA CRM */}
      {modalCampanhaCRM && (
        <div className="dino-recup-modal-backdrop" onClick={() => !resgatandoCRM && setModalCampanhaCRM(false)}>
          <div className="dino-recup-modal" style={{ maxWidth: '740px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dino-recup-modal-header" style={{ borderBottomColor: 'rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Disparar Campanha de Resgate CRM (WhatsApp)</h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Reativação inteligente de clientes afastados com mensageria e IA
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dino-recup-modal-close"
                disabled={resgatandoCRM}
                onClick={() => setModalCampanhaCRM(false)}
              >
                ×
              </button>
            </div>

            <div className="dino-recup-modal-body" style={{ gap: 16 }}>
              {campanhaDisparada ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: '48px' }}>🎉</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', margin: 0 }}>
                    Campanha de Resgate Iniciada com Sucesso!
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
                    Foram enfileirados <strong>{campanhaDisparada.totalClientes} clientes</strong> para envio. O robô de
                    mensageria da Barbearia Dino está processando os envios com intervalo seguro contra bloqueios no WhatsApp.
                  </p>

                  <div style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: 10, border: '1px solid var(--line)', maxWidth: 440, margin: '8px auto', textAlign: 'left', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>Identificador:</span>
                      <strong>{campanhaDisparada.id?.slice(0, 18)}...</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>Clientes Válidos:</span>
                      <strong style={{ color: '#10b981' }}>{campanhaDisparada.totalClientes}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Status:</span>
                      <strong style={{ color: '#38bdf8' }}>Enfileirado e Processando</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dino-recup-btn primary"
                    style={{ background: '#10b981', borderColor: '#10b981', alignSelf: 'center', marginTop: 8 }}
                    onClick={() => {
                      setModalCampanhaCRM(false)
                      setCampanhaDisparada(null)
                    }}
                  >
                    Concluir e Voltar
                  </button>
                </div>
              ) : (
                <>
                  {/* SELEÇÃO DO ESCOPO */}
                  <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--fg)', display: 'block', marginBottom: 8 }}>
                      Público Alvo do Disparo:
                    </label>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      {selecionados.size > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', cursor: 'pointer', color: '#3b82f6', fontWeight: 700 }}>
                          <input
                            type="radio"
                            name="escopo"
                            checked={escopoEnvio === 'selecionados'}
                            onChange={() => setEscopoEnvio('selecionados')}
                            style={{ margin: 0, cursor: 'pointer' }}
                          />
                          Apenas os Selecionados ({selecionados.size} clientes)
                        </label>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', cursor: 'pointer', color: 'var(--fg)' }}>
                        <input
                          type="radio"
                          name="escopo"
                          checked={escopoEnvio === 'filtrados'}
                          onChange={() => setEscopoEnvio('filtrados')}
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        Clientes do Filtro Atual ({dados.total} clientes)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', cursor: 'pointer', color: 'var(--fg)' }}>
                        <input
                          type="radio"
                          name="escopo"
                          checked={escopoEnvio === 'todos'}
                          onChange={() => setEscopoEnvio('todos')}
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        Toda a Base Histórica Avec ({dados.resumo?.totalAnalisados || 0} clientes)
                      </label>
                    </div>
                  </div>

                  {/* ESTRATÉGIA DE MENSAGEM */}
                  <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--fg)', display: 'block', marginBottom: 8 }}>
                      Estratégia de Abordagem:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--fg)' }}>
                        <input
                          type="radio"
                          name="tipoMsg"
                          checked={tipoMensagem === 'personalizada_modelo'}
                          onChange={() => setTipoMensagem('personalizada_modelo')}
                          style={{ marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Mensagem Inteligente por Perfil do Cliente (Recomendado)</strong>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            O sistema envia o texto calibrado para cada perfil: oferta acessível para <strong>Essencial</strong>, exclusividade para <strong>Premium</strong> e retorno do plano para <strong>Club</strong>.
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--fg)' }}>
                        <input
                          type="radio"
                          name="tipoMsg"
                          checked={tipoMensagem === 'unica'}
                          onChange={() => setTipoMensagem('unica')}
                          style={{ marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Mensagem Personalizada Única para Todos</strong>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            Você digita o texto e o robô personaliza automaticamente o nome do cliente e do barbeiro preferido.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* GATILHOS / CUPONS DE RETORNO (INSERÇÃO COM 1 CLIQUE) */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--fg)', display: 'block', marginBottom: 6 }}>
                      Gatilhos & Benefícios de Retorno (Clique para injetar no texto):
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {GATILHOS_CRM.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="dino-recup-trigger-pill"
                          onClick={() => {
                            setTipoMensagem('unica')
                            setMsgCampanha((prev) => prev + g.texto)
                          }}
                        >
                          {g.rotulo}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* EDITOR DE MENSAGEM */}
                  {tipoMensagem === 'unica' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--fg)' }}>
                          Texto da Mensagem no WhatsApp:
                        </label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Tags:</span>
                          {['{Nome}', '{Profissional}', '{Link Agendamento}', '{Ultima Visita}', '{Dias Sem Vir}'].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="dino-recup-var-btn"
                              onClick={() => setMsgCampanha((prev) => prev + ' ' + tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={msgCampanha}
                        onChange={(e) => setMsgCampanha(e.target.value)}
                        rows={5}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          color: 'var(--fg)',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          lineHeight: 1.4,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '12px 14px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: 'var(--fg)',
                      }}
                    >
                      <strong style={{ color: '#10b981', display: 'block', marginBottom: 4 }}>
                        ✓ Modo Inteligente Ativado
                      </strong>
                      Cada cliente receberá uma das 3 versões validadas (Essencial, Premium ou Club), incluindo o primeiro nome e o barbeiro habitual que ele costumava cortar no Avec.
                    </div>
                  )}

                  {/* PRÉVIA ESTILO WHATSAPP */}
                  <div style={{ background: '#0b141a', padding: '14px', borderRadius: 10, border: '1px solid #202c33' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                        D
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e9edef' }}>Prévia do Balão no WhatsApp</span>
                    </div>
                    <div
                      style={{
                        background: '#005c4b',
                        color: '#e9edef',
                        padding: '10px 12px',
                        borderRadius: '8px 8px 0 8px',
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        maxWidth: '92%',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {tipoMensagem === 'personalizada_modelo'
                        ? 'Olá Rodrigo! Aqui é da Barbearia Dino! 💈\n\nSentimos sua falta por aqui! Notamos que faz um tempinho que você não vem dar aquele trato no visual com a gente.\n\nPodemos reservar um horário especial com o Dino essa semana?'
                        : msgCampanha
                            .replace(/\{Nome\}/g, 'Rodrigo')
                            .replace(/\{Profissional\}/g, 'Dino')
                            .replace(/\{Link Agendamento\}/g, 'https://kytto.com.br/barbeiro/dino')
                            .replace(/\{Ultima Visita\}/g, '15/08/2026')
                            .replace(/\{Dias Sem Vir\}/g, '78')}
                      <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                        14:30 ✓✓
                      </div>
                    </div>
                  </div>

                  {/* TESTE PRELIMINAR NO WHATSAPP */}
                  <div
                    style={{
                      borderTop: '1px solid var(--line)',
                      paddingTop: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                      Enviar Teste no WhatsApp antes de disparar para a base:
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="DDD + Celular (ex: 65999056008)"
                        value={testeTelefone}
                        onChange={(e) => setTesteTelefone(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          color: 'var(--fg)',
                          fontSize: 13,
                        }}
                      />
                      <button
                        type="button"
                        className="dino-recup-btn ghost"
                        style={{ minHeight: '38px', fontSize: '12.5px' }}
                        disabled={testandoEnvio || !testeTelefone}
                        onClick={enviarTesteWhatsApp}
                      >
                        <Send size={14} />
                        {testandoEnvio ? 'Enviando teste...' : 'Enviar Teste'}
                      </button>
                    </div>

                    {testeFeedback && (
                      <div
                        style={{
                          fontSize: '12.5px',
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: testeFeedback.tipo === 'sucesso' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: testeFeedback.tipo === 'sucesso' ? '#34d399' : '#f87171',
                          border: `1px solid ${testeFeedback.tipo === 'sucesso' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                          fontWeight: 600,
                        }}
                      >
                        {testeFeedback.texto}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {!campanhaDisparada && (
              <div
                className="dino-recup-modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  className="dino-recup-btn ghost"
                  disabled={resgatandoCRM}
                  onClick={() => setModalCampanhaCRM(false)}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="dino-recup-btn primary"
                  style={{ background: '#059669', borderColor: '#059669', minHeight: '40px' }}
                  disabled={resgatandoCRM}
                  onClick={dispararCampanha}
                >
                  <Sparkles size={16} />
                  {resgatandoCRM
                    ? 'Enfileirando Envios...'
                    : escopoEnvio === 'selecionados'
                    ? `Disparar para ${selecionados.size} Selecionados`
                    : `Disparar para ${dados.total ? `${dados.total} Clientes` : `${dados.itens.length} Clientes`}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
