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
