import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { Dialog } from '../customer360/shared'
import WhatsappConversationPanel from './WhatsappConversationPanel'
import {
  FILTROS_QUADRO,
  HUMAN_QUEUE_LIMIT,
  HUMAN_QUEUE_PATH,
  isUncertainClaimError,
  queueDateLabel,
  queueErrorMessage,
  queueUrl,
  queueWaitLabel,
  validateClaimResponse,
  validateHumanQueueResponse,
} from './whatsapp-human-queue'

function safeText(value, fallback = 'operador logado') {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, 120) : fallback
}

function EmptyQueue({ loading, error }) {
  if (loading) return <p className="c360-empty" role="status">Consultando conversas humanas…</p>
  if (error) return null
  return <p className="c360-empty">Nenhuma conversa nesta visão.</p>
}

export default function WhatsappHumanQueue({
  empresaId = '',
  lojaId = '',
  tipoCanal = 'cliente',
  empresaNome = 'empresa atual',
  lojaNome = 'unidade atual',
  operatorLabel = 'operador logado',
  onChanged,
  standalone = false,
}) {
  const contextKey = `${String(empresaId || '')}\u0000${String(lojaId || '')}\u0000${['gestao', 'lancamentos'].includes(tipoCanal) ? tipoCanal : 'cliente'}`
  const [open, setOpen] = useState(standalone ? true : false)
  const [assignment, setAssignment] = useState('unassigned')
  const [rows, setRows] = useState([])
  const [loadedContextKey, setLoadedContextKey] = useState('')
  const [selection, setSelection] = useState(null)
  const [canClaim, setCanClaim] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorContextKey, setErrorContextKey] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeContextKey, setNoticeContextKey] = useState('')
  const [claimDialog, setClaimDialog] = useState(null)
  // Encerradas ficam fora do quadro: só aparecem escolhendo o filtro.
  const [filtro, setFiltro] = useState('em_andamento')
  const [busca, setBusca] = useState('')
  const [subFiltro, setSubFiltro] = useState('todas')
  const [somHabilitado, setSomHabilitado] = useState(() => {
    try { return localStorage.getItem('kytto_wa_som') === 'true' } catch { return false }
  })
  const prevUrgentesRef = useRef(0)
  const [claimingId, setClaimingId] = useState('')
  // Conversa aberta no painel lateral (histórico completo + resposta do atendente).
  const [conversaId, setConversaId] = useState('')
  // WhatsApp da loja desconectado do Kytto: o T-Rex não recebe nem responde (Stallone, 30/10–01/11).
  const [quedaWhatsapp, setQuedaWhatsapp] = useState(null)
  const mountedRef = useRef(true)
  const contextKeyRef = useRef(contextKey)
  const assignmentRef = useRef(assignment)
  const openRef = useRef(open)
  const sequenceRef = useRef(0)
  const flightRef = useRef(null)
  const claimLockRef = useRef(null)
  const claimControllerRef = useRef(null)

  // Invalida respostas antes mesmo de o efeito de mudança de contexto executar.
  if (contextKeyRef.current !== contextKey) {
    contextKeyRef.current = contextKey
    sequenceRef.current += 1
    flightRef.current?.abort()
    claimControllerRef.current?.abort()
    flightRef.current = null
    claimControllerRef.current = null
  }

  const clearQueue = useCallback(() => {
    sequenceRef.current += 1
    flightRef.current?.abort()
    claimControllerRef.current?.abort()
    flightRef.current = null
    claimControllerRef.current = null
    setRows([])
    setLoadedContextKey('')
    setSelection(null)
    setCanClaim(false)
    setLoading(false)
    setError('')
    setErrorContextKey('')
    setNotice('')
    setNoticeContextKey('')
    setClaimDialog(null)
    setClaimingId('')
    claimLockRef.current = null
  }, [])

  const loadQueue = useCallback(async (opcoes = {}) => {
    // Atualização automática: troca a lista sem piscar a tela.
    const silencioso = opcoes?.silencioso === true
    if (!mountedRef.current || !openRef.current) return false
    const empIdEfetivo = String(empresaId || '').trim()
    const lojaIdEfetivo = String(lojaId || '').trim()
    const snapshot = { empresaId: empIdEfetivo, lojaId: lojaIdEfetivo, contextKey: String(contextKey) }
    if (!snapshot.empresaId || !snapshot.lojaId) {
      setRows([])
      setSelection(null)
      setCanClaim(false)
      setError('Selecione uma empresa e uma unidade autorizadas para abrir a fila humana.')
      setErrorContextKey(snapshot.contextKey)
      setLoading(false)
      return false
    }
    const controller = new AbortController()
    const sequence = ++sequenceRef.current
    flightRef.current?.abort()
    flightRef.current = controller
    if (!silencioso) {
      setLoading(true)
      setError('')
      setErrorContextKey('')
      setNotice('')
      setNoticeContextKey('')
      setRows([])
      setLoadedContextKey('')
      setSelection(null)
      setCanClaim(false)
      setClaimDialog(null)
    }
    try {
      const payload = await api.get(queueUrl('all', tipoCanal, filtro), {
        headers: { 'X-Empresa-Id': snapshot.empresaId, 'X-Loja-Id': snapshot.lojaId },
        signal: controller.signal,
      })
      if (!mountedRef.current || !openRef.current || sequence !== sequenceRef.current || contextKeyRef.current !== snapshot.contextKey) return false
      const validated = validateHumanQueueResponse(payload, snapshot)
      setRows(validated.items)
      setLoadedContextKey(snapshot.contextKey)
      setSelection(validated.selection)
      setCanClaim(validated.canClaim)
      return true
    } catch (caught) {
      if (!mountedRef.current || sequence !== sequenceRef.current || contextKeyRef.current !== snapshot.contextKey || caught?.name === 'AbortError') return false
      setRows([])
      setSelection(null)
      setCanClaim(false)
      setClaimDialog(null)
      setError(queueErrorMessage(caught))
      setErrorContextKey(snapshot.contextKey)
      return false
    } finally {
      if (flightRef.current === controller) flightRef.current = null
      if (mountedRef.current && sequence === sequenceRef.current && contextKeyRef.current === snapshot.contextKey) setLoading(false)
    }
  }, [assignment, contextKey, empresaId, lojaId, tipoCanal, filtro])

  useEffect(() => {
    mountedRef.current = true
    openRef.current = open
    clearQueue()
    openRef.current = open
    if (open) loadQueue()
    return () => {
      mountedRef.current = false
      sequenceRef.current += 1
      flightRef.current?.abort()
      claimControllerRef.current?.abort()
      flightRef.current = null
      claimControllerRef.current = null
    }
  }, [open, contextKey, clearQueue]) // loadQueue intentionally runs only on open/context or explicit update

  // Trocou o filtro: consulta de novo (o primeiro carregamento é do efeito de abertura).
  const filtroAnterior = useRef(filtro)
  useEffect(() => {
    if (filtroAnterior.current === filtro) return
    filtroAnterior.current = filtro
    if (openRef.current) loadQueue()
  }, [filtro, loadQueue])

  // Quadro aberto: atualiza sozinho a cada 30 s (pausa enquanto há uma ação em andamento).
  useEffect(() => {
    if (!open) return undefined
    const timer = setInterval(() => {
      if (!claimLockRef.current && !flightRef.current) loadQueue({ silencioso: true })
    }, 30000)
    return () => clearInterval(timer)
  }, [open, loadQueue])

  const baseRows = useMemo(() => loadedContextKey === contextKey ? rows : [], [contextKey, loadedContextKey, rows])

  const stats = useMemo(() => {
    let urgentes = 0
    let ia = 0
    let equipe = 0
    let pendentes = 0
    for (const r of baseRows) {
      const isUrgente = r.status !== 'encerrado' && (r.precisaAtendente || (r.status === 'humano' && !r.assigned))
      if (isUrgente) urgentes++
      else if (r.status === 'humano') equipe++
      else if (r.status === 'ativo') ia++
      if (r.status !== 'encerrado' && r.hasPendingAction) pendentes++
    }
    return { urgentes, ia, equipe, pendentes, total: baseRows.length }
  }, [baseRows])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (stats.urgentes > 0) {
      document.title = `(🚨 ${stats.urgentes}) Fila WhatsApp · Kytto`
      if (somHabilitado && stats.urgentes > prevUrgentesRef.current) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(587.33, ctx.currentTime)
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
          gain.gain.setValueAtTime(0.12, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
        } catch {}
      }
    } else {
      document.title = 'Fila WhatsApp · Kytto'
    }
    prevUrgentesRef.current = stats.urgentes
  }, [stats.urgentes, somHabilitado])

  const displayedRows = useMemo(() => {
    let list = baseRows
    if (subFiltro === 'urgentes') {
      list = list.filter((r) => r.status !== 'encerrado' && (r.precisaAtendente || (r.status === 'humano' && !r.assigned)))
    } else if (subFiltro === 'ia') {
      list = list.filter((r) => r.status === 'ativo' && !r.precisaAtendente)
    } else if (subFiltro === 'equipe') {
      list = list.filter((r) => r.status === 'humano')
    } else if (subFiltro === 'pendentes') {
      list = list.filter((r) => r.status !== 'encerrado' && r.hasPendingAction)
    }

    const q = busca.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const nome = (r.nome || '').toLowerCase()
      const tel = (r.telefone || '').toLowerCase()
      const msgC = (r.ultimaMensagemCliente || '').toLowerCase()
      const msgIa = (r.ultimaRespostaIa || '').toLowerCase()
      const mot = (r.handoff_label || '').toLowerCase()
      return nome.includes(q) || tel.includes(q) || msgC.includes(q) || msgIa.includes(q) || mot.includes(q)
    })
  }, [baseRows, subFiltro, busca])

  function openQueue() {
    openRef.current = true
    setOpen(true)
  }

  function closeQueue() {
    openRef.current = false
    setOpen(false)
    clearQueue()
  }


  function requestClaim(item) {
    if (!canClaim || (item.assigned && !item.isMine) || !selection || claimingId) return
    setNotice('')
    setNoticeContextKey('')
    setError('')
    setErrorContextKey('')
    setClaimDialog({ item, selection, contextKey })
  }

  function requestClose(item) {
    if (!canClaim || item.status === 'encerrado' || !selection || claimingId) return
    setNotice('')
    setNoticeContextKey('')
    setError('')
    setErrorContextKey('')
    setClaimDialog({ item, selection, contextKey, acao: 'encerrar' })
  }

  async function requestRelease(item) {
    if (!canClaim || item.status !== 'humano' || claimingId) return
    setError('')
    setErrorContextKey('')
    
    const controller = new AbortController()
    claimLockRef.current = controller
    const sessionId = item.id
    claimControllerRef.current = controller
    setClaimingId(sessionId)
    setNotice('')
    setNoticeContextKey('')
    try {
      const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
      const devolvida = await api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/release${canalQuery}`, { retomar: true }, {
        headers: { 'X-Empresa-Id': selection?.empresaId || '', 'X-Loja-Id': selection?.canonicalLojaId || '' },
        signal: controller.signal,
      })
      if (!mountedRef.current || claimLockRef.current !== controller || contextKeyRef.current !== contextKey || !openRef.current) return
      const refreshed = await loadQueue()
      if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
        setNotice(devolvida?.retomou
          ? 'Conversa devolvida ao T-Rex: ele já está respondendo a última mensagem do cliente, com todo o histórico.'
          : 'Conversa devolvida ao T-Rex: ele continua de onde parou na próxima mensagem do cliente.')
        setNoticeContextKey(contextKey)
        if (typeof onChanged === 'function') await onChanged()
      }
    } catch (caught) {
      if (!mountedRef.current || claimLockRef.current !== controller || caught?.name === 'AbortError' || contextKeyRef.current !== contextKey || !openRef.current) return
      setError(queueErrorMessage(caught))
      setErrorContextKey(contextKey)
    } finally {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (claimLockRef.current === controller) {
        claimLockRef.current = null
        if (mountedRef.current && contextKeyRef.current === contextKey) setClaimingId('')
      }
    }
  }

  async function requestClearPending(item) {
    if (!canClaim || !item?.hasPendingAction || claimingId) return
    setError('')
    setErrorContextKey('')
    const controller = new AbortController()
    claimLockRef.current = controller
    const sessionId = item.id
    claimControllerRef.current = controller
    setClaimingId(sessionId)
    setNotice('')
    setNoticeContextKey('')
    try {
      const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
      await api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/clear-pending${canalQuery}`, {}, {
        headers: { 'X-Empresa-Id': selection?.empresaId || '', 'X-Loja-Id': selection?.canonicalLojaId || '' },
        signal: controller.signal,
      })
      if (!mountedRef.current || claimLockRef.current !== controller || contextKeyRef.current !== contextKey || !openRef.current) return
      const refreshed = await loadQueue()
      if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
        setNotice('Ação pendente limpa com sucesso! O cliente não receberá mais avisos de confirmação pendente no rodapé.')
        setNoticeContextKey(contextKey)
        if (typeof onChanged === 'function') await onChanged()
      }
    } catch (caught) {
      if (!mountedRef.current || claimLockRef.current !== controller || caught?.name === 'AbortError' || contextKeyRef.current !== contextKey || !openRef.current) return
      setError(queueErrorMessage(caught))
      setErrorContextKey(contextKey)
    } finally {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (claimLockRef.current === controller) {
        claimLockRef.current = null
        if (mountedRef.current && contextKeyRef.current === contextKey) setClaimingId('')
      }
    }
  }

  async function requestConfirmPending(item) {
    if (!canClaim || !selection || claimLockRef.current || claimingId) return
    const controller = new AbortController()
    claimLockRef.current = controller
    claimControllerRef.current = controller
    setClaimingId(item.id)
    setError('')
    setErrorContextKey('')
    setNotice('')
    setNoticeContextKey('')
    try {
      const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
      await api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(item.id)}/confirm-pending${canalQuery}`, {}, {
        headers: { 'X-Empresa-Id': selection.empresaId, 'X-Loja-Id': selection.canonicalLojaId },
        signal: controller.signal,
      })
      if (!mountedRef.current || claimLockRef.current !== controller || contextKeyRef.current !== contextKey || !openRef.current) return
      const refreshed = await loadQueue()
      if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
        setNotice('Agendamento confirmado e gravado com sucesso na agenda da barbearia!')
        setNoticeContextKey(contextKey)
        if (typeof onChanged === 'function') await onChanged()
      }
    } catch (caught) {
      if (!mountedRef.current || claimLockRef.current !== controller || caught?.name === 'AbortError' || contextKeyRef.current !== contextKey || !openRef.current) return
      setError(queueErrorMessage(caught))
      setErrorContextKey(contextKey)
    } finally {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (claimLockRef.current === controller) {
        claimLockRef.current = null
        if (mountedRef.current && contextKeyRef.current === contextKey) setClaimingId('')
      }
    }
  }

  async function confirmClaim() {
    const dialog = claimDialog
    if (!dialog || dialog.contextKey !== contextKey || !canClaim || claimLockRef.current || claimingId) return
    const encerrar = dialog.acao === 'encerrar'
    if (!encerrar && dialog.item.assigned && !dialog.item.isMine) return
    // Ref locka sincronicamente antes do primeiro await: dois cliques não geram dois POSTs.
    const controller = new AbortController()
    claimLockRef.current = controller
    const snapshot = dialog.selection
    const sessionId = dialog.item.id
    claimControllerRef.current = controller
    setClaimingId(sessionId)
    setError('')
    setErrorContextKey('')
    setNotice('')
    setNoticeContextKey('')
    try {
      const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
      const response = await api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/${encerrar ? 'close' : 'claim'}${canalQuery}`, {}, {
        headers: { 'X-Empresa-Id': snapshot.empresaId, 'X-Loja-Id': snapshot.canonicalLojaId },
        signal: controller.signal,
      })
      if (!mountedRef.current || claimLockRef.current !== controller || contextKeyRef.current !== contextKey || !openRef.current) return
      if (encerrar) {
        setClaimDialog(null)
        const atualizado = await loadQueue()
        if (atualizado && mountedRef.current && contextKeyRef.current === contextKey) {
          setNotice('Conversa encerrada e enviada ao histórico (filtro "Encerradas"). Se o cliente escrever de novo, o T-Rex volta a atender.')
          setNoticeContextKey(contextKey)
          if (typeof onChanged === 'function') await onChanged()
        }
        return
      }
      validateClaimResponse(response, sessionId)
      setClaimDialog(null)
      const refreshed = await loadQueue()
      if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
        setNotice('Conversa assumida. O T-Rex parou de responder este contato até você devolver.')
        setNoticeContextKey(contextKey)
        setConversaId(sessionId)
        if (typeof onChanged === 'function') await onChanged()
      }
    } catch (caught) {
      if (!mountedRef.current || claimLockRef.current !== controller || caught?.name === 'AbortError' || contextKeyRef.current !== contextKey || !openRef.current) return
      if (caught?.status === 409 || caught?.code === 'WHATSAPP_AI_SESSION_CONFLICT') {
        setClaimDialog(null)
        const refreshed = await loadQueue()
        if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
          setNotice('Esta conversa não está mais disponível para atribuição. A fila foi atualizada.')
          setNoticeContextKey(contextKey)
        }
      } else if (isUncertainClaimError(caught)) {
        setClaimDialog(null)
        setRows([])
        setLoadedContextKey('')
        setSelection(null)
        setCanClaim(false)
        setError(queueErrorMessage({ ...caught, uncertain: true }))
        setErrorContextKey(contextKey)
      } else {
        setClaimDialog(null)
        setRows([])
        setLoadedContextKey('')
        setSelection(null)
        setCanClaim(false)
        setError(queueErrorMessage(caught))
        setErrorContextKey(contextKey)
      }
    } finally {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (claimLockRef.current === controller) {
        claimLockRef.current = null
        if (mountedRef.current && contextKeyRef.current === contextKey) setClaimingId('')
      }
    }
  }

  const queueTitle = open ? 'Conversas do T-Rex no WhatsApp' : 'Atendimento humano'
  const operator = safeText(operatorLabel)
  const activeClaimDialog = claimDialog?.contextKey === contextKey ? claimDialog : null
  const visibleError = errorContextKey === contextKey ? error : ''
  const visibleNotice = noticeContextKey === contextKey ? notice : ''

  useEffect(() => {
    const empresaId = selection?.empresaId
    if (tipoCanal !== 'cliente' || !empresaId) { setQuedaWhatsapp(null); return undefined }
    let vivo = true
    const consultar = async () => {
      try {
        const data = await api.get('/api/admin/barbearia/whatsapp-conexao', { headers: { 'X-Empresa-Id': empresaId, 'X-Loja-Id': selection?.canonicalLojaId || '' } })
        if (!vivo) return
        const conexao = data && typeof data === 'object' ? data.conexao : null
        setQuedaWhatsapp(conexao?.foraDoAr ? { desde: conexao.lastDisconnectAt || null } : null)
      } catch { if (vivo) setQuedaWhatsapp(null) }
    }
    consultar()
    const timer = setInterval(consultar, 60000)
    return () => { vivo = false; clearInterval(timer) }
  }, [selection?.empresaId, selection?.canonicalLojaId, tipoCanal])

  return <section className="dadm-card wa-human-queue" aria-labelledby="wa-human-queue-title">
    <div className="c360-card-head wa-human-queue__head">
      <div>
        <h2 id="wa-human-queue-title">{queueTitle}</h2>
        <p className="wa-human-queue__intro">Todas as conversas em andamento com o T-Rex. Em vermelho, as que ele não conseguiu resolver: o atendente deve assumir: a conversa abre com todo o histórico e ele responde por ali. Conversas encerradas ficam no histórico e só aparecem pelo filtro. A tela atualiza sozinha a cada 30 segundos.</p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {!standalone && <button type="button" className="c360-btn ghost" onClick={() => window.open('/admin/whatsapp-fila' + (tipoCanal !== 'cliente' ? '?canal=' + tipoCanal : ''), '_blank')}>Abrir fila em nova janela</button>}
        {!standalone && <button type="button" className="c360-btn ghost" onClick={open ? closeQueue : openQueue} aria-expanded={open}>{open ? 'Fechar fila' : 'Abrir fila aqui'}</button>}
      </div>
    </div>

    {open && <>
      <div className="wa-human-queue__toolbar" aria-label="Filtros da fila humana">
        <label className="wa-trex-filtro" htmlFor="wa-trex-filtro">Status
          <select id="wa-trex-filtro" value={filtro} onChange={(event) => setFiltro(event.target.value)} disabled={loading || Boolean(claimingId)}>
            {FILTROS_QUADRO.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
          </select>
        </label>
        <div className="wa-trex-busca-wrapper">
          <input
            type="search"
            className="wa-trex-busca"
            placeholder="🔍 Buscar por nome, telefone ou mensagem…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`c360-btn ghost ${somHabilitado ? 'primary' : ''}`}
          onClick={() => {
            const novo = !somHabilitado
            setSomHabilitado(novo)
            try { localStorage.setItem('kytto_wa_som', String(novo)) } catch {}
          }}
          title="Ativar/desativar aviso sonoro ao chegar nova conversa urgente"
        >
          {somHabilitado ? '🔔 Som Ativo' : '🔕 Som Desativado'}
        </button>
        <button type="button" className="c360-btn ghost" onClick={loadQueue} disabled={loading || Boolean(claimingId)}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
      </div>

      <div className="wa-trex-stats" role="tablist" aria-label="Filtros rápidos">
        <button
          type="button"
          className={`wa-trex-pill wa-trex-pill--urgente ${subFiltro === 'urgentes' ? 'active' : ''} ${stats.urgentes > 0 ? 'has-urgentes' : ''}`}
          onClick={() => setSubFiltro(subFiltro === 'urgentes' ? 'todas' : 'urgentes')}
        >
          🚨 Coleta Urgente ({stats.urgentes})
        </button>
        <button
          type="button"
          className={`wa-trex-pill ${subFiltro === 'ia' ? 'active' : ''}`}
          onClick={() => setSubFiltro(subFiltro === 'ia' ? 'todas' : 'ia')}
        >
          🤖 Com T-Rex ({stats.ia})
        </button>
        <button
          type="button"
          className={`wa-trex-pill ${subFiltro === 'equipe' ? 'active' : ''}`}
          onClick={() => setSubFiltro(subFiltro === 'equipe' ? 'todas' : 'equipe')}
        >
          👤 Com Atendentes ({stats.equipe})
        </button>
        <button
          type="button"
          className={`wa-trex-pill ${subFiltro === 'pendentes' ? 'active' : ''}`}
          onClick={() => setSubFiltro(subFiltro === 'pendentes' ? 'todas' : 'pendentes')}
        >
          ⏳ Aguardando SIM ({stats.pendentes})
        </button>
        <button
          type="button"
          className={`wa-trex-pill ${subFiltro === 'todas' ? 'active' : ''}`}
          onClick={() => setSubFiltro('todas')}
        >
          📋 Todas ({stats.total})
        </button>
      </div>
      <p className="wa-human-queue__scope">Escopo: {safeText(empresaNome, 'empresa atual')} · {safeText(lojaNome, 'unidade atual')} · até {HUMAN_QUEUE_LIMIT} conversas por leitura.</p>
      {quedaWhatsapp && <p className="dadm-note danger" role="alert"><strong>O WhatsApp da loja está desconectado do Kytto{quedaWhatsapp.desde ? ` desde ${queueDateLabel(quedaWhatsapp.desde)}` : ''}.</strong> As mensagens dos clientes chegam no celular, mas o atendente virtual não recebe nem responde. <a href="/admin/whatsapp">Abra a Conexão do WhatsApp</a>, gere o QR e leia pelo celular da loja (WhatsApp › Aparelhos conectados).</p>}
      {visibleError && <p className="dadm-note danger" role="alert">{visibleError}</p>}
      {visibleNotice && <p className="dadm-note" role="status">{visibleNotice}</p>}
      {!loading && !visibleError && loadedContextKey === contextKey && !canClaim && <p className="dadm-note">A atribuição de conversas não está habilitada para o seu acesso.</p>}
      <div aria-live="polite">
        {!visibleError && !loading && loadedContextKey === contextKey && displayedRows.length === 0 && <EmptyQueue loading={loading} error={visibleError} />}
        {loading && <EmptyQueue loading={loading} error={visibleError} />}
        {!visibleError && displayedRows.length > 0 && <div className="wa-trex-board">
          {displayedRows.map((item) => {
            const comEquipe = item.status === 'humano'
            const encerrada = item.status === 'encerrado'
            const precisaColetaUrgente = !encerrada && (item.precisaAtendente || (comEquipe && !item.assigned))
            const tom = encerrada ? 'encerrada' : precisaColetaUrgente ? 'alerta' : comEquipe ? 'equipe' : 'ia'
            const titulo = item.nome || item.telefone
            const situacao = encerrada ? 'Encerrada' : precisaColetaUrgente
              ? `🚨 URGENTE · ${item.handoff_label}`
              : comEquipe ? (item.assigned ? (item.isMine ? 'Com você' : 'Com outro atendente') : `Com a equipe · ${item.handoff_label}`) : 'Em conversa com o T-Rex'
            return (
              <article key={item.id} className={`wa-trex-card wa-trex-card--${tom}${precisaColetaUrgente ? ' wa-trex-card--urgente' : ''}`} aria-label={`Conversa ${titulo}: ${situacao}`}>
                <header className="wa-trex-card__head">
                  <div>
                    <strong className="wa-trex-card__nome">{titulo}</strong>
                    {item.nome && <span className="wa-trex-card__fone">{item.telefone}</span>}
                  </div>
                  <span className="wa-trex-card__selo">{situacao}</span>
                </header>
                {precisaColetaUrgente && <p className="wa-trex-card__aviso" role="alert">🚨 Coleta urgente: o atendente deve assumir esta conversa.</p>}
                {!encerrada && item.hasPendingAction && (
                  <div className="wa-trex-card__msg" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#fbbf24' }}>
                      <b>⏳ Aguardando SIM:</b> {item.pendingSummary || 'Confirmação de agendamento pendente'}
                    </span>
                    {canClaim && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="c360-btn primary" style={{ padding: '3px 8px', fontSize: 11 }} disabled={Boolean(claimingId)} onClick={() => requestConfirmPending(item)} title="Confirma e grava o agendamento pendente imediatamente na agenda">
                          ✅ Fechar Agendamento
                        </button>
                        <button type="button" className="c360-btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} disabled={Boolean(claimingId)} onClick={() => requestClearPending(item)} title="Remove a ação pendente do rodapé desta conversa">
                          🧹 Destravar pendência
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {item.ultimaMensagemCliente && <p className="wa-trex-card__msg"><b>Cliente:</b> {item.ultimaMensagemCliente}</p>}
                {item.ultimaRespostaIa && <p className="wa-trex-card__msg wa-trex-card__msg--ia"><b>T-Rex:</b> {item.ultimaRespostaIa}</p>}
                <p className="wa-trex-card__meta">
                  Última mensagem: <strong>{queueDateLabel(item.ultima_interacao_em)}</strong>
                  {comEquipe && <> · Esperando: <strong>{queueWaitLabel(item.handoff_requested_at)}</strong></>}
                  {encerrada && item.closed_at && <> · Encerrada: <strong>{queueDateLabel(item.closed_at)}</strong></>}
                </p>
                <button type="button" className="c360-btn ghost wa-trex-card__ver" onClick={() => setConversaId(item.id)}>Ver conversa completa</button>
                {encerrada ? <p className="wa-trex-card__meta">No histórico. Se o cliente escrever de novo, o T-Rex volta a atender.</p> : <div className="wa-trex-card__acoes">
                  <button type="button" className="c360-btn primary" disabled={!canClaim || (item.assigned && !item.isMine) || item.isMine || Boolean(claimingId)} onClick={() => requestClaim(item)}>
                    {item.isMine ? 'Assumida por você' : item.assigned ? 'Já assumida' : 'Assumir conversa'}
                  </button>
                  <button type="button" className="c360-btn ghost" disabled={!canClaim || !comEquipe || Boolean(claimingId)} onClick={() => requestRelease(item)} title={comEquipe ? 'O T-Rex volta a responder este contato' : 'Esta conversa já está com o T-Rex'}>
                    Devolver ao T-Rex
                  </button>
                  <button type="button" className="c360-btn ghost wa-trex-card__encerrar" disabled={!canClaim || Boolean(claimingId)} onClick={() => requestClose(item)} title="Tira do quadro e guarda no histórico">
                    Encerrar conversa
                  </button>
                </div>}
              </article>
            )
          })}
        </div>}
      </div>
    </>}

    {conversaId && selection && <WhatsappConversationPanel
      sessionId={conversaId}
      empresaId={selection.empresaId}
      lojaId={selection.canonicalLojaId}
      tipoCanal={tipoCanal}
      canAct={canClaim}
      onClose={() => { setConversaId(''); loadQueue({ silencioso: true }) }}
      onChanged={async () => { await loadQueue({ silencioso: true }); if (typeof onChanged === 'function') await onChanged() }}
    />}

    <Dialog open={Boolean(activeClaimDialog)} title={activeClaimDialog?.acao === 'encerrar' ? 'Encerrar conversa?' : 'Assumir conversa?'} labelId="wa-human-queue-claim" onClose={() => { if (!claimingId) setClaimDialog(null) }} onSubmit={confirmClaim}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setClaimDialog(null)} disabled={Boolean(claimingId)}>Cancelar</button><button type="submit" className="c360-btn primary" disabled={Boolean(claimingId)}>{activeClaimDialog?.acao === 'encerrar' ? (claimingId ? 'Encerrando…' : 'Encerrar conversa') : (claimingId ? 'Assumindo…' : 'Assumir conversa')}</button></>}>
      {activeClaimDialog?.acao === 'encerrar' ? <>
        <p>A conversa sai do quadro e fica no histórico (filtro <strong>Encerradas</strong>). Nenhuma mensagem é enviada ao cliente.</p>
        <p>Se o cliente escrever de novo, o T-Rex volta a atender.</p>
      </> : <>
        <p>Esta conversa será atribuída ao operador logado: <strong>{operator}</strong>.</p>
        <p>Empresa: <strong>{safeText(empresaNome)}</strong><br />Unidade: <strong>{safeText(lojaNome)}</strong></p>
        <p>O T-Rex para de responder este contato até a conversa ser devolvida a ele. A conversa abre ao lado com todo o histórico, e você responde por ali.</p>
      </>}
    </Dialog>
  </section>
}
