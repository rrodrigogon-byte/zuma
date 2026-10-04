// ============================================================================
// CONEXÃO WHATSAPP POR EMPRESA — pareamento por QR + reconexão automática
// Usa o mesmo backend do NossaGente (core/whatsapp-provider.js). Aqui fica só
// o estado operacional da conexão (sem segredo): instância, estado, horários,
// tentativas de reconexão e um histórico curto de eventos.
// ============================================================================

import QRCode from 'qrcode';
import { db, save } from './db.js';
import {
  disconnectInstance, getInstanceStatus, providerSummary, requestInstanceQr,
  validInstance, whatsappProviderName, chatbotBackendConfig,
} from './core/whatsapp-provider.js';

const HISTORY_LIMIT = 40;
const BACKOFF_MINUTES = [1, 2, 5, 10, 15, 30];
const disconnecting = new Set();
const disconnectEpoch = new Map();

function store() {
  const state = db();
  state.whatsappConexaoKytto ||= { empresas: {} };
  state.whatsappConexaoKytto.empresas ||= {};
  return state.whatsappConexaoKytto.empresas;
}

// Cada instância do backend pertence a uma única empresa. A instância padrão do
// ambiente (CHATBOT_BACKEND_INSTANCE) vai para a empresa de CHATBOT_BACKEND_EMPRESA_ID
// quando definida; sem ela, para a primeira empresa que abrir a conexão, nunca para a
// empresa 'principal' da plataforma. Empresa sem instância não conecta nem envia.
export function instanciaEmUso(instance, exceto = '') {
  if (!instance) return false;
  return Object.values(store()).some(c => String(c.empresaId) !== String(exceto) && c.instance === instance);
}
function instanciaPadrao(key) {
  const inst = validInstance(chatbotBackendConfig().instance || '');
  if (!inst) return '';
  const dono = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  if (dono) return dono === key ? inst : '';
  if (key === 'principal') return '';
  return instanciaEmUso(inst, key) ? '' : inst;
}
function semInstancia(conexao) {
  return conexao.instance ? null : { ok: false, error: 'Esta empresa ainda não tem uma instância de WhatsApp atribuída. Peça à administração da plataforma.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' };
}
export function obterConexao(empresaId) {
  const empresas = store();
  const key = String(empresaId);
  empresas[key] ||= {
    empresaId: key,
    instance: instanciaPadrao(key),
    autoReconnect: true,
    numeroExibicao: '',
    state: 'unknown',
    phone: '',
    lastCheckAt: null,
    lastConnectedAt: null,
    lastDisconnectAt: null,
    lastQrAt: null,
    reconnectAttempts: 0,
    nextReconnectAt: null,
    lastError: null,
    history: [],
    ativo: false,
  };
  return empresas[key];
}

export function conexoesAtivas() {
  return Object.values(store()).filter((item) => item.ativo && item.autoReconnect);
}

function registrar(conexao, tipo, detalhe = '') {
  conexao.history = [{ at: new Date().toISOString(), tipo, detalhe: String(detalhe || '').slice(0, 200) }, ...(conexao.history || [])].slice(0, HISTORY_LIMIT);
}

function aplicarEstado(conexao, resultado) {
  const agora = new Date().toISOString();
  const anterior = conexao.state;
  conexao.lastCheckAt = agora;
  if (resultado.authError) {
    conexao.lastError = 'chave_invalida';
    if (anterior !== 'unknown') registrar(conexao, 'erro', 'Backend recusou a chave de API (401/403).');
    conexao.state = 'unknown';
    return;
  }
  if (!resultado.ok) {
    conexao.lastError = resultado.error || `http_${resultado.status || 'sem_resposta'}`;
    conexao.phone = ''; // sem status atual não há número verificável
    return;
  }
  conexao.lastError = null;
  conexao.state = resultado.state || 'unknown';
  conexao.phone = conexao.state === 'open' ? (resultado.phone || '') : '';
  if (conexao.state === 'open') {
    if (anterior !== 'open') {
      conexao.lastConnectedAt = agora;
      registrar(conexao, 'conectado', conexao.phone ? `Número ${mascararNumero(conexao.phone)}` : 'Sessão aberta');
    }
    conexao.reconnectAttempts = 0;
    conexao.nextReconnectAt = null;
  } else if (anterior === 'open') {
    conexao.lastDisconnectAt = agora;
    registrar(conexao, 'desconectado', `Estado ${conexao.state}`);
  }
}

