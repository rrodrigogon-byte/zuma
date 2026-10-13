const SUMMARY_KEYS = [
  'sourceItems',
  'mapped',
  'aligned',
  'divergent',
  'ambiguous',
  'unmapped',
  'notVerified',
  'coreOnly',
  'outOfScope',
]
const COMMON_SUMMARY_KEYS = ['sourceItems', 'available', 'blocked', 'unavailable', 'outOfScope']
const COMMON_REASON_LABELS = {
  NO_EXACT_MAPPING: 'Sem correspondência exata',
  AMBIGUOUS_MAPPING: 'Mais de uma correspondência exata',
  DUPLICATE_CORE_SKU: 'SKU duplicado no Commerce',
  DUPLICATE_SOURCE_IDENTIFIER: 'Identificador duplicado na origem',
  DUPLICATE_VARIANT_MAPPING: 'Variante vinculada mais de uma vez',
  DUPLICATE_VARIANT_CONFLICT: 'Valores conflitantes para a mesma variante',
  VARIANT_ID_MISSING: 'Variante sem identificador verificável',
  CORE_SKU_MISSING: 'SKU Commerce ausente',
  SOURCE_SCOPE_MISSING: 'Escopo da origem ausente',
  CORE_SCOPE_MISSING: 'Escopo Commerce ausente',
  STOREFRONT_MISSING: 'Storefront ausente',
  STOREFRONT_MISMATCH: 'Storefront divergente',
  SKU_MISMATCH: 'SKU divergente',
  SOURCE_UNIT_MISSING: 'Unidade da origem ausente',
  CORE_UNIT_MISSING: 'Unidade Commerce ausente',
  UNIT_NOT_COMPARABLE: 'Unidade não comparável',
  UNIT_MISMATCH: 'Unidades diferentes',
  CORE_PRODUCT_STATUS_MISSING: 'Status do produto ausente',
  CORE_PRODUCT_NOT_ACTIVE: 'Produto Commerce não ativo',
  CORE_VARIANT_ACTIVE_MISSING: 'Estado da variante ausente',
  CORE_VARIANT_NOT_ACTIVE: 'Variante Commerce não ativa',
  CORE_PUBLISHED_MISSING: 'Publicação da vitrine ausente',
  CORE_NOT_PUBLISHED: 'Item não publicado na vitrine',
  GLOBAL_STOCK: 'Estoque global não comparável',
  SOURCE_PRICE_MISSING: 'Preço da origem ausente',
  PROMOTIONAL_PRICE_INVALID: 'Promoção inválida',
  STOREFRONT_PRICE_MISSING: 'Preço da vitrine ausente',
  PRICE_DIVERGENCE: 'Preços divergentes',
  SOURCE_STOCK_MISSING: 'Estoque da origem ausente',
  STOREFRONT_STOCK_MISSING: 'Estoque da vitrine ausente',
  STOCK_DIVERGENCE: 'Estoques divergentes',
}

export const DIAGNOSTIC_STATUS_ROWS = [
  { key: 'aligned', label: 'Alinhados', detail: 'Itens comparáveis sem diferença observada.' },
  { key: 'divergent', label: 'Divergentes', detail: 'Itens comparáveis com diferença de preço ou estoque.' },
  { key: 'ambiguous', label: 'Ambíguos', detail: 'Há mais de uma possibilidade de vínculo exato.' },
  { key: 'unmapped', label: 'Sem mapeamento', detail: 'Não existe vínculo exato; isso não indica criação de produto.' },
  { key: 'notVerified', label: 'Não verificáveis', detail: 'O vínculo existe, mas a resposta não permite comparar tudo.' },
  { key: 'coreOnly', label: 'Somente no Commerce', detail: 'Existe no Commerce sem item correspondente na origem.' },
  { key: 'outOfScope', label: 'Fora do escopo', detail: 'Foi excluído por empresa ou unidade selecionada.' },
]

function id(value) {
  const result = String(value ?? '').trim()
  return result || ''
}

function count(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const result = Number(value.trim())
    return Number.isSafeInteger(result) ? result : null
  }
  return null
}

function nonNegativeNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function sameScope(left, right) {
  return ['empresaId', 'lojaId', 'storefrontId'].every(key => {
    const expected = id(left?.[key])
    return Boolean(expected) && expected === id(right?.[key])
  })
}

