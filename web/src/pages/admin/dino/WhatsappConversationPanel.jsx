import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { HUMAN_QUEUE_PATH, queueDateLabel, queueErrorMessage } from './whatsapp-human-queue'

const AUTORES = {
  cliente: 'Cliente',
  trex: 'T-Rex',
  equipe: 'Equipe',
}

const ENTREGA = {
  sending: 'enviando…',
  failed: 'não enviada',
  unknown: 'envio não confirmado',
  skipped: 'não enviada',
}

/**
 * Painel da conversa: todo o histórico (cliente, T-Rex e equipe) atualizado a cada 5 s,
 * resposta do atendente pelo WhatsApp da loja, devolver ao T-Rex e encerrar.
 */
export default function WhatsappConversationPanel({
  sessionId,
  empresaId,
  lojaId,
  tipoCanal = 'cliente',
  canAct = false,
  onClose,
  onChanged,
}) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [retomar, setRetomar] = useState(true)
  const [confirmar, setConfirmar] = useState('')
  const listaRef = useRef(null)
  const ultimoIdRef = useRef('')
  const vivoRef = useRef(true)
  const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
  const headers = { 'X-Empresa-Id': empresaId || '', 'X-Loja-Id': lojaId || '' }

  const carregar = useCallback(async () => {
    if (!sessionId) return
    try {
      const payload = await api.get(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/messages${canalQuery}`, { headers })
      if (!vivoRef.current) return
      // Resposta fora do formato esperado não derruba a tela.
      if (!payload || typeof payload !== 'object' || !payload.sessao || !Array.isArray(payload.mensagens)) throw new Error('Resposta inválida ao abrir a conversa.')
      setDados(payload)
      setErro('')
    } catch (caught) {
      if (vivoRef.current) setErro(queueErrorMessage(caught))
    }
  }, [sessionId, empresaId, lojaId, canalQuery])

  useEffect(() => {
    vivoRef.current = true
    setDados(null)
    ultimoIdRef.current = ''
    carregar()
    const timer = setInterval(carregar, 5000)
    return () => { vivoRef.current = false; clearInterval(timer) }
  }, [carregar])

  // Rola para a última mensagem quando chega coisa nova.
  useEffect(() => {
    const mensagens = dados?.mensagens || []
    const ultimo = mensagens.at(-1)?.id || ''
    if (ultimo && ultimo !== ultimoIdRef.current && listaRef.current) {
      ultimoIdRef.current = ultimo
      listaRef.current.scrollTop = listaRef.current.scrollHeight
    }
  }, [dados])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const fecharNoEsc = (event) => { if (event.key === 'Escape' && !ocupado) onClose?.() }
    window.addEventListener('keydown', fecharNoEsc)
    return () => window.removeEventListener('keydown', fecharNoEsc)
  }, [onClose, ocupado])

  const sessao = dados?.sessao
  const comEquipe = sessao?.status === 'humano'
  const encerrada = sessao?.status === 'encerrado'
  const outroAtendente = Boolean(sessao?.assumida && !sessao?.minha)
  const podeResponder = canAct && comEquipe && !outroAtendente

  async function acao(nome, executar, sucesso) {
    if (ocupado) return
    setOcupado(nome)
    setErro('')
    setAviso('')
    try {
      const resultado = await executar()
      if (!vivoRef.current) return
      setAviso(typeof sucesso === 'function' ? sucesso(resultado) : sucesso)
      await carregar()
      if (typeof onChanged === 'function') await onChanged()
      return resultado
    } catch (caught) {
      if (vivoRef.current) setErro(queueErrorMessage(caught))
      return null
    } finally {
      if (vivoRef.current) setOcupado('')
    }
  }

  async function enviar(event) {
    event?.preventDefault()
    const mensagem = texto.trim()
    if (!mensagem || !podeResponder) return
    const ok = await acao('enviar', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/messages${canalQuery}`, { texto: mensagem }, { headers }), 'Mensagem enviada ao cliente pelo WhatsApp.')
    if (ok) setTexto('')
  }

  async function assumir() {
    await acao('assumir', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/claim${canalQuery}`, {}, { headers }), 'Conversa assumida. O T-Rex parou de responder este contato até você devolver.')
  }

  async function devolver() {
    setConfirmar('')
    await acao('devolver', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/release${canalQuery}`, { retomar }, { headers }),
      (r) => r?.retomou ? 'Devolvida ao T-Rex: ele já está respondendo a última mensagem do cliente, com todo o histórico.' : 'Devolvida ao T-Rex: ele continua de onde parou na próxima mensagem do cliente.')
  }

  async function encerrar() {
    setConfirmar('')
    const ok = await acao('encerrar', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/close${canalQuery}`, {}, { headers }), 'Conversa encerrada e guardada no histórico.')
    if (ok) onClose?.({ encerrada: true })
  }

  const situacao = !sessao ? '' : encerrada ? 'Encerrada · no histórico'
    : comEquipe ? (sessao.minha ? 'Com você' : sessao.assumida ? 'Com outro atendente' : `Esperando a equipe${sessao.motivo ? ` · ${sessao.motivo}` : ''}`)
      : 'Em conversa com o T-Rex'

  return <div className="wa-conv-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) onClose?.() }}>
    <aside className="wa-conv" role="dialog" aria-modal="true" aria-labelledby="wa-conv-titulo">
      <header className="wa-conv__head">
        <div>
          <h2 id="wa-conv-titulo">{sessao?.nome || sessao?.telefone || 'Conversa'}</h2>
          <p className="wa-conv__sub">{sessao?.nome ? `${sessao.telefone} · ` : ''}{situacao}</p>
        </div>
        <button type="button" className="c360-btn ghost" onClick={() => onClose?.()} disabled={Boolean(ocupado)} aria-label="Fechar conversa">Fechar</button>
      </header>

      {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
      {aviso && <p className="dadm-note" role="status">{aviso}</p>}

      <div className="wa-conv__lista" ref={listaRef} aria-live="polite">
        {!dados && !erro && <p className="c360-empty">Carregando a conversa…</p>}
        {dados && dados.mensagens.length === 0 && <p className="c360-empty">Nenhuma mensagem registrada nesta conversa.</p>}
        {(dados?.mensagens || []).map((m) => <div key={m.id} className={`wa-conv__msg wa-conv__msg--${m.autor}`}>
          <span className="wa-conv__autor">{AUTORES[m.autor] || m.autor}{m.autorNome ? ` · ${m.autorNome}` : ''}</span>
          <p className="wa-conv__texto">{m.texto}</p>
          {m.enquete && <ul className="wa-conv__enquete" aria-label="Enquete enviada">
            <li><b>📊 {m.enquete.pergunta}</b></li>
            {m.enquete.opcoes.map((o, i) => <li key={i}>{i + 1}. {o}</li>)}
          </ul>}
          <span className="wa-conv__hora">{queueDateLabel(m.em)}{m.entrega && ENTREGA[m.entrega] ? ` · ${ENTREGA[m.entrega]}` : ''}</span>
        </div>)}
      </div>

      {encerrada ? <p className="wa-conv__rodape">Conversa no histórico. Se o cliente escrever de novo, o T-Rex volta a atender.</p> : <>
        {podeResponder ? <form className="wa-conv__composer" onSubmit={enviar}>
          <textarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={3} maxLength={4000}
            placeholder="Responder ao cliente pelo WhatsApp da loja…" disabled={Boolean(ocupado)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); enviar() } }} />
          <button type="submit" className="c360-btn primary" disabled={!texto.trim() || Boolean(ocupado)}>{ocupado === 'enviar' ? 'Enviando…' : 'Enviar'}</button>
        </form> : <p className="wa-conv__rodape">
          {!canAct ? 'Seu acesso permite só ver a conversa.' : outroAtendente ? 'Outro atendente está com esta conversa.' : 'O T-Rex está atendendo. Assuma para responder por aqui.'}
        </p>}
        {canAct && <div className="wa-conv__acoes">
          {!comEquipe && <button type="button" className="c360-btn primary" onClick={assumir} disabled={Boolean(ocupado)}>{ocupado === 'assumir' ? 'Assumindo…' : 'Assumir conversa'}</button>}
          {comEquipe && !outroAtendente && <>
            <label className="wa-conv__retomar">
              <input type="checkbox" checked={retomar} onChange={(event) => setRetomar(event.target.checked)} disabled={Boolean(ocupado)} />
              T-Rex responde já a última mensagem do cliente, se ninguém respondeu
            </label>
            {confirmar === 'devolver'
              ? <span className="wa-conv__confirma">Devolver ao T-Rex? <button type="button" className="c360-btn primary" onClick={devolver} disabled={Boolean(ocupado)}>Sim, devolver</button> <button type="button" className="c360-btn ghost" onClick={() => setConfirmar('')}>Não</button></span>
              : <button type="button" className="c360-btn ghost" onClick={() => setConfirmar('devolver')} disabled={Boolean(ocupado)}>{ocupado === 'devolver' ? 'Devolvendo…' : 'Devolver ao T-Rex'}</button>}
          </>}
          {confirmar === 'encerrar'
            ? <span className="wa-conv__confirma">Encerrar e guardar no histórico? <button type="button" className="c360-btn primary" onClick={encerrar} disabled={Boolean(ocupado)}>Sim, encerrar</button> <button type="button" className="c360-btn ghost" onClick={() => setConfirmar('')}>Não</button></span>
            : <button type="button" className="c360-btn ghost wa-trex-card__encerrar" onClick={() => setConfirmar('encerrar')} disabled={Boolean(ocupado) || outroAtendente}>{ocupado === 'encerrar' ? 'Encerrando…' : 'Encerrar conversa'}</button>}
        </div>}
      </>}
    </aside>
  </div>
}
