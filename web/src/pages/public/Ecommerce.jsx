import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Minus, Plus, Search, ShoppingBag, Store, X } from 'lucide-react'
import { api, fmtR } from '../../lib/api'
import './commerce.css'

const CART_KEY = 'kytto_commerce_cart'
const DELIVERY_KEY = 'kytto_commerce_delivery'

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
}

function money(value) { return fmtR(Number(value || 0)) }
function checkoutKey() { return `kytto-${Date.now()}-${Math.random().toString(36).slice(2,10)}` }

function normalizeCatalog(data, source) {
  const items = Array.isArray(data) ? data : data?.items || []
  if (source === 'legacy') return items
  return items.map(product => {
    const media = product.media?.find(item => item.url)?.url || ''
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
      imagem: media,
      ...primary,
      variants,
      emoji: '▦',
    }
  })
}

function selectedProductVariant(product, variantId) {
  const variant = product?.variants?.find(item => item.variantId === variantId) || product?.variants?.[0]
  return variant ? { ...product, ...variant, id: product.id, nome: product.nome, cat: product.cat, descricao: product.descricao, imagem: product.imagem } : product
}

function availableStock(product, variantId) {
  return Math.max(0, Number(selectedProductVariant(product, variantId)?.estoque || 0))
}

function ProductImage({ product, large = false }) {
  return product.imagem
    ? <img src={product.imagem} alt={product.nome} loading={large ? 'eager' : 'lazy'} decoding="async" className={`commerce-product-image ${large ? 'is-large' : ''}`} />
    : <div className={`commerce-product-placeholder ${large ? 'is-large' : ''}`} aria-hidden="true">{product.emoji || '▦'}</div>
}

function QuantityControl({ value, onChange, max }) {
  return <div className="commerce-quantity" aria-label="Quantidade">
    <button type="button" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus size={14} /></button>
    <strong>{value}</strong>
    <button type="button" aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></button>
  </div>
}

