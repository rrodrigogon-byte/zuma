import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Eye, Loader2, MessageSquare, Minus, Monitor, Moon, PackageSearch, Plus, QrCode, Search, ShoppingBag, Store, Sun, Trash2, Truck, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { decrementCartQuantity, loadAllStorefrontProducts, nextStorefrontCartSyncVersion, normalizeStorefrontAlias, storefrontApiBase, storefrontCartSessionKey, storefrontMediaRecoveryUrl, storefrontMediaUrl, storefrontRoute, storefrontStorageKey } from '../../lib/storefront'
import { recommendedShippingOption, shippingQuoteKey } from '../../lib/checkout-shipping'
import { createLatestRequest } from '../../lib/latest-request'
import { applyThemeMode, brandFromHost, commerceDisplayName, DINO_COMMERCE_LOGO, STALLONE_LOGO_LIGHT, storedThemeMode } from '../../lib/brand'
import { addProductToCart, applyCartLink, CART_LINK_PARAM, CATALOG_PAGE_SIZE, cartHasPickupOnlyItems, filterCatalog, isPickupOnlyProduct, paginateCatalog, parseCartLink, PICKUP_ONLY_NOTE, sortCatalog, stockState } from '../../lib/storefront-catalog'
import AddToCartSuccess from '../../components/store/AddToCartSuccess'
import CartDrawer from '../../components/store/CartDrawer'
import './commerce.css'
import './storefront-ux.css'
import './commerce-stallone.css'
import { ehHostLojaDino } from '../../lib/dominios-dino'

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
function checkoutKey() { return `kytto-${Date.now()}-${Math.random().toString(36).slice(2,10)}` }
function paymentKey(item) { return `${item?.provider || ''}:${item?.method || ''}` }
function paymentLabel(item) { return item?.provider === 'crediario' || item?.method === 'account' ? 'Marcar na conta' : item?.method === 'credit_card' ? 'Cartão de crédito' : item?.method === 'pix' ? 'Pix' : item?.method || 'Pagamento online' }
function shippingOptionMeta(option) {
  const carrier = option?.carrier || 'Transportadora'
  const totalDays = option?.deliveryRange?.max ?? option?.deliveryDays
  const timing = option?.preparationDays !== null && option?.preparationDays !== undefined && option?.providerDeliveryDays !== null && option?.providerDeliveryDays !== undefined && totalDays !== null && totalDays !== undefined
    ? `${carrier} · ${option.preparationDays} dias úteis de preparação/postagem + ${option.providerDeliveryDays} dias úteis de transporte · total: ${totalDays} dias úteis`
    : `${carrier}${totalDays ? ` · até ${totalDays} dias úteis` : ''}`
  const backorderNote = option?.backorderLeadDays ? ` · +${option.backorderLeadDays} dias úteis por encomenda` : ''
  const base = Number(option?.providerAmount)
  const surcharge = Number(option?.surchargeAmount)
  const total = Number(option?.amount)
  if (option?.provider === 'manual' || option?.carrier === 'Kytto Entrega' || option?.carrier === 'Motoboy local' || option?.carrier === 'Kytto Express') return `${timing}${backorderNote} · ${option.priceNote || 'Entrega própria'} · total: ${money(total)}`
  return Number.isFinite(base) && Number.isFinite(surcharge) && Number.isFinite(total)
    ? `${timing}${backorderNote} · Tarifa Correios ${money(base)} + 12% (${money(surcharge)}) = ${money(total)}`
    : `${timing}${backorderNote}`
}

function formatPublicAddress(address = {}) {
  const postal = String(address.postalCode || '').replace(/\D/g, '')
  const cep = postal.length === 8 ? `${postal.slice(0, 5)}-${postal.slice(5)}` : ''
  const first = [address.street, address.number].filter(Boolean).join(', ')
  const second = [address.neighborhood, address.city, address.state].filter(Boolean).join(' · ')
  return [first, address.complement, second, cep].filter(Boolean).join(' — ')
}

function productMedia(product, storeAlias = '') {
  const media = Array.isArray(product?.media) ? product.media : []
  return media.filter(item => item?.url).map((item, index) => ({
    id: item.id || item.url || `media-${index}`,
    url: storefrontMediaUrl(item.url, storeAlias),
    altText: item.altText || product?.nome || 'Imagem do produto',
    ordem: Number(item.ordem || 0),
  })).sort((a, b) => a.ordem - b.ordem)
}

