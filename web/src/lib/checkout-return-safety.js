// O status do pedido lido do servidor é a autoridade: callback e comprovante
// não confirmam pagamento sozinhos. Na dúvida, não oferecer segunda cobrança.
export function checkoutReturnSafety({ orderStatus, paymentStatus, hasPayment, hasProviderReturn } = {}) {
  const current = String(orderStatus || '').toLowerCase()
  const closed = ['cancelled', 'payment_failed', 'refunded', 'returned'].includes(current)
  const awaitingPayment = ['draft', 'pending_payment'].includes(current)
  const paid = !closed && (current ? !awaitingPayment : ['captured', 'paid', 'approved', 'authorized'].includes(String(paymentStatus || '').toLowerCase()))
  const verifyingProviderReturn = Boolean(hasProviderReturn && awaitingPayment && !closed)
  return {
    closed,
    paid,
    verifyingProviderReturn,
    showNewPayment: !hasPayment && !paid && !closed && !verifyingProviderReturn,
    showExistingPayment: Boolean(hasPayment) && !paid && !closed && !verifyingProviderReturn,
  }
}
