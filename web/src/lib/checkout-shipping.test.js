import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutShippingErrorMessage, checkoutShippingSupportAction, checkoutTotal, DINO_DELIVERY_UNAVAILABLE, isDinoCommerceStorefront, recommendedShippingOption, selectedShippingOption, shippingQuoteKey } from './checkout-shipping.js'
import { readFileSync } from 'node:fs'

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

test('soma a opção selecionada ao subtotal e rejeita seleção fora da cotação atual', () => {
  const quote = { items: [
    { id: 'expressa', selectionId: 'quote-1:expressa', amount: 65 },
    { id: 'gratis', selectionId: 'quote-1:gratis', amount: 0 },
  ] }
  const selected = selectedShippingOption({ deliveryMode: 'entrega', shippingQuote: quote, shippingOptionId: 'quote-1:expressa', shippingQuoteIsCurrent: true })
  assert.equal(selected?.id, 'expressa')
  assert.equal(checkoutTotal(2600, selected), 2665)
  assert.equal(checkoutTotal(2600, { id: 'gratis', amount: 0 }), 2600)
  assert.equal(selectedShippingOption({ deliveryMode: 'retirada', shippingQuote: quote, shippingOptionId: 'quote-1:expressa', shippingQuoteIsCurrent: true }), null)
  assert.equal(selectedShippingOption({ deliveryMode: 'entrega', shippingQuote: quote, shippingOptionId: 'quote-old:expressa', shippingQuoteIsCurrent: false }), null)
})

test('CEP fora da cobertura Dino explica indisponibilidade sem inventar tarifa, prazo ou cobrança', () => {
  const error = { code: 'SHIPPING_DESTINATION_UNAVAILABLE', message: 'nenhuma opção', details: { cep: '01001000', buyer: 'private@example.invalid' } }
  assert.equal(checkoutShippingErrorMessage(error, { isDino: true }), DINO_DELIVERY_UNAVAILABLE)
  assert.match(DINO_DELIVERY_UNAVAILABLE, /carrinho foi mantido/)
  assert.match(DINO_DELIVERY_UNAVAILABLE, /nenhum pedido ou pagamento/)
  assert.doesNotMatch(DINO_DELIVERY_UNAVAILABLE, /01001000|private@example\.invalid|R\$\s*42|prazo de entrega/)
  assert.equal(checkoutShippingErrorMessage(error, { isDino: false }), 'nenhuma opção')
  assert.equal(checkoutShippingErrorMessage({ code: 'SHIPPING_CEP_PROVIDER_TIMEOUT', message: 'serviço indisponível' }, { isDino: true }), 'serviço indisponível')
})

test('checkout hospedado sem alias identifica Dino pelo código verificado do contexto', () => {
  const context = { codigo: 'dino-web', public: { displayName: 'Dino Perfumaria' } }
  assert.equal(isDinoCommerceStorefront(context), true)
  assert.equal(checkoutShippingErrorMessage({ code: 'SHIPPING_DESTINATION_UNAVAILABLE', message: 'nenhuma opção de entrega está disponível para este CEP e carrinho' }, { isDino: isDinoCommerceStorefront(context) }), DINO_DELIVERY_UNAVAILABLE)
  assert.equal(isDinoCommerceStorefront({ codigo: 'outra-loja', public: { displayName: 'Dino Perfumaria' } }), false)
  assert.equal(isDinoCommerceStorefront(null), false)
})

test('suporte comercial de entrega não envia endereço, CEP, contatos pessoais ou carrinho', () => {
  const action = checkoutShippingSupportAction({ email: 'loja@example.invalid', phone: '+5511999999999' })
  assert.match(action.href, /^mailto:loja@example\.invalid\?/)
  assert.doesNotMatch(decodeURIComponent(action.href), /CEP|endereço|01001000|private@example\.invalid|carrinho/i)
  assert.equal(checkoutShippingSupportAction({ email: 'invalid\n@example.invalid', phone: 'javascript:123' }), null)
  assert.deepEqual(checkoutShippingSupportAction({ phone: '+5511999999999' }), { href: 'tel:+5511999999999', label: 'Ligar para a loja' })
})

test('checkout não libera pedido sem opção válida de entrega e mantém canal de suporte no alerta', () => {
  const source = readFileSync(new URL('../pages/public/CommerceCheckout.jsx', import.meta.url), 'utf8')
  assert.match(source, /const storeIdentity = normalizeStorefrontAlias\(routeAlias\) \|\| 'host'/)
  assert.match(source, /<CommerceCheckoutSession key=\{storeIdentity\} \/>/)
  assert.match(source, /shippingQuoteRequestRef\.current \+= 1/)
  assert.match(source, /deliveryMode === 'entrega' && !selectedOption/)
  assert.match(source, /setStoreContext\(context\?\.storefront \|\| null\)/)
  assert.match(source, /isDinoCommerceStorefront\(storeContext\)/)
  assert.match(source, /checkoutShippingErrorMessage\(err, \{ isDino: isDinoCommerce \}\)/)
  assert.doesNotMatch(source, /isDino: storeAlias === 'dino'/)
  assert.match(source, /checkoutShippingSupportAction\(publicBrand\.contact\)/)
  assert.match(source, /role="alert"/)
})
