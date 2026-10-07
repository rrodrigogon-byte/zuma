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

function supportedCaptureMethods(account) {
  const configured = publicConfig(account)?.methods;
  return Array.isArray(configured) && configured.length
    ? configured.map(value => String(value || '').trim().toLowerCase()).filter(value => ['pix', 'credit_card'].includes(value))
    : ['pix', 'credit_card'];
}

function assertCapturedPaymentCheck(checked, expected, errorCode) {
  if (checked?.paid !== true) return;
  if (checked?.success !== true) throw new CommerceError('payment_check não confirmou a consulta', errorCode);
  const checkedOrderNsu = normalizeOrderNsu(checked);
  const checkedTransactionNsu = normalizeTransactionNsu(checked);
  const checkedSlug = normalizeSlug(checked);
  // O contrato documentado de payment_check não garante eco dos IDs enviados.
  // A API confirma a tupla handle/pedido/transação/slug consultada; quando um
  // ID for ecoado, ainda deve coincidir exatamente com a tupla da requisição.
  if ((checkedOrderNsu && checkedOrderNsu !== expected.orderNsu)
    || (checkedTransactionNsu && checkedTransactionNsu !== expected.transactionNsu)
    || (checkedSlug && checkedSlug !== expected.slug)) {
    throw new CommerceError('payment_check não confirmou os identificadores da venda', errorCode);
  }
  const amountCents = Number(checked?.amount ?? checked?.paid_amount);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new CommerceError('payment_check não confirmou o valor capturado', errorCode);
  }
  if (expected.amount != null && Math.abs((amountCents / 100) - Number(expected.amount)) > 0.01) {
    throw new CommerceError('payment_check confirmou valor divergente do pedido', 'PAYMENT_AMOUNT_MISMATCH');
  }
  const captureMethod = String(checked?.capture_method || '').trim().toLowerCase();
  if (!captureMethod || !['pix', 'credit_card'].includes(captureMethod)) {
    throw new CommerceError('payment_check não confirmou um método suportado', errorCode);
  }
  const expectedMethod = String(expected.method || '').trim().toLowerCase();
  if (['pix', 'credit_card'].includes(expectedMethod) && captureMethod !== expectedMethod) {
    throw new CommerceError('payment_check confirmou método divergente do pagamento', errorCode);
  }
  if (expectedMethod === 'external' && !expected.allowedMethods.includes(captureMethod)) {
    throw new CommerceError('payment_check confirmou método não habilitado para a conta', errorCode);
  }
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
      const captureMethod = String(checked?.capture_method || '').trim().toLowerCase()
      assertCapturedPaymentCheck(checked, {
        orderNsu,
        transactionNsu,
        slug,
        amount: payment?.amount,
        method: payment?.method,
        allowedMethods: supportedCaptureMethods(account),
      }, 'PAYMENT_PROVIDER_STATUS_INVALID')
      return {
        providerPaymentId: checked?.paid === true ? transactionNsu : null,
        status: checked?.paid === true ? 'captured' : 'pending',
        amount: Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : null,
        summary: { paid: checked?.paid === true, orderNsu: checked?.paid === true ? orderNsu : normalizeOrderNsu(checked) || null, transactionNsu: checked?.paid === true ? transactionNsu : normalizeTransactionNsu(checked) || null, captureMethod: captureMethod || null, slug: checked?.paid === true ? slug : normalizeSlug(checked) || null, verifiedBy: 'payment_check' },
      }
    },

    async verifyWebhook({ payload, context }) {
      const orderNsu = normalizeOrderNsu(payload);
      const transactionNsu = normalizeTransactionNsu(payload);
      const slug = normalizeSlug(payload);
      if (!orderNsu || !transactionNsu || !slug) throw new CommerceError('webhook InfinitePay incompleto', 'PAYMENT_WEBHOOK_INVALID');
      if (context?.expectedOrderNsu && orderNsu !== String(context.expectedOrderNsu)) throw new CommerceError('webhook não corresponde ao pedido persistido', 'PAYMENT_WEBHOOK_INVALID');
      if (context?.expectedTransactionNsu && transactionNsu !== String(context.expectedTransactionNsu)) throw new CommerceError('webhook não corresponde ao pagamento persistido', 'PAYMENT_WEBHOOK_INVALID');
      const handle = handleFor(context?.account);
      const checked = await infinitePayRequest('/payment_check', { handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug });
      const checkedOrderNsu = normalizeOrderNsu(checked);
      const checkedTransactionNsu = normalizeTransactionNsu(checked);
      const checkedSlug = normalizeSlug(checked);
      const paid = checked?.paid === true;
      const amountCents = Number(checked?.amount ?? checked?.paid_amount ?? 0);
      const captureMethod = String(checked?.capture_method || '').trim().toLowerCase();
      assertCapturedPaymentCheck(checked, {
        orderNsu,
        transactionNsu,
        slug,
        amount: context?.expectedAmount,
        method: context?.expectedMethod,
        allowedMethods: supportedCaptureMethods(context?.account),
      }, 'PAYMENT_WEBHOOK_INVALID');
      const verifiedTransactionNsu = paid ? transactionNsu : null;
      return {
        // O mesmo NSU chega como pendente e depois como pago: o estado faz parte da chave,
        // senão o aviso de pagamento seria descartado como duplicado.
        eventId: `${transactionNsu}:${paid ? 'captured' : 'pending'}`,
        eventType: 'payment.updated',
        providerPaymentId: verifiedTransactionNsu,
        status: paid ? 'captured' : 'pending',
        amount: Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : null,
        signatureValid: false,
        verification: 'provider_payment_check',
        summary: { paid, orderNsu: checkedOrderNsu || orderNsu, transactionNsu: checkedTransactionNsu || transactionNsu, captureMethod: captureMethod || null, slug: checkedSlug || slug, verifiedBy: 'payment_check' },
      };
    },
  };
}

export function infinitePayConfigured() {
  return Boolean(process.env.INFINITEPAY_HANDLE || process.env.INFINITEPAY_TAG);
}
