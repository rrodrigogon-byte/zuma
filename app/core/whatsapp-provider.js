// ============================================================================
// PROVEDOR DE WHATSAPP — o MESMO backend e o MESMO contrato da Isa (NossaGente)
//
// A Isa conversa pelo chatbot-backend-nestjs (sessão WhatsApp Web pareada por
// QR) usando exatamente estas rotas (avd-uisa-permanente,
// server/integrations/whatsappApiClient.ts):
//   POST {BASE}/send      { chat_id, message, simulateTyping, delaySeconds, waitForReply:false }
//   GET  {BASE}/status    { authenticated, connecting }
//   GET  {BASE}/messages  ?latest=false&role=user&from=ISO&limit=N   (entrada por consulta)
// com o cabeçalho X-API-KEY. Não há webhook de mensagens: a entrada é por
// consulta periódica (core/whatsapp-isa-poll.js), como o worker da Isa.
//
// Variáveis de ambiente (o segredo NUNCA vai para o banco nem para a tela):
//   WHATSAPP_PROVIDER=chatbot_backend      liga este provedor (padrão: evolution)
//   CHATBOT_BACKEND_URL                    URL do backend DA DINO (obrigatória; sem padrão
//                                          para nunca falar com o número da Isa/UISA)
//   CHATBOT_BACKEND_API_BASE               prefixo (padrão: /api/v1/whats-app)
//   CHATBOT_BACKEND_KEY                    chave X-API-KEY (mínimo 20 caracteres, como na Isa)
//   CHATBOT_BACKEND_MODE                   isa (padrão) | instancias (rotas /instances/{inst}/...)
//   CHATBOT_BACKEND_INSTANCE               instância no modo "instancias" (padrão: dino-1)
//   WHATSAPP_SIMULATE_TYPING=true          liga o "digitando…" (a ponte da Isa envia false)
// ============================================================================

export const DEFAULT_API_BASE = '/api/v1/whats-app';
export const DEFAULT_INSTANCE = 'dino-1';
const TIMEOUT_MS = 20000;
// Limite de texto do contrato da Isa (assertMessage: 4000) e corte da ponte (3900).
export const MAX_MESSAGE_CHARS = 4000;
const CUT_AT = 3900;

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
let missingPhoneShapeLogged = false;
let resolvedPhoneLogged = false;

// Diagnóstico de contrato: nomes de campos e tipos, jamais valores, números ou
// segredos. Ajuda a localizar um possível campo "self" em versões do backend.
export function safeResponseFieldPaths(value) {
  const out = [];
  const walk = (node, prefix = '', depth = 0) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 3) return;
    for (const key of Object.keys(node).slice(0, 25)) {
      if (!/^[a-zA-Z_]{1,32}$/.test(key) || /token|secret|password|auth|key/i.test(key)) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const child = node[key];
      const type = Array.isArray(child) ? 'array' : typeof child;
      out.push(`${path}:${type}`);
      if (out.length >= 80) return;
      if (type === 'object') walk(child, path, depth + 1);
    }
  };
  walk(value);
  return out.slice(0, 80);
}

export function whatsappProviderName() {
  const value = clean(process.env.WHATSAPP_PROVIDER, 40).toLowerCase().replace(/[-\s]/g, '_');
  if (['chatbot_backend', 'nossagente', 'chatbot'].includes(value)) return 'chatbot_backend';
  return 'evolution';
}

export function chatbotBackendMode() {
  return clean(process.env.CHATBOT_BACKEND_MODE, 20).toLowerCase() === 'instancias' ? 'instancias' : 'isa';
}

export function chatbotBackendConfig(overrides = {}) {
  const baseUrl = clean(overrides.baseUrl || process.env.CHATBOT_BACKEND_URL || '', 1000).replace(/\/+$/, '');
  const apiBase = `/${clean(overrides.apiBase || process.env.CHATBOT_BACKEND_API_BASE || DEFAULT_API_BASE, 200).replace(/^\/+|\/+$/g, '')}`;
  return {
    baseUrl,
    apiBase,
    key: clean(process.env.CHATBOT_BACKEND_KEY, 1000),
    instance: validInstance(overrides.instance || process.env.CHATBOT_BACKEND_INSTANCE || DEFAULT_INSTANCE),
    sendPath: clean(process.env.CHATBOT_BACKEND_SEND_PATH, 300),
  };
}

// ----------------------------------------------------------------------------
// Instâncias liberadas no servidor e a empresa dona de cada uma.
//   CHATBOT_BACKEND_INSTANCES="dino=<uuid-da-empresa>,stallone-1=<uuid-da-empresa>"
//   WHATSAPP_LINE_VERIFIED_INSTANCES="dino,stallone-1"   (linhas já conferidas no aparelho)
// Sem CHATBOT_BACKEND_INSTANCES, vale o par antigo CHATBOT_BACKEND_INSTANCE +
// CHATBOT_BACKEND_EMPRESA_ID (e WHATSAPP_LINE_VERIFIED=1 para essa instância), então a
// Dino continua igual sem mudar nenhuma variável. Uma instância pertence a UMA empresa:
// entrada, saída e diagnóstico de uma empresa nunca usam a instância de outra.
// ----------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Atribuições feitas pela administração da plataforma no painel (Central WhatsApp)
// também registram a empresa dona da instância, sem exigir nova variável no
// Render. A fonte é injetada por whatsapp-conexao-kytto (evita import circular)
// e devolve [{ instance, owner, lineVerified }]. A variável de ambiente sempre
// prevalece; instância reivindicada por duas empresas fica sem dono.
let persistedRegistrySource = null;

