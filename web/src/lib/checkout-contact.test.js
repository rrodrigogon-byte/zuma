import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutContactReviewMessage } from './checkout-contact.js'

test('conflito de contato fornece orientação de retry sem expor detalhes privados', () => {
  const message = checkoutContactReviewMessage({ requestId: 'req-123\nPII', details: { email: 'private@example.invalid', reason: 'customer_phone_mismatch' } })
  assert.match(message, /Confira e-mail e telefone/)
  assert.match(message, /Nenhum pagamento foi iniciado/)
  assert.match(message, /Referência: req-123PII\./)
  assert.doesNotMatch(message, /private@example\.invalid|customer_phone_mismatch|\n/)
})
