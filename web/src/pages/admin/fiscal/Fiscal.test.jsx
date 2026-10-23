import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, toast: vi.fn() }
})
vi.mock('../../../lib/auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('../customer360.css', () => ({}))
vi.mock('../dino/dino-admin.css', () => ({}))
import Fiscal from './Fiscal'

const dados = {
  '/api/admin/fiscal/estado': { ambiente: 'homologacao', transmissao: 'desligada', pronto: false, pendencias: ['Certificado A1'] },
  '/api/admin/fiscal/emitentes': [{ id: 'e1', cnpj: '50073355000260', razaoSocial: 'TTC', uf: 'MT', cscConfigurado: true }],
  '/api/admin/fiscal/certificados': [],
  '/api/admin/fiscal/documentos': [{ id: 'd1', modelo: '65', serie: 1, numero: 7, status: 'validado_localmente', valorTotal: 24, mensagens: [], criadoEm: '2026-10-22T12:00:00Z', temXml: true, origem: 'bar_comanda', origemId: 'c1' }],
  '/api/admin/fiscal/vendas-sem-nota': [{ origem: 'bar_comanda', origemId: 'c2', descricao: 'Comanda Mesa 2', valor: 30 }],
}
async function montar(abaInicial) {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'AGRO OPEN TTC' }, lojasAcessiveis: [] })
  mocks.api.get.mockImplementation(async (url) => dados[url.split('?')[0]] ?? [])
  let tree
  await act(async () => { tree = create(createElement(Fiscal, { abaInicial })) })
  return tree
}
const texto = (tree) => JSON.stringify(tree.toJSON())

describe('Fiscal (homologação)', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.api.post.mockResolvedValue({ modelo: '65', numero: 8, status: 'validado_localmente' }) })

  it('avisa que é homologação e mostra o que falta', async () => {
    const tree = await montar('situacao')
    const s = texto(tree)
    expect(s).toContain('Ambiente de homologação')
    expect(s).toContain('Certificado A1')
    expect(s).not.toContain('CSC-')
  })

  it('emite NFC-e de venda pendente com a origem certa', async () => {
    const tree = await montar('documentos')
    expect(texto(tree)).toContain('XML validado (não enviado)')
    const botao = tree.root.findAll((n) => n.type === 'button' && n.children.join('') === 'Emitir NFC-e')[0]
    await act(async () => { botao.props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos', { modelo: '65', origem: 'bar_comanda', origemId: 'c2' })
  })
})
