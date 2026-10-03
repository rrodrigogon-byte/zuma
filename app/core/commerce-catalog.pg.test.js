import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { createCommerceAdminRouter } from './commerce-routes.js';
import { db } from './database.js';

const url = process.env.COMMERCE_CATALOG_TEST_DATABASE_URL;
const empresaId = 'a1111111-1111-4111-8111-111111111111';
const lojaId = 'a2222222-2222-4222-8222-222222222222';
const storefrontId = 'a3333333-3333-4333-8333-333333333333';
const locationId = 'a4444444-4444-4444-8444-444444444444';

// Requer banco de testes isolado já migrado; nunca escreve nas tabelas nem cria pedido.
test('PostgreSQL: GET catálogo com filtros de local e status vincula parâmetros corretamente', { skip: !url }, async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const original = db.query;
  const route = createCommerceAdminRouter().stack.find(item => item.route?.path === '/catalog/products' && item.route.methods.get)?.route?.stack?.[0]?.handle;
  assert.ok(route);
  const calls = [];
  try {
    await client.query('BEGIN READ ONLY');
    db.query = async (sql, values = []) => {
      if (sql.includes('FROM usuarios u')) return { rows: [{ usuario_id: 'a6666666-6666-4666-8666-666666666666', empresa_id: empresaId, loja_id: lojaId }] };
      if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: 1, corporate_access: false }] };
      if (sql.includes('SELECT id, loja_id FROM commerce_storefronts')) return { rows: [{ id: storefrontId, loja_id: lojaId }] };
      if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
      if (sql.includes('FROM commerce_inventory_locations')) return { rows: [{ id: locationId }] };
      if (sql.includes('FROM commerce_products p')) {
        calls.push({ sql, values });
        return client.query(sql, values);
      }
      throw new Error('consulta inesperada no catálogo PG');
    };
    for (const [status, countSize, listSize] of [[undefined, 3, 6], ['active', 4, 7]]) {
      calls.length = 0;
      const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await route({ user: { email: 'synthetic@example.invalid' }, headers: { 'x-empresa-id': empresaId, 'x-loja-id': lojaId, 'x-storefront-id': storefrontId }, query: { storefrontId, locationId, ...(status ? { status } : {}), limit: '20', offset: '0' } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(calls.length, 2);
      assert.equal(calls[0].values.length, countSize);
      assert.equal(calls[1].values.length, listSize);
      const scope = [empresaId, lojaId, storefrontId, ...(status ? [status] : [])];
      assert.deepEqual(calls[0].values, scope);
      assert.deepEqual(calls[1].values, [...scope, locationId, 20, 0]);
      assert.match(calls[1].sql, new RegExp(`il\\.location_id = \\$${countSize + 1}`));
      assert.equal(res.body.pagination.total, 0);
    }
  } finally {
    db.query = original;
    await client.query('ROLLBACK');
    await client.end();
  }
});
