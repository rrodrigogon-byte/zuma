import React, { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WhatsappControlCenter from './WhatsappControlCenter'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))
const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }))
const toastMock = vi.hoisted(() => ({ useToast: vi.fn(() => ({ toast: vi.fn() })) }))

vi.mock('../../../lib/api', () => ({ api: apiMock }))
vi.mock('../../../lib/auth', () => authMock)
vi.mock('../../../hooks/useToast', () => toastMock)
vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }) => createElement('a', props, children),
}))

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function connection(instance, state = 'open') {
  return {
    instance,
    state,
    providerConfigured: true,
    phoneMasked: '',
    phoneReference: '',
  }
}

function response(instancePrefix) {
  return { conexao: connection(`${instancePrefix}-cliente`), podeGerenciar: true }
}

function textOf(renderer) {
  const walk = node => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(walk).join(' ')
    return `${walk(node.children)} `
  }
  return walk(renderer.toJSON())
}

async function tick() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  globalThis.window = { location: { assign: vi.fn() } }
  globalThis.document = { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() }
  authMock.useAuth.mockReturnValue({
    empresaAtiva: { id: 'empresa-a', nome: 'Empresa A' },
    empresasAcessiveis: [{ id: 'empresa-a', nome: 'Empresa A' }, { id: 'empresa-b', nome: 'Empresa B' }],
    trocarEmpresa: vi.fn(),
    lojaAtiva: { id: 'loja-a', nome: 'Unidade A' },
    lojasAcessiveis: [{ id: 'loja-a', empresaId: 'empresa-a', nome: 'Unidade A' }],
    trocarLoja: vi.fn(),
    user: { platformAdmin: true },
  })
  apiMock.get.mockResolvedValue({ conexao: connection('default'), podeGerenciar: true })
})

afterEach(() => {
  vi.clearAllMocks()
  delete globalThis.window
  delete globalThis.document
})

describe('WhatsappControlCenter', () => {
  it('mostra loading explícito enquanto consulta o escopo selecionado', async () => {
    const pending = deferred()
    apiMock.get.mockReturnValue(pending.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappControlCenter />) })

    const section = renderer.root.findByProps({ 'aria-labelledby': 'wcp-channels-title' })
    expect(section.props['aria-busy']).toBe(true)
    expect(textOf(renderer)).toContain('Consultando os três canais no escopo selecionado')
    expect(apiMock.get).toHaveBeenCalledTimes(3)

    pending.resolve({ conexao: connection('empresa-a-cliente'), podeGerenciar: true })
    await tick()
    expect(section.props['aria-busy']).toBe(false)
    expect(textOf(renderer)).toContain('empresa-a-cliente')
    await act(async () => { renderer.unmount() })
  })

  it('mascara telefone bruto mesmo quando a API retorna a referência sem máscara', async () => {
    apiMock.get.mockResolvedValue({
      conexao: { ...connection('stallone-1'), phoneMasked: '', phoneReference: '5565996765768' },
      podeGerenciar: true,
    })
    let renderer
    await act(async () => { renderer = create(<WhatsappControlCenter />) })
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('5565•••••5768')
    expect(html).not.toContain('5565996765768')
    await act(async () => { renderer.unmount() })
  })

  it('ignora respostas antigas quando a empresa muda durante a consulta', async () => {
    const first = [deferred(), deferred(), deferred()]
    const second = [deferred(), deferred(), deferred()]
    let call = 0
    apiMock.get.mockImplementation(() => {
      const batch = call < 3 ? first : second
      const request = batch[call % 3]
      call += 1
      return request.promise
    })

    let context = authMock.useAuth()
    authMock.useAuth.mockImplementation(() => context)
    let renderer
    await act(async () => { renderer = create(<WhatsappControlCenter />) })
    await tick()
    expect(apiMock.get).toHaveBeenCalledTimes(3)

    context = {
      ...context,
      empresaAtiva: { id: 'empresa-b', nome: 'Empresa B' },
      lojaAtiva: { id: 'loja-b', nome: 'Unidade B' },
      lojasAcessiveis: [{ id: 'loja-b', empresaId: 'empresa-b', nome: 'Unidade B' }],
    }
    await act(async () => { renderer.update(<WhatsappControlCenter />) })
    await tick()
    expect(apiMock.get).toHaveBeenCalledTimes(6)

    second.forEach(item => item.resolve(response('empresa-b')))
    await tick()
    expect(textOf(renderer)).toContain('empresa-b-cliente')

    first.forEach(item => item.resolve(response('empresa-a')))
    await tick()
    const html = textOf(renderer)
    expect(html).toContain('empresa-b-cliente')
    expect(html).not.toContain('empresa-a-cliente')
    await act(async () => { renderer.unmount() })
  })
})
