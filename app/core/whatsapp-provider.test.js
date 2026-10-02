import test from 'node:test';
import assert from 'node:assert/strict';
import * as provider from './whatsapp-provider.js';

function withEnv(values, fn) {
  const saved = {};
  for (const key of Object.keys(values)) { saved[key] = process.env[key]; if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
  const restore = () => { for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } };
  let result;
  try { result = fn(); } catch (error) { restore(); throw error; }
  if (result && typeof result.then === 'function') return result.finally(restore);
  restore();
  return result;
}

// Modo legado de instâncias (rotas /instances/{inst}/...).
const env = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_URL: 'https://backend.test', CHATBOT_BACKEND_KEY: 'k'.repeat(24), CHATBOT_BACKEND_INSTANCE: 'dino-1', CHATBOT_BACKEND_SEND_PATH: undefined };
// Contrato da Isa (padrão).
const envIsa = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: undefined, CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', CHATBOT_BACKEND_INSTANCE: undefined };

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers, body: options.body ? JSON.parse(options.body) : null });
    const next = responses.shift() || { status: 404, body: {} };
    return { ok: next.status >= 200 && next.status < 300, status: next.status, text: async () => JSON.stringify(next.body || {}) };
  };
  fn.calls = calls;
  return fn;
}

test('provedor NossaGente é escolhido por WHATSAPP_PROVIDER e exige chave', () => {
  withEnv(env, () => {
    assert.equal(provider.whatsappProviderName(), 'chatbot_backend');
    assert.equal(provider.whatsappProviderConfigured(), true);
    assert.equal(provider.providerSummary().keyConfigured, true);
  });
  withEnv({ ...env, CHATBOT_BACKEND_KEY: undefined }, () => assert.equal(provider.whatsappProviderConfigured(), false));
  withEnv({ WHATSAPP_PROVIDER: undefined }, () => assert.equal(provider.whatsappProviderName(), 'evolution'));
});

test('normaliza estados e QR de formatos diferentes', () => {
  assert.equal(provider.normalizeState({ state: 'CONNECTED' }), 'open');
  assert.equal(provider.normalizeState({ instance: { state: 'connecting' } }), 'connecting');
  assert.equal(provider.normalizeState({ status: 'disconnected' }), 'close');
  assert.equal(provider.normalizeState({ connected: true }), 'open');
  assert.equal(provider.normalizeState({ connectionState: 'qr_ready' }), 'qr');
  const image = provider.extractQr({ base64: 'data:image/png;base64,AAAA', pairingCode: 'WXYZ-1234' });
  assert.equal(image.qrImage, 'data:image/png;base64,AAAA');
  assert.equal(image.pairingCode, 'WXYZ-1234');
  assert.equal(provider.extractQr({ qrDataUrl: 'data:image/png;base64,DINO' }).qrImage, 'data:image/png;base64,DINO');
  const raw = provider.extractQr({ qrcode: '2@abc,def' });
  assert.equal(raw.qrRaw, '2@abc,def');
  assert.equal(provider.validInstance('Dino-1'), 'dino-1');
  assert.equal(provider.validInstance('../x'), '');
});

test('envio tenta a próxima rota só quando a anterior não existe (404)', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 404 }, { status: 201, body: { id: 'm1' } }]);
    const result = await provider.sendTextViaChatbotBackend({ number: '5565999990000', text: 'oi' }, fetch);
    assert.equal(result.ok, true);
    assert.equal(fetch.calls.length, 2);
    assert.equal(fetch.calls[0].url, 'https://backend.test/api/v1/whats-app/instances/dino-1/messages/text');
    assert.equal(fetch.calls[1].url, 'https://backend.test/api/v1/whats-app/instances/dino-1/send-text');
    assert.equal(fetch.calls[0].headers.authorization, `Bearer ${'k'.repeat(24)}`);
    assert.equal(fetch.calls[0].body.number, '5565999990000');
  });
});

test('erro 500 não é repetido em outra rota (evita mensagem duplicada)', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 500 }]);
    const result = await provider.sendTextViaChatbotBackend({ number: '5565999990000', text: 'oi' }, fetch);
    assert.equal(result.ok, false);
    assert.equal(result.uncertain, true);
    assert.equal(fetch.calls.length, 1);
  });
});

test('chave recusada é sinalizada como authError', async () => {
  await withEnv(env, async () => {
    const status = await provider.getInstanceStatus('dino-1', fakeFetch([{ status: 401 }]));
    assert.equal(status.authError, true);
    const send = await provider.sendTextViaChatbotBackend({ number: '5565999990000', text: 'oi' }, fakeFetch([{ status: 403 }]));
    assert.equal(send.authError, true);
  });
});