export function setPersistedInstanceRegistrySource(source) {
  persistedRegistrySource = typeof source === 'function' ? source : null;
}

function persistedInstanceEntries() {
  if (!persistedRegistrySource) return [];
  try {
    const entries = persistedRegistrySource();
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function envInstanceRegistry(env = process.env) {
  const registry = new Map();
  const raw = clean(env.CHATBOT_BACKEND_INSTANCES, 4000);
  if (raw) {
    for (const part of raw.split(/[,;\s]+/)) {
      const [name, owner] = part.split(/[=:]/).map((item) => clean(item, 100));
      const instance = validInstance(name);
      if (!instance || !UUID_RE.test(owner || '')) continue;
      // Instância repetida com donos diferentes: ninguém fica com ela.
      if (registry.has(instance) && registry.get(instance) !== owner.toLowerCase()) { registry.set(instance, ''); continue; }
      registry.set(instance, owner.toLowerCase());
    }
    for (const [instance, owner] of [...registry]) if (!owner) registry.delete(instance);
    return registry;
  }
  const legacyOwner = clean(env.CHATBOT_BACKEND_EMPRESA_ID, 60).toLowerCase();
  const legacyInstance = validInstance(env.CHATBOT_BACKEND_INSTANCE || DEFAULT_INSTANCE);
  if (legacyInstance && UUID_RE.test(legacyOwner)) registry.set(legacyInstance, legacyOwner);
  return registry;
}

function persistedInstanceRegistry(envRegistry) {
  const persisted = new Map();
  for (const entry of persistedInstanceEntries()) {
    const instance = validInstance(entry?.instance);
    const owner = clean(entry?.owner, 60).toLowerCase();
    if (!instance || !UUID_RE.test(owner) || envRegistry.has(instance)) continue;
    if (persisted.has(instance) && persisted.get(instance).owner !== owner) { persisted.set(instance, null); continue; }
    persisted.set(instance, { owner, lineVerified: entry?.lineVerified === true });
  }
  for (const [instance, entry] of [...persisted]) if (!entry) persisted.delete(instance);
  return persisted;
}

export function instanceRegistry(env = process.env) {
  const registry = envInstanceRegistry(env);
  for (const [instance, entry] of persistedInstanceRegistry(registry)) registry.set(instance, entry.owner);
  return registry;
}

export function instanceOwner(instance, env = process.env) {
  return instanceRegistry(env).get(validInstance(instance)) || '';
}

/** Instâncias da empresa (normalmente uma). */
export function instancesOfCompany(empresaId, env = process.env) {
  const id = clean(empresaId, 60).toLowerCase();
  if (!id) return [];
  return [...instanceRegistry(env)].filter(([, owner]) => owner === id).map(([instance]) => instance);
}

export function instanceLineVerified(instance, env = process.env) {
  const resolved = validInstance(instance);
  if (!resolved) return false;
  const list = clean(env.WHATSAPP_LINE_VERIFIED_INSTANCES, 2000);
  const byEnv = list
    ? list.split(/[,;\s]+/).map((item) => validInstance(item)).includes(resolved)
    // Compatível: WHATSAPP_LINE_VERIFIED=1 vale só para a instância padrão do ambiente.
    : env.WHATSAPP_LINE_VERIFIED === '1' && resolved === validInstance(env.CHATBOT_BACKEND_INSTANCE || DEFAULT_INSTANCE);
  if (byEnv) return true;
  // Linha atribuída pela plataforma e já pareada por QR no aparelho da empresa.
  return persistedInstanceRegistry(envInstanceRegistry(env)).get(resolved)?.lineVerified === true;
}

/** A instância é de alguma empresa registrada (não pode ser usada por canal legado/global). */
// Guarda de último nível: a instância padrão do ambiente ou uma instância com empresa
// dona registrada. A verificação de QUAL empresa pode usar a linha fica no gate de saída
// (whatsapp-egress) e no vínculo canal↔instância da entrada.
function instanciaPermitida(instanceName, cfg) {
  return Boolean(instanceName && (instanceName === cfg.instance || isRegisteredInstance(instanceName)));
}

export function isRegisteredInstance(instance, env = process.env) {
  return Boolean(instanceOwner(instance, env));
}

export function validInstance(value) {
  const instance = clean(value, 100).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,63}$/.test(instance) ? instance : '';
}

/** Provedor pronto para enviar mensagens (sem checar conexão ao vivo). */
export function whatsappProviderConfigured() {
  if (whatsappProviderName() === 'chatbot_backend') {
    const cfg = chatbotBackendConfig();
    // Mesma regra da Isa: chave curta é recusada (evita placeholder em produção).
    const urlSegura = /^https:\/\//i.test(cfg.baseUrl) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(cfg.baseUrl);
    return Boolean(urlSegura && cfg.key.length >= 20 && (chatbotBackendMode() === 'isa' || cfg.instance));
  }
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

export function providerSummary() {
  const provider = whatsappProviderName();
  if (provider === 'chatbot_backend') {
    const cfg = chatbotBackendConfig();
    return { provider, label: 'Backend WhatsApp (mesmo da Isa/NossaGente)', mode: chatbotBackendMode(), entrada: chatbotBackendMode() === 'isa' ? 'consulta periódica (igual à Isa)' : 'webhook por instância', baseUrl: cfg.baseUrl, apiBase: cfg.apiBase, instance: cfg.instance, keyConfigured: Boolean(cfg.key), configured: whatsappProviderConfigured() };
  }
  return { provider, label: 'Evolution API', baseUrl: clean(process.env.EVOLUTION_API_URL, 300), instance: clean(process.env.EVOLUTION_INSTANCE, 100), keyConfigured: Boolean(process.env.EVOLUTION_API_KEY), configured: whatsappProviderConfigured() };
}

function authHeaders(key) {
  // Contrato da Isa: X-API-KEY. No modo de instâncias o backend aceita também
  // Bearer/apikey (chatbotBackendClient do NossaGente manda os três).
  if (!key) return {};
  return chatbotBackendMode() === 'isa' ? { 'X-API-KEY': key } : { authorization: `Bearer ${key}`, apikey: key, 'x-api-key': key };
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
    data.status?.state, data.status?.connectionState,
    data.instance?.state, data.instance?.status, data.instance?.status?.connectionState,
    data.data?.state, data.data?.status, data.session?.status,
  ].filter((value) => typeof value === 'string').map((value) => clean(value, 60).toLowerCase()).filter(Boolean);
  // Contrato da Isa: { authenticated, connecting }.
  if (!candidates.length && typeof data.authenticated === 'boolean') {
    if (data.authenticated === true && data.connecting !== true) return 'open';
    return data.connecting === true ? 'connecting' : 'qr';
  }
  const value = candidates[0] || (data.connected === true ? 'open' : data.connected === false ? 'close' : '');
  if (['open', 'connected', 'online', 'ready', 'authenticated', 'inchat', 'islogged', 'conectado'].includes(value)) return 'open';
  if (['connecting', 'starting', 'opening', 'initializing', 'pairing', 'syncing', 'conectando'].includes(value)) return 'connecting';
  if (['qr', 'qrcode', 'qr_code', 'qr_ready', 'waiting_qr', 'notlogged', 'scan_qr', 'desconectado_qr'].includes(value)) return 'qr';
  if (['close', 'closed', 'disconnected', 'offline', 'logout', 'logged_out', 'desconectado', 'failed'].includes(value)) return 'close';
  return value ? 'unknown' : 'unknown';
}

/** Extrai QR (data URL base64) e código de pareamento de respostas variadas. */
export function extractQr(data = {}) {
  const pick = (...values) => values.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) || '';
  let qr = pick(data.base64, data.qrDataUrl, data.base64Data, data.qr, data.qrcode, data.qrCode, data.qr_code, data.image, data.data?.base64, data.data?.qrDataUrl, data.data?.qr, data.data?.qrcode, data.data?.qrCode, data.qrcode?.base64, data.instance?.qrcode);
  const pairingCode = pick(data.pairingCode, data.pairing_code, data.code, data.data?.pairingCode, data.data?.code);
  if (qr && !qr.startsWith('data:image') && /^[A-Za-z0-9+/=]{200,}$/.test(qr)) qr = `data:image/png;base64,${qr}`;
  // Conteúdo cru do QR (ex.: "2@abc,...") precisa ser desenhado no servidor.
  const raw = qr && !qr.startsWith('data:image') ? qr : '';
  return { qrImage: qr.startsWith('data:image') ? qr : '', qrRaw: raw, pairingCode: /^[A-Z0-9-]{4,16}$/i.test(pairingCode) ? pairingCode : '' };
}

