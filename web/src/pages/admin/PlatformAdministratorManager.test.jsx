import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PlatformAdministratorManager, { administratorSearchPath, administratorStatusLabel } from './PlatformAdministratorManager'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../lib/api', () => ({ api: apiMock }))
vi.mock('../../lib/auth.jsx', () => authMock)

afterEach(() => {
  vi.clearAllMocks()
})

function textOf(node) {
  return node?.toJSON ? JSON.stringify(node.toJSON()) : ''
}

function findByProps(root, props) {
  return root.root.findAllByType('button').find(button => Object.entries(props).every(([key, value]) => button.props[key] === value))
}

describe('PlatformAdministratorManager', () => {
  it('keeps the global endpoint explicit and labels permanent status', () => {
    expect(administratorSearchPath('person+synthetic@example.invalid')).toBe('/api/admin/platform/administrators?query=person%2Bsynthetic%40example.invalid')
    expect(administratorStatusLabel({ ativo: true, expiresAt: null })).toBe('Ativo · sem vencimento')
    expect(administratorStatusLabel({ ativo: false, expiresAt: null })).toBe('Desativado')
  })

  it('does not render for a non-platform administrator and shows the permanent-scope caution for one', async () => {
    authMock.useAuth.mockReturnValue({ isPlatformAdmin: false })
    let hidden
    await act(async () => { hidden = create(<PlatformAdministratorManager />) })
    expect(hidden.toJSON()).toBeNull()
    hidden.unmount()

    authMock.useAuth.mockReturnValue({ isPlatformAdmin: true })
    apiMock.get.mockResolvedValue({ items: [] })
    let visible
    await act(async () => { visible = create(<PlatformAdministratorManager />) })
    const html = textOf(visible)
    expect(html).toContain('Administradores da plataforma')
    expect(html).toContain('Todas empresas e unidades atuais e futuras, sem vencimento')
    expect(html).toContain('senha e cadastro existentes preservados')
    expect(html).not.toContain('Senha inicial')
    visible.unmount()
  })

  it('only searches after submit and grants the selected sourceUserId with mandatory global confirmation', async () => {
    authMock.useAuth.mockReturnValue({ isPlatformAdmin: true })
    apiMock.get.mockImplementation(path => path.includes('?query=')
      ? Promise.resolve({ candidates: [{ sourceUserId: 'source-synthetic-1', nome: 'Pessoa Sintética', email: 'person.synthetic@example.invalid', empresaNome: 'Empresa Sintética' }], items: [] })
      : Promise.resolve({ items: [] }))
    apiMock.post.mockResolvedValue({ ok: true })
    let renderer
    await act(async () => { renderer = create(<PlatformAdministratorManager />) })

    const input = renderer.root.findByProps({ type: 'search' })
    await act(async () => { input.props.onChange({ target: { value: 'person.synthetic@example.invalid' } }) })
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    expect(apiMock.get).toHaveBeenCalledWith('/api/admin/platform/administrators')

    const form = renderer.root.findByType('form')
    await act(async () => { await form.props.onSubmit({ preventDefault: vi.fn() }) })
    expect(apiMock.get).toHaveBeenCalledWith('/api/admin/platform/administrators?query=person.synthetic%40example.invalid')

    const selectButton = findByProps(renderer, { 'aria-pressed': false })
    await act(async () => { selectButton.props.onClick() })
    const checkbox = renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox')
    expect(checkbox).toBeDefined()
    expect(renderer.root.findAllByType('button').some(button => button.props.children === 'Conceder administrador global' && button.props.disabled)).toBe(true)

    await act(async () => { checkbox.props.onChange({ target: { checked: true } }) })
    const grantButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Conceder administrador global')
    await act(async () => { await grantButton.props.onClick() })
    expect(apiMock.post).toHaveBeenCalledWith('/api/admin/platform/administrators', {
      sourceUserId: 'source-synthetic-1',
      confirmGlobal: true,
      expiresAt: null,
    })
    renderer.unmount()
  })

  it('requires the inline revoke confirmation and sends only confirmRevoke with accountId', async () => {
    authMock.useAuth.mockReturnValue({ isPlatformAdmin: true })
    apiMock.get.mockResolvedValue({ items: [{ accountId: 'account-synthetic-1', nome: 'Pessoa Sintética', email: 'person.synthetic@example.invalid', ativo: true, expiresAt: null }] })
    apiMock.post.mockResolvedValue({ ok: true })
    let renderer
    await act(async () => { renderer = create(<PlatformAdministratorManager />) })

    const revokeButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Revogar')
    await act(async () => { revokeButton.props.onClick() })
    expect(apiMock.post).not.toHaveBeenCalled()
    const confirmButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Confirmar revogação')
    expect(confirmButton).toBeDefined()
    await act(async () => { await confirmButton.props.onClick() })
    expect(apiMock.post).toHaveBeenCalledWith('/api/admin/platform/administrators/account-synthetic-1/revoke', { confirmRevoke: true })
    renderer.unmount()
  })
})
