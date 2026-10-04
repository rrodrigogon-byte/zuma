// Voz e imagem: localizar a mídia em qualquer formato do provedor, baixar com
// limites, pedir transcrição/descrição ao Gemini e nunca vazar a chave do backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  locateInboundMedia, loadMediaBase64, understandMedia, inboundMediaToText, mediaAsCustomerText,
  mediaEnabled, MEDIA_PREFIX, MEDIA_SYSTEM_GUIDANCE,
} from './whatsapp-ai-media.js';
import { parseBackendMessage, runIsaPollPass as runPoll, AUDIO_REPLY } from './whatsapp-isa-poll.js';

const runIsaPollPass = options => runPoll({ ...options, carregarCanal: async () => options?.canal || null });

async function comEnv(valores, fn) {
  const salvos = {};
  for (const [chave, valor] of Object.entries(valores)) { salvos[chave] = process.env[chave]; if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  try { return await fn(); } finally { for (const [chave, valor] of Object.entries(salvos)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; } }
}

const AUDIO_B64 = Buffer.from('OggS-fake-voice-note-'.repeat(10)).toString('base64');
const GEMINI_OK = (texto) => async (url, options) => {
  assert.match(url, /generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
  const body = JSON.parse(options.body);
  const inline = body.contents[0].parts.find((p) => p.inline_data);
  assert.ok(inline?.inline_data?.data, 'mídia vai inline para o Gemini');
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }) };
};

test('localiza áudio embutido (backend), URL e payload da Evolution; ignora figurinha e URL criptografada', () => {
  const a = locateInboundMedia({ messageType: 'audio', media: { base64: `data:audio/ogg; codecs=opus;base64,${AUDIO_B64}` }, whatsappMessageId: 'wa-9' });
  assert.equal(a.kind, 'audio');
  assert.equal(a.mimeType, 'audio/ogg');
  assert.equal(a.base64, AUDIO_B64);
  assert.equal(a.id, 'wa-9');

  const b = locateInboundMedia({ messageType: 'image', mediaUrl: 'https://cdn.exemplo.com/f.jpg', caption: 'quero assim' });
  assert.equal(b.kind, 'image');
  assert.equal(b.url, 'https://cdn.exemplo.com/f.jpg');
  assert.equal(b.caption, 'quero assim');

  const c = locateInboundMedia({ key: { id: 'EV1' }, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 8, url: 'https://mmg.whatsapp.net/v/x.enc' }, base64: AUDIO_B64 } });
  assert.equal(c.kind, 'audio');
  assert.equal(c.seconds, 8);
  assert.equal(c.url, undefined, 'URL .enc do WhatsApp não é usada');
  assert.equal(c.base64, AUDIO_B64);

  assert.equal(locateInboundMedia({ messageType: 'sticker', mimetype: 'image/webp' }), null);
  assert.equal(locateInboundMedia({ messageType: 'text', content: 'oi' }), null);
});

test('download respeita limite e só manda a chave do backend para o próprio backend', async () => {
  await comEnv({ CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', CHATBOT_BACKEND_MEDIA_PATH: '/messages/{id}/media', WHATSAPP_AI_MEDIA_MAX_MB: '1' }, async () => {
    const chamadas = [];
    const fetchImpl = async (url, options) => {
      chamadas.push({ url, headers: options.headers });
      return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => ({ base64: AUDIO_B64, mimetype: 'audio/ogg' }) };
    };
    const viaBackend = await loadMediaBase64({ kind: 'audio', mimeType: 'audio/ogg', id: 'wa-1' }, { fetchImpl });
    assert.equal(viaBackend.base64, AUDIO_B64);
    assert.equal(chamadas[0].url, 'https://dino-backend.test/api/v1/whats-app/messages/wa-1/media');
    assert.equal(chamadas[0].headers['X-API-KEY'], 'chave-de-teste-com-24-car');

    await loadMediaBase64({ kind: 'image', mimeType: 'image/jpeg', url: 'https://outro-dominio.test/f.jpg' }, { fetchImpl });
    assert.equal(chamadas[1].headers['X-API-KEY'], undefined, 'chave nunca vai para outra origem');

    const grande = 'A'.repeat(2 * 1024 * 1024);
    await assert.rejects(loadMediaBase64({ kind: 'audio', base64: grande }), { code: 'MEDIA_TOO_LARGE' });
    await assert.rejects(loadMediaBase64({ kind: 'audio', mimeType: 'audio/ogg' }), { code: 'MEDIA_UNAVAILABLE' });
  });
});

