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

const env = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_URL: 'https://backend.test', CHATBOT_BACKEND_KEY: 'k', CHATBOT_BACKEND_INSTANCE: 'dino-1', CHATBOT_BACKEND_SEND_PATH: undefined };

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
  const image = provider.extractQr({ base64: 'data:image/png;base64,AAAA', pairingCode: 'WXYZ-1234' });
  assert.equal(image.qrImage, 'data:image/png;base64,AAAA');
  assert.equal(image.pairingCode, 'WXYZ-1234');
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
    assert.equal(fetch.calls[0].headers.authorization, 'Bearer k');
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
