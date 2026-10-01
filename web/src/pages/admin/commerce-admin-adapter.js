import { api } from '../../lib/api'
import { loadAllStorefrontProducts } from '../../lib/storefront'
import { productChannelPublished } from '../../lib/product-management'

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

export function normalizeCoreProduct(product) {
  const variant = product.variants?.[0] || {}
  return {
    ...product,
    nome: product.nome,
    tipo: product.tipo || 'physical',
    slug: product.slug || '',
    descricaoCurta: product.descricao_curta || product.descricaoCurta || '',
    seo: product.seo && typeof product.seo === 'object' ? product.seo : {},
    dadosFiscais: product.dados_fiscais && typeof product.dados_fiscais === 'object' ? product.dados_fiscais : {},
    cat: product.category_name || 'Geral',
    categoryId: product.category_id || '',
    cod: variant.sku || 'Sem SKU',
    preco: number(variant.preco),
    precoPromocional: variant.precoPromocional == null ? null : number(variant.precoPromocional),
    estoque: number(variant.estoque),
    imagem: product.media?.[0]?.publicUrl || product.media?.[0]?.public_url || '',
    variantes: Array.isArray(product.variants) ? product.variants : [],
    media: Array.isArray(product.media) ? product.media : [],
    ativo: productChannelPublished(product),
    publicado: productChannelPublished(product),
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
    subtotal: number(order.subtotal),
    frete: number(order.frete),
    total: number(order.total),
    paymentStatus: order.payment_status || null,
    fulfillment: order.fulfillment || null,
    shippingMethodId: order.shipping_method_id || null,
    shippingQuoteId: order.shipping_quote_id || null,
    criadoEm: order.criado_em,
    itens: Array.isArray(order.items) ? order.items.map(item => ({ ...item, qtd: Number(item.quantidade || 0), nome: item.nome || item.nome_snapshot, preco: number(item.preco), subtotal: number(item.subtotal) })) : [],
    core: true,
  }
}

