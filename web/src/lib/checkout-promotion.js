const PROMOTION_REVALIDATION_CODES = new Set([
  'PROMOTION_EXPIRED',
  'PROMOTION_EXHAUSTED',
  'PROMOTION_LIMIT_REACHED',
  'PROMOTION_STOCK_UNAVAILABLE',
  'PROMOTION_PREVIEW_STALE',
])

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizePromotionCode(value) {
  return String(value || '').trim().toUpperCase()
}

export function promotionPreviewItems(cart = []) {
  return (Array.isArray(cart) ? cart : [])
    .map(item => ({
      variantId: item?.variantId,
      quantity: Number(item?.qtd ?? item?.quantity),
    }))
    .filter(item => item.variantId && Number.isInteger(item.quantity) && item.quantity > 0)
}

export function promotionItemsFingerprint(cart = []) {
  return promotionPreviewItems(cart)
    .map(item => `${String(item.variantId)}:${item.quantity}`)
    .sort()
    .join(',')
}

export function promotionPreviewFingerprint(code, cart = []) {
  return `${normalizePromotionCode(code)}|${promotionItemsFingerprint(cart)}`
}

export function promotionPreviewRequestBody(code, cart = []) {
  return {
    codigo: normalizePromotionCode(code),
    items: promotionPreviewItems(cart),
  }
}

export function normalizePromotionPreview(response) {
  const codigo = normalizePromotionCode(response?.codigo)
  const subtotal = finiteNumber(response?.subtotal, NaN)
  const desconto = finiteNumber(response?.desconto, NaN)
  const subtotalComDesconto = finiteNumber(response?.subtotalComDesconto, NaN)
  if (!codigo || !Number.isFinite(subtotal) || !Number.isFinite(desconto) || !Number.isFinite(subtotalComDesconto)) {
    const error = new Error('A prévia do cupom veio incompleta. Tente validar novamente.')
    error.code = 'PROMOTION_PREVIEW_INVALID'
    throw error
  }
  return {
    codigo,
    tipo: response.tipo || '',
    subtotal,
    desconto,
    subtotalComDesconto,
    inicio: response.inicio || null,
    fim: response.fim || null,
  }
}

export async function requestPromotionPreview({ api, storefrontApi, code, cart, signal } = {}) {
  const body = promotionPreviewRequestBody(code, cart)
  if (!body.codigo) {
    const error = new Error('Digite um cupom antes de confirmar.')
    error.code = 'PROMOTION_CODE_REQUIRED'
    throw error
  }
  if (!body.items.length) {
    const error = new Error('Adicione um item ao carrinho antes de confirmar o cupom.')
    error.code = 'PROMOTION_CART_EMPTY'
    throw error
  }
  const response = await api.post(`${storefrontApi}/promotions/preview`, body, { signal })
  return normalizePromotionPreview(response)
}

export function promotionPreviewTotals(preview) {
  const subtotal = finiteNumber(preview?.subtotal)
  const desconto = Math.abs(finiteNumber(preview?.desconto))
  const subtotalComDesconto = finiteNumber(preview?.subtotalComDesconto, Math.max(0, subtotal - desconto))
  return { subtotal, desconto, subtotalComDesconto }
}

export function promotionPreviewErrorMessage(error) {
  if (error?.code === 'PROMOTION_NOT_FOUND') return 'Este cupom não está disponível: pode ter expirado, esgotado o limite ou não ser válido para esta loja.'
  if (error?.code === 'PROMOTION_EXPIRED') return 'Este cupom expirou. Revalide outro cupom para continuar.'
  if (error?.code === 'PROMOTION_EXHAUSTED' || error?.code === 'PROMOTION_LIMIT_REACHED') return 'Este cupom esgotou o limite de uso. Revalide outro cupom para continuar.'
  if (error?.code === 'PROMOTION_STOCK_UNAVAILABLE') return 'O estoque promocional mudou. Revalide o cupom com o carrinho atual.'
  if (error?.code === 'PROMOTION_PREVIEW_STALE') return 'A prévia do cupom ficou desatualizada. Revalide o cupom para continuar.'
  if (error?.code === 'PROMOTION_CODE_REQUIRED' || error?.code === 'PROMOTION_CART_EMPTY' || error?.code === 'PROMOTION_PREVIEW_INVALID') return error.message
  return error?.message || 'Não foi possível validar o cupom. Tente novamente.'
}

export function isPromotionOrderRevalidationError(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'PROMOTION_NOT_FOUND'
    || PROMOTION_REVALIDATION_CODES.has(code)
    || (code.startsWith('PROMOTION_') && (code.includes('EXPIRED') || code.includes('EXHAUSTED')))
}
