import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAiBrainRoutes } from './ai-brain-routes.js';
import { buildCustomerGraph, customerToken } from './dino-grafo.js';

test('grafo pode explorar cliente sem oferta, mascara contato e impede cache', async t => {
  const previous = process.env.COMMERCE_CORE_ENABLED;
  process.env.COMMERCE_CORE_ENABLED = '1';
  t.after(() => { if (previous === undefined) delete process.env.COMMERCE_CORE_ENABLED; else process.env.COMMERCE_CORE_ENABLED = previous; });
  const routes = new Map();
  const app = { get: (path, fn) => routes.set(path, fn), post() {}, put() {}, patch() {}, delete() {} };
  const graph = buildCustomerGraph({ clients: [{ id: 'a', telefone: '65999990001', nome: 'Ana' }] });
  let loads = 0;
  registerAiBrainRoutes(app, { legacyEmpresaId: () => 'legacy', legacyLojaId: () => 'legacy-store',
    requireCommercePermission: async () => ({ empresaId: 'empresa', lojaId: 'store' }),
    loadGraph: async s => { loads++; assert.equal(s.lojaId, 'store'); return { graph, sources: { catalog: [], services: [] } }; } });
  const base = '/api/admin/barbearia/cerebro-ia';
  const res = { headers: {}, set(k,v) { this.headers[k] = v; return this; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; } };
  const req = { user: { role: 'admin' }, query: {}, params: { token: customerToken('5565999990001') } };
  await routes.get(`${base}/grafo`)(req,res);
  assert.equal(res.body.clientes[0].nome,'Ana'); assert.equal(res.body.ofertas.length,0);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.ok(!JSON.stringify(res.body).includes('5565999990001'));
  await routes.get(`${base}/grafo/cliente/:token`)(req,res);
  assert.equal(res.body.cliente.nome,'Ana'); assert.equal(res.body.ofertas,null);
  assert.equal(res.body.ego.nodes.length,1);
  await routes.get(`${base}/grafo`)({ ...req, user: { role: 'cliente' } },res);
  assert.equal(res.statusCode,403); assert.equal(loads,2);
});
