import test from 'node:test';
import assert from 'node:assert/strict';
import * as provider from './whatsapp-provider.js';

test('listInstances aceita os formatos do backend sem nomes vazios', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 200, body: { instances: [
      'dino', { instanceName: 'dino-2' }, { instance: { instanceName: 'dino-3', state: 'open' } },
      { instance_name: 'dino-4' }, { name: 'dino-5' }, { instance: 'dino-6' }, { id: 'dino-7' },
      null, {}, { instance: {} }, { name: '   ', instanceName: 'dino-8' },
    ] } }]);
    const result = await provider.listInstances(fetch);
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((item) => item.name), ['dino', 'dino-2', 'dino-3', 'dino-4', 'dino-5', 'dino-6', 'dino-7', 'dino-8']);
    assert.equal(result.items[2].state, 'open');
    assert.equal(fetch.calls.length, 1);
    assert.equal(fetch.calls[0].method, 'GET');
    assert.equal(new URL(fetch.calls[0].url).pathname, '/api/v1/whats-app/instances');
  });
});

test('listInstances rejeita envelope inválido e preserva falha de autenticação', async () => {
  await withEnv(env, async () => {
    const invalid = await provider.listInstances(fakeFetch([{ status: 200, body: { instances: {} } }]));
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error, 'invalid_instances_response');
    const denied = await provider.listInstances(fakeFetch([{ status: 401, body: {} }]));
    assert.equal(denied.authError, true);
    assert.deepEqual(denied.items, []);
  });
});

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

// Modo de instâncias Dino: status/QR por instância e /send com instanceName.
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

test('envio multi-instância usa uma única rota documentada com instanceName', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 200, body: { success: true, accepted: true, questionId: 'synthetic-1' } }]);
    const result = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, fetch);
    assert.equal(result.ok, true);
    assert.equal(fetch.calls.length, 1);
    assert.equal(fetch.calls[0].url, 'https://backend.test/api/v1/whats-app/send');
    assert.equal(fetch.calls[0].headers.authorization, `Bearer ${'k'.repeat(24)}`);
    assert.deepEqual(fetch.calls[0].body, { instanceName: 'dino-1', chat_id: '5565999990000', message: 'oi', simulateTyping: false, delaySeconds: 0, waitForReply: false });
  });
});

test('instância divergente não envia e 404 não tenta segunda rota', async () => {
  await withEnv(env, async () => {
    const noSend = fakeFetch([]);
    const mismatch = await provider.sendTextViaChatbotBackend({ instance: 'isa', number: '5565999990000', text: 'oi' }, noSend);
    assert.equal(mismatch.error, 'INSTANCE_SCOPE_MISMATCH');
    const missing = await provider.sendTextViaChatbotBackend({ number: '5565999990000', text: 'oi' }, noSend);
    assert.equal(missing.error, 'INSTANCE_SCOPE_MISMATCH');
    assert.equal(noSend.calls.length, 0);
    const fetch = fakeFetch([{ status: 404 }]);
    const result = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, fetch);
    assert.equal(result.ok, false);
    assert.deepEqual(fetch.calls.map(call => call.url), ['https://backend.test/api/v1/whats-app/send']);
  });
});

test('200 success=true sem accepted é aceito; 200 sem success fica incerto sem retry', async () => {
  await withEnv(env, async () => {
    const legacy = fakeFetch([{ status: 200, body: { success: true, questionId: 'synthetic-2' } }]);
    const accepted = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, legacy);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.uncertain, false);
    const ambiguous = fakeFetch([{ status: 200, body: { id: 'synthetic-3', status: 'queued' } }]);
    const result = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, ambiguous);
    assert.equal(result.ok, false);
    assert.equal(result.uncertain, true);
    assert.equal(result.retryable, false);
    assert.equal(ambiguous.calls.length, 1);
  });
});

test('erro 500 não é repetido em outra rota (evita mensagem duplicada)', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 500 }]);
    const result = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, fetch);
    assert.equal(result.ok, false);
    assert.equal(result.uncertain, true);
    assert.equal(fetch.calls.length, 1);
  });
});

