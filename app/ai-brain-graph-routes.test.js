import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAiBrainRoutes } from './ai-brain-routes.js';
import { buildCustomerGraph, customerToken } from './dino-grafo.js';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const STORE_ID = '22222222-2222-4222-8222-222222222222';
const PHONE = '5565999990001';

test('grafo pode explorar cliente sem oferta, mascara contato, escopa referência e impede cache', async (t) => {
  const previous = process.env.COMMERCE_CORE_ENABLED;
  process.env.COMMERCE_CORE_ENABLED = '1';
  t.after(() => { if (previous === undefined) delete process.env.COMMERCE_CORE_ENABLED; else process.env.COMMERCE_CORE_ENABLED = previous; });
  const routes = new Map();
  const app = { get: (path, fn) => routes.set(path, fn), post() {}, put() {}, patch() {}, delete() {} };
  const graph = buildCustomerGraph({
    clients: [{ id: 'a', telefone: '65999990001', nome: 'Ana' }],
    quality: { fontes: Object.fromEntries(['clients', 'appointments', 'commands', 'retailSales', 'pedidos'].map((name) => [name, { status: 'ok' }])) },
  });
  let loads = 0;
  registerAiBrainRoutes(app, {
    legacyEmpresaId: () => COMPANY_ID, legacyLojaId: () => STORE_ID,
    requireCommercePermission: async () => ({ empresaId: COMPANY_ID, lojaId: STORE_ID }),
    loadGraph: async (scope) => { loads += 1; assert.equal(scope.lojaId, STORE_ID); return { graph, sources: { catalog: [], services: [] } }; },
  });
  const base = '/api/admin/barbearia/cerebro-ia';
  const createResponse = () => ({ statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
  const request = { user: { role: 'admin', empresaId: COMPANY_ID, lojaId: STORE_ID }, query: {}, params: {} };
  let response = createResponse();
  await routes.get(`${base}/grafo`)(request, response);
  assert.equal(response.body.clientes[0].nome, 'Ana');
  assert.equal(response.body.ofertas.length, 0);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  const scopedToken = response.body.clientes[0].chave;
  assert.match(scopedToken, /^k[0-9a-z]{4,30}$/);
  const globalToken = customerToken(PHONE);
  assert.notEqual(scopedToken, globalToken);
  assert.equal(JSON.stringify(response.body).includes(PHONE), false);
  assert.equal(JSON.stringify(response.body).includes(globalToken), false, 'resposta não expõe token correlacionável entre lojas');

  response = createResponse();
  await routes.get(`${base}/grafo/cliente/:token`)({ ...request, params: { token: scopedToken } }, response);
  assert.equal(response.body.cliente.nome, 'Ana');
  assert.equal(response.body.ofertas, null);
  assert.equal(response.body.ego.nodes.length, 1);
  assert.equal(JSON.stringify(response.body).includes(globalToken), false);

  response = createResponse();
  await routes.get(`${base}/grafo/cliente/:token`)({ ...request, params: { token: globalToken } }, response);
  assert.equal(response.statusCode, 404, 'tokens globais antigos não resolvem em nenhuma unidade');

  response = createResponse();
  await routes.get(`${base}/grafo`)({ ...request, user: { role: 'cliente' } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(loads, 3);
});
