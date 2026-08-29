import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, ShieldCheck, Store } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'

const CART_KEY = 'kytto_commerce_cart'
const EMPTY_ADDRESS = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' }

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function money(value) { return fmtR(Number(value || 0)) }
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

function paymentIdempotencyKey(code, provider, method) {
  const storageKey = `kytto_payment_attempt:${String(code || '').toUpperCase()}:${provider}:${method}`
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderCode = searchParams.get('order') || searchParams.get('order_nsu') || ''
  const returnTransactionNsu = searchParams.get('transaction_nsu') || searchParams.get('transactionNsu') || ''
  const returnSlug = searchParams.get('slug') || searchParams.get('invoice_slug') || ''
  const [cart, setCart] = useState(readCart)
  const [products, setProducts] = useState([])
  const [shippingMethods, setShippingMethods] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [shippingMethodId, setShippingMethodId] = useState('')
  const [shippingQuote, setShippingQuote] = useState(null)
  const [shippingOptionId, setShippingOptionId] = useState('')
  const [address, setAddress] = useState(EMPTY_ADDRESS)
  const [deliveryMode, setDeliveryMode] = useState('retirada')
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', documento: '' })
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [selectedPayment, setSelectedPayment] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const paymentRequestRef = useRef(false)

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.preco || 0) * Number(item.qtd || 0), 0), [cart])
  const selectedShipping = shippingMethods.find(item => String(item.id) === String(shippingMethodId))
  const selectedOption = shippingQuote?.items?.find(item => item.id === shippingOptionId)
  const total = cartTotal + Number(selectedOption?.amount || 0)
  const deliveryAvailable = shippingMethods.some(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)
  const pickupAvailable = shippingMethods.some(item => item.tipo === 'pickup')
  const paymentReady = Boolean(order && payment)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [context, catalog, shipping, payments] = await Promise.all([
          api.get('/api/storefront/context'),
          api.get('/api/storefront/products'),
          api.get('/api/storefront/shipping-methods'),
          api.get('/api/storefront/payment-methods'),
        ])
        if (!active) return
        const methods = shipping?.items || []
        const methodsPayments = payments?.items || []
        if (!context?.capabilities?.checkout) throw new Error('Checkout não está habilitado para este storefront.')
        setProducts(catalog?.items || [])
        setShippingMethods(methods)
        setPaymentMethods(methodsPayments)
        setSelectedPayment(methodsPayments[0] ? `${methodsPayments[0].provider}:${methodsPayments[0].method}` : '')
        const initialShipping = methods.find(item => item.tipo === 'pickup') || methods[0]
        if (initialShipping) setShippingMethodId(initialShipping.id)
        if (orderCode) {
          const existing = await api.get(`/api/storefront/orders/${encodeURIComponent(orderCode)}`)
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
  }, [orderCode])

  useEffect(() => {
    if (!order?.public_code || payment || !returnTransactionNsu || !returnSlug) return undefined
    let active = true
    const reconcileReturn = async () => {
      setWorking(true); setError('')
      try {
        const result = await api.post(`/api/storefront/orders/${encodeURIComponent(order.public_code)}/payments/return`, { transactionNsu: returnTransactionNsu, slug: returnSlug })
        if (active) setPayment({ provider: 'infinitepay', status: result.status, returnConfirmed: true })
      } catch (err) { if (active) setError(err.message || 'Não foi possível confirmar o retorno do provedor.') }
      finally { if (active) setWorking(false) }
    }
    reconcileReturn()
    return () => { active = false }
  }, [order?.public_code, payment, returnTransactionNsu, returnSlug])

  useEffect(() => {
    if (!order?.public_code || payment?.checkout) return undefined
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const latest = await api.get(`/api/storefront/orders/${encodeURIComponent(order.public_code)}`)
        if (active) setOrder(current => current ? { ...current, ...latest } : latest)
      } catch { /* o acompanhamento manual continua disponível */ }
    }, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [order?.public_code, payment?.checkout])

  async function quoteShipping() {
    if (!selectedShipping?.quoteEnabled) return setError('Este método ainda não possui cotação configurada.')
    if (address.cep.replace(/\D/g, '').length !== 8) return setError('Informe um CEP válido antes de calcular o frete.')
    setWorking(true); setError('')
    try {
      const quote = await api.post('/api/storefront/shipping/quotes', { shippingMethodId, destinationCep: address.cep, items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })) })
      setShippingQuote(quote)
      setShippingOptionId(quote.items?.[0]?.id || '')
    } catch (err) { setError(err.message || 'Não foi possível calcular o frete.') }
    finally { setWorking(false) }
  }

  function updateAddress(key, value) {
    setAddress(current => ({ ...current, [key]: value }))
    if (key === 'cep') { setShippingQuote(null); setShippingOptionId('') }
  }

  async function createOrder(event) {
    event.preventDefault()
    setError('')
    if (!form.nome.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setError('Informe nome e e-mail válidos.')
    if (!shippingMethodId) return setError('A loja ainda não publicou uma forma de entrega.')
    if (deliveryMode === 'entrega' && (!shippingQuote || !shippingOptionId)) return setError('Calcule o frete e selecione uma opção antes de continuar.')
    setWorking(true)
    try {
      const created = await api.post('/api/storefront/orders', {
        customer: { nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.trim() },
        items: cart.map(item => ({ variantId: item.variantId, quantity: item.qtd })),
        idempotencyKey: idem('order'),
        shippingAddress: deliveryMode === 'entrega' ? { ...address, destinatario: form.nome, email: form.email, telefone: form.telefone, documento: form.documento } : { modo: 'retirada' },
        shippingMethodId,
        ...(deliveryMode === 'entrega' ? { shippingQuoteId: shippingQuote.quoteId, shippingOptionId } : {}),
      })
      const code = created.codigo || created.publicCode || created.public_code
      localStorage.removeItem(CART_KEY)
      setCart([])
      setOrder(created)
      navigate(`/checkout?order=${encodeURIComponent(code)}`, { replace: true })
    } catch (err) { setError(err.message || 'Não foi possível criar o pedido.') }
    finally { setWorking(false) }
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
      const result = await api.post(`/api/storefront/orders/${encodeURIComponent(code)}/payments`, { provider, method, idempotencyKey: paymentIdempotencyKey(code, provider, method) }, { signal: controller.signal })
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

  if (!order && !cart.length) return <main className="checkout-page"><div className="checkout-empty"><div className="checkout-empty-icon">🛒</div><h1>Seu carrinho está vazio</h1><p>Adicione produtos na loja para iniciar o checkout.</p><Link className="checkout-primary" to="/">Voltar para a loja</Link></div></main>

  if (order) {
    const code = order.codigo || order.publicCode || order.public_code
    const checkout = payment?.checkout || {}
    const pixCode = checkout.qrCode || checkout.qr_code || null
    const qr = checkout.qrCodeBase64 || checkout.qr_code_base64 || null
    const hostedUrl = checkout.url || checkout.link || checkout.checkoutUrl || checkout.ticketUrl || null
    const paid = ['captured', 'paid', 'approved', 'authorized'].includes(String(order.payment_status || payment?.status || '').toLowerCase())
    return <main className="checkout-result-shell"><div className="checkout-result-card">
      <div className="checkout-result-icon"><CheckCircle2 size={30} /></div>
      <span className="eyebrow">Pedido {code}</span>
      <h1>{paid ? 'Pagamento confirmado' : payment ? 'Pagamento iniciado' : 'Pedido criado'}</h1>
      <p className="checkout-result-lead">{paid ? 'O pagamento foi confirmado pelo provedor e o pedido seguirá para preparação.' : payment ? 'Conclua o pagamento no provedor. O status será atualizado automaticamente.' : 'Escolha um método para concluir o pagamento com segurança.'}</p>
      {error && <div className="checkout-form-error" role="alert">{error}</div>}
      {!payment && !paid && <div className="checkout-payment-box"><strong>Escolha como pagar</strong>{paymentMethods.length ? paymentMethods.map(item => { const value = `${item.provider}:${item.method}`; return <label key={value} className={`payment-option ${selectedPayment === value ? 'is-selected' : ''}`}><input type="radio" name="payment" value={value} checked={selectedPayment === value} onChange={() => setSelectedPayment(value)} /><span className="payment-option-copy"><strong>{item.method === 'pix' ? 'Pix' : item.method === 'credit_card' ? 'Cartão de crédito' : item.method}</strong><small>{item.provider === 'mercadopago' ? 'Mercado Pago' : item.provider === 'infinitepay' ? 'InfinitePay Checkout' : item.provider}</small></span></label> }) : <small>Nenhum provedor de pagamento está publicado para esta loja.</small>}<button type="button" className="checkout-primary" onClick={startPayment} disabled={working || redirecting || !paymentMethods.length}>{redirecting ? 'Abrindo checkout seguro…' : working ? 'Preparando pagamento…' : 'Iniciar pagamento'}</button><small className="checkout-payment-helper">InfinitePay abre o ambiente seguro do provedor. Mercado Pago exibe o Pix nesta tela.</small></div>}
      {payment && !paid && <div className="checkout-payment-box"><strong>Pagamento pendente</strong>{qr && <img className="checkout-qr" src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code do pagamento" />}{pixCode && <div className="checkout-pix-box"><label>Código Pix</label><textarea readOnly rows={4} value={pixCode} aria-label="Código Pix" /><button type="button" className="checkout-primary" onClick={() => copyCode(pixCode)}><Copy size={15} />{copied ? 'Código copiado' : 'Copiar código'}</button></div>}{hostedUrl && <a className="checkout-primary" href={hostedUrl} target="_blank" rel="noreferrer">Abrir checkout do provedor <ArrowRight size={16} /></a>}{!qr && !pixCode && !hostedUrl && <small>O provedor recebeu a solicitação, mas ainda não retornou uma instrução pública de pagamento. Aguarde o webhook ou consulte o pedido.</small>}<small>Status: {payment.status || order.payment_status || 'pending'}.</small></div>}
      <div className="checkout-result-meta"><div><span>Total</span><strong>{money(order.total || total)}</strong></div><div><span>Pedido</span><strong>{code}</strong></div></div>
      <div className="checkout-result-actions"><Link className="checkout-primary" to={`/pedido/${encodeURIComponent(code)}`}>Acompanhar pedido <ArrowRight size={16} /></Link><Link className="checkout-secondary" to="/">Voltar para a loja</Link></div>
    </div></main>
  }

  return <main className="checkout-page">
    <header className="checkout-header"><div className="checkout-header-inner"><Link className="checkout-brand" to="/"><span className="checkout-brand-mark">K</span><span>Kytto Commerce</span></Link><div className="checkout-header-security"><ShieldCheck size={16} /> Checkout protegido</div></div></header>
    <div className="checkout-content"><div className="checkout-main-column"><Link className="checkout-back" to="/"> <ArrowLeft size={14} /> Voltar para a loja</Link><Stepper paymentReady={false} /><section className="checkout-card"><div className="checkout-card-title"><div><span className="eyebrow">Checkout Commerce</span><h1>Finalize sua compra</h1><p>Seu pedido será criado primeiro; o pagamento acontece depois no provedor escolhido.</p></div><span className="checkout-card-icon"><Store size={20} /></span></div>
      <form onSubmit={createOrder}>
        <div className="checkout-form-grid"><label className="checkout-field"><span>Nome completo *</span><input value={form.nome} onChange={e => setForm(current => ({ ...current, nome: e.target.value }))} autoComplete="name" required /></label><label className="checkout-field"><span>E-mail *</span><input type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} autoComplete="email" required /></label><label className="checkout-field"><span>WhatsApp ou telefone</span><input value={form.telefone} onChange={e => setForm(current => ({ ...current, telefone: e.target.value }))} autoComplete="tel" /></label></div>
        <div className="checkout-info-banner"><ShieldCheck size={18} /><div><strong>Pagamento fora do formulário.</strong><br />A Kytto não coleta dados de cartão. Você será levado ao checkout seguro do provedor habilitado.</div></div>
        <div className="checkout-address"><div className="checkout-address-heading"><h2>Como receber</h2><span>Escolha uma opção publicada</span></div><div className="shipping-options">{pickupAvailable && <button type="button" className={`shipping-option ${deliveryMode === 'retirada' ? 'is-selected' : ''}`} onClick={() => { setDeliveryMode('retirada'); setShippingMethodId(shippingMethods.find(item => item.tipo === 'pickup')?.id || '') }}><span className="shipping-option-radio">{deliveryMode === 'retirada' ? '✓' : ''}</span><span className="shipping-option-copy"><strong>Retirada no local</strong><small>Confirme com a operação da loja.</small></span><b>Grátis</b></button>}{deliveryAvailable && <button type="button" className={`shipping-option ${deliveryMode === 'entrega' ? 'is-selected' : ''}`} onClick={() => { setDeliveryMode('entrega'); setShippingMethodId(shippingMethods.find(item => ['delivery', 'carrier'].includes(item.tipo) && item.quoteEnabled)?.id || '') }}><span className="shipping-option-radio">{deliveryMode === 'entrega' ? '✓' : ''}</span><span className="shipping-option-copy"><strong>Entrega</strong><small>Calcule o valor e o prazo por CEP.</small></span><b>Consultar</b></button>}</div></div>
        {deliveryMode === 'entrega' && <div className="checkout-address"><div className="checkout-form-grid"><label className="checkout-field"><span>CEP *</span><input value={address.cep} onChange={e => updateAddress('cep', e.target.value)} inputMode="numeric" autoComplete="postal-code" required /></label><label className="checkout-field"><span>Número *</span><input value={address.numero} onChange={e => updateAddress('numero', e.target.value)} required /></label><label className="checkout-field"><span>Logradouro *</span><input value={address.logradouro} onChange={e => updateAddress('logradouro', e.target.value)} required /></label><label className="checkout-field"><span>Bairro *</span><input value={address.bairro} onChange={e => updateAddress('bairro', e.target.value)} required /></label><label className="checkout-field"><span>Cidade *</span><input value={address.cidade} onChange={e => updateAddress('cidade', e.target.value)} required /></label><label className="checkout-field"><span>UF *</span><input value={address.estado} onChange={e => updateAddress('estado', e.target.value.toUpperCase())} maxLength={2} required /></label></div><button type="button" className="checkout-secondary" onClick={quoteShipping} disabled={working}>{working ? 'Calculando…' : 'Calcular frete'}</button>{shippingQuote?.items?.map(option => <label className="commerce-shipping-option" key={option.id}><input type="radio" name="shippingOption" checked={shippingOptionId === option.id} onChange={() => setShippingOptionId(option.id)} /><span><strong>{option.name}</strong><small>{option.carrier || 'Transportadora'}</small></span><b>{money(option.amount)}</b></label>)}</div>}
        {error && <div className="checkout-form-error" role="alert">{error}</div>}<div className="checkout-actions"><span>Estoque e valor serão revalidados no servidor.</span><button type="submit" className="checkout-primary checkout-primary-large" disabled={working || !cart.length}>{working ? <><Loader2 className="commerce-spin" size={16} /> Criando pedido…</> : <>Continuar para pagamento <ArrowRight size={16} /></>}</button></div>
      </form></section></div><aside className="checkout-summary"><div className="checkout-summary-heading"><div><span className="eyebrow">Seu pedido</span><h2>Resumo da compra</h2></div><span className="checkout-secure">Seguro</span></div><div className="checkout-summary-items">{cart.map(item => <div className="checkout-summary-item" key={`${item.produtoId}-${item.variantId || 'base'}`}><ProductThumb item={item} /><div className="checkout-summary-item-copy"><strong>{item.nome}</strong><span>{item.qtd} unidade(s)</span></div><b>{money(item.qtd * item.preco)}</b></div>)}</div><div className="checkout-totals"><div><span>Subtotal</span><b>{money(cartTotal)}</b></div>{selectedOption && <div><span>Entrega</span><b>{money(selectedOption.amount)}</b></div>}<div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div></div><div className="checkout-trust-list"><span>✓ Estoque revalidado no servidor</span><span>✓ Pagamento no provedor escolhido</span><span>✓ Acompanhamento por código do pedido</span></div></aside></div>
  </main>
}
