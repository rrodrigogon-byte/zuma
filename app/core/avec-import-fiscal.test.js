import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAvecFiscal, schemaId } from './avec-import-fiscal.js';

const SCOPE = Object.freeze({
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
});
const OTHER_SCOPE = '33333333-3333-4333-8333-333333333333';
const CUTOFF = '2026-10-14T12:00:00-04:00';

function baseRow(overrides = {}) {
  return {
    cnpj: '11444777000161',
    razaoSocial: 'Empresa Fiscal Sintética',
    nomeFantasia: 'Loja Fiscal Sintética',
    inscricaoEstadual: { state: 'provided', value: '110042490114' },
    inscricaoMunicipal: { state: 'exempt', value: null },
    regime: 'simples_nacional',
    address: {
      cep: '78000000',
      logradouro: 'Rua Sintética',
      numero: 0,
      bairro: 'Centro',
      cidade: 'Cuiabá',
      uf: 'MT',
    },
    lojaId: SCOPE.lojaId,
    fiscalReviewConfirmed: true,
    reviewScope: { ...SCOPE },
    dataFormat: { format: 'avec-fiscal-v1', version: '1' },
    sourceRef: 'source-fiscal-001',
    ...overrides,
  };
}

function analyze(rows, scope = SCOPE, input = {}) {
  return analyzeAvecFiscal({ rows, cutoff: CUTOFF, ...input }, scope);
}

function reasons(result) {
  return new Set(result.reasons);
}

function assertRowResult(result) {
  assert.deepEqual(Object.keys(result).sort(), ['line', 'reasons', 'status']);
  assert.equal(typeof result.line, 'number');
  assert.ok(Array.isArray(result.reasons));
  assert.ok(['blocked', 'ignored', 'ready_for_mapping'].includes(result.status));
  assert.equal(Object.hasOwn(result, 'payload'), false);
  assert.equal(Object.hasOwn(result, 'proposal'), false);
  assert.equal(Object.hasOwn(result, 'readyApply'), false);
}

test('exporta o schema fiscal e retorna linha válida somente pronta para mapeamento', () => {
  assert.equal(schemaId, 'fiscal');
  const result = analyze([baseRow()]);
  assert.deepEqual(result, [{ line: 1, status: 'ready_for_mapping', reasons: [] }]);
  assertRowResult(result[0]);
});

test('valida CNPJ de 14 dígitos e os dois dígitos verificadores sem normalizar a entrada', () => {
  assert.equal(analyze([baseRow({ cnpj: '11444777000161' })])[0].status, 'ready_for_mapping');
  assert.ok(reasons(analyze([baseRow({ cnpj: '11444777000162' })])[0]).has('CNPJ_DV_INVALID'));
  assert.ok(reasons(analyze([baseRow({ cnpj: '11.444.777/0001-61' })])[0]).has('CNPJ_FORMAT_INVALID'));
  assert.ok(reasons(analyze([baseRow({ cnpj: '00000000000000' })])[0]).has('CNPJ_DV_INVALID'));
});

test('aceita número de endereço zero, estados de inscrição explícitos e bloqueia ausência/valor incompatível', () => {
  assert.equal(analyze([baseRow({ inscricaoMunicipal: { state: 'not_applicable', value: null }, address: { ...baseRow().address, numero: 0 } })])[0].status, 'ready_for_mapping');
  const absent = analyze([baseRow({ inscricaoEstadual: undefined })])[0];
  assert.ok(reasons(absent).has('INSCRIPTION_REQUIRED'));
  const providedEmpty = analyze([baseRow({ inscricaoEstadual: { state: 'provided', value: '' } })])[0];
  assert.ok(reasons(providedEmpty).has('INSCRIPTION_REQUIRED'));
  const exemptWithValue = analyze([baseRow({ inscricaoMunicipal: { state: 'exempt', value: 'should-not-be-here' } })])[0];
  assert.ok(reasons(exemptWithValue).has('INSCRIPTION_FORMAT_INVALID'));
  const missingNumber = analyze([baseRow({ address: { ...baseRow().address, numero: undefined } })])[0];
  assert.ok(reasons(missingNumber).has('ADDRESS_INVALID'));
});

test('não infere regime e aceita somente enum ou mapeamento simples explicitamente declarado', () => {
  for (const regime of ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']) {
    assert.equal(analyze([baseRow({ regime })])[0].status, 'ready_for_mapping');
  }
  const notInferred = analyze([baseRow({ regime: 'simples' })])[0];
  assert.ok(reasons(notInferred).has('REGIME_INVALID'));
  assert.equal(analyze([baseRow({ regime: 'simples', regimeMapping: 'simples->simples_nacional' })])[0].status, 'ready_for_mapping');
  assert.equal(analyze([baseRow({ regime: { from: 'simples', to: 'simples_nacional', declared: true } })])[0].status, 'ready_for_mapping');
  assert.ok(reasons(analyze([baseRow({ regime: 'simples', regimeMapping: { from: 'simples', to: 'simples_nacional', declared: false } })])[0]).has('REGIME_INVALID'));
});

