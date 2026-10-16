import { validWahaGroupId, validWahaSession } from './whatsapp-waha.js';

const WEBHOOK_SECRET = /^(?:WAHA_WEBHOOK_SECRET|WHATSAPP_AI_WEBHOOK_SECRET)(?:_[A-Z0-9]+)?$/;
const HMAC_SECRET = /^WAHA_WEBHOOK_HMAC_KEY(?:_[A-Z0-9]+)?$/;

function envName(value) {
  const name = String(value ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{2,149}$/.test(name) ? name : '';
}

function channelConfig(row) {
  return row?.configuracao && typeof row.configuracao === 'object' && !Array.isArray(row.configuracao)
    ? row.configuracao
    : {};
}

function referencedWebhookSecret(row, config) {
  const configured = envName(config.segredo_env);
  if (configured) return configured;
  const reference = String(row?.credencial_referencia ?? '').trim();
  return reference.startsWith('ENV:') ? envName(reference.slice(4)) : '';
}

function connectedFromStatus(status) {
  if (status && status.ok === false) return null;
  const raw = status?.status ?? status?.state ?? status?.connectionState;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim().toUpperCase();
  if (['WORKING', 'OPEN', 'CONNECTED', 'READY'].includes(value)) return true;
  if (['STOPPED', 'FAILED', 'STARTING', 'SCAN_QR_CODE', 'STOPPING', 'CLOSED', 'CLOSE', 'DISCONNECTED', 'OFFLINE', 'OPENING', 'CONNECTING'].includes(value)) return false;
  return null;
}

function conclusion(titulo, ok, detalhe) {
  return { titulo, ok, detalhe };
}

function boolDetail(value, yes, no, unknown = 'Não foi possível verificar este item agora.') {
  return value === null ? unknown : (value ? yes : no);
}

function conclusions(readiness, errors = {}) {
  const out = [];
  out.push(conclusion(
    'Controle WAHA',
    readiness.controlConfigured,
    boolDetail(
      readiness.controlConfigured,
      'Controle privado WAHA configurado.',
      'Controle privado WAHA não configurado no servidor.',
      'Não foi possível verificar a configuração do controle privado WAHA.',
    ),
  ));
  out.push(conclusion(
    'Canal WAHA da unidade',
    readiness.channelConfigured,
    boolDetail(
      readiness.channelConfigured,
      'Registro do canal WAHA encontrado para esta empresa, unidade e perfil.',
      'Não há canal WAHA configurado para esta empresa, unidade e perfil.',
      errors.channel ? 'Não foi possível ler o canal WAHA desta empresa e unidade.' : undefined,
    ),
  ));
  out.push(conclusion(
    'Sessão WAHA atribuída',
    readiness.sessionAssigned,
    boolDetail(
      readiness.sessionAssigned,
      'Sessão WAHA atribuída ao canal desta unidade.',
      'Sessão WAHA ausente ou inconsistente no canal desta unidade.',
      'Não foi possível verificar a atribuição da sessão WAHA.',
    ),
  ));
  out.push(conclusion(
    'Sessão WAHA conectada',
    readiness.sessionConnected,
    boolDetail(
      readiness.sessionConnected,
      'Sessão WAHA conectada.',
      'Sessão WAHA não está conectada.',
      errors.session ? 'Não foi possível consultar o estado da sessão WAHA.' : 'A sessão WAHA ainda não pode ser consultada.',
    ),
  ));
  out.push(conclusion(
    'Grupo Admin',
    readiness.groupConfigured,
    boolDetail(
      readiness.groupConfigured,
      'Grupo Admin configurado para este canal.',
      'Grupo Admin ausente ou inválido no canal desta unidade.',
      'Não foi possível verificar o grupo Admin.',
    ),
  ));
  out.push(conclusion(
    'Segredo do webhook',
    readiness.webhookSecretConfigured,
    boolDetail(
      readiness.webhookSecretConfigured,
      'Segredo do webhook configurado.',
      'Segredo do webhook ausente, inválido ou não configurado no ambiente.',
      'Não foi possível verificar o segredo do webhook.',
    ),
  ));
  out.push(conclusion(
    'Segredo HMAC',
    readiness.hmacSecretConfigured,
    boolDetail(
      readiness.hmacSecretConfigured,
      'Segredo HMAC configurado.',
      'Segredo HMAC ausente, inválido ou não configurado no ambiente.',
      'Não foi possível verificar o segredo HMAC.',
    ),
  ));
  return out;
}

/**
 * Diagnóstico interno WAHA: somente leitura, sem legado, sem conteúdo e sem
 * retornar qualquer identificador privado. Todas as dependências externas são
 * recebidas pelo chamador para permitir testes sem rede nem banco real.
 */
export async function diagnosticarWahaReadiness({
  empresaId,
  lojaId,
  tipoCanal,
  assignedSession = '',
  database,
  wahaControlConfigured,
  getWahaSessionStatus,
  env = process.env,
  now = () => new Date(),
} = {}) {
  const checkedAt = new Date(typeof now === 'function' ? now() : now).toISOString();
  const readiness = {
    controlConfigured: null,
    sessionAssigned: null,
    sessionConnected: null,
    channelConfigured: null,
    groupConfigured: null,
    webhookSecretConfigured: null,
    hmacSecretConfigured: null,
  };
  const errors = {};
  let channel = null;

  try {
    const result = await database.queryRead(
      `SELECT configuracao, credencial_referencia, status
         FROM canais_integracao
        WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND tipo_canal = $3
        LIMIT 1`,
      [empresaId, lojaId, tipoCanal],
    );
    if (!result || !Array.isArray(result.rows)) throw new Error('invalid_read');
    channel = result.rows[0] || null;
    readiness.channelConfigured = Boolean(channel);
  } catch {
    errors.channel = true;
  }

  try {
    readiness.controlConfigured = Boolean(wahaControlConfigured());
  } catch {
    // Configuração indisponível para leitura: preserve unknown, não false.
  }

  if (channel) {
    const config = channelConfig(channel);
    const isWaha = String(config.transporte || '').trim().toLowerCase() === 'waha'
      && String(config.provider || '').trim().toLowerCase() === 'waha';
    readiness.channelConfigured = isWaha;
    const configuredSession = validWahaSession(config.waha_session);
    const channelInstance = validWahaSession(config.instance);
    const assigned = validWahaSession(assignedSession);
    readiness.sessionAssigned = isWaha && Boolean(assigned && configuredSession && channelInstance
      && assigned === configuredSession && configuredSession === channelInstance);
    readiness.groupConfigured = isWaha && Boolean(validWahaGroupId(config.waha_group_id));

    const webhookName = referencedWebhookSecret(channel, config);
    readiness.webhookSecretConfigured = isWaha && Boolean(WEBHOOK_SECRET.test(webhookName) && env?.[webhookName]);
    const hmacName = envName(config.waha_hmac_env);
    readiness.hmacSecretConfigured = isWaha && Boolean(HMAC_SECRET.test(hmacName) && env?.[hmacName]);

    if (readiness.sessionAssigned === true && readiness.controlConfigured === true) {
      try {
        const status = await getWahaSessionStatus(configuredSession);
        readiness.sessionConnected = connectedFromStatus(status);
        if (readiness.sessionConnected === null) errors.session = true;
      } catch {
        errors.session = true;
      }
    }
  } else if (!errors.channel) {
    readiness.sessionAssigned = false;
    readiness.groupConfigured = false;
    readiness.webhookSecretConfigured = false;
    readiness.hmacSecretConfigured = false;
  }

  return {
    tipoCanal,
    transporte: 'waha',
    agora: checkedAt,
    checkedAt,
    readiness,
    conclusoes: conclusions(readiness, errors),
  };
}
