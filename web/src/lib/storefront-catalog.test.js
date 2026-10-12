import test from 'node:test'
import assert from 'node:assert/strict'
import { addProductToCart, applyCartLink, cartItemCount, cartSubtotal, filterCatalog, normalizeSearchText, parseCartLink, stockState } from './storefront-catalog.js'

const catalog = [
  { id: 'p1', variantId: 'v1', nome: 'Xerjoff Decas 100ml', cat: 'Perfumes', cod: 'XJ-DECAS-100', descricao: 'Oriental sofisticado', preco: 2600, estoque: 5, esgotado: false, variants: [{ variantId: 'v1', cod: 'XJ-DECAS-100', label: '100ml' }] },
  { id: 'p2', variantId: 'v2', nome: 'Pomada Modeladora', cat: 'Cuidados pessoais', cod: 'POM-01', descricao: 'Fixação média, efeito matte', preco: 59.9, estoque: 2, esgotado: false, variants: [] },
  { id: 'p3', variantId: 'v3', nome: 'Érba Pura', cat: 'Perfumes', cod: 'XJ-ERBA', descricao: 'Cítrico', preco: 2600, estoque: 0, esgotado: true, variants: [] },
  { id: 'p4', variantId: 'v4', nome: 'Madagascar Centella', cat: 'Cuidados pessoais', cod: 'SKIN-1004', descricao: 'Sob encomenda', preco: 1087, estoque: 0, esgotado: false, permiteCompraSemEstoque: true, variants: [] },
]

test('normaliza caixa e acentos', () => {
  assert.equal(normalizeSearchText('  ÉRBA   Pura '), 'erba pura')
})

test('busca por nome, SKU, categoria e descrição, ignorando caixa/acento', () => {
  assert.deepEqual(filterCatalog(catalog, { query: 'xerjoff' }).map(p => p.id), ['p1'])
  assert.deepEqual(filterCatalog(catalog, { query: 'XERJOFF' }).map(p => p.id), ['p1'])
  assert.deepEqual(filterCatalog(catalog, { query: 'decas' }).map(p => p.id), ['p1'])
  assert.deepEqual(filterCatalog(catalog, { query: 'pom-01' }).map(p => p.id), ['p2'])
  assert.deepEqual(filterCatalog(catalog, { query: 'perfume' }).map(p => p.id), ['p1', 'p3'])
  assert.deepEqual(filterCatalog(catalog, { query: 'Perfumes' }).map(p => p.id), ['p1', 'p3'])
  assert.deepEqual(filterCatalog(catalog, { query: 'erba' }).map(p => p.id), ['p3'])
  assert.deepEqual(filterCatalog(catalog, { query: 'matte' }).map(p => p.id), ['p2'])
  assert.deepEqual(filterCatalog(catalog, { query: 'nada-disso' }), [])
})

test('filtro por categoria combina com busca', () => {
  assert.deepEqual(filterCatalog(catalog, { category: 'Cuidados pessoais' }).map(p => p.id), ['p2', 'p4'])
  assert.deepEqual(filterCatalog(catalog, { category: 'Perfumes', query: 'decas' }).map(p => p.id), ['p1'])
  assert.equal(filterCatalog(catalog, { category: 'Todos' }).length, 4)
})

test('estado de estoque: disponível, baixo e esgotado', () => {
  assert.equal(stockState(catalog[0]).kind, 'ok')
  assert.deepEqual(stockState(catalog[1]), { kind: 'low', stock: 2, label: 'Últimas 2 unidades' })
  assert.equal(stockState({ estoque: 1 }).label, 'Última unidade')
  assert.equal(stockState(catalog[2]).kind, 'out')
  assert.deepEqual(stockState(catalog[3]), { kind: 'backorder', stock: 0, label: 'Sob encomenda' })
})

test('adicionar incrementa a contagem do carrinho', () => {
  let cart = []
  let result = addProductToCart(cart, catalog[0])
  assert.equal(result.ok, true)
  assert.equal(result.added, 1)
  cart = result.cart
  assert.equal(cartItemCount(cart), 1)
  result = addProductToCart(cart, catalog[0])
  cart = result.cart
  assert.equal(cartItemCount(cart), 2)
  assert.equal(cart.length, 1)
  assert.equal(cartSubtotal(cart), 5200)
})

