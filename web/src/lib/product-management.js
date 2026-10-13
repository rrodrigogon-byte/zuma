export const CATALOG_ATTENTION = Object.freeze({ all: 'Todo o catálogo', images: 'Publicados sem imagem', descriptions: 'Publicados sem descrição', stock: 'Publicados com até 5 unidades' })

export function catalogAttention(value) {
  return Object.hasOwn(CATALOG_ATTENTION, value) ? value : 'all'
}

export function matchesCatalogAttention(product, value) {
  const attention = catalogAttention(value)
  if (attention === 'all') return true
  if (product.ativo === false || product.publicado === false) return false
  if (attention === 'images') return !product.imagem && !product.media?.length
  if (attention === 'descriptions') return !String(product.descricaoCurta || product.descricao_curta || product.descricao || '').trim()
  return Number.isFinite(Number(product.estoque)) && Number(product.estoque) <= 5 && product.permiteCompraSemEstoque !== true
}

function text(value) {
  return String(value ?? '').trim()
}

function normalized(value) {
  return text(value).toLocaleLowerCase('pt-BR')
}

export function productStatus(product = {}) {
  if (product.status === 'archived') return 'archived'
  if (productChannelPublished(product)) return 'published'
  if (product.status === 'active') return 'unpublished'
  return 'draft'
}

export function productChannelPublished(product = {}) {
  return product.status === 'active' && product.publicado === true
}

export function productQuality(product = {}) {
  const variants = Array.isArray(product.variantes)
    ? product.variantes
    : (Array.isArray(product.variants) ? product.variants : [])
  const media = Array.isArray(product.media) ? product.media : []
  const price = Number(product.preco || variants[0]?.preco || 0)
  const checks = [
    { key: 'name', ready: Boolean(text(product.nome)), label: 'nome' },
    { key: 'sku', ready: Boolean(text(product.cod || variants[0]?.sku)), label: 'SKU' },
    { key: 'category', ready: Boolean(text(product.categoryId || product.category_id || product.cat)), label: 'categoria' },
    { key: 'price', ready: price > 0, label: 'preço' },
    { key: 'description', ready: Boolean(text(product.descricaoCurta || product.descricao_curta || product.descricao || product.desc)), label: 'descrição' },
    { key: 'media', ready: Boolean(text(product.imagem)) || media.length > 0, label: 'imagem' },
  ]
  const completed = checks.filter(item => item.ready).length
  return {
    score: Math.round((completed / checks.length) * 100),
    missing: checks.filter(item => !item.ready).map(item => item.label),
  }
}

export function catalogSummary(products = []) {
  return products.reduce((summary, product) => {
    const status = productStatus(product)
    const stock = Number(product.estoque || 0)
    const quality = productQuality(product)
    summary.total += 1
    summary.totalUnits += Math.max(0, stock)
    if (status === 'published') {
      summary.published += 1
      if (stock <= 5) summary.lowStock += 1
      if (stock <= 0) summary.outOfStock += 1
    } else {
      summary.notPublished += 1
    }
    if (quality.missing.includes('imagem')) summary.missingMedia += 1
    if (quality.score < 100) summary.incomplete += 1
    return summary
  }, {
    total: 0,
    published: 0,
    notPublished: 0,
    lowStock: 0,
    outOfStock: 0,
    missingMedia: 0,
    incomplete: 0,
    totalUnits: 0,
  })
}

function matchesStock(product, stockFilter) {
  const stock = Number(product.estoque || 0)
  if (stockFilter === 'out') return stock <= 0
  if (stockFilter === 'low') return stock > 0 && stock <= 5
  if (stockFilter === 'available') return stock > 5
  return true
}

function productSearchText(product = {}) {
  const variants = Array.isArray(product.variantes)
    ? product.variantes
    : (Array.isArray(product.variants) ? product.variants : [])
  return normalized([
    product.nome,
    product.cod,
    product.cat,
    product.slug,
    ...variants.flatMap(variant => [variant.sku, variant.nome, variant.barcode]),
  ].join(' '))
}

export function filterProducts(products = [], filters = {}) {
  const query = normalized(filters.query)
  const category = text(filters.category)
  const status = text(filters.status || 'all')
  const stock = text(filters.stock || 'all')
  const quality = text(filters.quality || 'all')
  const sort = text(filters.sort || 'updated_desc')

  const filtered = products.filter(product => {
    if (!matchesCatalogAttention(product, filters.attention)) return false
    if (query && !productSearchText(product).includes(query)) return false
    if (category && category !== 'all' && text(product.categoryId || product.category_id || product.cat) !== category) return false
    if (status !== 'all' && productStatus(product) !== status) return false
    if (!matchesStock(product, stock)) return false
    const productQualityState = productQuality(product)
    if (quality === 'incomplete' && productQualityState.score === 100) return false
    if (quality === 'missing_media' && !productQualityState.missing.includes('imagem')) return false
    return true
  })

  return filtered.sort((a, b) => {
    if (sort === 'name_asc') return text(a.nome).localeCompare(text(b.nome), 'pt-BR')
    if (sort === 'stock_asc') return Number(a.estoque || 0) - Number(b.estoque || 0) || text(a.nome).localeCompare(text(b.nome), 'pt-BR')
    if (sort === 'price_asc') return Number(a.preco || 0) - Number(b.preco || 0) || text(a.nome).localeCompare(text(b.nome), 'pt-BR')
    if (sort === 'quality_asc') return productQuality(a).score - productQuality(b).score || text(a.nome).localeCompare(text(b.nome), 'pt-BR')
    return String(b.atualizado_em || b.updatedAt || '').localeCompare(String(a.atualizado_em || a.updatedAt || '')) || text(a.nome).localeCompare(text(b.nome), 'pt-BR')
  })
}

export function pagination(items = [], page = 1, pageSize = 24) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    totalPages,
    start,
    end: Math.min(items.length, start + pageSize),
    items: items.slice(start, start + pageSize),
  }
}
