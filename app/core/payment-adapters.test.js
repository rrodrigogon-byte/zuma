import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentProviderRegistry,
  canTransitionPaymentStatus,
  createPaymentAttempt,
  paymentProviders,
  reconcilePaymentByIdentifiers,
  resolvedPaymentMethod,
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
  assert.equal(validatePaymentMethod('external'), 'external');
  assert.throws(() => validatePaymentMethod('card_number'), error => error instanceof CommerceError && error.code === 'PAYMENT_METHOD_INVALID');
});

test('InfinitePay troca método externo pelo capture_method autoritativo', () => {
  assert.equal(resolvedPaymentMethod('infinitepay', 'external', 'pix'), 'pix');
  assert.equal(resolvedPaymentMethod('infinitepay', 'external', 'credit_card'), 'credit_card');
  assert.equal(resolvedPaymentMethod('infinitepay', 'external', 'boleto'), 'external');
  assert.equal(resolvedPaymentMethod('mercadopago', 'external', 'pix'), 'external');
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

test('checkout único InfinitePay reaproveita tentativa Pix legada pendente sem criar outra cobrança', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  let gatewayCalls = 0;
  paymentProviders.register('infinitepay', { createCheckout: async () => { gatewayCalls += 1; return {}; }, verifyWebhook: async () => ({ eventId: 'evt' }) });
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async sql => {
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-LEGADO', loja_id: lojaId, storefront_id: storefrontId, status: 'pending_payment', total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
    if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT id, status, amount, provider, method, payment_account_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555559', status: 'pending', amount: '10.00', provider: 'infinitepay', method: 'pix', payment_account_id: accountId, provider_payment_id: null, metadata: { checkout: { url: 'https://checkout.infinitepay.com.br/existente' } } }] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    const result = await createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'infinitepay', method: 'external', environment: 'production', idempotencyKey: 'payment-hosted-reuse' });
    assert.equal(result.existingAttempt, true);
    assert.equal(result.paymentId, '55555555-5555-4555-8555-555555555559');
    assert.equal(result.checkout.url, 'https://checkout.infinitepay.com.br/existente');
    assert.equal(gatewayCalls, 0);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('infinitepay');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('reconciliação consulta gateway, confirma valor e evita downgrade de pagamento', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  let transactionCount = 0;
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }), getStatus: async ({ payment }) => { assert.equal(payment.provider_payment_id, '9001'); return { providerPaymentId: '9001', status: 'captured', amount: 10, summary: { source: 'test' } }; } };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  let lockQuery = '';
  let statusUpdateQuery = '';
  db.transaction = async callback => {
    transactionCount += 1;
    return callback({ query: async (sql, values) => {
      if (sql.includes('SELECT p.id, p.order_id, p.provider, p.method')) return { rows: [{ id: '55555555-5555-4555-8555-555555555556', order_id: orderId, provider: 'testgateway', method: 'pix', status: 'pending', amount: '10.00', provider_payment_id: '9001', order_status: 'pending_payment', storefront_id: storefrontId, account_id: accountId, ambiente: 'sandbox', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
      if (sql.includes('SELECT p.id, p.order_id, p.method, p.status')) { lockQuery = sql; return { rows: [{ id: '55555555-5555-4555-8555-555555555556', order_id: orderId, method: 'pix', status: 'pending', amount: '10.00', order_status: 'pending_payment' }] }; }
      if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '10.00' }] };
      if (sql.includes('UPDATE commerce_payments') && sql.includes('authorized_at = CASE')) statusUpdateQuery = sql;
      return { rows: [] };
    } });
  };
  try {
    const result = await syncPaymentAttempt({ empresaId, lojaId }, '55555555-5555-4555-8555-555555555556');
    assert.equal(result.status, 'captured');
    assert.equal(result.changed, true);
    assert.equal(transactionCount, 2);
    assert.match(lockQuery, /FOR UPDATE OF p/);
    assert.match(statusUpdateQuery, /SET status = \$3::text/);
    assert.match(statusUpdateQuery, /CASE WHEN \$3::text = 'captured'/);
    assert.equal(canTransitionPaymentStatus('captured', 'pending'), false);
    assert.equal(canTransitionPaymentStatus('captured', 'refunded'), true);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('reconciliação manual vincula InfinitePay por NSU e slug antes de confirmar o status', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const calls = [];
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }), getStatus: async ({ payment }) => ({ providerPaymentId: payment.provider_payment_id, status: 'captured', amount: 30, summary: { paid: true } }) };
  paymentProviders.register('infinitepay', adapter);
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT p.id, p.order_id, p.provider, p.status')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: {}, payment_account_id: accountId, order_code: 'KC-APROVADO', storefront_id: storefrontId, order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id FROM commerce_payments')) return { rows: [] };
    if (sql.includes('SELECT p.id, p.order_id, p.provider, p.method')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'credit_card', status: 'pending', amount: '30.00', provider_payment_id: 'tx-3001', metadata: { checkout: { slug: 'slug-3001' } }, account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT p.id, p.order_id, p.method, p.status')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, method: 'credit_card', status: 'pending', amount: '30.00', order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '30.00' }] };
    return { rows: [] };
  } });
  try {
    const result = await reconcilePaymentByIdentifiers({ empresaId, lojaId }, '55555555-5555-4555-8555-555555555558', { transactionNsu: 'tx-3001', slug: 'slug-3001', captureMethod: 'credit_card' });
    assert.equal(result.status, 'captured');
    assert.equal(result.changed, true);
    const update = calls.find(call => call.sql.includes('UPDATE commerce_payments') && call.sql.includes('provider_payment_id = $3'));
    assert.deepEqual(update.values.slice(0, 3), [empresaId, '55555555-5555-4555-8555-555555555558', 'tx-3001']);
    assert.match(update.values[3], /slug-3001/);
    assert.match(update.values[3], /manualReconciliation/);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('infinitepay');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('nova tentativa reabre pagamento falho somente após checkout válido', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const adapter = { createCheckout: async () => ({ providerPaymentId: null, publicData: { url: 'https://checkout.example.test/pending' } }), verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  const updates = [];
  db.transaction = async callback => callback({ query: async (sql, values) => {
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-RETRY', loja_id: lojaId, storefront_id: storefrontId, status: 'payment_failed', total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
    if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT id, status, amount, provider, method, provider_payment_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555557', status: 'failed', amount: '10.00', provider: 'testgateway', method: 'pix', provider_payment_id: null, metadata: {} }] };
    if (sql.includes('SELECT id, status, amount, provider, method, payment_account_id')) return { rows: [] };
    if (sql.includes('UPDATE commerce_payments')) { updates.push({ sql, values }); return { rows: [] }; }
    if (sql.includes('UPDATE commerce_idempotency_keys')) return { rows: [] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    const result = await createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-retry' });
    assert.equal(result.status, 'pending');
    assert.equal(updates.length, 1);
    assert.match(updates[0].sql, /SET status = 'pending'/);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('erro de handle divergente preserva diagnóstico de configuração', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const adapter = {
    createCheckout: async () => { throw new CommerceError('handle divergente', 'PAYMENT_ACCOUNT_INVALID', { reason: 'handle_mismatch' }); },
    verifyWebhook: async () => ({ eventId: 'evt' }),
  };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  db.transaction = async callback => callback({
    query: async (sql, values) => {
      if (sql.includes('SELECT request_hash')) return { rows: [] };
      if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
      if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-HANDLE', loja_id: lojaId, storefront_id: storefrontId, status: 'pending_payment', total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
      if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: { handle: 'handle-commerce' } }] };
      if (sql.includes('SELECT id, status, amount, provider, method, payment_account_id')) return { rows: [] };
      if (sql.includes('SELECT id, status, amount, provider, method, provider_payment_id')) return { rows: [] };
      if (sql.includes('INSERT INTO commerce_payments')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', status: 'pending', amount: '10.00', provider: 'testgateway', method: 'pix', provider_payment_id: null, metadata: {} }] };
      if (sql.includes('UPDATE commerce_payments')) return { rows: [] };
      throw new Error(`query não prevista: ${sql}`);
    },
  });
  try {
    await assert.rejects(
      () => createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-handle-mismatch' }),
      error => error instanceof CommerceError && error.code === 'PAYMENT_ACCOUNT_INVALID' && error.details?.reason === 'handle_mismatch',
    );
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
