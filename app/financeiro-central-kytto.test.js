import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'financeiro-central-')), 'db.json');

const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const { db, reset } = await import('./db.js');
const financeiro = await import('./financeiro-central-kytto.js');

const EMPRESA = 'empresa-ledger-a';
const OUTRA_EMPRESA = 'empresa-ledger-b';
const LOJA_A = 'loja-ledger-a';
const LOJA_B = 'loja-ledger-b';
const DATA = '2030-01-15T12:00:00.000Z';

const entrada = (overrides = {}) => ({
  empresaId: EMPRESA,
  lojaId: LOJA_A,
  tipo: 'receita',
  categoria: 'Serviços',
  descricao: 'Atendimento determinístico',
  valor: 100,
  origem: 'teste-ledger',
  origemId: 'origem-1',
  status: 'pago',
  dataOperacao: DATA,
  pagoEm: DATA,
  chaveIdempotencia: 'ledger:test:1',
  ...overrides,
});

test.beforeEach(() => reset());

test('lançamento operacional exige empresa e loja e falha sem mutação', () => {
  assert.throws(() => financeiro.registrarLancamento({ ...entrada(), lojaId: '' }), (erro) => erro.code === 'FINANCIAL_SCOPE_REQUIRED');
  assert.equal(db().financeiroKytto, undefined);
  assert.throws(() => financeiro.registrarLancamento({ ...entrada(), empresaId: '' }), (erro) => erro.code === 'FINANCIAL_SCOPE_REQUIRED');
  assert.equal(db().financeiroKytto, undefined);

  const legado = financeiro.registrarLancamento({ ...entrada(), lojaId: undefined, legacy: true, chaveIdempotencia: 'ledger:legacy:1' });
  assert.equal(legado.lojaId, '');
  assert.equal(legado.quarentena, true);
});

test('replay igual é estável e payload divergente devolve conflito 409', () => {
  const primeiro = financeiro.registrarLancamento(entrada({ metadata: { canal: 'teste', ordem: 1 } }));
  const replay = financeiro.registrarLancamento(entrada({ metadata: { ordem: 1, canal: 'teste' } }));
  assert.equal(replay.id, primeiro.id);
  assert.equal(replay.criadoEm, primeiro.criadoEm);
  assert.equal(financeiro.listarLancamentos(EMPRESA, { lojaId: LOJA_A }).length, 1);

  assert.throws(() => financeiro.registrarLancamento(entrada({ descricao: 'valor divergente' })), (erro) => {
    assert.equal(erro.code, 'FINANCIAL_IDEMPOTENCY_CONFLICT');
    assert.equal(erro.statusCode, 409);
    return true;
  });
});

test('idempotência e consultas isolam lojas e empresas, com quarentena contabilizada', () => {
  const lojaA = financeiro.registrarLancamento(entrada({ chaveIdempotencia: 'mesma-chave', lojaId: LOJA_A, valor: 10 }));
  const lojaB = financeiro.registrarLancamento(entrada({ chaveIdempotencia: 'mesma-chave', lojaId: LOJA_B, valor: 20 }));
  financeiro.registrarLancamento(entrada({ empresaId: EMPRESA, lojaId: undefined, legacy: true, origemId: 'origem-quarentena', chaveIdempotencia: 'sem-loja' }));
  financeiro.registrarLancamento(entrada({ empresaId: OUTRA_EMPRESA, lojaId: LOJA_A, origemId: 'origem-outra-empresa', chaveIdempotencia: 'outra-empresa' }));

  assert.equal(financeiro.buscarLancamentoPorChave(EMPRESA, LOJA_A, 'mesma-chave').id, lojaA.id);
  assert.equal(financeiro.buscarLancamentoPorChave(EMPRESA, LOJA_B, 'mesma-chave').id, lojaB.id);
  assert.equal(financeiro.buscarLancamentoPorChave(OUTRA_EMPRESA, LOJA_A, 'outra-empresa').empresaId, OUTRA_EMPRESA);
  assert.equal(financeiro.listarLancamentosPorOrigem(EMPRESA, { lojaId: LOJA_A, origemId: 'origem-1' }).length, 1);
  assert.equal(financeiro.listarLancamentosPorOrigem(EMPRESA, { lojaId: LOJA_B, origemId: 'origem-1' }).length, 1);

  const resumoA = financeiro.resumoFinanceiro(EMPRESA, { lojaId: LOJA_A, hoje: '2030-01-15' });
  const resumoB = financeiro.resumoFinanceiro(EMPRESA, { lojaId: LOJA_B, hoje: '2030-01-15' });
  assert.equal(resumoA.totalReceitas, 10);
  assert.equal(resumoB.totalReceitas, 20);
  assert.equal(resumoA.quarentenaCount, 1);
  assert.throws(() => financeiro.resumoFinanceiro(EMPRESA, { hoje: '2030-01-15' }), (erro) => erro.code === 'FINANCIAL_SCOPE_REQUIRED');

  const fechamentoA = financeiro.fecharDia(EMPRESA, '2030-01-15', 'operador', { lojaId: LOJA_A });
  const fechamentoB = financeiro.fecharDia({ empresaId: EMPRESA, lojaId: LOJA_B, data: '2030-01-15', usuario: 'operador' });
  assert.equal(fechamentoA.totalLancamentos, 1);
  assert.equal(fechamentoB.totalLancamentos, 1);
  assert.equal(fechamentoA.quarentenaCount, 1);
  assert.notEqual(fechamentoA.id, fechamentoB.id);
});

