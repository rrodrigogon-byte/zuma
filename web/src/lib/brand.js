export const DINO_BARBERSHOP_LOGO = '/brand/dino-barbearia-logo.png'
export const DINO_COMMERCE_LOGO = '/brand/dino-logo-horizontal-tight.png'
export const STALLONE_LOGO = '/brand/stallone-logo-transparent.svg'
export const STALLONE_LOGO_LIGHT = '/brand/stallone-logo-light.svg'
export const STALLONE_MARK = '/brand/stallone-mark.svg'

// Marcas com identidade própria. Cada empresa (tenant) aponta para uma marca pelo
// brandKey do storefront; empresas sem marca registrada usam a identidade Kytto.
export const BRAND_KEYS = ['dino', 'stallone', 'zuma']
export const STALLONE_HOSTS = new Set(['stallone.kytto.com.br', 'www.stallone.kytto.com.br'])
export const ZUMA_HOSTS = new Set(['zuma.kytto.com.br', 'www.zuma.kytto.com.br', 'zuma-oriental.kytto.com.br'])

function normalizeHost(host) {
  return String(host || '').trim().toLowerCase().replace(/\.$/, '')
}

/** Marca pelo domínio próprio da loja (null quando o host não tem marca dedicada). */
export function brandFromHost(host) {
  const h = normalizeHost(host);
  if (STALLONE_HOSTS.has(h)) return 'stallone';
  if (ZUMA_HOSTS.has(h)) return 'zuma';
  return null;
}

export function isStalloneBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === 'object'
      ? [context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome]
      : [context]
    return values.some((value) => String(value || '').toLowerCase().includes('stallone'))
  })
}

/** Marca do tenant ativo (empresaAtiva do AuthContext ou alias do storefront). */
export function brandFromContext(...contexts) {
  if (isDinoBrandContext(...contexts)) return 'dino'
  if (isStalloneBrandContext(...contexts)) return 'stallone'
  return 'kytto'
}

export function commerceDisplayName(alias, publicName = '', storefrontName = '') {
  if (String(alias || '').trim().toLowerCase() === 'dino') return 'Dino Perfumaria'
  if (String(alias || '').trim().toLowerCase() === 'stallone') return 'Stallone Nutre Sport'
  return String(publicName || storefrontName || alias || 'Kytto Commerce').trim()
}

export function resolveBrand(pathname = '/', search = '', tenantBrand = '') {
  const path = String(pathname || '/').toLowerCase()
  const params = new URLSearchParams(String(search || ''))
  const tenant = String(tenantBrand || '').toLowerCase()
  if (BRAND_KEYS.includes(tenant) && (path === '/admin' || path.startsWith('/admin/'))) return tenant
  if (path === '/agendar/dino' || path.startsWith('/agendar/dino/')) return 'dino'
  if (['/ecommerce/dino', '/perfumaria/dino', '/checkout/dino', '/pedido/dino'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return 'dino'
  if (path === '/loja' && params.get('marca') === 'dino') return 'dino'
  if (['/ecommerce/stallone', '/checkout/stallone', '/pedido/stallone'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return 'stallone'
  if (path === '/loja' && params.get('marca') === 'stallone') return 'stallone'
  return 'kytto'
}

// Ícones da aba e da instalação por marca; as demais marcas mantêm os do index.html.
export const BRAND_ICONS = {
  stallone: { icon: STALLONE_MARK, iconType: 'image/svg+xml', touchIcon: '/brand/stallone-icon-192.png', themeColor: '#FFFFFF' },
}

export function brandIcons(brand) {
  return BRAND_ICONS[brand] || null
}

function swapHeadValue(selector, attribute, value) {
  const element = document.head?.querySelector(selector)
  if (!element) return
  if (element.dataset.brandDefault === undefined) element.dataset.brandDefault = element.getAttribute(attribute) || ''
  element.setAttribute(attribute, value ?? element.dataset.brandDefault)
}

export function applyBrand(brand) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (BRAND_KEYS.includes(brand)) html.dataset.brand = brand
  else delete html.dataset.brand
  const icons = brandIcons(brand)
  swapHeadValue('link[rel="icon"]', 'href', icons?.icon)
  swapHeadValue('link[rel="icon"]', 'type', icons?.iconType)
  swapHeadValue('link[rel="apple-touch-icon"]', 'href', icons?.touchIcon)
  swapHeadValue('meta[name="theme-color"]', 'content', icons?.themeColor)
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

/**
 * Empresa de clube/academia (ex.: AGRO OPEN TTC, Tangará Tênis Clube): ganha o menu focado no dia a
 * dia do clube (recepção, sócios, aulas, quadras, torneios e bar). Só muda o menu, não a marca.
 */
export function isClubeBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === 'object'
      ? [context.segmento, context.vertical, context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome, context.nome_fantasia]
      : [context]
    return values.some((value) => {
      const v = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return /\bttc\b|tenis clube|agro ?open|\bacademia\b|\bclube\b|\bfitness\b/.test(v)
    })
  })
}

export const PALATARE_LOGO = "/palatare-logo.png"
export const PALATARE_BANNER = "/palatare-banner.png"
export const CONCRETO_LOGO = "/brand/concreto-usina-logo.png"

export function isZumaBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === "object"
      ? [context.id, context.tipoNegocio, context.tipo_negocio, context.segmento, context.vertical, context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome, context.nome_fantasia, context.razaoSocial, context.cnpj]
      : [context]
    return values.some((value) => {
      const v = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return /\bzuma\b|c3c3ac01-8e50-4b61-8c79-de4aaa916da3|36296848000157|\bcozinha oriental\b|\boriental\b|\bsushi\b/.test(v)
    })
  })
}

