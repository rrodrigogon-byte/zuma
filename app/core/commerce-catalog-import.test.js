import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportInput } from './commerce-catalog-import.js';

const STOREFRONT_A = '11111111-1111-4111-8111-111111111111';
const STOREFRONT_B = '22222222-2222-4222-8222-222222222222';
const LOCATION_A = '33333333-3333-4333-8333-333333333333';

function input(items, override = {}) {
  return { storefrontId: STOREFRONT_A, locationId: LOCATION_A, items, ...override };
}

test('normaliza preços brasileiros e mantém sem estoque como rascunho', () => {
  const result = normalizeImportInput(input([
    { sku: 'DINO-001', produto: 'Perfume A', categoria: 'Perfumes', preco: 'R$ 1.250,00', estoque: 2, acao: 'publicar' },
    { sku: 'DINO-002', produto: 'Perfume B', preco: '350,00', estoque: '', acao: 'publicar' },
  ]));
  assert.equal(result.items[0].price, 1250);
  assert.equal(result.items[0].targetStock, 2);
  assert.equal(result.items[0].action, 'publish');
  assert.equal(result.items[1].price, 350);
  assert.equal(result.items[1].targetStock, null);
  assert.equal(result.items[1].action, 'draft');
});

test('hash do dataset é estável e hash de requisição separa storefronts', () => {
  const items = [{ sku: 'DINO-003', produto: 'Produto', preco: 100, estoque: 1, acao: 'publicar' }];
  const first = normalizeImportInput(input(items));
  const repeated = normalizeImportInput(input(items));
  const otherStorefront = normalizeImportInput(input(items, { storefrontId: STOREFRONT_B }));
  assert.equal(first.hash, repeated.hash);
  assert.equal(first.requestHash, repeated.requestHash);
  assert.equal(first.hash, otherStorefront.hash);
  assert.notEqual(first.requestHash, otherStorefront.requestHash);
});

test('rejeita SKU duplicado no mesmo lote', () => {
  assert.throws(
    () => normalizeImportInput(input([
      { sku: 'DINO-004', produto: 'Produto A', preco: 10, estoque: 1 },
      { sku: 'dino-004', produto: 'Produto B', preco: 12, estoque: 1 },
    ])),
    error => error?.code === 'CATALOG_IMPORT_DUPLICATE_SKU',
  );
});

test('rejeita preço ou estoque inválidos', () => {
  assert.throws(() => normalizeImportInput(input([{ sku: 'DINO-005', produto: 'Produto', preco: -1, estoque: 1 }])), error => error?.code === 'CATALOG_IMPORT_PRICE_INVALID');
  assert.throws(() => normalizeImportInput(input([{ sku: 'DINO-006', produto: 'Produto', preco: 1, estoque: -1 }])), error => error?.code === 'CATALOG_IMPORT_STOCK_INVALID');
  assert.throws(() => normalizeImportInput(input([{ sku: 'DINO-007', produto: 'Produto', preco: 1, estoque: 1.5 }])), error => error?.code === 'CATALOG_IMPORT_STOCK_INVALID');
});

test('rejeita lotes vazios ou acima do limite', () => {
  assert.throws(() => normalizeImportInput(input([])), error => error?.code === 'CATALOG_IMPORT_SIZE_INVALID');
  const tooMany = Array.from({ length: 501 }, (_, index) => ({ sku: `SKU-${String(index).padStart(3, '0')}`, produto: `Produto ${index}`, preco: 1, estoque: 1 }));
  assert.throws(() => normalizeImportInput(input(tooMany)), error => error?.code === 'CATALOG_IMPORT_SIZE_INVALID');
});
