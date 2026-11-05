import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => {
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} }
  globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
  globalThis.window.cancelAnimationFrame = globalThis.window.cancelAnimationFrame || ((id) => clearTimeout(id))
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, activeElement: null, body: {} }
  return { api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), blob: vi.fn(), upload: vi.fn(), delete: vi.fn() } }
})
vi.mock('../../../lib/api', () => ({ api: mocks.api }))
import ClassificacaoFiscal from './ClassificacaoFiscal'

const item = (x) => ({ herdada: false, orfa: false, erros: [], avisos: [], sugestoes: [], descricao: null, tipo: 'produto', ...x })
const analise = {
  crt: '1', regime: 'simples',
  fontes: { ncm: { vigencia: 'Vigente em 05/11/2026', ato: 'Resolução Gecex nº 926/2026' }, cest: { obtidoEm: '2026-11-05' } },
  resumo: { total: 5, sem: 1, erro: 1, aviso: 1, ok: 2, herdadas: 0, orfas: 1 },
  itens: [
    item({ fonte: 'loja_variante', fonteId: 'v1', nome: 'Perfume Asad · DINO-PERF-1', grupo: 'Loja online', origemRotulo: 'Loja online', situacao: 'ok', classificacao: { tipo: 'produto', ncm: '33030010', cfop: '5405', csosn: '500', cest: '2000700' }, descricao: { ncm: 'Perfumes (extratos)', cest: 'Perfumes (extratos)' }, busca: 'perfume asad dino-perf-1 loja online 33030010 3303.00.10 2000700 5405 csosn 500 perfumes (extratos)' }),
    item({ fonte: 'categoria', fonteId: 'barbearia:revenda', nome: 'barbearia:revenda', grupo: 'Padrão de categoria', origemRotulo: 'Padrão de categoria', situacao: 'erro', classificacao: { tipo: 'produto', ncm: '33059000', cfop: '5405', csosn: '500', cest: '2000500' }, erros: [{ campo: 'cest', mensagem: 'CEST 20.005.00 (Lubrificação íntima) não abrange o NCM 3305.90.00.' }], busca: 'barbearia:revenda padrao de categoria 33059000 2000500' }),
    item({ fonte: 'est_item', fonteId: 'e1', nome: 'Presunto Cozido · FRI-002', grupo: 'Estoque · Frios', origemRotulo: 'Estoque / barbearia', situacao: 'sem', classificacao: null, sugestoes: [{ origem: 'cadastro', ncm: '65050090', descricao: 'Chapéus e outros artigos › Outros', valido: true }], busca: 'presunto cozido fri-002 estoque frios 65050090 chapeus' }),
    item({ fonte: 'loja_variante', fonteId: 'v2', nome: 'Café Espresso', grupo: 'Bar · Bebidas', origemRotulo: 'Bar', situacao: 'aviso', classificacao: { tipo: 'produto', ncm: '21011110', cfop: '5102', csosn: '102' }, avisos: [{ campo: 'cest', mensagem: 'Este NCM está no Convênio ICMS 142/2018.' }], busca: 'cafe espresso bar bebidas 21011110 5102 csosn 102' }),
    item({ fonte: 'servico', fonteId: 'srv-1', nome: 'Corte degradê', grupo: 'Barbearia · Serviços', origemRotulo: 'Serviço', tipo: 'servico', situacao: 'ok', orfa: true, classificacao: { tipo: 'servico', cTribNac: '060101', aliquotaIss: 2 }, descricao: { servico: '06.01 Barbearia, cabeleireiros' }, busca: 'corte degrade barbearia servicos srv-1 060101 barbearia, cabeleireiros' }),
  ],
}
const referenciasBase = {
  csosn: [{ codigo: '102', descricao: 'Tributada sem permissão de crédito' }, { codigo: '500', descricao: 'ICMS cobrado anteriormente por ST' }],
  cstIcms: [{ codigo: '00', descricao: 'Tributada integralmente' }, { codigo: '60', descricao: 'ICMS cobrado anteriormente por ST' }],
  cstPisCofins: [{ codigo: '49', descricao: 'Outras operações de saída' }],
  unidades: [{ codigo: 'UN', descricao: 'Unidade' }, { codigo: 'KG', descricao: 'Quilograma' }],
  cfopsUsuais: [{ codigo: '5102', descricao: 'Venda de mercadoria adquirida' }, { codigo: '5405', descricao: 'Venda com ST (substituído)' }],
}
let conferencia = { erros: [], avisos: [] }
function respostas(url) {
  const [rota, qs = ''] = url.split('?')
  const p = new URLSearchParams(qs)
  if (rota.endsWith('/classificacoes/analise')) return analise
  if (rota.endsWith('/classificacoes/perfis')) return [{ id: 'sn_revenda_st', nome: 'Simples · revenda com ST', regime: 'simples', valores: { cfop: '5405', csosn: '500', cstPis: '49', cstCofins: '49' } }, { id: 'lp_st', nome: 'Lucro presumido · ST', regime: 'normal', valores: { cfop: '5405', cstIcms: '60' } }]
  if (rota.endsWith('/classificacoes/referencias')) {
    if (p.get('tipo') === 'ncm') return { itens: [{ codigo: '33051000', formatado: '3305.10.00', caminho: 'Preparações capilares › Xampus' }] }
    if (p.get('tipo') === 'ncm-detalhe') return { ncm: { codigo: p.get('q'), caminho: p.get('q') === '33051000' ? 'Preparações capilares › Xampus' : 'Chapéus › Outros' }, cests: p.get('q') === '33051000' ? [{ codigo: '2001700', formatado: '20.017.00', descricao: 'Xampus para o cabelo' }] : [] }
    if (p.get('tipo') === 'servico') return { itens: [{ codigo: '060101', item: '06.01', descricao: 'Barbearia, cabeleireiros, manicuros, pedicuros e congêneres.' }] }
    return referenciasBase
  }
  return []
}
async function montar() {
  mocks.api.get.mockImplementation(async (url) => respostas(url))
  mocks.api.post.mockImplementation(async (url) => (url.endsWith('/conferir') ? conferencia : { aplicadas: 1 }))
  mocks.api.put.mockResolvedValue({})
  let tree
  await act(async () => { tree = create(createElement(ClassificacaoFiscal, { toast: vi.fn() })) })
  return tree
}
const juntar = (n) => (n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(juntar).join('') : (n.children || []).map(juntar).join(''))
const texto = (tree) => juntar(tree.toJSON())
const textoDe = (n) => (typeof n === 'string' ? n : (n.children || []).map(textoDe).join(''))
const botoes = (tree, inicio) => tree.root.findAll((n) => n.type === 'button' && textoDe(n).startsWith(inicio))
const campo = (tree, aria) => tree.root.find((n) => n.props && n.props['aria-label'] === aria && ['input', 'select'].includes(n.type))
const linhas = (tree) => tree.root.findAll((n) => n.type === 'tr').length - 1
const esperar = async (ms = 400) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }

