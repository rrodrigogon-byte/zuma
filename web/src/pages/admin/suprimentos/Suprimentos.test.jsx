import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() }, toast: vi.fn() }
})
vi.mock('../../../lib/auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('../customer360.css', () => ({}))
vi.mock('../dino/dino-admin.css', () => ({}))
import Suprimentos from './Suprimentos'

const item = (extra) => ({ id: 'i1', nome: 'Limão', unidade: 'KG', tipo: 'insumo', custoMedio: 5, estoqueMinimo: 10, saldo: 2, abaixoDoMinimo: true, valorEmEstoque: 10, ...extra })
const dados = {
  '/api/admin/suprimentos/itens': [item({}), item({ id: 'i2', nome: 'Cerveja lata', unidade: 'UN', tipo: 'mercadoria', custoMedio: 3, estoqueMinimo: 0, saldo: 48, abaixoDoMinimo: false, valorEmEstoque: 144 })],
  '/api/admin/suprimentos/pedidos': [{ id: 'p1', numero: 7, fornecedorNome: 'Distribuidora', total: 300, condicaoPagamento: '30/60', status: 'enviado' }],
  '/api/admin/suprimentos/pedidos/p1': { id: 'p1', numero: 7, lojaId: 'l1', condicaoPagamento: '30/60', itens: [{ itemId: 'i2', nome: 'Cerveja lata', unidade: 'UN', pendente: 100, custoUnitario: 3 }] },
  '/api/admin/a2/fornecedores': { fornecedores: [] },
  '/api/admin/suprimentos/produtos-vendidos': [{ fonte: 'bar_produto', id: 'b1', nome: 'Caipirinha', grupo: 'Bar · Drinks' }],
  '/api/admin/suprimentos/fichas': [{ fonte: 'bar_produto', fonteId: 'b1', custo: 1, itens: [{ itemId: 'i1', nome: 'Limão', unidade: 'KG', fator: 0.2, espelho: false }] }],
}

async function montar(abaInicial = 'itens') {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'AGRO OPEN TTC' }, lojaAtiva: null, lojasAcessiveis: [{ id: 'l1', empresaId: 'e1', nome: 'Sede' }] })
  mocks.api.get.mockImplementation(async (url) => dados[url.split('?')[0]] ?? [])
  let tree
  await act(async () => { tree = create(createElement(Suprimentos, { abaInicial })) })
  return tree
}
const texto = (tree) => JSON.stringify(tree.toJSON())
const botao = (tree, rotulo) => tree.root.findAll((n) => n.type === 'button' && n.children.join('') === rotulo)[0]

describe('Estoque e compras', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.api.post.mockResolvedValue({ contasAPagar: [{}, {}] }) })

  it('lista saldos da unidade única e destaca o que está abaixo do mínimo', async () => {
    const tree = await montar()
    expect(mocks.api.get).toHaveBeenCalledWith('/api/admin/suprimentos/itens?lojaId=l1')
    const s = texto(tree)
    expect(s).toContain('Limão')
    expect(s).toContain('Abaixo do mínimo')
  })

  it('perda manda motivo, unidade e chave de idempotência', async () => {
    const tree = await montar()
    await act(async () => { botao(tree, 'Perda').props.onClick() })
    const inputs = tree.root.findAll((n) => n.type === 'input' && n.props.inputMode === 'decimal')
    await act(async () => { inputs.at(-1).props.onChange({ target: { value: '1,5' } }) })
    const motivo = tree.root.findAll((n) => n.type === 'input' && n.props.maxLength === 240)[0]
    await act(async () => { motivo.props.onChange({ target: { value: 'estragou' } }) })
    const form = tree.root.findAll((n) => n.type === 'form').at(-1)
    await act(async () => { form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/suprimentos/movimentos', expect.objectContaining({ lojaId: 'l1', itemId: 'i1', tipo: 'perda', motivo: 'estragou', idempotencia: expect.any(String) }))
  })

  it('receber pedido usa o pendente e avisa as contas a pagar criadas', async () => {
    const tree = await montar('compras')
    expect(texto(tree)).toContain('Distribuidora')
    await act(async () => { botao(tree, 'Receber').props.onClick() })
    const form = tree.root.findAll((n) => n.type === 'form').at(-1)
    await act(async () => { form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/suprimentos/recebimentos', expect.objectContaining({ pedidoId: 'p1', lojaId: 'l1', condicaoPagamento: '30/60', itens: [{ itemId: 'i2', quantidade: '100', custoUnitario: '3' }] }))
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('2 conta(s) a pagar'), 'success')
  })

  it('ficha técnica mostra o consumo do produto vendido', async () => {
    const tree = await montar('fichas')
    const s = texto(tree)
    expect(s).toContain('Caipirinha')
    expect(s).toContain('0,2 KG Limão')
  })
})
