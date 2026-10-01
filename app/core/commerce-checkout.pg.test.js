import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after, before } from 'node:test';
import pg from 'pg';
import { createPendingOrder } from './commerce-core.js';
import { expireCommerceReservations } from './commerce-retention.js';

const { Pool } = pg;
const DATABASE_ENV = 'COMMERCE_CHECKOUT_HARDENING_TEST_DATABASE_URL';
const EXPECTED_DATABASE = 'commerce_checkout_hardening_test';
const connectionString = process.env[DATABASE_ENV] || '';

function guardedDatabaseConfig(value) {
  if (!value) return null;
  const parsed = new URL(value);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const socket = parsed.searchParams.get('host') || '';
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || database !== EXPECTED_DATABASE
      || parsed.hostname !== 'localhost'
      || parsed.port
      || !socket.startsWith('/')) {
    throw new Error(`${DATABASE_ENV} deve apontar via socket para ${EXPECTED_DATABASE}`);
  }
  return { connectionString: value, ssl: false, max: 4 };
}

const poolConfig = guardedDatabaseConfig(connectionString);
const pool = poolConfig ? new Pool(poolConfig) : null;

const TENANT_ID = crypto.randomUUID();
const STORE_ID = crypto.randomUUID();
const STOREFRONT_ID = crypto.randomUUID();
const PRODUCT_A_ID = crypto.randomUUID();
const PRODUCT_B_ID = crypto.randomUUID();
const VARIANT_A_ID = crypto.randomUUID();
const VARIANT_B_ID = crypto.randomUUID();
const PRICE_LIST_ID = crypto.randomUUID();
const LOCATION_ID = crypto.randomUUID();
const IDEMPOTENCY_KEY = 'checkout-pg-concurrent-001';

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

