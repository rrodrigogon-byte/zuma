// ============================================================================
// PROVEDOR DE WHATSAPP — mesmo backend usado pelo NossaGente
// (chatbot-backend NestJS multi-instância, pareamento por QR estilo WhatsApp
// Web). Contrato: {BASE}/api/v1/whats-app/instances/{instância}/{status|qr|...}
//
// Variáveis de ambiente (o segredo NUNCA vai para o banco nem para a tela):
//   WHATSAPP_PROVIDER=chatbot_backend      liga este provedor (padrão: evolution)
//   CHATBOT_BACKEND_URL                    URL do backend (padrão: Cloud Run us-east1)
//   CHATBOT_BACKEND_API_BASE               prefixo (padrão: /api/v1/whats-app)
//   CHATBOT_BACKEND_KEY                    chave de API do backend
//   CHATBOT_BACKEND_INSTANCE               instância padrão (padrão: dino-1)
//   CHATBOT_BACKEND_SEND_PATH              rota de envio opcional, ex.: /instances/{instance}/messages/text
//
// A instância precisa constar em WHATSAPP_INSTANCE_NAMES do backend (lista
// fail-closed). Rotas destrutivas (reset de sessão) não são chamadas daqui.
// ============================================================================

export const DEFAULT_CHATBOT_BACKEND_URL = 'https://chatbot-backend-nestjs-wre7dlumya-ue.a.run.app';
export const DEFAULT_API_BASE = '/api/v1/whats-app';
export const DEFAULT_INSTANCE = 'dino-1';
const TIMEOUT_MS = 20000;

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export function whatsappProviderName() {
  const value = clean(process.env.WHATSAPP_PROVIDER, 40).toLowerCase().replace(/[-\s]/g, '_');
  if (['chatbot_backend', 'nossagente', 'chatbot'].includes(value)) return 'chatbot_backend';
  return 'evolution';
}

export function chatbotBackendConfig(overrides = {}) {
  const baseUrl = clean(overrides.baseUrl || process.env.CHATBOT_BACKEND_URL || DEFAULT_CHATBOT_BACKEND_URL, 1000).replace(/\/+$/, '');
  const apiBase = `/${clean(overrides.apiBase || process.env.CHATBOT_BACKEND_API_BASE || DEFAULT_API_BASE, 200).replace(/^\/+|\/+$/g, '')}`;
  return {
    baseUrl,
    apiBase,
    key: clean(process.env.CHATBOT_BACKEND_KEY, 1000),
    instance: validInstance(overrides.instance || process.env.CHATBOT_BACKEND_INSTANCE || DEFAULT_INSTANCE),
    sendPath: clean(process.env.CHATBOT_BACKEND_SEND_PATH, 300),
  };
}

export function validInstance(value) {
  const instance = clean(value, 100).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,63}$/.test(instance) ? instance : '';
}

/** Provedor pronto para enviar mensagens (sem checar conexão ao vivo). */
export function whatsappProviderConfigured() {
  if (whatsappProviderName() === 'chatbot_backend') {
    const cfg = chatbotBackendConfig();
    return Boolean(cfg.baseUrl && cfg.key && cfg.instance);
  }
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

export function providerSummary() {
  const provider = whatsappProviderName();
  if (provider === 'chatbot_backend') {
    const cfg = chatbotBackendConfig();
    return { provider, label: 'Backend WhatsApp NossaGente', baseUrl: cfg.baseUrl, apiBase: cfg.apiBase, instance: cfg.instance, keyConfigured: Boolean(cfg.key), configured: whatsappProviderConfigured() };
  }
  return { provider, label: 'Evolution API', baseUrl: clean(process.env.EVOLUTION_API_URL, 300), instance: clean(process.env.EVOLUTION_INSTANCE, 100), keyConfigured: Boolean(process.env.EVOLUTION_API_KEY), configured: whatsappProviderConfigured() };
}

function authHeaders(key) {
  return key ? { authorization: `Bearer ${key}`, apikey: key, 'x-api-key': key } : {};
}

export function isAuthError(status) {
  return status === 401 || status === 403;
}

async function call(cfg, method, path, body, fetchImpl = globalThis.fetch) {
  const url = `${cfg.baseUrl}${cfg.apiBase}${path}`;
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...authHeaders(cfg.key) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: null, data: {}, error: String(error?.name || 'NETWORK_ERROR').slice(0, 80) };
  }
}

