import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, BarChart3, Check, ChevronRight, ClipboardList, CreditCard, Edit3, Eye, FileBarChart, Globe2, Layers3, PackagePlus, Plus, RefreshCw, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, Trash2, Truck, X } from 'lucide-react'
import { fmtDate, fmtMoney } from '../../lib/api'
import { Link, useSearchParams } from 'react-router-dom'

// Customer 360 aceita só ids UUID do Commerce Core (clientes legados não têm ficha unificada).
const customer360Path = (customerId) => /^[0-9a-f-]{36}$/i.test(String(customerId || '')) ? `/admin/clientes-360/${encodeURIComponent(`loja:${customerId}`)}` : ''
function CustomerName({ id, children }) {
  const path = customer360Path(id)
  return path ? <Link to={path} className="ecommerce-customer360-link" title="Abrir Customer 360">{children}</Link> : children
}
import { adminProductMediaUrl, archiveCoreVariant, createCoreCategory, createCoreCustomer, createCoreCustomerAddress, createCoreDomain, createCoreFulfillment, createCorePaymentAccount, createCorePaymentAttempt, createCoreProductMedia, createCorePromotionTemplate, createCoreShippingLabel, cancelCoreShippingLabel, createCoreShippingAccount, createCoreShippingMethod, createCoreStorefront, createCoreCreditAccount, updateCoreCreditAccount, reconcileCorePayment, updateCoreStorefront, updateCoreShippingMethod, createCorePromotion, createCoreVariant, deleteCoreCustomerAddress, deleteCoreProduct, deleteCoreProductMedia, listCoreProductMedia, loadCommerceAdmin, loadCoreCustomerAddresses, loadCoreReports, saveCoreProduct, setPrimaryCoreDomain, syncCorePayment, syncCoreShippingTracking, toggleCoreProduct, updateCoreCategory, updateCoreCustomer, updateCoreCustomerAddress, updateCoreFulfillment, updateCoreMembership, updateCoreOrder, updateCorePaymentAccount, updateCoreShippingAccount, updateCoreVariant, uploadCoreProductMedia, verifyCoreDomain } from './commerce-admin-adapter'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { isTenantScope } from '../../lib/tenant-scope'
import { paymentAccountForm, paymentAccountPublicConfig, primaryVerifiedDomain } from '../../lib/payment-account-form'
import CommerceProductManagement from './CommerceProductManagement'
import OwnDeliveryRulesEditor from './OwnDeliveryRulesEditor'
import CurrencyInput from '../../components/CurrencyInput'
import './ecommerce-admin.css'

const STATUS = [
  ['pendente', 'Novos'],
  ['preparando', 'Em preparo'],
  ['pronto', 'Prontos'],
  ['entregue', 'Concluídos'],
  ['cancelado', 'Cancelados'],
]
const FULFILLMENT_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['shipped', 'out_for_delivery', 'picked_up', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['preparing', 'cancelled'],
}
const FULFILLMENT_LABELS = { pending: 'Pendente', preparing: 'Em preparo', ready: 'Pronto', shipped: 'Enviado', out_for_delivery: 'Em rota', delivered: 'Entregue', picked_up: 'Retirado', failed: 'Falhou', cancelled: 'Cancelado' }

const EMPTY_FORM = { nome: '', cod: '', cat: 'Geral', categoryId: '', tipo: 'physical', slug: '', preco: '', precoPromocional: '', estoque: '', descricaoCurta: '', descricao: '', seoTitulo: '', seoDescricao: '', dadosFiscais: {}, imagem: '', status: 'draft', publicado: false, ativo: false }
const EMPTY_PROMOTION = { nome: '', tipo: 'percentage', valor: '', codigo: '', limiteUso: '', usoMaximo: '' }
const EMPTY_CUSTOMER = { nome: '', email: '', telefone: '', documentoMascarado: '', bloqueado: false }
const EMPTY_CREDIT = { customerId: '', limiteCredito: '', prazoDias: '30', status: 'active', observacoes: '' }
const EMPTY_ADDRESS = { rotulo: 'principal', destinatario: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '', padrao: true }
const EMPTY_SHIPPING = { codigo: '', nome: '', tipo: 'pickup', provider: 'manual', deliveryType: 'regional_table', baseFee: '', pricePerKm: '', pricePerZone: '', fixedFee: '', additionalFee: '', freeShippingAbove: '', maxRadiusKm: '', distanceKm: '', deliveryDays: '3', originCep: '', rulesJson: '[]', configuracao: '{}', shippingAccountId: '', ativo: true }
const EMPTY_SHIPPING_ACCOUNT = { provider: 'melhorenvio', ambiente: 'sandbox', nome: 'Melhor Envio · Sandbox', secretRef: 'env:ME_ACCESS_TOKEN', webhookSecretRef: 'env:ME_WEBHOOK_SECRET', services: '', servicesAdditional: '', prepostagemApiEnabled: false, modalidadePagamento: '', postingCard: '', labelType: 'P', labelFormat: 'ET', labelLayout: 'PADRAO', origemCep: '', origin: { name: '', email: '', phone: '', document: '', companyDocument: '', stateRegister: '', address: '', number: '', complement: '', district: '', city: '', postalCode: '', stateAbbr: '' }, nonCommercial: false, ativo: false }
const EMPTY_DOMAIN = { dominio: '', principal: false }
const EMPTY_CATEGORY = { nome: '', descricao: '', ordem: 0, parentId: '' }
const EMPTY_STOREFRONT = { codigo: '', nome: '', lojaId: '', lojaCodigo: '', lojaNome: '', nomeFantasia: '', criarUnidade: true, canal: 'web', moeda: 'BRL', timezone: 'America/Sao_Paulo', status: 'active', dominio: '' }
const EMPTY_TEMPLATE = { codigo: '', nome: '', descricao: '', tipo: 'percentage', valor: '', regrasJson: '{}' }
const COMMERCE_TAB_BY_QUERY = { overview: 'visao', stores: 'lojas', catalog: 'catalogo', orders: 'pedidos', promotions: 'promocoes', reports: 'relatorios', customers: 'clientes', shipping: 'fulfillment', fulfillment: 'fulfillment', domains: 'dominios', payments: 'pagamentos', users: 'usuarios', audit: 'auditoria' }

function auditValue(value) {
  if (value == null) return '—'
  try { return JSON.stringify(value) }
  catch { return 'dados indisponíveis' }
}

const ADMIN_DIALOG_SELECTOR = '.ecommerce-admin-overlay[role="dialog"]'
const ADMIN_FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useAdminDialogFocusTrap() {
  const activeDialog = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    let focusFrame = 0
    const visibleDialog = () => Array.from(document.querySelectorAll(ADMIN_DIALOG_SELECTOR)).findLast(element => element.getClientRects().length > 0) || null
    const focusableInside = dialog => Array.from(dialog.querySelectorAll(ADMIN_FOCUSABLE_SELECTOR)).filter(element => element.getClientRects().length > 0)
    const syncDialog = () => {
      const nextDialog = visibleDialog()
      if (nextDialog === activeDialog.current) return
      if (nextDialog) {
        if (!activeDialog.current) previousFocus.current = document.activeElement
        activeDialog.current = nextDialog
        nextDialog.tabIndex = -1
        cancelAnimationFrame(focusFrame)
        focusFrame = requestAnimationFrame(() => {
          if (activeDialog.current !== nextDialog || nextDialog.contains(document.activeElement)) return
          ;(focusableInside(nextDialog)[0] || nextDialog).focus()
        })
        return
      }
      if (activeDialog.current) {
        activeDialog.current = null
        const target = previousFocus.current
        previousFocus.current = null
        if (target instanceof HTMLElement && document.contains(target)) target.focus()
      }
    }
    const onKeyDown = event => {
      const dialog = activeDialog.current
      if (!dialog) return
      if (event.key === 'Escape') {
        const close = dialog.querySelector('.ecommerce-admin-close')
        if (close instanceof HTMLElement) {
          event.preventDefault()
          close.click()
        }
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusableInside(dialog)
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const observer = new MutationObserver(syncDialog)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('keydown', onKeyDown)
    syncDialog()
    return () => {
      cancelAnimationFrame(focusFrame)
      observer.disconnect()
      document.removeEventListener('keydown', onKeyDown)
      const target = previousFocus.current
      if (target instanceof HTMLElement && document.contains(target)) target.focus()
      activeDialog.current = null
      previousFocus.current = null
    }
  }, [])
}