export function mascararNumero(valor) {
  const digits = String(valor || '').replace(/\D/g, '');
  if (digits.length < 8) return '';
  return `${digits.slice(0, 4)}•••••${digits.slice(-4)}`;
}

export function visaoPublica(conexao) {
  const provider = providerSummary();
  return {
    provider: provider.provider,
    providerLabel: provider.label,
    providerConfigured: provider.configured,
    keyConfigured: provider.keyConfigured,
    backendUrl: provider.baseUrl,
    instance: conexao.instance,
    ativo: Boolean(conexao.ativo),
    autoReconnect: conexao.autoReconnect !== false,
    state: conexao.state,
    phoneMasked: conexao.state === 'open' ? mascararNumero(conexao.phone) : '',
    lastCheckAt: conexao.lastCheckAt,
    lastConnectedAt: conexao.lastConnectedAt,
    lastDisconnectAt: conexao.lastDisconnectAt,
    lastQrAt: conexao.lastQrAt,
    reconnectAttempts: conexao.reconnectAttempts || 0,
    nextReconnectAt: conexao.nextReconnectAt,
    lastError: conexao.lastError,
    history: (conexao.history || []).slice(0, 20),
  };
}

export async function verificarConexao(empresaId, { fetchImpl } = {}) {
  const conexao = obterConexao(empresaId);
  if (whatsappProviderName() !== 'chatbot_backend') {
    conexao.lastError = 'provedor_nao_e_nossagente';
    return visaoPublica(conexao);
  }
  if (semInstancia(conexao)) { conexao.lastError = 'instancia_nao_atribuida'; return visaoPublica(conexao); }
  const key = String(empresaId);
  const epoch = disconnectEpoch.get(key) || 0;
  const resultado = await getInstanceStatus(conexao.instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0)) return visaoPublica(conexao);
  aplicarEstado(conexao, resultado);
  // Se o backend confirma a sessão aberta, a conexão precisa continuar ativa
  // mesmo quando uma tentativa anterior de logout falhou depois de persistir
  // apenas o estado local.
  if (resultado.ok && resultado.state === 'open' && conexao.autoReconnect !== false) conexao.ativo = true;
  save();
  return visaoPublica(conexao);
}

async function desenharQr(resultado) {
  if (resultado.qrImage) return resultado.qrImage;
  if (resultado.qrRaw) {
    try { return await QRCode.toDataURL(resultado.qrRaw, { margin: 1, width: 320 }); } catch { return ''; }
  }
  return '';
}

