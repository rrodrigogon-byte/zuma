import assert from 'node:assert/strict'
import test from 'node:test'
import { filterCatalog, sortCatalog } from './storefront-catalog.js'

const products = [
  { id: 'sold', nome: 'A', cat: 'Perfumes', estoque: 0, preco: 10 },
  { id: 'b', nome: 'B', cat: 'Perfumes', estoque: 1, preco: 30 },
  { id: 'c', nome: 'C', cat: 'Outros', estoque: 4, preco: 20 },
]
test('prioriza produtos disponíveis sem alterar array original nem ordem editorial do grupo', () => {
  assert.deepEqual(sortCatalog(products).map(p => p.id), ['b', 'c', 'sold'])
  assert.deepEqual(products.map(p => p.id), ['sold', 'b', 'c'])
})
test('filtro de estoque combina busca e categoria', () => {
  assert.deepEqual(filterCatalog(products, { inStockOnly: true, category: 'Perfumes', query: 'B' }).map(p => p.id), ['b'])
  assert.deepEqual(filterCatalog(products, { inStockOnly: true, query: 'A' }), [])
})
test('ordenação explícita por preço ou nome', () => {
  assert.deepEqual(sortCatalog(products, 'price-asc').map(p => p.id), ['sold', 'c', 'b'])
  assert.deepEqual(sortCatalog(products, 'price-desc').map(p => p.id), ['b', 'c', 'sold'])
  assert.deepEqual(sortCatalog([...products].reverse(), 'name').map(p => p.id), ['sold', 'b', 'c'])
})
