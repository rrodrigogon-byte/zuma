import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBrand, resolveBrand } from './brand.js'

test('resolveBrand aplica Dino apenas nas rotas da Barbearia e no link público Dino', () => {
  assert.equal(resolveBrand('/admin/barbearia'), 'dino')
  assert.equal(resolveBrand('/admin/barbearia-erp'), 'dino')
  assert.equal(resolveBrand('/agendar/dino'), 'dino')
  assert.equal(resolveBrand('/loja', '?marca=dino'), 'dino')
})

test('resolveBrand preserva Kytto e Agro Open nas demais rotas', () => {
  assert.equal(resolveBrand('/'), 'kytto')
  assert.equal(resolveBrand('/admin'), 'kytto')
  assert.equal(resolveBrand('/admin/torneios'), 'kytto')
  assert.equal(resolveBrand('/loja'), 'kytto')
  assert.equal(resolveBrand('/agendar/outra-barbearia'), 'kytto')
})

test('applyBrand é inofensivo fora do navegador', () => {
  assert.doesNotThrow(() => applyBrand('dino'))
  assert.doesNotThrow(() => applyBrand('kytto'))
})
