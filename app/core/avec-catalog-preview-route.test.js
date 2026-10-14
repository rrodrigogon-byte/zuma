import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import { createCommerceAdminRouter } from './commerce-routes.js';
import { db } from './database.js';
const scope = { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: '22222222-2222-4222-8222-222222222222', storefrontId: '33333333-3333-4333-8333-333333333333', locationId: '44444444-4444-4444-8444-444444444444', usuarioId: '66666666-6666-4666-8666-666666666666' };
const otherUnit = '77777777-7777-4777-8777-777777777777';
test('prévia AVEC: router HTTP real, permissões distintas, no-store e somente leitura', async () => {
  const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(source, /app\.use\('\/api\/admin\/commerce', createCommerceAdminRouter\(\)\)/);
  const calls = []; let denied = ''; let selectedUnit = scope.lojaId;
  const previous = { query: db.query, queryRead: db.queryRead, transaction: db.transaction };
  db.transaction = async () => { throw new Error('nenhuma transação de escrita permitida'); };
  db.query = db.queryRead = async (sql, values) => {
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b/i); calls.push({ sql, values });
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: values[1] === denied ? 0 : 1, corporate_access: false }] };
    if (sql.includes('FROM commerce_storefronts')) return { rows: values[2] === scope.lojaId ? [{ id: scope.storefrontId, loja_id: scope.lojaId, empresa_id: scope.empresaId, status: 'active' }] : [] };
    if (sql.includes('FROM commerce_inventory_locations')) return { rows: [{ id: scope.locationId, loja_id: scope.lojaId, empresa_id: scope.empresaId, ativo: true }] };
    if (sql.includes('FROM commerce_product_variants v')) return { rows: [] };
    throw new Error('consulta fora do contrato: '+sql.slice(0,140));
  };
  const app = express(); app.use(express.json());
  // Contexto sintético já autenticado. Exercita o router/guards reais; não substitui o teste do login produtivo.
  app.use((req, _res, next) => { req.commerceAdminContext = { ...scope, lojaId: selectedUnit }; next(); });
  app.use('/api/admin/commerce', createCommerceAdminRouter());
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/commerce/catalog/avec/preview`;
  const body = { source: 'avec', storefrontId: scope.storefrontId, locationId: scope.locationId, items: [{ idOrigem: 'SYNTHETIC-1', sku: 'SYNTHETIC-SKU', unidade: 'UN' }] };
  const request = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    let response = await request(); assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get('cache-control'), 'no-store');
    let data = await response.json(); assert.equal(data.write.performed, false); assert.equal(data.summary.total, 1); assert.equal(data.summary.costMissing, 1); assert.equal(data.summary.costZero, 0); assert.deepEqual(data.scope, { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId });
    assert.deepEqual(calls.filter(c => c.sql.includes('COUNT(*)::int AS grants')).map(c => c.values[1]), ['catalog.read', 'inventory.read']);
    assert.ok(calls.some(c => c.sql.includes('FROM commerce_product_variants v')));
    for (const permission of ['catalog.read', 'inventory.read']) { calls.length = 0; denied = permission; response = await request(); data = await response.json(); assert.equal(response.status, 403); assert.equal(data.code, 'PERMISSION_DENIED'); assert.equal(calls.some(c => c.sql.includes('commerce_product_variants')), false); }
    denied = ''; selectedUnit = otherUnit; calls.length = 0; response = await request(); data = await response.json(); assert.equal(response.status, 403); assert.equal(data.code, 'AVEC_SCOPE_MISMATCH'); assert.equal(calls.some(c => c.sql.includes('commerce_product_variants')), false);
    selectedUnit = null; calls.length = 0; response = await request(); data = await response.json(); assert.equal(response.status, 400); assert.equal(data.code, 'AVEC_SCOPE_REQUIRED'); assert.equal(calls.some(c => c.sql.includes('commerce_product_variants')), false);
    calls.length = 0; response = await fetch(url); assert.equal(response.status, 404); assert.equal(calls.length, 0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); Object.assign(db, previous); }
});
