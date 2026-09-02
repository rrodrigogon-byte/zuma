import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../core/database.js';
import { claimWhatsappAiTasks, cleanupWhatsappAiRetention } from './whatsapp-ai-worker.js';

test('cleanupWhatsappAiRetention remove apenas sessões antigas fora de handoff e respeita mínimo de sete dias', async () => {
  const original = db.query;
  let captured;
  db.query = async (sql, params) => { captured = { sql, params }; return { rowCount: 4 }; };
  try {
    const removed = await cleanupWhatsappAiRetention(1);
    assert.equal(removed, 4);
    assert.match(captured.sql, /status <> 'humano'/);
    assert.equal(captured.params[0], 7);
  } finally { db.query = original; }
});

test('claimWhatsappAiTasks reivindica conversas, campanhas, carrinhos e avisos de agenda com SKIP LOCKED e limite seguro', async () => {
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
    assert.equal(captured.params[1], 3);
    assert.equal(typeof captured.params[2], 'boolean');
    assert.equal(typeof captured.params[3], 'boolean');
  } finally { db.transaction = original; }
});