function normalizeCommonRead(commonRead, diagnosticScope, diagnosticSummary) {
  if (!commonRead || commonRead.mode !== 'read-only-common-catalog' || !commonRead.summary || !Array.isArray(commonRead.items)) return { common: null, commonUnavailable: true }
  if (!sameScope(diagnosticScope, commonRead.scope)) return { common: null, commonUnavailable: true }
  const commonSummary = {}
  for (const key of COMMON_SUMMARY_KEYS) {
    const value = count(commonRead.summary[key])
    if (value === null) return { common: null, commonUnavailable: true }
    commonSummary[key] = value
  }
  if (commonSummary.sourceItems !== commonSummary.available + commonSummary.blocked + commonSummary.unavailable) return { common: null, commonUnavailable: true }
  if (commonRead.items.length !== commonSummary.sourceItems) return { common: null, commonUnavailable: true }
  if (commonSummary.sourceItems + commonSummary.outOfScope !== diagnosticSummary.sourceItems + diagnosticSummary.outOfScope) return { common: null, commonUnavailable: true }
  const rawReasonCounts = commonRead.summary.reasonCounts
  if (!rawReasonCounts || typeof rawReasonCounts !== 'object' || Array.isArray(rawReasonCounts)) return { common: null, commonUnavailable: true }
  const reasonCounts = {}
  for (const [reason, rawCount] of Object.entries(rawReasonCounts)) {
    const value = count(rawCount)
    if (value === null || value === 0 || !COMMON_REASON_LABELS[reason]) return { common: null, commonUnavailable: true }
    reasonCounts[reason] = value
  }
  const statusCounts = { available: 0, blocked: 0, unavailable: 0 }
  const observedReasons = {}
  for (const item of commonRead.items) {
    if (!item || !Object.prototype.hasOwnProperty.call(statusCounts, item.status) || !Array.isArray(item.reasons)) return { common: null, commonUnavailable: true }
    statusCounts[item.status] += 1
    for (const reason of item.reasons) {
      if (!COMMON_REASON_LABELS[reason]) return { common: null, commonUnavailable: true }
      observedReasons[reason] = (observedReasons[reason] || 0) + 1
    }
    if (item.status !== 'available' && (item.sku !== null || item.variantId !== null || item.priceCents !== null || item.stockAvailable !== null || item.sourceStockAvailable !== null)) return { common: null, commonUnavailable: true }
    if (item.status === 'available') {
      if (!sameScope(diagnosticScope, item.scope) || !id(item.sku) || !id(item.variantId) || !['id', 'sku'].includes(item.matchedBy) || item.reasons.length > 0) return { common: null, commonUnavailable: true }
      if (count(item.priceCents) === null || nonNegativeNumber(item.stockAvailable) === null || nonNegativeNumber(item.sourceStockAvailable) === null) return { common: null, commonUnavailable: true }
    }
  }
  if (statusCounts.available !== commonSummary.available || statusCounts.blocked !== commonSummary.blocked || statusCounts.unavailable !== commonSummary.unavailable) return { common: null, commonUnavailable: true }
  const keys = Object.keys(observedReasons).sort()
  if (keys.length !== Object.keys(reasonCounts).length || keys.some(key => observedReasons[key] !== reasonCounts[key])) return { common: null, commonUnavailable: true }
  return {
    common: {
      summary: { ...commonSummary, reasonCounts },
      reasons: Object.entries(reasonCounts).map(([reason, countValue]) => ({ label: COMMON_REASON_LABELS[reason], count: countValue })),
    },
    commonUnavailable: false,
  }
}

export function diagnosticContext({ mode, empresaId, unitId, storefrontId, canReadReports = true } = {}) {
  return {
    mode: id(mode),
    empresaId: id(empresaId),
    unitId: id(unitId),
    storefrontId: id(storefrontId),
    canReadReports: canReadReports === true,
  }
}

export function diagnosticContextKey(context = {}) {
  const selected = diagnosticContext(context)
  return [selected.mode, selected.empresaId, selected.unitId, selected.storefrontId, selected.canReadReports ? 'read' : 'blocked'].join(':')
}

