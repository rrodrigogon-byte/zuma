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

export default function DinoRecuperacaoAvecPanel({ onAbrirAgenda }) {
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState({
    itens: [],
    total: 0,
    pagina: 1,
    paginas: 1,
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
  const [msgCampanha, setMsgCampanha] = useState('Oi {Nome}! Notei que faz um tempinho que você não vem aqui. Para celebrar sua volta, preparei um horário especial com o {Profissional}. Posso agendar para essa semana?\n\n👉 {Link Agendamento}')
  const [resgatandoCRM, setResgatandoCRM] = useState(false)
  const [campanhaDisparada, setCampanhaDisparada] = useState(null)
  const [testeTelefone, setTesteTelefone] = useState('')
  const [testandoEnvio, setTestandoEnvio] = useState(false)
  const [testeFeedback, setTesteFeedback] = useState(null)

  const [historicoModal, setHistoricoModal] = useState([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [copiadoKey, setCopiadoKey] = useState(null)

  // Carregar dados da API
  const carregar = useCallback(async (force = false) => {
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
    params.set('limite', '25')
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
  }, [debouncedBusca, deAtivo, ateAtivo, deAusente, ateAusente, diasSemVir, profissional, modelo, ordem, pagina])

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

  // Exportar CSV
  function baixarCsv() {
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    if (deAtivo) params.set('deAtivo', deAtivo)
    if (ateAtivo) params.set('ateAtivo', ateAtivo)
    if (deAusente) params.set('deAusente', deAusente)
    if (ateAusente) params.set('ateAusente', ateAusente)
    if (diasSemVir && diasSemVir !== 'todos') params.set('diasSemVir', diasSemVir)
    if (profissional && profissional !== 'todos') params.set('profissional', profissional)
    if (modelo && modelo !== 'todos') params.set('modelo', modelo)
    if (ordem) params.set('ordem', ordem)

    window.open(`/api/admin/barbearia/recuperacao-clientes/exportar.csv?${params.toString()}`, '_blank')
  }

  // Abrir modal de histórico Avec
  
  async function dispararCampanha() {
    try {
      setResgatandoCRM(true)
      const payload = {
        escopo: escopoEnvio,
        usarMensagemPersonalizadaPorModelo: tipoMensagem === 'personalizada_modelo',
        mensagem: msgCampanha,
      }

      if (escopoEnvio === 'filtrados') {
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
        payload.clientesIds = dados.itens.map(c => c.key)
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

  // Copiar mensagem para clipboard
  function copiarMensagem(cliente) {
    if (!cliente?.mensagemWhatsapp) return
    navigator.clipboard.writeText(cliente.mensagemWhatsapp)
    setCopiadoKey(cliente.key)
    setTimeout(() => setCopiadoKey(null), 2500)
  }

  // Link do WhatsApp
  const linkWa = (cliente) => {
    const d = String(cliente.telefone || '').replace(/\D/g, '')
    if (!d) return '#'
    const phone = d.startsWith('55') ? d : `55${d}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(cliente.mensagemWhatsapp || '')}`
  }

  // Lista de profissionais para o select
  const listaProfissionais = useMemo(() => {
    const profs = Object.keys(dados.resumo?.porProfissional || {})
    return profs.filter((p) => p && p !== 'Não informado').sort()
  }, [dados.resumo])

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

        <div className="dino-recup-kpi-card">
          <span className="dino-recup-kpi-label">
            🏷️ Perfil Modelo Essencial
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#34d399' }}>
            {dados.resumo?.porModelo?.essencial?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">foco em corte acessível com nova equipe</span>
        </div>

        <div className="dino-recup-kpi-card">
          <span className="dino-recup-kpi-label">
            ⭐ Perfil Modelo Premium
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#c084fc' }}>
            {dados.resumo?.porModelo?.premium?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">ticket alto, extras ou cliente do Dino</span>
        </div>

        <div className="dino-recup-kpi-card">
          <span className="dino-recup-kpi-label">
            🔄 Assinantes Club / Pacote
          </span>
          <span className="dino-recup-kpi-value" style={{ color: '#fbbf24' }}>
            {dados.resumo?.porModelo?.club?.toLocaleString('pt-BR') || 0}
          </span>
          <span className="dino-recup-kpi-sub">clientes frequentes do clube para reativar</span>
        </div>
      </div>

      {/* BANNER DE CENÁRIO DO REAJUSTE DE PREÇOS E FILTROS MANUAIS DE DATA */}
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
            style={{ marginLeft: 8, background: '#059669', color: '#fff', borderColor: '#059669', cursor: 'pointer' }}
            onClick={() => {
              setCampanhaDisparada(null);
              setTesteFeedback(null);
              setModalCampanhaCRM(true);
            }}
          >
            <Sparkles size={14} style={{ marginRight: 4 }} /> 
            Disparar Campanha CRM ({dados.total ? `${dados.total} clientes` : `${dados.itens.length}`})
          </button>
        </div>
        
        {/* Filtros customizados de período de presença e ausência */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 16px', background: 'var(--card2)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Frequentou entre:</span>
            <input type="date" value={deAtivo} onChange={e => { setDeAtivo(e.target.value); setPagina(1); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>e</span>
            <input type="date" value={ateAtivo} onChange={e => { setAteAtivo(e.target.value); setPagina(1); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }} />
          </div>
          <div style={{ width: '1px', background: 'var(--line)', minHeight: 24, margin: '0 8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Ausente entre:</span>
            <input type="date" value={deAusente} onChange={e => { setDeAusente(e.target.value); setPagina(1); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>e</span>
            <input type="date" value={ateAusente} onChange={e => { setAteAusente(e.target.value); setPagina(1); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }} />
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
            <option value="todos">Todos os barbeiros</option>
            {listaProfissionais.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
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

          {/* FILTRO DE DIAS SEM VIR */}
          <select
            className="dino-recup-select"
            value={diasSemVir}
            onChange={(e) => {
              setDiasSemVir(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">Qualquer tempo de ausência</option>
            <option value="ausentes">Ausentes há mais de 30 dias</option>
            <option value="30_60">30 a 60 dias sem vir (Atenção)</option>
            <option value="60_90">60 a 90 dias sem vir (Alerta)</option>
            <option value="90_180">90 a 180 dias sem vir (Churn)</option>
            <option value="180_mais">Mais de 180 dias sem vir (Perdido)</option>
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Carregando análise histórica da base…
                </td>
              </tr>
            ) : dados.itens?.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              dados.itens.map((c) => {
                const iniciais = (c.nome || 'CL')
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()

                return (
                  <tr key={c.key}>
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
                            else window.location.href = `/admin/barbearia?tab=Agenda&clienteId=${encodeURIComponent(c.key)}&clienteNome=${encodeURIComponent(c.nome)}`
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
              Página {dados.pagina} de {dados.paginas} ({dados.total} clientes)
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
                          <td><strong>{dataBR(item.data)}</strong></td>
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
          <div className="dino-recup-modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dino-recup-modal-header" style={{ borderBottomColor: 'rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
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

            <div className="dino-recup-modal-body">
              {campanhaDisparada ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', display: 'grid', gap: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <Check size={36} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
                    Campanha de Resgate Iniciada com Sucesso!
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
                    Foram enfileirados <strong>{campanhaDisparada.alvos} clientes</strong> para envio. O robô de mensageria da Barbearia Dino está processando os envios com intervalo seguro contra bloqueios no WhatsApp.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10 }}>
                    <button
                      type="button"
                      className="dino-recup-btn primary"
                      style={{ background: '#10b981', borderColor: '#10b981', minHeight: '40px', padding: '0 24px', fontWeight: 700 }}
                      onClick={() => {
                        setModalCampanhaCRM(false);
                        setCampanhaDisparada(null);
                      }}
                    >
                      Concluir e Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dino-recup-modal-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                    <div>
                      <span>Total Selecionado</span>
                      <strong style={{ color: '#10b981', fontSize: '18px' }}>
                        {escopoEnvio === 'filtrados' ? dados.total : dados.itens.length} clientes
                      </strong>
                    </div>
                    <div>
                      <span>🏷️ Essencial</span>
                      <strong style={{ color: '#10b981' }}>{dados.resumo?.porModelo?.essencial || 0}</strong>
                    </div>
                    <div>
                      <span>⭐ Premium</span>
                      <strong style={{ color: '#a855f7' }}>{dados.resumo?.porModelo?.premium || 0}</strong>
                    </div>
                    <div>
                      <span>🔄 Club / Pacote</span>
                      <strong style={{ color: '#f59e0b' }}>{dados.resumo?.porModelo?.club || 0}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>
                      1. Escolha o público do disparo:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', borderRadius: '10px',
                        border: `1px solid ${escopoEnvio === 'filtrados' ? '#10b981' : 'var(--line)'}`,
                        background: escopoEnvio === 'filtrados' ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="escopo"
                          checked={escopoEnvio === 'filtrados'}
                          onChange={() => setEscopoEnvio('filtrados')}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: '#f8fafc' }}>
                            Todos os clientes filtrados ({dados.total})
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            Alcança toda a coorte calculada ({isCenarioReajuste ? 'Cenário do Reajuste' : 'filtro ativo'})
                          </span>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', borderRadius: '10px',
                        border: `1px solid ${escopoEnvio === 'pagina' ? '#10b981' : 'var(--line)'}`,
                        background: escopoEnvio === 'pagina' ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="escopo"
                          checked={escopoEnvio === 'pagina'}
                          onChange={() => setEscopoEnvio('pagina')}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: '#f8fafc' }}>
                            Apenas página atual ({dados.itens.length})
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            Envio de lote controlado dos clientes visíveis
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>
                      2. Estratégia de Mensagem:
                    </label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', borderRadius: '10px',
                        border: `1px solid ${tipoMensagem === 'personalizada_modelo' ? '#38bdf8' : 'var(--line)'}`,
                        background: tipoMensagem === 'personalizada_modelo' ? 'rgba(56, 189, 248, 0.08)' : 'var(--surface-2)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="tipoMsg"
                          checked={tipoMensagem === 'personalizada_modelo'}
                          onChange={() => setTipoMensagem('personalizada_modelo')}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: '#38bdf8' }}>
                            ✨ Mensagem Inteligente Personalizada por Perfil (Recomendado)
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4, display: 'block', marginTop: 2 }}>
                            O sistema adapta o texto para cada cliente: quem parou no reajuste recebe a oferta do <strong>Modelo Essencial</strong>; quem consome serviços extras recebe o convite <strong>Premium VIP</strong>; e quem tinha plano recebe a oferta de reativação do <strong>Club</strong>.
                          </span>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', borderRadius: '10px',
                        border: `1px solid ${tipoMensagem === 'custom' ? '#38bdf8' : 'var(--line)'}`,
                        background: tipoMensagem === 'custom' ? 'rgba(56, 189, 248, 0.08)' : 'var(--surface-2)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="tipoMsg"
                          checked={tipoMensagem === 'custom'}
                          onChange={() => setTipoMensagem('custom')}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: '#f8fafc' }}>
                            ✍️ Mensagem Personalizada Única
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            Você digita o texto e o sistema substitui as variáveis automaticamente.
                          </span>
                        </div>
                      </label>
                    </div>

                    {tipoMensagem === 'custom' && (
                      <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="dino-recup-btn ghost"
                            style={{ minHeight: '26px', fontSize: '11px', padding: '0 8px' }}
                            onClick={() => setMsgCampanha((m) => m + ' {Nome}')}
                          >
                            + {'{Nome}'}
                          </button>
                          <button
                            type="button"
                            className="dino-recup-btn ghost"
                            style={{ minHeight: '26px', fontSize: '11px', padding: '0 8px' }}
                            onClick={() => setMsgCampanha((m) => m + ' {Profissional}')}
                          >
                            + {'{Profissional}'}
                          </button>
                          <button
                            type="button"
                            className="dino-recup-btn ghost"
                            style={{ minHeight: '26px', fontSize: '11px', padding: '0 8px' }}
                            onClick={() => setMsgCampanha((m) => m + ' {Link Agendamento}')}
                          >
                            + {'{Link Agendamento}'}
                          </button>
                        </div>
                        <textarea
                          value={msgCampanha}
                          onChange={(e) => setMsgCampanha(e.target.value)}
                          rows={4}
                          style={{
                            width: '100%', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)',
                            color: 'var(--fg)', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} /> Prévia da Mensagem (Exemplo: {dados.itens[0]?.nome || 'Cliente'})
                    </div>
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.12)', borderLeft: '3px solid #10b981', padding: '10px 14px', borderRadius: '4px 10px 10px 4px',
                      fontSize: '12.5px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.45, maxHeight: '140px', overflowY: 'auto'
                    }}>
                      {tipoMensagem === 'personalizada_modelo'
                        ? (dados.itens[0]?.mensagemWhatsapp || 'Mensagem personalizada por perfil do cliente...')
                        : msgCampanha
                            .replace(/\{Nome do Cliente\}|\{Nome\}/g, dados.itens[0]?.nome?.split(' ')[0] || 'Cliente')
                            .replace(/\{Profissional\}/g, dados.itens[0]?.profissionalPreferido?.split(' ')[0] || 'Equipe Dino')
                            .replace(/\{Link Agendamento\}/g, `https://kytto.com.br/barbeiro/dino?t=${dados.itens[0]?.telefone || ''}`)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: '260px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>Testar no seu Whats:</span>
                      <input
                        type="text"
                        placeholder="Ex: 65999998888"
                        value={testeTelefone}
                        onChange={(e) => setTesteTelefone(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: '12.5px', width: '150px' }}
                      />
                      <button
                        type="button"
                        className="dino-recup-btn ghost"
                        style={{ minHeight: '30px', fontSize: '12px', padding: '0 12px' }}
                        disabled={testandoEnvio || !testeTelefone}
                        onClick={enviarTesteWhatsApp}
                      >
                        {testandoEnvio ? 'Enviando…' : 'Enviar Teste'}
                      </button>
                    </div>
                    {testeFeedback && (
                      <span style={{ fontSize: '11.5px', color: testeFeedback.tipo === 'sucesso' ? '#10b981' : '#ef4444' }}>
                        {testeFeedback.texto}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="dino-recup-modal-footer">
              <button
                type="button"
                className="dino-recup-btn ghost"
                disabled={resgatandoCRM}
                onClick={() => setModalCampanhaCRM(false)}
              >
                {campanhaDisparada ? 'Fechar' : 'Cancelar'}
              </button>

              {!campanhaDisparada && (
                <button
                  type="button"
                  className="dino-recup-btn primary"
                  style={{ background: '#059669', borderColor: '#059669', minHeight: '38px', padding: '0 20px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                  disabled={resgatandoCRM || (escopoEnvio === 'filtrados' ? dados.total === 0 : dados.itens.length === 0)}
                  onClick={dispararCampanha}
                >
                  <Sparkles size={15} style={{ marginRight: 6 }} />
                  {resgatandoCRM
                    ? 'Disparando Campanha…'
                    : `Disparar para ${escopoEnvio === 'filtrados' ? dados.total : dados.itens.length} Clientes`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
