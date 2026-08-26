import crypto from 'crypto';
import { db } from './database.js';
import { CommerceError, assertUuid, requestId, tenantContext, withCommerceTransaction } from './commerce-core.js';
import { createMercadoPagoAdapter, mercadoPagoConfigured } from './mercadopago-adapter.js';

export class PaymentProviderRegistry {
  constructor() { this.adapters = new Map(); }
  register(provider, adapter) {
    if (!provider || typeof adapter?.createCheckout !== 'function' || typeof adapter?.verifyWebhook !== 'function') {
      throw new TypeError('adapter de pagamento deve implementar createCheckout e verifyWebhook');
    }
    this.adapters.set(String(provider).toLowerCase(), adapter);
    return this;
  }
  get(provider) { return this.adapters.get(String(provider || '').toLowerCase()); }
}

// Nenhum gateway é registrado automaticamente. O tenant deve configurar um
// provider homologado e um secret_ref gerenciado fora do Git e do frontend.
export const paymentProviders = new PaymentProviderRegistry();
if (mercadoPagoConfigured()) paymentProviders.register('mercadopago', createMercadoPagoAdapter());

export function validatePaymentMethod(method) {
  const value = String(method || '').toLowerCase();
  if (!['pix', 'credit_card', 'debit_card', 'boleto', 'external'].includes(value)) {
    throw new CommerceError('método de pagamento não suportado', 'PAYMENT_METHOD_INVALID');
  }
  return value;
}

