import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPaymentAccount,
  listPaymentAccounts,
  listPaymentProviders,
  updatePaymentAccount,
} from './commerce-payment-admin.js';
import { CommerceError } from './commerce-core.js';
import { paymentProviders } from './payment-adapters.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const storefrontId = '33333333-3333-4333-8333-333333333333';
const accountId = '44444444-4444-4444-8444-444444444444';
const context = { empresaId, lojaId, usuarioId: '66666666-6666-4666-8666-666666666666' };

function errorWithCode(code) {
  return error => error instanceof CommerceError && error.code === code;
}

test('provedores retornam somente contrato público e distinguem adapter registrado', () => {
  const result = listPaymentProviders();
  const mercadoPago = result.items.find(item => item.code === 'mercadopago');
  assert.deepEqual(Object.keys(mercadoPago).sort(), ['adapter', 'code', 'methods', 'name', 'registered'].sort());
  assert.equal(mercadoPago.adapter, true);
  assert.equal(Array.isArray(mercadoPago.methods), true);
  assert.equal('secretRefs' in mercadoPago, false);
});

test('referência de segredo rejeita token real ou formato arbitrário', async () => {
  await assert.rejects(
    () => createPaymentAccount({ query: async () => ({ rows: [] }) }, context, {
      storefrontId,
      provider: 'mercadopago',
      nome: 'MP Sandbox',
      secretRef: 'APP_USR-real-token-value',
      publicConfig: { webhookSecretRef: 'env:MP_WEBHOOK_SECRET' },
    }),
    errorWithCode('PAYMENT_SECRET_REF_INVALID'),
  );
});

test('conta ativa não pode ser criada sem credenciais presentes no ambiente', async () => {
  const trx = { query: async () => ({ rows: [] }) };
  await assert.rejects(
    () => createPaymentAccount(trx, context, {
      storefrontId,
      provider: 'mercadopago',
      nome: 'MP Sandbox',
      secretRef: 'env:MP_ACCESS_TOKEN',
      ativo: true,
      publicConfig: { webhookSecretRef: 'env:MP_WEBHOOK_SECRET' },
    }),
    errorWithCode('PAYMENT_ACCOUNT_NOT_CONFIGURED'),
  );
});

test('cadastro exige storefront e não retorna secret_ref nem webhookSecretRef', async () => {
  const queries = [];
  const trx = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
      if (sql.includes('INSERT INTO commerce_payment_accounts')) {
        return {
          rows: [{
            id: accountId,
            storefront_id: storefrontId,
            provider: 'mercadopago',
            ambiente: 'sandbox',
            nome: 'MP Sandbox',
            secret_ref: 'env:MP_ACCESS_TOKEN',
            public_config: { webhookSecretRef: 'env:MP_WEBHOOK_SECRET', methods: ['pix'] },
            ativo: false,
          }],
        };
      }
      return { rows: [] };
    },
  };
  const result = await createPaymentAccount(trx, context, {
    storefrontId,
    provider: 'mercadopago',
    nome: 'MP Sandbox',
    secretRef: 'env:MP_ACCESS_TOKEN',
    publicConfig: { webhookSecretRef: 'env:MP_WEBHOOK_SECRET', methods: ['pix'] },
    ativo: false,
  });
  assert.equal(result.id, accountId);
  assert.equal(result.secret_configured, false);
  assert.equal(result.webhook_configured, false);
  assert.equal(result.ready, false);
  assert.equal('secret_ref' in result, false);
  assert.equal('webhookSecretRef' in result.public_config, false);
  assert.equal(queries[0].values[0], empresaId);
});

test('listagem usa empresa e loja do contexto e mascara configuração sensível', async () => {
  let received;
  const client = {
    query: async (sql, values) => {
      received = { sql, values };
      return {
        rows: [{
          id: accountId,
          storefront_id: storefrontId,
          storefront_name: 'Loja Teste',
          provider: 'mercadopago',
          ambiente: 'sandbox',
          nome: 'MP Sandbox',
          secret_ref: 'env:MP_ACCESS_TOKEN',
          public_config: { webhookSecretRef: 'env:MP_WEBHOOK_SECRET', webhookUrl: 'https://example.test/webhook', methods: ['pix'] },
          ativo: false,
        }],
      };
    },
  };
  const result = await listPaymentAccounts(client, context);
  assert.deepEqual(received.values, [empresaId, lojaId, null]);
  assert.equal(result.items[0].storefront_name, 'Loja Teste');
  assert.equal(result.items[0].secret_configured, false);
  assert.equal('secret_ref' in result.items[0], false);
  assert.equal('webhookSecretRef' in result.items[0].public_config, false);
  assert.equal(result.items[0].public_config.webhookUrl, 'https://example.test/webhook');
});

