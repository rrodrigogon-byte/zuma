import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../../lib/api', () => ({ api: { get: mocked.get, post: mocked.post } }))
import ComandaNova from './ComandaNova'

const clientes = [
  { id: 'c1', nome: 'João da Silva', telefone: '65999991234', preferencias: { bebida: 'Café sem açúcar', tags: ['pontual'] }, familia: [{ relacao: 'esposa', nome: 'Maria' }], redesSociais: { instagram: 'joao.silva' } },
  { id: 'c2', nome: 'Carlos Souza' },
]
const servicos = [{ id: 'corte', nome: 'Corte', preco: 60 }, { id: 'barba', nome: 'Barba', preco: 40 }, { id: 'sobrancelha', nome: 'Sobrancelha', preco: 20 }]
const planos = [{ assinaturaId: 'a1', planoNome: 'Clube VIP', utilizavel: true, sessoesNoCiclo: 4, sessoesRestantes: 4, servicosIds: ['corte', 'barba'], servicosNomes: ['Corte', 'Barba'] }]
let renderer
const tick = () => new Promise((r) => setTimeout(r, 0))
const texto = (node) => typeof node === 'string' ? node : Array.isArray(node) ? node.map(texto).join(' ') : (node?.children || []).map(texto).join(' ')
const botao = (rotulo) => renderer.root.findAll((n) => n.type === 'button' && texto(n.children).includes(rotulo))[0]

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocked.get.mockReset(); mocked.post.mockReset()
  mocked.get.mockImplementation(async (url) => url.includes('/planos') ? { planos } : { itens: [] })
})
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null })

describe('nova comanda', () => {
  it('busca o cliente pelo nome, mostra o plano e abate corte e barba do Clube VIP', async () => {
    const onCriada = vi.fn()
    await act(async () => { renderer = create(<ComandaNova clientes={clientes} profissionais={[]} servicos={servicos} produtosRevenda={[]} onCriada={onCriada} toast={vi.fn()} />); await tick() })
    const busca = renderer.root.find((n) => n.type === 'input' && n.props.role === 'combobox')
    await act(async () => { busca.props.onFocus(); busca.props.onChange({ target: { value: 'joao' } }); await tick() })
    await act(async () => { botao('João da Silva').props.onClick(); await tick() })
    expect(mocked.get).toHaveBeenCalledWith('/api/admin/barbearia/clientes/c1/planos')
    const tela = () => texto(renderer.toJSON())
    expect(tela()).toContain('Clube VIP')
    expect(tela()).toContain('Café sem açúcar')
    expect(tela()).toContain('Maria')
    for (const nome of ['Corte', 'Barba', 'Sobrancelha']) {
      await act(async () => { renderer.root.findAll((n) => n.type === 'button' && n.props.className === 'cn-resultado' && texto(n.children).includes(nome))[0].props.onClick(); await tick() })
    }
    expect(tela()).toContain('Abatido pelo plano')
    expect(tela()).toMatch(/Total a receber\s*R\$\s*20,00/)
    mocked.post.mockResolvedValue({ comanda: { id: 'cmd-1' }, avisos: [] })
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick() })
    const [url, corpo] = mocked.post.mock.calls[0]
    expect(url).toBe('/api/admin/barbearia/comandas')
    expect(corpo.clienteId).toBe('c1')
    expect(corpo.itens.map((i) => i.servicoId)).toEqual(['corte', 'barba', 'sobrancelha'])
    expect(corpo.itens.every((i) => i.preco === undefined && i.coberturaPlano === undefined)).toBe(true)
    expect(onCriada).toHaveBeenCalledWith({ id: 'cmd-1' }, [])
  })

  it('busca itens da loja Dino no servidor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mocked.get.mockImplementation(async (url) => url.includes('catalogo-loja') ? { itens: [{ variantId: 'v1', nome: 'Pomada Dino', preco: 49.9, disponivel: 3 }] } : { planos: [] })
    await act(async () => { renderer = create(<ComandaNova clientes={clientes} profissionais={[]} servicos={servicos} produtosRevenda={[]} onCriada={vi.fn()} toast={vi.fn()} />); await tick() })
    await act(async () => { botao('Loja Dino').props.onClick(); await vi.advanceTimersByTimeAsync(300) })
    expect(mocked.get.mock.calls.some(([url]) => url.startsWith('/api/admin/barbearia/comandas/catalogo-loja'))).toBe(true)
    expect(texto(renderer.toJSON())).toContain('Pomada Dino')
    vi.useRealTimers()
  })
})
