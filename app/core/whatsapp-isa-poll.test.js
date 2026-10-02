// Entrada do WhatsApp igual à da Isa: consulta GET /messages, id de evento da Isa,
// idade máxima, áudio com resposta fixa, modos shadow/pilot e sem duplicar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackendMessage, runIsaPollPass, AUDIO_REPLY, pollEnabled } from './whatsapp-isa-poll.js';

const ENV = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: undefined, CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', WHATSAPP_POLL_MODE: undefined, WHATSAPP_POLL_PILOT_PHONES: undefined, WHATSAPP_MAX_REPLY_AGE_MINUTES: '30' };

async function comEnv(valores, fn) {
  const salvos = {};
  for (const [chave, valor] of Object.entries(valores)) { salvos[chave] = process.env[chave]; if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  try { return await fn(); } finally { for (const [chave, valor] of Object.entries(salvos)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; } }
}

const AGORA = Date.parse('2026-10-01T18:10:00.000Z');
const historico = {
  users: [
    { chatId: '5565999990001@c.us', messages: [
      { role: 'user', content: 'Quero marcar um corte amanhã', timestamp: '2026-10-01T18:05:00.000Z', whatsappMessageId: 'wa-1', messageType: 'text' },
      { role: 'assistant', content: 'Claro!', timestamp: '2026-10-01T18:05:05.000Z', messageType: 'text' },
      { role: 'user', content: 'mensagem velha', timestamp: '2026-10-01T16:00:00.000Z', whatsappMessageId: 'wa-0' },
    ] },
    { chatId: '5565999990002', messages: [
      { role: 'user', content: '[ÁUDIO RECEBIDO]', timestamp: '2026-10-01T18:06:00.000Z', whatsappMessageId: 'wa-2', messageType: 'audio' },
    ] },
  ],
};

function fetchHistorico() {
  const chamadas = [];
  const fn = async (url, options) => {
    chamadas.push({ url, method: options.method, headers: options.headers });
    return { ok: true, status: 200, text: async () => JSON.stringify(historico) };
  };
  fn.chamadas = chamadas;
  return fn;
}

function ingestFalso() {
  const vistos = new Set();
  const recebidos = [];
  const fn = async (canal, parsed) => {
    if (vistos.has(parsed.externalId)) return { duplicate: true };
    vistos.add(parsed.externalId);
    recebidos.push(parsed);
    return { duplicate: false, ignored: parsed.ignored };
  };
  fn.recebidos = recebidos;
  return fn;
}

test('mensagem do backend vira o mesmo evento do webhook, com id no formato da Isa', () => {
  const parsed = parseBackendMessage({ chatId: '65999990001', role: 'user', content: 'oi', timestamp: '2026-10-01T18:05:00.000Z', whatsappMessageId: 'wa-1' }, { agora: AGORA });
  assert.equal(parsed.ignored, false);
  assert.equal(parsed.event, 'MESSAGES_UPSERT');
  assert.equal(parsed.remoteJid, '5565999990001@s.whatsapp.net');
  assert.match(parsed.externalId, /^api:5565999990001:wa-1:[0-9a-f]{16}$/);
  assert.equal(parseBackendMessage({ chatId: '5565999990001', role: 'assistant', content: 'x', timestamp: '2026-10-01T18:05:00.000Z' }).reason, 'from_me');
  assert.equal(parseBackendMessage({ chatId: '120363@g.us', role: 'user', content: 'x', timestamp: '2026-10-01T18:05:00.000Z' }).reason, 'invalid_sender');
});

test('passada: só a mensagem nova e recente vai para a IA; áudio recebe resposta fixa; repetir não duplica', async () => {
  await comEnv(ENV, async () => {
    assert.equal(pollEnabled(), true);
    const fetch = fetchHistorico();
    const ingest = ingestFalso();
    const enviados = [];
    const enviar = async (msg) => { enviados.push(msg); return { ok: true }; };
    const canal = { id: 'canal-1', empresa_id: 'e', loja_id: 'l' };
    const primeira = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, ingest, enviar, comTrava: false });
    assert.equal(primeira.novas, 1, 'a mensagem de texto recente');
    assert.equal(primeira.audios, 1);
    assert.equal(primeira.ignoradas, 3, 'mensagem velha, resposta da própria atendente e o áudio');
    assert.deepEqual(enviados, [{ number: '5565999990002', text: AUDIO_REPLY }]);
    assert.match(fetch.chamadas[0].url, /^https:\/\/dino-backend\.test\/api\/v1\/whats-app\/messages\?latest=false&role=user/);
    assert.equal(fetch.chamadas[0].headers['X-API-KEY'], 'chave-de-teste-com-24-car');
    assert.equal(ingest.recebidos.find((item) => !item.ignored).text, 'Quero marcar um corte amanhã');

    const segunda = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, ingest, enviar, comTrava: false });
    assert.equal(segunda.novas, 0);
    assert.equal(segunda.duplicadas, 2);
    assert.equal(enviados.length, 1, 'áudio não é respondido duas vezes');
  });
});

test('modos: shadow só registra; pilot responde só os números liberados; off desliga', async () => {
  const canal = { id: 'canal-1', empresa_id: 'e', loja_id: 'l' };
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'shadow' }, async () => {
    const ingest = ingestFalso();
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest, enviar: async () => ({ ok: true }), comTrava: false });
    assert.equal(resumo.novas, 0);
    assert.ok(ingest.recebidos.every((item) => item.ignored));
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'pilot', WHATSAPP_POLL_PILOT_PHONES: '(65) 99999-0009' }, async () => {
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false });
    assert.equal(resumo.novas, 0);
    assert.equal(resumo.foraDoPiloto, 1);
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'pilot', WHATSAPP_POLL_PILOT_PHONES: '65999990001' }, async () => {
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false });
    assert.equal(resumo.novas, 1);
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'off' }, async () => {
    assert.equal((await runIsaPollPass({ canal, comTrava: false })).reason, 'poll_disabled');
  });
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1' }, async () => assert.equal(pollEnabled(), true, 'o backend por instância também usa a consulta de mensagens'));
});