test('update bloqueia somente a conta de pagamento e salva o handle InfinitePay', async () => {
  const queries = [];
  const trx = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.includes('SELECT a.id')) {
        return { rows: [{
          id: accountId,
          storefront_id: storefrontId,
          provider: 'infinitepay',
          ambiente: 'production',
          nome: 'InfinitePay Checkout · Produção',
          secret_ref: 'env:INFINITEPAY_HANDLE',
          public_config: { handle: 'AGRO-OPEN-TTC', methods: ['pix', 'credit_card'], redirectUrl: 'https://dino.kytto.com.br/checkout/dino', webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments' },
          ativo: false,
        }] };
      }
      if (sql.includes('SELECT dominio FROM commerce_store_domains')) return { rows: [{ dominio: 'dino.kytto.com.br' }] };
      if (sql.includes('UPDATE commerce_payment_accounts')) {
        return { rows: [{
          id: accountId,
          storefront_id: storefrontId,
          provider: 'infinitepay',
          ambiente: 'production',
          nome: 'InfinitePay Checkout · Produção',
          secret_ref: 'env:INFINITEPAY_HANDLE',
          public_config: { handle: 'rodrigo-ribeiro-d8a', methods: ['pix', 'credit_card'], redirectUrl: 'https://dino.kytto.com.br/checkout/dino', webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments' },
          ativo: false,
        }] };
      }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  const result = await updatePaymentAccount(trx, context, accountId, {
    publicConfig: { handle: 'rodrigo-ribeiro-d8a', methods: ['pix', 'credit_card'], redirectUrl: 'https://dino.kytto.com.br/checkout/dino', webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments' },
    ativo: false,
  });
  assert.match(queries[0].sql, /FOR UPDATE OF a/);
  assert.equal(result.public_config.handle, 'rodrigo-ribeiro-d8a');
  assert.deepEqual(result.public_config.methods, ['pix', 'credit_card']);
});

test('update rejeita conta de outra loja antes de executar alterações', async () => {
  const trx = {
    query: async (sql) => {
      if (sql.includes('SELECT a.id')) return { rows: [] };
      throw new Error('não deveria executar update fora do escopo');
    },
  };
  await assert.rejects(
    () => updatePaymentAccount(trx, context, accountId, { ativo: false }),
    errorWithCode('PAYMENT_ACCOUNT_NOT_FOUND'),
  );
});

test('InfinitePay inativa aceita somente configuração pública completa e não expõe a referência', async () => {
  const previous = process.env.INFINITEPAY_HANDLE;
  const previousAdapter = paymentProviders.get('infinitepay');
  process.env.INFINITEPAY_HANDLE = 'rodrigo-ribeiro-d8a';
  if (!previousAdapter) paymentProviders.register('infinitepay', { createCheckout() {}, verifyWebhook() {} });
  try {
    const trx = {
      query: async (sql, values) => {
        if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
        if (sql.includes('SELECT dominio FROM commerce_store_domains')) return { rows: [{ dominio: 'dino.kytto.com.br' }] };
        if (sql.includes('INSERT INTO commerce_payment_accounts')) {
          const config = JSON.parse(values[6]);
          return { rows: [{ id: accountId, storefront_id: storefrontId, provider: 'infinitepay', ambiente: 'production', nome: 'InfinitePay Dino', secret_ref: values[5], public_config: config, ativo: false }] };
        }
        throw new Error(`consulta inesperada: ${sql}`);
      },
    };
    const result = await createPaymentAccount(trx, context, {
      storefrontId,
      provider: 'infinitepay',
      ambiente: 'production',
      nome: 'InfinitePay Dino',
      secretRef: 'env:INFINITEPAY_HANDLE',
      ativo: false,
      publicConfig: {
        handle: '$rodrigo-ribeiro-d8a',
        redirectUrl: 'https://dino.kytto.com.br/checkout/dino',
        webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments',
        methods: ['pix', 'credit_card', 'pix'],
        token: 'campo arbitrário descartado',
      },
    });
    assert.equal(result.ready, true);
    assert.equal(result.public_config.handle, 'rodrigo-ribeiro-d8a');
    assert.deepEqual(result.public_config.methods, ['pix', 'credit_card']);
    assert.equal('secret_ref' in result, false);
    assert.equal('token' in result.public_config, false);
  } finally {
    if (previous === undefined) delete process.env.INFINITEPAY_HANDLE;
    else process.env.INFINITEPAY_HANDLE = previous;
    if (!previousAdapter) paymentProviders.adapters.delete('infinitepay');
  }
});

test('InfinitePay rejeita URL não HTTPS e ativação com handle divergente do ambiente', async () => {
  const trx = { query: async (sql) => {
    if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
    if (sql.includes('SELECT dominio FROM commerce_store_domains')) return { rows: [{ dominio: 'dino.kytto.com.br' }] };
    return { rows: [] };
  } };
  const base = {
    storefrontId,
    provider: 'infinitepay',
    ambiente: 'production',
    nome: 'InfinitePay Dino',
    secretRef: 'env:INFINITEPAY_HANDLE',
    publicConfig: {
      handle: 'rodrigo-ribeiro-d8a',
      redirectUrl: 'https://dino.kytto.com.br/checkout/dino',
      webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments',
      methods: ['pix', 'credit_card'],
    },
  };
  await assert.rejects(
    () => createPaymentAccount(trx, context, { ...base, publicConfig: { ...base.publicConfig, redirectUrl: 'http://dino.kytto.com.br/checkout/dino' } }),
    errorWithCode('PAYMENT_ACCOUNT_INVALID'),
  );
  await assert.rejects(
    () => createPaymentAccount(trx, context, { ...base, publicConfig: { ...base.publicConfig, redirectUrl: 'https://outro.exemplo.com/checkout/dino' } }),
    errorWithCode('PAYMENT_ACCOUNT_INVALID'),
  );
  const previous = process.env.INFINITEPAY_HANDLE;
  process.env.INFINITEPAY_HANDLE = 'outra-conta';
  try {
    await assert.rejects(
      () => createPaymentAccount(trx, context, { ...base, ativo: true }),
      errorWithCode('PAYMENT_ACCOUNT_NOT_CONFIGURED'),
    );
  } finally {
    if (previous === undefined) delete process.env.INFINITEPAY_HANDLE;
    else process.env.INFINITEPAY_HANDLE = previous;
  }
});
