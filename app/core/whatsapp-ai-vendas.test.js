import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { catalogSearchTerms } from './commerce-core.js';
import { createWhatsappAiToolExecutor, WhatsappAiToolError } from './whatsapp-ai-tools.js';
import { buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';

const context = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  phone: '5565999999999',
};
const storefrontId = '55555555-5555-4555-8555-555555555555';
const variantA = '66666666-6666-4666-8666-666666666666';
const variantFrozen = '77777777-7777-4777-8777-777777777777';

function product(id, variantId, { nome = 'Creatina 300g', categoria = 'Creatina', preco = 89.9, estoque = 5 } = {}) {
  return { id, nome, category_name: categoria, descricao_curta: '', media: [],
    variants: [{ id: variantId, sku: `SKU-${id.slice(0, 4)}`, nome, estoque, permiteCompraSemEstoque: false, prices: [{ preco, precoPromocional: null }] }] };
}

function catalogMock(t, { total = 768, products = [], seen = [] } = {}) {
  process.env.WHATSAPP_AI_PUBLIC_URL = 'https://kytto.example.com';
  t.after(() => { delete process.env.WHATSAPP_AI_PUBLIC_URL; });
  t.mock.method(db, 'queryRead', async (sql, params) => {
    seen.push({ sql, params });
    assert.equal(params[0], context.empresaId);
    if (sql.includes('FROM commerce_storefronts s') && sql.includes('JOIN lojas')) return { rows: [{ id: storefrontId, nome: 'Stallone', alias: 'stallone' }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total }] };
    if (sql.includes('jsonb_agg')) {
      const wanted = sql.includes('ANY(') ? params.find(Array.isArray) : null;
      return { rows: wanted ? products.filter(item => item.variants.some(variant => wanted.includes(variant.id))) : products };
    }
    throw new Error(`consulta inesperada: ${sql.slice(0, 80)}`);
  });
  t.mock.method(db, 'query', () => { throw new Error('consulta de venda não deve escrever'); });
  t.mock.method(db, 'transaction', () => { throw new Error('consulta de venda não deve abrir transação'); });
}

test('busca do catálogo separa palavras e ignora acentos', () => {
  assert.deepEqual(catalogSearchTerms('Whey  Proteína Chocolate'), ['whey', 'proteina', 'chocolate']);
  assert.deepEqual(catalogSearchTerms('a / Ômega-3'), ['omega']);
  assert.equal(catalogSearchTerms('um dois tres quatro cinco seis sete oito').length, 6);
});

test('buscar_produtos informa o total real do catálogo e o próximo offset', async t => {
  const seen = [];
  const products = Array.from({ length: 100 }, (_, index) => product(`9${String(index).padStart(7, '0')}-1111-4111-8111-111111111111`, `8${String(index).padStart(7, '0')}-1111-4111-8111-111111111111`));
  catalogMock(t, { total: 768, products, seen });
  const result = await createWhatsappAiToolExecutor(context)('buscar_produtos', { offset: 200, limit: 10 });
  assert.equal(result.total, 768);
  assert.equal(result.produtos.length, 10);
  assert.equal(result.haMais, true);
  assert.equal(result.proximoOffset, 210);
  const listagem = seen.find(item => item.sql.includes('jsonb_agg'));
  assert.deepEqual(listagem.params.slice(-2), [100, 200], 'lê o bloco a partir do offset pedido');
});

