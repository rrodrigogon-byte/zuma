import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Minus, Plus, Search, ShoppingBag, Store, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import './commerce.css'

const CART_KEY = 'kytto_commerce_cart'
const DELIVERY_KEY = 'kytto_commerce_delivery'

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
}

function money(value) { return fmtR(Number(value || 0)) }
function checkoutKey() { return `kytto-${Date.now()}-${Math.random().toString(36).slice(2,10)}` }
function paymentKey(item) { return `${item?.provider || ''}:${item?.method || ''}` }
function paymentLabel(item) { return item?.method === 'credit_card' ? 'Cartão de crédito' : item?.method === 'pix' ? 'Pix' : item?.method || 'Pagamento online' }
function shippingOptionMeta(option) {
  const carrier = option?.carrier || 'Transportadora'
  const totalDays = option?.deliveryRange?.max ?? option?.deliveryDays
  const timing = option?.preparationDays !== null && option?.preparationDays !== undefined && option?.providerDeliveryDays !== null && option?.providerDeliveryDays !== undefined && totalDays !== null && totalDays !== undefined
    ? `${carrier} · ${option.preparationDays} dias úteis de preparação/postagem + ${option.providerDeliveryDays} dias úteis de transporte · total: ${totalDays} dias úteis`
    : `${carrier}${totalDays ? ` · até ${totalDays} dias úteis` : ''}`
  const base = Number(option?.providerAmount)
  const surcharge = Number(option?.surchargeAmount)
  const total = Number(option?.amount)
  return Number.isFinite(base) && Number.isFinite(surcharge) && Number.isFinite(total)
    ? `${timing} · Tarifa Correios ${money(base)} + 12% (${money(surcharge)}) = ${money(total)}`
    : timing
}

function productMedia(product) {
  const media = Array.isArray(product?.media) ? product.media : []
  return media.filter(item => item?.url).map((item, index) => ({
    id: item.id || item.url || `media-${index}`,
    url: item.url,
    altText: item.altText || product?.nome || 'Imagem do produto',
    ordem: Number(item.ordem || 0),
  })).sort((a, b) => a.ordem - b.ordem)
}

function normalizeCatalog(data, source) {
  const items = Array.isArray(data) ? data : data?.items || []
  if (source === 'legacy') return items
  return items.map(product => {
    const media = productMedia(product)
    const primaryMedia = media[0]?.url || ''
    const variants = (product.variants || []).map((variant, index) => {
      const price = variant.prices?.[0] || {}
      const effective = Number(price.precoPromocional ?? price.preco ?? 0)
      const original = Number(price.preco ?? effective)
      return {
        variantId: variant.id,
        cod: variant.sku || '',
        label: variant.nome || variant.sku || `Opção ${index + 1}`,
        preco: effective,
        precoOriginal: original,
        precoPromocional: price.precoPromocional ?? null,
        promocaoAtiva: effective < original,
        estoque: Number(variant.estoque || 0),
        esgotado: Number(variant.estoque || 0) <= 0,
      }
    })
    const primary = variants[0] || { variantId: null, cod: '', preco: 0, precoOriginal: 0, precoPromocional: null, promocaoAtiva: false, estoque: 0, esgotado: true }
    return {
      id: product.id,
      variantId: primary.variantId,
      cod: primary.cod,
      nome: product.nome,
      cat: product.category_name || 'Produto',
      descricao: product.descricao_curta || product.descricao || '',
      descricaoDetalhada: product.descricao || '',
      imagem: primaryMedia,
      media,
      ...primary,
      variants,
      emoji: '▦',
    }
  })
}

function selectedProductVariant(product, variantId) {
  const variant = product?.variants?.find(item => item.variantId === variantId) || product?.variants?.[0]
  return variant ? { ...product, ...variant, id: product.id, nome: product.nome, cat: product.cat, descricao: product.descricao, descricaoDetalhada: product.descricaoDetalhada, imagem: product.imagem, media: product.media } : product
}

function availableStock(product, variantId) {
  return Math.max(0, Number(selectedProductVariant(product, variantId)?.estoque || 0))
}

function ProductImage({ product, large = false, mediaUrl = '' }) {
  const image = mediaUrl || product?.imagem || productMedia(product)[0]?.url || ''
  const alt = productMedia(product).find(item => item.url === image)?.altText || product?.nome || 'Produto'
  return image
    ? <img src={image} alt={alt} loading={large ? 'eager' : 'lazy'} decoding="async" className={`commerce-product-image ${large ? 'is-large' : ''}`} />
    : <div className={`commerce-product-placeholder ${large ? 'is-large' : ''}`} aria-hidden="true">{product?.emoji || '▦'}</div>
}

