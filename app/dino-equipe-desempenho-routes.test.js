import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { equipePerformanceNoStore, registerEquipePerformanceRoutes, EQUIPE_PERFORMANCE_PATH } from './dino-equipe-desempenho-routes.js';

async function fixture(options = {}) {
  const app = express(); let reads = 0;
  app.use(equipePerformanceNoStore);
  app.use((req, res, next) => {
    if (req.headers.authorization !== 'Bearer synthetic') return res.status(401).json({ code: 'UNAUTHORIZED' });
    req.user = options.user || { role: 'admin', empresaId: 'tenant-a', lojaId: 'unit-a' };
    next();
  });
  const root = { barbearias: { 'tenant-a': { profissionais: {}, agendamentos: {}, comandas: {}, vendasRevenda: {}, servicos: {}, configuracao: {} } } };
  const before = structuredClone(root);
  registerEquipePerformanceRoutes(app, { db: () => { reads++; return root; }, legacyEmpresaId: options.legacyEmpresaId || (req => req.user.empresaId), legacyLojaId: options.legacyLojaId || (req => req.user.lojaId), coreEnabled: () => options.core === true, salesReport: options.salesReport || (async (_context, range) => ({ period: range, summary: { gross_total: 999, orders_non_cancelled: 9, confirmed_total: 321, confirmed_orders: 2 } })), requireCommercePermission: async (req, permission) => { assert.equal(permission, 'reports.read'); if (options.deny) throw Object.assign(new Error('PRIVATE-ERROR-CANARY'), { code: 'PERMISSION_DENIED' }); return options.context || { empresaId: req.user.empresaId, lojaId: req.user.lojaId }; } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}${EQUIPE_PERFORMANCE_PATH}`;
  return { root, before, reads: () => reads, request: async ({ query = 'inicio=2026-10-01&fim=2026-10-15', method = 'GET', auth = true, headers = {} } = {}) => { const result = await fetch(`${base}?${query}`, { method, headers: { ...(auth ? { Authorization: 'Bearer synthetic' } : {}), ...headers } }); return { status: result.status, cache: result.headers.get('cache-control'), allow: result.headers.get('allow'), body: await result.json() }; }, close: () => new Promise(resolve => server.close(resolve)) };
}

test('HTTP read-only retorna contexto exato e no-store; não muta snapshot', async () => { const f = await fixture(); try { const r = await f.request(); assert.equal(r.status, 200); assert.equal(r.cache, 'no-store'); assert.deepEqual(r.body.scope, { empresaId: 'tenant-a', lojaId: 'unit-a' }); assert.equal(r.body.readOnly, true); assert.equal(r.body.writePerformed, false); assert.deepEqual(f.root, f.before); } finally { await f.close(); } });
test('401 e staff 403 têm no-store e zero leitura do snapshot', async () => { const f = await fixture({ user: { role: 'staff', empresaId: 'tenant-a', lojaId: 'unit-a' } }); try { assert.equal((await f.request({ auth: false })).status, 401); const denied = await f.request(); assert.equal(denied.status, 403); assert.equal(denied.cache, 'no-store'); assert.equal(f.reads(), 0); } finally { await f.close(); } });
test('Core exige reports.read e não usa fallback financeiro após negativa', async () => { const f = await fixture({ core: true, deny: true }); try { const r = await f.request(); assert.equal(r.status, 403); assert.equal(f.reads(), 0); assert.equal(JSON.stringify(r.body).includes('PRIVATE-ERROR'), false); } finally { await f.close(); } });
test('Core rejeita outra empresa/unidade resolvida antes do snapshot', async () => { for (const context of [{ empresaId: 'tenant-b', lojaId: 'unit-a' }, { empresaId: 'tenant-a', lojaId: 'unit-b' }]) { const f = await fixture({ core: true, context }); try { assert.equal((await f.request()).status, 403); assert.equal(f.reads(), 0); } finally { await f.close(); } } });
test('Core soma somente receita e pedidos Commerce confirmados ao resumo da equipe', async () => { const f = await fixture({ core: true }); try { const r = await f.request(); assert.equal(r.status, 200); assert.equal(r.body.summary.commerceRevenue, 321); assert.equal(r.body.summary.commerceOrders, 2); assert.equal(r.body.summary.revenue, 321); } finally { await f.close(); } });
test('Core aceita o contexto Dino em IDs Commerce e consulta o legado mapeado', async () => { const f = await fixture({
  core: true,
  legacyEmpresaId: () => 'emp-kytto-001',
  legacyLojaId: () => 'dino-web-estoque',
  context: { empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' },
}); try {
  const r = await f.request({ headers: { 'x-empresa-id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'x-loja-id': 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.scope, { empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque' });
} finally { await f.close(); } });
test('empresa principal ou seleção todas unidades é bloqueada', async () => { for (const user of [{ role: 'admin', empresaId: 'principal', lojaId: 'unit-a' }, { role: 'admin', empresaId: 'tenant-a', lojaId: '' }]) { const f = await fixture({ user }); try { assert.equal((await f.request()).status, 409); assert.equal(f.reads(), 0); } finally { await f.close(); } } });
test('query e cabeçalho não autorizam troca de tenant/unidade', async () => { const f = await fixture(); try { assert.equal((await f.request({ query: 'inicio=2026-10-01&fim=2026-10-15&empresaId=tenant-b' })).status, 403); assert.equal((await f.request({ headers: { 'x-loja-id': 'unit-b' } })).status, 403); assert.equal(f.reads(), 0); } finally { await f.close(); } });
test('métodos de mutação são 405 e não carregam nem escrevem dados', async () => { const f = await fixture(); try { for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) { const r = await f.request({ method }); assert.equal(r.status, 405); assert.equal(r.allow, 'GET'); assert.equal(r.cache, 'no-store'); } assert.equal(f.reads(), 0); assert.deepEqual(f.root, f.before); } finally { await f.close(); } });
test('query com dados sensíveis/campos extra é rejeitada sem eco', async () => { const f = await fixture(); try { const r = await f.request({ query: 'inicio=2026-10-01&fim=2026-10-15&email=PRIVATE-CONTACT-CANARY' }); assert.equal(r.status, 400); assert.equal(f.reads(), 0); assert.equal(JSON.stringify(r.body).includes('PRIVATE-CONTACT'), false); } finally { await f.close(); } });
test('período impossível é rejeitado com mensagem sanitizada', async () => { const f = await fixture(); try { const r = await f.request({ query: 'inicio=2026-02-30&fim=2026-10-15' }); assert.equal(r.status, 400); assert.equal(JSON.stringify(r.body).includes('2026-02-30'), false); } finally { await f.close(); } });
