import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutReturnSafety } from './checkout-return-safety.js'

test('retorno com pedido pendente bloqueia novo pagamento e link para o checkout anterior', () => {
  for (const hasPayment of [true, false]) {
    const state = checkoutReturnSafety({ orderStatus: 'pending_payment', paymentStatus: 'pending', hasPayment, hasProviderReturn: true })
    assert.equal(state.verifyingProviderReturn, true)
    assert.equal(state.showNewPayment, false)
    assert.equal(state.showExistingPayment, false)
    assert.equal(state.paid, false)
  }
})

test('pedido já pago/em separação não volta a oferecer pagamento, com ou sem parâmetros de retorno', () => {
  for (const status of ['paid', 'processing', 'shipped']) {
    const state = checkoutReturnSafety({ orderStatus: status, hasPayment: false, hasProviderReturn: true })
    assert.equal(state.paid, true)
    assert.equal(state.showNewPayment, false)
    assert.equal(state.verifyingProviderReturn, false)
  }
})

test('pedido cancelado não é reaberto por callback nem por status de pagamento capturado', () => {
  const state = checkoutReturnSafety({ orderStatus: 'cancelled', paymentStatus: 'captured', hasPayment: true, hasProviderReturn: true })
  assert.equal(state.closed, true)
  assert.equal(state.paid, false)
  assert.equal(state.reconcileProviderReturn, false)
  assert.equal(state.showNewPayment, false)
  assert.equal(state.showExistingPayment, false)
})

test('reserva expirada com retorno original ainda deve consultar provedor, mas sem segundo checkout', () => {
  const state = checkoutReturnSafety({ orderStatus: 'cancelled', paymentStatus: 'pending', hasPayment: false, hasProviderReturn: true })
  assert.equal(state.closed, true)
  assert.equal(state.paid, false)
  assert.equal(state.reconcileProviderReturn, true)
  assert.equal(state.showNewPayment, false)
  assert.equal(state.showExistingPayment, false)
})

test('sem retorno de provider, fluxo normal permite somente a tentativa existente ou início autorizado', () => {
  assert.equal(checkoutReturnSafety({ orderStatus: 'pending_payment', hasPayment: false }).showNewPayment, true)
  assert.equal(checkoutReturnSafety({ orderStatus: 'pending_payment', hasPayment: true }).showExistingPayment, true)
})
