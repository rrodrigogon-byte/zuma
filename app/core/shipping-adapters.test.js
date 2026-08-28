import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { shippingProviders } from './shipping-adapters.js';

const originalFetch = global.fetch;
const originalToken = process.env.ME_ACCESS_TOKEN;
const originalWebhook = process.env.ME_WEBHOOK_SECRET;
const originalCorreiosToken = process.env.CORREIOS_API_TOKEN;

function restoreEnvironment() {
  if (originalToken === undefined) delete process.env.ME_ACCESS_TOKEN;
  else process.env.ME_ACCESS_TOKEN = originalToken;
  if (originalWebhook === undefined) delete process.env.ME_WEBHOOK_SECRET;
  else process.env.ME_WEBHOOK_SECRET = originalWebhook;
  if (originalCorreiosToken === undefined) delete process.env.CORREIOS_API_TOKEN;
  else process.env.CORREIOS_API_TOKEN = originalCorreiosToken;
  global.fetch = originalFetch;
}

test.afterEach(restoreEnvironment);

test('adapter Melhor Envio monta cotação real com CEP, produtos, serviços e idempotência ausente', async () => {
  process.env.ME_ACCESS_TOKEN = 'test-token';
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify([{ id: 1, name: 'PAC', price: '22.45', delivery_time: 5, company: { name: 'Correios', id: 1 } }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const adapter = shippingProviders.get('melhorenvio');
  const result = await adapter.quote({
    account: { secret_ref: 'env:ME_ACCESS_TOKEN', ambiente: 'sandbox', public_config: {} },
    originPostalCode: '01001000',
    destinationPostalCode: '20040002',
    products: [{ id: 'SKU-1', width: 10, height: 5, length: 20, weight: 0.5, insuranceValue: 39.9, quantity: 2 }],
    services: ['1', '2'],
    options: { receipt: true },
  });
  assert.equal(captured.url, 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate');
  assert.equal(captured.body.from.postal_code, '01001000');
  assert.equal(captured.body.to.postal_code, '20040002');
  assert.deepEqual(captured.body.products[0], { id: 'SKU-1', width: 10, height: 5, length: 20, weight: 0.5, insurance_value: 39.9, quantity: 2 });
  assert.equal(captured.body.services, '1,2');
  assert.equal(captured.body.options.receipt, true);
  assert.equal(result.options[0].amount, 22.45);
  assert.equal(result.options[0].carrier, 'Correios');
});

test('adapter Melhor Envio constrói carrinho, compra e gera etiqueta com chave de idempotência', async () => {
  process.env.ME_ACCESS_TOKEN = 'test-token';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    if (url.endsWith('/cart')) return new Response(JSON.stringify({ id: 'shipment-1', status: 'pending' }), { status: 200 });
    if (url.endsWith('/shipment/checkout')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url.endsWith('/shipment/generate')) return new Response(JSON.stringify({ 'shipment-1': { message: 'generated' } }), { status: 200 });
    if (url.endsWith('/shipment/print')) return new Response(JSON.stringify({ url: 'https://provider.test/label/1' }), { status: 200 });
    throw new Error(`unexpected URL ${url}`);
  };
  const adapter = shippingProviders.get('melhorenvio');
  const result = await adapter.createShipment({
    account: { secret_ref: 'env:ME_ACCESS_TOKEN', ambiente: 'sandbox', public_config: { shipment: { nonCommercial: true } } },
    selectedOption: { id: '1', raw: { id: 1, packages: [{ width: 10, height: 5, length: 20, weight: 0.5 }] } },
    from: { name: 'Loja', email: 'loja@example.com', phone: '11999999999', document: '12345678909', address: 'Rua A', number: '10', district: 'Centro', city: 'São Paulo', postal_code: '01001000', state_abbr: 'SP' },
    to: { name: 'Cliente', email: 'cliente@example.com', document: '98765432100', address: 'Rua B', number: '20', district: 'Centro', city: 'Rio de Janeiro', postal_code: '20040002', state_abbr: 'RJ' },
    products: [{ name: 'Produto', quantity: 2, unitaryValue: 19.95 }],
    idempotencyKey: 'shipping-attempt-1',
  });
  assert.equal(requests.length, 4);
  assert.equal(requests[0].body.service, 1);
  assert.equal(requests[0].body.options.non_commercial, true);
  assert.equal(requests[0].body.products[0].unitary_value, 19.95);
  assert.equal(requests[0].options.headers['X-Idempotency-Key'], 'shipping-attempt-1');
  assert.equal(result.providerShipmentId, 'shipment-1');
  assert.equal(result.labelUrl, 'https://provider.test/label/1');
});

test('webhook Melhor Envio valida X-ME-Signature e normaliza evento order.posted', async () => {
  process.env.ME_WEBHOOK_SECRET = 'webhook-secret';
  const payload = { event: 'order.posted', data: { id: 'shipment-1', status: 'posted', tracking: 'BR123', tracking_url: 'https://rastreio.test/BR123' } };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', process.env.ME_WEBHOOK_SECRET).update(rawBody).digest('base64');
  const adapter = shippingProviders.get('melhorenvio');
  const result = await adapter.verifyWebhook({ payload, signature, context: { rawBody, account: { public_config: { webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } } } });
  assert.equal(result.eventType, 'order.posted');
  assert.equal(result.providerShipmentId, 'shipment-1');
  assert.equal(result.providerStatus, 'posted');
  assert.equal(result.trackingCode, 'BR123');
  await assert.rejects(() => adapter.verifyWebhook({ payload, signature: 'invalid', context: { rawBody, account: { public_config: { webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } } } }), /assinatura do webhook/);
});


test('adapter Correios consulta preço e prazo por serviço com token server-side', async () => {
  process.env.CORREIOS_API_TOKEN = 'correios-token';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer correios-token');
    if (url.includes('/preco/v1/nacional/03220')) return new Response(JSON.stringify({ coProduto: '03220', pcFinal: 'R$ 18,90', psCobrado: '500' }), { status: 200 });
    if (url.includes('/prazo/v1/nacional/03220')) return new Response(JSON.stringify({ coProduto: '03220', prazoEntrega: 5, entregaDomiciliar: 'S' }), { status: 200 });
    throw new Error(`URL inesperada ${url}`);
  };
  const result = await shippingProviders.get('correios').quote({
    account: { provider: 'correios', secret_ref: 'env:CORREIOS_API_TOKEN', ambiente: 'sandbox', public_config: { services: ['03220'] } },
    originPostalCode: '01001000',
    destinationPostalCode: '20040002',
    products: [{ id: 'SKU-1', width: 10, height: 5, length: 20, weight: 0.5, insuranceValue: 39.9, quantity: 1 }],
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.startsWith('https://apihom.correios.com.br/preco/v1/nacional/03220?'), true);
  assert.equal(requests[1].url.startsWith('https://apihom.correios.com.br/prazo/v1/nacional/03220?'), true);
  assert.equal(result.provider, 'correios');
  assert.equal(result.options[0].id, '03220');
  assert.equal(result.options[0].amount, 18.9);
  assert.equal(result.options[0].deliveryDays, 5);
  assert.equal(result.options[0].carrier, 'Correios');
});

test('adapter Correios consulta rastreamento e recusa pré-postagem não validada', async () => {
  process.env.CORREIOS_API_TOKEN = 'correios-token';
  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer correios-token');
    assert.equal(url, 'https://apihom.correios.com.br/srorastro/v1/objetos/AA123456789BR?resultado=T');
    return new Response(JSON.stringify({ objetos: [{ codObjeto: 'AA123456789BR', eventos: [{ codigo: 'PO', descricao: 'Objeto postado', dtHrCriado: '2026-08-28T10:00:00', unidade: { endereco: { cidade: 'São Paulo', uf: 'SP' } } }] }] }), { status: 200 });
  };
  const result = await shippingProviders.get('correios').track({ account: { provider: 'correios', secret_ref: 'env:CORREIOS_API_TOKEN', ambiente: 'sandbox', public_config: {} }, providerShipmentId: 'AA123456789BR' });
  assert.equal(result.providerStatus, 'posted');
  assert.equal(result.trackingCode, 'AA123456789BR');
  assert.equal(result.events[0].status, 'PO');
  await assert.rejects(() => shippingProviders.get('correios').createShipment({}), error => error.code === 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
});
