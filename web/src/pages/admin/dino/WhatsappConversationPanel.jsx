import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { HUMAN_QUEUE_PATH, queueDateLabel, queueErrorMessage } from './whatsapp-human-queue'

const AUTORES = {
  cliente: 'Cliente',
  trex: 'T-Rex',
  equipe: 'Equipe',
}


const RESPOSTAS_RAPIDAS = [
  { rotulo: "👋 Olá", texto: "Olá! Sou da equipe de atendimento da barbearia. Como posso te ajudar hoje?" },
  { rotulo: "💈 Vou ver horários", texto: "Vou conferir a disponibilidade com os barbeiros agora mesmo e já te passo as opções!" },
  { rotulo: "✅ Confirmado!", texto: "Perfeito! Seu agendamento está 100% confirmado na nossa agenda. Te esperamos!" },
  { rotulo: "📍 Endereço", texto: "Estamos na barbearia com estacionamento exclusivo e gratuito para clientes." },
  { rotulo: "💳 Chave PIX", texto: "Nossa chave PIX é o CNPJ 50.073.355/0001-89 (Dino Barbearia)." },
  { rotulo: "⏳ Um segundinho", texto: "Só um instante enquanto finalizo o atendimento anterior e já continuo com você!" },
];

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
  initialText = '',
  onClose,
  onNovaConversa,
  onChanged,
}) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [texto, setTexto] = useState(() => {
    if (initialText) return initialText
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('mensagem') || p.get('texto') || ''
    } catch {
      return ''
    }
  })
  const [ocupado, setOcupado] = useState('')
  const [retomar, setRetomar] = useState(true)
  const [confirmar, setConfirmar] = useState('')
  const [nomesProfissionaisBanco, setNomesProfissionaisBanco] = useState([])
  const listaRef = useRef(null)
  const ultimoIdRef = useRef('')
  const vivoRef = useRef(true)
  const canalQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
  const headers = { 'X-Empresa-Id': empresaId || '', 'X-Loja-Id': lojaId || '' }

  useEffect(() => {
    if (initialText) {
      setTexto(initialText)
    }
  }, [initialText])

  useEffect(() => {
    let ativo = true
    api.get('/api/admin/barbearia/profissionais', { headers: { 'X-Empresa-Id': empresaId || '', 'X-Loja-Id': lojaId || '' } })
      .then((res) => {
        if (!ativo) return
        const lista = Array.isArray(res) ? res : (res?.profissionais || res?.items || [])
        const nomes = [...new Set(
          lista
            .filter((p) => p && p.ativo !== false && p.atendeCliente !== false && !p.historicoAvec && !p.consolidadoEm)
            .map((p) => String(p.apelido || p.nome || '').trim().split(' ')[0])
            .filter(Boolean)
        )]
        setNomesProfissionaisBanco(nomes)
      })
      .catch(() => {})
    return () => { ativo = false }
  }, [empresaId, lojaId])

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
  const podeResponder = canAct && !outroAtendente && !encerrada

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
    const msgSucesso = !comEquipe
      ? 'Conversa assumida com sucesso e mensagem enviada pelo WhatsApp.'
      : 'Mensagem enviada ao cliente pelo WhatsApp.'
    const ok = await acao('enviar', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/messages${canalQuery}`, { texto: mensagem }, { headers }), msgSucesso)
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

  async function limparPendencia() {
    await acao('limparPendencia', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/clear-pending${canalQuery}`, {}, { headers }), 'Ação pendente removida com sucesso! O cliente não receberá mais cobrança de SIM no rodapé.')
  }

  async function confirmarPendencia() {
    await acao('confirmarPendencia', () => api.post(`${HUMAN_QUEUE_PATH}/${encodeURIComponent(sessionId)}/confirm-pending${canalQuery}`, {}, { headers }), 'Agendamento confirmado e gravado com sucesso na agenda da barbearia!')
  }

  async function inserirHorariosLivresHoje() {
    if (ocupado) return
    setOcupado('horarios')
    setErro('')
    try {
      const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date())
      const servs = await api.get('/api/admin/barbearia/servicos', { headers }).catch(() => [])
      const listaServ = Array.isArray(servs) ? servs : (servs?.servicos || servs?.items || [])
      const corte = listaServ.find((s) => /corte\s+premium/i.test(s.nome)) || listaServ.find((s) => /corte/i.test(s.nome)) || listaServ[0]
      if (!corte?.id) throw new Error('Serviço de corte não encontrado para consulta rápida.')
      const resp = await api.get(`/api/admin/barbearia/horarios-livres?data=${hojeIso}&servicoId=${encodeURIComponent(corte.id)}&profissionalId=qualquer`, { headers })
      const horarios = (Array.isArray(resp) ? resp : (resp?.horarios || [])).filter((h) => h.disponivel)
      if (horarios.length > 0) {
        const opcoes = horarios.slice(0, 4).map((h) => `${h.horario}${h.profissionalNome ? ` (com ${h.profissionalNome})` : ''}`).join(', ')
        const sugestao = `Para hoje tenho disponível às ${opcoes}. Qual desses horários fica melhor pra você?`
        setTexto((prev) => prev ? `${prev} ${sugestao}` : sugestao)
        setAviso('Horários livres de hoje inseridos na mensagem!')
      } else {
        const amanha = new Date(Date.now() + 86400000)
        const amanhaIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(amanha)
        const respAmanha = await api.get(`/api/admin/barbearia/horarios-livres?data=${amanhaIso}&servicoId=${encodeURIComponent(corte.id)}&profissionalId=qualquer`, { headers })
        const horariosAmanha = (Array.isArray(respAmanha) ? respAmanha : (respAmanha?.horarios || [])).filter((h) => h.disponivel)
        const opcoesAmanha = horariosAmanha.slice(0, 4).map((h) => `${h.horario}${h.profissionalNome ? ` (com ${h.profissionalNome})` : ''}`).join(', ')
        const equipeLabel = nomesProfissionaisBanco.length ? `com ${nomesProfissionaisBanco.join(', ')}` : 'na agenda da equipe'
        const sugestao = opcoesAmanha
          ? `Para hoje a agenda já fechou, mas para amanhã tenho às ${opcoesAmanha}. Qual fica melhor pra você?`
          : `Vou verificar um encaixe ${equipeLabel} e já te confirmo!`
        setTexto((prev) => prev ? `${prev} ${sugestao}` : sugestao)
        setAviso('Horários livres de amanhã inseridos na mensagem!')
      }
    } catch (caught) {
      setErro(caught?.message || 'Não foi possível consultar os horários livres agora.')
    } finally {
      if (vivoRef.current) setOcupado('')
    }
  }

  const situacao = !sessao ? '' : encerrada ? 'Encerrada · no histórico'
    : comEquipe ? (sessao.minha ? 'Com você' : sessao.assumida ? 'Com outro atendente' : `Esperando a equipe${sessao.motivo ? ` · ${sessao.motivo}` : ''}`)
      : 'Em conversa com o T-Rex'

  return <div className="wa-conv-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) onClose?.() }}>
    <aside className="wa-conv" role="dialog" aria-modal="true" aria-labelledby="wa-conv-titulo">
      <header className="wa-conv__head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="wa-conv-titulo">{sessao?.nome || sessao?.telefone || 'Conversa'}</h2>
            {sessao && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: comEquipe ? (sessao.minha ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)') : 'rgba(59, 130, 246, 0.15)',
                color: comEquipe ? (sessao.minha ? '#16a34a' : '#ca8a04') : '#2563eb',
                border: `1px solid ${comEquipe ? (sessao.minha ? '#86efac' : '#fde047') : '#93c5fd'}`
              }}>
                {comEquipe ? (sessao.minha ? '👤 Com você' : sessao.assumida ? `👥 Com ${sessao.atendenteNome || 'outro atendente'}` : '⏳ Aguardando equipe') : '🤖 T-Rex atendendo'}
              </span>
            )}
          </div>
          <p className="wa-conv__sub">{sessao?.nome ? `${sessao.telefone} · ` : ''}{situacao}</p>
          <div className="wa-conv__atalhos">
            <a href="/admin/barbearia?tab=agenda" target="_blank" rel="noreferrer" className="wa-conv__atalho-link">📅 Ver Agenda</a>
            <a href="/admin/barbearia?tab=clientes" target="_blank" rel="noreferrer" className="wa-conv__atalho-link">👤 Clientes</a>
            {sessao?.telefone && !sessao.telefone.includes("*") && (
              <a href={`https://wa.me/55${sessao.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="wa-conv__atalho-link">💬 WhatsApp Web</a>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {typeof onNovaConversa === 'function' && (
            <button
              type="button"
              className="c360-btn ghost wa-btn-nova-panel"
              onClick={() => onNovaConversa()}
              title="Iniciar nova conversa no WhatsApp"
            >
              ➕ Nova Conversa
            </button>
          )}
          {canAct && !encerrada && !outroAtendente && (
            !comEquipe ? (
              <button type="button" className="c360-btn primary" onClick={assumir} disabled={Boolean(ocupado)} title="Pausa o T-Rex e coloca o atendimento sob seu controle">
                {ocupado === 'assumir' ? 'Assumindo…' : '✋ Assumir'}
              </button>
            ) : (
              <button type="button" className="c360-btn ghost" onClick={() => setConfirmar('devolver')} disabled={Boolean(ocupado)} title="Devolve o atendimento para o robô T-Rex continuar">
                🤖 Devolver ao T-Rex
              </button>
            )
          )}
          <button type="button" className="c360-btn ghost" onClick={() => onClose?.()} disabled={Boolean(ocupado)} aria-label="Fechar conversa">Fechar</button>
        </div>
      </header>

      {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
      {aviso && <p className="dadm-note" role="status">{aviso}</p>}
      {sessao?.hasPendingAction && !encerrada && (
        <div className="dadm-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderColor: 'rgba(245, 158, 11, 0.5)', background: 'rgba(245, 158, 11, 0.12)' }}>
          <span style={{ fontSize: 12 }}>
            <strong>⏳ Ação pendente aguardando SIM:</strong> {sessao.pendingSummary || 'Confirmação pendente no T-Rex'}
          </span>
          {canAct && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="c360-btn primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={confirmarPendencia} disabled={Boolean(ocupado)}>
                {ocupado === 'confirmarPendencia' ? 'Confirmando…' : '✅ Fechar Agendamento'}
              </button>
              <button type="button" className="c360-btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={limparPendencia} disabled={Boolean(ocupado)}>
                {ocupado === 'limparPendencia' ? 'Limpando…' : '🧹 Destravar pendência'}
              </button>
            </div>
          )}
        </div>
      )}

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
        {podeResponder ? <>
          {!comEquipe && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>💡 <b>T-Rex ativo:</b> Digite sua resposta abaixo. Ao enviar, você assume a conversa e pausa o T-Rex automaticamente.</span>
              <button type="button" className="c360-btn primary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={assumir} disabled={Boolean(ocupado)}>
                {ocupado === 'assumir' ? 'Assumindo…' : '✋ Assumir agora'}
              </button>
            </div>
          )}
          <div className="wa-conv__macros" aria-label="Respostas Rápidas">
            <button type="button" className="wa-conv__macro-btn" style={{ background: 'rgba(20, 184, 122, 0.18)', borderColor: '#14b87a', fontWeight: 700 }} onClick={inserirHorariosLivresHoje} disabled={Boolean(ocupado)} title="Consulta a agenda real dos profissionais ativos no banco e escreve os próximos horários livres">
              {ocupado === 'horarios' ? '⏳ Consultando agenda…' : `⚡ Inserir Horários Livres${nomesProfissionaisBanco.length ? ` (${nomesProfissionaisBanco.join('/')})` : ''}`}
            </button>
            {RESPOSTAS_RAPIDAS.map((m, idx) => (
              <button key={idx} type="button" className="wa-conv__macro-btn" onClick={() => setTexto((prev) => prev ? `${prev} ${m.texto}` : m.texto)} title={m.texto}>
                {m.rotulo}
              </button>
            ))}
          </div>
          <form className="wa-conv__composer" onSubmit={enviar}>
          <textarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={3} maxLength={4000}
            placeholder={!comEquipe ? "Responder ao cliente (ao enviar, você assume e pausa o T-Rex)..." : "Responder ao cliente pelo WhatsApp da loja…"} disabled={Boolean(ocupado)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); enviar() } }} />
          <button type="submit" className="c360-btn primary" disabled={!texto.trim() || Boolean(ocupado)}>
            {ocupado === 'enviar' ? 'Enviando…' : !comEquipe ? 'Enviar (Assumir)' : 'Enviar'}
          </button>
        </form></> : <p className="wa-conv__rodape">
          {!canAct ? 'Seu acesso permite só ver a conversa.' : outroAtendente ? 'Outro atendente está com esta conversa.' : 'Esta conversa está finalizada.'}
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
