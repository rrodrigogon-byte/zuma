import http from 'node:http';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from '../db.js';
import { criarAgendamento, criarProfissional, criarServico } from '../barbearia-erp-kytto.js';
import { atualizarConsentimentoCliente, criarCliente, obterCliente } from '../clientes-contas-kytto.js';
import { db } from './database.js';
import {
  processAppointmentNotificationTask,
  queueAppointmentNotifications,
  recordAppointmentNotificationOptOut,
} from './barbershop-appointment-notifications.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const CANAL = '33333333-3333-4333-8333-333333333333';

beforeEach(() => reset());

function fixture() {
  const cliente = criarCliente(EMPRESA, { nome: 'Cliente avisos', telefone: '65999990000' });
  const profissional = criarProfissional(EMPRESA, { nome: 'Profissional teste', percentualComissao: 50 });
  const servico = criarServico(EMPRESA, { nome: 'Corte teste', duracaoMinutos: 30, preco: 50 });
  const agendamento = criarAgendamento(EMPRESA, {
    lojaId: LOJA,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefone,
    profissionalId: profissional.id,
    servicoId: servico.id,
    dataHora: '2030-06-10T14:00:00.000Z',
    dataAgenda: '2030-06-10',
    horaLocal: '10:00',
  });
  return { cliente, profissional, servico, agendamento };
}

function mockQueueDatabase({ insertRowCount = 1 } = {}) {
  const original = db.transaction;
  const captured = [];
  db.transaction = async (callback) => callback({
    async query(sql, params) {
      captured.push({ sql, params });
      if (/FROM canais_integracao/.test(sql)) return { rows: [{ id: CANAL, empresa_id: EMPRESA, loja_id: LOJA, status: 'ativo' }], rowCount: 1 };
      if (/INSERT INTO tarefas_integracao_canais/.test(sql)) return { rows: insertRowCount ? [{ id: crypto.randomUUID() }] : [], rowCount: insertRowCount };
      return { rows: [], rowCount: 0 };
    },
  });
  return { captured, restore() { db.transaction = original; } };
}

test('não enfileira aviso sem consentimento explícito de atendimento', async () => {
  const { agendamento } = fixture();
  const original = db.transaction;
  db.transaction = async () => { throw new Error('banco não deveria ser acessado'); };
  try {
    const resultado = await queueAppointmentNotifications({ empresaId: EMPRESA, lojaId: LOJA }, agendamento, 'criado');
    assert.deepEqual(resultado, { queued: 0, skipped: true, reason: 'service_consent_required' });
  } finally { db.transaction = original; }
});

test('enfileira evento e lembrete D−1 com fingerprint e conflito tenant-scoped', async () => {
  const { cliente, agendamento } = fixture();
  atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
  const mock = mockQueueDatabase();
  try {
    const resultado = await queueAppointmentNotifications({ empresaId: EMPRESA, lojaId: LOJA }, agendamento, 'criado');
    assert.equal(resultado.queued, 2);
    const inserts = mock.captured.filter((item) => /INSERT INTO tarefas_integracao_canais/.test(item.sql));
    assert.equal(inserts.length, 2);
    assert.match(inserts[0].sql, /ON CONFLICT \(empresa_id,tipo,referencia_externa\)/);
    assert.match(inserts[0].sql, /notificar_agendamento/);
    const payloads = inserts.map((item) => JSON.parse(item.params[4]));
    assert.deepEqual(new Set(payloads.map((item) => item.eventType)), new Set(['criado', 'lembrete']));
    assert.ok(payloads.every((item) => item.scheduleFingerprint && !('phone' in item)));
  } finally { mock.restore(); }
});

test('remarcação cancela lembrete pendente anterior antes de criar nova tarefa', async () => {
  const { cliente, agendamento } = fixture();
  atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
  const mock = mockQueueDatabase();
  try {
    const resultado = await queueAppointmentNotifications({ empresaId: EMPRESA, lojaId: LOJA }, { ...agendamento, dataHora: '2030-06-11T14:00:00.000Z' }, 'remarcado');
    assert.equal(resultado.queued, 2);
    const cancelamento = mock.captured.find((item) => /UPDATE tarefas_integracao_canais/.test(item.sql));
    assert.ok(cancelamento);
    assert.match(cancelamento.sql, /payload->>'eventType' IN \('criado','remarcado','lembrete'\)/);
    assert.deepEqual(cancelamento.params.slice(0, 2), [EMPRESA, LOJA]);
  } finally { mock.restore(); }
});

test('processa aviso com revalidação de consentimento e canal e não expõe telefone na resposta', async () => {
  const { cliente, agendamento } = fixture();
  atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
  const mock = mockQueueDatabase();
  let taskPayload;
  try {
    await queueAppointmentNotifications({ empresaId: EMPRESA, lojaId: LOJA }, agendamento, 'criado');
    const insert = mock.captured.find((item) => /INSERT INTO tarefas_integracao_canais/.test(item.sql) && JSON.parse(item.params[4]).eventType === 'criado');
    taskPayload = JSON.parse(insert.params[4]);
  } finally { mock.restore(); }

  let body;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      body = JSON.parse(raw);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ key: { id: 'provider-test-1' } }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const originalQuery = db.query;
  db.query = async (sql) => /FROM canais_integracao/.test(sql)
    ? { rows: [{ id: CANAL, empresa_id: EMPRESA, loja_id: LOJA, api_base_url: `http://127.0.0.1:${server.address().port}`, configuracao: { instance: 'teste' } }], rowCount: 1 }
    : { rows: [], rowCount: 0 };
  try {
    const resultado = await processAppointmentNotificationTask({ id: crypto.randomUUID(), empresa_id: EMPRESA, loja_id: LOJA, canal_id: CANAL, payload: taskPayload });
    assert.equal(resultado.sent, true);
    assert.equal(resultado.providerMessageId, 'provider-test-1');
    assert.equal('phone' in resultado, false);
    assert.match(body.text, /mensagem de atendimento/);
    assert.match(body.text, /responda SAIR/);
    assert.equal(body.number, '5565999990000');
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('opt-out revoga somente consentimento de atendimento no tenant e cancela tarefas pendentes', async () => {
  const { cliente } = fixture();
  atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: true, origem: 'teste' });
  atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'marketing', concedido: true, origem: 'teste' });
  const originalQuery = db.query;
  let captured;
  db.query = async (sql, params) => { captured = { sql, params }; return { rows: [], rowCount: 1 }; };
  try {
    const resultado = await recordAppointmentNotificationOptOut({ empresa_id: EMPRESA, loja_id: LOJA }, { text: 'SAIR', phone: '5565999990000' });
    assert.equal(resultado.optedOut, true);
    const atualizado = obterCliente(EMPRESA, cliente.id);
    assert.equal(atualizado.consentimentos.whatsapp.atendimento.concedido, false);
    assert.equal(atualizado.consentimentos.whatsapp.marketing.concedido, true);
    assert.match(captured.sql, /tipo='notificar_agendamento'/);
    assert.deepEqual(captured.params.slice(0, 2), [EMPRESA, LOJA]);
  } finally { db.query = originalQuery; }
});
