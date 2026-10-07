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
    assert.deepEqual(orderQuery.values, [empresaId, orderId, lojaId, null]);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
  }
});

test('pedido de outro storefront da mesma loja é rejeitado antes de chamar o gateway', async () => {
  const { db } = await import('./database.js');
  const adapter = { createCheckout: async () => { throw new Error('não deveria chamar gateway'); }, verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  const calls = [];
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    await assert.rejects(
      () => createPaymentAttempt({ empresaId, lojaId, storefrontId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-storefront-scope' }),
      error => error instanceof CommerceError && error.code === 'ORDER_NOT_FOUND',
    );
    const orderQuery = calls.find(call => call.sql.includes('SELECT o.id, o.public_code, o.loja_id'));
    assert.deepEqual(orderQuery.values, [empresaId, orderId, lojaId, storefrontId]);
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

test('reconciliação InfinitePay confirma NSU, slug e valor antes de persistir o vínculo e preserva storefront', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const calls = [];
  let gatewayCalls = 0;
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }), getStatus: async ({ payment }) => {
    gatewayCalls += 1;
    if (gatewayCalls === 1) assert.equal(calls.some(call => /^\s*(INSERT|UPDATE|DELETE)/i.test(call.sql)), false);
    assert.equal(payment.provider_payment_id, 'tx-3001');
    assert.equal(payment.metadata.checkout.orderNsu, 'KC-APROVADO');
    assert.equal(payment.metadata.checkout.slug, 'slug-3001');
    return { providerPaymentId: payment.provider_payment_id, status: 'captured', amount: 30, summary: { paid: true, orderNsu: 'KC-APROVADO', transactionNsu: 'tx-3001', slug: 'slug-3001', captureMethod: 'credit_card' } };
  } };
  paymentProviders.register('infinitepay', adapter);
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('a.id AS account_id') && sql.includes('LIMIT 1')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'external', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: {}, payment_account_id: accountId, order_code: 'KC-APROVADO', storefront_id: storefrontId, order_status: 'pending_payment', account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('a.id AS account_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'credit_card', status: 'pending', amount: '30.00', provider_payment_id: 'tx-3001', metadata: { checkout: { orderNsu: 'KC-APROVADO', transactionNsu: 'tx-3001', slug: 'slug-3001' } }, account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('o.public_code AS order_code')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: {}, payment_account_id: accountId, order_code: 'KC-APROVADO', storefront_id: storefrontId, order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id FROM commerce_payments')) return { rows: [] };
    if (sql.includes('SELECT p.id, p.order_id, p.method, p.status')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, method: 'credit_card', status: 'pending', amount: '30.00', order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '30.00' }] };
    return { rows: [] };
  } });
  try {
    const result = await reconcilePaymentByIdentifiers({ empresaId, lojaId, storefrontId }, '55555555-5555-4555-8555-555555555558', { transactionNsu: 'tx-3001', slug: 'slug-3001', captureMethod: 'credit_card' });
    assert.equal(result.status, 'captured');
    assert.equal(result.changed, true);
    const update = calls.find(call => call.sql.includes('UPDATE commerce_payments') && call.sql.includes('provider_payment_id = $3'));
    assert.deepEqual(update.values.slice(0, 3), [empresaId, '55555555-5555-4555-8555-555555555558', 'tx-3001']);
    assert.match(update.values[3], /slug-3001/);
    assert.match(update.values[3], /reconciliationBinding/);
    const scopedQueries = calls.filter(call => call.sql.includes('o.storefront_id = $4'));
    assert.equal(scopedQueries.length >= 2, true);
    assert.equal(scopedQueries.every(call => call.values[3] === storefrontId), true);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('infinitepay');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('reconciliação InfinitePay inválida não executa DML nem envenena provider_payment_id', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const calls = [];
  paymentProviders.register('infinitepay', {
    createCheckout: async () => ({}),
    verifyWebhook: async () => ({ eventId: 'evt' }),
    getStatus: async () => { throw new CommerceError('retorno rejeitado', 'PAYMENT_PROVIDER_REJECTED'); },
  });
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('a.id AS account_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'external', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: {}, payment_account_id: accountId, order_code: 'KC-APROVADO', storefront_id: storefrontId, order_status: 'pending_payment', account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    await assert.rejects(
      () => reconcilePaymentByIdentifiers({ empresaId, lojaId }, '55555555-5555-4555-8555-555555555558', { transactionNsu: 'tx-falso', slug: 'slug-falso', source: 'public_return' }),
      error => error.code === 'PAYMENT_PROVIDER_REJECTED',
    );
    assert.equal(calls.some(call => /^\s*(INSERT|UPDATE|DELETE)/i.test(call.sql)), false);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('infinitepay');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('retorno público pendente permanece somente leitura e não vincula identificadores', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const calls = [];
  paymentProviders.register('infinitepay', {
    createCheckout: async () => ({}),
    verifyWebhook: async () => ({ eventId: 'evt' }),
    getStatus: async () => ({ providerPaymentId: null, status: 'pending', amount: null, summary: { paid: false, verifiedBy: 'payment_check' } }),
  });
  const original = db.transaction;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('a.id AS account_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'external', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: {}, payment_account_id: accountId, order_code: 'KC-PENDENTE', storefront_id: storefrontId, order_status: 'pending_payment', account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    const result = await reconcilePaymentByIdentifiers({ empresaId, lojaId, storefrontId }, '55555555-5555-4555-8555-555555555558', { transactionNsu: 'tx-nao-confirmado', slug: 'slug-nao-confirmado', source: 'public_return' });
    assert.equal(result.status, 'pending');
    assert.equal(result.changed, false);
    assert.equal(result.pending, true);
    assert.equal(calls.some(call => /^\s*(INSERT|UPDATE|DELETE)/i.test(call.sql)), false);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('infinitepay');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('pedido sem reserva ativa exige novo pedido e não abre nova cobrança', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  let gatewayCalls = 0;
  const adapter = { createCheckout: async () => { gatewayCalls += 1; return { providerPaymentId: null, publicData: { url: 'https://checkout.example.test/pending' } }; }, verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  let orderStatus = 'payment_failed';
  db.transaction = async callback => callback({ query: async (sql, values) => {
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes("INSERT INTO commerce_idempotency_keys")) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-RETRY', loja_id: lojaId, storefront_id: storefrontId, status: orderStatus, total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
    throw new Error(`query não prevista: ${sql}`);
  } });
  try {
    for (const status of ['payment_failed', 'draft']) {
      orderStatus = status;
      await assert.rejects(
        () => createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: `payment-retry-${status}` }),
        error => error instanceof CommerceError && error.code === 'PAYMENT_ORDER_STATE_INVALID',
      );
    }
    assert.equal(gatewayCalls, 0);
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
      if (sql.includes('SELECT p.id, p.order_id, p.status, o.status AS order_status')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, status: 'pending', order_status: 'pending_payment' }] };
      if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '10.00' }] };
      if (sql.includes('SELECT id, location_id, variant_id')) return { rows: [] };
      if (sql.includes('UPDATE commerce_payments')) return { rows: [] };
      if (sql.includes('UPDATE commerce_orders') || sql.includes('commerce_order_events') || sql.includes('commerce_audit_logs')) return { rows: [] };
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

