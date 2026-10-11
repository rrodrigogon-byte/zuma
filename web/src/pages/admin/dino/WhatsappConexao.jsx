import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { brandFromContext } from '../../../lib/brand'
import { channelStatusPayload, webhookSecretEnvFor } from '../../../lib/whatsapp-webhook-secret'
import { useToast } from '../../../hooks/useToast'
import { Dialog } from '../customer360/shared'
import { dateTime } from './format'
import { linePresentation, statusRefreshInterval } from './whatsapp-view'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/whatsapp-conexao'
const SAIDA = { off: 'Desligado', pilot: 'Piloto (só números autorizados)', on: 'Liberado para todos' }
const STATES = { open: 'Conectado', qr: 'Aguardando leitura do QR', connecting: 'Conectando…', close: 'Desconectado', unknown: 'Sem informação' }
const HISTORY = { conectado: 'Conectou', desconectado: 'Caiu', desconectado_manual: 'Desconectado manualmente', qr_gerado: 'QR gerado', reconexao_solicitada: 'Reconexão solicitada', reconexao_automatica: 'Reconexão automática', instancia_alterada: 'Instância alterada', erro: 'Erro' }
const ERRORS = {
  chave_invalida: 'O backend recusou a chave de API. Confira CHATBOT_BACKEND_KEY no servidor.',
  instance_not_enabled: 'Esta linha ainda não existe no servidor de WhatsApp. Peça para incluir a instância em WHATSAPP_INSTANCE_NAMES do backend (Cloud Run) e publicar; depois toque em Gerar QR.',
  status_unavailable: 'O servidor de WhatsApp não informou o status desta linha agora. Toque em Verificar agora; se continuar, veja o Diagnóstico de ponta a ponta abaixo.',
  provedor_nao_e_nossagente: 'O servidor ainda usa outro provedor. Defina WHATSAPP_PROVIDER=chatbot_backend.',
}

function Check({ ok, children, hint }) {
  return <li className={ok ? 'ok' : 'pend'}><b aria-hidden="true">{ok ? '✓' : '•'}</b><span><strong>{children}</strong>{hint && <span className="dadm-muted"> — {hint}</span>}<span className="sr-only">{ok ? ' (ok)' : ' (pendente)'}</span></span></li>
}

export default function WhatsappConexao() {
  const { empresaAtiva } = useAuth()
  return <WhatsappConexaoEmpresa key={empresaAtiva?.id || 'sem-empresa'} />
}

