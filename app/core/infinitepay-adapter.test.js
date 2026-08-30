import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfinitePayAdapter } from './infinitepay-adapter.js';
import { CommerceError } from './commerce-core.js';

const adapter = createInfinitePayAdapter();
const order = {
  id: '55555555-5555-4555-8555-555555555555',
  publicCode: 'KC-TESTE-INFINITEPAY',
  total: '85.00',
  moeda: 'BRL',
};

function account() {
  return { publicConfig: { handle: 'handle-teste' } };
}

test('InfinitePay envia o payload operacional com items em centavos', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ link: 'https://checkout.infinitepay.com.br/checkout-test', slug: 'slug-test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await adapter.createCheckout({ order, account: account() });
    assert.equal(result.publicData.url, 'https://checkout.infinitepay.com.br/checkout-test');
    assert.equal(result.publicData.slug, 'slug-test');
    assert.deepEqual(requestBody.items, [{ quantity: 1, price: 8500, description: 'Pedido Kytto KC-TESTE-INFINITEPAY' }]);
    assert.equal('itens' in requestBody, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('InfinitePay classifica rejeição do provedor sem expor payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'invalid_request', message: 'payload inválido' }), {
    status: 422,
    headers: { 'content-type': 'application/json' },
  });
  try {
    await assert.rejects(
      () => adapter.createCheckout({ order, account: account() }),
      error => error instanceof CommerceError
        && error.code === 'PAYMENT_PROVIDER_REJECTED'
        && error.details?.providerStatus === 422
        && error.details?.providerCode === 'invalid_request',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('InfinitePay identifica Checkout Integrado desabilitado', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: 'external_checkout_not_enabled',
    message: 'External checkout is not enabled for this merchant.',
  }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
  try {
    await assert.rejects(
      () => adapter.createCheckout({ order, account: account() }),
      error => error instanceof CommerceError
        && error.code === 'PAYMENT_PROVIDER_NOT_READY'
        && error.details?.providerStatus === 404
        && error.details?.providerCode === 'external_checkout_not_enabled',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('InfinitePay normaliza webhook aprovado com identificadores e comprovante', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ success: true, paid: true, amount: 8500, capture_method: 'credit_card' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await adapter.verifyWebhook({
      payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', capture_method: 'credit_card', receipt_url: 'https://receipt.example/tx-9001' },
      context: { account: account() },
    });
    assert.equal(result.status, 'captured');
    assert.equal(result.providerPaymentId, 'tx-9001');
    assert.equal(result.amount, 85);
    assert.deepEqual(requestBody, { handle: 'handle-teste', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', slug: 'slug-test' });
    assert.deepEqual(result.summary, { paid: true, orderNsu: 'KC-TESTE-INFINITEPAY', transactionNsu: 'tx-9001', captureMethod: 'credit_card', receiptUrl: 'https://receipt.example/tx-9001', slug: 'slug-test' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('InfinitePay bloqueia handle divergente entre Commerce e ambiente', async () => {
  const originalHandle = process.env.INFINITEPAY_HANDLE;
  process.env.INFINITEPAY_HANDLE = 'handle-do-ambiente';
  try {
    await assert.rejects(
      () => adapter.createCheckout({ order, account: { ...account(), secretRef: 'env:INFINITEPAY_HANDLE' } }),
      error => error instanceof CommerceError
        && error.code === 'PAYMENT_ACCOUNT_INVALID'
        && error.details?.reason === 'handle_mismatch',
    );
  } finally {
    if (originalHandle === undefined) delete process.env.INFINITEPAY_HANDLE;
    else process.env.INFINITEPAY_HANDLE = originalHandle;
  }
});
