import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBrainGraph, loadBrainSources, loadOrders, loadCatalog, loadActiveFacts } from './ai-brain-data.js';
import { db } from './core/database.js';
import { buildCustomerGraph } from './dino-grafo.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const deps = () => ({ loadCatalog: async () => [], loadOrders: async () => [], loadActiveFacts: async () => [], loadConsents: async () => new Map(),
  listarClientes: () => [], listarAgendamentos: () => [], listarComandasBarbearia: () => [], listarVendasRevenda: () => [],
  listarProdutosRevenda: () => [], listarServicos: () => [], listarProfissionais: () => [], obterConfiguracao: () => ({}) });

test('fontes vazias e falhas têm estados distintos e não expõem mensagens internas', async () => {
  const d = deps(); d.loadOrders = async () => { throw new Error('secret database details'); };
  d.agendaSource = async () => 'postgres'; d.queryRead = async () => { throw new Error('agenda offline'); };
  const { sources, graph } = await loadBrainGraph({ empresaId, commerceLojaId: lojaId }, d);
  assert.deepEqual(sources.quality.fontes.pedidos, { status: 'indisponivel', registros: null });
  assert.deepEqual(sources.quality.fontes.catalogo, { status: 'ok', registros: 0 });
  assert.equal(graph.quality.fontes.pedidos.status, 'indisponivel');
  assert.ok(!JSON.stringify(sources).includes('secret'));
});

test('limite de leitura é cobertura parcial, não base completa', async () => {
  const d = deps(); d.loadCatalog = async () => Array.from({ length: 2000 }, (_, i) => ({ id: String(i), nome: 'P' }));
  d.agendaSource = async () => 'postgres'; d.queryRead = async () => ({ rows: [] });
  const s = await loadBrainSources({ empresaId, commerceLojaId: lojaId }, d);
  assert.equal(s.quality.fontes.catalogo.status, 'limitado');
});

test('sem unidade Commerce nenhuma leitura Kytto é tratada como escopo válido', async () => {
  const d = deps(); const calls = [];
  for (const key of ['loadCatalog', 'loadOrders', 'loadActiveFacts', 'loadConsents']) {
    d[key] = async () => { calls.push(key); throw new Error(`${key} não deve ser consultado sem loja`); };
  }
  for (const key of ['listarClientes', 'listarAgendamentos', 'listarComandasBarbearia', 'listarVendasRevenda', 'listarProdutosRevenda', 'listarServicos', 'listarProfissionais', 'obterConfiguracao']) {
    d[key] = () => { calls.push(key); throw new Error(`${key} não deve ser consultado sem loja`); };
  }
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(calls, []);
  assert.equal(sources.quality.fontes.clients.status, 'indisponivel');
  assert.equal(sources.quality.fontes.produtosLocais.status, 'indisponivel');
  assert.equal(sources.quality.estoqueLocalEscopo, 'indisponivel');
  for (const name of ['catalogo', 'pedidos', 'memoria', 'consentimentos']) assert.equal(sources.quality.fontes[name].status, 'indisponivel');
});

test('unidade não UUID bloqueia o resolvedor e o SQL da agenda antes de consultar', async () => {
  const d = deps(); let resolverCalls = 0; let queryCalls = 0;
  d.agendaSource = async () => { resolverCalls += 1; return 'postgres'; };
  d.queryRead = async () => { queryCalls += 1; return { rows: [] }; };
  const sources = await loadBrainSources({ empresaId, commerceLojaId: 'not-a-uuid' }, d);
  assert.equal(resolverCalls, 0);
  assert.equal(queryCalls, 0);
  assert.equal(sources.quality.fontes.appointments.status, 'indisponivel');
  assert.equal(sources.quality.fontes.catalogo.status, 'indisponivel');
});

