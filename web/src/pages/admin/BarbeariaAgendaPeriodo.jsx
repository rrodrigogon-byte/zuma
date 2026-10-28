import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import AgendaProfissionais, { iniciais, CORES_AVATAR } from './AgendaProfissionais'
import {
  hojeAgenda,
  somarDias,
  diasEntre,
  periodoMes,
  diaDoItem,
  horaDoItem,
  diaLegivel,
  diaExtenso,
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
  bloqueado: 'Bloqueado',
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

export const MODELOS_AGENDA = [
  {
    id: 'avec_colunas',
    nome: 'Avec Multi-Cadeira',
    subtitulo: 'Colunas diárias por barbeiro lado a lado',
    icone: '💈',
    badge: 'Popular',
    modo: 'dia',
    submodoDia: 'colunas',
    descricao: 'Cada barbeiro em sua própria coluna. Ideal para remanejar clientes e visualizar a equipe ao vivo.'
  },
  {
    id: 'simultaneos',
    nome: 'Horários Simultâneos',
    subtitulo: 'Matriz por hora para pais e filhos / famílias',
    icone: '⏱️',
    badge: 'Família',
    modo: 'dia',
    submodoDia: 'simultaneos',
    descricao: 'Destaque instantâneo de horários com múltiplas cadeiras livres juntas (ex.: 3 livres juntos).'
  },
  {
    id: 'semana_util',
    nome: 'Google Agenda Comercial',
    subtitulo: 'Segunda a Sábado (6 dias úteis)',
    icone: '📅',
    badge: 'Padrão',
    modo: 'semana_util',
    submodoDia: 'colunas',
    descricao: 'Grade semanal ampla estilo Google Calendar sem cortes, com cabeçalho sticky e cartões coloridos.'
  },
  {
    id: 'semana',
    nome: 'Semana Completa',
    subtitulo: 'Segunda a Domingo (7 dias corridos)',
    icone: '🗓️',
    badge: '7 Dias',
    modo: 'semana',
    submodoDia: 'colunas',
    descricao: 'Inclui domingos para acompanhamento de escalas ampliadas e plantões 24x7.'
  },
  {
    id: 'mes',
    nome: 'Visão Mensal Panorâmica',
    subtitulo: 'Calendário de 30 dias com volume de clientes',
    icone: '📆',
    badge: 'Mensal',
    modo: 'mes',
    submodoDia: 'colunas',
    descricao: 'Visão macro para planejamento mensal, folgas e tendências de ocupação por dia.'
  },
  {
    id: 'lista',
    nome: 'Fluxo de Balcão & Check-in',
    subtitulo: 'Lista cronológica por ordem de chegada',
    icone: '📋',
    badge: 'Recepção',
    modo: 'lista',
    submodoDia: 'colunas',
    descricao: 'Visualização compacta para recepção, balcão e atendimento sequencial.'
  }
]

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
  const STORAGE_KEY_MODELO = 'dino_agenda_modelo_padrao'
  const [modeloPadrao, setModeloPadrao] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MODELO) || 'semana_util'
    } catch {
      return 'semana_util'
    }
  })

  // Modo e submodo inicial respeitam o modelo salvo nas preferências do usuário
  const [modo, setModo] = useState(() => {
    if (modeloPadrao === 'avec_colunas' || modeloPadrao === 'simultaneos') return 'dia'
    if (['semana_util', 'semana', 'mes', 'lista', 'dia'].includes(modeloPadrao)) return modeloPadrao
    return 'semana_util'
  })

  const [submodoDia, setSubmodoDia] = useState(() => {
    if (modeloPadrao === 'simultaneos') return 'simultaneos'
    return 'colunas'
  })

  // Inicializa com Segunda a Sábado da semana de dataSelecionada ou hoje
  const semanaInicial = useMemo(() => semanaSegundaSabado(dataSelecionada || hoje), [])
  const [de, setDe] = useState(() => {
    if (modeloPadrao === 'avec_colunas' || modeloPadrao === 'simultaneos') return dataSelecionada || hoje
    return semanaInicial.de
  })
  const [ate, setAte] = useState(() => {
    if (modeloPadrao === 'avec_colunas' || modeloPadrao === 'simultaneos') return dataSelecionada || hoje
    return semanaInicial.ate
  })

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
  const itens = useMemo(() => {
    if (consulta?.chave !== chave) return []
    const _itens = consulta.itens || []
    const _bloqueios = []
    for (const b of (consulta.bloqueios || [])) {
      const ini = new Date(b.inicio)
      const fim = new Date(b.fim)
      const h1 = ini.toLocaleTimeString('pt-BR', {timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit'})
      const mIni = parseInt(h1.split(':')[0], 10) * 60 + parseInt(h1.split(':')[1], 10)
      const h2 = fim.toLocaleTimeString('pt-BR', {timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit'})
      let mFim = parseInt(h2.split(':')[0], 10) * 60 + parseInt(h2.split(':')[1], 10)
      if (mFim <= mIni) mFim = mIni + 60
      
      const baseItem = {
        id: b.id,
        isBloqueio: true,
        dataHora: b.inicio,
        horaLocal: h1,
        duracao: mFim - mIni,
        status: 'bloqueado',
        clienteNome: '🔒 ' + (b.titulo || 'Bloqueio'),
        servicoNome: b.motivo || 'Horário indisponível',
        profissionalId: b.profissionalId
      }
      
      if (!b.profissionalId && profissionais && profissionais.length > 0) {
         // Bloqueio geral: multiplica para todos os ativos
         for (const prof of profissionais) {
            if (prof.ativo !== false) {
               _bloqueios.push({ ...baseItem, id: b.id + '_' + prof.id, profissionalId: prof.id })
            }
         }
      } else {
         _bloqueios.push(baseItem)
      }
    }
    return [..._itens, ..._bloqueios]
  }, [consulta, chave])

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

  // Barbeiros ativos a exibir na visão diária (respeita profissionalId selecionado e filtro de visíveis)
  const barbeirosDoDia = useMemo(() => {
    if (!barbeirosAtivos || barbeirosAtivos.length === 0) return []
    if (profissionalId) {
      const ids = profissionalId.split(',').map(s => s.trim())
      return barbeirosAtivos.filter(b => ids.includes(b.id))
    }
    if (Array.isArray(visiveisIds) && visiveisIds.length > 0) {
      const setVis = new Set(visiveisIds)
      return barbeirosAtivos.filter(b => setVis.has(b.id))
    }
    return barbeirosAtivos
  }, [barbeirosAtivos, profissionalId, visiveisIds])

  // Agrupa os agendamentos do dia por barbeiro
  const agendamentosPorBarbeiroNoDia = useMemo(() => {
    const itensDoDia = porDia.get(de) || []
    const mapa = new Map()
    for (const b of barbeirosDoDia) {
      mapa.set(b.id, [])
    }
    const semBarbeiro = []

    for (const item of itensDoDia) {
      const bId = item.profissionalId || item.profissional_id
      if (bId && mapa.has(bId)) {
        mapa.get(bId).push(item)
      } else {
        const bNome = (item.profissionalNome || item.profissional_nome || '').trim().toLowerCase()
        const match = barbeirosDoDia.find(b => (b.nome || '').trim().toLowerCase() === bNome)
        if (match) {
          mapa.get(match.id).push(item)
        } else {
          semBarbeiro.push(item)
        }
      }
    }

    for (const lista of mapa.values()) {
      lista.sort((a, b) => horaDoItem(a).localeCompare(horaDoItem(b)))
    }
    semBarbeiro.sort((a, b) => horaDoItem(a).localeCompare(horaDoItem(b)))

    return { mapa, semBarbeiro }
  }, [barbeirosDoDia, porDia, de])

  // Matriz de horários para ver disponibilidades simultâneas (ex.: pais com filhos juntos)
  const gradeHorariosSimultaneos = useMemo(() => {
    const PADRAO = [
      '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45',
      '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
      '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45',
      '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00'
    ]
    const itensDoDia = porDia.get(de) || []
    const horasSet = new Set(PADRAO)
    for (const item of itensDoDia) {
      const h = horaDoItem(item)
      if (h && /^\d{2}:\d{2}$/.test(h)) horasSet.add(h)
    }
    const todasHoras = Array.from(horasSet).sort()

    function toMins(hhmm) {
      if (!hhmm) return 0
      const [h, m] = hhmm.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }

    return todasHoras.map(horaSlot => {
      const slotM = toMins(horaSlot)
      let livresJuntosCount = 0
      const statusPorBarbeiro = barbeirosDoDia.map(b => {
        const ags = agendamentosPorBarbeiroNoDia.mapa.get(b.id) || []
        const itemOcupando = ags.find(item => {
          const h = horaDoItem(item)
          if (h === horaSlot) return true
          const dur = Number(item.duracao || item.duracaoMinutos || 35)
          const iniM = toMins(h)
          const fimM = iniM + dur
          return slotM >= iniM && slotM < fimM
        })

        if (!itemOcupando) livresJuntosCount++

        return {
          barbeiro: b,
          ocupado: Boolean(itemOcupando),
          item: itemOcupando || null
        }
      })

      return {
        hora: horaSlot,
        livresCount: livresJuntosCount,
        totalBarbeiros: barbeirosDoDia.length,
        statusPorBarbeiro
      }
    })
  }, [barbeirosDoDia, agendamentosPorBarbeiroNoDia, porDia, de])

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
          bloqueios: r.bloqueios || [],
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

  const [popoverModelosAberto, setPopoverModelosAberto] = useState(false)
  const popoverModelosRef = useRef(null)

  // Fecha o popover de modelos ao clicar fora
  useEffect(() => {
    function handleClickFora(e) {
      if (popoverModelosRef.current && !popoverModelosRef.current.contains(e.target)) {
        setPopoverModelosAberto(false)
      }
    }
    if (popoverModelosAberto) {
      document.addEventListener('mousedown', handleClickFora)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFora)
    }
  }, [popoverModelosAberto])

  function selecionarModelo(modeloId) {
    const mod = MODELOS_AGENDA.find(m => m.id === modeloId)
    if (!mod) return
    if (mod.modo === 'dia') {
      escolherPeriodo(foco, foco, 'dia')
      setSubmodoDia(mod.submodoDia || 'colunas')
    } else if (mod.modo === 'semana_util') {
      const s = semanaSegundaSabado(foco)
      escolherPeriodo(s.de, s.ate, 'semana_util')
    } else if (mod.modo === 'semana') {
      const s = semanaCompleta(foco)
      escolherPeriodo(s.de, s.ate, 'semana')
    } else if (mod.modo === 'mes') {
      const p = periodoMes(foco)
      escolherPeriodo(p.de, p.ate, 'mes')
    } else if (mod.modo === 'lista') {
      escolherPeriodo(de, ate, 'lista')
    }
    setPopoverModelosAberto(false)
  }

  function salvarComoModeloPadrao(modeloId) {
    try {
      localStorage.setItem(STORAGE_KEY_MODELO, modeloId)
      setModeloPadrao(modeloId)
    } catch (_) {}
  }

  const modeloAtualId = useMemo(() => {
    if (modo === 'dia') {
      return submodoDia === 'simultaneos' ? 'simultaneos' : 'avec_colunas'
    }
    return modo
  }, [modo, submodoDia])

  const modeloAtual = useMemo(() => {
    return MODELOS_AGENDA.find(m => m.id === modeloAtualId) || MODELOS_AGENDA[2]
  }, [modeloAtualId])

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
          {/* Seletor Popover com Catálogo de Modelos de Agenda */}
          <div style={{ position: 'relative' }} ref={popoverModelosRef}>
            <button
              type="button"
              className="dino-cal-btn-modelos"
              onClick={() => setPopoverModelosAberto(v => !v)}
              aria-expanded={popoverModelosAberto}
              title="Escolha o modelo de layout desejado para a agenda"
            >
              <span>{modeloAtual.icone}</span>
              <span className="dino-cal-btn-modelos-label">{modeloAtual.nome}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
            </button>

            {popoverModelosAberto && (
              <div className="dino-cal-modelos-popover" role="dialog" aria-label="Modelos de visualização da agenda">
                <div className="dino-cal-modelos-header">
                  <div>
                    <div className="dino-cal-modelos-title">🎨 Modelos de Agenda</div>
                    <div className="dino-cal-modelos-sub">Escolha a visualização mais adequada para a sua rotina</div>
                  </div>
                  <button
                    type="button"
                    className="dino-cal-filter-close-btn"
                    onClick={() => setPopoverModelosAberto(false)}
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className="dino-cal-modelos-list">
                  {MODELOS_AGENDA.map(mod => {
                    const ativo = mod.id === modeloAtualId

                    return (
                      <button
                        type="button"
                        key={mod.id}
                        className="dino-cal-modelo-card"
                        data-ativo={ativo}
                        onClick={() => selecionarModelo(mod.id)}
                      >
                        <div className="dino-cal-modelo-icon-box">{mod.icone}</div>
                        <div className="dino-cal-modelo-content">
                          <div className="dino-cal-modelo-title-row">
                            <span className="dino-cal-modelo-name">{mod.nome}</span>
                            {mod.badge && <span className="dino-cal-modelo-badge">{mod.badge}</span>}
                            {ativo && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{mod.subtitulo}</span>
                          <span className="dino-cal-modelo-desc">{mod.descricao}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="dino-cal-modelos-footer">
                  <span>Padrão ao abrir: <strong>{MODELOS_AGENDA.find(m => m.id === modeloPadrao)?.nome || 'Semana'}</strong></span>
                  <button
                    type="button"
                    className="dino-cal-modelo-default-btn"
                    data-is-default={modeloAtualId === modeloPadrao}
                    onClick={() => salvarComoModeloPadrao(modeloAtualId)}
                    title="Salvar o modelo atualmente selecionado como preferido"
                  >
                    {modeloAtualId === modeloPadrao ? '⭐ É o seu padrão' : 'Definir atual como padrão'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botões Rápidos de Alternância de Layout */}
          <div className="dino-cal-view-selector" role="group" aria-label="Modo de visualização da agenda">
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'avec_colunas'}
              onClick={() => selecionarModelo('avec_colunas')}
              title="Colunas diárias separadas por barbeiro (Estilo Avec / Multi-cadeira)"
            >
              💈 Diário
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'simultaneos'}
              onClick={() => selecionarModelo('simultaneos')}
              title="Matriz de horários simultâneos (Famílias / Pais e Filhos)"
            >
              ⏱️ Família
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'semana_util'}
              onClick={() => selecionarModelo('semana_util')}
              title="Segunda a Sábado (6 dias úteis da barbearia - Estilo Google Calendar)"
            >
              Seg–Sáb
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'semana'}
              onClick={() => selecionarModelo('semana')}
              title="Semana completa (Segunda a Domingo)"
            >
              7 Dias
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'mes'}
              onClick={() => selecionarModelo('mes')}
              title="Visualização mensal (30 dias)"
            >
              Mês
            </button>
            <button
              type="button"
              className="dino-cal-view-btn"
              aria-pressed={modeloAtualId === 'lista'}
              onClick={() => selecionarModelo('lista')}
              title="Lista cronológica de balcão e check-in"
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
                              onClick={() => item.isBloqueio ? null : onOpenAppointment?.(item)}
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
            <div className="dino-cal-day-view-container">
              {/* Barra de Controle e Submodo da Visão do Dia */}
              <div className="dino-cal-day-header-bar">
                <div className="dino-cal-day-header-left">
                  <button
                    type="button"
                    className="dino-cal-btn-back-week"
                    onClick={() => mudarModo('semana_util')}
                    title="Retornar à visão semanal (Segunda a Sábado)"
                  >
                    ← Voltar para a Semana
                  </button>

                  <div className="dino-cal-nav-arrows">
                    <button
                      type="button"
                      className="dino-cal-arrow-btn"
                      onClick={() => navegar(-1)}
                      title="Dia anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="dino-cal-today-btn"
                      onClick={() => abrirDia(hoje)}
                      title="Ir para hoje"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className="dino-cal-arrow-btn"
                      onClick={() => navegar(1)}
                      title="Próximo dia"
                    >
                      ›
                    </button>
                  </div>

                  <div className="dino-cal-day-title-box">
                    <span className="dino-cal-day-title-main">
                      {diaExtenso(de) || diaLegivel(de)}
                    </span>
                    <span className="dino-cal-day-title-sub">
                      {(porDia.get(de) || []).length} atendimentos no dia · {barbeirosDoDia.length} barbeiro{barbeirosDoDia.length === 1 ? '' : 's'} na tela
                    </span>
                  </div>
                </div>

                <div className="dino-cal-day-header-right">
                  {/* Alternador de Visão Diária: Colunas por Barbeiro vs Horários Simultâneos */}
                  <div style={{ display: 'inline-flex', gap: 4, background: 'var(--card)', padding: 3, borderRadius: 8, border: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      className="dino-cal-day-submode-btn"
                      data-active={submodoDia === 'colunas'}
                      onClick={() => setSubmodoDia('colunas')}
                      title="Ver cada barbeiro em sua própria coluna lado a lado"
                    >
                      💈 Colunas por Barbeiro
                    </button>
                    <button
                      type="button"
                      className="dino-cal-day-submode-btn"
                      data-active={submodoDia === 'simultaneos'}
                      onClick={() => setSubmodoDia('simultaneos')}
                      title="Ver matriz horária para identificar disponibilidades simultâneas (pais e filhos / família)"
                    >
                      ⏱️ Horários Simultâneos (Família)
                    </button>
                  </div>

                  <button
                    type="button"
                    className="dino-cal-btn-novo"
                    onClick={() => onPickSlot ? onPickSlot({ data: de, hora: '09:00' }) : onNewAppointment?.()}
                  >
                    + Novo agendamento
                  </button>
                </div>
              </div>

              {/* 1. VISÃO EM COLUNAS SEPARADAS POR BARBEIRO */}
              {submodoDia === 'colunas' && (
                <div className="dino-cal-day-barbers-container">
                  <div
                    className="dino-cal-day-barbers-grid"
                    style={{
                      '--colunas-barbeiros': Math.max(1, barbeirosDoDia.length + (agendamentosPorBarbeiroNoDia.semBarbeiro.length ? 1 : 0))
                    }}
                  >
                    {barbeirosDoDia.map((barbeiro, idx) => {
                      const itensBarbeiro = agendamentosPorBarbeiroNoDia.mapa.get(barbeiro.id) || []
                      const cor = CORES_AVATAR[idx % CORES_AVATAR.length]

                      return (
                        <div key={barbeiro.id} className="dino-cal-barber-column">
                          {/* Cabeçalho da Coluna do Barbeiro */}
                          <div className="dino-cal-barber-header">
                            <div className="dino-cal-barber-profile">
                              <span
                                className="dino-cal-barber-avatar"
                                style={{ backgroundColor: cor }}
                              >
                                {barbeiro.fotoUrl ? (
                                  <img src={barbeiro.fotoUrl} alt={barbeiro.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  iniciais(barbeiro.nome)
                                )}
                              </span>
                              <div className="dino-cal-barber-info">
                                <span className="dino-cal-barber-name" title={barbeiro.nome}>
                                  {barbeiro.apelido || barbeiro.nome}
                                </span>
                                <span className="dino-cal-barber-badge">
                                  {itensBarbeiro.length} agendamento{itensBarbeiro.length === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="dino-cal-barber-add-mini"
                              onClick={() => onPickSlot ? onPickSlot({ data: de, hora: '10:00', profissionalId: barbeiro.id }) : onNewAppointment?.()}
                              title={`Agendar diretamente com ${barbeiro.nome}`}
                            >
                              + Agendar
                            </button>
                          </div>

                          {/* Corpo da Coluna: Agendamentos do Barbeiro */}
                          <div className="dino-cal-barber-body">
                            {itensBarbeiro.map(item => (
                              <button
                                type="button"
                                key={item.id}
                                className="dino-cal-event-card"
                                data-status={item.status}
                                onClick={() => item.isBloqueio ? null : onOpenAppointment?.(item)}
                                title={`Clique para gerenciar ou remanejar o agendamento de ${item.clienteNome || item.cliente_nome}`}
                              >
                                <div className="dino-cal-event-time">
                                  <span>{horaDoItem(item)}</span>
                                  <span>{formatarMoeda(item.valor)}</span>
                                </div>
                                <div className="dino-cal-event-client">
                                  {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                                </div>
                                <div className="dino-cal-event-service">
                                  {item.servicoNome || item.servico_nome || 'Serviço'}
                                </div>
                                <div className="dino-cal-event-footer">
                                  {item.origem === 'whatsapp_ia' && (
                                    <span className="dino-cal-event-wpp-badge">🤖 WhatsApp IA</span>
                                  )}
                                  <span className="dino-cal-event-status-badge">
                                    {STATUS[item.status] || item.status}
                                  </span>
                                </div>
                              </button>
                            ))}

                            {itensBarbeiro.length === 0 && (
                              <div className="dino-cal-barber-empty">
                                <span style={{ fontSize: 28 }}>💈</span>
                                <strong>Cadeira livre no dia</strong>
                                <p style={{ margin: 0 }}>Nenhum atendimento marcado para {barbeiro.nome} nesta data.</p>
                                <button
                                  type="button"
                                  className="dino-cal-free-slot-btn"
                                  style={{ marginTop: 8 }}
                                  onClick={() => onPickSlot ? onPickSlot({ data: de, hora: '09:00', profissionalId: barbeiro.id }) : onNewAppointment?.()}
                                >
                                  + Agendar horário
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Coluna de Atendimentos Sem Barbeiro Especificado (se houver) */}
                    {agendamentosPorBarbeiroNoDia.semBarbeiro.length > 0 && (
                      <div className="dino-cal-barber-column" style={{ borderColor: '#f59e0b' }}>
                        <div className="dino-cal-barber-header" style={{ background: 'color-mix(in srgb, #f59e0b 12%, var(--card))' }}>
                          <div className="dino-cal-barber-profile">
                            <span className="dino-cal-barber-avatar" style={{ backgroundColor: '#f59e0b' }}>
                              ✂️
                            </span>
                            <div className="dino-cal-barber-info">
                              <span className="dino-cal-barber-name">Geral / Sem Barbeiro</span>
                              <span className="dino-cal-barber-badge">
                                {agendamentosPorBarbeiroNoDia.semBarbeiro.length} para alocar
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="dino-cal-barber-body">
                          {agendamentosPorBarbeiroNoDia.semBarbeiro.map(item => (
                            <button
                              type="button"
                              key={item.id}
                              className="dino-cal-event-card"
                              data-status={item.status}
                              onClick={() => item.isBloqueio ? null : onOpenAppointment?.(item)}
                              title="Clique para designar um barbeiro ou remanejar"
                            >
                              <div className="dino-cal-event-time">
                                <span>{horaDoItem(item)}</span>
                                <span>{formatarMoeda(item.valor)}</span>
                              </div>
                              <div className="dino-cal-event-client">
                                {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                              </div>
                              <div className="dino-cal-event-service">
                                {item.servicoNome || item.servico_nome || 'Serviço'}
                              </div>
                              <div className="dino-cal-event-footer">
                                <span className="dino-cal-event-status-badge">
                                  {STATUS[item.status] || item.status}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. VISÃO EM MATRIZ DE HORÁRIOS SIMULTÂNEOS (FAMÍLIA / PAIS E FILHOS) */}
              {submodoDia === 'simultaneos' && (
                <div className="dino-cal-simultaneous-container" style={{ position: 'relative' }}>
                  <table className="dino-cal-simultaneous-table">
                    <thead>
                      <tr>
                        <th style={{ width: 80, textAlign: 'center' }}>Horário</th>
                        <th style={{ width: 170 }}>Disponibilidade</th>
                        {barbeirosDoDia.map(b => (
                          <th key={b.id} style={{ minWidth: 160 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13 }}>💈</span>
                              <span>{b.apelido || b.nome}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gradeHorariosSimultaneos.map(linha => {
                        const nivel = linha.livresCount >= 2 ? 'high' : linha.livresCount === 1 ? 'medium' : 'low'
                        return (
                          <tr key={linha.hora}>
                            <td className="dino-cal-slot-time-cell">
                              {linha.hora === horarioAtualStr && (
                                 <div className="dino-cal-current-time-line" style={{ top: `${topPercentOffset}%`, width: 'calc(100vw - 40px)' }} />
                              )}
                              {linha.hora}
                            </td>
                            <td className="dino-cal-slot-avail-cell">
                              <span className="dino-cal-avail-tag" data-level={nivel}>
                                {linha.livresCount >= 2 && `👨‍👦 ${linha.livresCount} livres juntos`}
                                {linha.livresCount === 1 && `🟡 1 cadeira livre`}
                                {linha.livresCount === 0 && `⚪ Lotação máxima`}
                              </span>
                            </td>
                            {linha.statusPorBarbeiro.map(stat => (
                              <td key={stat.barbeiro.id}>
                                {stat.ocupado && stat.item ? (
                                  <button
                                    type="button"
                                    className="dino-cal-slot-busy-pill"
                                    onClick={() => stat.item.isBloqueio ? null : onOpenAppointment?.(stat.item)}
                                    title={`Ocupado: ${stat.item.clienteNome || stat.item.cliente_nome} - ${stat.item.servicoNome || stat.item.servico_nome} (Clique para detalhes ou remanejamento)`}
                                  >
                                    <span className="dino-cal-slot-busy-pill-name">
                                      👤 {stat.item.clienteNome || stat.item.cliente_nome || 'Cliente'}
                                    </span>
                                    <span className="dino-cal-slot-busy-pill-srv">
                                      {stat.item.servicoNome || stat.item.servico_nome || 'Serviço'} · {horaDoItem(stat.item)}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="dino-cal-free-slot-btn"
                                    onClick={() => onPickSlot ? onPickSlot({ data: de, hora: linha.hora, profissionalId: stat.barbeiro.id }) : onNewAppointment?.()}
                                    title={`Livre às ${linha.hora} para ${stat.barbeiro.nome}. Clique para agendar!`}
                                  >
                                    + Livre
                                  </button>
                                )}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
                            onClick={() => item.isBloqueio ? null : onOpenAppointment?.(item)}
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
