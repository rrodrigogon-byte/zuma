const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/

export function normalizeStorefrontAlias(value) {
  const alias = String(value || '').trim().toLowerCase()
  return ALIAS_PATTERN.test(alias) ? alias : ''
}

export function storefrontApiBase(value) {
  const alias = normalizeStorefrontAlias(value)
  return alias ? `/api/public/storefront/${encodeURIComponent(alias)}` : '/api/storefront'
}

export function storefrontMediaUrl(value, storeAlias) {
  const url = String(value || '').trim()
  const match = url.match(/^\/api\/storefront\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
  if (!match) return url
  return `${storefrontApiBase(storeAlias)}/media/${match[1]}`
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

export function storefrontCartSessionKey(value) {
  const storageKey = storefrontStorageKey(value, 'cart_session')
  const generate = () => globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  try {
    const existing = globalThis.localStorage?.getItem(storageKey)
    if (/^[A-Za-z0-9_-]{24,180}$/.test(existing || '')) return existing
    const generated = generate()
    globalThis.localStorage?.setItem(storageKey, generated)
    return generated
  } catch { return generate() }
}

export function storefrontCheckoutIdempotencyKey(value) {
  const storageKey = storefrontStorageKey(value, 'checkout_idempotency')
  const generate = () => `order-${globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`}`
  try {
    const existing = globalThis.sessionStorage?.getItem(storageKey)
    if (/^[A-Za-z0-9_-]{24,180}$/.test(existing || '')) return existing
    const generated = generate()
    globalThis.sessionStorage?.setItem(storageKey, generated)
    return generated
  } catch { return generate() }
}

export function clearStorefrontCheckoutIdempotencyKey(value) {
  try { globalThis.sessionStorage?.removeItem(storefrontStorageKey(value, 'checkout_idempotency')) } catch { /* armazenamento opcional */ }
}

export function decrementCartQuantity(value) {
  const quantity = Math.max(0, Math.trunc(Number(value) || 0))
  return Math.max(0, quantity - 1)
}

export function storefrontAliasFromPath(pathname) {
  const match = String(pathname || '').match(/^\/(?:ecommerce|perfumaria|checkout|pedido)\/([^/?#]+)/i)
  return normalizeStorefrontAlias(match?.[1])
}

export async function loadAllStorefrontProducts(fetchPage, { pageSize = 100, maxItems = 2000 } = {}) {
  if (typeof fetchPage !== 'function') throw new TypeError('fetchPage deve ser uma função')
  const safePageSize = Math.min(Math.max(Number(pageSize) || 100, 1), 100)
  const safeMaxItems = Math.min(Math.max(Number(maxItems) || 2000, safePageSize), 5000)
  const items = []
  let offset = 0
  while (items.length < safeMaxItems) {
    const response = await fetchPage({ limit: safePageSize, offset })
    const batch = Array.isArray(response) ? response : response?.items || []
    items.push(...batch.slice(0, safeMaxItems - items.length))
    if (batch.length < safePageSize) break
    offset += batch.length
  }
  return items
}
