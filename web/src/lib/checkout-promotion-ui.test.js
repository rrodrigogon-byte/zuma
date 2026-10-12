import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../pages/public/CommerceCheckout.jsx', import.meta.url), 'utf8')

test('checkout só envia cupom depois de prévia confirmada e invalida respostas antigas', () => {
  assert.match(source, /requestPromotionPreview\(/)
  assert.match(source, /promotionConfirmed/)
  assert.match(source, /Aplicar cupom/)
  assert.match(source, /Cupom aplicado/)
  assert.match(source, /type="button" className="checkout-secondary" onClick=\{applyPromotion\}/)
  assert.match(source, /promotionRequestRef\.current/)
  assert.match(source, /promotionPreviewFingerprint\(/)
  assert.match(source, /promotionCode: promotionPreview\.codigo/)
})

test('checkout mantém proteção de conflito de contato e não adiciona bypass de customer', () => {
  assert.match(source, /checkoutContactReviewMessage/)
  assert.doesNotMatch(source, /customerIdHint/)
  assert.doesNotMatch(source, /auto.?merge/i)
})