function normalizePayment(payment) {
  return { ...payment, amount: number(payment.amount), fee: payment.fee == null ? null : number(payment.fee) }
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

async function safeCoreGet(path, fallback, warnings, label) {
  try {
    return await api.get(path)
  } catch (error) {
    if (![403, 404, 500, 502, 503].includes(Number(error.status))) throw error
    warnings.push({ path, label, status: error.status || 0, code: error.code || '' })
    return fallback
  }
}

function scopedPath(path, storefrontId) {
  if (!storefrontId) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}storefrontId=${encodeURIComponent(storefrontId)}`
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

export async function loadCommerceAdmin({ storefrontId: preferredStorefrontId = null, locationId: preferredLocationId = null } = {}) {
  const warnings = []
  try {
    const [storefrontData, storefrontsData, categoryData, promotionData, templateData, roleData, membershipData, orderData, customerData, locations, shippingData, shippingProviderData, shippingAccountData, fulfillmentData, domainData, providerData, accountData, paymentData, creditData, auditData, healthData] = await Promise.all([
      api.get('/api/admin/commerce/storefront'),
      safeCoreGet('/api/admin/commerce/storefronts', { items: [] }, warnings, 'lojas Commerce'),
      safeCoreGet('/api/admin/commerce/catalog/categories', { items: [] }, warnings, 'categorias'),
      safeCoreGet('/api/admin/commerce/promotions', { items: [] }, warnings, 'promoções'),
      safeCoreGet('/api/admin/commerce/promotions/templates', { items: [] }, warnings, 'templates promocionais'),
      safeCoreGet('/api/admin/commerce/users/roles', { items: [] }, warnings, 'papéis'),
      safeCoreGet('/api/admin/commerce/users/memberships', { items: [] }, warnings, 'usuários'),
      api.get('/api/admin/commerce/orders'),
      safeCoreGet('/api/admin/commerce/customers', { items: [] }, warnings, 'clientes'),
      safeCoreGet('/api/admin/commerce/inventory/locations', { items: [] }, warnings, 'locais de estoque'),
      safeCoreGet('/api/admin/commerce/shipping/methods', { items: [] }, warnings, 'métodos de entrega'),
      safeCoreGet('/api/admin/commerce/shipping/providers', { items: [] }, warnings, 'provedores logísticos'),
      safeCoreGet('/api/admin/commerce/shipping/accounts', { items: [] }, warnings, 'contas logísticas'),
      safeCoreGet('/api/admin/commerce/fulfillments', { items: [] }, warnings, 'fulfillments'),
      safeCoreGet('/api/admin/commerce/storefront/domains', { items: [] }, warnings, 'domínios'),
      safeCoreGet('/api/admin/commerce/payments/providers', { items: [] }, warnings, 'provedores de pagamento'),
      safeCoreGet('/api/admin/commerce/payments/accounts', { items: [] }, warnings, 'contas de pagamento'),
      safeCoreGet('/api/admin/commerce/payments', { items: [] }, warnings, 'pagamentos'),
      safeCoreGet('/api/admin/commerce/credit/accounts', { items: [] }, warnings, 'contas de crediário'),
      safeCoreGet('/api/admin/commerce/audit', { items: [], pagination: { total: 0, limit: 100, offset: 0, hasMore: false } }, warnings, 'auditoria'),
      safeCoreGet('/api/admin/commerce/operations/health', {}, warnings, 'saúde operacional'),
    ])
    const storefronts = storefrontsData?.items || []
    const fallbackStorefrontId = storefrontData?.items?.[0]?.id || storefronts[0]?.id || null
    const selectedStorefront = storefronts.find(item => item.id === preferredStorefrontId)
      || storefronts.find(item => item.id === fallbackStorefrontId)
      || storefronts[0]
      || null
    const inventoryLocations = locations?.items || []
    const eligibleLocations = selectedStorefront?.loja_id
      ? inventoryLocations.filter(item => item.loja_id === selectedStorefront.loja_id || item.loja_id == null)
      : inventoryLocations
    const selectedLocation = eligibleLocations.find(item => item.id === preferredLocationId) || eligibleLocations[0] || null
    const scope = new URLSearchParams()
    if (selectedStorefront?.id) scope.set('storefrontId', selectedStorefront.id)
    if (selectedLocation?.id) scope.set('locationId', selectedLocation.id)
    const productItems = await loadAllStorefrontProducts(({ limit, offset }) => api.get(`/api/admin/commerce/catalog/products?${scope.toString()}&limit=${limit}&offset=${offset}`))
    const [scopedOrders, scopedFulfillments, scopedPaymentAccounts, scopedPayments, scopedHealth] = await Promise.all([
      api.get(scopedPath('/api/admin/commerce/orders', selectedStorefront?.id)),
      safeCoreGet(scopedPath('/api/admin/commerce/fulfillments', selectedStorefront?.id), { items: [] }, warnings, 'fulfillments'),
      safeCoreGet(scopedPath('/api/admin/commerce/payments/accounts', selectedStorefront?.id), { items: [] }, warnings, 'contas de pagamento'),
      safeCoreGet(scopedPath('/api/admin/commerce/payments', selectedStorefront?.id), { items: [] }, warnings, 'pagamentos'),
      safeCoreGet(scopedPath('/api/admin/commerce/operations/health', selectedStorefront?.id), {}, warnings, 'saúde operacional'),
    ])
    return {
      mode: 'core',
      storefrontId: selectedStorefront?.id || null,
      storefronts,
      locationId: selectedLocation?.id || null,
      inventoryLocations,
      categories: categoryData?.items || [],
      promotions: promotionData?.items || [],
      promotionTemplates: templateData?.items || [],
      roles: roleData?.items || [],
      memberships: membershipData?.items || [],
      products: productItems.map(normalizeCoreProduct),
      orders: (scopedOrders?.items || []).map(normalizeCoreOrder),
      customers: customerData?.items || [],
      shippingMethods: shippingData?.items || [],
      shippingProviders: shippingProviderData?.items || [],
      shippingAccounts: shippingAccountData?.items || [],
      fulfillments: scopedFulfillments?.items || [],
      domains: domainData?.items || [],
      paymentProviders: providerData?.items || [],
      paymentAccounts: scopedPaymentAccounts?.items || [],
      payments: (scopedPayments?.items || []).map(normalizePayment),
      creditAccounts: creditData?.items || [],
      audit: auditData?.items || [],
      auditPagination: auditData?.pagination || { total: auditData?.items?.length || 0, limit: 100, offset: 0, hasMore: false },
      health: scopedHealth || {},
      warnings,
    }
  } catch (error) {
    if (error.status !== 404) throw error
    return loadLegacy()
  }
}

export async function createCoreStorefront(payload) {
  return api.post('/api/admin/commerce/storefronts', payload)
}

export async function updateCoreStorefront(id, payload) {
  return api.patch(`/api/admin/commerce/storefronts/${id}`, payload)
}

export async function createCorePromotionTemplate(payload) {
  return api.post('/api/admin/commerce/promotions/templates', payload)
}

export async function createCoreCategory(payload) {
  return api.post('/api/admin/commerce/catalog/categories', payload)
}

export async function updateCoreCategory(id, payload) {
  return api.patch(`/api/admin/commerce/catalog/categories/${id}`, payload)
}

export async function createCoreVariant(productId, payload) {
  return api.post(`/api/admin/commerce/catalog/products/${productId}/variants`, payload)
}

export async function updateCoreVariant(id, payload) {
  return api.patch(`/api/admin/commerce/catalog/variants/${id}`, payload)
}

export async function archiveCoreVariant(id) {
  return api.delete(`/api/admin/commerce/catalog/variants/${id}`)
}

export async function listCoreProductMedia(productId, storefrontId) {
  return api.get(scopedPath(`/api/admin/commerce/catalog/products/${productId}/media`, storefrontId))
}

export async function createCoreProductMedia(productId, payload, storefrontId) {
  return api.post(`/api/admin/commerce/catalog/products/${productId}/media`, { ...payload, storefrontId })
}

export async function uploadCoreProductMedia(productId, file, { altText = '', ordem = 0, variantId = null, idempotencyKey = '', storefrontId = null } = {}) {
  if (!file) throw new Error('Selecione uma imagem antes de enviar.')
  const headers = {
    'X-Image-Alt': String(altText || file.name || '').slice(0, 255),
    'X-Image-Order': String(Number.isInteger(Number(ordem)) ? Number(ordem) : 0),
  }
  if (variantId) headers['X-Variant-Id'] = variantId
  if (idempotencyKey) headers['X-Idempotency-Key'] = String(idempotencyKey).slice(0, 200)
  if (storefrontId) headers['X-Storefront-Id'] = storefrontId
  return api.upload(`/api/admin/commerce/catalog/products/${productId}/media/upload`, file, headers)
}

export async function deleteCoreProductMedia(id, storefrontId) {
  return api.delete(scopedPath(`/api/admin/commerce/catalog/media/${id}`, storefrontId))
}

export async function saveCoreProduct({ editingId, current, form, storefrontId, locationId, idempotencyKey }) {
  if (!storefrontId) throw new Error('Selecione a vitrine antes de salvar o produto.')
  if (!locationId) throw new Error('Selecione o local de estoque antes de salvar o produto.')
  if (!idempotencyKey) throw new Error('A sessão de salvamento expirou. Feche e reabra o formulário.')
  if (current?.status === 'archived') throw new Error('Produto arquivado não pode ser editado. Duplique-o como rascunho.')
  const price = number(form.preco)
  const promotional = form.precoPromocional === '' ? null : number(form.precoPromocional)
  const variants = current?.variantes || current?.variants || []
  const variantId = current?.variantId || variants[0]?.id || null
  const mediaUrl = String(form.imagem || '').trim()
  const knownMedia = Array.isArray(current?.media) ? current.media : []
  const payload = {
    productId: editingId || null,
    storefrontId,
    locationId,
    product: {
      nome: form.nome,
      slug: form.slug || undefined,
      tipo: form.tipo || 'physical',
      categoryId: form.categoryId || null,
      descricao: form.descricao,
      descricaoCurta: form.descricaoCurta,
      seo: { title: form.seoTitulo || '', description: form.seoDescricao || '' },
      dadosFiscais: form.dadosFiscais || {},
      status: form.status || (form.ativo ? 'active' : 'draft'),
    },
    variant: { id: variantId, sku: form.cod || undefined },
    price,
    promotionalPrice: promotional,
    targetStock: number(form.estoque),
    // Estoque de quando o formulário abriu: o servidor recusa se houve venda nesse meio tempo.
    expectedStock: editingId ? number(current?.estoque ?? current?.estoqueDisponivel ?? 0) : null,
    published: form.publicado === true,
    media: mediaUrl && !knownMedia.some(media => (media.public_url || media.publicUrl) === mediaUrl)
      ? { url: mediaUrl, storageKey: mediaUrl, mimeType: 'image/*', altText: form.nome }
      : null,
  }
  return api.put('/api/admin/commerce/catalog/products/workspace', payload, { headers: { 'X-Idempotency-Key': idempotencyKey } })
}

export async function toggleCoreProduct(product, storefrontId) {
  if (!storefrontId) throw new Error('storefront do canal não configurado')
  return api.post(`/api/admin/commerce/catalog/products/${product.id}/publish`, {
    storefrontId,
    publicado: product.publicado !== true,
  })
}

export async function deleteCoreProduct(product, storefrontId) {
  return api.delete(scopedPath(`/api/admin/commerce/catalog/products/${product.id}`, storefrontId))
}

export async function updateCoreOrder(order, status, storefrontId) {
  const next = LEGACY_TO_CORE[status] || status
  return api.patch(`/api/admin/commerce/orders/${order.id}`, { status: next, storefrontId })
}

export async function createCorePromotion(form) {
  const promotion = await api.post('/api/admin/commerce/promotions', {
    nome: form.nome,
    tipo: form.tipo,
    valor: Number(form.valor),
    limiteUso: form.limiteUso ? Number(form.limiteUso) : null,
    templateId: form.templateId || null,
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

export async function createCoreCustomer(payload) {
  return api.post('/api/admin/commerce/customers', payload)
}

export async function updateCoreCustomer(id, payload) {
  return api.patch(`/api/admin/commerce/customers/${id}`, payload)
}

export async function loadCoreCustomerAddresses(customerId) {
  return api.get(`/api/admin/commerce/customers/${customerId}/addresses`)
}

export async function createCoreCustomerAddress(customerId, payload) {
  return api.post(`/api/admin/commerce/customers/${customerId}/addresses`, payload)
}

export async function updateCoreCustomerAddress(customerId, addressId, payload) {
  return api.patch(`/api/admin/commerce/customers/${customerId}/addresses/${addressId}`, payload)
}

export async function deleteCoreCustomerAddress(customerId, addressId) {
  return api.delete(`/api/admin/commerce/customers/${customerId}/addresses/${addressId}`)
}

export async function createCoreShippingMethod(payload) {
  return api.post('/api/admin/commerce/shipping/methods', payload)
}

export async function createCoreCreditAccount(payload) {
  return api.post('/api/admin/commerce/credit/accounts', payload)
}

export async function updateCoreCreditAccount(id, payload) {
  return api.patch(`/api/admin/commerce/credit/accounts/${id}`, payload)
}

export async function updateCoreShippingMethod(id, payload) {
  return api.patch(`/api/admin/commerce/shipping/methods/${id}`, payload)
}

export async function createCoreShippingAccount(payload) {
  return api.post('/api/admin/commerce/shipping/accounts', payload)
}

export async function updateCoreShippingAccount(id, payload) {
  return api.patch(`/api/admin/commerce/shipping/accounts/${id}`, payload)
}

export async function createCoreShippingLabel(id, payload = {}, storefrontId) {
  return api.post(`/api/admin/commerce/fulfillments/${id}/label`, { ...payload, storefrontId })
}

export async function syncCoreShippingTracking(id, storefrontId) {
  return api.post(`/api/admin/commerce/fulfillments/${id}/track`, { storefrontId })
}

export async function cancelCoreShippingLabel(id, storefrontId) {
  return api.post(`/api/admin/commerce/fulfillments/${id}/cancel-label`, { storefrontId })
}

export async function createCoreDomain(payload) {
  return api.post('/api/admin/commerce/storefront/domains', payload)
}

export async function verifyCoreDomain(id) {
  return api.post(`/api/admin/commerce/storefront/domains/${id}/verify`, {})
}

export async function setPrimaryCoreDomain(id) {
  return api.post(`/api/admin/commerce/storefront/domains/${id}/primary`, {})
}

export async function createCoreFulfillment(payload) {
  return api.post('/api/admin/commerce/fulfillments', payload)
}

export async function updateCoreFulfillment(id, payload) {
  return api.patch(`/api/admin/commerce/fulfillments/${id}`, payload)
}

export async function createCorePaymentAccount(payload) {
  return api.post('/api/admin/commerce/payments/accounts', payload)
}

export async function updateCorePaymentAccount(id, payload) {
  return api.patch(`/api/admin/commerce/payments/accounts/${id}`, payload)
}

export async function createCorePaymentAttempt(orderId, payload) {
  return api.post(`/api/admin/commerce/orders/${orderId}/payments`, payload)
}

export async function syncCorePayment(paymentId, storefrontId) {
  return api.post(`/api/admin/commerce/payments/${paymentId}/sync`, { storefrontId })
}

export async function reconcileCorePayment(paymentId, payload, storefrontId) {
  return api.post(`/api/admin/commerce/payments/${paymentId}/reconcile`, { ...payload, storefrontId })
}

export async function loadCoreReports(storefrontId) {
  const [sales, fulfillment, inventory, customers] = await Promise.all([
    api.get(scopedPath('/api/admin/commerce/reports/sales', storefrontId)),
    api.get(scopedPath('/api/admin/commerce/reports/fulfillment', storefrontId)),
    api.get('/api/admin/commerce/reports/inventory'),
    api.get('/api/admin/commerce/reports/customers'),
  ])
  return { sales, fulfillment, inventory, customers }
}

export { CORE_TO_LEGACY, LEGACY_TO_CORE }