test('exige fonte, revisão de escopo e formato de dados, sem ecoar seus valores', () => {
  const missing = analyze([baseRow({ sourceRef: undefined, fiscalReviewConfirmed: false, reviewScope: undefined, dataFormat: undefined })])[0];
  assert.deepEqual([...reasons(missing)].sort(), ['DATA_FORMAT_REQUIRED', 'FISCAL_REVIEW_UNCONFIRMED', 'REVIEW_SCOPE_REQUIRED', 'SOURCE_REF_INVALID'].sort());
  const invalidReview = analyze([baseRow({ reviewScope: { ...SCOPE, lojaId: OTHER_SCOPE } })])[0];
  assert.ok(reasons(invalidReview).has('REVIEW_SCOPE_INVALID'));
  const invalidFormat = analyze([baseRow({ dataFormat: { version: '1' } })])[0];
  assert.ok(reasons(invalidFormat).has('DATA_FORMAT_INVALID'));
});

test('bloqueia contradicão de empresa/loja e escopo confiável inválido', () => {
  const rowMismatch = analyze([baseRow({ lojaId: OTHER_SCOPE })])[0];
  assert.equal(rowMismatch.status, 'blocked');
  assert.ok(reasons(rowMismatch).has('LOJA_SCOPE_MISMATCH'));
  const empresaMismatch = analyze([baseRow({ empresaId: OTHER_SCOPE })])[0];
  assert.ok(reasons(empresaMismatch).has('EMPRESA_SCOPE_MISMATCH'));
  const invalidScope = analyze([baseRow()], { empresaId: 'not-an-id', lojaId: SCOPE.lojaId })[0];
  assert.ok(reasons(invalidScope).has('SCOPE_INVALID'));
});

test('marca todas as linhas com CNPJ ou sourceRef duplicados e mantém rowResult 1-based', () => {
  const result = analyze([
    baseRow({ sourceRef: 'duplicate-ref' }),
    baseRow({ sourceRef: 'duplicate-ref' }),
  ]);
  assert.deepEqual(result.map(row => row.line), [1, 2]);
  assert.ok(reasons(result[0]).has('DUPLICATE_CNPJ'));
  assert.ok(reasons(result[0]).has('DUPLICATE_SOURCE_REF'));
  assert.ok(reasons(result[1]).has('DUPLICATE_SOURCE_REF'));
  assert.ok(reasons(result[1]).has('ROW_COUNT_INVALID'));
  assert.ok(result.every(row => row.status === 'blocked'));
});

test('documentos são aceitos apenas como referência minimizada autenticada e nunca aparecem no resultado', () => {
  const authenticated = analyze([baseRow({ documents: { authenticated: true, documentRef: 'doc-ref-synthetic', digest: 'digest-synthetic' } })]);
  assert.equal(authenticated[0].status, 'ready_for_mapping');
  const credentials = analyze([baseRow({ documents: { authenticated: true, credentials: 'private-secret' } })])[0];
  assert.ok(reasons(credentials).has('DOCUMENTS_INVALID'));
  assert.doesNotMatch(JSON.stringify(credentials), /doc-ref-synthetic|digest-synthetic|private-secret|credentials/);
});

test('cutoff inválido bloqueia sem depender da data atual e rows acima de um são bloqueados', () => {
  const invalidCutoff = analyze([baseRow()], SCOPE, { cutoff: '2026-02-30T12:00:00Z' })[0];
  assert.ok(reasons(invalidCutoff).has('CUTOFF_INVALID'));
  const tooMany = analyze([baseRow(), baseRow({ sourceRef: 'source-fiscal-002', cnpj: '11222333000181' })]);
  assert.ok(tooMany.every(row => reasons(row).has('ROW_COUNT_INVALID')));
});

test('não acessa rede, DB ou arquivos, não escreve, não muta entrada e não vaza nomes/PII/valores/mapeamentos', () => {
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = () => { fetchCalled = true; throw new Error('network must not be used'); };
  const input = Object.freeze({
    rows: Object.freeze([Object.freeze(baseRow({
      razaoSocial: 'Nome empresarial sensível',
      nomeFantasia: 'Nome privado',
      secretValue: 'private-value',
      mappedCustomerId: 'destination-id',
      amount: 999,
    }))]),
    cutoff: CUTOFF,
  });
  const before = structuredClone(input);
  const scope = { ...SCOPE };
  try {
    const result = analyzeAvecFiscal(input, scope);
    assert.equal(fetchCalled, false);
    assert.deepEqual(input, before);
    assert.deepEqual(scope, SCOPE);
    assertRowResult(result[0]);
    assert.doesNotMatch(JSON.stringify(result), /Nome empresarial sensível|Nome privado|private-value|destination-id|999|22222222/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
test('UF brasileira exige sigla existente, sem inferir validade fiscal do endereço', () => {
  for (const uf of ['XX', 'ZZ', 'mt', 'USA']) assert.ok(reasons(analyze([baseRow({ address: { ...baseRow().address, uf } })])[0]).has('ADDRESS_INVALID'));
  for (const uf of ['MT', 'SP', 'DF']) assert.equal(analyze([baseRow({ address: { ...baseRow().address, uf } })])[0].status, 'ready_for_mapping');
});
