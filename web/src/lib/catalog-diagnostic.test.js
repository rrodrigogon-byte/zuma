import assert from 'node:assert/strict'
import test from 'node:test'
import {
  diagnosticContext,
  diagnosticContextKey,
  diagnosticContextReady,
  diagnosticGuidance,
  diagnosticHeaders,
  diagnosticPath,
  mappedRateLabel,
  normalizeCatalogDiagnostic,
} from './catalog-diagnostic.js'

const scope = { mode: 'core', empresaId: 'empresa-1', unitId: 'unidade-1', storefrontId: 'storefront-1', canReadReports: true }
const report = (summary = {}, extra = {}) => ({ catalogDiagnostic: { mode: 'read-only-diagnostic', summary: { sourceItems: 4, mapped: 3, aligned: 1, divergent: 1, ambiguous: 0, unmapped: 1, notVerified: 1, coreOnly: 0, outOfScope: 0, ...summary }, items: [], ...extra } })

test('contexto core completo fica pronto', () => assert.equal(diagnosticContextReady(scope), true))
test('modo legacy não fica pronto', () => assert.equal(diagnosticContextReady({ ...scope, mode: 'legacy' }), false))
test('empresa, unidade ou storefront ausente bloqueia leitura', () => assert.equal(diagnosticContextReady({ ...scope, unitId: '' }), false))
test('permissão reports.read é capacidade de UI, não segurança', () => assert.equal(diagnosticContextReady({ ...scope, canReadReports: false }), false))
test('chave de contexto muda ao trocar empresa/unidade/storefront', () => assert.notEqual(diagnosticContextKey(scope), diagnosticContextKey({ ...scope, storefrontId: 'storefront-2' })))
test('path usa storefront na query e headers limitados ao contexto', () => {
  assert.equal(diagnosticPath('storefront/1'), '/api/admin/commerce/operations/inventory-divergence?storefrontId=storefront%2F1')
  assert.deepEqual(diagnosticHeaders({ empresaId: 'e', unitId: 'u' }), { Authorization: '', 'X-Empresa-Id': 'e', 'X-Loja-Id': 'u' })
})
test('payload rico normaliza resumo e taxa com denominador válido', () => {
  const normalized = normalizeCatalogDiagnostic(report())
  assert.equal(normalized.kind, 'ready')
  assert.equal(normalized.summary.mapped, 3)
  assert.equal(normalized.mappedRate, .75)
  assert.equal(normalized.rows.length, 7)
})
test('resposta incompleta é indisponível, não zero', () => assert.deepEqual(normalizeCatalogDiagnostic({ catalogDiagnostic: { mode: 'read-only-diagnostic', summary: {}, items: [] } }), { kind: 'unavailable', reason: 'incomplete' }))
test('resumo inconsistente é indisponível', () => assert.equal(normalizeCatalogDiagnostic(report({ mapped: 4, aligned: 1, divergent: 0, ambiguous: 0, notVerified: 0 })).kind, 'unavailable'))
test('zero itens não recebe taxa artificial', () => {
  const normalized = normalizeCatalogDiagnostic(report({ sourceItems: 0, mapped: 0, aligned: 0, divergent: 0, ambiguous: 0, unmapped: 0, notVerified: 0, coreOnly: 0, outOfScope: 0 }))
  assert.equal(normalized.mappedRate, null)
  assert.equal(mappedRateLabel(null), '—')
})
test('zero divergência com não verificáveis não vira consistente tudo', () => {
  const message = diagnosticGuidance({ sourceItems: 3, divergent: 0, unmapped: 2, ambiguous: 0, notVerified: 0 })
  assert.match(message, /não está totalmente verificável/i)
  assert.doesNotMatch(message, /consistente/i)
})

test('total de mapeados e sem vínculo deve cobrir origem exatamente', () => {
  assert.equal(normalizeCatalogDiagnostic(report({ sourceItems: 5 })).kind, 'unavailable')
  assert.equal(normalizeCatalogDiagnostic(report({ unmapped: 2 })).kind, 'unavailable')
})
test('itens somente no Commerce não viram alinhamento dos canais', () => {
  assert.match(diagnosticGuidance({ sourceItems: 3, mapped: 3, aligned: 3, divergent: 0, coreOnly: 2 }), /revise a cobertura/i)
})
test('números negativos, fracionados e acima do inteiro seguro são não verificáveis', () => {
  for (const value of [-1, .5, Number.MAX_SAFE_INTEGER + 1, 'NaN']) {
    assert.equal(normalizeCatalogDiagnostic(report({ sourceItems: value })).kind, 'unavailable')
  }
})

