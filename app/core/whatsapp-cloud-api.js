// ============================================================================
// META WHATSAPP BUSINESS CLOUD API (OFFICIAL GRAPH API)
// Suporte ao provedor oficial da Meta para mensagens empresariais seguras,
// templates HSM aprovados, botões interativos e zero risco de banimento.
// ============================================================================

import fetch from 'node-fetch';

export const META_GRAPH_VERSION = 'v22.0';
export const META_GRAPH_BASE = 'https://graph.facebook.com';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function formatPhoneNumberE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/**
 * Obtém as configurações da Meta Cloud API para o canal/empresa.
 */
export function getCloudApiConfig(channelOrConfig = {}) {
  const cfg = channelOrConfig.configuracao || channelOrConfig;
  return {
    token: clean(cfg.meta_access_token || cfg.whatsapp_token || process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_TOKEN || ''),
    phoneNumberId: clean(cfg.meta_phone_number_id || cfg.phone_number_id || process.env.META_PHONE_NUMBER_ID || ''),
    wabaId: clean(cfg.meta_waba_id || cfg.waba_id || process.env.META_WABA_ID || ''),
    verifyToken: clean(cfg.meta_verify_token || cfg.webhook_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || 'kytto_meta_webhook_2026'),
    apiVersion: clean(cfg.api_version || process.env.META_API_VERSION || META_GRAPH_VERSION),
  };
}

/**
 * Executa uma chamada à Graph API da Meta
 */