async function seedFixture() {
  const uniqueSuffix = TENANT_ID.replace(/\D/g, '').slice(0, 13).padEnd(13, '0');
  await pool.query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio)
     VALUES ($1, 'Checkout hardening test', $2, 'Checkout hardening test', 'loja')`,
    [TENANT_ID, `9${uniqueSuffix}`],
  );
  await pool.query(
    `INSERT INTO lojas (id, empresa_id, codigo, nome)
     VALUES ($1, $2, 'checkout_hardening', 'Checkout hardening')`,
    [STORE_ID, TENANT_ID],
  );
  await pool.query(
    `INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, status)
     VALUES ($1, $2, $3, 'checkout-hardening', 'Checkout hardening', 'active')`,
    [STOREFRONT_ID, TENANT_ID, STORE_ID],
  );
  await pool.query(
    `INSERT INTO commerce_products (id, empresa_id, slug, nome, tipo, status)
     VALUES ($1, $3, 'produto-a', 'Produto A', 'physical', 'active'),
            ($2, $3, 'produto-b', 'Produto B', 'physical', 'active')`,
    [PRODUCT_A_ID, PRODUCT_B_ID, TENANT_ID],
  );
  await pool.query(
    `INSERT INTO commerce_product_variants (id, empresa_id, product_id, sku, nome)
     VALUES ($1, $3, $4, 'CHECKOUT-A', 'Produto A'),
            ($2, $3, $5, 'CHECKOUT-B', 'Produto B')`,
    [VARIANT_A_ID, VARIANT_B_ID, TENANT_ID, PRODUCT_A_ID, PRODUCT_B_ID],
  );
  await pool.query(
    `INSERT INTO commerce_price_lists (id, empresa_id, codigo, nome, canal, moeda, ativo)
     VALUES ($1, $2, 'checkout-hardening', 'Checkout hardening', 'web', 'BRL', true)`,
    [PRICE_LIST_ID, TENANT_ID],
  );
  await pool.query(
    `INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
     VALUES ($1, $2, $3, $5, true), ($1, $2, $4, $5, true)`,
    [TENANT_ID, STOREFRONT_ID, PRODUCT_A_ID, PRODUCT_B_ID, PRICE_LIST_ID],
  );
  await pool.query(
    `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco)
     VALUES ($1, $2, $3, 12.50), ($1, $2, $4, 7.25)`,
    [TENANT_ID, PRICE_LIST_ID, VARIANT_A_ID, VARIANT_B_ID],
  );
  await pool.query(
    `INSERT INTO commerce_inventory_locations (id, empresa_id, loja_id, codigo, nome, tipo, ativo)
     VALUES ($1, $2, $3, 'checkout-hardening', 'Checkout hardening', 'store', true)`,
    [LOCATION_ID, TENANT_ID, STORE_ID],
  );
  await pool.query(
    `INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel, reservado, comprometido)
     VALUES ($1, $2, $3, 20, 0, 0), ($1, $2, $4, 20, 0, 0)`,
    [TENANT_ID, LOCATION_ID, VARIANT_A_ID, VARIANT_B_ID],
  );
}

async function dmlSnapshot() {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_orders WHERE empresa_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM commerce_order_items WHERE empresa_id = $1) AS order_items,
       (SELECT COUNT(*)::int FROM commerce_inventory_reservations WHERE empresa_id = $1) AS reservations,
       (SELECT COUNT(*)::int FROM commerce_inventory_movements WHERE empresa_id = $1) AS movements,
       (SELECT COUNT(*)::int FROM commerce_order_events WHERE empresa_id = $1) AS order_events,
       (SELECT COUNT(*)::int FROM commerce_customers WHERE empresa_id = $1) AS customers,
       (SELECT COUNT(*)::int FROM commerce_audit_logs WHERE empresa_id = $1) AS audit_logs,
       (SELECT COUNT(*)::int FROM commerce_idempotency_keys WHERE empresa_id = $1) AS idempotency_rows,
       (SELECT COALESCE(SUM(disponivel), 0)::int FROM commerce_inventory_levels WHERE empresa_id = $1) AS available,
       (SELECT COALESCE(SUM(reservado), 0)::int FROM commerce_inventory_levels WHERE empresa_id = $1) AS reserved,
       md5(jsonb_build_object(
         'orders', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_orders WHERE empresa_id = $1) x),
         'items', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_order_items WHERE empresa_id = $1) x),
         'reservations', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_inventory_reservations WHERE empresa_id = $1) x),
         'levels', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.location_id, x.variant_id), '[]'::jsonb) FROM (SELECT * FROM commerce_inventory_levels WHERE empresa_id = $1) x),
         'movements', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_inventory_movements WHERE empresa_id = $1) x),
         'events', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_order_events WHERE empresa_id = $1) x),
         'customers', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_customers WHERE empresa_id = $1) x),
         'audit', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_audit_logs WHERE empresa_id = $1) x),
         'idempotency', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM (SELECT * FROM commerce_idempotency_keys WHERE empresa_id = $1) x)
       )::text) AS state_hash`,
    [TENANT_ID],
  );
  return result.rows[0];
}

if (pool) {
  before(async () => {
    const identity = await pool.query(
      `SELECT current_database() AS database,
              inet_server_addr() IS NULL AS using_unix_socket`,
    );
    assert.equal(identity.rows[0].database, EXPECTED_DATABASE);
    assert.equal(identity.rows[0].using_unix_socket, true);
    await seedFixture();
  });
  after(async () => {
    await pool.end();
  });
}

const pgTest = (name, fn) => test(name, { skip: !pool }, fn);