const commonScope = { empresaId: 'empresa-1', lojaId: 'unidade-1', storefrontId: 'storefront-1' }
function commonPayload() {
  const value = report({ sourceItems: 2, mapped: 1, aligned: 1, divergent: 0, ambiguous: 0, notVerified: 0, unmapped: 1 }, { scope: commonScope })
  value.catalogDiagnostic.commonRead = {
    mode: 'read-only-common-catalog', scope: commonScope,
    summary: { sourceItems: 2, available: 1, blocked: 0, unavailable: 1, outOfScope: 0, reasonCounts: { NO_EXACT_MAPPING: 1 } },
    items: [
      { status: 'available', source: 'legacy', sku: 'PRIVATE-SKU-CANARY', variantId: 'PRIVATE-VARIANT-CANARY', priceCents: 9999, stockAvailable: 2, sourceStockAvailable: 2, matchedBy: 'id', reasons: [], scope: commonScope, token: 'PRIVATE-TOKEN-CANARY' },
      { status: 'unavailable', sku: null, variantId: null, priceCents: null, stockAvailable: null, sourceStockAvailable: null, reasons: ['NO_EXACT_MAPPING'] },
    ],
  }
  return value
}
test('leitura comum normaliza somente contagens e motivos, sem SKU/preço/token ou valores brutos', () => {
  const normalized = normalizeCatalogDiagnostic(commonPayload(), commonScope)
  assert.equal(normalized.kind, 'ready')
  assert.equal(normalized.common.summary.available, 1)
  assert.equal(normalized.common.reasons[0].count, 1)
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE-|9999|priceCents|stockAvailable/)
})
test('payload antigo sem leitura comum continua utilizável, sem consenso inventado', () => {
  const normalized = normalizeCatalogDiagnostic(report())
  assert.equal(normalized.kind, 'ready')
  assert.equal(normalized.common, null)
  assert.equal(normalized.commonUnavailable, false)
})
test('DTO comum incompleto ou agregado divergente não invalida resumo antigo nem vira zero', () => {
  for (const change of [value => { value.catalogDiagnostic.commonRead.items.pop() }, value => { value.catalogDiagnostic.commonRead.summary.available = 2 }]) {
    const value = commonPayload(); change(value)
    const normalized = normalizeCatalogDiagnostic(value, commonScope)
    assert.equal(normalized.kind, 'ready')
    assert.equal(normalized.summary.sourceItems, 2)
    assert.equal(normalized.common, null)
    assert.equal(normalized.commonUnavailable, true)
  }
})
test('escopo comum divergente é indisponível e escopo raiz divergente é rejeitado contra o pedido', () => {
  const value = commonPayload()
  value.catalogDiagnostic.commonRead.scope = { ...commonScope, lojaId: 'other-unit' }
  assert.equal(normalizeCatalogDiagnostic(value, commonScope).commonUnavailable, true)
  assert.deepEqual(normalizeCatalogDiagnostic(commonPayload(), { ...commonScope, empresaId: 'other-company' }), { kind: 'unavailable', reason: 'context' })
})
test('item bloqueado com dados individuais indevidos invalida somente a leitura comum', () => {
  const value = commonPayload()
  value.catalogDiagnostic.commonRead.items[1].sku = 'PRIVATE-BLOCKED-CANARY'
  const normalized = normalizeCatalogDiagnostic(value, commonScope)
  assert.equal(normalized.kind, 'ready')
  assert.equal(normalized.commonUnavailable, true)
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE-/)
})
test('motivos agregados devem corresponder aos itens e ordem das chaves não muda o resultado', () => {
  const value = commonPayload()
  const common = value.catalogDiagnostic.commonRead
  common.summary.available = 0; common.summary.blocked = 1
  common.items[0] = { status: 'blocked', reasons: ['CORE_UNIT_MISSING', 'UNIT_NOT_COMPARABLE'], sku: null, variantId: null, priceCents: null, stockAvailable: null, sourceStockAvailable: null }
  common.summary.reasonCounts = { UNIT_NOT_COMPARABLE: 1, NO_EXACT_MAPPING: 1, CORE_UNIT_MISSING: 1 }
  assert.equal(normalizeCatalogDiagnostic(value, commonScope).common.summary.blocked, 1)
  common.summary.reasonCounts.CORE_UNIT_MISSING = 2
  assert.equal(normalizeCatalogDiagnostic(value, commonScope).commonUnavailable, true)
})
test('zero registros reais permanece vazio explícito na leitura comum', () => {
  const value = report({ sourceItems: 0, mapped: 0, aligned: 0, divergent: 0, ambiguous: 0, notVerified: 0, unmapped: 0 }, { scope: commonScope })
  value.catalogDiagnostic.commonRead = { mode: 'read-only-common-catalog', scope: commonScope, summary: { sourceItems: 0, available: 0, blocked: 0, unavailable: 0, outOfScope: 0, reasonCounts: {} }, items: [] }
  const normalized = normalizeCatalogDiagnostic(value, commonScope)
  assert.equal(normalized.common.summary.sourceItems, 0)
  assert.equal(normalized.mappedRate, null)
})
