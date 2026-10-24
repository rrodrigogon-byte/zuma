// Ponte comanda ⇄ loja com PostgreSQL real e descartável.
// Rode com COMMERCE_COMANDA_TEST_DATABASE_URL=postgres://...?/<banco>_test (schema aplicado).
import test from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.COMMERCE_COMANDA_TEST_DATABASE_URL || '';
const ativo = /^postgres(ql)?:\/\/[^/]*(localhost|127\.0\.0\.1)[^/]*\/[a-z0-9_]+_test(\?|$)/i.test(url);

test('busca da loja respeita a unidade, usa preço promocional e baixa com idempotência', { skip: !ativo }, async () => {
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  const pg = (await import('pg')).default;
  const { buscarProdutosLoja, obterProdutoLoja, baixarEstoqueLoja } = await import('./commerce-comanda-bridge.js');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const q = (s, v) => c.query(s, v).then((r) => r.rows);
  const E = crypto.randomUUID(); const L = crypto.randomUUID(); const L2 = crypto.randomUUID();
  try {
    await q(`insert into empresas (id,nome,cnpj,razao_social) values ($1,'Teste',$2,'Teste LTDA')`, [E, String(Date.now()).slice(-14).padStart(14, '1')]);
    await q(`insert into lojas (id,empresa_id,codigo,nome) values ($1,$2,'A','A'),($3,$2,'B','B')`, [L, E, L2]);
    const [sf] = await q(`insert into commerce_storefronts (empresa_id,codigo,nome,loja_id,status) values ($1,'web','Web',$2,'active') returning id`, [E, L]);
    const [pl] = await q(`insert into commerce_price_lists (empresa_id,codigo,nome) values ($1,'web','Web') returning id`, [E]);
    const [p1] = await q(`insert into commerce_products (empresa_id,slug,nome,status) values ($1,'ghost','Perfume Ghost','active') returning id`, [E]);
    const [p2] = await q(`insert into commerce_products (empresa_id,slug,nome,status) values ($1,'rasc','Rascunho','draft') returning id`, [E]);
    const [v1] = await q(`insert into commerce_product_variants (empresa_id,product_id,sku,nome,barcode) values ($1,$2,'GHOST-100','100ml','7890000000017') returning id`, [E, p1.id]);
    await q(`insert into commerce_product_variants (empresa_id,product_id,sku,nome) values ($1,$2,'RASC-1','Un')`, [E, p2.id]);
    await q(`insert into commerce_product_channels (empresa_id,storefront_id,product_id,price_list_id,publicado) values ($1,$2,$3,$4,true)`, [E, sf.id, p1.id, pl.id]);
    await q(`insert into commerce_variant_prices (empresa_id,price_list_id,variant_id,preco,preco_promocional,vigencia_inicio) values ($1,$2,$3,430,399,now() - interval '1 day')`, [E, pl.id, v1.id]);
    const [loc] = await q(`insert into commerce_inventory_locations (empresa_id,codigo,nome,loja_id,tipo,ativo) values ($1,'a','A',$2,'store',true) returning id`, [E, L]);
    const [loc2] = await q(`insert into commerce_inventory_locations (empresa_id,codigo,nome,loja_id,tipo,ativo) values ($1,'b','B',$2,'store',true) returning id`, [E, L2]);
    await q(`insert into commerce_inventory_levels (empresa_id,location_id,variant_id,disponivel) values ($1,$2,$3,2),($1,$4,$3,9)`, [E, loc.id, v1.id, loc2.id]);
    const ctx = { empresaId: E, lojaId: L };
    const [item] = await buscarProdutosLoja(ctx, { q: 'ghost' });
    assert.equal(item.preco, 399);
    assert.equal(item.disponivelTotal, 2, 'estoque da outra unidade não entra');
    assert.equal(item.locationId, loc.id);
    assert.equal((await buscarProdutosLoja(ctx, { q: '7890000000017' })).length, 1);
    assert.equal((await buscarProdutosLoja(ctx, { q: 'Rascunho' })).length, 0, 'produto em rascunho não aparece');
    assert.equal((await buscarProdutosLoja(ctx, { q: '%' })).length, 0, 'curinga do LIKE é texto');
    assert.equal((await obterProdutoLoja(ctx, v1.id)).verificadoPeloServidor, true);
    const ctxW = { ...ctx, capabilities: new Set(['inventory.write']) };
    const alvo = { variantId: v1.id, locationId: loc.id, quantidade: 1, chave: `barbearia-comanda:${E}:i1` };
    assert.equal((await baixarEstoqueLoja(ctxW, alvo)).disponivel, 1);
    assert.equal((await baixarEstoqueLoja(ctxW, alvo)).disponivel, 1, 'mesma chave não baixa de novo');
    await assert.rejects(() => baixarEstoqueLoja(ctxW, { ...alvo, quantidade: 5, chave: `${alvo.chave}:2` }), { code: 'INSUFFICIENT_STOCK' });
  } finally {
    await c.end();
  }
});