/** Normaliza o estado da sessão para open | connecting | qr | close | unknown. */
export function normalizeState(data = {}) {
  const candidates = [
    data.state, data.status, data.connection, data.connectionState,
    data.instance?.state, data.instance?.status, data.data?.state, data.data?.status, data.session?.status,
  ].map((value) => clean(value, 60).toLowerCase()).filter(Boolean);
  const value = candidates[0] || (data.connected === true ? 'open' : data.connected === false ? 'close' : '');
  if (['open', 'connected', 'online', 'ready', 'authenticated', 'inchat', 'islogged', 'conectado'].includes(value)) return 'open';
  if (['connecting', 'starting', 'opening', 'initializing', 'pairing', 'syncing', 'conectando'].includes(value)) return 'connecting';
  if (['qr', 'qrcode', 'qr_code', 'waiting_qr', 'notlogged', 'scan_qr', 'desconectado_qr'].includes(value)) return 'qr';
  if (['close', 'closed', 'disconnected', 'offline', 'logout', 'logged_out', 'desconectado', 'failed'].includes(value)) return 'close';
  return value ? 'unknown' : 'unknown';
}

/** Extrai QR (data URL base64) e código de pareamento de respostas variadas. */
export function extractQr(data = {}) {
  const pick = (...values) => values.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) || '';
  let qr = pick(data.base64, data.qr, data.qrcode, data.qrCode, data.qr_code, data.image, data.data?.base64, data.data?.qr, data.data?.qrcode, data.data?.qrCode, data.qrcode?.base64, data.instance?.qrcode);
  const pairingCode = pick(data.pairingCode, data.pairing_code, data.code, data.data?.pairingCode, data.data?.code);
  if (qr && !qr.startsWith('data:image') && /^[A-Za-z0-9+/=]{200,}$/.test(qr)) qr = `data:image/png;base64,${qr}`;
  // Conteúdo cru do QR (ex.: "2@abc,...") precisa ser desenhado no servidor.
  const raw = qr && !qr.startsWith('data:image') ? qr : '';
  return { qrImage: qr.startsWith('data:image') ? qr : '', qrRaw: raw, pairingCode: /^[A-Z0-9-]{4,16}$/i.test(pairingCode) ? pairingCode : '' };
}

export async function listInstances(fetchImpl) {
  const cfg = chatbotBackendConfig();
  const result = await call(cfg, 'GET', '/instances', null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, items: [] };
  const list = Array.isArray(result.data) ? result.data : (result.data?.instances || result.data?.items || []);
  return { ok: result.ok, status: result.status, items: list.map((item) => (typeof item === 'string' ? { name: item } : { name: clean(item.name || item.instance || item.id, 100), state: normalizeState(item) })) };
}

export async function getInstanceStatus(instance, fetchImpl) {
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, state: 'unknown', error: 'invalid_instance' };
  const result = await call(cfg, 'GET', `/instances/${encodeURIComponent(cfg.instance)}/status`, null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, state: 'unknown' };
  if (result.status === 404) return { ok: false, status: 404, state: 'unknown', error: 'instance_not_enabled' };
  if (!result.ok) return { ok: false, status: result.status, state: 'unknown', error: result.error || 'status_unavailable' };
  const qr = extractQr(result.data);
  return {
    ok: true,
    status: result.status,
    state: normalizeState(result.data),
    phone: clean(result.data?.phone || result.data?.number || result.data?.me?.id || result.data?.user?.id || '', 40).replace(/@.*$/, '').replace(/:\d+$/, ''),
    ...qr,
  };
}

