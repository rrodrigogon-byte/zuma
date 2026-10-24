import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, toast: vi.fn() }
})
vi.mock('../../../lib/auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('../customer360.css', () => ({}))
vi.mock('../dino/dino-admin.css', () => ({}))
import FinanceiroRazao from './FinanceiroRazao'

const lanc = (extra) => ({ id: extra.id, tipo: 'despesa', categoria: 'Aluguel', descricao: 'Aluguel', valor: 100, vencimento: '2026-10-01', competencia: '2026-10-01', status: 'pendente', natureza: 'pagar', origem: 'manual', automatico: false, lojaId: null, ...extra })
const dados = {
  '/api/admin/razao/resumo': { saldo: 500, aReceber: 90, aPagar: 100, recMes: 600, despMes: 100, resultadoMes: 500, mesAtual: '2026-10', receberVencidos: 0, pagarVencidos: 1, pagarVencidosValor: 100, vencendo3Dias: 0, semUnidade: 0 },
  '/api/admin/razao/fluxo': [{ mes: '2026-10', receitas: 600, despesas: 100, saldo: 500 }],
  '/api/admin/razao/lancamentos': [
    lanc({ id: 'p1' }),
    lanc({ id: 'r1', tipo: 'receita', categoria: 'Contas de clientes', descricao: 'Fiado mesa 4', valor: 90, natureza: 'receber', origem: 'bar_comanda', automatico: true, vencimento: '2026-11-20' }),
    lanc({ id: 'x1', tipo: 'receita', categoria: 'Mensalidades', descricao: 'Mensalidade', valor: 600, status: 'pago', natureza: 'avulso', origem: 'clube_pagamento', automatico: true }),
  ],
  '/api/admin/razao/categorias': { receita: ['Mensalidades', 'Contas de clientes'], despesa: ['Aluguel', 'Outros'], grupos: {} },
  '/api/admin/razao/centros-custo': { centros: [] },
}

async function montar(abaInicial = 'geral') {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'AGRO OPEN TTC' }, lojaAtiva: null, lojasAcessiveis: [{ id: 'l1', empresaId: 'e1', nome: 'Sede' }] })
  mocks.api.get.mockImplementation(async (url) => dados[url.split('?')[0]] ?? {})
  let tree
  await act(async () => { tree = create(createElement(FinanceiroRazao, { abaInicial })) })
  return tree
}
const texto = (tree) => JSON.stringify(tree.toJSON())

describe('Financeiro sobre o razão', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.api.post.mockResolvedValue({}) })

  it('mostra os números da empresa toda e carrega do razão', async () => {
    const tree = await montar()
    expect(mocks.api.get).toHaveBeenCalledWith('/api/admin/razao/resumo')
    expect(texto(tree)).toContain('Saldo realizado')
    expect(texto(tree)).toContain('vencido(s)')
  })

  it('A receber lista só receitas pendentes, mesmo as automáticas, e a baixa usa o endpoint certo', async () => {
    const tree = await montar('receber')
    const s = texto(tree)
    expect(s).toContain('Fiado mesa 4')
    expect(s).not.toContain('Mensalidade"')
    const receber = tree.root.findAll((n) => n.type === 'button' && n.children.includes('Receber'))[0]
    await act(async () => { receber.props.onClick() })
    const form = tree.root.findAll((n) => n.type === 'form')[0]
    await act(async () => { form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/razao/lancamentos/r1/baixar', expect.objectContaining({ pagoEm: expect.any(String) }))
  })

  it('automático não oferece cancelar; manual pendente oferece', async () => {
    const tree = await montar('lancamentos')
    const botoes = tree.root.findAll((n) => n.type === 'button').map((b) => b.children.join(''))
    expect(botoes.filter((b) => b === 'Cancelar').length).toBe(1)
    expect(botoes).toContain('Estornar')
  })
})
