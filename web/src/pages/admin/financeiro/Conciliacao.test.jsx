import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { api: { get: vi.fn(), post: vi.fn() }, toast: vi.fn() }
})
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
import Conciliacao from './Conciliacao'

const dados = {
  '/api/admin/razao/conciliacao/contas': [{ id: 'c1', nome: 'Banco 0001 · 12345-6', saldoBanco: 1000, extratoAte: '2026-10-31', pendentes: 1, valorPendente: 50 }],
  '/api/admin/razao/conciliacao/linhas': [{ id: 'x1', data: '2026-10-15', valor: 50, descricao: 'PIX RECEBIDO', status: 'pendente', sugestoes: [{ lancamento: { id: 'l1', descricao: 'Aula avulsa', status: 'pendente', vencimento: '2026-10-15' }, pontos: 100, casaNome: false }] }],
}

describe('Conciliação bancária', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.api.get.mockImplementation(async (url) => dados[url.split('?')[0]] ?? []); mocks.api.post.mockResolvedValue({ baixado: true }) })

  it('mostra saldo e sugere conciliar e baixar a conta pendente', async () => {
    let tree
    await act(async () => { tree = create(createElement(Conciliacao, { categorias: { receita: [], despesa: [] }, toast: mocks.toast })) })
    expect(JSON.stringify(tree.toJSON())).toContain('Aula avulsa')
    const botao = tree.root.findAll((n) => n.type === 'button' && n.children.join('') === 'Conciliar e baixar')[0]
    await act(async () => { botao.props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/razao/conciliacao/linhas/x1/conciliar', { lancamentoId: 'l1' })
    expect(mocks.toast).toHaveBeenCalledWith('Conciliada e baixada.', 'success')
  })
})
