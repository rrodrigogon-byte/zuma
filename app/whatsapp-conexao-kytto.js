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
  validInstance, whatsappProviderName, chatbotBackendConfig, confirmedPhone, instancesOfCompany,
} from './core/whatsapp-provider.js';

const HISTORY_LIMIT = 40;
const BACKOFF_MINUTES = [1, 2, 5, 10, 15, 30];
const disconnecting = new Set();
const disconnectEpoch = new Map();

function normalizarTipoCanal(value = 'cliente') {
  return String(value || 'cliente').toLowerCase() === 'gestao' ? 'gestao' : 'cliente';
}

function chaveConexao(empresaId, tipoCanal = 'cliente') {
  return `${String(empresaId)}:${normalizarTipoCanal(tipoCanal)}`;
}

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
export function instanciaEmUso(instance, exceto = '', tipoCanal = '') {
  if (!instance) return false;
  const tipo = tipoCanal ? normalizarTipoCanal(tipoCanal) : '';
  return Object.values(store()).some(c => {
    if (c.instance !== instance) return false;
    if (String(c.empresaId) !== String(exceto)) return true;
    return tipo ? normalizarTipoCanal(c.tipoCanal) !== tipo : true;
  });
}
function instanciaPadrao(key, tipoCanal = 'cliente') {
  const perfil = normalizarTipoCanal(tipoCanal);

  // Instância registrada para esta empresa no servidor (CHATBOT_BACKEND_INSTANCES) vem primeiro.
  const registrada = instancesOfCompany(key).find((nome) => !instanciaEmUso(nome, key, perfil));
  if (registrada) return registrada;
  const inst = validInstance(chatbotBackendConfig().instance || '');
  if (!inst) return '';
  const dono = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  if (dono) return dono === key ? inst : '';
  if (key === 'principal') return '';
  return instanciaEmUso(inst, key, perfil) ? '' : inst;
}
function semInstancia(conexao) {
  return conexao.instance ? null : { ok: false, error: 'Esta empresa ainda não tem uma instância de WhatsApp atribuída. Peça à administração da plataforma.', code: 'WHATSAPP_INSTANCE_UNASSIGNED' };
}
export function obterConexao(empresaId, tipoCanal = 'cliente') {
  const empresas = store();
  const key = String(empresaId);
  const perfil = normalizarTipoCanal(tipoCanal);
  const storageKey = chaveConexao(key, perfil);
  if (!empresas[storageKey] && perfil === 'cliente' && empresas[key]?.empresaId) {
    empresas[storageKey] = { ...empresas[key], tipoCanal: 'cliente' };
    delete empresas[key];
  }
  empresas[storageKey] ||= {
    empresaId: key,
    tipoCanal: perfil,
    instance: instanciaPadrao(key, perfil),
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
  return empresas[storageKey];
}

export function conexoesAtivas() {
  return Object.values(store()).filter((item) => item.ativo && item.autoReconnect);
}

function registrar(conexao, tipo, detalhe = '') {
  conexao.history = [{ at: new Date().toISOString(), tipo, instance: conexao.instance, detalhe: String(detalhe || '').slice(0, 200) }, ...(conexao.history || [])].slice(0, HISTORY_LIMIT);
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

function numeroReferencia(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digits)) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) throw new Error('Informe um número brasileiro com DDD.');
  return digits;
}

