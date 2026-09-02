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
  const rowCounts = [4, 2, 3, 2, 1, 5, 6];
  db.transaction = async callback => callback({
    async query(sql, params) {
      captured.push({ sql, params });
      return { rowCount: rowCounts[captured.length - 1] };
    },
  });
  try {
    const removed = await cleanupWhatsappAiRetention(1, 10);
    assert.equal(removed, rowCounts.reduce((total, value) => total + value, 0));
    assert.equal(captured.length, 7);
    assert.match(captured[0].sql, /status <> 'humano'/);
    assert.equal(captured[0].params[0], 7);
    assert.match(captured[1].sql, /status = 'humano'/);
    assert.equal(captured[1].params[0], 30);
    assert.match(captured[2].sql, /UPDATE eventos_integracao_canais/);
    assert.match(captured[2].sql, /redacted/);
    assert.match(captured[3].sql, /UPDATE tarefas_integracao_canais/);
    assert.match(captured[4].sql, /DELETE FROM eventos_integracao_canais/);
    assert.match(captured[5].sql, /DELETE FROM whatsapp_ai_provider_runs/);
    assert.match(captured[6].sql, /DELETE FROM whatsapp_ai_policy_events/);
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
