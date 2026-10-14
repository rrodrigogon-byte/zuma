import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPreviewRegistry,
  PreviewConflictError,
  PreviewValidationError,
  previewTaxMaterialPlan,
  buildCurrentMaterials,
} from './comandas-caixa-previa.js';

const scope = { empresaId: 'empresa-fixture-dino', lojaId: 'unidade-fixture-dino' };

function plan(overrides = {}, context = {}) {
  return previewTaxMaterialPlan({
    idempotencyKey: 'fixture-plan',
    taxas: [{ meio: 'pix', percentual: 1.99, fixa: 0, fonte: 'fixture-sintetica' }],
    materiais: [{ servicoId: 'servico-fixture', produtoId: 'produto-fixture', quantidade: 2, unidade: 'ml', custoUnitario: 0.125, fonte: 'fixture-sintetica' }],
    simulacoes: [{ id: 'linha-fixture', servicoId: 'servico-fixture', bruto: 100, meio: 'pix', comissaoPercentual: 50 }],
    ...overrides,
  }, { ...scope, ...context });
}

test.beforeEach(() => clearPreviewRegistry());

test('calcula taxa/material/líquido com arredondamento monetário e não liquida nada', () => {
  const result = plan();
  assert.equal(result.status, 'pendente_revisao');
  assert.equal(result.linhas[0].taxa, 1.99);
  assert.equal(result.linhas[0].material, 0.25);
  assert.equal(result.linhas[0].liquido, 97.76);
  assert.equal(result.linhas[0].comissaoIndicativa, 48.88);
  assert.equal(result.linhas[0].liquidado, false);
  assert.equal(result.linhas[0].conciliado, false);
  assert.equal(result.linhas[0].pagamentoCriado, false);
  assert.equal(result.gravacaoAplicada, false);
  assert.equal(result.totais.bruto, 100);
});

test('zero explícito é calculável, ausência permanece pendente e custo desconhecido nunca vira zero', () => {
  const explicitZero = plan({
    idempotencyKey: 'fixture-zero',
    taxas: [{ meio: 'pix', percentual: 0, fixa: 0, fonte: 'fixture-zero' }],
    materiais: [{ servicoId: 'servico-fixture', produtoId: 'produto-fixture', quantidade: 1, unidade: 'g', custoUnitario: 0, fonte: 'fixture-zero' }],
    simulacoes: [{ servicoId: 'servico-fixture', bruto: 0, meio: 'pix', comissaoPercentual: 0 }],
  });
  assert.equal(explicitZero.linhas[0].taxa, 0);
  assert.equal(explicitZero.linhas[0].material, 0);
  assert.equal(explicitZero.linhas[0].liquido, 0);
  assert.equal(explicitZero.linhas[0].status, 'calculado');

  const absent = plan({
    idempotencyKey: 'fixture-absent',
    taxas: [],
    materiais: [{ servicoId: 'servico-fixture', quantidade: 1, unidade: 'ml' }],
  });
  assert.equal(absent.linhas[0].taxa, null);
  assert.equal(absent.linhas[0].material, null);
  assert.equal(absent.linhas[0].liquido, null);
  assert.equal(absent.linhas[0].status, 'pendente');
  assert.ok(absent.linhas[0].divergencias.some((item) => item.tipo === 'TAXA_NAO_CONFIGURADA'));
  assert.ok(absent.linhas[0].divergencias.some((item) => item.tipo === 'MATERIAL_CUSTO_DESCONHECIDO'));
});

test('valida percentual, parcelas, unidade e base sem aceitar limites silenciosamente', () => {
  assert.throws(() => plan({ idempotencyKey: 'fixture-percentual', taxas: [{ meio: 'pix', percentual: 100.01, fixa: 0 }] }), (error) => error instanceof PreviewValidationError && error.code === 'TAXA_PERCENTUAL_INVALIDO');
  assert.throws(() => plan({ idempotencyKey: 'fixture-parcelas', taxas: [{ meio: 'credito', percentual: 2, fixa: 0, parcelas: 25 }], simulacoes: [{ servicoId: 'servico-fixture', bruto: 10, meio: 'credito', parcelas: 25 }] }), (error) => error instanceof PreviewValidationError && error.code === 'TAXA_PARCELAS_INVALIDA');
  assert.throws(() => plan({ idempotencyKey: 'fixture-unidade', materiais: [{ servicoId: 'servico-fixture', unidade: 'ml', quantidade: 0 }] }), (error) => error instanceof PreviewValidationError && error.code === 'MATERIAL_QUANTIDADE_INVALIDA');
  assert.throws(() => plan({ idempotencyKey: 'fixture-unidade-un', materiais: [{ servicoId: 'servico-fixture', unidade: 'un', quantidade: 0.5 }] }), (error) => error instanceof PreviewValidationError && error.code === 'MATERIAL_QUANTIDADE_INVALIDA');
  assert.throws(() => plan({ idempotencyKey: 'fixture-base', taxas: [{ meio: 'pix', percentual: 2, fixa: 0, base: 'inventada' }] }), (error) => error instanceof PreviewValidationError && error.code === 'TAXA_BASE_INVALIDA');
});

