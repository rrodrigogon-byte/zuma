import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAiBrainRoutes } from './ai-brain-routes.js';
import { buildCustomerGraph, customerToken } from './dino-grafo.js';
import { scopedCustomerRef } from './dino-grafo-rede.js';
import { runAutomationRound as runAutomationRoundCore } from './core/ai-automations.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const PROFESSIONAL = '33333333-3333-4333-8333-333333333333';
const PRODUCT_INTERNAL = '44444444-4444-4444-8444-444444444444';
const BASE = '/api/admin/barbearia/cerebro-ia';
const OLD_FLAG = process.env.COMMERCE_CORE_ENABLED;
const RECENT_COMMAND = new Date(Date.now() - 3 * 86400000).toISOString();

test.after(() => {
  if (OLD_FLAG === undefined) delete process.env.COMMERCE_CORE_ENABLED;
  else process.env.COMMERCE_CORE_ENABLED = OLD_FLAG;
});

function harness({ runAiTask, runAutomationRound: runRound, commerceQueryRead = async () => ({ rows: [] }), identityStatuses = {}, storeId = STORE, user = { role: 'admin', empresaId: COMPANY, lojaId: STORE }, catalog = [{ id: 'product-1', nome: 'Pomada Premium', preco: 35, estoque: 8, publicado: true }], clients = [{ id: 'customer-1', nome: 'Ana Cliente', telefone: '5565999990001' }], commands = [{ id: 'cmd-1', clienteId: 'customer-1', profissionalId: PROFESSIONAL, status: 'paga', fechadaEm: RECENT_COMMAND, itens: [{ tipo: 'servico', nome: 'Corte', subtotal: 45 }, { tipo: 'produto', nome: 'Gel de barbear', produtoId: PRODUCT_INTERNAL, subtotal: 15 }] }], catalogStatus = 'ok', localProductsStatus = 'ok', servicesStatus = 'ok', getFactPhone = async () => null } = {}) {
  process.env.COMMERCE_CORE_ENABLED = '1';
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map((method) => [method, (path, handler) => routes.set(`${method.toUpperCase()} ${path}`, handler)]));
  const permissions = [];
  const commerceQueries = [];
  let receivedAiInput = null;
  let graphCalls = 0;
  let graphScope = null;
  const identityQuality = Object.fromEntries(['clients', 'appointments', 'commands', 'retailSales', 'pedidos']
    .map((name) => [name, { status: identityStatuses[name] || 'ok' }]));
  const graph = buildCustomerGraph({
    clients,
    commands, professionals: [{ id: PROFESSIONAL, nome: 'Ana Barbeira' }],
    quality: { fontes: { ...identityQuality, catalogo: { status: 'ok' }, memoria: { status: 'ok' }, consentimentos: { status: 'ok' }, produtosLocais: { status: 'ok' }, services: { status: 'ok' }, professionals: { status: 'ok' } } },
  });
  registerAiBrainRoutes(app, {
    legacyEmpresaId: () => 'legacy-company', legacyLojaId: () => 'legacy-store',
    requireCommercePermission: async (_request, permission) => { permissions.push(permission); return { empresaId: COMPANY, lojaId: storeId }; },
    commerceDb: { queryRead: async (sql, params) => { commerceQueries.push({ sql, params }); return commerceQueryRead(sql, params); } },
    runAutomationRound: runRound,
    getFactPhone,
    loadGraph: async (scope) => {
      graphCalls += 1;
      graphScope = scope;
      assert.equal(scope.lojaId, STORE);
      return { graph, sources: { catalog, services: [], clients, identityClients: clients, commands, appointments: [], retailSales: [], orders: [], facts: [], professionals: [{ id: PROFESSIONAL, nome: 'Ana Barbeira' }], quality: { fontes: { ...identityQuality, memoria: { status: 'ok' }, catalogo: { status: catalogStatus }, produtosLocais: { status: localProductsStatus }, services: { status: servicesStatus }, professionals: { status: 'ok' } } } } };
    },
    loadExecutiveSources: async ({ scope, graphSources, from, to, days }) => {
      assert.equal(scope.lojaId, STORE); assert.equal(days, 30); assert.ok(from < to); assert.ok(graphSources);
      return {
        schedule: { total: 12, concluidos: 8, cancelados: 2, faltas: 2, taxaComparecimento: 80, taxaCancelamento: 16.7 },
        // Data relativa: a janela executiva é o mês corrente; data fixa de outubro zerava em 01/11.
        finance: [{ tipo: 'receita', status: 'pago', valor: 120, pagoEm: new Date(Date.now() - 60_000).toISOString() }],
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
  return { routes, permissions, response, request, getAiInput: () => receivedAiInput, getGraphCalls: () => graphCalls, getGraphScope: () => graphScope, getGraph: () => graph, getCommerceQueries: () => commerceQueries };
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
  assert.equal(res.body.network.nodes.find((node) => node.id === 'metric:customers-total').window.kind, 'relationship_history');
  assert.equal(res.body.network.nodes.find((node) => node.id === 'metric:offers-total').window.kind, 'relationship_history');
  assert.equal(JSON.stringify(res.body).includes('Ana Cliente'), false);
  assert.equal(JSON.stringify(res.body).includes('5565999990001'), false);
  assert.deepEqual(h.permissions, ['reports.read']);
});

test('eventos antigos ou futuros não alimentam métricas nem oportunidades do histórico executivo', async () => {
  const dates = [new Date(Date.now() - 366 * 86400000).toISOString(), new Date(Date.now() + 86400000).toISOString()];
  for (const fechadaEm of dates) {
    const h = harness({ commands: [{ id: 'outside-window', clienteId: 'customer-1', status: 'paga', fechadaEm, itens: [{ tipo: 'servico', nome: 'Corte', subtotal: 45 }] }] });
    const response = h.response();
    await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), response);
    assert.equal(response.body.metrics.customers.total, 0);
    assert.equal(response.body.metrics.customers.customersWithOffers, 0);
    assert.equal(response.body.network.links.filter((link) => !link.structural).length, 0);
  }
});

