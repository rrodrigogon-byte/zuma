import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpeechWithType, textoParaFala, VOZ_GOOGLE_PADRAO } from './whatsapp-ai-tts.js';
import { chatbotBackendAudioPath, sendAudioViaChatbotBackend } from './whatsapp-provider.js';

test('texto falado sem emoji, marcação, link nem quebra de linha', () => {
  assert.equal(textoParaFala('Fechado! 😄\n*Corte com Dino* sábado às 12:00\n👉 Responda *SIM* https://kytto.com.br/x'), 'Fechado!. Corte com Dino sábado às 12:00. Responda SIM');
  assert.equal(textoParaFala('a'.repeat(2000)).length, 900);
});

test('Google TTS: OGG/Opus com a voz pt-BR padrão e a chave só na query', async () => {
  let pedido = null;
  const fetchImpl = async (url, opts) => { pedido = { url, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ audioContent: 'T2dnUw==' }) }; };
  const audio = await generateSpeechWithType('Bora marcar!', { GOOGLE_TTS_API_KEY: 'chave-teste' }, fetchImpl);
  assert.deepEqual(audio, { base64: 'T2dnUw==', mimetype: 'audio/ogg; codecs=opus' });
  assert.match(pedido.url, /^https:\/\/texttospeech\.googleapis\.com\/v1\/text:synthesize\?key=chave-teste$/);
  assert.equal(pedido.body.voice.name, VOZ_GOOGLE_PADRAO);
  assert.equal(pedido.body.voice.languageCode, 'pt-BR');
  assert.equal(pedido.body.audioConfig.audioEncoding, 'OGG_OPUS');
});

test('Google TTS: voz configurável e erro HTTP vira exceção (o envio cai para texto)', async () => {
  let voz = '';
  const ok = async (_url, opts) => { voz = JSON.parse(opts.body).voice.name; return { ok: true, json: async () => ({ audioContent: 'x' }) }; };
  await generateSpeechWithType('oi', { GOOGLE_TTS_API_KEY: 'k', GOOGLE_TTS_VOICE: 'pt-BR-Chirp3-HD-Charon' }, ok);
  assert.equal(voz, 'pt-BR-Chirp3-HD-Charon');
  await assert.rejects(() => generateSpeechWithType('oi', { GOOGLE_TTS_API_KEY: 'k' }, async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(() => generateSpeechWithType('oi', {}, async () => ({ ok: true })), /voz não configurada/);
});

test('rota de áudio do backend só com CHATBOT_BACKEND_AUDIO_PATH válido', async () => {
  assert.equal(chatbotBackendAudioPath({}), '');
  assert.equal(chatbotBackendAudioPath({ CHATBOT_BACKEND_AUDIO_PATH: '/send-audio' }), '/send-audio');
  assert.equal(chatbotBackendAudioPath({ CHATBOT_BACKEND_AUDIO_PATH: 'http://x' }), '');
  const antes = process.env.CHATBOT_BACKEND_AUDIO_PATH;
  delete process.env.CHATBOT_BACKEND_AUDIO_PATH;
  try {
    const r = await sendAudioViaChatbotBackend({ instance: 'dino', number: '5565999990001', base64: 'T2dnUw==' }, async () => { throw new Error('não deveria chamar'); });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'AUDIO_ROUTE_NOT_CONFIGURED');
  } finally {
    if (antes !== undefined) process.env.CHATBOT_BACKEND_AUDIO_PATH = antes;
  }
});
