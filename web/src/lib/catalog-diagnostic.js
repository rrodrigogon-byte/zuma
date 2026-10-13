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

export function normalizeCatalogDiagnostic(payload) {
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
  return {
    kind: 'ready',
    summary,
    mappedRate: summary.sourceItems > 0 ? summary.mapped / summary.sourceItems : null,
    rows: DIAGNOSTIC_STATUS_ROWS.map(row => ({ ...row, count: summary[row.key] })),
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
