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
    const variant = product.variants?.[0] || {}
    const price = variant.prices?.[0] || {}
    const effective = Number(price.precoPromocional ?? price.preco ?? 0)
    const original = Number(price.preco ?? effective)
    const media = product.media?.find(item => item.url)?.url || ''
    return {
      id: product.id,
      variantId: variant.id,
      cod: variant.sku || '',
      nome: product.nome,
      cat: product.category_name || 'Produto',
      descricao: product.descricao_curta || product.descricao || '',
      imagem: media,
      preco: effective,
      precoOriginal: original,
      precoPromocional: price.precoPromocional ?? null,
      promocaoAtiva: effective < original,
      estoque: Number(variant.estoque || 0),
      esgotado: Number(variant.estoque || 0) <= 0,
      emoji: '▦',
    }
  })
}

function ProductImage({ product, large = false }) {
  return product.imagem
    ? <img src={product.imagem} alt={product.nome} className={`commerce-product-image ${large ? 'is-large' : ''}`} />
    : <div className={`commerce-product-placeholder ${large ? 'is-large' : ''}`} aria-hidden="true">{product.emoji || '▦'}</div>
}

function QuantityControl({ value, onChange }) {
  return <div className="commerce-quantity" aria-label="Quantidade">
    <button type="button" aria-label="Diminuir quantidade" onClick={() => onChange(Math.max(1, value - 1))}><Minus size={14} /></button>
    <strong>{value}</strong>
    <button type="button" aria-label="Aumentar quantidade" onClick={() => onChange(value + 1)}><Plus size={14} /></button>
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
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [order, setOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutIdempotency, setCheckoutIdempotency] = useState(checkoutKey)
  const [catalogSource, setCatalogSource] = useState('detecting')
  const [delivery, setDelivery] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DELIVERY_KEY) || '{"mode":"retirada"}') } catch { return { mode: 'retirada' } }
  })

  useEffect(() => {
    api.get('/api/storefront/context')
      .then(() => api.get('/api/storefront/products').then(data => { setCatalogSource('core'); setProducts(normalizeCatalog(data, 'core')) }))
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
      const available = Number(current?.estoque || 0)
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

  function addToCart(product, qtd = 1) {
    const available = Math.max(0, Number(product.estoque || 0))
    if (!available) return
    setCart(previous => {
      const found = previous.find(item => item.produtoId === product.id)
      if (found) return previous.map(item => item.produtoId === product.id ? { ...item, qtd: Math.min(available, item.qtd + qtd) } : item)
      return [...previous, { produtoId: product.id, variantId: product.variantId || null, nome: product.nome, preco: product.preco, imagem: product.imagem, emoji: product.emoji, qtd: Math.min(available, qtd) }]
    })
    setSelected(null)
  }

  function updateCart(productId, qtd) {
    const available = Number(products.find(product => product.id === productId)?.estoque || 0)
    const safeQuantity = Math.min(Math.max(1, qtd), available)
    setCart(previous => qtd <= 0 || !available ? previous.filter(item => item.produtoId !== productId) : previous.map(item => item.produtoId === productId ? { ...item, qtd: safeQuantity } : item))
  }

  async function submitOrder(event) {
    event.preventDefault()
    setCheckoutError('')
    const form = new FormData(event.currentTarget)
    const nome = String(form.get('nome') || '').trim()
    const email = String(form.get('email') || '').trim()
    if (!nome || !email) return setCheckoutError('Informe nome e e-mail para receber o acompanhamento do pedido.')
    setSubmitting(true)
    try {
      const observacao = String(form.get('observacao') || '').trim()
      const result = catalogSource === 'core'
        ? await api.post('/api/storefront/orders', {
            customer: { nome, email, telefone: String(form.get('tel') || '').trim() },
            items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
            idempotencyKey: checkoutIdempotency,
            shippingAddress: delivery.mode === 'entrega' ? { modo: 'entrega', endereco: delivery.endereco || '' } : { modo: 'retirada' },
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
          <a className="commerce-button commerce-button-quiet" href="/pedido">Acompanhar pedido</a>
        </div>
      </div>
      <div className="commerce-hero-orbit" aria-hidden="true"><span>CATÁLOGO</span><span>ESTOQUE</span><span>PEDIDOS</span><strong>∞</strong></div>
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
        <button type="button" className="commerce-product-open" onClick={() => setSelected(product)} aria-label={`Ver detalhes de ${product.nome}`}><ProductImage product={product} /></button>
        <div className="commerce-product-content"><span>{product.cat || 'Produto'}</span><h2>{product.nome}</h2><p>{product.descricao || 'Produto disponível no catálogo Kytto.'}</p><div className="commerce-product-buy"><div className="commerce-price"><strong>{money(product.preco)}</strong>{product.promocaoAtiva && <s>{money(product.precoOriginal)}</s>}</div><button type="button" onClick={() => addToCart(product)} disabled={product.esgotado}>{product.esgotado ? 'Esgotado' : 'Adicionar'}</button></div></div>
      </article>)}
      {!filtered.length && <div className="commerce-state">Nenhum item encontrado para esta busca.</div>}
    </section>}

    <section className="commerce-trust-grid">
      <div><strong>Compra assistida</strong><span>Atendimento conectado à operação da loja.</span></div>
      <div><strong>Estoque em tempo real</strong><span>Disponibilidade validada antes do pedido.</span></div>
      <div><strong>Pedido rastreável</strong><span>Acompanhe cada etapa com seu código.</span></div>
    </section>

    {selected && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do produto"><div className="commerce-modal commerce-product-modal"><button type="button" className="commerce-close" onClick={() => setSelected(null)} aria-label="Fechar"><X size={18} /></button><ProductImage product={selected} large /><div><span className="commerce-eyebrow">{selected.cat || 'Produto'}</span><h2>{selected.nome}</h2><p>{selected.descricao || 'Produto disponível no catálogo Kytto.'}</p><div className="commerce-modal-price"><strong>{money(selected.preco)}</strong>{selected.promocaoAtiva && <s>{money(selected.precoOriginal)}</s>}</div><div className="commerce-modal-actions"><button type="button" className="commerce-button commerce-button-primary" onClick={() => addToCart(selected)}>Adicionar ao carrinho <ShoppingBag size={16} /></button><small>{selected.esgotado ? 'Sem estoque no momento.' : `${selected.estoque} unidade(s) disponíveis`}</small></div></div></div></div>}

    {checkoutOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Carrinho e checkout"><div className="commerce-modal commerce-checkout-modal"><button type="button" className="commerce-close" onClick={() => setCheckoutOpen(false)} aria-label="Fechar"><X size={18} /></button><div className="commerce-modal-heading"><span className="commerce-eyebrow">Checkout</span><h2>Finalize seu pedido</h2><p>O pedido será encaminhado para a operação da loja e você receberá um código de acompanhamento.</p></div><div className="commerce-checkout-layout"><div className="commerce-cart-list">{cart.map(item => <div className="commerce-cart-row" key={item.produtoId}><ProductImage product={item} /><div><strong>{item.nome}</strong><span>{money(item.preco)} cada</span></div><QuantityControl value={item.qtd} onChange={value => updateCart(item.produtoId, value)} /><b>{money(item.qtd * item.preco)}</b></div>)}<div className="commerce-cart-total"><span>Total</span><strong>{money(cartTotal)}</strong></div></div><form className="commerce-form" onSubmit={submitOrder}><label>Nome completo<input name="nome" autoComplete="name" required /></label><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>WhatsApp ou telefone<input name="tel" autoComplete="tel" /></label><fieldset><legend>Como receber</legend><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'retirada'} onChange={() => setDelivery({ mode: 'retirada' })} /> Retirada no local</label><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'entrega'} onChange={() => setDelivery({ mode: 'entrega' })} /> Entrega/delivery</label></fieldset>{delivery.mode === 'entrega' && <label>Endereço de entrega<textarea name="endereco" rows="2" onChange={event => setDelivery(current => ({ ...current, endereco: event.target.value }))} /></label>}<label>Observação<textarea name="observacao" rows="2" placeholder="Preferências ou instruções para a loja" /></label>{catalogSource === 'core' && <label>Cupom de desconto<input name="promotionCode" placeholder="Código do cupom (opcional)" /></label>}{checkoutError && <div className="commerce-form-error">{checkoutError}</div>}<button className="commerce-button commerce-button-primary" type="submit" disabled={submitting || !cart.length}>{submitting ? <><Loader2 className="commerce-spin" size={16} /> Enviando…</> : <>Confirmar pedido <ArrowRight size={16} /></>}</button></form></div></div></div>}

    {order && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Pedido criado"><div className="commerce-modal commerce-success-modal"><CheckCircle2 size={42} /><span className="commerce-eyebrow">Pedido recebido</span><h2>Seu pedido está na fila.</h2><p>Guarde o código abaixo para acompanhar o preparo.</p><strong className="commerce-order-code">{order.codigo || order.publicCode}</strong><a className="commerce-button commerce-button-primary" href={`/pedido/${order.codigo || order.publicCode}`}>Acompanhar pedido <ArrowRight size={16} /></a><button type="button" className="commerce-button commerce-button-quiet" onClick={() => setOrder(null)}>Voltar ao catálogo</button></div></div>}
  </main>
}
