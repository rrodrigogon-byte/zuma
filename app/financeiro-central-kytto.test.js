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

test('financeiro da Dino inclui o extrato legado somente leitura, sem duplicar o que já existe no cadastro canônico', async () => {
  const { db } = await import('./db.js');
  const fin = await import('./financeiro-central-kytto.js');
  const estado = db();
  estado.financeiroKytto ||= { empresas: {} };
  estado.financeiroKytto.empresas ||= {};
  const UUID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const LOJA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
  estado.financeiroKytto.empresas[UUID] = { sequencia: 0, fechamentos: {}, lancamentos: {
    'novo-1': { id: 'novo-1', empresaId: UUID, lojaId: LOJA, tipo: 'receita', status: 'pago', valor: 100, vencimento: '2026-10-24', dataOperacao: '2026-10-24', pagoEm: '2026-10-24', origem: 'comanda', chaveIdempotencia: 'k-novo' },
  } };
  estado.financeiroKytto.empresas['emp-kytto-001'] = { sequencia: 0, fechamentos: {}, lancamentos: {
    'avec-1': { id: 'avec-1', empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque', tipo: 'receita', status: 'pago', valor: 50, vencimento: '2026-10-20', dataOperacao: '2026-10-20', pagoEm: '2026-10-20', origem: 'avec-import-financeiro-20261022', chaveIdempotencia: 'k-avec' },
    'dup-1': { id: 'dup-1', empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque', tipo: 'receita', status: 'pago', valor: 100, vencimento: '2026-10-24', dataOperacao: '2026-10-24', pagoEm: '2026-10-24', origem: 'comanda', chaveIdempotencia: 'k-novo' },
  } };
  const itens = fin.listarLancamentos(UUID, { lojaId: LOJA });
  assert.deepEqual(itens.map((item) => item.id).sort(), ['avec-1', 'novo-1']);
  const avec = itens.find((item) => item.id === 'avec-1');
  assert.equal(avec.empresaId, UUID);
  assert.equal(avec.lojaId, LOJA);
  assert.equal(avec.somenteLeitura, true);
  assert.deepEqual(fin.listarLancamentos(UUID, { lojaId: LOJA, semCadastroLegado: true }).map((item) => item.id), ['novo-1']);
  assert.deepEqual(fin.listarLancamentos('outra-empresa', {}), [], 'outras empresas não recebem o extrato da Dino');
  delete estado.financeiroKytto.empresas[UUID];
  delete estado.financeiroKytto.empresas['emp-kytto-001'];
});

test('permite baixar contas legadas Avec e contas gerais sem unidade, liquidando como pago sob a empresa canônica', async () => {
  const { db } = await import('./db.js');
  const fin = await import('./financeiro-central-kytto.js');
  const estado = db();
  estado.financeiroKytto ||= { empresas: {} };
  estado.financeiroKytto.empresas ||= {};
  const UUID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const LOJA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

  estado.financeiroKytto.empresas[UUID] = { sequencia: 0, fechamentos: {}, lancamentos: {
    'despesa-geral': { id: 'despesa-geral', empresaId: UUID, lojaId: null, tipo: 'despesa', status: 'pendente', valor: 250, vencimento: '2026-10-25', dataOperacao: '2026-10-25', descricao: 'Aluguel Matriz' }
  } };
  estado.financeiroKytto.empresas['emp-kytto-001'] = { sequencia: 0, fechamentos: {}, lancamentos: {
    'avec-mentoria': { id: 'avec-mentoria', empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque', tipo: 'despesa', status: 'pendente', valor: 300, vencimento: '2026-10-21', dataOperacao: '2026-10-21', descricao: '32/50 - MENTORIA BOOK', origem: 'avec-import-financeiro-20261022', automatico: true },
    'avec-lavada': { id: 'avec-lavada', empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque', tipo: 'despesa', status: 'pendente', valor: 155, vencimento: '2026-10-20', dataOperacao: '2026-10-20', descricao: '15/20 - LAVADA DE TOALHAS SEMANAL', origem: 'avec-import-financeiro-20261022', automatico: true }
  } };

  // 1. Obter lançamento legado pelo id e unidade canônica
  const obtido = fin.obterLancamento(UUID, 'avec-mentoria', { lojaId: LOJA });
  assert.ok(obtido, 'obterLancamento deve encontrar a conta legada');
  assert.equal(obtido.descricao, '32/50 - MENTORIA BOOK');

  // 2. Baixar a conta legada marcando como pago
  const pagoMentoria = fin.atualizarLancamento(UUID, 'avec-mentoria', { status: 'pago', pagoEm: '2026-10-25T12:00:00.000Z' }, { lojaId: LOJA, permitirAutomatico: true });
  assert.ok(pagoMentoria, 'atualizarLancamento deve permitir marcar como pago');
  assert.equal(pagoMentoria.status, 'pago');
  assert.equal(pagoMentoria.empresaId, UUID);
  assert.equal(pagoMentoria.lojaId, LOJA);

  // 3. Baixar despesa geral sem loja através da unidade ativa
  const pagoGeral = fin.atualizarLancamento(UUID, 'despesa-geral', { status: 'pago' }, { lojaId: LOJA });
  assert.ok(pagoGeral, 'atualizarLancamento deve permitir pagar despesa sem loja');
  assert.equal(pagoGeral.status, 'pago');

  // 4. Cancelamento de conta legada pendente
  const cancelado = fin.cancelarLancamento(UUID, 'avec-lavada', { usuario: 'gestor@kytto.com.br', lojaId: LOJA, permitirAutomatico: true });
  assert.ok(cancelado, 'cancelarLancamento deve cancelar conta legada pendente');
  assert.equal(cancelado.status, 'cancelado');

  delete estado.financeiroKytto.empresas[UUID];
  delete estado.financeiroKytto.empresas['emp-kytto-001'];
});

test('resumoFinanceiro e dreGerencial suportam filtro por intervalo de datas e cache em memória', () => {
  const { registrarLancamento, resumoFinanceiro, dreGerencial } = financeiro;
  const empresaId = 'emp-filtro-datas-teste';
  const lojaId = 'loja-filtro-datas-teste';

  // Lança receita no dia 2026-10-05 e despesa no dia 2026-10-20
  registrarLancamento(empresaId, {
    lojaId,
    tipo: 'receita',
    descricao: 'Corte e barba VIP',
    categoria: 'Serviços',
    valor: 200,
    vencimento: '2026-10-05',
    status: 'pago',
    pagoEm: '2026-10-05T10:00:00Z',
  });

  registrarLancamento(empresaId, {
    lojaId,
    tipo: 'despesa',
    descricao: 'Insumos de barbearia',
    categoria: 'Insumos',
    valor: 50,
    vencimento: '2026-10-20',
    status: 'pago',
    pagoEm: '2026-10-20T14:00:00Z',
  });

  // Filtra apenas o intervalo 01 a 10 de outubro (só a receita deve entrar no recPeriodo)
  const resumo1 = resumoFinanceiro(empresaId, {
    lojaId,
    dataInicio: '2026-10-01',
    dataFim: '2026-10-10',
  });

  assert.equal(resumo1.recPeriodo, 200);
  assert.equal(resumo1.despPeriodo, 0);
  assert.equal(resumo1.resultadoPeriodo, 200);
  assert.equal(resumo1.margemPeriodo, 100);

  // Filtra apenas o intervalo 15 a 25 de outubro (só a despesa deve entrar no despPeriodo)
  const resumo2 = resumoFinanceiro(empresaId, {
    lojaId,
    dataInicio: '2026-10-15',
    dataFim: '2026-10-25',
  });

  assert.equal(resumo2.recPeriodo, 0);
  assert.equal(resumo2.despPeriodo, 50);
  assert.equal(resumo2.resultadoPeriodo, -50);

  // DRE Gerencial no intervalo customizado
  const dre = dreGerencial(empresaId, {
    lojaId,
    dataInicio: '2026-10-01',
    dataFim: '2026-10-10',
  });

  assert.equal(dre.receitaBruta, 200);
  assert.equal(dre.customizado, true);
  assert.equal(dre.dataInicio, '2026-10-01');
  assert.equal(dre.dataFim, '2026-10-10');
});