test('loja selecionada é enviada ao SQL e ao legado; registros sem loja são excluídos', async () => {
  const d = deps(); const calls = [];
  for (const key of ['loadOrders', 'loadCatalog', 'loadActiveFacts']) d[key] = async (...args) => { calls.push(args); return []; };
  d.agendaSource = async () => 'barbearia';
  d.listarAgendamentos = (id, filters) => { assert.equal(filters.lojaId, lojaId); return []; };
  d.listarClientes = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  d.listarComandasBarbearia = (id, filters) => { assert.equal(filters.lojaId, lojaId); return [{ clienteId: 'a', lojaId }, { clienteId: 'b' }, { clienteId: 'c', lojaId: 'other' }]; };
  const s = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [empresaId, lojaId]));
  assert.deepEqual(s.clients.map(c => c.id), ['a']);
  assert.equal(s.commands.length, 1);
  assert.equal(s.identityClients.length, 3, 'detecta colisões mesmo em cadastros fora da loja');
});

test('revenda local é carregada somente para a loja legada explicitamente vinculada', async () => {
  const d = deps(); const calls = [];
  d.agendaSource = async () => 'barbearia';
  d.listarAgendamentos = () => [];
  d.listarProdutosRevenda = (company, filters) => {
    calls.push([company, filters]);
    return [
      { id: 'store-product', lojaId, nome: 'Pomada', estoqueAtual: 2, estoqueMinimo: 5 },
      { id: 'other-product', lojaId: 'another-store', nome: 'Cera', estoqueAtual: 8 },
      { id: 'unscoped-product', nome: 'Avulso', estoqueAtual: 4 },
    ];
  };
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(calls, [[empresaId, { incluirInativos: false, lojaId, incluirSemLoja: true }]]);
  assert.deepEqual(sources.catalog.map((item) => item.id), ['local:store-product']);
  assert.equal(sources.catalog[0].estoqueMinimo, 5);
  assert.equal(sources.quality.estoqueLocalEscopo, 'unidade_escopada');
  assert.equal(sources.quality.fontes.produtosLocais.status, 'limitado');
  assert.match(sources.quality.fontes.produtosLocais.detail, /outra loja foram descartados/);
});

test('agenda PostgreSQL canônica é lida por empresa+loja e mapeada sem usar JSON em paralelo', async () => {
  const d = deps(); const queries = [];
  d.agendaSource = async (scope, options) => {
    assert.deepEqual(scope, { legacyEmpresaId: empresaId, legacyLojaId: lojaId, empresaId, lojaId });
    assert.deepEqual(options, { strictStoreMapping: true });
    return 'postgres';
  };
  d.listarAgendamentos = () => { throw new Error('JSON não deve ser lido quando PostgreSQL é canônico'); };
  d.queryRead = async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [{
      id: 'appointment-pg', empresa_id: empresaId, loja_id: lojaId, cliente_id: 'customer-pg',
      cliente_nome: 'Cliente PG', cliente_telefone: '556599998877', servico_id: 'service-pg',
      servico_nome: 'Corte PG', servico_preco: 55, profissional_id: 'professional-pg',
      profissional_nome: 'Profissional PG', data_hora: '2026-10-01T12:00:00Z', status: 'concluido',
      duracao_minutos: 30, valor: 55, observacoes: '',
    }] };
  };
  const sources = await loadBrainSources({ legacyEmpresaId: empresaId, empresaId, legacyLojaId: lojaId, commerceLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, [empresaId, lojaId, 5000]);
  assert.match(queries[0].sql, /a\.empresa_id = \$1 AND a\.loja_id = \$2/);
  assert.equal(sources.appointments[0].id, 'appointment-pg');
  assert.equal(sources.appointments[0].clienteTelefone, '556599998877');
  assert.equal(sources.appointments[0].servicoNome, 'Corte PG');
  assert.equal(sources.quality.fontes.appointments.fonte, 'postgres');
  assert.equal(sources.professionals[0].id, 'professional-pg');
});