test('chave recusada é sinalizada como authError', async () => {
  await withEnv(env, async () => {
    const status = await provider.getInstanceStatus('dino-1', fakeFetch([{ status: 401 }]));
    assert.equal(status.authError, true);
    const send = await provider.sendTextViaChatbotBackend({ instance: 'dino-1', number: '5565999990000', text: 'oi' }, fakeFetch([{ status: 403 }]));
    assert.equal(send.authError, true);
  });
});

test('status extrai número somente do backend, jamais inventa titularidade', async () => {
  await withEnv(env, async () => {
    const verified = await provider.getInstanceStatus('dino-1', fakeFetch([{ status: 200, body: { authenticated: true, connectedNumber: '+55 65 99999-0000' } }]));
    assert.equal(verified.state, 'open');
    assert.ok(verified.phone.includes('0000'));
    const unknown = await provider.getInstanceStatus('dino-1', fakeFetch([{ status: 200, body: { authenticated: true } }]));
    assert.equal(unknown.phone, '');
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

test('modo por instância usa instanceName na consulta, não parâmetro ignorado', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 200, body: { users: [{ chatId: '5565999990000', messages: [{ role: 'user', content: 'oi', timestamp: '2026-10-01T18:00:00.000Z', whatsappMessageId: 'w1' }] }] } }]);
    const result = await provider.fetchInboundMessages({ instance: 'dino-1', from: Date.parse('2026-10-01T17:30:00Z'), limit: 50 }, fetch);
    assert.equal(result.ok, true);
    assert.equal(result.messages.length, 1);
    assert.match(fetch.calls[0].url, /[?&]instanceName=dino-1(&|$)/);
    assert.doesNotMatch(fetch.calls[0].url, /[?&]instance=/);
    for (const invalid of [undefined, 'isa', '../dino']) {
      const rejected = await provider.fetchInboundMessages({ instance: invalid }, fetch);
      assert.equal(rejected.error, 'INSTANCE_SCOPE_MISMATCH');
      assert.equal(rejected.messages.length, 0);
    }
    assert.equal(fetch.calls.length, 1);
  });
});

test('desconexão usa somente DELETE /instances/{instancia}/session?confirm=true documentado pelo backend', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([{ status: 200, body: { ok: true } }]);
    const result = await provider.disconnectInstance('dino-1', fetch);
    assert.equal(result.ok, true);
    assert.equal(fetch.calls.length, 1);
    assert.equal(fetch.calls[0].method, 'DELETE');
    assert.equal(fetch.calls[0].url, 'https://backend.test/api/v1/whats-app/instances/dino-1/session?confirm=true');
    assert.equal(fetch.calls[0].body, null);
  });
});

test('404/405/500/401 e resposta contraditória não fazem fallback global nem retry de logout', async () => {
  await withEnv(env, async () => {
    for (const status of [404, 405, 500, 401]) {
      const fetch = fakeFetch([{ status }]);
      const result = await provider.disconnectInstance('dino-1', fetch);
      assert.equal(result.ok, false);
      assert.equal(result.status, status);
      assert.equal(result.authError, status === 401);
      assert.equal(result.uncertain, status === 500);
      assert.deepEqual(fetch.calls.map((call) => call.url), ['https://backend.test/api/v1/whats-app/instances/dino-1/session?confirm=true']);
    }
    const contraditorio = await provider.disconnectInstance('dino-1', fakeFetch([{ status: 200, body: { success: false } }]));
    assert.equal(contraditorio.ok, false);
  });
});

test('modo Isa e instância inválida não tentam qualquer reset', async () => {
  await withEnv(env, async () => {
    const fetch = fakeFetch([]);
    assert.equal((await provider.disconnectInstance('../isa', fetch)).error, 'invalid_instance');
    assert.equal(fetch.calls.length, 0);
  });
  await withEnv(envIsa, async () => {
    const fetch = fakeFetch([]);
    assert.equal((await provider.disconnectInstance('dino', fetch)).error, 'not_supported_in_isa_mode');
    assert.equal(fetch.calls.length, 0);
  });
});
