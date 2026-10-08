import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPromotionOrderRevalidationError,
  normalizePromotionCode,
  promotionPreviewFingerprint,
  promotionPreviewTotals,
  requestPromotionPreview,
} from './checkout-promotion.js'

test('prévia envia somente código normalizado e itens variantId/quantity ao endpoint do storefront', async () => {
  const calls = []
  const signal = { aborted: false }
  const result = await requestPromotionPreview({
    api: { post: async (...args) => { calls.push(args); return { codigo: ' verao10 ', tipo: 'percentual', subtotal: 100, desconto: 10, subtotalComDesconto: 90, inicio: null, fim: '2026-12-31' } } },
    storefrontApi: '/api/storefront/demo',
    code: ' verao10 ',
    cart: [{ variantId: 'v2', qtd: 2, preco: 50, nome: 'Produto' }, { variantId: 'ignored', qtd: 0 }],
    signal,
  })
  assert.equal(calls[0][0], '/api/storefront/demo/promotions/preview')
  assert.deepEqual(calls[0][1], { codigo: 'VERAO10', items: [{ variantId: 'v2', quantity: 2 }] })
  assert.equal(calls[0][2].signal, signal)
  assert.deepEqual(result, { codigo: 'VERAO10', tipo: 'percentual', subtotal: 100, desconto: 10, subtotalComDesconto: 90, inicio: null, fim: '2026-12-31' })
})

test('fingerprint muda com código ou itens, mas não com preço local do carrinho', () => {
  const cart = [{ variantId: 'v1', qtd: 1, preco: 10 }]
  assert.equal(normalizePromotionCode(' cupom-1 '), 'CUPOM-1')
  assert.notEqual(promotionPreviewFingerprint('CUPOM-1', cart), promotionPreviewFingerprint('CUPOM-2', cart))
  assert.equal(promotionPreviewFingerprint('CUPOM-1', cart), promotionPreviewFingerprint('CUPOM-1', [{ variantId: 'v1', qtd: 1, preco: 999 }]))
  assert.notEqual(promotionPreviewFingerprint('CUPOM-1', cart), promotionPreviewFingerprint('CUPOM-1', [{ variantId: 'v1', qtd: 2, preco: 10 }]))
})

test('totais usam subtotal e subtotalComDesconto canônicos da prévia e expõem desconto como valor positivo para a linha negativa', () => {
  assert.deepEqual(promotionPreviewTotals({ subtotal: '120', desconto: '20', subtotalComDesconto: '100' }), { subtotal: 120, desconto: 20, subtotalComDesconto: 100 })
})

test('expiração ou esgotamento no pedido exige revalidação sem classificar como sucesso', () => {
  assert.equal(isPromotionOrderRevalidationError({ code: 'PROMOTION_EXPIRED' }), true)
  assert.equal(isPromotionOrderRevalidationError({ code: 'PROMOTION_EXHAUSTED' }), true)
  assert.equal(isPromotionOrderRevalidationError({ code: 'CHECKOUT_CONTACT_REVIEW' }), false)
})
