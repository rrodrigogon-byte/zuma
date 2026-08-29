import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STEPS = [
  { id: 1, label: 'Seus dados', short: 'Dados' },
  { id: 2, label: 'Entrega', short: 'Entrega' },
  { id: 3, label: 'Pagamento', short: 'Pagamento' },
  { id: 4, label: 'Revisão', short: 'Revisão' },
]

const EMPTY_FORM = {
  nome: '', email: '', tel: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', referencia: '',
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function maskCep(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  return digits.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim()
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

function Stepper({ current }) {
  return (
    <nav className="checkout-stepper" aria-label="Etapas do checkout">
      {STEPS.map((step, index) => (
        <div key={step.id} className={`checkout-step ${step.id <= current ? 'is-active' : ''} ${step.id < current ? 'is-done' : ''}`}>
          <div className="checkout-step-dot">{step.id < current ? '✓' : step.id}</div>
          <span className="checkout-step-label"><span className="desktop-only">{step.label}</span><span className="mobile-only">{step.short}</span></span>
          {index < STEPS.length - 1 && <div className="checkout-step-line" />}
        </div>
      ))}
    </nav>
  )
}

function Field({ label, error, hint, children, required = false }) {
  return (
    <div className="checkout-field">
      <label>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="checkout-error" role="alert">{error}</small>}
    </div>
  )
}

function Summary({ items, products, simulation, couponCode, setCouponCode, onCoupon, couponLoading, couponError }) {
  const localTotal = useMemo(() => items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.produtoId)
    return sum + Number(product?.preco || 0) * Number(item.qtd || 0)
  }, 0), [items, products])
  const subtotal = simulation?.subtotal ?? localTotal
  const discount = simulation?.desconto ?? 0
  const shipping = simulation?.frete ?? 0
  const total = simulation?.totalFinal ?? Math.max(0, subtotal - discount + shipping)

  return (
    <aside className="checkout-summary" aria-label="Resumo do pedido">
      <div className="checkout-summary-heading">
        <div>
          <span className="eyebrow">Seu pedido</span>
          <h2>Resumo da compra</h2>
        </div>
        <span className="checkout-secure">Compra segura</span>
      </div>
      <div className="checkout-summary-items">
        {items.map((item, index) => {
          const product = products.find(p => p.id === item.produtoId)
          if (!product) return null
          return (
            <div key={`${item.produtoId}-${item.tamanho || ''}-${index}`} className="checkout-summary-item">
              <div className="checkout-summary-thumb">
                {product.imagem ? <img src={product.imagem} alt="" /> : <span>{product.emoji || '📦'}</span>}
              </div>
              <div className="checkout-summary-item-copy">
                <strong>{product.nome}</strong>
                <span>{item.tamanho ? `Tamanho ${item.tamanho} · ` : ''}{item.qtd} unidade{item.qtd > 1 ? 's' : ''}</span>
              </div>
              <b>{fmtR(Number(product.preco || 0) * Number(item.qtd || 0))}</b>
            </div>
          )
        })}
      </div>
      <div className="checkout-coupon">
        <div className="checkout-coupon-label">Cupom de desconto</div>
        <div className="checkout-coupon-row">
          <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Digite seu cupom" aria-label="Código do cupom" />
          <button type="button" onClick={onCoupon} disabled={couponLoading}>{couponLoading ? '...' : 'Aplicar'}</button>
        </div>
        {couponError && <div className="checkout-error" role="alert">{couponError}</div>}
        {simulation?.cupom && <div className="checkout-coupon-applied">✓ {simulation.cupom.codigo} aplicado</div>}
      </div>
      <div className="checkout-totals">
        <div><span>Subtotal</span><b>{fmtR(subtotal)}</b></div>
        {discount > 0 && <div className="checkout-discount"><span>Desconto</span><b>− {fmtR(discount)}</b></div>}
        <div><span>Entrega</span><b>{shipping > 0 ? fmtR(shipping) : 'Grátis'}</b></div>
        <div className="checkout-total"><span>Total</span><strong>{fmtR(total)}</strong></div>
      </div>
      <div className="checkout-trust-list">
        <span>✓ Preço e estoque revalidados no servidor</span>
        <span>✓ Pix processado com Mercado Pago</span>
        <span>✓ Você acompanha o pedido online</span>
      </div>
    </aside>
  )
}

