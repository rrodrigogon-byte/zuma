import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommercePublicRouter, publicCommercePolicy } from './commerce-routes.js';
import { paymentProviders } from './payment-adapters.js';
import { db } from './database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const storefrontId = '33333333-3333-4333-8333-333333333333';
const paymentId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const accountId = '66666666-6666-4666-8666-666666666666';
const code = 'KC-RETURN-TEST';

function handler() {
  const route = createCommercePublicRouter().stack.find(item => item.route?.path === '/orders/:publicCode/payments/return');
  assert.ok(route?.route?.stack?.[0]?.handle);
  return route.route.stack[0].handle;
}
function response() {
  return { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
}
function request() {
  return {
    publicResolvedStorefront: { id: storefrontId, empresa_id: empresaId, loja_id: lojaId, status: 'active' },
    params: { publicCode: code },
    body: { transactionNsu: 'tx-synthetic', slug: 'slug-synthetic' },
  };
}

test('retorno público tem quota própria menor que escrita geral', () => {
  assert.deepEqual(publicCommercePolicy({ method: 'POST', path: `/orders/${code}/payments/return` }), { scope: 'public-payment-return', limit: 8, windowSeconds: 600 });
});

test('slug ausente em /links: tentativa única de mesmo tenant, pedido e checkout válido é somente consultada quando payment_check diz não pago', async () => {
  const priorQuery = db.query;
  const priorTransaction = db.transaction;
  const priorAdapter = paymentProviders.get('infinitepay');
  const priorEnv = process.env.TEST_INFINITEPAY_RETURN_HANDLE;
  const queries = [];
  let providerCalls = 0;
  process.env.TEST_INFINITEPAY_RETURN_HANDLE = 'synthetic-handle';
  paymentProviders.register('infinitepay', {
    async createCheckout() { throw new Error('não criar cobrança no teste'); },
    async verifyWebhook() { throw new Error('não enviar webhook no teste'); },
    async getStatus({ payment }) {
      providerCalls++;
      assert.equal(payment.metadata.checkout.orderNsu, code);
      assert.equal(payment.metadata.checkout.transactionNsu, 'tx-synthetic');
      assert.equal(payment.metadata.checkout.slug, 'slug-synthetic');
      return { providerPaymentId: null, status: 'pending', amount: null, summary: { paid: false, verifiedBy: 'payment_check' } };
    },
  });
  db.query = async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes('FROM commerce_orders WHERE')) return { rows: [{ id: orderId }] };
    if (sql.includes('FROM commerce_payments p')) return { rows: [{ id: paymentId }] };
    throw new Error('SQL público inesperado');
  };
  db.transaction = async callback => callback({ query: async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes('a.id AS account_id')) return { rows: [{ id: paymentId, order_id: orderId, provider: 'infinitepay', method: 'external', status: 'pending', amount: '85.00', provider_payment_id: null, metadata: { checkout: { orderNsu: code, url: 'https://checkout.infinitepay.io/synthetic', slug: null } }, payment_account_id: accountId, account_id: accountId, ambiente: 'production', secret_ref: 'env:TEST_INFINITEPAY_RETURN_HANDLE', public_config: { handle: 'synthetic-handle' }, order_code: code, storefront_id: storefrontId, order_status: 'pending_payment' }] };
    throw new Error('SQL transacional inesperado');
  } });
  const res = response();
  try {
    await handler()(request(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { status: 'pending', changed: false, pending: true, refundRequired: false });
    assert.equal(providerCalls, 1);
    assert.deepEqual(queries[0].args, [empresaId, storefrontId, code]);
    assert.deepEqual(queries[1].args, [empresaId, orderId, 'tx-synthetic', 'slug-synthetic', code]);
    assert.match(queries[1].sql, /p\.metadata->'checkout'->>'slug' IS NULL/);
    assert.match(queries[1].sql, /p\.metadata->'checkout'->>'orderNsu' = \$5/);
    assert.equal(queries.some(call => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(call.sql)), false);
  } finally {
    db.query = priorQuery;
    db.transaction = priorTransaction;
    if (priorAdapter) paymentProviders.register('infinitepay', priorAdapter);
    else paymentProviders.adapters.delete('infinitepay');
    if (priorEnv === undefined) delete process.env.TEST_INFINITEPAY_RETURN_HANDLE;
    else process.env.TEST_INFINITEPAY_RETURN_HANDLE = priorEnv;
  }
});

test('duas tentativas possíveis nunca selecionam a mais recente nem fazem DML ou payment_check', async () => {
  const priorQuery = db.query;
  const priorTransaction = db.transaction;
  const queries = [];
  db.query = async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes('FROM commerce_orders WHERE')) return { rows: [{ id: orderId }] };
    if (sql.includes('FROM commerce_payments p')) return { rows: [{ id: paymentId }, { id: '77777777-7777-4777-8777-777777777777' }] };
    throw new Error('SQL inesperado');
  };
  db.transaction = async () => { throw new Error('não pode abrir transação no candidato ambíguo'); };
  try {
    const res = response();
    await handler()(request(), res);
    assert.notEqual(res.statusCode, 200);
    assert.equal(res.body.code, 'PAYMENT_RECONCILIATION_CONFLICT');
    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /LIMIT 2/);
  } finally { db.query = priorQuery; db.transaction = priorTransaction; }
});

test('pedido de outra vitrine não admite tentativa nem consulta provider', async () => {
  const priorQuery = db.query;
  const priorTransaction = db.transaction;
  db.query = async sql => {
    assert.match(sql, /empresa_id = \$1 AND storefront_id = \$2/);
    return { rows: [] };
  };
  db.transaction = async () => { throw new Error('não pode abrir transação cross-store'); };
  try {
    const res = response();
    await handler()(request(), res);
    assert.equal(res.body.code, 'ORDER_NOT_FOUND');
  } finally { db.query = priorQuery; db.transaction = priorTransaction; }
});
