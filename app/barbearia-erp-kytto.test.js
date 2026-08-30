import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from './db.js';
import { moduloDaRota, obterPerfil, temPermissao } from './perfis-usuarios-kytto.js';
import { listarLancamentos, registrarLancamento } from './financeiro-central-kytto.js';
import {
  atualizarConfiguracao,
  alterarStatusAgendamento,
  criarAgendamento,
  criarProfissional,
  criarServico,
  listarAgendamentos,
  listarProfissionais,
  listarServicos,
  obterConfiguracao,
  obterDashboard,
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
  const concluido = alterarStatusAgendamento(EMPRESA_A, agendamento.id, 'concluido', {
    meioPagamento: 'pix',
    valorRecebido: 50,
  });
  assert.equal(concluido.status, 'concluido');
  assert.equal(concluido.meioPagamento, 'pix');
  assert.equal(concluido.valorRecebido, 50);
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
