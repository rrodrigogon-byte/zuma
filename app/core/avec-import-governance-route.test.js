import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCommerceAdminRouter } from './commerce-routes.js';
import { db } from './database.js';
const scope = { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: '22222222-2222-4222-8222-222222222222', storefrontId: '33333333-3333-4333-8333-333333333333', locationId: '44444444-4444-4444-8444-444444444444', usuarioId: '66666666-6666-4666-8666-666666666666' };
const fixture = () => ({ source: 'avec', contractVersion: 'avec-dino-governance-v1', category: 'products', empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId, sourceEstablishmentId: 'SYNTHETIC-ESTABLISHMENT-PRIVATE', extractedAt: '2026-10-14T12:00:00-04:00', cutoff: '2026-10-14T12:00:00-04:00', rows: [{ sourceId: 'SYNTHETIC-PRODUCT-PRIVATE', sku: 'SYNTHETIC-SKU', unidade: 'UN' }] });
test('governança HTTP real: auth/RBAC, fronteira explícita, no-store, sem writer, saída minimizada', async () => {
  const previous = { query: db.query, queryRead: db.queryRead, transaction: db.transaction };
  const calls = []; let denied = '', validStore = true, selectedUnit = scope.lojaId, authenticated = true;
  db.transaction = async () => { throw new Error('WRITE TRANSACTION FORBIDDEN'); };
  db.query = db.queryRead = async (sql, values) => {
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/i); calls.push({ sql, values });
    if (sql.includes('COUNT(*)::int AS grants')) return { rows: [{ grants: denied === values[1] ? 0 : 1, corporate_access: false }] };
    if (sql.includes('FROM commerce_storefronts')) return { rows: validStore ? [{ id: scope.storefrontId, loja_id: scope.lojaId, empresa_id: scope.empresaId, status: 'active' }] : [] };
    if (sql.includes('FROM commerce_inventory_locations')) return { rows: [{ id: scope.locationId, loja_id: scope.lojaId, empresa_id: scope.empresaId, ativo: true }] };
    throw new Error('UNEXPECTED DATABASE READ');
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (authenticated) req.commerceAdminContext = { ...scope, lojaId: selectedUnit }; next(); });
  app.use('/api/admin/commerce', createCommerceAdminRouter());
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/commerce/catalog/avec/governance/preview`;
  const request = (body = fixture()) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    let res = await request(); assert.equal(res.status, 200, await res.clone().text());
    let data = await res.json(); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(data.summary.total, 1); assert.equal(data.summary.readyToApply, 0);
    assert.deepEqual(data.write, { performed: false, enabled: false, endpoint: null }); assert.equal(data.policy.agendaWindowDays, 60);
    assert.doesNotMatch(JSON.stringify(data), /SYNTHETIC-PRODUCT-PRIVATE|SYNTHETIC-ESTABLISHMENT-PRIVATE|SYNTHETIC-SKU/);
    assert.deepEqual(data.scope, { empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId });
    for (const permission of ['catalog.read', 'inventory.read']) {
      calls.length = 0; denied = permission; res = await request(); data = await res.json();
      assert.equal(res.status, 403); assert.equal(data.code, 'PERMISSION_DENIED'); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(calls.some(call => call.sql.includes('commerce_storefronts')), false);
    }
    denied = ''; validStore = false; calls.length = 0; res = await request(); assert.equal(res.status, 403); assert.equal((await res.json()).code, 'AVEC_SCOPE_MISMATCH');
    validStore = true; selectedUnit = null; calls.length = 0; res = await request(); assert.equal(res.status, 400); assert.equal((await res.json()).code, 'AVEC_SCOPE_REQUIRED');
    selectedUnit = scope.lojaId;
    for (const [patch, status] of [[{ empresaId: '77777777-7777-4777-8777-777777777777' }, 403], [{ execute: true }, 400], [{ cutoff: '2026-02-30T12:00:00Z' }, 400]]) {
      calls.length = 0; res = await request({ ...fixture(), ...patch }); assert.equal(res.status, status); assert.equal(calls.some(call => call.sql.includes('commerce_storefronts')), false);
    }
    const sensitive = fixture(); sensitive.rows[0].email = 'PRIVATE-SENSITIVE-FIXTURE';
    calls.length = 0; res = await request(sensitive); assert.equal(res.status, 400); data = await res.json(); assert.equal(data.code, 'AVEC_SENSITIVE_FIELD_REJECTED'); assert.doesNotMatch(JSON.stringify(data), /PRIVATE-SENSITIVE-FIXTURE/);
    for (const path of [url, url.replace('/preview', '/execute')]) { calls.length = 0; res = await fetch(path); assert.equal(res.status, 404); assert.equal(calls.length, 0); }
    calls.length = 0; res = await fetch(url.replace('/preview', '/execute'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(res.status, 404); assert.equal(calls.length, 0);
    authenticated = false; calls.length = 0; res = await request(); assert.ok(res.status >= 400); assert.equal(calls.length, 0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); Object.assign(db, previous); }
});
