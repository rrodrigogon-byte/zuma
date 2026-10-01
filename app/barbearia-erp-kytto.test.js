import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from './db.js';
import { moduloDaRota, obterPerfil, temPermissao } from './perfis-usuarios-kytto.js';
import { listarLancamentos, registrarLancamento } from './financeiro-central-kytto.js';
import { obterFidelidade, cadastrarMembroFidelidade, creditarFidelidade } from './canais-fidelidade-kytto.js';
import { criarCliente, atualizarConsentimentoCliente, obterSituacaoCredito, listarContasReceber } from './clientes-contas-kytto.js';
import {
  atualizarConfiguracao,
  atualizarConfiguracaoLoja,
  obterConfiguracaoLoja,
  alterarStatusAgendamento,
  atualizarAgendamento,
  criarAgendamento,
  vincularLancamentoFinanceiro,
  recebimentoAgendamentoVerificado,
  criarProfissional,
  atualizarProfissional,
  excluirProfissional,
  criarServico,
  listarAgendamentos,
  listarProfissionais,
  listarServicos,
  obterConfiguracao,
  obterDashboard,
  criarBloqueio,
  listarBloqueios,
  criarFilaEspera,
  listarFilaEspera,
  alterarStatusFila,
  criarPlano,
  listarPlanos,
  criarAssinatura,
  alterarStatusAssinatura,
  listarAssinaturas,
  criarProdutoRevenda,
  atualizarProdutoRevenda,
  listarProdutosRevenda,
  ajustarEstoqueRevenda,
  listarMovimentosEstoque,
  criarVendaRevenda,
  finalizarVendaRevenda,
  listarVendasRevenda,
  obterComissoes,
  criarComandaBarbearia,
  obterComandaBarbearia,
  listarComandasBarbearia,
  adicionarItensComandaBarbearia,
  atualizarComandaBarbearia,
  alterarStatusComandaBarbearia,
  cancelarComandaBarbearia,
  registrarPagamentoComandaBarbearia,
  registrarConsumoInternoComandaBarbearia,
} from './barbearia-erp-kytto.js';

const EMPRESA_A = 'empresa-teste-a';
const EMPRESA_B = 'empresa-teste-b';

beforeEach(() => reset());
afterEach(() => reset());

function baseServico(empresaId = EMPRESA_A) {
  return criarServico(empresaId, {
    nome: empresaId === EMPRESA_A ? 'Corte clássico' : 'Barba premium',
    duracaoMinutos: 45,
    preco: 50,
  });
}

function baseProfissional(empresaId = EMPRESA_A) {
  return criarProfissional(empresaId, { nome: empresaId === EMPRESA_A ? 'Ana Barbeira' : 'Bruno Barbeiro' });
}

function receberAgenda(empresaId, agendamento, meio, valor) {
  const lancamento = registrarLancamento(empresaId, {
    tipo: 'receita', origem: 'barbearia_atendimento', status: 'pago',
    valor, meioPagamento: meio,
    chaveIdempotencia: `barbearia_atendimento:${empresaId}:${agendamento.id}`,
  });
  return vincularLancamentoFinanceiro(empresaId, agendamento.id, lancamento.id);
}

