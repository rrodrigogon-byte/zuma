import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after, before } from 'node:test';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_ENV = 'COMMERCE_AVAILABILITY_TEST_DATABASE_URL';
const EXPECTED_DATABASE = 'commerce_availability_test';
const connectionString = process.env[DATABASE_ENV] || '';

function guardedDatabaseConfig(value) {
  if (!value) return null;
  const parsed = new URL(value);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const socket = parsed.searchParams.get('host') || '';
  const port = parsed.searchParams.get('port') || '5432';
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || database !== EXPECTED_DATABASE
      || parsed.hostname !== 'localhost'
      || parsed.port
      || !socket.startsWith('/')
      || !['5432', '55432'].includes(port)) {
    throw new Error(`${DATABASE_ENV} deve apontar via socket para ${EXPECTED_DATABASE}`);
  }
  return { connectionString: value, ssl: false, max: 8 };
}

const poolConfig = guardedDatabaseConfig(connectionString);
const pool = poolConfig ? new Pool(poolConfig) : null;
if (poolConfig) process.env.DATABASE_URL = connectionString;

const core = pool ? await import('./commerce-core.js') : null;
const appDatabase = core ? (await import('./database.js')).db : null;

const ids = Object.fromEntries([
  'tenant', 'storeA', 'storeB', 'storefrontA', 'storefrontB',
  'productA', 'productB', 'productSpread', 'variantA', 'variantB', 'variantSpread',
  'priceList', 'locationA', 'locationB', 'locationOther',
].map(key => [key, crypto.randomUUID()]));
const CNPJ = `9${ids.tenant.replace(/-/g, '').slice(0, 13)}`;

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (sql, values = []) => client.query(sql, values) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function query(sql, values = []) {
  return pool.query(sql, values);
}

async function seedFixture() {
  await query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio)
     VALUES ($1, 'Commerce availability test', $2, 'Commerce availability test', 'loja')`,
    [ids.tenant, CNPJ],
  );
  await query(
    `INSERT INTO lojas (id, empresa_id, codigo, nome)
     VALUES ($1, $3, 'availability-a', 'Loja Availability A'),
            ($2, $3, 'availability-b', 'Loja Availability B')`,
    [ids.storeA, ids.storeB, ids.tenant],
  );
  await query(
    `INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, status, configuracoes)
     VALUES ($1, $3, $4, 'availability-a', 'Vitrine Availability A', 'active', '{}'::jsonb),
            ($2, $3, $5, 'availability-b', 'Vitrine Availability B', 'active', '{}'::jsonb)`,
    [ids.storefrontA, ids.storefrontB, ids.tenant, ids.storeA, ids.storeB],
  );
  await query(
    `INSERT INTO commerce_products (id, empresa_id, slug, nome, tipo, status)
     VALUES ($1, $4, 'availability-a', 'Produto A', 'physical', 'active'),
            ($2, $4, 'availability-b', 'Produto B', 'physical', 'active'),
            ($3, $4, 'availability-spread', 'Produto espalhado', 'physical', 'active')`,
    [ids.productA, ids.productB, ids.productSpread, ids.tenant],
  );
  await query(
    `INSERT INTO commerce_product_variants (id, empresa_id, product_id, sku, nome)
     VALUES ($1, $4, $5, 'AVAIL-A', 'Produto A'),
            ($2, $4, $6, 'AVAIL-B', 'Produto B'),
            ($3, $4, $7, 'AVAIL-SPREAD', 'Produto espalhado')`,
    [ids.variantA, ids.variantB, ids.variantSpread, ids.tenant, ids.productA, ids.productB, ids.productSpread],
  );
  await query(
    `INSERT INTO commerce_price_lists (id, empresa_id, codigo, nome, canal, moeda, ativo)
     VALUES ($1, $2, 'availability-web', 'Availability web', 'web', 'BRL', true)`,
    [ids.priceList, ids.tenant],
  );
  await query(
    `INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
     VALUES ($1, $2, $3, $5, true), ($1, $2, $4, $5, true), ($1, $2, $6, $5, true),
            ($1, $7, $3, $5, true)`,
    [ids.tenant, ids.storefrontA, ids.productA, ids.productB, ids.priceList, ids.productSpread, ids.storefrontB],
  );
  await query(
    `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco)
     VALUES ($1, $2, $3, 10.00), ($1, $2, $4, 20.00), ($1, $2, $5, 30.00)`,
    [ids.tenant, ids.priceList, ids.variantA, ids.variantB, ids.variantSpread],
  );
  await query(
    `INSERT INTO commerce_inventory_locations (id, empresa_id, loja_id, codigo, nome, tipo, ativo)
     VALUES ($1, $4, $5, 'availability-a', 'Estoque A', 'store', true),
            ($2, $4, $5, 'availability-b', 'Estoque B', 'store', true),
            ($3, $4, $6, 'availability-other', 'Estoque outra loja', 'store', true)`,
    [ids.locationA, ids.locationB, ids.locationOther, ids.tenant, ids.storeA, ids.storeB],
  );
  // A e B são disjuntos entre os dois locais; Spread tem 2 + 2 dispersos.
  await query(
    `INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel, reservado, comprometido)
     VALUES ($1, $2, $4, 2, 0, 0), ($1, $2, $5, 0, 0, 0), ($1, $2, $6, 2, 0, 0),
            ($1, $3, $4, 0, 0, 0), ($1, $3, $5, 2, 0, 0), ($1, $3, $6, 2, 0, 0),
            ($1, $7, $4, 50, 0, 0)`,
    [ids.tenant, ids.locationA, ids.locationB, ids.variantA, ids.variantB, ids.variantSpread, ids.locationOther],
  );
}

async function storefrontProducts(storefrontId = ids.storefrontA) {
  const lojaId = storefrontId === ids.storefrontB ? ids.storeB : ids.storeA;
  return core.listPublishedProducts({ empresaId: ids.tenant, lojaId }, { storefrontId });
}

function orderInput(idempotencyKey, items, extra = {}) {
  return {
    storefrontId: ids.storefrontA,
    idempotencyKey,
    items,
    customer: { nome: `Cliente ${idempotencyKey}`, email: `${idempotencyKey}@example.invalid` },
    ...extra,
  };
}

function createOrder(input) {
  return transaction(trx => core.createPendingOrder(trx, { empresaId: ids.tenant, lojaId: ids.storeA }, input));
}

const pgTest = (name, fn) => test(name, { skip: !pool }, fn);

if (pool) {
  before(async () => {
    const identity = await query('SELECT current_database() AS database, inet_server_addr() IS NULL AS using_unix_socket');
    assert.equal(identity.rows[0].database, EXPECTED_DATABASE);
    assert.equal(identity.rows[0].using_unix_socket, true);
    await seedFixture();
  });
  after(async () => {
    await appDatabase.close();
    await pool.end();
  });
}

pgTest('vitrine usa o máximo reservável por variante e não soma 2+2 dispersos', async () => {
  const products = await storefrontProducts();
  const spread = products.flatMap(product => product.variants || []).find(variant => variant.id === ids.variantSpread);
  assert.ok(spread);
  assert.equal(Number(spread.estoque), 2);
  assert.notEqual(Number(spread.estoque), 4);

  const otherStoreProducts = await storefrontProducts(ids.storefrontB);
  const otherStoreA = otherStoreProducts.flatMap(product => product.variants || []).find(variant => variant.id === ids.variantA);
  assert.ok(otherStoreA);
  assert.equal(Number(otherStoreA.estoque), 50);
});

pgTest('carrinho multi-SKU com estoques disjuntos não cria pedido nem reserva split', async () => {
  await assert.rejects(
    () => createOrder(orderInput('disjoint-cart-001', [
      { variantId: ids.variantA, quantity: 1 },
      { variantId: ids.variantB, quantity: 1 },
    ])),
    error => error?.code === 'INSUFFICIENT_STOCK',
  );
  const state = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_orders WHERE empresa_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM commerce_inventory_reservations WHERE empresa_id = $1) AS reservations,
       (SELECT SUM(disponivel)::int FROM commerce_inventory_levels WHERE empresa_id = $1 AND location_id = ANY($2::uuid[])) AS available`,
    [ids.tenant, [ids.locationA, ids.locationB]],
  );
  assert.deepEqual(state.rows[0], { orders: 0, reservations: 0, available: 8 });
});