async function preparePayment(trx, context, input, provider, method, idem, requestHash) {
  const existing = await trx.query(
    `SELECT request_hash, response_body FROM commerce_idempotency_keys
      WHERE empresa_id = $1 AND scope = 'payment.create' AND key = $2 FOR UPDATE`,
    [context.empresaId, idem],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
    if (existing.rows[0].response_body) return { replay: true, result: existing.rows[0].response_body };
  } else {
    await trx.query(
      `INSERT INTO commerce_idempotency_keys (empresa_id, scope, key, request_hash, expires_at)
       VALUES ($1, 'payment.create', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
      [context.empresaId, idem, requestHash],
    );
  }
  const orderId = assertUuid(input.orderId, 'orderId');
  const orderResult = await trx.query(
    `SELECT o.id, o.storefront_id, o.status, o.total, o.moeda, c.email AS customer_email
       FROM commerce_orders o
       LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
      WHERE o.empresa_id = $1 AND o.id = $2
      FOR UPDATE`,
    [context.empresaId, orderId],
  );
  const order = orderResult.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado no tenant', 'ORDER_NOT_FOUND');
  if (!['draft', 'pending_payment', 'payment_failed'].includes(order.status)) throw new CommerceError('pedido não está disponível para nova tentativa de pagamento', 'PAYMENT_ORDER_STATE_INVALID');
  const account = await trx.query(
    `SELECT id, secret_ref, public_config
       FROM commerce_payment_accounts
      WHERE empresa_id = $1 AND storefront_id = $2 AND provider = $3 AND ativo = true
        AND ambiente = $4
      LIMIT 1`,
    [context.empresaId, order.storefront_id, provider, input.environment || 'sandbox'],
  );
  if (!account.rows[0]) throw new CommerceError('conta de pagamento ativa não configurada para a loja', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  const oldPayment = await trx.query(
    `SELECT id, status, amount, provider, method, provider_payment_id, metadata, criado_em
       FROM commerce_payments
      WHERE empresa_id = $1 AND idempotency_key = $2
      LIMIT 1`,
    [context.empresaId, idem],
  );
  const payment = oldPayment.rows[0] || (await trx.query(
    `INSERT INTO commerce_payments
      (empresa_id, order_id, provider, method, status, idempotency_key, amount, metadata)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7::jsonb)
     RETURNING id, status, amount, provider, method, provider_payment_id, metadata, criado_em`,
    [context.empresaId, orderId, provider, method, idem, order.total, JSON.stringify({ idempotencyKey: idem })],
  )).rows[0];
  return { replay: false, payment, order, account: account.rows[0], idempotencyKey: idem, requestId: requestId(`payment:${idem}`) };
}

async function markPaymentFailed(context, paymentId, error) {
  await withCommerceTransaction(trx => trx.query(
    `UPDATE commerce_payments
        SET status = 'failed', metadata = metadata || $3::jsonb, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2`,
    [context.empresaId, paymentId, JSON.stringify({ adapterError: String(error?.message || 'erro do gateway').slice(0, 500) })],
  ));
}

async function finalizePayment(context, prepared, checkout) {
  return withCommerceTransaction(async trx => {
    await trx.query(
      `UPDATE commerce_payments
          SET provider_payment_id = $3, metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2`,
      [context.empresaId, prepared.payment.id, checkout.providerPaymentId || null, JSON.stringify({ checkout: checkout.publicData || {} })],
    );
    const result = { paymentId: prepared.payment.id, status: 'pending', provider: prepared.payment.provider, method: prepared.payment.method, checkout: checkout.publicData || {} };
    await trx.query(
      `UPDATE commerce_idempotency_keys SET response_status = 201, response_body = $3::jsonb
        WHERE empresa_id = $1 AND scope = 'payment.create' AND key = $2`,
      [context.empresaId, prepared.idempotencyKey, JSON.stringify(result)],
    );
    return result;
  });
}

export async function createPaymentAttempt(contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const orderId = assertUuid(input.orderId, 'orderId');
  const provider = String(input.provider || '').trim().toLowerCase();
  const method = validatePaymentMethod(input.method);
  const adapter = paymentProviders.get(provider);
  if (!adapter) throw new CommerceError('gateway ainda não configurado/homologado para este ambiente', 'PAYMENT_PROVIDER_NOT_CONFIGURED', { provider });
  const idem = String(input.idempotencyKey || '').trim().slice(0, 180);
  if (!idem) throw new CommerceError('chave de idempotência é obrigatória para pagamento', 'PAYMENT_IDEMPOTENCY_REQUIRED');
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ orderId, provider, method, environment: input.environment || 'sandbox' })).digest('hex');
  const prepared = await withCommerceTransaction(trx => preparePayment(trx, context, input, provider, method, idem, requestHash));
  if (prepared.replay) return prepared.result;
  let checkout;
  try {
    checkout = await adapter.createCheckout({
      payment: prepared.payment,
      order: { id: prepared.order.id, total: prepared.order.total, currency: prepared.order.moeda, customerEmail: prepared.order.customer_email },
      account: { id: prepared.account.id, secretRef: prepared.account.secret_ref, publicConfig: prepared.account.public_config },
      requestId: prepared.requestId,
      idempotencyKey: idem,
    });
  } catch (error) {
    await markPaymentFailed(context, prepared.payment.id, error);
    throw new CommerceError('não foi possível iniciar o checkout no gateway', 'PAYMENT_PROVIDER_ERROR', { provider });
  }
  if (!checkout || typeof checkout !== 'object') {
    await markPaymentFailed(context, prepared.payment.id, new Error('resposta inválida'));
    throw new CommerceError('adapter de pagamento retornou resposta inválida', 'PAYMENT_ADAPTER_INVALID_RESPONSE');
  }
  return finalizePayment(context, prepared, checkout);
}

export async function verifyPaymentWebhook(provider, payload, signature, context = {}) {
  const adapter = paymentProviders.get(provider);
  if (!adapter) throw new CommerceError('gateway não registrado', 'PAYMENT_PROVIDER_NOT_CONFIGURED', { provider });
  const verified = await adapter.verifyWebhook({ payload, signature, context });
  if (!verified?.eventId) throw new CommerceError('webhook sem identificador do provedor', 'PAYMENT_WEBHOOK_INVALID');
  return verified;
}
