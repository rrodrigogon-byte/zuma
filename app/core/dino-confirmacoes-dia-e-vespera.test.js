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
  assert.match(msgVespera, /amanhã, às 9h, Corte e Barba com Dino/);
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
  assert.match(msgDia, /hoje: às 9h, Corte e Barba com Dino/);
  assert.match(msgDia, /Responda CONFIRMO, REMARCAR ou CANCELO/);
});

test('processarConfirmacoesDiarias enfileira confirmações de hoje e da véspera para agendamentos pendentes', async (t) => {
  reset();
  const mock = mockQueueDatabase();
  try {
    const clienteHoje = criarCliente(EMPRESA_DINO, { nome: 'Waltemir Teste', telefone: '65999990001' });
    const clienteAmanha = criarCliente(EMPRESA_DINO, { nome: 'Rodrigo Teste', telefone: '65999990002' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteHoje.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteAmanha.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });

    const prof = criarProfissional(EMPRESA_DINO, { nome: 'Dino' });
    const serv = criarServico(EMPRESA_DINO, { nome: 'Corte e barba com Dino', duracaoMinutos: 45, preco: 300 });

    const now = new Date('2026-11-11T12:00:00-04:00');
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-11T05:00:00-04:00') });
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

    t.mock.timers.setTime(now.valueOf());
    const total = await processarConfirmacoesDiarias({ forcar: true, agora: now, intervaloMs: 0 });
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

test('janela matinal das 07h00 as 09h00 envia confirmacao do dia, e vespera envia um dia antes', async (t) => {
  reset();
  const mock = mockQueueDatabase();
  try {
    const clienteHoje = criarCliente(EMPRESA_DINO, { nome: 'Marcos Manha', telefone: '65999990010' });
    const clienteAmanha = criarCliente(EMPRESA_DINO, { nome: 'Lucas Vespera', telefone: '65999990020' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteHoje.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
    atualizarConsentimentoCliente(EMPRESA_DINO, clienteAmanha.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });

    const prof = criarProfissional(EMPRESA_DINO, { nome: 'Dino' });
    const serv = criarServico(EMPRESA_DINO, { nome: 'Corte', duracaoMinutos: 30, preco: 100 });

    const now = new Date('2026-11-11T12:00:00-04:00');
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-11T05:00:00-04:00') });
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
    const hoje = formatter.format(now);
    const amanha = formatter.format(new Date(now.valueOf() + 24 * 60 * 60 * 1000));

    const agHoje = criarAgendamento(EMPRESA_DINO, {
      lojaId: LOJA,
      clienteId: clienteHoje.id,
      clienteNome: clienteHoje.nome,
      clienteTelefone: clienteHoje.telefone,
      profissionalId: prof.id,
      servicoId: serv.id,
      dataHora: `${hoje}T10:00:00-04:00`,
      dataAgenda: hoje,
      horaLocal: '10:00',
    });

    const agAmanha = criarAgendamento(EMPRESA_DINO, {
      lojaId: LOJA,
      clienteId: clienteAmanha.id,
      clienteNome: clienteAmanha.nome,
      clienteTelefone: clienteAmanha.telefone,
      profissionalId: prof.id,
      servicoId: serv.id,
      dataHora: `${amanha}T15:00:00-04:00`,
      dataAgenda: amanha,
      horaLocal: '15:00',
    });

    // 1. Às 08h00 (dentro da janela matinal 07h-09h): deve enviar confirmacao_dia para hoje
    mock.captured.length = 0;
    const enviadasManha = await processarConfirmacoesDiarias({ hora: 8 });
    assert.equal(enviadasManha, 1, 'Às 08h deve enviar apenas a confirmacao do dia');
    const insertsManha = mock.captured.filter((item) => /INSERT INTO tarefas_integracao_canais/.test(item.sql));
    assert.equal(insertsManha.length, 1);
    const payloadManha = JSON.parse(insertsManha[0].params[4]);
    assert.equal(payloadManha.eventType, 'confirmacao_dia');

    // Executar novamente às 08h15 não deve duplicar o envio
    mock.captured.length = 0;
    const enviadasRepetidas = await processarConfirmacoesDiarias({ hora: 8 });
    assert.equal(enviadasRepetidas, 0, 'Não deve reenviar na mesma janela matinal');

    // 2. Às 15h00 (tarde da véspera): deve enviar o lembrete de amanhã (1 dia antes)
    mock.captured.length = 0;
    const enviadasTarde = await processarConfirmacoesDiarias({ hora: 15 });
    assert.equal(enviadasTarde, 1, 'Às 15h deve enviar a confirmacao da vespera para amanha');
    const insertsTarde = mock.captured.filter((item) => /INSERT INTO tarefas_integracao_canais/.test(item.sql));
    assert.equal(insertsTarde.length, 1);
    const payloadTarde = JSON.parse(insertsTarde[0].params[4]);
    assert.equal(payloadTarde.eventType, 'lembrete');

    // Executar novamente às 15h30 não deve duplicar o envio da véspera
    mock.captured.length = 0;
    const enviadasVesperaRepetida = await processarConfirmacoesDiarias({ hora: 15 });
    assert.equal(enviadasVesperaRepetida, 0, 'Não deve reenviar na mesma vespera');

    // 3. Às 23h00 (fora de horário): não deve enviar nada
    mock.captured.length = 0;
    const enviadasNoite = await processarConfirmacoesDiarias({ hora: 23 });
    assert.equal(enviadasNoite, 0, 'Fora do horario comercial nao deve enviar nada');
  } finally {
    mock.restore();
  }
});

test('presenceConfirmIntent reconhece variações de confirmação do cliente', () => {
  for (const t of ['CONFIRMO', 'confirmo', 'confirmado', 'sim confirmo', 'confirmo presenca', 'vou sim', 'estarei ai', 'sim', 'ok', 'com certeza', 'pode confirmar']) {
    assert.equal(presenceConfirmIntent(t), true, `Deveria reconhecer "${t}" como confirmação de presença`);
  }
});

test('confirmAttendance confirma todos os agendamentos do cliente no mesmo dia (ex.: barba e corte sequenciais)', async (t) => {
  reset();
  const { confirmAttendance } = await import('./barbershop-agenda.js');
  const cliente = criarCliente(EMPRESA_DINO, { nome: 'Jeferson Zucchi ( Dino )', telefone: '65999887766' });
  const prof = criarProfissional(EMPRESA_DINO, { nome: 'Nati' });
  const serv1 = criarServico(EMPRESA_DINO, { nome: 'Barba Club', duracaoMinutos: 30, preco: 0.01 });
  const serv2 = criarServico(EMPRESA_DINO, { nome: 'Corte Club', duracaoMinutos: 30, preco: 0.01 });

  const now = new Date('2026-11-11T12:00:00-04:00');
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-11T05:00:00-04:00') });
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
  const hoje = formatter.format(now);

  const ag1 = criarAgendamento(EMPRESA_DINO, {
    lojaId: LOJA,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefone,
    profissionalId: prof.id,
    servicoId: serv1.id,
    dataHora: `${hoje}T11:00:00-04:00`,
    dataAgenda: hoje,
    horaLocal: '11:00',
  });

  const ag2 = criarAgendamento(EMPRESA_DINO, {
    lojaId: LOJA,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefone,
    profissionalId: prof.id,
    servicoId: serv2.id,
    dataHora: `${hoje}T11:30:00-04:00`,
    dataAgenda: hoje,
    horaLocal: '11:30',
  });

  assert.equal(ag1.status, 'agendado');
  assert.equal(ag2.status, 'agendado');

  // Cliente confirma o agendamento ag1 (ex.: respondendo CONFIRMO)
  const scope = { empresaId: EMPRESA_DINO, legacyEmpresaId: EMPRESA_DINO, lojaId: LOJA, phone: cliente.telefone };
  const res = await confirmAttendance(scope, ag1.id);
  assert.ok(res);

  // Verifica se AMBOS os agendamentos foram atualizados para 'confirmado'
  const { listarAgendamentos } = await import('../barbearia-erp-kytto.js');
  const agsAtualizados = listarAgendamentos(EMPRESA_DINO, { de: hoje, ate: hoje });
  const ag1Atualizado = agsAtualizados.find((a) => a.id === ag1.id);
  const ag2Atualizado = agsAtualizados.find((a) => a.id === ag2.id);

  assert.equal(ag1Atualizado.status, 'confirmado', 'Primeiro agendamento (Barba Club 11:00) deve estar confirmado');
  assert.equal(ag2Atualizado.status, 'confirmado', 'Segundo agendamento (Corte Club 11:30) deve estar confirmado também');
});
