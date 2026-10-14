import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAvecProducts } from './avec-import-products.js';

const SCOPE = Object.freeze({
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
});
const CUTOFF = '2026-10-14T12:00:00Z';

function input(rows) {
  return {
    source: 'avec',
    category: 'products',
    cutoff: CUTOFF,
    rows,
  };
}

function analyze(rows) {
  return analyzeAvecProducts(input(rows), SCOPE);
}

function row(overrides = {}) {
  return {
    sourceId: 'AV-P-001',
    sku: 'DINO-001',
    ean: '0012345678905',
    ncm: '22030000',
    custo: '10,00',
    custoNature: 'declared_purchase',
    unidade: 'UN',
    ...overrides,
  };
}

test('produto válido fica somente pronto para mapeamento', () => {
  const [result] = analyze([row()]);
  assert.deepEqual(result, { line: 1, status: 'ready_for_mapping', reasons: [] });
  assert.equal('proposal' in result, false);
  assert.equal('payload' in result, false);
});

test('exige identificador seguro, unidade válida e natureza de custo', () => {
  const [result] = analyze([row({ sourceId: '', sku: '', ean: '', unidade: '', custoNature: 'unknown' })]);
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.reasons, [
    'COST_NATURE_REQUIRED',
    'IDENTIFIER_MISSING',
    'UNIT_MISSING',
  ]);
});

test('não bloqueia EAN ou NCM ausentes, e não devolve valores de origem', () => {
  const [result] = analyze([row({ ean: '', ncm: '' })]);
  assert.equal(result.status, 'ready_for_mapping');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(Object.keys(result), ['line', 'status', 'reasons']);
});

test('distingue custo zero confirmado de custo ausente e nunca transforma ausente em zero', () => {
  const [zero, missing] = analyze([
    row({ sourceId: 'AV-P-ZERO', sku: 'DINO-ZERO', ean: '7891234567890', custo: '0,00', custoNature: 'confirmed_zero' }),
    row({ sourceId: 'AV-P-MISSING', sku: 'DINO-MISSING', ean: '7891234567891', custo: '', custoNature: 'declared_purchase' }),
  ]);
  assert.equal(zero.status, 'ready_for_mapping');
  assert.deepEqual(zero.reasons, []);
  assert.equal(missing.status, 'blocked');
  assert.deepEqual(missing.reasons, ['COST_MISSING']);
  assert.equal(JSON.stringify(missing).includes('0'), false);
});

test('bloqueia preço, estoque e publicação fora do escopo', () => {
  const [result] = analyze([row({ price: 12, estoque: 5, publicado: true, statusPublicacao: 'published' })]);
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.reasons, ['PRICE_STOCK_PUBLICATION_OUT_OF_SCOPE']);
});

test('detecta identificadores repetidos sem escolher mapeamento', () => {
  const results = analyze([
    row({ sourceId: 'AV-P-DUP', sku: 'DINO-DUP', ean: '7891234567890' }),
    row({ sourceId: 'AV-P-DUP', sku: 'DINO-DUP', ean: '7891234567890' }),
  ]);
  for (const result of results) {
    assert.equal(result.status, 'blocked');
    assert.deepEqual(result.reasons, [
      'DUPLICATE_SOURCE_EAN',
      'DUPLICATE_SOURCE_ID',
      'DUPLICATE_SOURCE_SKU',
    ]);
  }
});

test('bloqueia colisão por identificador compartilhado entre linhas', () => {
  const results = analyze([
    row({ sourceId: 'AV-P-COLLIDE', sku: 'DINO-A', ean: '7891234567890' }),
    row({ sourceId: 'AV-P-COLLIDE', sku: 'DINO-B', ean: '7891234567891' }),
  ]);
  assert.equal(results[0].status, 'blocked');
  assert.equal(results[1].status, 'blocked');
  assert.deepEqual(results[0].reasons, ['DUPLICATE_SOURCE_ID']);
  assert.deepEqual(results[1].reasons, ['DUPLICATE_SOURCE_ID']);
});

test('bloqueia unidade ausente ou inválida e preserva unidade válida', () => {
  const results = analyze([
    row({ sourceId: 'AV-P-UNIT-MISSING', sku: 'DINO-UM', ean: '7891234567890', unidade: '' }),
    row({ sourceId: 'AV-P-UNIT-BAD', sku: 'DINO-UB', ean: '7891234567891', unidade: 'LITROS' }),
    row({ sourceId: 'AV-P-UNIT-OK', sku: 'DINO-UO', ean: '7891234567892', unidade: 'kg' }),
  ]);
  assert.deepEqual(results[0].reasons, ['UNIT_MISSING']);
  assert.deepEqual(results[1].reasons, ['UNIT_INVALID']);
  assert.equal(results[2].status, 'ready_for_mapping');
});

test('bloqueia contradições de empresa e loja no escopo confiável', () => {
  const results = analyze([
    row({ sourceId: 'AV-P-TENANT', sku: 'DINO-T', ean: '7891234567890', empresaId: '33333333-3333-4333-8333-333333333333' }),
    row({ sourceId: 'AV-P-STORE', sku: 'DINO-S', ean: '7891234567891', lojaId: '44444444-4444-4444-8444-444444444444' }),
  ]);
  assert.deepEqual(results[0].reasons, ['TENANT_SCOPE_MISMATCH']);
  assert.deepEqual(results[1].reasons, ['STORE_SCOPE_MISMATCH']);
});

test('não ecoa PII, segredos, nomes, evidências ou valores em razões', () => {
  const secret = 'synthetic-secret-not-output';
  const result = analyze([row({
    sourceId: 'AV-P-SAFE',
    nome: 'Nome de teste que não deve sair',
    evidence: { token: secret, customerName: 'PII sintética' },
    price: secret,
  })])[0];
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('Nome de teste'), false);
  assert.equal(serialized.includes('PII sintética'), false);
  assert.equal(serialized.includes('AV-P-SAFE'), false);
  assert.deepEqual(result.reasons, ['PRICE_STOCK_PUBLICATION_OUT_OF_SCOPE']);
});

test('não executa escrita nem acesso externo: saída é determinística e somente rowResult', () => {
  const rows = [row({ sourceId: 'AV-P-DETERMINISTIC', sku: 'DINO-DET' })];
  const first = analyze(rows);
  const second = analyze(rows);
  assert.deepEqual(first, second);
  assert.deepEqual(first[0], { line: 1, status: 'ready_for_mapping', reasons: [] });
  assert.equal(first[0].status === 'readyToApply', false);
});