test('QR usa GET e cai para POST quando o método não existe', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 405 }, { status: 200, body: { qrcode: 'data:image/png;base64,QQ==', state: 'qr' } }]);
    const qr = await provider.requestInstanceQr('dino-1', fetch);
    assert.equal(qr.ok, true);
    assert.equal(qr.qrImage, 'data:image/png;base64,QQ==');
    assert.deepEqual(fetch.calls.map((call) => call.method), ['GET', 'POST']);
  });
});

test('contrato da Isa: envio por POST /send com chat_id, message e X-API-KEY', async () => {
  await withEnv(envIsa, async () => {
    assert.equal(provider.whatsappProviderConfigured(), true);
    const fetch = fakeFetch([{ status: 200, body: { success: true, accepted: true, questionId: 'q-1' } }]);
    const result = await provider.sendTextViaChatbotBackend({ number: '(65) 99999-0000', text: 'Olá!' }, fetch);
    assert.equal(result.ok, true);
    assert.equal(result.data.key.id, 'q-1');
    assert.equal(fetch.calls.length, 1);
    assert.equal(fetch.calls[0].url, 'https://dino-backend.test/api/v1/whats-app/send');
    assert.equal(fetch.calls[0].method, 'POST');
    assert.equal(fetch.calls[0].headers['X-API-KEY'], 'chave-de-teste-com-24-car');
    assert.equal(fetch.calls[0].headers.authorization, undefined);
    assert.deepEqual(fetch.calls[0].body, { chat_id: '5565999990000', message: 'Olá!', simulateTyping: false, delaySeconds: 0, waitForReply: false });
  });
});

test('contrato da Isa: accepted=false é falha; grupo e número inválido não saem', async () => {
  await withEnv(envIsa, async () => {
    const recusado = await provider.sendTextViaChatbotBackend({ number: '5565999990000', text: 'oi' }, fakeFetch([{ status: 200, body: { success: true, accepted: false, error: 'not_connected' } }]));
    assert.equal(recusado.ok, false);
    const fetch = fakeFetch([]);
    assert.equal((await provider.sendTextViaChatbotBackend({ number: '123@g.us', text: 'oi' }, fetch)).error, 'INVALID_CHAT_ID');
    assert.equal(fetch.calls.length, 0);
  });
});

test('contrato da Isa: sem URL explícita ou com chave curta o provedor não liga (nunca usa o número da Isa por padrão)', () => {
  withEnv({ ...envIsa, CHATBOT_BACKEND_URL: undefined }, () => assert.equal(provider.whatsappProviderConfigured(), false));
  withEnv({ ...envIsa, CHATBOT_BACKEND_KEY: 'curta' }, () => assert.equal(provider.whatsappProviderConfigured(), false));
});

test('contrato da Isa: status { authenticated, connecting } e texto longo cortado como na ponte', async () => {
  await withEnv(envIsa, async () => {
    const aberto = await provider.getInstanceStatus('qualquer', fakeFetch([{ status: 200, body: { authenticated: true, connecting: false } }]));
    assert.equal(aberto.state, 'open');
    const conectando = await provider.getInstanceStatus('qualquer', fakeFetch([{ status: 200, body: { authenticated: false, connecting: true } }]));
    assert.equal(conectando.state, 'connecting');
    const semSessao = await provider.getSessionStatus(fakeFetch([{ status: 200, body: { authenticated: false, connecting: false } }]));
    assert.equal(semSessao.state, 'qr');
  });
  const longo = provider.isaMessageText(`${'linha\n'.repeat(900)}fim`);
  assert.ok(longo.length <= 4000);
  assert.match(longo, /resposta resumida/);
});

test('contrato da Isa: entrada por GET /messages achatando users[].messages[]', async () => {
  await withEnv(envIsa, async () => {
    const fetch = fakeFetch([{ status: 200, body: { users: [{ chatId: '5565999990000', messages: [{ role: 'user', content: 'oi', timestamp: '2026-10-01T18:00:00.000Z', whatsappMessageId: 'w1' }] }] } }]);
    const result = await provider.fetchInboundMessages({ from: Date.parse('2026-10-01T17:30:00Z'), limit: 50 }, fetch);
    assert.equal(result.ok, true);
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].chatId, '5565999990000');
    assert.match(fetch.calls[0].url, /\/api\/v1\/whats-app\/messages\?latest=false&role=user&limit=50&from=2026-10-01T17%3A30%3A00.000Z$/);
  });
});

test('modo por instância preserva o contrato de mensagens e envia instance na consulta', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 200, body: { users: [{ chatId: '5565999990000', messages: [{ role: 'user', content: 'oi', timestamp: '2026-10-01T18:00:00.000Z', whatsappMessageId: 'w1' }] }] } }]);
    const result = await provider.fetchInboundMessages({ from: Date.parse('2026-10-01T17:30:00Z'), limit: 50 }, fetch);
    assert.equal(result.ok, true);
    assert.equal(result.messages.length, 1);
    assert.match(fetch.calls[0].url, /[?&]instance=dino-1(&|$)/);
  });
});
