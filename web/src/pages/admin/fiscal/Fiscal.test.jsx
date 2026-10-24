import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), blob: vi.fn(), upload: vi.fn() }, toast: vi.fn() }
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
  '/api/admin/fiscal/ibpt': [{ uf: 'MT', linhas: 13456, versao: '26.2.A', vigenciaFim: '2099-12-31' }],
  '/api/admin/fiscal/documentos': [
    { id: 'd1', modelo: '65', serie: 1, numero: 7, status: 'validado_localmente', valorTotal: 24, mensagens: [], criadoEm: '2026-10-22T12:00:00Z', temXml: true, origem: 'bar_comanda', origemId: 'c1' },
    { id: 'd2', modelo: '65', serie: 1, numero: 8, status: 'contingencia', contingenciaAtrasada: true, valorTotal: 24, mensagens: [], criadoEm: '2026-10-21T12:00:00Z', temXml: true, origem: 'bar_comanda', origemId: 'c3' },
    { id: 'd3', modelo: '65', serie: 1, numero: 9, status: 'falha_comunicacao', valorTotal: 24, mensagens: [], criadoEm: '2026-10-22T13:00:00Z', temXml: true, origem: 'bar_comanda', origemId: 'c4' },
    { id: 'd4', modelo: 'nfse', serie: 1, numero: 2, status: 'validado_localmente', valorTotal: 150, mensagens: [], criadoEm: '2026-10-22T13:00:00Z', temXml: true, origem: 'manual' },
  ],
  '/api/admin/fiscal/vendas-sem-nota': [{ origem: 'bar_comanda', origemId: 'c2', descricao: 'Comanda Mesa 2', valor: 30 }],
  '/api/admin/fiscal/inutilizacoes': [{ id: 'i1', modelo: '65', serie: 1, numeroInicial: 3, numeroFinal: 4, status: 'validado_localmente', justificativa: 'Sistema pulou a numeração', mensagens: [], criadoEm: '2026-10-22T12:00:00Z' }],
  '/api/admin/fiscal/classificacoes': [{ fonte: 'est_item', fonteId: 'it1', nome: 'Pão de queijo · PQ-1', grupo: 'Estoque · Padaria', classificacao: null, herdada: false, ncmSugerido: '19059090' }],
}
async function montar(abaInicial) {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'AGRO OPEN TTC' }, lojasAcessiveis: [] })
  mocks.api.get.mockImplementation(async (url) => dados[url.split('?')[0]] ?? [])
  let tree
  await act(async () => { tree = create(createElement(Fiscal, { abaInicial })) })
  return tree
}
const texto = (tree) => JSON.stringify(tree.toJSON())
const botoes = (tree, rotulo) => tree.root.findAll((n) => n.type === 'button' && n.children.join('') === rotulo)

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
    const botao = botoes(tree, 'Emitir NFC-e')[0]
    await act(async () => { botao.props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos', { modelo: '65', origem: 'bar_comanda', origemId: 'c2' })
  })

  it('pede contingência offline na emissão quando marcado', async () => {
    const tree = await montar('documentos')
    const marca = tree.root.find((n) => n.type === 'input' && n.props.type === 'checkbox')
    await act(async () => { marca.props.onChange({ target: { checked: true } }) })
    await act(async () => { botoes(tree, 'Emitir NFC-e')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos', { modelo: '65', origem: 'bar_comanda', origemId: 'c2', contingenciaOffline: true })
  })

  it('imprime o DANFE (NFC-e/NF-e) buscando o HTML autenticado; NFS-e não tem DANFE', async () => {
    const janela = { location: { href: '' }, close: vi.fn() }
    globalThis.window.open = vi.fn(() => janela)
    mocks.api.blob.mockResolvedValue(new Blob(['<!doctype html><p>DANFE</p>'], { type: 'text/html' }))
    const tree = await montar('documentos')
    const imprimir = botoes(tree, 'Imprimir DANFE')
    expect(imprimir).toHaveLength(3) // d1, d2 e d3 (65); a NFS-e d4 fica sem o botão
    await act(async () => { await imprimir[0].props.onClick() })
    expect(globalThis.window.open).toHaveBeenCalledWith('', '_blank')
    expect(mocks.api.blob).toHaveBeenCalledWith('/api/admin/fiscal/documentos/d1/danfe')
    expect(janela.location.href).toMatch(/^blob:/)
  })

  it('mostra contingências atrasadas, transmite as pendentes e passa NFC-e sem resposta para contingência', async () => {
    mocks.api.post.mockResolvedValue({ transmissao: 'homologacao', autorizadas: 1, rejeitadas: 0, falhas: 0, pendentes: 0 })
    const tree = await montar('documentos')
    const s = texto(tree)
    expect(s).toContain('Contingência offline (a transmitir)')
    expect(s).toContain('prazo de 24 h vencido')
    expect(s).toContain('passaram do prazo de 24 horas')
    await act(async () => { await botoes(tree, 'Transmitir contingências')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/contingencias/transmitir', {})
    const emCont = botoes(tree, 'Emitir em contingência')
    expect(emCont).toHaveLength(1) // só a NFC-e com falha de comunicação
    await act(async () => { await emCont[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos/d3/contingencia', {})
  })

  it('inutiliza uma faixa com justificativa de 15+ caracteres', async () => {
    mocks.api.post.mockResolvedValue({ numeroInicial: 5, numeroFinal: 7, status: 'validado_localmente' })
    const tree = await montar('inutilizacao')
    expect(texto(tree)).toContain('Bloqueada aqui (não enviada)')
    const enviar = botoes(tree, 'Inutilizar números')[0]
    expect(enviar.props.disabled).toBe(true)
    const [serie, inicial, final] = tree.root.findAll((n) => n.type === 'input')
    await act(async () => { serie.props.onChange({ target: { value: '1' } }) })
    await act(async () => { inicial.props.onChange({ target: { value: '5' } }) })
    await act(async () => { final.props.onChange({ target: { value: '7' } }) })
    const just = tree.root.find((n) => n.type === 'textarea')
    await act(async () => { just.props.onChange({ target: { value: 'curta' } }) })
    expect(botoes(tree, 'Inutilizar números')[0].props.disabled).toBe(true)
    await act(async () => { just.props.onChange({ target: { value: 'Sistema pulou a numeração do caixa' } }) })
    expect(botoes(tree, 'Inutilizar números')[0].props.disabled).toBe(false)
    const form = tree.root.find((n) => n.type === 'form')
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/inutilizacoes', { modelo: '65', serie: 1, numeroInicial: 5, numeroFinal: 7, justificativa: 'Sistema pulou a numeração do caixa' })
  })

  it('importa a tabela do IBPT como arquivo e lista as UFs importadas', async () => {
    mocks.api.upload.mockResolvedValue({ uf: 'MT', importadas: 13456, ignoradas: 0 })
    const tree = await montar('situacao')
    const s = texto(tree)
    expect(s).toContain('Tributos aproximados (IBPT)')
    expect(s).toContain('26.2.A')
    const arquivo = { name: 'TabelaIBPTaxMT26.2.A.csv', type: 'text/csv' }
    const input = tree.root.find((n) => n.type === 'input' && n.props['aria-label'] === 'Arquivo CSV do IBPT')
    await act(async () => { input.props.onChange({ target: { files: [arquivo] } }) })
    const form = tree.root.findAll((n) => n.type === 'form').find((f) => f.findAll((n) => n.type === 'button' && n.children.join('') === 'Importar tabela do IBPT').length)
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.upload).toHaveBeenCalledWith('/api/admin/fiscal/ibpt', arquivo)
  })

  it('classifica item do estoque único com o NCM do cadastro como sugestão', async () => {
    mocks.api.put.mockResolvedValue({})
    const tree = await montar('classificacao')
    expect(texto(tree)).toContain('NCM do cadastro 19059090')
    await act(async () => { botoes(tree, 'Classificar')[0].props.onClick() })
    const ncm = tree.root.find((n) => n.type === 'input' && n.props.maxLength === 8)
    expect(ncm.props.value).toBe('19059090')
    const form = tree.root.find((n) => n.type === 'form')
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    const corpo = mocks.api.put.mock.calls[0][1]
    expect(corpo).toMatchObject({ fonte: 'est_item', fonteId: 'it1', ncm: '19059090', cfop: '5102' })
    expect(corpo).not.toHaveProperty('ncmSugerido')
  })
})
