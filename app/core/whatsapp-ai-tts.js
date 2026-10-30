import fetch from 'node-fetch';

/**
 * Voz do T-Rex (Text-to-Speech). Ordem: Google Cloud TTS (OGG/Opus, o formato do áudio
 * gravado do WhatsApp), ElevenLabs (MP3) e OpenAI (OGG/Opus). Devolve { base64, mimetype }.
 *
 * Google: GOOGLE_TTS_API_KEY (chave restrita à Cloud Text-to-Speech API) e, opcional,
 * GOOGLE_TTS_VOICE e GOOGLE_TTS_RATE (padrão 1.08, o ritmo de fala do Dino). A voz padrão é Chirp 3 HD, a geração
 * de vozes do Google mais próxima da fala humana. Em 30/10 a Neural2-B soou robótica.
 * Achird foi a voz pronta mais próxima da do Dino nos 29 áudios dele (tom médio ~126 Hz,
 * cerca de 6 sílabas por segundo); o T-Rex é aprendiz do Dino.
 */
export const VOZ_GOOGLE_PADRAO = 'pt-BR-Chirp3-HD-Achird';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function horaFalada(h, m) {
  const hora = Number(h);
  const min = Number(m || 0);
  if (!Number.isFinite(hora) || hora > 23 || min > 59) return null;
  const base = hora === 0 ? 'meia-noite' : hora === 12 ? 'meio-dia' : `${hora}${hora === 1 ? ' hora' : ' horas'}`;
  if (!min) return base;
  if (min === 30) return `${hora === 0 ? 'meia-noite' : hora === 12 ? 'meio-dia' : hora} e meia`;
  return `${hora === 0 ? 'meia-noite' : hora === 12 ? 'meio-dia' : hora} e ${min}`;
}

function reaisFalados(valor) {
  const limpo = String(valor).replace(/\./g, '').replace(',', '.');
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return null;
  const reais = Math.floor(numero);
  const centavos = Math.round((numero - reais) * 100);
  const parteReais = reais ? `${reais} ${reais === 1 ? 'real' : 'reais'}` : '';
  const parteCentavos = centavos ? `${centavos} ${centavos === 1 ? 'centavo' : 'centavos'}` : '';
  return [parteReais, parteCentavos].filter(Boolean).join(' e ') || 'zero reais';
}

/**
 * Texto falado: sem emoji, marcação do WhatsApp, links nem códigos; horas, datas e
 * valores escritos como se fala ("06h15" → "6 e 15", "04/11" → "4 de novembro",
 * "R$ 300,00" → "300 reais"). Até 900 caracteres.
 */
export function textoParaFala(texto) {
  return String(texto || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/👉/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    // Códigos de pedido/agendamento não se leem em voz alta: ficam no texto do WhatsApp.
    .replace(/\s*\(?\b(?:c[oó]digo|code)\s*:?\s*[A-Z0-9-]{5,}\)?\.?/gi, '')
    .replace(/\bKC-[A-Z0-9]{6,}\b/g, 'do seu pedido')
    .replace(/R\$\s*([\d.]+(?:,\d{1,2})?)/g, (todo, valor) => reaisFalados(valor) || todo)
    .replace(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g, (todo, d, m) => (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? `${Number(d)} de ${MESES[Number(m) - 1]}` : todo))
    .replace(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})\b(?:\s*min)?/gi, (todo, h, m) => horaFalada(h, m) || todo)
    .replace(/\b(\d{1,2})\s*h\b/gi, (todo, h) => horaFalada(h, 0) || todo)
    .replace(/\bseg\b\.?/gi, 'segunda').replace(/\bter\b\.?/gi, 'terça').replace(/\bqua\b\.?/gi, 'quarta')
    .replace(/\bqui\b\.?/gi, 'quinta').replace(/\bsex\b\.?/gi, 'sexta').replace(/\bs[aá]b\b\.?/gi, 'sábado').replace(/\bdom\b\.?/gi, 'domingo')
    .replace(/(^|\s)[àÀaA]s (meio-dia|meia-noite)/g, (todo, antes, h) => `${antes}${h === 'meio-dia' ? 'ao meio-dia' : 'à meia-noite'}`)
    // Palavra toda em maiúsculas ("BARBA", "CORTE") pode ser soletrada: vira minúscula.
    .replace(/\b[A-ZÀ-Ú]{4,}\b/g, (palavra) => palavra.toLowerCase())
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/([.!?;,])\s*[.;]/g, '$1')
    .replace(/([.!?])\s*\./g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([,.!?])/g, '$1')
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
