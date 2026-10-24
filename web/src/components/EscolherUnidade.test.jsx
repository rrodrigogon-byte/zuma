import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../lib/auth', () => authMock)
vi.mock('react-router-dom', () => ({ Link: ({ children, to }) => createElement('a', { href: to }, children) }))
import EscolherUnidade from './EscolherUnidade'

function render(auth) {
  authMock.useAuth.mockReturnValue({ trocarLoja: vi.fn(), isPlatformAdmin: false, user: {}, ...auth })
  let tree
  act(() => { tree = create(createElement(EscolherUnidade)) })
  return tree
}
const empresa = { id: 'e1', nome: 'Barbearia Dino' }

describe('EscolherUnidade', () => {
  it('não aparece quando a unidade ativa é da empresa ativa', () => {
    const tree = render({ empresaAtiva: empresa, lojaAtiva: { id: 'l1' }, lojasAcessiveis: [{ id: 'l1', empresaId: 'e1', nome: 'Matriz' }] })
    expect(tree.toJSON()).toBeNull()
  })

  it('com várias unidades oferece a escolha ali mesmo', () => {
    const trocarLoja = vi.fn()
    const tree = render({ trocarLoja, empresaAtiva: empresa, lojaAtiva: null, lojasAcessiveis: [{ id: 'l1', empresaId: 'e1', nome: 'Matriz' }, { id: 'l2', empresa_id: 'e1', nome: 'Filial' }, { id: 'x', empresaId: 'e2', nome: 'Outra' }] })
    const botoes = tree.root.findAllByType('button')
    expect(botoes.map((b) => b.children.join(''))).toEqual(['Matriz', 'Filial'])
    act(() => { botoes[1].props.onClick() })
    expect(trocarLoja).toHaveBeenCalledWith('l2')
  })

  it('aceita a unidade assinada na sessão mesmo sem a lista no navegador', () => {
    const tree = render({ empresaAtiva: empresa, lojaAtiva: null, lojasAcessiveis: [], user: { lojaId: 'l9' } })
    expect(tree.toJSON()).toBeNull()
  })

  it('sem unidade liberada explica e leva às Unidades', () => {
    const tree = render({ empresaAtiva: empresa, lojaAtiva: null, lojasAcessiveis: [] })
    expect(JSON.stringify(tree.toJSON())).toContain('/admin/lojas')
  })
})
