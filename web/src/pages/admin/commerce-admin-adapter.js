import { api } from '../../lib/api'

const LEGACY_TO_CORE = {
  pendente: 'pending_payment',
  preparando: 'processing',
  pronto: 'ready',
  entregue: 'completed',
  cancelado: 'cancelled',
}

const CORE_TO_LEGACY = {
  draft: 'pendente',
  pending_payment: 'pendente',
  payment_failed: 'pendente',
  paid: 'preparando',
  fraud_review: 'preparando',
  processing: 'preparando',
  ready: 'pronto',
  ready_for_pickup: 'pronto',
  shipped: 'pronto',
  delivered: 'entregue',
  picked_up: 'entregue',
  completed: 'entregue',
  cancelled: 'cancelado',
  refunded: 'cancelado',
  partially_refunded: 'cancelado',
}

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function normalizeCoreProduct(product) {
  const variant = product.variants?.[0] || {}
  return {
    ...product,
    nome: product.nome,
    cat: product.category_name || 'Geral',
    categoryId: product.category_id || '',
    cod: variant.sku || 'Sem SKU',
    preco: number(variant.preco),
    precoPromocional: variant.precoPromocional == null ? null : number(variant.precoPromocional),
    estoque: number(variant.estoque),
    ativo: product.status === 'active',
    variantId: variant.id || null,
    core: true,
  }
}

function normalizeCoreOrder(order) {
  return {
    ...order,
    id: order.id,
    codigo: order.public_code,
    status: CORE_TO_LEGACY[order.status] || 'pendente',
    coreStatus: order.status,
    cliente: { nome: order.customer_name || 'Cliente', email: order.customer_email || '' },
    total: number(order.total),
    criadoEm: order.criado_em,
    itens: [],
    core: true,
  }
}

function normalizeLegacy(data) {
  return {
    mode: 'legacy',
    storefrontId: null,
    locationId: null,
    products: Array.isArray(data.products) ? data.products : [],
    orders: Array.isArray(data.orders) ? data.orders : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
  }
}

async function loadLegacy() {
  const [productData, orderData, customerData] = await Promise.all([
    api.get('/api/admin/loja'),
    api.get('/api/admin/loja/pedidos'),
    api.get('/api/admin/clientes').catch(() => ({ clientes: [] })),
  ])
  return normalizeLegacy({
    products: Array.isArray(productData) ? productData : productData?.produtos || [],
    orders: Array.isArray(orderData) ? orderData : orderData?.pedidos || [],
    customers: Array.isArray(customerData) ? customerData : customerData?.clientes || [],
  })
}

export async function loadCommerceAdmin() {
  try {
    const [storefrontData, productData, categoryData, promotionData, roleData, membershipData, orderData, customerData, locations] = await Promise.all([
      api.get('/api/admin/commerce/storefront'),
      api.get('/api/admin/commerce/catalog/products'),
      api.get('/api/admin/commerce/catalog/categories'),
      api.get('/api/admin/commerce/promotions').catch(error => {
        if (error.status === 403) return { items: [] }
        throw error
      }),
      api.get('/api/admin/commerce/users/roles').catch(error => {
        if (error.status === 403) return { items: [] }
        throw error
      }),
      api.get('/api/admin/commerce/users/memberships').catch(error => {
        if (error.status === 403) return { items: [] }
        throw error
      }),
      api.get('/api/admin/commerce/orders'),
      api.get('/api/admin/commerce/customers').catch(error => {
        if (error.status === 403) return { items: [] }
        throw error
      }),
      api.get('/api/admin/commerce/inventory/locations').catch(error => {
        if (error.status === 403) return { items: [] }
        throw error
      }),
    ])
    return {
      mode: 'core',
      storefrontId: storefrontData?.items?.[0]?.id || null,
      locationId: locations?.items?.[0]?.id || null,
      categories: categoryData?.items || [],
      promotions: promotionData?.items || [],
      roles: roleData?.items || [],
      memberships: membershipData?.items || [],
      products: (productData?.items || []).map(normalizeCoreProduct),
      orders: (orderData?.items || []).map(normalizeCoreOrder),
      customers: customerData?.items || [],
    }
  } catch (error) {
    if (error.status !== 404) throw error
    return loadLegacy()
  }
}

