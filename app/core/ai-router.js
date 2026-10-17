// Roteador de IAs do cérebro do atendente.
// Cada tarefa tem uma cadeia de provedores (principal → reservas). Se um provedor não
// está configurado, falha ou estoura o tempo, o próximo assume. Toda chamada é registrada
// (provedor, modelo, latência, custo estimado, se foi reserva) e há um teto diário de gasto.
// Chaves e modelos vêm só do ambiente (Secret Manager); nada é impresso em log.

import { db } from './database.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TIMEOUT_MS = Math.min(60000, Math.max(3000, Number.parseInt(process.env.AI_ROUTER_TIMEOUT_MS || '25000', 10) || 25000));

export class AiRouterError extends Error {
  constructor(message, code = 'AI_ROUTER_ERROR', { retryable = true, attempts = [] } = {}) {
    super(message);
    this.name = 'AiRouterError';
    this.code = code;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

export const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    keyEnv: ['GEMINI_API_KEY'],
    models: { fast: ['AI_MODEL_GEMINI_FAST', 'gemini-2.5-flash'], smart: ['AI_MODEL_GEMINI_SMART', 'gemini-2.5-pro'] },
  },
  anthropic: {
    label: 'Claude',
    keyEnv: ['ANTHROPIC_API_KEY'],
    models: { fast: ['AI_MODEL_ANTHROPIC_FAST', 'claude-haiku-4-5-20251001'], smart: ['AI_MODEL_ANTHROPIC_SMART', 'claude-sonnet-5'] },
  },
  openai: {
    label: 'GPT',
    keyEnv: ['OPENAI_API_KEY'],
    models: { fast: ['AI_MODEL_OPENAI_FAST', 'gpt-4.1-mini'], smart: ['AI_MODEL_OPENAI_SMART', 'gpt-4.1'] },
  },
};

// Centavos de real por 1.000 caracteres (entrada, saída). Estimativa grosseira e ajustável
// por AI_COST_<PROVEDOR>_<TIER>="entrada,saida"; serve para o teto diário, não para faturar.
const DEFAULT_COST = {
  'gemini:fast': [0.05, 0.2], 'gemini:smart': [0.4, 1.6],
  'anthropic:fast': [0.15, 0.75], 'anthropic:smart': [0.45, 2.2],
  'openai:fast': [0.06, 0.25], 'openai:smart': [0.3, 1.2],
};

// Tarefa → cadeia de provedores. "responder_*" usa ferramentas; o resto é texto/JSON.
export const AI_ROUTES = {
  classificar: ['gemini:fast', 'openai:fast', 'anthropic:fast'],
  resumir_extrair: ['anthropic:smart', 'openai:smart', 'gemini:smart'],
  propor_resposta: ['anthropic:smart', 'gemini:smart', 'openai:smart'],
  avaliar: ['openai:smart', 'anthropic:smart', 'gemini:smart'],
  venda_consultiva: ['anthropic:smart', 'gemini:smart', 'openai:smart'],
  responder_reserva: ['anthropic:smart', 'openai:smart'],
};

export const AI_TASK_LABELS = {
  classificar: 'Classificar intenção e urgência',
  resumir_extrair: 'Resumir conversa e extrair fatos',
  propor_resposta: 'Propor respostas para perguntas novas',
  avaliar: 'Avaliar conversas (IA juíza)',
  venda_consultiva: 'Venda consultiva de perfume',
  responder_reserva: 'Atender quando o Gemini cair',
};

function env(name) { return String(process.env[name] || '').trim(); }

