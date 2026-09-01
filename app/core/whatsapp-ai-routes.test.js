import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { db } from './database.js';
import { createWhatsappAiWebhookRouter } from './whatsapp-ai-routes.js';

const CHANNEL = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const LOJA = '33333333-3333-4333-8333-333333333333';
const PUBLIC = '44444444-4444-4444-8444-444444444444';

async function withServer(run) {
  const app = express();
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
  app.use('/api/webhooks', createWhatsappAiWebhookRouter());
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
}

test('webhook Evolution valida token e enfileira conversa sem processamento inline', async () => {
  const env = {
    FEATURE_WHATSAPP_AI: process.env.FEATURE_WHATSAPP_AI,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
    WHATSAPP_AI_WEBHOOK_SECRET: process.env.WHATSAPP_AI_WEBHOOK_SECRET,
  };
  Object.assign(process.env, { FEATURE_WHATSAPP_AI: 'true', GEMINI_API_KEY: 'gemini-test', EVOLUTION_API_URL: 'https://evolution.example', EVOLUTION_API_KEY: 'evolution-test', EVOLUTION_INSTANCE: 'dino', WHATSAPP_AI_WEBHOOK_SECRET: 'webhook-test' });
  const originalRead = db.queryRead;
  const originalTransaction = db.transaction;
  const queries = [];
  db.queryRead = async () => ({ rows: [{ id: CHANNEL, empresa_id: EMPRESA, loja_id: LOJA, codigo_publico: PUBLIC, provedor: 'whatsapp', status: 'ativo', algoritmo_assinatura: 'token_estatico', cabecalho_assinatura: 'x-setpoint-webhook-token', credencial_referencia: 'ENV:WHATSAPP_AI_WEBHOOK_SECRET', configuracao: {} }] });
  db.transaction = async callback => callback({
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO eventos_integracao_canais')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555' }] };
      return { rows: [] };
    },
  });
  try {
    await withServer(async base => {
      const payload = { event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-1', remoteJid: '5565999999999@s.whatsapp.net', fromMe: false }, message: { conversation: 'Olá' } } };
      const invalid = await fetch(`${base}/api/webhooks/whatsapp/${PUBLIC}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-setpoint-webhook-token': 'wrong' }, body: JSON.stringify(payload) });
      assert.equal(invalid.status, 401);
      await invalid.text();
      const response = await fetch(`${base}/api/webhooks/whatsapp/${PUBLIC}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-setpoint-webhook-token': 'webhook-test' }, body: JSON.stringify(payload) });
      assert.equal(response.status, 202);
      const body = await response.json();
      assert.equal(body.accepted, true);
      assert.equal(body.duplicate, false);
      const task = queries.find(item => item.sql.includes('INSERT INTO tarefas_integracao_canais'));
      assert.ok(task);
      assert.deepEqual(task.params.slice(0, 3), [EMPRESA, LOJA, CHANNEL]);
      assert.match(task.sql, /'processar_conversa'/);
    });
  } finally {
    db.queryRead = originalRead;
    db.transaction = originalTransaction;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
