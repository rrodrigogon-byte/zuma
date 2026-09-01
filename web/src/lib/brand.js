export function resolveBrand(pathname = '/', search = '', tenantBrand = '') {
  const path = String(pathname || '/').toLowerCase()
  const params = new URLSearchParams(String(search || ''))
  if (String(tenantBrand || '').toLowerCase() === 'dino' && (path === '/admin' || path.startsWith('/admin/'))) return 'dino'
  if (path === '/agendar/dino' || path.startsWith('/agendar/dino/')) return 'dino'
  if (['/ecommerce/dino', '/perfumaria/dino', '/checkout/dino', '/pedido/dino'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return 'dino'
  if (path === '/loja' && params.get('marca') === 'dino') return 'dino'
  return 'kytto'
}

export function applyBrand(brand) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (brand === 'dino') html.dataset.brand = 'dino'
  else delete html.dataset.brand
}

export const isDinoBrand = (brand) => brand === 'dino'