test('leituras de empresa sem dados não criam registros no store', () => {
  assert.equal(db().barbearias, undefined);
  assert.deepEqual(obterConfiguracao(EMPRESA_A).diasFuncionamento, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(listarProfissionais(EMPRESA_A), []);
  assert.deepEqual(listarServicos(EMPRESA_A), []);
  assert.deepEqual(listarAgendamentos(EMPRESA_A), []);
  assert.equal(obterDashboard(EMPRESA_A).indicadores.agendamentosHoje, 0);
  assert.equal(db().barbearias, undefined);
});

test('classifica as rotas como Barbearia e respeita perfis operacionais', () => {
  assert.equal(moduloDaRota('/api/admin/barbearia/dashboard'), 'barbearia');
  assert.equal(moduloDaRota('/api/admin/barbearia/agenda'), 'barbearia');
  assert.equal(temPermissao({ ativo: true, perfis: ['gerente_operacional'] }, 'barbearia', 'ler'), true);
  assert.equal(temPermissao({ ativo: true, perfis: ['gerente_operacional'] }, 'barbearia', 'criar'), true);
  assert.equal(temPermissao({ ativo: true, perfis: ['consultor'] }, 'barbearia', 'criar'), false);
  assert.ok(obterPerfil('administrador')?.permissoes?.barbearia?.includes('excluir'));
});

test('permite editar, arquivar e reativar profissionais sem cruzar empresas', () => {
  const profissional = criarProfissional(EMPRESA_A, { nome: 'Dino Inicial', tipo: 'funcionario', percentualComissao: 40 });
  const atualizado = atualizarProfissional(EMPRESA_A, profissional.id, { nome: 'Dino Atualizado', percentualComissao: 55, diasTrabalho: [1, 3, 5] });
  assert.equal(atualizado.nome, 'Dino Atualizado');
  assert.equal(atualizado.percentualComissao, 55);
  assert.deepEqual(atualizado.diasTrabalho, [1, 3, 5]);
  assert.equal(atualizarProfissional(EMPRESA_B, profissional.id, { nome: 'Não permitido' }), null);
  const excluido = excluirProfissional(EMPRESA_A, profissional.id);
  assert.equal(excluido.ativo, false);
  assert.equal(listarProfissionais(EMPRESA_A).length, 0);
  assert.equal(listarProfissionais(EMPRESA_A, { incluirInativos: true })[0].nome, 'Dino Atualizado');
  const reativado = atualizarProfissional(EMPRESA_A, profissional.id, { ativo: true });
  assert.equal(reativado.ativo, true);
  assert.equal(listarProfissionais(EMPRESA_A).length, 1);
});

test('mantém profissionais e serviços isolados por empresa', () => {
  const profissionalA = baseProfissional();
  const servicoA = baseServico();
  baseProfissional(EMPRESA_B);
  baseServico(EMPRESA_B);

  assert.equal(listarProfissionais(EMPRESA_A).length, 1);
  assert.equal(listarServicos(EMPRESA_A).length, 1);
  assert.equal(listarProfissionais(EMPRESA_B).length, 1);
  assert.equal(listarServicos(EMPRESA_B).length, 1);
  assert.equal(profissionalA.empresaId, EMPRESA_A);
  assert.equal(servicoA.empresaId, EMPRESA_A);
  assert.equal(db().barbearias[EMPRESA_A].profissionais[profissionalA.id].empresaId, EMPRESA_A);
});

test('cria agenda com preço e duração do serviço e bloqueia conflito do mesmo profissional', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const dados = {
    clienteNome: 'Cliente de teste',
    profissionalId: profissional.id,
    servicoId: servico.id,
    dataHora: '2030-01-15T10:00:00.000Z',
    dataAgenda: '2030-01-15',
  };
  const agendamento = criarAgendamento(EMPRESA_A, dados);

  assert.equal(agendamento.valor, 50);
  assert.equal(agendamento.duracaoMinutos, 45);
  assert.equal(agendamento.status, 'agendado');
  assert.equal(agendamento.dataAgenda, '2030-01-15');
  assert.throws(() => criarAgendamento(EMPRESA_A, { ...dados, clienteNome: 'Outro cliente' }), /Horário indisponível/);
  assert.equal(listarAgendamentos(EMPRESA_A, { data: '2030-01-15' }).length, 1);
});