test('idempotência usa escopo e hash: replay é seguro e payload divergente conflita', () => {
  const first = plan();
  const replay = plan();
  assert.equal(replay.idempotente, true);
  assert.equal(replay.planHash, first.planHash);
  assert.throws(() => plan({ simulacoes: [{ servicoId: 'servico-fixture', bruto: 101, meio: 'pix', comissaoPercentual: 50 }] }), (error) => error instanceof PreviewConflictError && error.code === 'PLAN_CONFLICT');
  assert.throws(() => plan({ idempotencyKey: 'fixture-other-scope', empresaId: 'outra-empresa' }), (error) => error instanceof PreviewConflictError && error.code === 'TENANT_SCOPE_MISMATCH');
  assert.throws(() => plan({ idempotencyKey: 'fixture-other-store', lojaId: 'outra-unidade' }), (error) => error instanceof PreviewConflictError && error.code === 'STORE_SCOPE_MISMATCH');
});

test('credenciais fiscais são somente sinalizadas e nunca retornadas', () => {
  const result = plan({ idempotencyKey: 'fixture-fiscal', credenciaisFiscais: { certificadoA1: 'fixture-secret', senha: 'fixture-password' } });
  assert.deepEqual(result.fiscal, { credenciaisRecebidas: true, credenciaisImportaveis: false });
  assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
  assert.equal(JSON.stringify(result).includes('fixture-password'), false);
  assert.ok(result.divergencias.some((item) => item.tipo === 'CREDENCIAL_FISCAL_IGNORADA'));
});

test('null, vazio e booleanos não se tornam taxa ou bruto zero', () => {
  for (const value of [null, '', '   ', undefined]) {
    assert.throws(() => plan({ taxas: [{ meio: 'pix', percentual: value }] }), /ausência não vira zero/);
    assert.throws(() => plan({ simulacoes: [{ servicoId: 'servico-fixture', bruto: value, meio: 'pix' }] }), PreviewValidationError);
  }
  for (const value of [false, true, {}, []]) assert.throws(() => plan({ taxas: [{ meio: 'pix', percentual: value }] }), PreviewValidationError);
});

test('consumo não inventa quantidade/unidade e custo subcentavo é multiplicado antes do arredondamento', () => {
  assert.throws(() => plan({ materiais: [{ servicoId: 'servico-fixture', custoUnitario: 1, unidade: 'ml' }] }), /quantidade/);
  assert.throws(() => plan({ materiais: [{ servicoId: 'servico-fixture', custoUnitario: 1, quantidade: 1 }] }), /unidade/);
  assert.equal(plan().linhas[0].material, 0.25);
});

test('converte kg/g e l/ml explicitamente e rejeita conversão de famílias diferentes', () => {
  const result = plan({ materiais: [{ servicoId: 'servico-fixture', quantidade: 125, unidade: 'ml', unidadeReferencia: 'l', custoUnitario: 8 }] });
  assert.equal(result.linhas[0].material, 1);
  assert.throws(() => plan({ idempotencyKey: 'incompatible', materiais: [{ servicoId: 'servico-fixture', quantidade: 2, unidade: 'g', unidadeReferencia: 'ml', custoUnitario: 1 }] }), error => error.code === 'MATERIAL_CONVERSAO_INVALIDA');
});

test('taxas percentuais mantêm precisão e base líquida resolve a equação declarada', () => {
  const result = plan({ taxas: [{ meio: 'pix', percentual: 2.123456, fixa: 0 }], simulacoes: [{ servicoId: 'servico-fixture', bruto: 1000, meio: 'pix' }] });
  assert.equal(result.linhas[0].regraTaxa.percentual, 2.123456);
  assert.equal(result.linhas[0].taxa, 21.23);
  const net = plan({ idempotencyKey: 'net-base', taxas: [{ meio: 'pix', percentual: 10, fixa: 1, base: 'liquido' }] });
  assert.equal(net.linhas[0].taxa, 10);
});

test('taxa maior que bruto é rejeitada, custo maior mantém perda explícita e comissão não fica negativa', () => {
  assert.throws(() => plan({ taxas: [{ meio: 'pix', fixa: 101 }] }), error => error.code === 'TAXA_EXCEDE_BRUTO');
  const result = plan({ materiais: [{ servicoId: 'servico-fixture', quantidade: 1, unidade: 'un', custoUnitario: 110 }] });
  assert.equal(result.linhas[0].liquido, -11.99);
  assert.equal(result.linhas[0].baseComissao, 0);
  assert.equal(result.linhas[0].comissaoIndicativa, 0);
});

