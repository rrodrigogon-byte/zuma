import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAvecFees } from './avec-import-fees.js';

const SCOPE = Object.freeze({
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
});
const OTHER_STORE = '33333333-3333-4333-8333-333333333333';
const CUTOFF = '2026-06-15T12:00:00Z';

function input(rows, cutoff = CUTOFF) {
  return { rows, cutoff };
}

function valid(overrides = {}) {
  return {
    sourceId: 'AV-FEE-001',
    acquirer: 'Acquirer A',
    method: 'credit',
    brand: 'visa',
    installments: 3,
    percent: 2.5,
    fixedCents: 99,
    anticipationMode: 'none',
    settlementDays: 30,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    contractRef: 'CONTRACT-001',
    lojaId: SCOPE.lojaId,
    ...overrides,
  };
}

function one(row = {}, scope = SCOPE) {
  return analyzeAvecFees(input([valid(row)]), scope)[0];
}

test('taxas válidas de crédito e débito ficam prontas somente para mapeamento', () => {
  const results = analyzeAvecFees(input([
    valid(),
    valid({ sourceId: 'AV-FEE-002', method: 'debit', brand: 'mastercard', installments: 1, percent: 1.2, fixedCents: 0 }),
  ]), SCOPE);
  assert.deepEqual(results, [
    { line: 1, status: 'ready_for_mapping', reasons: [] },
    { line: 2, status: 'ready_for_mapping', reasons: [] },
  ]);
  assert.equal(results.some(row => row.status === 'readyToApply'), false);
});

test('aceita taxa só percentual ou só fixa, inclusive percentual zero e fixa zero', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'PERCENT-ONLY', fixedCents: undefined, percent: 0 }),
    valid({ sourceId: 'FIXED-ONLY', brand: 'mastercard', percent: undefined, fixedCents: 0 }),
  ]), SCOPE);
  assert.deepEqual(results.map(row => row.status), ['ready_for_mapping', 'ready_for_mapping']);
});

test('exige componente de taxa explícito e rejeita números monetários não inteiros ou negativos', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'NONE', percent: undefined, fixedCents: undefined }),
    valid({ sourceId: 'FLOAT', percent: undefined, fixedCents: 10.5 }),
    valid({ sourceId: 'NEGATIVE', percent: undefined, fixedCents: -1 }),
    valid({ sourceId: 'PERCENT-OUT', percent: 100.01, fixedCents: undefined }),
    valid({ sourceId: 'PERCENT-NEG', percent: -0.01, fixedCents: undefined }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('FEE_COMPONENT_REQUIRED'));
  assert.ok(results[1].reasons.includes('FIXED_CENTS_INVALID'));
  assert.ok(results[2].reasons.includes('FIXED_CENTS_INVALID'));
  assert.ok(results[3].reasons.includes('PERCENT_INVALID'));
  assert.ok(results[4].reasons.includes('PERCENT_INVALID'));
  assert.ok(results.every(row => row.status === 'blocked'));
});

test('valida modalidade, bandeira e parcelas conforme crédito ou débito', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'NO-BRAND', brand: undefined }),
    valid({ sourceId: 'CREDIT-LOW', installments: 0 }),
    valid({ sourceId: 'CREDIT-HIGH', installments: 25 }),
    valid({ sourceId: 'DEBIT-MANY', method: 'debit', installments: 2 }),
    valid({ sourceId: 'UNKNOWN-METHOD', method: 'manual', brand: undefined, installments: undefined }),
    valid({ sourceId: 'NON-CARD', method: 'pix', brand: undefined, installments: undefined }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('BRAND_INVALID'));
  assert.ok(results[1].reasons.includes('INSTALLMENTS_INVALID'));
  assert.ok(results[2].reasons.includes('INSTALLMENTS_INVALID'));
  assert.ok(results[3].reasons.includes('INSTALLMENTS_INVALID'));
  assert.ok(results[4].reasons.includes('METHOD_INVALID'));
  assert.deepEqual(results[5], { line: 6, status: 'ready_for_mapping', reasons: [] });
});

test('antecipação ausente, zero, desconhecida ou inválida bloqueia sem inferência', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'MISSING', anticipationMode: undefined }),
    valid({ sourceId: 'ZERO', anticipationMode: 0 }),
    valid({ sourceId: 'UNKNOWN', anticipationMode: 'unknown' }),
    valid({ sourceId: 'INVALID', anticipationMode: 'automatic' }),
    valid({ sourceId: 'NONE', anticipationMode: 'none' }),
    valid({ sourceId: 'SEPARATE', anticipationMode: 'separate' }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('ANTICIPATION_MODE_REQUIRED'));
  assert.ok(results[1].reasons.includes('ANTICIPATION_MODE_INVALID'));
  assert.ok(results[2].reasons.includes('ANTICIPATION_UNKNOWN'));
  assert.ok(results[3].reasons.includes('ANTICIPATION_MODE_INVALID'));
  assert.equal(results[4].status, 'ready_for_mapping');
  assert.equal(results[5].status, 'ready_for_mapping');
});

