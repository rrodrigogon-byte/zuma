import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, CheckCircle2, CircleAlert, ExternalLink, MessageSquare, RefreshCw, ShieldCheck, Smartphone, Store, Users, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../hooks/useToast'
import { dateTime } from './format'
import '../customer360.css'
import './dino-admin.css'

const CHANNELS = [
  {
    key: 'cliente',
    label: 'Clientes',
    description: 'Atendimento, agenda, campanhas e relacionamento.',
    route: '/admin/whatsapp',
    api: '/api/admin/barbearia/whatsapp-conexao',
    icon: MessageSquare,
    tone: 'client',
  },
  {
    key: 'gestao',
    label: 'Gestão',
    description: 'Copiloto executivo do Dino: faturamento, agenda, equipe, metas diárias, roleta, comissões e clientes via texto e áudio.',
    route: '/admin/whatsapp-gestao',
    api: '/api/admin/barbearia/whatsapp-conexao-gestao',
    icon: Workflow,
    tone: 'management',
  },
  {
    key: 'lancamentos',
    label: 'Lançamentos',
    description: 'Notas e documentos para revisão humana, sem pagamentos automáticos.',
    route: '/admin/whatsapp-lancamentos',
    api: '/api/admin/barbearia/whatsapp-conexao-lancamentos',
    icon: Smartphone,
    tone: 'launches',
  },
]

const STATE_LABELS = {
  open: 'Conectado',
  qr: 'Aguardando QR',
  connecting: 'Conectando',
  close: 'Desconectado',
  unknown: 'Sem informação',
}

function normalizeId(value) {
  return String(value || '')
}

function channelState(connection) {
  if (!connection) return { label: 'Não consultado', tone: 'neutral', score: 0 }
  if (connection.state === 'open') return { label: 'Conectado', tone: 'success', score: 3 }
  if (connection.state === 'qr' || connection.state === 'connecting') return { label: STATE_LABELS[connection.state] || 'Conectando', tone: 'warning', score: 2 }
  if (!connection.providerConfigured) return { label: 'Infraestrutura pendente', tone: 'danger', score: 0 }
  if (!connection.instance) return { label: 'Sessão não atribuída', tone: 'danger', score: 1 }
  return { label: STATE_LABELS[connection.state] || 'Desconectado', tone: 'warning', score: 1 }
}

function statusCopy(connection, error) {
  if (error) return 'Não foi possível consultar este canal agora.'
  if (!connection) return 'Selecione uma unidade para consultar.'
  if (!connection.providerConfigured) return 'O provedor ainda não está configurado no servidor.'
  if (!connection.instance) return 'A administração precisa atribuir uma instância exclusiva.'
  if (connection.state === 'open') return connection.phoneMasked ? `Linha confirmada: ${connection.phoneMasked}` : 'Sessão aberta; confirme a linha no canal.'
  if (connection.state === 'qr') return 'QR disponível no cadastro do canal.'
  if (connection.state === 'connecting') return 'Pareamento em andamento. Atualize após concluir no aparelho.'
  return connection.lastError ? `Último bloqueio: ${String(connection.lastError).replaceAll('_', ' ')}` : 'Abra o canal para gerar QR, código ou validar.'
}

function formatScope(company, store) {
  if (!company?.id || !store?.id) return 'Nenhuma unidade selecionada'
  return `${company.nome || company.razaoSocial || company.id} · ${store.nome || store.codigo || store.id}`
}