function normalizedPhone(candidate) {
  if (typeof candidate !== 'string') return '';
  const raw = candidate.trim();
  // @lid e @g.us identificam outros destinatários, não a linha.
  if (raw.includes('@') && !/@(?:s\.whatsapp\.net|c\.us)$/i.test(raw)) return '';
  let digits = raw.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digits)) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}

// Contrato da Isa e validação de valores já persistidos. No modo instancias,
// getInstanceStatus NÃO usa estes campos genéricos: exige o pareamento exato.
export function confirmedPhone(data = {}) {
  const candidates = [
    data.connectedNumber, data.phoneNumber, data.phone, data.me?.id,
    data.instance?.connectedNumber, data.instance?.phoneNumber, data.instance?.phone,
    data.instance?.me?.id, data.data?.connectedNumber, data.data?.phoneNumber,
    data.data?.phone, data.data?.me?.id, data.data?.instance?.connectedNumber,
  ];
  for (const candidate of candidates) {
    const phone = normalizedPhone(candidate);
    if (phone) return phone;
  }
  return '';
}

/** Identidade da própria sessão no contrato multi-instância, nunca de um chat. */
export function confirmedPairingPhone(item = {}, expectedInstance = '') {
  const name = [item.instanceName, item.name, item.instance?.instanceName, item.instance?.name, item.instance]
    .find((value) => typeof value === 'string' && value.trim());
  if (!name || name !== expectedInstance) return '';
  if (item.pairing?.needsQr !== false || item.pairing?.instanceName !== name || item.status?.instanceName !== name) return '';
  if (item.status?.readyToSend === false || item.readyToSend === false) return '';
  if (normalizeState(item) !== 'open' || normalizeState(item.status) !== 'open') return '';
  if (normalizeState({ connectionState: item.pairing.connectionState }) !== 'open') return '';
  return normalizedPhone(item.pairing.connectedNumber);
}