test('referências operacionais e metadata saneada são preservadas', () => {
  const lancamento = financeiro.registrarLancamento(entrada({
    cobrancaId: 'cob-1',
    agendamentoId: 'ag-1',
    valeId: 'vale-1',
    origemId: 'origem-2',
    actionId: 'action-1',
    correlationId: 'corr-1',
    fingerprint: 'fingerprint-fornecido',
    metadata: { comprovante: 'ok', senha: 'não persistir', nested: { authorization: 'não persistir', loja: 'a' } },
  }));
  assert.equal(lancamento.cobrancaId, 'cob-1');
  assert.equal(lancamento.agendamentoId, 'ag-1');
  assert.equal(lancamento.valeId, 'vale-1');
  assert.equal(lancamento.origemId, 'origem-2');
  assert.equal(lancamento.actionId, 'action-1');
  assert.equal(lancamento.correlationId, 'corr-1');
  assert.equal(lancamento.fingerprint, 'fingerprint-fornecido');
  assert.equal(lancamento.metadata.comprovante, 'ok');
  assert.equal('senha' in lancamento.metadata, false);
  assert.equal('authorization' in lancamento.metadata.nested, false);
  assert.equal(financeiro.buscarLancamentoPorChave({ empresaId: EMPRESA, lojaId: LOJA_A, idempotencyKey: 'ledger:test:1' }).id, lancamento.id);
});

test('reversão append-only mantém original intacto e é idempotente', () => {
  const original = financeiro.registrarLancamento(entrada({ cobrancaId: 'cob-2', agendamentoId: 'ag-2', valeId: 'vale-2', chaveIdempotencia: 'ledger:paid:1' }));
  const antes = structuredClone(original);
  const reversao = financeiro.reverterLancamento({
    empresaId: EMPRESA, lojaId: LOJA_A, lancamentoId: original.id, actionId: 'action-reversal-1', idempotencyKey: 'reverse:1', motivo: 'Pagamento devolvido', usuarioId: 'usuario-1', correlationId: 'corr-reversal-1', confirmado: true,
  });
  assert.equal(reversao.lancamentoOriginalId, original.id);
  assert.equal(reversao.reversalId, reversao.id);
  assert.equal(reversao.tipo, 'despesa');
  assert.equal(reversao.valor, original.valor);
  assert.equal(reversao.valorEfeito, -original.valor);
  assert.deepEqual(financeiro.obterLancamento(EMPRESA, original.id, { lojaId: LOJA_A }), antes);
  assert.equal(financeiro.resumoFinanceiro(EMPRESA, { lojaId: LOJA_A, hoje: '2030-01-15' }).saldo, 0);

  const replay = financeiro.reverterLancamento({
    empresaId: EMPRESA, lojaId: LOJA_A, lancamentoId: original.id, actionId: 'action-reversal-1', idempotencyKey: 'reverse:1', motivo: 'Pagamento devolvido', usuarioId: 'usuario-1', correlationId: 'corr-reversal-1', confirmado: true,
  });
  assert.equal(replay.id, reversao.id);
  assert.throws(() => financeiro.reverterLancamento({
    empresaId: EMPRESA, lojaId: LOJA_A, lancamentoId: original.id, actionId: 'action-reversal-1', idempotencyKey: 'reverse:1', motivo: 'Outro motivo', usuarioId: 'usuario-1', correlationId: 'corr-reversal-1', confirmado: true,
  }), (erro) => erro.code === 'FINANCIAL_IDEMPOTENCY_CONFLICT' && erro.statusCode === 409);
  assert.throws(() => financeiro.reverterLancamento({
    empresaId: EMPRESA, lojaId: LOJA_A, lancamentoId: original.id, actionId: 'action-reversal-2', idempotencyKey: 'reverse:2', motivo: 'Outra ação', usuarioId: 'usuario-1', confirmado: true,
  }), (erro) => erro.code === 'FINANCIAL_REVERSAL_ALREADY_EXISTS');
});

test('reversão e cancelamento não mutam em falha de validação', () => {
  const original = financeiro.registrarLancamento(entrada({ chaveIdempotencia: 'ledger:paid:2' }));
  const antes = structuredClone(db().financeiroKytto);
  assert.throws(() => financeiro.reverterLancamento({
    empresaId: EMPRESA, lojaId: LOJA_A, lancamentoId: original.id, actionId: 'action-invalid', idempotencyKey: 'reverse-invalid', motivo: 'sem confirmação', usuarioId: 'usuario-1', confirmado: false,
  }), (erro) => erro.code === 'FINANCIAL_REVERSAL_CONFIRMATION_REQUIRED');
  assert.deepEqual(db().financeiroKytto, antes);
  assert.throws(() => financeiro.cancelarLancamento(EMPRESA, original.id, 'operador'), (erro) => erro.code === 'FINANCIAL_REVERSAL_REQUIRED');
  assert.deepEqual(db().financeiroKytto, antes);
});
