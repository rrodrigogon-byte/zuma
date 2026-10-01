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
    return new Response(JSON.stringify({ success: true, paid: true, amount: 8500, capture_method: 'credit_card', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', slug: 'slug-test' }), {
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
    assert.equal(result.eventId, 'tx-9001:captured');
    assert.equal(result.providerPaymentId, 'tx-9001');
    assert.equal(result.amount, 85);
    assert.deepEqual(requestBody, { handle: 'handle-teste', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', slug: 'slug-test' });
    assert.equal(result.signatureValid, false);
    assert.equal(result.verification, 'provider_payment_check');
    assert.deepEqual(result.summary, { paid: true, orderNsu: 'KC-TESTE-INFINITEPAY', transactionNsu: 'tx-9001', captureMethod: 'credit_card', slug: 'slug-test', verifiedBy: 'payment_check' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('InfinitePay rejeita identificadores divergentes devolvidos pelo payment_check', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid: true, amount: 8500, capture_method: 'credit_card', order_nsu: 'KC-OUTRO', transaction_nsu: 'tx-9001', slug: 'slug-test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      () => adapter.verifyWebhook({ payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001' }, context: { account: account() } }),
      error => error instanceof CommerceError && error.code === 'PAYMENT_WEBHOOK_INVALID',
    );
  } finally { globalThis.fetch = originalFetch; }
});

const verifiedSale = {
  success: true,
  paid: true,
  amount: 8500,
  capture_method: 'credit_card',
  order_nsu: 'KC-TESTE-INFINITEPAY',
  transaction_nsu: 'tx-9001',
  slug: 'slug-test',
};

for (const field of ['order_nsu', 'transaction_nsu', 'slug']) {
  for (const variant of ['ausente', 'divergente']) {
    test(`getStatus rejeita ${field} ${variant} antes de capturar`, async () => {
      const originalFetch = globalThis.fetch;
      const response = { ...verifiedSale };
      if (variant === 'ausente') delete response[field];
      else response[field] = `outro-${field}`;
      globalThis.fetch = async () => new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
      try {
        await assert.rejects(
          () => adapter.getStatus({ payment: { amount: '85.00', method: 'external', provider_payment_id: 'tx-9001', metadata: { checkout: { orderNsu: 'KC-TESTE-INFINITEPAY', slug: 'slug-test' } } }, account: account() }),
          error => error instanceof CommerceError && error.code === 'PAYMENT_PROVIDER_STATUS_INVALID',
        );
      } finally { globalThis.fetch = originalFetch; }
    });

    test(`verifyWebhook rejeita ${field} ${variant} antes de capturar`, async () => {
      const originalFetch = globalThis.fetch;
      const response = { ...verifiedSale };
      if (variant === 'ausente') delete response[field];
      else response[field] = `outro-${field}`;
      globalThis.fetch = async () => new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
      try {
        await assert.rejects(
          () => adapter.verifyWebhook({ payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001' }, context: { account: account(), expectedAmount: 85, expectedMethod: 'external' } }),
          error => error instanceof CommerceError && error.code === 'PAYMENT_WEBHOOK_INVALID',
        );
      } finally { globalThis.fetch = originalFetch; }
    });
  }
}

for (const [name, change, code] of [
  ['valor divergente', { amount: 8400 }, 'PAYMENT_AMOUNT_MISMATCH'],
  ['método ausente', { capture_method: undefined }, 'PAYMENT_PROVIDER_STATUS_INVALID'],
  ['método divergente', { capture_method: 'pix' }, 'PAYMENT_PROVIDER_STATUS_INVALID'],
]) {
  test(`getStatus rejeita ${name}`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ ...verifiedSale, ...change }), { status: 200, headers: { 'content-type': 'application/json' } });
    try {
      await assert.rejects(
        () => adapter.getStatus({ payment: { amount: '85.00', method: 'credit_card', provider_payment_id: 'tx-9001', metadata: { checkout: { orderNsu: 'KC-TESTE-INFINITEPAY', slug: 'slug-test' } } }, account: account() }),
        error => error instanceof CommerceError && error.code === code,
      );
    } finally { globalThis.fetch = originalFetch; }
  });
}