async function callMetaGraph({ endpoint, method = 'GET', token, body, fetchImpl = fetch }) {
  if (!token) {
    return { ok: false, status: 401, error: 'Token de acesso da Meta Cloud API não configurado.' };
  }
  const url = `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${endpoint.replace(/^\//, '')}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetchImpl(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeout: 15000,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data.error || {};
      return {
        ok: false,
        status: res.status,
        code: err.code || 'META_API_ERROR',
        error: err.message || `Erro HTTP ${res.status} na Meta Cloud API`,
        type: err.type,
        fbtrace_id: err.fbtrace_id,
        error_subcode: err.error_subcode,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 500, error: `Falha de rede ao conectar à Meta Cloud API: ${e.message}` };
  }
}

/**
 * Envia mensagem de texto simples via Meta Cloud API
 */
export async function sendCloudApiTextMessage({ phoneNumberId, token, to, text, previewUrl = false, fetchImpl = fetch }) {
  const recipient = formatPhoneNumberE164(to);
  if (!recipient) return { ok: false, error: 'Número de telefone do destinatário inválido.' };
  if (!text) return { ok: false, error: 'Texto da mensagem não pode ser vazio.' };

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: {
      preview_url: Boolean(previewUrl),
      body: String(text).slice(0, 4096),
    },
  };

  const res = await callMetaGraph({
    endpoint: `${phoneNumberId}/messages`,
    method: 'POST',
    token,
    body: payload,
    fetchImpl,
  });

  if (res.ok && res.data?.messages?.[0]?.id) {
    return {
      ok: true,
      messageId: res.data.messages[0].id,
      recipient,
      status: 'sent',
    };
  }
  return res;
}

/**
 * Envia mensagem interativa com botões de resposta rápida (ex: CONFIRMAR, REMARCAR, CANCELAR)
 */
export async function sendCloudApiInteractiveButtons({ phoneNumberId, token, to, bodyText, buttons = [], headerText = '', footerText = '', fetchImpl = fetch }) {
  const recipient = formatPhoneNumberE164(to);
  if (!recipient) return { ok: false, error: 'Telefone do destinatário inválido.' };
  if (!bodyText) return { ok: false, error: 'Texto da mensagem não pode ser vazio.' };
  if (!buttons.length || buttons.length > 3) return { ok: false, error: 'A Meta permite de 1 a 3 botões por mensagem interativa.' };

  const actionButtons = buttons.map((b, idx) => ({
    type: 'reply',
    reply: {
      id: clean(b.id || `btn_${idx + 1}`, 256),
      title: clean(b.title || b.label || `Opção ${idx + 1}`, 20),
    },
  }));

  const interactive = {
    type: 'button',
    body: { text: String(bodyText).slice(0, 1024) },
    action: { buttons: actionButtons },
  };

  if (headerText) {
    interactive.header = { type: 'text', text: String(headerText).slice(0, 60) };
  }
  if (footerText) {
    interactive.footer = { text: String(footerText).slice(0, 60) };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'interactive',
    interactive,
  };

  const res = await callMetaGraph({
    endpoint: `${phoneNumberId}/messages`,
    method: 'POST',
    token,
    body: payload,
    fetchImpl,
  });

  if (res.ok && res.data?.messages?.[0]?.id) {
    return {
      ok: true,
      messageId: res.data.messages[0].id,
      recipient,
      status: 'sent',
    };
  }
  return res;
}

/**
 * Envia mensagem oficial usando template HSM aprovado pela Meta
 */
export async function sendCloudApiTemplateMessage({ phoneNumberId, token, to, templateName, languageCode = 'pt_BR', components = [], fetchImpl = fetch }) {
  const recipient = formatPhoneNumberE164(to);
  if (!recipient) return { ok: false, error: 'Telefone do destinatário inválido.' };
  if (!templateName) return { ok: false, error: 'Nome do template não pode ser vazio.' };

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: clean(templateName, 512),
      language: { code: clean(languageCode, 10) },
      components: Array.isArray(components) ? components : [],
    },
  };

  const res = await callMetaGraph({
    endpoint: `${phoneNumberId}/messages`,
    method: 'POST',
    token,
    body: payload,
    fetchImpl,
  });

  if (res.ok && res.data?.messages?.[0]?.id) {
    return {
      ok: true,
      messageId: res.data.messages[0].id,
      recipient,
      status: 'sent',
    };
  }
  return res;
}

/**
 * Consulta lista de templates cadastrados na WABA
 */
export async function listCloudApiTemplates({ wabaId, token, limit = 50, fetchImpl = fetch }) {
  if (!wabaId) return { ok: false, error: 'WABA ID não informado.' };
  return callMetaGraph({
    endpoint: `${wabaId}/message_templates?limit=${limit}`,
    method: 'GET',
    token,
    fetchImpl,
  });
}

/**
 * Consulta informações do número de telefone (status de qualidade, nome de exibição, etc.)
 */
export async function getCloudApiPhoneNumberInfo({ phoneNumberId, token, fetchImpl = fetch }) {
  if (!phoneNumberId) return { ok: false, error: 'Phone Number ID não informado.' };
  return callMetaGraph({
    endpoint: `${phoneNumberId}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,status`,
    method: 'GET',
    token,
    fetchImpl,
  });
}

/**
 * Validação do Webhook da Meta (Desafio GET de Handshake)
 */
export function verifyMetaWebhookChallenge(query = {}, expectedVerifyToken = '') {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode === 'subscribe' && token === expectedVerifyToken) {
    return { verified: true, challenge };
  }
  return { verified: false, error: 'Token de verificação do webhook inválido ou modo incorreto.' };
}

/**
 * Parse e normalização de mensagens recebidas pelo Webhook da Meta Cloud API
 */
export function parseMetaWebhookEvent(body = {}) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0]?.value;

  if (!change) return null;

  const contacts = change.contacts || [];
  const messages = change.messages || [];
  const statuses = change.statuses || [];

  const parsedMessages = messages.map(msg => {
    let text = '';
    let type = msg.type || 'text';
    let buttonId = null;

    if (type === 'text') {
      text = msg.text?.body || '';
    } else if (type === 'interactive') {
      if (msg.interactive?.type === 'button_reply') {
        text = msg.interactive.button_reply?.title || '';
        buttonId = msg.interactive.button_reply?.id || null;
      } else if (msg.interactive?.type === 'list_reply') {
        text = msg.interactive.list_reply?.title || '';
        buttonId = msg.interactive.list_reply?.id || null;
      }
    } else if (type === 'button') {
      text = msg.button?.text || '';
    }

    const contact = contacts.find(c => c.wa_id === msg.from);

    return {
      messageId: msg.id,
      from: msg.from,
      senderName: contact?.profile?.name || '',
      timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
      type,
      text,
      buttonId,
      raw: msg,
    };
  });

  return {
    metadata: change.metadata || {},
    messages: parsedMessages,
    statuses,
  };
}