export function isRestauranteBrandContext(...contexts) {
  if (isZumaBrandContext(...contexts)) return false
  return contexts.some((context) => {
    const values = context && typeof context === "object"
      ? [context.tipoNegocio, context.tipo_negocio, context.segmento, context.vertical, context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome, context.nome_fantasia, context.razaoSocial]
      : [context]
    return values.some((value) => {
      const v = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return /\brestaurante\b|\bpizzaria\b|\bpalatare\b|\bgastronomia\b|\bzuma\b|\boriental\b|\bsushi\b/.test(v)
    })
  })
}

export function isConcretoBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === "object"
      ? [context.tipoNegocio, context.tipo_negocio, context.segmento, context.vertical, context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome, context.nome_fantasia, context.razaoSocial]
      : [context]
    return values.some((value) => {
      const v = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return /\bconcreto\b|\busina\b|\bconcreteira\b|\bbetoneira\b|\bserrano\b|\bartefatos de cimento\b/.test(v)
    })
  })
}

export function isHoldingBrandContext(...contexts) {
  return contexts.some((context) => {
    const values = context && typeof context === "object"
      ? [context.tipoNegocio, context.tipo_negocio, context.segmento, context.vertical, context.brandKey, context.brand_key, context.slug, context.codigo, context.alias, context.nome, context.nome_fantasia, context.razaoSocial]
      : [context]
    return values.some((value) => {
      const v = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return /\bholding\b|\bholding palatare\b|\bgrupo palatare\b|\bparticipacoes\b/.test(v)
    })
  })
}

export const isDinoBrand = (brand) => brand === "dino" 
export const isStalloneBrand = (brand) => brand === 'stallone'
/** Marcas com loja de tema escolhível (sistema/claro/escuro) guardado no navegador. */
export const brandHasThemeChoice = (brand) => BRAND_KEYS.includes(brand)

/** Entradas públicas da Stallone; hosts de outras lojas mantêm suas rotas. */
export function stalloneEntryFromHost(host, checkout = false) {
  return brandFromHost(host) === 'stallone'
    ? (checkout ? '/checkout/stallone' : '/ecommerce/stallone')
    : null
}

/**
 * Stallone: loja, checkout e acompanhamento sempre claros (pedido do cliente: sem
 * fundo preto). No painel, claro por padrão e a escolha explícita do usuário vale.
 */
export function brandThemeMode(brand, pathname, preference = 'system') {
  if (!brandHasThemeChoice(brand)) return 'system'
  const mode = normalizeThemeMode(preference)
  if (brand !== 'stallone') return mode
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')
  if (!admin) return 'light'
  return mode === 'system' ? 'light' : mode
}