/** Gera QR (ou reabre a sessão salva). O QR não é persistido. */
export async function gerarQr(empresaId, { usuario = '', fetchImpl, registrarHistorico = true } = {}) {
  const conexao = obterConexao(empresaId);
  const bloqueio = semInstancia(conexao);
  if (bloqueio) return { ...bloqueio, conexao: visaoPublica(conexao) };
  if (disconnecting.has(String(empresaId))) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'Desconexão em andamento.', conexao: visaoPublica(conexao) };
  const key = String(empresaId);
  const epoch = disconnectEpoch.get(key) || 0;
  conexao.ativo = true;
  const resultado = await requestInstanceQr(conexao.instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0)) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'A conexão mudou durante a solicitação.', conexao: visaoPublica(conexao) };
  if (resultado.authError) {
    aplicarEstado(conexao, resultado);
    save();
    return { ok: false, error: 'Backend recusou a chave de API. Confira CHATBOT_BACKEND_KEY.', conexao: visaoPublica(conexao) };
  }
  if (!resultado.ok) {
    conexao.lastError = resultado.error;
    save();
    const msg = resultado.error === 'instance_not_enabled'
      ? `Instância "${conexao.instance}" não está liberada no backend. Inclua-a em WHATSAPP_INSTANCE_NAMES do backend.`
      : 'Backend não devolveu o QR agora. Tente de novo em instantes.';
    return { ok: false, error: msg, conexao: visaoPublica(conexao) };
  }
  const qr = await desenharQr(resultado);
  conexao.state = resultado.state === 'open' ? 'open' : (qr ? 'qr' : (resultado.state || 'connecting'));
  conexao.lastQrAt = qr ? new Date().toISOString() : conexao.lastQrAt;
  if (registrarHistorico) registrar(conexao, qr ? 'qr_gerado' : 'reconexao_solicitada', usuario ? `por ${usuario}` : '');
  save();
  return { ok: true, qr, pairingCode: resultado.pairingCode || '', conexao: visaoPublica(conexao) };
}

export async function desconectar(empresaId, { usuario = '', fetchImpl } = {}) {
  const conexao = obterConexao(empresaId);
  const bloqueio = semInstancia(conexao);
  if (bloqueio) return { ...bloqueio, conexao: visaoPublica(conexao) };
  const key = String(empresaId);
  if (disconnecting.has(key)) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'Desconexão em andamento.', conexao: visaoPublica(conexao) };
  disconnecting.add(key);
  disconnectEpoch.set(key, (disconnectEpoch.get(key) || 0) + 1);
  try {
    const resultado = await disconnectInstance(conexao.instance, fetchImpl);
    // Um timeout pode acontecer DEPOIS do reset; GET é seguro, DELETE não deve ser repetido.
    // Recusa do DELETE (ex.: 4xx porque não há sessão) também é conferida pelo GET: se o
    // backend confirma que o número não está conectado, não há o que desconectar.
    const status = resultado.authError ? null : await getInstanceStatus(conexao.instance, fetchImpl);
    const semSessao = status?.ok === true && ['close', 'qr'].includes(status.state);
    if (!semSessao) {
      // Nunca simular logout local ou reiniciar outro número quando o backend
      // falhou ou ainda responde open/unknown. A instância continua visível.
      conexao.ativo = conexao.state === 'open' ? true : conexao.ativo;
      conexao.phone = ''; // nem DELETE nem GET final confirmaram a identidade atual
      conexao.lastError = resultado.ok ? 'LOGOUT_STATUS_UNCONFIRMED' : (resultado.error || 'logout_failed');
      save();
      return { ok: false, error: 'Backend não confirmou a desconexão.', conexao: visaoPublica(conexao) };
    }
    conexao.ativo = false;
    conexao.autoReconnect = false;
    conexao.state = 'close';
    conexao.phone = '';
    conexao.lastError = null;
    conexao.lastCheckAt = new Date().toISOString();
    conexao.lastDisconnectAt = conexao.lastCheckAt;
    registrar(conexao, 'desconectado_manual', usuario ? `por ${usuario}` : '');
    save();
    return { ok: true, error: null, conexao: visaoPublica(conexao) };
  } finally {
    disconnecting.delete(key);
  }
}

