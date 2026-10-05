import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { paymentProviders, publicPaymentMethods } from './payment-adapters.js';
import { createWhatsappAiToolExecutor } from './whatsapp-ai-tools.js';
import { buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';

const context = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444', phone: '5565999999999',
};
const storefrontId = '55555555-5555-4555-8555-555555555555';
const account = { id: 'fake-account', provider: 'test-commerce', ambiente: 'production', ativo: true,
  secret_ref: 'env:DINO_COMMERCE_UNIT_TEST_ONLY', public_config: { methods: ['pix', 'credit_card', 'invalid', 'pix'], privateField: 'must-not-leak' } };
function ready(t) {
  process.env.DINO_COMMERCE_UNIT_TEST_ONLY = 'synthetic-test-value';
  t.after(() => { delete process.env.DINO_COMMERCE_UNIT_TEST_ONLY; });
  t.mock.method(paymentProviders, 'get', provider => provider === 'test-commerce' ? {} : undefined);
}

test('projeção pública usa apenas conta pronta de produção e elimina métodos inválidos/duplicados', t => {
  ready(t);
  const items = publicPaymentMethods([account, account, { ...account, ambiente: 'sandbox' },
    { ...account, ativo: false }, { ...account, provider: 'unknown' }, { ...account, secret_ref: '' }]);
  assert.deepEqual(items.map(item => item.method), ['pix', 'credit_card']);
  assert.deepEqual(Object.keys(items[0]).sort(), ['ambiente', 'method', 'provider']);
  assert.equal(JSON.stringify(items).includes('must-not-leak'), false);
});

test('consulta de pagamento preserva escopo, só lê dados e fornece domínio verificado sem credenciais', async t => {
  ready(t);
  t.mock.method(db, 'queryRead', async (sql, params) => {
    assert.equal(params[0], context.empresaId);
    if (sql.includes('FROM commerce_storefronts')) {
      assert.equal(params[1], context.lojaId);
      assert.match(sql, /s.status = 'active'/);
      return { rows: [{ id: storefrontId, nome: 'Dino' }] };
    }
    assert.equal(params[1], storefrontId);
    if (sql.includes('FROM commerce_payment_accounts')) return { rows: [account] };
    assert.match(sql, /verificado_em IS NOT NULL/);
    return { rows: [{ dominio: 'dino.example.com' }] };
  });
  t.mock.method(db, 'query', () => { throw new Error('consulta não deve escrever'); });
  t.mock.method(db, 'transaction', () => { throw new Error('consulta não deve criar cobrança'); });
  const result = await createWhatsappAiToolExecutor(context)('consultar_pagamentos', {});
  assert.equal(result.urlLoja, 'https://dino.example.com/');
  assert.deepEqual(result.meios.map(item => item.nome), ['Pix', 'Cartão de crédito']);
  assert.equal(result.pagamentosDisponiveis, true);
  for (const forbidden of ['secret_ref', 'public_config', 'must-not-leak', 'synthetic-test-value']) {
    assert.equal(JSON.stringify(result).includes(forbidden), false);
  }
});

test('sem conta pronta ou domínio válido não inventa pagamento nem link', async t => {
  t.mock.method(db, 'queryRead', async sql => {
    if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
    if (sql.includes('FROM commerce_payment_accounts')) return { rows: [] };
    return { rows: [{ dominio: 'evil.example/path?token=fake' }] };
  });
  const result = await createWhatsappAiToolExecutor(context)('consultar_pagamentos', {});
  assert.equal(result.urlLoja, null);
  assert.equal(result.pagamentosDisponiveis, false);
  assert.deepEqual(result.meios, []);
});

test('capacidade de loja desativada bloqueia consulta antes do banco', async t => {
  t.mock.method(db, 'queryRead', () => { throw new Error('não deve ler'); });
  await assert.rejects(createWhatsappAiToolExecutor({ ...context, capabilities: { operateStore: false } })('consultar_pagamentos', {}), { code: 'CAPABILITY_DISABLED' });
});

test('crediário não vira oferta geral sem elegibilidade do pedido', async t => {
  ready(t);
  t.mock.method(db, 'queryRead', async sql => sql.includes('FROM commerce_storefronts')
    ? { rows: [{ id: storefrontId }] } : sql.includes('FROM commerce_payment_accounts')
      ? { rows: [{ ...account, public_config: { methods: ['account'] } }] } : { rows: [] });
  const result = await createWhatsappAiToolExecutor(context)('consultar_pagamentos', {});
  assert.deepEqual(result.meios, []);
  assert.equal(result.pagamentosDisponiveis, false);
});

test('prompt atende loja sem confundir pagamento online, serviços e exceções financeiras', () => {
  const prompt = buildWhatsappAiSystemPrompt();
  assert.match(prompt, /consulte consultar_pagamentos/);
  assert.match(prompt, /não autoriza preparar um pedido/);
  assert.match(prompt, /não comprovam os meios aceitos na barbearia presencial/);
  assert.match(prompt, /Nunca peça CPF, dados de cartão/);
  assert.match(prompt, /estorno, cobrança divergente/);
  assert.doesNotMatch(prompt, /Pagamento externo não está habilitado/);
});
