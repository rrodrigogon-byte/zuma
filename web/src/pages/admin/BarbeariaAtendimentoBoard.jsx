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
} from 'lucide-react'
import { fmtR } from '../../lib/api'
import { hojeAgenda } from '../../lib/barbearia-calendar'
import './BarbeariaAtendimentoBoard.css'

const COLUNAS_KANBAN = [
  { id: 'agendado', label: 'Agendado', color: '#3b82f6', bgDot: '#3b82f6', icon: Calendar, hint: 'Horários marcados aguardando' },
  { id: 'confirmado', label: 'Confirmado', color: '#8b5cf6', bgDot: '#8b5cf6', icon: CheckCircle2, hint: 'Cliente confirmou presença' },
  { id: 'em_atendimento', label: 'Em Atendimento', color: '#f59e0b', bgDot: '#f59e0b', icon: Scissors, hint: 'Cliente na cadeira agora' },
  { id: 'concluido', label: 'Concluído', color: '#10b981', bgDot: '#10b981', icon: Check, hint: 'Serviço finalizado' },
]

const ROTULOS_STATUS = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  nao_compareceu: 'Não compareceu',
}

const ACOES_PRINCIPAIS = {
  agendado: { label: 'Confirmar', next: 'confirmado', icon: CheckCircle2 },
  confirmado: { label: 'Iniciar atendimento', next: 'em_atendimento', icon: Play },
  em_atendimento: { label: 'Concluir serviço', next: 'concluido', icon: Check },
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
  return { minutos: diffMin, progresso, duracao }
}

