import { CommerceError } from './commerce-core.js';

const API_BASE = 'https://api.checkout.infinitepay.io';
const DEFAULT_ORIGIN = 'https://loja.kytto.com.br';

function envValue(reference) {
  const key = String(reference || '').trim().replace(/^env:/, '');
  return key && /^[A-Z][A-Z0-9_]{2,}$/.test(key) ? String(process.env[key] || '').trim() : '';
}

function publicConfig(account) {
  return account?.publicConfig || account?.public_config || {};
}

function normalizeHandle(value) {
  return String(value || '').trim().replace(/^\$/, '');
}

function handleFor(account) {
  const config = publicConfig(account);
  const configuredHandle = normalizeHandle(config.handle);
  const environmentHandle = normalizeHandle(envValue(account?.secretRef || account?.secret_ref));
  if (configuredHandle && environmentHandle && configuredHandle !== environmentHandle) {
    throw new CommerceError('o handle InfinitePay salvo no Commerce não coincide com o handle do ambiente', 'PAYMENT_ACCOUNT_INVALID', { reason: 'handle_mismatch' });
  }
  const handle = configuredHandle || environmentHandle;
  if (!handle) throw new CommerceError('InfinitePay não configurada: informe a InfiniteTag/handle no secret manager', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  return handle;
}

function appOrigin() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || DEFAULT_ORIGIN).replace(/\/$/, '');
}

function cents(value) {
  const result = Math.round(Number(value || 0) * 100);
  if (!Number.isFinite(result) || result <= 0) throw new CommerceError('valor do pedido inválido para InfinitePay', 'PAYMENT_AMOUNT_INVALID');
  return result;
}

async function infinitePayRequest(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      const providerCode = String(payload?.code || payload?.error || payload?.message || '').slice(0, 80) || null;
      const details = { providerStatus: response.status, providerCode };
      if (providerCode === 'external_checkout_not_enabled') {
        throw new CommerceError('o Checkout Integrado da InfinitePay está desabilitado para o perfil configurado', 'PAYMENT_PROVIDER_NOT_READY', details);
      }
      throw new CommerceError('InfinitePay rejeitou a solicitação', 'PAYMENT_PROVIDER_REJECTED', details);
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') throw new CommerceError('InfinitePay não respondeu no prazo', 'PAYMENT_PROVIDER_TIMEOUT');
    if (error instanceof CommerceError) throw error;
    throw new CommerceError('não foi possível comunicar com a InfinitePay', 'PAYMENT_PROVIDER_ERROR');
  } finally { clearTimeout(timer); }
}

function normalizeOrderNsu(payload) {
  return String(payload?.order_nsu || payload?.orderNsu || '').trim();
}
function normalizeTransactionNsu(payload) {
  return String(payload?.transaction_nsu || payload?.transactionNsu || '').trim();
}
function normalizeSlug(payload) {
  return String(payload?.invoice_slug || payload?.slug || '').trim();
}

export function createInfinitePayAdapter() {
  return {
    async createCheckout({ order, account }) {
      const handle = handleFor(account);
      const config = publicConfig(account);
      const orderNsu = String(order.publicCode || order.id || '').trim();
      const customer = order.customerEmail ? { email: String(order.customerEmail).trim().toLowerCase() } : undefined;
      const payload = {
        handle,
        order_nsu: orderNsu,
        redirect_url: String(config.redirectUrl || `${appOrigin()}/checkout?order=${encodeURIComponent(orderNsu)}`).slice(0, 500),
        webhook_url: String(config.webhookUrl || `${appOrigin()}/api/webhooks/infinitepay/payments`).slice(0, 500),
        // A API documenta o campo como `items` no exemplo operacional do Checkout Integrado.
        // `itens` aparece apenas no editor interativo da página principal; o payload gerado
        // e a Central de Ajuda usam `items`, que é o contrato enviado em produção.
        items: [{ quantity: 1, price: cents(order.total), description: `Pedido Kytto ${orderNsu}` }],
        ...(customer ? { customer } : {}),
      };
      const response = await infinitePayRequest('/links', payload);
      const url = String(response?.url || response?.link || response?.checkout_url || response?.checkoutUrl || '').trim();
      if (!url || !/^https:\/\/checkout\.infinitepay(?:\.com\.br|\.io)\//i.test(url)) throw new CommerceError('InfinitePay retornou um checkout inválido', 'PAYMENT_ADAPTER_INVALID_RESPONSE');
      const slug = normalizeSlug(response);
      return {
        providerPaymentId: null,
        publicData: { provider: 'infinitepay', status: 'pending', url, orderNsu, slug: slug || null, captureMethods: ['pix', 'credit_card'] },
      };
    },

    async getStatus({ payment, account }) {
      const metadata = payment?.metadata || {}
      const checkout = metadata.checkout || {}
      const handle = handleFor(account)
      const orderNsu = String(checkout.orderNsu || payment?.public_code || payment?.order_id || '').trim()
      const transactionNsu = String(payment?.provider_payment_id || checkout.transactionNsu || '').trim()
      const slug = String(checkout.slug || '').trim()
      if (!orderNsu || !transactionNsu || !slug) throw new CommerceError('InfinitePay ainda não possui identificadores para consulta', 'PAYMENT_PROVIDER_PAYMENT_NOT_FOUND')
      const checked = await infinitePayRequest('/payment_check', { handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug })
      const amountCents = Number(checked?.amount ?? checked?.paid_amount ?? 0)
      return {
        providerPaymentId: transactionNsu,
        status: checked?.paid === true ? 'captured' : 'pending',
        amount: Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : null,
        summary: { paid: checked?.paid === true, captureMethod: checked?.capture_method || null, slug },
      }
    },

    async verifyWebhook({ payload, context }) {
      const orderNsu = normalizeOrderNsu(payload);
      const transactionNsu = normalizeTransactionNsu(payload);
      const slug = normalizeSlug(payload);
      if (!orderNsu || !transactionNsu || !slug) throw new CommerceError('webhook InfinitePay incompleto', 'PAYMENT_WEBHOOK_INVALID');
      const handle = handleFor(context?.account);
      const checked = await infinitePayRequest('/payment_check', { handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug });
      const paid = checked?.paid === true;
      const amountCents = Number(checked?.amount ?? payload?.amount ?? 0);
      return {
        eventId: transactionNsu,
        eventType: 'payment.updated',
        providerPaymentId: transactionNsu,
        status: paid ? 'captured' : 'pending',
        amount: Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : null,
        summary: { paid, orderNsu, transactionNsu, captureMethod: checked?.capture_method || payload?.capture_method || null, receiptUrl: payload?.receipt_url || payload?.receiptUrl || null, slug },
      };
    },
  };
}

export function infinitePayConfigured() {
  return Boolean(process.env.INFINITEPAY_HANDLE || process.env.INFINITEPAY_TAG);
}