export function visaoPublica(conexao, { numeroCompleto = false } = {}) {
  const provider = providerSummary();
  const checkAt = Date.parse(conexao.lastCheckAt || '');
  const recente = Number.isFinite(checkAt) && Date.now() - checkAt >= 0 && Date.now() - checkAt < 2 * 60_000;
  const phone = conexao.state === 'open' && !conexao.lastError && recente ? confirmedPhone({ phone: conexao.phone }) : '';
  const reference = numeroCompleto ? confirmedPhone({ phone: conexao.numeroExibicao }) : '';
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
    phoneMasked: phone ? mascararNumero(phone) : '',
    ...(numeroCompleto ? { phoneNumber: phone, phoneReference: reference } : {}),
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

export async function verificarConexao(empresaId, { fetchImpl, tipoCanal = 'cliente' } = {}) {
  const conexao = obterConexao(empresaId, tipoCanal);
  if (whatsappProviderName() !== 'chatbot_backend') {
    conexao.lastError = 'provedor_nao_e_nossagente';
    return visaoPublica(conexao);
  }
  if (semInstancia(conexao)) { conexao.lastError = 'instancia_nao_atribuida'; return visaoPublica(conexao); }
  const key = String(empresaId);
  const epoch = disconnectEpoch.get(key) || 0;
  const instance = conexao.instance;
  const resultado = await getInstanceStatus(instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return visaoPublica(conexao);
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
export async function gerarQr(empresaId, { usuario = '', fetchImpl, registrarHistorico = true, tipoCanal = 'cliente' } = {}) {
  const conexao = obterConexao(empresaId, tipoCanal);
  const bloqueio = semInstancia(conexao);
  if (bloqueio) return { ...bloqueio, conexao: visaoPublica(conexao) };
  if (disconnecting.has(String(empresaId))) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'Desconexão em andamento.', conexao: visaoPublica(conexao) };
  const key = String(empresaId);
  const epoch = disconnectEpoch.get(key) || 0;
  const instance = conexao.instance;
  conexao.ativo = true;
  const resultado = await requestInstanceQr(instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'A conexão mudou durante a solicitação.', conexao: visaoPublica(conexao) };
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
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'A conexão mudou durante a solicitação.', conexao: visaoPublica(conexao) };
  const temPareamento = Boolean(qr || resultado.pairingCode);
  conexao.state = resultado.state === 'open' ? 'open' : (temPareamento ? 'qr' : (resultado.state || 'connecting'));
  // O QR ou uma reconexão nunca confirmam que o novo pareamento usa a linha antiga.
  conexao.phone = '';
  conexao.lastCheckAt = null;
  conexao.lastQrAt = temPareamento ? new Date().toISOString() : conexao.lastQrAt;
  if (registrarHistorico) registrar(conexao, temPareamento ? 'qr_gerado' : 'reconexao_solicitada', usuario ? `por ${usuario}` : '');
  save();
  return { ok: true, qr, pairingCode: resultado.pairingCode || '', conexao: visaoPublica(conexao) };
}

export async function desconectar(empresaId, { usuario = '', fetchImpl, tipoCanal = 'cliente' } = {}) {
  const conexao = obterConexao(empresaId, tipoCanal);
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
    const status = resultado.authError ? null : await getInstanceStatus(conexao.instance, fetchImpl, { resolvePhone: false });
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
    conexao.numeroExibicao = '';
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

export function configurar(empresaId, { instance, autoReconnect, numeroExibicao } = {}, { podeTrocarInstancia = false, tipoCanal = 'cliente' } = {}) {
  const perfil = normalizarTipoCanal(tipoCanal);
  const conexao = obterConexao(empresaId, perfil);
  const reference = numeroExibicao !== undefined ? numeroReferencia(numeroExibicao) : undefined;
  if (instance !== undefined && instance !== conexao.instance) {
    // Trocar a instância muda qual número do backend a empresa controla: só a
    // administração da plataforma faz isso, e nunca para uma instância de outra empresa.
    if (!podeTrocarInstancia) throw new Error('A instância é atribuída pela administração da plataforma.');
    const valida = validInstance(instance);
    if (!valida) throw new Error('Instância inválida: use letras minúsculas, números, - ou _.');
    if (instanciaEmUso(valida, empresaId, perfil)) throw new Error('Esta instância já pertence a outra empresa ou canal.');
    if (valida !== conexao.instance) {
      const key = String(empresaId);
      if (disconnecting.has(key)) throw new Error('Aguarde o fim da desconexão antes de trocar a instância.');
      disconnectEpoch.set(key, (disconnectEpoch.get(key) || 0) + 1);
      conexao.history = (conexao.history || []).map((item) => ({ ...item, instance: item.instance || conexao.instance }));
      registrar(conexao, 'instancia_alterada', `${conexao.instance} → ${valida}`);
      conexao.instance = valida;
      conexao.state = 'unknown';
      conexao.phone = '';
      conexao.numeroExibicao = '';
      conexao.lastCheckAt = null;
      conexao.lastConnectedAt = null;
      conexao.lastDisconnectAt = null;
      conexao.lastQrAt = null;
      conexao.reconnectAttempts = 0;
      conexao.nextReconnectAt = null;
      conexao.lastError = null;
      conexao.ativo = false;
      conexao.autoReconnect = false;
    }
  }
  if (autoReconnect !== undefined) conexao.autoReconnect = autoReconnect === true;
  if (reference !== undefined) conexao.numeroExibicao = reference;
  save();
  return visaoPublica(conexao);
}

/**
 * Vigia de reconexão: se a conexão caiu, pede nova conexão ao backend com
 * espera crescente (1, 2, 5, 10, 15, 30 min). Quando a sessão salva ainda é
 * válida o backend reabre sozinho; se o WhatsApp exigir, um novo QR fica
 * disponível na tela.
 */
export async function vigiarConexao(empresaId, { now = Date.now(), fetchImpl, tipoCanal = 'cliente' } = {}) {
  const conexao = obterConexao(empresaId, tipoCanal);
  const key = String(empresaId);
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (!conexao.ativo || conexao.autoReconnect === false || !conexao.instance) return { action: 'skip', reason: 'inactive' };
  const epoch = disconnectEpoch.get(key) || 0;
  const instance = conexao.instance;
  const status = await getInstanceStatus(instance, fetchImpl);
  // O GET pode ter começado ANTES do logout; não aplicar estado nem pedir QR
  // depois que a ação de desconexão adquiriu o lock em memória.
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { action: 'skip', reason: 'connection_changed' };
  aplicarEstado(conexao, status);
  if (!status.ok || status.authError) { save(); return { action: 'status_unavailable' }; }
  if (conexao.state === 'open' || conexao.state === 'connecting') { save(); return { action: 'none', state: conexao.state }; }
  if (conexao.nextReconnectAt && new Date(conexao.nextReconnectAt).getTime() > now) { save(); return { action: 'waiting', until: conexao.nextReconnectAt }; }
  const attempt = (conexao.reconnectAttempts || 0) + 1;
  const result = await requestInstanceQr(instance, fetchImpl);
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { action: 'skip', reason: 'connection_changed' };
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
    try { resultados.push({ empresaId: conexao.empresaId, tipoCanal: conexao.tipoCanal || 'cliente', ...(await vigiarConexao(conexao.empresaId, { ...options, tipoCanal: conexao.tipoCanal || 'cliente' })) }); }
    catch (error) { resultados.push({ empresaId: conexao.empresaId, action: 'error', error: String(error?.message || error).slice(0, 120) }); }
  }
  return resultados;
}

/** Evento connection.update recebido pelo webhook do canal. */
export function registrarEventoConexao(empresaId, state, tipoCanal = 'cliente') {
  const conexao = obterConexao(empresaId, tipoCanal);
  if (disconnecting.has(String(empresaId)) || (!conexao.ativo && conexao.autoReconnect === false)) return visaoPublica(conexao);
  aplicarEstado(conexao, { ok: true, state });
  if (conexao.state !== 'open') conexao.nextReconnectAt = null; // reconecta no próximo ciclo do vigia
  save();
  return visaoPublica(conexao);
}
