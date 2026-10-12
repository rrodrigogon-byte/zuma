// Regras puras da vitrine (busca, estoque e carrinho) — sem React, testáveis com node:test.

export const LOW_STOCK_THRESHOLD = 3

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function productSearchText(product = {}) {
  const variants = Array.isArray(product.variants) ? product.variants : []
  return normalizeSearchText([
    product.nome,
    product.cat,
    product.cod,
    product.descricao,
    ...variants.flatMap(variant => [variant?.cod, variant?.label]),
  ].filter(Boolean).join(' '))
}

// Todos os termos precisam aparecer (em qualquer ordem) em nome, categoria, SKU ou descrição.
export function filterCatalog(products = [], { query = '', category = 'Todos', inStockOnly = false } = {}) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean)
  return products.filter(product => {
    if (inStockOnly && stockState(product).kind === 'out') return false
    if (category && category !== 'Todos' && product.cat !== category) return false
    if (!terms.length) return true
    const text = productSearchText(product)
    return terms.every(term => text.includes(term))
  })
}

export function stockState(product = {}, threshold = LOW_STOCK_THRESHOLD) {
  const stock = Math.max(0, Number(product.estoque || 0))
  if ((product.permiteCompraSemEstoque || product.permite_compra_sem_estoque) && (product.esgotado || stock <= 0)) return { kind: 'backorder', stock: 0, label: 'Sob encomenda' }
  if (product.esgotado || stock <= 0) return { kind: 'out', stock: 0, label: 'Esgotado' }
  if (stock <= threshold) return { kind: 'low', stock, label: stock === 1 ? 'Última unidade' : `Últimas ${stock} unidades` }
  return { kind: 'ok', stock, label: 'Em estoque' }
}

export function cartItemKey(item = {}) {
  return item.variantId || item.produtoId || item.id || ''
}

export function cartItemCount(cart = []) {
  return cart.reduce((sum, item) => sum + Math.max(0, Number(item.qtd || 0)), 0)
}

export function cartSubtotal(cart = []) {
  return cart.reduce((sum, item) => sum + Math.max(0, Number(item.qtd || 0)) * Number(item.preco || 0), 0)
}

/**
 * Calcula a inclusão de um produto no carrinho sem efeitos colaterais.
 * Retorna { ok, cart, added, quantity, reason } — `reason` = 'out_of_stock' | 'stock_limit'.
 */
export function addProductToCart(cart = [], product = {}, qtd = 1, available = Number(product.estoque || 0)) {
  const stock = Math.max(0, Number(available || 0))
  const key = product.variantId || product.id
  const backorder = product.permiteCompraSemEstoque === true || product.permite_compra_sem_estoque === true
  if (!key || (stock <= 0 && !backorder) || (product.esgotado && !backorder)) return { ok: false, cart, added: 0, quantity: 0, reason: 'out_of_stock' }
  const effectiveStock = stock > 0 ? stock : 999
  const current = cart.find(item => cartItemKey(item) === key)
  const currentQty = Number(current?.qtd || 0)
  const nextQty = Math.min(effectiveStock, currentQty + Math.max(1, Number(qtd || 1)))
  const added = nextQty - currentQty
  if (added <= 0) return { ok: false, cart, added: 0, quantity: currentQty, reason: 'stock_limit', stock }
  const nextCart = current
    ? cart.map(item => cartItemKey(item) === key ? { ...item, qtd: nextQty } : item)
    : [...cart, {
        produtoId: product.id,
        variantId: product.variantId || null,
        nome: product.nome,
        preco: product.preco,
        imagem: product.imagem,
        emoji: product.emoji,
        cod: product.cod || '',
        variantLabel: Array.isArray(product.variants) && product.variants.length > 1 ? (product.label || '') : '',
        qtd: nextQty,
      }]
  return { ok: true, cart: nextCart, added, quantity: nextQty, stock: effectiveStock }
}


// Mantém a ordem editorial dentro de cada grupo de disponibilidade.
export function sortCatalog(products = [], sort = 'available') {
  return [...products].sort((a, b) => {
    if (sort === 'price-asc') return Number(a.preco || 0) - Number(b.preco || 0)
    if (sort === 'price-desc') return Number(b.preco || 0) - Number(a.preco || 0)
    if (sort === 'name') return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    return Number(stockState(a).kind === 'out') - Number(stockState(b).kind === 'out')
  })
}

// Renderização em páginas: catálogos grandes (ex.: 768 itens) não montam todos os cards de uma vez.
export const CATALOG_PAGE_SIZE = 48

export function paginateCatalog(products = [], visibleCount = CATALOG_PAGE_SIZE) {
  const list = Array.isArray(products) ? products : []
  const limit = Math.max(1, Math.floor(Number(visibleCount) || CATALOG_PAGE_SIZE))
  const items = list.slice(0, limit)
  return { items, total: list.length, remaining: Math.max(0, list.length - items.length), hasMore: list.length > items.length }
}

// Congelados e refrigerados só saem por retirada (a regra final é do servidor, na cotação de frete).
const PICKUP_ONLY_PATTERN = /\b(congelad[oa]s?|refrigerad[oa]s?|resfriad[oa]s?|perec[ií]ve(?:l|is))\b/i

export function isPickupOnlyProduct(product = {}) {
  const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  return PICKUP_ONLY_PATTERN.test(fold(product.cat || product.category_name || '')) || PICKUP_ONLY_PATTERN.test(fold(product.nome || ''))
}

export function cartHasPickupOnlyItems(cart = [], products = []) {
  const byId = new Map((Array.isArray(products) ? products : []).map(product => [product.id, product]))
  return (Array.isArray(cart) ? cart : []).some(item => isPickupOnlyProduct(byId.get(item.produtoId) || item))
}

export const PICKUP_ONLY_NOTE = 'Seu carrinho tem itens congelados ou refrigerados: este pedido é só para retirada na loja.'

// Link de carrinho montado pelo atendimento (WhatsApp): ?carrinho=<variantId>:<qtd>,...
const CART_LINK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const CART_LINK_PARAM = 'carrinho'

/** Itens válidos do parâmetro do link (até 20 itens, quantidade de 1 a 99). */
export function parseCartLink(value = '') {
  const lines = new Map()
  for (const part of String(value || '').split(',').slice(0, 20)) {
    const [rawId = '', rawQty = '1'] = part.trim().split(':')
    const variantId = rawId.trim().toLowerCase()
    const quantity = Number.parseInt(rawQty, 10)
    if (!CART_LINK_UUID.test(variantId) || !Number.isInteger(quantity) || quantity < 1) continue
    lines.set(variantId, Math.min(99, (lines.get(variantId) || 0) + quantity))
  }
  return [...lines.entries()].map(([variantId, quantity]) => ({ variantId, quantity }))
}

/**
 * Coloca no carrinho os itens do link, conferindo catálogo e estoque atuais.
 * `resolve(variantId)` devolve { product, available } (produto já na variante) ou null.
 */
export function applyCartLink(cart = [], lines = [], resolve = () => null) {
  let next = cart
  const added = []
  const missing = []
  for (const line of lines) {
    const found = resolve(line.variantId)
    if (!found?.product) { missing.push(line.variantId); continue }
    const current = next.find(item => cartItemKey(item) === line.variantId)
    const wanted = Math.max(0, line.quantity - Number(current?.qtd || 0))
    if (!wanted) { added.push(line.variantId); continue }
    const result = addProductToCart(next, found.product, wanted, found.available)
    if (result.ok) { next = result.cart; added.push(line.variantId) } else missing.push(line.variantId)
  }
  return { cart: next, added, missing }
}