function safeLineIdentity(connection) {
  const raw = String(connection?.phoneMasked || connection?.phoneReference || '').trim()
  if (!raw) return 'Ainda não confirmada'
  if (/[•*…]/.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return 'Linha cadastrada'
  return `${digits.slice(0, 4)}•••••${digits.slice(-4)}`
}

export default function WhatsappControlCenter() {
  const {
    empresaAtiva,
    empresasAcessiveis,
    trocarEmpresa,
    lojaAtiva,
    lojasAcessiveis,
    trocarLoja,
    user,
  } = useAuth()
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastReadAt, setLastReadAt] = useState(null)
  const [error, setError] = useState('')
  const loadGeneration = useRef(0)

  const companies = useMemo(() => (Array.isArray(empresasAcessiveis) ? empresasAcessiveis : []).filter((item) => item?.id), [empresasAcessiveis])
  const stores = useMemo(() => (Array.isArray(lojasAcessiveis) ? lojasAcessiveis : []).filter((item) => item?.id && item.ativa !== false && (!empresaAtiva?.id || normalizeId(item.empresaId) === normalizeId(empresaAtiva.id))), [empresaAtiva?.id, lojasAcessiveis])
  const companyId = normalizeId(empresaAtiva?.id)
  const storeId = normalizeId(lojaAtiva?.id)
  const scopeHeaders = useMemo(() => ({ headers: { 'X-Empresa-Id': companyId, 'X-Loja-Id': storeId } }), [companyId, storeId])

  const loadChannels = useCallback(async (foreground = true) => {
    const generation = ++loadGeneration.current
    if (!companyId || !storeId) {
      setRows([])
      setLastReadAt(null)
      setError('Selecione uma empresa e uma unidade para carregar os canais.')
      setLoading(false)
      return
    }
    setRows([])
    setLastReadAt(null)
    setLoading(foreground)
    setError('')
    const results = await Promise.all(CHANNELS.map(async (channel) => {
      try {
        const data = await api.get(`${channel.api}?atualizar=1`, scopeHeaders)
        return { channel, connection: data.conexao || null, canManage: Boolean(data.podeGerenciar), error: null }
      } catch (requestError) {
        return { channel, connection: null, canManage: false, error: requestError }
      }
    }))
    if (generation !== loadGeneration.current) return
    setRows(results)
    setLastReadAt(new Date().toISOString())
    if (results.every((item) => item.error)) setError('Nenhum canal respondeu. Confirme a sessão e a unidade selecionada.')
    setLoading(false)
  }, [companyId, storeId, scopeHeaders])

  useEffect(() => {
    loadChannels(true)
    return () => { loadGeneration.current += 1 }
  }, [loadChannels])

  const connectedCount = rows.filter((item) => channelState(item.connection).tone === 'success').length
  const configuredCount = rows.filter((item) => item.connection?.providerConfigured && item.connection?.instance).length
  const averageReadiness = rows.length ? Math.round(rows.reduce((sum, item) => sum + channelState(item.connection).score, 0) / (rows.length * 3) * 100) : 0
  const activeCompany = empresaAtiva?.nome || empresaAtiva?.razaoSocial || empresaAtiva?.id || 'Empresa não selecionada'
  const activeStore = lojaAtiva?.nome || lojaAtiva?.codigo || lojaAtiva?.id || 'Unidade não selecionada'
  const isPlatformAdmin = user?.platformAdmin === true

  function selectCompany(event) {
    const next = event.target.value
    if (next && next !== companyId) trocarEmpresa?.(next)
  }

  function selectStore(event) {
    trocarLoja?.(event.target.value)
  }

  function openChannel(channel) {
    if (!companyId || !storeId) {
      toast('Selecione a empresa e a unidade antes de abrir um canal.', 'error')
      return
    }
    window.location.assign(channel.route)
  }

  return <main className="dadm-page wcp-page">
    <header className="dadm-head wcp-head">
      <div>
        <div className="dadm-eyebrow">Administração · operação multicanal</div>
        <h1>Central de Conexões WhatsApp</h1>
        <p>Um painel para selecionar empresa e unidade, conferir os três canais e abrir o fluxo correto de QR, código, validação e ativação — sem misturar sessões.</p>
      </div>
      <div className="dadm-actions wcp-head-actions">
        <Link className="c360-btn ghost" to="/admin/whatsapp">Abrir Cliente</Link>
        <button type="button" className="c360-btn primary" onClick={() => loadChannels(true)} disabled={loading || !companyId || !storeId}>
          <RefreshCw size={15} className={loading ? 'wcp-spin' : ''} />
          {loading ? 'Atualizando…' : 'Verificar canais'}
        </button>
      </div>
    </header>

    <section className="wcp-hero" aria-label="Resumo da Central de Conexões">
      <div className="wcp-hero-copy">
        <span className="dadm-wa-badge">Plano de controle operacional</span>
        <h2>Conecte, valide e acompanhe cada número no lugar certo.</h2>
        <p>Cliente, Gestão e Lançamentos têm propósitos, permissões e sessões distintas. A central só consulta status; as ações de pareamento continuam nas telas específicas de cada canal.</p>
        <div className="wcp-hero-scope"><Store size={16} /> <span>Escopo atual: <strong>{formatScope(empresaAtiva, lojaAtiva)}</strong></span></div>
      </div>
      <div className="wcp-hero-visual" aria-hidden="true"><MessageSquare size={34} /><ShieldCheck size={19} /></div>
    </section>

    <section className="wcp-scope-card dadm-card" aria-labelledby="wcp-scope-title">
      <div className="c360-card-head"><div><span className="dadm-eyebrow">Passo 1</span><h2 id="wcp-scope-title">Escolha o contexto da operação</h2></div><span className="wcp-security-pill"><ShieldCheck size={14} /> Escopo isolado</span></div>
      <p className="dadm-muted">Todos os status, QR Codes, grupos e números abaixo pertencem somente à empresa e à unidade selecionadas.</p>
      <div className="wcp-scope-grid">
        <label className="c360-field" htmlFor="wcp-company"><span><Users size={14} /> Empresa</span>
          <select id="wcp-company" className="c360-input" value={companyId} onChange={selectCompany} disabled={!companies.length}>
            <option value="">Selecione uma empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.nome || company.razaoSocial || company.id}</option>)}
          </select>
        </label>
        <label className="c360-field" htmlFor="wcp-store"><span><Store size={14} /> Unidade</span>
          <select id="wcp-store" className="c360-input" value={storeId} onChange={selectStore} disabled={!companyId || !stores.length}>
            <option value="">Selecione uma unidade</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.nome || store.codigo || store.id}</option>)}
          </select>
        </label>
      </div>
      {!companies.length && <p className="dadm-note danger" role="alert">Nenhuma empresa autorizada foi carregada nesta sessão.</p>}
      {companies.length > 0 && !companyId && <p className="dadm-note warn" role="status">Selecione uma empresa para liberar o mapa de conexões.</p>}
      {companyId && !storeId && <p className="dadm-note warn" role="status">Selecione uma unidade para consultar QR, status e validações.</p>}
      {companyId && storeId && <p className="dadm-note" role="status">Operando em <strong>{activeCompany}</strong> · <strong>{activeStore}</strong>{isPlatformAdmin ? ' · administração da plataforma' : ''}.</p>}
    </section>

    <section className="wcp-kpis" aria-label="Indicadores da conexão">
      <article className="wcp-kpi"><span><Activity size={17} /> Canais conectados</span><strong>{connectedCount}/3</strong><small>sessões abertas no escopo</small></article>
      <article className="wcp-kpi"><span><CheckCircle2 size={17} /> Sessões atribuídas</span><strong>{configuredCount}/3</strong><small>instâncias exclusivas configuradas</small></article>
      <article className="wcp-kpi"><span><ShieldCheck size={17} /> Prontidão média</span><strong>{averageReadiness}%</strong><small>infraestrutura e pareamento</small></article>
      <article className="wcp-kpi"><span><Store size={17} /> Unidade ativa</span><strong className="wcp-kpi-text">{activeStore}</strong><small>{activeCompany}</small></article>
    </section>

    <section className="wcp-channel-section" aria-labelledby="wcp-channels-title" aria-busy={loading}>
      <div className="wcp-section-heading"><div><span className="dadm-eyebrow">Passo 2</span><h2 id="wcp-channels-title">Mapa dos canais</h2><p>Abra um canal para gerar QR, solicitar código, confirmar pareamento, salvar grupo Admin e ativar o fluxo correspondente.</p></div><span className="wcp-last-read">{lastReadAt ? `Última leitura: ${dateTime(lastReadAt)}` : 'Aguardando leitura'}</span></div>
      {error && <p className="dadm-note warn" role="status"><CircleAlert size={16} /> {error}</p>}
      {loading && <p className="dadm-note" role="status"><RefreshCw size={16} className="wcp-spin" /> Consultando os três canais no escopo selecionado…</p>}
      <div className="wcp-channel-grid">
        {(rows.length ? rows : CHANNELS.map((channel) => ({ channel, connection: null, error: null, canManage: false }))).map(({ channel, connection, error: channelError }) => {
          const Icon = channel.icon
          const state = channelState(connection)
          return <article className={`wcp-channel-card is-${state.tone}`} key={channel.key}>
            <div className="wcp-channel-top"><span className={`wcp-channel-icon is-${channel.tone}`}><Icon size={21} /></span><span className={`wcp-status-pill is-${state.tone}`}>{state.label}</span></div>
            <div><h3>{channel.label}</h3><p>{channel.description}</p></div>
            <div className="wcp-channel-detail"><span>Instância</span><strong>{connection?.instance || 'Não atribuída'}</strong></div>
            <div className="wcp-channel-detail"><span>Identidade da linha</span><strong>{safeLineIdentity(connection)}</strong></div>
            <p className="wcp-channel-copy">{statusCopy(connection, channelError)}</p>
            <div className="wcp-channel-actions">
              <button type="button" className="c360-btn primary" onClick={() => openChannel(channel)} disabled={!companyId || !storeId}><ExternalLink size={14} /> Abrir configuração</button>
              <Link className="c360-btn ghost" to={companyId && storeId ? channel.route : '#'} onClick={(event) => { if (!companyId || !storeId) { event.preventDefault(); toast('Selecione a empresa e a unidade primeiro.', 'error') } }}>QR e validação <ArrowRight size={14} /></Link>
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="wcp-flow-grid">
      <article className="dadm-card wcp-flow-card"><div className="wcp-flow-number">1</div><div><h3>Selecionar</h3><p>Escolha empresa e unidade. O painel troca o contexto antes de consultar qualquer sessão.</p></div></article>
      <article className="dadm-card wcp-flow-card"><div className="wcp-flow-number">2</div><div><h3>Conectar</h3><p>Abra o canal correto, gere QR ou código e confirme a linha no aparelho responsável.</p></div></article>
      <article className="dadm-card wcp-flow-card"><div className="wcp-flow-number">3</div><div><h3>Validar</h3><p>Confira diagnóstico, grupo Admin, webhook e prontidão antes de ativar o atendente.</p></div></article>
    </section>

    <section className="wcp-safety dadm-wa-policy" aria-label="Regras de segurança">
      <ShieldCheck size={20} aria-hidden="true" />
      <div><strong>Regras que não podem ser quebradas</strong><p>Uma instância física não pode pertencer a duas empresas ou canais. O Cliente não compartilha sessão com Gestão ou Lançamentos. Lançamentos não paga, transfere, altera estoque nem marca despesas como pagas. QR e credenciais permanecem no servidor e nunca aparecem nesta visão agregada.</p></div>
    </section>
  </main>
}
