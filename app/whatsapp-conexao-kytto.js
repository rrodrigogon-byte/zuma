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
  setPersistedInstanceRegistrySource, instanceOwner,
} from './core/whatsapp-provider.js';
import {
  getWahaSessionQr, getWahaSessionStatus, logoutWahaSession, provisionWahaSession,
  requestWahaPairingCode, validWahaSession, wahaControlConfigured, wahaProviderSummary,
} from './core/whatsapp-waha.js';

const HISTORY_LIMIT = 40;
const BACKOFF_MINUTES = [1, 2, 5, 10, 15, 30];
const disconnecting = new Set();
const disconnectEpoch = new Map();

function normalizarTipoCanal(value = 'cliente') {
  const normalized = String(value || 'cliente').toLowerCase();
  return ['cliente', 'gestao', 'lancamentos'].includes(normalized) ? normalized : 'cliente';
}

function canalInterno(tipoCanal = 'cliente') {
  return normalizarTipoCanal(tipoCanal) !== 'cliente';
}

function normalizarEstadoWaha(value) {
  const state = String(value || '').trim().toUpperCase();
  if (state === 'WORKING') return 'open';
  if (state === 'SCAN_QR_CODE') return 'qr';
  if (['STARTING', 'AUTHENTICATING', 'RESTARTING'].includes(state)) return 'connecting';
  if (['STOPPED', 'FAILED', 'LOGGED_OUT'].includes(state)) return 'close';
  return 'unknown';
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
const UUID_EMPRESA = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A instância do canal Clientes foi atribuída (ou confirmada) pela administração
// da plataforma. Registros anteriores comprovam isso pelo evento 'instancia_alterada',
// que só a plataforma consegue gerar (configurar exige podeTrocarInstancia).
export function instanciaConfirmadaPelaPlataforma(conexao) {
  if (!conexao?.instance) return false;
  if (conexao.instanciaConfirmadaPelaPlataforma === true) return true;
  const comprovada = (conexao.history || []).some((item) => item?.tipo === 'instancia_alterada' && String(item?.detalhe || '').endsWith(`→ ${conexao.instance}`));
  // Fixa a comprovação no registro: o histórico é curto e o evento pode sair dele.
  if (comprovada) conexao.instanciaConfirmadaPelaPlataforma = true;
  return comprovada;
}

// Empresas cuja instância do canal Clientes foi atribuída no painel passam a ser
// donas dela no servidor (entrada, saída e diagnóstico) sem editar variável no
// Render. A linha conta como conferida depois do primeiro pareamento por QR.
export function instanciasAtribuidasNoPainel() {
  return Object.values(store())
    .filter((c) => normalizarTipoCanal(c?.tipoCanal) === 'cliente' && UUID_EMPRESA.test(String(c?.empresaId || '')) && instanciaConfirmadaPelaPlataforma(c))
    .map((c) => ({ instance: c.instance, owner: String(c.empresaId).toLowerCase(), lineVerified: Boolean(c.lastConnectedAt) }));
}

setPersistedInstanceRegistrySource(instanciasAtribuidasNoPainel);

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

  // Canais internos nunca herdam uma instância Evolution/Cliente. A sessão WAHA
  // precisa ser atribuída explicitamente pela administração da plataforma.
  if (perfil !== 'cliente') return '';

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
    transport: perfil === 'cliente' ? 'legado' : 'waha',
  };
  if (perfil !== 'cliente' && empresas[storageKey].transport !== 'waha') {
    empresas[storageKey].instance = '';
    empresas[storageKey].state = 'unknown';
    empresas[storageKey].phone = '';
    empresas[storageKey].ativo = false;
    empresas[storageKey].autoReconnect = false;
    empresas[storageKey].transport = 'waha';
  }
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

// O watchdog roda a cada minuto. lastCheckAt é um sinal volátil de saúde e não
// precisa reescrever o db.json inteiro (que pode ter dezenas de MB) a cada GET.
// Todo o restante continua sendo persistido quando realmente muda: estado,
// telefone confirmado, erro, reconexão, timestamps operacionais e histórico.
function estadoPersistivel(conexao) {
  const { lastCheckAt, ...persistivel } = conexao;
  return JSON.stringify(persistivel);
}