test('valida settlementDays, IDs seguros e contrato sem ecoar campos inválidos', () => {
  const secret = 'PRIVATE-SECRET-PII-DO-NOT-ECHO';
  const results = analyzeAvecFees(input([
    valid({ sourceId: '=formula', acquirer: 'Acq', contractRef: 'Contract' }),
    valid({ sourceId: 'NEG-DAYS', settlementDays: -1 }),
    valid({ sourceId: 'FLOAT-DAYS', settlementDays: 1.5 }),
    valid({ sourceId: 'HIGH-DAYS', settlementDays: 366 }),
    valid({ sourceId: 'BAD-CONTRACT', contractRef: '' }),
    valid({ sourceId: secret, acquirer: '' }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('SOURCE_ID_INVALID'));
  assert.ok(results[1].reasons.includes('SETTLEMENT_DAYS_INVALID'));
  assert.ok(results[2].reasons.includes('SETTLEMENT_DAYS_INVALID'));
  assert.ok(results[3].reasons.includes('SETTLEMENT_DAYS_INVALID'));
  assert.ok(results[4].reasons.includes('CONTRACT_REF_INVALID'));
  assert.ok(results[5].reasons.includes('ACQUIRER_INVALID'));
  assert.doesNotMatch(JSON.stringify(results), /PRIVATE|SECRET|PII|formula|Acq|Contract/);
});

test('vigência exige datas YYYY-MM-DD válidas e cobre o cutoff explícito', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'BEFORE', validFrom: '2026-07-01' }),
    valid({ sourceId: 'AFTER', validTo: '2026-06-14' }),
    valid({ sourceId: 'BAD-FROM', validFrom: '15/01/2026' }),
    valid({ sourceId: 'BAD-TO', validTo: '2026-02-30' }),
    valid({ sourceId: 'REVERSED', validFrom: '2026-07-01', validTo: '2026-01-01' }),
    valid({ sourceId: 'GOOD', validFrom: '2026-06-15', validTo: '2026-06-15' }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('VALIDITY_NOT_COVERING_CUTOFF'));
  assert.ok(results[1].reasons.includes('VALIDITY_NOT_COVERING_CUTOFF'));
  assert.ok(results[2].reasons.includes('VALID_FROM_INVALID'));
  assert.ok(results[3].reasons.includes('VALID_TO_INVALID'));
  assert.ok(results[4].reasons.includes('VALIDITY_INVALID'));
  assert.equal(results[5].status, 'ready_for_mapping');
});

test('bloqueia unidade ausente, inválida ou diferente do escopo confiável', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'MISMATCH', lojaId: OTHER_STORE }),
    valid({ sourceId: 'MISSING', lojaId: undefined }),
    valid({ sourceId: 'INVALID', lojaId: 'not-a-uuid' }),
    valid({ sourceId: 'EXACT', brand: 'mastercard', lojaId: SCOPE.lojaId.toUpperCase() }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('LOJA_ID_MISMATCH'));
  assert.ok(results[1].reasons.includes('LOJA_ID_MISMATCH'));
  assert.ok(results[2].reasons.includes('LOJA_ID_MISMATCH'));
  assert.equal(results[3].status, 'ready_for_mapping');
});

test('marca duplicidade e conflito sem depender apenas de sourceId, respeitando vigências não sobrepostas', () => {
  const results = analyzeAvecFees(input([
    valid({ sourceId: 'SOURCE-A', validFrom: '2026-01-01', validTo: '2026-06-30', percent: 2 }),
    valid({ sourceId: 'SOURCE-B', validFrom: '2026-06-15', validTo: '2026-12-31', percent: 3 }),
    valid({ sourceId: 'SOURCE-C', validFrom: '2027-01-01', validTo: '2027-12-31', percent: 3 }),
    valid({ sourceId: 'SOURCE-D', validFrom: '2026-06-15', validTo: '2026-12-31', percent: 3 }),
  ]), SCOPE);
  assert.ok(results[0].reasons.includes('FEE_CONFLICT'));
  assert.ok(results[1].reasons.includes('FEE_CONFLICT'));
  assert.equal(results[2].status, 'blocked');
  assert.ok(results[2].reasons.includes('VALIDITY_NOT_COVERING_CUTOFF'));
  assert.ok(results[3].reasons.includes('DUPLICATE_FEE'));
  assert.equal(results[0].reasons.includes('DUPLICATE_FEE'), false);
});

test('não usa banco, rede, arquivos, mapeamentos de UI ou proposta de payload', () => {
  const result = one();
  assert.deepEqual(Object.keys(result).sort(), ['line', 'reasons', 'status']);
  assert.equal(typeof analyzeAvecFees, 'function');
  assert.doesNotMatch(analyzeAvecFees.toString(), /fetch|INSERT|UPDATE|DELETE|write|payload/i);
});
test('vigência usa o dia de Cuiabá no corte, não o dia UTC', () => {
  const rows = [valid({ validFrom: '2026-06-15', validTo: '2026-06-15' })];
  assert.equal(analyzeAvecFees(input(rows, '2026-06-15T23:30:00-04:00'), SCOPE)[0].status, 'ready_for_mapping');
  assert.equal(analyzeAvecFees(input(rows, '2026-06-16T03:30:00Z'), SCOPE)[0].status, 'ready_for_mapping');
  assert.equal(analyzeAvecFees(input(rows, '2026-06-16T04:00:00Z'), SCOPE)[0].status, 'blocked');
});
