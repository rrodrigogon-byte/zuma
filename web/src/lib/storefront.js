const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/

export function normalizeStorefrontAlias(value) {
  const alias = String(value || '').trim().toLowerCase()
  return ALIAS_PATTERN.test(alias) ? alias : ''
}

export function storefrontApiBase(value) {
  const alias = normalizeStorefrontAlias(value)
  return alias ? `/api/public/storefront/${encodeURIComponent(alias)}` : '/api/storefront'
}

export function storefrontRoute(value, destination = 'store') {
  const alias = normalizeStorefrontAlias(value)
  if (destination === 'checkout') return alias ? `/checkout/${encodeURIComponent(alias)}` : '/checkout'
  if (destination === 'order') return alias ? `/pedido/${encodeURIComponent(alias)}` : '/pedido'
  return alias ? `/ecommerce/${encodeURIComponent(alias)}` : '/'
}

export function storefrontStorageKey(value, kind) {
  const alias = normalizeStorefrontAlias(value) || 'host'
  const safeKind = String(kind || 'state').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'state'
  return `kytto_commerce_${safeKind}:${alias}`
}

export function storefrontAliasFromPath(pathname) {
  const match = String(pathname || '').match(/^\/(?:ecommerce|perfumaria|checkout|pedido)\/([^/?#]+)/i)
  return normalizeStorefrontAlias(match?.[1])
}
