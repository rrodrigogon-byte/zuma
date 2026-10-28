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

async function openQueue(renderer) {
    await tick()
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

describe('WhatsappHumanQueue', () => {
  it('é lazy: fechado não faz GET; abrir faz GET com filtros, headers e AbortSignal', async () => {
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    expect(apiMock.get).not.toHaveBeenCalled()
    await openQueue(renderer)
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    expect(apiMock.get.mock.calls[0][0]).toBe('/api/admin/commerce/whatsapp-ai/sessions?status=humano&assignment=unassigned&limit=100')
    expect(apiMock.get.mock.calls[0][1].headers).toEqual({ 'X-Empresa-Id': empresaA, 'X-Loja-Id': lojaA })
    expect(apiMock.get.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(textOf(renderer)).toContain('***9999')
    renderer.unmount()
  })

  it('filtro é explícito: troca não faz GET e Atualizar consulta Todos humanos', async () => {
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    const select = renderer.root.findByProps({ id: 'wa-human-queue-assignment' })
    await act(async () => { select.props.onChange({ target: { value: 'all' } }) })
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    await act(async () => { button(renderer, 'Atualizar fila').props.onClick() })
    await tick()
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    expect(apiMock.get.mock.calls[1][0]).toContain('assignment=all')
    renderer.unmount()
  })

  it('canClaim=false desabilita Assumir atendimento e não supõe permissionamento legado', async () => {
    apiMock.get.mockResolvedValue(response([item()], { canClaim: false }))
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    const claim = button(renderer, 'Assumir atendimento')
    expect(claim.props.disabled).toBe(true)
    expect(apiMock.post).not.toHaveBeenCalled()
    renderer.unmount()
  })

  it('403 e resposta malformada limpam dados e mostram mensagem segura sem raw error', async () => {
    apiMock.get.mockRejectedValueOnce(Object.assign(new Error('SECRET-403'), { status: 403 }))
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    expect(textOf(renderer)).toContain('Você não tem permissão')
    expect(textOf(renderer)).not.toContain('SECRET-403')
    apiMock.get.mockResolvedValueOnce({ items: [{ id: 'not-an-id' }], canClaim: true, selection: {} })
    await act(async () => { button(renderer, 'Atualizar fila').props.onClick() })
    await tick()
    expect(textOf(renderer)).toContain('A fila humana não pôde ser validada')
    expect(textOf(renderer)).not.toContain('not-an-id')
    renderer.unmount()
  })

  it('canary de PII nunca aparece no DOM; telefone bruto vira máscara e campos brutos são descartados', async () => {
    apiMock.get.mockResolvedValue(response([item(sessionA, { telefone: '5565999999999', nome: 'PII-CANARY', raw: 'RAW-CANARY', assigned_to: 'SECRET-CANARY' })]))
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    const html = textOf(renderer)
    expect(html).toContain('***9999')
    expect(html).not.toContain('5565999999999')
    expect(html).not.toContain('PII-CANARY')
    expect(html).not.toContain('SECRET-CANARY')
    renderer.unmount()
  })

  it('cancelar confirmação não faz POST; confirmar usa seleção canônica e bloqueia clique duplo', async () => {
    const pending = deferred()
    apiMock.post.mockReturnValue(pending.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    expect(textOf(renderer)).toContain('Empresa A')
    expect(textOf(renderer)).toContain('Unidade A')
    await act(async () => { button(renderer, 'Cancelar').props.onClick() })
    expect(apiMock.post).not.toHaveBeenCalled()
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    const dialog = renderer.root.findByProps({ role: 'dialog' })
    await act(async () => {
      dialog.props.onSubmit({ preventDefault: () => {} })
      dialog.props.onSubmit({ preventDefault: () => {} })
    })
    expect(apiMock.post).toHaveBeenCalledTimes(1)
    expect(apiMock.post.mock.calls[0][0]).toBe(`/api/admin/commerce/whatsapp-ai/sessions/${sessionA}/claim`)
    expect(apiMock.post.mock.calls[0][1]).toEqual({})
    expect(apiMock.post.mock.calls[0][2].headers).toEqual({ 'X-Empresa-Id': empresaA, 'X-Loja-Id': lojaCanonical })
    expect(apiMock.post.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal)
    pending.resolve({ id: sessionA, status: 'humano', assigned_to: 'raw-secret' })
    await tick()
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    expect(textOf(renderer)).toContain('Atendimento assumido')
    renderer.unmount()
  })

  it('resposta antiga é abortada e nunca renderizada após troca de contexto; unmount aborta GET', async () => {
    const first = deferred()
    const second = deferred()
    apiMock.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    const firstSignal = apiMock.get.mock.calls[0][1].signal
    await act(async () => { renderer.update(<WhatsappHumanQueue {...props({ empresaId: '66666666-6666-4666-8666-666666666666', lojaId: '77777777-7777-4777-8777-777777777777' })} standalone={true} />) })
    expect(firstSignal.aborted).toBe(true)
    const secondSignal = apiMock.get.mock.calls[1][1].signal
    second.resolve(response([item(sessionB, { telefone: '***8888' })], { selection: { empresaId: '66666666-6666-4666-8666-666666666666', requestedLojaId: '77777777-7777-4777-8777-777777777777', canonicalLojaId: lojaCanonical, inferred: false } }))
    await tick()
    first.resolve(response([item(sessionA, { telefone: '***CANARY' })]))
    await tick()
    expect(textOf(renderer)).toContain('***8888')
    expect(textOf(renderer)).not.toContain('CANARY')
    renderer.unmount()
    expect(secondSignal.aborted).toBe(false)
  })

  it('aborta uma leitura ainda pendente ao desmontar', async () => {
    const pending = deferred()
    apiMock.get.mockReturnValue(pending.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
        const signal = apiMock.get.mock.calls[0][1].signal
    await act(async () => { renderer.unmount() })
    expect(signal.aborted).toBe(true)
  })
})

describe('guards finais da fila humana', () => {
  it('conclusão do POST antigo não libera o lock nem altera a atribuição em outra empresa/unidade', async () => {
    const oldClaim = deferred(), newClaim = deferred(), onChanged = vi.fn()
    apiMock.post.mockReturnValueOnce(oldClaim.promise).mockReturnValueOnce(newClaim.promise)
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props({ onChanged })} standalone={true} />) })
    await openQueue(renderer)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
    const oldSignal = apiMock.post.mock.calls[0][2].signal
    const empresaB = '66666666-6666-4666-8666-666666666666', lojaB = '77777777-7777-4777-8777-777777777777'
    const bResponse = response([item(sessionB, { telefone: '***8888' })], { selection: { empresaId: empresaB, requestedLojaId: lojaB, canonicalLojaId: lojaCanonical, inferred: false } })
    apiMock.get.mockResolvedValue(bResponse)
    await act(async () => { renderer.update(<WhatsappHumanQueue {...props({ empresaId: empresaB, lojaId: lojaB, onChanged })} standalone={true} />) })
    await tick()
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
    expect(apiMock.post).toHaveBeenCalledTimes(2)
    oldClaim.resolve({ id: sessionA, status: 'humano' })
    await tick()
    const activeButton = button(renderer, 'Assumindo…')
    expect(activeButton.props.disabled).toBe(true)
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
    expect(apiMock.post).toHaveBeenCalledTimes(2)
    expect(onChanged).not.toHaveBeenCalled()
    newClaim.resolve({ id: sessionB, status: 'humano' })
    await tick()
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(textOf(renderer)).not.toContain('***9999')
    await act(async () => { renderer.unmount() })
  })

  it('timeout de atribuição descarta dados/permissão e não repete POST automaticamente', async () => {
    apiMock.post.mockRejectedValue(Object.assign(new Error('PRIVATE-TIMEOUT'), { status: 504 }))
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
    await tick()
    expect(textOf(renderer)).toContain('Atualize a fila antes de tentar novamente')
    expect(textOf(renderer)).not.toContain('PRIVATE-TIMEOUT')
    expect(button(renderer, 'Assumir atendimento')).toBeUndefined()
    expect(apiMock.post).toHaveBeenCalledTimes(1)
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    await act(async () => { button(renderer, 'Atualizar fila').props.onClick() })
    await tick()
    expect(apiMock.post).toHaveBeenCalledTimes(1)
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    await act(async () => { renderer.unmount() })
  })

  it('conflito atualiza só GET e informa que a atribuição não está mais disponível', async () => {
    apiMock.post.mockRejectedValue(Object.assign(new Error('PRIVATE-CONFLICT'), { status: 409 }))
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    apiMock.get.mockResolvedValue(response([]))
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
    await tick()
    expect(apiMock.post).toHaveBeenCalledTimes(1)
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    expect(textOf(renderer)).toContain('não está mais disponível')
    expect(textOf(renderer)).toContain('Nenhuma conversa nesta visão')
    expect(textOf(renderer)).not.toContain('PRIVATE-CONFLICT')
    await act(async () => { renderer.unmount() })
  })

  it('trocar filtro fecha diálogo e não apresenta um vazio como se a visão já tivesse sido consultada', async () => {
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    await act(async () => { renderer.root.findByProps({ id: 'wa-human-queue-assignment' }).props.onChange({ target: { value: 'all' } }) })
    expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0)
    expect(textOf(renderer)).not.toContain('Nenhuma conversa nesta visão')
    expect(apiMock.post).not.toHaveBeenCalled()
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    await act(async () => { renderer.unmount() })
  })

  it('nova leitura invalida imediatamente o diálogo antigo e sua permissão de confirmar', async () => {
    const pending = deferred()
    let renderer
    await act(async () => { renderer = create(<WhatsappHumanQueue {...props()} standalone={true} />) })
    await openQueue(renderer)
    await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
    apiMock.get.mockReturnValueOnce(pending.promise)
    await act(async () => { button(renderer, 'Atualizar fila').props.onClick() })
    expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0)
    expect(button(renderer, 'Assumir atendimento')).toBeUndefined()
    expect(apiMock.post).not.toHaveBeenCalled()
    pending.resolve(response([]))
    await tick()
    await act(async () => { renderer.unmount() })
  })
})

