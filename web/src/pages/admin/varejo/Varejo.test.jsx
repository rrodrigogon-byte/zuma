import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, toast: vi.fn() }
})
vi.mock('../../../lib/auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('../customer360.css', () => ({}))
vi.mock('../dino/dino-admin.css', () => ({}))
import Varejo from './Varejo'

const produtos = [{ id: 'p1', nome: 'Arroz 5kg', unidade: 'UN', saldo: 10, estoqueMinimo: 0, custoMedio: 20, precoBase: 30, precoFinal: 27, promocao: { texto: '10% OFF' }, margem: 25.9 }]
describe('Supermercado e varejo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'Mercado' }, lojaAtiva: null, lojasAcessiveis: [{ id: 'l1', empresaId: 'e1', nome: 'Centro' }, { id: 'l2', empresaId: 'e1', nome: 'Bairro' }] })
    mocks.api.get.mockImplementation(async (url) => (url.startsWith('/api/admin/varejo/produtos') ? { produtos } : {}))
  })
  it('mostra o preço com promoção e a margem', async () => {
    let tree
    await act(async () => { tree = create(createElement(Varejo, {})) })
    const s = JSON.stringify(tree.toJSON())
    expect(s).toContain('10% OFF')
    expect(s).toContain('25,9')
  })
})
