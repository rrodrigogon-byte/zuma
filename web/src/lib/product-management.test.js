import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogSummary, filterProducts, pagination, productQuality, productStatus } from './product-management.js'

const products = [
  {
    id: 'p-1', nome: 'Perfume Completo', cod: 'PERF-001', cat: 'Perfumes', categoryId: 'cat-1', preco: 199.9,
    estoque: 12, ativo: true, publicado: true, status: 'active', descricaoCurta: 'Descrição', imagem: 'https://cdn.invalid/perfume.webp',
    variantes: [{ sku: 'PERF-001', barcode: '789000000001' }], atualizado_em: '2026-09-20T10:00:00Z',
  },
  {
    id: 'p-2', nome: 'Produto sem mídia', cod: 'LOW-002', cat: 'Cuidados', categoryId: 'cat-2', preco: 35,
    estoque: 3, ativo: true, publicado: false, status: 'active', descricao: '', media: [], variantes: [{ sku: 'LOW-002' }], atualizado_em: '2026-09-21T10:00:00Z',
  },
  {
    id: 'p-3', nome: 'Rascunho', cod: '', cat: '', preco: 0, estoque: 0, ativo: false, status: 'draft', variantes: [], atualizado_em: '2026-09-22T10:00:00Z',
  },
]

test('productStatus diferencia publicado, ativo fora da vitrine, rascunho e arquivado', () => {
  assert.equal(productStatus(products[0]), 'published')
  assert.equal(productStatus(products[1]), 'unpublished')
  assert.equal(productStatus(products[2]), 'draft')
  assert.equal(productStatus({ ativo: false, status: 'archived' }), 'archived')
})

test('productQuality calcula somente campos reais e lista lacunas', () => {
  assert.deepEqual(productQuality(products[0]), { score: 100, missing: [] })
  const incomplete = productQuality(products[1])
  assert.equal(incomplete.score, 67)
  assert.deepEqual(incomplete.missing, ['descrição', 'imagem'])
})

test('catalogSummary conta publicação, estoque e qualidade sem estimativas', () => {
  assert.deepEqual(catalogSummary(products), {
    total: 3,
    published: 1,
    notPublished: 2,
    lowStock: 0,
    outOfStock: 0,
    missingMedia: 2,
    incomplete: 2,
    totalUnits: 15,
  })
})

test('filterProducts busca também SKU e código de barras e combina filtros', () => {
  assert.deepEqual(filterProducts(products, { query: '789000000001' }).map(item => item.id), ['p-1'])
  assert.deepEqual(filterProducts(products, { status: 'unpublished', stock: 'low', quality: 'missing_media' }).map(item => item.id), ['p-2'])
  assert.deepEqual(filterProducts(products, { category: 'cat-1' }).map(item => item.id), ['p-1'])
})

test('filterProducts ordena por qualidade e estoque de forma determinística', () => {
  assert.deepEqual(filterProducts(products, { sort: 'quality_asc' }).map(item => item.id), ['p-3', 'p-2', 'p-1'])
  assert.deepEqual(filterProducts(products, { sort: 'stock_asc' }).map(item => item.id), ['p-3', 'p-2', 'p-1'])
})

test('pagination limita a página e preserva contagens', () => {
  const source = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }))
  assert.deepEqual(pagination(source, 2, 24), { page: 2, totalPages: 3, start: 24, end: 48, items: source.slice(24, 48) })
  assert.equal(pagination(source, 99, 24).page, 3)
})
