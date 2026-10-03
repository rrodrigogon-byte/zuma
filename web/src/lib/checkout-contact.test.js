import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkoutContactReference, checkoutContactReviewMessage, checkoutContactSupportAction } from './checkout-contact.js'

const requestId = '46fac68f-adfa-4be5-b601-8b7446dcfa4f'

test('conflito conserva carrinho, explica bloqueio da tentativa e não revela qual contato existe', () => {
  const message = checkoutContactReviewMessage({ requestId, details: { email: 'private@example.invalid', reason: 'customer_phone_mismatch' } })
  assert.match(message, /Seu carrinho foi mantido/)
  assert.match(message, /Nenhum pedido ou pagamento foi iniciado nesta tentativa/)
  assert.match(message, new RegExp(requestId))
  assert.doesNotMatch(message, /private@example\.invalid|customer_phone_mismatch/)
})

test('referência inválida ou contaminada nunca é concatenada nem enviada à loja', () => {
  const error = { requestId: 'req-123\nprivate@example.invalid', details: { phone: '11999999999' } }
  assert.equal(checkoutContactReference(error), '')
  assert.doesNotMatch(checkoutContactReviewMessage(error), /private|req-123|11999999999|Referência:/)
  assert.equal(checkoutContactReference({ requestId: requestId.toUpperCase() }), requestId)
})

test('suporte por e-mail usa só a referência e a caixa comercial, sem cliente ou carrinho', () => {
  const action = checkoutContactSupportAction({ email: 'loja@example.invalid', phone: '5511999999999' }, { requestId, details: { email: 'private@example.invalid', phone: '11988887777', reason: 'identifiers_resolve_to_different_customers' } })
  assert.equal(action.label, 'Escrever para a loja')
  assert.match(action.href, /^mailto:loja@example\.invalid\?/)
  assert.match(decodeURIComponent(action.href), new RegExp(requestId))
  assert.doesNotMatch(decodeURIComponent(action.href), /private@example\.invalid|11988887777|identifiers_resolve_to_different_customers/)
})

test('suporte alternativo só usa telefone comercial validado e não inventa WhatsApp', () => {
  assert.deepEqual(checkoutContactSupportAction({ phone: '+5511999999999' }, {}), { href: 'tel:+5511999999999', label: 'Ligar para a loja' })
  assert.equal(checkoutContactSupportAction({ email: 'bad\n@example.invalid', phone: 'javascript:123' }, {}), null)
})

test('checkout mantém contato e carrinho no 409, foca alerta e permite recuperação acessível', () => {
  const source = readFileSync(new URL('../pages/public/CommerceCheckout.jsx', import.meta.url), 'utf8')
  const conflict = source.split("if (err.code === 'CHECKOUT_CONTACT_REVIEW') {")[1].split('return')[0]
  assert.match(conflict, /setContactReview\(/)
  assert.match(conflict, /contactReviewRef\.current\?\.focus\(\)/)
  assert.doesNotMatch(conflict, /removeItem|clearStorefrontCheckoutIdempotencyKey|setCart\(\[\]\)/)
  assert.match(source, /role="alert"/)
  assert.match(source, /Revisar e-mail e telefone/)
  assert.match(source, /checkoutContactSupportAction\(publicBrand\.contact, contactReview\)/)
})