test('não presume taxa zero para dinheiro ou conta', () => {
  for (const meio of ['dinheiro', 'conta']) {
    const result = plan({ idempotencyKey: meio, taxas: [], simulacoes: [{ servicoId: 'servico-fixture', bruto: 20, meio }] });
    assert.equal(result.linhas[0].taxa, null);
  }
});

test('duplicidade idêntica de material/taxa/linha não duplica o orçamento', () => {
  for (const overrides of [
    { materiais: [{ servicoId: 'servico-fixture', quantidade: 1, unidade: 'un', custoUnitario: 1 }, { servicoId: 'servico-fixture', quantidade: 1, unidade: 'un', custoUnitario: 1 }] },
    { taxas: [{ meio: 'pix', percentual: 1 }, { meio: 'pix', percentual: 1 }] },
    { simulacoes: [{ id: 'same', servicoId: 'servico-fixture', bruto: 20, meio: 'pix' }, { id: 'same', servicoId: 'servico-fixture', bruto: 20, meio: 'pix' }] },
  ]) assert.throws(() => plan(overrides), PreviewConflictError);
});

test('regras igualmente específicas são ambíguas, regra exata prevalece sobre geral', () => {
  const taxas = [{ meio: 'credito', bandeira: 'visa', percentual: 2 }, { meio: 'credito', parcelas: 2, percentual: 3 }];
  const simulacoes = [{ servicoId: 'servico-fixture', bruto: 100, meio: 'credito', bandeira: 'visa', parcelas: 2 }];
  assert.throws(() => plan({ taxas, simulacoes }), error => error.code === 'TAXA_AMBIGUA');
  const result = plan({ taxas: [...taxas, { meio: 'credito', bandeira: 'visa', parcelas: 2, percentual: 4 }], simulacoes });
  assert.equal(result.linhas[0].taxa, 4);
});

test('referências precisam existir na empresa e limite de lote é explícito', () => {
  assert.throws(() => plan({}, { validServiceIds: ['outro'] }), error => error.code === 'SERVICE_SCOPE_MISMATCH');
  assert.throws(() => plan({}, { validProductIds: [] }), error => error.code === 'PRODUCT_SCOPE_MISMATCH');
  assert.throws(() => plan({ taxas: Array.from({ length: 501 }, () => ({ meio: 'pix', percentual: 1 })) }), error => error.code === 'PREVIEW_SIZE_INVALID');
});

test('baseline alterado invalida chave e tentativa inválida não prende a chave', () => {
  plan();
  assert.throws(() => plan({}, { currentTaxas: { pix: { percentual: 2 } } }), error => error.code === 'PLAN_CONFLICT');
  clearPreviewRegistry();
  assert.throws(() => plan({ taxas: [{ meio: 'pix', fixa: 101 }] }), PreviewValidationError);
  assert.equal(plan().idempotente, false);
});

test('precisão muito pequena não vira zero e cálculo de material acima do limite é bloqueado', () => {
  assert.throws(() => plan({ taxas: [{ meio: 'pix', percentual: 0.000000001 }] }), error => error.code === 'PREVIEW_PRECISION_INVALID');
  assert.throws(() => plan({ materiais: [{ servicoId: 'servico-fixture', quantidade: 0.000000001, unidade: 'ml', custoUnitario: 1 }] }), error => error.code === 'MATERIAL_QUANTIDADE_INVALIDA');
  assert.throws(() => plan({ materiais: [{ servicoId: 'servico-fixture', quantidade: 1000000000, unidade: 'un', custoUnitario: 1000000000 }] }), error => error.code === 'PREVIEW_NUMBER_INVALID');
});

test('baseline preserva custo por litro e consumo ml sem gerar divergência falsa', () => {
  const currentMaterials = buildCurrentMaterials({ servicos: [{ id: 'servico-fixture', consumoInterno: [{ produtoId: 'produto-fixture', quantidade: 125, unidade: 'ml' }] }], produtos: [{ id: 'produto-fixture', unidade: 'l', custoUnitario: 8 }] });
  assert.equal(currentMaterials[0].unidadeReferencia, 'l');
  const result = plan({ materiais: [{ servicoId: 'servico-fixture', produtoId: 'produto-fixture', quantidade: 125, unidade: 'ml', unidadeReferencia: 'l', custoUnitario: 8 }] }, { currentMaterials });
  assert.equal(result.linhas[0].material, 1);
  assert.equal(result.comparativo.materiaisAtuais[0].fatorReferencia, 0.001);
  assert.equal(result.divergencias.some(item => item.tipo === 'MATERIAL_DIVERGENTE'), false);
});

test('custo material declarado, inclusive zero, precede consumo como no módulo existente', () => {
  const current = buildCurrentMaterials({ servicos: [{ id: 'servico-fixture', custoMaterial: 0, consumoInterno: [{ produtoId: 'produto-fixture', quantidade: 1 }] }], produtos: [{ id: 'produto-fixture', unidade: 'un', custoUnitario: 8 }] });
  assert.equal(current.length, 1);
  assert.equal(current[0].custoUnitario, 0);
});
