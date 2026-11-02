import test from 'node:test';
import assert from 'node:assert/strict';
import { reset } from '../db.js';
import { criarCliente, atualizarConsentimentoCliente } from '../clientes-contas-kytto.js';
import { criarAgendamento, criarProfissional, criarServico, atualizarConfiguracao } from '../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from './barbershop-appointment-notifications.js';
import { processarConfirmacoesDiarias, obterEmpresasBarbearia } from './dino-confirmacao-diaria.js';
import { resolvePersona, personaAppointmentMessage } from './whatsapp-ai-persona.js';
import { presenceConfirmIntent } from './whatsapp-ai.js';
import { db } from './database.js';

const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const LOJA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
const CANAL = 'ae741d39-039c-4f4b-9183-9c5f639405a0';

function mockQueueDatabase() {
  const original = db.transaction;
  const captured = [];
  db.transaction = async (callback) => callback({
    async query(sql, params) {
      captured.push({ sql, params });
      if (/FROM canais_integracao/.test(sql)) return { rows: [{ id: CANAL, empresa_id: EMPRESA_DINO, loja_id: LOJA, status: 'ativo' }], rowCount: 1 };
      if (/INSERT INTO tarefas_integracao_canais/.test(sql)) return { rows: [{ id: crypto.randomUUID() }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  });
  return { captured, restore() { db.transaction = original; } };
}

test('obterEmpresasBarbearia inclui a empresa canônica da Barbearia Dino', () => {
  const empresas = obterEmpresasBarbearia();
  assert.ok(empresas.includes(EMPRESA_DINO));
});

test('persona T-Rex gera mensagem de confirmação da véspera e do dia no formato oficial Dino', () => {
  const persona = resolvePersona({ persona: { id: 'trex', ativo: true } }, {}, EMPRESA_DINO);

  const msgVespera = personaAppointmentMessage(persona, {
    evento: 'lembrete',
    nome: 'Waltemir',
    servico: 'Corte e Barba',
    profissional: 'Dino',
    quando: 'às 9h',
    quandoRelativo: 'amanhã',
    loja: 'Barbearia Dino',
  });
  assert.match(msgVespera, /^Opa, Waltemir!/);
  assert.match(msgVespera, /Passando pra confirmar seu horário de amanhã: às 9h, Corte e Barba com Dino/);
  assert.match(msgVespera, /Responda CONFIRMO, REMARCAR ou CANCELO/);

  const msgDia = personaAppointmentMessage(persona, {
    evento: 'confirmacao_dia',
    nome: 'Waltemir',
    servico: 'Corte e Barba',
    profissional: 'Dino',
    quando: 'às 9h',
    quandoRelativo: 'hoje',
    loja: 'Barbearia Dino',
  });
  assert.match(msgDia, /^Opa, Waltemir!/);
  assert.match(msgDia, /Passando pra confirmar seu horário de hoje: às 9h, Corte e Barba com Dino/);
  assert.match(msgDia, /Responda CONFIRMO, REMARCAR ou CANCELO/);
});

test('processarConfirmacoesDiarias enfileira confirmações de hoje e da véspera para agendamentos pendentes', async () => {
  reset();
  const mock = mockQueueDatabase();
  try {
    const clienteHoje = criarCliente(EMPRESA_DINO, { nome: 'Waltemir Teste', telefone: '65999990001' });
    const clienteAmanha = criarCliente(EMPRESA_DINO, { nome: 'Rodrigo Teste', telefone: '65999990002' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteHoje.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteAmanha.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });

    const prof = criarProfissional(EMPRESA_DINO, { nome: 'Dino' });
    const serv = criarServico(EMPRESA_DINO, { nome: 'Corte e barba com Dino', duracaoMinutos: 45, preco: 300 });

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
    const hoje = formatter.format(now);
    const amanha = formatter.format(new Date(now.valueOf() + 24 * 60 * 60 * 1000));

    criarAgendamento(EMPRESA_DINO, {
      lojaId: LOJA,
      clienteId: clienteHoje.id,
      clienteNome: clienteHoje.nome,
      clienteTelefone: clienteHoje.telefone,
      profissionalId: prof.id,
      servicoId: serv.id,
      dataHora: `${hoje}T15:00:00-04:00`,
      dataAgenda: hoje,
      horaLocal: '15:00',
    });

    criarAgendamento(EMPRESA_DINO, {
      lojaId: LOJA,
      clienteId: clienteAmanha.id,
      clienteNome: clienteAmanha.nome,
      clienteTelefone: clienteAmanha.telefone,
      profissionalId: prof.id,
      servicoId: serv.id,
      dataHora: `${amanha}T10:00:00-04:00`,
      dataAgenda: amanha,
      horaLocal: '10:00',
    });

    const total = await processarConfirmacoesDiarias();
    assert.equal(total, 2);

    const inserts = mock.captured.filter((item) => /INSERT INTO tarefas_integracao_canais/.test(item.sql));
    assert.equal(inserts.length, 2);

    const payloads = inserts.map((item) => JSON.parse(item.params[4]));
    const eventTypes = payloads.map((p) => p.eventType);
    assert.ok(eventTypes.includes('confirmacao_dia'), 'enfileirou confirmacao_dia para o agendamento de hoje');
    assert.ok(eventTypes.includes('lembrete'), 'enfileirou lembrete para o agendamento de amanha');
  } finally {
    mock.restore();
  }
});

test('presenceConfirmIntent reconhece variações de confirmação do cliente', () => {
  for (const t of ['CONFIRMO', 'confirmo', 'confirmado', 'sim confirmo', 'confirmo presenca', 'vou sim', 'estarei ai']) {
    assert.equal(presenceConfirmIntent(t), true, `Deveria reconhecer "${t}" como confirmação de presença`);
  }
});
