import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, MapPin, PackageCheck, ShieldCheck, Store, Trash2, Truck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { commerceDisplayName, isStalloneBrandContext, DINO_COMMERCE_LOGO, STALLONE_LOGO, STALLONE_LOGO_LIGHT } from '../../lib/brand'
import { checkoutPaymentChoices, clearStorefrontCheckoutIdempotencyKey, nextStorefrontCartSyncVersion, normalizeStorefrontAlias, removeStorefrontCartItem, storefrontApiBase, storefrontCartSessionKey, storefrontCheckoutIdempotencyKey, storefrontRoute, storefrontStorageKey } from '../../lib/storefront'
import { createLatestRequest } from '../../lib/latest-request'
import { cartHasPickupOnlyItems, PICKUP_ONLY_NOTE } from '../../lib/storefront-catalog'
import { createCheckoutOrderPoller } from '../../lib/checkout-order-polling'
import { checkoutShippingErrorMessage, checkoutShippingSupportAction, checkoutTotal, DINO_DELIVERY_UNAVAILABLE, isDinoCommerceStorefront, recommendedShippingOption, selectedShippingOption, shippingQuoteKey } from '../../lib/checkout-shipping'
import { checkoutContactReference, checkoutContactReviewMessage, checkoutContactSupportAction } from '../../lib/checkout-contact'
import { checkoutReturnSafety } from '../../lib/checkout-return-safety'
import { hasLateCaptureReview, LATE_CAPTURE_COPY } from '../../lib/late-capture-status'
import { isPromotionOrderRevalidationError, normalizePromotionCode, promotionPreviewErrorMessage, promotionPreviewFingerprint, promotionPreviewTotals, requestPromotionPreview } from '../../lib/checkout-promotion'
import './checkout-promotion.css'
import './stallone-checkout.css'

const EMPTY_ADDRESS = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' }