function normalizeCatalog(data, source, storeAlias = '') {
  const items = Array.isArray(data) ? data : data?.items || []
  if (source === 'legacy') return items
  return items.map(product => {
    const media = productMedia(product, storeAlias)
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
        permiteCompraSemEstoque: variant.permiteCompraSemEstoque === true || variant.permite_compra_sem_estoque === true,
        esgotado: Number(variant.estoque || 0) <= 0 && !(variant.permiteCompraSemEstoque === true || variant.permite_compra_sem_estoque === true),
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
  const variant = selectedProductVariant(product, variantId)
  const stock = Math.max(0, Number(variant?.estoque || 0))
  return stock > 0 ? stock : variant?.permiteCompraSemEstoque === true ? 999 : 0
}

function useRecoverableCatalogImage(image) {
  const [brokenImage, setBrokenImage] = useState('')
  const [recovery, setRecovery] = useState(null)
  const source = recovery?.original === image ? recovery.url : image
  return {
    source,
    broken: Boolean(image && brokenImage === image),
    onError() {
      const retry = source === image ? storefrontMediaRecoveryUrl(image) : ''
      if (retry) setRecovery({ original: image, url: retry })
      else setBrokenImage(image)
    },
  }
}

function ProductImage({ product, large = false, mediaUrl = '' }) {
  const image = mediaUrl || product?.imagem || productMedia(product)[0]?.url || ''
  const alt = productMedia(product).find(item => item.url === image)?.altText || product?.nome || 'Produto'
  const { source, broken, onError } = useRecoverableCatalogImage(image)
  if (broken) return <div className={`commerce-product-placeholder sf-image-fallback ${large ? 'is-large' : ''}`} role="img" aria-label={`${product?.nome || 'Produto'} — imagem indisponível`}><Store size={large ? 40 : 28} aria-hidden="true" /><span>Imagem indisponível</span></div>
  return image
    ? <img width="600" height="600" onError={onError} src={source} alt={alt} loading={large ? 'eager' : 'lazy'} decoding="async" className={`commerce-product-image ${large ? 'is-large' : ''}`} />
    : <div className={`commerce-product-placeholder ${large ? 'is-large' : ''}`} aria-hidden="true">{product?.emoji || '▦'}</div>
}

function GalleryThumbnailImage({ item }) {
  const { source, broken, onError } = useRecoverableCatalogImage(item.url)
  return broken ? <Store size={18} aria-hidden="true" /> : <img src={source} onError={onError} alt="" loading="lazy" decoding="async" />
}

function ProductGallery({ product }) {
  const media = productMedia(product)
  const items = media.length ? media : (product?.imagem ? [{ id: product.imagem, url: product.imagem, altText: product.nome || 'Produto', ordem: 0 }] : [])
  const [activeId, setActiveId] = useState(items[0]?.id || '')
  useEffect(() => { setActiveId(items[0]?.id || '') }, [product?.id])
  const active = items.find(item => item.id === activeId) || items[0]
  return <div className="commerce-product-gallery">
    <div className="commerce-product-gallery-main"><ProductImage product={product} large mediaUrl={active?.url || ''} /></div>
    {items.length > 1 && <div className="commerce-product-gallery-thumbs" role="list" aria-label="Imagens do produto">{items.map(item => <button type="button" key={item.id} className={`commerce-product-gallery-thumb ${active?.id === item.id ? 'is-active' : ''}`} onClick={() => setActiveId(item.id)} aria-label={`Ver imagem ${items.indexOf(item) + 1} de ${items.length}`} aria-pressed={active?.id === item.id}><GalleryThumbnailImage item={item} /></button>)}</div>}
    {items.length > 1 && <small className="commerce-product-gallery-count">{items.indexOf(active) + 1} de {items.length} imagens</small>}
  </div>
}

function QuantityControl({ value, onChange, max }) {
  const removesItem = value <= 1
  return <div className="commerce-quantity" aria-label="Quantidade">
    <button type="button" aria-label={removesItem ? 'Remover item' : 'Diminuir quantidade'} title={removesItem ? 'Remover item' : 'Diminuir quantidade'} onClick={() => onChange(decrementCartQuantity(value))}>{removesItem ? <Trash2 size={14} /> : <Minus size={14} />}</button>
    <strong>{value}</strong>
    <button type="button" aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></button>
  </div>
}

/**
 * Topo da loja Stallone (claro): logotipo, slogan, fatos reais da compra e atalhos
 * para as categorias com mais produtos, que filtram o catálogo em um clique.
 */
function StalloneHero({ tagline, productCount, topCategories, onCategory, onTrack, catalogSource }) {
  return <section className="commerce-hero stallone-hero" aria-labelledby="stallone-hero-title">
    <div className="stallone-hero-bar">
      <img src={STALLONE_LOGO_LIGHT} alt="Stallone Nutre Sport" width="230" height="84" />
      <button type="button" className="stallone-link-button" onClick={onTrack} aria-label="Acompanhar pedido"><PackageSearch size={18} aria-hidden="true" /><span>Acompanhar pedido</span></button>
    </div>
    <div className="stallone-hero-copy">
      <h1 id="stallone-hero-title"><span>Força para evoluir.</span> <span>Nutrição para ir além.</span></h1>
      <span className="stallone-hero-stripe" aria-hidden="true" />
      <p>{tagline}</p>
      <div className="stallone-hero-actions">
        <a className="stallone-cta" href="#catalogo">{productCount ? `Ver os ${productCount} produtos` : 'Ver o catálogo'} <ArrowRight size={18} aria-hidden="true" /></a>
      </div>
      <ul className="stallone-hero-facts">
        <li><Store size={18} aria-hidden="true" />Retirada grátis na loja</li>
        <li><Truck size={18} aria-hidden="true" />Entrega com frete pelo CEP</li>
        <li><QrCode size={18} aria-hidden="true" />Pix ou cartão de crédito</li>
      </ul>
    </div>
    <div className="stallone-objetivos-kyttoia" style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: '16px 20px',
      margin: '18px 0',
      color: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <strong style={{ fontSize: 15, letterSpacing: '-0.01em' }}>KyttoIA Nutre Sport · Consultor Nutricional por Objetivo</strong>
          <span style={{ background: '#f59e0b', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>MOTOR KYTTOIA</span>
        </div>
        <small style={{ color: '#94a3b8', fontSize: 12 }}>Clique no seu objetivo para carregar os suplementos recomendados:</small>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onCategory('Creatina')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          🏋️‍♂️ Hipertrofia & Força
        </button>
        <button type="button" onClick={() => onCategory('Whey & Proteínas')} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          🏃‍♀️ Proteínas & Definição
        </button>
        <button type="button" onClick={() => onCategory('Pré-treino & Energia')} style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          ⚡ Pré-Treino Explosivo
        </button>
        <button type="button" onClick={() => onCategory('Vitaminas & Minerais')} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          🌿 Longevidade & Imunidade
        </button>
      </div>
    </div>
    <div className="stallone-vip-club" style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      border: '1px solid #4338ca',
      borderRadius: 12,
      padding: '16px 20px',
      margin: '18px 0',
      color: '#fff',
      boxShadow: '0 6px 24px rgba(67, 56, 202, 0.25)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>📦</span>
          <strong style={{ fontSize: 16, letterSpacing: '-0.01em', color: '#a5b4fc' }}>Stallone VIP Club · Box Mensal Recorrente</strong>
          <span style={{ background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>REPOSIÇÃO AUTOMÁTICA</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#38bdf8' }}>Plano Starter</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>R$ 149,90<small style={{ fontSize: 10, color: '#94a3b8' }}>/mês</small></span>
          </div>
          <p style={{ fontSize: 11, color: '#cbd5e1', margin: '6px 0 8px' }}>Whey 100% Pure + Coqueteleira + 5% cashback em toda a loja.</p>
          <button type="button" onClick={() => onCategory('Whey & Proteínas')} style={{ width: '100%', background: '#0284c7', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver Suplementos do Plano</button>
        </div>
        <div style={{ background: 'rgba(99, 102, 241, 0.15)', borderRadius: 8, padding: 12, border: '1px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#818cf8' }}>Plano Performance ⭐</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>R$ 279,90<small style={{ fontSize: 10, color: '#94a3b8' }}>/mês</small></span>
          </div>
          <p style={{ fontSize: 11, color: '#e0e7ff', margin: '6px 0 8px' }}>Whey Isolado + Creatina Creapure + Coqueteleira + 10% cashback.</p>
          <button type="button" onClick={() => onCategory('Creatina')} style={{ width: '100%', background: '#4f46e5', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver Suplementos do Plano</button>
        </div>
        <div style={{ background: 'rgba(245, 158, 11, 0.12)', borderRadius: 8, padding: 12, border: '1px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>Plano Elite Pro 👑</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>R$ 449,90<small style={{ fontSize: 10, color: '#94a3b8' }}>/mês</small></span>
          </div>
          <p style={{ fontSize: 11, color: '#fef3c7', margin: '6px 0 8px' }}>Whey Hydro + Creatina + Pré-Treino Panic + Camiseta + KyttoIA + 15% cashback.</p>
          <button type="button" onClick={() => onCategory('Pré-treino & Energia')} style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver Suplementos do Plano</button>
        </div>
      </div>
    </div>
    {topCategories.length > 0 && <nav className="stallone-hero-shelf" aria-label="Categorias com mais produtos">
      <h2>Comece por uma categoria</h2>
      <ul>
        {topCategories.map(([name, count]) => <li key={name}><button type="button" onClick={() => onCategory(name)}><span>{name}</span><small>{count} {count === 1 ? 'item' : 'itens'}</small><ChevronRight size={18} aria-hidden="true" /></button></li>)}
        <li><button type="button" className="stallone-shelf-all" onClick={() => onCategory('Todos')}><span>Todas as categorias</span><small>{productCount}</small><ChevronRight size={18} aria-hidden="true" /></button></li>
      </ul>
    </nav>}
    <div className="stallone-hero-status" role="status"><i aria-hidden="true" />{catalogSource === 'core' ? 'Estoque atualizado. A disponibilidade é confirmada ao finalizar a compra.' : 'Carregando o catálogo da loja.'}</div>
  </section>
}

export default function Ecommerce() {
  const { storeAlias: routeAlias = '' } = useParams()
  const storeAlias = normalizeStorefrontAlias(routeAlias)
  const hostName = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const storefrontIdentity = `${hostName}|${storeAlias || 'host'}`
  return <EcommerceStorefront key={storefrontIdentity} routeAlias={routeAlias} hostName={hostName} />
}

function EcommerceStorefront({ routeAlias, hostName }) {
  const navigate = useNavigate()
  const storeAlias = normalizeStorefrontAlias(routeAlias)
  const isDinoStorefront = storeAlias === 'dino' || (ehHostLojaDino(hostName) && !storeAlias)
  const isStalloneStorefront = storeAlias === 'stallone' || (brandFromHost(hostName) === 'stallone' && !storeAlias)
  const storefrontApi = storefrontApiBase(storeAlias)
  const storeRoute = storefrontRoute(storeAlias, 'store')
  const checkoutRoute = storefrontRoute(storeAlias, 'checkout')
  const cartStorageKey = storefrontStorageKey(storeAlias, 'cart')
  const [cartSessionKey, setCartSessionKey] = useState(() => storefrontCartSessionKey(storeAlias))
  const deliveryStorageKey = storefrontStorageKey(storeAlias, 'delivery')
  const [storeContext, setStoreContext] = useState(null)
  const [themeMode, setThemeMode] = useState(() => storedThemeMode())
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [addedItem, setAddedItem] = useState(null)
  const [justAdded, setJustAdded] = useState({})
  const [addError, setAddError] = useState('')
  const [cartBump, setCartBump] = useState(false)
  const addLockRef = useRef(new Set())
  // Stallone: sem barra presa no topo. Depois que a busca sai da tela, uma pílula
  // pequena no rodapé oferece Buscar e Carrinho sem cobrir os produtos.
  const toolbarRef = useRef(null)
  const searchInputRef = useRef(null)
  const [quickbarVisible, setQuickbarVisible] = useState(false)
  const cartSyncControllerRef = useRef(null)
  const [category, setCategory] = useState('Todos')
  const [sort, setSort] = useState('available')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [cart, setCart] = useState(() => readCart(storeAlias))
  const [selected, setSelected] = useState(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [order, setOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutIdempotency, setCheckoutIdempotency] = useState(checkoutKey)
  const [checkoutContact, setCheckoutContact] = useState({ nome: '', email: '' })
  const [recoveryPreference, setRecoveryPreference] = useState(null)
  const [catalogSource, setCatalogSource] = useState('detecting')
  const [delivery, setDelivery] = useState(() => {
    try { return JSON.parse(localStorage.getItem(deliveryStorageKey) || '{"mode":"retirada"}') } catch { return { mode: 'retirada' } }
  })
  const [shippingMethods, setShippingMethods] = useState([])
  const [shippingMethodId, setShippingMethodId] = useState('')
  const [shippingAddress, setShippingAddress] = useState({ destinatario: '', email: '', telefone: '', documento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' })
  const addressNumberRef = useRef(null)
  const lastLookupCepRef = useRef('')
  const lastShippingQuoteKeyRef = useRef('')
  const postalRequestRef = useRef(createLatestRequest())
  const postalControllerRef = useRef(null)
  const shippingQuoteRequestRef = useRef(createLatestRequest())
  const shippingQuoteControllerRef = useRef(null)
  const orderRequestRef = useRef(false)
  const paymentRequestRef = useRef(false)
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

  const changeThemeMode = (mode) => {
    setThemeMode(applyThemeMode(mode, { persist: true }))
  }

  useEffect(() => {
    api.get(`${storefrontApi}/context`)
      .then((context) => { setStoreContext(context?.storefront || null); return Promise.all([loadAllStorefrontProducts(({ limit, offset }) => api.get(`${storefrontApi}/products?limit=${limit}&offset=${offset}`)), api.get(`${storefrontApi}/shipping-methods`), api.get(`${storefrontApi}/payment-methods`).catch(() => ({ items: [] }))]).then(([data, shipping, payments]) => { setCatalogSource('core'); setProducts(normalizeCatalog(data, 'core', storeAlias)); const methods = shipping?.items || []; setShippingMethods(methods); const hasReadyDelivery = methods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled); const effectiveMode = delivery.mode === 'entrega' && !hasReadyDelivery ? 'retirada' : delivery.mode; if (effectiveMode !== delivery.mode) setDelivery({ mode: effectiveMode }); setShippingMethodId(methods.find(item => (effectiveMode === 'entrega' ? ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled : item.tipo === 'pickup'))?.id || ''); const availablePayments = payments?.items || []; setPaymentMethods(availablePayments); setSelectedPaymentMethod(current => current || paymentKey(availablePayments.find(item => item.method === 'pix') || availablePayments[0] || {})) }) })
      .catch(err => {
        if (storeAlias || err.status !== 404) throw err
        return api.get('/api/loja').then(data => { setCatalogSource('legacy'); setProducts(normalizeCatalog(data, 'legacy')) })
      })
      .catch(err => setError(err.message || 'Não foi possível carregar o catálogo.'))
      .finally(() => setLoading(false))
  }, [storefrontApi, storeAlias])

  useEffect(() => localStorage.setItem(cartStorageKey, JSON.stringify(cart)), [cart, cartStorageKey])
  useEffect(() => () => {
    postalRequestRef.current.invalidate()
    shippingQuoteRequestRef.current.invalidate()
    postalControllerRef.current?.abort()
    shippingQuoteControllerRef.current?.abort()
  }, [])
  useEffect(() => {
    if (catalogSource !== 'core' || order) return undefined
    cartSyncControllerRef.current?.abort()
    const controller = new AbortController()
    cartSyncControllerRef.current = controller
    const timer = window.setTimeout(() => {
      const validContact = checkoutContact.nome.trim().length >= 2 && shippingAddress.telefone.replace(/\D/g, '').length >= 10
      const consentPayload = recoveryPreference === null ? {} : recoveryPreference === false
        ? { recoveryConsent: false }
        : validContact ? {
            recoveryConsent: true,
            recoverySource: 'checkout_checkbox',
            recoveryEvidence: { checkbox: true, notice: 'Autorizo um único lembrete por WhatsApp sobre este carrinho. Posso revogar respondendo SAIR.', sourcePage: window.location.pathname },
            contact: { name: checkoutContact.nome.trim(), email: checkoutContact.email.trim(), phone: shippingAddress.telefone.trim() },
          } : {}
      api.post(`${storefrontApi}/cart`, { sessionKey: cartSessionKey, syncVersion: nextStorefrontCartSyncVersion(storeAlias), items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })), ...consentPayload }, { signal: controller.signal }).catch(() => {})
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      if (cartSyncControllerRef.current === controller) cartSyncControllerRef.current = null
    }
  }, [cart, cartSessionKey, catalogSource, checkoutContact.email, checkoutContact.nome, order, recoveryPreference, shippingAddress.telefone, storeAlias, storefrontApi])
  useEffect(() => localStorage.setItem(deliveryStorageKey, JSON.stringify(delivery)), [delivery, deliveryStorageKey])
  useEffect(() => {
    if (!products.length) return
    setCart(previous => previous.map(item => {
      const current = products.find(product => product.id === item.produtoId)
      const available = availableStock(current, item.variantId)
      return current && available > 0 ? { ...item, qtd: Math.min(item.qtd, available) } : null
    }).filter(Boolean))
  }, [products])

  const categories = useMemo(() => ['Todos', ...new Set(products.map(item => item.cat).filter(Boolean))], [products])
  // Atalhos do topo da Stallone: as 6 categorias com mais produtos publicados.
  const topCategories = useMemo(() => {
    const counts = new Map()
    for (const item of products) if (item.cat) counts.set(item.cat, (counts.get(item.cat) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 6)
  }, [products])
  function goToCategory(name) {
    setCategory(name)
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.requestAnimationFrame(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
  }
  const filtered = useMemo(() => sortCatalog(filterCatalog(products, { query, category, inStockOnly }), sort), [products, query, category, inStockOnly, sort])
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE)
  useEffect(() => setVisibleCount(CATALOG_PAGE_SIZE), [query, category, inStockOnly, sort])
  const catalogPage = useMemo(() => paginateCatalog(filtered, visibleCount), [filtered, visibleCount])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput), 220)
    return () => window.clearTimeout(timer)
  }, [searchInput])
  useEffect(() => {
    if (!addError) return undefined
    const timer = window.setTimeout(() => setAddError(''), 3800)
    return () => window.clearTimeout(timer)
  }, [addError])
  useEffect(() => {
    if (!cartOpen && !addedItem) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [cartOpen, addedItem])
  const cartCount = cart.reduce((sum, item) => sum + item.qtd, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.qtd * Number(item.preco || 0), 0)
  const pickupAvailable = catalogSource !== 'core' || shippingMethods.some(item => item.tipo === 'pickup')
  const pickupOnlyCart = cartHasPickupOnlyItems(cart, products)
  const deliveryConfigured = catalogSource !== 'core' || shippingMethods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)
  const deliveryAvailable = deliveryConfigured && !pickupOnlyCart
  const selectedShippingMethod = shippingMethods.find(item => item.id === shippingMethodId)
  const selectedShippingOption = shippingQuote?.items?.find(item => (item.selectionId || item.id) === shippingOptionId)
  const checkoutTotal = cartTotal + Number(selectedShippingOption?.amount || 0)
  const automaticShippingQuoteKey = shippingQuoteKey({ deliveryMode: delivery.mode, address: shippingAddress, cart })
  const shippingQuoteIsCurrent = Boolean(shippingQuote && automaticShippingQuoteKey && lastShippingQuoteKeyRef.current === automaticShippingQuoteKey)
  const selectedVariant = selectedProductVariant(selected, selectedVariantId)
  const requiredShippingTypes = delivery.mode === 'entrega' ? ['delivery', 'carrier'] : ['pickup']
  const quoteBlocked = catalogSource === 'core' && delivery.mode === 'entrega' && (!shippingQuoteIsCurrent || !shippingOptionId || !selectedShippingOption)
  const checkoutBlocked = catalogSource === 'core' && (!shippingMethods.length || !shippingMethodId || !requiredShippingTypes.includes(selectedShippingMethod?.tipo) || quoteBlocked)
  // Carrinho com congelados/refrigerados: troca para retirada quando possível.
  useEffect(() => {
    if (pickupOnlyCart && delivery.mode === 'entrega' && pickupAvailable) chooseDelivery('retirada')
  }, [pickupOnlyCart, delivery.mode, pickupAvailable])

  function chooseDelivery(mode) {
    setCheckoutError('')
    postalRequestRef.current.invalidate()
    shippingQuoteRequestRef.current.invalidate()
    postalControllerRef.current?.abort()
    shippingQuoteControllerRef.current?.abort()
    setAddressLookupLoading(false)
    setShippingQuoteLoading(false)
    lastLookupCepRef.current = ''
    lastShippingQuoteKeyRef.current = ''
    setDelivery(mode === 'entrega' ? { mode, endereco: delivery.endereco || '' } : { mode })
    setShippingQuote(null)
    setShippingOptionId('')
    if (catalogSource === 'core') { setShippingMethodId(shippingMethods.find(item => (mode === 'entrega' ? ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled : item.tipo === 'pickup'))?.id || ''); setShippingQuote(null); setShippingOptionId('') }
  }

  function changeShippingAddress(field, value) {
    setCheckoutError('')
    const normalizedValue = field === 'cep' ? formatCep(value) : field === 'estado' ? String(value || '').toUpperCase().slice(0, 2) : value
    const changedCep = field === 'cep' && String(shippingAddress.cep || '').replace(/\D/g, '') !== String(normalizedValue || '').replace(/\D/g, '')
    if (changedCep) lastLookupCepRef.current = ''
    if (['cep', 'cidade', 'estado'].includes(field)) {
      postalRequestRef.current.invalidate()
      shippingQuoteRequestRef.current.invalidate()
      postalControllerRef.current?.abort()
      shippingQuoteControllerRef.current?.abort()
      setAddressLookupLoading(false)
      setShippingQuoteLoading(false)
    }
    setShippingAddress(current => {
      if (field !== 'cep') return { ...current, [field]: normalizedValue }
      const changed = String(current.cep || '').replace(/\D/g, '') !== String(normalizedValue || '').replace(/\D/g, '')
      return changed
        ? { ...current, cep: normalizedValue, logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' }
        : { ...current, cep: normalizedValue }
    })
    if (['cep', 'cidade', 'estado'].includes(field)) {
      setShippingQuote(null)
      setShippingOptionId('')
      lastShippingQuoteKeyRef.current = ''
    }
  }

  async function lookupCep(value = shippingAddress.cep, { force = false } = {}) {
    const cep = String(value || '').replace(/\D/g, '')
    if (cep.length !== 8) return setCheckoutError('Informe um CEP com 8 dígitos.')
    if (!force && lastLookupCepRef.current === cep) return
    lastLookupCepRef.current = cep
    postalControllerRef.current?.abort()
    const controller = new AbortController()
    postalControllerRef.current = controller
    setAddressLookupLoading(true)
    setCheckoutError('')
    await postalRequestRef.current.run(
      () => api.get(`${storefrontApi}/shipping/address/${cep}`, { signal: controller.signal }),
      {
        success: address => {
          setShippingAddress(current => ({ ...current, ...address, cep: formatCep(address.cep || cep) }))
          setShippingQuote(null)
          setShippingOptionId('')
          window.setTimeout(() => addressNumberRef.current?.focus(), 0)
        },
        error: err => {
          lastLookupCepRef.current = ''
          if (err?.name !== 'AbortError') setCheckoutError(err.message || 'Não foi possível consultar o CEP. Complete o endereço manualmente ou tente novamente.')
        },
        settled: () => { setAddressLookupLoading(false); if (postalControllerRef.current === controller) postalControllerRef.current = null },
      },
    )
  }

  async function requestShippingQuote({ quoteKey = '' } = {}) {
    if (catalogSource !== 'core') return
    if (!deliveryAvailable) return setCheckoutError('Esta loja ainda não possui uma opção de entrega pronta.')
    if (shippingAddress.cep.replace(/\D/g, '').length !== 8) return setCheckoutError('Consulte um CEP válido antes de calcular o frete.')
    const effectiveQuoteKey = quoteKey || shippingQuoteKey({ deliveryMode: delivery.mode, address: shippingAddress, cart })
    shippingQuoteControllerRef.current?.abort()
    const controller = new AbortController()
    shippingQuoteControllerRef.current = controller
    setShippingQuoteLoading(true)
    setCheckoutError('')
    await shippingQuoteRequestRef.current.run(
      () => api.post(`${storefrontApi}/shipping/quotes/available`, { destinationCep: shippingAddress.cep, destination: { cep: shippingAddress.cep, cidade: shippingAddress.cidade, estado: shippingAddress.estado }, items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })) }, { signal: controller.signal }),
      {
        success: quote => {
          const first = recommendedShippingOption(quote)
          if (!first) throw new Error('Nenhuma opção de frete está disponível para este CEP e carrinho.')
          setShippingQuote(quote)
          setShippingOptionId(first.selectionId || first.id)
          setShippingMethodId(first.shippingMethodId || '')
          lastShippingQuoteKeyRef.current = effectiveQuoteKey
        },
        error: err => {
          if (err?.name !== 'AbortError') {
            lastShippingQuoteKeyRef.current = effectiveQuoteKey
            setCheckoutError(err.message || 'Não foi possível calcular o frete neste momento.')
          }
        },
        settled: () => { setShippingQuoteLoading(false); if (shippingQuoteControllerRef.current === controller) shippingQuoteControllerRef.current = null },
      },
    )
  }

  useEffect(() => {
    if (catalogSource !== 'core' || delivery.mode !== 'entrega') return undefined
    const cep = shippingAddress.cep.replace(/\D/g, '')
    if (cep.length !== 8 || cep === lastLookupCepRef.current) return undefined
    const timer = window.setTimeout(() => lookupCep(cep), 350)
    return () => window.clearTimeout(timer)
  }, [catalogSource, delivery.mode, shippingAddress.cep, storefrontApi])

  useEffect(() => {
    if (!automaticShippingQuoteKey || automaticShippingQuoteKey === lastShippingQuoteKeyRef.current || shippingQuoteLoading) return undefined
    const timer = window.setTimeout(() => requestShippingQuote({ quoteKey: automaticShippingQuoteKey }), 300)
    return () => window.clearTimeout(timer)
  }, [automaticShippingQuoteKey, shippingQuoteLoading])

  async function startPayment() {
    if (!order || !paymentMethods.length || paymentRequestRef.current) return
    const selectedPayment = paymentMethods.find(item => paymentKey(item) === selectedPaymentMethod) || paymentMethods.find(item => item.method === 'pix') || paymentMethods[0]
    if (!selectedPayment) return
    paymentRequestRef.current = true
    setPaymentLoading(true)
    setCheckoutError('')
    try {
      const code = order.codigo || order.publicCode || order.public_code
      const idempotencyKey = paymentIdempotencyKey || checkoutKey()
      if (!paymentIdempotencyKey) setPaymentIdempotencyKey(idempotencyKey)
      const payment = await api.post(`${storefrontApi}/orders/${encodeURIComponent(code)}/payments`, { provider: selectedPayment.provider, method: selectedPayment.method, idempotencyKey })
      setPaymentResult(payment)
    } catch (err) { setCheckoutError(err.message || 'Não foi possível iniciar o pagamento no gateway.') }
    finally { paymentRequestRef.current = false; setPaymentLoading(false) }
  }

  useEffect(() => {
    const code = order?.codigo || order?.publicCode || order?.public_code
    if (!code || !paymentResult) return undefined
    let active = true
    const refresh = async () => {
      try {
        const latest = await api.get(`${storefrontApi}/orders/${encodeURIComponent(code)}`)
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
      const path = catalogSource === 'core' ? `${storefrontApi}/orders/${encodeURIComponent(code)}` : `/api/loja/pedido/${encodeURIComponent(code)}`
      setTrackingOrder(await api.get(path))
    } catch (err) {
      setTrackingError(err.message || 'Não foi possível localizar este pedido.')
    } finally { setTrackingLoading(false) }
  }

  // Link enviado pelo atendimento no WhatsApp (?carrinho=...): monta o carrinho com o
  // catálogo e o estoque atuais, limpa o parâmetro da URL e abre o carrinho.
  const cartLinkAppliedRef = useRef(false)
  useEffect(() => {
    if (cartLinkAppliedRef.current || catalogSource !== 'core' || !products.length) return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get(CART_LINK_PARAM)
    if (!raw) return
    cartLinkAppliedRef.current = true
    const resolve = (variantId) => {
      const product = products.find(item => (item.variants || []).some(variant => variant.variantId === variantId))
      return product ? { product: selectedProductVariant(product, variantId), available: availableStock(product, variantId) } : null
    }
    const result = applyCartLink(cart, parseCartLink(raw), resolve)
    setCart(result.cart)
    setAddError(result.missing.length === 1 ? 'Um item do link não está mais disponível no momento. Confira o carrinho.' : result.missing.length > 1 ? `${result.missing.length} itens do link não estão mais disponíveis no momento. Confira o carrinho.` : '')
    params.delete(CART_LINK_PARAM)
    const search = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`)
    if (result.added.length) setCartOpen(true)
  }, [catalogSource, products]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isStalloneStorefront) return undefined
    // Aparece só quando a busca já passou para cima (rolando a vitrine), não antes dela.
    // Leitura de layout no máximo uma vez por quadro (rolagem passiva, sem travar a tela).
    let frame = 0
    const update = () => {
      frame = 0
      const element = toolbarRef.current
      setQuickbarVisible(Boolean(element) && element.getBoundingClientRect().bottom < 0)
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [isStalloneStorefront])
  // Todas as lojas: o detalhe do produto tem "Voltar à loja". O gesto/botão "voltar"
  // do celular e a tecla Esc fecham o detalhe e devolvem o cliente à vitrine, sem sair do site.
  const productHistoryRef = useRef(false)
  useEffect(() => {
    if (selected && !productHistoryRef.current) {
      productHistoryRef.current = true
      try { window.history.pushState({ ...(window.history.state || {}), stlProduct: true }, '') } catch { productHistoryRef.current = false }
    } else if (!selected && productHistoryRef.current) {
      productHistoryRef.current = false
      if (window.history.state?.stlProduct) window.history.back()
    }
    return undefined
  }, [selected])
  useEffect(() => {
    const onPop = () => {
      if (productHistoryRef.current && !window.history.state?.stlProduct) {
        productHistoryRef.current = false
        setSelected(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (!selected) return undefined
    const onKey = event => { if (event.key === 'Escape') setSelected(null) }
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { root.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [selected])
  function backToStore() { setSelected(null) }
  function cartFromProduct() { setSelected(null); setCartOpen(true) }
  function focusSearch() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    toolbarRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), reduce ? 0 : 350)
  }
  function openTracking() {
    setTrackingOpen(true)
    setTrackingError('')
    setTrackingOrder(null)
  }

  function openCheckout() {
    setCheckoutError('')
    if (catalogSource === 'core') {
      navigate(checkoutRoute)
      return
    }
    setCheckoutOpen(true)
  }

  function addToCart(product, qtd = 1) {
    const cartKey = product.variantId || product.id
    if (addLockRef.current.has(cartKey)) return
    const available = availableStock(product, product.variantId)
    const result = addProductToCart(cart, product, qtd, available)
    if (!result.ok) {
      setAddedItem(null)
      setAddError(result.reason === 'stock_limit'
        ? `Limite de estoque atingido: ${result.quantity} ${result.quantity === 1 ? 'unidade' : 'unidades'} de ${product.nome} já no carrinho.`
        : `${product.nome} está esgotado no momento.`)
      return
    }
    addLockRef.current.add(cartKey)
    setAddError('')
    setCart(result.cart)
    setSelected(null)
    setAddedItem({ key: cartKey, nome: product.nome, imagem: product.imagem, added: result.added, quantity: result.quantity })
    setJustAdded(current => ({ ...current, [cartKey]: true }))
    setCartBump(true)
    window.setTimeout(() => setCartBump(false), 450)
    window.setTimeout(() => {
      addLockRef.current.delete(cartKey)
      setJustAdded(current => { const next = { ...current }; delete next[cartKey]; return next })
    }, 650)
  }

  function clearSearch() { setSearchInput(''); setQuery('') }
  function clearFilters() { clearSearch(); setCategory('Todos'); setInStockOnly(false) }
  function openProduct(product) { setSelected(product); setSelectedVariantId(product.variantId || product.variants?.[0]?.variantId || '') }
  function describeCartItem(item) {
    const product = products.find(entry => entry.id === item.produtoId)
    const variant = selectedProductVariant(product, item.variantId)
    return { cod: variant?.cod || '', label: product?.variants?.length > 1 ? (variant?.label || '') : '', available: product ? availableStock(product, item.variantId) : item.qtd }
  }
  function checkoutFromCart() { setCartOpen(false); openCheckout() }

  function updateCart(productId, variantId, qtd) {
    setCheckoutError('')
    shippingQuoteRequestRef.current.invalidate()
    shippingQuoteControllerRef.current?.abort()
    setShippingQuoteLoading(false)
    setShippingQuote(null)
    setShippingOptionId('')
    lastShippingQuoteKeyRef.current = ''
    const product = products.find(item => item.id === productId)
    const available = availableStock(product, variantId)
    const cartKey = variantId || productId
    const safeQuantity = Math.min(Math.max(1, qtd), available)
    setCart(previous => qtd <= 0 || !available ? previous.filter(item => (item.variantId || item.produtoId) !== cartKey) : previous.map(item => (item.variantId || item.produtoId) === cartKey ? { ...item, qtd: safeQuantity } : item))
  }

  async function submitOrder(event) {
    event.preventDefault()
    if (orderRequestRef.current) return
    setCheckoutError('')
    const form = new FormData(event.currentTarget)
    const nome = String(form.get('nome') || '').trim()
    const email = String(form.get('email') || '').trim()
    if (!nome || !email) return setCheckoutError('Informe nome e e-mail para receber o acompanhamento do pedido.')
    if (catalogSource === 'core' && !shippingMethodId) return setCheckoutError('Selecione uma forma de entrega configurada pela loja.')
    if (delivery.mode === 'entrega' && (!shippingQuoteIsCurrent || !shippingOptionId || !selectedShippingOption)) return setCheckoutError('Consulte o CEP e recalcule o frete antes de confirmar o pedido.')
    if (delivery.mode === 'entrega' && (!shippingAddress.logradouro || !shippingAddress.numero || !shippingAddress.bairro || !shippingAddress.cidade || !shippingAddress.estado)) return setCheckoutError('Consulte o CEP e complete o endereço de entrega.')
    orderRequestRef.current = true
    setSubmitting(true)
    try {
      const observacao = String(form.get('observacao') || '').trim()
      const result = catalogSource === 'core'
        ? await api.post(`${storefrontApi}/orders`, {
            customer: { nome, email, telefone: String(form.get('tel') || '').trim() },
            items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
            idempotencyKey: checkoutIdempotency,
            cartSessionKey,
            shippingAddress: delivery.mode === 'entrega' ? { ...shippingAddress, destinatario: nome, email, telefone: String(form.get('tel') || '').trim(), documento: String(form.get('documento') || '').trim() } : { modo: 'retirada' },
            shippingMethodId: shippingMethodId || null,
            ...(delivery.mode === 'entrega' ? { shippingQuoteId: selectedShippingOption?.quoteId || shippingQuote.quoteId, shippingOptionId: selectedShippingOption?.id || shippingOptionId } : {}),
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
        localStorage.removeItem(cartStorageKey)
        localStorage.removeItem(storefrontStorageKey(storeAlias, 'cart_session'))
        setCartSessionKey(storefrontCartSessionKey(storeAlias))
        navigate(`${checkoutRoute}?order=${encodeURIComponent(code)}`)
        return
      }
      setOrder(result)
      setPaymentResult(null)
      setPaymentIdempotencyKey(checkoutKey())
      setCheckoutIdempotency(checkoutKey())
    } catch (err) {
      if (['SHIPPING_QUOTE_EXPIRED', 'SHIPPING_QUOTE_MISMATCH', 'SHIPPING_OPTION_INVALID'].includes(err.code)) {
        setShippingQuote(null)
        setShippingOptionId('')
        lastShippingQuoteKeyRef.current = ''
      }
      const shippingError = err.code === 'SHIPPING_QUOTE_MISMATCH'
        ? 'A cotação mudou porque o CEP, endereço ou carrinho foi atualizado. Recalcule o frete para continuar.'
        : err.code === 'SHIPPING_QUOTE_EXPIRED'
          ? 'A cotação expirou. Calcule o frete novamente para continuar.'
          : err.code === 'SHIPPING_OPTION_INVALID'
            ? 'A opção de frete ficou indisponível. Calcule o frete novamente e selecione outra opção.'
            : ''
      setCheckoutError(shippingError || err.message || 'Não foi possível registrar o pedido.')
    } finally { orderRequestRef.current = false; setSubmitting(false) }
  }

  const publicBrand = storeContext?.public || {}
  const operationalName = publicBrand.displayName || storeContext?.nome || (storeAlias ? storeAlias : 'Kytto Commerce')
  const brandName = commerceDisplayName(storeAlias, publicBrand.displayName, storeContext?.nome)
  useEffect(() => {
    const previous = document.title
    document.title = `${isDinoStorefront ? 'Dino Perfumaria' : isStalloneStorefront ? 'Stallone Nutre Sport' : brandName} | Loja online`
    return () => { document.title = previous }
  }, [brandName, isDinoStorefront, isStalloneStorefront])
  const brandTagline = publicBrand.tagline || 'Uma experiência de compra completa para produtos, serviços e operações locais — com catálogo, atendimento e gestão conectados.'
  const publicAddress = formatPublicAddress(publicBrand.address)
  const publicPhone = String(publicBrand.contact?.phone || '')
  const publicEmail = String(publicBrand.contact?.email || '')
  const publicPolicies = [
    ['Política de privacidade', publicBrand.policies?.privacyUrl],
    ['Trocas e devoluções', publicBrand.policies?.returnsUrl],
    ['Entrega e retirada', publicBrand.policies?.shippingUrl],
    ['Termos de uso', publicBrand.policies?.termsUrl],
  ].filter(([, url]) => url)

  return <main className="commerce-shell sf-ux" data-storefront-alias={storeAlias || undefined}>
    <a href="#catalogo" className="commerce-skip-link">Pular para o catálogo</a>
    {publicBrand.announcement?.enabled && publicBrand.announcement?.text && (
      <aside
        className="commerce-announcement-bar"
        style={{
          backgroundColor: publicBrand.announcement.bgColor || '#172033',
          color: publicBrand.announcement.textColor || '#FFFFFF',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          zIndex: 40
        }}
      >
        <span>{publicBrand.announcement.text}</span>
        {publicBrand.announcement.link && (
          <a
            href={publicBrand.announcement.link}
            style={{ color: 'inherit', textDecoration: 'underline', marginLeft: '6px' }}
          >
            Saiba mais →
          </a>
        )}
      </aside>
    )}
    {isStalloneStorefront ? <StalloneHero tagline={brandTagline} productCount={products.length} topCategories={topCategories} onCategory={goToCategory} onTrack={openTracking} catalogSource={catalogSource} /> : <section className="commerce-hero">
      {isDinoStorefront && <div className="commerce-dino-brandbar"><div className="commerce-dino-identity"><div className="commerce-dino-logo-frame"><img src={DINO_COMMERCE_LOGO} alt="Dino — Barbearia e Perfumaria" /></div><div className="commerce-dino-brand-copy"><span>Dino</span><strong>Barbearia &amp; Perfumaria</strong><small>Estilo, cuidado e presença.</small></div></div><div className="commerce-dino-theme" role="group" aria-label="Tema da loja">{[["system", Monitor, "Sistema"], ["light", Sun, "Claro"], ["dark", Moon, "Escuro"]].map(([mode, Icon, label]) => <button type="button" key={mode} onClick={() => changeThemeMode(mode)} className={themeMode === mode ? 'active' : ''} aria-pressed={themeMode === mode} title={`Tema ${label.toLowerCase()}`}><Icon size={14} /><span>{label}</span></button>)}</div></div>}
      <div>
        <span className="commerce-eyebrow"><Store size={14} /> {brandName}</span>
        <h1>{isDinoStorefront ? <>Autocuidado, estilo e bem-estar. <em>Compre com confiança.</em></> : <>Venda melhor. <em>Opere com inteligência.</em></>}</h1>
        <p>{brandTagline}</p>
        <div className="commerce-hero-actions">
          <a className="commerce-button commerce-button-primary" href="#catalogo">Explorar catálogo <ArrowRight size={16} /></a>
          <button type="button" className="commerce-button commerce-button-quiet" onClick={openTracking}>Acompanhar pedido</button>
        </div>
      </div>
      <div className="commerce-hero-orbit" aria-hidden="true"><span>CATÁLOGO</span><span>ESTOQUE</span><span>PEDIDOS</span><strong>∞</strong></div>
      <div className="commerce-channel-status" role="status"><span className={catalogSource === 'core' ? 'is-live' : ''}>{catalogSource === 'core' ? 'Estoque atualizado' : catalogSource === 'legacy' ? 'Catálogo da loja' : 'Conectando catálogo'}</span><small>{catalogSource === 'core' ? 'Disponibilidade confirmada ao finalizar a compra.' : 'Disponibilidade sujeita à confirmação da loja.'}</small></div>
    </section>}

    <section className="commerce-toolbar" id="catalogo" ref={toolbarRef}>
      <div className="sf-search" role="search"><Search size={18} aria-hidden="true" /><input ref={searchInputRef} type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && searchInput) { event.preventDefault(); clearSearch() } }} placeholder={isStalloneStorefront ? 'Buscar whey, creatina…' : 'Buscar produto, SKU ou categoria'} aria-label="Buscar produto, SKU ou categoria" autoComplete="off" enterKeyHint="search" />{searchInput && <button type="button" className="sf-search-clear" onClick={clearSearch} aria-label="Limpar busca"><X size={17} /></button>}</div>
      <div className="commerce-categories" role="group" aria-label="Filtrar por categoria">
        {categories.map(item => <button key={item} type="button" aria-pressed={category === item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <button type="button" className={`commerce-cart-button ${cartBump ? 'is-bumped' : ''}`} onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}><ShoppingBag size={19} aria-hidden="true" /><span>Carrinho</span><b className={cartCount ? '' : 'is-empty'} aria-hidden="true">{cartCount}</b></button>
      {!isStalloneStorefront && <div className="sf-catalog-options"><label><input type="checkbox" checked={inStockOnly} onChange={event => setInStockOnly(event.target.checked)} /> Somente em estoque</label><label>Ordenar por <select value={sort} onChange={event => setSort(event.target.value)}><option value="available">Disponibilidade</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option></select></label></div>}
    </section>
    {isStalloneStorefront && <nav className={`stl-quickbar${quickbarVisible && !cartOpen && !addedItem && !selected ? ' is-visible' : ''}`} aria-label="Atalhos da loja" aria-hidden={!(quickbarVisible && !cartOpen && !addedItem && !selected)}>
      <button type="button" onClick={focusSearch} tabIndex={quickbarVisible ? 0 : -1}><Search size={18} aria-hidden="true" /><span>Buscar</span></button>
      <button type="button" className="is-cart" onClick={() => setCartOpen(true)} tabIndex={quickbarVisible ? 0 : -1} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}><ShoppingBag size={18} aria-hidden="true" /><span>Carrinho</span><b aria-hidden="true">{cartCount}</b></button>
    </nav>}
    {isStalloneStorefront && <div className="stl-catalog-bar">
      <p aria-live="polite">{loading ? 'Carregando produtos…' : <><strong>{filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</strong>{category !== 'Todos' ? ` em ${category}` : ''}{query ? ` para “${query}”` : ''}</>}</p>
      <div className="stl-catalog-controls">
        <label className="stl-switch"><input type="checkbox" role="switch" checked={inStockOnly} onChange={event => setInStockOnly(event.target.checked)} /><span aria-hidden="true" />Só em estoque</label>
        <label className="stl-sort"><span>Ordenar</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="available">Disponibilidade</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option></select></label>
      </div>
    </div>}

    {loading && <div className="commerce-state"><Loader2 className="commerce-spin" /> Carregando catálogo…</div>}
    {!loading && error && <div className="commerce-state commerce-state-error">{error}</div>}
    {!isStalloneStorefront && !loading && !error && (query || category !== 'Todos' || inStockOnly) && <p className="sf-results-meta" aria-live="polite">{filtered.length === 1 ? '1 produto encontrado' : `${filtered.length} produtos encontrados`}</p>}
    {!loading && !error && <section className="commerce-product-grid" aria-label="Produtos">
      {catalogPage.items.map(product => {
        const stock = stockState(product)
        const cartKey = product.variantId || product.id
        const added = Boolean(justAdded[cartKey])
        return <article className={`commerce-product-card ${stock.kind === 'out' ? 'is-soldout' : ''}`} key={product.id}>
          <button type="button" className="commerce-product-open" onClick={() => openProduct(product)} aria-label={`Ver detalhes de ${product.nome}`}>{stock.kind !== 'ok' && <span className={`sf-stock-badge is-${stock.kind}`}>{stock.label}</span>}<ProductImage product={product} /></button>
          <div className="commerce-product-content"><span>{product.cat || 'Produto'}</span><h2 title={product.nome}>{product.nome}</h2><p>{product.descricao || `Produto disponível no catálogo ${brandName}.`}</p><button type="button" className="commerce-product-details-button" onClick={() => openProduct(product)}><Eye size={15} aria-hidden="true" /> Ver detalhes</button><div className="commerce-product-buy"><div className="commerce-price"><strong>{money(product.preco)}</strong>{product.promocaoAtiva && <s>{money(product.precoOriginal)}</s>}</div>{stock.kind === 'ok' && <span className="sf-stock-line">Em estoque</span>}{isPickupOnlyProduct(product) && <span className="sf-pickup-only">Somente retirada na loja</span>}{stock.kind === 'backorder' && <span className="sf-stock-line">Sob encomenda · +10 dias úteis</span>}<button type="button" className={`sf-add ${added ? 'is-added' : ''}`} onClick={() => addToCart(product)} disabled={stock.kind === 'out' || added} aria-label={stock.kind === 'out' ? `${product.nome} — esgotado` : `Adicionar ${product.nome} ao carrinho`}>{stock.kind === 'out' ? 'Esgotado' : added ? <><Check size={17} aria-hidden="true" /> Adicionado</> : <><ShoppingBag size={17} aria-hidden="true" /> Adicionar</>}</button></div></div>
        </article>
      })}
      {catalogPage.hasMore && <div className="sf-load-more"><button type="button" className="sf-btn sf-btn-secondary" onClick={() => setVisibleCount(count => count + CATALOG_PAGE_SIZE)}>Mostrar mais produtos</button><small aria-live="polite">Exibindo {catalogPage.items.length} de {catalogPage.total}</small></div>}
      {!filtered.length && <div className="sf-empty" role="status"><strong>Nenhum produto encontrado</strong><p>Tente outro nome, SKU ou categoria.</p><button type="button" className="sf-btn sf-btn-secondary" onClick={clearFilters}>Limpar filtros</button></div>}
    </section>}

    <section className="commerce-trust-grid">
      <div><strong>Compra assistida</strong><span>Atendimento conectado à operação da loja.</span></div>
      <div><strong>Estoque em tempo real</strong><span>Disponibilidade validada antes do pedido.</span></div>
      <div><strong>Pedido rastreável</strong><span>Acompanhe cada etapa com seu código.</span></div>
    </section>

    {(publicAddress || publicPhone || publicEmail || publicPolicies.length > 0) && <section className="commerce-store-details" aria-label="Informações da loja">
      <div><span className="commerce-eyebrow">Retirada e atendimento</span><h2>{operationalName}</h2>{publicAddress && <address>{publicAddress}</address>}{publicBrand.pickup?.instructions && <p>{publicBrand.pickup.instructions}</p>}{Number(publicBrand.pickup?.leadTimeHours) > 0 && <small>Prazo de preparação para retirada: até {publicBrand.pickup.leadTimeHours} hora(s).</small>}</div>
      <div className="commerce-store-contact">{publicPhone && <a href={`tel:${publicPhone}`}><strong>Telefone</strong><span>{publicPhone}</span></a>}{publicEmail && <a href={`mailto:${publicEmail}`}><strong>E-mail</strong><span>{publicEmail}</span></a>}</div>
      {publicPolicies.length > 0 && <nav aria-label="Políticas da loja">{publicPolicies.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>)}</nav>}
    </section>}

    {selected && <div className="commerce-overlay sf-product-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do produto" onClick={event => { if (event.target === event.currentTarget) backToStore() }}><div className="commerce-modal commerce-product-modal sf-product-sheet"><div className="sf-sheet-top"><button type="button" className="sf-back" onClick={backToStore} autoFocus><ArrowLeft size={18} aria-hidden="true" /><span>Voltar à loja</span></button><button type="button" className="sf-sheet-cart" onClick={cartFromProduct} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}><ShoppingBag size={18} aria-hidden="true" />{cartCount > 0 && <b aria-hidden="true">{cartCount}</b>}</button></div><ProductGallery product={selectedVariant} /><div><span className="commerce-eyebrow">{selected.cat || 'Produto'}</span><h2>{selected.nome}</h2><p>{selected.descricao || 'Produto disponível no catálogo Kytto.'}</p>{selectedVariant.descricaoDetalhada && selectedVariant.descricaoDetalhada !== selectedVariant.descricao && <p className="commerce-product-long-description">{selectedVariant.descricaoDetalhada}</p>}<div className="commerce-product-meta"><span><small>SKU</small><strong>{selectedVariant.cod || '—'}</strong></span><span><small>Disponibilidade</small><strong>{selectedVariant.permiteCompraSemEstoque && selectedVariant.estoque <= 0 ? 'Sob encomenda' : selectedVariant.esgotado ? 'Esgotado' : `${selectedVariant.estoque} em estoque`}</strong></span></div>{selected.variants?.length > 1 && <label className="commerce-variant-select">Variação<select value={selectedVariant.variantId || ''} onChange={event => setSelectedVariantId(event.target.value)}>{selected.variants.map(variant => <option key={variant.variantId} value={variant.variantId}>{variant.label || variant.cod || 'Opção'}{variant.esgotado ? ' · esgotado' : ''}</option>)}</select></label>}<div className="sf-sheet-buy"><div className="commerce-modal-price"><strong>{money(selectedVariant.preco)}</strong>{selectedVariant.promocaoAtiva && <s>{money(selectedVariant.precoOriginal)}</s>}</div><div className="commerce-modal-actions"><button type="button" className="commerce-button commerce-button-primary" disabled={selectedVariant.esgotado} onClick={() => addToCart(selectedVariant)}>{selectedVariant.esgotado ? 'Produto esgotado' : selectedVariant.permiteCompraSemEstoque && selectedVariant.estoque <= 0 ? 'Comprar sob encomenda' : 'Adicionar ao carrinho'} <ShoppingBag size={16} /></button><small>{selectedVariant.esgotado ? 'Sem estoque no momento.' : selectedVariant.permiteCompraSemEstoque && selectedVariant.estoque <= 0 ? 'Prazo de entrega: +10 dias úteis por encomenda.' : `${selectedVariant.estoque} unidade(s) disponíveis`}</small></div></div></div></div></div>}

    {checkoutOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Carrinho e checkout"><div className="commerce-modal commerce-checkout-modal"><button type="button" className="commerce-close" onClick={() => setCheckoutOpen(false)} aria-label="Fechar"><X size={18} /></button><div className="commerce-modal-heading"><span className="commerce-eyebrow">Checkout</span><h2>Finalize seu pedido</h2><p>O pedido será encaminhado para a operação da loja e você receberá um código de acompanhamento.</p></div><div className="commerce-checkout-layout"><div className="commerce-cart-list">{cart.map(item => <div className="commerce-cart-row" key={`${item.produtoId}-${item.variantId || 'base'}`}><ProductImage product={item} /><div><strong>{item.nome}</strong><span>{money(item.preco)} cada</span></div><QuantityControl value={item.qtd} max={Math.max(1, availableStock(products.find(product => product.id === item.produtoId), item.variantId))} onChange={value => updateCart(item.produtoId, item.variantId, value)} /><b>{money(item.qtd * item.preco)}</b></div>)}<div className="commerce-cart-total"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>{selectedShippingOption && <div className="commerce-cart-total commerce-cart-shipping"><span>Frete · {selectedShippingOption.name}<small>{shippingOptionMeta(selectedShippingOption)}</small></span><strong>{money(selectedShippingOption.amount)}</strong></div>}<div className="commerce-cart-total"><span>Total{selectedShippingMethod?.tipo === 'pickup' ? ' · retirada' : ''}</span><strong>{money(checkoutTotal)}</strong></div></div><form id="commerce-inline-checkout-form" className="commerce-form" onSubmit={submitOrder}>
<label>Nome completo<input name="nome" autoComplete="name" required value={checkoutContact.nome} onChange={event => setCheckoutContact(current => ({ ...current, nome: event.target.value }))} /></label><label>E-mail<input name="email" type="email" autoComplete="email" required value={checkoutContact.email} onChange={event => setCheckoutContact(current => ({ ...current, email: event.target.value }))} /></label><label>WhatsApp ou telefone<input name="tel" autoComplete="tel" value={shippingAddress.telefone} onChange={event => changeShippingAddress('telefone', event.target.value)} /></label><label className="commerce-recovery-consent"><input type="checkbox" checked={recoveryPreference === true} onChange={event => setRecoveryPreference(event.target.checked)} /><span><strong>Lembrar meu carrinho por WhatsApp</strong><small>Opcional. Autorizo um único lembrete. Posso revogar desmarcando ou respondendo SAIR.</small></span></label><fieldset className="commerce-delivery-methods"><legend>Como receber</legend><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'retirada'} disabled={!pickupAvailable} onChange={() => chooseDelivery('retirada')} /> Retirada no local</label><label className="commerce-radio"><input type="radio" name="delivery" checked={delivery.mode === 'entrega'} disabled={!deliveryAvailable} onChange={() => chooseDelivery('entrega')} /> Entrega/delivery</label></fieldset>{pickupOnlyCart && <small className="commerce-delivery-unavailable" role="status">{PICKUP_ONLY_NOTE}</small>}{catalogSource === 'core' && !deliveryConfigured && <small className="commerce-delivery-unavailable">Nenhuma forma de entrega está ativa para este storefront. Configure uma retirada ou uma entrega própria no backoffice para liberar o checkout.</small>}{catalogSource === 'core' && delivery.mode === 'retirada' && <label>Forma de retirada<select value={shippingMethodId} onChange={event => setShippingMethodId(event.target.value)} disabled={!shippingMethods.length} required><option value="">Selecione uma opção configurada</option>{shippingMethods.filter(method => method.tipo === 'pickup').map(method => <option key={method.id} value={method.id}>{method.nome}</option>)}</select>{!shippingMethods.length && <small>Nenhum método publicado para este storefront.</small>}{selectedShippingMethod?.tipo === 'pickup' && <small>Retirada confirmada no local. O pagamento será concluído conforme gateway homologado.</small>}</label>}{catalogSource === 'core' && delivery.mode === 'entrega' && <small className="commerce-delivery-unavailable">Informe o CEP para visualizar todas as opções próprias e transportadoras disponíveis para o carrinho.</small>}{delivery.mode === 'entrega' && <div className="commerce-address-fields"><label>CPF ou CNPJ do destinatário<input name="documento" inputMode="numeric" autoComplete="shipping" required value={shippingAddress.documento} onChange={event => changeShippingAddress('documento', event.target.value)} /></label><label className="commerce-cep-field">CEP<div className="commerce-inline-field"><input name="cep" inputMode="numeric" autoComplete="shipping postal-code" required value={shippingAddress.cep} onChange={event => changeShippingAddress('cep', formatCep(event.target.value))} onBlur={() => shippingAddress.cep.replace(/\D/g, '').length === 8 && lookupCep(shippingAddress.cep)} placeholder="00000-000" /><button type="button" className="commerce-button commerce-button-quiet" onClick={() => lookupCep(shippingAddress.cep, { force: true })} disabled={addressLookupLoading}>{addressLookupLoading ? 'Consultando…' : 'Consultar CEP'}</button></div></label><label>Logradouro<input name="logradouro" autoComplete="shipping address-line1" required value={shippingAddress.logradouro} onChange={event => changeShippingAddress('logradouro', event.target.value)} /></label><label>Número<input ref={addressNumberRef} name="numero" autoComplete="shipping address-line2" required value={shippingAddress.numero} onChange={event => changeShippingAddress('numero', event.target.value)} /></label><label>Bairro<input name="bairro" autoComplete="shipping address-level3" required value={shippingAddress.bairro} onChange={event => changeShippingAddress('bairro', event.target.value)} /></label><label>Cidade<input name="cidade" autoComplete="shipping address-level2" required value={shippingAddress.cidade} onChange={event => changeShippingAddress('cidade', event.target.value)} /></label><label>UF<input name="estado" maxLength="2" autoComplete="shipping address-level1" required value={shippingAddress.estado} onChange={event => changeShippingAddress('estado', event.target.value.toUpperCase())} /></label><label>Complemento<input name="complemento" value={shippingAddress.complemento} onChange={event => changeShippingAddress('complemento', event.target.value)} /></label><label className="wide">Referência<input name="referencia" value={shippingAddress.referencia} onChange={event => changeShippingAddress('referencia', event.target.value)} /></label>{deliveryAvailable ? <div className="commerce-shipping-quote-box wide"><div className="commerce-quote-heading"><strong>Opções de frete</strong><button type="button" className="commerce-button commerce-button-quiet" onClick={requestShippingQuote} disabled={shippingQuoteLoading || !cart.length}>{shippingQuoteLoading ? 'Calculando…' : shippingQuote ? 'Atualizar cotação' : 'Calcular frete'}</button></div>{shippingQuote?.expiresAt && <small>Cotação válida até {new Date(shippingQuote.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</small>}<div className="commerce-shipping-options">{shippingQuote?.items?.map(option => { const selectionId = option.selectionId || option.id; return <label className="commerce-shipping-option" key={selectionId}><input type="radio" name="shippingOption" value={selectionId} checked={shippingOptionId === selectionId} onChange={event => { setShippingOptionId(event.target.value); setShippingMethodId(option.shippingMethodId || shippingMethodId) }} /><span><strong>{option.name}</strong><small>{shippingOptionMeta(option)}</small></span><b>{money(option.amount)}</b></label> })}</div>{!shippingQuote && <small>Informe o CEP e calcule o frete para continuar.</small>}</div> : <small className="wide">Esta forma de entrega ainda não está conectada a um cotador real.</small>}</div>}<label>Observação<textarea name="observacao" rows="2" placeholder="Preferências ou instruções para a loja" /></label>{catalogSource === 'core' && <label>Cupom de desconto<input name="promotionCode" placeholder="Código do cupom (opcional)" /></label>}{checkoutError && <div className="commerce-form-error">{checkoutError}</div>}<button className="commerce-button commerce-button-primary" type="submit" disabled={submitting || addressLookupLoading || shippingQuoteLoading || !cart.length || checkoutBlocked}>{submitting ? <><Loader2 className="commerce-spin" size={16} /> Enviando…</> : <>Confirmar pedido <ArrowRight size={16} /></>}</button>{checkoutBlocked && <small className="commerce-checkout-note">{delivery.mode === 'entrega' && deliveryAvailable ? 'Informe o CEP; o frete será calculado e incluído no total antes de avançar.' : 'A loja ainda não publicou uma forma de entrega para este canal.'}</small>}</form></div></div></div>}

    {trackingOpen && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Acompanhar pedido"><div className="commerce-modal commerce-tracking-modal"><button type="button" className="commerce-close" onClick={() => setTrackingOpen(false)} aria-label="Fechar"><X size={18} /></button><span className="commerce-eyebrow">Acompanhamento</span><h2>Onde está seu pedido?</h2><p>Informe o código recebido após a confirmação. A consulta usa somente o canal desta loja.</p><form className="commerce-tracking-form" onSubmit={findOrder}><label>Código do pedido<input value={trackingCode} onChange={event => setTrackingCode(event.target.value)} placeholder="Ex.: LJ-123456" autoComplete="off" /></label><button type="submit" className="commerce-button commerce-button-primary" disabled={trackingLoading}>{trackingLoading ? <><Loader2 className="commerce-spin" size={16} /> Consultando…</> : <>Consultar <ArrowRight size={16} /></>}</button></form>{trackingError && <div className="commerce-form-error" role="alert">{trackingError}</div>}{trackingOrder && <div className="commerce-tracking-result" aria-live="polite"><span className="commerce-eyebrow">Pedido encontrado</span><strong>{trackingOrder.codigo || trackingOrder.publicCode || trackingOrder.public_code}</strong><b>{trackingOrder.status || 'Em processamento'}</b><small>Atualizado em {trackingOrder.atualizado_em ? new Date(trackingOrder.atualizado_em).toLocaleString('pt-BR') : '—'}</small>{trackingOrder.fulfillments?.map(item => <div className="commerce-tracking-fulfillment" key={item.id || `${item.status}-${item.trackingCode}`}><b>{item.carrier || 'Entrega'} · {item.status}</b>{item.trackingCode && <span>Código: {item.trackingCode}</span>}{item.trackingUrl && <a href={item.trackingUrl} target="_blank" rel="noreferrer">Abrir rastreio</a>}{item.ocorrencias?.slice?.(-3).map((event, index) => <small key={`${event.at || index}`}>{event.description || event.status}</small>)}</div>)}</div>}</div></div>}

    {publicBrand.contact?.whatsapp && (
      <a
        href={`https://wa.me/${publicBrand.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Olá! Vim da loja online ${brandName} e gostaria de tirar uma dúvida.`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#25D366',
          color: '#FFFFFF',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(37, 211, 102, 0.45)',
          zIndex: 99,
          textDecoration: 'none'
        }}
        title="Fale Conosco no WhatsApp"
        aria-label="Fale Conosco no WhatsApp"
      >
        <MessageSquare size={28} />
      </a>
    )}

    {order && <div className="commerce-overlay" role="dialog" aria-modal="true" aria-label="Pedido criado"><div className="commerce-modal commerce-success-modal"><CheckCircle2 size={42} /><span className="commerce-eyebrow">Pedido recebido</span><h2>Seu pedido está na fila.</h2><p>Guarde o código abaixo para acompanhar o preparo.</p><strong className="commerce-order-code">{order.codigo || order.publicCode || order.public_code}</strong>{checkoutError && <div className="commerce-form-error" role="alert">{checkoutError}</div>}{paymentMethods.length ? <div className="commerce-payment-box"><strong>Forma de pagamento</strong><small>Escolha um método publicado pela loja. Pix e cartão dependem do gateway; “Marcar na conta” valida o crediário aprovado do cliente.</small><div className="commerce-payment-methods" role="radiogroup" aria-label="Método de pagamento">{paymentMethods.map(item => <label key={paymentKey(item)} className="commerce-payment-method"><input type="radio" name="publicPaymentMethod" value={paymentKey(item)} checked={selectedPaymentMethod === paymentKey(item)} onChange={event => setSelectedPaymentMethod(event.target.value)} disabled={paymentLoading || Boolean(paymentResult)} /><span><strong>{paymentLabel(item)}</strong><small>{item.provider === 'mercadopago' ? 'Mercado Pago' : item.provider === 'infinitepay' ? 'InfinitePay' : item.provider === 'crediario' ? 'Crediário da loja' : item.provider}</small></span></label>)}</div><button type="button" className="commerce-button commerce-button-primary" onClick={startPayment} disabled={paymentLoading || paymentResult || !selectedPaymentMethod}>{paymentLoading ? <><Loader2 className="commerce-spin" size={16} /> Iniciando pagamento…</> : paymentResult ? 'Pagamento iniciado' : `Pagar com ${paymentLabel(paymentMethods.find(item => paymentKey(item) === selectedPaymentMethod))}`}</button>{paymentResult?.checkout?.qrCodeBase64 && <img className="commerce-pix-qr" src={`data:image/png;base64,${paymentResult.checkout.qrCodeBase64}`} alt="QR Code Pix gerado pelo gateway" />}{paymentResult?.checkout?.qrCode && <div className="commerce-pix-copy"><small>Pix copia e cola</small><code>{paymentResult.checkout.qrCode}</code><button type="button" className="commerce-button commerce-button-quiet" onClick={() => navigator.clipboard?.writeText(paymentResult.checkout.qrCode)}>Copiar código</button></div>}{paymentResult?.checkout?.ticketUrl && <a className="commerce-button commerce-button-quiet" href={paymentResult.checkout.ticketUrl} target="_blank" rel="noreferrer">Abrir checkout do provedor</a>}{paymentResult && <small>Status informado pelo gateway: {paymentResult.checkout?.status || paymentResult.status || 'pending'}. Status persistido do pedido: {order.payment_status || 'aguardando webhook'}. Esta tela atualiza automaticamente.</small>}</div> : <div className="commerce-payment-box commerce-payment-unavailable"><strong>Pagamento online ainda não habilitado</strong><small>A loja precisa concluir a homologação e configurar um gateway real. Nenhum pagamento foi simulado.</small></div>}<button type="button" className="commerce-button commerce-button-primary" onClick={() => { setOrder(null); setTrackingCode(order.codigo || order.publicCode || order.public_code || ''); openTracking() }}>Acompanhar pedido <ArrowRight size={16} /></button><button type="button" className="commerce-button commerce-button-quiet" onClick={() => setOrder(null)}>Voltar ao catálogo</button></div></div>}
    <AddToCartSuccess item={addedItem} onClose={() => setAddedItem(null)} onViewCart={() => { setAddedItem(null); setCartOpen(true) }} />
    <CartDrawer open={cartOpen} cart={cart} describe={describeCartItem} money={money} onClose={() => setCartOpen(false)} onChangeQty={(item, qtd) => updateCart(item.produtoId, item.variantId, qtd)} onRemove={item => updateCart(item.produtoId, item.variantId, 0)} onCheckout={checkoutFromCart} checkoutDisabled={!cart.length} />
    {addError && <div className="sf-toast" role="alert"><AlertCircle size={18} aria-hidden="true" /> {addError}</div>}
  </main>
}
