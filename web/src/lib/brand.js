export const DINO_BARBERSHOP_LOGO = '/brand/dino-barbearia-logo.png'
export const DINO_COMMERCE_LOGO = '/brand/dino-logo-horizontal.png'

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

export function normalizeThemeMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return ['light', 'dark'].includes(mode) ? mode : 'system'
}

export function applyThemeMode(value, { persist = false, storage = typeof localStorage === 'undefined' ? null : localStorage } = {}) {
  const mode = normalizeThemeMode(value)
  if (typeof document !== 'undefined') {
    if (mode === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = mode
  }
  if (persist) {
    try { storage?.setItem('sp_theme_mode', mode) } catch { /* preferência opcional */ }
  }
  return mode
}

export function storedThemeMode(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try { return normalizeThemeMode(storage?.getItem('sp_theme_mode')) }
  catch { return 'system' }
}

export function isDinoBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === 'object'
      ? [context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome]
      : [context]
    return values.some((value) => String(value || '').toLowerCase().includes('dino'))
  })
}

export const isDinoBrand = (brand) => brand === 'dino'