export default function Ecommerce() {
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
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingOrder, setTrackingOrder] = useState(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingError, setTrackingError] = useState('')

  useEffect(() => {
    api.get('/api/storefront/context')
      .then(() => Promise.all([api.get('/api/storefront/products'), api.get('/api/storefront/shipping-methods')]).then(([data, shipping]) => { setCatalogSource('core'); setProducts(normalizeCatalog(data, 'core')); const methods = shipping?.items || []; setShippingMethods(methods); setShippingMethodId(methods.find(item => item.tipo === (delivery.mode === 'entrega' ? 'delivery' : 'pickup'))?.id || '') }))
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
  const deliveryAvailable = catalogSource !== 'core' || shippingMethods.some(item => item.tipo === 'delivery')
  const selectedShippingMethod = shippingMethods.find(item => item.id === shippingMethodId)
  const selectedVariant = selectedProductVariant(selected, selectedVariantId)
  const requiredShippingType = delivery.mode === 'entrega' ? 'delivery' : 'pickup'
  const checkoutBlocked = catalogSource === 'core' && (!shippingMethods.length || !shippingMethodId || selectedShippingMethod?.tipo !== requiredShippingType)

  function chooseDelivery(mode) {
    setDelivery(mode === 'entrega' ? { mode, endereco: delivery.endereco || '' } : { mode })
    if (catalogSource === 'core') setShippingMethodId(shippingMethods.find(item => item.tipo === (mode === 'entrega' ? 'delivery' : 'pickup'))?.id || '')
  }

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
    if (delivery.mode === 'entrega' && !delivery.endereco?.trim()) return setCheckoutError('Informe o endereço para entrega.')
    setSubmitting(true)
    try {
      const observacao = String(form.get('observacao') || '').trim()
      const result = catalogSource === 'core'
        ? await api.post('/api/storefront/orders', {
            customer: { nome, email, telefone: String(form.get('tel') || '').trim() },
            items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
            idempotencyKey: checkoutIdempotency,
            shippingAddress: delivery.mode === 'entrega' ? { modo: 'entrega', endereco: delivery.endereco || '' } : { modo: 'retirada' },
            shippingMethodId: shippingMethodId || null,
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
      setOrder(result)
      setCheckoutIdempotency(checkoutKey())
      setCart([])
      setCheckoutOpen(false)
    } catch (err) {
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

    {selected && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do produto"><div className="commerce-modal commerce-product-modal"><button type="button" className="commerce-close" onClick={() => setSelected(null)} aria-label="Fechar"><X size={18} /></button><ProductImage product={selectedVariant} large /><div><span className="commerce-eyebrow">{selected.cat || 'Produto'}</span><h2>{selected.nome}</h2><p>{selected.descricao || 'Produto disponível no catálogo Kytto.'}</p>{selected.variants?.length > 1 && <label className="commerce-variant-select">Variação<select value={selectedVariant.variantId || ''} onChange={event => setSelectedVariantId(event.target.value)}>{selected.variants.map(variant => <option key={variant.variantId} value={variant.variantId}>{variant.label || variant.cod || 'Opção'}{variant.esgotado ? ' · esgotado' : ''}</option>)}</select></label>}<div className="commerce-modal-price"><strong>{money(selectedVariant.preco)}</strong>{selectedVariant.promocaoAtiva && <s>{money(selectedVariant.precoOriginal)}</s>}</div><div className="commerce-modal-actions"><button type="button" className="commerce-button commerce-button-primary" disabled={selectedVariant.esgotado} onClick={() => addToCart(selectedVariant)}>{selectedVariant.esgotado ? 'Produto esgotado' : 'Adicionar ao carrinho'} <ShoppingBag size={16} /></button><small>{selectedVariant.esgotado ? 'Sem estoque no momento.' : `${selectedVariant.estoque} unidade(s) disponíveis`}</small></div></div></div></div>}

    {checkoutOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Carrinho e checkout"><div className="commerce-modal commerce-checkout-modal"><button type="button" className="commerce-close" onClick={() => setCheckoutOpen(false)} aria-label="Fechar"><X size={18} /></button><div className="commerce-modal-heading"><span className="commerce-eyebrow">Checkout</span><h2>Finalize seu pedido</h2><p>O pedido será encaminhado para a operação da loja e você receberá um código de acompanhamento.</p></div><div className="commerce-checkout-layout"><div className="commerce-cart-list">{cart.map(item => <div className="commerce-cart-row" key={`${item.produtoId}-${item.variantId || 'base'}`}><ProductImage product={item} /><div><strong>{item.nome}</strong><span>{money(item.preco)} cada</span></div><QuantityControl value={item.qtd} max={Math.max(1, availableStock(products.find(product => product.id === item.produtoId), item.variantId))} onChange={value => updateCart(item.produtoId, item.variantId, value)} /><b>{money(item.qtd * item.preco)}</b></div>)}<div className="commerce-cart-total"><span>Total{selectedShippingMethod?.tipo === 'pickup' ? ' · retirada' : ''}</span><strong>{money(cartTotal)}</strong></div></div><form className="commerce-form" onSubmit={submitOrder}><label>Nome completo<input name="nome" autoComplete="name" required /></label><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>WhatsApp ou telefone<input name="tel" autoComplete="tel" /></label><fieldset><legend>Como receber</legend><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'retirada'} disabled={!pickupAvailable} onChange={() => chooseDelivery('retirada')} /> Retirada no local</label><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'entrega'} disabled={!deliveryAvailable} onChange={() => chooseDelivery('entrega')} /> Entrega/delivery</label></fieldset>{catalogSource === 'core' && <label>Forma de entrega<select value={shippingMethodId} onChange={event => setShippingMethodId(event.target.value)} disabled={!shippingMethods.length} required><option value="">Selecione uma opção configurada</option>{shippingMethods.filter(method => method.tipo === (delivery.mode === 'entrega' ? 'delivery' : 'pickup')).map(method => <option key={method.id} value={method.id}>{method.nome}</option>)}</select>{!shippingMethods.length && <small>Nenhum método publicado para este storefront.</small>}{selectedShippingMethod?.tipo === 'pickup' && <small>Retirada confirmada no local. O pagamento será concluído conforme gateway homologado.</small>}</label>}{delivery.mode === 'entrega' && <label>Endereço de entrega<textarea name="endereco" rows="2" value={delivery.endereco || ''} onChange={event => setDelivery(current => ({ ...current, endereco: event.target.value }))} /></label>}<label>Observação<textarea name="observacao" rows="2" placeholder="Preferências ou instruções para a loja" /></label>{catalogSource === 'core' && <label>Cupom de desconto<input name="promotionCode" placeholder="Código do cupom (opcional)" /></label>}{checkoutError && <div className="commerce-form-error">{checkoutError}</div>}<button className="commerce-button commerce-button-primary" type="submit" disabled={submitting || !cart.length || checkoutBlocked}>{submitting ? <><Loader2 className="commerce-spin" size={16} /> Enviando…</> : <>Confirmar pedido <ArrowRight size={16} /></>}</button>{checkoutBlocked && <small className="commerce-checkout-note">A loja ainda não publicou uma forma de entrega para este canal.</small>}</form></div></div></div>}

    {trackingOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Acompanhar pedido"><div className="commerce-modal commerce-tracking-modal"><button type="button" className="commerce-close" onClick={() => setTrackingOpen(false)} aria-label="Fechar"><X size={18} /></button><span className="commerce-eyebrow">Acompanhamento</span><h2>Onde está seu pedido?</h2><p>Informe o código recebido após a confirmação. A consulta usa somente o canal desta loja.</p><form className="commerce-tracking-form" onSubmit={findOrder}><label>Código do pedido<input value={trackingCode} onChange={event => setTrackingCode(event.target.value)} placeholder="Ex.: LJ-123456" autoComplete="off" /></label><button type="submit" className="commerce-button commerce-button-primary" disabled={trackingLoading}>{trackingLoading ? <><Loader2 className="commerce-spin" size={16} /> Consultando…</> : <>Consultar <ArrowRight size={16} /></>}</button></form>{trackingError && <div className="commerce-form-error" role="alert">{trackingError}</div>}{trackingOrder && <div className="commerce-tracking-result" aria-live="polite"><span className="commerce-eyebrow">Pedido encontrado</span><strong>{trackingOrder.codigo || trackingOrder.publicCode || trackingOrder.public_code}</strong><b>{trackingOrder.status || 'Em processamento'}</b><small>Atualizado em {trackingOrder.atualizado_em ? new Date(trackingOrder.atualizado_em).toLocaleString('pt-BR') : '—'}</small></div>}</div></div>}

    {order && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Pedido criado"><div className="commerce-modal commerce-success-modal"><CheckCircle2 size={42} /><span className="commerce-eyebrow">Pedido recebido</span><h2>Seu pedido está na fila.</h2><p>Guarde o código abaixo para acompanhar o preparo.</p><strong className="commerce-order-code">{order.codigo || order.publicCode || order.public_code}</strong><button type="button" className="commerce-button commerce-button-primary" onClick={() => { setOrder(null); setTrackingCode(order.codigo || order.publicCode || order.public_code || ''); openTracking() }}>Acompanhar pedido <ArrowRight size={16} /></button><button type="button" className="commerce-button commerce-button-quiet" onClick={() => setOrder(null)}>Voltar ao catálogo</button></div></div>}
  </main>
}
