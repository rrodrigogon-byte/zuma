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
vi.mock('react-router-dom', () => ({ Link: ({ children, ...props }) => createElement('a', props, children) }))

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