export default function BarbeariaAtendimentoBoard({
  dataSelecionada,
  onDateChange,
  agendamentos = [],
  profissionais = [],
  servicos = [],
  comandas = [],
  onStatusChange,
  onOpenAppointment,
  onOpenComanda,
  onCreateComanda,
  onNewAppointment,
  onNewComanda,
  onOpenRecebimento,
  onOpenHistorico,
  loading = false,
}) {
  const [draggedCardId, setDraggedCardId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [menuAbertoId, setMenuAbertoId] = useState(null)
  const [moverAbertoId, setMoverAbertoId] = useState(null)
  const [agoraTempo, setAgoraTempo] = useState(Date.now())
  const [modoVisualizacao, setModoVisualizacao] = useState('kanban')

  // Suporte a Touch Drag em dispositivos móveis (ex: iPhone)
  const [touchDragging, setTouchDragging] = useState(false)
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 })
  const [touchCard, setTouchCard] = useState(null)
  const touchStartPos = useRef({ x: 0, y: 0 })
  const boardRef = useRef(null)

  // Atualiza tempo relativo a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => setAgoraTempo(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Fecha menus ao clicar fora
  useEffect(() => {
    if (typeof document === 'undefined') return
    function handleClickFora(e) {
      if (!e.target.closest('.atendimento-popover') && !e.target.closest('.atendimento-menu-trigger') && !e.target.closest('.atendimento-move-btn')) {
        setMenuAbertoId(null)
        setMoverAbertoId(null)
      }
    }
    document.addEventListener('click', handleClickFora)
    return () => document.removeEventListener('click', handleClickFora)
  }, [])

  // Filtragem dos agendamentos
  const agendamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return agendamentos.filter((item) => {
      if (filtroProfissional && String(item.profissionalId) !== String(filtroProfissional)) {
        return false
      }
      if (!termo) return true
      const nomeCliente = (item.clienteNome || item.cliente_nome || '').toLowerCase()
      const telCliente = (item.clienteTelefone || item.cliente_telefone || '').toLowerCase()
      const servico = (item.servicoNome || item.servico_nome || '').toLowerCase()
      const prof = (item.profissionalNome || item.profissional_nome || '').toLowerCase()
      return nomeCliente.includes(termo) || telCliente.includes(termo) || servico.includes(termo) || prof.includes(termo)
    })
  }, [agendamentos, busca, filtroProfissional])

  // Métricas do dia
  const metricas = useMemo(() => {
    const total = agendamentos.length
    const emAtendimento = agendamentos.filter((i) => i.status === 'em_atendimento').length
    const concluidos = agendamentos.filter((i) => i.status === 'concluido').length
    const totalPrevisto = agendamentos.reduce((acc, i) => acc + Number(i.valor || 0), 0)
    const faturado = agendamentos
      .filter((i) => i.status === 'concluido')
      .reduce((acc, i) => acc + Number(i.valor || 0), 0)
    return { total, emAtendimento, concluidos, totalPrevisto, faturado }
  }, [agendamentos])

  // Handlers de Drag and Drop Nativo HTML5
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

    executarTransicao(card, destinoStatus)
  }

  // Suporte a Touch Drag para telas sensíveis ao toque (Mobile / iPhone)
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
    if (dx > 8 || dy > 8) {
      setTouchDragging(true)
      setTouchPos({ x: touch.clientX, y: touch.clientY })
      // Detecta sobre qual coluna o toque está
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
      executarTransicao(touchCard, dragOverCol)
    }
    setTouchDragging(false)
    setTouchCard(null)
    setDragOverCol(null)
  }

  function executarTransicao(item, novoStatus) {
    if (novoStatus === 'cancelado') {
      if (!window.confirm(`Deseja cancelar o atendimento de ${item.clienteNome || 'cliente'}?`)) return
    }
    if (novoStatus === 'nao_compareceu') {
      if (!window.confirm(`Marcar que ${item.clienteNome || 'o cliente'} não compareceu?`)) return
    }
    if (onStatusChange) {
      onStatusChange(item, novoStatus)
    }
    setMenuAbertoId(null)
    setMoverAbertoId(null)
  }

  // Navegação de data
  function mudarData(offset) {
    const base = new Date(`${dataSelecionada}T12:00:00Z`)
    base.setUTCDate(base.getUTCDate() + offset)
    const nova = base.toISOString().slice(0, 10)
    onDateChange(nova)
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
      {/* ── CARD SUPERIOR: BARRA DE FERRAMENTAS E FILTROS ── */}
      <div className="atendimento-toolbar-card">
        <div className="atendimento-toolbar-top">
          <div className="atendimento-toolbar-title">
            <h2>
              <Scissors size={22} style={{ color: 'var(--accent)' }} />
              Quadro de Atendimento Dinâmico
            </h2>
            <p>
              Arraste os cards entre as colunas para atualizar o status do cliente em tempo real, abrir comandas e finalizar recebimentos.
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

            {/* Alternador de visualização */}
            <button
              type="button"
              className="atendimento-pill"
              onClick={() => setModoVisualizacao((m) => (m === 'kanban' ? 'lista' : 'kanban'))}
              title="Alternar entre quadro Kanban e lista compacta"
            >
              {modoVisualizacao === 'kanban' ? 'Ver em Lista' : 'Ver em Kanban'}
            </button>

            {/* Ações principais */}
            {onNewComanda && (
              <button type="button" className="atendimento-pill" onClick={onNewComanda} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                <Receipt size={14} /> Comanda avulsa
              </button>
            )}
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
              <span className="atendimento-kpi-lbl">Em atendimento agora</span>
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
            <div className="atendimento-kpi-icon" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>
              <DollarSign size={18} />
            </div>
            <div className="atendimento-kpi-info">
              <span className="atendimento-kpi-val">{fmtR(metricas.totalPrevisto)}</span>
              <span className="atendimento-kpi-lbl">Previsto ({fmtR(metricas.faturado)} faturado)</span>
            </div>
          </div>
        </div>

        {/* ── BARRA DE FILTROS E BUSCA EM TEMPO REAL ── */}
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

          {/* Pílulas de filtro por profissional */}
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
            const itensColuna = agendamentosFiltrados.filter((item) => item.status === coluna.id)
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
                  <span className="atendimento-col-total">{fmtR(valorTotalColuna)}</span>
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

                      return (
                        <CardAtendimento
                          key={item.id}
                          item={item}
                          coluna={coluna}
                          comanda={comandaDoAtendimento}
                          tempoDecorrido={tempoDecorrido}
                          isDragging={isDraggingThis}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, item)}
                          onClick={() => onOpenAppointment && onOpenAppointment(item)}
                          onStatusChange={executarTransicao}
                          onOpenComanda={onOpenComanda}
                          onCreateComanda={onCreateComanda}
                          onOpenRecebimento={onOpenRecebimento}
                          onOpenHistorico={onOpenHistorico}
                          menuAbertoId={menuAbertoId}
                          setMenuAbertoId={setMenuAbertoId}
                          moverAbertoId={moverAbertoId}
                          setMoverAbertoId={setMoverAbertoId}
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
            {agendamentosFiltrados.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                Nenhum agendamento encontrado para o filtro selecionado.
              </div>
            ) : (
              agendamentosFiltrados.map((item) => {
                const comandaDoAtendimento = comandas.find((c) => c.agendamentoId === item.id && c.status !== 'cancelada')
                const statusInfo = COLUNAS_KANBAN.find((c) => c.id === item.status) || { label: item.status, color: '#888' }

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
                      borderLeft: `4px solid ${statusInfo.color}`,
                      borderRadius: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, flex: 1 }}>
                      <span className="atendimento-time-badge">{formatarHora(item.dataHora)}</span>
                      <div>
                        <strong style={{ color: 'var(--navy)', fontSize: 14 }}>
                          {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
                        </strong>
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

                      {/* Botão de ação rápida */}
                      {ACOES_PRINCIPAIS[item.status] && (
                        <button
                          type="button"
                          className="atendimento-pill"
                          onClick={() => executarTransicao(item, ACOES_PRINCIPAIS[item.status].next)}
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
    </div>
  )
}

// ── COMPONENTE INDIVIDUAL DO CARD DO ATENDIMENTO ──
function CardAtendimento({
  item,
  coluna,
  comanda,
  tempoDecorrido,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onClick,
  onStatusChange,
  onOpenComanda,
  onCreateComanda,
  onOpenRecebimento,
  onOpenHistorico,
  menuAbertoId,
  setMenuAbertoId,
  moverAbertoId,
  setMoverAbertoId,
}) {
  const telLimpo = limparTelefone(item.clienteTelefone || item.cliente_telefone)
  const isMenuAberto = menuAbertoId === item.id
  const isMoverAberto = moverAbertoId === item.id
  const acaoPrincipal = ACOES_PRINCIPAIS[item.status]

  // Link do WhatsApp com mensagem pré-formatada amigável
  const linkWhatsapp = telLimpo
    ? `https://wa.me/55${telLimpo}?text=${encodeURIComponent(
        `Olá, ${item.clienteNome || 'tudo bem'}! Aqui é da barbearia sobre seu horário agendado às ${formatarHora(
          item.dataHora
        )}.`
      )}`
    : null

  return (
    <div
      className={`atendimento-card ${isDragging ? 'is-dragging' : ''}`}
      style={{ borderLeftColor: coluna.color }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
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

          {/* Cronômetro se em atendimento */}
          {tempoDecorrido && (
            <span className="atendimento-timer-live" title="Tempo decorrido na cadeira">
              <span className="atendimento-pulse-dot" />
              {tempoDecorrido.minutos} min
            </span>
          )}
        </div>

        <strong className="atendimento-card-price">{fmtR(item.valor)}</strong>
      </div>

      {/* ── LINHA DO CLIENTE: AVATAR, NOME E WHATSAPP ── */}
      <div className="atendimento-client-row">
        <div className="atendimento-client-info">
          <div className="atendimento-client-avatar">{extrairIniciais(item.clienteNome || item.cliente_nome)}</div>
          <span className="atendimento-client-name" title={item.clienteNome}>
            {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}
          </span>
        </div>

        {linkWhatsapp && (
          <a
            href={linkWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="atendimento-whatsapp-btn"
            title="Conversar no WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare size={14} />
          </a>
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
        <div className="atendimento-barber-name">
          <User size={12} />
          <span>{item.profissionalNome || item.profissional_nome || 'Sem profissional'}</span>
        </div>

        {/* Barra de progresso para quem está na cadeira */}
        {tempoDecorrido && (
          <div className="atendimento-progress-track">
            <div className="atendimento-progress-fill" style={{ width: `${tempoDecorrido.progresso}%` }} />
          </div>
        )}
      </div>

      {/* ── LINHA DA COMANDA ── */}
      <div className="atendimento-comanda-row" onClick={(e) => e.stopPropagation()}>
        {comanda ? (
          <span
            className={`atendimento-comanda-chip ${comanda.status === 'paga' ? 'paga' : comanda.saldoPendente > 0 ? 'aguardando' : 'aberta'}`}
            onClick={() => onOpenComanda && onOpenComanda(comanda)}
            title="Clique para ver ou gerenciar a comanda"
          >
            <Receipt size={12} />
            {comanda.status === 'paga'
              ? `Comanda paga (${fmtR(comanda.total)})`
              : `Comanda #${comanda.id.slice(-4)} (${fmtR(comanda.total)})`}
          </span>
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

        {/* Botão de mover status (ideal para celular touch) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="atendimento-move-btn"
            title="Mover para outra coluna"
            onClick={() => {
              setMoverAbertoId(isMoverAberto ? null : item.id)
              setMenuAbertoId(null)
            }}
          >
            ⇄ Mover
          </button>

          {isMoverAberto && (
            <div className="atendimento-popover">
              <strong style={{ fontSize: 11, padding: '4px 8px', color: 'var(--muted)' }}>Mover status para:</strong>
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

        {/* Menu de mais opções (...) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="atendimento-menu-trigger"
            title="Mais opções"
            onClick={() => {
              setMenuAbertoId(isMenuAberto ? null : item.id)
              setMoverAbertoId(null)
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
                Ver detalhes
              </button>

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
  )
}
