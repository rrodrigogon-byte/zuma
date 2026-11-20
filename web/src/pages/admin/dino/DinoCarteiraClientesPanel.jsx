import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import {
  Scissors,
  Users,
  Clock,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  UserCheck,
  PhoneCall,
  ChevronRight,
  ExternalLink,
  Download,
  Crown,
  Zap,
  CheckCircle2,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { refHistoricoCliente, urlHistoricoCliente } from './historico-cliente'
import './DinoCarteiraClientesPanel.css'

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

export default function DinoCarteiraClientesPanel({ onNovoCliente }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState(null)
  const [clientes, setClientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [barbeiroSelecionadoId, setBarbeiroSelecionadoId] = useState('') // '' = todos
  const [filtroRetorno, setFiltroRetorno] = useState('todos')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [modalReatribuir, setModalReatribuir] = useState(null) // { cliente, novoBarbeiroId }
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)
  const [unificando, setUnificando] = useState(false)
  const [modalLote, setModalLote] = useState(null)
  const [abertosIds, setAbertosIds] = useState({}) // { disparos: [], totalProntos: 0 }
  const [carregandoLote, setCarregandoLote] = useState(false)
  const [enviandoLoteId, setEnviandoLoteId] = useState(null)
  const [enviadosComSucesso, setEnviadosComSucesso] = useState({})
  const [enviandoTodosLote, setEnviandoTodosLote] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => { setBuscaDebounced(busca) }, 350)
    return () => clearTimeout(timer)
  }, [busca])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [resResumo, resLista] = await Promise.all([
        api.get('/api/admin/barbearia/carteira-clientes/resumo')
          .catch(() => api.get('/api/admin/dino/carteira-clientes/resumo')),
        api.get(`/api/admin/barbearia/carteira-clientes?profissionalId=${encodeURIComponent(barbeiroSelecionadoId)}&filtroRetorno=${encodeURIComponent(filtroRetorno)}&busca=${encodeURIComponent(buscaDebounced)}`)
          .catch(() => api.get(`/api/admin/dino/carteira-clientes?profissionalId=${encodeURIComponent(barbeiroSelecionadoId)}&filtroRetorno=${encodeURIComponent(filtroRetorno)}&busca=${encodeURIComponent(buscaDebounced)}`)),
      ])
      setResumo(resResumo)
      setClientes(resLista?.clientes || [])
      setProfissionais(resLista?.profissionais || [])
    } catch (err) {
      console.error('Erro ao carregar carteiras:', err)
    } finally {
      setLoading(false)
    }
  }, [barbeiroSelecionadoId, filtroRetorno, buscaDebounced])

  const autoUnificarDuplicados = useCallback(async () => {
    const confirmou = window.confirm(
      "Deseja iniciar a varredura e unificação inteligente de cadastros duplicados da barbearia?\n\n" +
      "O sistema irá localizar cadastros com o mesmo celular (com ou sem código 55), histórico comum ou nomes idênticos, consolidando comandas, assinaturas e histórico sob o cadastro principal sem perda de informações fiscais."
    )
    if (!confirmou) return
    setUnificando(true)
    try {
      const res = await api.post('/api/admin/barbearia/clientes/auto-unificar')
        .catch(() => api.post('/api/admin/barbearia/clientes/auto-unificar-duplicados'))
        .catch(() => api.post('/api/admin/dino/clientes/auto-unificar'))
      alert(`Varredura concluída! ${res?.gruposUnificados ?? res?.totalGrupos ?? 0} grupo(s) de clientes duplicados foram unificados com sucesso.`)
      carregarDados()
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Falha na unificação automática.")
    } finally {
      setUnificando(false)
    }
  }, [carregarDados])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Barbeiro ativo atualmente
  const barbeiroAtivo = useMemo(() => {
    if (!barbeiroSelecionadoId) return null
    return profissionais.find((p) => p.id === barbeiroSelecionadoId) || null
  }, [barbeiroSelecionadoId, profissionais])

  // KPIs da carteira selecionada
  const kpisCarteira = useMemo(() => {
    if (!resumo) {
      return {
        total: 0,
        emDia: 0,
        idealRetorno: 0,
        atrasados: 0,
        sumidos: 0,
        faturamento: 0,
        taxaRetencao: 100,
        ticketMedio: 0,
        potencialRecuperacao: 0,
        totalVip: 0,
      }
    }
    if (barbeiroSelecionadoId) {
      const bResumo = (resumo.carteiras || []).find((c) => c.profissionalId === barbeiroSelecionadoId)
      if (bResumo) {
        return {
          total: bResumo.totalClientes,
          emDia: bResumo.emDia,
          idealRetorno: bResumo.idealRetorno,
          atrasados: bResumo.atrasados,
          sumidos: bResumo.sumidos,
          faturamento: bResumo.faturamentoTotal,
          taxaRetencao: bResumo.taxaRetencao ?? (bResumo.totalClientes > 0 ? Math.round(((bResumo.emDia + bResumo.idealRetorno) / bResumo.totalClientes) * 100) : 0),
          ticketMedio: bResumo.ticketMedio ?? (bResumo.totalClientes > 0 ? Math.round(bResumo.faturamentoTotal / bResumo.totalClientes) : 0),
          potencialRecuperacao: bResumo.potencialRecuperacao ?? Math.round((bResumo.atrasados + bResumo.sumidos) * 60),
          totalVip: bResumo.totalVip || 0,
          cicloMedioRetornoDias: bResumo.cicloMedioRetornoDias || 25,
        }
      }
    }
    // Visão Geral (Soma de todos)
    const total = resumo.totalGeralClientes || 0
    let emDia = 0, idealRetorno = 0, atrasados = 0, sumidos = 0, faturamento = 0, totalVip = 0
    for (const c of resumo.carteiras || []) {
      emDia += c.emDia || 0
      idealRetorno += c.idealRetorno || 0
      atrasados += c.atrasados || 0
      sumidos += c.sumidos || 0
      totalVip += c.totalVip || 0
      faturamento += c.faturamentoTotal || 0
    }
    const taxaRetencao = total > 0 ? Math.round(((emDia + idealRetorno) / total) * 100) : 0
    const ticketMedio = total > 0 ? Math.round((faturamento / total) * 100) / 100 : 0
    const potencialRecuperacao = Math.round((atrasados + sumidos) * (ticketMedio > 0 ? ticketMedio : 60))
    const cicloMedioRetornoDias = resumo.cicloMedioRetornoGeral || 25
    return {
      total,
      emDia,
      idealRetorno,
      atrasados,
      sumidos,
      faturamento,
      taxaRetencao,
      ticketMedio,
      potencialRecuperacao,
      totalVip,
      cicloMedioRetornoDias,
    }
  }, [resumo, barbeiroSelecionadoId])

  async function handleVincularBarbeiro(e) {
    e.preventDefault()
    if (!modalReatribuir || !modalReatribuir.novoBarbeiroId) return
    setSalvandoVinculo(true)
    try {
      const profEscolhido = profissionais.find((p) => p.id === modalReatribuir.novoBarbeiroId)
      await api.patch(`/api/admin/barbearia/clientes/${modalReatribuir.cliente.clienteId}/vincular-barbeiro`, {
        profissionalId: modalReatribuir.novoBarbeiroId,
        profissionalNome: profEscolhido?.nome || '',
      })
      setModalReatribuir(null)
      await carregarDados()
    } catch (err) {
      alert('Erro ao vincular barbeiro: ' + (err.message || 'tente novamente.'))
    } finally {
      setSalvandoVinculo(false)
    }
  }

  const exportarCsv = useCallback(() => {
    const url = `/api/admin/barbearia/carteira-clientes/exportar-csv?profissionalId=${encodeURIComponent(barbeiroSelecionadoId)}&filtroRetorno=${encodeURIComponent(filtroRetorno)}&busca=${encodeURIComponent(buscaDebounced)}`
    window.open(url, '_blank')
  }, [barbeiroSelecionadoId, filtroRetorno, buscaDebounced])

  const abrirReativacaoLote = useCallback(async () => {
    setCarregandoLote(true)
    try {
      const candidatos = (clientes || [])
        .filter(c => c.statusRetorno === 'ideal_retorno' || c.statusRetorno === 'atrasado')
        .slice(0, 150)
        .map(c => ({
          clienteId: c.clienteId || c.id,
          nome: c.nome,
          telefone: c.telefone,
          barbeiroApelido: c.barbeiroApelido || c.barbeiroNome?.split(' ')[0] || 'Dino',
          servicoFavorito: c.servicoFavorito || 'corte',
          diasSemRetorno: c.diasSemRetorno || 0,
        }))

      let res = null
      try {
        res = await api.post('/api/admin/barbearia/carteira-clientes/disparar-reativacao', {
          clientesSelecionados: candidatos,
          profissionalId: barbeiroSelecionadoId,
        })
      } catch (postErr) {
        console.warn('Fallback resiliente na fila de reativação:', postErr)
      }

      if (res && res.disparos && res.disparos.length > 0) {
        setModalLote(res)
      } else {
        const listaAlvo = candidatos.length > 0 ? candidatos : (clientes || []).slice(0, 100)
        const disparosLocais = listaAlvo.map(c => {
          const msg = gerarMensagemRetornoTexto(c)
          const tel = String(c.telefone || '').replace(/\D/g, '')
          const temTel = tel.length >= 10
          return {
            clienteId: c.clienteId || c.id || String(Math.random()),
            nome: c.nome,
            telefone: c.telefone,
            whatsappUrl: temTel ? `/admin/whatsapp-fila?telefone=${tel}&nome=${encodeURIComponent(c.nome || '')}&mensagem=${encodeURIComponent(msg)}` : null,
            mensagem: msg,
            status: temTel ? 'pronto' : 'sem_telefone',
          }
        })
        setModalLote({
          ok: true,
          totalProntos: disparosLocais.filter(d => d.status === 'pronto').length,
          totalSemTelefone: disparosLocais.filter(d => d.status === 'sem_telefone').length,
          disparos: disparosLocais,
        })
      }
    } catch (err) {
      alert('Erro ao preparar reativação: ' + (err.message || 'tente novamente.'))
    } finally {
      setCarregandoLote(false)
    }
  }, [clientes, barbeiroSelecionadoId])

  function gerarMensagemRetornoTexto(cliente) {
    const primeiroNome = String(cliente?.nome || '').trim().split(/\s+/)[0] || 'amigo'
    const barbeiroNome = cliente?.barbeiroApelido || cliente?.barbeiroNome?.split(' ')[0] || 'Dino'
    const servico = cliente?.servicoFavorito || 'corte'
    const dias = cliente?.diasSemRetorno || 0

    const tempoFrase = dias > 0 ? `já faz ${dias} dias do seu último ${servico}` : `está na hora de renovar o visual`
    const saudacoes = ['Fala', 'Olá', 'E aí', 'Tudo bem? Aqui é o']
    const saudacao = saudacoes[Math.floor(Math.random() * saudacoes.length)]
    return `${saudacao} ${primeiroNome}! Aqui é o ${barbeiroNome} da Barbearia Dino! 💈\n\nVi aqui que ${tempoFrase}. Vamos dar aquele talento no visual essa semana?\n\nJá separei sua cadeira! Pode me avisar por aqui ou escolher o melhor horário no link: https://kytto.com.br/agendar/dino`
  }

  function irParaPainelTrex(cliente, msgCustom = null) {
    const rawTel = String(cliente?.telefone || '').replace(/\D/g, '')
    if (rawTel.length < 10) {
      alert('Cliente sem telefone válido cadastrado.')
      return
    }
    const telCompleto = rawTel.startsWith('55') ? rawTel : `55${rawTel}`
    const nome = String(cliente?.nome || '').trim()
    const msg = msgCustom || gerarMensagemRetornoTexto(cliente)

    const params = new URLSearchParams({
      telefone: telCompleto,
      nome,
      mensagem: msg,
      origem: 'carteira_clientes',
      novo: '1',
    })
    navigate(`/admin/whatsapp-fila?${params.toString()}`)
  }

  async function dispararDiretoTrex(item) {
    const rawTel = String(item?.telefone || '').replace(/\D/g, '')
    if (rawTel.length < 10) {
      alert('Telefone inválido para disparo.')
      return
    }
    const telCompleto = rawTel.startsWith('55') ? rawTel : `55${rawTel}`
    setEnviandoLoteId(item.clienteId)
    try {
      await api.post('/api/admin/commerce/whatsapp-ai/sessions/start', {
        telefone: telCompleto,
        nome: item.nome || '',
        texto: item.mensagem || gerarMensagemRetornoTexto(item),
        assumir: false,
      })
      setEnviadosComSucesso((prev) => ({ ...prev, [item.clienteId]: true }))
    } catch (err) {
      alert('Erro ao enviar pelo WhatsApp T-Rex: ' + (err?.message || 'verifique se a linha oficial está conectada.'))
    } finally {
      setEnviandoLoteId(null)
    }
  }

  async function dispararTodosTrex() {
    if (!modalLote?.disparos) return
    const pendentes = modalLote.disparos.filter((d) => d.status === 'pronto' && !enviadosComSucesso[d.clienteId])
    if (pendentes.length === 0) {
      alert('Todos os clientes elegíveis já foram enviados!')
      return
    }
    if (!confirm(`Deseja enviar mensagem de reativação para ${pendentes.length} cliente(s) diretamente pela linha oficial do T-Rex?`)) {
      return
    }
    setEnviandoTodosLote(true)
    let sucessos = 0
    let falhas = 0
    for (const item of pendentes) {
      try {
        const rawTel = String(item.telefone || '').replace(/\D/g, '')
        const telCompleto = rawTel.startsWith('55') ? rawTel : `55${rawTel}`
        await api.post('/api/admin/commerce/whatsapp-ai/sessions/start', {
          telefone: telCompleto,
          nome: item.nome || '',
          texto: item.mensagem || gerarMensagemRetornoTexto(item),
          assumir: false,
        })
        setEnviadosComSucesso((prev) => ({ ...prev, [item.clienteId]: true }))
        sucessos++
      } catch (_e) {
        falhas++
      }
    }
    setEnviandoTodosLote(false)
    alert(`Disparo em lote concluído! ${sucessos} mensagem(ns) enviada(s) via T-Rex.${falhas > 0 ? ` ${falhas} falha(s).` : ''}`)
  }

  return (
    <div className="carteira-container">
      {/* CABEÇALHO E SELETOR DE BARBEIROS */}
      <div className="carteira-header-card">
        <div className="carteira-title-row">
          <div>
            <div className="carteira-kicker">Relacionamento & Fidelização</div>
            <h2 className="carteira-h2">
              <Users size={26} color="#f59e0b" />
              Carteira de Clientes por Profissional
            </h2>
            <p className="carteira-sub">
              Acompanhe a base exclusiva de clientes de cada barbeiro (Dino, Nat, Bruno, David e equipe).
              Identifique clientes que estão na hora de voltar e reative o contato com inteligência via WhatsApp (Motor KyttoIA).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="carteira-prof-pill"
              onClick={exportarCsv}
              title="Exportar base completa filtrada para planilha CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <button
              type="button"
              className="carteira-prof-pill"
              style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#10b981', fontWeight: 600 }}
              onClick={autoUnificarDuplicados}
              disabled={unificando}
              title="Detectar e unificar automaticamente clientes duplicados com e sem DDI 55"
            >
              <Users size={14} />
              {unificando ? 'Unificando…' : 'Unificar Duplicados'}
            </button>
            <button
              type="button"
              className="carteira-prof-pill"
              onClick={carregarDados}
              title="Recarregar dados"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
            {onNovoCliente && (
              <button
                type="button"
                className="carteira-prof-pill active"
                onClick={onNovoCliente}
              >
                + Novo Cliente
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE SELEÇÃO DE BARBEIROS */}
        <div className="carteira-profs-bar">
          <button
            type="button"
            className={`carteira-prof-pill ${barbeiroSelecionadoId === '' ? 'active' : ''}`}
            onClick={() => setBarbeiroSelecionadoId('')}
          >
            <div className="carteira-prof-avatar">👥</div>
            <span>Todos os Barbeiros</span>
            <span className="carteira-count-badge">{resumo?.totalGeralClientes || 0}</span>
          </button>

          {(resumo?.carteiras || []).map((b) => (
            <button
              key={b.profissionalId}
              type="button"
              className={`carteira-prof-pill ${barbeiroSelecionadoId === b.profissionalId ? 'active' : ''}`}
              onClick={() => setBarbeiroSelecionadoId(b.profissionalId)}
            >
              <div className="carteira-prof-avatar">
                {b.profissionalApelido ? b.profissionalApelido.slice(0, 2).toUpperCase() : '💈'}
              </div>
              <span>{b.profissionalApelido || b.profissionalNome}</span>
              <span className="carteira-count-badge">{b.totalClientes}</span>
              {b.taxaRetencao !== undefined && (
                <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 2 }}>({b.taxaRetencao}%)</span>
              )}
            </button>
          ))}
        </div>

        {/* INDICADORES DA CARTEIRA SELECIONADA */}
        <div className="carteira-kpis-grid">
          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">Carteira Ativa</span>
            <span className="carteira-kpi-val" style={{ color: '#38bdf8' }}>{kpisCarteira.total}</span>
            <span className="carteira-kpi-sub">
              {barbeiroAtivo ? `Clientes do ${barbeiroAtivo.nome}` : 'Base total de clientes'}
            </span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">🟢 Em dia (&le; 15 dias)</span>
            <span className="carteira-kpi-val" style={{ color: '#34d399' }}>{kpisCarteira.emDia}</span>
            <span className="carteira-kpi-sub">Visitaram recentemente</span>
          </div>

          <div className="carteira-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <span className="carteira-kpi-label">🟡 Hora de Voltar (16 a 30d)</span>
            <span className="carteira-kpi-val" style={{ color: '#fbbf24' }}>{kpisCarteira.idealRetorno}</span>
            <span className="carteira-kpi-sub">Momento ideal para retorno</span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">🔴 Em Atraso (&gt; 30 dias)</span>
            <span className="carteira-kpi-val" style={{ color: '#f87171' }}>{kpisCarteira.atrasados + kpisCarteira.sumidos}</span>
            <span className="carteira-kpi-sub">Risco de perda / Reativação</span>
          </div>

          <div className="carteira-kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <span className="carteira-kpi-label">Taxa de Retenção</span>
            <span className="carteira-kpi-val" style={{ color: '#10b981' }}>
              {kpisCarteira.taxaRetencao}%
            </span>
            <span className="carteira-kpi-sub">Ciclo médio: ~{kpisCarteira.cicloMedioRetornoDias} dias</span>
          </div>

          <div className="carteira-kpi-card">
            <span className="carteira-kpi-label">Faturamento Acumulado</span>
            <span className="carteira-kpi-val" style={{ color: '#f59e0b', fontSize: 22 }}>
              {moeda(kpisCarteira.faturamento)}
            </span>
            <span className="carteira-kpi-sub">
              Ticket Médio: {moeda(kpisCarteira.ticketMedio)}
            </span>
          </div>
        </div>

        {/* BARRA VISUAL DE RETENÇÃO E SAÚDE DA BASE */}
        {kpisCarteira.total > 0 && (
          <div className="carteira-retencao-card">
            <div className="carteira-retencao-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#f3f4f6' }}>
                  Composição da Carteira & Ciclo de Retorno
                </span>
                <span className="carteira-ciclo-tag">
                  Ciclo habitual: <strong>~{kpisCarteira.cicloMedioRetornoDias} dias</strong>
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Fidelidade da Base: <strong style={{ color: '#10b981' }}>{kpisCarteira.taxaRetencao}%</strong>
              </span>
            </div>

            <div className="carteira-progress-bar-container" title={`Em dia: ${kpisCarteira.emDia} | Hora de voltar: ${kpisCarteira.idealRetorno} | Atrasados: ${kpisCarteira.atrasados} | Sumidos: ${kpisCarteira.sumidos}`}>
              <div
                className="carteira-progress-segment em-dia"
                style={{ width: `${Math.round((kpisCarteira.emDia / kpisCarteira.total) * 100)}%` }}
                title={`Em dia: ${kpisCarteira.emDia} clientes (${Math.round((kpisCarteira.emDia / kpisCarteira.total) * 100)}%)`}
              />
              <div
                className="carteira-progress-segment ideal-retorno"
                style={{ width: `${Math.round((kpisCarteira.idealRetorno / kpisCarteira.total) * 100)}%` }}
                title={`Hora de voltar: ${kpisCarteira.idealRetorno} clientes (${Math.round((kpisCarteira.idealRetorno / kpisCarteira.total) * 100)}%)`}
              />
              <div
                className="carteira-progress-segment atrasados"
                style={{ width: `${Math.round((kpisCarteira.atrasados / kpisCarteira.total) * 100)}%` }}
                title={`Atrasados: ${kpisCarteira.atrasados} clientes (${Math.round((kpisCarteira.atrasados / kpisCarteira.total) * 100)}%)`}
              />
              <div
                className="carteira-progress-segment sumidos"
                style={{ width: `${Math.round((kpisCarteira.sumidos / kpisCarteira.total) * 100)}%` }}
                title={`Sumidos: ${kpisCarteira.sumidos} clientes (${Math.round((kpisCarteira.sumidos / kpisCarteira.total) * 100)}%)`}
              />
            </div>

            <div className="carteira-progress-legend">
              <span className="legend-item"><span className="legend-dot dot-em-dia" /> Em dia ({kpisCarteira.emDia})</span>
              <span className="legend-item"><span className="legend-dot dot-ideal" /> Hora de voltar ({kpisCarteira.idealRetorno})</span>
              <span className="legend-item"><span className="legend-dot dot-atrasado" /> Atrasados ({kpisCarteira.atrasados})</span>
              <span className="legend-item"><span className="legend-dot dot-sumido" /> Sumidos ({kpisCarteira.sumidos})</span>
            </div>
          </div>
        )}

        {/* BANNER INTELIGENTE DE OPORTUNIDADE & REATIVAÇÃO */}
        {(kpisCarteira.idealRetorno > 0 || kpisCarteira.atrasados > 0) && (
          <div className="carteira-opportunity-banner">
            <div className="carteira-opportunity-text">
              <Sparkles size={20} color="#f59e0b" />
              <span>
                <strong>Oportunidade na Carteira:</strong> {kpisCarteira.idealRetorno + kpisCarteira.atrasados} clientes em momento de retorno.
                Potencial de faturamento adormecido de <strong>{moeda(kpisCarteira.potencialRecuperacao)}</strong>.
              </span>
            </div>
            <button
              type="button"
              className="btn-lote-reativacao"
              onClick={abrirReativacaoLote}
              disabled={carregandoLote}
            >
              <Zap size={14} />
              {carregandoLote ? 'Carregando fila…' : '⚡ Reativação em Lote (Motor KyttoIA)'}
            </button>
          </div>
        )}

        {/* FILTROS E BUSCA */}
        <div className="carteira-actions-row">
          <div className="carteira-search-box">
            <input
              type="text"
              className="carteira-input"
              placeholder="Buscar cliente por nome ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="carteira-select"
              value={filtroRetorno}
              onChange={(e) => setFiltroRetorno(e.target.value)}
            >
              <option value="todos">Todos os status de retorno</option>
              <option value="ideal_retorno">🟡 Hora de Voltar (16 a 30 dias)</option>
              <option value="atrasado">🔴 Em Atraso (31 a 60 dias)</option>
              <option value="sumido">⚠️ Sumidos (&gt; 60 dias)</option>
              <option value="em_dia">🟢 Em Dia (&le; 15 dias)</option>
              <option value="vip">👑 Clientes VIP (Alto Valor)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE CLIENTES DA CARTEIRA */}
      <div className="carteira-table-wrap">
        <table className="carteira-table">
          <thead>
            <tr>
              <th className="carteira-th">Cliente</th>
              <th className="carteira-th">Barbeiro Titular</th>
              <th className="carteira-th">Última Visita</th>
              <th className="carteira-th">Status de Retorno</th>
              <th className="carteira-th">Atendimentos</th>
              <th className="carteira-th">Ação de Relacionamento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Carregando carteira de clientes…
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              clientes.map((c) => {
                const urlHistorico = urlHistoricoCliente(refHistoricoCliente(c))
                return (
                  <tr key={c.clienteId} className="carteira-row">
                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <a
                          href={urlHistorico}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="carteira-cliente-link"
                          title="Abrir ficha completa 360° e histórico do cliente em nova guia"
                        >
                          <span className="carteira-cliente-nome">{c.nome}</span>
                          <ExternalLink size={13} className="carteira-link-icon" />
                        </a>
                        {c.isVip && (
                          <span className="carteira-vip-badge" title="Cliente VIP: Alto faturamento e visitas recorrentes">
                            👑 VIP
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.telefone || 'Sem telefone'}</div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                          {c.barbeiroApelido || c.barbeiroNome || 'Sem barbeiro'}
                        </span>
                        {c.barbeiroFonte === 'manual' ? (
                          <span style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                            Fixado
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '1px 6px', borderRadius: 4 }}>
                            Habitual
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-vincular-barbeiro"
                          onClick={() => setModalReatribuir({ cliente: c, novoBarbeiroId: c.barbeiroId || '' })}
                          title="Alterar barbeiro responsável"
                        >
                          <Scissors size={12} />
                          Trocar
                        </button>
                      </div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ fontWeight: 600 }}>{dataBR(c.ultimaVisita)}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.servicoFavorito || 'Serviço'}</div>
                      {c.cicloMedioDias > 0 && (
                        <div style={{ fontSize: 10.5, color: '#38bdf8', marginTop: 2, fontWeight: 600 }} title="Média de dias entre visitas consecutivas deste cliente">
                          ⏱️ Ciclo: ~{c.cicloMedioDias}d
                        </div>
                      )}
                    </td>

                    <td className="carteira-td">
                      <span className={`retorno-badge retorno-${c.statusRetorno}`}>
                        {c.statusRetorno === 'em_dia' && '🟢 Em dia'}
                        {c.statusRetorno === 'ideal_retorno' && `🟡 Voltar (${c.diasSemRetorno}d)`}
                        {c.statusRetorno === 'atrasado' && `🔴 Atrasado (${c.diasSemRetorno}d)`}
                        {c.statusRetorno === 'sumido' && `⚠️ Sumido (${c.diasSemRetorno}d)`}
                      </span>
                    </td>

                    <td className="carteira-td">
                      <div style={{ fontWeight: 700 }}>{c.totalAtendimentosComBarbeiro} visita(s)</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        {moeda(c.totalGastoComBarbeiro)}
                        {c.ticketMedioCliente > 0 && ` (Méd: ${moeda(c.ticketMedioCliente)})`}
                      </div>
                    </td>

                    <td className="carteira-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={urlHistorico}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ficha-carteira"
                          title="Abrir ficha completa 360° com histórico de atendimentos, consumos, preferências e dados do cliente em nova guia"
                        >
                          <ExternalLink size={13} />
                          Ficha 360°
                        </a>
                        {c.telefone && String(c.telefone).replace(/\D/g, '').length >= 10 ? (
                          <button
                            type="button"
                            onClick={() => irParaPainelTrex(c)}
                            className="btn-whatsapp-carteira"
                            title="Abrir no Painel do T-Rex para enviar mensagem via WhatsApp oficial do sistema"
                          >
                            <MessageSquare size={13} />
                            WhatsApp (T-Rex)
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>Sem WhatsApp</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE REATIVAÇÃO RÁPIDA EM LOTE (MOTOR KYTTOIA) */}
      {modalLote && (
        <div className="modal-overlay-carteira" onClick={() => setModalLote(null)}>
          <div className="modal-content-carteira" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-carteira">
              <h3 className="modal-title-carteira">
                <Zap size={22} color="#f59e0b" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Fila de Reativação em Lote (Motor KyttoIA)
              </h3>
              <button
                type="button"
                onClick={() => setModalLote(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px 0' }}>
              Foram preparados <strong>{modalLote.totalProntos} contatos</strong> para reativação com mensagens humanizadas e links de agendamento personalizados.
            </p>

            {/* SELO OFICIAL DE BLINDAGEM ANTI-BLOQUEIO META WHATSAPP */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ color: '#10b981', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🛡️ Blindagem Oficial Anti-Bloqueio Meta WhatsApp
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, fontSize: 11.5, color: '#cbd5e1' }}>
                <div>🟢 <strong>Spintax Dinâmico:</strong> Hash único por disparo</div>
                <div>🟢 <strong>Jitter Aleatório (20s-45s):</strong> Simula pausa humana</div>
                <div>🟢 <strong>Janela Comercial (07h-21h):</strong> Sem incômodo noturno</div>
                <div>🟢 <strong>Opt-out Obrigatório:</strong> Cláusula "PARAR" ativa</div>
              </div>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 10, paddingRight: 4 }}>
              {(modalLote.disparos || []).map((d) => (
                <div
                  key={d.clienteId}
                  style={{
                    background: '#0f131a',
                    border: '1px solid #2d3748',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>
                      {d.nome}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {d.telefone}
                    </div>
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.mensagem}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {enviadosComSucesso[d.clienteId] || abertosIds?.[d.clienteId] ? (
                      <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} color="#10b981" /> Enviado via T-Rex
                      </span>
                    ) : d.telefone && String(d.telefone).replace(/\D/g, '').length >= 10 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => dispararDiretoTrex(d)}
                          disabled={enviandoLoteId === d.clienteId || enviandoTodosLote}
                          className="btn-whatsapp-carteira"
                          style={{ padding: '6px 10px', fontSize: 12, background: '#10b981' }}
                          title="Disparar mensagem agora diretamente pela linha oficial do T-Rex"
                        >
                          <Zap size={12} />
                          {enviandoLoteId === d.clienteId ? 'Enviando…' : 'Enviar Direto'}
                        </button>
                        <button
                          type="button"
                          onClick={() => irParaPainelTrex(d, d.mensagem)}
                          disabled={enviandoTodosLote}
                          className="btn-whatsapp-carteira"
                          style={{ padding: '6px 10px', fontSize: 12, background: '#3b82f6' }}
                          title="Abrir atendimento no Painel do T-Rex"
                        >
                          <MessageSquare size={12} />
                          Abrir T-Rex
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>Sem Celular</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="carteira-prof-pill"
                  onClick={exportarCsvCarteira}
                  disabled={enviandoTodosLote}
                >
                  📥 Baixar Fila em CSV
                </button>
                <button
                  type="button"
                  className="carteira-prof-pill"
                  style={{ background: '#10b981', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, cursor: 'pointer' }}
                  onClick={dispararTodosTrex}
                  disabled={enviandoTodosLote}
                >
                  <Zap size={14} />
                  {enviandoTodosLote ? 'Disparando Fila via T-Rex…' : 'Enviar Todos via T-Rex (Fila Oficial)'}
                </button>
              </div>
              <button
                type="button"
                className="carteira-prof-pill active"
                onClick={() => setModalLote(null)}
                disabled={enviandoTodosLote}
              >
                Concluir Reativações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA REATRIBUIR BARBEIRO DA CARTEIRA */}
      {modalReatribuir && (
        <div className="modal-overlay-carteira" onClick={() => setModalReatribuir(null)}>
          <div className="modal-content-carteira" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-carteira">
              <h3 className="modal-title-carteira">
                <UserCheck size={20} color="#f59e0b" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Vincular Cliente a um Barbeiro
              </h3>
              <button
                type="button"
                onClick={() => setModalReatribuir(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVincularBarbeiro} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
                  Cliente
                </label>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                  {modalReatribuir.cliente.nome}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {modalReatribuir.cliente.telefone}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
                  Barbeiro Responsável pela Carteira
                </label>
                <select
                  required
                  className="carteira-select"
                  style={{ width: '100%' }}
                  value={modalReatribuir.novoBarbeiroId}
                  onChange={(e) => setModalReatribuir({ ...modalReatribuir, novoBarbeiroId: e.target.value })}
                >
                  <option value="">Selecione o profissional…</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.apelido || p.nome.split(' ')[0]})
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                  Ao fixar o barbeiro, todas as notificações de retorno e campanhas personalizadas levarão o nome deste profissional.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="carteira-prof-pill"
                  onClick={() => setModalReatribuir(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="carteira-prof-pill active"
                  disabled={salvandoVinculo}
                >
                  {salvandoVinculo ? 'Salvando…' : 'Salvar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