export function configurar(empresaId, { instance, autoReconnect, numeroExibicao } = {}, { podeTrocarInstancia = false } = {}) {
  const conexao = obterConexao(empresaId);
  if (instance !== undefined && instance !== conexao.instance) {
    // Trocar a instância muda qual número do backend a empresa controla: só a
    // administração da plataforma faz isso, e nunca para uma instância de outra empresa.
    if (!podeTrocarInstancia) throw new Error('A instância é atribuída pela administração da plataforma.');
    const valida = validInstance(instance);
    if (!valida) throw new Error('Instância inválida: use letras minúsculas, números, - ou _.');
    if (instanciaEmUso(valida, empresaId)) throw new Error('Esta instância já pertence a outra empresa.');
    if (valida !== conexao.instance) {
      registrar(conexao, 'instancia_alterada', `${conexao.instance} → ${valida}`);
      conexao.instance = valida;
      conexao.state = 'unknown';
    }
  }
  if (autoReconnect !== undefined) conexao.autoReconnect = autoReconnect === true;
  if (numeroExibicao !== undefined) conexao.numeroExibicao = String(numeroExibicao || '').replace(/[^\d+()\s-]/g, '').slice(0, 25);
  save();
  return visaoPublica(conexao);
}

/**
 * Vigia de reconexão: se a conexão caiu, pede nova conexão ao backend com
 * espera crescente (1, 2, 5, 10, 15, 30 min). Quando a sessão salva ainda é
 * válida o backend reabre sozinho; se o WhatsApp exigir, um novo QR fica
 * disponível na tela.
 */
export async function vigiarConexao(empresaId, { now = Date.now(), fetchImpl } = {}) {
  const conexao = obterConexao(empresaId);
  const key = String(empresaId);
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (!conexao.ativo || conexao.autoReconnect === false || !conexao.instance) return { action: 'skip', reason: 'inactive' };
  const epoch = disconnectEpoch.get(key) || 0;
  const status = await getInstanceStatus(conexao.instance, fetchImpl);
  // O GET pode ter começado ANTES do logout; não aplicar estado nem pedir QR
  // depois que a ação de desconexão adquiriu o lock em memória.
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0)) return { action: 'skip', reason: 'disconnect_in_progress' };
  aplicarEstado(conexao, status);
  if (!status.ok || status.authError) { save(); return { action: 'status_unavailable' }; }
  if (conexao.state === 'open' || conexao.state === 'connecting') { save(); return { action: 'none', state: conexao.state }; }
  if (conexao.nextReconnectAt && new Date(conexao.nextReconnectAt).getTime() > now) { save(); return { action: 'waiting', until: conexao.nextReconnectAt }; }
  const attempt = (conexao.reconnectAttempts || 0) + 1;
  const result = await requestInstanceQr(conexao.instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0)) return { action: 'skip', reason: 'disconnect_in_progress' };
  conexao.reconnectAttempts = attempt;
  const minutes = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
  conexao.nextReconnectAt = new Date(now + minutes * 60_000).toISOString();
  registrar(conexao, 'reconexao_automatica', `tentativa ${attempt}${result.ok ? '' : ' (backend indisponível)'}`);
  if (result.ok && result.state === 'open') { conexao.state = 'open'; conexao.reconnectAttempts = 0; conexao.nextReconnectAt = null; }
  save();
  return { action: 'reconnect', attempt, ok: result.ok };
}

export async function vigiarTodas(options = {}) {
  const resultados = [];
  for (const conexao of conexoesAtivas()) {
    try { resultados.push({ empresaId: conexao.empresaId, ...(await vigiarConexao(conexao.empresaId, options)) }); }
    catch (error) { resultados.push({ empresaId: conexao.empresaId, action: 'error', error: String(error?.message || error).slice(0, 120) }); }
  }
  return resultados;
}

/** Evento connection.update recebido pelo webhook do canal. */
export function registrarEventoConexao(empresaId, state) {
  const conexao = obterConexao(empresaId);
  if (disconnecting.has(String(empresaId)) || (!conexao.ativo && conexao.autoReconnect === false)) return visaoPublica(conexao);
  aplicarEstado(conexao, { ok: true, state });
  if (conexao.state !== 'open') conexao.nextReconnectAt = null; // reconecta no próximo ciclo do vigia
  save();
  return visaoPublica(conexao);
}
