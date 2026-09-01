import { config } from '../config.js';

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_STEPS = 4;

export class GeminiError extends Error {
  constructor(message, code = 'GEMINI_ERROR') {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

function modelName() {
  return String(process.env.GEMINI_MODEL || config.integrations?.gemini?.model || 'gemini-2.5-flash').trim();
}

function apiKey() {
  return String(config.integrations?.gemini?.apiKey || process.env.GEMINI_API_KEY || '').trim();
}

function normalizedHistory(history = []) {
  return history.slice(-16).map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(item.text || '').slice(0, 4000) }],
  })).filter(item => item.parts[0].text);
}

function responseText(parts = []) {
  return parts.filter(part => typeof part.text === 'string').map(part => part.text).join('\n').trim();
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function runGeminiWithTools({
  systemInstruction,
  history = [],
  userText,
  tools = [],
  executeTool,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxSteps = DEFAULT_MAX_STEPS,
} = {}) {
  const key = apiKey();
  if (!key) throw new GeminiError('Gemini não configurado no ambiente', 'GEMINI_NOT_CONFIGURED');
  if (typeof executeTool !== 'function') throw new GeminiError('Executor de ferramentas ausente', 'TOOL_EXECUTOR_REQUIRED');
  const model = modelName();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contents = [...normalizedHistory(history), { role: 'user', parts: [{ text: String(userText || '').slice(0, 4000) }] }];
  const traces = [];

  for (let step = 0; step < maxSteps; step += 1) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: String(systemInstruction || '').slice(0, 12000) }] },
          contents,
          tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
          toolConfig: tools.length ? { functionCallingConfig: { mode: 'AUTO' } } : undefined,
          generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new GeminiError(`Falha de conexão com Gemini: ${error.message}`, 'GEMINI_NETWORK_ERROR');
    }

    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (!response.ok) {
      const message = String(payload?.error?.message || `HTTP ${response.status}`).slice(0, 500);
      throw new GeminiError(`Gemini indisponível: ${message}`, 'GEMINI_HTTP_ERROR');
    }

    const content = payload?.candidates?.[0]?.content;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const calls = parts.filter(part => part.functionCall?.name);
    if (!calls.length) {
      const text = responseText(parts);
      if (!text) throw new GeminiError('Gemini não retornou resposta utilizável', 'GEMINI_EMPTY_RESPONSE');
      return { text: text.slice(0, 4000), model, traces };
    }

    contents.push({ role: 'model', parts: safeJson(parts) });
    const functionResponses = [];
    for (const part of calls) {
      const name = String(part.functionCall.name || '').slice(0, 80);
      const args = part.functionCall.args && typeof part.functionCall.args === 'object' ? safeJson(part.functionCall.args) : {};
      let result;
      try {
        result = await executeTool(name, args);
        traces.push({ name, ok: true });
      } catch (error) {
        result = { ok: false, error: String(error?.message || 'Falha na ferramenta').slice(0, 500), code: error?.code || 'TOOL_ERROR' };
        traces.push({ name, ok: false, code: result.code });
      }
      functionResponses.push({ functionResponse: { name, response: safeJson(result) } });
    }
    contents.push({ role: 'user', parts: functionResponses });
  }

  throw new GeminiError('Limite de etapas de ferramentas atingido', 'GEMINI_TOOL_LIMIT');
}

export function configuredGeminiModel() {
  return { configured: Boolean(apiKey()), model: modelName() };
}