function ProductMediaImage({ media, storefrontId, alt = 'Imagem do produto', className = '' }) {
  const previewUrl = adminProductMediaUrl(media, storefrontId)
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setSrc('')
    setFailed(false)
    if (!previewUrl) return () => {}
    if (!previewUrl.startsWith('/api/admin/commerce/catalog/media/')) {
      setSrc(previewUrl)
      return () => {}
    }
    api.blob(previewUrl).then(blob => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setSrc(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [previewUrl])
  if (!src && !failed) {
    return <div className={`commerce-product-media-fallback ${className}`.trim()} role="status"><PackagePlus size={24} aria-hidden="true" /><span>Carregando imagem…</span></div>
  }
  if (failed) {
    return <div className={`commerce-product-media-fallback ${className}`.trim()} role="img" aria-label={`${alt} — imagem indisponível`}><PackagePlus size={24} aria-hidden="true" /><span>Imagem indisponível</span></div>
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
}

export default function EcommerceAdmin() {
  const { lojasAcessiveis, atualizarContextoLojas, user: authUser, empresaAtiva: empresaAtivaAuth } = useAuth()
  const tenantScope = isTenantScope(authUser, empresaAtivaAuth)
  useAdminDialogFocusTrap()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [products, setProducts] = useState([])
  const [storefronts, setStorefronts] = useState([])
  const [promotionTemplates, setPromotionTemplates] = useState([])
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [creditAccounts, setCreditAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [promotions, setPromotions] = useState([])
  const [memberships, setMemberships] = useState([])
  const [roles, setRoles] = useState([])
  const [shippingMethods, setShippingMethods] = useState([])
  const [shippingProviders, setShippingProviders] = useState([])
  const [shippingAccounts, setShippingAccounts] = useState([])
  const [fulfillments, setFulfillments] = useState([])
  const [domains, setDomains] = useState([])
  const [reports, setReports] = useState(null)
  const [paymentProviders, setPaymentProviders] = useState([])
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [payments, setPayments] = useState([])
  const [audit, setAudit] = useState([])
  const [auditPagination, setAuditPagination] = useState({ total: 0, limit: 100, offset: 0, hasMore: false })
  const [health, setHealth] = useState({})
  const [auditQuery, setAuditQuery] = useState('')
  const [paymentForm, setPaymentForm] = useState(() => paymentAccountForm())
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [reconcileTarget, setReconcileTarget] = useState(null)
  const [reconcileForm, setReconcileForm] = useState({ transactionNsu: '', slug: '', receiptUrl: '', captureMethod: '' })
  const [storefrontModalOpen, setStorefrontModalOpen] = useState(false)
  const [storefrontActivationTarget, setStorefrontActivationTarget] = useState(null)
  const [storefrontActivationLoading, setStorefrontActivationLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [promotionForm, setPromotionForm] = useState({ ...EMPTY_PROMOTION, templateId: '' })
  const [storefrontForm, setStorefrontForm] = useState(EMPTY_STOREFRONT)
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [variantForm, setVariantForm] = useState({ sku: '', nome: '', barcode: '', pesoGramas: '', larguraCm: '', alturaCm: '', comprimentoCm: '', atributosJson: '{}', preco: '', precoPromocional: '', ativo: true })
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [variantEditingId, setVariantEditingId] = useState(null)
  const [variantProduct, setVariantProduct] = useState(null)
  const [productMedia, setProductMedia] = useState([])
  const [selectedImageFiles, setSelectedImageFiles] = useState([])
  const [imageAltText, setImageAltText] = useState('')
  const [imageOrderBase, setImageOrderBase] = useState(0)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaForm, setMediaForm] = useState({ url: '', altText: '', ordem: 0 })
  const [mode, setMode] = useState('legacy')
  const [storefrontId, setStorefrontId] = useState(null)
  const loadRequestId = useRef(0)
  const reportRequestId = useRef(0)
  const [locationId, setLocationId] = useState(null)
  const [inventoryLocations, setInventoryLocations] = useState([])
  const [catalogUnavailable, setCatalogUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [orderQuery, setOrderQuery] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [tab, setTab] = useState(() => COMMERCE_TAB_BY_QUERY[requestedTab] || 'visao')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [productSaveKey, setProductSaveKey] = useState('')
  const [notice, setNotice] = useState('')
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER)
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT)
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  const [editingCreditAccountId, setEditingCreditAccountId] = useState(null)
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS)
  const [shippingForm, setShippingForm] = useState(EMPTY_SHIPPING)
  const [domainForm, setDomainForm] = useState(EMPTY_DOMAIN)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [shippingModalOpen, setShippingModalOpen] = useState(false)
  const [editingShippingMethodId, setEditingShippingMethodId] = useState(null)
  const [shippingAccountForm, setShippingAccountForm] = useState(EMPTY_SHIPPING_ACCOUNT)
  const [shippingAccountModalOpen, setShippingAccountModalOpen] = useState(false)
  const [domainModalOpen, setDomainModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerAddresses, setCustomerAddresses] = useState([])
  const [editingCustomerId, setEditingCustomerId] = useState(null)
  const [editingAddressId, setEditingAddressId] = useState(null)

  const commerceStores = useMemo(() => {
    const seen = new Map()
    storefronts.forEach(item => {
      if (!item.loja_id || seen.has(item.loja_id)) return
      seen.set(item.loja_id, { id: item.loja_id, codigo: item.loja_codigo || item.codigo, nome: item.loja_nome || item.nome, ativa: true })
    })
    return Array.from(seen.values())
  }, [storefronts])

  function syncStoreContext(storefront) {
    if (!storefront?.loja_id) return
    const merged = new Map((Array.isArray(lojasAcessiveis) ? lojasAcessiveis : []).map(item => [item.id, item]))
    commerceStores.forEach(item => merged.set(item.id, item))
    const loja = commerceStores.find(item => item.id === storefront.loja_id)
    if (loja) atualizarContextoLojas({ lojas_acessiveis: Array.from(merged.values()), loja })
  }

  function selectStorefront(storefront) {
    if (!storefront?.id) return
    if (storefront.status && storefront.status !== 'active') {
      setError('Ative a vitrine antes de operar seus dados.')
      return
    }
    setStorefrontId(storefront.id)
    syncStoreContext(storefront)
    setNotice(`Loja ativa: ${storefront.nome}. As abas serão recarregadas neste escopo.`)
    void loadData(true, { storefrontId: storefront.id, locationId: null })
  }

  async function loadData(silent = false, selection = {}) {
    const requestId = ++loadRequestId.current
    ++reportRequestId.current
    setReports(null)
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const data = await loadCommerceAdmin({ storefrontId: selection.storefrontId ?? storefrontId, locationId: selection.locationId ?? locationId })
      if (requestId !== loadRequestId.current) return
      setMode(data.mode)
      const availableStorefronts = data.storefronts || []
      setStorefronts(availableStorefronts)
      setPromotionTemplates(data.promotionTemplates || [])
      setStorefrontId(data.storefrontId || null)
      setLocationId(data.locationId)
      setInventoryLocations(data.inventoryLocations || [])
      setProducts(data.products)
      setCatalogUnavailable(Boolean(data.catalogUnavailable))
      setOrders(data.orders)
      setCustomers(data.customers)
      setCreditAccounts(data.creditAccounts || [])
      setCategories(data.categories || [])
      setPromotions(data.promotions || [])
      setMemberships(data.memberships || [])
      setRoles(data.roles || [])
      setShippingMethods(data.shippingMethods || [])
      setShippingProviders(data.shippingProviders || [])
      setShippingAccounts(data.shippingAccounts || [])
      setFulfillments(data.fulfillments || [])
      setDomains(data.domains || [])
      setPaymentProviders(data.paymentProviders || [])
      setPaymentAccounts(data.paymentAccounts || [])
      setPayments(data.payments || [])
      setAudit(data.audit || [])
      setAuditPagination(data.auditPagination || { total: data.audit?.length || 0, limit: 100, offset: 0, hasMore: false })
      setHealth(data.health || {})
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setNotice(`Alguns módulos estão indisponíveis: ${data.warnings.map(item => item.label).join(', ')}. Os dados carregados continuam disponíveis.`)
      }
    } catch (err) { if (requestId === loadRequestId.current) setError(err.message || 'Não foi possível carregar a operação comercial.') }
    finally { if (requestId === loadRequestId.current) { setLoading(false); setRefreshing(false) } }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const nextTab = COMMERCE_TAB_BY_QUERY[requestedTab]
    if (nextTab) setTab(nextTab)
  }, [requestedTab])

  useEffect(() => {
    if (mode !== 'core' || !storefronts.length) return
    const active = storefronts.find(item => item.id === storefrontId && (!item.status || item.status === 'active'))
    syncStoreContext(active)
  }, [mode, storefronts, storefrontId, commerceStores])

  const filteredOrders = useMemo(() => {
    const needle = orderQuery.trim().toLowerCase()
    if (!needle) return orders
    return orders.filter(order => `${order.codigo || ''} ${order.cliente?.nome || ''} ${order.cliente?.email || ''} ${order.status || ''}`.toLowerCase().includes(needle))
  }, [orders, orderQuery])
  const filteredCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter(customer => `${customer.nome || ''} ${customer.email || ''} ${customer.telefone || ''}`.toLowerCase().includes(needle))
  }, [customers, customerQuery])
  const filteredAudit = useMemo(() => {
    const needle = auditQuery.trim().toLowerCase()
    if (!needle) return audit
    return audit.filter(item => `${item.entidade || ''} ${item.acao || ''} ${item.entidade_id || ''} ${item.correlation_id || ''}`.toLowerCase().includes(needle))
  }, [audit, auditQuery])
  const revenue = orders.filter(order => order.status !== 'cancelado').reduce((sum, order) => sum + Number(order.total || 0), 0)
  const lowStock = products.filter(item => Number(item.estoque || 0) <= 5 && item.ativo !== false).length
  const publishedProducts = products.filter(item => item.ativo !== false).length
  const totalUnits = products.reduce((sum, item) => sum + Number(item.estoque || 0), 0)
  const openOrders = orders.filter(order => !['entregue', 'cancelado'].includes(order.status)).length
  const pendingPayments = Number(health.payments?.pending || 0) + Number(health.payments?.authorized || 0)
  const failedWebhooks = Number(health.webhooks?.payments?.failed || 0) + Number(health.webhooks?.shipping?.failed || 0)
  const fulfillmentAttention = Number(health.fulfillments?.pending || 0) + Number(health.fulfillments?.failed || 0)
  const readyPaymentAccounts = paymentAccounts.filter(account => account.ativo && account.ready).length
  const readyShippingAccounts = shippingAccounts.filter(account => account.ativo && account.ready).length
  const activeStorefront = storefronts.find(item => item.id === storefrontId && (!item.status || item.status === 'active')) || null
  const activeCurrency = String(activeStorefront?.moeda || 'BRL').trim().toUpperCase()
  const money = value => fmtMoney(value, activeCurrency)
  const currencyLabel = activeCurrency === 'BRL' ? 'R$' : activeCurrency === 'USD' ? '$' : activeCurrency

  function beginCreate() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setEditingProduct(null)
    setProductMedia([])
    setSelectedImageFiles([])
    setImageAltText('')
    setImageOrderBase(0)
    setProductSaveKey(crypto.randomUUID())
    setModalOpen(true)
  }
  function beginCategoryEdit(category) { setEditingCategoryId(category.id); setCategoryForm({ nome: category.nome || '', descricao: category.descricao || '', ordem: category.ordem || 0, parentId: category.parent_id || '' }) }
  function beginEdit(item) {
    const seo = item.seo && typeof item.seo === 'object' ? item.seo : {}
    setForm({ nome: item.nome || '', cod: item.cod || '', cat: item.cat || 'Geral', categoryId: item.categoryId || item.category_id || '', tipo: item.tipo || 'physical', slug: item.slug || '', preco: item.preco ?? '', precoPromocional: item.precoPromocional ?? '', estoque: item.estoque ?? '', descricaoCurta: item.descricaoCurta || item.descricao_curta || '', descricao: item.descricao || item.desc || '', seoTitulo: seo.title || seo.titulo || '', seoDescricao: seo.description || seo.descricao || '', dadosFiscais: item.dadosFiscais || item.dados_fiscais || {}, imagem: item.imagem || '', status: item.status || 'draft', publicado: item.publicado === true, ativo: item.ativo !== false })
    setEditingId(item.id)
    setEditingProduct(item)
    setProductMedia(Array.isArray(item.media) ? item.media : [])
    setSelectedImageFiles([])
    setImageAltText('')
    setImageOrderBase(Array.isArray(item.media) ? item.media.length : 0)
    setProductSaveKey(crypto.randomUUID())
    setModalOpen(true)
    if (mode === 'core' && item.id) listCoreProductMedia(item.id, storefrontId).then(data => setProductMedia(data?.items || [])).catch(err => setError(err.message || 'Não foi possível carregar as imagens do produto.'))
  }
  function beginDuplicate(item) {
    const seo = item.seo && typeof item.seo === 'object' ? item.seo : {}
    setForm({
      nome: `${item.nome || 'Produto'} — cópia`,
      cod: '',
      cat: item.cat || 'Geral',
      categoryId: item.categoryId || item.category_id || '',
      tipo: item.tipo || 'physical',
      slug: '',
      preco: item.preco ?? '',
      precoPromocional: item.precoPromocional ?? '',
      estoque: 0,
      descricaoCurta: item.descricaoCurta || item.descricao_curta || '',
      descricao: item.descricao || item.desc || '',
      seoTitulo: seo.title || seo.titulo || '',
      seoDescricao: seo.description || seo.descricao || '',
      dadosFiscais: item.dadosFiscais || item.dados_fiscais || {},
      imagem: '',
      status: 'draft',
      publicado: false,
      ativo: false,
    })
    setEditingId(null)
    setEditingProduct(null)
    setProductMedia([])
    setSelectedImageFiles([])
    setImageAltText('')
    setImageOrderBase(0)
    setProductSaveKey(crypto.randomUUID())
    setNotice('Cópia preparada como rascunho, sem estoque ou imagens. Se o SKU ficar vazio, um novo código será gerado ao salvar.')
    setModalOpen(true)
  }
  function change(field, value) { setForm(current => ({ ...current, [field]: value })) }
  function changeVariant(field, value) { setVariantForm(current => ({ ...current, [field]: value })) }
  function addProductImages(files) {
    const invalid = files.find(file => !/^image\/(jpeg|png|webp|gif)$/i.test(file.type) || file.size > 8 * 1024 * 1024)
    if (invalid) {
      setError(`A imagem “${invalid.name}” deve ser JPEG, PNG, WebP ou GIF e ter no máximo 8 MB.`)
      return
    }
    setSelectedImageFiles(current => [...current, ...files.map(file => ({ file, uploadId: crypto.randomUUID(), previewUrl: URL.createObjectURL(file) }))])
  }
  function selectProductImages(event) {
    addProductImages(Array.from(event.target.files || []))
    event.target.value = ''
  }
  function dropProductImages(event) {
    event.preventDefault()
    addProductImages(Array.from(event.dataTransfer.files || []))
  }
  function removeSelectedImage(index) {
    setSelectedImageFiles(current => {
      const removed = current[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }
  function clearSelectedImageFiles() {
    setSelectedImageFiles(current => {
      current.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl) })
      return []
    })
  }
  function closeProductModal() {
    clearSelectedImageFiles()
    setModalOpen(false)
  }

  function changeMedia(field, value) { setMediaForm(current => ({ ...current, [field]: value })) }

  function changeCategory(field, value) { setCategoryForm(current => ({ ...current, [field]: value })) }
  async function saveCategory(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Categorias exigem o Commerce Core PostgreSQL ativo.')
      const payload = { ...categoryForm, ordem: Number(categoryForm.ordem || 0), parentId: categoryForm.parentId || null }
      if (editingCategoryId) {
        const updated = await updateCoreCategory(editingCategoryId, payload)
        setCategories(current => current.map(item => item.id === editingCategoryId ? updated : item).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome || '').localeCompare(String(b.nome || ''))))
        setNotice('Categoria atualizada no Commerce Core.')
      } else {
        const created = await createCoreCategory(payload)
        setCategories(current => [...current, created].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome || '').localeCompare(String(b.nome || ''))))
        setNotice('Categoria criada no Commerce Core.')
      }
      setEditingCategoryId(null)
      setCategoryForm(EMPTY_CATEGORY)
    } catch (err) { setError(err.message || 'Não foi possível criar a categoria.') }
  }

  async function beginVariantManager(product) {
    if (mode !== 'core') return setError('Variantes e mídias exigem o Commerce Core PostgreSQL ativo.')
    setVariantProduct(product)
    setVariantEditingId(null)
    setVariantForm({ sku: '', nome: '', barcode: '', pesoGramas: '', larguraCm: '', alturaCm: '', comprimentoCm: '', atributosJson: '{}', preco: '', precoPromocional: '', ativo: true })
    setMediaForm({ url: '', altText: '', ordem: 0 })
    setProductMedia(Array.isArray(product.media) ? product.media : [])
    setVariantModalOpen(true)
    try {
      const data = await listCoreProductMedia(product.id, storefrontId)
      setProductMedia(data?.items || [])
    } catch (err) { setError(err.message || 'Não foi possível carregar as mídias do produto.') }
  }
  function beginVariantEdit(variant) {
    setVariantEditingId(variant.id)
    setVariantForm({ sku: variant.sku || '', nome: variant.nome || '', barcode: variant.barcode || '', pesoGramas: variant.pesoGramas ?? '', larguraCm: variant.larguraCm ?? '', alturaCm: variant.alturaCm ?? '', comprimentoCm: variant.comprimentoCm ?? '', atributosJson: JSON.stringify(variant.atributos || {}, null, 2), preco: variant.preco ?? '', precoPromocional: variant.precoPromocional ?? '', ativo: variant.ativo !== false })
  }
  async function saveVariant(event) {
    event.preventDefault()
    try {
      if (!variantProduct) throw new Error('Produto da variante não selecionado.')
      let atributos
      try { atributos = JSON.parse(variantForm.atributosJson || '{}') } catch { throw new Error('Atributos devem conter JSON válido.') }
      if (!atributos || Array.isArray(atributos) || typeof atributos !== 'object') throw new Error('Atributos devem ser um objeto JSON.')
      const payload = { storefrontId, sku: variantForm.sku, nome: variantForm.nome, barcode: variantForm.barcode, pesoGramas: variantForm.pesoGramas === '' ? null : Number(variantForm.pesoGramas), larguraCm: variantForm.larguraCm === '' ? null : Number(variantForm.larguraCm), alturaCm: variantForm.alturaCm === '' ? null : Number(variantForm.alturaCm), comprimentoCm: variantForm.comprimentoCm === '' ? null : Number(variantForm.comprimentoCm), atributos, preco: variantForm.preco === '' ? undefined : Number(variantForm.preco), precoPromocional: variantForm.precoPromocional === '' ? null : Number(variantForm.precoPromocional), ativo: variantForm.ativo === true }
      if (variantEditingId) await updateCoreVariant(variantEditingId, payload)
      else await createCoreVariant(variantProduct.id, payload)
      setNotice(variantEditingId ? 'Variante atualizada no Commerce Core.' : 'Variante criada no Commerce Core.')
      setVariantEditingId(null)
      setVariantForm({ sku: '', nome: '', barcode: '', pesoGramas: '', larguraCm: '', alturaCm: '', comprimentoCm: '', atributosJson: '{}', preco: '', precoPromocional: '', ativo: true })
      await loadData(true)
      const refreshed = await loadCommerceAdmin()
      setVariantProduct((refreshed.products || []).find(item => item.id === variantProduct.id) || variantProduct)
    } catch (err) { setError(err.message || 'Não foi possível salvar a variante.') }
  }
  async function archiveVariant(variant) {
    if (!window.confirm(`Arquivar a variante “${variant.sku}”?`)) return
    try { await archiveCoreVariant(variant.id, storefrontId); setNotice('Variante arquivada.'); await loadData(true) } catch (err) { setError(err.message || 'Não foi possível arquivar a variante.') }
  }
  async function saveProductMedia(event) {
    event.preventDefault()
    try {
      if (!variantProduct || !mediaForm.url.trim()) throw new Error('Informe a URL da mídia.')
      const created = await createCoreProductMedia(variantProduct.id, { url: mediaForm.url.trim(), altText: mediaForm.altText.trim(), ordem: Number(mediaForm.ordem || 0) }, storefrontId)
      setProductMedia(current => [...current, created].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)))
      setMediaForm({ url: '', altText: '', ordem: 0 })
      setNotice('Mídia adicionada ao produto.')
    } catch (err) { setError(err.message || 'Não foi possível adicionar a mídia.') }
  }
  async function removeProductMedia(media) {
    if (!window.confirm('Remover esta mídia do produto?')) return
    try {
      await deleteCoreProductMedia(media.id, storefrontId)
      const mediaUrl = media.public_url || media.publicUrl || ''
      setProductMedia(current => current.filter(item => item.id !== media.id))
      if (mediaUrl && mediaUrl === form.imagem) change('imagem', '')
      setNotice('Mídia removida.')
    } catch (err) { setError(err.message || 'Não foi possível remover a mídia.') }
  }
  async function uploadProductImages(productId, orderBase = imageOrderBase) {
    if (mode !== 'core' || !productId || !selectedImageFiles.length) return []
    setMediaUploading(true)
    const uploaded = []
    try {
      for (const [index, selected] of selectedImageFiles.entries()) {
        const created = await uploadCoreProductMedia(productId, selected.file, { altText: imageAltText.trim() || form.nome, ordem: orderBase + index, idempotencyKey: `${productSaveKey}:media:${selected.uploadId}`, storefrontId })
        uploaded.push({ selected, media: created })
        setProductMedia(current => [...current, created].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)))
      }
      uploaded.forEach(item => { if (item.selected.previewUrl) URL.revokeObjectURL(item.selected.previewUrl) })
      setSelectedImageFiles(current => current.filter(selected => !uploaded.some(item => item.selected === selected)))
      setImageOrderBase(current => current + uploaded.length)
      setImageAltText('')
      return uploaded.map(item => item.media)
    } catch (err) {
      uploaded.forEach(item => { if (item.selected.previewUrl) URL.revokeObjectURL(item.selected.previewUrl) })
      setSelectedImageFiles(current => current.filter(selected => !uploaded.some(item => item.selected === selected)))
      throw err
    } finally {
      setMediaUploading(false)
    }
  }

  async function saveProduct(event) {
    event.preventDefault()
    try {
      if (mode === 'core') {
        const saved = await saveCoreProduct({ editingId, current: { ...editingProduct, media: productMedia }, form, storefrontId, locationId, idempotencyKey: productSaveKey })
        const productId = editingId || saved?.productId
        await uploadProductImages(productId, imageOrderBase)
        setNotice(editingId ? 'Produto atualizado no Commerce Core.' : 'Produto cadastrado no Commerce Core.')
        clearSelectedImageFiles()
        setProductSaveKey('')
        setModalOpen(false)
        await loadData(true, { storefrontId, locationId })
        return
      }
      const payload = { ...form, preco: Number(form.preco || 0), precoPromocional: form.precoPromocional === '' ? null : Number(form.precoPromocional), estoque: Number(form.estoque || 0) }
      const result = editingId ? await api.patch(`/api/admin/loja/${editingId}`, payload) : await api.post('/api/admin/loja', payload)
      const product = result?.produto || result
      setProducts(current => editingId ? current.map(item => item.id === editingId ? product : item) : [product, ...current])
      setNotice(editingId ? 'Produto atualizado.' : 'Produto cadastrado.')
      closeProductModal()
    } catch (err) { setError(err.message || 'Não foi possível salvar o produto.') }
  }

  async function toggleProduct(item) {
    try {
      if (mode === 'core') {
        await toggleCoreProduct(item, storefrontId)
        setNotice(item.ativo === false ? 'Produto publicado no canal.' : 'Produto retirado do canal.')
        await loadData(true)
        return
      }
      const result = await api.patch(`/api/admin/loja/${item.id}`, { ativo: item.ativo === false })
      const product = result?.produto || result
      setProducts(current => current.map(row => row.id === item.id ? product : row))
    } catch (err) { setError(err.message || 'Não foi possível alterar o status do produto.') }
  }

  async function deleteProduct(item) {
    const action = mode === 'core' ? 'Arquivar' : 'Excluir'
    if (!window.confirm(`${action} “${item.nome}”? ${mode === 'core' ? 'O histórico será preservado e o item sairá do catálogo ativo.' : 'Esta ação remove o item do catálogo.'}`)) return
    try {
      if (mode === 'core') {
        await deleteCoreProduct(item, storefrontId)
        setNotice('Produto arquivado no Commerce Core.')
        await loadData(true)
        return
      }
      await api.delete(`/api/admin/loja/${item.id}`)
      setProducts(current => current.filter(row => row.id !== item.id))
      setNotice('Produto excluído.')
    } catch (err) { setError(err.message || 'Não foi possível excluir o produto.') }
  }

  async function toggleMembership(membership) {
    try {
      await updateCoreMembership(membership.id, { ativo: !membership.ativo })
      setMemberships(current => current.map(item => item.id === membership.id ? { ...item, ativo: !item.ativo } : item))
      setNotice(`Membership de ${membership.email} ${membership.ativo ? 'desativada' : 'ativada'}.`)
    } catch (err) { setError(err.message || 'Não foi possível atualizar a membership.') }
  }

  function beginCustomerCreate() { setCustomerForm(EMPTY_CUSTOMER); setEditingCustomerId(null); setCustomerModalOpen(true) }
  function beginCustomerEdit(customer) { setCustomerForm({ nome: customer.nome || '', email: customer.email || '', telefone: customer.telefone || '', documentoMascarado: customer.documento_mascarado || '', bloqueado: customer.bloqueado === true }); setEditingCustomerId(customer.id); setCustomerModalOpen(true) }
  async function saveCustomer(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Clientes do Commerce Core exigem PostgreSQL ativo.')
      if (editingCustomerId) await updateCoreCustomer(editingCustomerId, customerForm)
      else await createCoreCustomer(customerForm)
      setCustomerModalOpen(false)
      setNotice(editingCustomerId ? 'Cliente atualizado no Commerce Core.' : 'Cliente cadastrado no Commerce Core.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível salvar o cliente.') }
  }
  async function openCustomerAddresses(customer) {
    try {
      setSelectedCustomer(customer)
      const data = await loadCoreCustomerAddresses(customer.id)
      setCustomerAddresses(data?.items || [])
      setEditingAddressId(null)
      setAddressForm({ ...EMPTY_ADDRESS, destinatario: customer.nome || '' })
      setAddressModalOpen(true)
    } catch (err) { setError(err.message || 'Não foi possível carregar os endereços.') }
  }
  function beginAddressEdit(address) {
    setEditingAddressId(address.id)
    setAddressForm({ ...EMPTY_ADDRESS, ...address, destinatario: address.destinatario || selectedCustomer?.nome || '' })
  }
  async function saveAddress(event) {
    event.preventDefault()
    try {
      if (editingAddressId) await updateCoreCustomerAddress(selectedCustomer.id, editingAddressId, addressForm)
      else await createCoreCustomerAddress(selectedCustomer.id, addressForm)
      const data = await loadCoreCustomerAddresses(selectedCustomer.id)
      setCustomerAddresses(data?.items || [])
      setEditingAddressId(null)
      setAddressForm({ ...EMPTY_ADDRESS, destinatario: selectedCustomer.nome || '' })
      setNotice(editingAddressId ? 'Endereço atualizado com auditoria no tenant.' : 'Endereço salvo com auditoria no tenant.')
    } catch (err) { setError(err.message || 'Não foi possível salvar o endereço.') }
  }
  async function removeAddress(address) {
    if (!window.confirm(`Excluir o endereço “${address.rotulo}”?`)) return
    try {
      await deleteCoreCustomerAddress(selectedCustomer.id, address.id)
      setCustomerAddresses(current => current.filter(item => item.id !== address.id))
      if (editingAddressId === address.id) {
        setEditingAddressId(null)
        setAddressForm({ ...EMPTY_ADDRESS, destinatario: selectedCustomer?.nome || '' })
      }
      setNotice('Endereço removido.')
    } catch (err) { setError(err.message || 'Não foi possível remover o endereço.') }
  }
  function beginCreditCreate() { setEditingCreditAccountId(null); setCreditForm(EMPTY_CREDIT); setCreditModalOpen(true) }
  function beginCreditEdit(account) {
    setEditingCreditAccountId(account.id)
    setCreditForm({ customerId: account.customer_id || '', limiteCredito: account.limite_credito ?? '', prazoDias: account.prazo_dias ?? '30', status: account.status || 'active', observacoes: account.observacoes || '' })
    setCreditModalOpen(true)
  }
  async function saveCreditAccount(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja ativa.')
      const payload = { ...creditForm, storefrontId, limiteCredito: Number(creditForm.limiteCredito), prazoDias: Number(creditForm.prazoDias) }
      if (editingCreditAccountId) await updateCoreCreditAccount(editingCreditAccountId, payload)
      else await createCoreCreditAccount(payload)
      setCreditModalOpen(false)
      setNotice(editingCreditAccountId ? 'Conta de crediário atualizada.' : 'Conta de crediário criada para o cliente.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível salvar a conta de crediário.') }
  }
  function changeCredit(field, value) { setCreditForm(current => ({ ...current, [field]: value })) }
  function beginShippingMethodEdit(method) {
    const config = method.configuracao && typeof method.configuracao === 'object' ? method.configuracao : {}
    const deliveryType = config.deliveryType || config.kind || config.tipoEntrega || config.ownDeliveryType || 'regional_table'
    setEditingShippingMethodId(method.id)
    setShippingForm({
      ...EMPTY_SHIPPING,
      codigo: method.codigo || '',
      nome: method.nome || '',
      tipo: method.tipo || 'pickup',
      provider: config.provider || 'manual',
      deliveryType,
      baseFee: config.baseFee ?? config.taxaBase ?? '',
      pricePerKm: config.pricePerKm ?? config.valorPorKm ?? '',
      pricePerZone: config.pricePerZone ?? config.valorPorZona ?? '',
      fixedFee: config.fixedFee ?? config.taxaFixa ?? '',
      additionalFee: config.additionalFee ?? config.adicionalExpresso ?? '',
      freeShippingAbove: config.freeShippingAbove ?? config.freteGratisAcima ?? '',
      maxRadiusKm: config.maxRadiusKm ?? config.raioKm ?? '',
      distanceKm: config.distanceKm ?? config.distanciaKm ?? '',
      deliveryDays: config.deliveryDays ?? config.prazoDias ?? '3',
      originCep: config.origemCep || config.originPostalCode || '',
      rulesJson: JSON.stringify(Array.isArray(config.rules) ? config.rules : [], null, 2),
      configuracao: JSON.stringify(config, null, 2),
      shippingAccountId: config.shippingAccountId || config.accountId || '',
      ativo: method.ativo !== false,
    })
    setShippingModalOpen(true)
  }
  function buildShippingConfiguration() {
    let advanced = {}
    try { advanced = shippingForm.configuracao ? JSON.parse(shippingForm.configuracao) : {} } catch { throw new Error('Configuração avançada deve conter JSON válido.') }
    if (!advanced || Array.isArray(advanced) || typeof advanced !== 'object') throw new Error('Configuração avançada deve ser um objeto JSON.')
    if (!['delivery', 'carrier'].includes(shippingForm.tipo)) return advanced
    if (shippingForm.provider === 'manual') {
      let rules = []
      try { rules = shippingForm.rulesJson ? JSON.parse(shippingForm.rulesJson) : [] } catch { throw new Error('As faixas/regras devem conter JSON válido.') }
      if (!Array.isArray(rules)) throw new Error('As faixas/regras devem ser uma lista JSON.')
      const own = {
        ...advanced,
        provider: 'manual',
        deliveryType: shippingForm.deliveryType,
        ...(shippingForm.originCep ? { origemCep: shippingForm.originCep } : {}),
        ...(shippingForm.baseFee !== '' ? { baseFee: Number(shippingForm.baseFee) } : {}),
        ...(shippingForm.pricePerKm !== '' ? { pricePerKm: Number(shippingForm.pricePerKm) } : {}),
        ...(shippingForm.pricePerZone !== '' ? { pricePerZone: Number(shippingForm.pricePerZone) } : {}),
        ...(shippingForm.fixedFee !== '' ? { fixedFee: Number(shippingForm.fixedFee) } : {}),
        ...(shippingForm.additionalFee !== '' ? { additionalFee: Number(shippingForm.additionalFee) } : {}),
        ...(shippingForm.freeShippingAbove !== '' ? { freeShippingAbove: Number(shippingForm.freeShippingAbove) } : {}),
        ...(shippingForm.maxRadiusKm !== '' ? { maxRadiusKm: Number(shippingForm.maxRadiusKm) } : {}),
        ...(shippingForm.distanceKm !== '' ? { distanceKm: Number(shippingForm.distanceKm) } : {}),
        ...(shippingForm.deliveryDays !== '' ? { deliveryDays: Number(shippingForm.deliveryDays) } : {}),
        ...(rules.length ? { rules } : {}),
      }
      delete own.shippingAccountId
      delete own.accountId
      return own
    }
    const account = shippingAccounts.find(item => item.id === shippingForm.shippingAccountId && item.ativo && item.ready)
    if (!account) throw new Error('Selecione uma conta logística ativa e pronta para este método.')
    return { ...advanced, provider: account.provider, shippingAccountId: account.id, environment: account.ambiente }
  }
  async function saveShippingMethod(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      const configuracao = buildShippingConfiguration()
      if (editingShippingMethodId) {
        const updated = await updateCoreShippingMethod(editingShippingMethodId, { codigo: shippingForm.codigo, nome: shippingForm.nome, tipo: shippingForm.tipo, ativo: shippingForm.ativo, configuracao })
        setShippingMethods(current => current.map(item => item.id === editingShippingMethodId ? updated : item))
        setNotice('Método de entrega atualizado no Commerce Core.')
      } else {
        const created = await createCoreShippingMethod({ codigo: shippingForm.codigo, nome: shippingForm.nome, tipo: shippingForm.tipo, ativo: shippingForm.ativo, storefrontId, configuracao })
        setShippingMethods(current => [...current, created])
        setNotice('Método de entrega criado no Commerce Core.')
      }
      setEditingShippingMethodId(null)
      setShippingForm(EMPTY_SHIPPING)
      setShippingModalOpen(false)
    } catch (err) { setError(err.message || 'Não foi possível salvar o método de entrega.') }
  }
  function beginShippingAccount() { setShippingAccountForm(EMPTY_SHIPPING_ACCOUNT); setShippingAccountModalOpen(true) }
  function changeShippingAccount(field, value) {
    setShippingAccountForm(current => {
      if (field === 'provider' && value !== current.provider) {
        const correios = value === 'correios'
        return { ...current, provider: value, nome: correios ? 'Correios · Sandbox' : 'Melhor Envio · Sandbox', secretRef: correios ? 'env:CORREIOS_API_TOKEN' : 'env:ME_ACCESS_TOKEN', webhookSecretRef: correios ? '' : 'env:ME_WEBHOOK_SECRET', services: correios ? '03220,04669' : '', servicesAdditional: '', prepostagemApiEnabled: false, modalidadePagamento: correios ? '2' : '', postingCard: '', labelType: 'P', labelFormat: 'ET', labelLayout: 'PADRAO' }
      }
      return { ...current, [field]: value }
    })
  }
  function changeShippingOrigin(field, value) { setShippingAccountForm(current => ({ ...current, origin: { ...current.origin, [field]: value } })) }
  async function saveShippingAccount(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      const account = await createCoreShippingAccount({ provider: shippingAccountForm.provider, ambiente: shippingAccountForm.ambiente, nome: shippingAccountForm.nome, secretRef: shippingAccountForm.secretRef, storefrontId, ativo: shippingAccountForm.ativo, publicConfig: { ...(shippingAccountForm.webhookSecretRef ? { webhookSecretRef: shippingAccountForm.webhookSecretRef } : {}), ...(shippingAccountForm.services ? { services: shippingAccountForm.services.split(',').map(value => value.trim()).filter(Boolean) } : {}), ...(shippingAccountForm.servicesAdditional ? { servicesAdditional: shippingAccountForm.servicesAdditional.split(',').map(value => value.trim()).filter(Boolean) } : {}), prepostagemApiEnabled: shippingAccountForm.prepostagemApiEnabled === true, ...(shippingAccountForm.modalidadePagamento ? { modalidadePagamento: shippingAccountForm.modalidadePagamento } : {}), ...(shippingAccountForm.postingCard ? { postingCard: shippingAccountForm.postingCard } : {}), ...(shippingAccountForm.labelType ? { labelType: shippingAccountForm.labelType } : {}), ...(shippingAccountForm.labelFormat ? { labelFormat: shippingAccountForm.labelFormat } : {}), ...(shippingAccountForm.labelLayout ? { labelLayout: shippingAccountForm.labelLayout } : {}), origemCep: shippingAccountForm.origemCep, origin: { ...shippingAccountForm.origin, postalCode: shippingAccountForm.origemCep }, shipment: { nonCommercial: shippingAccountForm.nonCommercial } } })
      setShippingAccounts(current => [account, ...current])
      setShippingAccountModalOpen(false)
      setNotice('Conta logística cadastrada por referências seguras. Nenhuma etiqueta foi comprada.')
    } catch (err) { setError(err.message || 'Não foi possível cadastrar a conta logística.') }
  }
  async function toggleShippingAccount(account) {
    try {
      const updated = await updateCoreShippingAccount(account.id, { ativo: !account.ativo })
      setShippingAccounts(current => current.map(item => item.id === account.id ? { ...item, ...updated } : item))
      setNotice(`Conta logística ${account.nome} ${account.ativo ? 'desativada' : 'ativada'}.`)
    } catch (err) { setError(err.message || 'Não foi possível alterar a conta logística.') }
  }
  async function generateShippingLabel(fulfillment) {
    if (!window.confirm('Gerar e comprar esta etiqueta no provedor logístico? A operação pode consumir saldo e não é simulada.')) return
    try {
      const updated = await createCoreShippingLabel(fulfillment.id, {}, storefrontId)
      setFulfillments(current => current.map(item => item.id === fulfillment.id ? { ...item, ...updated } : item))
      setNotice(updated.label_url ? 'Etiqueta gerada. O link privado está disponível no fulfillment.' : 'Etiqueta gerada no provedor logístico.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível gerar a etiqueta.') }
  }
  async function cancelShippingLabel(fulfillment) {
    if (!window.confirm('Cancelar esta pré-postagem nos Correios? A operação será enviada ao provedor e não é simulada.')) return
    try {
      const updated = await cancelCoreShippingLabel(fulfillment.id, storefrontId)
      setFulfillments(current => current.map(item => item.id === fulfillment.id ? { ...item, ...updated } : item))
      setNotice('Pré-postagem Correios cancelada no provedor.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível cancelar a pré-postagem.') }
  }
  async function saveDomain(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      const created = await createCoreDomain({ storefrontId, ...domainForm })
      setDomains(current => [...current, created])
      setDomainForm(EMPTY_DOMAIN)
      setDomainModalOpen(false)
      setNotice('Domínio cadastrado como pendente. Configure o TXT antes de verificar.')
    } catch (err) { setError(err.message || 'Não foi possível cadastrar o domínio.') }
  }
  async function verifyDomain(domain) {
    try {
      await verifyCoreDomain(domain.id)
      setNotice('Domínio verificado e apto à publicação.')
      await loadData(true)
    } catch (err) { setError(err.message || 'O TXT ainda não corresponde ao desafio.') }
  }
  async function setPrimaryDomain(domain) {
    try {
      await setPrimaryCoreDomain(domain.id)
      setDomains(current => current.map(item => ({ ...item, principal: item.id === domain.id })))
      setNotice('Domínio principal atualizado.')
    } catch (err) { setError(err.message || 'Não foi possível definir o domínio principal.') }
  }
  async function changeFulfillment(fulfillment, status) {
    try {
      const updated = await updateCoreFulfillment(fulfillment.id, { status, ocorrencia: `Atualização administrativa para ${status}`, storefrontId })
      setFulfillments(current => current.map(item => item.id === fulfillment.id ? { ...item, ...updated } : item))
      setNotice('Fulfillment atualizado com auditoria.')
    } catch (err) { setError(err.message || 'Não foi possível atualizar o fulfillment.') }
  }
  async function createOrderFulfillment(event) {
    event.preventDefault()
    try {
      const formData = new FormData(event.currentTarget)
      const orderId = formData.get('orderId')
      const shippingMethodId = formData.get('shippingMethodId') || null
      if (!orderId) throw new Error('Selecione um pedido.')
      const created = await createCoreFulfillment({ orderId, shippingMethodId, storefrontId })
      setFulfillments(current => [created, ...current])
      event.currentTarget.reset()
      setNotice('Fulfillment criado como pendente; nenhum rastreio foi inventado.')
    } catch (err) { setError(err.message || 'Não foi possível criar o fulfillment.') }
  }

  function currentPaymentContext() {
    const storefront = storefronts.find(item => item.id === storefrontId) || null
    return { storefront, domain: primaryVerifiedDomain(domains, storefrontId) }
  }
  function beginPaymentAccount() {
    setPaymentForm(paymentAccountForm('mercadopago', currentPaymentContext()))
    setPaymentModalOpen(true)
  }
  function changePayment(field, value) {
    if (field === 'provider') {
      setPaymentForm(paymentAccountForm(value, currentPaymentContext()))
      return
    }
    setPaymentForm(current => ({ ...current, [field]: value }))
  }
  async function savePaymentAccount(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      const account = await createCorePaymentAccount({
        provider: paymentForm.provider,
        ambiente: paymentForm.ambiente,
        nome: paymentForm.nome,
        secretRef: paymentForm.secretRef,
        storefrontId,
        ativo: paymentForm.ativo,
        publicConfig: paymentAccountPublicConfig(paymentForm),
      })
      setPaymentAccounts(current => [account, ...current])
      setPaymentModalOpen(false)
      setNotice('Conta de pagamento cadastrada por referência segura. Nenhum segredo foi salvo no painel.')
    } catch (err) { setError(err.message || 'Não foi possível cadastrar a conta de pagamento.') }
  }
  async function togglePaymentAccount(account) {
    try {
      const updated = await updateCorePaymentAccount(account.id, { ativo: !account.ativo, storefrontId })
      setPaymentAccounts(current => current.map(item => item.id === account.id ? { ...item, ...updated } : item))
      setNotice(`Conta ${account.nome} ${account.ativo ? 'desativada' : 'ativada'}.`)
    } catch (err) { setError(err.message || 'Não foi possível alterar a conta de pagamento.') }
  }
  async function startPayment(order) {
    try {
      const account = paymentAccounts.find(item => item.provider === 'mercadopago' && item.ativo && item.ready)
      if (!account) throw new Error('Ative uma conta Mercado Pago pronta e homologada antes de iniciar o Pix.')
      if (!order.cliente?.email) throw new Error('O pedido precisa ter e-mail do cliente para iniciar o Pix.')
      const idempotencyKey = `admin-pix-${order.id}-${window.crypto?.randomUUID?.() || Date.now()}`
      const result = await createCorePaymentAttempt(order.id, { accountId: account.id, provider: account.provider, method: 'pix', environment: account.ambiente, idempotencyKey, storefrontId })
      setNotice(result.checkout?.qrCode ? 'Pix criado. O QR Code foi retornado pelo Mercado Pago.' : 'Tentativa Pix registrada; aguarde o retorno do provedor.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível iniciar o Pix.') }
  }

  async function syncPayment(payment) {
    try {
      const result = await syncCorePayment(payment.id, storefrontId)
      setNotice(result.changed ? `Status sincronizado no gateway: ${result.status}.` : result.stale ? 'O gateway retornou um status antigo; o estado persistido foi preservado.' : `Pagamento já está em ${result.status}.`)
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível reconciliar o pagamento.') }
  }
  function beginPaymentReconcile(payment) {
    setReconcileTarget(payment)
    setReconcileForm({ transactionNsu: '', slug: '', receiptUrl: '', captureMethod: payment.method === 'credit_card' ? 'credit_card' : payment.method || '' })
  }
  function changeReconcile(field, value) { setReconcileForm(current => ({ ...current, [field]: value })) }
  async function reconcilePayment(event) {
    event.preventDefault()
    try {
      if (!reconcileTarget) throw new Error('Selecione um pagamento para reconciliar.')
      const result = await reconcileCorePayment(reconcileTarget.id, reconcileForm, storefrontId)
      setReconcileTarget(null)
      setNotice(result.changed ? `Pagamento InfinitePay reconciliado como ${result.status}.` : `Pagamento já está em ${result.status}.`)
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível reconciliar a venda InfinitePay.') }
  }
  async function savePromotion(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Promoções e cupons exigem o Commerce Core PostgreSQL ativo.')
      await createCorePromotion(promotionForm)
      setPromotionForm(EMPTY_PROMOTION)
      setNotice('Promoção criada com segurança no tenant.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível criar a promoção.') }
  }

  async function loadReports() {
    const requestId = ++reportRequestId.current
    setReports(null)
    setError('')
    try {
      if (mode !== 'core') throw new Error('Relatórios do Commerce Core exigem PostgreSQL ativo.')
      const data = await loadCoreReports(storefrontId)
      if (requestId === reportRequestId.current) setReports(data)
    } catch (err) { if (requestId === reportRequestId.current) setError(err.message || 'Não foi possível carregar os relatórios.') }
  }

  function changePromotion(field, value) { setPromotionForm(current => ({ ...current, [field]: value })) }
  function changeStorefront(field, value) { setStorefrontForm(current => ({ ...current, [field]: value })) }
  function changeTemplate(field, value) { setTemplateForm(current => ({ ...current, [field]: value })) }
  function beginStorefrontCreate() { setStorefrontForm(EMPTY_STOREFRONT); setStorefrontModalOpen(true) }
  async function activateStorefront() {
    if (!storefrontActivationTarget?.id || storefrontActivationLoading) return
    setStorefrontActivationLoading(true)
    setError('')
    try {
      await updateCoreStorefront(storefrontActivationTarget.id, { status: 'active' })
      setStorefrontActivationTarget(null)
      setNotice(`Canal ${storefrontActivationTarget.nome} ativado. Revise o catálogo antes de divulgar a URL pública.`)
      await loadData(true)
    } catch (err) {
      setError(err.message || 'Não foi possível ativar o canal Commerce.')
    } finally {
      setStorefrontActivationLoading(false)
    }
  }
  async function saveStorefront(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Novas lojas Commerce exigem o Commerce Core PostgreSQL ativo.')
      const created = await createCoreStorefront({ ...storefrontForm, lojaId: storefrontForm.lojaId || null, dominio: storefrontForm.dominio.trim() || null })
      let domainNotice = ''
      if (storefrontForm.dominio.trim()) {
        await createCoreDomain({ storefrontId: created.id, dominio: storefrontForm.dominio.trim(), principal: true })
        domainNotice = ' O domínio foi cadastrado como pendente; configure o TXT para verificar.'
      }
      setStorefronts(current => [created, ...current])
      setStorefrontId(created.id)
      syncStoreContext({ ...created, loja_id: created.loja_id || created.loja?.id, loja_nome: created.loja?.nome, loja_codigo: created.loja?.codigo })
      setStorefrontModalOpen(false)
      setNotice(`Loja Commerce criada na mesma base multiempresa.${domainNotice}`)
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível criar a loja Commerce.') }
  }
  function applyPromotionTemplate(template) {
    setPromotionForm(current => ({ ...current, templateId: template.id, nome: template.nome || '', tipo: template.tipo || 'percentage', valor: template.valor ?? '', codigo: '' }))
    setTab('promocoes')
    setNotice(`Template “${template.nome}” aplicado ao formulário de promoção.`)
  }
  async function savePromotionTemplate(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Templates promocionais exigem o Commerce Core PostgreSQL ativo.')
      let regras = {}
      try { regras = JSON.parse(templateForm.regrasJson || '{}') } catch { throw new Error('Regras do template devem conter JSON válido.') }
      const created = await createCorePromotionTemplate({ ...templateForm, valor: Number(templateForm.valor), regras })
      setPromotionTemplates(current => [...current, created].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''))))
      setTemplateForm(EMPTY_TEMPLATE)
      setTemplateModalOpen(false)
      setNotice('Template promocional salvo no tenant.')
    } catch (err) { setError(err.message || 'Não foi possível salvar o template promocional.') }
  }
  function changeCustomer(field, value) { setCustomerForm(current => ({ ...current, [field]: value })) }
  function changeAddress(field, value) { setAddressForm(current => ({ ...current, [field]: value })) }
  function changeShipping(field, value) { setShippingForm(current => ({ ...current, [field]: value })) }
  function changeDomain(field, value) { setDomainForm(current => ({ ...current, [field]: value })) }

  async function updateOrder(order, status) {
    try {
      if (mode === 'core') {
        await updateCoreOrder(order, status, storefrontId)
        setNotice(`Pedido ${order.codigo} atualizado no Commerce Core.`)
        await loadData(true)
        return
      }
      const result = await api.patch(`/api/admin/loja/pedidos/${order.id}`, { status })
      const updated = result?.pedido || result
      setOrders(current => current.map(item => item.id === order.id ? updated : item))
      setNotice(`Pedido ${order.codigo} atualizado.`)
    } catch (err) { setError(err.message || 'Não foi possível atualizar o pedido.') }
  }

  return <main className="ecommerce-admin-shell">
    <header className="ecommerce-admin-header"><div><span className="ecommerce-admin-kicker"><ShoppingBag size={14} /> Commerce OS</span><h1>Operação comercial</h1><p>Backoffice multiempresa para catálogo, campanhas, pedidos, estoque e canais de venda.</p></div><div className="ecommerce-admin-header-actions">{mode === 'core' && storefronts.length > 0 && <label className="commerce-storefront-switcher"><Store size={15} /><span>Loja ativa</span><select value={storefrontId || ''} onChange={event => selectStorefront(storefronts.find(item => item.id === event.target.value))}><option value="" disabled>Selecione uma vitrine ativa</option>{storefronts.map(item => <option value={item.id} key={item.id} disabled={Boolean(item.status && item.status !== 'active')}>{item.nome} · {item.codigo}</option>)}</select></label>}<span className={`commerce-source-badge ${mode}`}>{mode === 'core' ? 'Core PostgreSQL' : 'Catálogo legado'}</span><button type="button" className="ecommerce-admin-button ghost" onClick={() => loadData(true)}><RefreshCw size={15} className={refreshing ? 'ecommerce-admin-spin' : ''} /> Atualizar</button><button type="button" className="ecommerce-admin-button primary" onClick={beginCreate} disabled={catalogUnavailable}><Plus size={16} /> Novo item</button></div></header>
    {error && <div className="ecommerce-admin-alert error">{error}<button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    {catalogUnavailable && <div className="ecommerce-admin-alert error" role="alert">O catálogo está temporariamente indisponível. Produtos e estoque não devem ser interpretados como zero; os pedidos continuam acessíveis. Use Atualizar para tentar novamente.</div>}
    {notice && <div className="ecommerce-admin-alert success"><Check size={15} /> {notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    <nav className="ecommerce-admin-tabs" aria-label="Administração comercial"><button className={tab === 'visao' ? 'active' : ''} onClick={() => setTab('visao')}><BarChart3 size={15} /> Visão geral</button><button className={tab === 'lojas' ? 'active' : ''} onClick={() => setTab('lojas')}><Store size={15} /> Lojas & canais</button><button className={tab === 'catalogo' ? 'active' : ''} onClick={() => setTab('catalogo')}><Archive size={15} /> Catálogo</button><button className={tab === 'pedidos' ? 'active' : ''} onClick={() => setTab('pedidos')}><ClipboardList size={15} /> Pedidos {openOrders > 0 && <b>{openOrders}</b>}</button>{mode === 'core' && <><button className={tab === 'promocoes' ? 'active' : ''} onClick={() => setTab('promocoes')}><Tag size={15} /> Promoções</button><button className={tab === 'relatorios' ? 'active' : ''} onClick={() => { setTab('relatorios'); loadReports() }}><FileBarChart size={15} /> Relatórios</button><button className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}><ShoppingBag size={15} /> Clientes</button><button className={tab === 'fulfillment' ? 'active' : ''} onClick={() => setTab('fulfillment')}><Truck size={15} /> Entrega</button><button className={tab === 'dominios' ? 'active' : ''} onClick={() => setTab('dominios')}><Globe2 size={15} /> Domínios</button><button className={tab === 'pagamentos' ? 'active' : ''} onClick={() => setTab('pagamentos')}><CreditCard size={15} /> Pagamentos</button><button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}><Settings2 size={15} /> Usuários</button><button className={tab === 'auditoria' ? 'active' : ''} onClick={() => setTab('auditoria')}><ShieldCheck size={15} /> Auditoria</button></>}{!tenantScope && <><a href="/admin/estoque"><PackagePlus size={15} /> Estoque</a><a href="/admin/pagamentos"><Truck size={15} /> Pagamentos</a><a href="/admin/configuracoes"><Settings2 size={15} /> Configurações</a></>}</nav>
    {loading ? <div className="ecommerce-admin-loading">Carregando operação…</div> : <>
      {tab === 'visao' && <section className="ecommerce-admin-overview"><div className="ecommerce-admin-kpis"><article><span>Vendas registradas</span><strong>{money(revenue)}</strong><small>{orders.length} pedido(s) no histórico</small></article><article><span>Pedidos em aberto</span><strong>{openOrders}</strong><small>Na fila operacional agora</small></article><article><span>Itens publicados</span><strong>{catalogUnavailable ? '—' : products.filter(item => item.ativo !== false).length}</strong><small>{catalogUnavailable ? 'Indisponível' : `${lowStock} em estoque baixo`}</small></article><article><span>Clientes</span><strong>{customers.length}</strong><small>Base da operação</small></article></div><section className="commerce-health-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Operação</span><h2>Saúde do Commerce Core</h2></div><span className="commerce-source-badge core">Dados atuais</span></div><div className="commerce-health-grid"><button type="button" onClick={() => setTab('pedidos')}><strong>{pendingPayments}</strong><span>pagamentos aguardando</span></button><button type="button" onClick={() => setTab('auditoria')}><strong>{failedWebhooks}</strong><span>webhooks com falha</span></button><button type="button" onClick={() => setTab('fulfillment')}><strong>{fulfillmentAttention}</strong><span>fulfillments em atenção</span></button><button type="button" onClick={() => setTab('pagamentos')}><strong>{readyPaymentAccounts + readyShippingAccounts}</strong><span>contas prontas</span></button></div></section><div className="ecommerce-admin-overview-grid"><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fluxo</span><h2>Pedidos recentes</h2></div><button type="button" onClick={() => setTab('pedidos')}>Ver fila <ChevronRight size={15} /></button></div>{orders.slice(0, 5).map(order => <div className="ecommerce-admin-order-line" key={order.id}><div><strong>{order.codigo}</strong><span>{order.cliente?.nome || 'Cliente balcão'} · {fmtDate(order.criadoEm)}</span></div><div><b>{money(order.total)}</b><em className={`status-${order.status}`}>{order.status}</em></div></div>)}{!orders.length && <p className="ecommerce-admin-empty">Nenhum pedido registrado.</p>}</section><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Catálogo</span><h2>Estoque em atenção</h2></div><button type="button" onClick={() => setTab('catalogo')}>Gerenciar <ChevronRight size={15} /></button></div>{products.filter(item => Number(item.estoque || 0) <= 5 && item.ativo !== false).slice(0, 6).map(item => <div className="ecommerce-admin-stock-line" key={item.id}><div><strong>{item.nome}</strong><span>{item.cat || 'Geral'}</span></div><b>{item.estoque || 0} un.</b></div>)}{!catalogUnavailable && !lowStock && <p className="ecommerce-admin-empty">Nenhum item em estoque baixo.</p>}</section></div></section>}
      {tab === 'lojas' && <section className="ecommerce-admin-panel commerce-storefronts-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker"><Store size={14} /> Governança de canais</span><h2>Lojas e storefronts</h2><p className="commerce-admin-help">Crie novas lojas sobre a mesma base multiempresa. O domínio só fica público depois da verificação TXT.</p></div><button type="button" className="ecommerce-admin-button primary" onClick={beginStorefrontCreate}><Plus size={15} /> Nova loja</button></div><div className="commerce-storefront-callout"><div><strong>Uma operação, vários canais</strong><span>Catálogo, preços, estoque, pedidos e pagamentos permanecem separados por empresa e loja ativa.</span></div><div className="commerce-storefront-callout-metric"><strong>{storefronts.length}</strong><span>canais configurados</span></div></div><div className="commerce-storefront-grid">{storefronts.map(storefront => <article className="commerce-storefront-card" key={storefront.id}><header><div><span className={`commerce-storefront-status ${storefront.status}`}>{storefront.status === 'active' ? 'Ativo' : storefront.status === 'paused' ? 'Pausado' : 'Rascunho'}</span><h3>{storefront.nome}</h3><small>{storefront.codigo} · {storefront.loja_nome || 'Tenant sem unidade vinculada'}</small></div><div className="ecommerce-admin-header-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => { selectStorefront(storefront); setTab('catalogo') }}>Usar canal</button>{storefront.status !== 'active' && <button type="button" className="ecommerce-admin-button primary" onClick={() => setStorefrontActivationTarget(storefront)}>Ativar canal</button>}</div></header>{storefrontActivationTarget?.id === storefront.id && <div className="commerce-storefront-activation" role="alert"><div><strong>Confirmar ativação pública</strong><span>O alias e o checkout deste canal poderão responder publicamente. Revise o catálogo e as formas de atendimento antes de divulgar a URL.</span></div><div className="ecommerce-admin-header-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setStorefrontActivationTarget(null)} disabled={storefrontActivationLoading}>Cancelar</button><button type="button" className="ecommerce-admin-button primary" onClick={activateStorefront} disabled={storefrontActivationLoading}>{storefrontActivationLoading ? 'Ativando…' : 'Confirmar ativação'}</button></div></div>}<p>{storefront.canal || 'web'} · {storefront.moeda || 'BRL'} · {storefront.timezone || 'America/Sao_Paulo'}</p><div className="commerce-storefront-meta"><span><b>Unidade</b>{storefront.loja_codigo || 'Sem unidade'}</span><span><b>Atualizado</b>{storefront.atualizado_em ? fmtDate(storefront.atualizado_em) : '—'}</span><span><b>Domínio</b>{(storefront.dominios || []).some(domain => domain.status === 'verified') ? 'Verificado' : 'Pendente'}</span></div><div className="commerce-storefront-card-stats"><span><strong>{storefront.produtos_publicados || 0}</strong> produtos publicados</span><span><strong>{storefront.pedidos || 0}</strong> pedidos</span></div><div className="commerce-storefront-domains"><Globe2 size={14} />{(storefront.dominios || []).length ? storefront.dominios.map(domain => <span key={domain.id} className={domain.status}>{domain.dominio}{domain.principal ? ' · principal' : ''}</span>) : <span>Sem domínio customizado</span>}</div></article>)}{!storefronts.length && <div className="ecommerce-admin-empty commerce-storefront-empty"><Store size={22} /><strong>Nenhuma loja Commerce cadastrada</strong><span>Crie o primeiro canal para começar a publicar produtos, promoções e pedidos.</span><button type="button" className="ecommerce-admin-button primary" onClick={beginStorefrontCreate}>Criar primeira loja</button></div>}</div></section>}
      {tab === 'catalogo' && (catalogUnavailable ? <div className="ecommerce-admin-alert error" role="status">Não foi possível consultar o catálogo desta loja. Tente Atualizar; nenhuma alteração de produto foi feita.</div> : <CommerceProductManagement
        mode={mode}
        products={products}
        categories={categories}
        storefrontId={storefrontId}
        locationId={locationId}
        inventoryLocations={inventoryLocations}
        onLocationChange={nextLocationId => {
          setLocationId(nextLocationId)
          void loadData(true, { storefrontId, locationId: nextLocationId })
        }}
        storeName={storefronts.find(item => item.id === storefrontId)?.nome || ''}
        categoryForm={categoryForm}
        editingCategoryId={editingCategoryId}
        onCategoryChange={changeCategory}
        onCategorySubmit={saveCategory}
        onCategoryEdit={beginCategoryEdit}
        onCategoryCancel={() => { setEditingCategoryId(null); setCategoryForm(EMPTY_CATEGORY) }}
        onCreateProduct={beginCreate}
        onEditProduct={beginEdit}
        onDuplicateProduct={beginDuplicate}
        onManageVariants={beginVariantManager}
        onToggleProduct={toggleProduct}
        onArchiveProduct={deleteProduct}
        onRefresh={() => loadData(true)}
      />)}
      {tab === 'pedidos' && <section className="ecommerce-admin-orders"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fulfillment</span><h2>Fila de pedidos</h2></div><div className="ecommerce-admin-header-actions"><div className="ecommerce-admin-search"><Search size={15} /><input value={orderQuery} onChange={event => setOrderQuery(event.target.value)} placeholder="Buscar código, cliente ou status" aria-label="Buscar pedido" /></div><a href="/loja">Abrir vitrine <Eye size={15} /></a></div></div><div className="ecommerce-admin-kanban">{STATUS.filter(([status]) => status !== 'cancelado').map(([status, label]) => <section className="ecommerce-admin-column" key={status}><header><strong>{label}</strong><b>{filteredOrders.filter(order => order.status === status).length}</b></header>{filteredOrders.filter(order => order.status === status).map(order => <article className="ecommerce-admin-order-card" key={order.id}><div className="ecommerce-admin-order-card-head"><strong>{order.codigo}</strong><span>{fmtDate(order.criadoEm)}</span></div><p><CustomerName id={order.customer_id}>{order.cliente?.nome || 'Cliente balcão'}</CustomerName></p>{order.fulfillment && <small className="commerce-order-fulfillment-line">{FULFILLMENT_LABELS[order.fulfillment.status] || order.fulfillment.status}{order.fulfillment.carrier ? ` · ${order.fulfillment.carrier}` : ''}{order.fulfillment.trackingCode ? ` · ${order.fulfillment.trackingCode}` : ''}</small>}<div className="ecommerce-admin-order-items">{(order.itens || []).slice(0, 3).map(item => <span key={`${order.id}-${item.produtoId || item.variantId}`}>{item.qtd || item.quantidade}× {item.nome || item.nome_snapshot}</span>)}</div><footer><b>{money(order.total)}</b>{status === 'pendente' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'preparando')}>Preparar</button>}{status === 'pendente' && mode === 'core' && <>{paymentAccounts.some(account => account.provider === 'mercadopago' && account.ativo && account.ready) ? <button type="button" onClick={() => startPayment(order)}>Iniciar Pix</button> : <span className="commerce-order-note">Aguardando gateway pronto</span>}</>}{status === 'preparando' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'pronto')}>Liberar</button>}{status === 'preparando' && mode === 'core' && order.coreStatus === 'paid' && <button type="button" onClick={() => updateOrder(order, 'preparando')}>Preparar</button>}{status === 'preparando' && mode === 'core' && order.coreStatus === 'processing' && <button type="button" onClick={() => updateOrder(order, 'pronto')}>Liberar</button>}{status === 'pronto' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'entregue')}>Concluir</button>}{status === 'pronto' && mode === 'core' && <span className="commerce-order-note">Fulfillment pendente</span>}</footer></article>)}</section>)}</div></section>}
      {tab === 'clientes' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Relacionamento</span><h2>Clientes do tenant</h2></div><div className="ecommerce-admin-header-actions"><div className="ecommerce-admin-search"><Search size={15} /><input value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} placeholder="Buscar cliente, e-mail ou telefone" aria-label="Buscar cliente" /></div><button type="button" className="ecommerce-admin-button primary" onClick={beginCustomerCreate}><Plus size={15} /> Novo cliente</button></div></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filteredCustomers.map(customer => <tr key={customer.id}><td><strong><CustomerName id={customer.id}>{customer.nome}</CustomerName></strong><small>{customer.email || 'Sem email'}</small></td><td>{customer.telefone || '—'}</td><td><span className={`commerce-source-badge ${customer.bloqueado ? 'legacy' : 'core'}`}>{customer.bloqueado ? 'Bloqueado' : 'Ativo'}</span></td><td><div className="ecommerce-row-actions">{customer360Path(customer.id) && <Link to={customer360Path(customer.id)}>Ficha 360</Link>}<button type="button" onClick={() => beginCustomerEdit(customer)}>Editar</button><button type="button" onClick={() => openCustomerAddresses(customer)}>Endereços</button></div></td></tr>)}</tbody></table>{!customers.length ? <p className="ecommerce-admin-empty">Nenhum cliente cadastrado no Core.</p> : !filteredCustomers.length && <p className="ecommerce-admin-empty">Nenhum cliente encontrado para esta busca.</p>}</div><section className="commerce-subpanel commerce-credit-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Pagamento local</span><h3>Crediário e “marcar na conta”</h3><p className="commerce-admin-help">A opção aparece no checkout somente para clientes cadastrados com conta ativa e limite disponível.</p></div><button type="button" className="ecommerce-admin-button primary" onClick={beginCreditCreate}><Plus size={15} /> Aprovar cliente</button></div><div className="commerce-credit-list">{creditAccounts.filter(account => !storefrontId || account.storefront_id === storefrontId).map(account => <article className="commerce-credit-card" key={account.id}><div><strong>{account.customer_name}</strong><span>{account.customer_email || 'Sem e-mail'} · {account.storefront_name || 'Loja ativa'}</span><small>Limite {money(account.limite_credito)} · Devedor {money(account.saldo_devedor)} · vencimento em {account.prazo_dias} dias</small></div><div className="ecommerce-row-actions"><span className={`commerce-source-badge ${account.status === 'active' ? 'core' : 'legacy'}`}>{account.status === 'active' ? 'Ativo' : account.status === 'blocked' ? 'Bloqueado' : 'Encerrado'}</span><button type="button" onClick={() => beginCreditEdit(account)}><Edit3 size={14} /> Editar</button></div></article>)}{!creditAccounts.filter(account => !storefrontId || account.storefront_id === storefrontId).length && <p className="ecommerce-admin-empty">Nenhuma conta de crediário aprovada para esta loja.</p>}</div></section></section>}
      {tab === 'fulfillment' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Expedição</span><h2>Entrega e fulfillment</h2></div><div className="ecommerce-admin-header-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={beginShippingAccount}><Settings2 size={15} /> Conta logística</button><button type="button" className="ecommerce-admin-button primary" onClick={() => { setEditingShippingMethodId(null); setShippingForm(EMPTY_SHIPPING); setShippingModalOpen(true) }}><Plus size={15} /> Novo método</button></div></div><div className="commerce-fulfillment-layout"><section className="commerce-subpanel"><h3>Métodos de entrega</h3>{shippingMethods.map(method => <div className="commerce-fulfillment-line" key={method.id}><div><strong>{method.nome}</strong><span>{method.codigo} · {method.tipo}</span></div><div className="ecommerce-row-actions"><span className={`commerce-source-badge ${method.ativo === false ? 'legacy' : 'core'}`}>{method.ativo === false ? 'Inativo' : 'Ativo'}</span><button type="button" onClick={() => beginShippingMethodEdit(method)}><Edit3 size={14} /> Editar</button></div></div>)}{!shippingMethods.length && <p className="ecommerce-admin-empty">Nenhum método configurado.</p>}</section><section className="commerce-subpanel"><h3>Criar fulfillment</h3><form className="commerce-inline-form" onSubmit={createOrderFulfillment}><label>Pedido<select name="orderId" required defaultValue=""><option value="" disabled>Selecione um pedido</option>{orders.filter(order => !['entregue', 'cancelado'].includes(order.status)).map(order => <option value={order.id} key={order.id}>{order.codigo} · {money(order.total)}</option>)}</select></label><label>Método<select name="shippingMethodId" defaultValue=""><option value="">Sem método definido</option>{shippingMethods.map(method => <option value={method.id} key={method.id}>{method.nome}</option>)}</select></label><button type="submit" className="ecommerce-admin-button primary" disabled={!orders.length}><Truck size={15} /> Criar pendente</button></form></section></div><div className="commerce-subpanel commerce-shipping-accounts-list"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Integração</span><h3>Contas logísticas</h3></div><span>{shippingAccounts.length} conta(s)</span></div>{shippingAccounts.map(account => <article className="commerce-shipping-account" key={account.id}><div><strong>{account.nome}</strong><span>{account.provider} · {account.ambiente} · origem {account.public_config?.origemCep || 'não informada'}</span><small>{account.provider === 'correios' ? (account.label_ready ? 'Pronta para cotação, pré-postagem, rótulo assíncrono e tracking' : account.ready ? 'Pronta para cotação e rastreamento; API 36/CWS ou modalidade contratual pendente' : account.secret_configured ? 'Token presente; códigos de serviço/origem pendentes' : 'Aguardando secret manager') : account.label_ready ? 'Pronta para cotação, etiqueta e tracking' : account.ready ? 'Pronta para cotação; complete a origem para etiqueta' : account.secret_configured ? 'Token presente; webhook/origem pendente' : 'Aguardando secret manager'}</small></div><button type="button" className={`ecommerce-status-toggle ${account.ativo ? 'on' : ''}`} onClick={() => toggleShippingAccount(account)} disabled={!account.ready && !account.ativo}><span />{account.ativo ? 'Ativa' : account.ready ? 'Inativa' : 'Aguardando configuração'}</button></article>)}{!shippingAccounts.length && <p className="ecommerce-admin-empty">Nenhuma conta logística configurada.</p>}</div><div className="commerce-subpanel commerce-fulfillment-list"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Acompanhamento</span><h3>Fulfillments</h3></div><span>{fulfillments.length} registro(s)</span></div>{fulfillments.map(item => <article className="commerce-fulfillment-card" key={item.id}><div><strong>{item.public_code || item.order_id}</strong><span>{item.storefront_name || 'Storefront'} · {FULFILLMENT_LABELS[item.status] || item.status}</span></div><div className="commerce-fulfillment-actions">{(FULFILLMENT_TRANSITIONS[item.status] || []).slice(0, 3).map(next => <button type="button" key={next} onClick={() => changeFulfillment(item, next)}>{FULFILLMENT_LABELS[next] || next}</button>)}{item.provider_shipment_id && item.label_url && <a href={item.label_url} target="_blank" rel="noreferrer">Abrir etiqueta</a>}{item.provider_shipment_id && <button type="button" onClick={async () => { try { const updated = await syncCoreShippingTracking(item.id, storefrontId); setFulfillments(current => current.map(row => row.id === item.id ? { ...row, ...updated } : row)); setNotice('Tracking sincronizado diretamente com o provedor.'); } catch (err) { setError(err.message || 'Não foi possível sincronizar o tracking.') } }}>Atualizar tracking</button>}{!item.provider_shipment_id && item.shipping_quote_id && ['ready', 'preparing'].includes(item.status) && ((item.provider || item.shipping_provider) !== 'correios' || item.correios_label_ready === true) && <button type="button" onClick={() => generateShippingLabel(item)}>Gerar etiqueta</button>}{!item.provider_shipment_id && item.shipping_quote_id && (item.provider || item.shipping_provider) === 'correios' && item.correios_label_ready !== true && <span className="commerce-order-note">Pré-postagem Correios requer API 36/CWS e modalidade contratual configuradas</span>}{item.provider === 'correios' && item.provider_shipment_id && !['cancelled', 'delivered', 'picked_up', 'out_for_delivery'].includes(item.status) && <button type="button" onClick={() => cancelShippingLabel(item)}>Cancelar pré-postagem</button>}</div></article>)}{!fulfillments.length && <p className="ecommerce-admin-empty">Nenhum fulfillment criado.</p>}</div></section>}
      {tab === 'dominios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Publicação</span><h2>Canais e domínios</h2><p className="commerce-admin-help">Um domínio só expõe o catálogo depois da verificação TXT.</p></div><button type="button" className="ecommerce-admin-button primary" onClick={() => setDomainModalOpen(true)}><Plus size={15} /> Adicionar domínio</button></div><div className="commerce-domain-list">{domains.map(domain => <article className="commerce-domain-card" key={domain.id}><div><strong>{domain.dominio}</strong><span>{domain.storefront_name || 'Storefront'} · {domain.principal ? 'Principal · ' : ''}{domain.status === 'verified' ? 'Verificado' : 'Pendente'}</span>{domain.status !== 'verified' && domain.verification_name && <code>{domain.verification_name} TXT {domain.verification_value}</code>}</div><div className="commerce-domain-actions">{domain.status !== 'verified' && <button type="button" onClick={() => verifyDomain(domain)}>Verificar TXT</button>}{domain.status === 'verified' && !domain.principal && <button type="button" onClick={() => setPrimaryDomain(domain)}>Definir principal</button>}</div></article>)}{!domains.length && <p className="ecommerce-admin-empty">Nenhum domínio cadastrado. O storefront público permanece fechado por domínio.</p>}</div></section>}
      {tab === 'promocoes' && <section className="ecommerce-admin-panel commerce-promotions-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Campanhas</span><h2>Promoções e cupons</h2></div><span className="commerce-source-badge core">Server-side</span></div><section className="commerce-promotion-templates"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker"><Sparkles size={14} /> Biblioteca de campanhas</span><h3>Templates promocionais</h3><p className="commerce-admin-help">Comece com um modelo padrão e ajuste o nome, valor e cupom antes de publicar.</p></div><button type="button" className="ecommerce-admin-button ghost" onClick={() => { setTemplateForm(EMPTY_TEMPLATE); setTemplateModalOpen(true) }}><Plus size={15} /> Novo template</button></div><div className="commerce-template-grid">{promotionTemplates.map(template => <article className="commerce-template-card" key={template.id}><span className="commerce-template-type">{template.sistema ? 'Padrão Kytto' : 'Template do tenant'}</span><strong>{template.nome}</strong><p>{template.descricao || 'Modelo reutilizável para campanhas comerciais.'}</p><b>{template.tipo === 'percentage' ? `${template.valor}% de desconto` : `${money(template.valor)} de desconto`}</b><button type="button" className="ecommerce-admin-button ghost" onClick={() => applyPromotionTemplate(template)}>Usar template</button></article>)}{!promotionTemplates.length && <p className="ecommerce-admin-empty">Nenhum template disponível.</p>}</div></section><div className="commerce-promotion-layout"><form className="commerce-promotion-form" onSubmit={savePromotion}><label>Template base<select value={promotionForm.templateId || ''} onChange={event => { const selected = promotionTemplates.find(item => item.id === event.target.value); if (selected) applyPromotionTemplate(selected); else changePromotion('templateId', '') }}><option value="">Promoção manual</option>{promotionTemplates.map(template => <option value={template.id} key={template.id}>{template.nome}</option>)}</select></label><label>Nome da promoção<input required value={promotionForm.nome} onChange={event => changePromotion('nome', event.target.value)} /></label><label>Tipo<select value={promotionForm.tipo} onChange={event => changePromotion('tipo', event.target.value)}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>{promotionForm.tipo === 'percentage' ? 'Percentual (%)' : `Valor (${currencyLabel})`}{promotionForm.tipo === 'percentage' ? <input required type="number" min="0.01" max="100" step="0.01" value={promotionForm.valor} onChange={event => changePromotion('valor', event.target.value)} /> : <CurrencyInput required min="0.01" step="0.01" value={promotionForm.valor} currency={activeCurrency} onChange={value => changePromotion('valor', value)} />}</label><label>Código do cupom<input placeholder="Ex.: BEMVINDO10" value={promotionForm.codigo} onChange={event => changePromotion('codigo', event.target.value)} /></label><label>Limite da campanha<input type="number" min="1" step="1" value={promotionForm.limiteUso} onChange={event => changePromotion('limiteUso', event.target.value)} /></label><label>Limite do cupom<input type="number" min="1" step="1" value={promotionForm.usoMaximo} onChange={event => changePromotion('usoMaximo', event.target.value)} /></label><button type="submit" className="ecommerce-admin-button primary"><Plus size={15} /> Criar promoção</button></form><div className="commerce-promotion-list">{promotions.map(promotion => <article key={promotion.id}><div><strong>{promotion.nome}</strong><span>{promotion.tipo === 'percentage' ? `${promotion.valor}%` : money(promotion.valor)} · {promotion.usos || 0}{promotion.limite_uso ? `/${promotion.limite_uso}` : ''} usos</span></div><div>{(promotion.codigos || []).map(code => <b key={code.id}>{code.codigo}</b>)}</div></article>)}{!promotions.length && <p className="ecommerce-admin-empty">Nenhuma promoção cadastrada.</p>}</div></div></section>}
      {tab === 'pagamentos' && <section className="ecommerce-admin-panel commerce-payments-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Financeiro</span><h2>Pagamentos e gateways</h2><p className="commerce-admin-help">As credenciais ficam no secret manager. Esta tela administra somente referências, ambiente e estado.</p></div><button type="button" className="ecommerce-admin-button primary" onClick={beginPaymentAccount}><Plus size={15} /> Nova conta</button></div><div className="commerce-payment-kpis"><article><span>Contas ativas</span><strong>{paymentAccounts.filter(account => account.ativo).length}</strong><small>Escopo da loja atual</small></article><article><span>Transações</span><strong>{payments.length}</strong><small>Persistidas no Core</small></article><article><span>Capturadas</span><strong>{payments.filter(payment => ['captured', 'authorized'].includes(payment.status)).length}</strong><small>Sem estimativas</small></article><article><span>Provedores prontos</span><strong>{paymentProviders.filter(provider => provider.registered).length}</strong><small>Adapters registrados</small></article></div><div className="commerce-payment-layout"><section className="commerce-subpanel"><h3>Provedores</h3>{paymentProviders.map(provider => <article className="commerce-payment-provider" key={provider.code}><div><strong>{provider.name}</strong><span>{provider.registered ? 'Adapter registrado' : provider.adapter ? 'Aguardando secrets' : 'Adapter em preparação'}</span></div><small>{provider.methods.length ? `Métodos: ${provider.methods.join(', ')}` : 'Nenhum método disponível ainda'}</small></article>)}{!paymentProviders.length && <p className="ecommerce-admin-empty">Nenhum provedor disponível.</p>}</section><section className="commerce-subpanel"><div className="ecommerce-admin-panel-heading"><div><h3>Contas configuradas</h3><span className="commerce-admin-help">Nunca exibe token, senha ou chave privada.</span></div></div>{paymentAccounts.map(account => <article className="commerce-payment-account" key={account.id}><div><strong>{account.nome}</strong><span>{account.provider} · {account.ambiente} · {account.secret_configured ? 'referência configurada' : 'sem referência'}</span></div><button type="button" className={`ecommerce-status-toggle ${account.ativo ? 'on' : ''}`} onClick={() => togglePaymentAccount(account)} disabled={!account.ready && !account.ativo}><span />{account.ativo ? 'Ativa' : account.ready ? 'Inativa' : 'Aguardando configuração'}</button></article>)}{!paymentAccounts.length && <p className="ecommerce-admin-empty">Nenhuma conta configurada. Cadastre a referência no secret manager antes de ativar.</p>}</section></div><section className="commerce-subpanel commerce-payment-transactions"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Reconciliação</span><h3>Transações recentes</h3></div><span>{payments.length} registro(s)</span></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Provedor</th><th>Método</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td><strong>{payment.order_code || payment.order_id}</strong></td><td>{payment.customer_name || '—'}</td><td>{payment.provider}</td><td>{payment.method}</td><td>{money(payment.amount)}</td><td><span className={`commerce-payment-status ${payment.status}`}>{payment.status}</span></td><td>{payment.provider_payment_id ? <button type="button" className="ecommerce-row-actions" onClick={() => syncPayment(payment)}>Sincronizar</button> : payment.provider === 'infinitepay' ? <button type="button" className="ecommerce-row-actions" onClick={() => beginPaymentReconcile(payment)}>Vincular venda</button> : <small>Gateway pendente</small>}</td></tr>)}</tbody></table></div>{!payments.length && <p className="ecommerce-admin-empty">Nenhuma transação registrada no Core.</p>}</section></section>}
      {tab === 'relatorios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Analytics</span><h2>Relatórios do tenant</h2></div><button type="button" onClick={loadReports}><RefreshCw size={15} /> Atualizar dados</button></div>{!reports ? <p className="ecommerce-admin-empty">Carregando relatórios…</p> : <div className="commerce-reports-workspace"><div className="commerce-report-grid"><article><span>Pedidos no período</span><strong>{reports.sales?.summary?.orders ?? reports.sales?.orders ?? 0}</strong><small>Dados reais do Commerce Core</small></article><article><span>Valor bruto dos pedidos</span><strong>{money(reports.sales?.summary?.gross_order_total ?? reports.sales?.summary?.revenue ?? reports.sales?.revenue)}</strong><small>Exclui cancelados e reembolsados; inclui pendentes</small></article><article><span>Pagamentos capturados</span><strong>{money(reports.sales?.summary?.captured_total)}</strong><small>Somente pagamentos efetivamente capturados</small></article><article><span>Em expedição</span><strong>{reports.fulfillment?.summary?.awaiting_dispatch ?? 0}</strong><small>Aguardando separação ou coleta</small></article><article><span>Entregues</span><strong>{reports.fulfillment?.summary?.delivered ?? 0}</strong><small>Fulfillments concluídos</small></article></div><section className="commerce-subpanel commerce-sales-tracking-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Pós-venda</span><h3>Vendas e entregas</h3><p className="commerce-admin-help">Acompanhe o ciclo do pedido, expedição, transportadora e rastreio no mesmo painel.</p></div><span className="commerce-source-badge core">Dados reais</span></div><div className="commerce-fulfillment-report-grid"><div><span>Pedidos ativos</span><strong>{reports.fulfillment?.summary?.active_orders ?? 0}</strong></div><div><span>Enviados</span><strong>{reports.fulfillment?.summary?.shipped ?? 0}</strong></div><div><span>Falhas</span><strong>{reports.fulfillment?.summary?.failed ?? 0}</strong></div><div><span>Valor bruto</span><strong>{money(reports.fulfillment?.summary?.gross_total)}</strong></div></div>{Array.isArray(reports.fulfillment?.providers) && reports.fulfillment.providers.length > 0 && <div className="commerce-provider-summary">{reports.fulfillment.providers.map(provider => <span key={provider.provider}><b>{provider.provider}</b><small>{provider.fulfillments} envio(s) · {provider.delivered} entregue(s)</small></span>)}</div>}<div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Entrega</th><th>Rastreio</th><th>Valor</th></tr></thead><tbody>{(reports.fulfillment?.recent || []).slice(0, 12).map(row => <tr key={row.public_code}><td><strong>{row.public_code}</strong><small>{fmtDate(row.criado_em)}</small></td><td>{row.customer_name || '—'}</td><td><span className={`commerce-payment-status ${row.order_status}`}>{row.order_status}</span></td><td><span className={`commerce-payment-status ${row.fulfillment_status || 'pending'}`}>{FULFILLMENT_LABELS[row.fulfillment_status] || row.fulfillment_status || 'Sem fulfillment'}</span><small>{row.carrier || 'A definir'}</small></td><td>{row.tracking_code ? <span><strong>{row.tracking_code}</strong>{row.tracking_url && <a href={row.tracking_url} target="_blank" rel="noreferrer">Abrir rastreio</a>}</span> : <small>Sem código</small>}</td><td>{money(row.total)}</td></tr>)}</tbody></table>{!reports.fulfillment?.recent?.length && <p className="ecommerce-admin-empty">Nenhuma venda no período selecionado.</p>}</div></section><div className="commerce-report-grid"><article><span>SKUs monitorados</span><strong>{reports.inventory?.summary?.variants ?? (Array.isArray(reports.inventory?.items) ? reports.inventory.items.length : 0)}</strong><small>Saldo agregado por local</small></article><article><span>Estoque baixo</span><strong>{Array.isArray(reports.inventory?.items) ? reports.inventory.items.filter(item => item.low_stock).length : 0}</strong><small>Itens no limite mínimo</small></article><article><span>Novos clientes</span><strong>{reports.customers?.summary?.new_customers ?? reports.customers?.summary?.customers ?? reports.customers?.customers ?? 0}</strong><small>Escopo do tenant</small></article><article><span>Respostas de satisfação</span><strong>{reports.customers?.satisfaction?.responses ?? 0}</strong><small>Avaliações recebidas no período</small></article><article><span>Nota média</span><strong>{Number(reports.customers?.satisfaction?.responses || 0) ? `${Number(reports.customers?.satisfaction?.average_rating || 0).toFixed(1)} / 5` : '—'}</strong><small>Avaliações reais recebidas</small></article><article><span>Recomendariam</span><strong>{Number(reports.customers?.satisfaction?.responses || 0) ? `${Number(reports.customers?.satisfaction?.recommendation_rate || 0).toFixed(1)}%` : '—'}</strong><small>Percentual entre respondentes</small></article></div><section className="commerce-subpanel commerce-inventory-report-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Inventário</span><h3>Saldo por SKU</h3><p className="commerce-admin-help">Disponível, reservado e comprometido por local de estoque da loja ativa.</p></div><span className="commerce-source-badge core">Dados reais</span></div>{Array.isArray(reports.inventory?.items) && reports.inventory.items.length ? <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Produto / SKU</th><th>Disponível</th><th>Reservado</th><th>Comprometido</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>{reports.inventory.items.slice(0, 50).map(item => <tr key={item.variant_id || item.sku || item.product_id}><td><strong>{item.product_name || 'Produto sem nome'}</strong><small>{item.sku || 'Sem SKU'}</small></td><td><strong>{item.available ?? 0}</strong></td><td>{item.reserved ?? 0}</td><td>{item.committed ?? 0}</td><td>{item.minimum ?? 0}</td><td><span className={`commerce-payment-status ${item.low_stock ? 'pending' : 'captured'}`}>{item.low_stock ? 'Repor' : 'Normal'}</span></td></tr>)}</tbody></table>{reports.inventory.items.length > 50 && <p className="ecommerce-admin-empty">Exibindo os 50 primeiros SKUs. Use a aba Estoque para a operação completa.</p>}</div> : <p className="ecommerce-admin-empty">Nenhum nível de estoque disponível para a loja ativa.</p>}</section></div>}</section>}
      {tab === 'usuarios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Governança</span><h2>Usuários e permissões</h2></div><span className="commerce-source-badge core">Membership PostgreSQL</span></div>{!memberships.length ? <p className="ecommerce-admin-empty">Nenhuma membership visível ou a permissão users.write ainda não foi concedida.</p> : <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Loja</th><th>MFA</th><th>Status</th><th>Ação</th></tr></thead><tbody>{memberships.map(membership => <tr key={membership.id}><td><strong>{membership.nome_completo || membership.email}</strong><small>{membership.email}</small></td><td>{membership.role_nome || membership.role_codigo}</td><td>{membership.loja_nome || 'Todas as lojas'}</td><td>{membership.mfa_obrigatorio ? 'Obrigatório' : 'Opcional'}</td><td>{membership.ativo ? 'Ativa' : 'Desativada'}</td><td><button type="button" className="ecommerce-status-toggle" onClick={() => toggleMembership(membership)}>{membership.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>)}</tbody></table></div>}<p className="ecommerce-admin-empty">Papéis disponíveis: {roles.map(role => role.nome).join(', ') || 'sem dados'}</p></section>}
      {tab === 'auditoria' && <section className="ecommerce-admin-panel commerce-audit-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Governança</span><h2>Auditoria do tenant</h2><p className="commerce-admin-help">Eventos filtrados pelo tenant e, quando aplicável, pela loja da sua membership. Valores sensíveis são saneados no servidor.</p></div><div className="ecommerce-admin-header-actions"><div className="ecommerce-admin-search"><Search size={15} /><input value={auditQuery} onChange={event => setAuditQuery(event.target.value)} placeholder="Buscar entidade, ação ou correlation id" aria-label="Buscar auditoria" /></div><button type="button" className="ecommerce-admin-button ghost" onClick={() => loadData(true)}><RefreshCw size={15} /> Atualizar</button></div></div><div className="commerce-audit-summary"><span>{auditPagination.total} evento(s) carregado(s)</span><span>Exibindo até {auditPagination.limit} mais recentes</span></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table commerce-audit-table"><thead><tr><th>Data</th><th>Entidade</th><th>Ação</th><th>Usuário</th><th>Correlation id</th><th>Dados</th></tr></thead><tbody>{filteredAudit.map(item => <tr key={item.id}><td><small>{fmtDate(item.criado_em)}</small></td><td><strong>{item.entidade || '—'}</strong><small>{item.entidade_id || '—'}</small></td><td><span className="commerce-source-badge core">{item.acao || '—'}</span></td><td>{item.usuario_id || 'sistema'}</td><td><code>{item.correlation_id || '—'}</code></td><td><span className="commerce-audit-json" title={auditValue(item.depois)}>{auditValue(item.depois)}</span></td></tr>)}</tbody></table>{!filteredAudit.length && <p className="ecommerce-admin-empty">Nenhum evento de auditoria corresponde à busca.</p>}</div></section>}
    </>}    {modalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de produto"><form className="ecommerce-admin-modal commerce-product-modal" onSubmit={saveProduct} aria-busy={mediaUploading}><button type="button" className="ecommerce-admin-close" onClick={closeProductModal} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">{editingId ? 'Editar item' : 'Novo item'}</span><h2>{editingId ? 'Atualizar produto' : 'Cadastrar produto'}</h2><div className="ecommerce-admin-form-grid"><label className="wide">Nome do item<input required value={form.nome} onChange={event => change('nome', event.target.value)} /></label><label>SKU / código<input value={form.cod} onChange={event => change('cod', event.target.value)} /><small>Opcional na criação; se ficar vazio, o sistema gera um SKU único ao salvar.</small></label>{mode === 'core' ? <label>Categoria<select value={form.categoryId} onChange={event => change('categoryId', event.target.value)}><option value="">Sem categoria</option>{categories.map(category => <option value={category.id} key={category.id}>{category.nome}</option>)}</select></label> : <label>Categoria<input value={form.cat} onChange={event => change('cat', event.target.value)} /></label>}<label>Tipo de produto{mode === 'core' ? <select value={form.tipo} onChange={event => change('tipo', event.target.value)}><option value="physical">Físico</option><option value="digital">Digital</option><option value="service">Serviço</option><option value="ticket">Ingresso</option></select> : <input value={form.tipo} onChange={event => change('tipo', event.target.value)} />}</label><label>Preço de venda ({currencyLabel})<CurrencyInput required min="0" step="0.01" value={form.preco} currency={activeCurrency} onChange={value => change('preco', value)} /></label><label>Preço promocional ({currencyLabel})<CurrencyInput min="0" step="0.01" value={form.precoPromocional} currency={activeCurrency} onChange={value => change('precoPromocional', value)} /></label><label>Estoque inicial<input required type="number" min="0" step="1" value={form.estoque} onChange={event => change('estoque', event.target.value)} /></label><label>Slug / URL amigável<input pattern="[a-z0-9][a-z0-9-]{0,119}" value={form.slug} onChange={event => change('slug', event.target.value)} placeholder="produto-exemplo" /></label>{mode === 'core' ? <><label>Estado do cadastro<select value={form.status} onChange={event => { const status = event.target.value; change('status', status); if (status === 'draft') change('publicado', false) }}><option value="draft">Rascunho</option><option value="active">Ativo</option></select><small className="commerce-admin-help">Ativo pode permanecer fora da vitrine.</small></label><label>Publicação no canal<select value={form.publicado ? 'published' : 'unpublished'} onChange={event => { const published = event.target.value === 'published'; change('publicado', published); if (published) change('status', 'active') }}><option value="unpublished">Fora da vitrine</option><option value="published">Publicado na vitrine</option></select><small className="commerce-admin-help">Aplica somente à loja ativa.</small></label></> : <label>Estado ao salvar<select value={form.ativo ? 'published' : 'draft'} onChange={event => change('ativo', event.target.value === 'published')}><option value="draft">Salvar como rascunho</option><option value="published">Publicar na vitrine</option></select></label>}<label className="wide">Descrição curta<textarea rows="2" maxLength="500" value={form.descricaoCurta} onChange={event => change('descricaoCurta', event.target.value)} placeholder="Resumo exibido nos cards e resultados de busca." /></label><label className="wide">Descrição detalhada<textarea rows="5" maxLength="10000" value={form.descricao} onChange={event => change('descricao', event.target.value)} placeholder="Materiais, medidas, benefícios, cuidados e demais informações do produto." /></label><label>SEO — título<input maxLength="160" value={form.seoTitulo} onChange={event => change('seoTitulo', event.target.value)} placeholder="Título para busca" /></label><label>SEO — descrição<input maxLength="320" value={form.seoDescricao} onChange={event => change('seoDescricao', event.target.value)} placeholder="Resumo para compartilhamento e busca" /></label><label className="wide">URL principal legada (opcional)<input type="text" placeholder="https://… ou caminho existente" value={form.imagem} onChange={event => change('imagem', event.target.value)} /></label></div>{mode === 'core' && <section className="commerce-product-media-editor"><div className="commerce-product-media-heading"><div><span className="ecommerce-admin-kicker">Galeria do produto</span><h3>{productMedia.length} imagem(ns) cadastrada(s)</h3></div><span className="commerce-admin-help">A primeira imagem é usada como capa quando a ordem for 0.</span></div>{productMedia.length > 0 && <div className="commerce-product-media-grid">{productMedia.map(media => <article key={media.id} className="commerce-product-media-card"><ProductMediaImage media={media} storefrontId={storefrontId} alt={media.alt_text || media.altText || form.nome} /><div><small>{media.alt_text || media.altText || 'Sem texto alternativo'}</small><span>Ordem {media.ordem ?? 0}</span></div><button type="button" className="ecommerce-admin-button ghost" onClick={() => removeProductMedia(media)}><Trash2 size={14} /> Remover</button></article>)}</div>}{selectedImageFiles.length > 0 && <div className="commerce-selected-media"><div className="commerce-selected-media-heading"><strong>{selectedImageFiles.length} nova(s) imagem(ns) selecionada(s)</strong><button type="button" onClick={clearSelectedImageFiles}>Limpar seleção</button></div><div className="commerce-selected-media-grid">{selectedImageFiles.map((selected, index) => <article key={selected.uploadId}><img src={selected.previewUrl} alt={`Prévia de ${selected.file.name}`} /><div><span>{selected.file.name}</span><small>{(selected.file.size / 1024 / 1024).toFixed(2)} MB</small></div><button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remover ${selected.file.name}`}><X size={14} /></button></article>)}</div></div>}<label className="commerce-upload-dropzone" onDragOver={event => event.preventDefault()} onDrop={dropProductImages}><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={selectProductImages} /><strong>Adicionar imagens do item</strong><span>Clique ou arraste JPEG, PNG, WebP ou GIF · até 8 MB cada · múltiplos arquivos</span></label><div className="commerce-product-media-options"><label>Texto alternativo padrão<input value={imageAltText} onChange={event => setImageAltText(event.target.value)} placeholder={form.nome || 'Descreva a imagem'} /></label><label>Ordem inicial<input type="number" min="0" step="1" value={imageOrderBase} onChange={event => setImageOrderBase(Number(event.target.value) || 0)} /></label></div><p className="commerce-admin-help">As novas imagens serão enviadas com segurança ao armazenamento da loja ao salvar o produto. O campo de URL continua disponível para referências externas.</p></section>}<div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={closeProductModal}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary" disabled={mediaUploading}>{mediaUploading ? 'Enviando imagens…' : <><Check size={15} /> Salvar item</>}</button></div></form></div>}
    {variantModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Gerenciar variantes e mídias"><section className="ecommerce-admin-modal commerce-variant-modal"><button type="button" className="ecommerce-admin-close" onClick={() => setVariantModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Catálogo avançado</span><h2>Variantes e mídias · {variantProduct?.nome}</h2><div className="commerce-variant-list">{(variantProduct?.variantes || variantProduct?.variants || []).map(variant => <article key={variant.id}><div><strong>{variant.sku}</strong><span>{variant.nome || 'Sem nome'} · {variant.atributos ? JSON.stringify(variant.atributos) : 'sem atributos'}</span><small>{variant.preco == null ? 'Sem preço' : money(variant.preco)} · {variant.estoque || 0} un. · {variant.ativo === false ? 'Arquivada' : 'Ativa'}</small></div><div className="ecommerce-row-actions"><button type="button" onClick={() => beginVariantEdit(variant)}><Edit3 size={14} /> Editar</button>{variant.ativo !== false && <button type="button" onClick={() => archiveVariant(variant)}><Archive size={14} /> Arquivar</button>}</div></article>)}{!(variantProduct?.variantes || variantProduct?.variants || []).length && <p className="ecommerce-admin-empty">Nenhuma variante cadastrada.</p>}</div><form className="ecommerce-admin-form-grid commerce-variant-form" onSubmit={saveVariant}><h3 className="wide">{variantEditingId ? 'Editar variante' : 'Nova variante'}</h3><label>SKU<input required value={variantForm.sku} onChange={event => changeVariant('sku', event.target.value)} /></label><label>Nome<input value={variantForm.nome} onChange={event => changeVariant('nome', event.target.value)} /></label><label>Preço ({currencyLabel})<CurrencyInput required min="0" step="0.01" value={variantForm.preco} currency={activeCurrency} onChange={value => changeVariant('preco', value)} /></label><label>Preço promocional ({currencyLabel})<CurrencyInput min="0" step="0.01" value={variantForm.precoPromocional} currency={activeCurrency} onChange={value => changeVariant('precoPromocional', value)} /></label><label>Barcode<input value={variantForm.barcode} onChange={event => changeVariant('barcode', event.target.value)} /></label><label>Peso (g)<input type="number" min="0" step="1" value={variantForm.pesoGramas} onChange={event => changeVariant('pesoGramas', event.target.value)} /></label><label>Largura (cm)<input type="number" min="0" step="0.01" value={variantForm.larguraCm} onChange={event => changeVariant('larguraCm', event.target.value)} /></label><label>Altura (cm)<input type="number" min="0" step="0.01" value={variantForm.alturaCm} onChange={event => changeVariant('alturaCm', event.target.value)} /></label><label>Comprimento (cm)<input type="number" min="0" step="0.01" value={variantForm.comprimentoCm} onChange={event => changeVariant('comprimentoCm', event.target.value)} /></label><label className="wide">Atributos JSON<textarea rows="3" value={variantForm.atributosJson} onChange={event => changeVariant('atributosJson', event.target.value)} placeholder='{"cor":"azul","tamanho":"M"}' /></label><label className="commerce-checkbox"><input type="checkbox" checked={variantForm.ativo} onChange={event => changeVariant('ativo', event.target.checked)} /> Variante ativa</label><div className="ecommerce-admin-modal-actions wide"><button type="button" className="ecommerce-admin-button ghost" onClick={() => { setVariantEditingId(null); setVariantForm({ sku: '', nome: '', barcode: '', pesoGramas: '', larguraCm: '', alturaCm: '', comprimentoCm: '', atributosJson: '{}', preco: '', precoPromocional: '', ativo: true }) }}>{variantEditingId ? 'Cancelar edição' : 'Limpar'}</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> {variantEditingId ? 'Atualizar variante' : 'Criar variante'}</button></div></form><div className="commerce-media-manager"><div className="commerce-category-list-heading"><strong>Mídias do produto</strong><span>{productMedia.length} arquivo(s)</span></div>{productMedia.map(media => <article key={media.id}><div>{media.public_url || media.publicUrl ? <ProductMediaImage media={media} storefrontId={storefrontId} alt={media.alt_text || media.altText || variantProduct?.nome || 'Imagem do produto'} /> : <span>URL interna</span>}<small>{media.alt_text || media.altText || 'Sem texto alternativo'} · ordem {media.ordem || 0}</small></div><button type="button" onClick={() => removeProductMedia(media)}><Trash2 size={14} /> Remover</button></article>)}<form className="ecommerce-admin-form-grid" onSubmit={saveProductMedia}><label className="wide">URL da imagem<input required type="url" value={mediaForm.url} onChange={event => changeMedia('url', event.target.value)} placeholder="https://…" /></label><label>Texto alternativo<input value={mediaForm.altText} onChange={event => changeMedia('altText', event.target.value)} /></label><label>Ordem<input type="number" min="0" step="1" value={mediaForm.ordem} onChange={event => changeMedia('ordem', event.target.value)} /></label><button type="submit" className="ecommerce-admin-button primary"><Plus size={15} /> Adicionar mídia</button></form></div></section></div>}
    {storefrontModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Criar loja Commerce"><form className="ecommerce-admin-modal commerce-storefront-modal" onSubmit={saveStorefront}><button type="button" className="ecommerce-admin-close" onClick={() => setStorefrontModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker"><Store size={14} /> Nova operação</span><h2>Criar loja Commerce</h2><p className="commerce-admin-help">A loja será vinculada ao mesmo tenant, com unidade operacional e estoque isolados. Nenhum domínio fica público antes da validação TXT.</p><div className="ecommerce-admin-form-grid"><label>Identificador da loja<input required pattern="[a-z0-9][a-z0-9_-]{1,79}" value={storefrontForm.codigo} onChange={event => changeStorefront('codigo', event.target.value)} placeholder="ex.: loja-centro" /></label><label>Nome comercial<input required value={storefrontForm.nome} onChange={event => changeStorefront('nome', event.target.value)} placeholder="Loja Centro" /></label><label>Código da unidade<input value={storefrontForm.lojaCodigo} onChange={event => changeStorefront('lojaCodigo', event.target.value)} placeholder="CENTRO" /></label><label>Nome da unidade<input value={storefrontForm.lojaNome} onChange={event => changeStorefront('lojaNome', event.target.value)} placeholder="Unidade Centro" /></label><label className="wide">Nome fantasia<input value={storefrontForm.nomeFantasia} onChange={event => changeStorefront('nomeFantasia', event.target.value)} placeholder="Opcional" /></label><label>Canal<select value={storefrontForm.canal} onChange={event => changeStorefront('canal', event.target.value)}><option value="web">Web / E-commerce</option><option value="pos">PDV</option><option value="marketplace">Marketplace</option><option value="api">API</option></select></label><label>Fuso horário<select value={storefrontForm.timezone} onChange={event => changeStorefront('timezone', event.target.value)}><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="America/Manaus">America/Manaus</option><option value="America/Fortaleza">America/Fortaleza</option></select></label><label className="wide">Domínio customizado (opcional)<input type="text" value={storefrontForm.dominio} onChange={event => changeStorefront('dominio', event.target.value)} placeholder="loja.exemplo.com.br" /><small>Será cadastrado como pendente; o DNS/TXT será verificado depois.</small></label><label className="commerce-checkbox wide"><input type="checkbox" checked={storefrontForm.criarUnidade} onChange={event => changeStorefront('criarUnidade', event.target.checked)} /> Criar unidade operacional e local de estoque automaticamente</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setStorefrontModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Store size={15} /> Criar loja</button></div></form></div>}
    {templateModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Criar template promocional"><form className="ecommerce-admin-modal commerce-template-modal" onSubmit={savePromotionTemplate}><button type="button" className="ecommerce-admin-close" onClick={() => setTemplateModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker"><Sparkles size={14} /> Biblioteca do tenant</span><h2>Novo template promocional</h2><div className="ecommerce-admin-form-grid"><label>Código<input required pattern="[a-z0-9][a-z0-9_-]{1,79}" value={templateForm.codigo} onChange={event => changeTemplate('codigo', event.target.value)} placeholder="campanha-verao" /></label><label>Nome<input required value={templateForm.nome} onChange={event => changeTemplate('nome', event.target.value)} placeholder="Campanha de verão" /></label><label className="wide">Descrição<input value={templateForm.descricao} onChange={event => changeTemplate('descricao', event.target.value)} placeholder="Como e quando usar este modelo" /></label><label>Tipo<select value={templateForm.tipo} onChange={event => changeTemplate('tipo', event.target.value)}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>{templateForm.tipo === 'percentage' ? 'Percentual (%)' : `Valor (${currencyLabel})`}{templateForm.tipo === 'percentage' ? <input required type="number" min="0.01" max="100" step="0.01" value={templateForm.valor} onChange={event => changeTemplate('valor', event.target.value)} /> : <CurrencyInput required min="0.01" step="0.01" value={templateForm.valor} currency={activeCurrency} onChange={value => changeTemplate('valor', value)} />}</label><label className="wide">Regras JSON<textarea rows="4" value={templateForm.regrasJson} onChange={event => changeTemplate('regrasJson', event.target.value)} /></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setTemplateModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Sparkles size={15} /> Salvar template</button></div></form></div>}
    {paymentModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de conta de pagamento"><form className="ecommerce-admin-modal" onSubmit={savePaymentAccount}><button type="button" className="ecommerce-admin-close" onClick={() => setPaymentModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Gateway</span><h2>Configurar conta de pagamento</h2><p className="commerce-admin-help">Informe somente referências <code>env:VARIAVEL</code> e configuração pública. Nenhum token ou senha é salvo no painel.</p><div className="ecommerce-admin-form-grid"><label>Provedor<select value={paymentForm.provider} onChange={event => changePayment('provider', event.target.value)}><option value="mercadopago">Mercado Pago</option><option value="infinitepay">InfinitePay Checkout</option><option value="stripe">Stripe</option><option value="pagarme">Pagar.me</option><option value="stone">Stone</option></select></label><label>Ambiente<select value={paymentForm.ambiente} onChange={event => changePayment('ambiente', event.target.value)} disabled={paymentForm.provider === 'infinitepay'}><option value="sandbox">Sandbox</option><option value="production">Produção</option></select></label><label className="wide">Nome da conta<input required value={paymentForm.nome} onChange={event => changePayment('nome', event.target.value)} /></label><label className="wide">Secret ref<input required pattern="env:[A-Z][A-Z0-9_]{2,}" value={paymentForm.secretRef} onChange={event => changePayment('secretRef', event.target.value)} /></label>{paymentForm.provider === 'mercadopago' && <label className="wide">Webhook secret ref<input required pattern="env:[A-Z][A-Z0-9_]{2,}" value={paymentForm.webhookSecretRef} onChange={event => changePayment('webhookSecretRef', event.target.value)} /></label>}{paymentForm.provider === 'infinitepay' && <><label className="wide">InfiniteTag / handle<input required maxLength="120" value={paymentForm.handle} onChange={event => changePayment('handle', event.target.value)} placeholder="sua-infinite-tag" /></label><label className="wide">URL de retorno<input required type="url" value={paymentForm.redirectUrl} onChange={event => changePayment('redirectUrl', event.target.value)} /></label><label className="wide">URL do webhook<input required type="url" value={paymentForm.webhookUrl} onChange={event => changePayment('webhookUrl', event.target.value)} /></label><div className="wide commerce-admin-help"><strong>Métodos publicados após ativação:</strong> Pix e cartão de crédito.</div></>}<label className="commerce-checkbox"><input type="checkbox" checked={paymentForm.ativo} onChange={event => changePayment('ativo', event.target.checked)} /> Ativar após homologação</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setPaymentModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar referência</button></div></form></div>}
    {reconcileTarget && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Reconciliar venda InfinitePay"><form className="ecommerce-admin-modal" onSubmit={reconcilePayment}><button type="button" className="ecommerce-admin-close" onClick={() => setReconcileTarget(null)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Reconciliação auditável</span><h2>Vincular venda InfinitePay</h2><p className="commerce-admin-help">Use os identificadores públicos exibidos nos detalhes da venda. O Commerce consultará o gateway e só marcará o pagamento como aprovado se o valor e o status forem confirmados.</p><div className="ecommerce-admin-form-grid"><label className="wide">Transaction NSU<input required value={reconcileForm.transactionNsu} onChange={event => changeReconcile('transactionNsu', event.target.value)} placeholder="Ex.: 123456789" /></label><label className="wide">Invoice slug / slug<input required value={reconcileForm.slug} onChange={event => changeReconcile('slug', event.target.value)} placeholder="Ex.: checkout-abc123" /></label><label className="wide">URL do comprovante (opcional)<input type="url" value={reconcileForm.receiptUrl} onChange={event => changeReconcile('receiptUrl', event.target.value)} placeholder="https://…" /></label><label>Método de captura<select value={reconcileForm.captureMethod} onChange={event => changeReconcile('captureMethod', event.target.value)}><option value="credit_card">Cartão de crédito</option><option value="pix">Pix</option><option value="">Não informado</option></select></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setReconcileTarget(null)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Validar e reconciliar</button></div></form></div>}
    {creditModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Conta de crediário"><form className="ecommerce-admin-modal" onSubmit={saveCreditAccount}><button type="button" className="ecommerce-admin-close" onClick={() => setCreditModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Conta a prazo</span><h2>{editingCreditAccountId ? 'Editar conta de crediário' : 'Aprovar cliente no crediário'}</h2><p className="commerce-admin-help">Somente clientes cadastrados e não bloqueados podem usar “Marcar na conta”. O limite é validado no servidor antes de capturar o pedido.</p><div className="ecommerce-admin-form-grid"><label className="wide">Cliente<select required value={creditForm.customerId} disabled={Boolean(editingCreditAccountId)} onChange={event => changeCredit('customerId', event.target.value)}><option value="">Selecione um cliente cadastrado</option>{customers.filter(customer => !customer.bloqueado).map(customer => <option value={customer.id} key={customer.id}>{customer.nome} · {customer.email || 'sem e-mail'}</option>)}</select></label><label>Limite de crédito ({currencyLabel})<CurrencyInput required min="0.01" step="0.01" value={creditForm.limiteCredito} currency={activeCurrency} onChange={value => changeCredit('limiteCredito', value)} /></label><label>Prazo (dias)<input required type="number" min="1" max="365" step="1" value={creditForm.prazoDias} onChange={event => changeCredit('prazoDias', event.target.value)} /></label><label>Status<select value={creditForm.status} onChange={event => changeCredit('status', event.target.value)}><option value="active">Ativo</option><option value="blocked">Bloqueado</option><option value="closed">Encerrado</option></select></label><label className="wide">Observações<textarea rows="3" value={creditForm.observacoes} onChange={event => changeCredit('observacoes', event.target.value)} placeholder="Ex.: aprovado pelo financeiro" /></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setCreditModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar conta</button></div></form></div>}
    {customerModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de cliente"><form className="ecommerce-admin-modal" onSubmit={saveCustomer}><button type="button" className="ecommerce-admin-close" onClick={() => setCustomerModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">{editingCustomerId ? 'Editar cliente' : 'Novo cliente'}</span><h2>{editingCustomerId ? 'Atualizar cliente' : 'Cadastrar cliente'}</h2><div className="ecommerce-admin-form-grid"><label className="wide">Nome<input required value={customerForm.nome} onChange={event => changeCustomer('nome', event.target.value)} /></label><label>Email<input type="email" value={customerForm.email} onChange={event => changeCustomer('email', event.target.value)} /></label><label>Telefone<input value={customerForm.telefone} onChange={event => changeCustomer('telefone', event.target.value)} /></label><label>Documento mascarado<input placeholder="Somente valor já mascarado" value={customerForm.documentoMascarado} onChange={event => changeCustomer('documentoMascarado', event.target.value)} /></label><label className="commerce-checkbox"><input type="checkbox" checked={customerForm.bloqueado} onChange={event => changeCustomer('bloqueado', event.target.checked)} /> Bloquear cliente</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setCustomerModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar cliente</button></div></form></div>}
    {addressModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Endereços do cliente"><section className="ecommerce-admin-modal"><button type="button" className="ecommerce-admin-close" onClick={() => setAddressModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Cliente</span><h2>Endereços de {selectedCustomer?.nome}</h2><div className="commerce-address-list">{customerAddresses.map(address => <article key={address.id}><div><strong>{address.rotulo}</strong><span>{[address.logradouro, address.numero, address.bairro, address.cidade, address.estado].filter(Boolean).join(', ') || 'Endereço incompleto'}{address.cep ? ` · CEP ${address.cep}` : ''}</span></div><div className="ecommerce-row-actions"><button type="button" onClick={() => beginAddressEdit(address)}><Edit3 size={15} /> Editar</button><button type="button" onClick={() => removeAddress(address)}><Trash2 size={15} /> Remover</button></div></article>)}{!customerAddresses.length && <p className="ecommerce-admin-empty">Nenhum endereço cadastrado.</p>}</div><form className="ecommerce-admin-form-grid commerce-address-form" onSubmit={saveAddress}><label>Rótulo<input value={addressForm.rotulo} onChange={event => changeAddress('rotulo', event.target.value)} /></label><label>Destinatário<input required value={addressForm.destinatario} onChange={event => changeAddress('destinatario', event.target.value)} /></label><label>CEP<input value={addressForm.cep} onChange={event => changeAddress('cep', event.target.value)} /></label><label>Logradouro<input value={addressForm.logradouro} onChange={event => changeAddress('logradouro', event.target.value)} /></label><label>Número<input value={addressForm.numero} onChange={event => changeAddress('numero', event.target.value)} /></label><label>Bairro<input value={addressForm.bairro} onChange={event => changeAddress('bairro', event.target.value)} /></label><label>Cidade<input value={addressForm.cidade} onChange={event => changeAddress('cidade', event.target.value)} /></label><label>UF<input maxLength="2" value={addressForm.estado} onChange={event => changeAddress('estado', event.target.value)} /></label><label className="wide">Complemento<input value={addressForm.complemento} onChange={event => changeAddress('complemento', event.target.value)} /></label><label className="commerce-checkbox"><input type="checkbox" checked={addressForm.padrao} onChange={event => changeAddress('padrao', event.target.checked)} /> Endereço padrão</label><div className="ecommerce-admin-modal-actions wide"><button type="button" className="ecommerce-admin-button ghost" onClick={() => { setEditingAddressId(null); setAddressForm({ ...EMPTY_ADDRESS, destinatario: selectedCustomer?.nome || '' }) }}>{editingAddressId ? 'Cancelar edição' : 'Limpar'}</button><button type="submit" className="ecommerce-admin-button primary">{editingAddressId ? <><Check size={15} /> Atualizar endereço</> : <><Plus size={15} /> Adicionar endereço</>}</button></div></form></section></div>}
    {shippingAccountModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de conta logística"><form className="ecommerce-admin-modal commerce-shipping-account-modal" onSubmit={saveShippingAccount}><button type="button" className="ecommerce-admin-close" onClick={() => setShippingAccountModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Logística</span><h2>Configurar conta logística</h2><p className="commerce-admin-help">Use somente referências como <code>env:ME_ACCESS_TOKEN</code>. O token e o segredo de webhook devem existir no secret manager. A conta não ativa sozinha.</p><div className="ecommerce-admin-form-grid"><label>Provedor<select value={shippingAccountForm.provider} onChange={event => changeShippingAccount('provider', event.target.value)}><option value="melhorenvio">Melhor Envio</option><option value="correios">Correios</option></select></label><label>Ambiente<select value={shippingAccountForm.ambiente} onChange={event => changeShippingAccount('ambiente', event.target.value)}><option value="sandbox">Sandbox</option><option value="production">Produção</option></select></label><label className="wide">Nome da conta<input required value={shippingAccountForm.nome} onChange={event => changeShippingAccount('nome', event.target.value)} /></label><label className="wide">Secret ref<input required pattern="env:[A-Z][A-Z0-9_]{2,}" value={shippingAccountForm.secretRef} onChange={event => changeShippingAccount('secretRef', event.target.value)} /></label><label className="wide">Webhook secret ref <small>{shippingAccountForm.provider === 'correios' ? '(não utilizado; tracking por consulta autenticada)' : '(obrigatório para tracking assinado)'}</small><input required={shippingAccountForm.provider === 'melhorenvio'} disabled={shippingAccountForm.provider === 'correios'} pattern="env:[A-Z][A-Z0-9_]{2,}" value={shippingAccountForm.webhookSecretRef} onChange={event => changeShippingAccount('webhookSecretRef', event.target.value)} /></label>{shippingAccountForm.provider === 'correios' && <><label className="wide">Códigos de serviço contratados<input required value={shippingAccountForm.services} onChange={event => changeShippingAccount('services', event.target.value)} placeholder="Ex.: 03220, 04669" /><small>Informe somente serviços liberados no cartão/contrato dos Correios.</small></label><label className="wide">Serviços adicionais (opcional)<input value={shippingAccountForm.servicesAdditional} onChange={event => changeShippingAccount('servicesAdditional', event.target.value)} placeholder="Ex.: 019, 001" /></label><label>Modalidade de pagamento<select value={shippingAccountForm.modalidadePagamento} onChange={event => changeShippingAccount('modalidadePagamento', event.target.value)}><option value="">Selecione</option><option value="1">1 · À vista</option><option value="2">2 · A faturar</option><option value="3">3 · À vista e a faturar</option><option value="4">4 · Prestação de contas</option></select></label><label>Número do cartão de postagem<input value={shippingAccountForm.postingCard} onChange={event => changeShippingAccount('postingCard', event.target.value)} placeholder="Conforme contrato Correios" /></label><label>Tipo de rótulo<select value={shippingAccountForm.labelType} onChange={event => changeShippingAccount('labelType', event.target.value)}><option value="P">P · Padrão</option><option value="R">R · Reduzido</option></select></label><label>Formato do rótulo<select value={shippingAccountForm.labelFormat} onChange={event => changeShippingAccount('labelFormat', event.target.value)}><option value="ET">ET · Etiqueta</option><option value="EV">EV · Envelope</option></select></label><label className="wide">Layout de impressão<input value={shippingAccountForm.labelLayout} onChange={event => changeShippingAccount('labelLayout', event.target.value.toUpperCase())} placeholder="PADRAO" /></label><label className="commerce-checkbox wide"><input type="checkbox" checked={shippingAccountForm.prepostagemApiEnabled} onChange={event => changeShippingAccount('prepostagemApiEnabled', event.target.checked)} /> Pré-postagem API 36 validada no CWS (não marque antes da validação oficial)</label></>}<label>CEP de origem<input required inputMode="numeric" value={shippingAccountForm.origemCep} onChange={event => changeShippingAccount('origemCep', event.target.value)} placeholder="00000-000" /></label><label>Nome do remetente<input required value={shippingAccountForm.origin.name} onChange={event => changeShippingOrigin('name', event.target.value)} /></label><label>E-mail do remetente<input required type="email" value={shippingAccountForm.origin.email} onChange={event => changeShippingOrigin('email', event.target.value)} /></label><label>Telefone do remetente<input required value={shippingAccountForm.origin.phone} onChange={event => changeShippingOrigin('phone', event.target.value)} /></label><label>CPF do remetente<input value={shippingAccountForm.origin.document} onChange={event => changeShippingOrigin('document', event.target.value)} /></label><label>CNPJ do remetente<input value={shippingAccountForm.origin.companyDocument} onChange={event => changeShippingOrigin('companyDocument', event.target.value)} /></label><label>Inscrição estadual<input value={shippingAccountForm.origin.stateRegister} onChange={event => changeShippingOrigin('stateRegister', event.target.value)} /></label><label className="wide">Logradouro<input required value={shippingAccountForm.origin.address} onChange={event => changeShippingOrigin('address', event.target.value)} /></label><label>Número<input required value={shippingAccountForm.origin.number} onChange={event => changeShippingOrigin('number', event.target.value)} /></label><label>Complemento<input value={shippingAccountForm.origin.complement} onChange={event => changeShippingOrigin('complement', event.target.value)} /></label><label>Bairro<input required value={shippingAccountForm.origin.district} onChange={event => changeShippingOrigin('district', event.target.value)} /></label><label>Cidade<input required value={shippingAccountForm.origin.city} onChange={event => changeShippingOrigin('city', event.target.value)} /></label><label>UF<input required maxLength="2" value={shippingAccountForm.origin.stateAbbr} onChange={event => changeShippingOrigin('stateAbbr', event.target.value.toUpperCase())} /></label><label className="commerce-checkbox wide"><input type="checkbox" checked={shippingAccountForm.nonCommercial} onChange={event => changeShippingAccount('nonCommercial', event.target.checked)} /> Usar declaração de conteúdo não comercial; para vendas com nota fiscal, deixe desmarcado e informe a chave no momento da expedição.</label><label className="commerce-checkbox"><input type="checkbox" checked={shippingAccountForm.ativo} onChange={event => changeShippingAccount('ativo', event.target.checked)} /> Ativar após validar secrets e origem</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setShippingAccountModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar conta</button></div></form></div>}
    {shippingModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label={`${editingShippingMethodId ? 'Editar' : 'Novo'} método de entrega`}><form className="ecommerce-admin-modal commerce-shipping-method-modal" onSubmit={saveShippingMethod}><button type="button" className="ecommerce-admin-close" onClick={() => { setEditingShippingMethodId(null); setShippingForm(EMPTY_SHIPPING); setShippingModalOpen(false) }} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Fulfillment</span><h2>{editingShippingMethodId ? 'Editar método de entrega' : 'Novo método de entrega'}</h2><div className="ecommerce-admin-form-grid"><label>Código<input required value={shippingForm.codigo} onChange={event => changeShipping('codigo', event.target.value)} placeholder="retirada-loja" /></label><label>Nome<input required value={shippingForm.nome} onChange={event => changeShipping('nome', event.target.value)} placeholder="Retirada na loja" /></label><label>Tipo<select value={shippingForm.tipo} onChange={event => changeShipping('tipo', event.target.value)}><option value="pickup">Retirada</option><option value="delivery">Delivery</option><option value="carrier">Transportadora</option><option value="digital">Digital</option><option value="service">Serviço</option></select></label>{['delivery', 'carrier'].includes(shippingForm.tipo) && <label>Operação<select value={shippingForm.provider} onChange={event => changeShipping('provider', event.target.value)}><option value="manual">Entrega própria · sem Correios</option><option value="melhorenvio">Melhor Envio</option><option value="correios">Correios</option></select></label>}{['delivery', 'carrier'].includes(shippingForm.tipo) && shippingForm.provider === 'manual' && <><label>Modalidade<select value={shippingForm.deliveryType} onChange={event => changeShipping('deliveryType', event.target.value)}><option value="motoboy">Motoboy / entrega local</option><option value="regional_table">Tabela regional fixa</option><option value="express">Entrega expressa</option><option value="free_shipping">Frete grátis</option></select></label><label>Prazo (dias úteis)<input type="number" min="1" step="1" value={shippingForm.deliveryDays} onChange={event => changeShipping('deliveryDays', event.target.value)} /></label><label>CEP de origem<input inputMode="numeric" placeholder="00000-000" value={shippingForm.originCep} onChange={event => changeShipping('originCep', event.target.value.replace(/\\D/g, '').slice(0, 8))} /></label><label>Taxa base ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.baseFee} currency={activeCurrency} onChange={value => changeShipping('baseFee', value)} /></label><label>Valor por km ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.pricePerKm} currency={activeCurrency} onChange={value => changeShipping('pricePerKm', value)} /></label><label>Valor por zona ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.pricePerZone} currency={activeCurrency} onChange={value => changeShipping('pricePerZone', value)} /></label><label>Taxa expressa fixa ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.fixedFee} currency={activeCurrency} onChange={value => changeShipping('fixedFee', value)} /></label><label>Adicional expresso ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.additionalFee} currency={activeCurrency} onChange={value => changeShipping('additionalFee', value)} /></label><label>Frete grátis acima de ({currencyLabel})<CurrencyInput min="0" step="0.01" value={shippingForm.freeShippingAbove} currency={activeCurrency} onChange={value => changeShipping('freeShippingAbove', value)} /></label><label>Raio máximo (km)<input type="number" min="0" step="0.1" value={shippingForm.maxRadiusKm} onChange={event => changeShipping('maxRadiusKm', event.target.value)} /></label><label>Distância padrão (km)<input type="number" min="0" step="0.1" value={shippingForm.distanceKm} onChange={event => changeShipping('distanceKm', event.target.value)} /></label><OwnDeliveryRulesEditor value={shippingForm.rulesJson} onChange={value => changeShipping('rulesJson', value)} /><p className="commerce-admin-help wide">A entrega própria calcula no servidor por cidade, UF, faixa de CEP, distância e valor do pedido. Ative o método somente depois de revisar as regras e taxas reais da loja.</p></>}{['delivery', 'carrier'].includes(shippingForm.tipo) && shippingForm.provider !== 'manual' && <label>Conta logística<select required value={shippingForm.shippingAccountId} onChange={event => changeShipping('shippingAccountId', event.target.value)}><option value="">Selecione uma conta pronta</option>{shippingAccounts.filter(account => account.ativo && account.ready).map(account => <option key={account.id} value={account.id}>{account.nome} · {account.ambiente}</option>)}</select></label>}<label className="wide">Configuração avançada (JSON)<textarea rows="3" value={shippingForm.configuracao} onChange={event => changeShipping('configuracao', event.target.value)} /></label><label className="commerce-checkbox"><input type="checkbox" checked={shippingForm.ativo} onChange={event => changeShipping('ativo', event.target.checked)} /> Método ativo</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => { setEditingShippingMethodId(null); setShippingForm(EMPTY_SHIPPING); setShippingModalOpen(false) }}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> {editingShippingMethodId ? 'Atualizar método' : 'Criar método'}</button></div></form></div>}
    {domainModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Novo domínio"><form className="ecommerce-admin-modal" onSubmit={saveDomain}><button type="button" className="ecommerce-admin-close" onClick={() => setDomainModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Canal web</span><h2>Adicionar domínio</h2><p className="commerce-admin-help">Após salvar, crie o registro TXT indicado antes de solicitar a verificação.</p><div className="ecommerce-admin-form-grid"><label className="wide">Domínio<input required value={domainForm.dominio} onChange={event => changeDomain('dominio', event.target.value)} placeholder="loja.exemplo.com.br" /></label><label className="commerce-checkbox"><input type="checkbox" checked={domainForm.principal} onChange={event => changeDomain('principal', event.target.checked)} /> Definir como principal</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setDomainModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Cadastrar domínio</button></div></form></div>}
  </main>
}
