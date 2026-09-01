import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBrand, applyThemeMode, DINO_BARBERSHOP_LOGO, DINO_COMMERCE_LOGO, isDinoBrandContext, normalizeThemeMode, resolveBrand, storedThemeMode } from './brand.js'

test('Barbearia Dino e Dino Perfumaria usam assets de marca distintos', () => {
  assert.equal(DINO_BARBERSHOP_LOGO, '/brand/dino-barbearia-logo.png')
  assert.equal(DINO_COMMERCE_LOGO, '/brand/dino-logo-horizontal.png')
  assert.notEqual(DINO_BARBERSHOP_LOGO, DINO_COMMERCE_LOGO)
})

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

test('applyBrand e applyThemeMode são inofensivos fora do navegador', () => {
  assert.doesNotThrow(() => applyBrand('dino'))
  assert.doesNotThrow(() => applyBrand('kytto'))
  assert.equal(applyThemeMode('dark'), 'dark')
})

test('isDinoBrandContext reconhece o objeto empresaAtiva do AuthContext sem contaminar outros tenants', () => {
  assert.equal(isDinoBrandContext({ id: 'empresa-1', nome: 'Barbearia Dino' }), true)
  assert.equal(isDinoBrandContext({ brandKey: 'dino' }), true)
  assert.equal(isDinoBrandContext({ id: 'empresa-2', nome: 'AGRO OPEN TTC' }), false)
  assert.equal(isDinoBrandContext(null, undefined, 'kytto'), false)
})

test('applyThemeMode persiste a preferência da loja quando solicitado', () => {
  const writes = []
  const storage = { setItem: (...args) => writes.push(args) }
  assert.equal(applyThemeMode('LIGHT', { persist: true, storage }), 'light')
  assert.deepEqual(writes, [['sp_theme_mode', 'light']])
})

test('normalizeThemeMode limita o tema aos três estados suportados', () => {
  assert.equal(normalizeThemeMode('light'), 'light')
  assert.equal(normalizeThemeMode('DARK'), 'dark')
  assert.equal(normalizeThemeMode('system'), 'system')
  assert.equal(normalizeThemeMode('qualquer'), 'system')
})

test('storedThemeMode lê a preferência sem depender do localStorage real', () => {
  assert.equal(storedThemeMode({ getItem: () => 'dark' }), 'dark')
  assert.equal(storedThemeMode({ getItem: () => 'light' }), 'light')
  assert.equal(storedThemeMode({ getItem: () => null }), 'system')
  assert.equal(storedThemeMode({ getItem: () => { throw new Error('bloqueado') } }), 'system')
})
