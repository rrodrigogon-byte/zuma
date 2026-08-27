import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPaymentAccount,
  listPaymentAccounts,
  listPaymentProviders,
  updatePaymentAccount,
} from './commerce-payment-admin.js';
import { CommerceError } from './commerce-core.js';

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
  assert.deepEqual(received.values, [empresaId, lojaId]);
  assert.equal(result.items[0].storefront_name, 'Loja Teste');
  assert.equal(result.items[0].secret_configured, false);
  assert.equal('secret_ref' in result.items[0], false);
  assert.equal('webhookSecretRef' in result.items[0].public_config, false);
  assert.equal(result.items[0].public_config.webhookUrl, 'https://example.test/webhook');
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