pgTest('checkout da mesma SKU espalhada falha acima do máximo de um local e reserva tudo no local escolhido', async () => {
  await assert.rejects(
    () => createOrder(orderInput('spread-too-many-001', [{ variantId: ids.variantSpread, quantity: 3 }])),
    error => error?.code === 'INSUFFICIENT_STOCK',
  );
  const created = await createOrder(orderInput('spread-single-location-001', [{ variantId: ids.variantSpread, quantity: 2 }]));
  const reservations = await query(
    `SELECT location_id, variant_id, quantidade, status
       FROM commerce_inventory_reservations WHERE empresa_id = $1 AND order_id = $2`,
    [ids.tenant, created.id],
  );
  assert.deepEqual(reservations.rows.map(row => ({ ...row, quantidade: Number(row.quantidade) })), [{
    location_id: reservations.rows[0].location_id,
    variant_id: ids.variantSpread,
    quantidade: 2,
    status: 'pending',
  }]);
});

pgTest('corrida com a mesma idempotência serializa no banco e devolve replay exato', async () => {
  const input = orderInput('availability-race-idem-001', [{ variantId: ids.variantSpread, quantity: 1 }]);
  const [first, second] = await Promise.all([createOrder(input), createOrder(input)]);
  assert.deepEqual(second, first);
  const persisted = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_orders WHERE empresa_id = $1 AND public_code = $2) AS orders,
       (SELECT COUNT(*)::int FROM commerce_inventory_reservations WHERE empresa_id = $1 AND order_id = $3) AS reservations,
       (SELECT COUNT(*)::int FROM commerce_idempotency_keys WHERE empresa_id = $1 AND scope = 'order.create' AND key = $4) AS idempotency_rows`,
    [ids.tenant, first.publicCode, first.id, input.idempotencyKey],
  );
  assert.deepEqual(persisted.rows[0], { orders: 1, reservations: 1, idempotency_rows: 1 });
});

pgTest('checkout rejeita local de outra loja e mantém isolamento por loja', async () => {
  await assert.rejects(
    () => createOrder(orderInput('other-store-location-001', [{ variantId: ids.variantA, quantity: 1 }], { locationId: ids.locationOther })),
    error => error?.code === 'INVENTORY_LOCATION_SCOPE_MISMATCH',
  );
  const levels = await query(
    `SELECT l.loja_id, il.disponivel::int
       FROM commerce_inventory_levels il
       JOIN commerce_inventory_locations l ON l.empresa_id = il.empresa_id AND l.id = il.location_id
      WHERE il.empresa_id = $1 AND il.variant_id = $2
      ORDER BY l.loja_id, il.disponivel`,
    [ids.tenant, ids.variantA],
  );
  assert.deepEqual(levels.rows, [
    { loja_id: ids.storeA, disponivel: 0 },
    { loja_id: ids.storeA, disponivel: 2 },
    { loja_id: ids.storeB, disponivel: 50 },
  ].sort((left, right) => left.loja_id.localeCompare(right.loja_id)));
});