function OrderResult({ order, payment, onBackToStore }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const copyPix = async () => {
    if (!payment?.copiaECola) return
    try {
      await navigator.clipboard.writeText(payment.copiaECola)
      setCopied(true)
      toast('Código Pix copiado')
      setTimeout(() => setCopied(false), 2200)
    } catch { toast('Não foi possível copiar o código', true) }
  }
  const qr = payment?.qrBase64 ? (payment.qrBase64.startsWith('data:') ? payment.qrBase64 : `data:image/png;base64,${payment.qrBase64}`) : null

  return (
    <main className="checkout-result-shell">
      <div className="checkout-result-card">
        <div className="checkout-result-icon">{payment?.status === 'aprovado' ? '✓' : '⌁'}</div>
        <span className="eyebrow">Pedido {order?.codigo}</span>
        <h1>{payment?.status === 'aprovado' ? 'Pagamento confirmado' : 'Pedido criado com sucesso'}</h1>
        <p className="checkout-result-lead">
          {payment?.status === 'aprovado' ? 'Seu pedido já está confirmado. A equipe da Kytto iniciará a preparação.' : 'Conclua o Pix para confirmar seu pedido. O status será atualizado automaticamente.'}
        </p>
        {qr && payment?.status !== 'aprovado' && <img className="checkout-qr" src={qr} alt="QR Code Pix para pagamento" />}
        {payment?.copiaECola && payment?.status !== 'aprovado' && (
          <div className="checkout-pix-box">
            <label>Pix copia e cola</label>
            <textarea readOnly rows={3} value={payment.copiaECola} aria-label="Código Pix copia e cola" />
            <button type="button" className="checkout-primary" onClick={copyPix}>{copied ? 'Código copiado' : 'Copiar código Pix'}</button>
          </div>
        )}
        <div className="checkout-result-meta">
          <div><span>Status do pagamento</span><strong>{payment?.status === 'aprovado' ? 'Aprovado' : 'Aguardando Pix'}</strong></div>
          <div><span>Total</span><strong>{fmtR(order?.total)}</strong></div>
        </div>
        <div className="checkout-result-actions">
          <Link className="checkout-primary" to={`/pedido/${order?.codigo}`}>Acompanhar pedido</Link>
          <button type="button" className="checkout-secondary" onClick={onBackToStore}>Voltar para a loja</button>
        </div>
        <small className="checkout-result-note">Guarde o código <b>{order?.codigo}</b> para consultar o pedido depois.</small>
      </div>
    </main>
  )
}