/** Pede QR / (re)conexão da instância. Não apaga a sessão salva. */
export async function requestInstanceQr(instance, fetchImpl) {
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, error: 'invalid_instance' };
  let result = await call(cfg, 'GET', `/instances/${encodeURIComponent(cfg.instance)}/qr`, null, fetchImpl);
  if (result.status === 404 || result.status === 405) result = await call(cfg, 'POST', `/instances/${encodeURIComponent(cfg.instance)}/qr`, {}, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
  if (!result.ok) return { ok: false, status: result.status, error: result.status === 404 ? 'instance_not_enabled' : (result.error || 'qr_unavailable') };
  return { ok: true, status: result.status, state: normalizeState(result.data), ...extractQr(result.data) };
}

/** Encerra o socket sem apagar credenciais (logout não destrutivo). */
export async function disconnectInstance(instance, fetchImpl) {
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, error: 'invalid_instance' };
  const base = `/instances/${encodeURIComponent(cfg.instance)}`;
  let result = await call(cfg, 'POST', `${base}/session/logout`, {}, fetchImpl);
  if (result.status === 404 || result.status === 405) result = await call(cfg, 'DELETE', `${base}/session`, null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
  return { ok: result.ok, status: result.status, error: result.ok ? null : (result.error || 'logout_failed') };
}

function sendPaths(cfg) {
  const instance = encodeURIComponent(cfg.instance);
  const custom = cfg.sendPath ? [cfg.sendPath.replace('{instance}', instance)] : [];
  return [...custom, `/instances/${instance}/messages/text`, `/instances/${instance}/send-text`, `/instances/${instance}/send`];
}

/**
 * Envia texto. Só tenta a próxima rota quando a anterior NÃO existe (404/405):
 * qualquer outra resposta encerra (evita envio duplicado).
 */
export async function sendTextViaChatbotBackend({ instance, number, text }, fetchImpl) {
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.key) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_KEY_MISSING', data: {} };
  if (!cfg.instance) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INVALID_INSTANCE', data: {} };
  const body = { number, to: number, phone: number, text, message: text };
  let last = null;
  for (const path of sendPaths(cfg)) {
    const result = await call({ ...cfg, apiBase: path.startsWith('/api/') ? '' : cfg.apiBase }, 'POST', path, body, fetchImpl);
    last = result;
    if (result.status === 404 || result.status === 405) continue;
    const uncertain = result.status === null || (!result.ok && (result.status === 408 || result.status >= 500));
    return {
      ok: result.ok,
      status: result.status,
      retryable: !result.ok && !uncertain && (result.status === 425 || result.status === 429),
      uncertain,
      authError: isAuthError(result.status),
      error: result.ok ? undefined : (result.error || `HTTP_${result.status}`),
      data: result.data,
    };
  }
  return { ok: false, status: last?.status ?? 404, retryable: false, uncertain: false, error: 'SEND_ROUTE_NOT_FOUND', data: {} };
}

/** Tenta registrar o webhook de entrada no backend (se a rota existir). */
export async function registerInstanceWebhook({ instance, url, headers = {} }, fetchImpl) {
  const cfg = chatbotBackendConfig({ instance });
  const base = `/instances/${encodeURIComponent(cfg.instance)}`;
  const body = { url, enabled: true, headers, events: ['messages.upsert', 'connection.update'] };
  let result = await call(cfg, 'PUT', `${base}/webhook`, body, fetchImpl);
  if (result.status === 404 || result.status === 405) result = await call(cfg, 'POST', `${base}/webhook`, body, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
  if (result.status === 404 || result.status === 405) return { ok: false, unsupported: true, status: result.status };
  return { ok: result.ok, status: result.status };
}
