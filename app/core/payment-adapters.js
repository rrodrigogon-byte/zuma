import crypto from 'crypto';
import { db } from './database.js';
import { CommerceError, assertUuid, requestId, tenantContext, transitionOrder, withCommerceTransaction } from './commerce-core.js';
import { createMercadoPagoAdapter, mercadoPagoConfigured } from './mercadopago-adapter.js';
import { createInfinitePayAdapter, infinitePayConfigured } from './infinitepay-adapter.js';

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
if (infinitePayConfigured()) paymentProviders.register('infinitepay', createInfinitePayAdapter());

export function validatePaymentMethod(method) {
  const value = String(method || '').toLowerCase();
  if (!['pix', 'credit_card', 'debit_card', 'boleto', 'external', 'account'].includes(value)) {
    throw new CommerceError('método de pagamento não suportado', 'PAYMENT_METHOD_INVALID');
  }
  return value;
}

export function resolvedPaymentMethod(provider, currentMethod, captureMethod) {
  const current = String(currentMethod || '').trim().toLowerCase();
  const captured = String(captureMethod || '').trim().toLowerCase();
  return String(provider || '').trim().toLowerCase() === 'infinitepay'
    && current === 'external'
    && ['pix', 'credit_card'].includes(captured)
    ? captured
    : current;
}

function environmentName(value) {
  const environment = String(value || 'sandbox').trim().toLowerCase();
  if (!['sandbox', 'production'].includes(environment)) throw new CommerceError('ambiente de pagamento inválido', 'PAYMENT_ACCOUNT_INVALID');
  return environment;
}

function envReferenceConfigured(reference) {
  const value = String(reference || '').trim();
  return value.startsWith('env:') && Boolean(process.env[value.slice(4)]);
}

function accountCredentialsConfigured(account, provider) {
  if (!envReferenceConfigured(account?.secret_ref)) return false;
  if (provider === 'mercadopago') return envReferenceConfigured(account?.public_config?.webhookSecretRef);
  return true;
}

export function paymentAccountReady(account) {
  const provider = String(account?.provider || '').toLowerCase();
  return Boolean(account?.id && account?.ativo === true && paymentProviders.get(provider) && accountCredentialsConfigured(account, provider));
}

const PAYMENT_STATUS_TRANSITIONS = {
  pending: ['authorized', 'captured', 'failed', 'cancelled', 'refunded'],
  authorized: ['captured', 'failed', 'cancelled', 'refunded'],
  captured: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  failed: [],
  cancelled: [],
  refunded: [],
};

