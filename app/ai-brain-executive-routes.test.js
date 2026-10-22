import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAiBrainRoutes } from './ai-brain-routes.js';
import { buildCustomerGraph } from './dino-grafo.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const BASE = '/api/admin/barbearia/cerebro-ia';
const OLD_FLAG = process.env.COMMERCE_CORE_ENABLED;

test.after(() => {
  if (OLD_FLAG === undefined) delete process.env.COMMERCE_CORE_ENABLED;
  else process.env.COMMERCE_CORE_ENABLED = OLD_FLAG;
});

function harness({ runAiTask, storeId = STORE, user = { role: 'admin', empresaId: COMPANY, lojaId: STORE } } = {}) {
  process.env.COMMERCE_CORE_ENABLED = '1';
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map((method) => [method, (path, handler) => routes.set(`${method.toUpperCase()} ${path}`, handler)]));
  const permissions = [];
  let receivedAiInput = null;
  let graphCalls = 0;
  let graphScope = null;
  const graph = buildCustomerGraph({
    clients: [{ id: 'customer-1', nome: 'Ana Cliente', telefone: '5565999990001' }],
    commands: [{ id: 'cmd-1', clienteId: 'customer-1', status: 'paga', fechadaEm: '2026-10-01T12:00:00-04:00', itens: [{ tipo: 'servico', nome: 'Corte', subtotal: 45 }] }],
    quality: { fontes: { clients: { status: 'ok' }, appointments: { status: 'ok' }, commands: { status: 'ok' }, retailSales: { status: 'ok' }, catalogo: { status: 'ok' }, pedidos: { status: 'ok' }, memoria: { status: 'ok' }, consentimentos: { status: 'ok' }, produtosLocais: { status: 'ok' } } },
  });
  registerAiBrainRoutes(app, {
    legacyEmpresaId: () => 'legacy-company', legacyLojaId: () => 'legacy-store',
    requireCommercePermission: async (_request, permission) => { permissions.push(permission); return { empresaId: COMPANY, lojaId: storeId }; },
    loadGraph: async (scope) => {
      graphCalls += 1;
      graphScope = scope;
      assert.equal(scope.lojaId, STORE);
      return { graph, sources: { catalog: [{ id: 'product-1', nome: 'Pomada Premium', preco: 35, estoque: 8, publicado: true }], services: [] } };
    },
    loadExecutiveSources: async ({ scope, graphSources, from, to, days }) => {
      assert.equal(scope.lojaId, STORE); assert.equal(days, 30); assert.ok(from < to); assert.ok(graphSources);
      return {
        schedule: { total: 12, concluidos: 8, cancelados: 2, faltas: 2, taxaComparecimento: 80, taxaCancelamento: 16.7 },
        finance: [{ tipo: 'receita', status: 'pago', valor: 120, pagoEm: '2026-10-02T12:00:00Z' }],
        cash: [],
        commerce: { ordersByStatus: [{ status: 'paid', total: 2 }], payments: { transactions: 2, amount: 120 }, inventory: [{ name: 'Pomada Premium', available: 2, minimum: 3, sold: 2 }] },
        quality: {
          graph: { status: 'ok', records: 1 }, appointments: { status: 'ok', records: 12 }, finance: { status: 'ok', records: 1 },
          cash: { status: 'ok', records: 0 }, orders: { status: 'ok', records: 1 }, payments: { status: 'ok', records: 1 }, inventory: { status: 'ok', records: 1 },
        },
      };
    },
    getBrainSettings: async () => ({ tetoDiarioCentavos: 150 }),
    runAiTask: async (task, options) => {
      assert.equal(task, 'previsao_gerencial');
      assert.equal(options.capCents, 150); assert.equal(options.json, true);
      receivedAiInput = JSON.parse(options.user);
      return runAiTask ? runAiTask(task, options) : { data: { summary: 'Verifique os sinais consolidados.', actions: ['Revisar estoque com demanda.'], caveats: ['A leitura não comprova causa.'] } };
    },
  });
  const response = () => ({ headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const request = (extra = {}) => ({ user, query: { dias: '30' }, body: { dias: 30 }, params: {}, ...extra });
  return { routes, permissions, response, request, getAiInput: () => receivedAiInput, getGraphCalls: () => graphCalls, getGraphScope: () => graphScope };
}

test('GET executivo retorna métricas agregadas e exige reports.read', async () => {
  const h = harness();
  const res = h.response();
  await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), res);
  assert.equal(res.statusCode, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.metrics.customers.total, 1);
  assert.equal(res.body.metrics.operations.total, 12);
  assert.equal(res.body.metrics.finance.paidIncome, 120);
  assert.equal(res.body.metrics.offers[0].name, 'Pomada Premium');
  assert.ok(res.body.network.links.length > 0);
  assert.equal(JSON.stringify(res.body).includes('Ana Cliente'), false);
  assert.equal(JSON.stringify(res.body).includes('5565999990001'), false);
  assert.deepEqual(h.permissions, ['reports.read']);
});

