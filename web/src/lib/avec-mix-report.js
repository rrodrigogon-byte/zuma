const TYPES = new Set(['services', 'products', 'plans', 'tips'])
export function avecMixReportLink(history, type = '') {
  if (!history?.selectedFrom || !history?.selectedToExclusive) return '/admin/avec-relatorio'
  const end = new Date(`${history.selectedToExclusive}T12:00:00Z`)
  if (Number.isNaN(end.valueOf())) return '/admin/avec-relatorio'
  end.setUTCDate(end.getUTCDate() - 1)
  const query = new URLSearchParams({ inicio: history.selectedFrom, fim: end.toISOString().slice(0, 10) })
  if (TYPES.has(type)) query.set('tipo', type)
  return `/admin/avec-relatorio?${query}`
}
export function readAvecMixFilters(search) {
  const query = new URLSearchParams(search)
  const range = {}
  for (const key of ['inicio', 'fim']) if (query.get(key)) range[key] = query.get(key)
  return { range, type: TYPES.has(query.get('tipo')) ? query.get('tipo') : '' }
}
export function selectAvecMixRows(rows, type = '') {
  const source = Array.isArray(rows) ? rows : []
  return TYPES.has(type) ? source.filter(row => row.type === type) : source
}
