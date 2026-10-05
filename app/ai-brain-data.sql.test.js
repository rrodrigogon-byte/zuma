import test from 'node:test';
import assert from 'node:assert/strict';
const { db } = await import('./core/database.js');
const { loadOrders, loadCatalog, loadActiveFacts } = await import('./ai-brain-data.js');

// PostgreSQL embarcado opcional; nenhuma conexão com produção.
test('SQL do grafo isola lojas, pedidos, preços e fatos em PostgreSQL/PGlite', { skip: !process.env.AI_GRAPH_PGLITE_MODULE }, async () => {
const { PGlite } = await import(process.env.AI_GRAPH_PGLITE_MODULE);
const pg = new PGlite();
await pg.exec(`
CREATE TABLE commerce_categories (id uuid primary key, empresa_id uuid, nome text);
CREATE TABLE commerce_products (id uuid primary key, empresa_id uuid, category_id uuid, nome text, status text, tipo text);
CREATE TABLE commerce_product_variants (id uuid primary key, empresa_id uuid, product_id uuid, ativo boolean);
CREATE TABLE commerce_price_lists (id uuid primary key, empresa_id uuid, ativo boolean);
CREATE TABLE commerce_variant_prices (id uuid primary key, empresa_id uuid, variant_id uuid, price_list_id uuid, preco numeric, preco_promocional numeric, custo numeric, vigencia_inicio timestamptz, vigencia_fim timestamptz);
CREATE TABLE commerce_storefronts (id uuid primary key, empresa_id uuid, loja_id uuid, status text);
CREATE TABLE commerce_product_channels (empresa_id uuid, product_id uuid, storefront_id uuid, price_list_id uuid, publicado boolean);
CREATE TABLE commerce_inventory_locations (id uuid primary key, empresa_id uuid, loja_id uuid, ativo boolean);
CREATE TABLE commerce_inventory_levels (empresa_id uuid, variant_id uuid, location_id uuid, disponivel int, reservado int);
CREATE TABLE commerce_customers (id uuid primary key, empresa_id uuid, telefone text, nome text, metadados jsonb);
CREATE TABLE commerce_orders (id uuid primary key, empresa_id uuid, loja_id uuid, customer_id uuid, status text, criado_em timestamptz);
CREATE TABLE commerce_order_items (id uuid primary key, empresa_id uuid, order_id uuid, variant_id uuid, nome_snapshot text, subtotal numeric);
CREATE TABLE ai_conversation_summaries (id uuid primary key, empresa_id uuid, loja_id uuid);
CREATE TABLE ai_customer_facts (id uuid primary key, empresa_id uuid, telefone text, categoria text, valor text, status text, criado_em timestamptz, valido_ate date, fonte_resumo_id uuid);
`);
const id = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const e=id(1), l=id(2), other=id(3), p=id(4), v=id(5), pl=id(6), sf=id(7), loc=id(8), c=id(9);
await pg.query(`INSERT INTO commerce_products VALUES ($1,$2,null,'P','active','physical');`, [p,e]);
await pg.query(`INSERT INTO commerce_product_variants VALUES ($1,$2,$3,true),($4,$2,$3,true)`,[v,e,p,id(15)]);
await pg.query(`INSERT INTO commerce_price_lists VALUES ($1,$2,true)`,[pl,e]);
await pg.query(`INSERT INTO commerce_variant_prices VALUES ($1,$2,$3,$4,100,80,40,now()-interval '1 day',null)`,[id(10),e,v,pl]);
await pg.query(`INSERT INTO commerce_storefronts VALUES ($1,$2,$3,'active')`,[sf,e,l]);
await pg.query(`INSERT INTO commerce_product_channels VALUES ($1,$2,$3,$4,true)`,[e,p,sf,pl]);
await pg.query(`INSERT INTO commerce_inventory_locations VALUES ($1,$2,$3,true),($4,$2,$5,true)`,[loc,e,l,id(11),other]);
await pg.query(`INSERT INTO commerce_inventory_levels VALUES ($1,$2,$3,5,1),($1,$2,$4,100,0)`,[e,v,loc,id(11)]);
await pg.query(`INSERT INTO commerce_customers VALUES ($1,$2,'65999990001','Cliente','{}')`,[c,e]);
for(const [i,status,store] of [[20,'paid',l],[21,'pending_payment',l],[22,'paid',other]]) {
 await pg.query(`INSERT INTO commerce_orders VALUES ($1,$2,$3,$4,$5,now())`,[id(i),e,store,c,status]);
 await pg.query(`INSERT INTO commerce_order_items VALUES ($1,$2,$3,$4,'P',100)`,[id(i+10),e,id(i),v]);
}
for (const [i,store] of [[40,l],[41,other]]) {
 await pg.query(`INSERT INTO ai_conversation_summaries VALUES ($1,$2,$3)`,[id(i),e,store]);
 await pg.query(`INSERT INTO ai_customer_facts VALUES ($1,$2,'65999990001','produto_interesse','P','ativo',now(),null,$3)`,[id(i+10),e,id(i)]);
}
const previous = db.queryRead;
db.queryRead = (sql, params) => pg.query(sql, params);
try {
const catalog = await loadCatalog(e,l);
assert.equal(catalog.length,1); assert.equal(catalog[0].preco,80); assert.equal(catalog[0].custo,40); assert.equal(catalog[0].estoque,4);
const orders = await loadOrders(e,l); assert.equal(orders.length,1); assert.equal(orders[0].status,'paid'); assert.equal(orders[0].itens[0].produtoId,p);
assert.equal((await loadActiveFacts(e,l)).length,1);
assert.equal((await loadOrders(id(99),l)).length,0);
assert.equal((await loadCatalog(e,other))[0].preco,null);
} finally { db.queryRead = previous; await pg.close(); }
});