export async function listInstances(fetchImpl, { includeFieldPaths = false } = {}) {
  const cfg = chatbotBackendConfig();
  const result = await call(cfg, 'GET', '/instances', null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, items: [] };
  const list = Array.isArray(result.data) ? result.data : (result.data?.instances || result.data?.items || []);
  if (!Array.isArray(list)) return { ok: false, status: result.status, error: 'invalid_instances_response', items: [], ...(includeFieldPaths ? { responseFields: safeResponseFieldPaths(result.data) } : {}) };
  const items = list.map((item) => {
    if (typeof item === 'string') return { name: clean(item, 100) };
    if (!item || typeof item !== 'object') return null;
    const name = [item.name, item.instanceName, item.instance_name, item.instance?.instanceName, item.instance?.name, item.instance, item.id]
      .find((value) => typeof value === 'string' && value.trim());
    return name ? { name: clean(name, 100), state: normalizeState(item), phone: confirmedPairingPhone(item, name), ...(includeFieldPaths ? { fields: safeResponseFieldPaths(item) } : {}) } : null;
  }).filter((item) => item?.name);
  return { ok: result.ok, status: result.status, items, ...(includeFieldPaths ? { responseFields: safeResponseFieldPaths(result.data) } : {}) };
}

export async function getInstanceStatus(instance, fetchImpl, { resolvePhone = true } = {}) {
  if (chatbotBackendMode() === 'isa') return getSessionStatus(fetchImpl);
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, state: 'unknown', error: 'invalid_instance' };
  const result = await call(cfg, 'GET', `/instances/${encodeURIComponent(cfg.instance)}/status`, null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, state: 'unknown' };
  if (result.status === 404) return { ok: false, status: 404, state: 'unknown', error: 'instance_not_enabled' };
  if (!result.ok) {
    // Algumas versões do backend respondem 400/500 (e não 404) para instância que não
    // está em WHATSAPP_INSTANCE_NAMES. A lista diz com certeza se ela existe.
    const listed = await listInstances(fetchImpl).catch(() => null);
    if (listed?.ok && Array.isArray(listed.items) && listed.items.length && !listed.items.some((item) => clean(item.name, 100).toLowerCase() === cfg.instance)) {
      return { ok: false, status: result.status, state: 'unknown', error: 'instance_not_enabled' };
    }
    return { ok: false, status: result.status, state: 'unknown', error: result.error || 'status_unavailable' };
  }
  const reportedNames = [result.data?.instanceName, result.data?.name, result.data?.instance?.instanceName,
    result.data?.instance?.name, result.data?.instance, result.data?.status?.instanceName]
    .filter((value) => typeof value === 'string' && value.trim());
  if (reportedNames.some((value) => clean(value, 100).toLowerCase() !== cfg.instance)) {
    return { ok: false, status: result.status, state: 'unknown', error: 'instance_mismatch' };
  }
  const reportedStates = [result.data?.state, typeof result.data?.status === 'string' ? result.data.status : '',
    result.data?.connection, result.data?.connectionState, result.data?.status?.state, result.data?.status?.connectionState,
    result.data?.instance?.state, result.data?.instance?.status?.connectionState]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => normalizeState({ state: value })).filter((value) => value !== 'unknown');
  const qr = extractQr(result.data);
  const state = normalizeState(result.data);
  if (new Set(reportedStates).size > 1 || (state === 'open' && (result.data?.readyToSend === false
    || result.data?.status?.readyToSend === false || result.data?.connecting === true))) {
    return { ok: false, status: result.status, state: 'unknown', error: 'status_conflict' };
  }
  let phone = '';
  if (state === 'open' && resolvePhone) {
    // Mesmo que o status contenha phone/me.id, no modo multi-instância ele não
    // prova titularidade. Só a lista com nome EXATO, estado atual e pareamento
    // válido autoriza exibir pairing.connectedNumber.
    const listed = await listInstances(fetchImpl, { includeFieldPaths: !missingPhoneShapeLogged });
    const candidate = listed.items.find((item) => item.name === cfg.instance);
    const exact = candidate?.state === 'open' ? candidate : null;
    phone = listed.ok ? (exact?.phone || '') : '';
    // Timeout, 401 e 5xx não consomem a única amostra: tentar novamente quando
    // a lista responder. Um 2xx com envelope inesperado já é sinal útil.
    const usableShape = listed.ok || (listed.status >= 200 && listed.status < 300 && listed.error === 'invalid_instances_response');
    if (!phone && !missingPhoneShapeLogged && usableShape) {
      missingPhoneShapeLogged = true;
      console.info('[WhatsApp] sessão aberta sem identidade; somente campos/tipos:', JSON.stringify({
        status: safeResponseFieldPaths(result.data),
        list: listed.responseFields || [],
        exact: candidate?.fields || [],
      }));
    }
  }
  if (phone && !resolvedPhoneLogged) {
    resolvedPhoneLogged = true;
    console.info('[WhatsApp] telefone da própria instância confirmado; valor omitido do log.');
  }
  return {
    ok: true,
    status: result.status,
    state,
    phone,
    ...qr,
  };
}

