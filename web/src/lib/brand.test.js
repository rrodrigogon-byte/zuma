import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBrand, resolveBrand } from './brand.js'

test('resolveBrand aplica Dino em todo o backoffice somente quando Dino é o tenant ativo', () => {
  assert.equal(resolveBrand('/admin', '', 'dino'), 'dino')
  assert.equal(resolveBrand('/admin/ecommerce', '', 'dino'), 'dino')
  assert.equal(resolveBrand('/admin/barbearia', '', 'dino'), 'dino')
  assert.equal(resolveBrand('/admin/torneios', '', 'dino'), 'dino')
  assert.equal(resolveBrand('/admin/barbearia', '', 'kytto'), 'kytto')
  assert.equal(resolveBrand('/admin/ecommerce'), 'kytto')
})

test('resolveBrand aplica Dino em toda a jornada pública vinculada ao alias', () => {
  assert.equal(resolveBrand('/agendar/dino'), 'dino')
  assert.equal(resolveBrand('/ecommerce/dino'), 'dino')
  assert.equal(resolveBrand('/perfumaria/dino'), 'dino')
  assert.equal(resolveBrand('/checkout/dino'), 'dino')
  assert.equal(resolveBrand('/pedido/dino/DINO-123'), 'dino')
  assert.equal(resolveBrand('/loja', '?marca=dino'), 'dino')
})

test('resolveBrand preserva Kytto e Agro Open nas demais rotas e aliases', () => {
  assert.equal(resolveBrand('/'), 'kytto')
  assert.equal(resolveBrand('/admin'), 'kytto')
  assert.equal(resolveBrand('/admin/torneios', '', 'kytto'), 'kytto')
  assert.equal(resolveBrand('/loja'), 'kytto')
  assert.equal(resolveBrand('/ecommerce/agro-open'), 'kytto')
  assert.equal(resolveBrand('/checkout/outra-loja'), 'kytto')
  assert.equal(resolveBrand('/agendar/outra-barbearia'), 'kytto')
})

test('applyBrand é inofensivo fora do navegador', () => {
  assert.doesNotThrow(() => applyBrand('dino'))
  assert.doesNotThrow(() => applyBrand('kytto'))
})