function ProductGallery({ product }) {
  const media = productMedia(product)
  const items = media.length ? media : (product?.imagem ? [{ id: product.imagem, url: product.imagem, altText: product.nome || 'Produto', ordem: 0 }] : [])
  const [activeId, setActiveId] = useState(items[0]?.id || '')
  useEffect(() => { setActiveId(items[0]?.id || '') }, [product?.id])
  const active = items.find(item => item.id === activeId) || items[0]
  return <div className="commerce-product-gallery">
    <div className="commerce-product-gallery-main"><ProductImage product={product} large mediaUrl={active?.url || ''} /></div>
    {items.length > 1 && <div className="commerce-product-gallery-thumbs" role="list" aria-label="Imagens do produto">{items.map(item => <button type="button" key={item.id} className={`commerce-product-gallery-thumb ${active?.id === item.id ? 'is-active' : ''}`} onClick={() => setActiveId(item.id)} aria-label={`Ver imagem ${items.indexOf(item) + 1} de ${items.length}`} aria-pressed={active?.id === item.id}><img src={item.url} alt="" loading="lazy" decoding="async" /></button>)}</div>}
    {items.length > 1 && <small className="commerce-product-gallery-count">{items.indexOf(active) + 1} de {items.length} imagens</small>}
  </div>
}

function QuantityControl({ value, onChange, max }) {
  return <div className="commerce-quantity" aria-label="Quantidade">
    <button type="button" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus size={14} /></button>
    <strong>{value}</strong>
    <button type="button" aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></button>
  </div>
}

