import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: mock.post }, fmtR: value => `VALOR ${value}` }))
import CommerceCatalogImport from './CommerceCatalogImport'
const scope = { empresaId: 'company-a', lojaId: 'unit-a', storefrontId: 'sf-a', locationId: 'loc-a' }
const props = { mode: 'core', empresaId: scope.empresaId, unitId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId }
const csv = 'id_origem,sku,ean,ncm,custo,unidade,nome\nAV-1,SKU-1,0012345678905,22030000,,UN,Fixture\n'
const response = (s = scope) => ({ mode: 'read-only-avec-catalog-preview', write: { performed: false }, scope: s, datasetHash: 'a'.repeat(64), summary: { total: 1, proposable: 1, conflict: 0, ambiguous: 0, absent: 0, noChange: 0, costMissing: 1, costZero: 0 }, items: [{ line: 1, sourceId: 'AV-1', sku: 'SKU-1', ean: '0012345678905', ncm: '22030000', custoInformado: false, custoCents: null, unidade: 'UN', status: 'proposable', reasons: [] }] })
const text = child => typeof child === 'string' ? child : Array.isArray(child) ? child.map(text).join(' ') : text(child?.props?.children || child?.children || '')
let ui
const tick = () => new Promise(r => setTimeout(r, 0))
async function mount(p = props) { await act(async () => { ui = create(<CommerceCatalogImport {...p} />); await tick() }) }
const button = () => ui.root.findAllByType('button').find(x => text(x.props.children).includes('Gerar prévia AVEC'))
const fileInput = () => ui.root.findAllByType('input').filter(x => x.props.type === 'file')[1]
async function select(content = csv) { await act(async () => { await fileInput().props.onChange({ target: { files: [{ name: 'fixture.csv', size: 200, text: async () => content }], value: 'fixture' } }); await tick() }) }
async function preview() { await act(async () => { button().props.onClick(); await tick() }) }
beforeEach(() => { mock.post.mockReset(); globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (ui) await act(async () => ui.unmount()); ui = null })
describe('prévia AVEC no catálogo existente', () => {
  it('abre sem consulta, só aceita prévia read-only e custo ausente não vira zero', async () => {
    await mount(); expect(mock.post).not.toHaveBeenCalled()
    expect(text(ui.toJSON())).toContain('Enriquecer catálogo com AVEC')
    await select(); mock.post.mockResolvedValue(response()); await preview()
    expect(mock.post.mock.calls[0][0]).toBe('/api/admin/commerce/catalog/avec/preview')
    expect(text(ui.toJSON())).toContain('Não informado')
    expect(text(ui.toJSON())).not.toContain('Executar enriquecimento')
    expect(mock.post.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal)
  })
  it('recusa resposta de outra empresa ou unidade', async () => {
    await mount(); await select(); mock.post.mockResolvedValue(response({ ...scope, empresaId: 'company-b' })); await preview()
    expect(text(ui.toJSON())).toContain('saiu do escopo')
    expect(text(ui.toJSON())).not.toContain('Fingerprint')
  })
  it('mudança de unidade aborta resposta antiga, limpa arquivo e não mantém carregamento', async () => {
    let resolve; mock.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount(); await select(); await preview()
    const signal = mock.post.mock.calls[0][2].signal
    await act(async () => { ui.update(<CommerceCatalogImport {...props} unitId="unit-b" />); await tick() })
    await act(async () => { resolve(response()); await tick() })
    expect(signal.aborted).toBe(true)
    expect(text(ui.toJSON())).not.toContain('fixture.csv')
    expect(text(ui.toJSON())).not.toContain('Fingerprint')
    expect(button().props.disabled).toBe(true)
  })
  it('selecionar arquivo novo invalida a resposta de prévia anterior', async () => {
    let resolve; mock.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount(); await select(); await preview(); await select(csv.replace('SKU-1', 'SKU-2'))
    await act(async () => { resolve(response()); await tick() })
    expect(text(ui.toJSON())).not.toContain('Fingerprint')
    expect(button().props.disabled).toBe(false)
  })
  it('arquivo cuja leitura termina depois de trocar a empresa é descartado', async () => {
    let resolve; let task
    await mount()
    await act(async () => { task = fileInput().props.onChange({ target: { files: [{ name: 'old.csv', size: 200, text: () => new Promise(r => { resolve = r }) }], value: 'fixture' } }); await tick() })
    await act(async () => { ui.update(<CommerceCatalogImport {...props} empresaId="company-b" />); await tick(); resolve(csv); await task })
    expect(text(ui.toJSON())).not.toContain('old.csv')
    expect(mock.post).not.toHaveBeenCalled()
  })
  it('resposta incompleta e erro de rede mostram erro, não crash/sucesso', async () => {
    await mount(); await select(); mock.post.mockResolvedValue({ scope }); await preview()
    expect(text(ui.toJSON())).toContain('incompleta ou inválida')
    mock.post.mockRejectedValue(new Error('Fixture indisponível')); await preview()
    expect(text(ui.toJSON())).toContain('Fixture indisponível')
    expect(button().props.disabled).toBe(false)
  })
  it('sem unidade explícita não consulta', async () => {
    await mount({ ...props, unitId: '' }); await select(); await preview()
    expect(mock.post).not.toHaveBeenCalled()
  })
})
