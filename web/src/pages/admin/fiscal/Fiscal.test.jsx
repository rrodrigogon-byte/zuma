import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { useAuth: vi.fn(), api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), blob: vi.fn(), upload: vi.fn(), delete: vi.fn() }, toast: vi.fn() }
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
async function montar(abaInicial, extra = {}) {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'AGRO OPEN TTC' }, lojasAcessiveis: [] })
  mocks.api.get.mockImplementation(async (url) => extra[url.split('?')[0]] ?? dados[url.split('?')[0]] ?? [])
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
    const marca = tree.root.find((n) => n.type === 'input' && n.props.type === 'checkbox' && !n.props['aria-label'])
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
  it('produção: aviso de valor fiscal; liberada mas bloqueada avisa que nada sai', async () => {
    let tree = await montar('situacao', { '/api/admin/fiscal/estado': { ambiente: 'producao', transmissao: 'producao', producaoLiberada: true, pronto: true, pendencias: [], avisos: ['O certificado A1 vence em 10 dia(s): renove antes para não parar a emissão'] } })
    let s = texto(tree)
    expect(s).toContain('Ambiente de produção')
    expect(s).toContain('têm valor fiscal')
    expect(s).toContain('vence em 10 dia(s)')
    tree = await montar('situacao', { '/api/admin/fiscal/estado': { ambiente: 'producao', transmissao: 'producao_bloqueada', producaoLiberada: false, pronto: false, pendencias: ['Produção não liberada'] } })
    s = texto(tree)
    expect(s).toContain('não está liberada neste servidor')
  })

  it('emitente: produção desabilitada sem liberação; excluir pede confirmação e chama DELETE', async () => {
    mocks.api.delete.mockResolvedValue({ ok: true, desativado: true, mensagem: 'O emitente tem notas emitidas: foi desativado e o histórico continua disponível.' })
    const tree = await montar('situacao')
    await act(async () => { botoes(tree, 'Editar')[0].props.onClick() })
    const opcaoProducao = tree.root.find((n) => n.type === 'option' && n.props.value === 'producao')
    expect(opcaoProducao.props.disabled).toBe(true)
    await act(async () => { botoes(tree, 'Voltar')[0].props.onClick() })
    await act(async () => { botoes(tree, 'Excluir')[0].props.onClick() })
    expect(texto(tree)).toContain('Excluir o emitente TTC?')
    const form = tree.root.findAll((n) => n.type === 'form').find((f) => f.findAll((n) => n.type === 'button' && n.children.join('') === 'Excluir').length)
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/admin/fiscal/emitentes/e1')
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('desativado'), 'success')
  })

  it('certificado substituído: usar de novo e excluir; o em uso não tem esses botões', async () => {
    mocks.api.delete.mockResolvedValue({ ok: true, excluido: true })
    mocks.api.post.mockResolvedValue({ ativo: true })
    const tree = await montar('situacao', { '/api/admin/fiscal/certificados': [
      { id: 'c1', titular: 'NOVO', validoAte: '2099-01-01', ativo: true },
      { id: 'c0', titular: 'ANTIGO', validoAte: '2099-01-01', ativo: false },
    ] })
    expect(botoes(tree, 'Usar este')).toHaveLength(1)
    await act(async () => { await botoes(tree, 'Usar este')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/certificados/c0/ativar', {})
    const excluir = botoes(tree, 'Excluir').at(-2) // emitente, certificado antigo, IBPT
    await act(async () => { excluir.props.onClick() })
    expect(texto(tree)).toContain('ANTIGO')
    const form = tree.root.findAll((n) => n.type === 'form').find((f) => f.findAll((n) => n.type === 'button' && n.children.join('') === 'Excluir').length)
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/admin/fiscal/certificados/c0')
  })

  it('IBPT: excluir a tabela da UF', async () => {
    mocks.api.delete.mockResolvedValue({ ok: true, excluido: true })
    const tree = await montar('situacao')
    await act(async () => { botoes(tree, 'Excluir').at(-1).props.onClick() })
    const form = tree.root.findAll((n) => n.type === 'form').find((f) => f.findAll((n) => n.type === 'button' && n.children.join('') === 'Excluir').length)
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/admin/fiscal/ibpt/MT')
  })
  it('documentos: período personalizado filtra sem quebrar e autorizado mostra o ambiente', async () => {
    const tree = await montar('documentos', { '/api/admin/fiscal/documentos': [
      { id: 'p1', modelo: '65', serie: 1, numero: 1, status: 'autorizado', ambiente: 'producao', valorTotal: 300, mensagens: [], criadoEm: '2026-11-01T12:00:00Z', temXml: true, origem: 'loja_pedido', origemId: 'o1' },
      { id: 'h1', modelo: '65', serie: 1, numero: 5, status: 'autorizado', ambiente: 'homologacao', valorTotal: 10, mensagens: [], criadoEm: '2026-10-01T12:00:00Z', temXml: true, origem: 'bar_comanda', origemId: 'c9' },
    ] })
    let s = texto(tree)
    expect(s).toContain('Autorizado (produção)')
    expect(s).toContain('Autorizado (homologação)')
    await act(async () => { botoes(tree, 'Personalizado')[0].props.onClick() })
    const datas = tree.root.findAll((n) => n.type === 'input' && n.props.type === 'date')
    expect(datas).toHaveLength(2)
    await act(async () => { datas[0].props.onChange({ target: { value: '2026-10-15' } }) })
    s = texto(tree)
    expect(s).toContain('Autorizado (produção)')
    expect(s).not.toContain('Autorizado (homologação)')
  })

  it('vendas sem nota: emite as marcadas e todas em lote e mostra as que falharam', async () => {
    mocks.api.post.mockResolvedValue({ total: 2, emitidas: 1, falhas: 1, resultados: [
      { origem: 'bar_comanda', origemId: 'c2', ok: true, numero: 9, status: 'autorizado' },
      { origem: 'loja_pedido', origemId: 'o7aaaaaa-x', ok: false, erro: 'Item 1 (Kit) sem classificação fiscal' },
    ] })
    const tree = await montar('documentos', { '/api/admin/fiscal/vendas-sem-nota': [
      { origem: 'bar_comanda', origemId: 'c2', descricao: 'Comanda Mesa 2', valor: 30 },
      { origem: 'loja_pedido', origemId: 'o7aaaaaa-x', descricao: 'Pedido KC-1', valor: 450 },
    ] })
    expect(botoes(tree, 'Emitir marcadas (0)')[0].props.disabled).toBe(true)
    const marcar = tree.root.find((n) => n.type === 'input' && n.props['aria-label'] === 'Marcar Pedido KC-1')
    await act(async () => { marcar.props.onChange() })
    await act(async () => { await botoes(tree, 'Emitir marcadas (1)')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos/lote', { modelo: '65', vendas: [{ origem: 'loja_pedido', origemId: 'o7aaaaaa-x' }] })
    expect(texto(tree)).toContain('sem classificação fiscal')
    await act(async () => { await botoes(tree, 'Emitir todas (2)')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenLastCalledWith('/api/admin/fiscal/documentos/lote', { modelo: '65', vendas: [{ origem: 'bar_comanda', origemId: 'c2' }, { origem: 'loja_pedido', origemId: 'o7aaaaaa-x' }] })
  })

  it('emissão automática: liga, escolhe as origens e mostra a última rodada', async () => {
    mocks.api.put.mockImplementation(async (url, corpo) => ({ ...corpo, desde: '2026-11-01T19:00:00Z' }))
    const tree = await montar('documentos', { '/api/admin/fiscal/automatica': { emissaoAutomatica: false, origens: ['loja_pedido'], ultimaRodada: '2026-11-01T18:00:00Z', ultimoResumo: { emitidas: 2, falhas: 1, erros: ['Fiscal não está pronto: Certificado A1'] } } })
    expect(texto(tree)).toContain('Fiscal não está pronto')
    const liga = tree.root.find((n) => n.type === 'input' && n.props['aria-label'] === 'Emissão automática ligada')
    await act(async () => { await liga.props.onChange({ target: { checked: true } }) })
    expect(mocks.api.put).toHaveBeenCalledWith('/api/admin/fiscal/automatica', expect.objectContaining({ emissaoAutomatica: true, origens: ['loja_pedido'] }))
    const barbearia = tree.root.find((n) => n.type === 'input' && n.props['aria-label'] === 'Origem Produtos das comandas da barbearia')
    await act(async () => { await barbearia.props.onChange({ target: { checked: true } }) })
    expect(mocks.api.put).toHaveBeenLastCalledWith('/api/admin/fiscal/automatica', expect.objectContaining({ origens: ['loja_pedido', 'barbearia_comanda'] }))
  })

  it('emissão automática ligada: "Emitir pendentes agora" roda na hora e mostra o resultado', async () => {
    mocks.api.post.mockResolvedValue({ emitidas: 3, falhas: 0, erros: [], config: { emissaoAutomatica: true, origens: ['loja_pedido'], ultimaRodada: '2026-11-02T13:00:00Z', ultimoResumo: { emitidas: 3, falhas: 0, erros: [] } } })
    const desligada = await montar('documentos', { '/api/admin/fiscal/automatica': { emissaoAutomatica: false, origens: ['loja_pedido'] } })
    expect(botoes(desligada, 'Emitir pendentes agora')).toHaveLength(0)
    const tree = await montar('documentos', { '/api/admin/fiscal/automatica': { emissaoAutomatica: true, origens: ['loja_pedido'], desde: '2026-11-01T19:00:00Z' } })
    await act(async () => { await botoes(tree, 'Emitir pendentes agora')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/automatica/rodar', {})
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('3 nota(s) emitida(s)'), 'success')
  })
  it('planilha: baixar, prévia (sem gravar) e aplicar', async () => {
    mocks.api.blob.mockResolvedValue(new Blob(['fonte;fonte_id'], { type: 'text/csv' }))
    mocks.api.upload.mockResolvedValueOnce({ linhas: 3, validas: 1, ignoradas: 1, aplicadas: 0, prevista: true, erros: [{ linha: 3, item: 'Kit', mensagem: 'CFOP com 4 dígitos' }] })
      .mockResolvedValueOnce({ linhas: 3, validas: 1, ignoradas: 1, aplicadas: 1, prevista: false, erros: [{ linha: 3, item: 'Kit', mensagem: 'CFOP com 4 dígitos' }] })
    const tree = await montar('classificacao')
    await act(async () => { await botoes(tree, 'Baixar planilha')[0].props.onClick() })
    expect(mocks.api.blob).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes/planilha')
    const arquivo = { name: 'classificacao-fiscal.csv', type: 'text/csv' }
    const input = tree.root.find((n) => n.type === 'input' && n.props['aria-label'] === 'Planilha de classificação (CSV)')
    await act(async () => { input.props.onChange({ target: { files: [arquivo] } }) })
    expect(botoes(tree, 'Aplicar planilha')[0].props.disabled).toBe(true)
    await act(async () => { await botoes(tree, 'Ver prévia')[0].props.onClick() })
    expect(mocks.api.upload).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes/planilha', arquivo)
    expect(texto(tree)).toContain('CFOP com 4 dígitos')
    await act(async () => { await botoes(tree, 'Aplicar planilha')[0].props.onClick() })
    expect(mocks.api.upload).toHaveBeenLastCalledWith('/api/admin/fiscal/classificacoes/planilha?aplicar=1', arquivo)
  })

  const formCom = (tree, rotulo) => tree.root.findAll((n) => n.type === 'form').find((f) => f.findAll((n) => n.type === 'button' && n.children.join('') === rotulo).length)
  const campoPor = (tree, aria) => tree.root.find((n) => (n.type === 'input' || n.type === 'select') && n.props['aria-label'] === aria)

  it('numeração: inclui série, edita o próximo número e exclui série sem uso', async () => {
    mocks.api.put.mockResolvedValue({ ok: true })
    mocks.api.delete.mockResolvedValue({ ok: true })
    const tree = await montar('numeracao', { '/api/admin/fiscal/numeracao': [
      { emitenteId: 'e1', emitente: 'TTC', modelo: '65', serie: 1, ambiente: 'producao', proximo: 1501, ultimoUsado: 1500, padrao: true },
      { emitenteId: 'e1', emitente: 'TTC', modelo: 'nfse', serie: 1, ambiente: 'producao', proximo: 1, ultimoUsado: null, padrao: true },
    ] })
    expect(texto(tree)).toContain('último usado: ')
    await act(async () => { botoes(tree, '+ Série')[0].props.onClick() })
    await act(async () => { campoPor(tree, 'Modelo da série').props.onChange({ target: { value: 'nfse' } }) })
    await act(async () => { campoPor(tree, 'Ambiente da série').props.onChange({ target: { value: 'producao' } }) })
    await act(async () => { campoPor(tree, 'Número da série').props.onChange({ target: { value: '2' } }) })
    await act(async () => { campoPor(tree, 'Próximo número').props.onChange({ target: { value: '842' } }) })
    await act(async () => { await formCom(tree, 'Salvar').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.put).toHaveBeenLastCalledWith('/api/admin/fiscal/numeracao', { emitenteId: 'e1', modelo: 'nfse', serie: 2, ambiente: 'producao', proximo: 842, padrao: true })
    // editar: modelo/série ficam travados; só o próximo e o padrão mudam
    await act(async () => { botoes(tree, 'Editar')[0].props.onClick() })
    expect(campoPor(tree, 'Número da série').props.disabled).toBe(true)
    await act(async () => { campoPor(tree, 'Próximo número').props.onChange({ target: { value: '1600' } }) })
    await act(async () => { await formCom(tree, 'Salvar').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.put).toHaveBeenLastCalledWith('/api/admin/fiscal/numeracao', { emitenteId: 'e1', modelo: '65', serie: 1, ambiente: 'producao', proximo: 1600, padrao: true })
    // só a série sem uso tem Excluir
    expect(botoes(tree, 'Excluir')).toHaveLength(1)
    await act(async () => { botoes(tree, 'Excluir')[0].props.onClick() })
    await act(async () => { await formCom(tree, 'Excluir').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/admin/fiscal/numeracao?emitenteId=e1&modelo=nfse&serie=1&ambiente=producao')
  })

  it('NF-e: carta de correção da autorizada e SVC da que ficou sem resposta', async () => {
    mocks.api.post.mockResolvedValue({ sequencia: 1, protocolo: '1512', modelo: '55', numero: 5, status: 'autorizado', ambiente: 'homologacao' })
    const tree = await montar('documentos', { '/api/admin/fiscal/documentos': [
      { id: 'n1', modelo: '55', serie: 1, numero: 5, status: 'autorizado', ambiente: 'producao', valorTotal: 200, mensagens: [], criadoEm: '2026-10-22T12:00:00Z', temXml: true, origem: 'manual' },
      { id: 'n2', modelo: '55', serie: 1, numero: 6, status: 'falha_comunicacao', ambiente: 'producao', valorTotal: 80, mensagens: [], criadoEm: '2026-10-22T12:00:00Z', temXml: true, origem: 'manual' },
    ] })
    expect(texto(tree)).toContain('Total emitido (produção)')
    expect(botoes(tree, 'Carta de correção')).toHaveLength(1)
    await act(async () => { botoes(tree, 'Carta de correção')[0].props.onClick() })
    expect(formCom(tree, 'Registrar carta').findAll((n) => n.type === 'button' && n.children.join('') === 'Registrar carta')[0].props.disabled).toBe(true)
    const area = tree.root.findAll((n) => n.type === 'textarea').find((t) => t.props.maxLength === 1000)
    await act(async () => { area.props.onChange({ target: { value: 'Correção do complemento: apto 52' } }) })
    await act(async () => { await formCom(tree, 'Registrar carta').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos/n1/carta-correcao', { texto: 'Correção do complemento: apto 52' })
    await act(async () => { botoes(tree, 'Emitir em SVC')[0].props.onClick() })
    await act(async () => { await formCom(tree, 'Emitir em SVC').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/documentos/n2/svc', { justificativa: 'SEFAZ de origem sem resposta: falha de comunicação na autorização da NF-e' })
  })

  it('NF-e com destinatário de outra UF: exige alíquota do DIFAL e envia itens, endereço e DIFAL', async () => {
    mocks.api.post.mockResolvedValue({ modelo: '55', numero: 1, status: 'autorizado', ambiente: 'homologacao' })
    const tree = await montar('documentos')
    await act(async () => { botoes(tree, '+ NF-e (com destinatário)')[0].props.onClick() })
    const set = async (aria, value) => act(async () => { campoPor(tree, aria).props.onChange({ target: { value } }) })
    const setRotulo = async (rotulo, value) => {
      const label = tree.root.findAll((n) => n.type === 'label' && n.children.some((c) => c === rotulo))[0]
      const input = label.findAll((n) => n.type === 'input')[0]
      await act(async () => { input.props.onChange({ target: { value } }) })
    }
    await set('Código do item 1', 'v1'); await set('Descrição do item 1', 'Pomada'); await set('Valor do item 1', '200,00')
    await setRotulo('CPF ou CNPJ', '529.982.247-25'); await setRotulo('Nome / razão social', 'Cliente SP')
    await setRotulo('Logradouro', 'Av Paulista'); await setRotulo('Número', '1000'); await setRotulo('Bairro', 'Bela Vista'); await setRotulo('Cidade', 'São Paulo')
    await set('UF do destinatário', 'SP'); await setRotulo('Código IBGE', '3550308'); await setRotulo('CEP', '01310-100')
    const emitir = () => formCom(tree, 'Emitir NF-e').findAll((n) => n.type === 'button' && n.children.join('') === 'Emitir NF-e')[0]
    expect(emitir().props.disabled).toBe(true)
    expect(texto(tree)).toContain('DIFAL')
    await setRotulo('Alíquota interna do ICMS em SP (%)', '18'); await setRotulo('FCP de SP (%)', '2')
    expect(emitir().props.disabled).toBe(false)
    await act(async () => { await formCom(tree, 'Emitir NF-e').props.onSubmit({ preventDefault() {} }) })
    const [url, corpo] = mocks.api.post.mock.calls.at(-1)
    expect(url).toBe('/api/admin/fiscal/documentos')
    expect(corpo).toMatchObject({
      modelo: '55', origem: 'manual', consumidorFinal: true, difal: { aliquotaInternaDestino: 18, fcpDestino: 2 },
      itens: [{ fonte: 'loja_variante', fonteId: 'v1', descricao: 'Pomada', quantidade: 1, valorUnitario: 200 }],
      destinatario: { cpf: '52998224725', nome: 'Cliente SP', indIEDest: '9', endereco: { uf: 'SP', codigoMunicipio: '3550308', cep: '01310100', logradouro: 'Av Paulista' } },
    })
    expect(corpo.idempotencia).toMatch(/^manual:/)
  })

  it('barbearia: venda com NFS-e dos serviços e NFC-e avulsa com a classificação informada', async () => {
    const tree = await montar('documentos', { '/api/admin/fiscal/vendas-sem-nota': [{ origem: 'barbearia_comanda', origemId: 'cmd-1', descricao: 'Comanda B-7 · Ana (produtos)', valor: 36 }] })
    await act(async () => { botoes(tree, 'Emitir NFS-e (serviços)')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenLastCalledWith('/api/admin/fiscal/documentos', { modelo: 'nfse', origem: 'barbearia_comanda', origemId: 'cmd-1' })
    await act(async () => { botoes(tree, '+ NFC-e avulsa')[0].props.onClick() })
    const emitirBtn = () => formCom(tree, 'Emitir NFC-e').findAll((n) => n.type === 'button' && n.children.join('') === 'Emitir NFC-e')[0]
    expect(emitirBtn().props.disabled).toBe(true)
    for (const [aria, v] of [['Descrição da NFC-e avulsa', 'Pomada Matte'], ['NCM da NFC-e avulsa', '3305.90.00'], ['Valor da NFC-e avulsa', '45,90'], ['CPF da NFC-e avulsa', '529.982.247-25']]) {
      await act(async () => { campoPor(tree, aria).props.onChange({ target: { value: v } }) })
    }
    expect(emitirBtn().props.disabled).toBe(false)
    await act(async () => { await formCom(tree, 'Emitir NFC-e').props.onSubmit({ preventDefault() {} }) })
    const [, corpo] = mocks.api.post.mock.calls.at(-1)
    expect(corpo).toMatchObject({ modelo: '65', origem: 'manual', destinatario: { cpf: '52998224725' }, itens: [{ descricao: 'Pomada Matte', quantidade: 1, valorUnitario: 45.9, classificacao: { tipo: 'produto', ncm: '33059000', cfop: '5102', csosn: '102' } }] })
  })

  it('SPED: salva o contador e gera os arquivos do período (download em ISO-8859-1)', async () => {
    const criados = []
    globalThis.document.createElement = (tag) => { const el = { tag, click: vi.fn() }; criados.push(el); return el }
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:sped')
    globalThis.URL.revokeObjectURL = vi.fn()
    mocks.api.put.mockImplementation(async (url, corpo) => corpo)
    mocks.api.post.mockResolvedValue({ nomeArquivo: 'EFD-ICMS-IPI-x-202610.txt', base64: Buffer.from('|0000|020|', 'latin1').toString('base64'), resumo: { documentos: 3, cancelados: 1, linhas: 76, leiaute: '020', debitosIcms: 78 }, avisos: ['Só entram as saídas emitidas no Kytto'] })
    const tree = await montar('sped', { '/api/admin/fiscal/sped/config': { perfil: 'A', contador: {} } })
    await act(async () => { campoPor(tree, 'Nome do contador').props.onChange({ target: { value: 'Maria' } }) })
    await act(async () => { campoPor(tree, 'Código de receita do ICMS').props.onChange({ target: { value: '1112' } }) })
    await act(async () => { await formCom(tree, 'Salvar configuração').props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.put).toHaveBeenCalledWith('/api/admin/fiscal/sped/config', expect.objectContaining({ codReceitaIcms: '1112', contador: expect.objectContaining({ nome: 'Maria' }) }))
    await act(async () => { campoPor(tree, 'Ano do SPED').props.onChange({ target: { value: '2026' } }) })
    await act(async () => { campoPor(tree, 'Mês do SPED').props.onChange({ target: { value: '10' } }) })
    await act(async () => { await botoes(tree, 'Gerar EFD ICMS/IPI')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/sped/efd-icms-ipi', { ano: 2026, mes: 10 })
    expect(criados.at(-1).download).toBe('EFD-ICMS-IPI-x-202610.txt')
    expect(texto(tree)).toContain('Só entram as saídas emitidas no Kytto')
    await act(async () => { await botoes(tree, 'Gerar EFD-Contribuições')[0].props.onClick() })
    expect(mocks.api.post).toHaveBeenLastCalledWith('/api/admin/fiscal/sped/efd-contribuicoes', { ano: 2026, mes: 10 })
  })

  it('SPED e Contador: exibe apuração contábil por CFOP e baixa SPED Fiscal, SPED Contribuições, CSV e Pacote de XMLs', async () => {
    mocks.api.blob.mockResolvedValue(new Blob(['|0000|'], { type: 'text/plain' }))
    const tree = await montar('contador', {
      '/api/admin/fiscal/contador/resumo': {
        competencia: '2026-11',
        totais: {
          autorizados: 12,
          valorAutorizado: 2450,
          porModelo: { '65': { qtd: 10, valor: 1550, canceladas: 1 }, '55': { qtd: 1, valor: 600, canceladas: 0 }, nfse: { qtd: 1, valor: 300, canceladas: 0 } },
          tributos: { baseIcms: 1550, valorIcms: 263.5, valorPis: 34.87, valorCofins: 160.55, valorIss: 15 },
        },
        porCfop: [
          { cfop: '5102', cstOuCsosn: '102', qtdItens: 18, valorContabil: 1550, baseIcms: 1550, valorIcms: 263.5, valorPis: 25.57, valorCofins: 117.8 },
        ],
      },
      '/api/admin/fiscal/contador/pacote': { competencia: '2026-11', totalXmls: 12, xmls: [] },
    })
    expect(texto(tree)).toContain('SPED Fiscal, EFD Contribuições e Fechamento para o Contador')
    expect(texto(tree)).toContain('5102')
    await act(async () => { await botoes(tree, 'Baixar SPED Fiscal (EFD ICMS/IPI)')[0].props.onClick() })
    expect(mocks.api.blob).toHaveBeenCalledWith(expect.stringContaining('/api/admin/fiscal/contador/sped-fiscal?competencia='))
    await act(async () => { await botoes(tree, 'Baixar SPED Contribuições (PIS/COFINS)')[0].props.onClick() })
    expect(mocks.api.blob).toHaveBeenCalledWith(expect.stringContaining('/api/admin/fiscal/contador/sped-contribuicoes?competencia='))
    await act(async () => { await botoes(tree, 'Exportar CSV (Domínio / Questor)')[0].props.onClick() })
    expect(mocks.api.blob).toHaveBeenCalledWith(expect.stringContaining('/api/admin/fiscal/contador/csv?competencia='))
    await act(async () => { await botoes(tree, 'Baixar Pacote de XMLs + Resumo')[0].props.onClick() })
    expect(mocks.api.get).toHaveBeenCalledWith(expect.stringContaining('/api/admin/fiscal/contador/pacote?competencia='))
  })
})