/** Estado da sessão única (contrato da Isa): GET {BASE}/status. */
export async function getSessionStatus(fetchImpl) {
  const cfg = chatbotBackendConfig();
  if (!cfg.baseUrl) return { ok: false, state: 'unknown', error: 'backend_not_configured' };
  const result = await call(cfg, 'GET', '/status', null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, state: 'unknown' };
  if (!result.ok) return { ok: false, status: result.status, state: 'unknown', error: result.error || 'status_unavailable' };
  const state = normalizeState(result.data);
  return {
    ok: true,
    status: result.status,
    state,
    authenticated: result.data?.authenticated === true,
    connecting: result.data?.connecting === true,
    phone: state === 'open' ? confirmedPhone(result.data) : '',
    ...extractQr(result.data),
  };
}

/** Pede QR / (re)conexão. Não apaga a sessão salva. */
export async function requestInstanceQr(instance, fetchImpl) {
  if (chatbotBackendMode() === 'isa') {
    const cfg = chatbotBackendConfig();
    if (!cfg.baseUrl) return { ok: false, error: 'backend_not_configured' };
    // O backend da Isa expõe o pareamento em /connect (e /qr em versões novas).
    let result = await call(cfg, 'GET', '/qr', null, fetchImpl);
    if (result.status === 404 || result.status === 405) result = await call(cfg, 'GET', '/connect', null, fetchImpl);
    if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
    if (!result.ok) return { ok: false, status: result.status, error: result.error || 'qr_unavailable' };
    return { ok: true, status: result.status, state: normalizeState(result.data), ...extractQr(result.data) };
  }
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, error: 'invalid_instance' };
  let result = await call(cfg, 'GET', `/instances/${encodeURIComponent(cfg.instance)}/qr`, null, fetchImpl);
  if (result.status === 404 || result.status === 405) result = await call(cfg, 'POST', `/instances/${encodeURIComponent(cfg.instance)}/qr`, {}, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
  if (!result.ok) return { ok: false, status: result.status, error: result.status === 404 ? 'instance_not_enabled' : (result.error || 'qr_unavailable') };
  return { ok: true, status: result.status, state: normalizeState(result.data), ...extractQr(result.data) };
}

/** Remove a sessão SOMENTE da instância indicada; a confirmação é exigida pelo backend Dino. */
export async function disconnectInstance(instance, fetchImpl) {
  // Na sessão única da Isa, desconectar derruba o número inteiro: não é feito daqui.
  if (chatbotBackendMode() === 'isa') return { ok: false, error: 'not_supported_in_isa_mode' };
  const cfg = chatbotBackendConfig({ instance });
  if (!cfg.instance) return { ok: false, error: 'invalid_instance' };
  const base = `/instances/${encodeURIComponent(cfg.instance)}`;
  // Swagger live do backend Dino: DELETE /instances/{instanceName}/session?confirm=true.
  // Nunca usar a rota global /session ou /logout: ela pode encerrar outra empresa.
  const result = await call(cfg, 'DELETE', `${base}/session?confirm=true`, null, fetchImpl);
  const ok = result.ok && result.data?.ok !== false && result.data?.success !== false;
  return {
    ok,
    status: result.status,
    authError: isAuthError(result.status),
    uncertain: result.status === null || result.status === 408 || result.status >= 500,
    error: ok ? null : (result.status === null ? 'LOGOUT_NETWORK_UNCERTAIN' : `LOGOUT_HTTP_${result.status}`),
  };
}

