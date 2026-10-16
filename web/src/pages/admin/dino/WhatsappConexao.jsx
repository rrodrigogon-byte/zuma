import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { brandFromContext } from '../../../lib/brand'
import { channelStatusPayload, webhookSecretEnvFor } from '../../../lib/whatsapp-webhook-secret'
import { useToast } from '../../../hooks/useToast'
import { Dialog } from '../customer360/shared'
import { dateTime } from './format'
import { linePresentation, statusRefreshInterval, outboundPresentation } from './whatsapp-view'
import { normalizeWhatsappAiOperationalStatus } from './whatsapp-ai-operational'
import { WhatsappAiOperationalSection } from './WhatsappAiOperationalSection'
import { internalWhatsappReadiness } from './whatsapp-internal-readiness'
import WhatsappHumanQueue from './WhatsappHumanQueue'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/whatsapp-conexao'
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
  const { empresaAtiva, lojaAtiva } = useAuth()
  const scopeKey = `${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`
  const { pathname } = useLocation()
  return <WhatsappConexaoEmpresa key={`${scopeKey}:${pathname}`} />
}

function WhatsappConexaoEmpresa() {
  const { empresaAtiva, lojaAtiva, user } = useAuth()
  const pathname = typeof window !== 'undefined' ? String(window.location?.pathname || '') : ''
  const tipoCanal = pathname.includes('/admin/whatsapp-lancamentos') ? 'lancamentos' : pathname.includes('/admin/whatsapp-gestao') ? 'gestao' : 'cliente'
  const canalLabel = tipoCanal === 'lancamentos' ? 'Lançamentos' : tipoCanal === 'gestao' ? 'Gestão' : 'Clientes'
  const basePath = tipoCanal === 'lancamentos' ? `${BASE}-lancamentos` : tipoCanal === 'gestao' ? `${BASE}-gestao` : BASE
  const channelQuery = tipoCanal === 'cliente' ? '' : `?canal=${tipoCanal}`
  const aiStatusPath = `/api/admin/commerce/whatsapp-ai/status${channelQuery}`
  const aiChannelPath = `/api/admin/commerce/whatsapp-ai/channel${channelQuery}`
  const aiWebhookPath = `/api/admin/commerce/whatsapp-ai/channel/sync-webhook${channelQuery}`
  const { toast } = useToast()
  const tenantId = String(empresaAtiva?.id || '')
  const lojaId = String(lojaAtiva?.id || '')
  const requestOptions = { headers: { 'X-Empresa-Id': tenantId, 'X-Loja-Id': lojaId } }
  const [conexao, setConexao] = useState(null)
  const [podeGerenciar, setPodeGerenciar] = useState(false)
  const [ia, setIa] = useState(null)
  const [iaOperational, setIaOperational] = useState({ kind: 'loading' })
  const [iaReadAt, setIaReadAt] = useState(null)
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
  const [grupos, setGrupos] = useState([])
  const [grupoSelecionado, setGrupoSelecionado] = useState('')
  const telefoneRef = useRef(null)
  const scopeRef = useRef(0)
  const statusSeqRef = useRef(0)
  const statusFlightRef = useRef(null)
  const iaSeqRef = useRef(0)
  const iaFlightRef = useRef(null)
  const diagFlightRef = useRef(null)
  const qrFlightRef = useRef(null)
  const referenceDirtyRef = useRef(false)

  const carregar = useCallback(async (foreground = false) => {
    if (!tenantId || !lojaId || statusFlightRef.current || (!foreground && document.visibilityState !== 'visible')) return
    const flight = Symbol('whatsapp-status')
    const scope = scopeRef.current
    const sequence = ++statusSeqRef.current
    statusFlightRef.current = flight
    if (foreground) setAtualizando(true)
    try {
      const data = await api.get(`${basePath}?atualizar=1`, requestOptions)
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
  }, [tenantId, lojaId, tipoCanal])

  const recarregarIa = useCallback(async () => {
    if (!tenantId || !lojaId) {
      setIa(null)
      setIaOperational({ kind: 'unverifiable', reason: 'context' })
      setIaReadAt(null)
      return
    }
    if (iaFlightRef.current) return iaFlightRef.current
    const flight = Symbol('whatsapp-ai-status')
    const scope = scopeRef.current
    const sequence = ++iaSeqRef.current
    iaFlightRef.current = flight
    try {
      const data = await api.get(aiStatusPath, { headers: { 'X-Empresa-Id': tenantId, 'X-Loja-Id': lojaId } })
      if (scope === scopeRef.current && sequence === iaSeqRef.current) {
        const normalized = normalizeWhatsappAiOperationalStatus(data)
        setIaOperational(normalized)
        if (normalized.kind === 'valid') {
          setIa(data)
          setIaReadAt(new Date().toISOString())
        } else {
          setIa(null)
          setIaReadAt(null)
        }
      }
    } catch (error) {
      if (scope === scopeRef.current && sequence === iaSeqRef.current) {
        setIa(null)
        setIaOperational({ kind: 'unverifiable', reason: [401, 403].includes(error?.status) ? 'permission' : [404, 409].includes(error?.status) ? 'context' : error?.status === 503 ? 'unavailable' : 'read' })
        setIaReadAt(null)
      }
    } finally {
      if (iaFlightRef.current === flight) iaFlightRef.current = null
    }
  }, [tenantId, lojaId, tipoCanal])

  const diagnosticar = useCallback(async () => {
    if (!tenantId || !lojaId || diagFlightRef.current) return
    const flight = Symbol('whatsapp-diagnostic')
    const scope = scopeRef.current
    diagFlightRef.current = flight
    setBusy((value) => value || 'diag')
    try {
      const data = await api.get(`${basePath}/diagnostico`, requestOptions)
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
  }, [tenantId, lojaId, tipoCanal])

  useEffect(() => {
    scopeRef.current += 1
    statusSeqRef.current += 1
    statusFlightRef.current = null
    iaSeqRef.current += 1
    iaFlightRef.current = null
    diagFlightRef.current = null
    qrFlightRef.current = null
    referenceDirtyRef.current = false
    setConexao(null); setPodeGerenciar(false); setIa(null); setIaOperational({ kind: 'loading' }); setIaReadAt(null); setDiag(null); setGrupos([]); setGrupoSelecionado('')
    setErro(''); setErroDiag(''); setDiagBloqueado(false); setBusy('')
    setQr({ image: '', code: '' }); setInstancia(''); setReferencia(''); setWebhookInfo('')
    carregar(true)
    recarregarIa()
    return () => { scopeRef.current += 1; statusSeqRef.current += 1; iaSeqRef.current += 1; statusFlightRef.current = null; iaFlightRef.current = null; diagFlightRef.current = null; qrFlightRef.current = null }
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
      const data = await api.post(`${basePath}/qr`, { auto }, requestOptions)
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
      const data = await api.put(`${basePath}/config`, patch, requestOptions)
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
      const data = await api.post(`${basePath}/verificar`, {}, requestOptions)
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
      const data = await api.post(`${basePath}/desconectar`, { confirmado: true }, requestOptions)
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
      await api.post(aiChannelPath, {
        instance: conexao.instance, displayName: `${canalLabel} · ${empresaAtiva?.nome || 'da empresa'}`.slice(0, 120), status: 'rascunho', tipoCanal,
        transporte: tipoCanal === 'cliente' ? 'legado' : 'waha',
        ...(tipoCanal === 'cliente' ? { webhookSecretEnv: webhookSecretEnvFor(empresaAtiva), webhookHeader: 'x-setpoint-webhook-token' } : { wahaWebhookSecretEnv: 'WAHA_WEBHOOK_SECRET', wahaHmacSecretEnv: 'WAHA_WEBHOOK_HMAC_KEY', webhookHeader: 'x-waha-webhook-secret' }),
        capabilities: tipoCanal === 'cliente'
          ? { humanized: true, captureLeads: true, operateStore: true, manageAppointments: true, sendPromotions: false, reminders: true, humanHandoff: true, financialOperations: false }
          : { humanized: true, captureLeads: false, operateStore: false, manageAppointments: false, sendPromotions: false, reminders: false, humanHandoff: true, financialOperations: tipoCanal === 'lancamentos' },
      }, requestOptions)
      if (scope === scopeRef.current) { toast('Canal criado em rascunho.'); await recarregarIa() }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  // Liga ou pausa o atendente direto nesta tela, mantendo capacidades e instância salvas.
  async function alterarAtendente(status) {
    if (!ia?.channel) return
    if (status === 'ativo' && tipoCanal !== 'cliente' && !internalWhatsappReadiness(conexao, diag, ia, tipoCanal).readyForActivation) return
    if (status === 'ativo' && !window.confirm('Ativar o atendente IA neste WhatsApp? As mensagens recebidas passam a ser respondidas pela IA, com as capacidades salvas no canal.')) return
    const scope = scopeRef.current
    setBusy('canal')
    try {
      await api.post(aiChannelPath, channelStatusPayload(ia.channel, { status, instance: conexao?.instance, empresa: empresaAtiva, tipoCanal }), requestOptions)
      if (scope === scopeRef.current) { toast(status === 'ativo' ? 'Atendente ativado.' : 'Atendente pausado.'); await recarregarIa() }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function listarGrupos() {
    if (tipoCanal === 'cliente') return
    const scope = scopeRef.current
    setBusy('grupos')
    try {
      const data = await api.get(`${basePath}/grupos`, requestOptions)
      if (scope === scopeRef.current) { setGrupos(Array.isArray(data.groups) ? data.groups : []); toast('Grupos carregados sem participantes.') }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function salvarGrupo() {
    if (!grupoSelecionado) return
    const scope = scopeRef.current
    setBusy('grupo')
    try {
      await api.put(`${basePath}/grupo`, { groupId: grupoSelecionado }, requestOptions)
      if (scope === scopeRef.current) { toast('Grupo Admin allowlisted para este canal.'); await recarregarIa() }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function sincronizarWebhook() {
    const scope = scopeRef.current
    setBusy('webhook')
    try {
      const data = await api.post(aiWebhookPath, { confirmed: true }, requestOptions)
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
      await api.post(`${basePath}/teste`, { confirmado: true, telefone: tipoCanal === 'cliente' ? teste.telefone : undefined }, requestOptions)
      if (scope === scopeRef.current) { toast('Teste aceito pelo backend; confira a entrega no aparelho.'); setTeste({ telefone: '', open: false }) }
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function copiarTexto(value, successMessage, errorMessage) {
    try { await navigator.clipboard.writeText(value); toast(successMessage) }
    catch { toast(errorMessage, true) }
  }

  async function copiarNumero(value) {
    await copiarTexto(value, 'Número copiado.', 'Não foi possível copiar o número.')
  }

  async function copiarLinkCadastro() {
    const url = `${window.location.origin}/admin/whatsapp${tipoCanal === 'lancamentos' ? '-lancamentos' : tipoCanal === 'gestao' ? '-gestao' : ''}`
    await copiarTexto(url, 'Link de cadastro copiado.', 'Não foi possível copiar o link de cadastro.')
  }

  const state = conexao?.lastError ? 'unknown' : (conexao?.state || 'unknown')
  const internalReady = internalWhatsappReadiness(conexao ? { ...conexao, state } : null, diag, ia, tipoCanal)
  const line = tipoCanal === 'cliente' ? linePresentation(conexao ? { ...conexao, state } : null) : {
    value: conexao?.instance ? 'Sessão interna atribuída' : 'Sessão interna não atribuída',
    source: 'Pareamento próprio e grupo Admin exclusivo; não utiliza a linha de Clientes', verified: false,
  }
  const webhookUrl = ia?.channel?.publicCode ? (tipoCanal === 'cliente' ? `${window.location.origin}/api/webhooks/whatsapp/${ia.channel.publicCode}` : `${window.location.origin}/api/webhooks/waha`) : ''
  const erroConexao = conexao?.lastError ? (ERRORS[conexao.lastError] || 'O backend informou uma falha na conexão. Confira o diagnóstico para obter orientação segura.') : ''
  const pending = diag?.conclusoes?.filter((item) => !item.ok).length
  const saida = tipoCanal === 'cliente' ? conexao?.saida : null
  const outbound = tipoCanal === 'cliente' ? outboundPresentation(conexao ? { ...conexao, state } : null, diag) : internalReady
  const grupoOperacional = tipoCanal !== 'cliente' && Boolean(ia?.channel?.wahaGroupId)
  const saidaBloqueada = !outbound.ready
  const messages = diag?.mensagens24h
  const iaSummary = iaOperational.kind === 'loading' ? 'Aguardando' : iaOperational.kind !== 'valid' ? 'Não verificável' : iaOperational.channel.configured ? (iaOperational.channel.status === 'ativo' ? 'Ativo' : 'Em preparação') : 'Não configurado'

  return <div className="dadm-page dadm-wa-page">
    <header className="dadm-head dadm-wa-head">
      <div><div className="dadm-eyebrow">Relacionamento & IA · {empresaAtiva?.nome || 'Empresa'}</div><h1>WhatsApp · {canalLabel}</h1><p>Acompanhe a linha em uso, a conexão do atendente e a atividade com atualização automática — sem expor a chave de API.</p></div>
      <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={atualizando} onClick={() => { carregar(true); recarregarIa(); if (podeGerenciar && !diagBloqueado) diagnosticar() }}>{atualizando ? 'Atualizando…' : 'Atualizar agora'}</button></div>
    </header>
    <section className="dadm-card dadm-wa-registration" aria-labelledby="wa-registration">
      <div className="c360-card-head"><h2 id="wa-registration">Cadastrar o número WhatsApp · {canalLabel}</h2><span className="dadm-operational-scope">Disponível para todas as empresas</span></div>
      <p>Use este link depois de selecionar a empresa no menu lateral. O cadastro, o QR e o status sempre ficam isolados na empresa ativa; uma empresa nunca reutiliza a linha de outra.</p>
      <nav className="dadm-actions" aria-label="Perfis WhatsApp da empresa">
        <Link className="c360-btn ghost" aria-current={tipoCanal === 'cliente' ? 'page' : undefined} to="/admin/whatsapp">Clientes</Link>
        <Link className="c360-btn ghost" aria-current={tipoCanal === 'gestao' ? 'page' : undefined} to="/admin/whatsapp-gestao">Gestão</Link>
        <Link className="c360-btn ghost" aria-current={tipoCanal === 'lancamentos' ? 'page' : undefined} to="/admin/whatsapp-lancamentos">Lançamentos</Link>
      </nav>
      {tipoCanal !== 'cliente' && <p className="dadm-note warn" role="status">{internalReady.label}. Configure a ponte privada, atribua uma sessão exclusiva, prepare o canal em rascunho, pareie o aparelho e salve o grupo Admin antes de ativar. Gestão consulta informações; Lançamentos prepara pendências para revisão humana, sem pagar, transferir ou dar baixa.</p>}
      <div className="dadm-wa-registration-link">
        <input className="c360-input" aria-label="Link de cadastro do número WhatsApp" readOnly value={`${window.location.origin}/admin/whatsapp${tipoCanal === 'lancamentos' ? '-lancamentos' : tipoCanal === 'gestao' ? '-gestao' : ''}`} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="c360-btn ghost" onClick={copiarLinkCadastro}>Copiar link</button>
        <Link className="c360-btn primary" to={tipoCanal === 'lancamentos' ? '/admin/whatsapp-lancamentos' : tipoCanal === 'gestao' ? '/admin/whatsapp-gestao' : '/admin/whatsapp'}>Abrir cadastro</Link>
      </div>
      <small className="dadm-muted">O administrador ou gestor da empresa deve abrir o link, conferir a empresa ativa e então gerar o QR para parear o aparelho.</small>
      <p className="dadm-muted">{tipoCanal === 'lancamentos' ? 'Este é o canal interno exclusivo para receber notas e preparar despesas pendentes. Para perguntas gerais, use' : tipoCanal === 'gestao' ? 'Este é o canal interno somente leitura para perguntas gerais do sistema. Para lançar notas, use' : 'Para configurar os canais internos sem remover o atendimento a clientes, use'}{' '}<Link to={tipoCanal === 'lancamentos' ? '/admin/whatsapp-gestao' : tipoCanal === 'gestao' ? '/admin/whatsapp-lancamentos' : '/admin/whatsapp-gestao'}>{tipoCanal === 'lancamentos' ? 'abrir o WhatsApp Gestão' : tipoCanal === 'gestao' ? 'abrir o WhatsApp Lançamentos' : 'abrir o WhatsApp Gestão'}</Link>.</p>
    </section>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {!conexao && !erro && <section className="dadm-card" role="status">{tenantId && lojaId ? 'Consultando o estado do WhatsApp…' : 'Selecione uma empresa e uma unidade para consultar os canais.'}</section>}
    <WhatsappAiOperationalSection status={iaOperational} readAt={iaReadAt} />
    <WhatsappHumanQueue
      empresaId={tenantId}
      lojaId={lojaId}
      tipoCanal={tipoCanal}
      empresaNome={empresaAtiva?.nome}
      lojaNome={lojaAtiva?.nome}
      operatorLabel={user?.nome || user?.name || user?.email}
      onChanged={recarregarIa}
    />

    {conexao && <>
      <section className="dadm-wa-hero" aria-label="Linha e status do WhatsApp">
        <div className="dadm-wa-identity">
          <span className="dadm-wa-overline">Linha do WhatsApp · {conexao.instance || 'instância não atribuída'}</span>
          <strong className="dadm-wa-number">{line.value}</strong>
          <span className={`dadm-wa-source ${line.verified ? 'verified' : ''}`}>{line.verified ? '✓ ' : '• '}{line.source}</span>
          {line.copy && <button type="button" className="dadm-wa-copy" onClick={() => copiarNumero(line.copy)} aria-label="Copiar número completo do WhatsApp">Copiar número</button>}
          {podeGerenciar && tipoCanal === 'cliente' && !conexao.phoneNumber && <a className="dadm-wa-copy dadm-wa-reference-link" href="#wa-reference">{conexao.phoneReference ? 'Editar referência não verificada' : 'Informar número de referência'}</a>}
        </div>
        <div className="dadm-wa-live">
          <span className={`dadm-state ${state}`} role="status">{STATES[state] || state}</span>
          <small>Última consulta: {dateTime(conexao.lastCheckAt)}</small>
          <small>Atualização automática {state === 'qr' || state === 'connecting' ? 'a cada 5 s' : 'a cada 30 s'} · pausa com a aba oculta</small>
        </div>
      </section>

      <div className="dadm-wa-summary" aria-label="Resumo da operação">
        <article><span>Atendente IA</span><strong>{iaSummary}</strong><small>{iaOperational.kind === 'valid' && iaOperational.channel.lastEventAt?.state === 'current' ? `Último evento: ${dateTime(iaOperational.channel.lastEventAt.value)}` : iaOperational.kind === 'valid' ? 'Evento não verificável ou não informado' : 'Leitura operacional não verificável'}</small></article>
        <article><span>Contatos distintos · 24 h</span><strong>{messages ? Number(messages.contatos || 0).toLocaleString('pt-BR') : '—'}</strong><small>{messages ? 'Entre até 200 mensagens consultadas' : 'Disponível para a empresa dona'}</small></article>
        <article><span>Mensagens consultadas · 24 h</span><strong>{messages ? Number(messages.total || 0).toLocaleString('pt-BR') : '—'}</strong><small>{messages ? `Amostra de até 200 · última ${dateTime(messages.ultimaEm)}` : 'Sem leitura disponível'}</small></article>
        <article><span>Saúde do canal</span><strong>{pending == null ? 'Aguardando' : `${pending} pendência${pending === 1 ? '' : 's'} no diagnóstico`}</strong><small>{diag ? `Conferido em ${dateTime(diag.agora)} · não substitui a leitura operacional` : 'Confira a integração abaixo'}</small></article>
      </div>

      <div className="dadm-wa">
        <div className="dadm-wa-column">
          <section className="dadm-card" aria-labelledby="wa-conn">
            <div className="c360-card-head"><h2 id="wa-conn">Conexão e identificação</h2><span className={`dadm-state ${state}`}>{STATES[state] || state}</span></div>
            {!conexao.providerConfigured && <p className="dadm-note warn">{tipoCanal === 'cliente' ? (conexao.provider !== 'chatbot_backend' ? ERRORS.provedor_nao_e_nossagente : 'Falta a chave CHATBOT_BACKEND_KEY no servidor.') : 'O controle privado WAHA do Kytto ainda não está configurado.'}</p>}
            {erroConexao && conexao.providerConfigured && <p className="dadm-note danger">{erroConexao}</p>}
            {tipoCanal === 'cliente' && state === 'open' && !conexao.phoneMasked && <p className="dadm-note warn" role="status">Sessão aberta, mas o backend não informou o número. Confirme a conta pareada em Aparelhos conectados no WhatsApp antes de usar este canal; uma referência manual não comprova titularidade.</p>}
            {saidaBloqueada && <p className="dadm-note warn" role="status">{outbound.label}. Confira o diagnóstico da instância antes de testar mensagens. O modo de envio do servidor não substitui conexão, empresa dona e verificação da linha.</p>}
            {saida?.modo === 'pilot' && !saida.pilotoConfigurado && <p className="dadm-note warn" role="status">Envio em modo piloto, mas sem nenhum número autorizado em WHATSAPP_POLL_PILOT_PHONES.</p>}
            <dl className="dadm-result">
              <div><dt>Identificação da linha</dt><dd>{line.verified ? line.value : 'Não confirmada'}</dd></div>
              <div><dt>Instância no backend</dt><dd>{conexao.instance || 'Não atribuída'}</dd></div>
              {tipoCanal !== 'cliente' && <div><dt>Transporte</dt><dd>WAHA privado</dd></div>}
              {conexao && <div><dt>Envio de mensagens</dt><dd>{outbound.label}</dd></div>}
              <div><dt>Backend</dt><dd>{conexao.providerLabel}</dd></div>
              <div><dt>Conectado desde</dt><dd>{state === 'open' ? dateTime(conexao.lastConnectedAt) : '—'}</dd></div>
              <div><dt>Última verificação</dt><dd>{dateTime(conexao.lastCheckAt)}</dd></div>
              {conexao.reconnectAttempts > 0 && <div><dt>Tentativas de reconexão</dt><dd>{conexao.reconnectAttempts} · próxima {dateTime(conexao.nextReconnectAt)}</dd></div>}
            </dl>
            {podeGerenciar && tipoCanal === 'cliente' && !conexao.phoneNumber && <form className="dadm-wa-reference" onSubmit={(event) => { event.preventDefault(); salvarConfig({ numeroExibicao: referencia }) }}>
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
              {state === 'open' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy) || saidaBloqueada} title={saidaBloqueada ? outbound.label : undefined} onClick={() => setTeste({ telefone: '', open: true })}>Enviar teste</button>}
              {conexao.ativo && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={() => setConfirmarSaida(true)}>Desconectar</button>}
            </div> : <p className="dadm-muted">Só administradores e gestores alteram a conexão.</p>}
            {tipoCanal !== 'cliente' && <div className="dadm-wa-reference" aria-labelledby="wa-group">
              <h3 id="wa-group">Grupo Admin deste canal</h3>
              <p className="dadm-muted">Gestão e Lançamentos aceitam mensagens somente de um grupo <code>@g.us</code> allowlisted para esta empresa, sessão e perfil. Conversas individuais e outros grupos são descartados.</p>
              {ia?.channel?.wahaGroupSubject && <p className="dadm-note">Grupo salvo: <strong>{ia.channel.wahaGroupSubject}</strong> · <code>{ia.channel.wahaGroupId}</code></p>}
              {podeGerenciar && <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={Boolean(busy) || state !== 'open'} onClick={listarGrupos}>{busy === 'grupos' ? 'Listando…' : 'Listar grupos'}</button><select className="c360-input" aria-label="Grupo Admin WAHA" value={grupoSelecionado || ia?.channel?.wahaGroupId || ''} onChange={(event) => setGrupoSelecionado(event.target.value)}><option value="">Selecione um grupo Admin</option>{grupos.map((group) => <option key={group.id} value={group.id}>{group.subject}</option>)}</select><button type="button" className="c360-btn primary" disabled={Boolean(busy) || !grupoSelecionado} onClick={salvarGrupo}>{busy === 'grupo' ? 'Salvando…' : 'Salvar grupo'}</button></div>}
            </div>}
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
              <Check ok={conexao.providerConfigured}>{tipoCanal === 'cliente' ? 'Backend configurado' : 'Controle WAHA configurado'}</Check>
              <Check ok={tipoCanal !== 'cliente' ? state === 'open' && grupoOperacional : state === 'open' && Boolean(conexao.phoneMasked)} hint={tipoCanal !== 'cliente' ? (grupoOperacional ? 'sessão e grupo allowlisted' : 'salve um grupo Admin') : (state === 'open' && !conexao.phoneMasked ? 'sessão aberta, número não informado' : undefined)}>{tipoCanal !== 'cliente' ? 'Sessão e grupo Admin identificados' : 'Número identificado pelo backend'}</Check>
              <Check ok={Boolean(ia.gemini?.configured)} hint={ia.gemini?.model}>Gemini configurado</Check>
              <Check ok={Boolean(ia.featureEnabled)} hint="FEATURE_WHATSAPP_AI=true">IA liberada no servidor</Check>
              <Check ok={ia.channel?.status === 'ativo'}>Canal do atendente ativo</Check>
              <Check ok={outbound.ready} hint={outbound.label}>{tipoCanal === 'cliente' ? 'Prontidão do envio' : 'Prontidão WAHA deste perfil'}</Check>
              <Check ok={Boolean(ia.channel?.lastEventAt)} hint={ia.channel?.lastEventAt ? `último em ${dateTime(ia.channel.lastEventAt)}` : 'nenhuma mensagem recebida ainda'}>Mensagens chegando</Check>
            </ul> : <p className="c360-empty">Status do atendente indisponível para o seu perfil.</p>}
            {webhookUrl && <p className="dadm-note dadm-wa-webhook">Webhook de entrada: <strong>{webhookUrl}</strong> · {tipoCanal === 'cliente' ? <>cabeçalho <code>{ia.channel?.webhookHeader || 'x-setpoint-webhook-token'}</code></> : <>segredo + HMAC protegidos no servidor</>}</p>}
            {podeGerenciar && ia && !ia.channel && <button type="button" className="c360-btn primary" disabled={Boolean(busy) || !conexao.instance} onClick={prepararAtendente}>Preparar atendente (rascunho)</button>}
            {podeGerenciar && ia?.channel && ia.channel.status !== 'ativo' && <button type="button" className="c360-btn primary" disabled={Boolean(busy) || (tipoCanal !== 'cliente' && !internalReady.readyForActivation)} onClick={() => alterarAtendente('ativo')}>Ativar atendente</button>}
            {podeGerenciar && ia?.channel?.status === 'ativo' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={() => alterarAtendente('rascunho')}>Pausar atendente</button>}
            {podeGerenciar && ia?.channel?.status === 'ativo' && <button type="button" className="c360-btn ghost" disabled={Boolean(busy)} onClick={sincronizarWebhook}>Sincronizar webhook</button>}
            {webhookInfo && <p className="dadm-note warn dadm-wa-webhook">{webhookInfo}</p>}
            {tipoCanal === 'cliente' && <Link to={brandFromContext(empresaAtiva) === 'stallone' ? '/admin/cerebro-ia' : '/admin/barbearia-erp?area=integracoes&tab=Integra%C3%A7%C3%B5es'}>{brandFromContext(empresaAtiva) === 'stallone' ? 'Ver o cérebro do atendente →' : 'Revisar capacidades e ativar o atendente →'}</Link>}
          </section>

          <section className="dadm-card" aria-labelledby="wa-auto">
            <h2 id="wa-auto">Reconexão automática</h2>
            <label className="dadm-toggle"><input type="checkbox" checked={conexao.autoReconnect} disabled={!podeGerenciar || Boolean(busy)} onChange={(event) => salvarConfig({ autoReconnect: event.target.checked })} />Reconectar sozinho quando a conexão cair</label>
            <p>{tipoCanal === 'cliente' ? 'O servidor verifica a conexão a cada minuto. Quando ela cair, tenta reconectar com espera crescente de 1 a 30 minutos; se necessário, um novo QR aparece nesta tela.' : 'O servidor consulta o estado da sessão interna. A reconexão depende da ponte WAHA e do pareamento; consulta de status não comprova reconexão nem entrega.'}</p>
            {podeGerenciar && user?.platformAdmin === true && <form className="dadm-filters" onSubmit={(event) => { event.preventDefault(); salvarConfig({ instance: instancia }) }}><label className="c360-field" style={{ flex: 1 }}>Instância no backend<input className="c360-input" value={instancia} onChange={(event) => setInstancia(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9_-]{1,63}" /></label><button type="submit" className="c360-btn ghost" disabled={Boolean(busy) || instancia === conexao.instance}>Salvar</button></form>}
          </section>

          <section className="dadm-card" aria-labelledby="wa-hist"><h2 id="wa-hist">Histórico da conexão</h2>{conexao.history?.length ? <ul className="dadm-history">{conexao.history.slice(0, 8).map((item) => <li key={`${item.at}-${item.tipo}-${item.instance || ''}`}><span>{HISTORY[item.tipo] || item.tipo}{item.instance && item.instance !== conexao.instance ? ` · instância ${item.instance}` : ''}{item.detalhe ? ` · ${item.detalhe}` : ''}</span><span>{dateTime(item.at)}</span></li>)}</ul> : <p className="c360-empty">Nada registrado ainda.</p>}</section>
        </div>
      </div>
    </>}

    <Dialog open={teste.open} title={tipoCanal === 'cliente' ? 'Enviar mensagem de teste' : 'Testar grupo Admin WAHA'} labelId="wa-teste" onClose={() => setTeste({ telefone: '', open: false })} onSubmit={enviarTeste} initialFocusRef={telefoneRef}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setTeste({ telefone: '', open: false })}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'teste'}>Enviar</button></>}>
      {tipoCanal === 'cliente' ? <label className="c360-field">Telefone com DDD<input ref={telefoneRef} className="c360-input" inputMode="tel" required value={teste.telefone} onChange={(event) => setTeste({ ...teste, telefone: event.target.value })} placeholder="(65) 99999-0000" /></label> : <p className="dadm-muted">O teste será enviado somente ao grupo Admin salvo para esta empresa e este perfil. Não é possível informar um número individual.</p>}
      <p className="dadm-muted">O backend aceita o envio, mas a entrega no aparelho deve ser conferida. Limite de 5 testes por hora.</p>
    </Dialog>
    <Dialog open={confirmarSaida} title="Desconectar o WhatsApp?" labelId="wa-sair" danger onClose={() => setConfirmarSaida(false)}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setConfirmarSaida(false)}>Voltar</button><button type="button" className="c360-btn primary" disabled={busy === 'sair'} onClick={desconectar}>Desconectar</button></>}>
      <p>O atendente IA, lembretes de agenda, campanhas e recuperação de carrinho param de enviar mensagens até você conectar de novo. A reconexão automática fica pausada.</p>
    </Dialog>
  </div>
}