export function canTransitionPaymentStatus(current, next) {
  const from = String(current || '').toLowerCase();
  const to = String(next || '').toLowerCase();
  return from === to || Boolean(PAYMENT_STATUS_TRANSITIONS[from]?.includes(to));
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
  const accountId = assertUuid(input.accountId, 'accountId');
  const environment = environmentName(input.environment);
  const orderResult = await trx.query(
    `SELECT o.id, o.public_code, o.loja_id, o.storefront_id, o.status, o.total, o.moeda, c.email AS customer_email
       FROM commerce_orders o
       LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
      WHERE o.empresa_id = $1 AND o.id = $2
        AND ($3::uuid IS NULL OR o.loja_id = $3)
      FOR UPDATE OF o`,
    [context.empresaId, orderId, context.lojaId],
  );
  const order = orderResult.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado no tenant', 'ORDER_NOT_FOUND');
  if (!['draft', 'pending_payment', 'payment_failed'].includes(order.status)) throw new CommerceError('pedido não está disponível para nova tentativa de pagamento', 'PAYMENT_ORDER_STATE_INVALID');
  const account = await trx.query(
    `SELECT id, secret_ref, public_config
       FROM commerce_payment_accounts
      WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND provider = $4 AND ativo = true
        AND ambiente = $5
      LIMIT 1`,
    [context.empresaId, accountId, order.storefront_id, provider, environment],
  );
  if (!account.rows[0]) throw new CommerceError('conta de pagamento ativa não configurada para a loja', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  if (!accountCredentialsConfigured(account.rows[0], provider)) throw new CommerceError('credenciais da conta de pagamento ainda não estão configuradas no secret manager', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  const pending = await trx.query(
    `SELECT id, status, amount, provider, method, payment_account_id, provider_payment_id, metadata, criado_em
       FROM commerce_payments
      WHERE empresa_id = $1 AND order_id = $2 AND status = 'pending'
      ORDER BY criado_em DESC
      LIMIT 1
      FOR UPDATE`,
    [context.empresaId, orderId],
  );
  if (pending.rows[0]) {
    const current = pending.rows[0];
    const sameHostedAttempt = provider === 'infinitepay' && current.provider === provider && method === 'external' && ['external', 'pix', 'credit_card'].includes(current.method);
    const sameAttempt = current.provider === provider && (current.method === method || sameHostedAttempt) && current.payment_account_id === accountId;
    if (sameAttempt && (current.provider_payment_id || current.metadata?.checkout)) {
      return {
        replay: true,
        result: {
          paymentId: current.id,
          status: current.status,
          provider: current.provider,
          method: current.method,
          checkout: current.metadata?.checkout || {},
          existingAttempt: true,
        },
      };
    }
    throw new CommerceError('já existe uma tentativa de pagamento pendente para este pedido', 'PAYMENT_ATTEMPT_IN_PROGRESS');
  }
  const oldPayment = await trx.query(
    `SELECT id, status, amount, provider, method, provider_payment_id, metadata, criado_em
       FROM commerce_payments
      WHERE empresa_id = $1 AND idempotency_key = $2
      LIMIT 1`,
    [context.empresaId, idem],
  );
  const payment = oldPayment.rows[0] || (await trx.query(
    `INSERT INTO commerce_payments
      (empresa_id, order_id, payment_account_id, provider, method, status, idempotency_key, amount, metadata)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8::jsonb)
     RETURNING id, status, amount, provider, method, provider_payment_id, metadata, criado_em`,
    [context.empresaId, orderId, accountId, provider, method, idem, order.total, JSON.stringify({ idempotencyKey: idem, paymentAccountId: accountId })],
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
          SET status = 'pending', provider_payment_id = $3, metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
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
  const environment = environmentName(input.environment);
  const adapter = paymentProviders.get(provider);
  if (!adapter) throw new CommerceError('gateway ainda não configurado/homologado para este ambiente', 'PAYMENT_PROVIDER_NOT_CONFIGURED', { provider });
  const idem = String(input.idempotencyKey || '').trim().slice(0, 180);
  if (!idem) throw new CommerceError('chave de idempotência é obrigatória para pagamento', 'PAYMENT_IDEMPOTENCY_REQUIRED');
  const accountId = assertUuid(input.accountId, 'accountId');
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ orderId, provider, method, environment, accountId })).digest('hex');
  const prepared = await withCommerceTransaction(trx => preparePayment(trx, context, { ...input, accountId, environment }, provider, method, idem, requestHash));
  if (prepared.replay) return prepared.result;
  let checkout;
  try {
    checkout = await adapter.createCheckout({
      payment: prepared.payment,
      order: { id: prepared.order.id, publicCode: prepared.order.public_code, total: prepared.order.total, currency: prepared.order.moeda, customerEmail: prepared.order.customer_email },
      account: { id: prepared.account.id, secretRef: prepared.account.secret_ref, publicConfig: prepared.account.public_config },
      requestId: prepared.requestId,
      idempotencyKey: idem,
    });
  } catch (error) {
    await markPaymentFailed(context, prepared.payment.id, error);
    if (error instanceof CommerceError && ['PAYMENT_PROVIDER_TIMEOUT', 'PAYMENT_ACCOUNT_NOT_CONFIGURED', 'PAYMENT_PROVIDER_UNSUPPORTED', 'PAYMENT_PROVIDER_REJECTED', 'PAYMENT_PROVIDER_NOT_READY', 'PAYMENT_ACCOUNT_INVALID', 'PAYMENT_ADAPTER_INVALID_RESPONSE'].includes(error.code)) throw error;
    throw new CommerceError('não foi possível iniciar o checkout no gateway', 'PAYMENT_PROVIDER_ERROR', { provider });
  }
  if (!checkout || typeof checkout !== 'object') {
    await markPaymentFailed(context, prepared.payment.id, new Error('resposta inválida'));
    throw new CommerceError('adapter de pagamento retornou resposta inválida', 'PAYMENT_ADAPTER_INVALID_RESPONSE');
  }
  return finalizePayment(context, prepared, checkout);
}

export async function syncPaymentAttempt(contextInput, paymentIdInput) {
  const context = tenantContext(contextInput);
  const paymentId = assertUuid(paymentIdInput, 'paymentId');
  const prepared = await withCommerceTransaction(async trx => {
    const result = await trx.query(
      `SELECT p.id, p.order_id, p.provider, p.method, p.status, p.amount, p.provider_payment_id, p.metadata,
              o.status AS order_status, o.storefront_id, a.id AS account_id, a.ambiente,
              a.secret_ref, a.public_config
         FROM commerce_payments p
         JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
         LEFT JOIN commerce_payment_accounts a ON a.empresa_id = p.empresa_id AND a.id = p.payment_account_id
        WHERE p.empresa_id = $1 AND p.id = $2
          AND ($3::uuid IS NULL OR o.loja_id = $3)
        FOR UPDATE OF p`,
      [context.empresaId, paymentId, context.lojaId],
    );
    const payment = result.rows[0];
    if (!payment) throw new CommerceError('pagamento não encontrado no tenant', 'PAYMENT_NOT_FOUND');
    if (!payment.provider_payment_id) throw new CommerceError('pagamento ainda não possui identificador no gateway', 'PAYMENT_PROVIDER_PAYMENT_NOT_FOUND');
    if (!payment.account_id || !payment.secret_ref || !payment.ambiente) throw new CommerceError('conta de pagamento do registro não está vinculada', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
    if (!paymentAccountReady({ id: payment.account_id, provider: payment.provider, ambiente: payment.ambiente, secret_ref: payment.secret_ref, public_config: payment.public_config, ativo: true })) throw new CommerceError('credenciais da conta de pagamento ainda não estão configuradas no secret manager', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
    return payment;
  });
  const adapter = paymentProviders.get(prepared.provider);
  if (!adapter || typeof adapter.getStatus !== 'function') throw new CommerceError('este gateway não oferece reconciliação de status', 'PAYMENT_PROVIDER_STATUS_UNAVAILABLE');
  let statusResult;
  try {
    statusResult = await adapter.getStatus({ payment: prepared, account: { id: prepared.account_id, ambiente: prepared.ambiente, secret_ref: prepared.secret_ref, public_config: prepared.public_config } });
  } catch (error) {
    if (error instanceof CommerceError) throw error;
    throw new CommerceError('não foi possível consultar o status no gateway', 'PAYMENT_PROVIDER_ERROR', { provider: prepared.provider });
  }
  if (!statusResult?.status || String(statusResult.providerPaymentId || '') !== String(prepared.provider_payment_id)) throw new CommerceError('adapter retornou um pagamento diferente do registro persistido', 'PAYMENT_PROVIDER_STATUS_INVALID');
  if (statusResult.amount != null && Math.abs(Number(statusResult.amount) - Number(prepared.amount)) > 0.01) throw new CommerceError('valor consultado no gateway diverge do pedido', 'PAYMENT_AMOUNT_MISMATCH');
  return withCommerceTransaction(async trx => {
    const currentResult = await trx.query(`SELECT p.id, p.order_id, p.method, p.status, p.amount, o.status AS order_status FROM commerce_payments p JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id WHERE p.empresa_id = $1 AND p.id = $2 FOR UPDATE OF p`, [context.empresaId, paymentId]);
    const current = currentResult.rows[0];
    if (!current) throw new CommerceError('pagamento não encontrado', 'PAYMENT_NOT_FOUND');
    const next = String(statusResult.status).toLowerCase();
    const nextMethod = resolvedPaymentMethod(prepared.provider, current.method, statusResult.summary?.captureMethod);
    const eventKey = `reconcile:${prepared.provider}:${statusResult.providerPaymentId || prepared.provider_payment_id}:${next}`;
    if (current.status !== next && !canTransitionPaymentStatus(current.status, next)) return { paymentId, orderId: current.order_id, status: current.status, provider: prepared.provider, changed: false, stale: true, summary: statusResult.summary || {} };
    if (current.status !== next || current.method !== nextMethod) {
      await trx.query(
        `UPDATE commerce_payments
            SET status = $3::text,
                method = $5::text,
                authorized_at = CASE WHEN $3::text = 'authorized' THEN COALESCE(authorized_at, CURRENT_TIMESTAMP) ELSE authorized_at END,
                captured_at = CASE WHEN $3::text = 'captured' THEN COALESCE(captured_at, CURRENT_TIMESTAMP) ELSE captured_at END,
                refunded_at = CASE WHEN $3::text IN ('refunded','partially_refunded') THEN COALESCE(refunded_at, CURRENT_TIMESTAMP) ELSE refunded_at END,
                metadata = metadata || $4::jsonb,
                atualizado_em = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND id = $2`,
        [context.empresaId, paymentId, next, JSON.stringify({ reconciliation: { eventKey, summary: statusResult.summary || {} } }), nextMethod],
      );
      if (next === 'captured' && ['draft', 'pending_payment', 'payment_failed'].includes(current.order_status)) await transitionOrder(trx, { empresaId: context.empresaId }, { orderId: current.order_id, status: 'paid', origin: 'payment_reconciliation', correlationId: eventKey, payload: { provider: prepared.provider, eventKey } });
      if (next === 'failed' && ['draft', 'pending_payment'].includes(current.order_status)) await transitionOrder(trx, { empresaId: context.empresaId }, { orderId: current.order_id, status: 'payment_failed', origin: 'payment_reconciliation', correlationId: eventKey, payload: { provider: prepared.provider, eventKey } });
      if (next === 'partially_refunded' && current.order_status === 'completed') await transitionOrder(trx, { empresaId: context.empresaId }, { orderId: current.order_id, status: 'partially_refunded', origin: 'payment_reconciliation', correlationId: eventKey, payload: { provider: prepared.provider, eventKey } });
      if (next === 'refunded' && ['paid', 'completed'].includes(current.order_status)) await transitionOrder(trx, { empresaId: context.empresaId }, { orderId: current.order_id, status: 'refunded', origin: 'payment_reconciliation', correlationId: eventKey, payload: { provider: prepared.provider, eventKey } });
    }
    return { paymentId, orderId: current.order_id, status: next, provider: prepared.provider, method: nextMethod, changed: current.status !== next || current.method !== nextMethod, summary: statusResult.summary || {} };
  });
}

export async function reconcilePaymentByIdentifiers(contextInput, paymentIdInput, input = {}) {
  const context = tenantContext(contextInput);
  const paymentId = assertUuid(paymentIdInput, 'paymentId');
  const transactionNsu = String(input.transactionNsu || input.transaction_nsu || '').trim().slice(0, 180);
  const slug = String(input.slug || input.invoiceSlug || input.invoice_slug || '').trim().slice(0, 180);
  const receiptUrl = String(input.receiptUrl || input.receipt_url || '').trim().slice(0, 500);
  const captureMethod = String(input.captureMethod || input.capture_method || '').trim().slice(0, 40);
  if (!transactionNsu || !slug) throw new CommerceError('transaction_nsu e slug são obrigatórios para reconciliar a venda', 'PAYMENT_RECONCILIATION_INPUT_INVALID');
  await withCommerceTransaction(async trx => {
    const result = await trx.query(
      `SELECT p.id, p.order_id, p.provider, p.status, p.amount, p.provider_payment_id, p.metadata, p.payment_account_id,
              o.public_code AS order_code, o.storefront_id, o.status AS order_status
         FROM commerce_payments p
         JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
        WHERE p.empresa_id = $1 AND p.id = $2
          AND ($3::uuid IS NULL OR o.loja_id = $3)
        FOR UPDATE OF p`,
      [context.empresaId, paymentId, context.lojaId],
    );
    const payment = result.rows[0];
    if (!payment) throw new CommerceError('pagamento não encontrado no tenant ou na loja ativa', 'PAYMENT_NOT_FOUND');
    if (payment.provider !== 'infinitepay') throw new CommerceError('a reconciliação manual por NSU está disponível somente para InfinitePay', 'PAYMENT_RECONCILIATION_PROVIDER_UNSUPPORTED');
    if (payment.provider_payment_id && payment.provider_payment_id !== transactionNsu) throw new CommerceError('o pagamento já possui outro identificador InfinitePay', 'PAYMENT_RECONCILIATION_CONFLICT');
    const duplicate = await trx.query(
      `SELECT id FROM commerce_payments
        WHERE empresa_id = $1 AND provider = 'infinitepay' AND provider_payment_id = $2 AND id <> $3
        LIMIT 1`,
      [context.empresaId, transactionNsu, paymentId],
    );
    if (duplicate.rows[0]) throw new CommerceError('transaction_nsu já está vinculado a outro pagamento', 'PAYMENT_RECONCILIATION_CONFLICT');
    const checkout = {
      ...(payment.metadata?.checkout || {}),
      orderNsu: payment.order_code,
      transactionNsu,
      slug,
      ...(receiptUrl ? { receiptUrl } : {}),
      ...(captureMethod ? { captureMethod } : {}),
    };
    await trx.query(
      `UPDATE commerce_payments
          SET provider_payment_id = $3,
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2`,
      [context.empresaId, paymentId, transactionNsu, JSON.stringify({ checkout, manualReconciliation: { at: new Date().toISOString(), source: 'admin' } })],
    );
  });
  return syncPaymentAttempt(context, paymentId);
}

export async function verifyPaymentWebhook(provider, payload, signature, context = {}) {
  const adapter = paymentProviders.get(provider);
  if (!adapter) throw new CommerceError('gateway não registrado', 'PAYMENT_PROVIDER_NOT_CONFIGURED', { provider });
  const verified = await adapter.verifyWebhook({ payload, signature, context });
  if (!verified?.eventId) throw new CommerceError('webhook sem identificador do provedor', 'PAYMENT_WEBHOOK_INVALID');
  return verified;
}
