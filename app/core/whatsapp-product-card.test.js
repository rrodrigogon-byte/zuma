import test from 'node:test';
import assert from 'node:assert/strict';
import { productDetails, productCard } from './whatsapp-product-card.js';
import { createWhatsappAiToolExecutor } from './whatsapp-ai-tools.js';
import { db } from './database.js';
const context = { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: '22222222-2222-4222-8222-222222222222', canalId: '33333333-3333-4333-8333-333333333333', sessionId: '44444444-4444-4444-8444-444444444444', phone: '5565999999999' };
const product = { id: 'p1', nome: 'Perfume 100ml', descricao: 'Fragrância amadeirada.', media: [], variants: [{ id: 'v1', estoque: 2, prices: [{ preco: 360 }], atributos: { marca: 'Marca real', volume_ml: 100, concentracao: 'EDT', chave_interna: 'não expor' } }] };
function catalog(t, products = [product]) {
  t.mock.method(db, 'queryRead', async (sql, values) => {
    assert.equal(values[0], context.empresaId);
    if (!sql.includes('FROM commerce_products p') && sql.includes('FROM commerce_storefronts s')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', alias: 'dino' }] };
    assert.match(sql, /FROM commerce_products p/);
    return { rows: products };
  });
  t.mock.method(db, 'query', () => { throw new Error('ficha não pode escrever'); });
}
test('volume e atributos usam cadastro da variante, sem campos livres internos', () => {
  assert.deepEqual(productDetails(product, product.variants[0]), { marca: 'Marca real', concentracao: 'EDT', volume: '100 ml' });
  assert.equal(productDetails({ nome: 'Perfume 200ml' }, { nome: 'Variante 50ml' }).volume, '50 ml');
  assert.equal(productDetails({ nome: 'Kit 4x25ml' }).volume, '4x25 ml');
});
test('não inventa unidade para volume numérico ambíguo nem escolhe entre dois volumes', () => {
  assert.equal(productDetails({}, { atributos: { volume: 100 } }).volume, undefined);
  assert.equal(productDetails({ descricao: 'Disponível em 50ml e 100ml' }).volume, undefined);
});
test('ficha informa ausências e encomenda, sem prometer prazo nem foto substituta', () => {
  const card = productCard({ nome: 'Perfume' }, { preco: 120, estoque: 0, sobEncomenda: true });
  assert.match(card, /Volume: não informado/);
  assert.match(card, /não tem foto cadastrada/);
  assert.match(card, /Descrição ainda não cadastrada/);
  assert.match(card, /Sob encomenda/);
  assert.match(card, /120,00/);
});
test('ficha inclui foto real em linha própria, descrição e preço', () => {
  const photo = 'https://catalogo.example/foto.jpg';
  const card = productCard({ ...product, fotos: [photo] }, { preco: 360, estoque: 2, detalhes: productDetails(product, product.variants[0]) });
  assert.ok(card.endsWith(photo));
  assert.match(card, /Fragrância amadeirada/);
  assert.match(card, /100 ml/);
  assert.match(card, /360,00/);
});
test('produto único consultado já inclui ficha; repetir apresentação não duplica', async t => {
  catalog(t);
  const ctx = { ...context };
  const execute = createWhatsappAiToolExecutor(ctx);
  const result = await execute('buscar_produtos', { query: 'Perfume' });
  assert.equal(result.fichaAutomaticaIncluida, true);
  assert.equal(ctx.productCards.size, 1);
  await execute('apresentar_produto', { productId: 'p1' });
  assert.equal(ctx.productCards.size, 1);
  assert.match([...ctx.productCards.values()][0], /100 ml/);
});
test('rejeita produto não consultado e exige escolher variante quando há mais de uma', async t => {
  catalog(t, [{ ...product, variants: [...product.variants, { ...product.variants[0], id: 'v2' }] }]);
  const execute = createWhatsappAiToolExecutor({ ...context });
  await assert.rejects(execute('apresentar_produto', { productId: 'p1' }), { code: 'PRODUCT_NOT_CONSULTED' });
  await execute('buscar_produtos', { query: 'Perfume' });
  await assert.rejects(execute('apresentar_produto', { productId: 'p1' }), { code: 'VARIANT_REQUIRED' });
  const result = await execute('apresentar_produto', { productId: 'p1', variantId: 'v2' });
  assert.equal(result.fichaIncluidaPeloSistema, true);
});
test('capacidade desativada impede apresentação', async () => {
  await assert.rejects(createWhatsappAiToolExecutor({ ...context, capabilities: { operateStore: false } })('apresentar_produto', { productId: 'p1' }), { code: 'CAPABILITY_DISABLED' });
});

test('novo executor/reserva não reutiliza fichas de tentativa anterior', async t => {
  catalog(t);
  const ctx = { ...context };
  await createWhatsappAiToolExecutor(ctx)('buscar_produtos', { query: 'Perfume' });
  const reserve = { ...ctx };
  const execute = createWhatsappAiToolExecutor(reserve);
  assert.equal(reserve.productCards.size, 0);
  await assert.rejects(execute('apresentar_produto', { productId: 'p1' }), { code: 'PRODUCT_NOT_CONSULTED' });
  assert.equal(ctx.productCards.size, 1);
});

test('limita fichas por resposta sem descartar as já preparadas', async t => {
  catalog(t, Array.from({ length: 4 }, (_, index) => ({ ...product, id: `p${index}` })));
  const ctx = { ...context };
  const execute = createWhatsappAiToolExecutor(ctx);
  await execute('buscar_produtos', {});
  for (let index = 0; index < 3; index++) await execute('apresentar_produto', { productId: `p${index}` });
  await assert.rejects(execute('apresentar_produto', { productId: 'p3' }), { code: 'PRODUCT_CARD_LIMIT' });
  assert.equal(ctx.productCards.size, 3);
});
