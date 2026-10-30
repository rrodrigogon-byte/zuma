import fetch from 'node-fetch';

/**
 * Voz do T-Rex (Text-to-Speech). Ordem: Google Cloud TTS (OGG/Opus, o formato do áudio
 * gravado do WhatsApp), ElevenLabs (MP3) e OpenAI (OGG/Opus). Devolve { base64, mimetype }.
 *
 * Google: GOOGLE_TTS_API_KEY (chave restrita à Cloud Text-to-Speech API) e, opcional,
 * GOOGLE_TTS_VOICE (padrão pt-BR-Neural2-B, voz masculina) e GOOGLE_TTS_RATE (padrão 1.08).
 */
export const VOZ_GOOGLE_PADRAO = 'pt-BR-Neural2-B';

/** Texto falado: sem emoji, marcação do WhatsApp, links nem quebras repetidas; até 900 caracteres. */
export function textoParaFala(texto) {
  return String(texto || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/👉/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 900);
}

export async function generateSpeechWithType(text, env = process.env, fetchImpl = fetch) {
  const fala = textoParaFala(text);
  if (!fala) throw new Error('texto vazio para áudio');

  if (env.GOOGLE_TTS_API_KEY) {
    const voz = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/.test(String(env.GOOGLE_TTS_VOICE || '')) ? env.GOOGLE_TTS_VOICE : VOZ_GOOGLE_PADRAO;
    const ritmo = Math.min(1.4, Math.max(0.8, Number(env.GOOGLE_TTS_RATE) || 1.08));
    const response = await fetchImpl(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: fala },
        voice: { languageCode: voz.slice(0, 5), name: voz },
        audioConfig: { audioEncoding: 'OGG_OPUS', speakingRate: ritmo },
      }),
    });
    if (!response.ok) throw new Error(`Google TTS falhou: HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.audioContent) throw new Error('Google TTS sem áudio');
    return { base64: data.audioContent, mimetype: 'audio/ogg; codecs=opus' };
  }

  if (env.ELEVENLABS_API_KEY) {
    const voiceId = env.ELEVENLABS_VOICE_ID || 'pNInz6obbfIdGnc8csK0';
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fala, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!response.ok) throw new Error(`ElevenLabs TTS falhou: HTTP ${response.status}`);
    return { base64: Buffer.from(await response.arrayBuffer()).toString('base64'), mimetype: 'audio/mpeg' };
  }

  if (env.OPENAI_API_KEY) {
    const response = await fetchImpl('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: fala, voice: 'echo', response_format: 'opus' }),
    });
    if (!response.ok) throw new Error(`OpenAI TTS falhou: HTTP ${response.status}`);
    return { base64: Buffer.from(await response.arrayBuffer()).toString('base64'), mimetype: 'audio/ogg; codecs=opus' };
  }

  throw new Error('voz não configurada (GOOGLE_TTS_API_KEY, ELEVENLABS_API_KEY ou OPENAI_API_KEY)');
}

/** Compatibilidade: só o base64. */
export async function generateSpeech(text) {
  return (await generateSpeechWithType(text)).base64;
}
