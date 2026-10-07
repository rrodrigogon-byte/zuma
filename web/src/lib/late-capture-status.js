export function hasLateCaptureReview(order = {}) {
  return String(order?.coreStatus || order?.status || '').toLowerCase() === 'cancelled'
    && String(order?.payment_status || '').toLowerCase() === 'captured'
    && order?.payment_review_status === 'refund_required'
}

export const LATE_CAPTURE_COPY = Object.freeze({
  title: 'Pagamento confirmado após o cancelamento',
  detail: 'O provedor confirmou a captura, mas a reserva já havia expirado. O pedido não será enviado. A loja precisa revisar o estorno; ele ainda não foi concluído.',
  payment: 'Confirmado; revisão de estorno necessária',
  delivery: 'Pedido cancelado: sem preparação ou entrega. Não pague novamente.',
})