/** chat_id no formato da Isa: 55 + DDD + número; grupos e @lid são recusados. */
export function isaChatId(value) {
  const raw = clean(value, 80);
  if (/@g\.us$|@lid$/i.test(raw)) return '';
  let digits = raw.replace(/@.*$/, '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}

/** Texto como a ponte da Isa: até 4000 caracteres, cortando em quebra de linha. */
export function isaMessageText(text) {
  const value = String(text ?? '').replace(/\u0000/g, '').trim();
  if (value.length <= MAX_MESSAGE_CHARS) return value;
  const corte = value.slice(0, CUT_AT);
  const quebra = corte.lastIndexOf('\n');
  return `${(quebra > CUT_AT * 0.6 ? corte.slice(0, quebra) : corte).trim()}\n\n(resposta resumida; peça os detalhes se precisar)`;
}

async function sendTextIsa({ instance, number, text, simulateTyping = process.env.WHATSAPP_SIMULATE_TYPING === 'true' }, fetchImpl) {
  const cfg = chatbotBackendConfig();
  if (!cfg.baseUrl) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_URL_MISSING', data: {} };
  if (cfg.key.length < 20) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_KEY_MISSING', data: {} };
  const instanceName = chatbotBackendMode() === 'instancias' ? validInstance(instance || '') : '';
  if (chatbotBackendMode() === 'instancias' && !instanciaPermitida(instanceName, cfg)) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INSTANCE_SCOPE_MISMATCH', data: {} };
  const chatId = isaChatId(number);
  if (!chatId) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INVALID_CHAT_ID', data: {} };
  const message = isaMessageText(text);
  if (!message) return { ok: false, status: null, retryable: false, uncertain: false, error: 'EMPTY_MESSAGE', data: {} };
  // Proteção Antiban: Ativa simulação de digitação humanizada (composing) proporcional ao tamanho
  const deveSimularDigitacao = simulateTyping !== false && process.env.WHATSAPP_SIMULATE_TYPING !== 'false';
  const delayHumanizado = deveSimularDigitacao ? Math.min(5, Math.max(2, Math.round(message.length / 60))) : 0;
  // O backend multi-instância documenta APENAS /send com instanceName; nunca
  // tentar rotas sem escopo como fallback após resposta incerta ou 404.
  const result = await call(cfg, 'POST', '/send', { ...(instanceName ? { instanceName } : {}), chat_id: chatId, message, simulateTyping: deveSimularDigitacao, delaySeconds: delayHumanizado, waitForReply: false }, fetchImpl);
  // accepted é opcional no Swagger. Não reenviar 2xx sem success conclusivo:
  // a API pode ter colocado a mensagem em fila antes de perder a resposta.
  const aceito = result.ok && result.data?.success === true && result.data?.accepted !== false;
  const uncertain = result.status === null || (!result.ok && (result.status === 408 || result.status >= 500))
    || (result.ok && result.data?.success !== false && !aceito);
  return {
    ok: aceito,
    status: result.status,
    retryable: !aceito && !uncertain && (result.status === 425 || result.status === 429),
    uncertain,
    authError: isAuthError(result.status),
    error: aceito ? undefined : (result.error || result.data?.error || `HTTP_${result.status}`),
    data: { ...result.data, key: { id: clean(result.data?.questionId || result.data?.messageId || result.data?.id, 200) || undefined } },
  };
}

/**
 * Mensagens recebidas (contrato da Isa): GET {BASE}/messages?latest=false&role=user&from=ISO&limit=N.
 * Devolve a lista achatada [{ chatId, role, content, timestamp, messageType, whatsappMessageId, questionId }].
 */
export async function fetchInboundMessages({ instance, from, limit = 100, role = 'user' } = {}, fetchImpl) {
  const cfg = chatbotBackendConfig();
  if (!cfg.baseUrl || cfg.key.length < 20) return { ok: false, error: 'backend_not_configured', messages: [] };
  const instanceName = chatbotBackendMode() === 'instancias' ? validInstance(instance || '') : '';
  if (chatbotBackendMode() === 'instancias' && !instanciaPermitida(instanceName, cfg)) return { ok: false, error: 'INSTANCE_SCOPE_MISMATCH', messages: [] };
  const params = new URLSearchParams({ latest: 'false', role: role === 'assistant' ? 'assistant' : 'user', limit: String(Math.min(200, Math.max(25, Number(limit) || 100))) });
  if (from) params.set('from', new Date(from).toISOString());
  if (instanceName) params.set('instanceName', instanceName);
  const result = await call(cfg, 'GET', `/messages?${params.toString()}`, null, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status, messages: [] };
  if (!result.ok) return { ok: false, status: result.status, error: result.error || 'messages_unavailable', messages: [] };
  const data = result.data || {};
  const lista = [];
  const empilhar = (chatId, mensagens) => {
    for (const item of Array.isArray(mensagens) ? mensagens : []) lista.push({ ...item, chatId: clean(item?.chatId || chatId, 80) });
  };
  if (Array.isArray(data.users)) for (const usuario of data.users) empilhar(usuario?.chatId, usuario?.messages);
  if (Array.isArray(data.messages)) empilhar(data.chatId, data.messages);
  if (Array.isArray(data)) empilhar('', data);
  return { ok: true, status: result.status, messages: lista };
}

/**
 * Mensagens que SAÍRAM do número (role=assistant). O backend marca cada uma com
 * interactionType: "bot" (enviada pela API: IA, lembrete, campanha) ou "organic"
 * (digitada no celular/WhatsApp Web pela equipe). Usado para pausar a IA quando
 * a equipe assume a conversa pelo aparelho.
 */
export async function fetchOutboundMessages({ instance, from, limit = 100 } = {}, fetchImpl) {
  const resposta = await fetchInboundMessages({ instance, from, limit, role: 'assistant' }, fetchImpl);
  // Defesa: o backend pode ignorar o filtro de role; só vale o que é de fato saída.
  return { ...resposta, messages: resposta.messages.filter((item) => String(item?.role || '').toLowerCase() === 'assistant') };
}

export async function sendTextViaChatbotBackend({ instance, number, text, simulateTyping }, fetchImpl) {
  return sendTextIsa({ instance, number, text, simulateTyping }, fetchImpl);
}

/**
 * Figurinha (WebP 512x512) pelo backend. A rota é configurável porque o contrato da
 * Isa só documenta /send (texto): CHATBOT_BACKEND_STICKER_PATH (ex.: /send-sticker).
 * Sem a rota configurada, nada é enviado (unsupported). Ver
 * docs/operations/WHATSAPP-BACKEND-FIGURINHA.md para a implementação no backend.
 */
export async function sendStickerViaChatbotBackend({ instance, number, url = '', base64 = '', mimetype = 'image/webp', fileName = '' } = {}, fetchImpl) {
  const cfg = chatbotBackendConfig();
  const stickerPath = chatbotBackendStickerPath();
  if (!stickerPath || !stickerPath.startsWith('/')) return { ok: false, unsupported: true, status: null, retryable: false, uncertain: false, error: 'STICKER_ROUTE_NOT_CONFIGURED' };
  if (!cfg.baseUrl || cfg.key.length < 20) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_NOT_CONFIGURED' };
  const instanceName = chatbotBackendMode() === 'instancias' ? validInstance(instance || '') : '';
  if (chatbotBackendMode() === 'instancias' && !instanciaPermitida(instanceName, cfg)) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INSTANCE_SCOPE_MISMATCH' };
  const chatId = isaChatId(number);
  if (!chatId) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INVALID_CHAT_ID' };
  if (base64.length > 700000) return { ok: false, retryable: false, uncertain: false, error: 'STICKER_INVALID' };
  if (!url && !base64) return { ok: false, status: null, retryable: false, uncertain: false, error: 'STICKER_EMPTY' };
  const result = await call(cfg, 'POST', stickerPath.replace('{instance}', encodeURIComponent(instanceName || cfg.instance)), { ...(instanceName ? { instanceName } : {}), chat_id: chatId, sticker: { ...(url ? { url } : {}), ...(base64 ? { base64 } : {}), mimetype, ...(fileName ? { fileName } : {}) } }, fetchImpl);
  const aceito = result.ok && result.data?.success !== false && result.data?.accepted !== false;
  return { ok: aceito, status: result.status, unsupported: result.status === 404 || result.status === 405, retryable: false, uncertain: result.status === null || result.status >= 500, error: aceito ? undefined : (result.error || result.data?.error || `HTTP_${result.status}`) };
}

/**
 * Resposta em voz (áudio gravado/PTT) pelo backend: rota ligada por ambiente,
 * CHATBOT_BACKEND_AUDIO_PATH=/send-audio (ver integracoes/chatbot-backend-whatsapp-extras).
 * Sem a variável nada é enviado e o T-Rex responde em texto.
 */
export function chatbotBackendAudioPath(env = process.env) {
  const value = clean(env.CHATBOT_BACKEND_AUDIO_PATH || '', 120);
  return /^\/[a-z0-9/_{}.-]+$/i.test(value) ? value : '';
}

export async function sendAudioViaChatbotBackend({ instance, number, base64 = '', mimetype = 'audio/ogg; codecs=opus' } = {}, fetchImpl) {
  const cfg = chatbotBackendConfig();
  const audioPath = chatbotBackendAudioPath();
  if (!audioPath) return { ok: false, unsupported: true, status: null, retryable: false, uncertain: false, error: 'AUDIO_ROUTE_NOT_CONFIGURED' };
  if (!cfg.baseUrl || cfg.key.length < 20) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_NOT_CONFIGURED' };
  const instanceName = chatbotBackendMode() === 'instancias' ? validInstance(instance || '') : '';
  if (chatbotBackendMode() === 'instancias' && !instanciaPermitida(instanceName, cfg)) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INSTANCE_SCOPE_MISMATCH' };
  const chatId = isaChatId(number);
  if (!chatId) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INVALID_CHAT_ID' };
  if (!base64 || base64.length > 2_800_000) return { ok: false, retryable: false, uncertain: false, error: 'AUDIO_INVALID' };
  const result = await call(cfg, 'POST', audioPath.replace('{instance}', encodeURIComponent(instanceName || cfg.instance)), { ...(instanceName ? { instanceName } : {}), chat_id: chatId, audio: { base64, mimetype } }, fetchImpl);
  const aceito = result.ok && result.data?.success !== false && result.data?.accepted !== false;
  return { ok: aceito, status: result.status, unsupported: result.status === 404 || result.status === 405, retryable: false, uncertain: result.status === null || result.status >= 500, error: aceito ? undefined : (result.error || result.data?.error || `HTTP_${result.status}`) };
}

/** Tenta registrar o webhook de entrada no backend (se a rota existir). */
export async function registerInstanceWebhook({ instance, url, headers = {} }, fetchImpl) {
  // Como na Isa, o backend não chama webhook de mensagens: a entrada é por consulta.
  if (chatbotBackendMode() === 'isa') return { ok: true, unsupported: true, polling: true };
  const cfg = chatbotBackendConfig({ instance });
  const base = `/instances/${encodeURIComponent(cfg.instance)}`;
  const body = { url, enabled: true, headers, events: ['messages.upsert', 'connection.update'] };
  let result = await call(cfg, 'PUT', `${base}/webhook`, body, fetchImpl);
  if (result.status === 404 || result.status === 405) result = await call(cfg, 'POST', `${base}/webhook`, body, fetchImpl);
  if (isAuthError(result.status)) return { ok: false, authError: true, status: result.status };
  if (result.status === 404 || result.status === 405) return { ok: false, unsupported: true, status: result.status };
  return { ok: result.ok, status: result.status };
}

/**
 * Figurinha (sticker WebP) pelo backend próprio. O backend da Isa/NossaGente
 * ainda não documenta envio de mídia: a rota é ligada por ambiente, sem deploy,
 * quando existir. Contrato esperado (CHATBOT_BACKEND_STICKER_PATH=/send-media):
 *   POST {BASE}{path} { instanceName, chat_id,
 *                       sticker: { mimetype: 'image/webp', base64 } }
 *   → 2xx { success: true, messageId }
 * Sem a variável, devolve { ok:false, unsupported:true } e nada é enviado.
 */
export function chatbotBackendStickerPath(env = process.env) {
  const value = clean(env.CHATBOT_BACKEND_STICKER_PATH || '', 120);
  return /^\/[a-z0-9/_{}.-]+$/i.test(value) ? value : '';
}

/**
 * Enquete (poll) pelo backend, como a Isa faz nas aprovações: o cliente toca na opção.
 * Rota POST /send-poll do chatbot-backend-nestjs (CHATBOT_BACKEND_POLL_PATH muda ou desliga com "off"). Contrato:
 *   POST {BASE}{path} { instanceName, chat_id, poll: { name, options: [..2-12], selectableCount: 1 } }
 *   → 2xx { success: true, messageId }
 * Sem a rota, devolve { ok:false, unsupported:true } e o atendimento manda as opções numeradas.
 * Ver docs/operations/WHATSAPP-BACKEND-ENQUETE.md.
 */
// Padrão /send-poll (rota do chatbot-backend-nestjs). "off" desliga; backend sem a rota
// responde 404 e o atendimento manda as opções numeradas em texto.
export const DEFAULT_POLL_PATH = '/send-poll';
export function chatbotBackendPollPath(env = process.env) {
  const raw = clean(env.CHATBOT_BACKEND_POLL_PATH ?? '', 120);
  if (/^(off|0|false|nao|não)$/i.test(raw)) return '';
  const value = raw || DEFAULT_POLL_PATH;
  return /^\/[a-z0-9/_{}.-]+$/i.test(value) ? value : '';
}

export async function sendPollViaChatbotBackend({ instance, number, name = '', options = [], selectableCount = 1 } = {}, fetchImpl) {
  const cfg = chatbotBackendConfig();
  const pollPath = chatbotBackendPollPath();
  if (!pollPath) return { ok: false, unsupported: true, status: null, retryable: false, uncertain: false, error: 'POLL_ROUTE_NOT_CONFIGURED' };
  if (!cfg.baseUrl || cfg.key.length < 20) return { ok: false, status: null, retryable: false, uncertain: false, error: 'CHATBOT_BACKEND_NOT_CONFIGURED' };
  const instanceName = chatbotBackendMode() === 'instancias' ? validInstance(instance || '') : '';
  if (chatbotBackendMode() === 'instancias' && !instanciaPermitida(instanceName, cfg)) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INSTANCE_SCOPE_MISMATCH' };
  const chatId = isaChatId(number);
  if (!chatId) return { ok: false, status: null, retryable: false, uncertain: false, error: 'INVALID_CHAT_ID' };
  const pergunta = clean(name, 255);
  const opcoes = (Array.isArray(options) ? options : []).map((item) => clean(item, 100)).filter(Boolean).slice(0, 12);
  if (!pergunta || opcoes.length < 2) return { ok: false, status: null, retryable: false, uncertain: false, error: 'POLL_INVALID' };
  const result = await call(cfg, 'POST', pollPath.replace('{instance}', encodeURIComponent(instanceName || cfg.instance)), {
    ...(instanceName ? { instanceName } : {}),
    chat_id: chatId,
    poll: { name: pergunta, options: opcoes, selectableCount: Math.max(1, Math.min(opcoes.length, Number(selectableCount) || 1)) },
  }, fetchImpl);
  const aceito = result.ok && result.data?.success !== false && result.data?.accepted !== false;
  return { ok: aceito, status: result.status, unsupported: result.status === 404 || result.status === 405, retryable: false, uncertain: result.status === null || result.status >= 500, error: aceito ? undefined : (result.error || result.data?.error || `HTTP_${result.status}`) };
}
