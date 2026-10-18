import React, { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

const authMock = vi.hoisted(() => {
  // ambiente node: o Sidebar só lê largura da janela e preferências do navegador
  globalThis.window = { innerWidth: 1280, addEventListener() {}, removeEventListener() {}, location: { pathname: '/admin' }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  globalThis.document = globalThis.document || { documentElement: { dataset: {}, setAttribute() {}, removeAttribute() {}, style: { setProperty() {} } }, addEventListener() {}, removeEventListener() {} }
  return { useAuth: vi.fn() }
})
vi.mock('../lib/auth', () => authMock)
vi.mock('../lib/api', () => ({ api: { get: vi.fn(async () => ({})) } }))
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to, style, ...props }) => createElement('a', { ...props, href: to }, typeof children === 'function' ? children({ isActive: false }) : children),
  useLocation: () => ({ pathname: '/admin', search: '' }),
  useNavigate: () => vi.fn(),
}))

function render(empresa) {
  authMock.useAuth.mockReturnValue({
    user: { nome: 'Rodrigo', role: 'admin' }, logout: vi.fn(), isOrg: true, isStaff: true, isAtleta: false, isPlatformAdmin: true,
    empresaAtiva: empresa, empresasAcessiveis: [empresa], lojaAtiva: null, lojasAcessiveis: [], trocarEmpresa: vi.fn(), trocarLoja: vi.fn(),
  })
  let tree
  act(() => { tree = create(createElement(Sidebar)) })
  const textos = []
  const links = tree.root.findAll((n) => n.type === 'a').map((a) => a.props.href)
  tree.root.findAll((n) => typeof n.type === 'string').forEach((n) => n.children.forEach((c) => { if (typeof c === 'string') textos.push(c) }))
  return { links, textos }
}

describe('menu do clube (AGRO OPEN TTC)', () => {
  it('abre com recepção, sócios e aulas do Clube no topo e esconde varejo que não se aplica', () => {
    const { links, textos } = render({ id: 'ttc', nome: 'AGRO OPEN TTC' })
    expect(textos).toContain('Hoje no clube')
    expect(links).toContain('/admin/clube/recepcao')
    expect(links).toContain('/admin/clube/alunos')
    expect(links).not.toContain('/admin/supermercado')
    expect(links).not.toContain('/admin/oficina')
    expect(links).not.toContain('/loja-atendimento')
    // grupos fora do dia a dia começam recolhidos (menu curto)
    expect(links).not.toContain('/admin/mesas')
  })

  it('outras empresas seguem com o menu completo', () => {
    const { links } = render({ id: 'x', nome: 'Supermercado Bom Preço' })
    expect(links).toContain('/admin/supermercado')
  })
})