// Permite gateway/proxy corporativo (ou servidor falso nos testes) sem mudar código.
function baseUrl(provider) {
  const defaults = { gemini: 'https://generativelanguage.googleapis.com', anthropic: 'https://api.anthropic.com', openai: 'https://api.openai.com' };
  const custom = env(`AI_${provider.toUpperCase()}_BASE_URL`);
  return (/^https?:\/\//.test(custom) ? custom : defaults[provider]).replace(/\/+$/, '');
}

// Claude pelo Vertex AI (Google Cloud): sem chave da Anthropic, autentica com a conta de
// serviço do GCP. Ativa com ANTHROPIC_VERTEX_PROJECT_ID; região em ANTHROPIC_VERTEX_REGION
// (padrão "global"); credencial em GOOGLE_APPLICATION_CREDENTIALS_JSON (JSON da conta de
// serviço) ou nas credenciais padrão do ambiente (GOOGLE_APPLICATION_CREDENTIALS).
export const VERTEX_KEY = 'vertex';
const VERTEX_DEFAULT_MODELS = { fast: 'claude-haiku-4-5@20251001', smart: 'claude-sonnet-4-5@20250929' };

export function anthropicVertexConfig() {
  const projectId = env('ANTHROPIC_VERTEX_PROJECT_ID');
  if (!projectId || env('ANTHROPIC_API_KEY')) return null;
  const region = env('ANTHROPIC_VERTEX_REGION') || env('CLOUD_ML_REGION') || 'global';
  return { projectId, region };
}

export function anthropicVertexUrl(model, config = anthropicVertexConfig()) {
  const host = config.region === 'global' ? 'aiplatform.googleapis.com' : `${config.region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.region)}/publishers/anthropic/models/${encodeURIComponent(model)}:rawPredict`;
}

let vertexAuthClient = null;
async function vertexAccessToken() {
  if (!vertexAuthClient) {
    const { GoogleAuth } = await import('google-auth-library');
    const inline = env('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    let credentials;
    if (inline) {
      try { credentials = JSON.parse(inline); } catch { throw new AiRouterError('Credencial do Vertex inválida', 'VERTEX_CREDENTIALS_INVALID', { retryable: false }); }
    }
    vertexAuthClient = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  }
  try {
    const token = await vertexAuthClient.getAccessToken();
    const value = typeof token === 'string' ? token : token?.token;
    if (!value) throw new Error('sem token');
    return value;
  } catch (error) {
    if (error instanceof AiRouterError) throw error;
    throw new AiRouterError('Não foi possível autenticar no Vertex AI', 'VERTEX_AUTH_FAILED', { retryable: true });
  }
}

/** Mesma chamada Messages API da Anthropic, pela API direta ou pelo Vertex AI. */
async function anthropicMessages({ key, model, body, fetchImpl, timeoutMs, accessToken = vertexAccessToken }) {
  if (key === VERTEX_KEY) {
    const token = await accessToken();
    return postJson(fetchImpl, anthropicVertexUrl(model), { authorization: `Bearer ${token}` }, { anthropic_version: 'vertex-2023-10-16', ...body }, timeoutMs, 'anthropic');
  }
  return postJson(fetchImpl, `${baseUrl('anthropic')}/v1/messages`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, ...body }, timeoutMs, 'anthropic');
}

export function providerKey(provider) {
  const spec = PROVIDERS[provider];
  if (!spec) return '';
  for (const name of spec.keyEnv) { const value = env(name); if (value) return value; }
  if (provider === 'anthropic' && anthropicVertexConfig()) return VERTEX_KEY;
  return '';
}

export function providerConfigured(provider) { return Boolean(providerKey(provider)); }

export function modelFor(provider, tier = 'fast') {
  const spec = PROVIDERS[provider]?.models?.[tier] || PROVIDERS[provider]?.models?.fast;
  if (!spec) return '';
  // No Vertex os IDs de modelo têm outro formato (ex.: claude-sonnet-4-5@20250929).
  if (provider === 'anthropic' && anthropicVertexConfig()) return env(spec[0]) || VERTEX_DEFAULT_MODELS[tier] || VERTEX_DEFAULT_MODELS.fast;
  return env(spec[0]) || spec[1];
}

export function routeFor(task) {
  const override = env(`AI_ROUTE_${String(task).toUpperCase()}`);
  const chain = override ? override.split(',').map((item) => item.trim()).filter(Boolean) : (AI_ROUTES[task] || AI_ROUTES.classificar);
  return chain
    .map((item) => { const [provider, tier = 'fast'] = item.split(':'); return { provider, tier: tier === 'smart' ? 'smart' : 'fast' }; })
    .filter((step) => PROVIDERS[step.provider]);
}

export function estimateCostCents(provider, tier, inputChars = 0, outputChars = 0) {
  const custom = env(`AI_COST_${provider.toUpperCase()}_${tier.toUpperCase()}`);
  const [inRate, outRate] = custom ? custom.split(',').map(Number) : (DEFAULT_COST[`${provider}:${tier}`] || [0.3, 1.2]);
  const value = ((Number(inputChars) || 0) / 1000) * (Number(inRate) || 0) + ((Number(outputChars) || 0) / 1000) * (Number(outRate) || 0);
  return Math.round(value * 10000) / 10000;
}

/** Situação dos provedores sem expor chaves (só "configurado" e o modelo). */
export function routerStatus() {
  return {
    providers: Object.entries(PROVIDERS).map(([id, spec]) => ({
      id, label: id === 'anthropic' && providerKey(id) === VERTEX_KEY ? 'Claude (Vertex AI)' : spec.label,
      configured: providerConfigured(id), models: { fast: modelFor(id, 'fast'), smart: modelFor(id, 'smart') },
    })),
    routes: Object.keys(AI_ROUTES).map((task) => ({ task, label: AI_TASK_LABELS[task] || task, chain: routeFor(task).map((s) => `${s.provider}:${s.tier}`) })),
  };
}

export function parseJsonLoose(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(raw); } catch { /* tenta o primeiro objeto */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; } }
  return null;
}