export default function Ecommerce() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [cart, setCart] = useState(readCart)
  const [selected, setSelected] = useState(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [order, setOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutIdempotency, setCheckoutIdempotency] = useState(checkoutKey)
  const [catalogSource, setCatalogSource] = useState('detecting')
  const [delivery, setDelivery] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DELIVERY_KEY) || '{"mode":"retirada"}') } catch { return { mode: 'retirada' } }
  })
  const [shippingMethods, setShippingMethods] = useState([])
  const [shippingMethodId, setShippingMethodId] = useState('')
  const [shippingAddress, setShippingAddress] = useState({ destinatario: '', email: '', telefone: '', documento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' })
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [shippingQuote, setShippingQuote] = useState(null)
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false)
  const [shippingOptionId, setShippingOptionId] = useState('')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingOrder, setTrackingOrder] = useState(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingError, setTrackingError] = useState('')

  useEffect(() => {
    api.get('/api/storefront/context')
      .then(() => Promise.all([api.get('/api/storefront/products'), api.get('/api/storefront/shipping-methods'), api.get('/api/storefront/payment-methods').catch(() => ({ items: [] }))]).then(([data, shipping, payments]) => { setCatalogSource('core'); setProducts(normalizeCatalog(data, 'core')); const methods = shipping?.items || []; setShippingMethods(methods); const hasReadyDelivery = methods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled); const effectiveMode = delivery.mode === 'entrega' && !hasReadyDelivery ? 'retirada' : delivery.mode; if (effectiveMode !== delivery.mode) setDelivery({ mode: effectiveMode }); setShippingMethodId(methods.find(item => (effectiveMode === 'entrega' ? ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled : item.tipo === 'pickup'))?.id || ''); const availablePayments = payments?.items || []; setPaymentMethods(availablePayments); setSelectedPaymentMethod(current => current || paymentKey(availablePayments.find(item => item.method === 'pix') || availablePayments[0] || {})) }))
      .catch(err => {
        if (err.status !== 404) throw err
        return api.get('/api/loja').then(data => { setCatalogSource('legacy'); setProducts(normalizeCatalog(data, 'legacy')) })
      })
      .catch(err => setError(err.message || 'Não foi possível carregar o catálogo.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem(DELIVERY_KEY, JSON.stringify(delivery)), [delivery])
  useEffect(() => {
    if (!products.length) return
    setCart(previous => previous.map(item => {
      const current = products.find(product => product.id === item.produtoId)
      const available = availableStock(current, item.variantId)
      return current && available > 0 ? { ...item, qtd: Math.min(item.qtd, available) } : null
    }).filter(Boolean))
  }, [products])

  const categories = useMemo(() => ['Todos', ...new Set(products.map(item => item.cat).filter(Boolean))], [products])
  const filtered = useMemo(() => products.filter(product => {
    const text = `${product.nome} ${product.descricao || ''} ${product.cod || ''}`.toLowerCase()
    return (category === 'Todos' || product.cat === category) && (!query.trim() || text.includes(query.trim().toLowerCase()))
  }), [products, query, category])
  const cartCount = cart.reduce((sum, item) => sum + item.qtd, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.qtd * Number(item.preco || 0), 0)
  const pickupAvailable = catalogSource !== 'core' || shippingMethods.some(item => item.tipo === 'pickup')
  const deliveryAvailable = catalogSource !== 'core' || shippingMethods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)
  const selectedShippingMethod = shippingMethods.find(item => item.id === shippingMethodId)
  const selectedShippingOption = shippingQuote?.items?.find(item => item.id === shippingOptionId)
  const checkoutTotal = cartTotal + Number(selectedShippingOption?.amount || 0)
  const selectedVariant = selectedProductVariant(selected, selectedVariantId)
  const requiredShippingTypes = delivery.mode === 'entrega' ? ['delivery', 'carrier'] : ['pickup']
  const quoteBlocked = catalogSource === 'core' && delivery.mode === 'entrega' && (!selectedShippingMethod?.quoteEnabled || !shippingQuote || !shippingOptionId)
  const checkoutBlocked = catalogSource === 'core' && (!shippingMethods.length || !shippingMethodId || !requiredShippingTypes.includes(selectedShippingMethod?.tipo) || quoteBlocked)

  function chooseDelivery(mode) {
    setDelivery(mode === 'entrega' ? { mode, endereco: delivery.endereco || '' } : { mode })
    setShippingQuote(null)
    setShippingOptionId('')
    if (catalogSource === 'core') { setShippingMethodId(shippingMethods.find(item => (mode === 'entrega' ? ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled : item.tipo === 'pickup'))?.id || ''); setShippingQuote(null); setShippingOptionId('') }
  }

  function changeShippingAddress(field, value) {
    setShippingAddress(current => ({ ...current, [field]: value }))
    if (field === 'cep') { setShippingQuote(null); setShippingOptionId('') }
  }

  async function lookupCep() {
    const cep = shippingAddress.cep.replace(/\D/g, '')
    if (cep.length !== 8) return setCheckoutError('Informe um CEP com 8 dígitos.')
    setAddressLookupLoading(true)
    setCheckoutError('')
    try {
      const address = await api.get(`/api/storefront/shipping/address/${cep}`)
      setShippingAddress(current => ({ ...current, ...address, cep: address.cep?.replace(/\D/g, '') || cep }))
      setShippingQuote(null)
      setShippingOptionId('')
    } catch (err) { setCheckoutError(err.message || 'Não foi possível consultar o CEP.') }
    finally { setAddressLookupLoading(false) }
  }

  async function requestShippingQuote() {
    if (catalogSource !== 'core') return
    if (!selectedShippingMethod?.quoteEnabled) return setCheckoutError('Esta forma de entrega ainda não possui uma conta logística pronta.')
    if (shippingAddress.cep.replace(/\D/g, '').length !== 8) return setCheckoutError('Consulte um CEP válido antes de calcular o frete.')
    setShippingQuoteLoading(true)
    setCheckoutError('')
    try {
      const quote = await api.post('/api/storefront/shipping/quotes', { shippingMethodId, destinationCep: shippingAddress.cep, items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })) })
      setShippingQuote(quote)
      setShippingOptionId(quote.items?.[0]?.id || '')
    } catch (err) { setCheckoutError(err.message || 'Não foi possível calcular o frete neste momento.') }
    finally { setShippingQuoteLoading(false) }
  }

  async function startPayment() {
    if (!order || !paymentMethods.length) return
    const selectedPayment = paymentMethods.find(item => paymentKey(item) === selectedPaymentMethod) || paymentMethods.find(item => item.method === 'pix') || paymentMethods[0]
    if (!selectedPayment) return
    setPaymentLoading(true)
    setCheckoutError('')
    try {
      const code = order.codigo || order.publicCode || order.public_code
      const idempotencyKey = paymentIdempotencyKey || checkoutKey()
      if (!paymentIdempotencyKey) setPaymentIdempotencyKey(idempotencyKey)
      const payment = await api.post(`/api/storefront/orders/${encodeURIComponent(code)}/payments`, { provider: selectedPayment.provider, method: selectedPayment.method, idempotencyKey })
      setPaymentResult(payment)
    } catch (err) { setCheckoutError(err.message || 'Não foi possível iniciar o pagamento no gateway.') }
    finally { setPaymentLoading(false) }
  }

  useEffect(() => {
    const code = order?.codigo || order?.publicCode || order?.public_code
    if (!code || !paymentResult) return undefined
    let active = true
    const refresh = async () => {
      try {
        const latest = await api.get(`/api/storefront/orders/${encodeURIComponent(code)}`)
        if (active) setOrder(current => current ? { ...current, ...latest } : current)
      } catch { /* a próxima tentativa ou o acompanhamento manual poderá recuperar */ }
    }
    const timer = window.setInterval(refresh, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [order?.id, paymentResult?.paymentId, paymentResult?.id])

  async function findOrder(event) {
    event.preventDefault()
    const code = trackingCode.trim()
    if (!code) return setTrackingError('Informe o código do pedido.')
    setTrackingLoading(true)
    setTrackingError('')
    setTrackingOrder(null)
    try {
      const path = catalogSource === 'core' ? `/api/storefront/orders/${encodeURIComponent(code)}` : `/api/loja/pedido/${encodeURIComponent(code)}`
      setTrackingOrder(await api.get(path))
    } catch (err) {
      setTrackingError(err.message || 'Não foi possível localizar este pedido.')
    } finally { setTrackingLoading(false) }
  }

  function openTracking() {
    setTrackingOpen(true)
    setTrackingError('')
    setTrackingOrder(null)
  }

  function addToCart(product, qtd = 1) {
    const available = availableStock(product, product.variantId)
    if (!available) return
    const cartKey = product.variantId || product.id
    setCart(previous => {
      const found = previous.find(item => (item.variantId || item.produtoId) === cartKey)
      if (found) return previous.map(item => (item.variantId || item.produtoId) === cartKey ? { ...item, qtd: Math.min(available, item.qtd + qtd) } : item)
      return [...previous, { produtoId: product.id, variantId: product.variantId || null, nome: product.nome, preco: product.preco, imagem: product.imagem, emoji: product.emoji, qtd: Math.min(available, qtd) }]
    })
    setSelected(null)
  }

  function updateCart(productId, variantId, qtd) {
    const product = products.find(item => item.id === productId)
    const available = availableStock(product, variantId)
    const cartKey = variantId || productId
    const safeQuantity = Math.min(Math.max(1, qtd), available)
    setCart(previous => qtd <= 0 || !available ? previous.filter(item => (item.variantId || item.produtoId) !== cartKey) : previous.map(item => (item.variantId || item.produtoId) === cartKey ? { ...item, qtd: safeQuantity } : item))
  }

  async function submitOrder(event) {
    event.preventDefault()
    setCheckoutError('')
    const form = new FormData(event.currentTarget)
    const nome = String(form.get('nome') || '').trim()
    const email = String(form.get('email') || '').trim()
    if (!nome || !email) return setCheckoutError('Informe nome e e-mail para receber o acompanhamento do pedido.')
    if (catalogSource === 'core' && !shippingMethodId) return setCheckoutError('Selecione uma forma de entrega configurada pela loja.')
    if (delivery.mode === 'entrega' && (!shippingQuote || !shippingOptionId)) return setCheckoutError('Consulte o CEP e selecione uma opção de frete antes de confirmar.')
    if (delivery.mode === 'entrega' && (!shippingAddress.logradouro || !shippingAddress.numero || !shippingAddress.bairro || !shippingAddress.cidade || !shippingAddress.estado)) return setCheckoutError('Consulte o CEP e complete o endereço de entrega.')
    setSubmitting(true)
    try {
      const observacao = String(form.get('observacao') || '').trim()
      const result = catalogSource === 'core'
        ? await api.post('/api/storefront/orders', {
            customer: { nome, email, telefone: String(form.get('tel') || '').trim() },
            items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
            idempotencyKey: checkoutIdempotency,
            shippingAddress: delivery.mode === 'entrega' ? { ...shippingAddress, destinatario: nome, email, telefone: String(form.get('tel') || '').trim(), documento: String(form.get('documento') || '').trim() } : { modo: 'retirada' },
            shippingMethodId: shippingMethodId || null,
            ...(delivery.mode === 'entrega' ? { shippingQuoteId: shippingQuote.quoteId, shippingOptionId } : {}),
            note: observacao,
            ...(String(form.get('promotionCode') || '').trim() ? { promotionCode: String(form.get('promotionCode')).trim() } : {}),
          })
        : await api.post('/api/loja/pedido', {
            cliente: { nome, email, tel: String(form.get('tel') || '').trim() },
            itens: cart.map(item => ({ produtoId: item.produtoId, qtd: item.qtd })),
            idempotencyKey: checkoutIdempotency,
            entrega: delivery,
            observacao,
          })
      const code = result.codigo || result.publicCode || result.public_code
      setCart([])
      setCheckoutOpen(false)
      if (catalogSource === 'core' && code) {
        localStorage.removeItem(CART_KEY)
        navigate(`/checkout?order=${encodeURIComponent(code)}`)
        return
      }
      setOrder(result)
      setPaymentResult(null)
      setPaymentIdempotencyKey(checkoutKey())
      setCheckoutIdempotency(checkoutKey())
    } catch (err) {
      if (['SHIPPING_QUOTE_EXPIRED', 'SHIPPING_QUOTE_MISMATCH', 'SHIPPING_OPTION_INVALID'].includes(err.code)) { setShippingQuote(null); setShippingOptionId('') }
      setCheckoutError(err.message || 'Não foi possível registrar o pedido.')
    } finally { setSubmitting(false) }
  }

  return <main className="commerce-shell">
    <section className="commerce-hero">
      <div>
        <span className="commerce-eyebrow"><Store size={14} /> Kytto Commerce</span>
        <h1>Venda melhor. <em>Opere com inteligência.</em></h1>
        <p>Uma experiência de compra completa para produtos, serviços e operações locais — com catálogo, atendimento e gestão conectados.</p>
        <div className="commerce-hero-actions">
          <a className="commerce-button commerce-button-primary" href="#catalogo">Explorar catálogo <ArrowRight size={16} /></a>
          <button type="button" className="commerce-button commerce-button-quiet" onClick={openTracking}>Acompanhar pedido</button>
        </div>
      </div>
      <div className="commerce-hero-orbit" aria-hidden="true"><span>CATÁLOGO</span><span>ESTOQUE</span><span>PEDIDOS</span><strong>∞</strong></div>
      <div className="commerce-channel-status" role="status"><span className={catalogSource === 'core' ? 'is-live' : ''}>{catalogSource === 'core' ? 'Core PostgreSQL ativo' : catalogSource === 'legacy' ? 'Catálogo operacional' : 'Conectando catálogo'}</span><small>{catalogSource === 'core' ? 'Estoque e pedido validados no servidor.' : 'Disponibilidade sujeita à confirmação da loja.'}</small></div>
    </section>

    <section className="commerce-toolbar" id="catalogo">
      <div className="commerce-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto, SKU ou categoria" aria-label="Buscar no catálogo" /></div>
      <div className="commerce-categories" role="tablist" aria-label="Categorias">
        {categories.map(item => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <button type="button" className="commerce-cart-button" onClick={() => setCheckoutOpen(true)} disabled={!cart.length}><ShoppingBag size={18} /><span>Carrinho</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
    </section>

    {loading && <div className="commerce-state"><Loader2 className="commerce-spin" /> Carregando catálogo…</div>}
    {!loading && error && <div className="commerce-state commerce-state-error">{error}</div>}
    {!loading && !error && <section className="commerce-product-grid">
      {filtered.map(product => <article className="commerce-product-card" key={product.id}>
        <button type="button" className="commerce-product-open" onClick={() => { setSelected(product); setSelectedVariantId(product.variantId || product.variants?.[0]?.variantId || '') }} aria-label={`Ver detalhes de ${product.nome}`}><ProductImage product={product} /></button>
        <div className="commerce-product-content"><span>{product.cat || 'Produto'}</span><h2>{product.nome}</h2><p>{product.descricao || 'Produto disponível no catálogo Kytto.'}</p><div className="commerce-product-buy"><div className="commerce-price"><strong>{money(product.preco)}</strong>{product.promocaoAtiva && <s>{money(product.precoOriginal)}</s>}</div><button type="button" onClick={() => addToCart(product)} disabled={product.esgotado}>{product.esgotado ? 'Esgotado' : 'Adicionar'}</button></div></div>
      </article>)}
      {!filtered.length && <div className="commerce-state">Nenhum item encontrado para esta busca.</div>}
    </section>}

    <section className="commerce-trust-grid">
      <div><strong>Compra assistida</strong><span>Atendimento conectado à operação da loja.</span></div>
      <div><strong>Estoque em tempo real</strong><span>Disponibilidade validada antes do pedido.</span></div>
      <div><strong>Pedido rastreável</strong><span>Acompanhe cada etapa com seu código.</span></div>
    </section>

    {selected && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do produto"><div className="commerce-modal commerce-product-modal"><button type="button" className="commerce-close" onClick={() => setSelected(null)} aria-label="Fechar"><X size={18} /></button><ProductGallery product={selectedVariant} /><div><span className="commerce-eyebrow">{selected.cat || 'Produto'}</span><h2>{selected.nome}</h2><p>{selected.descricao || 'Produto disponível no catálogo Kytto.'}</p>{selectedVariant.descricaoDetalhada && selectedVariant.descricaoDetalhada !== selectedVariant.descricao && <p className="commerce-product-long-description">{selectedVariant.descricaoDetalhada}</p>}<div className="commerce-product-meta"><span><small>SKU</small><strong>{selectedVariant.cod || '—'}</strong></span><span><small>Disponibilidade</small><strong>{selectedVariant.esgotado ? 'Esgotado' : `${selectedVariant.estoque} em estoque`}</strong></span></div>{selected.variants?.length > 1 && <label className="commerce-variant-select">Variação<select value={selectedVariant.variantId || ''} onChange={event => setSelectedVariantId(event.target.value)}>{selected.variants.map(variant => <option key={variant.variantId} value={variant.variantId}>{variant.label || variant.cod || 'Opção'}{variant.esgotado ? ' · esgotado' : ''}</option>)}</select></label>}<div className="commerce-modal-price"><strong>{money(selectedVariant.preco)}</strong>{selectedVariant.promocaoAtiva && <s>{money(selectedVariant.precoOriginal)}</s>}</div><div className="commerce-modal-actions"><button type="button" className="commerce-button commerce-button-primary" disabled={selectedVariant.esgotado} onClick={() => addToCart(selectedVariant)}>{selectedVariant.esgotado ? 'Produto esgotado' : 'Adicionar ao carrinho'} <ShoppingBag size={16} /></button><small>{selectedVariant.esgotado ? 'Sem estoque no momento.' : `${selectedVariant.estoque} unidade(s) disponíveis`}</small></div></div></div></div>}

    {checkoutOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Carrinho e checkout"><div className="commerce-modal commerce-checkout-modal"><button type="button" className="commerce-close" onClick={() => setCheckoutOpen(false)} aria-label="Fechar"><X size={18} /></button><div className="commerce-modal-heading"><span className="commerce-eyebrow">Checkout</span><h2>Finalize seu pedido</h2><p>O pedido será encaminhado para a operação da loja e você receberá um código de acompanhamento.</p></div><div className="commerce-checkout-layout"><div className="commerce-cart-list">{cart.map(item => <div className="commerce-cart-row" key={`${item.produtoId}-${item.variantId || 'base'}`}><ProductImage product={item} /><div><strong>{item.nome}</strong><span>{money(item.preco)} cada</span></div><QuantityControl value={item.qtd} max={Math.max(1, availableStock(products.find(product => product.id === item.produtoId), item.variantId))} onChange={value => updateCart(item.produtoId, item.variantId, value)} /><b>{money(item.qtd * item.preco)}</b></div>)}<div className="commerce-cart-total"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>{selectedShippingOption && <div className="commerce-cart-total commerce-cart-shipping"><span>Frete · {selectedShippingOption.name}<small>{shippingOptionMeta(selectedShippingOption)}</small></span><strong>{money(selectedShippingOption.amount)}</strong></div>}<div className="commerce-cart-total"><span>Total{selectedShippingMethod?.tipo === 'pickup' ? ' · retirada' : ''}</span><strong>{money(checkoutTotal)}</strong></div><Link className="commerce-button commerce-button-primary commerce-dedicated-checkout-link" to="/checkout">Continuar para checkout seguro <ArrowRight size={16} /></Link></div><form className="commerce-form" onSubmit={submitOrder}>
<label>Nome completo<input name="nome" autoComplete="name" required /></label><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>WhatsApp ou telefone<input name="tel" autoComplete="tel" value={shippingAddress.telefone} onChange={event => changeShippingAddress('telefone', event.target.value)} /></label><fieldset><legend>Como receber</legend><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'retirada'} disabled={!pickupAvailable} onChange={() => chooseDelivery('retirada')} /> Retirada no local</label><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'entrega'} disabled={!deliveryAvailable} onChange={() => chooseDelivery('entrega')} /> Entrega/delivery</label></fieldset>{catalogSource === 'core' && !deliveryAvailable && <small className="commerce-delivery-unavailable">Delivery não está habilitado para este storefront. Configure uma conta Correios ativa, origem/remetente e método de entrega no backoffice para liberar cotação real por CEP.</small>}{catalogSource === 'core' && <label>Forma de entrega<select value={shippingMethodId} onChange={event => { setShippingMethodId(event.target.value); setShippingQuote(null); setShippingOptionId('') }} disabled={!shippingMethods.length} required><option value="">Selecione uma opção configurada</option>{shippingMethods.filter(method => delivery.mode === 'entrega' ? ['delivery', 'carrier'].includes(method.tipo) && method.quoteEnabled : method.tipo === 'pickup').map(method => <option key={method.id} value={method.id}>{method.nome}</option>)}</select>{!shippingMethods.length && <small>Nenhum método publicado para este storefront.</small>}{selectedShippingMethod?.tipo === 'pickup' && <small>Retirada confirmada no local. O pagamento será concluído conforme gateway homologado.</small>}</label>}{delivery.mode === 'entrega' && <div className="commerce-address-fields"><label>CPF ou CNPJ do destinatário<input name="documento" inputMode="numeric" autoComplete="shipping" required value={shippingAddress.documento} onChange={event => changeShippingAddress('documento', event.target.value)} /></label><label className="commerce-cep-field">CEP<div className="commerce-inline-field"><input name="cep" inputMode="numeric" autoComplete="shipping postal-code" required value={shippingAddress.cep} onChange={event => changeShippingAddress('cep', event.target.value)} onBlur={() => shippingAddress.cep.replace(/\D/g, '').length === 8 && lookupCep()} placeholder="00000-000" /><button type="button" className="commerce-button commerce-button-quiet" onClick={lookupCep} disabled={addressLookupLoading}>{addressLookupLoading ? 'Consultando…' : 'Consultar CEP'}</button></div></label><label>Logradouro<input name="logradouro" autoComplete="shipping address-line1" required value={shippingAddress.logradouro} onChange={event => changeShippingAddress('logradouro', event.target.value)} /></label><label>Número<input name="numero" autoComplete="shipping address-line2" required value={shippingAddress.numero} onChange={event => changeShippingAddress('numero', event.target.value)} /></label><label>Bairro<input name="bairro" autoComplete="shipping address-level3" required value={shippingAddress.bairro} onChange={event => changeShippingAddress('bairro', event.target.value)} /></label><label>Cidade<input name="cidade" autoComplete="shipping address-level2" required value={shippingAddress.cidade} onChange={event => changeShippingAddress('cidade', event.target.value)} /></label><label>UF<input name="estado" maxLength="2" autoComplete="shipping address-level1" required value={shippingAddress.estado} onChange={event => changeShippingAddress('estado', event.target.value.toUpperCase())} /></label><label>Complemento<input name="complemento" value={shippingAddress.complemento} onChange={event => changeShippingAddress('complemento', event.target.value)} /></label><label className="wide">Referência<input name="referencia" value={shippingAddress.referencia} onChange={event => changeShippingAddress('referencia', event.target.value)} /></label>{selectedShippingMethod?.quoteEnabled ? <div className="commerce-shipping-quote-box wide"><div className="commerce-quote-heading"><strong>Opções de frete</strong><button type="button" className="commerce-button commerce-button-quiet" onClick={requestShippingQuote} disabled={shippingQuoteLoading || !cart.length}>{shippingQuoteLoading ? 'Calculando…' : shippingQuote ? 'Atualizar cotação' : 'Calcular frete'}</button></div>{shippingQuote?.expiresAt && <small>Cotação válida até {new Date(shippingQuote.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</small>}<div className="commerce-shipping-options">{shippingQuote?.items?.map(option => <label className="commerce-shipping-option" key={option.id}><input type="radio" name="shippingOption" value={option.id} checked={shippingOptionId === option.id} onChange={event => setShippingOptionId(event.target.value)} /><span><strong>{option.name}</strong><small>{shippingOptionMeta(option)}</small></span><b>{money(option.amount)}</b></label>)}</div>{!shippingQuote && <small>Informe o CEP e calcule o frete para continuar.</small>}</div> : <small className="wide">Esta forma de entrega ainda não está conectada a um cotador real.</small>}</div>}<label>Observação<textarea name="observacao" rows="2" placeholder="Preferências ou instruções para a loja" /></label>{catalogSource === 'core' && <label>Cupom de desconto<input name="promotionCode" placeholder="Código do cupom (opcional)" /></label>}{checkoutError && <div className="commerce-form-error">{checkoutError}</div>}<button className="commerce-button commerce-button-primary" type="submit" disabled={submitting || !cart.length || checkoutBlocked}>{submitting ? <><Loader2 className="commerce-spin" size={16} /> Enviando…</> : <>Confirmar pedido <ArrowRight size={16} /></>}</button>{checkoutBlocked && <small className="commerce-checkout-note">A loja ainda não publicou uma forma de entrega para este canal.</small>}</form></div></div></div>}

    {trackingOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Acompanhar pedido"><div className="commerce-modal commerce-tracking-modal"><button type="button" className="commerce-close" onClick={() => setTrackingOpen(false)} aria-label="Fechar"><X size={18} /></button><span className="commerce-eyebrow">Acompanhamento</span><h2>Onde está seu pedido?</h2><p>Informe o código recebido após a confirmação. A consulta usa somente o canal desta loja.</p><form className="commerce-tracking-form" onSubmit={findOrder}><label>Código do pedido<input value={trackingCode} onChange={event => setTrackingCode(event.target.value)} placeholder="Ex.: LJ-123456" autoComplete="off" /></label><button type="submit" className="commerce-button commerce-button-primary" disabled={trackingLoading}>{trackingLoading ? <><Loader2 className="commerce-spin" size={16} /> Consultando…</> : <>Consultar <ArrowRight size={16} /></>}</button></form>{trackingError && <div className="commerce-form-error" role="alert">{trackingError}</div>}{trackingOrder && <div className="commerce-tracking-result" aria-live="polite"><span className="commerce-eyebrow">Pedido encontrado</span><strong>{trackingOrder.codigo || trackingOrder.publicCode || trackingOrder.public_code}</strong><b>{trackingOrder.status || 'Em processamento'}</b><small>Atualizado em {trackingOrder.atualizado_em ? new Date(trackingOrder.atualizado_em).toLocaleString('pt-BR') : '—'}</small>{trackingOrder.fulfillments?.map(item => <div className="commerce-tracking-fulfillment" key={item.id || `${item.status}-${item.trackingCode}`}><b>{item.carrier || 'Entrega'} · {item.status}</b>{item.trackingCode && <span>Código: {item.trackingCode}</span>}{item.trackingUrl && <a href={item.trackingUrl} target="_blank" rel="noreferrer">Abrir rastreio</a>}{item.ocorrencias?.slice?.(-3).map((event, index) => <small key={`${event.at || index}`}>{event.description || event.status}</small>)}</div>)}</div>}</div></div>}

    {order && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Pedido criado"><div className="commerce-modal commerce-success-modal"><CheckCircle2 size={42} /><span className="commerce-eyebrow">Pedido recebido</span><h2>Seu pedido está na fila.</h2><p>Guarde o código abaixo para acompanhar o preparo.</p><strong className="commerce-order-code">{order.codigo || order.publicCode || order.public_code}</strong>{checkoutError && <div className="commerce-form-error" role="alert">{checkoutError}</div>}{paymentMethods.length ? <div className="commerce-payment-box"><strong>Pagamento online</strong><small>Escolha um método publicado pela loja. A confirmação depende do provedor e do webhook, sem aprovação local.</small><div className="commerce-payment-methods" role="radiogroup" aria-label="Método de pagamento">{paymentMethods.map(item => <label key={paymentKey(item)} className="commerce-payment-method"><input type="radio" name="publicPaymentMethod" value={paymentKey(item)} checked={selectedPaymentMethod === paymentKey(item)} onChange={event => setSelectedPaymentMethod(event.target.value)} disabled={paymentLoading || Boolean(paymentResult)} /><span><strong>{paymentLabel(item)}</strong><small>{item.provider === 'mercadopago' ? 'Mercado Pago' : item.provider === 'infinitepay' ? 'InfinitePay' : item.provider}</small></span></label>)}</div><button type="button" className="commerce-button commerce-button-primary" onClick={startPayment} disabled={paymentLoading || paymentResult || !selectedPaymentMethod}>{paymentLoading ? <><Loader2 className="commerce-spin" size={16} /> Iniciando pagamento…</> : paymentResult ? 'Pagamento iniciado' : `Pagar com ${paymentLabel(paymentMethods.find(item => paymentKey(item) === selectedPaymentMethod))}`}</button>{paymentResult?.checkout?.qrCodeBase64 && <img className="commerce-pix-qr" src={`data:image/png;base64,${paymentResult.checkout.qrCodeBase64}`} alt="QR Code Pix gerado pelo gateway" />}{paymentResult?.checkout?.qrCode && <div className="commerce-pix-copy"><small>Pix copia e cola</small><code>{paymentResult.checkout.qrCode}</code><button type="button" className="commerce-button commerce-button-quiet" onClick={() => navigator.clipboard?.writeText(paymentResult.checkout.qrCode)}>Copiar código</button></div>}{paymentResult?.checkout?.ticketUrl && <a className="commerce-button commerce-button-quiet" href={paymentResult.checkout.ticketUrl} target="_blank" rel="noreferrer">Abrir checkout do provedor</a>}{paymentResult && <small>Status informado pelo gateway: {paymentResult.checkout?.status || paymentResult.status || 'pending'}. Status persistido do pedido: {order.payment_status || 'aguardando webhook'}. Esta tela atualiza automaticamente.</small>}</div> : <div className="commerce-payment-box commerce-payment-unavailable"><strong>Pagamento online ainda não habilitado</strong><small>A loja precisa concluir a homologação e configurar um gateway real. Nenhum pagamento foi simulado.</small></div>}<button type="button" className="commerce-button commerce-button-primary" onClick={() => { setOrder(null); setTrackingCode(order.codigo || order.publicCode || order.public_code || ''); openTracking() }}>Acompanhar pedido <ArrowRight size={16} /></button><button type="button" className="commerce-button commerce-button-quiet" onClick={() => setOrder(null)}>Voltar ao catálogo</button></div></div>}
  </main>
}