test('produto sem nível de estoque pode aparecer como oportunidade, mas não como disponível/enviável', async () => {
  const h = harness({ catalog: [{ id: 'product-unknown', nome: 'Pomada sem saldo', preco: 35, estoque: null, estoque_informado: false, publicado: true }] });
  const list = h.response();
  await h.routes.get(`GET ${BASE}/grafo`)(h.request(), list);
  assert.equal(list.body.ofertas[0].melhor.disponibilidade, 'nao_verificada');
  assert.equal(list.body.ofertas[0].enviar, false);

  const executive = h.response();
  await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), executive);
  assert.equal(executive.body.quality.sources.offers.status, 'limitado');
  assert.equal(executive.body.quality.sources.offers.records, 1);
  assert.match(executive.body.quality.sources.offers.detail, /1 recomendação\(ões\) de produto sem saldo verificado/);
});

test('catálogo, revenda local ou serviços parciais degradam a cobertura das oportunidades', async () => {
  for (const options of [{ catalogStatus: 'limitado' }, { localProductsStatus: 'limitado' }, { servicesStatus: 'indisponivel' }]) {
    const h = harness(options);
    const response = h.response();
    await h.routes.get(`GET ${BASE}/grafo/executivo`)(h.request(), response);
    assert.equal(response.body.quality.sources.offers.status, 'limitado');
    assert.match(response.body.quality.sources.offers.detail, /Catálogo, revenda local ou serviços/);
  }
});

test('lista, ofertas e ego usam referência da unidade; a rota rejeita token global', async () => {
  const h = harness();
  const key = [...h.getGraph().customers.keys()][0];
  const scopedRef = scopedCustomerRef({ empresaId: COMPANY, lojaId: STORE }, key);
  const globalToken = customerToken(String(key));
  const listResponse = h.response();
  await h.routes.get(`GET ${BASE}/grafo`)(h.request(), listResponse);
  assert.equal(listResponse.body.clientes[0].chave, scopedRef);
  assert.ok(listResponse.body.ofertas.every((row) => row.cliente.chave === scopedRef));
  assert.equal(JSON.stringify(listResponse.body).includes(globalToken), false);

  const legacyResponse = h.response();
  await h.routes.get(`GET ${BASE}/grafo/cliente/:token`)(h.request({ params: { token: globalToken } }), legacyResponse);
  assert.equal(legacyResponse.statusCode, 404);
  assert.equal(legacyResponse.body.code, 'NOT_FOUND');

  const egoResponse = h.response();
  await h.routes.get(`GET ${BASE}/grafo/cliente/:token`)(h.request({ params: { token: scopedRef } }), egoResponse);
  assert.equal(egoResponse.statusCode, undefined);
  assert.equal(egoResponse.body.cliente.chave, scopedRef);
  assert.ok(egoResponse.body.ego.nodes.some((node) => node.id === `c:${scopedRef}`));
  const egoJson = JSON.stringify(egoResponse.body.ego);
  assert.equal(egoJson.includes(PROFESSIONAL), false);
  assert.equal(egoJson.includes(PRODUCT_INTERNAL), false);
  assert.equal(egoJson.includes('Ana Barbeira'), false);
  assert.ok(egoResponse.body.ego.nodes.some((node) => node.tipo === 'profissional' && node.rotulo === 'Profissional 01'));
  assert.equal(JSON.stringify(egoResponse.body).includes(globalToken), false);
  assert.equal(egoResponse.body.ofertas?.cliente?.chave || scopedRef, scopedRef);
});

