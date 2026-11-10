import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock3, Inbox, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { empresaSemUnidade, sincronizarContextoComercial } from '../../../lib/contexto-comercial'
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
import WhatsappCloudApiPanel from './WhatsappCloudApiPanel'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/whatsapp-conexao'
const STATES = { open: 'Conectado', qr: 'Aguardando leitura do QR', connecting: 'Conectando…', close: 'Desconectado', unknown: 'Sem informação' }
const HISTORY = { conectado: 'Conectou', desconectado: 'Caiu', desconectado_manual: 'Desconectado manualmente', qr_gerado: 'QR gerado', codigo_pareamento_gerado: 'Código de pareamento gerado', reconexao_solicitada: 'Reconexão solicitada', reconexao_automatica: 'Reconexão automática', instancia_alterada: 'Instância alterada', erro: 'Erro', alerta_queda: 'Alerta de queda enviado', alerta_sem_destinatario: 'Queda sem e-mail de alerta cadastrado', instancia_confirmada: 'Instância confirmada' }
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
  const { empresaAtiva, lojaAtiva, lojasAcessiveis, atualizarContextoLojas } = useAuth()
  const precisaSincronizar = empresaSemUnidade(lojasAcessiveis, empresaAtiva?.id) || (Boolean(empresaAtiva?.id) && !lojaAtiva?.id)
  // Sem unidade da empresa ativa no navegador, relê o contexto autorizado no servidor
  // antes de bloquear QR e pareamento (corrige vínculos antigos sem novo login).
  useEffect(() => {
    if (!precisaSincronizar) return
    sincronizarContextoComercial({ cliente: api, lojasAcessiveis, atualizarContextoLojas, forcar: true })
  }, [precisaSincronizar, empresaAtiva?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const scopeKey = `${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`
  const { pathname } = useLocation()
  return <WhatsappConexaoEmpresa key={`${scopeKey}:${pathname}`} />
}

function WhatsappConexaoEmpresa() {
  const { empresaAtiva, empresasAcessiveis, trocarEmpresa, lojaAtiva, lojasAcessiveis, trocarLoja, user } = useAuth()
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
  const empresas = Array.isArray(empresasAcessiveis) ? empresasAcessiveis.filter((empresa) => empresa?.id) : []
  // Aceita o vínculo pelo id da empresa e pelo alias Commerce, como o restante do painel.
  const lojas = lojasDaEmpresa(lojasAcessiveis, tenantId).filter((loja) => loja?.id)
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
  const [emailAlerta, setEmailAlerta] = useState('')
  const [modoProvedor, setModoProvedor] = useState('waha')
  const emailAlertaSujoRef = useRef(false)
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
      if (!emailAlertaSujoRef.current) setEmailAlerta(data.conexao.emailAlerta || '')
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
      if ('emailAlerta' in patch) { emailAlertaSujoRef.current = false; setEmailAlerta(data.conexao.emailAlerta || '') }
      toast('Configuração salva.')
    } catch (error) { if (scope === scopeRef.current) toast(error.message, true) }
    finally { if (scope === scopeRef.current) setBusy('') }
  }

  async function gerarCodigoPareamento() {
    if (tipoCanal === 'cliente') return
    if (!referencia.trim()) { toast('Informe o número com DDD e DDI antes de gerar o código.', true); return }
    const scope = scopeRef.current
    setBusy('pareamento')
    try {
      const data = await api.post(`${basePath}/codigo-pareamento`, { phoneNumber: referencia }, requestOptions)
      if (scope !== scopeRef.current) return
      statusSeqRef.current += 1
      statusFlightRef.current = null
      setConexao(data.conexao)
      setReferencia(data.conexao?.phoneReference || referencia)
      setQr({ image: '', code: data.pairingCode || '' })
      toast('Código gerado. Digite-o no WhatsApp do número informado.')
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

  async function desconectar(forcar = false) {
    const scope = scopeRef.current
    setBusy('sair')
    try {
      const deveForcar = forcar || state !== 'open'
      const data = await api.post(`${basePath}/desconectar`, { confirmado: true, ...(deveForcar ? { forcar: true } : {}) }, requestOptions)
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
  const validationSteps = tipoCanal === 'cliente'
    ? [
      { ok: Boolean(conexao?.instance), title: 'Instância do backend atribuída', detail: conexao?.instance || 'A administração da plataforma precisa atribuir uma linha.' },
      { ok: state === 'open' && Boolean(conexao?.phoneMasked), title: 'Número confirmado pelo backend', detail: state === 'open' && conexao?.phoneMasked ? conexao.phoneMasked : 'Faça o pareamento por QR e aguarde a confirmação.' },
      { ok: Boolean(ia?.channel), title: 'Canal do atendente preparado', detail: ia?.channel ? `Status: ${ia.channel.status}` : 'Prepare o canal depois de confirmar a linha.' },
    ]
    : [
      { ok: Boolean(conexao?.provider === 'waha' && conexao?.providerConfigured), title: 'Ponte WAHA privada configurada', detail: conexao?.providerConfigured ? 'Controle protegido disponível.' : 'A ponte ainda não está disponível no servidor.' },
      { ok: Boolean(conexao?.instance), title: 'Sessão exclusiva atribuída', detail: conexao?.instance || 'A administração da plataforma precisa atribuir uma sessão.' },
      { ok: Boolean(referencia), title: 'Número informado para pareamento', detail: referencia || 'Informe o número com DDI para liberar o código.' },
      { ok: state === 'open', title: 'Número pareado e confirmado', detail: state === 'open' ? 'A sessão WAHA está conectada.' : 'Use QR ou código e depois clique em Verificar agora.' },
      { ok: Boolean(grupoOperacional), title: 'Grupo Admin salvo', detail: grupoOperacional ? 'Mensagens ficam limitadas ao grupo allowlisted.' : 'Liste os grupos e salve um grupo Admin exclusivo.' },
      { ok: internalReady.readyForActivation, title: 'Canal pronto para ativação', detail: internalReady.readyForActivation ? 'Todas as validações obrigatórias passaram.' : internalReady.blockers?.[0] || 'Consulte o diagnóstico abaixo.' },
    ]

  return <div className="dadm-page dadm-wa-page">
    <header className="dadm-head dadm-wa-head">
      <div><div className="dadm-eyebrow">Administração · coleta via WAHA</div><h1>Central WhatsApp</h1><p>Conexão, QR Code, pareamento e diagnóstico do canal <strong>{canalLabel}</strong>, sempre isolados por empresa e unidade.</p></div>
      <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={atualizando} onClick={() => { carregar(true); recarregarIa(); if (podeGerenciar && !diagBloqueado) diagnosticar() }}>{atualizando ? 'Atualizando…' : 'Atualizar agora'}</button></div>
    </header>

    {/* Seletor de Provedor Oficial Meta Cloud API vs QR Code WAHA */}
    <div className="flex flex-wrap items-center gap-2 my-4 p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl w-fit">
      <button
        type="button"
        onClick={() => setModoProvedor('waha')}
        className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${modoProvedor === 'waha' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
      >
        <Smartphone size={15} />
        WhatsApp Web / WAHA (QR Code)
      </button>
      <button
        type="button"
        onClick={() => setModoProvedor('cloud_api')}
        className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${modoProvedor === 'cloud_api' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
      >
        <ShieldCheck size={15} />
        WhatsApp Business Oficial (Meta Cloud API) 🛡️
      </button>
    </div>

    {modoProvedor === 'cloud_api' ? (
      <div className="my-4">
        <WhatsappCloudApiPanel empresaId={tenantId} lojaId={lojaId} />
      </div>
    ) : (
      <>
    <section className="dadm-wa-hero" aria-label="Resumo da Central WhatsApp">
      <div>
        <span className="dadm-wa-badge">Revisão humana obrigatória</span>
        <h2>{tipoCanal === 'lancamentos' ? 'Receba despesas e documentos sem lançar nada por engano.' : tipoCanal === 'gestao' ? 'Centralize perguntas e rotinas sem misturar empresas ou canais.' : 'Conecte o WhatsApp da empresa com segurança e rastreabilidade.'}</h2>
        <p>{tipoCanal === 'lancamentos' ? 'Notas, recibos e comprovantes são recebidos, preservados e preparados para revisão. Pagamentos, transferências, baixas e alterações de estoque nunca são automáticos.' : tipoCanal === 'gestao' ? 'O canal de Gestão é separado do atendimento ao cliente e do canal de Lançamentos. A empresa ativa, a unidade e o grupo autorizado determinam o que pode ser consultado.' : 'A Central mostra o estado real da sessão, oferece QR Code e código de pareamento, valida a linha e mantém a operação vinculada ao contexto escolhido.'}</p>
      </div>
      <MessageSquare size={30} aria-hidden="true" />
    </section>
    <section className="dadm-wa-policy" aria-label="Política de segurança do WhatsApp">
      <ShieldCheck size={19} aria-hidden="true" />
      <div><strong>Automação com barreira de segurança.</strong><p>Empresa, unidade, sessão física e canal são conferidos antes de liberar ações. Nenhum segredo aparece na tela; QR, grupos, mensagens e respostas não são compartilhados entre empresas.</p></div>
    </section>
    <section className="dadm-card dadm-wa-registration dadm-wa-config" aria-labelledby="wa-registration">
      <div className="c360-card-head"><h2 id="wa-registration">Cadastrar o número WhatsApp · {canalLabel}</h2><span className="dadm-operational-scope">Disponível para todas as empresas</span></div>
      <p>Use este link depois de selecionar a empresa no menu lateral. O cadastro, o QR e o status sempre ficam isolados na empresa ativa; uma empresa nunca reutiliza a linha de outra.</p>
      <section className="dadm-wa-context" aria-labelledby="wa-context-title">
        <div className="c360-card-head"><h3 id="wa-context-title">Empresa e unidade do canal</h3><span className="dadm-operational-scope">Obrigatório para consultar e conectar</span></div>
        <p className="dadm-muted">Selecione o contexto antes de consultar a conexão. Depois disso, os botões de QR, código, validação e grupo Admin aparecem para a empresa e unidade escolhidas.</p>
        <div className="dadm-wa-context-fields">
          <label className="c360-field" htmlFor="whatsapp-empresa-ativa">Empresa
            <select id="whatsapp-empresa-ativa" className="c360-input" value={empresaAtiva?.id || ''} onChange={(event) => trocarEmpresa?.(event.target.value)} disabled={!empresas.length}>
              <option value="">Selecione uma empresa</option>
              {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome || empresa.razaoSocial || empresa.id}</option>)}
            </select>
          </label>
          <label className="c360-field" htmlFor="whatsapp-loja-ativa">Unidade
            <select id="whatsapp-loja-ativa" className="c360-input" value={lojaAtiva?.id || ''} onChange={(event) => trocarLoja?.(event.target.value)} disabled={!empresaAtiva?.id || !lojas.length}>
              <option value="">Selecione uma unidade</option>
              {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome || loja.razaoSocial || loja.id}</option>)}
            </select>
          </label>
        </div>
        {!empresas.length && <p className="dadm-note danger" role="alert">Nenhuma empresa autorizada foi carregada. Atualize a sessão ou peça ao administrador da plataforma para liberar o acesso.</p>}
        {empresas.length > 0 && !empresaAtiva?.id && <p className="dadm-note warn" role="status">Selecione uma empresa para liberar o cadastro deste canal.</p>}
        {empresaAtiva?.id && !lojaAtiva?.id && <p className="dadm-note warn" role="status">Selecione uma unidade da empresa para liberar QR, pareamento e validação.</p>}
        {empresaAtiva?.id && lojaAtiva?.id && <p className="dadm-note" role="status">Contexto ativo: <strong>{empresaAtiva.nome}</strong> · <strong>{lojaAtiva.nome}</strong>. As ações abaixo ficam isoladas neste contexto.</p>}
      </section>
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
      {podeGerenciar && conexao && <form className="dadm-wa-number-form" aria-labelledby="wa-number-title" onSubmit={(event) => { event.preventDefault(); salvarConfig({ numeroExibicao: referencia }) }}>
        <div><h3 id="wa-number-title">Cadastrar número do aparelho</h3><p className="dadm-muted">Informe o número que será pareado neste canal. O cadastro é uma referência operacional; a confirmação real só acontece quando o backend/WAHA retornar a sessão conectada.</p></div>
        <div className="dadm-filters dadm-wa-number-fields">
          <label className="c360-field" htmlFor="wa-number-reference">Número do WhatsApp (com DDD e DDI)
            <input id="wa-number-reference" className="c360-input" type="tel" inputMode="tel" autoComplete="off" maxLength={25} required value={referencia} onChange={(event) => { referenceDirtyRef.current = true; setReferencia(event.target.value) }} placeholder="+55 (65) 99999-0000" />
          </label>
          <button type="submit" className="c360-btn ghost" disabled={Boolean(busy) || referencia.replace(/\D/g, '') === (conexao.phoneReference || '')}>{busy === 'config' ? 'Salvando…' : 'Salvar número'}</button>
          {tipoCanal !== 'cliente' && <button type="button" className="c360-btn primary" disabled={Boolean(busy) || !conexao.instance || !referencia.trim() || state === 'open'} onClick={gerarCodigoPareamento}>{busy === 'pareamento' ? 'Gerando código…' : 'Gerar código de pareamento'}</button>}
        </div>
        <small className="dadm-muted">{tipoCanal === 'cliente' ? 'Para Clientes, o número verificado vem exclusivamente do backend.' : 'O código é temporário e deve ser digitado no WhatsApp do aparelho informado. Ele não ativa o atendente nem substitui o grupo Admin.'}</small>
      </form>}
      {conexao && <section className="dadm-wa-number-check" aria-labelledby="wa-number-check-title"><div className="c360-card-head"><h3 id="wa-number-check-title">Validação deste canal</h3><span className={`dadm-validation-count ${validationSteps.every((item) => item.ok) ? 'ok' : ''}`}>{validationSteps.filter((item) => item.ok).length}/{validationSteps.length} concluídas</span></div><ul className="dadm-checklist">{validationSteps.map((item) => <li key={item.title} className={item.ok ? 'ok' : 'pend'}><b aria-hidden="true">{item.ok ? '✓' : '!'}</b><span><strong>{item.title}</strong><small>{item.detail}</small></span></li>)}</ul></section>}
      <p className="dadm-muted">{tipoCanal === 'lancamentos' ? 'Este é o canal interno exclusivo para receber notas e preparar despesas pendentes. Para perguntas gerais, use' : tipoCanal === 'gestao' ? 'Este é o canal interno executivo para o empresário Dino consultar faturamento, agenda, equipe, metas diárias, roleta, comissões e clientes por texto ou áudio. Para lançar notas, use' : 'Para configurar os canais internos sem remover o atendimento a clientes, use'}{' '}<Link to={tipoCanal === 'lancamentos' ? '/admin/whatsapp-gestao' : tipoCanal === 'gestao' ? '/admin/whatsapp-lancamentos' : '/admin/whatsapp-gestao'}>{tipoCanal === 'lancamentos' ? 'abrir o WhatsApp Gestão' : tipoCanal === 'gestao' ? 'abrir o WhatsApp Lançamentos' : 'abrir o WhatsApp Gestão'}</Link>.</p>
    </section>
    {erro && <p className="dadm-note danger dadm-wa-feedback" role="alert">{erro}</p>}
    {tipoCanal === 'cliente' && conexao?.foraDoAr && <p className="dadm-note danger dadm-wa-feedback" role="alert"><strong>O atendente virtual está parado.</strong> Este WhatsApp está desconectado do Kytto{conexao.lastDisconnectAt ? ` desde ${dateTime(conexao.lastDisconnectAt)}` : ''}: as mensagens dos clientes chegam no celular, mas não chegam ao atendente, e nada é respondido. Toque em <strong>Gerar QR</strong> e leia pelo celular da loja (WhatsApp › Aparelhos conectados › Conectar aparelho).</p>}
    {!conexao && !erro && <section className="dadm-card dadm-wa-loading" role="status">{tenantId && lojaId ? 'Consultando o estado do WhatsApp…' : 'Selecione uma empresa e uma unidade para consultar os canais.'}</section>}
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
      <section className="dadm-wa-line-card" aria-label="Linha e status do WhatsApp">
        <div className="dadm-wa-identity">
          <span className="dadm-wa-overline">Linha do WhatsApp · {conexao.instance || 'instância não atribuída'}</span>
          <strong className="dadm-wa-number">{line.value}</strong>
          <span className={`dadm-wa-source ${line.verified ? 'verified' : ''}`}>{line.verified ? '✓ ' : '• '}{line.source}</span>
          {line.copy && <button type="button" className="dadm-wa-copy" onClick={() => copiarNumero(line.copy)} aria-label="Copiar número completo do WhatsApp">Copiar número</button>}
          {podeGerenciar && tipoCanal === 'cliente' && !conexao.phoneNumber && <a className="dadm-wa-copy dadm-wa-reference-link" href="#wa-number-reference">{conexao.phoneReference ? 'Editar referência não verificada' : 'Informar número de referência'}</a>}
        </div>
        <div className="dadm-wa-live">
          <span className={`dadm-state ${state}`} role="status">{STATES[state] || state}</span>
          <small>Última consulta: {dateTime(conexao.lastCheckAt)}</small>
          <small>Atualização automática {state === 'qr' || state === 'connecting' ? 'a cada 5 s' : 'a cada 30 s'} · pausa com a aba oculta</small>
        </div>
      </section>

      <div className="dadm-wa-summary" aria-label="Resumo da operação">
        <article><Inbox size={19} aria-hidden="true" /><span>Mensagens recebidas</span><strong>{messages ? Number(messages.total || 0).toLocaleString('pt-BR') : '0'}</strong><small>na empresa ativa</small></article>
        <article><Clock3 size={19} aria-hidden="true" /><span>A revisar</span><strong>{messages ? Number(messages.pendentes || messages.received || pending || 0).toLocaleString('pt-BR') : '0'}</strong><small>aguardando conferência</small></article>
        <article><Smartphone size={19} aria-hidden="true" /><span>Estado do canal</span><strong className="dadm-wa-summary-status">{STATES[state] || state}</strong><small>{conexao?.providerLabel || 'Nenhum canal configurado'} · {iaSummary}</small></article>
        <article><ShieldCheck size={19} aria-hidden="true" /><span>Webhook</span><strong className={conexao?.providerConfigured ? 'dadm-wa-summary-ok' : 'dadm-wa-summary-warning'}>{conexao?.providerConfigured ? 'Protegido' : 'Não configurado'}</strong><small>segredo mantido no servidor</small></article>
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
              {tipoCanal !== 'cliente' && <><div><dt>Transporte</dt><dd>WAHA privado</dd></div><div><dt>Número cadastrado</dt><dd>{conexao.phoneReference || 'Ainda não informado'}</dd></div></>}
              {conexao && <div><dt>Envio de mensagens</dt><dd>{outbound.label}</dd></div>}
              <div><dt>Backend</dt><dd>{conexao.providerLabel}</dd></div>
              <div><dt>Conectado desde</dt><dd>{state === 'open' ? dateTime(conexao.lastConnectedAt) : '—'}</dd></div>
              <div><dt>Última verificação</dt><dd>{dateTime(conexao.lastCheckAt)}</dd></div>
              {conexao.reconnectAttempts > 0 && <div><dt>Tentativas de reconexão</dt><dd>{conexao.reconnectAttempts} · próxima {dateTime(conexao.nextReconnectAt)}</dd></div>}
            </dl>
            {state !== 'open' && (qr.image || qr.code) && <div className="dadm-qr" aria-live="polite">
              {qr.image && <img src={qr.image} alt="QR code para conectar o WhatsApp" />}
              {qr.code && <><span>{tipoCanal === 'cliente' ? 'Código de pareamento devolvido pelo backend' : 'Código de pareamento do número informado'}</span><code>{qr.code}</code></>}
              <small>O QR é renovado a cada 40 s enquanto esta aba estiver visível.</small>
            </div>}
            {state !== 'open' && <ol className="dadm-steps"><li>No celular do número informado, abra o WhatsApp.</li><li>Para QR: toque em <strong>Configurações › Aparelhos conectados › Conectar um aparelho</strong> e aponte a câmera.</li><li>Para código: abra <strong>Aparelhos conectados › Conectar com número de telefone</strong> e digite o código acima.</li><li>Depois clique em <strong>Verificar agora</strong> e confira o checklist; número informado sozinho nunca significa pareamento.</li></ol>}
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
            {tipoCanal === 'cliente' && <form className="dadm-filters" onSubmit={(event) => { event.preventDefault(); salvarConfig({ emailAlerta }) }}>
              <label className="c360-field" style={{ flex: 1 }} htmlFor="wa-email-alerta">E-mail para alerta de queda (até 3, separados por vírgula)
                <input id="wa-email-alerta" className="c360-input" type="text" inputMode="email" autoComplete="off" maxLength={380} value={emailAlerta} disabled={!podeGerenciar || Boolean(busy)} onChange={(event) => { emailAlertaSujoRef.current = true; setEmailAlerta(event.target.value) }} placeholder="gerente@loja.com.br" />
              </label>
              <button type="submit" className="c360-btn ghost" disabled={!podeGerenciar || Boolean(busy) || emailAlerta.trim() === (conexao.emailAlerta || '')}>{busy === 'config' ? 'Salvando…' : 'Salvar e-mail'}</button>
            </form>}
            {tipoCanal === 'cliente' && <small className="dadm-muted">Se a conexão ficar mais de 10 minutos fora, enviamos um e-mail com o passo a passo, e repetimos a cada 6 horas enquanto continuar fora.{conexao.alertaEnviadoEm ? ` Último alerta: ${dateTime(conexao.alertaEnviadoEm)}.` : ''}</small>}
            <p>{tipoCanal === 'cliente' ? 'O servidor verifica a conexão a cada minuto. Quando ela cair, tenta reconectar com espera crescente de 1 a 30 minutos; se necessário, um novo QR aparece nesta tela.' : 'O servidor consulta o estado da sessão interna. A reconexão depende da ponte WAHA e do pareamento; consulta de status não comprova reconexão nem entrega.'}</p>
            {podeGerenciar && user?.platformAdmin === true && <form className="dadm-filters" onSubmit={(event) => { event.preventDefault(); salvarConfig({ instance: instancia }) }}><label className="c360-field" style={{ flex: 1 }}>Instância no backend<input className="c360-input" value={instancia} onChange={(event) => setInstancia(event.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9_-]{1,63}" /></label><button type="submit" className="c360-btn ghost" disabled={Boolean(busy) || !instancia || (instancia === conexao.instance && (tipoCanal !== 'cliente' || conexao.donoRegistrado !== false))}>{instancia === conexao.instance && tipoCanal === 'cliente' && conexao.donoRegistrado === false ? 'Confirmar instância' : 'Salvar'}</button></form>}
            {tipoCanal === 'cliente' && conexao.instance && conexao.donoRegistrado === false && <p className="dadm-note warn" role="status">A instância {conexao.instance} ainda não está registrada como desta empresa no servidor: mensagens não entram nem saem. {user?.platformAdmin === true ? 'Toque em Confirmar instância para registrá-la.' : 'Peça à administração da plataforma para confirmar a instância.'}</p>}
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
      actions={<>
        <button type="button" className="c360-btn ghost" onClick={() => setConfirmarSaida(false)}>Voltar</button>
        {state !== 'open' && <button type="button" className="c360-btn ghost" disabled={busy === 'sair'} onClick={() => desconectar(true)}>Forçar desconexão</button>}
        <button type="button" className="c360-btn primary" disabled={busy === 'sair'} onClick={() => desconectar(false)}>Desconectar</button>
      </>}>
      <p>O atendente IA, lembretes de agenda, campanhas e recuperação de carrinho param de enviar mensagens até você conectar de novo. A reconexão automática fica pausada.</p>
      {state !== 'open' && <p className="dadm-note warn">A linha já está aguardando pareamento (sem aparelho conectado no momento). A desconexão irá limpar a sessão e pausar a reconexão automática para você conectar um novo número com segurança.</p>}
    </Dialog>
    </>)}
  </div>
}