test('Gemini transcreve áudio e descreve foto; texto chega marcado para o atendente', async () => {
  await comEnv({ GEMINI_API_KEY: 'chave-gemini-teste', WHATSAPP_AI_MEDIA: undefined }, async () => {
    assert.equal(mediaEnabled(), true);
    const audio = await understandMedia({ kind: 'audio', base64: AUDIO_B64, mimeType: 'audio/ogg; codecs=opus' }, { fetchImpl: GEMINI_OK('Quero cortar amanhã às 15h com o Bruno') });
    assert.equal(audio.text, 'Quero cortar amanhã às 15h com o Bruno');
    assert.equal(mediaAsCustomerText('audio', audio.text), `${MEDIA_PREFIX.audio} Quero cortar amanhã às 15h com o Bruno`);
    assert.equal(mediaAsCustomerText('audio', '[sem fala]'), '');
    assert.match(mediaAsCustomerText('image', 'Degradê médio com risca lateral.', 'assim'), /^\[foto enviada pelo cliente\] Degradê médio.*\nLegenda do cliente: assim$/s);

    const tudo = await inboundMediaToText({ messageType: 'audio', media: { base64: AUDIO_B64, mimetype: 'audio/ogg' } }, { fetchImpl: GEMINI_OK('Tem horário hoje?') });
    assert.deepEqual({ ok: tudo.ok, kind: tudo.kind, text: tudo.text }, { ok: true, kind: 'audio', text: `${MEDIA_PREFIX.audio} Tem horário hoje?` });
  });
  await comEnv({ GEMINI_API_KEY: 'chave-gemini-teste', WHATSAPP_AI_MEDIA: 'off' }, async () => {
    assert.equal((await inboundMediaToText({ messageType: 'audio', media: { base64: AUDIO_B64 } })).code, 'MEDIA_DISABLED');
  });
});

test('falha do Gemini não lança: quem chamou mantém o fallback', async () => {
  await comEnv({ GEMINI_API_KEY: 'chave-gemini-teste' }, async () => {
    const falha = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const r = await inboundMediaToText({ messageType: 'audio', media: { base64: AUDIO_B64 } }, { fetchImpl: falha });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'GEMINI_HTTP_ERROR');
  });
});

test('o prompt orienta conferir dados do áudio e não comentar aparência', () => {
  assert.match(MEDIA_SYSTEM_GUIDANCE, /confirme nomes, dias e horários/);
  assert.match(MEDIA_SYSTEM_GUIDANCE, /sem comentar a aparência/);
});

test('polling: áudio novo vira texto transcrito na fila; repetido não paga Gemini de novo; falha mantém resposta fixa', async () => {
  const ENV = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: undefined, CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', WHATSAPP_POLL_MODE: undefined, WHATSAPP_MAX_REPLY_AGE_MINUTES: '30' };
  await comEnv(ENV, async () => {
    const AGORA = Date.parse('2026-10-02T14:20:00.000Z');
    const historico = { users: [
      { chatId: '5565999990010', messages: [{ role: 'user', content: '[ÁUDIO RECEBIDO]', messageType: 'audio', timestamp: '2026-10-02T14:13:00.000Z', whatsappMessageId: 'wa-voz' }] },
      { chatId: '5565999990011', messages: [{ role: 'user', content: '[IMAGEM RECEBIDA]', messageType: 'image', timestamp: '2026-10-02T14:14:00.000Z', whatsappMessageId: 'wa-foto' }] },
      { chatId: '5565999990012', messages: [{ role: 'user', content: '[ÁUDIO RECEBIDO]', messageType: 'audio', timestamp: '2026-10-02T14:15:00.000Z', whatsappMessageId: 'wa-voz-ruim' }] },
    ] };
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(historico) });
    const vistos = new Set();
    const recebidos = [];
    const ingest = async (canal, parsed) => { if (vistos.has(parsed.externalId)) return { duplicate: true }; vistos.add(parsed.externalId); recebidos.push(parsed); return { duplicate: false }; };
    const jaRecebido = async (canal, id) => vistos.has(id);
    let chamadasMidia = 0;
    const entenderMidia = async (item) => {
      chamadasMidia += 1;
      if (item.whatsappMessageId === 'wa-voz') return { ok: true, kind: 'audio', text: `${MEDIA_PREFIX.audio} Quero marcar barba amanhã cedo` };
      if (item.whatsappMessageId === 'wa-foto') return { ok: true, kind: 'image', text: `${MEDIA_PREFIX.image} Degradê alto com topete.` };
      return { ok: false, code: 'MEDIA_UNAVAILABLE' };
    };
    const enviados = [];
    const enviar = async (msg) => { enviados.push(msg); return { ok: true }; };
    const canal = { id: 'canal-dino', empresa_id: 'e', loja_id: 'l' };

    const primeira = await runIsaPollPass({ fetchImpl, agora: AGORA, canal, ingest, enviar, autorizarSaida: async () => ({ ok: true }), comTrava: false, jaRecebido, entenderMidia });
    assert.equal(primeira.novas, 2);
    assert.equal(primeira.midiasLidas, 2);
    assert.equal(primeira.audios, 2);
    assert.equal(primeira.fotos, 1);
    const voz = recebidos.find((r) => r.phone === '5565999990010');
    assert.equal(voz.ignored, false);
    assert.equal(voz.text, `${MEDIA_PREFIX.audio} Quero marcar barba amanhã cedo`);
    assert.equal(voz.media, 'audio');
    assert.match(voz.externalId, /^api:5565999990010:wa-voz:/);
    assert.equal(recebidos.find((r) => r.phone === '5565999990011').text, `${MEDIA_PREFIX.image} Degradê alto com topete.`);
    assert.deepEqual(enviados, [{ number: '5565999990012', text: AUDIO_REPLY }], 'só o áudio ilegível recebe a resposta fixa');

    const segunda = await runIsaPollPass({ fetchImpl, agora: AGORA + 5000, canal, ingest, enviar, autorizarSaida: async () => ({ ok: true }), comTrava: false, jaRecebido, entenderMidia });
    assert.equal(segunda.novas, 0);
    assert.equal(segunda.duplicadas, 3);
    assert.equal(chamadasMidia, 3, 'nenhuma nova chamada ao Gemini para mensagens já recebidas');
    assert.equal(enviados.length, 1);
  });
});