test('POST IA é explícito, usa apenas agregados e respeita reports.read/settings.write', async () => {
  const h = harness();
  const res = h.response();
  await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), h.response());
  assert.equal(h.getAiInput(), null, 'carregar a página não deve chamar IA');
  await h.routes.get(`POST ${BASE}/grafo/executivo/analisar`)(h.request(), res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.analysis.summary, 'Verifique os sinais consolidados.');
  assert.deepEqual(h.permissions, ['reports.read', 'reports.read', 'settings.write']);
  const serialized = JSON.stringify(h.getAiInput());
  assert.equal(serialized.includes('Ana Cliente'), false);
  assert.equal(serialized.includes('5565999990001'), false);
  assert.equal(serialized.includes('Pomada Premium'), false);
  assert.equal(serialized.includes('customer-1'), false);
  assert.ok(h.getAiInput().coverage);
});

test('teto de IA atingido responde sem executar análise nem alterar métricas determinísticas', async () => {
  const h = harness({ runAiTask: async () => { throw Object.assign(new Error('teto'), { code: 'BUDGET_EXCEEDED' }); } });
  const res = h.response();
  await h.routes.get(`POST ${BASE}/grafo/executivo/analisar`)(h.request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'BUDGET_EXCEEDED');
});

test('unidade ativa é obrigatória no grafo executivo e sem ela não lê fontes nem chama IA', async () => {
  const h = harness({ storeId: null });
  const get = h.response();
  await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), get);
  assert.equal(get.statusCode, 409);
  assert.equal(get.body.code, 'STORE_SCOPE_REQUIRED');

  const post = h.response();
  await h.routes.get(`POST ${BASE}/grafo/executivo/analisar`)(h.request(), post);
  assert.equal(post.statusCode, 409);
  assert.equal(post.body.code, 'STORE_SCOPE_REQUIRED');
  assert.equal(h.getGraphCalls(), 0);
  assert.equal(h.getAiInput(), null);
  assert.deepEqual(h.permissions, ['reports.read', 'reports.read']);
});

test('grafo, memória e automações não leem nem alteram dados tenant-wide sem unidade ativa', async () => {
  const h = harness({ storeId: null });
  const requests = [
    ['GET', `${BASE}/grafo`, {}],
    ['GET', `${BASE}/grafo/cliente/:token`, { params: { token: 'kabcde' } }],
    ['GET', `${BASE}/memoria/:ref`, { params: { ref: 'tel:5565999990001' } }],
    ['PATCH', `${BASE}/memoria/fatos/:id`, { params: { id: '44444444-4444-4444-8444-444444444444' } }],
    ['DELETE', `${BASE}/memoria/:ref`, { params: { ref: 'tel:5565999990001' } }],
    ['GET', `${BASE}/automacoes/previa`, {}],
    ['POST', `${BASE}/automacoes/executar`, {}],
  ];
  for (const [method, path, extra] of requests) {
    const res = h.response();
    await h.routes.get(`${method} ${path}`)(h.request(extra), res);
    assert.equal(res.statusCode, 409, path);
    assert.equal(res.body.code, 'STORE_SCOPE_REQUIRED', path);
  }
  assert.equal(h.getGraphCalls(), 0);
});

test('telefone direto fora do grafo da loja não resolve memória de outra unidade', async () => {
  const h = harness();
  const res = h.response();
  await h.routes.get(`GET ${BASE}/memoria/:ref`)(h.request({ params: { ref: 'tel:5565999999999' } }), res);
  assert.deepEqual(res.body, { disponivel: false, motivo: 'sem_telefone', facts: [], summaries: [] });
  assert.equal(h.getGraphCalls(), 1);
});

test('vínculo legado requer claims assinados coincidentes e rejeita seleção de outra loja ou conta Commerce nova', async () => {
  const mismatch = harness({ user: { role: 'admin', empresaId: COMPANY, lojaId: '33333333-3333-4333-8333-333333333333' } });
  await mismatch.routes.get(`GET ${BASE}/grafo/executivo`)(mismatch.request(), mismatch.response());
  assert.equal(mismatch.getGraphScope().legacyScopeVerified, false);
  assert.equal(mismatch.getGraphScope().legacy, null);
  assert.equal(mismatch.getGraphScope().legacyLoja, null);

  const commerceAccount = harness({ user: { role: 'admin', empresaId: COMPANY, lojaId: STORE, pgAccount: true } });
  await commerceAccount.routes.get(`GET ${BASE}/grafo/executivo`)(commerceAccount.request(), commerceAccount.response());
  assert.equal(commerceAccount.getGraphScope().legacyScopeVerified, false);

  const signedMatch = harness();
  await signedMatch.routes.get(`GET ${BASE}/grafo/executivo`)(signedMatch.request(), signedMatch.response());
  assert.equal(signedMatch.getGraphScope().legacyScopeVerified, true);
  assert.equal(signedMatch.getGraphScope().legacy, COMPANY);
  assert.equal(signedMatch.getGraphScope().legacyLoja, STORE);
});
