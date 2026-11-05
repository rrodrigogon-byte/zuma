export const COMMERCE_TAB_BY_QUERY = { overview: 'visao', stores: 'lojas', lojas: 'lojas', catalog: 'catalogo', orders: 'pedidos', promotions: 'promocoes', reports: 'relatorios', customers: 'clientes', shipping: 'fulfillment', fulfillment: 'fulfillment', domains: 'dominios', payments: 'pagamentos', users: 'usuarios', audit: 'auditoria' }

export function commerceTabSearch(search, tab) {
  const params = new URLSearchParams(search)
  const query = Object.entries(COMMERCE_TAB_BY_QUERY).find(([, value]) => value === tab)?.[0]
  if (!query) return params
  params.set('tab', query)
  if (tab !== 'catalogo') params.delete('attention')
  return params
}
