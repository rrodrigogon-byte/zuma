import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCpfCnpj, normalizeCep, normalizeShippingAddress, publicShippingMethod, quoteShipping, shippingAccountReady, updateShippingTracking } from './commerce-shipping.js';

const originalFetch = global.fetch;
const originalToken = process.env.ME_ACCESS_TOKEN;
const originalWebhook = process.env.ME_WEBHOOK_SECRET;
const originalCorreiosToken = process.env.CORREIOS_API_TOKEN;

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.ME_ACCESS_TOKEN;
  else process.env.ME_ACCESS_TOKEN = originalToken;
  if (originalWebhook === undefined) delete process.env.ME_WEBHOOK_SECRET;
  else process.env.ME_WEBHOOK_SECRET = originalWebhook;
  if (originalCorreiosToken === undefined) delete process.env.CORREIOS_API_TOKEN;
  else process.env.CORREIOS_API_TOKEN = originalCorreiosToken;
});

test('normaliza CEP e exige documento em endereço de entrega', () => {
  assert.equal(normalizeCep('01001-000'), '01001000');
  assert.equal(isValidCpfCnpj('12345678909'), true);
  assert.equal(isValidCpfCnpj('11444777000161'), true);
  assert.equal(isValidCpfCnpj('12345678900'), false);
  assert.throws(() => normalizeCep('123'), /8 dígitos/);
  assert.throws(() => normalizeShippingAddress({ destinatario: 'Cliente', cep: '01001000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }), /CPF ou CNPJ/);
  assert.throws(() => normalizeShippingAddress({ destinatario: 'Cliente', documento: '12345678900', cep: '01001000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }), /inválido/);
  const address = normalizeShippingAddress({ destinatario: 'Cliente', email: 'Cliente@EXAMPLE.COM', telefone: '11999999999', documento: '12345678909', cep: '01001-000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'sp' });
  assert.deepEqual(address, { modo: 'entrega', destinatario: 'Cliente', email: 'cliente@example.com', telefone: '11999999999', documento: '12345678909', companyDocument: null, cep: '01001000', logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', referencia: null });
});

test('método público só habilita cotação com conta pronta e não expõe configuração interna', () => {
  const method = { id: '10000000-0000-4000-8000-000000000101', codigo: 'me', nome: 'Transportadora', tipo: 'delivery', configuracao: { provider: 'melhorenvio', shippingAccountId: '10000000-0000-4000-8000-000000000102', origin: { document: 'secret-like' } } };
  assert.equal(publicShippingMethod({ ...method, shipping_account_ready: false }).quoteEnabled, false);
  const publicMethod = publicShippingMethod({ ...method, shipping_account_ready: true });
  assert.equal(publicMethod.quoteEnabled, true);
  assert.equal(publicMethod.configuracao.origin, undefined);
  assert.equal(publicShippingMethod({ ...method, configuracao: { ...method.configuracao, shippingAccountId: undefined, accountId: '10000000-0000-4000-8000-000000000102' }, shipping_account_ready: true }).quoteEnabled, true);
  assert.equal(shippingAccountReady({ id: '10000000-0000-4000-8000-000000000102', provider: 'melhorenvio', ativo: true, secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } }), false);
  process.env.ME_ACCESS_TOKEN = 'token';
  process.env.ME_WEBHOOK_SECRET = 'secret';
  assert.equal(shippingAccountReady({ id: '10000000-0000-4000-8000-000000000102', provider: 'melhorenvio', ativo: true, secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } }), true);
});

test('tracking preserva ocorrência e respeita transições válidas do fulfillment', async () => {
  const statements = [];
  const trx = { query: async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT id, status, ocorrencias')) return { rows: [{ id: '10000000-0000-4000-8000-000000000107', status: 'ready', ocorrencias: [] }] };
    if (sql.includes('UPDATE commerce_fulfillments')) return { rows: [{ id: '10000000-0000-4000-8000-000000000107', status: 'shipped', tracking_code: 'BR123' }] };
    throw new Error(`query inesperada: ${sql}`);
  } };
  const updated = await updateShippingTracking(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, '10000000-0000-4000-8000-000000000107', { providerStatus: 'posted', trackingCode: 'BR123', trackingUrl: 'https://rastreio.test/BR123' });
  assert.equal(updated.status, 'shipped');
  assert.equal(statements[1].sql.includes('status = $3'), true);
});

test('cotação chama o provedor real fora da transação e persiste snapshot idempotente', async () => {
  process.env.ME_ACCESS_TOKEN = 'token';
  process.env.ME_WEBHOOK_SECRET = 'secret';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate');
    const body = JSON.parse(options.body);
    assert.equal(body.from.postal_code, '01001000');
    assert.equal(body.to.postal_code, '20040002');
    return new Response(JSON.stringify([{ id: 1, name: 'PAC', price: 25, delivery_time: 4, company: { name: 'Correios', id: 1 }, packages: [{ width: 10, height: 5, length: 20, weight: 0.5 }] }]), { status: 200 });
  };
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000101', codigo: 'melhorenvio', nome: 'Correios', tipo: 'delivery', configuracao: { provider: 'melhorenvio', shippingAccountId: '10000000-0000-4000-8000-000000000102', origemCep: '01001000' }, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104', configuracoes: {} }] };
      if (sql.includes('FROM commerce_shipping_accounts')) return { rows: [{ id: '10000000-0000-4000-8000-000000000102', storefront_id: '10000000-0000-4000-8000-000000000103', provider: 'melhorenvio', ambiente: 'sandbox', secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' }, ativo: true }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU-1', nome: 'Produto', peso_gramas: 500, largura_cm: 10, altura_cm: 5, comprimento_cm: 20, price: 39.9 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT id FROM commerce_shipping_accounts')) return { rows: [{ id: '10000000-0000-4000-8000-000000000102' }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) return { rows: [{ id: 'quote-1', expires_at: '2099-01-01T00:00:00.000Z' }] };
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, { storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000101', destinationCep: '20040-002', items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 2 }] });
  assert.equal(result.quoteId, 'quote-1');
  assert.equal(result.provider, 'melhorenvio');
  assert.equal(result.items[0].amount, 25);
  assert.equal(queries.some(item => item.sql.includes('INSERT INTO commerce_shipping_quotes')), true);
});


test('conta Correios só fica pronta com token, origem e serviço contratado', () => {
  process.env.CORREIOS_API_TOKEN = 'correios-token';
  const base = { id: '10000000-0000-4000-8000-000000000108', provider: 'correios', ativo: true, secret_ref: 'env:CORREIOS_API_TOKEN', public_config: { origemCep: '01001000' } };
  assert.equal(shippingAccountReady(base), false);
  assert.equal(shippingAccountReady({ ...base, public_config: { origemCep: '01001000', services: ['03220'] } }), true);
  assert.equal(shippingAccountReady({ ...base, public_config: { origemCep: '01001000', services: ['03220'] }, ambiente: 'sandbox' }), true);
});
