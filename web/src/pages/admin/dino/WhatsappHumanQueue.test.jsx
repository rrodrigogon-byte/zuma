import React, { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WhatsappHumanQueue from './WhatsappHumanQueue'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../../../lib/api', () => ({ api: apiMock }))
vi.mock('../customer360/shared', () => ({
  Dialog: ({ open, title, labelId, onClose, onSubmit, children, actions }) => open ? createElement('form', { role: 'dialog', 'aria-labelledby': labelId, onSubmit, onClose }, [
    createElement('h2', { key: 'title', id: labelId }, title),
    children,
    actions,
  ]) : null,
}))

const empresaA = '11111111-1111-4111-8111-111111111111'
const lojaA = '22222222-2222-4222-8222-222222222222'
const lojaCanonical = '33333333-3333-4333-8333-333333333333'
const sessionA = '44444444-4444-4444-8444-444444444444'
const sessionB = '55555555-5555-4555-8555-555555555555'

function item(id = sessionA, overrides = {}) {
  return {
    id,
    telefone: '***9999',
    status: 'humano',
    assigned: false,
    isMine: false,
    assigned_at: null,
    handoff_requested_at: '2026-10-13T11:00:00.000Z',
    ultima_interacao_em: '2026-10-13T11:59:00.000Z',
    handoff_label: 'cliente pediu uma pessoa',
    priority: 1,
    ...overrides,
  }
}

function response(items = [item()], overrides = {}) {
  return {
    items,
    canClaim: true,
    selection: { empresaId: empresaA, requestedLojaId: lojaA, canonicalLojaId: lojaCanonical, inferred: false },
    ...overrides,
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function textOf(renderer) {
  const walk = (node) => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(walk).join(' ')
    return `${walk(node.children)} `
  }
  return walk(renderer.toJSON())
}

function button(renderer, label) {
  return renderer.root.findAllByType('button').find((node) => node.props.children === label)
}

async function tick() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}


function props(overrides = {}) {
  return { empresaId: empresaA, lojaId: lojaA, empresaNome: 'Empresa A', lojaNome: 'Unidade A', operatorLabel: 'Operador A', ...overrides }
}

beforeEach(() => {
  apiMock.get.mockResolvedValue(response())
  apiMock.post.mockResolvedValue({ id: sessionA, status: 'humano' })
})

afterEach(() => {
  vi.clearAllMocks()
})

async function montar(overrides = {}) {
  let renderer
  await act(async () => { renderer = create(createElement(WhatsappHumanQueue, props({ standalone: true, ...overrides }))) })
  await tick()
  return renderer
}

function cards(renderer) {
  return renderer.root.findAll((node) => node.type === 'article' && String(node.props.className || '').includes('wa-trex-card'))
}

describe('quadro de conversas do T-Rex', () => {
  it('abre consultando todas as conversas em andamento, com empresa e unidade nos headers', async () => {
    await montar()
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    const [url, options] = apiMock.get.mock.calls[0]
    expect(url).toContain('status=all')
    expect(url).toContain('assignment=all')
    expect(options.headers).toEqual({ 'X-Empresa-Id': empresaA, 'X-Loja-Id': lojaA })
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('conversa que o T-Rex não resolveu fica em vermelho e pede que o atendente assuma', async () => {
    apiMock.get.mockResolvedValue(response([
      item(sessionA, { precisa_atendente: true, nome: 'Carlos', ultima_mensagem_cliente: 'quero falar com alguém' }),
      item(sessionB, { status: 'ativo', handoff_requested_at: null, precisa_atendente: false, ultima_resposta_ia: 'Tenho 15h ou 16h' }),
    ]))
    const renderer = await montar()
    const [vermelho, verde] = cards(renderer)
    expect(vermelho.props.className).toContain('wa-trex-card--alerta')
    expect(textOf(renderer)).toContain('O atendente deve assumir esta conversa.')
    expect(textOf(renderer)).toContain('quero falar com alguém')
    expect(verde.props.className).toContain('wa-trex-card--ia')
    expect(textOf(renderer)).toContain('Em conversa com o T-Rex')
  })

  it('todo box tem Assumir conversa e Devolver ao T-Rex; devolver só vale para conversa com a equipe', async () => {
    apiMock.get.mockResolvedValue(response([
      item(sessionB, { status: 'ativo', handoff_requested_at: null, precisa_atendente: false }),
    ]))
    const renderer = await montar()
    expect(button(renderer, 'Assumir conversa').props.disabled).toBe(false)
    expect(button(renderer, 'Devolver ao T-Rex').props.disabled).toBe(true)
  })

  it('assumir uma conversa que está com o T-Rex confirma, faz POST e recarrega o quadro', async () => {
    apiMock.get.mockResolvedValue(response([item(sessionB, { status: 'ativo', handoff_requested_at: null })]))
    apiMock.post.mockResolvedValue({ id: sessionB, status: 'humano' })
    const renderer = await montar()
    await act(async () => { button(renderer, 'Assumir conversa').props.onClick() })
    const dialogo = renderer.root.findByProps({ role: 'dialog' })
    await act(async () => { await dialogo.props.onSubmit({ preventDefault() {} }) })
    await tick()
    expect(apiMock.post).toHaveBeenCalledTimes(1)
    expect(apiMock.post.mock.calls[0][0]).toBe(`/api/admin/commerce/whatsapp-ai/sessions/${sessionB}/claim`)
    expect(apiMock.post.mock.calls[0][2].headers).toEqual({ 'X-Empresa-Id': empresaA, 'X-Loja-Id': lojaCanonical })
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    expect(textOf(renderer)).toContain('O T-Rex parou de responder este contato')
  })

  it('devolver ao T-Rex chama release e avisa que a IA volta a responder', async () => {
    apiMock.get.mockResolvedValue(response([item(sessionA, { assigned: true, isMine: true })]))
    apiMock.post.mockResolvedValue({ id: sessionA, status: 'ativo' })
    const renderer = await montar()
    await act(async () => { await button(renderer, 'Devolver ao T-Rex').props.onClick() })
    await tick()
    expect(apiMock.post.mock.calls[0][0]).toBe(`/api/admin/commerce/whatsapp-ai/sessions/${sessionA}/release`)
    expect(textOf(renderer)).toContain('Conversa devolvida ao T-Rex')
  })

  it('sem permissão de atribuição os dois botões ficam desabilitados', async () => {
    apiMock.get.mockResolvedValue(response([item()], { canClaim: false }))
    const renderer = await montar()
    expect(button(renderer, 'Assumir conversa').props.disabled).toBe(true)
    expect(button(renderer, 'Devolver ao T-Rex').props.disabled).toBe(true)
  })

  it('telefone bruto nunca aparece: vira máscara com os 4 últimos dígitos', async () => {
    apiMock.get.mockResolvedValue(response([item(sessionA, { telefone: '5565999999999', nome: '' })]))
    const renderer = await montar()
    expect(textOf(renderer)).not.toContain('5565999999999')
    expect(textOf(renderer)).toContain('***9999')
  })

  it('erro 403 mostra mensagem segura sem dados', async () => {
    apiMock.get.mockRejectedValue(Object.assign(new Error('raw secret'), { status: 403 }))
    const renderer = await montar()
    expect(textOf(renderer)).toContain('Você não tem permissão para consultar a fila humana.')
    expect(textOf(renderer)).not.toContain('raw secret')
    expect(cards(renderer)).toHaveLength(0)
  })
})
