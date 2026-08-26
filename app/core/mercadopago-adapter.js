import crypto from 'crypto';
import { CommerceError } from './commerce-core.js';

const API_BASE = 'https://api.mercadopago.com';

function envSecret(name, fallback) {
  const key = String(name || '').trim();
  if (key && /^[A-Z][A-Z0-9_]{1,79}$/.test(key) && process.env[key]) return process.env[key];
  return fallback && process.env[fallback] ? process.env[fallback] : '';
}

function parseSignature(value) {
  const result = {};
  for (const part of String(value || '').split(',')) {
    const [key, content] = part.trim().split('=');
    if (key && content) result[key] = content;
  }
  return result;
}

function equalHex(left, right) {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requestHeaders(token, idempotencyKey) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  };
}

async function mpRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || `Mercado Pago HTTP ${response.status}`);
    error.status = response.status;
    error.providerBody = body;
    throw error;
  }
  return body;
}

function accessToken(account) {
  const token = envSecret(account?.secretRef, 'MP_ACCESS_TOKEN');
  if (!token) throw new CommerceError('access token do Mercado Pago não configurado no secret manager', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  return token;
}

function webhookSecret(account) {
  return envSecret(account?.secretRef ? `${account.secretRef}_WEBHOOK_SECRET` : '', 'MP_WEBHOOK_SECRET');
}

export function createMercadoPagoAdapter() {
  return {
    async createCheckout({ payment, order, account, idempotencyKey }) {
      if (payment.method !== 'pix') throw new CommerceError('Mercado Pago inicial está homologado somente para Pix', 'PAYMENT_METHOD_INVALID');
      const token = accessToken(account);
      const email = String(order.customerEmail || '').trim().toLowerCase();
      if (!email) throw new CommerceError('e-mail do pagador é obrigatório para Pix', 'PAYMENT_PROVIDER_ERROR');
      const payload = {
        transaction_amount: Number(order.total),
        description: `Pedido Kytto ${order.id}`,
        payment_method_id: 'pix',
        payer: { email },
        external_reference: order.id,
      };
      const response = await mpRequest('/v1/payments', {
        method: 'POST',
        headers: requestHeaders(token, idempotencyKey),
        body: JSON.stringify(payload),
      });
      const transaction = response.point_of_interaction?.transaction_data || {};
      if (!response.id) throw new CommerceError('Mercado Pago retornou pagamento sem identificador', 'PAYMENT_ADAPTER_INVALID_RESPONSE');
      return {
        providerPaymentId: String(response.id),
        publicData: {
          status: response.status || 'pending',
          statusDetail: response.status_detail || null,
          qrCode: transaction.qr_code || null,
          qrCodeBase64: transaction.qr_code_base64 || null,
          ticketUrl: transaction.ticket_url || null,
        },
      };
    },

    async verifyWebhook({ payload, signature, context }) {
      const secret = webhookSecret(context?.account);
      if (!secret) throw new CommerceError('segredo de webhook do Mercado Pago não configurado', 'PAYMENT_WEBHOOK_INVALID');
      const parsed = parseSignature(signature);
      const requestId = String(context?.requestId || '').trim();
      const dataId = String(context?.dataId || payload?.data?.id || '').trim().toLowerCase();
      const ts = String(parsed.ts || '').trim();
      if (!parsed.v1 || !ts || !requestId || !dataId) throw new CommerceError('assinatura de webhook Mercado Pago incompleta', 'PAYMENT_WEBHOOK_INVALID');
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      if (!equalHex(expected, parsed.v1)) throw new CommerceError('assinatura de webhook Mercado Pago inválida', 'PAYMENT_WEBHOOK_INVALID');
      const token = accessToken(context?.account || {});
      const payment = await mpRequest(`/v1/payments/${encodeURIComponent(dataId)}`, { headers: requestHeaders(token) });
      const statusMap = { approved: 'captured', pending: 'pending', in_process: 'pending', rejected: 'failed', cancelled: 'cancelled', refunded: 'refunded', charged_back: 'refunded' };
      const status = statusMap[String(payment.status || '').toLowerCase()];
      if (!status) throw new CommerceError('status Mercado Pago não suportado', 'PAYMENT_WEBHOOK_INVALID');
      return {
        eventId: String(payload?.id || `${dataId}:${ts}`),
        eventType: String(payload?.type || 'payment'),
        providerPaymentId: dataId,
        status,
        amount: payment.transaction_amount,
        empresaId: context?.empresaId,
        summary: { mpStatus: payment.status, statusDetail: payment.status_detail || null },
      };
    },
  };
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET);
}