test('busca com várias palavras gera um filtro por palavra', async t => {
  const seen = [];
  catalogMock(t, { total: 1, products: [product('99999999-1111-4111-8111-111111111111', variantA, { nome: 'Whey Isolado - Chocolate' })], seen });
  const result = await createWhatsappAiToolExecutor(context)('buscar_produtos', { query: 'whey chocolate' });
  assert.equal(result.total, 1);
  const contagem = seen.find(item => item.sql.includes('COUNT(*)'));
  assert.ok(contagem.params.includes('%whey%') && contagem.params.includes('%chocolate%'));
  assert.equal((contagem.sql.match(/translate\(/g) || []).length, 2);
});

test('link_carrinho busca a variante pedida mesmo fora da primeira página e não escreve', async t => {
  const seen = [];
  catalogMock(t, { products: [product('99999999-1111-4111-8111-111111111111', variantA)], seen });
  const result = await createWhatsappAiToolExecutor(context)('link_carrinho', { items: [{ variantId: variantA, quantity: 2 }] });
  assert.equal(result.linkCarrinho, `https://kytto.example.com/ecommerce/stallone?carrinho=${encodeURIComponent(`${variantA}:2`)}`);
  assert.equal(result.totalProdutos, 'R$ 179,80');
  assert.equal(result.somenteRetirada, undefined);
  const listagem = seen.find(item => item.sql.includes('jsonb_agg'));
  assert.match(listagem.sql, /fv\.id = ANY\(\$\d+::uuid\[\]\)/);
  assert.match(result.orientacao, /Não peça CPF/);
});

test('link_carrinho avisa quando há congelado (só retirada)', async t => {
  catalogMock(t, { products: [product('99999999-1111-4111-8111-111111111111', variantFrozen, { nome: 'Açaí 1kg', categoria: 'Congelados' })] });
  const result = await createWhatsappAiToolExecutor(context)('link_carrinho', { items: [{ variantId: variantFrozen, quantity: 1 }] });
  assert.equal(result.somenteRetirada, true);
});

test('produto inexistente ou sem estoque não entra no link', async t => {
  catalogMock(t, { products: [product('99999999-1111-4111-8111-111111111111', variantA, { estoque: 1 })] });
  await assert.rejects(
    () => createWhatsappAiToolExecutor(context)('link_carrinho', { items: [{ variantId: variantA, quantity: 3 }] }),
    error => error instanceof WhatsappAiToolError && error.code === 'ITEM_UNAVAILABLE',
  );
  await assert.rejects(
    () => createWhatsappAiToolExecutor(context)('link_carrinho', { items: [{ variantId: variantFrozen, quantity: 1 }] }),
    error => error.code === 'ITEM_UNAVAILABLE',
  );
});

test('cotar_frete exige CEP com 8 dígitos e respeita a capacidade de loja', async t => {
  catalogMock(t, { products: [product('99999999-1111-4111-8111-111111111111', variantA)] });
  await assert.rejects(
    () => createWhatsappAiToolExecutor(context)('cotar_frete', { cep: '7830', items: [{ variantId: variantA, quantity: 1 }] }),
    error => error.code === 'SHIPPING_CEP_INVALID',
  );
  const semLoja = { ...context, capabilities: { operateStore: false } };
  for (const tool of ['cotar_frete', 'link_carrinho']) {
    await assert.rejects(() => createWhatsappAiToolExecutor(semLoja)(tool, { cep: '78300000', items: [{ variantId: variantA, quantity: 1 }] }));
  }
});

test('prompt orienta retirada, entrega com link de carrinho e não pede CPF', () => {
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Stallone Nutre Sport', segment: 'suplementos' });
  assert.match(prompt, /cotar_frete/);
  assert.match(prompt, /link_carrinho/);
  assert.match(prompt, /congelado ou refrigerado só sai por retirada/);
  assert.match(prompt, /Nunca peça CPF/);
});

function orderMock(t, { order = null, accounts = [], seen = [] } = {}) {
  t.mock.method(db, 'queryRead', async (sql, params) => {
    seen.push({ sql, params });
    assert.equal(params[0], context.empresaId);
    if (sql.includes('FROM commerce_storefronts s') && sql.includes('JOIN lojas')) return { rows: [{ id: storefrontId, nome: 'Stallone', alias: 'stallone' }] };
    if (sql.includes('FROM commerce_orders o')) return { rows: order ? [order] : [] };
    if (sql.includes('FROM commerce_payment_accounts')) return { rows: accounts };
    throw new Error(`consulta inesperada: ${sql.slice(0, 80)}`);
  });
  t.mock.method(db, 'query', () => { throw new Error('sem pedido válido não pode escrever'); });
  t.mock.method(db, 'transaction', () => { throw new Error('sem pedido válido não pode criar cobrança'); });
}

test('link_pagamento_pedido só vale para pedido do próprio telefone, na loja da conversa', async t => {
  const seen = [];
  orderMock(t, { seen });
  await assert.rejects(
    () => createWhatsappAiToolExecutor(context)('link_pagamento_pedido', { orderCode: 'kc-123', metodo: 'pix' }),
    error => error.code === 'ORDER_NOT_FOUND',
  );
  const consulta = seen.find(item => item.sql.includes('FROM commerce_orders o'));
  assert.deepEqual(consulta.params, [context.empresaId, context.lojaId, 'KC-123', context.phone, storefrontId]);
  assert.match(consulta.sql, /o\.storefront_id = \$5/);
});

test('link_pagamento_pedido não cobra pedido que já não aguarda pagamento', async t => {
  orderMock(t, { order: { id: '88888888-8888-4888-8888-888888888888', public_code: 'KC-1', status: 'paid', total: 50 } });
  const result = await createWhatsappAiToolExecutor(context)('link_pagamento_pedido', { orderCode: 'KC-1', metodo: 'cartão' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ORDER_NOT_AWAITING_PAYMENT');
});

test('link_pagamento_pedido sem meio online pronto não inventa cobrança', async t => {
  orderMock(t, { order: { id: '88888888-8888-4888-8888-888888888888', public_code: 'KC-1', status: 'pending_payment', total: 50 }, accounts: [] });
  const result = await createWhatsappAiToolExecutor(context)('link_pagamento_pedido', { orderCode: 'KC-1', metodo: 'pix' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PAYMENT_METHOD_UNAVAILABLE');
});

test('link_pagamento_pedido aceita só Pix ou cartão', async t => {
  orderMock(t);
  await assert.rejects(
    () => createWhatsappAiToolExecutor(context)('link_pagamento_pedido', { orderCode: 'KC-1', metodo: 'boleto' }),
    error => error.code === 'PAYMENT_METHOD_INVALID',
  );
});

test('prompt permite pagar pelo WhatsApp só com o link do próprio pedido', () => {
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Stallone Nutre Sport' });
  assert.match(prompt, /pergunte Pix ou cartão e use link_pagamento_pedido/);
  assert.match(prompt, /o pagamento acontece na página segura do gateway/);
});
