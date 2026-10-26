import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import AgendaProfissionais from './AgendaProfissionais'
import {
  hojeAgenda,
  somarDias,
  diasEntre,
  periodoMes,
  diaDoItem,
  horaDoItem,
  diaLegivel,
  filtrarAgenda,
  inicioDaSemana,
  semanaSegundaSabado,
  semanaCompleta,
  mesAnoLegivel,
  diaSemanaCurto,
  diaNumero
} from '../../lib/barbearia-calendar'
import './BarbeariaAgendaPeriodo.css'

const STATUS = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  nao_compareceu: 'Não compareceu'
}

const ORIGEM = {
  whatsapp_ia: 'WhatsApp IA',
  publico: 'Link público',
  online: 'Link público',
  admin: 'Recepção',
  avec: 'Histórico Avec'
}

const WEEK_NAMES = {
  0: 'DOM',
  1: 'SEG',
  2: 'TER',
  3: 'QUA',
  4: 'QUI',
  5: 'SEX',
  6: 'SÁB'
}

function formatarMoeda(val) {
  const n = Number(val || 0)
  return n > 0 ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
}

export default function BarbeariaAgendaPeriodo({
  profissionais = [],
  servicos = [],
  profissionalId = '',
  onProfissionalChange,
  onOpenAppointment,
  onPickSlot,
  refreshKey = 0,
  dataSelecionada,
  onDateChange,
  statusFiltro = '',
  onNewAppointment
}) {
  const hoje = hojeAgenda()
  // Modo padrão: 'semana_util' = Segunda a Sábado (6 dias úteis da barbearia, conforme solicitado)
  const [modo, setModo] = useState('semana_util')

  // Inicializa com Segunda a Sábado da semana de dataSelecionada ou hoje
  const semanaInicial = useMemo(() => semanaSegundaSabado(dataSelecionada || hoje), [])
  const [de, setDe] = useState(semanaInicial.de)
  const [ate, setAte] = useState(semanaInicial.ate)

  const [busca, setBusca] = useState('')
  const [consulta, setConsulta] = useState(null)
  const [erro, setErro] = useState('')
  const [atualizacao, setAtualizacao] = useState(0)
  const [servicoId, setServicoId] = useState('')
  const [livres, setLivres] = useState(null)
  const [erroLivres, setErroLivres] = useState('')
  const [buscando, setBuscando] = useState(false)
  const pedidoLivres = useRef(0)

  const foco = dataSelecionada || de
  const dias = useMemo(() => diasEntre(de, ate), [de, ate])

  // Filtra APENAS profissionais ativos (elimina inativos e excluídos da visão da agenda)
    // Filtra APENAS profissionais ativos (elimina inativos e excluídos da visão da agenda)
  const barbeirosAtivos = useMemo(() => {
    return (profissionais || []).filter(p => p && p.ativo !== false && !p.removidoEm && !p.excluido)
  }, [profissionais])

  // Filtro de profissionais que queremos exibir na tela (com persistência no localStorage)
  const STORAGE_KEY_VISIVEIS = 'dino_agenda_profissionais_visiveis'
  const [visiveisIds, setVisiveisIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VISIVEIS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (_) {}
    return []
  })

  // Sincroniza quando os barbeiros ativos carregam
  useEffect(() => {
    if ((!visiveisIds || visiveisIds.length === 0) && barbeirosAtivos.length > 0) {
      setVisiveisIds(barbeirosAtivos.map(p => p.id))
    }
  }, [barbeirosAtivos])

  function handleVisiveisChange(novosIds) {
    setVisiveisIds(novosIds)
    try {
      localStorage.setItem(STORAGE_KEY_VISIVEIS, JSON.stringify(novosIds))
    } catch (_) {}
  }

  const chave = JSON.stringify([de, ate, profissionalId, refreshKey, atualizacao])
  const chaveLivres = JSON.stringify([de, ate, profissionalId, servicoId, refreshKey, atualizacao])
  const contextoAtual = useRef(chaveLivres)
  contextoAtual.current = chaveLivres
  const carregando = dias.length > 0 && consulta?.chave !== chave && !erro
  const itens = consulta?.chave === chave ? consulta.itens : []

  // Filtra itens por busca, status e APENAS os profissionais marcados para exibição na tela!
  const visiveis = useMemo(() => {
    let filtrados = itens
    if (profissionalId) {
      const idsFiltro = profissionalId.split(',').map(s => s.trim())
      filtrados = filtrados.filter(item => !item.profissionalId || idsFiltro.includes(item.profissionalId))
    } else if (Array.isArray(visiveisIds) && visiveisIds.length > 0) {
      const setVisiveis = new Set(visiveisIds)
      filtrados = filtrados.filter(item => {
        if (!item.profissionalId) return true
        return setVisiveis.has(item.profissionalId)
      })
    }
    return filtrarAgenda(filtrados, { busca, status: statusFiltro })
  }, [itens, profissionalId, visiveisIds, busca, statusFiltro])
  const porDia = useMemo(() => {
    const mapa = new Map(dias.map(d => [d, []]))
    for (const item of visiveis) {
      const d = diaDoItem(item)
      if (mapa.has(d)) mapa.get(d).push(item)
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => horaDoItem(a).localeCompare(horaDoItem(b)))
    }
    return mapa
  }, [dias, visiveis])

  // Sincroniza quando dataSelecionada muda externamente
  useEffect(() => {
    if (!dataSelecionada || (dataSelecionada >= de && dataSelecionada <= ate)) return
    if (modo === 'mes') {
      const p = periodoMes(dataSelecionada)
      setDe(p.de); setAte(p.ate)
    } else if (modo === 'semana_util') {
      const s = semanaSegundaSabado(dataSelecionada)
      setDe(s.de); setAte(s.ate)
    } else if (modo === 'semana') {
      const s = semanaCompleta(dataSelecionada)
      setDe(s.de); setAte(s.ate)
    } else {
      setDe(dataSelecionada); setAte(dataSelecionada)
    }
  }, [dataSelecionada])

  // Busca agendamentos do backend
  useEffect(() => {
    let ativo = true
    setErro('')
    if (!dias.length) { setErro('Escolha um período válido de até 62 dias.'); return }
    const q = new URLSearchParams({ de, ate })
    if (profissionalId) q.set('profissionalId', profissionalId)

    lerAgenda(() => api.get(`/api/admin/barbearia/agenda-periodo?${q}`), { ativo: () => ativo }).then(r => {
      const historico = (r?.historico || []).map(item => ({ ...item, horaLocal: item.hora || '' }))
      if (ativo && r) {
        setConsulta({
          chave,
          itens: [...(r.itens || []), ...historico],
          horario: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba' })
        })
      }
    }).catch(e => {
      if (ativo) setErro(erroAgenda(e))
    })
    return () => { ativo = false }
  }, [chave])

  useEffect(() => {
    pedidoLivres.current++
    setLivres(null)
    setErroLivres('')
    setBuscando(false)
  }, [chaveLivres])

  function escolherPeriodo(inicio, fim, novoModo = modo) {
    setDe(inicio)
    setAte(fim)
    setModo(novoModo)
    onDateChange?.(inicio)
  }

  function mudarModo(novo) {
    if (novo === 'semana_util') {
      const s = semanaSegundaSabado(foco)
      escolherPeriodo(s.de, s.ate, novo)
    } else if (novo === 'semana') {
      const s = semanaCompleta(foco)
      escolherPeriodo(s.de, s.ate, novo)
    } else if (novo === 'dia') {
      escolherPeriodo(foco, foco, novo)
    } else if (novo === 'mes') {
      const p = periodoMes(foco)
      escolherPeriodo(p.de, p.ate, novo)
    } else {
      setModo(novo)
    }
  }

  function irParaHoje() {
    if (modo === 'semana_util') {
      const s = semanaSegundaSabado(hoje)
      escolherPeriodo(s.de, s.ate, modo)
    } else if (modo === 'semana') {
      const s = semanaCompleta(hoje)
      escolherPeriodo(s.de, s.ate, modo)
    } else if (modo === 'mes') {
      const p = periodoMes(hoje)
      escolherPeriodo(p.de, p.ate, modo)
    } else {
      escolherPeriodo(hoje, hoje, modo)
    }
  }

  function navegar(sentido) {
    if (modo === 'mes') {
      const p = periodoMes(de, sentido)
      escolherPeriodo(p.de, p.ate, modo)
    } else if (modo === 'dia') {
      const prox = somarDias(de, sentido)
      escolherPeriodo(prox, prox, modo)
    } else if (modo === 'semana_util' || modo === 'semana') {
      const salto = 7 * sentido
      escolherPeriodo(somarDias(de, salto), somarDias(ate, salto), modo)
    } else {
      const salto = Math.max(1, dias.length) * sentido
      escolherPeriodo(somarDias(de, salto), somarDias(ate, salto), modo)
    }
  }

  async function buscarLivres() {
    if (!servicoId || !dias.length || dias.length > 14) return
    const pedido = ++pedidoLivres.current
    const contexto = chaveLivres
    setBuscando(true); setLivres(null); setErroLivres('')
    const q = new URLSearchParams({ servicoId, de, ate })
    if (profissionalId) q.set('profissionalId', profissionalId)
    try {
      const r = await lerAgenda(() => api.get(`/api/admin/barbearia/horarios-livres?${q}`), {
        ativo: () => pedido === pedidoLivres.current && contexto === contextoAtual.current
      })
      if (r && pedido === pedidoLivres.current && contexto === contextoAtual.current) {
        setLivres({ ...r, contexto, servicoId })
      }
    } catch (e) {
      if (pedido === pedidoLivres.current) setErroLivres(erroAgenda(e))
    } finally {
      if (pedido === pedidoLivres.current) setBuscando(false)
    }
  }

  const vagas = livres?.contexto === chaveLivres ? livres : null
  const totalVagas = (vagas?.itens || []).reduce((n, item) => n + item.horarios.length, 0)
  const recuo = dias.length ? (new Date(`${de}T12:00:00Z`).getUTCDay() + 6) % 7 : 0

  const abrirDia = dia => {
    if (onDateChange) onDateChange(dia)
    escolherPeriodo(dia, dia, 'dia')
  }

  // Nome do profissional selecionado para o título
  const profissionalAtivoNome = useMemo(() => {
    if (!profissionalId) return 'Toda a equipe'
    const ids = profissionalId.split(',').map(s => s.trim())
    if (ids.length === 1) {
      const p = profissionais.find(item => item.id === ids[0])
      return p ? p.nome : 'Profissional'
    }
    return `${ids.length} profissionais selecionados`
  }, [profissionalId, profissionais])

  // Subtítulo do período legível
  const subtituloPeriodo = useMemo(() => {
    if (modo === 'dia') return diaLegivel(de)
    if (modo === 'semana_util') return `${diaLegivel(de)} – ${diaLegivel(ate)} (Segunda a Sábado)`
    if (modo === 'semana') return `${diaLegivel(de)} – ${diaLegivel(ate)} (Semana Completa)`
    if (modo === 'mes') return mesAnoLegivel(de)
    return `${diaLegivel(de)} a ${diaLegivel(ate)}`
  }, [modo, de, ate])

  return (
    <section className="dino-cal" aria-label="Agenda visual da Barbearia Dino">
      {/* 1. CABEÇALHO SUPERIOR ESTILO GOOGLE AGENDAR */}
      <header className="dino-cal-google-header">
        {/* Controles de Navegação (Hoje, <, >, Título) */}
        <div className="dino-cal-left-controls">
          <button
            type="button"
            className="dino-cal-today-btn"
            onClick={irParaHoje}
            title="Ir para a semana de hoje"
          >
            Hoje
          </button>

          <div className="dino-cal-nav-arrows">
            <button
              type="button"
              className="dino-cal-arrow-btn"
              aria-label="Período anterior"
              onClick={() => navegar(-1)}
              disabled={!dias.length}
              title="Período anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="dino-cal-arrow-btn"
              aria-label="Próximo período"
              onClick={() => navegar(1)}
              disabled={!dias.length}
              title="Próximo período"
            >
              ›
            </button>
          </div>

          <div className="dino-cal-date-headline">
            <div className="dino-cal-headline-main">
              {mesAnoLegivel(de) || 'Agenda'}
            </div>
            <div className="dino-cal-headline-sub">
              {subtituloPeriodo} · <strong style={{ color: 'var(--text)' }}>{profissionalAtivoNome}</strong>
            </div>
          </div>
        </div>

        {/* Busca rápida de agendamento */}
        <div className="dino-cal-center-search">
          <span className="dino-cal-search-icon">🔍</span>
          <input
            type="search"
            className="dino-cal-search-input"
            placeholder="Buscar cliente, serviço..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="dino-cal-search-clear"
              onClick={() => setBusca('')}
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Ações da Direita: Seleção de Modo + Botão Novo Agendamento */}
        <div className="dino-cal-right-actions">
          <div className="dino-cal-view-selector" role="group" aria-label="Modo de visualização da agenda">
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modo === 'semana_util'}
              onClick={() => mudarModo('semana_util')}
              title="Segunda a Sábado (6 dias úteis da barbearia)"
            >
              Seg–Sáb
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modo === 'semana'}
              onClick={() => mudarModo('semana')}
              title="Semana completa (Segunda a Domingo)"
            >
              Semana
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modo === 'dia'}
              onClick={() => mudarModo('dia')}
              title="Visualização diária detalhada"
            >
              Dia
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modo === 'mes'}
              onClick={() => mudarModo('mes')}
              title="Visualização mensal"
            >
              Mês
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modo === 'lista'}
              onClick={() => mudarModo('lista')}
              title="Lista cronológica por período"
            >
              Lista
            </button>
          </div>

          <button
            type="button"
            className="dino-cal-btn-novo"
            onClick={() => onPickSlot ? onPickSlot({ data: dataSelecionada || hoje, hora: '09:00' }) : onNewAppointment?.()}
            title="Agendar novo atendimento"
          >
            <span>+</span> Agendar
          </button>

          <button
            type="button"
            className="dino-cal-btn-refresh"
            onClick={() => { setErro(''); setAtualizacao(n => n + 1) }}
            title="Atualizar dados da agenda"
          >
            ↻
          </button>
        </div>
      </header>

      {/* 2. BARRA SUPERIOR DE BARBEIROS (TOP BAR COM FILTRO DE PROFISSIONAIS NA TELA) */}
      <AgendaProfissionais
        profissionais={barbeirosAtivos}
        value={profissionalId}
        onChange={onProfissionalChange}
        visiveisIds={visiveisIds}
        onVisiveisIdsChange={handleVisiveisChange}
        label="Barbeiros na agenda"
        mostrarContador={true}
      />

      {/* 3. RESUMO RÁPIDO DO PERÍODO */}
      <div className="dino-cal-summary-bar">
        <div className="dino-cal-summary-counters">
          <div>
            <strong>{visiveis.length}</strong> <span>atendimento{visiveis.length === 1 ? '' : 's'} no período</span>
          </div>
          <div>
            <strong>{visiveis.filter(i => i.status === 'confirmado').length}</strong> <span>confirmado(s)</span>
          </div>
          <div>
            <strong>{visiveis.filter(i => i.status === 'em_atendimento').length}</strong> <span>em atendimento</span>
          </div>
          <div>
            <strong>{visiveis.filter(i => i.origem === 'whatsapp_ia').length}</strong> <span>pelo WhatsApp IA</span>
          </div>
        </div>

        <div className="dino-cal-summary-meta">
          {carregando ? (
            <em>Atualizando agenda em tempo real…</em>
          ) : erro ? (
            <span role="alert" style={{ color: '#ef4444' }}>{erro}</span>
          ) : (
            <span>Última sincronização às {consulta?.horario || 'agora'}</span>
          )}
        </div>
      </div>

      {/* 4. GRADE PRINCIPAL DO CALENDÁRIO */}
      {!carregando && !erro && (
        <>
          {/* Seletor rápido de dias para telas compactas / split view */}
          {(modo === 'semana_util' || modo === 'semana') && (
            <div className="dino-cal-mobile-days-strip">
              {dias.map(d => {
                const itensCount = (porDia.get(d) || []).length
                const dt = new Date(`${d}T12:00:00Z`)
                const label = WEEK_NAMES[dt.getUTCDay()] || diaSemanaCurto(d)
                const num = diaNumero(d)
                const isToday = d === hoje
                const isSelected = foco === d
                return (
                  <button
                    key={d}
                    type="button"
                    className="dino-cal-mobile-day-pill"
                    data-today={isToday}
                    data-selected={isSelected}
                    onClick={() => {
                      const colEl = document.getElementById(`col-dia-${d}`)
                      if (colEl) colEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                    }}
                    title={`Ver atendimentos de ${label} ${num}`}
                  >
                    <span className="dino-cal-mobile-day-name">{label}</span>
                    <span className="dino-cal-mobile-day-num">{num}</span>
                    <span className="dino-cal-mobile-day-count">{itensCount}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* MODO SEMANA (SEG–SÁB OU SEG–DOM) */}
          {(modo === 'semana_util' || modo === 'semana') && (
            <div className="dino-cal-week-container">
              <div
                className="dino-cal-week-grid"
                style={{ '--colunas-semana': dias.length }}
              >
                {dias.map(dia => {
                  const itensDia = porDia.get(dia) || []
                  const eHoje = dia === hoje
                  const selecionado = foco === dia
                  const dt = new Date(`${dia}T12:00:00Z`)
                  const diaSemanaLabel = WEEK_NAMES[dt.getUTCDay()] || diaSemanaCurto(dia)
                  const diaNum = diaNumero(dia)

                  return (
                    <div
                      key={dia}
                      id={`col-dia-${dia}`}
                      className="dino-cal-day-column"
                      data-today={eHoje}
                      data-selected={selecionado}
                    >
                      {/* Cabeçalho do Dia (SEG 26) com destaque para Hoje */}
                      <button
                        type="button"
                        className="dino-cal-day-header"
                        onClick={() => abrirDia(dia)}
                        title={`Clique para abrir o dia ${diaLegivel(dia)} em detalhe`}
                      >
                        <span className="dino-cal-day-weekday">{diaSemanaLabel}</span>
                        <span className="dino-cal-day-number">{diaNum}</span>
                        <span className="dino-cal-day-count-badge">
                          {itensDia.length} atendimento{itensDia.length === 1 ? '' : 's'}
                        </span>
                      </button>

                      {/* Lista de Atendimentos do Dia (Event Cards estilo Google Agenda) */}
                      <div className="dino-cal-day-body">
                        {itensDia.map(item => {
                          const hora = horaDoItem(item)
                          const valorFormatado = formatarMoeda(item.valor)

                          if (item.historico) {
                            return (
                              <div
                                key={item.id}
                                className="dino-cal-event-card"
                                data-historico="avec"
                                data-status={item.status}
                                title={`Histórico Avec · comanda ${item.numeroComanda || 's/n'}`}
                              >
                                <div className="dino-cal-event-time">
                                  <span>{item.hora ? `${item.hora}*` : 'Concluído'}</span>
                                  {valorFormatado && <span className="dino-cal-event-val">{valorFormatado}</span>}
                                </div>
                                <div className="dino-cal-event-client">
                                  {item.clienteNome || 'Cliente sem nome'}
                                </div>
                                <div className="dino-cal-event-service">
                                  {item.servicoNome || 'Serviço histórico'}
                                </div>
                                <div className="dino-cal-event-footer">
                                  <span className="dino-cal-event-prof-pill">
                                    {item.profissionalNome || 'Profissional'}
                                  </span>
                                  <span style={{ color: 'var(--muted)', fontSize: 10 }}>Avec</span>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <button
                              type="button"
                              key={item.id}
                              className="dino-cal-event-card"
                              data-status={item.status}
                              onClick={() => onOpenAppointment?.(item)}
                              title={`Abrir agendamento: ${item.clienteNome || 'Cliente'} às ${hora}`}
                            >
                              <div className="dino-cal-event-time">
                                <span>{hora || '00:00'}</span>
                                {valorFormatado && <span className="dino-cal-event-val">{valorFormatado}</span>}
                              </div>
                              <div className="dino-cal-event-client">
                                {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                              </div>
                              <div className="dino-cal-event-service">
                                {item.servicoNome || item.servico_nome || 'Serviço'}
                              </div>
                              <div className="dino-cal-event-footer">
                                {!profissionalId && (
                                  <span className="dino-cal-event-prof-pill">
                                    💈 {item.profissionalNome || item.profissional_nome || 'Barbeiro'}
                                  </span>
                                )}
                                {item.origem === 'whatsapp_ia' && (
                                  <span className="dino-cal-event-wpp-badge" title="Agendado pela IA no WhatsApp">
                                    🤖 IA
                                  </span>
                                )}
                                <span className="dino-cal-event-status-badge" style={{ color: 'var(--text)' }}>
                                  {STATUS[item.status] || item.status}
                                </span>
                              </div>
                            </button>
                          )
                        })}

                        {itensDia.length === 0 && (
                          <div className="dino-cal-day-empty">
                            <span className="dino-cal-day-empty-icon">☕</span>
                            <span>Nenhum atendimento</span>
                            <button
                              type="button"
                              className="dino-cal-day-add-btn"
                              onClick={() => onPickSlot ? onPickSlot({ data: dia, hora: '09:00' }) : onNewAppointment?.()}
                            >
                              + Agendar neste dia
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* MODO DIA */}
          {modo === 'dia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{diaLegivel(de)}</h3>
                  <small style={{ color: 'var(--muted)' }}>{(porDia.get(de) || []).length} atendimentos registrados para este dia</small>
                </div>
                <button
                  type="button"
                  className="dino-cal-btn-novo"
                  onClick={() => onPickSlot ? onPickSlot({ data: de, hora: '09:00' }) : onNewAppointment?.()}
                >
                  + Agendar neste dia
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {(porDia.get(de) || []).map(item => (
                  <button
                    type="button"
                    key={item.id}
                    className="dino-cal-event-card"
                    data-status={item.status}
                    style={{ padding: 14 }}
                    onClick={() => onOpenAppointment?.(item)}
                  >
                    <div className="dino-cal-event-time" style={{ fontSize: 13 }}>
                      <span>{horaDoItem(item)}</span>
                      <span>{formatarMoeda(item.valor)}</span>
                    </div>
                    <div className="dino-cal-event-client" style={{ fontSize: 15, marginTop: 4 }}>
                      {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                    </div>
                    <div className="dino-cal-event-service" style={{ fontSize: 13, marginTop: 2 }}>
                      {item.servicoNome || item.servico_nome || 'Serviço'}
                    </div>
                    <div className="dino-cal-event-footer" style={{ marginTop: 8 }}>
                      <span className="dino-cal-event-prof-pill">💈 {item.profissionalNome || item.profissional_nome || 'Barbeiro'}</span>
                      {item.origem === 'whatsapp_ia' && <span className="dino-cal-event-wpp-badge">🤖 WhatsApp IA</span>}
                      <span className="dino-cal-event-status-badge">{STATUS[item.status] || item.status}</span>
                    </div>
                  </button>
                ))}
                {!(porDia.get(de) || []).length && (
                  <div className="dino-cal-day-empty" style={{ padding: 48, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                    <span className="dino-cal-day-empty-icon" style={{ fontSize: 36 }}>📅</span>
                    <strong style={{ fontSize: 15, marginTop: 8 }}>Nenhum atendimento para {diaLegivel(de)}</strong>
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Clique abaixo para agendar um atendimento para este dia.</p>
                    <button
                      type="button"
                      className="dino-cal-btn-novo"
                      style={{ marginTop: 12 }}
                      onClick={() => onPickSlot ? onPickSlot({ data: de, hora: '09:00' }) : onNewAppointment?.()}
                    >
                      + Novo agendamento
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODO MÊS */}
          {modo === 'mes' && (
            <div className="dino-cal-week-container">
              <div className="dino-cal-month-grid">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="dino-cal-month-weekday-header">{d}</div>
                ))}
                {Array.from({ length: recuo }, (_, i) => (
                  <div key={`pad-${i}`} style={{ background: 'transparent' }} />
                ))}
                {dias.map(dia => {
                  const itensDia = porDia.get(dia) || []
                  const eHoje = dia === hoje
                  return (
                    <div
                      key={dia}
                      className="dino-cal-month-cell"
                      data-today={eHoje}
                      onClick={() => abrirDia(dia)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="dino-cal-month-cell-header">
                        <span className="dino-cal-month-date-num">{diaNumero(dia)}</span>
                        {itensDia.length > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
                            {itensDia.length}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                        {itensDia.slice(0, 3).map(it => (
                          <div
                            key={it.id}
                            style={{
                              fontSize: 10.5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              padding: '2px 4px',
                              borderRadius: 4,
                              background: 'color-mix(in srgb, var(--accent) 12%, var(--card))',
                              color: 'var(--text)'
                            }}
                          >
                            <strong>{horaDoItem(it)}</strong> {it.clienteNome || 'Cliente'}
                          </div>
                        ))}
                        {itensDia.length > 3 && (
                          <small style={{ color: 'var(--muted)', fontSize: 10 }}>+{itensDia.length - 3} mais</small>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* MODO LISTA */}
          {modo === 'lista' && (
            <div className="dino-cal-list-container">
              {dias.map(dia => {
                const itensDia = porDia.get(dia) || []
                return (
                  <div key={dia} className="dino-cal-list-day-section">
                    <div className="dino-cal-list-day-title">
                      {diaLegivel(dia)} · {itensDia.length} atendimento{itensDia.length === 1 ? '' : 's'}
                    </div>
                    {itensDia.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                        {itensDia.map(item => (
                          <button
                            type="button"
                            key={item.id}
                            className="dino-cal-event-card"
                            data-status={item.status}
                            onClick={() => onOpenAppointment?.(item)}
                          >
                            <div className="dino-cal-event-time">
                              <span>{horaDoItem(item)}</span>
                              <span>{formatarMoeda(item.valor)}</span>
                            </div>
                            <div className="dino-cal-event-client">{item.clienteNome || 'Cliente sem nome'}</div>
                            <div className="dino-cal-event-service">{item.servicoNome || 'Serviço'}</div>
                            <div className="dino-cal-event-footer">
                              <span className="dino-cal-event-prof-pill">💈 {item.profissionalNome || 'Barbeiro'}</span>
                              <span className="dino-cal-event-status-badge">{STATUS[item.status] || item.status}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0' }}>Sem atendimentos cadastrados para este dia.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 5. GAVETA INFERIOR: ENCONTRE O PRÓXIMO HORÁRIO LIVRE */}
      <div className="dino-cal-availability-drawer">
        <div className="dino-cal-avail-header">
          <div>
            <h4 className="dino-cal-avail-title">⚡ Encontre o Próximo Horário Livre</h4>
            <p className="dino-cal-avail-subtitle">
              Consulte horários disponíveis por serviço considerando a jornada de cada barbeiro ativo.
            </p>
          </div>
          <div className="dino-cal-avail-controls">
            <select
              className="dino-cal-avail-select"
              value={servicoId}
              onChange={e => setServicoId(e.target.value)}
            >
              <option value="">Selecione um serviço...</option>
              {servicos.filter(s => s.ativo !== false).map(s => (
                <option key={s.id} value={s.id}>{s.nome} ({s.duracaoMinutos || 30} min)</option>
              ))}
            </select>
            <button
              type="button"
              className="dino-cal-avail-search-btn"
              disabled={buscando || !servicoId || !dias.length || dias.length > 14}
              onClick={buscarLivres}
            >
              {buscando ? 'Consultando vagas…' : 'Buscar vagas'}
            </button>
          </div>
        </div>

        {dias.length > 14 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            Para consulta instantânea de vagas, o filtro cobre até 14 dias.
          </p>
        )}

        {erroLivres && <p role="alert" style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{erroLivres}</p>}

        {vagas && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              🎯 {totalVagas} horários livres encontrados entre {diaLegivel(de)} e {diaLegivel(ate)}:
            </div>
            <div className="dino-cal-slots-grid">
              {vagas.itens.filter(l => l.horarios.length > 0).map(l => (
                <div key={`${l.data}-${l.profissionalId}`} className="dino-cal-slot-group">
                  <div className="dino-cal-slot-group-title">
                    {diaLegivel(l.data)} · 💈 {l.profissionalNome} ({l.horarios.length} vagas)
                  </div>
                  <div className="dino-cal-slot-chips">
                    {l.horarios.map(h => (
                      <button
                        type="button"
                        key={h}
                        className="dino-cal-slot-chip"
                        onClick={() => {
                          if (vagas.contexto === contextoAtual.current) {
                            onPickSlot?.({
                              data: l.data,
                              hora: h,
                              profissionalId: l.profissionalId,
                              servicoId: vagas.servicoId
                            })
                          }
                        }}
                        title={`Agendar com ${l.profissionalNome} às ${h}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
