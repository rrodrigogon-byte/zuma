import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIGURINHAS, escolherFigurinha, podeEnviarFigurinha, enviarFigurinhaDoMomento, lerFigurinha, urlFigurinha, INTERVALO_MS,
} from './whatsapp-stickers.js';
import { sendStickerViaChatbotBackend } from './whatsapp-provider.js';

const SESSION = { id: 's1', empresa_id: 'e1', loja_id: 'l1', telefone: '5565999990001', estado: {} };

function withEnv(values, fn) {
  const previous = { ...process.env };
  Object.assign(process.env, values);
  return Promise.resolve().then(fn).finally(() => { process.env = previous; });
}

test('cada figurinha do catálogo existe como WebP 512x512 e com menos de 100 KB', () => {
  for (const mood of Object.keys(FIGURINHAS)) {
    const arquivo = lerFigurinha(mood);
    assert.ok(arquivo, `arquivo de ${mood}`);
    assert.equal(arquivo.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(arquivo.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(arquivo.length < 100 * 1024, `${mood} tem ${arquivo.length} bytes`);
  }
});

test('momentos: o sistema decide a figurinha, nunca o modelo', () => {
  assert.equal(escolherFigurinha({ kind: 'confirmed', actionType: 'agendamento' }), 'agendado');
  assert.equal(escolherFigurinha({ kind: 'confirmed', actionType: 'remarcacao' }), 'agendado');
  assert.equal(escolherFigurinha({ kind: 'confirmed', actionType: 'pedido' }), 'cheiroso');
  assert.equal(escolherFigurinha({ kind: 'confirmed', actionType: 'cancelamento' }), null, 'cancelamento não comemora');
  assert.equal(escolherFigurinha({ kind: 'confirmed', actionType: 'promocao_cliente' }), null);
  assert.equal(escolherFigurinha({ kind: 'confirmation_failed' }), 'desculpa');
  assert.equal(escolherFigurinha({ kind: 'personalization_granted' }), 'valeu');
  assert.equal(escolherFigurinha({ kind: 'gemini', traces: [{ name: 'confirmar_presenca', ok: true }] }), 'confirmado');
  assert.equal(escolherFigurinha({ kind: 'gemini', traces: [{ name: 'avisar_atraso', ok: true }] }), 'chegando');
  assert.equal(escolherFigurinha({ kind: 'gemini', primeiroContato: true }), 'ola');
  assert.equal(escolherFigurinha({ kind: 'gemini' }), null, 'conversa comum não leva figurinha');
  for (const kind of ['handoff', 'opt_out', 'security_handoff', 'sensitive_handoff', 'output_blocked', 'gemini_fallback']) {
    assert.equal(escolherFigurinha({ kind, primeiroContato: true }), null, `${kind} nunca leva figurinha`);
  }
});

test('limite: 1 a cada 4 h, nunca repetida em seguida, no máximo 3 por dia', () => {
  const agora = Date.parse('2026-10-05T18:00:00Z');
  assert.equal(podeEnviarFigurinha({}, 'ola', agora), true);
  const recente = { figurinhas: [{ mood: 'ola', em: new Date(agora - 60 * 1000).toISOString() }] };
  assert.equal(podeEnviarFigurinha(recente, 'agendado', agora), false);
  const antiga = { figurinhas: [{ mood: 'ola', em: new Date(agora - INTERVALO_MS - 1000).toISOString() }] };
  assert.equal(podeEnviarFigurinha(antiga, 'agendado', agora), true);
  assert.equal(podeEnviarFigurinha(antiga, 'ola', agora), false, 'mesma figurinha em seguida');
  const tres = { figurinhas: [5, 10, 15].map((h, i) => ({ mood: ['ola', 'agendado', 'valeu'][i], em: new Date(agora - h * 3600 * 1000).toISOString() })) };
  assert.equal(podeEnviarFigurinha(tres, 'confirmado', agora), false);
});

test('desligadas por padrão: nada sai sem WHATSAPP_STICKERS=on', async () => withEnv({ WHATSAPP_STICKERS: '' }, async () => {
  let chamadas = 0;
  const out = await enviarFigurinhaDoMomento({ session: SESSION, response: { kind: 'confirmed', actionType: 'agendamento' }, enviar: async () => { chamadas += 1; return { ok: true }; }, query: async () => ({}) });
  assert.deepEqual(out, { sent: false, reason: 'desligadas' });
  assert.equal(chamadas, 0);
}));

test('ligadas: envia o WebP depois de confirmar, grava o histórico e nunca lança', async () => withEnv({ WHATSAPP_STICKERS: 'on', PUBLIC_BASE_URL: 'https://setpoint.kytto.com.br' }, async () => {
  const enviados = [];
  const updates = [];
  const out = await enviarFigurinhaDoMomento({
    session: SESSION, response: { kind: 'confirmed', actionType: 'agendamento' }, tenant: { empresa_id: 'e1' },
    enviar: async (tenant, telefone, fig) => { enviados.push({ telefone, fig }); return { ok: true }; },
    query: async (sql, params) => { updates.push(params); return {}; },
  });
  assert.deepEqual(out, { sent: true, mood: 'agendado' });
  assert.equal(enviados[0].telefone, '5565999990001');
  assert.equal(enviados[0].fig.url, 'https://setpoint.kytto.com.br/figurinhas/trex-agendado.webp');
  assert.ok(enviados[0].fig.base64.length > 1000);
  assert.equal(JSON.parse(updates[0][3])[0].mood, 'agendado');
  const falha = await enviarFigurinhaDoMomento({ session: SESSION, response: { kind: 'confirmation_failed' }, enviar: async () => { throw new Error('rede'); }, query: async () => ({}) });
  assert.equal(falha.sent, false, 'erro do provedor não derruba o atendimento');
  assert.equal(urlFigurinha('inexistente'), '');
}));

test('backend sem rota de figurinha configurada: não chama a rede', async () => withEnv({ CHATBOT_BACKEND_STICKER_PATH: '', CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_KEY: 'x'.repeat(24) }, async () => {
  let chamou = false;
  const out = await sendStickerViaChatbotBackend({ number: '5565999990001', base64: 'AAAA' }, async () => { chamou = true; });
  assert.equal(out.unsupported, true);
  assert.equal(chamou, false);
}));

test('backend com rota: manda instância, chat_id e o WebP', async () => withEnv({ CHATBOT_BACKEND_STICKER_PATH: '/send-sticker', CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino' }, async () => {
  let pedido = null;
  const out = await sendStickerViaChatbotBackend({ instance: 'dino', number: '5565999990001', url: 'https://x/figurinhas/trex-ola.webp', base64: 'AAAA' }, async (url, init) => {
    pedido = { url, body: JSON.parse(init.body), headers: init.headers };
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
  });
  assert.equal(out.ok, true);
  assert.equal(pedido.url, 'https://backend.example.invalid/api/v1/whats-app/send-sticker');
  assert.equal(pedido.body.instanceName, 'dino');
  assert.equal(pedido.body.chat_id, '5565999990001');
  assert.equal(pedido.body.sticker.mimetype, 'image/webp');
  const errado = await sendStickerViaChatbotBackend({ instance: 'outra', number: '5565999990001', base64: 'AAAA' }, async () => { throw new Error('não deveria chamar'); });
  assert.equal(errado.error, 'INSTANCE_SCOPE_MISMATCH');
}));