function httpError(provider, status, retryable) {
  const code = status === 429 ? 'RATE_LIMITED' : status === 401 || status === 403 ? 'AUTH_FAILED' : status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED';
  return new AiRouterError(`${PROVIDERS[provider]?.label || provider} respondeu HTTP ${status}`, `${provider.toUpperCase()}_${code}`, { retryable });
}

async function postJson(fetchImpl, url, headers, body, timeoutMs, provider) {
  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new AiRouterError(`${PROVIDERS[provider]?.label || provider} fora do ar`, `${provider.toUpperCase()}_NETWORK`, { retryable: true });
  }
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
  if (!response.ok) throw httpError(provider, response.status, response.status === 429 || response.status >= 500);
  return payload;
}

/**
 * Orçamento de raciocínio ("thinking") da família Gemini 2.5. Os tokens de raciocínio
 * contam dentro de maxOutputTokens: no 2.5 Pro (raciocínio obrigatório, mínimo 128) um
 * teto de 900 era consumido inteiro pelo raciocínio e a resposta voltava vazia, o que
 * derrubava o resumo noturno do cérebro para a heurística. Pro: orçamento fixo e somado
 * ao teto; Flash/Flash-Lite: raciocínio desligado. Outros modelos seguem o padrão da API.
 */
export function geminiThinking(model) {
  const name = String(model || '').toLowerCase();
  if (!name.startsWith('gemini-2.5')) return { config: null, extraTokens: 0 };
  if (name.includes('pro')) return { config: { thinkingBudget: 256 }, extraTokens: 256 };
  return { config: { thinkingBudget: 0 }, extraTokens: 0 };
}

async function callGemini({ key, model, system, user, json, maxTokens, fetchImpl, timeoutMs }) {
  const thinking = geminiThinking(model);
  const payload = await postJson(fetchImpl, `${baseUrl('gemini')}/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens + thinking.extraTokens,
      ...(thinking.config ? { thinkingConfig: thinking.config } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  }, timeoutMs, 'gemini');
  if (payload?.promptFeedback?.blockReason) throw new AiRouterError('Gemini bloqueou por política', 'GEMINI_BLOCKED', { retryable: false });
  const candidate = payload?.candidates?.[0] || {};
  const text = (candidate.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('').trim();
  // Resposta cortada pelo teto não vira JSON válido: registra o motivo real em vez de "JSON inválido".
  if (candidate.finishReason === 'MAX_TOKENS' && json) throw new AiRouterError('Gemini atingiu o limite de saída', 'GEMINI_MAX_TOKENS', { retryable: true });
  return text;
}

async function callAnthropic({ key, model, system, user, maxTokens, fetchImpl, timeoutMs }) {
  const payload = await anthropicMessages({ key, model, fetchImpl, timeoutMs, body: {
    max_tokens: maxTokens, system: system || undefined, temperature: 0.2,
    messages: [{ role: 'user', content: user }],
  } });
  return (payload?.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('').trim();
}

async function callOpenAi({ key, model, system, user, json, maxTokens, fetchImpl, timeoutMs }) {
  const payload = await postJson(fetchImpl, `${baseUrl('openai')}/v1/chat/completions`, { authorization: `Bearer ${key}` }, {
    model, max_completion_tokens: maxTokens,
    messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  }, timeoutMs, 'openai');
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

const CALLERS = { gemini: callGemini, anthropic: callAnthropic, openai: callOpenAi };

export async function recordRouterRun(run) {
  if (!UUID.test(String(run.empresaId || ''))) return;
  try {
    await db.query(
      `INSERT INTO ai_router_runs (empresa_id, tarefa, provedor, modelo, status, fallback, latencia_ms, input_chars, output_chars, custo_centavos, erro_codigo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [run.empresaId, run.task, run.provider, run.model || null, run.status, Boolean(run.fallback), Math.max(0, Math.round(run.latencyMs || 0)),
        Math.max(0, run.inputChars || 0), Math.max(0, run.outputChars || 0), Math.max(0, run.costCents || 0), run.errorCode || null],
    );
  } catch (error) {
    if (error?.code !== '42P01') console.warn('[AI Router] registro de execução falhou:', String(error?.code || 'erro'));
  }
}

