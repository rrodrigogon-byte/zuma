import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeWhatsappEgress, egressMode, evaluateWhatsappEgress } from './whatsapp-egress.js';
import { enviarMensagem } from './whatsapp.js';
import { db } from './database.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const CHANNEL = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const request = { empresaId: COMPANY, lojaId: STORE, canalId: CHANNEL, instance: 'dino', number: '5565999990001' };

function withEnv(fn) {
  const previous = { ...process.env };
  Object.assign(process.env, {
    WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias',
    CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_INSTANCE: 'dino',
    CHATBOT_BACKEND_EMPRESA_ID: COMPANY, WHATSAPP_POLL_PILOT_PHONES: '5565999990001',
  });
  delete process.env.WHATSAPP_EGRESS_MODE;
  delete process.env.WHATSAPP_LINE_VERIFIED;
  delete process.env.WHATSAPP_FULL_ROLLOUT_APPROVED;
  return Promise.resolve().then(fn).finally(() => { process.env = previous; });
}

test('saída Dino negada por padrão mesmo com worker de entrada ligado; zero HTTP', async () => withEnv(async () => {
  process.env.WHATSAPP_POLL_MODE = 'on';
  assert.equal(egressMode(), 'off');
  let queryCount = 0;
  const database = { queryRead: () => { queryCount += 1; throw new Error('não consultar'); } };
  assert.equal((await authorizeWhatsappEgress(request, { database })).reason, 'line_unverified');
  assert.equal(queryCount, 0);
  const result = await enviarMensagem({ whatsapp_instance: 'dino', empresa_id: COMPANY, loja_id: STORE, canal_id: CHANNEL }, request.number, 'texto de teste');
  assert.equal(result.ok, false);
  assert.equal(result.uncertain, false);
}));

test('sem escopo da empresa/loja/canal ou instância de outra empresa falha antes de SQL', async () => withEnv(async () => {
  process.env.WHATSAPP_LINE_VERIFIED = '1';
  process.env.WHATSAPP_EGRESS_MODE = 'on';
  assert.equal(egressMode(), 'off', 'modo amplo sem aprovação explícita é bloqueado');
  process.env.WHATSAPP_FULL_ROLLOUT_APPROVED = '1';
  for (const patch of [{ empresaId: OTHER }, { lojaId: OTHER }, { canalId: null }, { instance: 'isa' }, { empresaId: null }]) {
    const decision = evaluateWhatsappEgress({ ...request, ...patch });
    if (patch.lojaId === OTHER) assert.equal(decision.ok, true, 'UUID da loja válida exige verificação escopada no SQL');
    else assert.equal(decision.ok, false);
  }
}));

test('pilot permite somente contato interno da allowlist, on continua exigir canal único ativo', async () => withEnv(async () => {
  process.env.WHATSAPP_LINE_VERIFIED = '1';
  process.env.WHATSAPP_EGRESS_MODE = 'pilot';
  assert.equal(evaluateWhatsappEgress(request).ok, true);
  assert.equal(evaluateWhatsappEgress({ ...request, number: '5565999990002' }).reason, 'pilot_not_listed');
  assert.equal(evaluateWhatsappEgress({ ...request, number: 'contato-invalido' }).reason, 'recipient_invalid');
  let queries = 0;
  const database = { queryRead: async (sql, params) => {
    queries += 1;
    assert.match(sql, /NOT EXISTS/);
    assert.deepEqual(params, [COMPANY, STORE, CHANNEL, 'dino']);
    return { rows: [{ id: CHANNEL }] };
  } };
  assert.equal((await authorizeWhatsappEgress(request, { database })).ok, true);
  assert.equal(queries, 1);
  assert.equal((await authorizeWhatsappEgress(request, { database: { queryRead: async () => ({ rows: [] }) } })).reason, 'channel_inactive_or_shared');
  assert.equal((await authorizeWhatsappEgress(request, { database: { queryRead: async () => { throw new Error('falha PG'); } } })).reason, 'channel_unavailable');
}));

