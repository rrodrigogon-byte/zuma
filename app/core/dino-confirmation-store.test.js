import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { reset } from '../db.js';
import {
  alterarStatusAgendamento, atualizarConfiguracao, criarAgendamento, criarProfissional, criarServico,
  inicializarConfirmacaoAutomatica, registrarConfirmacaoAutomaticaEnviada, cancelarPorFaltaConfirmacao,
  obterConfiguracao,
} from '../barbearia-erp-kytto.js';
import { criarCliente } from '../clientes-contas-kytto.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
beforeEach(() => reset());

function fixture() {
  const cliente = criarCliente(EMPRESA, { nome: 'Cliente teste', telefone: '65999990000' });
  const profissional = criarProfissional(EMPRESA, { nome: 'Profissional teste' });
  const servico = criarServico(EMPRESA, { nome: 'Corte teste', preco: 50, duracaoMinutos: 30, intervaloRecomendacaoDias: 14 });
  const agendamento = criarAgendamento(EMPRESA, {
    lojaId: LOJA, clienteId: cliente.id, clienteNome: cliente.nome, clienteTelefone: cliente.telefone,
    profissionalId: profissional.id, servicoId: servico.id,
    dataHora: '2030-06-10T14:00:00.000Z', dataAgenda: '2030-06-10', horaLocal: '10:00',
  });
  return { cliente, profissional, servico, agendamento };
}

test('automação é opt-in e novos agendamentos herdam uma cópia limpa do estado', () => {
  const before = fixture();
  assert.equal(obterConfiguracao(EMPRESA).confirmacaoAutomaticaAtiva, false);
  assert.equal(before.agendamento.confirmacaoAutomatica, undefined);

  reset();
  atualizarConfiguracao(EMPRESA, { confirmacaoAutomaticaAtiva: true });
  const after = fixture();
  assert.deepEqual(after.agendamento.confirmacaoAutomatica, {
    ativa: true, status: 'aguardando', primeiraEnviadaEm: null, segundaEnviadaEm: null, prazoRespostaAte: null, confirmadoEm: null,
  });
});

test('segunda etapa exige a primeira mensagem e cancelamento ocorre só depois do prazo, mantendo histórico', () => {
  atualizarConfiguracao(EMPRESA, { confirmacaoAutomaticaAtiva: true });
  const { agendamento } = fixture();
  assert.equal(registrarConfirmacaoAutomaticaEnviada(EMPRESA, agendamento.id, 'segunda', {
    lojaId: LOJA, enviadoEm: '2030-06-10T11:45:00.000Z',
  }), null, 'não agenda prazo de resposta sem primeira confirmação');
  const first = registrarConfirmacaoAutomaticaEnviada(EMPRESA, agendamento.id, 'primeira', {
    lojaId: LOJA, enviadoEm: '2030-06-09T14:00:00.000Z',
  });
  assert.equal(first.confirmacaoAutomatica.status, 'primeira_enviada');
  const second = registrarConfirmacaoAutomaticaEnviada(EMPRESA, agendamento.id, 'segunda', {
    lojaId: LOJA, enviadoEm: '2030-06-10T11:45:00.000Z',
  });
  assert.equal(second.confirmacaoAutomatica.status, 'segunda_enviada');
  assert.equal(second.confirmacaoAutomatica.prazoRespostaAte, '2030-06-10T12:45:00.000Z');
  assert.equal(cancelarPorFaltaConfirmacao(EMPRESA, agendamento.id, { lojaId: LOJA, agora: '2030-06-10T12:44:59.999Z' }), null);
  const canceled = cancelarPorFaltaConfirmacao(EMPRESA, agendamento.id, { lojaId: LOJA, agora: '2030-06-10T12:45:00.000Z' });
  assert.equal(canceled.status, 'cancelado');
  assert.equal(canceled.motivoCancelamento, 'falta_confirmacao');
  assert.equal(canceled.confirmacaoAutomatica.status, 'cancelado_falta_confirmacao');
  assert.equal(canceled.historicoStatus[0].motivo, 'falta_confirmacao');
  assert.equal(canceled.historicoStatus[0].origem, 'confirmacao_automatica');
  assert.equal(cancelarPorFaltaConfirmacao(EMPRESA, agendamento.id, { lojaId: LOJA, agora: '2030-06-10T12:46:00.000Z' }), null, 'replay não cria um segundo cancelamento');
});

test('cliente pode confirmar dentro do prazo e isso desativa a fila de cancelamento', () => {
  atualizarConfiguracao(EMPRESA, { confirmacaoAutomaticaAtiva: true });
  const { agendamento } = fixture();
  registrarConfirmacaoAutomaticaEnviada(EMPRESA, agendamento.id, 'primeira', { lojaId: LOJA, enviadoEm: '2030-06-09T14:00:00.000Z' });
  registrarConfirmacaoAutomaticaEnviada(EMPRESA, agendamento.id, 'segunda', { lojaId: LOJA, enviadoEm: '2030-06-10T11:45:00.000Z' });
  const confirmed = alterarStatusAgendamento(EMPRESA, agendamento.id, 'confirmado', { lojaId: LOJA });
  assert.equal(confirmed.status, 'confirmado');
  assert.equal(confirmed.confirmacaoAutomatica.status, 'confirmado');
  assert.ok(confirmed.confirmacaoAutomatica.confirmadoEm);
  assert.equal(cancelarPorFaltaConfirmacao(EMPRESA, agendamento.id, { lojaId: LOJA, agora: '2030-06-10T12:45:00.000Z' }), null);
});

test('unidade fora do escopo não inicializa nem cancela a confirmação', () => {
  atualizarConfiguracao(EMPRESA, { confirmacaoAutomaticaAtiva: true });
  const { agendamento } = fixture();
  assert.equal(inicializarConfirmacaoAutomatica(EMPRESA, agendamento.id, { lojaId: 'loja-errada' }), null);
  assert.equal(cancelarPorFaltaConfirmacao(EMPRESA, agendamento.id, { lojaId: 'loja-errada', agora: '2030-06-10T12:45:00.000Z' }), null);
});