export async function spentTodayCents(empresaId) {
  if (!UUID.test(String(empresaId || ''))) return 0;
  try {
    const result = await db.queryRead(
      `SELECT COALESCE(SUM(custo_centavos), 0)::float AS total FROM ai_router_runs
        WHERE empresa_id = $1 AND criado_em >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Cuiaba') AT TIME ZONE 'America/Cuiaba'`,
      [empresaId],
    );
    return Number(result.rows[0]?.total || 0);
  } catch (error) {
    // Sem a tabela o cérebro nem liga; qualquer outra falha bloqueia gasto (fecha em segurança).
    return error?.code === '42P01' ? 0 : Number.POSITIVE_INFINITY;
  }
}

/**
 * Executa uma tarefa de texto/JSON na cadeia de provedores.
 * @returns {{ text, data, provider, model, tier, fallback, attempts }}
 */
export async function runAiTask(task, {
  system = '', user = '', json = false, maxTokens = 900, empresaId = null, exclude = [],
  fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, recorder = recordRouterRun,
  capCents = null, spentToday = spentTodayCents,
} = {}) {
  const chain = routeFor(task).filter((step) => !exclude.includes(step.provider));
  const attempts = [];
  if (capCents !== null && capCents !== undefined) {
    const spent = await spentToday(empresaId);
    if (spent >= Number(capCents)) {
      await recorder({ empresaId, task, provider: chain[0]?.provider || 'nenhum', status: 'skipped', errorCode: 'BUDGET_EXCEEDED' });
      throw new AiRouterError('Teto diário de gasto com IA atingido', 'BUDGET_EXCEEDED', { retryable: false, attempts });
    }
  }
  const userText = String(user || '').slice(0, 24000);
  const systemText = String(system || '').slice(0, 12000);
  let index = 0;
  for (const step of chain) {
    const key = providerKey(step.provider);
    const model = modelFor(step.provider, step.tier);
    if (!key) { attempts.push({ provider: step.provider, status: 'not_configured' }); continue; }
    const started = Date.now();
    try {
      const text = await CALLERS[step.provider]({ key, model, system: systemText, user: userText, json, maxTokens, fetchImpl, timeoutMs });
      if (!text) throw new AiRouterError('Resposta vazia', `${step.provider.toUpperCase()}_EMPTY`, { retryable: true });
      const data = json ? parseJsonLoose(text) : null;
      if (json && !data) throw new AiRouterError('JSON inválido', `${step.provider.toUpperCase()}_BAD_JSON`, { retryable: true });
      const inputChars = userText.length + systemText.length;
      const fallback = index > 0 || attempts.length > 0;
      await recorder({ empresaId, task, provider: step.provider, model, status: 'success', fallback, latencyMs: Date.now() - started, inputChars, outputChars: text.length, costCents: estimateCostCents(step.provider, step.tier, inputChars, text.length) });
      attempts.push({ provider: step.provider, status: 'success' });
      return { text, data, provider: step.provider, model, tier: step.tier, fallback, attempts };
    } catch (error) {
      const code = String(error?.code || 'AI_ERROR').slice(0, 80);
      attempts.push({ provider: step.provider, status: 'failed', code });
      await recorder({ empresaId, task, provider: step.provider, model, status: 'failed', fallback: index > 0, latencyMs: Date.now() - started, errorCode: code });
    }
    index += 1;
  }
  const configured = attempts.some((item) => item.status !== 'not_configured');
  throw new AiRouterError(configured ? 'Todas as IAs da cadeia falharam' : 'Nenhuma IA configurada para esta tarefa', configured ? 'ALL_PROVIDERS_FAILED' : 'NO_PROVIDER_CONFIGURED', { retryable: configured, attempts });
}