export default function Checkout() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [shippingOptions, setShippingOptions] = useState([])
  const [shippingMethod, setShippingMethod] = useState('pickup')
  const [paymentMethod] = useState('pix')
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [simulation, setSimulation] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [consent, setConsent] = useState(false)
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [checkoutKey] = useState(() => window.crypto?.randomUUID?.() || `checkout_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let saved = []
    try { saved = JSON.parse(localStorage.getItem('kytto_cart_v2') || '[]') } catch { saved = [] }
    if (Array.isArray(saved)) setItems(saved)
    Promise.all([
      api.get('/api/loja'),
      api.get('/api/loja/checkout/opcoes-entrega').catch(() => ({ opcoes: [{ id: 'pickup', nome: 'Retirada na loja', descricao: 'Retire no ponto informado pela Kytto', preco: 0, prazo: 'Após confirmação', tipo: 'retirada' }] })),
    ]).then(([catalog, shipping]) => {
      setProducts(Array.isArray(catalog) ? catalog : [])
      const options = Array.isArray(shipping?.opcoes) ? shipping.opcoes : []
      setShippingOptions(options)
      if (options[0]?.id) setShippingMethod(options[0].id)
    }).catch(() => toast('Não foi possível carregar o checkout', true)).finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    try { sessionStorage.setItem('kytto_checkout_draft', JSON.stringify({ form, shippingMethod, couponCode, step })) } catch { /* storage opcional */ }
  }, [form, shippingMethod, couponCode, step])

  useEffect(() => {
    const saved = sessionStorage.getItem('kytto_checkout_draft')
    if (!saved) return
    try {
      const draft = JSON.parse(saved)
      if (draft.form) setForm(value => ({ ...value, ...draft.form }))
      if (draft.shippingMethod) setShippingMethod(draft.shippingMethod)
      if (draft.couponCode) setCouponCode(draft.couponCode)
    } catch { /* rascunho inválido */ }
  }, [])

  useEffect(() => {
    if (!payment?.pagamentoId || payment.status === 'aprovado') return undefined
    const timer = setInterval(async () => {
      try {
        const status = await api.get(`/api/pagamento/${payment.pagamentoId}`)
        if (status.status === 'aprovado' || status.status === 'recusado') {
          setPayment(prev => ({ ...prev, status: status.status, copiaECola: status.copiaECola || prev.copiaECola, qrBase64: status.qrBase64 || prev.qrBase64 }))
          if (status.status === 'aprovado') setOrder(prev => ({ ...prev, pagamento: 'pago', paymentStatus: 'aprovado' }))
        }
      } catch { /* polling tolerante */ }
    }, 5000)
    return () => clearInterval(timer)
  }, [payment?.pagamentoId, payment?.status])

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: '' }))
  }

  const payload = useMemo(() => ({
    itens: items,
    cupomCodigo: couponCode || undefined,
    metodoEntrega: shippingMethod,
    endereco: { cep: digits(form.cep), rua: form.rua, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, uf: form.uf, referencia: form.referencia },
  }), [items, couponCode, shippingMethod, form])

  const simulate = async () => {
    const result = await api.post('/api/loja/checkout/simular', payload)
    setSimulation(result)
    setCouponError('')
    return result
  }

  const validateStep = () => {
    const errors = {}
    if (step === 1) {
      if (!form.nome.trim()) errors.nome = 'Informe seu nome completo.'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = 'Informe um e-mail válido.'
      if (digits(form.tel).length < 10) errors.tel = 'Informe um telefone válido.'
    }
    if (step === 2 && shippingMethod !== 'pickup') {
      if (digits(form.cep).length !== 8) errors.cep = 'Informe um CEP válido.'
      if (!form.rua.trim()) errors.rua = 'Informe a rua.'
      if (!form.numero.trim()) errors.numero = 'Informe o número.'
      if (!form.cidade.trim()) errors.cidade = 'Informe a cidade.'
      if (form.uf.trim().length !== 2) errors.uf = 'Informe a UF.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const next = async () => {
    if (!validateStep()) return
    setWorking(true)
    try {
      if (step >= 2) await simulate()
      setStep(value => Math.min(4, value + 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) { toast(error.message || 'Revise os dados do checkout', true) }
    finally { setWorking(false) }
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) { setCouponError('Digite um cupom para aplicar.'); return }
    setCouponLoading(true)
    try { await simulate(); toast('Cupom aplicado') }
    catch (error) { setCouponError(error.message || 'Cupom inválido') }
    finally { setCouponLoading(false) }
  }

  const createOrder = async () => {
    if (!consent) { toast('Aceite os termos para finalizar o pedido', true); return }
    setWorking(true)
    const idempotencyKey = checkoutKey
    try {
      const created = await api.post('/api/loja/checkout/pedido', { idempotencyKey, cliente: { nome: form.nome, email: form.email, tel: form.tel }, itens: items, cupomCodigo: couponCode || undefined, metodoEntrega: shippingMethod, endereco: payload.endereco })
      const paid = await api.post(`/api/loja/checkout/${created.pedidoId}/pagamento`, { metodoPagamento: paymentMethod, idempotencyKey: `${idempotencyKey}:payment` })
      setOrder(created.pedido)
      setPayment({ ...paid.pagamento, pagamentoId: paid.pagamentoId })
      localStorage.removeItem('kytto_cart_v2')
      sessionStorage.removeItem('kytto_checkout_draft')
      setStep(5)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) { toast(error.message || 'Não foi possível finalizar o pedido', true) }
    finally { setWorking(false) }
  }

  const totalItems = items.reduce((sum, item) => sum + Number(item.qtd || 0), 0)

  if (loading) return <main className="checkout-page"><div className="checkout-loading"><div className="checkout-spinner" />Carregando seu carrinho…</div></main>
  if (!items.length) return (
    <main className="checkout-page"><div className="checkout-empty"><div className="checkout-empty-icon">🛒</div><h1>Seu carrinho está vazio</h1><p>Adicione produtos à sua sacola para começar.</p><Link className="checkout-primary" to="/loja">Explorar a loja</Link></div></main>
  )
  if (step === 5) return <OrderResult order={order} payment={payment} onBackToStore={() => navigate('/loja')} />

  const selectedShipping = shippingOptions.find(option => option.id === shippingMethod)
  const isDelivery = selectedShipping?.tipo === 'entrega'

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <div className="checkout-header-inner">
          <Link to="/loja" className="checkout-brand" aria-label="Voltar para a loja"><span className="checkout-brand-mark">K</span><span>Kytto</span></Link>
          <div className="checkout-header-security"><span>⌁</span> Checkout seguro <span className="checkout-header-count">{totalItems} item{totalItems === 1 ? '' : 's'}</span></div>
        </div>
      </header>
      <div className="checkout-content">
        <div className="checkout-main-column">
          <Link to="/loja" className="checkout-back">← Voltar para a loja</Link>
          <Stepper current={step} />

          {step === 1 && <section className="checkout-card">
            <div className="checkout-card-title"><div><span className="eyebrow">Etapa 1 de 4</span><h1>Como podemos falar com você?</h1><p>Use o checkout como convidado. Não é preciso criar uma conta.</p></div><span className="checkout-card-icon">◌</span></div>
            <div className="checkout-form-grid">
              <Field label="Nome completo" required error={fieldErrors.nome}><input autoFocus value={form.nome} onChange={e => updateField('nome', e.target.value)} placeholder="Ex.: Maria da Silva" autoComplete="name" /></Field>
              <Field label="E-mail" required error={fieldErrors.email} hint="Enviaremos a confirmação e o acompanhamento."><input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field>
              <Field label="WhatsApp / telefone" required error={fieldErrors.tel}><input inputMode="tel" value={form.tel} onChange={e => updateField('tel', maskPhone(e.target.value))} placeholder="(65) 99999-0000" autoComplete="tel" /></Field>
            </div>
            <div className="checkout-info-banner"><span>i</span><div><strong>Seus dados ficam protegidos.</strong><br />Usaremos seu e-mail somente para confirmar e acompanhar este pedido.</div></div>
            <div className="checkout-actions"><span>Campos marcados com * são obrigatórios.</span><button type="button" className="checkout-primary" onClick={next} disabled={working}>{working ? 'Validando…' : 'Continuar para entrega →'}</button></div>
          </section>}

          {step === 2 && <section className="checkout-card">
            <div className="checkout-card-title"><div><span className="eyebrow">Etapa 2 de 4</span><h1>Como você quer receber?</h1><p>Escolha a opção que funciona melhor para você.</p></div><span className="checkout-card-icon">⌂</span></div>
            <div className="shipping-options">
              {shippingOptions.map(option => <button type="button" key={option.id} className={`shipping-option ${shippingMethod === option.id ? 'is-selected' : ''}`} onClick={() => setShippingMethod(option.id)}><span className="shipping-option-radio">{shippingMethod === option.id ? '✓' : ''}</span><span className="shipping-option-copy"><strong>{option.nome}</strong><small>{option.descricao}</small><small className="shipping-option-time">{option.prazo}</small></span><b>{Number(option.preco || 0) ? fmtR(option.preco) : 'Grátis'}</b></button>)}
            </div>
            {isDelivery && <div className="checkout-address"><div className="checkout-address-heading"><h2>Endereço de entrega</h2><span>Brasil</span></div><div className="checkout-form-grid"><Field label="CEP" required error={fieldErrors.cep}><input inputMode="numeric" value={form.cep} onChange={e => updateField('cep', maskCep(e.target.value))} placeholder="00000-000" autoComplete="postal-code" /></Field><Field label="Rua" required error={fieldErrors.rua}><input value={form.rua} onChange={e => updateField('rua', e.target.value)} placeholder="Nome da rua" autoComplete="address-line1" /></Field><Field label="Número" required error={fieldErrors.numero}><input inputMode="numeric" value={form.numero} onChange={e => updateField('numero', e.target.value)} placeholder="123" autoComplete="address-line2" /></Field><Field label="Complemento"><input value={form.complemento} onChange={e => updateField('complemento', e.target.value)} placeholder="Apto, bloco…" /></Field><Field label="Bairro"><input value={form.bairro} onChange={e => updateField('bairro', e.target.value)} placeholder="Seu bairro" autoComplete="address-level3" /></Field><Field label="Cidade" required error={fieldErrors.cidade}><input value={form.cidade} onChange={e => updateField('cidade', e.target.value)} placeholder="Sua cidade" autoComplete="address-level2" /></Field><Field label="UF" required error={fieldErrors.uf}><input value={form.uf} onChange={e => updateField('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="MT" autoComplete="address-level1" /></Field><Field label="Referência"><input value={form.referencia} onChange={e => updateField('referencia', e.target.value)} placeholder="Perto de…" /></Field></div></div>}
            <div className="checkout-actions"><button type="button" className="checkout-secondary" onClick={() => setStep(1)}>← Dados</button><button type="button" className="checkout-primary" onClick={next} disabled={working}>{working ? 'Calculando…' : 'Continuar para pagamento →'}</button></div>
          </section>}

          {step === 3 && <section className="checkout-card">
            <div className="checkout-card-title"><div><span className="eyebrow">Etapa 3 de 4</span><h1>Escolha o pagamento</h1><p>Você será direcionado para uma cobrança segura do Mercado Pago.</p></div><span className="checkout-card-icon">▣</span></div>
            <div className="payment-option is-selected"><span className="shipping-option-radio">✓</span><span className="payment-option-copy"><strong>Pix</strong><small>Aprovação rápida, direto pelo app do seu banco.</small></span><span className="payment-badge">Mercado Pago</span></div>
            <div className="payment-coming-soon"><strong>Cartão e outras opções em breve</strong><span>Estamos preparando Checkout Pro para ampliar as formas de pagamento sem armazenar dados sensíveis.</span></div>
            <div className="checkout-security-panel"><span>▣</span><div><strong>Pagamento protegido pelo Mercado Pago</strong><p>A Kytto não armazena dados bancários. O status do pagamento é confirmado automaticamente pelo provedor.</p></div></div>
            <div className="checkout-actions"><button type="button" className="checkout-secondary" onClick={() => setStep(2)}>← Entrega</button><button type="button" className="checkout-primary" onClick={next} disabled={working}>{working ? 'Recalculando…' : 'Revisar pedido →'}</button></div>
          </section>}

          {step === 4 && <section className="checkout-card">
            <div className="checkout-card-title"><div><span className="eyebrow">Etapa 4 de 4</span><h1>Confira antes de finalizar</h1><p>Revise os dados. Você só será cobrado depois de confirmar.</p></div><span className="checkout-card-icon">✓</span></div>
            <div className="review-sections">
              <button type="button" className="review-section" onClick={() => setStep(1)}><span><small>CONTATO</small><strong>{form.nome}</strong><em>{form.email} · {form.tel}</em></span><b>Editar</b></button>
              <button type="button" className="review-section" onClick={() => setStep(2)}><span><small>ENTREGA</small><strong>{selectedShipping?.nome || 'Retirada na loja'}</strong><em>{isDelivery ? `${form.rua}, ${form.numero} · ${form.cidade}/${form.uf}` : selectedShipping?.descricao}</em></span><b>Editar</b></button>
              <button type="button" className="review-section" onClick={() => setStep(3)}><span><small>PAGAMENTO</small><strong>Pix Mercado Pago</strong><em>Você receberá o código Pix na próxima tela.</em></span><b>Editar</b></button>
            </div>
            <label className="checkout-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Li e concordo com as condições de compra e com a política de privacidade da Kytto.</span></label>
            <div className="checkout-final-note"><span>⌁</span><p>O estoque será reservado por 30 minutos. Se o pagamento não for identificado nesse período, o pedido poderá expirar.</p></div>
            <div className="checkout-actions"><button type="button" className="checkout-secondary" onClick={() => setStep(3)}>← Pagamento</button><button type="button" className="checkout-primary checkout-primary-large" onClick={createOrder} disabled={working}>{working ? 'Criando pedido…' : 'Confirmar pedido e gerar Pix'}</button></div>
          </section>}
        </div>
        <Summary items={items} products={products} simulation={simulation} couponCode={couponCode} setCouponCode={setCouponCode} onCoupon={applyCoupon} couponLoading={couponLoading} couponError={couponError} />
      </div>
    </main>
  )
}