test('grafo e ego não expõem perfil ou interesse quando a cobertura de identidade está incompleta', async () => {
  const h = harness({ identityStatuses: { clients: 'limitado' } });
  const listResponse = h.response();
  await h.routes.get(`GET ${BASE}/grafo`)(h.request(), listResponse);
  assert.deepEqual(listResponse.body.clientes, []);
  assert.deepEqual(listResponse.body.ofertas, []);
  assert.equal(listResponse.body.clientesLimitados, true);
  assert.equal(JSON.stringify(listResponse.body).includes('Ana Cliente'), false);
  assert.equal(JSON.stringify(listResponse.body).includes('interesses'), false);

  const key = [...h.getGraph().customers.keys()][0];
  const scopedRef = scopedCustomerRef({ empresaId: COMPANY, lojaId: STORE }, key);
  const egoResponse = h.response();
  await h.routes.get(`GET ${BASE}/grafo/cliente/:token`)(h.request({ params: { token: scopedRef } }), egoResponse);
  assert.equal(egoResponse.statusCode, 404);
  assert.equal(egoResponse.body.code, 'NOT_FOUND');
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
  assert.equal(h.getAiInput().windows.selectedPeriod.kind, 'selected_period');
  assert.equal(h.getAiInput().windows.relationshipHistory.maxDays, 365);
  assert.equal(h.getAiInput().windows.currentOverduePosition.kind, 'current_overdue_position');
  assert.equal(h.getAiInput().windows.stockSnapshot.kind, 'current_stock_snapshot');
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

test('prévia não agrega histórico de automação tenant-wide como resultado da unidade', async () => {
  const guardScopes = [];
  const h = harness({
    runAutomationRound: (options) => runAutomationRoundCore({
      ...options,
      getSettings: async () => ({ ativo: true, autonomia: 1, automacoes: {} }),
      loadGuards: async (empresaId, lojaId) => {
        guardScopes.push([empresaId, lojaId]);
        return { recentMarketing: new Map(), recentAny: new Map(), sentRefs: new Set(), sentToday: 0, quiet: false };
      },
    }),
    commerceQueryRead: async (sql) => ({ rows: /canais_integracao/.test(sql) ? [{ loja_id: STORE }] : [] }),
  });
  const response = h.response();
  await h.routes.get(`GET ${BASE}/automacoes/previa`)(h.request(), response);
  assert.equal(response.statusCode, undefined);
  assert.deepEqual(guardScopes, [[COMPANY, STORE]]);
  assert.deepEqual(response.body.resultados, []);
  assert.equal(response.body.resultadosStatus, 'ok');
  assert.match(response.body.resultadosDetalhe, /somente registros vinculados à unidade ativa/);
  assert.ok(h.getCommerceQueries().some(({ sql }) => /canais_integracao/.test(sql)));
  const logQuery = h.getCommerceQueries().find(({ sql }) => /ai_automation_log/.test(sql));
  assert.ok(logQuery);
  assert.match(logQuery.sql, /WHERE empresa_id = \$1 AND loja_id = \$2/);
  assert.deepEqual(logQuery.params, [COMPANY, STORE]);
});

test('prévia para sem canal ativo sem carregar grafo ou consultar histórico', async () => {
  const h = harness({ commerceQueryRead: async () => ({ rows: [] }) });
  const response = h.response();
  await h.routes.get(`GET ${BASE}/automacoes/previa`)(h.request(), response);
  assert.equal(response.body.reason, 'canal_inativo');
  assert.equal(response.body.resultadosStatus, 'indisponivel');
  assert.equal(h.getGraphCalls(), 0);
  assert.equal(h.getCommerceQueries().some(({ sql }) => /ai_automation_log/.test(sql)), false);
});

test('telefone direto fora do grafo da loja não resolve memória de outra unidade', async () => {
  const h = harness();
  const res = h.response();
  await h.routes.get(`GET ${BASE}/memoria/:ref`)(h.request({ params: { ref: 'tel:5565999999999' } }), res);
  assert.deepEqual(res.body, { disponivel: false, motivo: 'sem_telefone', facts: [], summaries: [] });
  assert.equal(h.getGraphCalls(), 1);
});

test('telefone compartilhado não permite ler nem alterar memória como se fosse uma pessoa única', async () => {
  const phone = '5565999990001';
  const h = harness({
    clients: [
      { id: 'customer-1', nome: 'Ana Cliente', telefone: phone },
      { id: 'customer-duplicate', nome: 'Outro cadastro', telefone: phone },
    ],
    getFactPhone: async () => phone,
  });
  const memory = h.response();
  await h.routes.get(`GET ${BASE}/memoria/:ref`)(h.request({ params: { ref: `tel:${phone}` } }), memory);
  assert.deepEqual(memory.body, { disponivel: false, motivo: 'sem_telefone', facts: [], summaries: [] });

  const fact = h.response();
  await h.routes.get(`PATCH ${BASE}/memoria/fatos/:id`)(h.request({ params: { id: 'fact-ambiguous' }, body: { status: 'ativo' } }), fact);
  assert.equal(fact.statusCode, 404);
  assert.equal(fact.body.code, 'NOT_FOUND');
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
