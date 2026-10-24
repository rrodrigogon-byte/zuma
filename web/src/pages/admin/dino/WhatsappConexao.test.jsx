import React, { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WhatsappConexao from './WhatsappConexao'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }))
const toastMock = vi.hoisted(() => ({ useToast: vi.fn(() => ({ toast: vi.fn() })) }))

vi.mock('../../../lib/api', () => ({ api: apiMock }))
vi.mock('../../../lib/auth', () => authMock)
vi.mock('../../../hooks/useToast', () => toastMock)
vi.mock('../../../lib/brand', () => ({ brandFromContext: () => 'dino' }))
vi.mock('../../../lib/whatsapp-webhook-secret', () => ({
  channelStatusPayload: () => ({}),
  webhookSecretEnvFor: () => 'WHATSAPP_AI_WEBHOOK_SECRET',
}))
vi.mock('../customer360/shared', () => ({ Dialog: ({ children }) => createElement('div', null, children) }))
vi.mock('react-router-dom', () => ({ Link: ({ children, ...props }) => createElement('a', props, children), useLocation: () => ({ pathname: globalThis.window?.location?.pathname || '/admin/whatsapp' }) }))

const connection = {
  state: 'open', providerConfigured: true, provider: 'chatbot_backend', providerLabel: 'Backend', instance: 'dino',
  phoneMasked: '5565•••••1234', phoneNumber: '', phoneReference: '', autoReconnect: true, ativo: true,
  lastCheckAt: null, lastConnectedAt: null, history: [], saida: { modo: 'off' },
}

function operational(channel = null, overrides = {}) {
  return {
    featureEnabled: true,
    gemini: { configured: false, model: 'not-rendered' },
    channel,
    sessions: {},
    humanQueue: { unassigned: 0 },
    tasks: {},
    deliveries: {},
    provider24h: { total: 0, success: 0, failed: 0, avgLatencyMs: 0, toolCalls: 0 },
    worker: { active: true, leaseExpiresAt: null, lastHeartbeatAt: null },
    ...overrides,
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function httpError(status, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status })
}

function textOf(renderer) {
  return JSON.stringify(renderer.toJSON())
}

async function tick() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function unmount(renderer) {
  await act(async () => { renderer.unmount() })
}

function installDocument(visibilityState = 'visible') {
  const listeners = new Map()
  globalThis.document = {
    visibilityState,
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    removeEventListener: vi.fn((name, handler) => { if (listeners.get(name) === handler) listeners.delete(name) }),
  }
  return { emit: (name) => listeners.get(name)?.() }
}

