import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAvecMaterials } from './avec-import-materials.js';

const SCOPE = Object.freeze({
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
});
const CUTOFF = '2026-01-15T12:00:00Z';

function material(overrides = {}) {
  return {
    sourceId: 'mat-001',
    sourceServiceId: 'service-001',
    sourceProductId: 'product-001',
    quantity: 2,
    consumptionUnit: 'kg',
    referenceUnit: 'g',
    referenceQuantity: 1000,
    costCents: 0,
    costEvidence: 'evidence-ref-001',
    lojaId: SCOPE.lojaId,
    serviceUnitConfirmed: true,
    ...overrides,
  };
}

function analyze(rows, scope = SCOPE, cutoff = CUTOFF) {
  return analyzeAvecMaterials({ rows, cutoff }, scope);
}

function reasons(result) {
  return result[0].reasons;
}

function assertOnlyRowResult(value) {
  assert.deepEqual(Object.keys(value).sort(), ['line', 'reasons', 'status']);
  assert.equal(typeof value.line, 'number');
  assert.ok(Array.isArray(value.reasons));
  assert.ok(['blocked', 'ignored', 'ready_for_mapping'].includes(value.status));
}

test('linha material válida fica pronta para mapeamento, nunca pronta para aplicação', () => {
  const result = analyze([material()]);
  assert.deepEqual(result, [{ line: 1, status: 'ready_for_mapping', reasons: [] }]);
});

test('aceita zero explícito como custo e distingue ausência de custo', () => {
  assert.deepEqual(analyze([material({ costCents: 0 })])[0].reasons, []);
  assert.ok(reasons(analyze([material({ costCents: undefined })])).includes('COST_CENTS_MISSING'));
  assert.ok(reasons(analyze([material({ costCents: null })])).includes('COST_CENTS_MISSING'));
});

test('bloqueia custo não inteiro, negativo, inseguro ou não finito', () => {
  for (const costCents of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(
      reasons(analyze([material({ costCents })])).includes('COST_CENTS_INVALID'),
      `costCents inválido não bloqueado: ${String(costCents)}`,
    );
  }
});

test('exige identificadores seguros e não infere nome ou aproximação', () => {
  const result = analyze([material({
    sourceId: '=source',
    sourceServiceId: 'service',
    sourceProductId: 'product',
    name: 'não deve aparecer',
    approximateProduct: 'não deve ser usado',
  })]);
  assert.ok(reasons(result).includes('SOURCE_ID_INVALID'));
  assert.equal(result[0].status, 'blocked');
  assert.doesNotMatch(JSON.stringify(result), /não deve aparecer|approximateProduct|service|product|source/);
});

test('bloqueia quantidade e quantidade de referência ausentes, zero, negativas ou não finitas', () => {
  for (const quantity of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(reasons(analyze([material({ quantity })])).includes('QUANTITY_INVALID'));
  }
  for (const referenceQuantity of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(reasons(analyze([material({ referenceQuantity })])).includes('REFERENCE_QUANTITY_INVALID'));
  }
});

test('valida enumeração e compatibilidade de famílias de unidades sem conversão', () => {
  const invalid = analyze([material({ consumptionUnit: 'kg', referenceUnit: 'ml' })])[0];
  assert.equal(invalid.status, 'blocked');
  assert.ok(invalid.reasons.includes('UNIT_FAMILY_MISMATCH'));
  assert.equal(analyze([material({ consumptionUnit: 'g', referenceUnit: 'kg' })])[0].status, 'ready_for_mapping');
  assert.equal(analyze([material({ consumptionUnit: 'l', referenceUnit: 'ml' })])[0].status, 'ready_for_mapping');
  assert.ok(reasons(analyze([material({ consumptionUnit: 'invalid-unit' })])).includes('CONSUMPTION_UNIT_INVALID'));
  assert.ok(reasons(analyze([material({ referenceUnit: 'mg' })])).includes('REFERENCE_UNIT_INVALID'));
});

test('exige evidência de custo não vazia, confirmação de unidade e loja exata', () => {
  const result = analyze([material({
    costEvidence: '   ',
    serviceUnitConfirmed: false,
    lojaId: '33333333-3333-4333-8333-333333333333',
  })])[0];
  assert.equal(result.status, 'blocked');
  assert.ok(result.reasons.includes('COST_EVIDENCE_MISSING'));
  assert.ok(result.reasons.includes('SERVICE_UNIT_UNCONFIRMED'));
  assert.ok(result.reasons.includes('STORE_SCOPE_MISMATCH'));
});

test('loja inválida ou ausente é bloqueada e nunca considerada igual ao escopo', () => {
  assert.ok(reasons(analyze([material({ lojaId: undefined })])).includes('STORE_ID_MISSING'));
  assert.ok(reasons(analyze([material({ lojaId: 'not-a-uuid' })])).includes('STORE_ID_INVALID'));
});

test('marca todas as linhas com sourceId seguro repetido como duplicadas', () => {
  const result = analyze([material(), material({ sourceId: 'mat-001' }), material({ sourceId: 'mat-002' })]);
  assert.ok(result[0].reasons.includes('DUPLICATE_SOURCE_ID'));
  assert.ok(result[1].reasons.includes('DUPLICATE_SOURCE_ID'));
  assert.deepEqual(result[2].reasons, []);
});

test('usa linhas 1-based, bloqueia cutoff inválido e não produz status de aplicação', () => {
  const result = analyze([material(), material({ sourceId: 'mat-002' })], SCOPE, '2026-01-15');
  assert.deepEqual(result.map(row => row.line), [1, 2]);
  assert.ok(result.every(row => row.status === 'blocked'));
  assert.ok(result.every(row => row.reasons.includes('CUTOFF_INVALID')));
  assert.ok(result.every(row => !Object.hasOwn(row, 'payload') && !Object.hasOwn(row, 'proposal')));
});

test('não vaza entradas, nomes, valores, PII ou campos desconhecidos e não muta input/escopo', () => {
  const input = {
    rows: [material({
      costEvidence: 'private evidence text',
      name: 'Pessoa ou material privado',
      email: 'private@example.test',
      secret: 'should-not-output',
      arbitraryValue: 'should-not-output',
    })],
    cutoff: CUTOFF,
  };
  const before = structuredClone(input);
  const scope = { ...SCOPE };
  const result = analyzeAvecMaterials(input, scope);
  assert.deepEqual(input, before);
  assert.deepEqual(scope, SCOPE);
  assertOnlyRowResult(result[0]);
  assert.doesNotMatch(JSON.stringify(result), /private evidence|Pessoa|example|should-not-output|mat-001|service-001|product-001|22222222/);
});

test('retorna array vazio para entrada sem rows sem acessar DB, rede ou arquivos', () => {
  assert.deepEqual(analyzeAvecMaterials({ cutoff: CUTOFF }, SCOPE), []);
});
