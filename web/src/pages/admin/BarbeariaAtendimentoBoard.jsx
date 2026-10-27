import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  GripVertical,
  Clock,
  CheckCircle2,
  Play,
  Check,
  User,
  MessageSquare,
  Receipt,
  Scissors,
  MoreVertical,
  Calendar,
  Search,
  Plus,
  ArrowRight,
  AlertCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  UserX,
  XCircle,
  Sparkles,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Flame,
  Zap,
  RefreshCw,
  Printer,
  Package,
  ShoppingBag,
} from 'lucide-react'
import { fmtR } from '../../lib/api'
import { hojeAgenda } from '../../lib/barbearia-calendar'
import './BarbeariaAtendimentoBoard.css'

const COLUNAS_KANBAN = [
  { id: 'agendado', label: 'Agendado', color: '#3b82f6', bgDot: '#3b82f6', icon: Calendar, hint: 'Horários marcados aguardando' },
  { id: 'confirmado', label: 'Confirmado', color: '#10b981', bgDot: '#10b981', icon: CheckCircle2, hint: 'Cliente confirmou presença' },
  { id: 'em_atendimento', label: 'Em Atendimento', color: '#f59e0b', bgDot: '#f59e0b', icon: Scissors, hint: 'Cliente na cadeira agora' },
  { id: 'concluido', label: 'Concluído', color: '#10b981', bgDot: '#10b981', icon: Check, hint: 'Serviço finalizado' },
]

const ACOES_PRINCIPAIS = {
  agendado: { label: 'Confirmar', next: 'confirmado', icon: CheckCircle2 },
  confirmado: { label: 'Iniciar atendimento', next: 'em_atendimento', icon: Play },
  em_atendimento: { label: 'Concluir serviço', next: 'concluido', icon: Check },
}

// ── SÍNTESE DE ÁUDIO VIA WEB AUDIO API ──
function tocarSomInterativo(tipo, ativo = true) {
  if (!ativo || typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') ctx.resume()

    if (tipo === 'avancar') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12) // G5
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else if (tipo === 'concluido') {
      // Arpejo alegre maior: C5, E5, G5, C6
      const notas = [523.25, 659.25, 783.99, 1046.5]
      notas.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const t = ctx.currentTime + idx * 0.07
        gain.gain.setValueAtTime(0.16, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.24)
      })
    } else if (tipo === 'voltar') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.13)
    }
  } catch (_) {}
}

function formatarHora(value) {
  if (!value) return '—'
  const data = new Date(value)
  if (Number.isNaN(data.valueOf())) {
    const str = String(value)
    if (str.includes('T')) return str.split('T')[1].slice(0, 5)
    return str.slice(0, 5)
  }
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' })
}

function extrairHoraNumero(dataHora) {
  if (!dataHora) return 12
  const s = String(dataHora)
  if (s.includes('T')) {
    const horaStr = s.split('T')[1].slice(0, 2)
    const h = parseInt(horaStr, 10)
    if (!Number.isNaN(h)) return h
  }
  const d = new Date(dataHora)
  if (Number.isNaN(d.valueOf())) {
    return parseInt(s.slice(0, 2), 10) || 12
  }
  return d.getHours()
}

function obterTurno(dataHora) {
  const h = extrairHoraNumero(dataHora)
  if (h < 12) return 'manha'
  if (h < 18) return 'tarde'
  return 'noite'
}

