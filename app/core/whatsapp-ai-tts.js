import fetch from 'node-fetch';

/**
 * Text-to-Speech (TTS) engine para o T-Rex
 */
export async function generateSpeech(text) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    // Voz do T-Rex simulada (ou custom ID)
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obbfIdGnc8csK0'; // Adam/default
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!response.ok) throw new Error(`ElevenLabs TTS falhou: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'echo', // Voz amigável
        response_format: 'opus'
      })
    });
    if (!response.ok) throw new Error(`OpenAI TTS falhou: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  throw new Error('API de TTS não configurada (ELEVENLABS_API_KEY ou OPENAI_API_KEY requerida para enviar áudio).');
}