test('produto esgotado não entra no carrinho', () => {
  const result = addProductToCart([], catalog[2])
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'out_of_stock')
  assert.deepEqual(result.cart, [])
})

test('produto sob encomenda entra no carrinho mesmo com estoque zero', () => {
  const result = addProductToCart([], catalog[3])
  assert.equal(result.ok, true)
  assert.equal(result.quantity, 1)
  assert.equal(result.stock, 999)
})

test('limite de estoque é respeitado', () => {
  let cart = addProductToCart([], catalog[1]).cart
  cart = addProductToCart(cart, catalog[1]).cart
  const blocked = addProductToCart(cart, catalog[1])
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'stock_limit')
  assert.equal(cartItemCount(blocked.cart), 2)
  const clamped = addProductToCart([], catalog[1], 5)
  assert.equal(clamped.quantity, 2)
  assert.equal(clamped.added, 2)
})

test('paginateCatalog mostra o catálogo em páginas e informa o restante', async () => {
  const { paginateCatalog, CATALOG_PAGE_SIZE } = await import('./storefront-catalog.js')
  const list = Array.from({ length: 130 }, (_, index) => ({ id: index }))
  const first = paginateCatalog(list)
  assert.equal(first.items.length, CATALOG_PAGE_SIZE)
  assert.equal(first.remaining, 130 - CATALOG_PAGE_SIZE)
  assert.equal(first.hasMore, true)
  const all = paginateCatalog(list, 500)
  assert.equal(all.items.length, 130)
  assert.equal(all.hasMore, false)
  assert.equal(paginateCatalog([], 48).total, 0)
  assert.equal(paginateCatalog(list, 0).items.length, CATALOG_PAGE_SIZE)
})

test('congelados e refrigerados deixam o carrinho só para retirada', async () => {
  const { cartHasPickupOnlyItems, isPickupOnlyProduct } = await import('./storefront-catalog.js')
  const products = [
    { id: 'p1', nome: 'Creatina 300g', cat: 'Creatina' },
    { id: 'p2', nome: 'Pão de queijo 1kg', cat: 'Sem glúten & Congelados' },
    { id: 'p3', nome: 'Iogurte proteico refrigerado', cat: 'Despensa saudável' },
  ]
  assert.equal(isPickupOnlyProduct(products[0]), false)
  assert.equal(isPickupOnlyProduct(products[1]), true)
  assert.equal(isPickupOnlyProduct(products[2]), true)
  assert.equal(cartHasPickupOnlyItems([{ produtoId: 'p1', qtd: 1 }], products), false)
  assert.equal(cartHasPickupOnlyItems([{ produtoId: 'p1', qtd: 1 }, { produtoId: 'p2', qtd: 1 }], products), true)
  assert.equal(cartHasPickupOnlyItems([], products), false)
})

test('link de carrinho do WhatsApp: lê só itens válidos e soma repetidos', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  assert.deepEqual(parseCartLink(`${id}:2,${id.toUpperCase()}:1,lixo,22222222-2222-4222-8222-222222222222:0`), [{ variantId: id, quantity: 3 }])
  assert.deepEqual(parseCartLink(`${id}:500`), [{ variantId: id, quantity: 99 }])
  assert.deepEqual(parseCartLink(''), [])
})

test('link de carrinho do WhatsApp: monta o carrinho respeitando estoque e catálogo atuais', () => {
  const a = '11111111-1111-4111-8111-111111111111'
  const b = '22222222-2222-4222-8222-222222222222'
  const catalog = { [a]: { product: { id: 'p1', variantId: a, nome: 'Creatina', preco: 89.9, estoque: 1 }, available: 1 } }
  const result = applyCartLink([], [{ variantId: a, quantity: 2 }, { variantId: b, quantity: 1 }], id => catalog[id] || null)
  assert.equal(result.cart.length, 1)
  assert.equal(result.cart[0].qtd, 1, 'não passa do estoque disponível')
  assert.deepEqual(result.added, [a])
  assert.deepEqual(result.missing, [b])
  const again = applyCartLink(result.cart, [{ variantId: a, quantity: 1 }], id => catalog[id] || null)
  assert.equal(again.cart[0].qtd, 1, 'abrir o mesmo link de novo não duplica')
})