function readCart(storeAlias) {
  try {
    const value = JSON.parse(localStorage.getItem(storefrontStorageKey(storeAlias, 'cart')) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function money(value) { return fmtR(Number(value || 0)) }
function formatCep(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}
function paymentLabel(item) { return item?.label || (item?.provider === 'crediario' || item?.method === 'account' ? 'Marcar na conta' : item?.method === 'credit_card' ? 'Cartão de crédito' : item?.method === 'pix' ? 'Pix' : item?.method || 'Pagamento online') }
function paymentDescription(item) {
  if (item?.provider === 'infinitepay') {
    const labels = (item.captureMethods || []).map(method => method === 'credit_card' ? 'cartão' : method === 'pix' ? 'Pix' : '').filter(Boolean)
    const methods = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} ou ${labels.at(-1)}` : labels[0] || 'a forma de pagamento'
    return `Escolha ${methods} uma única vez, no ambiente seguro da InfinitePay.`
  }
  if (item?.provider === 'mercadopago') return 'Mercado Pago'
  if (item?.provider === 'crediario') return 'Crediário da loja'
  return item?.provider || 'Provedor seguro'
}
function shippingPromise(option) {
  const total = option?.deliveryRange?.max ?? option?.deliveryDays
  const backorderNote = option?.backorderLeadDays ? ` · +${option.backorderLeadDays} dias úteis por encomenda` : ''
  if (option?.preparationDays !== null && option?.preparationDays !== undefined && option?.providerDeliveryDays !== null && option?.providerDeliveryDays !== undefined && total !== null && total !== undefined) {
    return `${option.carrier || 'Transportadora'} · ${option.preparationDays} dias úteis de preparação e postagem + ${option.providerDeliveryDays} dias úteis de transporte · total estimado: ${total} dias úteis${backorderNote}`;
  }
  if (option?.provider === 'manual' || option?.carrier === 'Kytto Entrega' || option?.carrier === 'Motoboy local' || option?.carrier === 'Kytto Express') return `${option?.carrier || 'Entrega própria'} · ${option.priceNote || (total === 1 ? 'até 24 horas úteis' : `até ${total || 10} dias úteis`)}${backorderNote}`
  return `${option?.carrier || 'Transportadora'}${option?.deliveryRange?.max ? ` · até ${option.deliveryRange.max} dias úteis` : ''}${backorderNote}`;
}
function shippingPriceSummary(option) {
  const base = Number(option?.providerAmount);
  const surcharge = Number(option?.surchargeAmount);
  const total = Number(option?.amount);
  if (option?.provider === 'manual' || option?.carrier === 'Kytto Entrega' || option?.carrier === 'Motoboy local' || option?.carrier === 'Kytto Express') return option.priceNote && !String(shippingPromise(option)).includes(option.priceNote) ? `${option.priceNote} · total de entrega ${money(total)}` : `Total de entrega ${money(total)}`
  return Number.isFinite(base) && Number.isFinite(surcharge) && Number.isFinite(total)
    ? `Tarifa Correios ${money(base)} + 12% (${money(surcharge)}) = total de entrega ${money(total)}`
    : '';
}
function idem(prefix = 'checkout') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }

function hostedPaymentUrl(checkout) {
  const candidate = checkout?.url || checkout?.link || checkout?.checkoutUrl || checkout?.ticketUrl || ''
  if (!candidate) return ''
  try {
    const url = new URL(candidate, window.location.origin)
    const allowedHosts = new Set(['checkout.infinitepay.com.br', 'checkout.infinitepay.io'])
    return url.protocol === 'https:' && allowedHosts.has(url.hostname) ? url.toString() : ''
  } catch { return '' }
}

function paymentIdempotencyKey(code, provider, method, storeAlias) {
  const storageKey = `kytto_payment_attempt:${normalizeStorefrontAlias(storeAlias) || 'host'}:${String(code || '').toUpperCase()}:${provider}:${method}`
  try {
    const existing = localStorage.getItem(storageKey)
    if (existing) return existing
    const generated = idem('payment')
    localStorage.setItem(storageKey, generated)
    return generated
  } catch { return idem('payment') }
}

function ProductThumb({ item }) {
  return item.imagem
    ? <img className="checkout-summary-thumb" src={item.imagem} alt="" />
    : <span className="checkout-summary-thumb">▦</span>
}

function Stepper({ paymentReady }) {
  return <div className="checkout-stepper" aria-label="Etapas do checkout">
    {['Dados', 'Entrega', 'Pagamento'].map((label, index) => <div key={label} className={`checkout-step ${index === 0 || paymentReady ? 'is-active' : ''}`}>
      <span className="checkout-step-dot">{paymentReady && index < 2 ? '✓' : index + 1}</span><span>{label}</span>{index < 2 && <i className="checkout-step-line" />}
    </div>)}
  </div>
}

export default function CommerceCheckout() {
  const { storeAlias: routeAlias = '' } = useParams()
  const storeIdentity = normalizeStorefrontAlias(routeAlias) || 'host'
  return <CommerceCheckoutSession key={storeIdentity} />
}

function CommerceCheckoutSession() {
  const navigate = useNavigate()
  const { storeAlias: routeAlias = '' } = useParams()
  const storeAlias = normalizeStorefrontAlias(routeAlias)
  const storefrontApi = storefrontApiBase(storeAlias)
  const storeRoute = storefrontRoute(storeAlias, 'store')
  const checkoutRoute = storefrontRoute(storeAlias, 'checkout')
  const orderRoute = storefrontRoute(storeAlias, 'order')
  const cartStorageKey = storefrontStorageKey(storeAlias, 'cart')
  const [cartSessionKey] = useState(() => storefrontCartSessionKey(storeAlias))
  const [orderIdempotencyKey, setOrderIdempotencyKey] = useState(() => storefrontCheckoutIdempotencyKey(storeAlias))
  const [searchParams] = useSearchParams()
  const orderCode = searchParams.get('order') || searchParams.get('order_nsu') || ''
  const returnTransactionNsu = searchParams.get('transaction_nsu') || searchParams.get('transactionNsu') || ''
  const returnSlug = searchParams.get('slug') || searchParams.get('invoice_slug') || ''
  const hasProviderReturn = Boolean(orderCode && returnTransactionNsu && returnSlug)
  useEffect(() => {
    if (!searchParams.has('receipt_url') && !searchParams.has('receiptUrl')) return
    const sanitized = new URLSearchParams(searchParams)
    sanitized.delete('receipt_url')
    sanitized.delete('receiptUrl')
    navigate({ search: sanitized.toString() }, { replace: true })
  }, [navigate, searchParams])
  const [cart, setCart] = useState(() => readCart(storeAlias))
  const [storeContext, setStoreContext] = useState(null)
  const isDinoCommerce = isDinoCommerceStorefront(storeContext)
  const isStalloneCommerce = storeAlias === 'stallone' || isStalloneBrandContext(storeContext, storeContext?.configuracao?.public)
  const [products, setProducts] = useState([])
  const [shippingMethods, setShippingMethods] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [shippingMethodId, setShippingMethodId] = useState('')
  const [shippingQuote, setShippingQuote] = useState(null)
  const [shippingOptionId, setShippingOptionId] = useState('')
  const [address, setAddress] = useState(EMPTY_ADDRESS)
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState('retirada')
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', documento: '' })
  const [note, setNote] = useState('')
  const [promotionCode, setPromotionCode] = useState('')
  const [promotionPreview, setPromotionPreview] = useState(null)
  const [promotionState, setPromotionState] = useState('idle')
  const [promotionError, setPromotionError] = useState('')
  const [recoveryPreference, setRecoveryPreference] = useState(null)
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [returnStatus, setReturnStatus] = useState(hasProviderReturn ? 'checking' : null)
  const [selectedPayment, setSelectedPayment] = useState('')
  // Crediário: o número do pedido é confirmado por código no WhatsApp antes de marcar na conta.
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [phoneEnding, setPhoneEnding] = useState('')
  const [phoneToken, setPhoneToken] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [working, setWorking] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const [contactReview, setContactReview] = useState(null)
  const [copied, setCopied] = useState(false)
  const [cartAnnouncement, setCartAnnouncement] = useState('')
  const orderRequestRef = useRef(false)
  const paymentRequestRef = useRef(false)
  const cartSyncControllerRef = useRef(null)
  const removedCartIndexRef = useRef(null)
  const emptyCartLinkRef = useRef(null)
  const addressNumberRef = useRef(null)
  const emailRef = useRef(null)
  const promotionButtonRef = useRef(null)
  const contactReviewRef = useRef(null)
  const lastLookupCepRef = useRef('')
  const lastShippingQuoteKeyRef = useRef('')
  const shippingQuoteRequestRef = useRef(0)
  const postalRequestRef = useRef(createLatestRequest())
  const promotionRequestRef = useRef({ id: 0, controller: null })

  function invalidateShippingQuote() {
    shippingQuoteRequestRef.current += 1
    setShippingQuoteLoading(false)
    setShippingQuote(null)
    setShippingOptionId('')
    lastShippingQuoteKeyRef.current = ''
  }

  useEffect(() => () => {
    postalRequestRef.current.invalidate()
    shippingQuoteRequestRef.current += 1
    promotionRequestRef.current.controller?.abort()
    promotionRequestRef.current.id += 1
  }, [])

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.preco || 0) * Number(item.qtd || 0), 0), [cart])
  const promotionFingerprint = useMemo(() => promotionPreviewFingerprint(promotionCode, cart), [promotionCode, cart])
  const promotionConfirmed = Boolean(
    promotionPreview
    && promotionState !== 'applying'
    && promotionPreview.codigo === normalizePromotionCode(promotionCode)
    && promotionPreview.confirmedFingerprint === promotionFingerprint,
  )
  const promotionTotals = promotionConfirmed
    ? promotionPreviewTotals(promotionPreview)
    : { subtotal: cartTotal, desconto: 0, subtotalComDesconto: cartTotal }
  const automaticShippingQuoteKey = shippingQuoteKey({ deliveryMode, address, cart })
  const shippingQuoteIsCurrent = Boolean(shippingQuote && automaticShippingQuoteKey && lastShippingQuoteKeyRef.current === automaticShippingQuoteKey)
  const selectedOption = selectedShippingOption({ deliveryMode, shippingQuote, shippingOptionId, shippingQuoteIsCurrent })
  const total = checkoutTotal(promotionTotals.subtotalComDesconto, selectedOption)
  const pickupOnlyCart = cartHasPickupOnlyItems(cart, products)
  const deliveryAvailable = !pickupOnlyCart && shippingMethods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)
  const pickupAvailable = shippingMethods.some(item => item.tipo === 'pickup')
  const paymentReady = Boolean(order && payment)
  const paymentChoices = useMemo(() => checkoutPaymentChoices(paymentMethods), [paymentMethods])
  // Com o pedido criado, pergunta de novo quais pagamentos valem para ele: "Marcar na conta"
  // só aparece quando o cliente do pedido tem crediário aprovado nesta loja.
  const orderPublicCode = order?.codigo || order?.publicCode || order?.public_code || ''
  useEffect(() => {
    if (!orderPublicCode) return undefined
    let active = true
    api.get(`${storefrontApi}/payment-methods?order=${encodeURIComponent(orderPublicCode)}`)
      .then(result => { if (active && Array.isArray(result?.items)) setPaymentMethods(result.items) })
      .catch(() => {})
    return () => { active = false }
  }, [orderPublicCode, storefrontApi])
  // Se a lista mudar (ex.: "Marcar na conta" passa a valer para este pedido), a escolha
  // atual precisa ser uma das opções mostradas; senão o botão não sabe o que pagar.
  useEffect(() => {
    if (!paymentChoices.length) return
    if (!paymentChoices.some(item => `${item.provider}:${item.method}` === selectedPayment)) setSelectedPayment(`${paymentChoices[0].provider}:${paymentChoices[0].method}`)
  }, [paymentChoices, selectedPayment])
  const selectedPaymentChoice = paymentChoices.find(item => `${item.provider}:${item.method}` === selectedPayment) || null

  useEffect(() => {
    promotionRequestRef.current.controller?.abort()
    promotionRequestRef.current = { id: promotionRequestRef.current.id + 1, controller: null }
    setPromotionPreview(null)
    setPromotionError('')
    setPromotionState(current => current === 'applying' ? 'idle' : current)
  }, [promotionFingerprint])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [context, catalog, shipping, payments] = await Promise.all([
          api.get(`${storefrontApi}/context`),
          api.get(`${storefrontApi}/products`),
          api.get(`${storefrontApi}/shipping-methods`),
          api.get(`${storefrontApi}/payment-methods`),
        ])
        if (!active) return
        setStoreContext(context?.storefront || null)
        const methods = shipping?.items || []
        const methodsPayments = payments?.items || []
        if (!context?.capabilities?.checkout) throw new Error('Checkout não está habilitado para este storefront.')
        setProducts(catalog?.items || [])
        setShippingMethods(methods)
        setPaymentMethods(methodsPayments)
        const initialPaymentChoices = checkoutPaymentChoices(methodsPayments)
        setSelectedPayment(initialPaymentChoices[0] ? `${initialPaymentChoices[0].provider}:${initialPaymentChoices[0].method}` : '')
        const initialShipping = methods.find(item => item.tipo === 'pickup') || methods[0]
        if (initialShipping) {
          setShippingMethodId(initialShipping.id)
          setDeliveryMode(initialShipping.tipo === 'pickup' ? 'retirada' : 'entrega')
        }
        if (orderCode) {
          const existing = await api.get(`${storefrontApi}/orders/${encodeURIComponent(orderCode)}`)
          if (!active) return
          setOrder(existing)
          setForm(current => ({ ...current, nome: existing.customer_name || existing.customer?.nome || '', email: existing.customer_email || existing.customer?.email || '' }))
        }
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar o checkout.')
      } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [orderCode, storefrontApi])

  useEffect(() => {
    if (order) return undefined
    cartSyncControllerRef.current?.abort()
    const controller = new AbortController()
    cartSyncControllerRef.current = controller
    const timer = window.setTimeout(() => {
      const validContact = form.nome.trim().length >= 2 && form.telefone.replace(/\D/g, '').length >= 10
      const consentPayload = recoveryPreference === null ? {} : recoveryPreference === false
        ? { recoveryConsent: false }
        : validContact ? {
            recoveryConsent: true,
            recoverySource: 'checkout_checkbox',
            recoveryEvidence: { checkbox: true, notice: 'Autorizo um único lembrete por WhatsApp sobre este carrinho. Posso revogar respondendo SAIR.', sourcePage: window.location.pathname },
            contact: { name: form.nome.trim(), email: form.email.trim(), phone: form.telefone.trim() },
          } : {}
      api.post(`${storefrontApi}/cart`, { sessionKey: cartSessionKey, syncVersion: nextStorefrontCartSyncVersion(storeAlias), items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })), ...consentPayload }, { signal: controller.signal }).catch(() => {})
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      if (cartSyncControllerRef.current === controller) cartSyncControllerRef.current = null
    }
  }, [cart, cartSessionKey, form.email, form.nome, form.telefone, order, recoveryPreference, storeAlias, storefrontApi])

  useEffect(() => {
    const syncCartFromAnotherTab = event => {
      if (order || event.storageArea !== window.localStorage || event.key !== cartStorageKey) return
      try {
        const nextCart = event.newValue ? JSON.parse(event.newValue) : []
        setCart(Array.isArray(nextCart) ? nextCart : [])
        invalidateShippingQuote()
        setCartAnnouncement('O carrinho foi atualizado em outra aba.')
      } catch { /* valor inválido de outra aba é ignorado */ }
    }
    window.addEventListener('storage', syncCartFromAnotherTab)
    return () => window.removeEventListener('storage', syncCartFromAnotherTab)
  }, [cartStorageKey, order])

  useEffect(() => {
    if (removedCartIndexRef.current === null) return
    const removedIndex = removedCartIndexRef.current
    removedCartIndexRef.current = null
    window.setTimeout(() => {
      if (!cart.length) return emptyCartLinkRef.current?.focus()
      const buttons = document.querySelectorAll('.checkout-remove-item')
      buttons[Math.min(removedIndex, buttons.length - 1)]?.focus()
    }, 0)
  }, [cart])

  useEffect(() => {
    if (!order?.public_code || !returnTransactionNsu || !returnSlug || !checkoutReturnSafety({ orderStatus: order.status, hasPayment: Boolean(payment), hasProviderReturn }).reconcileProviderReturn) return undefined
    let active = true
    const reconcileReturn = async () => {
      setWorking(true); setError(''); setReturnStatus('checking')
      try {
        const result = await api.post(`${storefrontApi}/orders/${encodeURIComponent(order.public_code)}/payments/return`, { transactionNsu: returnTransactionNsu, slug: returnSlug })
        if (!active) return
        setReturnStatus(result.refundRequired ? 'needs_review' : result.status === 'captured' ? 'confirmed' : 'pending')
        if (result.refundRequired) setError('O provedor informou uma captura que precisa de conferência pela loja. Não pague novamente; a equipe verificará possível duplicidade ou estorno.')
        if (result.status === 'captured') {
          const latest = await api.get(`${storefrontApi}/orders/${encodeURIComponent(order.public_code)}`)
          if (active) setOrder(current => current ? { ...current, ...latest } : latest)
        }
      } catch (_err) { if (active) { setReturnStatus('needs_review'); setError('Não foi possível confirmar o pagamento agora. Não pague novamente; acompanhe este pedido ou fale com a loja para conferência.') } }
      finally { if (active) setWorking(false) }
    }
    reconcileReturn()
    return () => { active = false }
  }, [order?.public_code, payment, returnTransactionNsu, returnSlug, storefrontApi])

  useEffect(() => {
    if (hasProviderReturn && returnStatus !== 'needs_review' && checkoutReturnSafety({ orderStatus: order?.status, hasPayment: Boolean(payment), hasProviderReturn }).paid) {
      setError('')
      setReturnStatus('confirmed')
    }
  }, [hasProviderReturn, order?.status, payment, returnStatus])

  useEffect(() => {
    if (!order?.public_code) return undefined
    const poller = createCheckoutOrderPoller({
      load: () => api.get(`${storefrontApi}/orders/${encodeURIComponent(order.public_code)}`),
      apply: latest => setOrder(current => current ? { ...current, ...latest } : latest),
      schedule: window.setTimeout,
      cancelSchedule: window.clearTimeout,
    })
    return () => poller.stop()
  }, [order?.public_code, payment?.paymentId, storefrontApi])

  async function quoteShipping({ quoteKey = '' } = {}) {
    if (!deliveryAvailable) return setError('Esta loja ainda não publicou uma opção de entrega pronta.')
    if (address.cep.replace(/\D/g, '').length !== 8) return setError('Informe um CEP válido antes de calcular o frete.')
    const effectiveQuoteKey = quoteKey || shippingQuoteKey({ deliveryMode, address, cart })
    const requestId = ++shippingQuoteRequestRef.current
    setShippingQuoteLoading(true); setError('')
    try {
      const quote = await api.post(`${storefrontApi}/shipping/quotes/available`, { destinationCep: address.cep, destination: { cep: address.cep, cidade: address.cidade, estado: address.estado }, items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })) })
      if (requestId !== shippingQuoteRequestRef.current) return
      const first = recommendedShippingOption(quote)
      if (!first) throw Object.assign(new Error('Nenhuma opção de frete está disponível para este CEP e carrinho.'), { code: 'SHIPPING_DESTINATION_UNAVAILABLE' })
      setShippingQuote(quote)
      setShippingOptionId(first.selectionId || first.id)
      setShippingMethodId(first.shippingMethodId || '')
      lastShippingQuoteKeyRef.current = effectiveQuoteKey
    } catch (err) {
      if (requestId !== shippingQuoteRequestRef.current) return
      lastShippingQuoteKeyRef.current = effectiveQuoteKey
      setError(checkoutShippingErrorMessage(err, { isDino: isDinoCommerce }))
    } finally {
      if (requestId === shippingQuoteRequestRef.current) setShippingQuoteLoading(false)
    }
  }

  // Carrinho com congelados/refrigerados: troca para retirada quando possível.
  useEffect(() => {
    if (pickupOnlyCart && deliveryMode === 'entrega' && pickupAvailable) chooseDelivery('retirada')
  }, [pickupOnlyCart, deliveryMode, pickupAvailable])

  function chooseDelivery(mode) {
    if (mode === deliveryMode) return
    invalidateShippingQuote()
    postalRequestRef.current.invalidate()
    setAddressLookupLoading(false)
    lastLookupCepRef.current = ''
    setDeliveryMode(mode)
    setShippingMethodId(shippingMethods.find(item => mode === 'retirada'
      ? item.tipo === 'pickup'
      : ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)?.id || '')
  }

  function updateAddress(key, value) {
    setError('')
    const nextValue = key === 'cep' ? formatCep(value) : key === 'estado' ? String(value || '').toUpperCase().slice(0, 2) : value
    const changedCep = key === 'cep' && String(address.cep || '').replace(/\D/g, '') !== String(nextValue || '').replace(/\D/g, '')
    if (changedCep) {
      lastLookupCepRef.current = ''
      postalRequestRef.current.invalidate()
      setAddressLookupLoading(false)
    }
    setAddress(current => {
      if (key !== 'cep') return { ...current, [key]: nextValue }
      const changed = String(current.cep || '').replace(/\D/g, '') !== String(nextValue || '').replace(/\D/g, '')
      return changed ? { ...EMPTY_ADDRESS, cep: nextValue } : { ...current, cep: nextValue }
    })
    if (['cep', 'cidade', 'estado'].includes(key)) {
      invalidateShippingQuote()
    }
  }

  async function lookupCep(value = address.cep, { force = false } = {}) {
    const cep = String(value || '').replace(/\D/g, '')
    if (cep.length !== 8) return setError('Informe um CEP válido antes de consultar.')
    if (!force && lastLookupCepRef.current === cep) return
    lastLookupCepRef.current = cep
    setAddressLookupLoading(true); setError('')
    await postalRequestRef.current.run(
      () => api.get(`${storefrontApi}/shipping/address/${cep}`),
      {
        success: result => {
          setAddress(current => ({ ...current, ...result, cep: formatCep(result.cep || cep) }))
          invalidateShippingQuote()
          addressNumberRef.current?.focus()
        },
        error: err => {
          lastLookupCepRef.current = ''
          setError(err.message || 'Não foi possível consultar o CEP. Complete o endereço manualmente ou tente novamente.')
        },
        settled: () => setAddressLookupLoading(false),
      },
    )
  }

  useEffect(() => {
    if (deliveryMode !== 'entrega') return undefined
    const cep = address.cep.replace(/\D/g, '')
    if (cep.length !== 8 || cep === lastLookupCepRef.current) return undefined
    const timer = window.setTimeout(() => lookupCep(cep), 350)
    return () => window.clearTimeout(timer)
  }, [address.cep, deliveryMode, storefrontApi])

  useEffect(() => {
    if (!automaticShippingQuoteKey || automaticShippingQuoteKey === lastShippingQuoteKeyRef.current || shippingQuoteLoading) return undefined
    const timer = window.setTimeout(() => quoteShipping({ quoteKey: automaticShippingQuoteKey }), 300)
    return () => window.clearTimeout(timer)
  }, [automaticShippingQuoteKey, shippingQuoteLoading])

  async function applyPromotion() {
    const code = normalizePromotionCode(promotionCode)
    if (promotionState === 'applying') return
    promotionRequestRef.current.controller?.abort()
    const requestId = promotionRequestRef.current.id + 1
    const controller = new AbortController()
    const cartSnapshot = cart
    const requestFingerprint = promotionPreviewFingerprint(code, cartSnapshot)
    promotionRequestRef.current = { id: requestId, controller }
    setPromotionPreview(null)
    setPromotionError('')
    setPromotionState('applying')
    try {
      const result = await requestPromotionPreview({ api, storefrontApi, code, cart: cartSnapshot, signal: controller.signal })
      if (requestId !== promotionRequestRef.current.id || controller.signal.aborted) return
      if (promotionPreviewFingerprint(result.codigo, cartSnapshot) !== requestFingerprint) {
        const staleError = new Error('A prévia do cupom ficou desatualizada. Revalide o cupom para continuar.')
        staleError.code = 'PROMOTION_PREVIEW_STALE'
        throw staleError
      }
      setPromotionPreview({ ...result, confirmedFingerprint: requestFingerprint })
      setPromotionState('applied')
    } catch (err) {
      if (requestId !== promotionRequestRef.current.id || err?.name === 'AbortError') return
      setPromotionPreview(null)
      setPromotionState('error')
      setPromotionError(promotionPreviewErrorMessage(err))
    } finally {
      if (requestId === promotionRequestRef.current.id) {
        promotionRequestRef.current.controller = null
        setPromotionState(current => current === 'applying' ? 'idle' : current)
      }
    }
  }

  function removePromotion() {
    promotionRequestRef.current.controller?.abort()
    promotionRequestRef.current = { id: promotionRequestRef.current.id + 1, controller: null }
    setPromotionCode('')
    setPromotionPreview(null)
    setPromotionError('')
    setPromotionState('idle')
  }

  function removeCartItem(item) {
    if (working || order) return
    setError('')
    removedCartIndexRef.current = Math.max(0, cart.findIndex(candidate => candidate.produtoId === item.produtoId && String(candidate.variantId || '') === String(item.variantId || '')))
    invalidateShippingQuote()
    const nextCart = removeStorefrontCartItem(cart, item.produtoId, item.variantId)
    try {
      if (nextCart.length) localStorage.setItem(cartStorageKey, JSON.stringify(nextCart))
      else localStorage.removeItem(cartStorageKey)
    } catch { /* armazenamento local opcional */ }
    clearStorefrontCheckoutIdempotencyKey(storeAlias)
    setOrderIdempotencyKey(storefrontCheckoutIdempotencyKey(storeAlias))
    setCart(nextCart)
    setCartAnnouncement(`${item.nome} foi excluído do carrinho. ${nextCart.length ? `${nextCart.length} item(ns) restante(s).` : 'O carrinho está vazio.'}`)
  }

  async function createOrder(event) {
    event.preventDefault()
    if (orderRequestRef.current || submitting || addressLookupLoading || shippingQuoteLoading) return
    if (loading || !paymentChoices.length) return setError('O pagamento online está temporariamente indisponível. Entre em contato com a loja antes de continuar.')
    setContactReview(null)
    setError('')
    const email = form.email.trim()
    const phone = form.telefone.trim()
    if (!form.nome.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Informe nome e e-mail válidos.')
    if (phone && phone.replace(/\D/g, '').length < 10) return setError('Informe um telefone válido ou deixe este campo em branco.')
    if (normalizePromotionCode(promotionCode) && !promotionConfirmed) {
      setError('Confirme o cupom antes de continuar. A validação precisa ser feita pelo servidor.')
      window.requestAnimationFrame(() => promotionButtonRef.current?.focus())
      return
    }
    if (!shippingMethodId) return setError('A loja ainda não publicou uma forma de entrega.')
    if (deliveryMode === 'entrega' && (!shippingQuoteIsCurrent || !shippingOptionId || !selectedOption)) return setError('Consulte o CEP e recalcule o frete antes de continuar.')
    orderRequestRef.current = true
    setSubmitting(true)
    try {
      const created = await api.post(`${storefrontApi}/orders`, {
        customer: { nome: form.nome.trim(), email, telefone: phone },
        items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
        idempotencyKey: orderIdempotencyKey,
        cartSessionKey,
        shippingAddress: deliveryMode === 'entrega' ? { ...address, destinatario: form.nome.trim(), email, telefone: phone, documento: form.documento } : { modo: 'retirada' },
        shippingMethodId,
        note: note.trim(),
        ...(promotionConfirmed ? { promotionCode: promotionPreview.codigo } : {}),
        ...(deliveryMode === 'entrega' ? { shippingQuoteId: selectedOption.quoteId || shippingQuote?.quoteId, shippingOptionId: selectedOption.id } : {}),
      })
      const code = created.codigo || created.publicCode || created.public_code
      localStorage.removeItem(cartStorageKey)
      clearStorefrontCheckoutIdempotencyKey(storeAlias)
      localStorage.removeItem(storefrontStorageKey(storeAlias, 'cart_session'))
      setCart([])
      setOrder(created)
      navigate(`${checkoutRoute}?order=${encodeURIComponent(code)}`, { replace: true })
    } catch (err) {
      if (['SHIPPING_QUOTE_EXPIRED', 'SHIPPING_QUOTE_MISMATCH', 'SHIPPING_OPTION_INVALID'].includes(err.code)) {
        invalidateShippingQuote()
      }
      if (err.code === 'CHECKOUT_CONTACT_REVIEW') {
        setContactReview({ requestId: checkoutContactReference(err) })
        setError(checkoutContactReviewMessage(err))
        window.requestAnimationFrame(() => contactReviewRef.current?.focus())
        return
      }
      if (isPromotionOrderRevalidationError(err)) {
        setPromotionPreview(null)
        setPromotionState('error')
        setPromotionError(promotionPreviewErrorMessage(err))
        setError(promotionPreviewErrorMessage(err))
        window.requestAnimationFrame(() => promotionButtonRef.current?.focus())
        return
      }
      const shippingError = err.code === 'SHIPPING_QUOTE_MISMATCH'
        ? 'A cotação mudou porque o CEP, endereço ou carrinho foi atualizado. Recalcule o frete para continuar.'
        : err.code === 'SHIPPING_QUOTE_EXPIRED'
          ? 'A cotação expirou. Calcule o frete novamente para continuar.'
          : err.code === 'SHIPPING_OPTION_INVALID'
            ? 'A opção de frete ficou indisponível. Calcule o frete novamente e selecione outra opção.'
            : ''
      setError(shippingError || err.message || 'Não foi possível criar o pedido.')
    } finally { orderRequestRef.current = false; setSubmitting(false) }
  }

  async function sendPhoneCode() {
    setPhoneBusy(true); setError('')
    try {
      const code = order?.codigo || order?.publicCode || order?.public_code
      const result = await api.post(`${storefrontApi}/phone-verification/start`, { order: code, ...(form.telefone ? { phone: form.telefone } : {}) })
      setPhoneEnding(result?.phoneEnding || '')
      setPhoneCodeSent(true)
    } catch (err) { setError(err.message || 'Não foi possível enviar o código.') } finally { setPhoneBusy(false) }
  }

  async function confirmPhoneCode() {
    setPhoneBusy(true); setError('')
    try {
      const orderCode = order?.codigo || order?.publicCode || order?.public_code
      const result = await api.post(`${storefrontApi}/phone-verification/confirm`, { order: orderCode, code: phoneCode })
      setPhoneToken(result?.token || '')
    } catch (err) { setError(err.message || 'Código incorreto.') } finally { setPhoneBusy(false) }
  }

  async function startPayment() {
    if (!order || paymentRequestRef.current) return
    const code = order.codigo || order.publicCode || order.public_code
    const [provider, method] = selectedPayment.split(':')
    if (!provider || !method) return setError('Nenhum método de pagamento está disponível para esta loja.')
    paymentRequestRef.current = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    setWorking(true); setRedirecting(false); setError('')
    try {
      const result = await api.post(`${storefrontApi}/orders/${encodeURIComponent(code)}/payments`, { provider, method, idempotencyKey: paymentIdempotencyKey(code, provider, method, storeAlias), ...(provider === 'crediario' ? { phoneVerificationToken: phoneToken } : {}) }, { signal: controller.signal })
      if (!result || typeof result !== 'object') throw new Error('O Commerce Core não retornou uma resposta válida.')
      const hostedUrl = provider === 'infinitepay' ? hostedPaymentUrl(result.checkout) : ''
      if (provider === 'infinitepay' && !hostedUrl) throw new Error('A InfinitePay não retornou o link do checkout. Tente novamente em instantes.')
      setPayment(result)
      if (hostedUrl) {
        setRedirecting(true)
        window.location.assign(hostedUrl)
      }
    } catch (err) {
      const message = err?.name === 'AbortError' ? 'O gateway demorou para responder. Verifique sua conexão e tente novamente.' : err.message || 'O provedor recusou a criação do pagamento.'
      setError(message)
    } finally {
      window.clearTimeout(timeout)
      paymentRequestRef.current = false
      setWorking(false)
    }
  }

  async function copyCode(value) {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 2200) } catch { setError('Não foi possível copiar o código Pix.') }
  }

  if (loading) return <main className="checkout-page"><div className="checkout-loading"><div className="checkout-spinner" />Carregando checkout seguro…</div></main>

  if (!order && !cart.length) return <main className="checkout-page"><span className="sr-only" role="status" aria-live="polite">{cartAnnouncement}</span><div className="checkout-empty"><div className="checkout-empty-icon">🛒</div><h1>Seu carrinho está vazio</h1><p>Adicione produtos na loja para iniciar o checkout.</p><Link ref={emptyCartLinkRef} className="checkout-primary" to={storeRoute}>Voltar para a loja</Link></div></main>

  if (order) {
    const code = order.codigo || order.publicCode || order.public_code
    const checkout = payment?.checkout || {}
    const pixCode = checkout.qrCode || checkout.qr_code || null
    const qr = checkout.qrCodeBase64 || checkout.qr_code_base64 || null
    const hostedUrl = checkout.url || checkout.link || checkout.checkoutUrl || checkout.ticketUrl || null
    const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : []
    const latestFulfillment = fulfillments[0] || null
    const shippingOption = order.shippingOption || order.shipping_option || null
    const timeline = Array.isArray(order.timeline) ? order.timeline : []
    const fulfillmentLabels = { pending: 'Aguardando preparação', preparing: 'Em separação', ready: 'Pronto para envio', shipped: 'Enviado', out_for_delivery: 'Em rota de entrega', delivered: 'Entregue', picked_up: 'Retirado', failed: 'Falha na entrega', cancelled: 'Entrega cancelada' }
    const orderStatusLabels = { pending_payment: 'Aguardando pagamento', payment_failed: 'Pagamento recusado', paid: 'Pagamento confirmado', processing: 'Em preparação', ready: 'Pronto para envio', shipped: 'Enviado', delivered: 'Entregue', completed: 'Concluído', cancelled: 'Cancelado' }
    // O status do pedido manda: pagamento que chegou depois de cancelado/expirado não
    // reabre o pedido e vai para estorno, então não mostramos "Pagamento confirmado".
    const orderStatus = String(order.status || '').toLowerCase()
    const lateCaptureReview = hasLateCaptureReview(order)
    // Qualquer status depois de "aguardando pagamento" (pago, em preparação, pronto para
    // retirada, retirado, em análise…) já tem pagamento: não oferece pagar de novo.
    const { closed, paid, verifyingProviderReturn, showNewPayment, showExistingPayment } = checkoutReturnSafety({
      orderStatus, paymentStatus: order.payment_status || payment?.status, hasPayment: Boolean(payment), hasProviderReturn,
    })
    return <main className="checkout-result-shell"><div className="checkout-result-card">
      <div className="checkout-result-icon">{closed ? <ShieldCheck size={30} /> : <CheckCircle2 size={30} />}</div>
      <span className="eyebrow">Pedido {code}</span>
      <h1>{closed ? (orderStatus === 'payment_failed' ? 'Pagamento não aprovado' : 'Pedido cancelado') : paid ? 'Pagamento confirmado' : verifyingProviderReturn ? 'Verificando pagamento' : payment ? 'Pagamento iniciado' : 'Pedido criado'}</h1>
      <p className="checkout-result-lead">{lateCaptureReview ? LATE_CAPTURE_COPY.detail : closed ? 'Este pedido não aceita mais pagamento. Se houve cobrança, a loja precisa confirmar com o provedor e orientar sobre possível estorno. Não pague novamente.' : paid ? 'O pagamento foi confirmado pelo provedor e o pedido seguirá para preparação.' : verifyingProviderReturn ? 'A confirmação pela InfinitePay ainda está em verificação. Não faça outro pagamento. Acompanhe as atualizações do pedido abaixo.' : payment ? 'Conclua o pagamento no provedor. O status será atualizado automaticamente.' : 'Escolha um método para concluir o pagamento com segurança.'}</p>
      {lateCaptureReview && <div className="checkout-payment-box" role="status"><strong>{LATE_CAPTURE_COPY.title}</strong><small>{LATE_CAPTURE_COPY.payment}. {LATE_CAPTURE_COPY.delivery}</small></div>}
      {error && <div className="checkout-form-error" role="alert">{error}</div>}
      {verifyingProviderReturn && <div className="checkout-payment-box" role="status"><strong>{returnStatus === 'needs_review' ? 'Conferência necessária' : 'Aguardando confirmação do provedor'}</strong><small>Este pedido continua em acompanhamento. O comprovante apresentado não altera o status automaticamente; a loja confirmará o pagamento com a InfinitePay. Não abra um novo checkout nem pague novamente.</small></div>}
      {showNewPayment && <div className="checkout-payment-box"><strong>Como deseja continuar?</strong>{paymentChoices.length ? paymentChoices.map(item => { const value = `${item.provider}:${item.method}`; const copy = <span className="payment-option-copy"><strong>{paymentLabel(item)}</strong><small>{paymentDescription(item)}</small>{item.provider === 'infinitepay' && <span className="payment-provider-badges">{item.captureMethods.map(method => <span key={method}>{method === 'credit_card' ? 'Cartão' : 'Pix'}</span>)}</span>}</span>; return paymentChoices.length === 1 ? <div key={value} className="payment-option payment-provider-option is-selected"><span className="payment-option-radio" aria-hidden="true">✓</span>{copy}</div> : <label key={value} className={`payment-option ${selectedPayment === value ? 'is-selected' : ''}`}><input type="radio" name="payment" value={value} checked={selectedPayment === value} onChange={() => setSelectedPayment(value)} />{copy}</label> }) : <small>Nenhum provedor de pagamento está publicado para esta loja.</small>}{selectedPaymentChoice?.provider === 'crediario' && <div className="checkout-phone-verify">{phoneToken ? <small>WhatsApp confirmado.</small> : <><small>Para marcar na conta, confirme o WhatsApp do pedido{phoneEnding ? ` (final ${phoneEnding})` : form.telefone ? ` (final ${form.telefone.replace(/\D/g, '').slice(-4)})` : ''} com o código que vamos enviar.</small>{!phoneCodeSent ? <button type="button" className="checkout-secondary" onClick={sendPhoneCode} disabled={phoneBusy}>{phoneBusy ? 'Enviando…' : 'Enviar código pelo WhatsApp'}</button> : <div className="checkout-inline-field"><input value={phoneCode} onChange={e => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 números" aria-label="Código recebido no WhatsApp" /><button type="button" className="checkout-secondary" onClick={confirmPhoneCode} disabled={phoneBusy || phoneCode.length !== 6}>{phoneBusy ? 'Conferindo…' : 'Confirmar'}</button></div>}</>}</div>}<button type="button" className="checkout-primary" onClick={startPayment} disabled={working || redirecting || !paymentChoices.length || (selectedPaymentChoice?.provider === 'crediario' && !phoneToken)}>{redirecting ? 'Abrindo checkout seguro…' : working ? 'Preparando pagamento…' : selectedPaymentChoice?.provider === 'infinitepay' ? 'Continuar na InfinitePay' : selectedPaymentChoice?.provider === 'crediario' ? 'Marcar na conta' : 'Iniciar pagamento'}</button><small className="checkout-payment-helper">{selectedPaymentChoice?.provider === 'infinitepay' ? 'Na próxima tela, escolha Pix ou cartão uma única vez. Nenhum dado de cartão passa pela Kytto.' : selectedPaymentChoice?.provider === 'crediario' ? 'O valor entra no seu crediário com a loja, com o prazo combinado.' : 'O pagamento será processado pelo provedor publicado para esta loja.'}</small></div>}
      {showExistingPayment && <div className="checkout-payment-box"><strong>Pagamento pendente</strong>{qr && <img className="checkout-qr" src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code do pagamento" />}{pixCode && <div className="checkout-pix-box"><label>Código Pix</label><textarea readOnly rows={4} value={pixCode} aria-label="Código Pix" /><button type="button" className="checkout-primary" onClick={() => copyCode(pixCode)}><Copy size={15} />{copied ? 'Código copiado' : 'Copiar código'}</button></div>}{hostedUrl && <a className="checkout-primary" href={hostedUrl} target="_blank" rel="noreferrer">Abrir checkout do provedor <ArrowRight size={16} /></a>}{!qr && !pixCode && !hostedUrl && <small>O provedor recebeu a solicitação, mas ainda não retornou uma instrução pública de pagamento. Aguarde o webhook ou consulte o pedido.</small>}<small>Status: {payment.status || order.payment_status || 'pending'}.</small></div>}
      <section className="checkout-tracking-panel" aria-label="Acompanhamento da entrega"><div className="checkout-tracking-heading"><div><span className="eyebrow"><PackageCheck size={14} /> Pós-venda</span><h2>Acompanhe seu pedido</h2></div><span className="checkout-status-pill">{orderStatusLabels[order.status] || order.status || 'Em atualização'}</span></div>{latestFulfillment ? <><div className="checkout-tracking-summary"><div><Truck size={17} /><span><strong>{fulfillmentLabels[latestFulfillment.status] || latestFulfillment.status}</strong><small>{latestFulfillment.carrier || 'Logística da loja'}</small></span></div>{latestFulfillment.trackingCode && <div><MapPin size={17} /><span><strong>{latestFulfillment.trackingCode}</strong><small>Código de rastreio</small></span></div>}{shippingOption?.deliveryDays !== null && shippingOption?.deliveryDays !== undefined && <div><PackageCheck size={17} /><span><strong>Prazo total estimado</strong><small>{shippingPromise(shippingOption)}</small>{shippingPriceSummary(shippingOption) && <small className="checkout-shipping-price-note">{shippingPriceSummary(shippingOption)}</small>}</span></div>}</div>{latestFulfillment.trackingUrl && <a className="checkout-tracking-link" href={latestFulfillment.trackingUrl} target="_blank" rel="noreferrer">Acompanhar no site da transportadora <ArrowRight size={15} /></a>}{Array.isArray(latestFulfillment.ocorrencias) && latestFulfillment.ocorrencias.length > 0 && <div className="checkout-tracking-events">{latestFulfillment.ocorrencias.slice(0, 5).map((event, index) => <div key={`${event.at || event.data || index}-${index}`}><span>{event.at || event.data || 'Atualização'}</span><strong>{event.description || event.descricao || event.status || event.mensagem || 'Movimentação registrada'}</strong></div>)}</div>}</> : <div className="checkout-tracking-empty"><PackageCheck size={18} /><span>{closed ? 'Este pedido foi encerrado sem entrega. Se houve cobrança, a equipe precisa conferir o pagamento e orientar os próximos passos.' : 'Após a confirmação do pagamento, a loja separará o pedido e disponibilizará o rastreio nesta área.'}</span></div>}{!closed && !latestFulfillment && shippingOption?.deliveryDays !== null && shippingOption?.deliveryDays !== undefined && <div className="checkout-tracking-eta"><PackageCheck size={17} /><span><strong>Prazo total estimado</strong><small>{shippingPromise(shippingOption)}</small>{shippingPriceSummary(shippingOption) && <small className="checkout-shipping-price-note">{shippingPriceSummary(shippingOption)}</small>}</span></div>}{timeline.length > 0 && <div className="checkout-order-timeline">{timeline.slice(-6).map((event, index) => <div key={`${event.at || index}-${index}`}><span>{event.at ? new Date(event.at).toLocaleString('pt-BR') : 'Atualização'}</span><strong>{orderStatusLabels[event.toStatus] || event.toStatus || 'Atualização do pedido'}</strong><small>{event.source === 'system' ? 'Sistema' : event.source || 'Operação'}</small></div>)}</div>}</section>
      <div className="checkout-result-meta"><div><span>Total</span><strong>{money(order.total || total)}</strong></div><div><span>Pedido</span><strong>{code}</strong></div></div>
      <div className="checkout-result-actions"><Link className="checkout-primary" to={`${orderRoute}/${encodeURIComponent(code)}`}>Acompanhar pedido <ArrowRight size={16} /></Link><Link className="checkout-secondary" to={storeRoute}>Voltar para a loja</Link></div>
    </div></main>
  }

  const publicBrand = storeContext?.public || {}
  const brandName = commerceDisplayName(storeAlias, publicBrand.displayName, storeContext?.nome)
  const brandMark = storeAlias === 'stallone' || isStalloneBrandContext(storeContext, storeContext?.configuracao?.public) ? 'S' : 'K'
  const contactSupport = contactReview ? checkoutContactSupportAction(publicBrand.contact, contactReview) : null
  const shippingSupport = isDinoCommerce && error === DINO_DELIVERY_UNAVAILABLE ? checkoutShippingSupportAction(publicBrand.contact) : null

  return <main className="checkout-page">
    <span className="sr-only" role="status" aria-live="polite">{cartAnnouncement}</span>
    <header className="checkout-header"><div className="checkout-header-inner"><Link className={`checkout-brand${isDinoCommerce ? ' checkout-brand-dino-commerce' : ''}`} to={storeRoute} aria-label={`Voltar para ${brandName}`}>{isDinoCommerce ? <img className="checkout-brand-logo" src={DINO_COMMERCE_LOGO} alt="Dino Perfumaria" /> : isStalloneCommerce ? <><img className="checkout-brand-logo stallone-logo-on-dark" src={STALLONE_LOGO} alt="Stallone Nutre Sport" /><img className="checkout-brand-logo stallone-logo-on-light" src={STALLONE_LOGO_LIGHT} alt="" aria-hidden="true" /></> : <><span className="checkout-brand-mark">{brandMark}</span><span>{brandName}</span></>}</Link><div className="checkout-header-security"><ShieldCheck size={16} /> Checkout protegido</div></div></header>
    <div className="checkout-content"><div className="checkout-main-column"><Link className="checkout-back" to={storeRoute}> <ArrowLeft size={14} /> Voltar para a loja</Link><Stepper paymentReady={false} /><section className="checkout-card"><div className="checkout-card-title"><div><span className="eyebrow">Compra segura</span><h1>Finalize sua compra</h1><p>Preencha seus dados, escolha como receber e siga para o pagamento seguro.</p></div><span className="checkout-card-icon"><Store size={20} /></span></div>
      <form onSubmit={createOrder}>
        <div className="checkout-form-grid"><label className="checkout-field"><span>Nome completo *</span><input name="name" value={form.nome} onChange={e => setForm(current => ({ ...current, nome: e.target.value }))} autoComplete="name" required /></label><label className="checkout-field"><span>E-mail *</span><input name="email" spellCheck={false} ref={emailRef} type="email" value={form.email} onChange={e => { setForm(current => ({ ...current, email: e.target.value })); if (contactReview) { setContactReview(null); setError('') } }} autoComplete="email" required /></label><label className="checkout-field"><span>WhatsApp ou telefone</span><input name="phone" type="tel" value={form.telefone} onChange={e => { setForm(current => ({ ...current, telefone: e.target.value })); if (contactReview) { setContactReview(null); setError('') } }} autoComplete="tel" inputMode="tel" aria-describedby="checkout-phone-help" /><small id="checkout-phone-help" className={form.telefone.trim() && form.telefone.replace(/\D/g, '').length < 10 ? 'checkout-error' : ''}>{form.telefone.trim() && form.telefone.replace(/\D/g, '').length < 10 ? 'Informe ao menos 10 dígitos ou deixe o campo em branco.' : 'Opcional.'}</small></label><div className="checkout-field checkout-promotion-field"><span>Cupom de desconto</span><div className="checkout-promotion-control"><input aria-label="Cupom de desconto" value={promotionCode} onChange={e => { setPromotionCode(e.target.value.toUpperCase()); setError('') }} autoComplete="off" name="coupon" spellCheck={false} placeholder="Digite seu cupom…" /><button type="button" className="checkout-secondary" onClick={applyPromotion} ref={promotionButtonRef} disabled={promotionState === 'applying' || !promotionCode.trim() || !cart.length}>{promotionState === 'applying' ? 'Validando…' : promotionConfirmed ? 'Cupom aplicado' : promotionState === 'error' ? 'Revalidar cupom' : 'Aplicar cupom'}</button></div>{promotionState === 'applying' && <small className="checkout-promotion-feedback is-applying" role="status" aria-live="polite">Validando cupom no servidor…</small>}{promotionConfirmed && <div className="checkout-promotion-actions"><small className="checkout-promotion-feedback is-applied" role="status" aria-live="polite">Cupom aplicado</small><button type="button" className="checkout-promotion-remove" onClick={removePromotion}>Remover cupom</button></div>}{promotionError && <small className="checkout-promotion-feedback is-error" role="alert">{promotionError}</small>}</div></div>
        <label className="checkout-recovery-consent"><input type="checkbox" checked={recoveryPreference === true} onChange={event => setRecoveryPreference(event.target.checked)} /><span><strong>Lembrar meu carrinho por WhatsApp</strong><small>Opcional. Autorizo um único lembrete sobre este carrinho. Posso revogar desmarcando ou respondendo SAIR.</small></span></label>
        <div className="checkout-info-banner"><ShieldCheck size={18} /><div><strong>Pagamento seguro.</strong><br />Os dados do cartão são preenchidos diretamente no ambiente do provedor de pagamento.</div></div>
        <div className="checkout-address"><div className="checkout-address-heading"><h2>Como receber</h2><span>Escolha uma opção publicada</span></div><div className="shipping-options">{pickupAvailable && <button type="button" className={`shipping-option ${deliveryMode === 'retirada' ? 'is-selected' : ''}`} onClick={() => chooseDelivery('retirada')}><span className="shipping-option-radio">{deliveryMode === 'retirada' ? '✓' : ''}</span><span className="shipping-option-copy"><strong>Retirada no local</strong><small>Confirme com a operação da loja.</small></span><b>Grátis</b></button>}{deliveryAvailable && <button type="button" className={`shipping-option ${deliveryMode === 'entrega' ? 'is-selected' : ''}`} onClick={() => chooseDelivery('entrega')}><span className="shipping-option-radio">{deliveryMode === 'entrega' ? '✓' : ''}</span><span className="shipping-option-copy"><strong>Entrega</strong><small>Disponibilidade, valor e prazo dependem da cobertura publicada para o CEP.</small></span><b>{selectedOption ? money(selectedOption.amount) : 'Consultar'}</b></button>}</div>{pickupOnlyCart && <p className="checkout-pickup-only" role="status">{PICKUP_ONLY_NOTE}</p>}</div>
        {deliveryMode === 'entrega' && <div className="checkout-address"><div className="checkout-form-grid"><label className="checkout-field"><span>CPF ou CNPJ do destinatário *</span><input value={form.documento} onChange={e => setForm(current => ({ ...current, documento: e.target.value }))} inputMode="numeric" autoComplete="off" required /></label><label className="checkout-field"><span>CEP *</span><div className="checkout-inline-field"><input value={address.cep} onChange={e => updateAddress('cep', e.target.value)} onBlur={() => address.cep.replace(/\D/g, '').length === 8 && lookupCep()} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" required /><button type="button" className="checkout-secondary" onClick={() => lookupCep(address.cep, { force: true })} disabled={addressLookupLoading}>{addressLookupLoading ? 'Consultando…' : 'Consultar CEP'}</button></div></label><label className="checkout-field"><span>Número *</span><input ref={addressNumberRef} value={address.numero} onChange={e => updateAddress('numero', e.target.value)} required /></label><label className="checkout-field"><span>Complemento</span><input name="addressComplement" value={address.complemento} onChange={e => updateAddress('complemento', e.target.value)} autoComplete="address-line2" maxLength={120} placeholder="Apartamento, bloco ou sala…" /></label><label className="checkout-field"><span>Ponto de referência</span><input name="addressReference" value={address.referencia} onChange={e => updateAddress('referencia', e.target.value)} autoComplete="off" maxLength={240} placeholder="Uma referência para encontrar o local…" /></label><label className="checkout-field"><span>Logradouro *</span><input value={address.logradouro} onChange={e => updateAddress('logradouro', e.target.value)} required /></label><label className="checkout-field"><span>Bairro *</span><input value={address.bairro} onChange={e => updateAddress('bairro', e.target.value)} required /></label><label className="checkout-field"><span>Cidade *</span><input value={address.cidade} onChange={e => updateAddress('cidade', e.target.value)} required /></label><label className="checkout-field"><span>UF *</span><input value={address.estado} onChange={e => updateAddress('estado', e.target.value.toUpperCase())} maxLength={2} required /></label></div><button type="button" className="checkout-secondary" onClick={quoteShipping} disabled={shippingQuoteLoading}>{shippingQuoteLoading ? 'Calculando…' : 'Calcular frete'}</button>{shippingQuote?.items?.map(option => { const selectionId = option.selectionId || option.id; return <label className="commerce-shipping-option" key={selectionId}><input type="radio" name="shippingOption" checked={shippingOptionId === selectionId} onChange={() => { setShippingOptionId(selectionId); setShippingMethodId(option.shippingMethodId || shippingMethodId) }} /><span><strong>{option.name}</strong><small>{shippingPromise(option)}</small>{shippingPriceSummary(option) && <small className="checkout-shipping-price-note">{shippingPriceSummary(option)}</small>}</span><b>{money(option.amount)}</b></label> })}</div>}
        <label className="checkout-field"><span>Observação</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Preferências ou instruções para a loja" /></label>
        {!paymentChoices.length && <div className="checkout-form-error" role="status"><strong>Pagamento online indisponível.</strong> Nenhum método está disponível neste momento. Seu carrinho permanece salvo; entre em contato com a loja antes de continuar.</div>}
        {error && <div ref={contactReview ? contactReviewRef : null} tabIndex={contactReview ? -1 : undefined} className="checkout-form-error" role="alert">{error}{contactReview && <div className="checkout-contact-actions"><button type="button" className="checkout-contact-action" onClick={() => emailRef.current?.focus()}>Revisar e-mail e telefone</button>{contactSupport && <a className="checkout-contact-action" href={contactSupport.href}>{contactSupport.label}</a>}</div>}{shippingSupport && <div className="checkout-contact-actions"><a className="checkout-contact-action" href={shippingSupport.href}>{shippingSupport.label}</a></div>}</div>}<div className="checkout-actions"><span>{deliveryMode === 'entrega' && selectedOption ? `Frete de ${money(selectedOption.amount)} incluído. Estoque e total serão revalidados no servidor.` : 'Estoque e valor serão revalidados no servidor.'}</span><button type="submit" className="checkout-primary checkout-primary-large" disabled={loading || !paymentChoices.length || submitting || addressLookupLoading || shippingQuoteLoading || !cart.length || (deliveryMode === 'entrega' && !selectedOption)}>{submitting ? <><Loader2 className="commerce-spin" size={16} /> Criando pedido…</> : shippingQuoteLoading ? 'Aguardando cálculo do frete…' : <>Continuar para pagamento <ArrowRight size={16} /></>}</button></div>
      </form></section></div><aside className="checkout-summary"><div className="checkout-summary-heading"><div><span className="eyebrow">Seu pedido</span><h2>Resumo da compra</h2></div><span className="checkout-secure">Seguro</span></div><div className="checkout-summary-items">{cart.map(item => <div className="checkout-summary-item" key={`${item.produtoId}-${item.variantId || 'base'}`}><ProductThumb item={item} /><div className="checkout-summary-item-copy"><strong>{item.nome}</strong><span>{item.qtd} unidade(s)</span></div><div className="checkout-summary-item-actions"><b>{money(item.qtd * item.preco)}</b><button type="button" className="checkout-remove-item" onClick={() => removeCartItem(item)} disabled={working || submitting || addressLookupLoading || shippingQuoteLoading} aria-label={`Excluir ${item.nome} do carrinho`} title="Excluir item do carrinho"><Trash2 size={14} aria-hidden="true" /><span>Excluir</span></button></div></div>)}</div><div className="checkout-totals"><div><span>Subtotal</span><b>{money(promotionTotals.subtotal)}</b></div>{promotionConfirmed && <div className="checkout-discount"><span>Desconto</span><b>{money(-promotionTotals.desconto)}</b></div>}{selectedOption && <div><span>Entrega</span><b>{money(selectedOption.amount)}</b></div>}<div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div></div><div className="checkout-trust-list"><span>✓ Disponibilidade confirmada ao finalizar</span><span>✓ Pagamento em ambiente seguro</span><span>✓ Acompanhe seu pedido pelo código</span></div></aside></div>
  </main>
}