export function diagnosticContextReady(context = {}) {
  const selected = diagnosticContext(context)
  return selected.mode === 'core' && selected.canReadReports && Boolean(selected.empresaId && selected.unitId && selected.storefrontId)
}

export function diagnosticHeaders({ empresaId, unitId } = {}) {
  let token = ''
  try {
    token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token') || ''
  } catch { /* storage indisponível: o backend responderá sem sessão */ }
  // Somente os três headers de autenticação/contexto já usados pelo cliente. O storefront segue na query.
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'X-Empresa-Id': id(empresaId),
    'X-Loja-Id': id(unitId),
  }
}

export function diagnosticPath(storefrontId) {
  return `/api/admin/commerce/operations/inventory-divergence?storefrontId=${encodeURIComponent(id(storefrontId))}`
}

export function normalizeCatalogDiagnostic(payload, expectedScope = null) {
  const report = payload?.catalogDiagnostic || payload
  if (!report || report.mode !== 'read-only-diagnostic' || !report.summary || !Array.isArray(report.items)) {
    return { kind: 'unavailable', reason: 'incomplete' }
  }
  const summary = {}
  for (const key of SUMMARY_KEYS) {
    const value = count(report.summary[key])
    if (value === null) return { kind: 'unavailable', reason: 'incomplete' }
    summary[key] = value
  }
  const mappedBreakdown = summary.aligned + summary.divergent + summary.ambiguous + summary.notVerified
  if (!Number.isSafeInteger(mappedBreakdown) || summary.mapped !== mappedBreakdown || summary.mapped + summary.unmapped !== summary.sourceItems) {
    return { kind: 'unavailable', reason: 'inconsistent' }
  }
  if (expectedScope && !sameScope(expectedScope, report.scope)) return { kind: 'unavailable', reason: 'context' }
  const commonResult = report.commonRead === undefined
    ? { common: null, commonUnavailable: false }
    : normalizeCommonRead(report.commonRead, report.scope, summary)
  return {
    kind: 'ready',
    summary,
    mappedRate: summary.sourceItems > 0 ? summary.mapped / summary.sourceItems : null,
    rows: DIAGNOSTIC_STATUS_ROWS.map(row => ({ ...row, count: summary[row.key] })),
    common: commonResult.common,
    commonUnavailable: commonResult.commonUnavailable,
  }
}

export function mappedRateLabel(rate) {
  return rate === null ? '—' : `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function diagnosticGuidance(summary = {}) {
  const divergent = count(summary.divergent) ?? 0
  const notComparable = (count(summary.unmapped) ?? 0) + (count(summary.ambiguous) ?? 0) + (count(summary.notVerified) ?? 0)
  const sourceItems = count(summary.sourceItems) ?? 0
  if (divergent > 0) return `${divergent} item(ns) comparável(is) apresenta(m) divergência. Revise os dados na origem antes de qualquer ajuste; este diagnóstico é somente leitura.`
  if (sourceItems === 0) return 'Nenhum item de origem foi recebido neste escopo; não há base comparável para concluir consistência.'
  if (notComparable > 0) return 'Nenhuma divergência foi observada nos itens comparáveis, mas o catálogo não está totalmente verificável por causa dos vínculos pendentes ou incompletos.'
  if ((count(summary.coreOnly) ?? 0) > 0) return 'Nenhuma divergência foi observada nos itens comparáveis, mas existem itens somente no Commerce. Revise a cobertura antes de concluir alinhamento entre os canais.'
  return 'Nenhuma divergência foi observada nos itens comparáveis. O resultado descreve apenas os itens recebidos neste escopo.'
}

export function commonCatalogGuidance(common) {
  if (!common) return ''
  const { available, blocked, unavailable } = common.summary
  if (blocked > 0) return `${blocked} item(ns) têm leitura bloqueada por dados que não permitem uma comparação verificável. Esta leitura é somente consulta e não autoriza venda.`
  if (unavailable > 0) return `${available} item(ns) têm correspondência verificável para comparação; ${unavailable} permanecem sem correspondência exata. Não foi usado fallback por nome ou diferença de caixa.`
  if (available === 0) return 'Nenhuma correspondência comum é verificável neste escopo; ausência não é estoque zero nem autorização de venda.'
  return `${available} item(ns) têm correspondência verificável para comparação. O consenso é somente leitura e não representa oferta ou autorização de venda.`
}
