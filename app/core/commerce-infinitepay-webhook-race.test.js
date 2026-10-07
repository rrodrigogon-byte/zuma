import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommerceWebhookRouter } from './commerce-routes.js';
import { paymentProviders } from './payment-adapters.js';
import { db } from './database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const orderId = '55555555-5555-4555-8555-555555555555';
const paymentId = '44444444-4444-4444-8444-444444444444';
const accountId = '66666666-6666-4666-8666-666666666666';

function webhookHandler() {
  const route = createCommerceWebhookRouter().stack.find(item => item.route?.path === '/:provider/payments');
  assert.ok(route);
  return route.route.stack[0].handle;
}
function response() {
  return { statusCode: 200, body: null, status(value) { this.statusCode=value; return this; }, json(value) { this.body=value; return this; } };
}

test('webhook concorrente B pago não sobrescreve captura A; replay mantém erro e única auditoria', async () => {
  const priorQuery = db.query;
  const priorTransaction = db.transaction;
  const priorAdapter = paymentProviders.get('infinitepay');
  const calls = [];
  let providerCalls = 0;
  let auditInserts = 0;
  let webhookInserts = 0;
  paymentProviders.register('infinitepay', {
    createCheckout: async () => { throw new Error('sem cobranças'); },
    verifyWebhook: async (_input) => {
      providerCalls++;
      assert.equal(_input.context.expectedOrderNsu,'KC-RACE-SYNTHETIC');
      return { eventId: 'tx-B:captured', eventType: 'payment.updated', status: 'captured', amount: 30, providerPaymentId: 'tx-B', signatureValid: true, verification: 'payment_check', summary: { paid: true, orderNsu: 'KC-RACE-SYNTHETIC', transactionNsu: 'tx-B', slug: 'slug-B', captureMethod: 'pix' } };
    },
  });
  db.query = async sql => {
    calls.push(sql);
    if (sql.includes('p.provider_payment_id = $2')) return { rows: [] };
    if (sql.includes('p.provider_payment_id IS NULL') && sql.includes("p.status = 'pending'")) return { rows: [{ payment_id: paymentId, empresa_id: empresaId, payment_account_id: accountId, amount: '30', method: 'external', provider_payment_id: null, order_code: 'KC-RACE-SYNTHETIC', secret_ref: 'env:SYNTHETIC', public_config: {} }] };
    throw new Error('SELECT owner inesperado');
  };
  db.transaction = async callback => callback({ query: async (sql, values) => {
    calls.push(sql);
    if (sql.includes('INSERT INTO commerce_payment_webhooks')) { webhookInserts++; return { rows: webhookInserts === 1 ? [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] : [] }; }
    if (sql.includes('SELECT status, payload_resumido')) return { rows: [{ status: 'failed', review_code: 'PROVIDER_CAPTURE_CONFLICT' }] };
    if (sql.includes('FOR UPDATE OF p')) return { rows: [{ id: paymentId, order_id: orderId, method: 'pix', amount: '30', status: 'captured', provider_payment_id: 'tx-A', order_status: 'paid' }] };
    if (sql.includes('UPDATE commerce_payment_webhooks')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) { auditInserts++; return { rows: [] }; }
    throw new Error('DML inesperado no webhook: ' + sql.slice(0, 65));
  } });
  const req = { params: { provider: 'infinitepay' }, query: {}, body: { order_nsu: 'KC-RACE-SYNTHETIC', transaction_nsu: 'tx-B', invoice_slug: 'slug-B' }, headers: {}, rawBody: Buffer.from('{}') };
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = response();
      await webhookHandler()(req,res);
      assert.equal(res.statusCode,400);
      assert.equal(res.body.code,'PROVIDER_CAPTURE_CONFLICT');
      assert.equal(auditInserts,1,`auditoria única no replay ${attempt}`);
    }
    assert.equal(providerCalls,2);
    assert.equal(calls.some(sql => /^\s*UPDATE commerce_payments/i.test(sql)),false);
    assert.equal(calls.some(sql => sql.includes('transitionOrder')),false);
  } finally {
    db.query = priorQuery;
    db.transaction = priorTransaction;
    if (priorAdapter) paymentProviders.register('infinitepay',priorAdapter);
    else paymentProviders.adapters.delete('infinitepay');
  }
});