test('falha definitiva do createCheckout marca pedido payment_failed e libera reservas na mesma transação', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const adapter = { createCheckout: async () => { throw new CommerceError('recusado', 'PAYMENT_PROVIDER_REJECTED'); }, verifyWebhook: async () => ({ eventId: 'evt' }) };
  paymentProviders.register('testgateway', adapter);
  const original = db.transaction;
  const calls = [];
  const paymentId = '55555555-5555-4555-8555-555555555558';
  const reservationId = '66666666-6666-4666-8666-666666666666';
  const locationId = '77777777-7777-4777-8777-777777777777';
  const variantId = '88888888-8888-4888-8888-888888888888';
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_idempotency_keys')) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-FAIL', loja_id: lojaId, storefront_id: storefrontId, status: 'pending_payment', total: '10.00', moeda: 'BRL', customer_email: 'cliente@example.com' }] };
    if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT id, status, amount, provider, method, payment_account_id')) return { rows: [] };
    if (sql.includes('SELECT id, status, amount, provider, method, provider_payment_id')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_payments')) return { rows: [{ id: paymentId, status: 'pending', amount: '10.00', provider: 'testgateway', method: 'pix', provider_payment_id: null, metadata: {} }] };
    if (sql.includes('SELECT p.id, p.order_id, p.status, o.status AS order_status')) return { rows: [{ id: paymentId, order_id: orderId, status: 'pending', order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '10.00' }] };
    if (sql.includes('SELECT id, location_id, variant_id')) return { rows: [{ id: reservationId, location_id: locationId, variant_id: variantId, quantidade: 1, status: 'pending' }] };
    if (sql.includes('SELECT disponivel, reservado, comprometido')) return { rows: [{ disponivel: 2, reservado: 1, comprometido: 0 }] };
    return { rows: [] };
  } });
  try {
    await assert.rejects(() => createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-definitive-failure' }), error => error.code === 'PAYMENT_PROVIDER_REJECTED');
    assert.ok(calls.some(call => call.sql.includes("SET status = CASE WHEN $3::boolean THEN 'failed'")));
    assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_orders SET status = $3') && call.values[2] === 'payment_failed'));
    assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_inventory_reservations') && call.values[3] === 'released'));
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('reconciliação cancelada fecha pedido pendente e libera reserva na mesma transação', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const paymentId = '55555555-5555-4555-8555-555555555559';
  const reservationId = '66666666-6666-4666-8666-666666666667';
  const locationId = '77777777-7777-4777-8777-777777777778';
  const variantId = '88888888-8888-4888-8888-888888888889';
  paymentProviders.register('testgateway', {
    createCheckout: async () => ({}),
    verifyWebhook: async () => ({ eventId: 'evt' }),
    getStatus: async () => ({ status: 'cancelled', providerPaymentId: 'tx-cancelled', amount: 10, summary: {} }),
  });
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT p.id, p.order_id, p.provider')) return { rows: [{ id: paymentId, order_id: orderId, provider: 'testgateway', method: 'pix', status: 'pending', amount: '10.00', provider_payment_id: 'tx-cancelled', metadata: {}, order_status: 'pending_payment', storefront_id: storefrontId, account_id: accountId, ambiente: 'sandbox', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT p.id, p.order_id, p.method')) return { rows: [{ id: paymentId, order_id: orderId, method: 'pix', status: 'pending', amount: '10.00', order_status: 'pending_payment' }] };
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '10.00' }] };
    if (sql.includes('SELECT id, location_id, variant_id')) return { rows: [{ id: reservationId, location_id: locationId, variant_id: variantId, quantidade: 1, status: 'pending' }] };
    if (sql.includes('SELECT disponivel, reservado, comprometido')) return { rows: [{ disponivel: 9, reservado: 1, comprometido: 0 }] };
    return { rows: [] };
  } });
  try {
    const result = await syncPaymentAttempt({ empresaId, lojaId }, paymentId);
    assert.equal(result.status, 'cancelled');
    assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_payments') && call.values[2] === 'cancelled'));
    assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_orders SET status = $3') && call.values[2] === 'cancelled'));
    assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_inventory_reservations') && call.values[3] === 'released'));
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('captura tardia em pedido cancelado exige estorno e gera evento auditável sem reabrir o pedido', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const paymentId = '55555555-5555-4555-8555-555555555560';
  paymentProviders.register('testgateway', {
    createCheckout: async () => ({}),
    verifyWebhook: async () => ({ eventId: 'evt' }),
    getStatus: async () => ({ status: 'captured', providerPaymentId: 'tx-late-capture', amount: 10, summary: {} }),
  });
  const original = db.transaction;
  const calls = [];
  let lateCaptureStored = false;
  db.transaction = async callback => callback({ query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT p.id, p.order_id, p.provider')) return { rows: [{ id: paymentId, order_id: orderId, provider: 'testgateway', method: 'pix', status: 'pending', amount: '10.00', provider_payment_id: 'tx-late-capture', metadata: {}, order_status: 'cancelled', storefront_id: storefrontId, account_id: accountId, ambiente: 'sandbox', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT p.id, p.order_id, p.method')) return { rows: [{ id: paymentId, order_id: orderId, method: 'pix', status: 'pending', amount: '10.00', order_status: 'cancelled' }] };
    if (sql.includes("'{lateCapture}'")) {
      if (lateCaptureStored) return { rows: [] };
      lateCaptureStored = true;
      return { rows: [{ id: paymentId }] };
    }
    return { rows: [] };
  } });
  try {
    const result = await syncPaymentAttempt({ empresaId, lojaId }, paymentId);
    assert.equal(result.status, 'captured');
    assert.equal(result.refundRequired, true);
    assert.equal(lateCaptureStored, true);
    assert.equal(calls.some(call => call.sql.includes('UPDATE commerce_orders SET status')), false);
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_order_events')).length, 1);
    assert.equal(calls.filter(call => call.sql.includes("'late_capture_review'")).length, 1);
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('polling registra captura tardia quando pagamento ou pedido já está terminal', async t => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const paymentId = '55555555-5555-4555-8555-555555555561';
  paymentProviders.register('testgateway', {
    createCheckout: async () => ({}),
    verifyWebhook: async () => ({ eventId: 'evt' }),
    getStatus: async () => ({ status: 'captured', providerPaymentId: 'tx-late-terminal', amount: 10, summary: {} }),
  });
  const original = db.transaction;
  try {
    for (const { paymentStatus, orderStatus } of [
      { paymentStatus: 'cancelled', orderStatus: 'cancelled' },
      { paymentStatus: 'failed', orderStatus: 'cancelled' },
      { paymentStatus: 'refunded', orderStatus: 'cancelled' },
      { paymentStatus: 'pending', orderStatus: 'draft' },
      { paymentStatus: 'failed', orderStatus: 'payment_failed' },
    ]) {
      await t.test(`${paymentStatus}/${orderStatus}`, async () => {
        const calls = [];
        let lateCaptureStored = false;
        db.transaction = async callback => callback({ query: async (sql, values = []) => {
          calls.push({ sql, values });
          if (sql.includes('SELECT p.id, p.order_id, p.provider')) return { rows: [{ id: paymentId, order_id: orderId, provider: 'testgateway', method: 'pix', status: paymentStatus, amount: '10.00', provider_payment_id: 'tx-late-terminal', metadata: {}, order_status: orderStatus, storefront_id: storefrontId, account_id: accountId, ambiente: 'sandbox', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
          if (sql.includes('SELECT p.id, p.order_id, p.method')) return { rows: [{ id: paymentId, order_id: orderId, method: 'pix', status: paymentStatus, amount: '10.00', order_status: orderStatus }] };
          if (sql.includes("'{lateCapture}'")) { lateCaptureStored = true; return { rows: [{ id: paymentId }] }; }
          return { rows: [] };
        } });
        const result = await syncPaymentAttempt({ empresaId, lojaId }, paymentId);
        assert.equal(result.status, 'captured');
        assert.equal(result.refundRequired, true);
        assert.equal(lateCaptureStored, true);
        assert.ok(calls.some(call => call.sql.includes('UPDATE commerce_payments') && call.values[2] === 'captured'));
        assert.equal(calls.some(call => call.sql.includes('UPDATE commerce_orders SET status')), false);
      });
    }
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

test('captura quando o pedido não espera mais pagamento vira estorno (inclui pedido já pago por outra tentativa)', async () => {
  const { captureNeedsRefund } = await import('./payment-adapters.js');
  assert.equal(captureNeedsRefund('pending', 'pending_payment', 'captured'), false, 'pagamento normal');
  assert.equal(captureNeedsRefund('pending', 'paid', 'captured', { otherCaptured: true }), true, 'cliente pagou duas vezes');
  assert.equal(captureNeedsRefund('authorized', 'processing', 'captured', { otherCaptured: true }), true);
  assert.equal(captureNeedsRefund('pending', 'paid', 'captured'), false, 'pedido marcado pago à mão: a captura é o mesmo pagamento');
  assert.equal(captureNeedsRefund('pending', 'cancelled', 'captured'), true, 'pago depois de cancelado/expirado');
  assert.equal(captureNeedsRefund('failed', 'payment_failed', 'captured'), true);
  assert.equal(captureNeedsRefund('captured', 'paid', 'captured'), false, 'repetição do mesmo evento');
  assert.equal(captureNeedsRefund('pending', 'paid', 'failed'), false);
});

test('tentativa que caiu por tempo esgotado é retomada em vez de travar o pedido', async () => {
  const { db } = await import('./database.js');
  process.env.TEST_PAYMENT_ACCESS = 'token';
  const paymentId = '55555555-5555-4555-8555-55555555555a';
  let created = 0;
  paymentProviders.register('testgateway', {
    createCheckout: async ({ payment }) => { created += 1; assert.equal(payment.id, paymentId, 'mesma tentativa'); return { providerPaymentId: null, publicData: { url: 'https://checkout.example/abc' } }; },
    verifyWebhook: async () => ({ eventId: 'evt' }),
  });
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT request_hash')) return { rows: [] };
    if (sql.includes('SELECT o.id, o.public_code, o.loja_id')) return { rows: [{ id: orderId, public_code: 'KC-TIMEOUT', loja_id: lojaId, storefront_id: storefrontId, status: 'pending_payment', total: '10.00', moeda: 'BRL', customer_email: null }] };
    if (sql.includes('SELECT id, secret_ref, public_config')) return { rows: [{ id: accountId, secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {} }] };
    if (sql.includes('SELECT id, status, amount, provider, method, payment_account_id')) return { rows: [{ id: paymentId, status: 'pending', amount: '10.00', provider: 'testgateway', method: 'pix', payment_account_id: accountId, provider_payment_id: null, metadata: { checkoutState: 'unknown_requires_reconciliation' } }] };
    return { rows: [] };
  } });
  try {
    const result = await createPaymentAttempt({ empresaId, lojaId }, { orderId, accountId, provider: 'testgateway', method: 'pix', environment: 'sandbox', idempotencyKey: 'payment-retry-after-timeout' });
    assert.equal(result.paymentId, paymentId);
    assert.equal(result.checkout.url, 'https://checkout.example/abc');
    assert.equal(created, 1);
    assert.ok(!calls.some(call => call.sql.includes('INSERT INTO commerce_payments')), 'não cria outra cobrança');
  } finally {
    db.transaction = original;
    paymentProviders.adapters.delete('testgateway');
    delete process.env.TEST_PAYMENT_ACCESS;
  }
});

// A consulta ao provedor ocorre fora da transação. Simula outra captura B
// entrando após a leitura inicial de A e antes do FOR UPDATE final.
test('reconciliação concorrente não sobrescreve captura B com NSU A já verificado', async () => {
  const { db } = await import('./database.js');
  const original = db.transaction;
  const priorAdapter = paymentProviders.get('infinitepay');
  const priorEnv = process.env.TEST_PAYMENT_ACCESS;
  process.env.TEST_PAYMENT_ACCESS = 'synthetic-handle';
  paymentProviders.register('infinitepay', {
    createCheckout: async () => { throw new Error('checkout não pode ser criado'); },
    verifyWebhook: async () => { throw new Error('webhook não pode ser enviado'); },
    getStatus: async () => ({ providerPaymentId: 'tx-A', status: 'captured', amount: 30, summary: { paid: true, orderNsu: 'KC-CORRIDA', transactionNsu: 'tx-A', slug: 'slug-A', captureMethod: 'pix' } }),
  });
  const all = [];
  let auditInserts = 0;
  let webhookInserts = 0;
  db.transaction = async callback => callback({ query: async (sql, values) => {
    all.push({ sql, values });
    if (sql.includes('a.id AS account_id')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', method: 'external', status: 'pending', amount: '30.00', provider_payment_id: null, metadata: { checkout: { orderNsu: 'KC-CORRIDA', slug: null } }, payment_account_id: accountId, account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_PAYMENT_ACCESS', public_config: {}, order_code: 'KC-CORRIDA', storefront_id: storefrontId, order_status: 'pending_payment' }] };
    if (sql.includes('FOR UPDATE OF p')) return { rows: [{ id: '55555555-5555-4555-8555-555555555558', order_id: orderId, provider: 'infinitepay', status: 'captured', method: 'pix', amount: '30.00', provider_payment_id: 'tx-B', metadata: { checkout: { transactionNsu: 'tx-B' } }, payment_account_id: accountId, order_code: 'KC-CORRIDA', storefront_id: storefrontId, order_status: 'paid' }] };
    if (sql.includes('INSERT INTO commerce_payment_webhooks')) { webhookInserts++; return { rows: webhookInserts === 1 ? [{ id: 'synthetic-webhook' }] : [] }; }
    if (sql.includes('INSERT INTO commerce_audit_logs')) { auditInserts++; return { rows: [] }; }
    throw new Error('SQL inesperado em conflito: ' + sql.slice(0, 65));
  } });
  try {
    for (const pass of [1, 2]) {
      const result = await reconcilePaymentByIdentifiers({ empresaId, lojaId, storefrontId }, '55555555-5555-4555-8555-555555555558', { transactionNsu: 'tx-A', slug: 'slug-A', source: 'public_return' });
      assert.equal(result.conflict, true);
      assert.equal(result.refundRequired, true);
      assert.equal(result.changed, false);
      assert.equal(auditInserts, 1, `auditoria idempotente em replay ${pass}`);
    }
    assert.equal(webhookInserts, 2);
    assert.equal(all.filter(item => /^\s*UPDATE commerce_payments/i.test(item.sql)).length, 0);
  } finally {
    db.transaction = original;
    if (priorAdapter) paymentProviders.register('infinitepay', priorAdapter);
    else paymentProviders.adapters.delete('infinitepay');
    if (priorEnv === undefined) delete process.env.TEST_PAYMENT_ACCESS;
    else process.env.TEST_PAYMENT_ACCESS = priorEnv;
  }
});
