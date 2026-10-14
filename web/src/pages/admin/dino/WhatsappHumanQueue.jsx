import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { Dialog } from '../customer360/shared'
import {
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
  empresaNome = 'empresa atual',
  lojaNome = 'unidade atual',
  operatorLabel = 'operador logado',
  onChanged,
}) {
  const contextKey = `${String(empresaId || '')}\u0000${String(lojaId || '')}`
  const [open, setOpen] = useState(false)
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
  const [claimingId, setClaimingId] = useState('')
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

  const loadQueue = useCallback(async () => {
    if (!mountedRef.current || !openRef.current) return false
    const snapshot = { empresaId: String(empresaId || ''), lojaId: String(lojaId || ''), contextKey: String(contextKey) }
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
    try {
      const payload = await api.get(queueUrl(assignmentRef.current), {
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
  }, [assignment, contextKey, empresaId, lojaId])

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

  const displayedRows = useMemo(() => loadedContextKey === contextKey ? rows : [], [contextKey, loadedContextKey, rows])

  function openQueue() {
    openRef.current = true
    setOpen(true)
  }

  function closeQueue() {
    openRef.current = false
    setOpen(false)
    clearQueue()
  }

  function chooseAssignment(event) {
    const value = event.target.value === 'all' ? 'all' : 'unassigned'
    clearQueue()
    assignmentRef.current = value
    setAssignment(value)
    setRows([])
    setLoadedContextKey('')
    setSelection(null)
    setCanClaim(false)
    setNotice('Filtro alterado. Toque em Atualizar fila para consultar esta visão.')
    setNoticeContextKey(contextKey)
  }

  function requestClaim(item) {
    if (!canClaim || item.assigned !== false || !selection || claimingId) return
    setNotice('')
    setNoticeContextKey('')
    setError('')
    setErrorContextKey('')
    setClaimDialog({ item, selection, contextKey })
  }

  async function confirmClaim() {
    const dialog = claimDialog
    if (!dialog || dialog.contextKey !== contextKey || !canClaim || dialog.item.assigned !== false || claimLockRef.current || claimingId) return
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
      const response = await api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/claim`, {}, {
        headers: { 'X-Empresa-Id': snapshot.empresaId, 'X-Loja-Id': snapshot.canonicalLojaId },
        signal: controller.signal,
      })
      if (!mountedRef.current || claimLockRef.current !== controller || contextKeyRef.current !== contextKey || !openRef.current) return
      validateClaimResponse(response, sessionId)
      setClaimDialog(null)
      const refreshed = await loadQueue()
      if (refreshed && mountedRef.current && contextKeyRef.current === contextKey) {
        setNotice('Atendimento assumido. A fila foi atualizada.')
        setNoticeContextKey(contextKey)
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

  const queueTitle = open ? 'Fila humana do WhatsApp' : 'Atendimento humano'
  const operator = safeText(operatorLabel)
  const activeClaimDialog = claimDialog?.contextKey === contextKey ? claimDialog : null
  const visibleError = errorContextKey === contextKey ? error : ''
  const visibleNotice = noticeContextKey === contextKey ? notice : ''

  return <section className="dadm-card wa-human-queue" aria-labelledby="wa-human-queue-title">
    <div className="c360-card-head wa-human-queue__head">
      <div>
        <h2 id="wa-human-queue-title">{queueTitle}</h2>
        <p className="wa-human-queue__intro">Conversas encaminhadas para atendimento humano. Esta tela não envia mensagens nem retoma a automação. Fechar e reabrir descarta a leitura e consulta novamente.</p>
      </div>
      <button type="button" className="c360-btn ghost" onClick={open ? closeQueue : openQueue} aria-expanded={open}>{open ? 'Fechar fila' : 'Abrir fila'}</button>
    </div>

    {open && <>
      <div className="wa-human-queue__toolbar" aria-label="Filtros da fila humana">
        <label className="c360-field" htmlFor="wa-human-queue-assignment">Conversas
          <select id="wa-human-queue-assignment" className="c360-input" value={assignment} onChange={chooseAssignment} disabled={loading || Boolean(claimingId)}>
            <option value="unassigned">Sem responsável</option>
            <option value="all">Todos humanos</option>
          </select>
        </label>
        <button type="button" className="c360-btn ghost" onClick={loadQueue} disabled={loading || Boolean(claimingId)}>{loading ? 'Atualizando…' : 'Atualizar fila'}</button>
      </div>
      <p className="wa-human-queue__scope">Escopo: {safeText(empresaNome, 'empresa atual')} · {safeText(lojaNome, 'unidade atual')} · até {HUMAN_QUEUE_LIMIT} conversas por leitura.</p>
      {visibleError && <p className="dadm-note danger" role="alert">{visibleError}</p>}
      {visibleNotice && <p className="dadm-note" role="status">{visibleNotice}</p>}
      {!loading && !visibleError && loadedContextKey === contextKey && !canClaim && <p className="dadm-note">A atribuição de conversas não está habilitada para o seu acesso.</p>}
      <div aria-live="polite">
        {!visibleError && !loading && loadedContextKey === contextKey && displayedRows.length === 0 && <EmptyQueue loading={loading} error={visibleError} />}
        {loading && <EmptyQueue loading={loading} error={visibleError} />}
        {!visibleError && displayedRows.length > 0 && <div className="wa-human-queue__table-wrap">
          <table className="c360-table wa-human-queue__table">
            <caption className="sr-only">Conversas aguardando atendimento humano</caption>
            <thead><tr><th scope="col">Conversa</th><th scope="col">Motivo</th><th scope="col">Espera</th><th scope="col">Responsável</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead>
            <tbody>{displayedRows.map((item) => <tr key={item.id}>
              <td data-label="Conversa"><strong>{item.telefone}</strong><small>Última interação: {queueDateLabel(item.ultima_interacao_em)}</small></td>
              <td data-label="Motivo"><span className="c360-badge tone-muted">{item.handoff_label}</span></td>
              <td data-label="Espera">{queueWaitLabel(item.handoff_requested_at)}</td>
              <td data-label="Responsável">{item.assigned ? (item.isMine ? 'Você' : 'Outro atendente') : 'Sem responsável'}</td>
              <td data-label="Ação"><button type="button" className="c360-btn primary wa-human-queue__claim" disabled={!canClaim || item.assigned || Boolean(claimingId)} onClick={() => requestClaim(item)}>{item.assigned ? (item.isMine ? 'Assumida por você' : 'Já assumida') : 'Assumir atendimento'}</button></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </>}

    <Dialog open={Boolean(activeClaimDialog)} title="Assumir atendimento?" labelId="wa-human-queue-claim" onClose={() => { if (!claimingId) setClaimDialog(null) }} onSubmit={confirmClaim}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setClaimDialog(null)} disabled={Boolean(claimingId)}>Cancelar</button><button type="submit" className="c360-btn primary" disabled={Boolean(claimingId)}>{claimingId ? 'Assumindo…' : 'Confirmar atribuição'}</button></>}>
      <p>Esta conversa será atribuída ao operador logado: <strong>{operator}</strong>.</p>
      <p>Empresa: <strong>{safeText(empresaNome)}</strong><br />Unidade: <strong>{safeText(lojaNome)}</strong></p>
      <p>Não haverá envio de mensagem nem retomada da automação.</p>
    </Dialog>
  </section>
}
