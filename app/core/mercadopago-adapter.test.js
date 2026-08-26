import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createMercadoPagoAdapter } from './mercadopago-adapter.js';

test('Mercado Pago valida x-signature e normaliza pagamento aprovado', async () => {
  const previous = { secret: process.env.MP_WEBHOOK_SECRET, token: process.env.MP_ACCESS_TOKEN, fetch: global.fetch };
  process.env.MP_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.MP_ACCESS_TOKEN = 'test-access-token';
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: '123', status: 'approved', transaction_amount: 49.9, status_detail: 'accredited' }) });
  try {
    const ts = '1704908010';
    const dataId = '123';
    const requestId = 'request-1';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const digest = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
    const result = await createMercadoPagoAdapter().verifyWebhook({
      payload: { id: 'event-1', type: 'payment', data: { id: dataId } },
      signature: `ts=${ts},v1=${digest}`,
      context: { dataId, requestId },
    });
    assert.equal(result.providerPaymentId, dataId);
    assert.equal(result.status, 'captured');
    assert.equal(result.amount, 49.9);
  } finally {
    if (previous.secret === undefined) delete process.env.MP_WEBHOOK_SECRET; else process.env.MP_WEBHOOK_SECRET = previous.secret;
    if (previous.token === undefined) delete process.env.MP_ACCESS_TOKEN; else process.env.MP_ACCESS_TOKEN = previous.token;
    global.fetch = previous.fetch;
  }
});

test('Mercado Pago rejeita assinatura inválida antes de consultar pagamento', async () => {
  const previous = { secret: process.env.MP_WEBHOOK_SECRET, token: process.env.MP_ACCESS_TOKEN, fetch: global.fetch };
  process.env.MP_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.MP_ACCESS_TOKEN = 'test-access-token';
  global.fetch = async () => { throw new Error('não deveria consultar o provedor'); };
  try {
    await assert.rejects(
      () => createMercadoPagoAdapter().verifyWebhook({
        payload: { id: 'event-1', data: { id: '123' } },
        signature: 'ts=1704908010,v1=invalid',
        context: { dataId: '123', requestId: 'request-1' },
      }),
      error => error.code === 'PAYMENT_WEBHOOK_INVALID',
    );
  } finally {
    if (previous.secret === undefined) delete process.env.MP_WEBHOOK_SECRET; else process.env.MP_WEBHOOK_SECRET = previous.secret;
    if (previous.token === undefined) delete process.env.MP_ACCESS_TOKEN; else process.env.MP_ACCESS_TOKEN = previous.token;
    global.fetch = previous.fetch;
  }
});