beforeEach(() => {
  globalThis.window = { location: { origin: 'https://painel.test' }, confirm: vi.fn(() => true) }
  installDocument()
  authMock.useAuth.mockReturnValue({ empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' }, lojaAtiva: { id: 'loja-a', nome: 'Unidade A' }, user: {} })
  apiMock.get.mockImplementation((path) => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
    ? Promise.resolve({ conexao: connection, podeGerenciar: false })
    : Promise.resolve(operational()))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  delete globalThis.document
  delete globalThis.window
})

describe('WhatsappConexao · saúde operacional IA', () => {
  it('renderiza a seção e envia contexto explícito empresa/unidade sem expor campos fora da allowlist', async () => {
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Saúde e pendências da IA')
    expect(html).toContain('Worker compartilhado')
    expect(html).toContain('sem execuções')
    const health = renderer.root.findByProps({ 'aria-labelledby': 'wa-ai-health' })
    expect(JSON.stringify(health.findByType('h2').children)).toContain('Saúde e pendências da IA')
    const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join(' ')
    expect(text(health)).not.toContain('not-rendered')
    expect(apiMock.post).not.toHaveBeenCalled()
    expect(apiMock.put).not.toHaveBeenCalled()
    const statusCall = apiMock.get.mock.calls.find(([path]) => path === '/api/admin/commerce/whatsapp-ai/status')
    expect(statusCall).toBeDefined()
    expect(statusCall[1]).toEqual({ headers: { 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-a' } })
    await unmount(renderer)
  })

  it('exibe o link copiável de cadastro para a empresa ativa sem alterar a conexão', async () => {
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Cadastrar o número WhatsApp')
    expect(html).toContain('Disponível para todas as empresas')
    expect(html).toContain('https://painel.test/admin/whatsapp')
    expect(html).toContain('Abrir cadastro')
    expect(apiMock.post).not.toHaveBeenCalled()
    expect(apiMock.put).not.toHaveBeenCalled()
    await unmount(renderer)
  })

  it('mostra p50/p95 válidos com denominador, janela e limitação ao provedor', async () => {
    apiMock.get.mockImplementation(path => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.resolve(operational(null, { provider24h: { total: 5, success: 5, failed: 0, avgLatencyMs: 700, toolCalls: 1, latency24h: { window: '24h', scope: 'unit', sampleSize: 4, p50Ms: 512.5, p95Ms: 1400.25 } } })))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('p50 512,5 ms · p95 1.400,25 ms')
    expect(html).toContain('4 durações positivas · janela 24 h · unidade atual')
    expect(html).toContain('não é latência ponta a ponta da conversa')
    await unmount(renderer)
  })

  it('não transforma zero amostras em latência zero nem expõe percentil malformado', async () => {
    apiMock.get.mockImplementation(path => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.resolve(operational(null, { provider24h: { total: 3, success: 3, failed: 0, avgLatencyMs: 0, toolCalls: 0, latency24h: { window: '24h', scope: 'unit', sampleSize: 0, p50Ms: null, p95Ms: null } } })))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    expect(textOf(renderer)).toContain('sem amostras válidas')
    expect(textOf(renderer)).toContain('0 durações positivas registradas; zero também pode ser ausência de medição')
    await unmount(renderer)

    apiMock.get.mockImplementation(path => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.resolve(operational(null, { provider24h: { total: 3, success: 3, failed: 0, avgLatencyMs: 500, toolCalls: 0, latency24h: { window: '24h', scope: 'unit', sampleSize: 2, p50Ms: 'not-a-number', p95Ms: 900 } } })))
    let malformedRenderer
    await act(async () => { malformedRenderer = create(<WhatsappConexao />) })
    await tick()
    const malformedText = textOf(malformedRenderer)
    expect(malformedText).toContain('Percentis indisponíveis nesta leitura')
    expect(malformedText).not.toContain('not-a-number')
    await unmount(malformedRenderer)
  })

  it('resume dead-letter como próximo passo e mantém detalhes recolhidos sem mutação', async () => {
    apiMock.get.mockImplementation(path => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.resolve(operational({ status: 'ativo', lastEventAt: new Date().toISOString(), lastSyncAt: null, aiCircuitOpen: false, aiConsecutiveFailures: 0 }, { tasks: { deadLetter: 1 } })))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const guidance = renderer.root.findByProps({ 'aria-label': 'Próximo passo operacional' })
    expect(JSON.stringify(guidance.findByType('strong').children)).toContain('dead-letter')
    const details = renderer.root.findByType('details')
    expect(details.props.open).toBeUndefined()
    expect(details.findByType('summary').children.join('')).toContain('Ver orientações e limites')
    expect(apiMock.post).not.toHaveBeenCalled()
    expect(apiMock.put).not.toHaveBeenCalled()
    await unmount(renderer)
  })

  it('mantém atendimento humano sem responsável como prioridade sem atribuir automaticamente', async () => {
    apiMock.get.mockImplementation(path => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.resolve(operational(null, { humanQueue: { unassigned: 1 }, tasks: { deadLetter: 2 } })))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const guidance = renderer.root.findByProps({ 'aria-label': 'Próximo passo operacional' })
    expect(JSON.stringify(guidance.findByType('strong').children)).toContain('sem responsável')
    expect(textOf(renderer)).toContain('Sem ação automática')
    expect(apiMock.post).not.toHaveBeenCalled()
    await unmount(renderer)
  })

  it('mantém single-flight quando atualização manual coincide com polling/leitura em andamento', async () => {
    const pending = deferred()
    apiMock.get.mockImplementation((path) => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : pending.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const update = renderer.root.findAllByType('button').find((button) => button.props.children === 'Atualizar agora')
    await act(async () => { update.props.onClick() })
    expect(apiMock.get.mock.calls.filter(([path]) => path === '/api/admin/commerce/whatsapp-ai/status')).toHaveLength(1)
    pending.resolve(operational())
    await tick()
    await unmount(renderer)
  })

  it('troca somente a unidade e ignora resposta operacional antiga', async () => {
    const first = deferred()
    const second = deferred()
    let context = { empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' }, lojaAtiva: { id: 'loja-a', nome: 'Unidade A' }, user: {} }
    authMock.useAuth.mockImplementation(() => context)
    let calls = 0
    apiMock.get.mockImplementation((path) => {
      if (path.startsWith('/api/admin/barbearia/whatsapp-conexao')) return Promise.resolve({ conexao: connection, podeGerenciar: false })
      calls += 1
      return calls === 1 ? first.promise : second.promise
    })
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    context = { empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' }, lojaAtiva: { id: 'loja-b', nome: 'Unidade B' }, user: {} }
    await act(async () => { renderer.update(<WhatsappConexao />) })
    second.resolve(operational({ status: 'ativo', lastEventAt: null, lastSyncAt: null }))
    await tick()
    first.resolve(operational({ status: 'rascunho', lastEventAt: null, lastSyncAt: null }))
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Empresa A')
    expect(html).toContain('Ativo')
    expect(html).not.toContain('CANARY')
    const statusCalls = apiMock.get.mock.calls.filter(([path]) => path === '/api/admin/commerce/whatsapp-ai/status')
    expect(statusCalls[1][1]).toEqual({ headers: { 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-b' } })
    await unmount(renderer)
  })

  it('mostra mensagem visível e não quebra quando o status IA responde 403', async () => {
    apiMock.get.mockImplementation((path) => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.reject(httpError(403, 'Acesso negado')))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Não verificável por permissão')
    expect(html).toContain('Saúde e pendências da IA')
    await unmount(renderer)
  })

  it('mostra mensagem visível e não quebra quando o status IA responde 503', async () => {
    apiMock.get.mockImplementation((path) => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.resolve({ conexao: connection, podeGerenciar: false })
      : Promise.reject(httpError(503, 'Serviço indisponível')))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    expect(textOf(renderer)).toContain('Indisponível agora')
    await unmount(renderer)
  })

  it('mostra contexto ausente e não chama o endpoint operacional', async () => {
    authMock.useAuth.mockReturnValue({ empresaAtiva: null, lojaAtiva: null, user: {} })
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('selecione uma empresa e uma unidade autorizadas')
    expect(apiMock.get.mock.calls.filter(([path]) => path === '/api/admin/commerce/whatsapp-ai/status')).toHaveLength(0)
    await unmount(renderer)
  })

  it('oferece empresa e unidade no próprio fluxo quando o contexto ainda não foi selecionado', async () => {
    const trocarEmpresa = vi.fn()
    const trocarLoja = vi.fn()
    authMock.useAuth.mockReturnValue({
      empresaAtiva: null,
      empresasAcessiveis: [{ id: 'empresa-a', nome: 'Empresa A' }, { id: 'empresa-b', nome: 'Empresa B' }],
      trocarEmpresa,
      lojaAtiva: null,
      lojasAcessiveis: [{ id: 'loja-a', empresaId: 'empresa-a', nome: 'Unidade A' }],
      trocarLoja,
      user: {},
    })
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Empresa e unidade do canal')
    expect(html).toContain('Selecione uma empresa para liberar o cadastro deste canal.')
    const empresa = renderer.root.findByProps({ id: 'whatsapp-empresa-ativa' })
    await act(async () => { empresa.props.onChange({ target: { value: 'empresa-a' } }) })
    expect(trocarEmpresa).toHaveBeenCalledWith('empresa-a')
    const loja = renderer.root.findByProps({ id: 'whatsapp-loja-ativa' })
    await act(async () => { loja.props.onChange({ target: { value: 'loja-a' } }) })
    expect(trocarLoja).toHaveBeenCalledWith('loja-a')
    await unmount(renderer)
  })

  it('mantém a seção operacional disponível quando o endpoint legado de conexão falha', async () => {
    apiMock.get.mockImplementation((path) => path.startsWith('/api/admin/barbearia/whatsapp-conexao')
      ? Promise.reject(new Error('backend legado indisponível'))
      : Promise.resolve(operational()))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('Saúde e pendências da IA')
    expect(html).toContain('backend legado indisponível')
    await unmount(renderer)
  })

  it('pausa polling oculto e retoma ao reaparecer', async () => {
    vi.useFakeTimers()
    const visibility = installDocument()
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    apiMock.get.mockClear()
    globalThis.document.visibilityState = 'hidden'
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(apiMock.get).not.toHaveBeenCalled()
    globalThis.document.visibilityState = 'visible'
    await act(async () => { visibility.emit('visibilitychange'); await Promise.resolve(); await Promise.resolve() })
    expect(apiMock.get.mock.calls.some(([path]) => path === '/api/admin/barbearia/whatsapp-conexao?atualizar=1')).toBe(true)
    expect(apiMock.get.mock.calls.some(([path]) => path === '/api/admin/commerce/whatsapp-ai/status')).toBe(true)
    await unmount(renderer)
  })
})

it('usa rota e link exclusivos no canal Lançamentos', async () => {
  globalThis.window.location.pathname = '/admin/whatsapp-lancamentos'
  let renderer
  await act(async () => { renderer = create(<WhatsappConexao />) })
  await tick()
  const html = textOf(renderer)
  expect(html).toContain('Lançamentos')
  expect(html).toContain('https://painel.test/admin/whatsapp-lancamentos')
  expect(apiMock.get.mock.calls.some(([path]) => path === '/api/admin/barbearia/whatsapp-conexao-lancamentos?atualizar=1')).toBe(true)
  expect(apiMock.get.mock.calls.some(([path]) => path === '/api/admin/commerce/whatsapp-ai/status?canal=lancamentos')).toBe(true)
  await unmount(renderer)
})

function setupInternal(profile, options = {}) {
 globalThis.window.location.pathname = `/admin/whatsapp-${profile}`
 const internal = { ...connection, provider: 'waha', providerLabel: 'WAHA privado', providerConfigured: true, state: 'open', instance: `private-${profile}`, phoneMasked: '', saida: { modo: 'on' }, ...options.connection }
 const diag = { tipoCanal: profile, transporte: 'waha', agora: new Date().toISOString(), readiness: { controlConfigured: true, sessionAssigned: true, sessionConnected: true, channelConfigured: true, groupConfigured: true, webhookSecretConfigured: true, hmacSecretConfigured: true, ...options.readiness }, conclusoes: [] }
 apiMock.get.mockImplementation(path => path.endsWith('/diagnostico') ? Promise.resolve(diag)
   : path.startsWith('/api/admin/barbearia/whatsapp-conexao') ? Promise.resolve({ conexao: internal, podeGerenciar: true })
   : Promise.resolve(operational({ status: options.status || 'rascunho', lastEventAt: null, lastSyncAt: null, wahaGroupId: '555555@g.us' }, { gemini: { configured: true } })))
 return diag
}

it('envio Clientes liberado não libera teste nem ativação quando WAHA não está pronto', async () => {
 setupInternal('gestao', { connection: { providerConfigured: false } })
 let renderer
 await act(async () => { renderer = create(<WhatsappConexao />) }); await tick()
 expect(textOf(renderer)).toContain('Controle privado WAHA não configurado')
 expect(textOf(renderer)).not.toContain('Piloto ligado')
 const activate = renderer.root.findAllByType('button').find(b => b.props.children === 'Ativar atendente')
 expect(activate.props.disabled).toBe(true)
 await act(async () => { activate.props.onClick() })
 expect(apiMock.post).not.toHaveBeenCalled()
 expect(apiMock.put).not.toHaveBeenCalled()
 await unmount(renderer)
})

it('grupo desconhecido bloqueia ativação e texto não pede número pessoal no canal interno', async () => {
 setupInternal('lancamentos', { readiness: { groupConfigured: null } })
 let renderer
 await act(async () => { renderer = create(<WhatsappConexao />) }); await tick()
 expect(textOf(renderer)).toContain('Grupo Admin exclusivo não confirmado')
 expect(textOf(renderer)).not.toContain('Número de referência (opcional; não verificado)')
 expect(textOf(renderer)).toContain('sem pagar, transferir ou dar baixa')
 expect(renderer.root.findAllByType('button').find(b => b.props.children === 'Ativar atendente').props.disabled).toBe(true)
 await unmount(renderer)
})

it('pré-requisitos completos liberam somente confirmação explícita do perfil correto, sem envio automático', async () => {
 setupInternal('gestao')
 let renderer
 await act(async () => { renderer = create(<WhatsappConexao />) }); await tick()
 expect(renderer.root.findAllByType('button').find(b => b.props.children === 'Ativar atendente').props.disabled).toBe(false)
 expect(textOf(renderer)).toContain('Pronto para ativar o atendente deste perfil')
 expect(apiMock.post).not.toHaveBeenCalled(); expect(apiMock.put).not.toHaveBeenCalled()
 for (const [, opts] of apiMock.get.mock.calls) expect(opts).toEqual({ headers: { 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-a' } })
 await unmount(renderer)
})

it('troca entre perfis limpa diagnósticos e não aceita a resposta antiga de Gestão em Lançamentos', async () => {
 const oldDiagnostic = deferred()
 setupInternal('gestao')
 const previous = apiMock.get.getMockImplementation()
 apiMock.get.mockImplementation(path => path.endsWith('-gestao/diagnostico') ? oldDiagnostic.promise : previous(path))
 let renderer
 await act(async () => { renderer = create(<WhatsappConexao />) }); await tick()
 setupInternal('lancamentos', { connection: { providerConfigured: false } })
 await act(async () => { renderer.update(<WhatsappConexao />) }); await tick()
 oldDiagnostic.resolve({ tipoCanal: 'gestao', transporte: 'waha', agora: new Date().toISOString(), conclusoes: [{ titulo: 'DIAGNOSTIC_OLD_CANARY', ok: true }] }); await tick()
 expect(textOf(renderer)).not.toContain('DIAGNOSTIC_OLD_CANARY')
 expect(textOf(renderer)).toContain('Lançamentos')
 expect(apiMock.get.mock.calls.some(([path]) => path.endsWith('-lancamentos/diagnostico'))).toBe(true)
 await unmount(renderer)
})

it('exibe cadastro de número e solicita código de pareamento para canal interno', async () => {
 setupInternal('lancamentos', { connection: { state: 'qr', phoneReference: '' } })
 apiMock.post.mockImplementation((path) => path.endsWith('/codigo-pareamento')
   ? Promise.resolve({ pairingCode: '1234-5678', conexao: { ...connection, provider: 'waha', providerLabel: 'WAHA privado', providerConfigured: true, state: 'connecting', instance: 'private-lancamentos', phoneReference: '5511999999999' } })
   : Promise.resolve({}))
 let renderer
 await act(async () => { renderer = create(<WhatsappConexao />) }); await tick()
 expect(textOf(renderer)).toContain('Cadastrar número do aparelho')
 expect(textOf(renderer)).toContain('Gerar código de pareamento')
 const input = renderer.root.findByProps({ id: 'wa-number-reference' })
 await act(async () => { input.props.onChange({ target: { value: '+55 (11) 99999-9999' } }) })
 const pairing = renderer.root.findAllByType('button').find(b => b.props.children === 'Gerar código de pareamento')
 await act(async () => { pairing.props.onClick() }); await tick()
 expect(apiMock.post).toHaveBeenCalledWith('/api/admin/barbearia/whatsapp-conexao-lancamentos/codigo-pareamento', { phoneNumber: '+55 (11) 99999-9999' }, { headers: { 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-a' } })
 expect(textOf(renderer)).toContain('1234-5678')
 await unmount(renderer)
})

describe('WhatsappConexao · unidade da empresa ativa', () => {
  it('lista a unidade vinculada pelo alias Commerce da empresa', async () => {
    authMock.useAuth.mockReturnValue({
      empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' },
      empresasAcessiveis: [{ id: 'empresa-a', nome: 'Empresa A' }],
      trocarEmpresa: vi.fn(),
      lojaAtiva: null,
      lojasAcessiveis: [{ id: 'loja-a', commerceEmpresaId: 'empresa-a', nome: 'Unidade A' }, { id: 'loja-b', empresaId: 'empresa-b', nome: 'Unidade B' }],
      trocarLoja: vi.fn(),
      atualizarContextoLojas: vi.fn(),
      user: {},
    })
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    const loja = renderer.root.findByProps({ id: 'whatsapp-loja-ativa' })
    expect(loja.props.disabled).toBe(false)
    const valores = loja.findAllByType('option').map((option) => option.props.value)
    expect(valores).toContain('loja-a')
    expect(valores).not.toContain('loja-b')
    await unmount(renderer)
  })

  it('relê o contexto autorizado no servidor quando a unidade perdeu o vínculo com a empresa', async () => {
    const atualizarContextoLojas = vi.fn()
    authMock.useAuth.mockReturnValue({
      empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' },
      empresasAcessiveis: [{ id: 'empresa-a', nome: 'Empresa A' }],
      trocarEmpresa: vi.fn(),
      lojaAtiva: null,
      lojasAcessiveis: [{ id: 'loja-a', nome: 'Unidade A' }],
      trocarLoja: vi.fn(),
      atualizarContextoLojas,
      user: {},
    })
    apiMock.get.mockImplementation((path) => path === '/api/admin/commerce-session'
      ? Promise.resolve({ empresas_acessiveis: [{ id: 'empresa-a', nome: 'Empresa A' }], lojas_acessiveis: [{ id: 'loja-a', empresaId: 'empresa-a', nome: 'Unidade A' }] })
      : Promise.resolve(operational()))
    let renderer
    await act(async () => { renderer = create(<WhatsappConexao />) })
    await tick()
    expect(apiMock.get).toHaveBeenCalledWith('/api/admin/commerce-session')
    expect(atualizarContextoLojas).toHaveBeenCalledTimes(1)
    const [payload] = atualizarContextoLojas.mock.calls[0]
    expect(payload.lojas_acessiveis).toEqual([expect.objectContaining({ id: 'loja-a', empresaId: 'empresa-a' })])
    expect(payload.empresas_acessiveis).toHaveLength(1)
    await unmount(renderer)
  })
})
