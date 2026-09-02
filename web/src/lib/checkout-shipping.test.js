import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendedShippingOption, shippingQuoteKey } from './checkout-shipping.js'

const cart = [{ variantId: 'variant-b', qtd: 1 }, { variantId: 'variant-a', qtd: 2 }]
const address = { cep: '78300-055', cidade: 'Tangará da Serra', estado: 'MT' }

test('libera cotação automática somente para entrega com destino e carrinho completos', () => {
  assert.equal(shippingQuoteKey({ deliveryMode: 'retirada', address, cart }), '')
  assert.equal(shippingQuoteKey({ deliveryMode: 'entrega', address: { ...address, cidade: '' }, cart }), '')
  assert.equal(shippingQuoteKey({ deliveryMode: 'entrega', address, cart: [] }), '')
  assert.equal(shippingQuoteKey({ deliveryMode: 'entrega', address, cart }), '78300055|MT|tangará da serra|variant-a:2,variant-b:1')
})

test('mantém chave estável por ordem e invalida a cotação quando destino ou quantidade muda', () => {
  const original = shippingQuoteKey({ deliveryMode: 'entrega', address, cart })
  assert.equal(shippingQuoteKey({ deliveryMode: 'entrega', address, cart: [...cart].reverse() }), original)
  assert.notEqual(shippingQuoteKey({ deliveryMode: 'entrega', address: { ...address, cep: '78301-000' }, cart }), original)
  assert.notEqual(shippingQuoteKey({ deliveryMode: 'entrega', address, cart: [{ variantId: 'variant-a', qtd: 3 }] }), original)
})

test('ignora linhas inválidas antes de cotar', () => {
  assert.equal(shippingQuoteKey({ deliveryMode: 'entrega', address, cart: [{ variantId: '', qtd: 1 }, { variantId: 'variant-a', qtd: 0 }] }), '')
})

test('recomenda a menor tarifa aplicável e desempata pelo menor prazo', () => {
  const quote = { items: [
    { id: 'expressa', amount: 65, deliveryDays: 1 },
    { id: 'regional-lenta', amount: 25, deliveryDays: 8 },
    { id: 'regional-rapida', amount: 25, deliveryDays: 4 },
    { id: 'invalida', amount: -1, deliveryDays: 1 },
  ] }
  assert.equal(recommendedShippingOption(quote)?.id, 'regional-rapida')
  assert.equal(recommendedShippingOption({ items: [] }), null)
})
