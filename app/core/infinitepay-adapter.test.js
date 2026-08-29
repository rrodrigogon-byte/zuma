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
