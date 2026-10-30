import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpeechWithType, textoParaFala, VOZ_GOOGLE_PADRAO } from './whatsapp-ai-tts.js';
import { chatbotBackendAudioPath, sendAudioViaChatbotBackend } from './whatsapp-provider.js';

test('texto falado sem emoji, marcação, link nem quebra de linha', () => {
  assert.equal(textoParaFala('Fechado! 😄\n*Corte com Dino* sábado às 12:00\n👉 Responda *SIM* https://kytto.com.br/x'), 'Fechado! Corte com Dino sábado ao meio-dia. Responda SIM');
  assert.equal(textoParaFala('Pra quarta, 04/11, tenho às 06h00, 06h15 ou 06h30. Sai por R$ 300,00.'), 'Pra quarta, 4 de novembro, tenho às 6 horas, 6 e 15 ou 6 e meia. Sai por 300 reais.');
  assert.equal(textoParaFala('Feito! BARBA (Bruno ou Nati), seg 2/11 às 14h. Código B7C4ECDC.'), 'Feito! barba (Bruno ou Nati), segunda 2 de novembro às 14 horas.');
  assert.equal(textoParaFala('Total R$ 1.250,50 às 18:30.'), 'Total 1250 reais e 50 centavos às 18 e meia.');
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
