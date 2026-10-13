import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: apiMock }))

import CommerceCatalogDiagnostic from './CommerceCatalogDiagnostic'

const scope = { mode: 'core', empresaId: 'empresa-1', unitId: 'unidade-1', storefrontId: 'storefront-1', canReadReports: true }
const payload = (summary = {}, selected = scope) => ({ catalogDiagnostic: { mode: 'read-only-diagnostic', scope: { empresaId: selected.empresaId, lojaId: selected.unitId, storefrontId: selected.storefrontId }, summary: { sourceItems: 2, mapped: 2, aligned: 1, divergent: 1, ambiguous: 0, unmapped: 0, notVerified: 0, coreOnly: 0, outOfScope: 0, ...summary }, items: [] } })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ')
const button = renderer => renderer.root.findAllByType('button')[0]

beforeEach(() => {
  apiMock.get.mockReset()
  globalThis.localStorage = { getItem: vi.fn(() => 'token-snapshot') }
})
afterEach(() => { delete globalThis.localStorage })

describe('CommerceCatalogDiagnostic', () => {
  it('não consulta no mount: abertura é opt-in', async () => {
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    expect(apiMock.get).not.toHaveBeenCalled()
    expect(text(renderer.root)).toContain('Abrir diagnóstico')
  })
  it('faz somente GET com path storefront e headers de contexto no clique', async () => {
    apiMock.get.mockResolvedValue(payload())
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    expect(apiMock.get).toHaveBeenCalledWith('/api/admin/commerce/operations/inventory-divergence?storefrontId=storefront-1', expect.objectContaining({ signal: expect.any(AbortSignal), headers: { Authorization: 'Bearer token-snapshot', 'X-Empresa-Id': 'empresa-1', 'X-Loja-Id': 'unidade-1' } }))
    expect(text(renderer.root)).toContain('Divergências')
  })
  it('renderiza resumo agregado sem items, preço ou ids', async () => {
    apiMock.get.mockResolvedValue({ catalogDiagnostic: { ...payload({ aligned: 2, divergent: 0 }).catalogDiagnostic, items: [{ id: 'PRIVATE-ITEM-CANARY', sku: 'SKU-PRIVATE-CANARY', price: 99, token: 'SECRET-RESPONSE-CANARY' }] } })
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    const rendered = text(renderer.root)
    expect(rendered).toContain('Itens de origem')
    expect(rendered).toContain('Mapeados')
    expect(rendered).not.toContain('SKU-')
    expect(rendered).not.toContain('R$')
    expect(rendered).not.toContain('PRIVATE-ITEM-CANARY')
    expect(rendered).not.toContain('SECRET-RESPONSE-CANARY')
  })
  it('mostra orientação de não verificação quando divergência é zero mas há unmapped', async () => {
    apiMock.get.mockResolvedValue(payload({ aligned: 0, divergent: 0, mapped: 0, unmapped: 2 }))
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    expect(text(renderer.root)).toMatch(/não está totalmente verificável/i)
  })
  it('não habilita consulta sem contexto completo', async () => {
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} unitId="" />) })
    expect(button(renderer).props.disabled).toBe(true)
    await act(async () => { button(renderer).props.onClick() })
    expect(apiMock.get).not.toHaveBeenCalled()
  })
  it('não habilita consulta sem reports.read', async () => {
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} canReadReports={false} />) })
    expect(button(renderer).props.disabled).toBe(true)
    expect(text(renderer.root)).toContain('Abrir diagnóstico')
  })
  it('distingue resposta incompleta de zero', async () => {
    apiMock.get.mockResolvedValue({ catalogDiagnostic: { mode: 'read-only-diagnostic', summary: {}, items: [] } })
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    expect(text(renderer.root)).toMatch(/resposta do diagnóstico veio incompleta/i)
    expect(text(renderer.root)).not.toContain('Itens de origem')
  })
  it('mostra erro 403 como sem permissão e não tenta POST', async () => {
    apiMock.get.mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }))
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    expect(text(renderer.root)).toMatch(/não possui reports.read/i)
  })
  it('aborta consulta pendente ao desmontar', async () => {
    let resolve
    apiMock.get.mockImplementation((_path, options) => new Promise(done => { resolve = () => done(payload()); options.signal.addEventListener('abort', () => {}) }))
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    await act(async () => { renderer.unmount() })
    expect(apiMock.get.mock.calls[0][1].signal.aborted).toBe(true)
    resolve?.()
  })
  it('descarta resposta atrasada após troca de storefront', async () => {
    const flights = []
    apiMock.get.mockImplementation((path, options) => new Promise(resolve => flights.push({ path, options, resolve })))
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    await act(async () => { renderer.update(<CommerceCatalogDiagnostic {...scope} storefrontId="storefront-2" />) })
    await act(async () => { button(renderer).props.onClick() })
    await act(async () => { flights[0].resolve(payload({ divergent: 9 })) })
    await tick()
    expect(text(renderer.root)).not.toContain('9')
    await act(async () => { flights[1].resolve(payload({ aligned: 2, divergent: 0 }, { ...scope, storefrontId: 'storefront-2' })) })
    await tick()
    expect(text(renderer.root)).toContain('Alinhados')
  })
})