test('URL do chatbot configurada nunca cai silenciosamente na Evolution ao omitir provider', async () => withEnv(async () => {
  delete process.env.WHATSAPP_PROVIDER;
  const result = await enviarMensagem({ whatsapp_instance: 'dino', empresa_id: COMPANY }, request.number, 'não enviar');
  assert.equal(result.error, 'WHATSAPP_PROVIDER_SCOPE');
  assert.equal(result.uncertain, false);
}));

test('outra empresa não herda URL/chave/instância Evolution globais', async () => withEnv(async () => {
  process.env.WHATSAPP_PROVIDER = 'evolution';
  process.env.EVOLUTION_API_URL = 'http://127.0.0.1:1';
  process.env.EVOLUTION_API_KEY = 'synthetic-global-key';
  process.env.EVOLUTION_INSTANCE = 'legacy-global';
  const denied = await enviarMensagem({ empresa_id: OTHER, loja_id: STORE, whatsapp_instance: 'other-channel' }, request.number, 'não enviar');
  assert.equal(denied.error, 'WHATSAPP_EVOLUTION_TENANT_CONFIG_REQUIRED');
  assert.equal(denied.uncertain, false);
}));

test('owner Dino configurado recusa modo Isa sem instância, mesmo com credencial válida', async () => withEnv(async () => {
  process.env.CHATBOT_BACKEND_MODE = 'isa';
  const result = await enviarMensagem({ empresa_id: COMPANY, whatsapp_instance: 'dino' }, request.number, 'não enviar');
  assert.equal(result.error, 'WHATSAPP_OWNER_REQUIRES_INSTANCE_MODE');
  assert.equal(result.ok, false);
}));

test('piloto envia apenas uma vez sob lock da linha; aceitação não significa entrega no aparelho', async () => withEnv(async () => {
  process.env.WHATSAPP_EGRESS_MODE = 'pilot';
  process.env.WHATSAPP_LINE_VERIFIED = '1';
  process.env.CHATBOT_BACKEND_KEY = 'synthetic-key-24-characters';
  const oldTx = db.transaction;
  const oldFetch = globalThis.fetch;
  let locked = false;
  let requests = 0;
  try {
    db.transaction = async callback => {
      locked = true;
      try {
        return await callback({ query: async (sql, params) => {
          assert.match(sql, /FOR SHARE OF c/);
          assert.deepEqual(params, [COMPANY, STORE, CHANNEL, 'dino']);
          return { rows: [{ id: CHANNEL }] };
        } });
      } finally { locked = false; }
    };
    globalThis.fetch = async (url, options) => {
      requests += 1;
      assert.equal(locked, true);
      assert.equal(new URL(url).pathname, '/api/v1/whats-app/send');
      assert.equal(JSON.parse(options.body).instanceName, 'dino');
      return { ok: true, status: 200, text: async () => '{"success":true,"accepted":true}' };
    };
    const result = await enviarMensagem({ empresa_id: COMPANY, loja_id: STORE, canal_id: CHANNEL, whatsapp_instance: 'dino' }, request.number, 'teste sintético');
    assert.equal(result.ok, true);
    assert.equal(requests, 1);
    assert.equal(locked, false);
    const successfulTx = db.transaction;
    db.transaction = async callback => { await successfulTx(callback); throw new Error('commit desconhecido'); };
    const uncertain = await enviarMensagem({ empresa_id: COMPANY, loja_id: STORE, canal_id: CHANNEL, whatsapp_instance: 'dino' }, request.number, 'teste sintético de commit');
    assert.equal(uncertain.ok, false);
    assert.equal(uncertain.uncertain, true);
    assert.equal(uncertain.retryable, false);
    assert.equal(requests, 2, 'nenhuma repetição automática depois de resposta HTTP');
  } finally {
    db.transaction = oldTx;
    globalThis.fetch = oldFetch;
  }
}));