it('POST antigo concluído depois de fechar/reabrir não atualiza a nova leitura nem dispara callback', async () => {
  const pending = deferred(), onChanged = vi.fn()
  apiMock.post.mockReturnValue(pending.promise)
  let renderer
  await act(async () => { renderer = create(<WhatsappHumanQueue {...props({ onChanged })} standalone={true} />) })
  await openQueue(renderer)
  await act(async () => { button(renderer, 'Assumir atendimento').props.onClick() })
  await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onSubmit({ preventDefault() {} }) })
  const signal = apiMock.post.mock.calls[0][2].signal
  await act(async () => { button(renderer, 'Fechar fila').props.onClick() })
  await openQueue(renderer)
  expect(signal.aborted).toBe(true)
  expect(apiMock.get).toHaveBeenCalledTimes(2)
  pending.resolve({ id: sessionA, status: 'humano' })
  await tick()
  expect(apiMock.get).toHaveBeenCalledTimes(2)
  expect(onChanged).not.toHaveBeenCalled()
  expect(textOf(renderer)).not.toContain('Atendimento assumido')
  await act(async () => { renderer.unmount() })
})

it('envia o perfil Lançamentos na URL da fila humana', async () => {
  let renderer
  await act(async () => { renderer = create(<WhatsappHumanQueue {...props({ tipoCanal: 'lancamentos' })} standalone={true} />) })
  await openQueue(renderer)
  expect(apiMock.get.mock.calls[0][0]).toContain('&canal=lancamentos')
  renderer.unmount()
})