test('sem vínculo assinado, legado não é consultado e agenda PostgreSQL é somente cobertura parcial', async () => {
  const d = deps(); const queries = [];
  d.agendaSource = async (scope, options) => {
    assert.deepEqual(scope, { legacyEmpresaId: '', legacyLojaId: undefined, empresaId, lojaId });
    assert.deepEqual(options, { strictStoreMapping: true });
    return 'postgres';
  };
  d.queryRead = async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; };
  for (const key of ['listarClientes', 'listarAgendamentos', 'listarComandasBarbearia', 'listarVendasRevenda', 'listarProdutosRevenda', 'listarServicos', 'listarProfissionais', 'obterConfiguracao']) {
    d[key] = () => { throw new Error(`${key} não deve ser consultado sem vínculo`); };
  }
  const sources = await loadBrainSources({
    legacyEmpresaId: 'legacy-other-company', legacyLojaId: 'legacy-other-store', legacyScopeVerified: false,
    empresaId, commerceLojaId: lojaId,
  }, d);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, [empresaId, lojaId, 5000]);
  assert.equal(sources.quality.fontes.appointments.status, 'limitado');
  assert.equal(sources.quality.fontes.appointments.fonte, 'postgres');
  assert.match(sources.quality.fontes.appointments.detail, /não foi associada sem vínculo assinado/);
  assert.equal(sources.quality.fontes.clients.status, 'indisponivel');
  assert.equal(sources.quality.fontes.produtosLocais.status, 'indisponivel');
  assert.equal(sources.quality.estoqueLocalEscopo, 'nao_mapeado');
  assert.equal(sources.identityClients.length, 0);
});

test('ID de cliente PostgreSQL sem correspondência usa telefone somente quando inequívoco', () => {
  const graph = buildCustomerGraph({
    clients: [{ id: 'legacy-client', nome: 'Ana', telefone: '556599991234' }],
    appointments: [{ clienteId: 'pg-client', clienteTelefone: '556599991234', status: 'concluido', dataHora: '2026-10-01T12:00:00Z', servicoNome: 'Corte' }],
  }, { now: new Date('2026-10-22T12:00:00Z') });
  assert.equal(graph.customers.size, 1);
  assert.equal([...graph.customers.values()][0].visits.length, 1);
});

test('catálogos não deduplicam produtos diferentes apenas pelo nome', async () => {
  const d = deps(); d.loadCatalog = async () => [{ id: 'p1', nome: 'Mesmo' }];
  d.agendaSource = async () => 'barbearia'; d.listarAgendamentos = () => [];
  d.listarProdutosRevenda = () => [{ id: 'p1', lojaId, nome: 'Mesmo' }];
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(sources.catalog.map(p => p.id), ['p1', 'local:p1']);
});

test('consultas parametrizam empresa e loja, compras confirmadas e origem dos fatos', async () => {
  const previous = db.queryRead; const calls = [];
  db.queryRead = async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; };
  try {
    await loadOrders(empresaId, lojaId); await loadCatalog(empresaId, lojaId); await loadActiveFacts(empresaId, lojaId);
    assert.deepEqual(calls.map(c => c.params.slice(0, 2)), Array.from({ length: 3 }, () => [empresaId, lojaId]));
    assert.ok(calls[0].params[2].includes('paid'));
    assert.ok(!calls[0].params[2].includes('pending_payment'));
    assert.match(calls[0].sql, /o.loja_id = \$2/);
    assert.match(calls[1].sql, /loc.loja_id = \$2/);
    assert.match(calls[1].sql, /pc.price_list_id = vp.price_list_id/);
    assert.match(calls[2].sql, /s.id = f.fonte_resumo_id AND s.loja_id = \$2/);
  } finally { db.queryRead = previous; }
});

test('helpers Commerce rejeitam chamada sem unidade antes de consultar SQL', async () => {
  const previous = db.queryRead; let calls = 0;
  db.queryRead = async () => { calls += 1; return { rows: [] }; };
  try {
    await assert.rejects(() => loadCatalog(empresaId), /Unidade Commerce é obrigatória/);
    await assert.rejects(() => loadOrders(empresaId), /Unidade Commerce é obrigatória/);
    await assert.rejects(() => loadActiveFacts(empresaId), /Unidade Commerce é obrigatória/);
    assert.equal(calls, 0);
  } finally { db.queryRead = previous; }
});