function salvarSeEstadoMudou(antes, conexao) {
  if (antes !== estadoPersistivel(conexao)) save();
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
  const provider = canalInterno(conexao.tipoCanal) ? wahaProviderSummary() : providerSummary();
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
    // Canal Clientes: a empresa é a dona registrada da instância (variável do Render
    // ou atribuição confirmada pela plataforma). Sem isso nada entra nem sai.
    ...(canalInterno(conexao.tipoCanal) ? {} : {
      instanciaConfirmada: instanciaConfirmadaPelaPlataforma(conexao),
      donoRegistrado: Boolean(conexao.instance) && instanceOwner(conexao.instance) === String(conexao.empresaId || '').toLowerCase(),
    }),
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
  // mesma regra do watchdog: só grava o banco quando algo além de lastCheckAt mudou
  const antes = estadoPersistivel(conexao);
  if (canalInterno(tipoCanal)) {
    if (!wahaControlConfigured()) { conexao.lastError = 'waha_nao_configurado'; return visaoPublica(conexao); }
    if (!validWahaSession(conexao.instance)) { conexao.lastError = 'instancia_nao_atribuida'; return visaoPublica(conexao); }
    const status = await getWahaSessionStatus(conexao.instance);
    aplicarEstado(conexao, { ok: true, state: normalizarEstadoWaha(status?.status), phone: '' });
    if (conexao.state === 'open' && conexao.autoReconnect !== false) conexao.ativo = true;
    salvarSeEstadoMudou(antes, conexao);
    return visaoPublica(conexao);
  }
  if (whatsappProviderName() !== 'chatbot_backend') {
    conexao.lastError = 'provedor_nao_e_nossagente';
    return visaoPublica(conexao);
  }
  if (semInstancia(conexao)) { conexao.lastError = 'instancia_nao_atribuida'; return visaoPublica(conexao); }
  const key = chaveConexao(empresaId, tipoCanal);
  const epoch = disconnectEpoch.get(key) || 0;
  const instance = conexao.instance;
  const resultado = await getInstanceStatus(instance, fetchImpl);
  if (disconnecting.has(key) || epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return visaoPublica(conexao);
  aplicarEstado(conexao, resultado);
  // Se o backend confirma a sessão aberta, a conexão precisa continuar ativa
  // mesmo quando uma tentativa anterior de logout falhou depois de persistir
  // apenas o estado local.
  if (resultado.ok && resultado.state === 'open' && conexao.autoReconnect !== false) conexao.ativo = true;
  salvarSeEstadoMudou(antes, conexao);
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
  if (canalInterno(tipoCanal)) {
    if (!wahaControlConfigured()) return { ok: false, error: 'Controle privado WAHA não configurado no servidor.', code: 'WAHA_NOT_CONFIGURED', conexao: visaoPublica(conexao) };
    if (!validWahaSession(conexao.instance)) return { ok: false, error: 'Esta empresa ainda não tem uma sessão WAHA atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED', conexao: visaoPublica(conexao) };
    try {
      const provisioned = await provisionWahaSession(conexao.instance);
      const state = normalizarEstadoWaha(provisioned?.status);
      const qr = state === 'open' ? '' : (await getWahaSessionQr(conexao.instance)).dataUrl;
      if (!qr && state !== 'open') {
        return { ok: false, error: 'A instância está iniciando. Aguarde 10 segundos e clique em Gerar QR novamente.', code: 'WAHA_STARTING', conexao: visaoPublica(conexao) };
      }
      conexao.ativo = true;
      conexao.state = state === 'open' ? 'open' : (qr ? 'qr' : 'connecting');
      conexao.phone = '';
      conexao.lastCheckAt = new Date().toISOString();
      conexao.lastQrAt = qr ? conexao.lastCheckAt : conexao.lastQrAt;
      conexao.lastError = null;
      if (registrarHistorico) registrar(conexao, qr ? 'qr_gerado' : 'reconexao_solicitada', usuario ? `por ${usuario}` : '');
      save();
      return { ok: true, qr, pairingCode: '', conexao: visaoPublica(conexao) };
    } catch (error) {
      return { ok: false, error: String(error?.message || 'Erro ao gerar QR Code'), code: 'WAHA_ERROR', conexao: visaoPublica(conexao) };
    }
  }
  const bloqueio = semInstancia(conexao);
  if (bloqueio) return { ...bloqueio, conexao: visaoPublica(conexao) };
  const key = chaveConexao(empresaId, tipoCanal);
  if (disconnecting.has(key)) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'Desconexão em andamento.', conexao: visaoPublica(conexao) };
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

export async function solicitarCodigoPareamento(empresaId, { phoneNumber = '', usuario = '', tipoCanal = 'cliente' } = {}) {
  const perfil = normalizarTipoCanal(tipoCanal);
  const conexao = obterConexao(empresaId, perfil);
  if (!canalInterno(perfil)) return { ok: false, code: 'PAIRING_CODE_INTERNAL_ONLY', error: 'O código de pareamento pertence somente aos canais internos WAHA.', conexao: visaoPublica(conexao) };
  if (!wahaControlConfigured()) return { ok: false, code: 'WAHA_NOT_CONFIGURED', error: 'Controle privado WAHA não configurado no servidor.', conexao: visaoPublica(conexao) };
  if (!validWahaSession(conexao.instance)) return { ok: false, code: 'WHATSAPP_INSTANCE_UNASSIGNED', error: 'Esta empresa ainda não tem uma sessão WAHA atribuída.', conexao: visaoPublica(conexao) };
  let reference;
  try { reference = numeroReferencia(phoneNumber); } catch (error) { return { ok: false, code: 'INVALID_PHONE', error: error.message, conexao: visaoPublica(conexao) }; }
  try {
    const provisioned = await provisionWahaSession(conexao.instance);
    if (normalizarEstadoWaha(provisioned?.status) === 'open') {
      return { ok: false, code: 'WHATSAPP_ALREADY_CONNECTED', error: 'Esta sessão já está conectada. Verifique o status e o número pareado.', conexao: visaoPublica(conexao) };
    }
    const pairingCode = await requestWahaPairingCode(conexao.instance, reference);
    conexao.numeroExibicao = reference;
    conexao.ativo = true;
    conexao.autoReconnect = true;
    conexao.state = 'connecting';
    conexao.phone = '';
    conexao.lastCheckAt = new Date().toISOString();
    conexao.lastError = null;
    registrar(conexao, 'codigo_pareamento_gerado', usuario ? `por ${usuario}` : '');
    save();
    return { ok: true, pairingCode, conexao: visaoPublica(conexao) };
  } catch (error) {
    return { ok: false, code: 'PAIRING_CODE_FAILED', error: String(error?.message || 'Não foi possível gerar o código de pareamento.').slice(0, 180), conexao: visaoPublica(conexao) };
  }
}

export async function desconectar(empresaId, { usuario = '', fetchImpl, tipoCanal = 'cliente', forcar = false } = {}) {
  const conexao = obterConexao(empresaId, tipoCanal);
  if (canalInterno(tipoCanal)) {
    if (!wahaControlConfigured()) return { ok: false, error: 'Controle privado WAHA não configurado no servidor.', code: 'WAHA_NOT_CONFIGURED', conexao: visaoPublica(conexao) };
    if (!validWahaSession(conexao.instance)) return { ok: false, error: 'Esta empresa ainda não tem uma sessão WAHA atribuída.', code: 'WHATSAPP_INSTANCE_UNASSIGNED', conexao: visaoPublica(conexao) };
    await logoutWahaSession(conexao.instance);
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
  }
  const bloqueio = semInstancia(conexao);
  if (bloqueio) return { ...bloqueio, conexao: visaoPublica(conexao) };
  const key = chaveConexao(empresaId, tipoCanal);
  if (disconnecting.has(key)) return { ok: false, code: 'WHATSAPP_DISCONNECT_IN_PROGRESS', error: 'Desconexão em andamento.', conexao: visaoPublica(conexao) };
  disconnecting.add(key);
  disconnectEpoch.set(key, (disconnectEpoch.get(key) || 0) + 1);
  try {
    const resultado = await disconnectInstance(conexao.instance, fetchImpl);
    // Um timeout pode acontecer DEPOIS do reset; GET é seguro, DELETE não deve ser repetido.
    // Recusa do DELETE (ex.: 4xx porque não há sessão) também é conferida pelo GET: se o
    // backend confirma que o número não está conectado, não há o que desconectar.
    const status = resultado.authError ? null : await getInstanceStatus(conexao.instance, fetchImpl, { resolvePhone: false });
    
    // Considera sem sessão (desconectado) se:
    // 1) Forçado pelo usuário ou pela interface (forcar: true);
    // 2) O status responder explicitamente 'close' ou 'qr';
    // 3) O DELETE ou status reportar 404 (instância/sessão inexistente no gateway);
    // 4) O DELETE foi bem-sucedido (resultado.ok === true) e o status não reporta 'open';
    // 5) A conexão local já não estava 'open' (ex.: estado qr, close, aguardando linha) e o status não reporta 'open'.
    // Considera sem sessão (desconectado) se:
    // 1) Forçado pelo usuário ou pela interface (forcar: true);
    // 2) O status responder explicitamente 'close' ou 'qr';
    // 3) A conexão local já não estava 'open' (ex.: estado qr, close, aguardando linha) e o status não reporta 'open'.
    const semSessao = forcar === true
      || (status?.ok === true && ['close', 'qr'].includes(status.state))
      || (conexao.state !== 'open' && status?.state !== 'open');

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
  conexao.transport = perfil === 'cliente' ? 'legado' : 'waha';
  const reference = numeroExibicao !== undefined ? numeroReferencia(numeroExibicao) : undefined;
  // A plataforma pode confirmar a instância atual (registro de dono sem variável de ambiente).
  if (instance !== undefined && podeTrocarInstancia && perfil === 'cliente' && instance === conexao.instance && conexao.instance && !conexao.instanciaConfirmadaPelaPlataforma) {
    conexao.instanciaConfirmadaPelaPlataforma = true;
    registrar(conexao, 'instancia_confirmada', conexao.instance);
  }
  if (instance !== undefined && instance !== conexao.instance) {
    // Trocar a instância muda qual número do backend a empresa controla: só a
    // administração da plataforma faz isso, e nunca para uma instância de outra empresa.
    if (!podeTrocarInstancia) throw new Error('A instância é atribuída pela administração da plataforma.');
    const valida = canalInterno(perfil) ? validWahaSession(instance) : validInstance(instance);
    if (!valida) throw new Error('Instância inválida: use letras minúsculas, números, - ou _.');
    if (instanciaEmUso(valida, empresaId, perfil)) throw new Error('Esta instância já pertence a outra empresa ou canal.');
    if (valida !== conexao.instance) {
      const key = chaveConexao(empresaId, perfil);
      if (disconnecting.has(key)) throw new Error('Aguarde o fim da desconexão antes de trocar a instância.');
      disconnectEpoch.set(key, (disconnectEpoch.get(key) || 0) + 1);
      conexao.history = (conexao.history || []).map((item) => ({ ...item, instance: item.instance || conexao.instance }));
      registrar(conexao, 'instancia_alterada', `${conexao.instance} → ${valida}`);
      conexao.instance = valida;
      conexao.instanciaConfirmadaPelaPlataforma = perfil === 'cliente';
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
  const key = chaveConexao(empresaId, tipoCanal);
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (!conexao.ativo || conexao.autoReconnect === false || !conexao.instance) return { action: 'skip', reason: 'inactive' };
  if (canalInterno(tipoCanal)) {
    if (!wahaControlConfigured()) {
      const antes = estadoPersistivel(conexao);
      conexao.lastError = 'waha_nao_configurado';
      salvarSeEstadoMudou(antes, conexao);
      return { action: 'status_unavailable' };
    }
    try {
      const status = await getWahaSessionStatus(conexao.instance);
      const antes = estadoPersistivel(conexao);
      aplicarEstado(conexao, { ok: true, state: normalizarEstadoWaha(status?.status) });
      salvarSeEstadoMudou(antes, conexao);
      return { action: 'none', state: conexao.state };
    } catch (error) {
      const antes = estadoPersistivel(conexao);
      conexao.lastError = String(error?.message || 'waha_error').slice(0, 180);
      salvarSeEstadoMudou(antes, conexao);
      return { action: 'status_unavailable' };
    }
  }
  const epoch = disconnectEpoch.get(key) || 0;
  const instance = conexao.instance;
  const status = await getInstanceStatus(instance, fetchImpl);
  // O GET pode ter começado ANTES do logout; não aplicar estado nem pedir QR
  // depois que a ação de desconexão adquiriu o lock em memória.
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { action: 'skip', reason: 'connection_changed' };
  const antes = estadoPersistivel(conexao);
  aplicarEstado(conexao, status);
  if (!status.ok || status.authError) { salvarSeEstadoMudou(antes, conexao); return { action: 'status_unavailable' }; }
  if (conexao.state === 'open' || conexao.state === 'connecting') { salvarSeEstadoMudou(antes, conexao); return { action: 'none', state: conexao.state }; }
  if (conexao.nextReconnectAt && new Date(conexao.nextReconnectAt).getTime() > now) { salvarSeEstadoMudou(antes, conexao); return { action: 'waiting', until: conexao.nextReconnectAt }; }
  const attempt = (conexao.reconnectAttempts || 0) + 1;
  const result = await requestInstanceQr(instance, fetchImpl);
  if (disconnecting.has(key)) return { action: 'skip', reason: 'disconnect_in_progress' };
  if (epoch !== (disconnectEpoch.get(key) || 0) || conexao.instance !== instance) return { action: 'skip', reason: 'connection_changed' };
  conexao.reconnectAttempts = attempt;
  const minutes = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
  conexao.nextReconnectAt = new Date(now + minutes * 60_000).toISOString();
  registrar(conexao, 'reconexao_automatica', `tentativa ${attempt}${result.ok ? '' : ' (backend indisponível)'}`);
  if (result.ok && result.state === 'open') { conexao.state = 'open'; conexao.reconnectAttempts = 0; conexao.nextReconnectAt = null; }
  salvarSeEstadoMudou(antes, conexao);
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
  if (disconnecting.has(chaveConexao(empresaId, tipoCanal)) || (!conexao.ativo && conexao.autoReconnect === false)) return visaoPublica(conexao);
  aplicarEstado(conexao, { ok: true, state });
  if (conexao.state !== 'open') conexao.nextReconnectAt = null; // reconecta no próximo ciclo do vigia
  save();
  return visaoPublica(conexao);
}