export async function saveCoreProduct({ editingId, current, form, storefrontId, locationId }) {
  const price = number(form.preco)
  const promotional = form.precoPromocional === '' ? null : number(form.precoPromocional)
  if (editingId) {
    const product = await api.patch(`/api/admin/commerce/catalog/products/${editingId}`, {
      nome: form.nome,
      categoryId: form.categoryId || null,
      descricao: form.descricao,
      status: form.ativo ? 'active' : 'archived',
    })
    if (current?.variantId) {
      await api.patch(`/api/admin/commerce/catalog/products/${editingId}/price`, {
        variantId: current.variantId,
        preco: price,
        precoPromocional: promotional,
      })
      const delta = number(form.estoque) - number(current.estoque)
      if (delta && locationId) {
        await api.post('/api/admin/commerce/inventory/adjust', {
          locationId,
          variantId: current.variantId,
          delta,
          tipo: 'ajuste',
          idempotencyKey: `admin-stock-${editingId}-${Date.now()}`,
        })
      }
    }
    return product
  }
  const created = await api.post('/api/admin/commerce/catalog/products', {
    nome: form.nome,
    categoryId: form.categoryId || null,
    descricao: form.descricao,
    status: form.ativo ? 'active' : 'draft',
    preco: price,
    precoPromocional: promotional,
    storefrontId: form.ativo ? storefrontId : null,
    publicado: form.ativo,
    variant: { sku: form.cod || undefined },
    media: form.imagem ? { url: form.imagem, storageKey: form.imagem, mimeType: 'image/*', altText: form.nome } : undefined,
  })
  if (locationId && created?.variant?.id && number(form.estoque)) {
    await api.post('/api/admin/commerce/inventory/adjust', {
      locationId,
      variantId: created.variant.id,
      delta: number(form.estoque),
      tipo: 'entrada',
      idempotencyKey: `admin-stock-${created.id}-${Date.now()}`,
    })
  }
  return created
}

export async function toggleCoreProduct(product, storefrontId) {
  if (!storefrontId) throw new Error('storefront do canal não configurado')
  return api.post(`/api/admin/commerce/catalog/products/${product.id}/publish`, {
    storefrontId,
    publicado: product.ativo === false,
  })
}

export async function deleteCoreProduct(product) {
  return api.delete(`/api/admin/commerce/catalog/products/${product.id}`)
}

export async function updateCoreOrder(order, status) {
  const next = LEGACY_TO_CORE[status] || status
  return api.patch(`/api/admin/commerce/orders/${order.id}`, { status: next })
}

export async function createCorePromotion(form) {
  const promotion = await api.post('/api/admin/commerce/promotions', {
    nome: form.nome,
    tipo: form.tipo,
    valor: Number(form.valor),
    limiteUso: form.limiteUso ? Number(form.limiteUso) : null,
    ativo: true,
  })
  if (form.codigo?.trim()) {
    await api.post('/api/admin/commerce/promotions/codes', {
      promotionId: promotion.id,
      codigo: form.codigo.trim().toUpperCase(),
      usoMaximo: form.usoMaximo ? Number(form.usoMaximo) : null,
      ativo: true,
    })
  }
  return promotion
}

export async function updateCoreMembership(id, payload) {
  return api.patch(`/api/admin/commerce/users/memberships/${id}`, payload)
}

export async function loadCoreReports() {
  const [sales, inventory, customers] = await Promise.all([
    api.get('/api/admin/commerce/reports/sales'),
    api.get('/api/admin/commerce/reports/inventory'),
    api.get('/api/admin/commerce/reports/customers'),
  ])
  return { sales, inventory, customers }
}

export { CORE_TO_LEGACY, LEGACY_TO_CORE }