describe('Classificação fiscal: pesquisa completa e cadastro conferido', () => {
  beforeEach(() => { vi.clearAllMocks(); conferencia = { erros: [], avisos: [] }; try { globalThis.localStorage?.clear?.() } catch { /* sem armazenamento */ } })
  afterEach(() => { vi.useRealTimers() })

  it('mostra contagens por situação e problemas primeiro; filtra por situação, origem e tipo', async () => {
    const tree = await montar()
    const s = texto(tree)
    expect(s).toContain('Com erro')
    expect(s).toContain('(1)')
    expect(mocks.api.get).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes/analise')
    expect(linhas(tree)).toBe(5)
    // ordem: erro, sem, aviso, ok
    const primeiro = tree.root.findAll((n) => n.type === 'strong')[0]
    expect(primeiro.children.join('')).toContain('Revenda da barbearia')
    await act(async () => { botoes(tree, 'Com erro')[0].props.onClick() })
    expect(linhas(tree)).toBe(1)
    expect(texto(tree)).toContain('Lubrificação íntima')
    await act(async () => { botoes(tree, 'Todas')[0].props.onClick() })
    await act(async () => { campo(tree, 'Tipo').props.onChange({ target: { value: 'servico' } }) })
    expect(linhas(tree)).toBe(1)
    expect(texto(tree)).toContain('Corte degradê')
    await act(async () => { campo(tree, 'Tipo').props.onChange({ target: { value: 'todos' } }) })
    await act(async () => { campo(tree, 'Origem do item').props.onChange({ target: { value: 'Loja online' } }) })
    expect(linhas(tree)).toBe(1)
    await act(async () => { botoes(tree, 'Limpar filtros')[0].props.onClick() })
    expect(linhas(tree)).toBe(5)
  })

  it('busca por NCM formatado, CSOSN, descrição oficial e sem acento', async () => {
    const tree = await montar()
    const buscar = async (q) => { await act(async () => { campo(tree, 'Buscar na classificação').props.onChange({ target: { value: q } }) }) }
    await buscar('3303.00.10'); expect(linhas(tree)).toBe(1); expect(texto(tree)).toContain('Perfume Asad')
    await buscar('csosn 102'); expect(linhas(tree)).toBe(1); expect(texto(tree)).toContain('Café Espresso')
    await buscar('chapeus'); expect(linhas(tree)).toBe(1); expect(texto(tree)).toContain('Presunto')
    await buscar('degrade'); expect(linhas(tree)).toBe(1)
    await buscar('060101 barbearia'); expect(linhas(tree)).toBe(1)
    await buscar('nada-disso'); expect(texto(tree)).toContain('Nenhum item com esses filtros.')
  })

  it('cadastro do produto: NCM com descrição oficial, CEST do NCM, CSOSN pelo regime e erro bloqueia o salvar', async () => {
    const tree = await montar()
    await act(async () => { campo(tree, 'Buscar na classificação').props.onChange({ target: { value: 'presunto' } }) })
    await act(async () => { botoes(tree, 'Classificar')[1].props.onClick() })
    // NCM do cadastro já vem preenchido e mostra o que ele é de verdade
    expect(campo(tree, 'NCM').props.value).toBe('65050090')
    await esperar()
    expect(texto(tree)).toContain('Chapéus')
    // Simples: só CSOSN (sem CST)
    expect(tree.root.findAll((n) => n.props && n.props['aria-label'] === 'CST do ICMS').length).toBe(0)
    // pesquisa na tabela oficial e escolha do NCM certo
    await act(async () => { botoes(tree, 'Pesquisar NCM')[0].props.onClick() })
    await act(async () => { campo(tree, 'Pesquisar NCM (descrição ou código)').props.onChange({ target: { value: 'xampu' } }) })
    await esperar()
    await act(async () => { botoes(tree, '3305.10.00')[0].props.onClick() })
    expect(campo(tree, 'NCM').props.value).toBe('33051000')
    await esperar()
    expect(texto(tree)).toContain('20.017.00 · Xampus para o cabelo')
    // conferência com erro: botão Salvar desabilitado e mensagem no campo
    conferencia = { erros: [{ campo: 'cest', mensagem: 'Com substituição tributária (CSOSN 500 / CST 60) o CEST é obrigatório.' }], avisos: [] }
    await act(async () => { campo(tree, 'CSOSN').props.onChange({ target: { value: '500' } }) })
    await esperar()
    const salvar = () => tree.root.findAll((n) => n.type === 'button' && n.props.type === 'submit')[0]
    expect(salvar().props.disabled).toBe(true)
    expect(texto(tree)).toContain('o CEST é obrigatório')
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes/conferir', expect.objectContaining({ ncm: '33051000', csosn: '500', fonte: 'est_item', fonteId: 'e1' }))
    // corrigido: grava
    conferencia = { erros: [], avisos: [] }
    await act(async () => { campo(tree, 'CEST').props.onChange({ target: { value: '2001700' } }) })
    await act(async () => { campo(tree, 'CFOP').props.onChange({ target: { value: '5405' } }) })
    await esperar()
    expect(salvar().props.disabled).toBe(false)
    expect(texto(tree)).toContain('nenhum problema')
    const form = tree.root.findAll((n) => n.type === 'form')[0]
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.put).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes', expect.objectContaining({ fonte: 'est_item', fonteId: 'e1', tipo: 'produto', ncm: '33051000', cest: '2001700', cfop: '5405', csosn: '500' }))
    expect(mocks.api.put.mock.calls[0][1].sugestoes).toBeUndefined()
  })

  it('cadastro do serviço: cTribNac pela Lista de Serviços Nacional', async () => {
    const tree = await montar()
    await act(async () => { botoes(tree, '+ Serviço (NFS-e)')[0].props.onClick() })
    await act(async () => { campo(tree, 'Código interno do serviço').props.onChange({ target: { value: 'barba-premium' } }) })
    await act(async () => { botoes(tree, 'Pesquisar na Lista de Serviços Nacional')[0].props.onClick() })
    await act(async () => { campo(tree, 'Pesquisar serviço (descrição ou código)').props.onChange({ target: { value: 'barbearia' } }) })
    await esperar()
    await act(async () => { botoes(tree, '060101 · 06.01')[0].props.onClick() })
    expect(campo(tree, 'cTribNac').props.value).toBe('060101')
    await esperar()
    expect(texto(tree)).toContain('06.01 · Barbearia, cabeleireiros')
    await act(async () => { campo(tree, 'Alíquota do ISS').props.onChange({ target: { value: '2' } }) })
    await esperar()
    const form = tree.root.findAll((n) => n.type === 'form')[0]
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.put).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes', expect.objectContaining({ fonte: 'servico', fonteId: 'barba-premium', tipo: 'servico', cTribNac: '060101', aliquotaIss: '2' }))
  })

  it('lote: só produtos são marcáveis e a conferência também vale para o lote', async () => {
    const tree = await montar()
    const marcaveis = tree.root.findAll((n) => n.type === 'input' && n.props.type === 'checkbox' && String(n.props['aria-label']).startsWith('Marcar ') && n.props['aria-label'] !== 'Marcar todos os visíveis')
    expect(marcaveis.length).toBe(3) // sem serviço e sem padrão de categoria
    await act(async () => { marcaveis.find((m) => m.props['aria-label'].includes('Presunto')).props.onChange() })
    await act(async () => { botoes(tree, 'Classificar selecionados (1)')[0].props.onClick() })
    await act(async () => { campo(tree, 'Perfil fiscal').props.onChange({ target: { value: 'sn_revenda_st' } }) })
    await act(async () => { campo(tree, 'NCM').props.onChange({ target: { value: '33051000' } }) })
    await esperar()
    // perfil de regime normal não aparece para empresa do Simples
    expect(texto(tree)).not.toContain('Lucro presumido · ST')
    const form = tree.root.findAll((n) => n.type === 'form')[0]
    await act(async () => { await form.props.onSubmit({ preventDefault() {} }) })
    expect(mocks.api.post).toHaveBeenCalledWith('/api/admin/fiscal/classificacoes/lote', { itens: [{ fonte: 'est_item', fonteId: 'e1' }], classificacao: expect.objectContaining({ ncm: '33051000', cfop: '5405', csosn: '500' }) })
  })
})