test('foto com legenda segue como texto; foto sem legenda pede leitura', () => {
  const agora = Date.parse('2026-10-02T14:20:00.000Z');
  const comLegenda = parseBackendMessage({ chatId: '5565999990011', role: 'user', content: 'quero esse corte', messageType: 'image', timestamp: '2026-10-02T14:19:00.000Z', whatsappMessageId: 'x1' }, { agora });
  assert.equal(comLegenda.ignored, false);
  assert.equal(comLegenda.text, 'quero esse corte');
  const semLegenda = parseBackendMessage({ chatId: '5565999990011', role: 'user', content: '[IMAGEM RECEBIDA]', messageType: 'image', timestamp: '2026-10-02T14:19:00.000Z', whatsappMessageId: 'x2' }, { agora });
  assert.equal(semLegenda.reason, 'image');
});

test('polling: texto que chega depois do áudio do mesmo contato espera a transcrição (ordem preservada)', async () => {
  const ENV = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: undefined, CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', WHATSAPP_POLL_MODE: undefined, WHATSAPP_MAX_REPLY_AGE_MINUTES: '30' };
  await comEnv(ENV, async () => {
    const AGORA = Date.parse('2026-10-02T14:20:00.000Z');
    const historico = { users: [
      { chatId: '5565999990030', messages: [
        { role: 'user', content: '[ÁUDIO RECEBIDO]', messageType: 'audio', timestamp: '2026-10-02T14:16:00.000Z', whatsappMessageId: 'a1' },
        { role: 'user', content: 'pode ser com o Léo', messageType: 'text', timestamp: '2026-10-02T14:16:30.000Z', whatsappMessageId: 'a2' },
      ] },
      { chatId: '5565999990031', messages: [{ role: 'user', content: 'oi', messageType: 'text', timestamp: '2026-10-02T14:17:00.000Z', whatsappMessageId: 'b1' }] },
    ] };
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(historico) });
    const ordem = [];
    const ingest = async (canal, parsed) => { ordem.push(parsed.text); return { duplicate: false }; };
    const entenderMidia = async () => ({ ok: true, kind: 'audio', text: `${MEDIA_PREFIX.audio} quero cortar amanhã` });
    const r = await runIsaPollPass({ fetchImpl, agora: AGORA, canal: { id: 'c' }, ingest, enviar: async () => ({ ok: true }), comTrava: false, jaRecebido: async () => false, entenderMidia });
    assert.equal(r.novas, 3);
    assert.deepEqual(ordem, ['oi', `${MEDIA_PREFIX.audio} quero cortar amanhã`, 'pode ser com o Léo']);
  });
});

test('download com chave não segue redirecionamento levando o X-API-KEY', async () => {
  await comEnv({ CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', CHATBOT_BACKEND_MEDIA_PATH: '/messages/{id}/media' }, async () => {
    const chamadas = [];
    const fetchImpl = async (url, options) => {
      chamadas.push({ url, headers: options.headers, redirect: options.redirect });
      if (url.startsWith('https://dino-backend.test')) return { ok: false, status: 302, headers: new Map([['location', 'https://bucket.storage.test/assinado?x=1']]) };
      return { ok: true, status: 200, headers: new Map([['content-type', 'audio/ogg']]), arrayBuffer: async () => Buffer.from('voz') };
    };
    const r = await loadMediaBase64({ kind: 'audio', mimeType: 'audio/ogg', id: 'wa-7' }, { fetchImpl });
    assert.equal(Buffer.from(r.base64, 'base64').toString(), 'voz');
    assert.equal(chamadas[0].redirect, 'manual');
    assert.equal(chamadas[1].url, 'https://bucket.storage.test/assinado?x=1');
    assert.equal(chamadas[1].headers['X-API-KEY'], undefined);
  });
});