test('remarca atendimento com histórico, preserva escopo e bloqueia conflito', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const agendamento = criarAgendamento(EMPRESA_A, { clienteNome: 'Cliente remarcação', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-15T10:00:00.000Z', dataAgenda: '2030-01-15' });
  criarAgendamento(EMPRESA_A, { clienteNome: 'Horário ocupado', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-15T11:00:00.000Z', dataAgenda: '2030-01-15' });

  const remarcado = atualizarAgendamento(EMPRESA_A, agendamento.id, { dataHora: '2030-01-15T12:00:00.000Z', dataAgenda: '2030-01-15', profissionalId: profissional.id, servicoId: servico.id, origem: 'admin', usuario: 'operador-teste' });
  assert.equal(remarcado.dataHora, '2030-01-15T12:00:00.000Z');
  assert.equal(remarcado.historicoRemarcacoes.length, 1);
  assert.equal(remarcado.historicoRemarcacoes[0].antes.dataHora, '2030-01-15T10:00:00.000Z');
  assert.equal(remarcado.historicoRemarcacoes[0].responsavel, 'operador-teste');
  assert.throws(() => atualizarAgendamento(EMPRESA_A, agendamento.id, { dataHora: '2030-01-15T11:00:00.000Z', dataAgenda: '2030-01-15', profissionalId: profissional.id, servicoId: servico.id }), /Horário indisponível/);
  assert.equal(atualizarAgendamento(EMPRESA_B, agendamento.id, { dataHora: '2030-01-15T13:00:00.000Z' }), null);
});

test('aplica calendário por unidade e não cruza conflito entre lojas diferentes', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const calendario = atualizarConfiguracaoLoja(EMPRESA_A, 'loja-a', { horarioAbertura: '09:00', horarioFechamento: '18:00', feriados: ['2030-01-20'] });
  assert.equal(calendario.lojaId, 'loja-a');
  assert.equal(obterConfiguracaoLoja(EMPRESA_A, 'loja-a').herdadaDaEmpresa, false);
  assert.throws(() => criarAgendamento(EMPRESA_A, { clienteNome: 'Antes da abertura', lojaId: 'loja-a', horaLocal: '08:30', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-15T08:30:00.000Z', dataAgenda: '2030-01-15' }), /fora do funcionamento/);
  assert.throws(() => criarAgendamento(EMPRESA_A, { clienteNome: 'Feriado', lojaId: 'loja-a', horaLocal: '10:00', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-20T10:00:00.000Z', dataAgenda: '2030-01-20' }), /feriado/);
  const lojaA = criarAgendamento(EMPRESA_A, { clienteNome: 'Loja A', lojaId: 'loja-a', horaLocal: '10:00', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-15T10:00:00.000Z', dataAgenda: '2030-01-15' });
  const lojaB = criarAgendamento(EMPRESA_A, { clienteNome: 'Loja B', lojaId: 'loja-b', horaLocal: '10:00', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-01-15T10:00:00.000Z', dataAgenda: '2030-01-15' });
  assert.equal(lojaA.lojaId, 'loja-a');
  assert.equal(lojaB.lojaId, 'loja-b');
  assert.equal(listarAgendamentos(EMPRESA_A, { lojaId: 'loja-a' }).length, 1);
  assert.equal(listarAgendamentos(EMPRESA_A, { lojaId: 'loja-b' }).length, 1);
});

test('torna o recebimento idempotente no financeiro central', () => {
  const primeiro = registrarLancamento(EMPRESA_A, {
    tipo: 'receita',
    categoria: 'Serviços',
    descricao: 'Atendimento de teste',
    valor: 50,
    origem: 'barbearia_atendimento',
    status: 'pago',
    meioPagamento: 'pix',
    chaveIdempotencia: `barbearia_atendimento:${EMPRESA_A}:age-teste`,
    referencia: { agendamentoId: 'age-teste' },
  });
  const repetido = registrarLancamento(EMPRESA_A, {
    tipo: 'receita',
    categoria: 'Serviços',
    descricao: 'Atendimento de teste repetido',
    valor: 50,
    origem: 'barbearia_atendimento',
    status: 'pago',
    meioPagamento: 'pix',
    chaveIdempotencia: `barbearia_atendimento:${EMPRESA_A}:age-teste`,
    referencia: { agendamentoId: 'age-teste' },
  });
  assert.equal(primeiro.id, repetido.id);
  assert.equal(listarLancamentos(EMPRESA_A).filter((item) => item.origem === 'barbearia_atendimento').length, 1);
});

test('permite o fluxo operacional de atendimento e rejeita salto de estado', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const agendamento = criarAgendamento(EMPRESA_A, {
    clienteNome: 'Cliente de fluxo',
    profissionalId: profissional.id,
    servicoId: servico.id,
    dataHora: '2030-02-20T13:00:00.000Z',
  });

  assert.throws(() => alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido'), /Transição/);
  assert.equal(alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'confirmado').status, 'confirmado');
  assert.equal(alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'em_atendimento').status, 'em_atendimento');
  assert.throws(() => alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido', { meioPagamento: 'pix', valorRecebido: 50 }), /fluxo de recebimento/);
  const concluido = alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido');
  assert.equal(concluido.status, 'concluido');
  assert.equal(concluido.valorRecebido, 0);
  assert.equal(recebimentoAgendamentoVerificado(EMPRESA_A, concluido), null);
  const pago = receberAgenda(EMPRESA_A, concluido, 'pix', 50);
  assert.equal(pago.meioPagamento, 'pix');
  assert.equal(pago.valorRecebido, 50);
  assert.equal(recebimentoAgendamentoVerificado(EMPRESA_A, pago)?.valor, 50);
});

test('agenda não aceita pagamento forjado em criação ou edição e não fatura atendimento sem ledger', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const dados = { clienteNome: 'Cliente sem cobrança', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-02-21T13:00:00.000Z', dataAgenda: '2030-02-21' };
  assert.throws(() => criarAgendamento(EMPRESA_A, { ...dados, status: 'concluido' }), /Status inicial/);
  assert.throws(() => criarAgendamento(EMPRESA_A, { ...dados, financeiroLancamentoId: 'fin-forjado' }), /fluxo de recebimento/);
  assert.throws(() => criarAgendamento(EMPRESA_A, { ...dados, valor: 1 }), /preço cadastrado/);
  const agenda = criarAgendamento(EMPRESA_A, dados);
  assert.equal(agenda.valor, servico.preco);
  assert.throws(() => atualizarAgendamento(EMPRESA_A, agenda.id, { valor: 1 }), /não pode ser alterado/);
  assert.equal(listarAgendamentos(EMPRESA_A)[0].valor, servico.preco, 'remarcação forjada não altera preço persistido');
  assert.throws(() => atualizarAgendamento(EMPRESA_A, agenda.id, { valorRecebido: 500 }), /fluxo de recebimento/);
  assert.equal(listarAgendamentos(EMPRESA_A)[0].valorRecebido, 0);
  alterarStatusAgendamento(EMPRESA_A, agenda.id, 'confirmado');
  alterarStatusAgendamento(EMPRESA_A, agenda.id, 'em_atendimento');
  const concluido = alterarStatusAgendamento(EMPRESA_A, agenda.id, 'concluido');
  assert.equal(obterDashboard(EMPRESA_A, { data: '2030-02-21' }).indicadores.faturamentoHoje, 0);
  assert.equal(obterComissoes(EMPRESA_A).porProfissional.find((item) => item.profissionalId === profissional.id).brutoServicos, 0);
  const deOutraEmpresa = registrarLancamento(EMPRESA_B, { tipo: 'receita', origem: 'barbearia_atendimento', status: 'pago', valor: 50, chaveIdempotencia: `barbearia_atendimento:${EMPRESA_A}:${agenda.id}` });
  assert.throws(() => vincularLancamentoFinanceiro(EMPRESA_A, agenda.id, deOutraEmpresa.id), /Lançamento de recebimento/);
  assert.equal(recebimentoAgendamentoVerificado(EMPRESA_A, concluido), null);
  receberAgenda(EMPRESA_A, concluido, 'pix', 50);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert.equal(obterDashboard(EMPRESA_A, { data: hoje }).indicadores.faturamentoHoje, 50, 'receita pertence ao dia do lançamento');
  assert.equal(obterDashboard(EMPRESA_A, { data: '2030-02-21' }).indicadores.faturamentoHoje, 0, 'não retroage à data futura do serviço');
});

test('bloqueia agenda em indisponibilidade global ou do profissional, sem vazar entre empresas', () => {
  const profissionalA = baseProfissional();
  const servicoA = baseServico();
  const bloqueio = criarBloqueio(EMPRESA_A, { titulo: 'Almoço', inicio: '2030-03-11T12:00:00.000Z', fim: '2030-03-11T13:00:00.000Z', profissionalId: profissionalA.id });
  assert.equal(listarBloqueios(EMPRESA_A, { data: '2030-03-11' }).length, 1);
  assert.throws(() => criarAgendamento(EMPRESA_A, { clienteNome: 'Bloqueado', profissionalId: profissionalA.id, servicoId: servicoA.id, dataHora: '2030-03-11T12:30:00.000Z' }), /Horário indisponível|não funciona neste dia/);
  assert.equal(listarBloqueios(EMPRESA_B, { data: '2030-03-11' }).length, 0);
  assert.equal(criarAgendamento(EMPRESA_B, { clienteNome: 'Livre', servicoId: baseServico(EMPRESA_B).id, dataHora: '2030-03-11T12:30:00.000Z' }).status, 'agendado');
  assert.equal(bloqueio.empresaId, EMPRESA_A);
});

test('mantém fila por empresa e aplica transições sem saltos', () => {
  const item = criarFilaEspera(EMPRESA_A, { clienteNome: 'Fila A', dataAgenda: '2030-03-11', previsaoMinutos: 25 });
  criarFilaEspera(EMPRESA_A, { clienteNome: 'Fila A2', dataAgenda: '2030-03-11' });
  criarFilaEspera(EMPRESA_B, { clienteNome: 'Fila B', dataAgenda: '2030-03-11' });
  assert.equal(listarFilaEspera(EMPRESA_A, { data: '2030-03-11' }).length, 2);
  assert.equal(listarFilaEspera(EMPRESA_B, { data: '2030-03-11' }).length, 1);
  assert.throws(() => alterarStatusFila(EMPRESA_A, item.id, 'atendido'), /Transição/);
  assert.equal(alterarStatusFila(EMPRESA_A, item.id, 'chamado', { mesaOuPosicao: 'Cadeira 2' }).status, 'chamado');
  assert.equal(alterarStatusFila(EMPRESA_A, item.id, 'atendido').status, 'atendido');
});

test('cria plano e assinatura pendente sem cobrança e exige confirmação para ativar', () => {
  const servico = baseServico();
  const plano = criarPlano(EMPRESA_A, { nome: 'Plano mensal', preco: 120, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [servico.id] });
  assert.equal(listarPlanos(EMPRESA_A).length, 1);
  const assinatura = criarAssinatura(EMPRESA_A, { clienteId: 'cliente-a', clienteNome: 'Cliente A', planoId: plano.id });
  assert.equal(assinatura.status, 'pendente_ativacao');
  assert.equal(assinatura.cobrancaAutomatica, false);
  assert.throws(() => alterarStatusAssinatura(EMPRESA_A, assinatura.id, 'ativa'), /confirmação explícita/);
  const ativa = alterarStatusAssinatura(EMPRESA_A, assinatura.id, 'ativa', { confirmadoSemCobranca: true });
  assert.equal(ativa.status, 'ativa');
  assert.equal(listarAssinaturas(EMPRESA_A, { status: 'ativa' }).length, 1);
});

test('mantém estoque de revenda separado por empresa e exige histórico para alterações', () => {
  const produto = criarProdutoRevenda(EMPRESA_A, { nome: 'Pomada teste', sku: 'P-001', precoVenda: 35, custoUnitario: 18, estoqueAtual: 2, estoqueMinimo: 1 });
  assert.equal(listarProdutosRevenda(EMPRESA_A)[0].statusEstoque, 'ok');
  assert.equal(listarProdutosRevenda(EMPRESA_B).length, 0);
  assert.throws(() => ajustarEstoqueRevenda(EMPRESA_A, produto.id, { tipo: 'saida_manual', quantidade: 3 }), /insuficiente/);
  const entrada = ajustarEstoqueRevenda(EMPRESA_A, produto.id, { tipo: 'entrada', quantidade: 3, observacao: 'Reposição teste' });
  assert.equal(entrada.produto.estoqueAtual, 5);
  const saida = ajustarEstoqueRevenda(EMPRESA_A, produto.id, { tipo: 'saida_manual', quantidade: 2, observacao: 'Uso interno teste' });
  assert.equal(saida.produto.estoqueAtual, 3);
  assert.equal(listarMovimentosEstoque(EMPRESA_A, { produtoId: produto.id }).length, 3);
  assert.throws(() => atualizarProdutoRevenda(EMPRESA_A, produto.id, { nome: 'Pomada teste', precoVenda: 35, estoqueAtual: 9 }), /endpoint de ajuste/);
});

test('separa pedido de revenda da confirmação e baixa estoque e financeiro uma única vez', () => {
  const produto = criarProdutoRevenda(EMPRESA_A, { nome: 'Pomada venda', precoVenda: 40, estoqueAtual: 3, estoqueMinimo: 1 });
  const venda = criarVendaRevenda(EMPRESA_A, { clienteNome: 'Cliente venda', itens: [{ produtoId: produto.id, quantidade: 2 }], chaveIdempotencia: 'pedido-venda-teste-1' });
  assert.equal(venda.status, 'aguardando_pagamento');
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_revenda' }).length, 0);
  assert.equal(listarMovimentosEstoque(EMPRESA_A, { produtoId: produto.id }).length, 1);
  assert.throws(() => finalizarVendaRevenda(EMPRESA_A, venda.id, { meioPagamento: 'pix' }), /confirmação explícita/);
  const paga = finalizarVendaRevenda(EMPRESA_A, venda.id, { confirmadoPagamento: true, meioPagamento: 'pix', valorRecebido: 80, usuario: 'teste' });
  assert.equal(paga.status, 'pago');
  assert.equal(paga.estoqueBaixado, true);
  assert.equal(listarProdutosRevenda(EMPRESA_A).find((item) => item.id === produto.id).estoqueAtual, 1);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_revenda', status: 'pago' }).length, 1);
  assert.equal(listarMovimentosEstoque(EMPRESA_A, { produtoId: produto.id }).length, 2);
  const repetida = finalizarVendaRevenda(EMPRESA_A, venda.id, { confirmadoPagamento: true, meioPagamento: 'pix', valorRecebido: 80 });
  assert.equal(repetida.financeiroLancamentoId, paga.financeiroLancamentoId);
  assert.equal(listarVendasRevenda(EMPRESA_A, { status: 'pago' }).length, 1);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_revenda' }).length, 1);
  assert.equal(listarMovimentosEstoque(EMPRESA_A, { produtoId: produto.id }).length, 2);
  assert.throws(() => criarVendaRevenda(EMPRESA_B, { itens: [{ produtoId: produto.id, quantidade: 1 }] }), /inválido/);
});

test('calcula repasse indicativo de serviços e produtos pagos sem lançar pagamento', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const agendamento = criarAgendamento(EMPRESA_A, { clienteNome: 'Cliente comissão', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-04-02T10:00:00.000Z', dataAgenda: '2030-04-02', horaLocal: '10:00' });
  alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'confirmado');
  alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'em_atendimento');
  receberAgenda(EMPRESA_A, alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido'), 'dinheiro', 50);
  const produto = criarProdutoRevenda(EMPRESA_A, { nome: 'Pomada comissão', precoVenda: 40, estoqueAtual: 1 });
  const venda = criarVendaRevenda(EMPRESA_A, { profissionalId: profissional.id, itens: [{ produtoId: produto.id, quantidade: 1 }] });
  finalizarVendaRevenda(EMPRESA_A, venda.id, { confirmadoPagamento: true, meioPagamento: 'dinheiro', valorRecebido: 40 });
  const semProfissional = criarVendaRevenda(EMPRESA_A, { itens: [{ produtoId: (criarProdutoRevenda(EMPRESA_A, { nome: 'Pente comissão', precoVenda: 10, estoqueAtual: 1 })).id, quantidade: 1 }] });
  const semProfissionalPaga = finalizarVendaRevenda(EMPRESA_A, semProfissional.id, { confirmadoPagamento: true, meioPagamento: 'dinheiro', valorRecebido: 10 });
  const resultado = obterComissoes(EMPRESA_A);
  const linha = resultado.porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(linha.brutoServicos, 50);
  assert.equal(linha.brutoProdutos, 40);
  assert.equal(linha.comissaoServicos, 25);
  assert.equal(linha.comissaoProdutos, 12);
  assert.equal(linha.repasse, 37);
  assert.equal(linha.taxas, 0);
  assert.equal(resultado.taxasConfiguradas, false);
  assert.equal(resultado.vendasSemProfissional, 1);
  assert.equal(semProfissionalPaga.financeiroLancamentoId !== null, true);
});

test('desconta taxa da comissão somente quando existe regra real com fonte cadastrada', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const agendamento = criarAgendamento(EMPRESA_A, { clienteNome: 'Cliente taxa real', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-04-03T10:00:00.000Z', dataAgenda: '2030-04-03', horaLocal: '10:00' });
  alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'confirmado');
  alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'em_atendimento');
  receberAgenda(EMPRESA_A, alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido'), 'pix', 50);
  const semTaxa = obterComissoes(EMPRESA_A);
  assert.equal(semTaxa.porProfissional.find((item) => item.profissionalId === profissional.id).taxas, 0);
  assert.deepEqual(semTaxa.meiosSemTaxaConfigurada, ['pix']);
  assert.throws(() => atualizarConfiguracao(EMPRESA_A, { taxasPagamento: { pix: { percentual: 2, fixa: 0.5 } } }), /fonte da taxa real/);
  atualizarConfiguracao(EMPRESA_A, { taxasPagamento: { pix: { percentual: 2, fixa: 0.5, fonte: 'Contrato adquirente teste' } } });
  const comTaxa = obterComissoes(EMPRESA_A);
  const linha = comTaxa.porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(comTaxa.taxasConfiguradas, true);
  assert.equal(linha.taxas, 1.5);
  assert.equal(linha.comissaoServicos, 24.25);
  assert.deepEqual(comTaxa.meiosSemTaxaConfigurada, []);
});

test('integra comanda de serviço e revenda com recebimento explícito e baixa idempotente', () => {
  const profissional = baseProfissional();
  const servico = baseServico();
  const produto = criarProdutoRevenda(EMPRESA_A, { nome: 'Pomada comanda', sku: 'POM-001', precoVenda: 35, estoqueAtual: 2, estoqueMinimo: 1 });
  const comanda = criarComandaBarbearia(EMPRESA_A, { lojaId: 'loja-a', clienteNome: 'Cliente comanda', profissionalId: profissional.id, itens: [{ tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id }] });
  assert.equal(comanda.status, 'aberta');
  assert.equal(comanda.total, 50);
  assert.equal(listarComandasBarbearia(EMPRESA_A, { lojaId: 'loja-a' }).length, 1);
  adicionarItensComandaBarbearia(EMPRESA_A, comanda.id, [{ tipo: 'produto', produtoId: produto.id, quantidade: 1 }]);
  const comandaComItens = atualizarComandaBarbearia(EMPRESA_A, comanda.id, { gorjeta: 10, observacoes: 'Atendimento presencial' });
  assert.equal(comandaComItens.total, 95);
  assert.throws(() => registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { meioPagamento: 'pix', valor: 95 }), /confirmação explícita/);
  const aguardando = alterarStatusComandaBarbearia(EMPRESA_A, comanda.id, 'aguardando_pagamento');
  assert.equal(aguardando.status, 'aguardando_pagamento');
  const paga = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 95, chaveIdempotencia: 'cmd-pag-1', usuario: 'teste' });
  assert.equal(paga.status, 'paga');
  assert.equal(paga.totalPago, 95);
  assert.equal(paga.financeiroLancamentoIds.length, 1);
  assert.equal(db().barbearias[EMPRESA_A].produtosRevenda[produto.id].estoqueAtual, 1);
  assert.equal(Object.values(db().barbearias[EMPRESA_A].movimentosEstoque).filter((item) => item.comandaId === comanda.id).length, 1);
  const repetida = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 95, chaveIdempotencia: 'cmd-pag-1', usuario: 'teste' });
  assert.equal(repetida.idempotente, true);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 1);
  assert.equal(obterComandaBarbearia(EMPRESA_A, comanda.id).status, 'paga');
  assert.equal(listarComandasBarbearia(EMPRESA_B).length, 0);
});

test('PATCH e status não aceitam ledger forjado nem confirmam pagamento sem o fluxo de recebimento', () => {
  const servico = baseServico();
  const comanda = criarComandaBarbearia(EMPRESA_A, { lojaId: 'loja-a', itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const antes = obterComandaBarbearia(EMPRESA_A, comanda.id);
  assert.throws(() => atualizarComandaBarbearia(EMPRESA_A, comanda.id, { desconto: 1, financeiroLancamentoIds: ['falso'] }), /Vínculos financeiros/);
  assert.throws(() => atualizarComandaBarbearia(EMPRESA_A, comanda.id, { contasReceberIds: [] }), /Vínculos financeiros/);
  for (const status of ['parcialmente_paga', 'em_conta', 'paga']) {
    assert.throws(() => alterarStatusComandaBarbearia(EMPRESA_A, comanda.id, status), /recebimento confirmado/);
  }
  assert.deepEqual(obterComandaBarbearia(EMPRESA_A, comanda.id), antes);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 0);
});

test('comanda parcialmente paga não pode ser cancelada por rotas genéricas', () => {
  const servico = baseServico();
  const comanda = criarComandaBarbearia(EMPRESA_A, { itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const parcial = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 20, chaveIdempotencia: 'parcial-1' });
  assert.equal(parcial.status, 'parcialmente_paga');
  assert.throws(() => cancelarComandaBarbearia(EMPRESA_A, comanda.id), /fluxo financeiro apropriado/);
  assert.throws(() => alterarStatusComandaBarbearia(EMPRESA_A, comanda.id, 'cancelada'), /fluxo financeiro apropriado/);
  assert.equal(obterComandaBarbearia(EMPRESA_A, comanda.id).status, 'parcialmente_paga');
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 1);
});

test('remarcação e alteração de status rejeitam loja divergente sem mutar agendamento', () => {
  const servico = baseServico();
  const agendamento = criarAgendamento(EMPRESA_A, { lojaId: 'loja-a', clienteNome: 'Cliente de teste', servicoId: servico.id, dataHora: '2030-01-15T10:00:00.000Z' });
  assert.equal(atualizarAgendamento(EMPRESA_A, agendamento.id, { lojaId: 'loja-b' }), null);
  assert.equal(alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido', { lojaId: 'loja-b' }), null);
  const depois = listarAgendamentos(EMPRESA_A, { lojaId: 'loja-a' }).find((item) => item.id === agendamento.id);
  assert.equal(depois.status, 'agendado');
  assert.equal(depois.lojaId, 'loja-a');
});

test('não baixa estoque nem lança financeiro quando pagamento fica pendente em conta', () => {
  const produto = criarProdutoRevenda(EMPRESA_A, { nome: 'Pomada conta', precoVenda: 30, estoqueAtual: 2 });
  const comanda = criarComandaBarbearia(EMPRESA_A, { clienteNome: 'Cliente conta', itens: [{ tipo: 'produto', produtoId: produto.id, quantidade: 1 }] });
  assert.throws(() => registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'conta', valor: 30 }), /cliente cadastrado/);
  assert.equal(db().barbearias[EMPRESA_A].produtosRevenda[produto.id].estoqueAtual, 2);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 0);
});

test('aplica limite, saldo e vencimento antes de lançar a comanda na conta do cliente', () => {
  const cliente = criarCliente(EMPRESA_A, { nome: 'Cliente crédito', limiteCreditoMensal: 100, diasVencimento: 15 });
  const servico = baseServico();
  const primeira = criarComandaBarbearia(EMPRESA_A, { clienteId: cliente.id, clienteNome: cliente.nome, itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const faturada = registrarPagamentoComandaBarbearia(EMPRESA_A, primeira.id, { confirmado: true, clienteId: cliente.id, meioPagamento: 'conta', valor: 50, chaveIdempotencia: 'conta-limite-1' });
  assert.equal(faturada.status, 'em_conta');
  assert.equal(obterSituacaoCredito(EMPRESA_A, cliente.id, 50).disponivel, 50);
  const contas = listarContasReceber(EMPRESA_A, { clienteId: cliente.id });
  assert.equal(contas.length, 1);
  const dias = Math.round((new Date(contas[0].dataVencimento).valueOf() - Date.now()) / 86400000);
  assert.ok(dias >= 14 && dias <= 15);

  const segunda = criarComandaBarbearia(EMPRESA_A, { clienteId: cliente.id, clienteNome: cliente.nome, itens: [{ tipo: 'servico', servicoId: servico.id, quantidade: 2 }] });
  assert.throws(() => registrarPagamentoComandaBarbearia(EMPRESA_A, segunda.id, { confirmado: true, clienteId: cliente.id, meioPagamento: 'conta', valor: 100, chaveIdempotencia: 'conta-limite-2' }), /Limite de crédito insuficiente/);
  assert.equal(listarContasReceber(EMPRESA_A, { clienteId: cliente.id }).length, 1);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 1);
  assert.equal(obterSituacaoCredito(EMPRESA_B, cliente.id, 10), null);
});

test('rejeita item de produto de outra empresa na comanda', () => {
  const produto = criarProdutoRevenda(EMPRESA_B, { nome: 'Produto isolado', precoVenda: 12, estoqueAtual: 1 });
  const comanda = criarComandaBarbearia(EMPRESA_A, { clienteNome: 'Cliente isolado' });
  assert.throws(() => adicionarItensComandaBarbearia(EMPRESA_A, comanda.id, [{ tipo: 'produto', produtoId: produto.id }]), /não encontrado/);
});

test('leitura de fidelidade sem dados não cria estrutura no store', () => {
  assert.equal(db().canaisKytto, undefined);
  assert.deepEqual(obterFidelidade(EMPRESA_A), { regra: { pontosPorReal: 1, valorPonto: 0.01, ativa: true }, membros: [], movimentos: [] });
  assert.equal(db().canaisKytto, undefined);
});

test('mantém consentimento de CRM isolado por empresa e registra alteração', () => {
  const clienteA = criarCliente(EMPRESA_A, { nome: 'Cliente consentimento', telefone: '65999999999' });
  const clienteB = criarCliente(EMPRESA_B, { nome: 'Cliente outra empresa', telefone: '65988888888' });
  const atualizado = atualizarConsentimentoCliente(EMPRESA_A, clienteA.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, responsavel: 'operador-teste' });
  assert.equal(atualizado.consentimentos.whatsapp.atendimento.concedido, true);
  assert.equal(atualizado.consentimentoHistorico.length, 1);
  assert.equal(atualizado.consentimentoHistorico[0].responsavel, 'operador-teste');
  assert.equal(atualizarConsentimentoCliente(EMPRESA_B, clienteA.id, { canal: 'whatsapp', finalidade: 'marketing', concedido: true }), null);
  assert.equal(clienteB.consentimentos.whatsapp.marketing.concedido, false);
  assert.throws(() => atualizarConsentimentoCliente(EMPRESA_A, clienteA.id, { canal: 'sms', finalidade: 'marketing', concedido: true }), /inválidos/);
});

test('pontua comanda paga uma única vez quando cliente aderiu à fidelidade', () => {
  const cliente = criarCliente(EMPRESA_A, { nome: 'Cliente fiel', telefone: '65977777777' });
  cadastrarMembroFidelidade(EMPRESA_A, { clienteId: cliente.id, nome: cliente.nome, telefone: cliente.telefone });
  const servico = baseServico();
  const comanda = criarComandaBarbearia(EMPRESA_A, { clienteId: cliente.id, clienteNome: cliente.nome, itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const primeira = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 50, clienteId: cliente.id, chaveIdempotencia: 'pagamento-fiel-1' });
  assert.equal(primeira.status, 'paga');
  assert.equal(primeira.fidelidadeValorPontuado, 50);
  assert.equal(obterFidelidade(EMPRESA_A).membros[0].pontos, 50);
  const repetida = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 50, clienteId: cliente.id, chaveIdempotencia: 'pagamento-fiel-1' });
  assert.equal(repetida.fidelidadeValorPontuado, 50);
  assert.equal(obterFidelidade(EMPRESA_A).movimentos.length, 1);
  const chaveCredito = obterFidelidade(EMPRESA_A).movimentos[0].chaveIdempotencia;
  assert.equal(creditarFidelidade(EMPRESA_A, cliente.id, 50, 'teste', { chaveIdempotencia: chaveCredito }).repetido, true);
});

test('impede ficha técnica de serviço com insumo de outra empresa', () => {
  const produtoB = criarProdutoRevenda(EMPRESA_B, { nome: 'Produto privado B', precoVenda: 12, estoqueAtual: 2 });
  assert.throws(() => criarServico(EMPRESA_A, { nome: 'Serviço inválido', preco: 30, consumoInterno: [{ produtoId: produtoB.id, quantidade: 1 }] }), /empresa ativa/);
});

test('baixa insumos da ficha técnica apenas após faturamento integral e de forma idempotente', () => {
  const insumo = criarProdutoRevenda(EMPRESA_A, { nome: 'Shampoo consumo', precoVenda: 20, estoqueAtual: 5 });
  const servico = criarServico(EMPRESA_A, { nome: 'Lavagem com insumo', preco: 45, consumoInterno: [{ produtoId: insumo.id, quantidade: 2 }] });
  const comanda = criarComandaBarbearia(EMPRESA_A, { lojaId: 'loja-a', clienteNome: 'Cliente consumo', itens: [{ tipo: 'servico', servicoId: servico.id, quantidade: 2 }] });
  assert.throws(() => registrarConsumoInternoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true }), /faturamento integral/);
  const paga = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, meioPagamento: 'pix', valor: 90 });
  assert.equal(paga.status, 'paga');
  assert.equal(listarProdutosRevenda(EMPRESA_A).find((item) => item.id === insumo.id).estoqueAtual, 1);
  assert.equal(listarMovimentosEstoque(EMPRESA_A, { produtoId: insumo.id }).filter((item) => item.tipo === 'consumo_servico').length, 1);
  const repetido = registrarConsumoInternoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true });
  assert.equal(repetido.movimentos.length, 0);
  assert.equal(listarProdutosRevenda(EMPRESA_A).find((item) => item.id === insumo.id).estoqueAtual, 1);
  assert.equal(registrarConsumoInternoComandaBarbearia(EMPRESA_B, comanda.id, { confirmado: true }), null);
});

test('valida e persiste configurações de funcionamento', () => {
  const inicial = obterConfiguracao(EMPRESA_A);
  assert.deepEqual(inicial.diasFuncionamento, [1, 2, 3, 4, 5, 6]);
  const atualizada = atualizarConfiguracao(EMPRESA_A, {
    horarioAbertura: '09:00',
    horarioFechamento: '19:00',
    intervaloMinutos: 20,
    diasFuncionamento: [1, 3, 3, 8, -1],
    politicaCancelamentoHoras: 12,
  });
  assert.equal(atualizada.horarioAbertura, '09:00');
  assert.equal(atualizada.horarioFechamento, '19:00');
  assert.equal(atualizada.intervaloMinutos, 20);
  assert.deepEqual(atualizada.diasFuncionamento, [1, 3]);
  assert.equal(obterConfiguracao(EMPRESA_A).politicaCancelamentoHoras, 12);
});
