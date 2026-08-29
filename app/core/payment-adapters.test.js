import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentProviderRegistry,
  canTransitionPaymentStatus,
  createPaymentAttempt,
  paymentProviders,
  syncPaymentAttempt,
  validatePaymentMethod,
} from './payment-adapters.js';
import { CommerceError } from './commerce-core.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const orderId = '55555555-5555-4555-8555-555555555555';

test('registry exige createCheckout e verifyWebhook', () => {
  const registry = new PaymentProviderRegistry();
  assert.throws(() => registry.register('fake', {}), TypeError);
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }) };
  registry.register('TestProvider', adapter);
  assert.equal(registry.get('testprovider'), adapter);
});

test('método de pagamento aceita somente valores explícitos', () => {
  assert.equal(validatePaymentMethod('pix'), 'pix');
  assert.equal(validatePaymentMethod('credit_card'), 'credit_card');
  assert.throws(() => validatePaymentMethod('card_number'), error => error instanceof CommerceError && error.code === 'PAYMENT_METHOD_INVALID');
});

test('nenhum gateway não registrado pode criar cobrança', async () => {
  paymentProviders.adapters.clear();
  await assert.rejects(
    () => createPaymentAttempt({ empresaId }, { orderId, provider: 'gateway-inexistente', method: 'pix', idempotencyKey: 'payment-test-1' }),
    error => error instanceof CommerceError && error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  );
});


const lojaId = '22222222-2222-4222-8222-222222222222';
const storefrontId = '33333333-3333-4333-8333-333333333333';
const accountId = '44444444-4444-4444-8444-444444444444';


test('tentativa exige accountId explícito antes de abrir transação', async () => {
  paymentProviders.register('testgateway', { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }) });
  await assert.rejects(
    () => createPaymentAttempt({ empresaId }, { orderId, provider: 'testgateway', method: 'pix', idempotencyKey: 'payment-account-required' }),
    error => error instanceof CommerceError && error.code === 'INVALID_ID',
  );
  paymentProviders.adapters.delete('testgateway');
});

test('pedido fora da loja do contexto é rejeitado pelo filtro tenant-aware', async () => {
  const { db } = await import('./database.js');
  const adapter = { createCheckout: async () => { throw new Error('não deveria chamar gateway'); }, verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  const calls = [];
  const original = db.transaction;
  db.transaction = async callback => callback({
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('SELECT request_hash')) return { rows: [] };
      if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
      if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [] };
      throw new Error(`query não prevista: ${sql}`);
    },
  });
  try {
    await assert.rejects(
      () => createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-store-scope' }),
      error => error instanceof CommerceError && error.code === 'ORDER_NOT_FOUND',
    );
    const orderQuery = calls.find(call => call.sql.includes('SELECT o.id, o.public_code, o.loja_id'));
    assert.deepEqual(orderQuery.values, [empresaId, orderId, lojaId]);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
  }
});

test('reconciliação consulta gateway, confirma valor e evita downgrade de pagamento', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  let transactionCount = 0;
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }), getStatus: async ({ payment }) => { assert.equal(payment.provider_payment_id, '9001'); return { providerPaymentId: '9001', status: 'captured', amount: 10, summary: { source: 'test' } }; } };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  db.transaction = async callback => {
    transactionCount += 1;
    return callback({ query: async (sql, values) => {
      if (sql.includes('SELECT p.id, p.order_id, p.provider, p.method')) return { rows: [{ id: '55555555-5555-4555-8555-555555555556', order_id: orderId, provider: 'testgateway', method: 'pix', status: 'pending', amount: '10.00', provider_payment_id: '9001', order_status: 'pending_payment', storefront_id: storefrontId, account_id: accountId, ambiente: 'sandbox', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
      if (sql.includes('SELECT p.id, p.order_id, p.status, p.amount')) return { rows: [{ id: '55555555-5555-4555-8555-555555555556', order_id: orderId, status: 'pending', amount: '10.00', order_status: 'pending_payment' }] };
      if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '10.00' }] };
      return { rows: [] };
    } });
  };
  try {
    const result = await syncPaymentAttempt({ empresaId, lojaId }, '55555555-5555-4555-8555-555555555556');
    assert.equal(result.status, 'captured');
    assert.equal(result.changed, true);
    assert.equal(transactionCount, 2);
    assert.equal(canTransitionPaymentStatus('captured', 'pending'), false);
    assert.equal(canTransitionPaymentStatus('captured', 'refunded'), true);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('conta ativa sem secret presente é bloqueada antes do createCheckout', async () => {
  const { db } = await import('./database.js');
  const adapter = { createCheckout: async () => { throw new Error('não deveria chamar gateway'); }, verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  delete process.env.TEST_PAYMENT_ACCESS;
  const original = db.transaction;
  db.transaction = async callback => callback({
    query: async sql => {
      if (sql.includes('SELECT request_hash')) return { rows: [] };
      if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
      if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-TESTE', loja_id: lojaId, storefront_id: storefrontId, status: 'pending_payment', total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
      if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
      throw new Error(`query não prevista: ${sql}`);
    },
  });
  try {
    await assert.rejects(
      () => createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-secret-missing' }),
      error => error instanceof CommerceError && error.code === 'PAYMENT_ACCOUNT_NOT_CONFIGURED',
    );
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
  }
});
