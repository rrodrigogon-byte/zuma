import { config } from '../config.js';

const DEFAULT_TIMEOUT_MS = 20000;
// 6 passos: listar serviço → próximos horários → preparar cabe numa resposta só.
const DEFAULT_MAX_STEPS = Math.min(8, Math.max(3, Number.parseInt(process.env.GEMINI_MAX_TOOL_STEPS || '6', 10) || 6));
const DEFAULT_MAX_HISTORY_CHARS = Math.min(32000, Math.max(4000, Number.parseInt(process.env.WHATSAPP_AI_HISTORY_MAX_CHARS || '16000', 10)));
const DEFAULT_REQUEST_ATTEMPTS = Math.min(3, Math.max(1, Number.parseInt(process.env.GEMINI_REQUEST_ATTEMPTS || '2', 10)));

export class GeminiError extends Error {
  constructor(message, code = 'GEMINI_ERROR', { status = null, retryable = false } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function modelName() {
  return String(process.env.GEMINI_MODEL || config.integrations?.gemini?.model || 'gemini-2.5-flash').trim();
}

function apiKey() {
  return String(config.integrations?.gemini?.apiKey || process.env.GEMINI_API_KEY || '').trim();
}

export function normalizedGeminiHistory(history = [], maxChars = DEFAULT_MAX_HISTORY_CHARS) {
  const safeBudget = Math.min(32000, Math.max(4000, Number(maxChars) || DEFAULT_MAX_HISTORY_CHARS));
  const selected = [];
  let consumed = 0;
  for (const item of history.slice(-32).reverse()) {
    const text = String(item?.text || '').slice(0, 4000);
    if (!text) continue;
    const remaining = safeBudget - consumed;
    if (remaining <= 0) break;
    selected.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: text.slice(Math.max(0, text.length - remaining)) }],
    });
    consumed += Math.min(text.length, remaining);
  }
  return selected.reverse();
}

function responseText(parts = []) {
  return parts.filter(part => typeof part.text === 'string').map(part => part.text).join('\n').trim();
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function inputCharacters(contents = [], systemInstruction = '') {
  return String(systemInstruction || '').length + contents.reduce((total, content) => total + (content.parts || []).reduce((sum, part) => {
    if (typeof part.text === 'string') return sum + part.text.length;
    return sum + JSON.stringify(part.functionResponse || part.functionCall || {}).length;
  }, 0), 0);
}

function geminiHttpError(response, payload = {}) {
  const status = Number(response?.status || 0);
  const message = String(payload?.error?.message || `HTTP ${status}`).replace(/[\r\n]+/g, ' ').slice(0, 500);
  if (status === 429) return new GeminiError(`Gemini temporariamente limitado: ${message}`, 'GEMINI_RATE_LIMIT', { status, retryable: true });
  if (status === 408 || status === 425 || status >= 500) return new GeminiError(`Gemini temporariamente indisponível: ${message}`, 'GEMINI_HTTP_TEMPORARY', { status, retryable: true });
  if (status === 401 || status === 403) return new GeminiError('Gemini recusou a credencial configurada', 'GEMINI_AUTH_ERROR', { status, retryable: false });
  return new GeminiError(`Gemini recusou a solicitação: ${message}`, 'GEMINI_HTTP_ERROR', { status, retryable: false });
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function geminiRequest(endpoint, request, { fetchImpl, timeoutMs, attempts = DEFAULT_REQUEST_ATTEMPTS } = {}) {
  let lastError;
  const safeAttempts = Math.min(3, Math.max(1, Number(attempts) || DEFAULT_REQUEST_ATTEMPTS));
  for (let attempt = 1; attempt <= safeAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, { ...request, signal: AbortSignal.timeout(timeoutMs) });
      const raw = await response.text();
      let payload;
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
      if (!response.ok) throw geminiHttpError(response, payload);
      return payload;
    } catch (error) {
      lastError = error instanceof GeminiError
        ? error
        : new GeminiError('Falha de conexão com Gemini', 'GEMINI_NETWORK_ERROR', { retryable: true });
      if (!lastError.retryable || attempt >= safeAttempts) throw lastError;
      await wait(Math.min(1000, 200 * (2 ** (attempt - 1))));
    }
  }
  throw lastError || new GeminiError('Gemini indisponível', 'GEMINI_ERROR');
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
  requestAttempts = DEFAULT_REQUEST_ATTEMPTS,
} = {}) {
  const key = apiKey();
  if (!key) throw new GeminiError('Gemini não configurado no ambiente', 'GEMINI_NOT_CONFIGURED', { retryable: false });
  if (typeof executeTool !== 'function') throw new GeminiError('Executor de ferramentas ausente', 'TOOL_EXECUTOR_REQUIRED', { retryable: false });
  const model = modelName();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const systemText = String(systemInstruction || '').slice(0, 12000);
  const contents = [...normalizedGeminiHistory(history), { role: 'user', parts: [{ text: String(userText || '').slice(0, 4000) }] }];
  const traces = [];
  const startedAt = Date.now();
  let outputChars = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const payload = await geminiRequest(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
        toolConfig: tools.length ? { functionCallingConfig: { mode: 'AUTO' } } : undefined,
        generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
      }),
    }, { fetchImpl, timeoutMs, attempts: requestAttempts });

    const blockReason = String(payload?.promptFeedback?.blockReason || '');
    if (blockReason) throw new GeminiError('Gemini bloqueou a solicitação por política de segurança', 'GEMINI_BLOCKED', { retryable: false });
    const candidate = payload?.candidates?.[0];
    if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(String(candidate?.finishReason || '').toUpperCase())) {
      throw new GeminiError('Gemini bloqueou a resposta por política de segurança', 'GEMINI_BLOCKED', { retryable: false });
    }
    const content = candidate?.content;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const calls = parts.filter(part => part.functionCall?.name);
    if (!calls.length) {
      const text = responseText(parts);
      if (!text) throw new GeminiError('Gemini não retornou resposta utilizável', 'GEMINI_EMPTY_RESPONSE', { retryable: false });
      outputChars += text.length;
      return {
        text: text.slice(0, 4000),
        model,
        traces,
        metrics: {
          latencyMs: Math.max(0, Date.now() - startedAt),
          inputChars: inputCharacters(contents, systemText),
          outputChars,
          toolCalls: traces.length,
        },
      };
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

  throw new GeminiError('Limite de etapas de ferramentas atingido', 'GEMINI_TOOL_LIMIT', { retryable: false });
}

export function configuredGeminiModel() {
  return { configured: Boolean(apiKey()), model: modelName() };
}
