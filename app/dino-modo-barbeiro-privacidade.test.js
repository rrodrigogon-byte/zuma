import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import {
  mascararTelefone,
  painelBarbeiro,
  notificarClientePeloZapOficial,
} from './dino-modo-barbeiro.js';
import { provisionarEquipeDino } from './dino-equipe-seed.js';

test('Privacidade do Barbeiro: mascararTelefone', () => {
  assert.equal(mascararTelefone('65999172020'), '(65) 9****-**20');
  assert.equal(mascararTelefone('+55 65 99622-3344'), '(65) 9****-**44');
  assert.equal(mascararTelefone(''), '');
  assert.equal(mascararTelefone(null), '');
  assert.equal(mascararTelefone('123'), '');
});

test('Privacidade do Barbeiro: painelBarbeiro mascara contatos para o barbeiro e preserva para a gestão', () => {
  const empId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
  provisionarEquipeDino();

  const profs = barbeariaErpKytto.listarProfissionais(empId);
  const bruno = profs.find((p) => p.nome.toLowerCase().includes('bruno'));
  assert.ok(bruno, 'Bruno deve existir');

  const srv = barbeariaErpKytto.listarServicos(empId)[0] || barbeariaErpKytto.criarServico(empId, { nome: 'Corte Barba', preco: 60, duracaoMinutos: 30 });
  const dataRef = new Date();
  while (bruno.diasTrabalho && !bruno.diasTrabalho.includes(dataRef.getDay())) {
    dataRef.setDate(dataRef.getDate() + 1);
  }
  const hoje = dataRef.toISOString().slice(0, 10);

  // Cria um agendamento com telefone real
  const ag = barbeariaErpKytto.criarAgendamento(empId, {
    lojaId,
    profissionalId: bruno.id,
    servicoId: srv.id,
    servicoNome: srv.nome,
    clienteNome: 'Cliente Privado Teste',
    clienteTelefone: '65999172020',
    dataHora: `${hoje}T10:00:00-04:00`,
    status: 'agendado',
    origem: 'app',
  }, { permitirEncaixe: true });

  // 1. Acesso como profissional (Bruno) -> Telefones devem vir MASCARADOS
  const painelBruno = painelBarbeiro(barbeariaErpKytto, {
    empresaId: empId,
    lojaId,
    profissionalId: bruno.id,
    data: hoje,
    usuario: { id: 'usr-dino-bruno', email: 'bruno@barbeariadino.com.br', role: 'profissional' },
  });

  assert.equal(painelBruno.gestao, false);
  const agBruno = painelBruno.agendamentos.find((a) => a.id === ag.id);
  assert.ok(agBruno, 'Agendamento deve estar na agenda do Bruno');
  assert.equal(agBruno.clienteTelefone, '(65) 9****-**20', 'Telefone deve estar mascarado para o barbeiro');
  assert.equal(agBruno.telefoneProtegido, true);

  // 2. Acesso como gestão (Dino / Admin) -> Telefones reais disponíveis para administração
  const painelGestao = painelBarbeiro(barbeariaErpKytto, {
    empresaId: empId,
    lojaId,
    profissionalId: bruno.id,
    data: hoje,
    usuario: { id: 'usr-dino-oficial', email: 'dino@barbeariadino.com.br', role: 'admin' },
  });

  assert.equal(painelGestao.gestao, true);
  const agGestao = painelGestao.agendamentos.find((a) => a.id === ag.id);
  assert.ok(agGestao, 'Agendamento deve estar na visualização da gestão');
  assert.equal(agGestao.clienteTelefone, '65999172020', 'Telefone real deve ser preservado para a gestão');
  assert.equal(agGestao.telefoneProtegido, false);
});

test('Privacidade do Barbeiro: notificarClientePeloZapOficial dispara mensagem oficial sem expor telefone', async () => {
  let mensagemEnviada = null;
  let telefoneDestino = null;

  const mockEnviar = async (tel, texto) => {
    telefoneDestino = tel;
    mensagemEnviada = texto;
    return { ok: true };
  };

  const erpMock = {
    listarProfissionais: () => [
      { id: 'prof-bruno', nome: 'Bruno Barbeiro', email: 'bruno@barbeariadino.com.br', ativo: true },
    ],
    obterAgendamento: () => ({
      id: 'ag-99',
      clienteNome: 'Pedro Alcantara',
      clienteTelefone: '65998887766',
      horaLocal: '16:30',
      servicoNome: 'Corte + Barba',
    }),
  };

  const resultado = await notificarClientePeloZapOficial(erpMock, {
    empresaId: 'emp-dino',
    usuario: { email: 'bruno@barbeariadino.com.br', role: 'profissional' },
    agendamentoId: 'ag-99',
    tipo: 'horario_hoje',
    enviarMensagemFn: mockEnviar,
  });

  assert.equal(resultado.ok, true);
  assert.equal(telefoneDestino, '65998887766', 'O backend deve resolver o telefone real internamente');
  assert.match(mensagemEnviada, /Barbearia Dino/, 'Mensagem deve ser institucional da Barbearia Dino');
  assert.match(mensagemEnviada, /16:30/, 'Mensagem deve conter o horário');
  assert.match(mensagemEnviada, /Bruno/, 'Mensagem deve assinar o nome do barbeiro');
});

test('Privacidade do Barbeiro: mensagem personalizada editada pelo barbeiro tem precedência', async () => {
  let telefoneDestino = '';
  let mensagemEnviada = '';

  const mockEnviar = async (tel, texto) => {
    telefoneDestino = tel;
    mensagemEnviada = texto;
    return { ok: true };
  };

  const erpMock = {
    listarProfissionais: () => [
      { id: 'prof-bruno', nome: 'Bruno Mendes', email: 'bruno@barbeariadino.com.br', ativo: true },
    ],
    obterAgendamento: () => ({
      id: 'ag-100',
      clienteNome: 'Arthur Martins',
      clienteTelefone: '65999887766',
      horaLocal: '17:00',
      servicoNome: 'Corte Degrade',
    }),
  };

  const textoAmigo = 'Fala meu irmão Arthur! Aqui é o Bruno. Tô com um horário livre às 17h e lembrei de você. Bora dar aquele talento no visual? Cervejinha tá trincando!';

  const resultado = await notificarClientePeloZapOficial(erpMock, {
    empresaId: 'emp-dino',
    usuario: { email: 'bruno@barbeariadino.com.br', role: 'profissional' },
    agendamentoId: 'ag-100',
    tipo: 'retorno',
    mensagemPersonalizada: textoAmigo,
    enviarMensagemFn: mockEnviar,
  });

  assert.equal(resultado.ok, true);
  assert.equal(telefoneDestino, '65999887766');
  assert.equal(mensagemEnviada, textoAmigo, 'A mensagem despachada deve ser exatamente o texto personalizado pelo barbeiro');
});
