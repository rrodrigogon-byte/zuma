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