function WhatsappConexaoEmpresa() {
  const { empresaAtiva, user } = useAuth()
  const { toast } = useToast()
  const tenantId = String(empresaAtiva?.id || '')
  const [conexao, setConexao] = useState(null)
  const [podeGerenciar, setPodeGerenciar] = useState(false)
  const [ia, setIa] = useState(null)
  const [qr, setQr] = useState({ image: '', code: '' })
  const [busy, setBusy] = useState('')
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')
  const [instancia, setInstancia] = useState('')
  const [referencia, setReferencia] = useState('')
  const [teste, setTeste] = useState({ telefone: '', open: false })
  const [confirmarSaida, setConfirmarSaida] = useState(false)
  const [webhookInfo, setWebhookInfo] = useState('')
  const [diag, setDiag] = useState(null)
  const [erroDiag, setErroDiag] = useState('')
  const [diagBloqueado, setDiagBloqueado] = useState(false)
  const telefoneRef = useRef(null)
  const scopeRef = useRef(0)
  const statusSeqRef = useRef(0)
  const statusFlightRef = useRef(null)
  const diagFlightRef = useRef(null)
  const qrFlightRef = useRef(null)
  const referenceDirtyRef = useRef(false)

  const carregar = useCallback(async (foreground = false) => {
    if (statusFlightRef.current || (!foreground && document.visibilityState !== 'visible')) return
    const flight = Symbol('whatsapp-status')
    const scope = scopeRef.current
    const sequence = ++statusSeqRef.current
    statusFlightRef.current = flight
    if (foreground) setAtualizando(true)
    try {
      const data = await api.get(`${BASE}?atualizar=1`)
      if (scope !== scopeRef.current || sequence !== statusSeqRef.current) return
      setConexao(data.conexao)
      setPodeGerenciar(Boolean(data.podeGerenciar))
      setErro('')
      setInstancia((value) => value || data.conexao.instance || '')
      if (!referenceDirtyRef.current) setReferencia(data.conexao.phoneReference || '')
      if (data.conexao.state === 'open') setQr({ image: '', code: '' })
    } catch (error) {
      if (scope !== scopeRef.current || sequence !== statusSeqRef.current) return
      // Não manter um telefone anteriormente verificado após falha de consulta.
      setConexao((current) => current ? { ...current, state: 'unknown', phoneNumber: '', phoneMasked: '', lastCheckAt: null } : null)
      setErro(error.message || 'Não foi possível consultar a conexão.')
    } finally {
      if (statusFlightRef.current === flight) statusFlightRef.current = null
      if (scope === scopeRef.current && sequence === statusSeqRef.current) setAtualizando(false)
    }
  }, [tenantId])

  const recarregarIa = useCallback(async () => {
    const scope = scopeRef.current
    try {
      const data = await api.get('/api/admin/commerce/whatsapp-ai/status')
      if (scope === scopeRef.current) setIa(data)
    } catch {
      if (scope === scopeRef.current) setIa(null)
    }
  }, [tenantId])

  const diagnosticar = useCallback(async () => {
    if (diagFlightRef.current) return
    const flight = Symbol('whatsapp-diagnostic')
    const scope = scopeRef.current
    diagFlightRef.current = flight
    setBusy((value) => value || 'diag')
    try {
      const data = await api.get(`${BASE}/diagnostico`)
      if (scope !== scopeRef.current) return
      setDiag(data)
      setErroDiag('')
      setDiagBloqueado(false)
    } catch (error) {
      if (scope !== scopeRef.current) return
      setDiag(null)
      setErroDiag(error?.status === 403 ? (error?.data?.motivo === 'WHATSAPP_INSTANCE_UNASSIGNED' || /instância de WhatsApp atribuída/.test(String(error?.message || '')) ? 'Esta empresa ainda não tem uma linha de WhatsApp atribuída. Peça à administração da plataforma.' : 'Diagnóstico disponível somente para a empresa dona desta linha.') : (error.message || 'Diagnóstico indisponível agora.'))
      if (error?.status === 403) setDiagBloqueado(true)
    } finally {
      if (diagFlightRef.current === flight) diagFlightRef.current = null
      if (scope === scopeRef.current) setBusy((value) => value === 'diag' ? '' : value)
    }
  }, [tenantId])

  useEffect(() => {
    scopeRef.current += 1
    statusSeqRef.current += 1
    statusFlightRef.current = null
    diagFlightRef.current = null
    qrFlightRef.current = null
    referenceDirtyRef.current = false
    setConexao(null); setPodeGerenciar(false); setIa(null); setDiag(null)
    setErro(''); setErroDiag(''); setDiagBloqueado(false); setBusy('')
    setQr({ image: '', code: '' }); setInstancia(''); setReferencia(''); setWebhookInfo('')
    carregar(true)
    recarregarIa()
    return () => { scopeRef.current += 1; statusSeqRef.current += 1; statusFlightRef.current = null; diagFlightRef.current = null; qrFlightRef.current = null }
  }, [carregar, recarregarIa])

  useEffect(() => {
    const timer = setInterval(() => carregar(), statusRefreshInterval(conexao?.state))
    const onVisible = () => { if (document.visibilityState === 'visible') { carregar(); recarregarIa() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [carregar, recarregarIa, conexao?.state])

  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') recarregarIa() }, 60_000)
    return () => clearInterval(timer)
  }, [recarregarIa])

  useEffect(() => {
    if (!podeGerenciar || diagBloqueado) return undefined
    diagnosticar()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') diagnosticar() }, 120_000)
    return () => clearInterval(timer)
  }, [podeGerenciar, diagBloqueado, diagnosticar])

  useEffect(() => {
    if (!podeGerenciar || !['qr', 'connecting'].includes(conexao?.state) || !(qr.image || qr.code)) return undefined
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && !busy) gerarQr(true) }, 40_000)
    return () => clearInterval(timer)
  }, [conexao?.state, qr.image, qr.code, podeGerenciar, busy]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gerarQr(auto = false) {
    if (qrFlightRef.current) return
    const flight = Symbol('whatsapp-qr')
    qrFlightRef.current = flight
    const scope = scopeRef.current
    if (!auto) setBusy('qr')
    try {
      const data = await api.post(`${BASE}/qr`, { auto })
      if (scope !== scopeRef.current) return
      statusSeqRef.current += 1
      statusFlightRef.current = null
      setConexao(data.conexao)
      if (data.qr || data.pairingCode) setQr({ image: data.qr || '', code: data.pairingCode || '' })
      else if (!auto && data.conexao.state === 'open') toast('Sessão reaberta. Confira no aparelho qual número foi pareado.')
    } catch (error) { if (!auto && scope === scopeRef.current) toast(error.message, true) }
    finally {
      if (qrFlightRef.current === flight) qrFlightRef.current = null
      if (!auto && scope === scopeRef.current) setBusy('')
    }
  }

  async function salvarConfig(patch) {
    const scope = scopeRef.current
    setBusy('config')
    try {
      const data = await api.put(`${BASE}/config`, patch)
      if (scope !== scopeRef.current) return
      statusSeqRef.current += 1
      statusFlightRef.current = null
      setConexao(data.conexao)
      if ('numeroExibicao' in patch) { referenceDirtyRef.current = false; setReferencia(data.conexao.phoneReference || '') }
      toast('Configuração salva.')
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function verificar() {
    const scope = scopeRef.current
    setBusy('verificar')
    try {
      const data = await api.post(`${BASE}/verificar`, {})
      if (scope !== scopeRef.current) return
      statusSeqRef.current += 1
      statusFlightRef.current = null
      setConexao(data.conexao)
      toast(data.resultado?.action === 'reconnect' ? 'Reconexão solicitada ao backend.' : 'Conexão verificada.')
      recarregarIa(); diagnosticar()
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function desconectar() {
    const scope = scopeRef.current
    setBusy('sair')
    try {
      const data = await api.post(`${BASE}/desconectar`, { confirmado: true })
      if (scope !== scopeRef.current) return
      statusSeqRef.current += 1
      statusFlightRef.current = null
      setConexao(data.conexao)
      setReferencia(''); setQr({ image: '', code: '' }); setConfirmarSaida(false)
      toast('WhatsApp desconectado. A reconexão automática fica pausada.')
      recarregarIa(); diagnosticar()
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function prepararAtendente() {
    const scope = scopeRef.current
    setBusy('canal')
    try {
      await api.post('/api/admin/commerce/whatsapp-ai/channel', {
        instance: conexao.instance, displayName: `Atendimento ${empresaAtiva?.nome || 'da empresa'}`.slice(0, 120), status: 'rascunho',
        webhookSecretEnv: webhookSecretEnvFor(empresaAtiva), webhookHeader: 'x-setpoint-webhook-token',
        capabilities: { humanized: true, captureLeads: true, operateStore: true, manageAppointments: true, sendPromotions: false, reminders: true, humanHandoff: true },
      })
      if (scope === scopeRef.current) { toast('Canal criado em rascunho.'); await recarregarIa() }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  // Liga ou pausa o atendente direto nesta tela, mantendo capacidades e instância salvas.
  async function alterarAtendente(status) {
    if (!ia?.channel) return
    if (status === 'ativo' && !window.confirm('Ativar o atendente IA neste WhatsApp? As mensagens recebidas passam a ser respondidas pela IA, com as capacidades salvas no canal.')) return
    const scope = scopeRef.current
    setBusy('canal')
    try {
      await api.post('/api/admin/commerce/whatsapp-ai/channel', channelStatusPayload(ia.channel, { status, instance: conexao?.instance, empresa: empresaAtiva }))
      if (scope === scopeRef.current) { toast(status === 'ativo' ? 'Atendente ativado.' : 'Atendente pausado.'); await recarregarIa() }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function sincronizarWebhook() {
    const scope = scopeRef.current
    setBusy('webhook')
    try {
      const data = await api.post('/api/admin/commerce/whatsapp-ai/channel/sync-webhook', { confirmed: true })
      if (scope === scopeRef.current) {
        setWebhookInfo(data.manual ? data.instructions : '')
        toast(data.manual ? 'O backend não registra webhook sozinho: veja as instruções.' : 'Webhook registrado no backend.')
        await recarregarIa()
      }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function enviarTeste() {
    const scope = scopeRef.current
    setBusy('teste')
    try {
      await api.post(`${BASE}/teste`, { confirmado: true, telefone: teste.telefone })
      if (scope === scopeRef.current) { toast('Teste aceito pelo backend; confira a entrega no aparelho.'); setTeste({ telefone: '', open: false }) }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function copiarNumero(value) {
    try { await navigator.clipboard.writeText(value); toast('Número copiado.') }
    catch { toast('Não foi possível copiar o número.', true) }
  }

  const state = conexao?.lastError ? 'unknown' : (conexao?.state || 'unknown')
  const line = linePresentation(conexao ? { ...conexao, state } : null)
  const webhookUrl = ia?.channel?.publicCode ? `${window.location.origin}/api/webhooks/whatsapp/${ia.channel.publicCode}` : ''
  const erroConexao = conexao?.lastError ? (ERRORS[conexao.lastError] || `Última falha: ${conexao.lastError}`) : ''
  const pending = diag?.conclusoes?.filter((item) => !item.ok).length
  const saida = conexao?.saida
  const saidaBloqueada = saida?.modo === 'off'
  const messages = diag?.mensagens24h

  return <div className="dadm-page dadm-wa-page">
    <header className="dadm-head dadm-wa-head">
      <div><div className="dadm-eyebrow">Relacionamento & IA · {empresaAtiva?.nome || 'Empresa'}</div><h1>WhatsApp da empresa</h1><p>Acompanhe a linha em uso, a conexão do atendente e a atividade com atualização automática — sem expor a chave de API.</p></div>
      <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={atualizando} onClick={() => { carregar(true); recarregarIa(); if (podeGerenciar && !diagBloqueado) diagnosticar() }}>{atualizando ? 'Atualizando…' : 'Atualizar agora'}</button></div>
    </header>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {!conexao && !erro && <section className="dadm-card" role="status">Consultando o estado do WhatsApp…</section>}

    {conexao && <>
      <section className="dadm-wa-hero" aria-label="Linha e status do WhatsApp">
        <div className="dadm-wa-identity">
          <span className="dadm-wa-overline">Linha do WhatsApp · {conexao.instance || 'instância não atribuída'}</span>
          <strong className="dadm-wa-number">{line.value}</strong>
          <span className={`dadm-wa-source ${line.verified ? 'verified' : ''}`}>{line.verified ? '✓ ' : '• '}{line.source}</span>
          {line.copy && <button type="button" className="dadm-wa-copy" onClick={() => copiarNumero(line.copy)} aria-label="Copiar número completo do WhatsApp">Copiar número</button>}
          {podeGerenciar && !conexao.phoneNumber && <a className="dadm-wa-copy dadm-wa-reference-link" href="#wa-reference">{conexao.phoneReference ? 'Editar referência não verificada' : 'Informar número de referência'}</a>}
        </div>
        <div className="dadm-wa-live">
          <span className={`dadm-state ${state}`} role="status">{STATES[state] || state}</span>
          <small>Última consulta: {dateTime(conexao.lastCheckAt)}</small>
          <small>Atualização automática {state === 'qr' || state === 'connecting' ? 'a cada 5 s' : 'a cada 30 s'} · pausa com a aba oculta</small>
        </div>
      </section>

      <div className="dadm-wa-summary" aria-label="Resumo da operação">
        <article><span>Atendente IA</span><strong>{ia?.channel?.status === 'ativo' ? 'Ativo' : ia?.channel ? 'Em preparação' : 'Não configurado'}</strong><small>{ia?.channel?.lastEventAt ? `Último evento: ${dateTime(ia.channel.lastEventAt)}` : 'Sem evento recente informado'}</small></article>
        <article><span>Contatos distintos · 24 h</span><strong>{messages ? Number(messages.contatos || 0).toLocaleString('pt-BR') : '—'}</strong><small>{messages ? 'Entre até 200 mensagens consultadas' : 'Disponível para a empresa dona'}</small></article>
        <article><span>Mensagens consultadas · 24 h</span><strong>{messages ? Number(messages.total || 0).toLocaleString('pt-BR') : '—'}</strong><small>{messages ? `Amostra de até 200 · última ${dateTime(messages.ultimaEm)}` : 'Sem leitura disponível'}</small></article>
        <article><span>Saúde do canal</span><strong>{pending == null ? 'Aguardando' : pending === 0 ? 'Tudo certo' : `${pending} pendência${pending === 1 ? '' : 's'}`}</strong><small>{diag ? `Conferido em ${dateTime(diag.agora)}` : 'Confira a integração abaixo'}</small></article>
      </div>

      <div className="dadm-wa">
        <div className="dadm-wa-column">
          <section className="dadm-card" aria-labelledby="wa-conn">
            <div className="c360-card-head"><h2 id="wa-conn">Conexão e identificação</h2><span className={`dadm-state ${state}`}>{STATES[state] || state}</span></div>
            {!conexao.providerConfigured && <p className="dadm-note warn">{conexao.provider !== 'chatbot_backend' ? ERRORS.provedor_nao_e_nossagente : 'Falta a chave CHATBOT_BACKEND_KEY no servidor.'}</p>}
            {erroConexao && conexao.providerConfigured && <p className="dadm-note danger">{erroConexao}</p>}
            {state === 'open' && !conexao.phoneMasked && <p className="dadm-note warn" role="status">Sessão aberta, mas o backend não informou o número. Confirme a conta pareada em Aparelhos conectados no WhatsApp antes de usar este canal; uma referência manual não comprova titularidade.</p>}
            {saidaBloqueada && <p className="dadm-note warn" role="status">O envio de mensagens está desligado no servidor (WHATSAPP_EGRESS_MODE=off). Nada sai por este número: nem teste, nem IA, nem campanhas. Para testar, o responsável pelo servidor define WHATSAPP_EGRESS_MODE=pilot e inclui o número de teste em WHATSAPP_POLL_PILOT_PHONES.</p>}
            {saida?.modo === 'pilot' && !saida.pilotoConfigurado && <p className="dadm-note warn" role="status">Envio em modo piloto, mas sem nenhum número autorizado em WHATSAPP_POLL_PILOT_PHONES.</p>}
            <dl className="dadm-result">
              <div><dt>Identificação da linha</dt><dd>{line.verified ? line.value : 'Não confirmada'}</dd></div>
              <div><dt>Instância no backend</dt><dd>{conexao.instance || 'Não atribuída'}</dd></div>
              {saida && <div><dt>Envio de mensagens</dt><dd>{SAIDA[saida.modo] || saida.modo}</dd></div>}
              <div><dt>Backend</dt><dd>{conexao.providerLabel}</dd></div>
              <div><dt>Conectado desde</dt><dd>{state === 'open' ? dateTime(conexao.lastConnectedAt) : '—'}</dd></div>
              <div><dt>Última verificação</dt><dd>{dateTime(conexao.lastCheckAt)}</dd></div>
              {conexao.reconnectAttempts > 0 && <div><dt>Tentativas de reconexão</dt><dd>{conexao.reconnectAttempts} · próxima {dateTime(conexao.nextReconnectAt)}</dd></div>}
            </dl>
            {podeGerenciar && !conexao.phoneNumber && <form className="dadm-wa-reference" onSubmit={(event) => { event.preventDefault(); salvarConfig({ numeroExibicao: referencia }) }}>
              <label className="c360-field" htmlFor="wa-reference">Número de referência (opcional; não verificado)</label>
              <div className="dadm-filters"><input id="wa-reference" className="c360-input" type="tel" inputMode="tel" autoComplete="off" maxLength={25} value={referencia} onChange={(event) => { referenceDirtyRef.current = true; setReferencia(event.target.value) }} placeholder="(65) 99999-0000" /><button type="submit" className="c360-btn ghost" disabled={Boolean(busy) || referencia.replace(/\D/g, '') === (conexao.phoneReference || '')}>Salvar referência</button></div>
              <small className="dadm-muted">Aparece no topo como referência não verificada. Não substitui a confirmação da linha no backend nem libera envio.</small>
            </form>}
            {state !== 'open' && (qr.image || qr.code) && <div className="dadm-qr" aria-live="polite">
              {qr.image && <img src={qr.image} alt="QR code para conectar o WhatsApp" />}
              {qr.code && <><span>Ou use o código de pareamento</span><code>{qr.code}</code></>}
              <small>O QR é renovado a cada 40 s enquanto esta aba estiver visível.</small>
            </div>}
            {state !== 'open' && <ol className="dadm-steps"><li>No celular da empresa, abra o WhatsApp.</li><li>Toque em <strong>Configurações › Aparelhos conectados › Conectar um aparelho</strong>.</li><li>Gere o QR aqui e aponte a câmera. A tela atualiza quando conectar.</li></ol>}
            {podeGerenciar ? <div className="dadm-actions">
              {state !== 'open' && <button type="button" className="c360-btn primary" disabled={Boolean(busy) || !conexao.providerConfigured || !conexao.instance} onClick={() => gerarQr()}>{busy === 'qr' ? 'Gerando…' : qr.image ? 'Gerar novo QR' : 'Gerar QR'}</button>}
              <button type="button" className="c360-btn ghost" disabled={Boolean(busy) || !conexao.providerConfigured} onClick={verificar}>{busy === 'verificar' ? 'Verificando…' : 'Verificar agora'}</button>
              {state === 'open' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy) || saidaBloqueada} title={saidaBloqueada ? 'Envio desligado no servidor (WHATSAPP_EGRESS_MODE=off)' : undefined} onClick={() => setTeste({ telefone: '', open: true })}>Enviar teste</button>}
              {conexao.ativo && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={() => setConfirmarSaida(true)}>Desconectar</button>}
            </div> : <p className="dadm-muted">Só administradores e gestores alteram a conexão.</p>}
          </section>

          {podeGerenciar && <section className="dadm-card" aria-labelledby="wa-diag">
            <div className="c360-card-head"><h2 id="wa-diag">Diagnóstico de ponta a ponta</h2><button type="button" className="c360-btn ghost" disabled={busy === 'diag'} onClick={diagnosticar}>{busy === 'diag' ? 'Conferindo…' : 'Conferir de novo'}</button></div>
            <p>Mostra as travas, contagens e horários da instância da empresa. Nenhum conteúdo de conversa é exibido.</p>
            {erroDiag && <p className="dadm-note warn" role="status">{erroDiag}</p>}
            {diag && <ul className="dadm-check">{(diag.conclusoes || []).map((item) => <Check key={item.titulo} ok={item.ok} hint={item.detalhe}>{item.titulo}</Check>)}</ul>}
          </section>}
        </div>

        <div className="dadm-wa-column">
          <section className="dadm-card" aria-labelledby="wa-ia">
            <h2 id="wa-ia">Atendente IA no WhatsApp</h2>
            {ia ? <ul className="dadm-check">
              <Check ok={conexao.providerConfigured}>Backend configurado</Check>
              <Check ok={state === 'open' && Boolean(conexao.phoneMasked)} hint={state === 'open' && !conexao.phoneMasked ? 'sessão aberta, número não informado' : undefined}>Número identificado pelo backend</Check>
              <Check ok={Boolean(ia.gemini?.configured)} hint={ia.gemini?.model}>Gemini configurado</Check>
              <Check ok={Boolean(ia.featureEnabled)} hint="FEATURE_WHATSAPP_AI=true">IA liberada no servidor</Check>
              <Check ok={ia.channel?.status === 'ativo'}>Canal do atendente ativo</Check>
              {saida && <Check ok={saida.modo !== 'off'} hint={saida.modo === 'off' ? 'WHATSAPP_EGRESS_MODE=off' : SAIDA[saida.modo]}>Envio de mensagens liberado</Check>}
              <Check ok={Boolean(ia.channel?.lastEventAt)} hint={ia.channel?.lastEventAt ? `último em ${dateTime(ia.channel.lastEventAt)}` : 'nenhuma mensagem recebida ainda'}>Mensagens chegando</Check>
            </ul> : <p className="c360-empty">Status do atendente indisponível para o seu perfil.</p>}
            {webhookUrl && <p className="dadm-note dadm-wa-webhook">Webhook de entrada: <strong>{webhookUrl}</strong> · cabeçalho <code>{ia.channel?.webhookHeader || 'x-setpoint-webhook-token'}</code></p>}
            {podeGerenciar && ia && !ia.channel && <button type="button" className="c360-btn primary" disabled={Boolean(busy)} onClick={prepararAtendente}>Preparar atendente (rascunho)</button>}
            {podeGerenciar && ia?.channel && ia.channel.status !== 'ativo' && <button type="button" className="c360-btn primary" disabled={Boolean(busy)} onClick={() => alterarAtendente('ativo')}>Ativar atendente</button>}
            {podeGerenciar && ia?.channel?.status === 'ativo' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={() => alterarAtendente('rascunho')}>Pausar atendente</button>}
            {podeGerenciar && ia?.channel?.status === 'ativo' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={sincronizarWebhook}>Sincronizar webhook</button>}
            {webhookInfo && <p className="dadm-note warn dadm-wa-webhook">{webhookInfo}</p>}
            <Link to={brandFromContext(empresaAtiva) === 'stallone' ? '/admin/cerebro-ia' : '/admin/barbearia-erp?area=integracoes&tab=Integra%C3%A7%C3%B5es'}>{brandFromContext(empresaAtiva) === 'stallone' ? 'Ver o cérebro do atendente →' : 'Revisar capacidades e ativar o atendente →'}</Link>
          </section>

          <section className="dadm-card" aria-labelledby="wa-auto">
            <h2 id="wa-auto">Reconexão automática</h2>
            <label className="dadm-toggle"><input type="checkbox" checked={conexao.autoReconnect} disabled={!podeGerenciar || Boolean(busy)} onChange={(event) => salvarConfig({ autoReconnect: event.target.checked })} />Reconectar sozinho quando a conexão cair</label>
            <p>O servidor verifica a conexão a cada minuto. Quando ela cair, tenta reconectar com espera crescente de 1 a 30 minutos; se necessário, um novo QR aparece nesta tela.</p>
            {podeGerenciar && user?.platformAdmin === true && <form className="dadm-filters" onSubmit={(event) => { event.preventDefault(); salvarConfig({ instance: instancia }) }}><label className="c360-field" style={{ flex: 1 }}>Instância no backend<input className="c360-input" value={instancia} onChange={(event) => setInstancia(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9_-]{1,63}" /></label><button type="submit" className="c360-btn ghost" disabled={Boolean(busy) || instancia === conexao.instance}>Salvar</button></form>}
          </section>

          <section className="dadm-card" aria-labelledby="wa-hist"><h2 id="wa-hist">Histórico da conexão</h2>{conexao.history?.length ? <ul className="dadm-history">{conexao.history.slice(0, 8).map((item) => <li key={`${item.at}-${item.tipo}-${item.instance || ''}`}><span>{HISTORY[item.tipo] || item.tipo}{item.instance && item.instance !== conexao.instance ? ` · instância ${item.instance}` : ''}{item.detalhe ? ` · ${item.detalhe}` : ''}</span><span>{dateTime(item.at)}</span></li>)}</ul> : <p className="c360-empty">Nada registrado ainda.</p>}</section>
        </div>
      </div>
    </>}

    <Dialog open={teste.open} title="Enviar mensagem de teste" labelId="wa-teste" onClose={() => setTeste({ telefone: '', open: false })} onSubmit={enviarTeste} initialFocusRef={telefoneRef}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setTeste({ telefone: '', open: false })}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'teste'}>Enviar</button></>}>
      <label className="c360-field">Telefone com DDD<input ref={telefoneRef} className="c360-input" inputMode="tel" required value={teste.telefone} onChange={(event) => setTeste({ ...teste, telefone: event.target.value })} placeholder="(65) 99999-0000" /></label>
      <p className="dadm-muted">O backend aceita o envio, mas a entrega no aparelho deve ser conferida. Limite de 5 testes por hora.</p>
    </Dialog>
    <Dialog open={confirmarSaida} title="Desconectar o WhatsApp?" labelId="wa-sair" danger onClose={() => setConfirmarSaida(false)}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setConfirmarSaida(false)}>Voltar</button><button type="button" className="c360-btn primary" disabled={busy === 'sair'} onClick={desconectar}>Desconectar</button></>}>
      <p>O atendente IA, lembretes de agenda, campanhas e recuperação de carrinho param de enviar mensagens até você conectar de novo. A reconexão automática fica pausada.</p>
    </Dialog>
  </div>
}
