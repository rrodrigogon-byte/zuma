function cartFingerprint(cart = []) {
  return cart
    .map(item => ({ id: String(item?.variantId || ''), quantity: Number(item?.qtd || item?.quantity || 0) }))
    .filter(item => item.id && Number.isInteger(item.quantity) && item.quantity > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(item => `${item.id}:${item.quantity}`)
    .join(',')
}

export function shippingQuoteKey({ deliveryMode, address, cart } = {}) {
  if (deliveryMode !== 'entrega') return ''
  const cep = String(address?.cep || '').replace(/\D/g, '')
  const city = String(address?.cidade || '').trim().toLowerCase()
  const state = String(address?.estado || '').trim().toUpperCase()
  const items = cartFingerprint(cart)
  return cep.length === 8 && city && state.length === 2 && items ? `${cep}|${state}|${city}|${items}` : ''
}

export function recommendedShippingOption(quote) {
  const candidates = Array.isArray(quote?.items) ? quote.items.filter(item => Number.isFinite(Number(item?.amount)) && Number(item.amount) >= 0) : []
  return candidates.reduce((best, item) => {
    if (!best) return item
    const amount = Number(item.amount)
    const bestAmount = Number(best.amount)
    if (amount !== bestAmount) return amount < bestAmount ? item : best
    const days = Number(item?.deliveryRange?.max ?? item?.deliveryDays ?? Number.POSITIVE_INFINITY)
    const bestDays = Number(best?.deliveryRange?.max ?? best?.deliveryDays ?? Number.POSITIVE_INFINITY)
    return days < bestDays ? item : best
  }, null)
}

export function selectedShippingOption({ deliveryMode, shippingQuote, shippingOptionId, shippingQuoteIsCurrent } = {}) {
  if (deliveryMode !== 'entrega' || !shippingQuoteIsCurrent) return null
  return shippingQuote?.items?.find(item => (item.selectionId || item.id) === shippingOptionId) || null
}

export function checkoutTotal(subtotal, shippingOption) {
  const base = Number(subtotal)
  const amount = Number(shippingOption?.amount)
  return (Number.isFinite(base) ? base : 0) + (Number.isFinite(amount) && amount > 0 ? amount : 0)
}

const PUBLIC_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

// /checkout no domínio próprio não tem :storeAlias. A identidade da vitrine
// vem do GET /context do servidor, não da forma da URL ou do carrinho.
export function isDinoCommerceStorefront(storeContext) {
  return storeContext?.codigo === 'dino-web'
}

export const DINO_DELIVERY_UNAVAILABLE = 'Não há entrega disponível para este CEP e carrinho no momento. A Dino atende somente a área local já habilitada. Seu carrinho foi mantido; nenhum pedido ou pagamento foi iniciado por este cálculo. Para outra localidade, consulte a loja antes de tentar novamente.'

export function checkoutShippingErrorMessage(error, { isDino = false } = {}) {
  if (isDino && error?.code === 'SHIPPING_DESTINATION_UNAVAILABLE') return DINO_DELIVERY_UNAVAILABLE
  return error?.message || 'Não foi possível calcular o frete.'
}

// Somente o canal comercial publicado pela vitrine. Nunca coloque CEP, endereço,
// dados do comprador ou conteúdo do carrinho na URL de suporte.
export function checkoutShippingSupportAction(contact) {
  const email = String(contact?.email || '').trim()
  if (email.length <= 254 && PUBLIC_EMAIL.test(email)) {
    return { href: `mailto:${email}?subject=${encodeURIComponent('Consulta sobre entrega da loja')}&body=${encodeURIComponent('Olá, preciso de orientação sobre disponibilidade de entrega antes de concluir uma compra.')}`, label: 'Consultar a loja' }
  }
  const phone = String(contact?.phone || '').trim()
  if (/^\+?[0-9]{10,15}$/.test(phone)) return { href: `tel:${phone}`, label: 'Ligar para a loja' }
  return null
}