// ── Reserva do atendimento: Claude com as mesmas ferramentas do Gemini ─────────

function toJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') out.type = value.toLowerCase();
    else out[key] = toJsonSchema(value);
  }
  return out;
}

export function anthropicToolsFromDeclarations(declarations = []) {
  return declarations.map((item) => ({
    name: item.name,
    description: String(item.description || '').slice(0, 1000),
    input_schema: toJsonSchema(item.parameters || { type: 'OBJECT', properties: {} }),
  }));
}

/** Mesmo contrato de runGeminiWithTools: { text, model, traces, metrics }. */
export async function runAnthropicWithTools({
  systemInstruction = '', history = [], userText = '', tools = [], executeTool,
  fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, maxSteps = 4, tier = 'smart', accessToken = vertexAccessToken,
} = {}) {
  const key = providerKey('anthropic');
  if (!key) throw new AiRouterError('Claude não configurado', 'ANTHROPIC_NOT_CONFIGURED', { retryable: false });
  if (typeof executeTool !== 'function') throw new AiRouterError('Executor de ferramentas ausente', 'TOOL_EXECUTOR_REQUIRED', { retryable: false });
  const model = modelFor('anthropic', tier);
  const messages = [];
  for (const item of history.slice(-16)) {
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    const text = String(item.text || '').slice(0, 4000);
    if (!text) continue;
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += `\n${text}`;
    else messages.push({ role, content: text });
  }
  if (messages[0]?.role === 'assistant') messages.shift();
  if (messages.length && messages[messages.length - 1].role === 'user') messages[messages.length - 1].content += `\n${String(userText).slice(0, 4000)}`;
  else messages.push({ role: 'user', content: String(userText).slice(0, 4000) });
  const anthropicTools = anthropicToolsFromDeclarations(tools);
  const traces = [];
  const started = Date.now();
  const inputChars = String(systemInstruction).length + messages.reduce((sum, m) => sum + String(m.content).length, 0);
  for (let step = 0; step < maxSteps; step += 1) {
    const payload = await anthropicMessages({ key, model, fetchImpl, timeoutMs, accessToken, body: {
      // Instruções inteiras (calendário e agenda vão no meio do prompt) e menos variação.
      max_tokens: 900, temperature: 0.2, system: String(systemInstruction).slice(0, 24000),
      tools: anthropicTools.length ? anthropicTools : undefined, messages,
    } });
    const content = Array.isArray(payload?.content) ? payload.content : [];
    const calls = content.filter((part) => part.type === 'tool_use');
    if (!calls.length) {
      const text = content.filter((part) => part.type === 'text').map((part) => part.text).join('').trim();
      if (!text) throw new AiRouterError('Claude não retornou resposta', 'ANTHROPIC_EMPTY', { retryable: false });
      return { text: text.slice(0, 4000), model, provider: 'anthropic', traces, metrics: { latencyMs: Date.now() - started, inputChars, outputChars: text.length, toolCalls: traces.length } };
    }
    messages.push({ role: 'assistant', content });
    const results = [];
    for (const call of calls) {
      const name = String(call.name || '').slice(0, 80);
      let result;
      try {
        result = await executeTool(name, call.input && typeof call.input === 'object' ? call.input : {});
        traces.push({ name, ok: true });
      } catch (error) {
        result = { ok: false, error: String(error?.message || 'Falha na ferramenta').slice(0, 500), code: error?.code || 'TOOL_ERROR' };
        traces.push({ name, ok: false, code: result.code });
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result ?? {}).slice(0, 12000) });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new AiRouterError('Limite de etapas de ferramentas atingido', 'ANTHROPIC_TOOL_LIMIT', { retryable: false });
}
