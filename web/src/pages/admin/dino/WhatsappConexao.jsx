import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../hooks/useToast'
import { Dialog } from '../customer360/shared'
import { dateTime } from './format'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/whatsapp-conexao'
const STATES = { open: 'Conectado', qr: 'Aguardando leitura do QR', connecting: 'Conectando…', close: 'Desconectado', unknown: 'Sem informação' }
const HISTORY = { conectado: 'Conectou', desconectado: 'Caiu', desconectado_manual: 'Desconectado manualmente', qr_gerado: 'QR gerado', reconexao_solicitada: 'Reconexão solicitada', reconexao_automatica: 'Reconexão automática', instancia_alterada: 'Instância alterada', erro: 'Erro' }
const ERRORS = {
  chave_invalida: 'O backend recusou a chave de API. Confira CHATBOT_BACKEND_KEY no servidor.',
  instance_not_enabled: 'A instância não está liberada no backend. Peça para incluí-la em WHATSAPP_INSTANCE_NAMES do backend do NossaGente.',
  provedor_nao_e_nossagente: 'O servidor ainda usa outro provedor. Defina WHATSAPP_PROVIDER=chatbot_backend.',
}

function Check({ ok, children, hint }) {
  return <li className={ok ? 'ok' : 'pend'}><b aria-hidden="true">{ok ? '✓' : '•'}</b><span><strong>{children}</strong>{hint && <span className="dadm-muted"> — {hint}</span>}<span className="sr-only">{ok ? ' (ok)' : ' (pendente)'}</span></span></li>
}