for (const [key, next] of [['empresaId', 'empresa-2'], ['unitId', 'unidade-2']]) {
  it(`limpa e descarta resposta antiga ao trocar ${key}`, async () => {
    let resolveOld
    apiMock.get.mockImplementation(() => new Promise(resolve => { resolveOld = resolve }))
    let renderer
    await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
    await act(async () => { button(renderer).props.onClick() })
    const previousSignal = apiMock.get.mock.calls[0][1].signal
    await act(async () => { renderer.update(<CommerceCatalogDiagnostic {...scope} {...{ [key]: next }} />) })
    expect(previousSignal.aborted).toBe(true)
    await act(async () => { resolveOld(payload()) })
    expect(text(renderer.root)).not.toContain('Itens de origem')
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    await act(async () => { renderer.unmount() })
  })
}

it('renderiza leitura comum apenas agregada e sem oferta, SKU/preço/token', async () => {
  const value = payload({ aligned: 1, divergent: 0, mapped: 1, unmapped: 1 })
  const selected = value.catalogDiagnostic.scope
  value.catalogDiagnostic.commonRead = {
    mode: 'read-only-common-catalog', scope: selected,
    summary: { sourceItems: 2, available: 1, blocked: 0, unavailable: 1, outOfScope: 0, reasonCounts: { NO_EXACT_MAPPING: 1 } },
    items: [
      { status: 'available', reasons: [], scope: selected, matchedBy: 'id', sku: 'PRIVATE-COMMON-SKU', variantId: 'PRIVATE-COMMON-VARIANT', priceCents: 9999, stockAvailable: 2, sourceStockAvailable: 2, token: 'PRIVATE-COMMON-TOKEN' },
      { status: 'unavailable', reasons: ['NO_EXACT_MAPPING'], sku: null, variantId: null, priceCents: null, stockAvailable: null, sourceStockAvailable: null },
    ],
  }
  apiMock.get.mockResolvedValue(value)
  let renderer
  await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
  await act(async () => { button(renderer).props.onClick() })
  const rendered = text(renderer.root)
  expect(rendered).toContain('Correspondência verificável para comparação')
  expect(rendered).toContain('não é oferta nem autorização de venda')
  expect(rendered).not.toContain('PRIVATE-')
  expect(rendered).not.toContain('R$')
  expect(rendered).not.toContain('9999')
  expect(apiMock.get).toHaveBeenCalledTimes(1)
  await act(async () => { renderer.unmount() })
})
it('resposta fora da empresa/unidade/vitrine pedida não apresenta contagens', async () => {
  apiMock.get.mockResolvedValue(payload({}, { ...scope, empresaId: 'empresa-externa' }))
  let renderer
  await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
  await act(async () => { button(renderer).props.onClick() })
  expect(text(renderer.root)).not.toContain('Itens de origem')
  expect(text(renderer.root)).toContain('Diagnóstico não verificável')
  await act(async () => { renderer.unmount() })
})
it('leitura comum malformada preserva diagnóstico anterior sem zero confiável', async () => {
  const value = payload()
  value.catalogDiagnostic.commonRead = { mode: 'read-only-common-catalog', scope: value.catalogDiagnostic.scope, summary: {}, items: [] }
  apiMock.get.mockResolvedValue(value)
  let renderer
  await act(async () => { renderer = create(<CommerceCatalogDiagnostic {...scope} />) })
  await act(async () => { button(renderer).props.onClick() })
  expect(text(renderer.root)).toContain('Itens de origem')
  expect(text(renderer.root)).toContain('não pôde ser verificada')
  expect(text(renderer.root)).not.toContain('Disponíveis para comparação')
  await act(async () => { renderer.unmount() })
})