pgTest('checkout PostgreSQL serializa chamadas simultâneas, faz replay exato e conflito não executa DML extra', async () => {
  let releaseFirstLocked;
  const firstLocked = new Promise(resolve => { releaseFirstLocked = resolve; });
  let releaseSecondAttempt;
  const secondAttemptedLock = new Promise(resolve => { releaseSecondAttempt = resolve; });
  let finalizedResponses = 0;
  const input = {
    storefrontId: STOREFRONT_ID,
    locationId: LOCATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    customer: { nome: 'Cliente concorrente', email: 'checkout.concurrent@example.invalid' },
    items: [
      { variantId: VARIANT_B_ID, quantity: 1 },
      { variantId: VARIANT_A_ID, quantity: 2 },
    ],
    correlationId: 'checkout-pg-concurrent',
    finalizeResponse: async order => {
      finalizedResponses += 1;
      await secondAttemptedLock;
      return { ...order, responseVersion: 'pg-real-1' };
    },
  };
  const advisoryKey = `commerce-order-create:${TENANT_ID}:${IDEMPOTENCY_KEY}`;

  const firstCall = transaction(async trx => {
    await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [advisoryKey]);
    releaseFirstLocked();
    return createPendingOrder(trx, { empresaId: TENANT_ID, lojaId: STORE_ID }, input);
  });
  await firstLocked;
  const secondCall = transaction(async baseTrx => {
    const trx = {
      query: (sql, values = []) => {
        if (sql.includes('pg_advisory_xact_lock') && values[0] === advisoryKey) releaseSecondAttempt();
        return baseTrx.query(sql, values);
      },
    };
    return createPendingOrder(trx, { empresaId: TENANT_ID, lojaId: STORE_ID }, input);
  });

  const [created, replayed] = await Promise.all([firstCall, secondCall]);
  assert.deepEqual(replayed, created);
  assert.equal(finalizedResponses, 1);

  const persisted = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM commerce_orders WHERE empresa_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM commerce_order_items WHERE empresa_id = $1) AS order_items,
       (SELECT COUNT(*)::int FROM commerce_inventory_reservations WHERE empresa_id = $1) AS reservations,
       (SELECT COUNT(DISTINCT order_id)::int FROM commerce_inventory_reservations WHERE empresa_id = $1) AS reservation_sets,
       (SELECT response_body FROM commerce_idempotency_keys
         WHERE empresa_id = $1 AND scope = 'order.create' AND key = $2) AS replay_body`,
    [TENANT_ID, IDEMPOTENCY_KEY],
  );
  assert.deepEqual(persisted.rows[0], {
    orders: 1,
    order_items: 2,
    reservations: 2,
    reservation_sets: 1,
    replay_body: created,
  });

  const beforeConflict = await dmlSnapshot();
  await assert.rejects(
    () => transaction(trx => createPendingOrder(
      trx,
      { empresaId: TENANT_ID, lojaId: STORE_ID },
      { ...input, items: [{ variantId: VARIANT_A_ID, quantity: 3 }, { variantId: VARIANT_B_ID, quantity: 1 }] },
    )),
    error => error?.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.deepEqual(await dmlSnapshot(), beforeConflict);

  await pool.query(
    `UPDATE commerce_inventory_reservations
        SET expira_em = CURRENT_TIMESTAMP - INTERVAL '1 minute'
      WHERE empresa_id = $1 AND order_id = $2 AND status = 'pending'`,
    [TENANT_ID, created.id],
  );
  const expired = await expireCommerceReservations({ transaction }, { limit: 10, empresaId: TENANT_ID });
  assert.deepEqual(expired, { expiredOrders: 1, failedOrders: [], leaseAcquired: true });
  const released = await pool.query(
    `SELECT o.status,
            COUNT(*) FILTER (WHERE r.status = 'released')::int AS released_reservations,
            COALESCE(SUM(il.disponivel), 0)::int AS available,
            COALESCE(SUM(il.reservado), 0)::int AS reserved,
            (SELECT COUNT(*)::int FROM commerce_inventory_movements m WHERE m.empresa_id = $1 AND m.referencia_id = o.id AND m.tipo = 'liberacao') AS release_movements
       FROM commerce_orders o
       JOIN commerce_inventory_reservations r ON r.empresa_id = o.empresa_id AND r.order_id = o.id
       JOIN commerce_inventory_levels il ON il.empresa_id = r.empresa_id AND il.location_id = r.location_id AND il.variant_id = r.variant_id
      WHERE o.empresa_id = $1 AND o.id = $2
      GROUP BY o.id, o.status`,
    [TENANT_ID, created.id],
  );
  assert.deepEqual(released.rows[0], { status: 'cancelled', released_reservations: 2, available: 40, reserved: 0, release_movements: 2 });
});