export default function WhatsappConexao() {
  const { empresaAtiva, user } = useAuth()
  const { toast } = useToast()
  const [conexao, setConexao] = useState(null)
  const [podeGerenciar, setPodeGerenciar] = useState(false)
  const [ia, setIa] = useState(null)
  const [qr, setQr] = useState({ image: '', code: '', at: 0 })
  const [busy, setBusy] = useState('')
  const [erro, setErro] = useState('')
  const [instancia, setInstancia] = useState('')
  const [teste, setTeste] = useState({ telefone: '', open: false })
  const [confirmarSaida, setConfirmarSaida] = useState(false)
  const [webhookInfo, setWebhookInfo] = useState('')
  const [diag, setDiag] = useState(null)
  const telefoneRef = useRef(null)

  const carregar = useCallback(async (atualizar = true) => {
    try {
      const data = await api.get(`${BASE}${atualizar ? '?atualizar=1' : ''}`)
      setConexao(data.conexao); setPodeGerenciar(Boolean(data.podeGerenciar)); setErro('')
      setInstancia((atual) => atual || data.conexao.instance)
      if (data.conexao.state === 'open') setQr({ image: '', code: '', at: 0 })
    } catch (error) { setErro(error.message || 'Não foi possível consultar a conexão.') }
  }, [])

  useEffect(() => {
    carregar(true)
    api.get('/api/admin/commerce/whatsapp-ai/status').then(setIa).catch(() => setIa(null))
  }, [carregar, empresaAtiva?.id])

  // Enquanto espera a leitura do QR, confere o estado a cada 5 s e renova o QR a cada 40 s.
  useEffect(() => {
    if (!conexao || !['qr', 'connecting'].includes(conexao.state)) return undefined
    const status = setInterval(() => { if (document.visibilityState === 'visible') carregar(true) }, 5000)
    const renew = setInterval(() => { if (document.visibilityState === 'visible' && qr.image) gerarQr(true) }, 40000)
    return () => { clearInterval(status); clearInterval(renew) }
  }, [conexao?.state, qr.image]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gerarQr(auto = false) {
    if (!auto) setBusy('qr')
    try {
      const data = await api.post(`${BASE}/qr`, { auto })
      setConexao(data.conexao)
      if (data.qr || data.pairingCode) setQr({ image: data.qr || '', code: data.pairingCode || '', at: Date.now() })
      else if (!auto && data.conexao.state === 'open') toast('Sessão reaberta. Confira no aparelho qual número foi pareado.')
    } catch (error) { if (!auto) toast(error.message, true) }
    finally { if (!auto) setBusy('') }
  }

  async function salvarConfig(patch) {
    setBusy('config')
    try { const data = await api.put(`${BASE}/config`, patch); setConexao(data.conexao); toast('Configuração salva.') }
    catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  async function verificar() {
    setBusy('verificar')
    try { const data = await api.post(`${BASE}/verificar`, {}); setConexao(data.conexao); toast(data.resultado?.action === 'reconnect' ? 'Reconexão solicitada ao backend.' : 'Conexão verificada.') }
    catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  async function desconectar() {
    setBusy('sair')
    try { const data = await api.post(`${BASE}/desconectar`, { confirmado: true }); setConexao(data.conexao); setConfirmarSaida(false); toast('WhatsApp desconectado. A reconexão automática fica pausada.') }
    catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  async function recarregarIa() { try { setIa(await api.get('/api/admin/commerce/whatsapp-ai/status')) } catch { setIa(null) } }

  // Cria o canal do atendente em rascunho usando a instância conectada aqui.
  // Ativar continua sendo uma decisão separada, com confirmação, na Central Dino.
  async function prepararAtendente() {
    setBusy('canal')
    try {
      await api.post('/api/admin/commerce/whatsapp-ai/channel', {
        instance: conexao.instance, displayName: `Atendimento ${empresaAtiva?.nome || 'da empresa'}`.slice(0, 120), status: 'rascunho',
        webhookSecretEnv: 'WHATSAPP_AI_WEBHOOK_SECRET', webhookHeader: 'x-setpoint-webhook-token',
        capabilities: { humanized: true, captureLeads: true, operateStore: true, manageAppointments: true, sendPromotions: false, reminders: true, humanHandoff: true },
      })
      toast('Canal do atendente criado em rascunho.'); await recarregarIa()
    } catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  async function sincronizarWebhook() {
    setBusy('webhook')
    try {
      const data = await api.post('/api/admin/commerce/whatsapp-ai/channel/sync-webhook', { confirmed: true })
      setWebhookInfo(data.manual ? data.instructions : '')
      toast(data.manual ? 'O backend não registra webhook sozinho: veja as instruções.' : 'Webhook registrado no backend.')
      await recarregarIa()
    } catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  async function diagnosticar() {
    setBusy('diag'); setErro('')
    try { setDiag(await api.get(`${BASE}/diagnostico`)) }
    catch (error) { setErro(error?.message || 'Não foi possível diagnosticar agora.') }
    finally { setBusy('') }
  }

  async function enviarTeste() {
    setBusy('teste')
    try { await api.post(`${BASE}/teste`, { confirmado: true, telefone: teste.telefone }); toast('Mensagem de teste enviada.'); setTeste({ telefone: '', open: false }) }
    catch (error) { toast(error.message, true) }
    finally { setBusy('') }
  }

  const state = conexao?.state || 'unknown'
  const webhookUrl = ia?.channel?.publicCode ? `${window.location.origin}/api/webhooks/whatsapp/${ia.channel.publicCode}` : ''
  const erroConexao = conexao?.lastError ? (ERRORS[conexao.lastError] || `Última falha: ${conexao.lastError}`) : ''

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Relacionamento & IA · {empresaAtiva?.nome || 'Empresa'}</div><h1>WhatsApp da empresa</h1><p>Conecte o número pelo mesmo backend de WhatsApp do NossaGente: leia o QR uma vez, e o sistema mantém a sessão e reconecta sozinho quando cair. A chave de API fica só no servidor.</p></div>
      <div className="dadm-actions"><button type="button" className="c360-btn ghost" onClick={() => carregar(true)}>Atualizar</button></div>
    </header>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}

    {conexao && <div className="dadm-wa">
      <section className="dadm-card" aria-labelledby="wa-conn">
        <div className="c360-card-head"><h2 id="wa-conn">Conexão</h2><span className={`dadm-state ${state}`} role="status">{STATES[state] || state}</span></div>
        {!conexao.providerConfigured && <p className="dadm-note warn">{conexao.provider !== 'chatbot_backend' ? ERRORS.provedor_nao_e_nossagente : 'Falta a chave CHATBOT_BACKEND_KEY no servidor.'}</p>}
        {erroConexao && conexao.providerConfigured && <p className="dadm-note danger">{erroConexao}</p>}
        {state === 'open' && !conexao.phoneMasked && <p className="dadm-note warn" role="status">A sessão está conectada, mas o backend não informa o número. Confirme a conta pareada no WhatsApp do aparelho antes de usar este canal.</p>}
        <dl className="dadm-result">
          <div><dt>Número confirmado pelo backend</dt><dd>{state === 'open' ? (conexao.phoneMasked || 'Não informado') : '—'}</dd></div>
          <div><dt>Instância no backend</dt><dd>{conexao.instance}</dd></div>
          <div><dt>Backend</dt><dd style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{conexao.providerLabel}</dd></div>
          <div><dt>Conectado desde</dt><dd>{conexao.state === 'open' ? dateTime(conexao.lastConnectedAt) : '—'}</dd></div>
          <div><dt>Última verificação</dt><dd>{dateTime(conexao.lastCheckAt)}</dd></div>
          {conexao.reconnectAttempts > 0 && <div><dt>Tentativas de reconexão</dt><dd>{conexao.reconnectAttempts} · próxima {dateTime(conexao.nextReconnectAt)}</dd></div>}
        </dl>

        {state !== 'open' && (qr.image || qr.code) && <div className="dadm-qr" aria-live="polite">
          {qr.image && <img src={qr.image} alt="QR code para conectar o WhatsApp" />}
          {qr.code && <><span style={{ color: '#333', fontSize: 13 }}>ou use o código de pareamento</span><code>{qr.code}</code></>}
          <span style={{ color: '#555', fontSize: 12 }}>Renova sozinho a cada 40 s enquanto esta tela estiver aberta.</span>
        </div>}

        {state !== 'open' && <ol className="dadm-steps">
          <li>No celular do número da empresa, abra o WhatsApp.</li>
          <li>Toque em <strong>Configurações › Aparelhos conectados › Conectar um aparelho</strong>.</li>
          <li>Clique em <strong>Gerar QR</strong> aqui e aponte a câmera. A tela confirma sozinha quando conectar.</li>
        </ol>}

        {podeGerenciar ? <div className="dadm-actions">
          {state !== 'open' && <button type="button" className="c360-btn primary" disabled={busy === 'qr' || !conexao.providerConfigured} onClick={() => gerarQr(false)}>{busy === 'qr' ? 'Gerando…' : (qr.image ? 'Gerar novo QR' : 'Gerar QR')}</button>}
          <button type="button" className="c360-btn ghost" disabled={busy === 'verificar' || !conexao.providerConfigured} onClick={verificar}>Verificar agora</button>
          {state === 'open' && <button type="button" className="c360-btn ghost" onClick={() => { setTeste({ telefone: '', open: true }) }}>Enviar teste</button>}
          {conexao.ativo && <button type="button" className="c360-btn ghost" onClick={() => setConfirmarSaida(true)}>Desconectar</button>}
        </div> : <p className="dadm-muted">Só administradores e gestores alteram a conexão.</p>}
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        <section className="dadm-card" aria-labelledby="wa-auto">
          <h2 id="wa-auto">Reconexão automática</h2>
          <label className="dadm-toggle">
            <input type="checkbox" checked={conexao.autoReconnect} disabled={!podeGerenciar || busy === 'config'} onChange={(event) => salvarConfig({ autoReconnect: event.target.checked })} />
            Reconectar sozinho quando a conexão cair
          </label>
          <p>O servidor confere a conexão a cada minuto. Se cair, pede nova conexão ao backend com espera crescente (1, 2, 5, 10, 15 e 30 min). Quando o WhatsApp exigir, um novo QR aparece nesta tela.</p>
          {podeGerenciar && user?.platformAdmin === true && <form className="dadm-filters" onSubmit={(event) => { event.preventDefault(); salvarConfig({ instance: instancia }) }}>
            <label className="c360-field" style={{ flex: 1 }}>Instância no backend<input className="c360-input" value={instancia} onChange={(event) => setInstancia(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9_-]{1,63}" /></label>
            <button type="submit" className="c360-btn ghost" disabled={busy === 'config' || instancia === conexao.instance}>Salvar</button>
          </form>}
        </section>

        <section className="dadm-card" aria-labelledby="wa-ia">
          <h2 id="wa-ia">Atendente IA no WhatsApp</h2>
          {ia ? <ul className="dadm-check">
            <Check ok={conexao.providerConfigured}>Backend do WhatsApp configurado</Check>
            <Check ok={state === 'open' && Boolean(conexao.phoneMasked)} hint={state === 'open' && !conexao.phoneMasked ? 'sessão ativa, número não confirmado' : undefined}>Número verificado</Check>
            <Check ok={Boolean(ia.gemini?.configured)} hint={ia.gemini?.model}>Gemini configurado</Check>
            <Check ok={Boolean(ia.featureEnabled)} hint="FEATURE_WHATSAPP_AI=true">IA liberada no servidor</Check>
            <Check ok={ia.channel?.status === 'ativo'}>Canal do atendente ativo</Check>
            <Check ok={Boolean(ia.channel?.lastEventAt)} hint={ia.channel?.lastEventAt ? `último em ${dateTime(ia.channel.lastEventAt)}` : 'nenhuma mensagem recebida ainda'}>Mensagens chegando</Check>
          </ul> : <p className="c360-empty">Status do atendente indisponível para o seu perfil.</p>}
          {webhookUrl && <p className="dadm-note" style={{ overflowWrap: 'anywhere' }}>Webhook de entrada: <strong>{webhookUrl}</strong> · cabeçalho <code>{ia.channel?.webhookHeader || 'x-setpoint-webhook-token'}</code></p>}
          {podeGerenciar && ia && !ia.channel && <button type="button" className="c360-btn primary" disabled={busy === 'canal'} onClick={prepararAtendente}>Preparar atendente (rascunho)</button>}
          {podeGerenciar && ia?.channel?.status === 'ativo' && <button type="button" className="c360-btn ghost" disabled={busy === 'webhook'} onClick={sincronizarWebhook}>Sincronizar webhook</button>}
          {webhookInfo && <p className="dadm-note warn" style={{ overflowWrap: 'anywhere' }}>{webhookInfo}</p>}
          <Link to="/admin/barbearia-erp?area=integracoes&tab=Integra%C3%A7%C3%B5es">Revisar capacidades e ativar o atendente →</Link>
        </section>

        {podeGerenciar && <section className="dadm-card" aria-labelledby="wa-diag">
          <div className="c360-card-head"><h2 id="wa-diag">Diagnóstico de ponta a ponta</h2>
            <button type="button" className="c360-btn ghost" disabled={busy === 'diag'} onClick={diagnosticar}>{busy === 'diag' ? 'Conferindo…' : (diag ? 'Conferir de novo' : 'Conferir agora')}</button></div>
          <p className="dadm-muted">Confere a chave, a instância, o número, se o backend guardou as mensagens recebidas e se elas estão entrando no Kytto. Mostra só contagens e horários.</p>
          {diag && <ul className="dadm-check">{(diag.conclusoes || []).map((c) => <Check key={c.titulo} ok={c.ok} hint={c.detalhe}>{c.titulo}</Check>)}</ul>}
        </section>}

        <section className="dadm-card" aria-labelledby="wa-hist">
          <h2 id="wa-hist">Histórico da conexão</h2>
          {conexao.history?.length ? <ul className="dadm-history">{conexao.history.map((item) => <li key={`${item.at}-${item.tipo}`}><span>{HISTORY[item.tipo] || item.tipo}{item.detalhe ? ` · ${item.detalhe}` : ''}</span><span>{dateTime(item.at)}</span></li>)}</ul> : <p className="c360-empty">Nada registrado ainda.</p>}
        </section>
      </div>
    </div>}

    <Dialog open={teste.open} title="Enviar mensagem de teste" labelId="wa-teste" onClose={() => setTeste({ telefone: '', open: false })} onSubmit={enviarTeste} initialFocusRef={telefoneRef}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setTeste({ telefone: '', open: false })}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'teste'}>Enviar</button></>}>
      <label className="c360-field">Telefone com DDD<input ref={telefoneRef} className="c360-input" inputMode="tel" required value={teste.telefone} onChange={(event) => setTeste({ ...teste, telefone: event.target.value })} placeholder="(65) 99999-0000" /></label>
      <p className="dadm-muted">Envia uma mensagem curta de teste por este número. Limite de 5 testes por hora.</p>
    </Dialog>

    <Dialog open={confirmarSaida} title="Desconectar o WhatsApp?" labelId="wa-sair" danger onClose={() => setConfirmarSaida(false)}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setConfirmarSaida(false)}>Voltar</button><button type="button" className="c360-btn primary" disabled={busy === 'sair'} onClick={desconectar}>Desconectar</button></>}>
      <p>O atendente IA, lembretes de agenda, campanhas e recuperação de carrinho param de enviar mensagens até você conectar de novo. A reconexão automática fica pausada.</p>
    </Dialog>
  </div>
}
