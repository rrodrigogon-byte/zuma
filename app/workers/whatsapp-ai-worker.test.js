import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../core/database.js';
import {
  acquireWhatsappAiWorkerLease,
  claimWhatsappAiTasks,
  cleanupWhatsappAiRetention,
  isTransientWhatsappTaskError,
} from './whatsapp-ai-worker.js';

test('cleanupWhatsappAiRetention aplica prazo mínimo a sessões regulares e handoffs antigos', async () => {
  const original = db.transaction;
  const captured = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      captured.push({ sql, params });
      return { rowCount: captured.length === 1 ? 4 : 2 };
    },
  });
  try {
    const removed = await cleanupWhatsappAiRetention(1, 10);
    assert.equal(removed, 6);
    assert.match(captured[0].sql, /status <> 'humano'/);
    assert.equal(captured[0].params[0], 7);
    assert.match(captured[1].sql, /status = 'humano'/);
    assert.equal(captured[1].params[0], 30);
  } finally { db.transaction = original; }
});

test('claimWhatsappAiTasks reivindica todas as classes, recupera órfãs e cria lease por tarefa', async () => {
  const original = db.transaction;
  let captured;
  db.transaction = async callback => callback({
    async query(sql, params) {
      captured = { sql, params };
      return { rows: [{ id: '11111111-1111-4111-8111-111111111111', tipo: 'processar_conversa', status: 'processando' }] };
    },
  });
  try {
    const rows = await claimWhatsappAiTasks(3);
    assert.equal(rows.length, 1);
    assert.match(captured.sql, /tipo = 'processar_conversa'/);
    assert.match(captured.sql, /enviar_campanha/);
    assert.match(captured.sql, /recuperar_carrinho/);
    assert.match(captured.sql, /notificar_agendamento/);
    assert.match(captured.sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(captured.sql, /tentativas = t\.tentativas \+ 1/);
    assert.match(captured.sql, /status = 'processando'/);
    assert.match(captured.sql, /lease_expira_em <= CURRENT_TIMESTAMP/);
    assert.match(captured.sql, /lease_token = uuid_generate_v4\(\)/);
    assert.match(captured.sql, /dead_letter_em = NULL/);
    assert.equal(captured.params[1], 3);
    assert.equal(typeof captured.params[2], 'boolean');
    assert.equal(typeof captured.params[3], 'boolean');
    assert.equal(typeof captured.params[4], 'number');
  } finally { db.transaction = original; }
});

test('acquireWhatsappAiWorkerLease usa exclusão por vencimento e preserva o mesmo titular', async () => {
  const original = db.query;
  let captured;
  db.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ nome: 'whatsapp-ai', titular: params[0], expira_em: new Date().toISOString() }] };
  };
  try {
    const lease = await acquireWhatsappAiWorkerLease({ holder: 'instance-a', seconds: 45 });
    assert.equal(lease.titular, 'instance-a');
    assert.match(captured.sql, /ON CONFLICT \(nome\) DO UPDATE/);
    assert.match(captured.sql, /expira_em <= CURRENT_TIMESTAMP/);
    assert.match(captured.sql, /titular = EXCLUDED\.titular/);
    assert.deepEqual(captured.params, ['instance-a', 45]);
  } finally { db.query = original; }
});

test('isTransientWhatsappTaskError diferencia falha temporária de resultado incerto', () => {
  assert.equal(isTransientWhatsappTaskError(Object.assign(new Error('limite'), { status: 429 })), true);
  assert.equal(isTransientWhatsappTaskError(Object.assign(new Error('timeout'), { code: 'GEMINI_NETWORK_ERROR', retryable: true })), true);
  assert.equal(isTransientWhatsappTaskError(Object.assign(new Error('incerto'), { code: 'WHATSAPP_DELIVERY_UNKNOWN', retryable: false })), false);
  assert.equal(isTransientWhatsappTaskError(Object.assign(new Error('inválido'), { code: 'INVALID_INPUT', retryable: false })), false);
});