function extrairIniciais(nome) {
  return String(nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

function limparTelefone(telefone) {
  return String(telefone || '').replace(/\D/g, '')
}

function calcularTempoDecorrido(dataHora, duracaoMinutos) {
  if (!dataHora) return null
  const inicio = new Date(dataHora).getTime()
  if (Number.isNaN(inicio)) return null
  const agora = Date.now()
  const diffMin = Math.floor((agora - inicio) / 60000)
  const duracao = Number(duracaoMinutos || 30)
  const progresso = Math.min(100, Math.max(0, Math.round((diffMin / duracao) * 100)))
  return { minutos: diffMin, progresso, duracao, excedeu: diffMin > duracao }
}

function calcularStatusTempo(item) {
  if (!item.dataHora) return null
  const dataInicio = new Date(item.dataHora).getTime()
  if (Number.isNaN(dataInicio)) return null
  const agora = Date.now()
  const diffMin = Math.floor((agora - dataInicio) / 60000)

  // Se agendado ou confirmado e já passou do horário previsto
  if (['agendado', 'confirmado'].includes(item.status)) {
    if (diffMin >= 5) {
      return { tipo: 'atrasado', minutos: diffMin, label: `Atrasado ${diffMin} min` }
    }
    if (diffMin > -20 && diffMin < 5) {
      const restantes = Math.abs(diffMin)
      return { tipo: 'chegando', minutos: restantes, label: `Chegando em ${restantes} min` }
    }
  }
  return null
}

export default function BarbeariaAtendimentoBoard({
  dataSelecionada,
  onDateChange,
  agendamentos = [],
  profissionais = [],
  servicos = [],
  produtosRevenda = [],
  comandas = [],
  onStatusChange,
  onOpenAppointment,
  onOpenComanda,
  onCreateComanda,
  onNewAppointment,
  onNewComanda,
  onOpenRecebimento,
  onOpenHistorico,
  onReassignBarber,
  onCreateEncaixe,
  onAddItemComanda,
  onRefresh,
  loading = false,
}) {
  const [draggedCardId, setDraggedCardId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('todos') // todos, manha, tarde, noite
  const [filtroRapido, setFiltroRapido] = useState('todos') // todos, atrasados, com_comanda, sem_comanda
  const [ordenacao, setOrdenacao] = useState('horario') // horario, atraso, valor, barbeiro
  const [menuAbertoId, setMenuAbertoId] = useState(null)
  const [moverAbertoId, setMoverAbertoId] = useState(null)
  const [reatribuirAbertoId, setReatribuirAbertoId] = useState(null)
  const [whatsappMenuId, setWhatsappMenuId] = useState(null)
  const [agoraTempo, setAgoraTempo] = useState(Date.now())
  const [modoVisualizacao, setModoVisualizacao] = useState('kanban')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(Date.now())
  const [rotacionandoRefresh, setRotacionandoRefresh] = useState(false)

  // Feedback Sonoro
  const [somAtivo, setSomAtivo] = useState(() => {
    try {
      return localStorage.getItem('barbearia_board_som') !== 'false'
    } catch (_) {
      return true
    }
  })

  // Efeito de Confetti
  const [confettiAtivo, setConfettiAtivo] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState([])

  // Modal de Encaixe Rápido
  const [modalEncaixeAberto, setModalEncaixeAberto] = useState(false)
  const [formEncaixe, setFormEncaixe] = useState({
    clienteNome: '',
    clienteTelefone: '',
    servicoId: '',
    profissionalId: '',
    iniciarImediato: true,
  })

  // Modal de Adicionar Item Rápido na Comanda
  const [modalItemComanda, setModalItemComanda] = useState(null) // { agendamento, comanda }
  const [abaItemComanda, setAbaItemComanda] = useState('produtos') // produtos, servicos

  // Touch Drag para Mobile
  const [touchDragging, setTouchDragging] = useState(false)
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 })
  const [touchCard, setTouchCard] = useState(null)
  const touchStartPos = useRef({ x: 0, y: 0 })
  const boardRef = useRef(null)

  function toggleSom() {
    setSomAtivo((prev) => {
      const next = !prev
      try {
        localStorage.setItem('barbearia_board_som', String(next))
      } catch (_) {}
      return next
    })
  }

  // Atualiza tempo a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => setAgoraTempo(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Disparar celebração de confetti
  function dispararCelebracao() {
    tocarSomInterativo('concluido', somAtivo)
    const cores = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
    const pieces = Array.from({ length: 32 }).map((_, idx) => ({
      id: idx,
      left: `${Math.random() * 96}%`,
      top: `-20px`,
      bg: cores[Math.floor(Math.random() * cores.length)],
      delay: `${Math.random() * 0.4}s`,
      size: `${6 + Math.random() * 8}px`,
    }))
    setConfettiPieces(pieces)
    setConfettiAtivo(true)
    setTimeout(() => {
      setConfettiAtivo(false)
      setConfettiPieces([])
    }, 2500)
  }

  // Fechar menus ao clicar fora
  useEffect(() => {
    if (typeof document === 'undefined') return
    function handleClickFora(e) {
      if (
        !e.target.closest('.atendimento-popover') &&
        !e.target.closest('.atendimento-menu-trigger') &&
        !e.target.closest('.atendimento-move-btn') &&
        !e.target.closest('.atendimento-whatsapp-btn')
      ) {
        setMenuAbertoId(null)
        setMoverAbertoId(null)
        setReatribuirAbertoId(null)
        setWhatsappMenuId(null)
      }
    }
    document.addEventListener('click', handleClickFora)
    return () => document.removeEventListener('click', handleClickFora)
  }, [])

  // Disparar atualização rápida
  async function executarRefresh() {
    setRotacionandoRefresh(true)
    if (onRefresh) {
      try {
        await onRefresh()
      } catch (_) {}
    }
    setUltimaAtualizacao(Date.now())
    setTimeout(() => setRotacionandoRefresh(false), 600)
  }

  // Filtragem e Ordenação Inteligente
  const agendamentosProcessados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    let lista = agendamentos.filter((item) => {
      // Filtro por barbeiro
      if (filtroProfissional && String(item.profissionalId) !== String(filtroProfissional)) {
        return false
      }
      // Filtro por turno
      if (filtroTurno !== 'todos') {
        const turnoItem = obterTurno(item.dataHora)
        if (turnoItem !== filtroTurno) return false
      }
      // Filtro rápido
      const comanda = comandas.find((c) => c.agendamentoId === item.id && c.status !== 'cancelada')
      const statusTempo = calcularStatusTempo(item)
      if (filtroRapido === 'atrasados' && statusTempo?.tipo !== 'atrasado') return false
      if (filtroRapido === 'com_comanda' && !comanda) return false
      if (filtroRapido === 'sem_comanda' && comanda) return false

      // Busca textual
      if (!termo) return true
      const nomeCliente = (item.clienteNome || item.cliente_nome || '').toLowerCase()
      const telCliente = (item.clienteTelefone || item.cliente_telefone || '').toLowerCase()
      const servico = (item.servicoNome || item.servico_nome || '').toLowerCase()
      const prof = (item.profissionalNome || item.profissional_nome || '').toLowerCase()
      return nomeCliente.includes(termo) || telCliente.includes(termo) || servico.includes(termo) || prof.includes(termo)
    })

    // Ordenação
    lista.sort((a, b) => {
      if (ordenacao === 'valor') {
        return Number(b.valor || 0) - Number(a.valor || 0)
      }
      if (ordenacao === 'atraso') {
        const atrasoA = calcularStatusTempo(a)?.minutos || 0
        const atrasoB = calcularStatusTempo(b)?.minutos || 0
        return atrasoB - atrasoA
      }
      if (ordenacao === 'barbeiro') {
        const nomeA = a.profissionalNome || ''
        const nomeB = b.profissionalNome || ''
        return nomeA.localeCompare(nomeB)
      }
      // Padrão: Horário
      const timeA = new Date(a.dataHora || 0).getTime()
      const timeB = new Date(b.dataHora || 0).getTime()
      return timeA - timeB
    })

    return lista
  }, [agendamentos, busca, filtroProfissional, filtroTurno, filtroRapido, ordenacao, comandas, agoraTempo])

  // Métricas do dia
  const metricas = useMemo(() => {
    const total = agendamentos.length
    const emAtendimento = agendamentos.filter((i) => i.status === 'em_atendimento').length
    const concluidos = agendamentos.filter((i) => i.status === 'concluido').length
    const atrasados = agendamentos.filter((i) => calcularStatusTempo(i)?.tipo === 'atrasado').length
    const totalPrevisto = agendamentos.reduce((acc, i) => acc + Number(i.valor || 0), 0)
    const faturado = agendamentos
      .filter((i) => i.status === 'concluido')
      .reduce((acc, i) => acc + Number(i.valor || 0), 0)
    return { total, emAtendimento, concluidos, atrasados, totalPrevisto, faturado }
  }, [agendamentos, agoraTempo])

  // Contagem por turno
  const contagemTurnos = useMemo(() => {
    const manha = agendamentos.filter((i) => obterTurno(i.dataHora) === 'manha').length
    const tarde = agendamentos.filter((i) => obterTurno(i.dataHora) === 'tarde').length
    const noite = agendamentos.filter((i) => obterTurno(i.dataHora) === 'noite').length
    return { manha, tarde, noite }
  }, [agendamentos])

  // Drag and drop nativo
  function handleDragStart(e, item) {
    setDraggedCardId(item.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.setData('application/json', JSON.stringify({ id: item.id, status: item.status }))
  }

  function handleDragEnd() {
    setDraggedCardId(null)
    setDragOverCol(null)
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colId) {
      setDragOverCol(colId)
    }
  }

  function handleDragLeave(e, colId) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (dragOverCol === colId) {
      setDragOverCol(null)
    }
  }

  async function handleDrop(e, destinoStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain')
    if (!cardId) return

    const card = agendamentos.find((i) => String(i.id) === String(cardId))
    if (!card || card.status === destinoStatus) return

    executarTransicaoComEfeitos(card, destinoStatus)
  }

  // Touch drag para mobile
  function handleTouchStart(e, item) {
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    setTouchCard(item)
    setTouchPos({ x: touch.clientX, y: touch.clientY })
  }

  function handleTouchMove(e) {
    if (!touchCard) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    if (dx > 10 || dy > 10) {
      setTouchDragging(true)
      setTouchPos({ x: touch.clientX, y: touch.clientY })
      if (typeof document !== 'undefined' && typeof document.elementsFromPoint === 'function') {
        const elementos = document.elementsFromPoint(touch.clientX, touch.clientY) || []
        const colEl = elementos.find((el) => el.getAttribute('data-drop-col'))
        if (colEl) {
          setDragOverCol(colEl.getAttribute('data-drop-col'))
        } else {
          setDragOverCol(null)
        }
      }
    }
  }

  function handleTouchEnd() {
    if (touchDragging && touchCard && dragOverCol && dragOverCol !== touchCard.status) {
      executarTransicaoComEfeitos(touchCard, dragOverCol)
    }
    setTouchDragging(false)
    setTouchCard(null)
    setDragOverCol(null)
  }

  function executarTransicaoComEfeitos(item, novoStatus) {
    if (novoStatus === 'cancelado') {
      if (!window.confirm(`Deseja cancelar o atendimento de ${item.clienteNome || 'cliente'}?`)) return
    }
    if (novoStatus === 'nao_compareceu') {
      if (!window.confirm(`Marcar que ${item.clienteNome || 'o cliente'} não compareceu?`)) return
    }

    if (novoStatus === 'concluido') {
      dispararCelebracao()
    } else {
      tocarSomInterativo('avancar', somAtivo)
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(novoStatus === 'concluido' ? [50, 40, 80] : 35)
      } catch (_) {}
    }

    if (onStatusChange) {
      onStatusChange(item, novoStatus)
    }
    setMenuAbertoId(null)
    setMoverAbertoId(null)
    setReatribuirAbertoId(null)
    setWhatsappMenuId(null)
  }

  function submeterEncaixeRapido(e) {
    e.preventDefault()
    if (!formEncaixe.clienteNome.trim()) return
    const servicoEscolhido = servicos.find((s) => s.id === formEncaixe.servicoId) || servicos[0]
    const profEscolhido = profissionais.find((p) => p.id === formEncaixe.profissionalId) || profissionais[0]

    if (onCreateEncaixe) {
      onCreateEncaixe({
        ...formEncaixe,
        servicoId: servicoEscolhido?.id || '',
        profissionalId: profEscolhido?.id || '',
      })
    }
    setModalEncaixeAberto(false)
    setFormEncaixe({
      clienteNome: '',
      clienteTelefone: '',
      servicoId: '',
      profissionalId: '',
      iniciarImediato: true,
    })
    tocarSomInterativo('avancar', somAtivo)
  }

  function submeterAdicaoItem(itemEscolhido, tipo) {
    if (!modalItemComanda?.comanda?.id) return
    if (onAddItemComanda) {
      onAddItemComanda(modalItemComanda.comanda.id, {
        tipo,
        id: itemEscolhido.id,
        quantidade: 1,
        profissionalId: modalItemComanda.agendamento.profissionalId,
      })
    }
    setModalItemComanda(null)
    tocarSomInterativo('avancar', somAtivo)
  }

  const hoje = hojeAgenda()
  const ontem = (() => {
    const d = new Date(`${hoje}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const amanha = (() => {
    const d = new Date(`${hoje}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <div className="atendimento-board" ref={boardRef} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* ── CHUVA DE CONFETTI CELEBRATIVO ── */}
      {confettiAtivo && (
        <div className="atendimento-confetti-container" aria-hidden="true">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="atendimento-confetti-piece"
              style={{
                left: p.left,
                top: p.top,
                background: p.bg,
                animationDelay: p.delay,
                width: p.size,
                height: `${parseFloat(p.size) * 1.5}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── CARD SUPERIOR: BARRA DE FERRAMENTAS E FILTROS ── */}
      <div className="atendimento-toolbar-card">
        <div className="atendimento-toolbar-top">
          <div className="atendimento-toolbar-title">
            <h2>
              <Scissors size={22} style={{ color: 'var(--accent)' }} />
              Quadro de Atendimento Dinâmico
            </h2>
            <p>
              Arraste cards entre as colunas, avance com deslize (swipe) no celular, abra comandas e controle a operação em tempo real.
            </p>
          </div>

          <div className="atendimento-toolbar-actions">
            {/* Seletor Rápido de Data */}
            <div className="atendimento-date-picker">
              <button
                type="button"
                className={`atendimento-date-btn ${dataSelecionada === ontem ? 'active' : ''}`}
                onClick={() => onDateChange(ontem)}
                title="Ver ontem"
              >
                Ontem
              </button>
              <button
                type="button"
                className={`atendimento-date-btn ${dataSelecionada === hoje ? 'active' : ''}`}
                onClick={() => onDateChange(hoje)}
                title="Ir para hoje"
              >
                Hoje
              </button>
              <button
                type="button"
                className={`atendimento-date-btn ${dataSelecionada === amanha ? 'active' : ''}`}
                onClick={() => onDateChange(amanha)}
                title="Ver amanhã"
              >
                Amanhã
              </button>
              <input
                type="date"
                className="atendimento-date-input"
                value={dataSelecionada}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                title="Selecionar outra data"
              />
            </div>

            {/* Botão de Atualização Rápida */}
            <button
              type="button"
              className={`atendimento-refresh-btn ${rotacionandoRefresh ? 'rotating' : ''}`}
              onClick={executarRefresh}
              title="Sincronizar quadro agora"
            >
              <RefreshCw size={14} />
              <span>Sincronizar</span>
            </button>

            {/* Alternador de Som */}
            <button
              type="button"
              className={`atendimento-sound-btn ${somAtivo ? 'active' : ''}`}
              onClick={toggleSom}
              title={somAtivo ? 'Efeitos sonoros ativados (clique para silenciar)' : 'Efeitos sonoros desativados (clique para ativar)'}
            >
              {somAtivo ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{somAtivo ? 'Som ligado' : 'Mudo'}</span>
            </button>

            {/* Botão de Imprimir Ficha do Dia */}
            <button
              type="button"
              className="atendimento-pill"
              onClick={() => typeof window !== 'undefined' && window.print()}
              title="Imprimir folha operacional do dia para a bancada"
            >
              <Printer size={14} /> Imprimir Escala
            </button>

            {/* Alternador de visualização */}
            <button
              type="button"
              className="atendimento-pill"
              onClick={() => setModoVisualizacao((m) => (m === 'kanban' ? 'lista' : 'kanban'))}
              title="Alternar entre quadro Kanban e lista compacta"
            >
              {modoVisualizacao === 'kanban' ? 'Ver em Lista' : 'Ver em Kanban'}
            </button>

            {/* Botão de Encaixe Rápido (Walk-in) */}
            <button
              type="button"
              className="atendimento-pill"
              onClick={() => {
                setFormEncaixe({
                  clienteNome: '',
                  clienteTelefone: '',
                  servicoId: servicos[0]?.id || '',
                  profissionalId: filtroProfissional || profissionais[0]?.id || '',
                  iniciarImediato: true,
                })
                setModalEncaixeAberto(true)
              }}
              style={{
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
              }}
              title="Cadastrar cliente eventual que acabou de chegar"
            >
              <Zap size={14} /> + Encaixe Rápido
            </button>

            {/* Comanda avulsa */}
            {onNewComanda && (
              <button
                type="button"
                className="atendimento-pill"
                onClick={onNewComanda}
                title="Abrir uma comanda rápida no caixa"
              >
                <Receipt size={14} /> Comanda avulsa
              </button>
            )}

            {/* Novo agendamento */}
            {onNewAppointment && (
              <button
                type="button"
                onClick={onNewAppointment}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={16} /> Novo atendimento
              </button>
            )}
          </div>
        </div>

        {/* ── RESUMO RÁPIDO DO DIA (KPIs) ── */}
        <div className="atendimento-kpi-row">
          <div className="atendimento-kpi-item">
            <div className="atendimento-kpi-icon" style={{ background: '#3b82f618', color: '#3b82f6' }}>
              <Calendar size={18} />
            </div>
            <div className="atendimento-kpi-info">
              <span className="atendimento-kpi-val">{metricas.total}</span>
              <span className="atendimento-kpi-lbl">Total do dia</span>
            </div>
          </div>

          <div className="atendimento-kpi-item">
            <div className="atendimento-kpi-icon" style={{ background: '#f59e0b18', color: '#f59e0b' }}>
              <Scissors size={18} />
            </div>
            <div className="atendimento-kpi-info">
              <span className="atendimento-kpi-val">{metricas.emAtendimento}</span>
              <span className="atendimento-kpi-lbl">Na cadeira agora</span>
            </div>
          </div>

          <div className="atendimento-kpi-item">
            <div className="atendimento-kpi-icon" style={{ background: '#10b98118', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
            <div className="atendimento-kpi-info">
              <span className="atendimento-kpi-val">{metricas.concluidos}</span>
              <span className="atendimento-kpi-lbl">Concluídos</span>
            </div>
          </div>

          <div className="atendimento-kpi-item">
            <div
              className="atendimento-kpi-icon"
              style={{
                background: metricas.atrasados > 0 ? '#ef444418' : '#8b5cf618',
                color: metricas.atrasados > 0 ? '#dc2626' : '#8b5cf6',
              }}
            >
              {metricas.atrasados > 0 ? <AlertCircle size={18} /> : <DollarSign size={18} />}
            </div>
            <div className="atendimento-kpi-info">
              <span className="atendimento-kpi-val">
                {metricas.atrasados > 0 ? `${metricas.atrasados} atrasados` : fmtR(metricas.totalPrevisto)}
              </span>
              <span className="atendimento-kpi-lbl">
                {metricas.atrasados > 0 ? 'Requer atenção' : `Faturado: ${fmtR(metricas.faturado)}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── BARRA DE FILTROS, BUSCA, TURNOS E ORDENAÇÃO ── */}
        <div className="atendimento-filter-bar">
          <div className="atendimento-search-box">
            <Search className="atendimento-search-icon" size={15} />
            <input
              type="text"
              className="atendimento-search-input"
              placeholder="Buscar cliente, telefone, serviço ou barbeiro…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Filtro por Turno do Dia (Manhã, Tarde, Noite) */}
          <div className="atendimento-shift-group">
            <button
              type="button"
              className={`atendimento-shift-btn ${filtroTurno === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroTurno('todos')}
            >
              Todos os turnos
            </button>
            <button
              type="button"
              className={`atendimento-shift-btn ${filtroTurno === 'manha' ? 'active' : ''}`}
              onClick={() => setFiltroTurno('manha')}
            >
              🌅 Manhã ({contagemTurnos.manha})
            </button>
            <button
              type="button"
              className={`atendimento-shift-btn ${filtroTurno === 'tarde' ? 'active' : ''}`}
              onClick={() => setFiltroTurno('tarde')}
            >
              ☀️ Tarde ({contagemTurnos.tarde})
            </button>
            <button
              type="button"
              className={`atendimento-shift-btn ${filtroTurno === 'noite' ? 'active' : ''}`}
              onClick={() => setFiltroTurno('noite')}
            >
              🌙 Noite ({contagemTurnos.noite})
            </button>
          </div>

          {/* Filtros rápidos por estado */}
          <div className="atendimento-quick-filter-group">
            <button
              type="button"
              className={`atendimento-filter-chip ${filtroRapido === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroRapido('todos')}
            >
              Todos ({agendamentos.length})
            </button>
            {metricas.atrasados > 0 && (
              <button
                type="button"
                className={`atendimento-filter-chip ${filtroRapido === 'atrasados' ? 'active-warning' : ''}`}
                onClick={() => setFiltroRapido(filtroRapido === 'atrasados' ? 'todos' : 'atrasados')}
              >
                ⚠️ Atrasados ({metricas.atrasados})
              </button>
            )}
            <button
              type="button"
              className={`atendimento-filter-chip ${filtroRapido === 'sem_comanda' ? 'active' : ''}`}
              onClick={() => setFiltroRapido(filtroRapido === 'sem_comanda' ? 'todos' : 'sem_comanda')}
            >
              Sem comanda
            </button>
            <button
              type="button"
              className={`atendimento-filter-chip ${filtroRapido === 'com_comanda' ? 'active' : ''}`}
              onClick={() => setFiltroRapido(filtroRapido === 'com_comanda' ? 'todos' : 'com_comanda')}
            >
              Comanda aberta
            </button>
          </div>

          {/* Seletor de ordenação */}
          <select
            className="atendimento-sort-select"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            title="Ordenar cards"
          >
            <option value="horario">Ordenar: Horário</option>
            <option value="atraso">Ordenar: Atrasados primeiro</option>
            <option value="valor">Ordenar: Maior valor (R$)</option>
            <option value="barbeiro">Ordenar: Por barbeiro</option>
          </select>
        </div>

        {/* Pílulas de filtro por profissional */}
        <div style={{ marginTop: 12 }}>
          <div className="atendimento-barbeiro-pills">
            <button
              type="button"
              className={`atendimento-pill ${filtroProfissional === '' ? 'active' : ''}`}
              onClick={() => setFiltroProfissional('')}
            >
              Todos os barbeiros
              <span className="atendimento-pill-count">{agendamentos.length}</span>
            </button>
            {profissionais
              .filter((p) => p.ativo !== false)
              .map((p) => {
                const count = agendamentos.filter((a) => String(a.profissionalId) === String(p.id)).length
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`atendimento-pill ${String(filtroProfissional) === String(p.id) ? 'active' : ''}`}
                    onClick={() => setFiltroProfissional(String(filtroProfissional) === String(p.id) ? '' : String(p.id))}
                  >
                    {p.nome}
                    <span className="atendimento-pill-count">{count}</span>
                  </button>
                )
              })}
          </div>
        </div>
      </div>

      {/* ── GRADE KANBAN COM AS 4 COLUNAS PRINCIPAIS ── */}
      {modoVisualizacao === 'kanban' ? (
        <div className="atendimento-kanban-board">
          {COLUNAS_KANBAN.map((coluna) => {
            const itensColuna = agendamentosProcessados.filter((item) => item.status === coluna.id)
            const valorTotalColuna = itensColuna.reduce((acc, item) => acc + Number(item.valor || 0), 0)
            const isDragOver = dragOverCol === coluna.id

            return (
              <div
                key={coluna.id}
                data-drop-col={coluna.id}
                className={`atendimento-kanban-col ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, coluna.id)}
                onDragLeave={(e) => handleDragLeave(e, coluna.id)}
                onDrop={(e) => handleDrop(e, coluna.id)}
              >
                {/* Cabeçalho da Coluna */}
                <div className="atendimento-col-header">
                  <div className="atendimento-col-title-group">
                    <span className="atendimento-col-dot" style={{ background: coluna.bgDot }} />
                    <h3 className="atendimento-col-title">{coluna.label}</h3>
                    <span className="atendimento-col-count">{itensColuna.length}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="atendimento-col-total">{fmtR(valorTotalColuna)}</span>
                    {coluna.id === 'em_atendimento' && (
                      <button
                        type="button"
                        className="atendimento-col-add-btn"
                        onClick={() => {
                          setFormEncaixe({
                            clienteNome: '',
                            clienteTelefone: '',
                            servicoId: servicos[0]?.id || '',
                            profissionalId: filtroProfissional || profissionais[0]?.id || '',
                            iniciarImediato: true,
                          })
                          setModalEncaixeAberto(true)
                        }}
                        title="Adicionar encaixe direto na cadeira"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Área de Cards e Drop */}
                <div className="atendimento-cards-container">
                  {isDragOver && (
                    <div className="atendimento-drop-hint">
                      <ArrowRight size={16} /> Solte para mover para {coluna.label}
                    </div>
                  )}

                  {itensColuna.length === 0 && !isDragOver ? (
                    <div className="atendimento-col-empty">
                      <div className="atendimento-col-empty-icon">✂</div>
                      <span>Nenhum atendimento em {coluna.label.toLowerCase()}</span>
                      <small style={{ color: 'var(--muted)', marginTop: 4 }}>Arraste um card aqui</small>
                    </div>
                  ) : (
                    itensColuna.map((item) => {
                      const comandaDoAtendimento = comandas.find(
                        (c) => c.agendamentoId === item.id && c.status !== 'cancelada'
                      )
                      const isDraggingThis = draggedCardId === item.id
                      const tempoDecorrido =
                        coluna.id === 'em_atendimento'
                          ? calcularTempoDecorrido(item.dataHora, item.duracaoMinutos)
                          : null
                      const statusTempo = calcularStatusTempo(item)

                      return (
                        <CardAtendimentoSwipeable
                          key={item.id}
                          item={item}
                          coluna={coluna}
                          comanda={comandaDoAtendimento}
                          tempoDecorrido={tempoDecorrido}
                          statusTempo={statusTempo}
                          isDragging={isDraggingThis}
                          profissionais={profissionais}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, item)}
                          onClick={() => onOpenAppointment && onOpenAppointment(item)}
                          onStatusChange={executarTransicaoComEfeitos}
                          onReassignBarber={onReassignBarber}
                          onOpenComanda={onOpenComanda}
                          onCreateComanda={onCreateComanda}
                          onOpenRecebimento={onOpenRecebimento}
                          onOpenHistorico={onOpenHistorico}
                          onOpenAddItem={(ag, cm) => setModalItemComanda({ agendamento: ag, comanda: cm })}
                          menuAbertoId={menuAbertoId}
                          setMenuAbertoId={setMenuAbertoId}
                          moverAbertoId={moverAbertoId}
                          setMoverAbertoId={setMoverAbertoId}
                          reatribuirAbertoId={reatribuirAbertoId}
                          setReatribuirAbertoId={setReatribuirAbertoId}
                          whatsappMenuId={whatsappMenuId}
                          setWhatsappMenuId={setWhatsappMenuId}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── MODO LISTA COMPACTA ── */
        <div className="atendimento-toolbar-card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {agendamentosProcessados.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                Nenhum agendamento encontrado para o filtro selecionado.
              </div>
            ) : (
              agendamentosProcessados.map((item) => {
                const comandaDoAtendimento = comandas.find((c) => c.agendamentoId === item.id && c.status !== 'cancelada')
                const statusInfo = COLUNAS_KANBAN.find((c) => c.id === item.status) || { label: item.status, color: '#888' }
                const statusTempo = calcularStatusTempo(item)

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      borderLeft: `4.5px solid ${statusInfo.color}`,
                      borderRadius: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220, flex: 1 }}>
                      <span className="atendimento-time-badge">{formatarHora(item.dataHora)}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ color: 'var(--navy)', fontSize: 14 }}>
                            {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                          </strong>
                          {statusTempo?.tipo === 'atrasado' && (
                            <span className="atendimento-badge-urgente">⚠️ {statusTempo.label}</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {item.servicoNome || item.servico_nome} · {item.profissionalNome || item.profissional_nome}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: `${statusInfo.color}18`,
                          color: statusInfo.color,
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                      <strong style={{ color: 'var(--navy)', fontSize: 13 }}>{fmtR(item.valor)}</strong>

                      {ACOES_PRINCIPAIS[item.status] && (
                        <button
                          type="button"
                          className="atendimento-pill"
                          onClick={() => executarTransicaoComEfeitos(item, ACOES_PRINCIPAIS[item.status].next)}
                        >
                          {ACOES_PRINCIPAIS[item.status].label}
                        </button>
                      )}

                      {comandaDoAtendimento ? (
                        <button
                          type="button"
                          className="atendimento-pill"
                          onClick={() => onOpenComanda && onOpenComanda(comandaDoAtendimento)}
                        >
                          Comanda {comandaDoAtendimento.status === 'paga' ? '✓ Paga' : 'Aberta'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="atendimento-pill"
                          onClick={() => onCreateComanda && onCreateComanda(item)}
                        >
                          + Comanda
                        </button>
                      )}

                      <button
                        type="button"
                        className="atendimento-pill"
                        onClick={() => onOpenAppointment && onOpenAppointment(item)}
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── ZONAS RÁPIDAS DE SOLTURA INFERIORES: CANCELAR E NÃO COMPARECEU ── */}
      <div className="atendimento-drop-quick-bar">
        <div
          data-drop-col="nao_compareceu"
          className={`atendimento-quick-drop-zone ${dragOverCol === 'nao_compareceu' ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'nao_compareceu')}
          onDragLeave={(e) => handleDragLeave(e, 'nao_compareceu')}
          onDrop={(e) => handleDrop(e, 'nao_compareceu')}
        >
          <UserX size={16} />
          <span>Arraste aqui para marcar: <strong>Não Compareceu</strong></span>
        </div>

        <div
          data-drop-col="cancelado"
          className={`atendimento-quick-drop-zone ${dragOverCol === 'cancelado' ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'cancelado')}
          onDragLeave={(e) => handleDragLeave(e, 'cancelado')}
          onDrop={(e) => handleDrop(e, 'cancelado')}
        >
          <XCircle size={16} />
          <span>Arraste aqui para <strong>Cancelar Atendimento</strong></span>
        </div>
      </div>

      {/* ── PROXY FLUTUANTE DURANTE TOUCH DRAG (MOBILE) ── */}
      {touchDragging && touchCard && (
        <div
          className="atendimento-touch-proxy"
          style={{
            left: touchPos.x,
            top: touchPos.y,
          }}
        >
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="atendimento-time-badge">{formatarHora(touchCard.dataHora)}</span>
              <strong>{fmtR(touchCard.valor)}</strong>
            </div>
            <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{touchCard.clienteNome}</strong>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{touchCard.servicoNome}</div>
          </div>
        </div>
      )}

      {/* ── MODAL INTERATIVO DE ENCAIXE RÁPIDO (WALK-IN) ── */}
      {modalEncaixeAberto && (
        <div className="atendimento-modal-backdrop" onClick={() => setModalEncaixeAberto(false)}>
          <div className="atendimento-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="atendimento-modal-head">
              <h3>
                <Zap size={18} style={{ color: 'var(--accent)' }} />
                Encaixe Rápido de Cliente
              </h3>
              <button
                type="button"
                className="atendimento-modal-close"
                onClick={() => setModalEncaixeAberto(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submeterEncaixeRapido} className="atendimento-modal-body">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Nome do cliente *
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  placeholder="Ex: Carlos Oliveira"
                  value={formEncaixe.clienteNome}
                  onChange={(e) => setFormEncaixe((prev) => ({ ...prev, clienteNome: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Telefone / WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  placeholder="(65) 99999-0000"
                  value={formEncaixe.clienteTelefone}
                  onChange={(e) => setFormEncaixe((prev) => ({ ...prev, clienteTelefone: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Escolha o serviço
                </label>
                <div className="atendimento-service-selector-grid">
                  {servicos
                    .filter((s) => s.ativo !== false)
                    .slice(0, 8)
                    .map((servico) => {
                      const isSelected = formEncaixe.servicoId === servico.id
                      return (
                        <div
                          key={servico.id}
                          className={`atendimento-service-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => setFormEncaixe((prev) => ({ ...prev, servicoId: servico.id }))}
                        >
                          <strong style={{ fontSize: 12, color: 'var(--navy)' }}>{servico.nome}</strong>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                            {fmtR(servico.preco)}
                          </span>
                          <small style={{ color: 'var(--muted)', fontSize: 10 }}>{servico.duracaoMinutos || 30} min</small>
                        </div>
                      )
                    })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Barbeiro responsável
                </label>
                <div className="atendimento-barber-selector-grid">
                  {profissionais
                    .filter((p) => p.ativo !== false)
                    .map((prof) => {
                      const isSelected = formEncaixe.profissionalId === prof.id
                      return (
                        <button
                          key={prof.id}
                          type="button"
                          className={`atendimento-barber-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => setFormEncaixe((prev) => ({ ...prev, profissionalId: prof.id }))}
                        >
                          <User size={13} />
                          {prof.nome}
                        </button>
                      )
                    })}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'var(--card2)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onClick={() => setFormEncaixe((prev) => ({ ...prev, iniciarImediato: !prev.iniciarImediato }))}
              >
                <input
                  type="checkbox"
                  checked={formEncaixe.iniciarImediato}
                  onChange={(e) => setFormEncaixe((prev) => ({ ...prev, iniciarImediato: e.target.checked }))}
                  style={{ cursor: 'pointer' }}
                />
                <label style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--navy)' }}>
                  Iniciar atendimento imediatamente (vai direto para a cadeira)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="atendimento-pill"
                  onClick={() => setModalEncaixeAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 18px',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Confirmar encaixe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL INTERATIVO: ADICIONAR ITEM / PRODUTO À COMANDA ── */}
      {modalItemComanda && (
        <div className="atendimento-modal-backdrop" onClick={() => setModalItemComanda(null)}>
          <div className="atendimento-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="atendimento-modal-head">
              <h3>
                <ShoppingBag size={18} style={{ color: 'var(--accent)' }} />
                Adicionar Item à Comanda
              </h3>
              <button
                type="button"
                className="atendimento-modal-close"
                onClick={() => setModalItemComanda(null)}
              >
                ✕
              </button>
            </div>

            <div className="atendimento-modal-body">
              <div style={{ padding: '8px 12px', background: 'var(--card2)', borderRadius: 10, fontSize: 13 }}>
                Cliente: <strong>{modalItemComanda.agendamento?.clienteNome || 'Cliente'}</strong> · Barbeiro: <strong>{modalItemComanda.agendamento?.profissionalNome || 'Atendente'}</strong>
              </div>

              {/* Abas: Produtos de Revenda vs Serviços Adicionais */}
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <button
                  type="button"
                  className={`atendimento-pill ${abaItemComanda === 'produtos' ? 'active' : ''}`}
                  onClick={() => setAbaItemComanda('produtos')}
                >
                  <Package size={14} /> Produtos de revenda ({produtosRevenda.length})
                </button>
                <button
                  type="button"
                  className={`atendimento-pill ${abaItemComanda === 'servicos' ? 'active' : ''}`}
                  onClick={() => setAbaItemComanda('servicos')}
                >
                  <Scissors size={14} /> Serviços extras ({servicos.length})
                </button>
              </div>

              {abaItemComanda === 'produtos' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {produtosRevenda.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
                      Nenhum produto cadastrado no estoque de revenda.
                    </div>
                  ) : (
                    produtosRevenda.map((p) => (
                      <div
                        key={p.id}
                        className="atendimento-service-option"
                        onClick={() => submeterAdicaoItem(p, 'produto')}
                        title="Clique para adicionar à comanda"
                      >
                        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{p.nome}</strong>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmtR(p.precoVenda)}</span>
                        <small style={{ color: 'var(--muted)', fontSize: 10 }}>Estoque: {p.estoqueAtual ?? 0}</small>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {servicos
                    .filter((s) => s.ativo !== false && s.id !== modalItemComanda.agendamento?.servicoId)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="atendimento-service-option"
                        onClick={() => submeterAdicaoItem(s, 'servico')}
                        title="Clique para adicionar à comanda"
                      >
                        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{s.nome}</strong>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{fmtR(s.preco)}</span>
                        <small style={{ color: 'var(--muted)', fontSize: 10 }}>{s.duracaoMinutos || 30} min</small>
                      </div>
                    ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className="atendimento-pill"
                  onClick={() => setModalItemComanda(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOLHA DE IMPRESSÃO LIMPA (ESCALA DO DIA) ── */}
      <div className="atendimento-print-sheet" style={{ display: 'none' }}>
        <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 22, textTransform: 'uppercase' }}>
            Escala e Quadro Operacional de Atendimentos
          </h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Data: <strong>{dataSelecionada}</strong></span>
            <span>Total: <strong>{metricas.total} clientes</strong> | Faturamento previsto: <strong>{fmtR(metricas.totalPrevisto)}</strong></span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Hora</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Telefone</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Serviço</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Barbeiro</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Visto</th>
            </tr>
          </thead>
          <tbody>
            {agendamentosProcessados.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{formatarHora(item.dataHora)}</td>
                <td style={{ padding: '6px 8px' }}>{item.clienteNome || 'Cliente'}</td>
                <td style={{ padding: '6px 8px' }}>{item.clienteTelefone || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{item.servicoNome}</td>
                <td style={{ padding: '6px 8px' }}>{item.profissionalNome}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtR(item.valor)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', textTransform: 'capitalize' }}>{item.status}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>[ &nbsp; ]</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── COMPONENTE DO CARD COM SUPORTE A SWIPE (MOBILE GESTURE) ──
function CardAtendimentoSwipeable({
  item,
  coluna,
  comanda,
  tempoDecorrido,
  statusTempo,
  isDragging,
  profissionais = [],
  onDragStart,
  onDragEnd,
  onTouchStart,
  onClick,
  onStatusChange,
  onReassignBarber,
  onOpenComanda,
  onCreateComanda,
  onOpenRecebimento,
  onOpenHistorico,
  onOpenAddItem,
  menuAbertoId,
  setMenuAbertoId,
  moverAbertoId,
  setMoverAbertoId,
  reatribuirAbertoId,
  setReatribuirAbertoId,
  whatsappMenuId,
  setWhatsappMenuId,
}) {
  const telLimpo = limparTelefone(item.clienteTelefone || item.cliente_telefone)
  const isMenuAberto = menuAbertoId === item.id
  const isMoverAberto = moverAbertoId === item.id
  const isReatribuirAberto = reatribuirAbertoId === item.id
  const isWhatsappMenuAberto = whatsappMenuId === item.id
  const acaoPrincipal = ACOES_PRINCIPAIS[item.status]

  // Estado de Swipe horizontal no celular (iPhone)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchOriginX = useRef(0)
  const touchOriginY = useRef(0)
  const isHorizontalSwipe = useRef(false)

  function handleCardTouchStart(e) {
    const t = e.touches[0]
    touchOriginX.current = t.clientX
    touchOriginY.current = t.clientY
    isHorizontalSwipe.current = false
    if (onTouchStart) onTouchStart(e)
  }

  function handleCardTouchMove(e) {
    const t = e.touches[0]
    const dx = t.clientX - touchOriginX.current
    const dy = t.clientY - touchOriginY.current

    if (!isHorizontalSwipe.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      isHorizontalSwipe.current = true
    }

    if (isHorizontalSwipe.current) {
      const clamped = Math.max(-110, Math.min(110, dx))
      setSwipeOffset(clamped)
    }
  }

  function handleCardTouchEnd() {
    if (isHorizontalSwipe.current) {
      if (swipeOffset > 70 && acaoPrincipal) {
        onStatusChange(item, acaoPrincipal.next)
      } else if (swipeOffset < -70) {
        if (comanda && onOpenComanda) {
          onOpenComanda(comanda)
        } else if (onCreateComanda) {
          onCreateComanda(item)
        }
      }
    }
    setSwipeOffset(0)
    isHorizontalSwipe.current = false
  }

  // Modelos de mensagens do WhatsApp
  function gerarLinkWhatsapp(tipoMsg = 'lembrete') {
    if (!telLimpo) return null
    let texto = ''
    if (tipoMsg === 'lembrete') {
      texto = `Olá, ${item.clienteNome || 'tudo bem'}! Aqui é da barbearia. Confirmando seu horário agendado hoje às ${formatarHora(item.dataHora)}.`
    } else if (tipoMsg === 'cadeira') {
      texto = `Olá, ${item.clienteNome || 'tudo bem'}! Seu barbeiro ${item.profissionalNome || ''} já está pronto. Sua cadeira está liberada, pode entrar!`
    } else if (tipoMsg === 'obrigado') {
      texto = `Olá, ${item.clienteNome || 'tudo bem'}! Foi um prazer atendê-lo hoje na barbearia. Qualquer dúvida estamos à disposição. Até a próxima!`
    }
    return `https://wa.me/55${telLimpo}?text=${encodeURIComponent(texto)}`
  }

  return (
    <div className="atendimento-card-swipe-wrapper">
      {/* Fundo revelado ao deslizar para a direita (Avançar) */}
      {swipeOffset > 25 && acaoPrincipal && (
        <div className="atendimento-swipe-bg-right">
          <CheckCircle2 size={18} />
          <span>Solte para avançar: {acaoPrincipal.label}</span>
        </div>
      )}

      {/* Fundo revelado ao deslizar para a esquerda (Comanda / Ações) */}
      {swipeOffset < -25 && (
        <div className="atendimento-swipe-bg-left">
          <Receipt size={18} />
          <span>{comanda ? 'Ver Comanda' : '+ Criar Comanda'}</span>
        </div>
      )}

      <div
        className={`atendimento-card ${isDragging ? 'is-dragging' : ''}`}
        style={{
          borderLeftColor: coluna.color,
          transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: isHorizontalSwipe.current ? 'none' : 'transform 0.22s ease',
        }}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onTouchStart={handleCardTouchStart}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClick()
          }
        }}
      >
        {/* ── LINHA SUPERIOR: HORÁRIO, LIVE TIMER E VALOR ── */}
        <div className="atendimento-card-top">
          <div className="atendimento-card-time-group">
            <span className="atendimento-drag-handle" title="Arraste para mover o card">
              <GripVertical size={16} />
            </span>
            <span className="atendimento-time-badge">{formatarHora(item.dataHora)}</span>

            {/* Alerta de atraso ou proximidade */}
            {statusTempo?.tipo === 'atrasado' && (
              <span className="atendimento-badge-urgente" title="Cliente aguardando após horário previsto">
                ⚠️ {statusTempo.label}
              </span>
            )}
            {statusTempo?.tipo === 'chegando' && (
              <span className="atendimento-badge-chegando">
                ⏰ {statusTempo.label}
              </span>
            )}

            {/* Cronômetro se em atendimento */}
            {tempoDecorrido && (
              <span
                className="atendimento-timer-live"
                style={{ color: tempoDecorrido.excedeu ? '#dc2626' : '#f59e0b' }}
                title={tempoDecorrido.excedeu ? 'Tempo previsto de serviço excedido' : 'Tempo na cadeira'}
              >
                <span
                  className="atendimento-pulse-dot"
                  style={{ background: tempoDecorrido.excedeu ? '#dc2626' : '#f59e0b' }}
                />
                {tempoDecorrido.minutos} min {tempoDecorrido.excedeu ? '(+)' : ''}
              </span>
            )}
          </div>

          <strong className="atendimento-card-price">{fmtR(item.valor)}</strong>
        </div>

        {/* ── LINHA DO CLIENTE: AVATAR, NOME E WHATSAPP ── */}
        <div className="atendimento-client-row">
          <div className="atendimento-client-info">
            <div className="atendimento-client-avatar">{extrairIniciais(item.clienteNome || item.cliente_nome)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="atendimento-client-name" title={item.clienteNome}>
                {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
              </span>
              {item.clienteTelefone && (
                <span className="atendimento-client-phone-sub">{item.clienteTelefone}</span>
              )}
            </div>
          </div>

          {telLimpo && (
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="atendimento-whatsapp-btn"
                title="Mensagens de WhatsApp"
                onClick={() => {
                  setWhatsappMenuId(isWhatsappMenuAberto ? null : item.id)
                  setMenuAbertoId(null)
                  setMoverAbertoId(null)
                  setReatribuirAbertoId(null)
                }}
              >
                <MessageSquare size={14} />
              </button>

              {isWhatsappMenuAberto && (
                <div className="atendimento-popover">
                  <strong style={{ fontSize: 11, padding: '4px 8px', color: 'var(--muted)' }}>
                    Enviar via WhatsApp:
                  </strong>
                  <a
                    href={gerarLinkWhatsapp('lembrete')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="atendimento-popover-item"
                    onClick={() => setWhatsappMenuId(null)}
                  >
                    ⏰ Lembrete de horário
                  </a>
                  <a
                    href={gerarLinkWhatsapp('cadeira')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="atendimento-popover-item"
                    onClick={() => setWhatsappMenuId(null)}
                  >
                    ✂ Cadeira liberada / Pode entrar
                  </a>
                  <a
                    href={gerarLinkWhatsapp('obrigado')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="atendimento-popover-item"
                    onClick={() => setWhatsappMenuId(null)}
                  >
                    ⭐ Agradecimento pós-corte
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── LINHA DO SERVIÇO E BARBEIRO ── */}
        <div className="atendimento-service-row">
          <div className="atendimento-service-name">
            <Scissors size={12} style={{ color: 'var(--accent)' }} />
            <span>
              {item.servicoNome || item.servico_nome || 'Serviço'} · {item.duracaoMinutos || 30} min
            </span>
          </div>

          <div
            className="atendimento-barber-name"
            style={{ cursor: onReassignBarber ? 'pointer' : 'default' }}
            title={onReassignBarber ? 'Clique para reatribuir barbeiro' : undefined}
            onClick={(e) => {
              if (onReassignBarber) {
                e.stopPropagation()
                setReatribuirAbertoId(isReatribuirAberto ? null : item.id)
                setMenuAbertoId(null)
                setMoverAbertoId(null)
                setWhatsappMenuId(null)
              }
            }}
          >
            <User size={12} />
            <span>{item.profissionalNome || item.profissional_nome || 'Sem profissional'}</span>
            {onReassignBarber && <small style={{ color: 'var(--accent)', marginLeft: 4 }}>⇄ Trocar</small>}
          </div>

          {/* Barra de progresso para quem está na cadeira */}
          {tempoDecorrido && (
            <div className="atendimento-progress-track">
              <div
                className="atendimento-progress-fill"
                style={{
                  width: `${tempoDecorrido.progresso}%`,
                  background: tempoDecorrido.excedeu ? '#dc2626' : '#f59e0b',
                }}
              />
            </div>
          )}
        </div>

        {/* ── LINHA DA COMANDA ── */}
        <div className="atendimento-comanda-row" onClick={(e) => e.stopPropagation()}>
          {comanda ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                className={`atendimento-comanda-chip ${
                  comanda.status === 'paga' ? 'paga' : comanda.saldoPendente > 0 ? 'aguardando' : 'aberta'
                }`}
                onClick={() => onOpenComanda && onOpenComanda(comanda)}
                title="Clique para ver ou gerenciar a comanda"
              >
                <Receipt size={12} />
                {comanda.status === 'paga'
                  ? `Comanda paga (${fmtR(comanda.total)})`
                  : `Comanda #${comanda.id.slice(-4)} (${fmtR(comanda.total)})`}
              </span>

              {/* Botão rápido para adicionar pomada / cerveja / serviço */}
              {onOpenAddItem && comanda.status !== 'paga' && (
                <button
                  type="button"
                  className="atendimento-add-item-chip"
                  onClick={() => onOpenAddItem(item, comanda)}
                  title="Adicionar produto ou serviço extra na comanda"
                >
                  <Plus size={11} /> Item
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="atendimento-comanda-btn-create"
              onClick={() => onCreateComanda && onCreateComanda(item)}
              title="Abrir comanda para este atendimento"
            >
              <Plus size={12} /> Criar comanda
            </button>
          )}
        </div>

        {/* ── RODAPÉ DE AÇÕES DO CARD ── */}
        <div className="atendimento-card-actions" onClick={(e) => e.stopPropagation()}>
          {/* Ação principal do fluxo operacional */}
          {acaoPrincipal && (
            <button
              type="button"
              className="atendimento-action-primary"
              onClick={() => onStatusChange(item, acaoPrincipal.next)}
            >
              <acaoPrincipal.icon size={12} /> {acaoPrincipal.label}
            </button>
          )}

          {/* Se já concluído e sem recebimento financeiro registrado */}
          {item.status === 'concluido' && !item.financeiroLancamentoId && onOpenRecebimento && (
            <button
              type="button"
              className="atendimento-action-primary"
              onClick={() => onOpenRecebimento(item)}
              style={{ background: '#10b981' }}
            >
              <Receipt size={12} /> Receber
            </button>
          )}

          {/* Botão de mover status em 1 toque */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="atendimento-move-btn"
              title="Mover para outra coluna"
              onClick={() => {
                setMoverAbertoId(isMoverAberto ? null : item.id)
                setMenuAbertoId(null)
                setReatribuirAbertoId(null)
                setWhatsappMenuId(null)
              }}
            >
              ⇄ Mover
            </button>

            {isMoverAberto && (
              <div className="atendimento-popover">
                <strong style={{ fontSize: 11, padding: '4px 8px', color: 'var(--muted)' }}>
                  Mover status para:
                </strong>
                {COLUNAS_KANBAN.filter((c) => c.id !== item.status).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="atendimento-popover-item"
                    onClick={() => onStatusChange(item, c.id)}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Menu popover de reatribuição de barbeiro */}
          {isReatribuirAberto && onReassignBarber && (
            <div className="atendimento-popover" style={{ left: 0, right: 'auto' }}>
              <strong style={{ fontSize: 11, padding: '4px 8px', color: 'var(--muted)' }}>
                Reatribuir barbeiro:
              </strong>
              {profissionais
                .filter((p) => p.ativo !== false && p.id !== item.profissionalId)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="atendimento-popover-item"
                    onClick={() => {
                      setReatribuirAbertoId(null)
                      onReassignBarber(item, p.id)
                    }}
                  >
                    <User size={12} />
                    {p.nome}
                  </button>
                ))}
            </div>
          )}

          {/* Menu de mais opções (...) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="atendimento-menu-trigger"
              title="Mais opções"
              onClick={() => {
                setMenuAbertoId(isMenuAberto ? null : item.id)
                setMoverAbertoId(null)
                setReatribuirAbertoId(null)
                setWhatsappMenuId(null)
              }}
            >
              <MoreVertical size={16} />
            </button>

            {isMenuAberto && (
              <div className="atendimento-popover">
                <button
                  type="button"
                  className="atendimento-popover-item"
                  onClick={() => {
                    setMenuAbertoId(null)
                    onClick()
                  }}
                >
                  Ver detalhes completos
                </button>

                {onReassignBarber && (
                  <button
                    type="button"
                    className="atendimento-popover-item"
                    onClick={() => {
                      setMenuAbertoId(null)
                      setReatribuirAbertoId(item.id)
                    }}
                  >
                    ⇄ Reatribuir barbeiro
                  </button>
                )}

                {onOpenHistorico && (
                  <button
                    type="button"
                    className="atendimento-popover-item"
                    onClick={() => {
                      setMenuAbertoId(null)
                      onOpenHistorico(item)
                    }}
                  >
                    Histórico do cliente ↗
                  </button>
                )}

                <button
                  type="button"
                  className="atendimento-popover-item"
                  onClick={() => onStatusChange(item, 'nao_compareceu')}
                >
                  Não compareceu
                </button>

                <button
                  type="button"
                  className="atendimento-popover-item danger"
                  onClick={() => onStatusChange(item, 'cancelado')}
                >
                  Cancelar atendimento
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