test('getStatus é determinístico em replay autoritativo', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify(verifiedSale), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const input = { payment: { amount: '85.00', method: 'external', provider_payment_id: 'tx-9001', metadata: { checkout: { orderNsu: 'KC-TESTE-INFINITEPAY', slug: 'slug-test' } } }, account: account() };
    assert.deepEqual(await adapter.getStatus(input), await adapter.getStatus(input));
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('timeout abortado é classificado sem chamada real', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const error = new Error('aborted');
    error.name = options.signal?.aborted ? 'AbortError' : 'AbortError';
    throw error;
  };
  try {
    await assert.rejects(
      () => adapter.getStatus({ payment: { amount: '85.00', method: 'external', provider_payment_id: 'tx-9001', metadata: { checkout: { orderNsu: 'KC-TESTE-INFINITEPAY', slug: 'slug-test' } } }, account: account() }),
      error => error instanceof CommerceError && error.code === 'PAYMENT_PROVIDER_TIMEOUT',
    );
  } finally { globalThis.fetch = originalFetch; }
});

test('InfinitePay ignora valor e método não confirmados pelo payment_check', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await adapter.verifyWebhook({ payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', amount: 1, capture_method: 'credit_card' }, context: { account: account() } });
    assert.equal(result.status, 'pending');
    assert.equal(result.eventId, 'tx-9001:pending');
    assert.equal(result.providerPaymentId, null);
    assert.equal(result.amount, null);
    assert.equal(result.summary.captureMethod, null);
  } finally { globalThis.fetch = originalFetch; }
});

test('getStatus pendente não devolve o NSU do payload como identificador verificado', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await adapter.getStatus({ payment: { amount: '85.00', method: 'external', provider_payment_id: 'tx-nao-confirmado', metadata: { checkout: { orderNsu: 'KC-TESTE-INFINITEPAY', slug: 'slug-test' } } }, account: account() });
    assert.equal(result.status, 'pending');
    assert.equal(result.providerPaymentId, null);
    assert.equal(result.summary.transactionNsu, null);
  } finally { globalThis.fetch = originalFetch; }
});

test('webhook fabricado não captura quando payment_check não confirma a venda', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid: false, amount: 8500 }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await adapter.verifyWebhook({ payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-fabricada', paid: true }, context: { account: account(), expectedOrderNsu: 'KC-TESTE-INFINITEPAY', expectedAmount: 85 } });
    assert.equal(result.status, 'pending');
    assert.equal(result.summary.paid, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('payment_check com valor divergente é rejeitado antes da mutação', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid: true, amount: 1, capture_method: 'pix', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001', slug: 'slug-test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      () => adapter.verifyWebhook({ payload: { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-9001' }, context: { account: account(), expectedOrderNsu: 'KC-TESTE-INFINITEPAY', expectedAmount: 85 } }),
      error => error instanceof CommerceError && error.code === 'PAYMENT_AMOUNT_MISMATCH',
    );
  } finally { globalThis.fetch = originalFetch; }
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

test('o aviso de pago do mesmo NSU não é descartado como duplicado do aviso pendente', async () => {
  const originalFetch = globalThis.fetch;
  let paid = false;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, paid, amount: 8500, order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-dup', slug: 'slug-test', capture_method: 'pix' }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const payload = { invoice_slug: 'slug-test', order_nsu: 'KC-TESTE-INFINITEPAY', transaction_nsu: 'tx-dup' };
    const pendente = await adapter.verifyWebhook({ payload, context: { account: account() } });
    paid = true;
    const pago = await adapter.verifyWebhook({ payload, context: { account: account() } });
    assert.notEqual(pendente.eventId, pago.eventId);
    assert.equal(pago.status, 'captured');
  } finally { globalThis.fetch = originalFetch; }
});
