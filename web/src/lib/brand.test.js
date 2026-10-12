import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBrand, applyThemeMode, brandThemeMode, stalloneEntryFromHost, commerceDisplayName, DINO_BARBERSHOP_LOGO, DINO_COMMERCE_LOGO, isDinoBrandContext, normalizeThemeMode, resolveBrand, storedThemeMode } from './brand.js'

test('Barbearia Dino e Dino Perfumaria usam assets de marca distintos', () => {
  assert.equal(DINO_BARBERSHOP_LOGO, '/brand/dino-barbearia-logo.png')
  assert.equal(DINO_COMMERCE_LOGO, '/brand/dino-logo-horizontal-tight.png')
  assert.notEqual(DINO_BARBERSHOP_LOGO, DINO_COMMERCE_LOGO)
})

test('nome comercial do Commerce usa Dino Perfumaria sem alterar outros storefronts', () => {
  assert.equal(commerceDisplayName('dino', 'Barbearia Dino', 'DINO-MATRIZ'), 'Dino Perfumaria')
  assert.equal(commerceDisplayName('outra-loja', 'Loja Exemplo', 'Matriz'), 'Loja Exemplo')
  assert.equal(commerceDisplayName('outra-loja', '', 'Matriz'), 'Matriz')
  assert.equal(commerceDisplayName('', '', ''), 'Kytto Commerce')
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

test('Stallone Nutre Sport tem marca própria no backoffice, na loja e no domínio', async () => {
  const { brandFromContext, brandFromHost, BRAND_KEYS, STALLONE_LOGO } = await import('./brand.js')
  assert.ok(BRAND_KEYS.includes('stallone'))
  assert.equal(STALLONE_LOGO, '/brand/stallone-logo-transparent.svg')
  assert.equal(brandFromContext({ id: 'e1', nome: 'Stallone Nutre Sport', brandKey: 'stallone' }), 'stallone')
  assert.equal(brandFromContext({ nome: 'Barbearia Dino', brandKey: 'dino' }), 'dino')
  assert.equal(brandFromContext({ nome: 'AGRO OPEN TTC', brandKey: 'default' }), 'kytto')
  assert.equal(resolveBrand('/admin/ecommerce', '', 'stallone'), 'stallone')
  assert.equal(resolveBrand('/ecommerce/stallone'), 'stallone')
  assert.equal(resolveBrand('/checkout/stallone'), 'stallone')
  assert.equal(resolveBrand('/pedido/stallone/STL-1'), 'stallone')
  assert.equal(resolveBrand('/ecommerce/stallone-fake'), 'kytto')
  assert.equal(brandFromHost('stallone.kytto.com.br'), 'stallone')
  assert.equal(brandFromHost('dino.kytto.com.br'), null)
  assert.equal(commerceDisplayName('stallone', 'Stallone Nutre Sport', 'STALLONE-MATRIZ'), 'Stallone Nutre Sport')
  assert.doesNotThrow(() => applyBrand('stallone'))
})


test('domínio Stallone abre sua vitrine e seu checkout sem afetar outras lojas', () => {
  for (const host of ['stallone.kytto.com.br', 'WWW.STALLONE.KYTTO.COM.BR.']) {
    assert.equal(stalloneEntryFromHost(host), '/ecommerce/stallone')
    assert.equal(stalloneEntryFromHost(host, true), '/checkout/stallone')
  }
  for (const host of ['dino.kytto.com.br', 'kytto.com.br', 'stallone.kytto.com.br.exemplo.com', '']) {
    assert.equal(stalloneEntryFromHost(host), null)
  }
})

test('Stallone oferece administração clara, loja escura e mantém preferência explícita', () => {
  assert.equal(brandThemeMode('stallone', '/admin'), 'light')
  assert.equal(brandThemeMode('stallone', '/admin/ecommerce'), 'light')
  assert.equal(brandThemeMode('stallone', '/ecommerce/stallone'), 'light')
  assert.equal(brandThemeMode('stallone', '/ecommerce/stallone', 'dark'), 'light', 'vitrine da Stallone é sempre clara')
  assert.equal(brandThemeMode('stallone', '/checkout/stallone', 'dark'), 'light')
  assert.equal(brandThemeMode('stallone', '/admin', 'dark'), 'dark')
  assert.equal(brandThemeMode('stallone', '/checkout/stallone', 'light'), 'light')
  assert.equal(brandThemeMode('dino', '/admin'), 'system')
  assert.equal(brandThemeMode('kytto', '/admin', 'dark'), 'system')
})

test('Stallone usa o símbolo S como ícone da aba e da instalação', async () => {
  const { brandIcons } = await import('./brand.js')
  assert.equal(brandIcons('stallone').icon, '/brand/stallone-mark.svg')
  assert.equal(brandIcons('stallone').touchIcon, '/brand/stallone-icon-192.png')
  assert.equal(brandIcons('stallone').themeColor, '#FFFFFF', 'barra do navegador branca, como a loja')
  assert.equal(brandIcons('dino'), null)
  assert.equal(brandIcons('kytto'), null)
})
