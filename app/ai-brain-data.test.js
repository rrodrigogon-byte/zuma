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
  d.listarAgendamentos = (id, filters) => { assert.equal(filters.lojaId, lojaId); return [{ id: 'unscoped-appointment', clienteId: 'b', status: 'concluido', dataHora: '2026-10-01T10:00:00Z' }]; };
  d.listarClientes = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  d.listarComandasBarbearia = (id, filters) => { assert.equal(filters.lojaId, lojaId); return [{ clienteId: 'a', lojaId }, { clienteId: 'b' }, { clienteId: 'c', lojaId: 'other' }]; };
  const s = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [empresaId, lojaId]));
  assert.deepEqual(s.clients.map(c => c.id), ['a']);
  assert.equal(s.commands.length, 1);
  assert.deepEqual(s.identityClients.map((client) => client.id), ['a'], 'cadastros de outras lojas não participam da identidade desta unidade');
  assert.equal(s.quality.fontes.appointments.status, 'limitado');
  assert.match(s.quality.fontes.appointments.detail, /foram descartados; cobertura parcial/);
  assert.equal(s.quality.fontes.commands.status, 'limitado');
});

test('fontes legadas aplicam limites de linhas antes de construir o grafo', async () => {
  const d = deps();
  d.agendaSource = async () => 'barbearia';
  const recente = new Date(Date.now() - 10 * 86400000).toISOString();
  d.listarAgendamentos = () => Array.from({ length: 20001 }, (_, index) => ({ id: `appointment-${index}`, lojaId, status: 'cancelado', dataHora: recente }));
  d.listarComandasBarbearia = () => Array.from({ length: 5001 }, (_, index) => ({ id: `command-${index}`, lojaId, status: 'rascunho' }));
  d.listarVendasRevenda = () => Array.from({ length: 5001 }, (_, index) => ({ id: `sale-${index}`, lojaId, status: 'cancelado' }));
  d.listarProdutosRevenda = () => Array.from({ length: 2001 }, (_, index) => ({ id: `product-${index}`, lojaId, nome: `Produto ${index}`, estoqueAtual: 1 }));
  d.listarServicos = () => Array.from({ length: 1001 }, (_, index) => ({ id: `service-${index}`, nome: `Serviço ${index}`, ativo: true }));
  d.listarProfissionais = () => Array.from({ length: 1001 }, (_, index) => ({ id: `professional-${index}`, nome: `Profissional ${index}`, ativo: true }));
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.equal(sources.appointments.length, 20000);
  assert.equal(sources.commands.length, 5000);
  assert.equal(sources.retailSales.length, 5000);
  assert.equal(sources.catalog.filter((item) => item.id.startsWith('local:')).length, 2000);
  assert.equal(sources.quality.fontes.appointments.status, 'limitado');
  assert.equal(sources.quality.fontes.commands.status, 'limitado');
  assert.equal(sources.quality.fontes.retailSales.status, 'limitado');
  assert.equal(sources.quality.fontes.produtosLocais.status, 'limitado');
  assert.equal(sources.quality.fontes.services.status, 'limitado');
  assert.equal(sources.quality.fontes.professionals.status, 'limitado');
});

test('agenda local entra na janela do grafo (400 dias para trás e todo o futuro) e não passa do limite', async () => {
  const d = deps();
  d.agendaSource = async () => 'barbearia';
  const dia = 86400000; const agora = Date.now();
  d.listarAgendamentos = () => [
    ...Array.from({ length: 6000 }, (_, index) => ({ id: `antigo-${index}`, lojaId, status: 'concluido', dataHora: new Date(agora - 500 * dia).toISOString() })),
    { id: 'recente', lojaId, status: 'concluido', dataHora: new Date(agora - 30 * dia).toISOString() },
    { id: 'futuro', lojaId, status: 'agendado', dataHora: new Date(agora + 30 * dia).toISOString() },
  ];
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(sources.appointments.map((item) => item.id).sort(), ['futuro', 'recente']);
  assert.equal(sources.quality.fontes.appointments.status, 'ok');
});

test('revenda local é carregada somente para a loja legada explicitamente vinculada', async () => {
  const d = deps(); const calls = [];
  d.agendaSource = async () => 'barbearia';
  d.listarAgendamentos = () => [];
  d.listarProdutosRevenda = (company, filters) => {
    calls.push([company, filters]);
    return [
      { id: 'store-product', lojaId, nome: 'Pomada', estoqueAtual: 2, estoqueMinimo: 5 },
      { id: 'bad-stock', lojaId, nome: 'Saldo corrompido', estoqueAtual: 'abc', estoqueMinimo: 'NaN' },
      { id: 'other-product', lojaId: 'another-store', nome: 'Cera', estoqueAtual: 8 },
      { id: 'unscoped-product', nome: 'Avulso', estoqueAtual: 4 },
    ];
  };
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.deepEqual(calls, [[empresaId, { incluirInativos: false, lojaId, incluirSemLoja: true }]]);
  assert.deepEqual(sources.catalog.map((item) => item.id), ['local:store-product', 'local:bad-stock']);
  assert.equal(sources.catalog[0].estoqueMinimo, 5);
  assert.equal(sources.catalog[1].estoque, null);
  assert.equal(sources.catalog[1].estoqueMinimo, null);
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
  assert.deepEqual(queries[0].params, [empresaId, lojaId, 20000]);
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
  assert.deepEqual(queries[0].params, [empresaId, lojaId, 20000]);
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

test('produto publicado sem nível Commerce continua com saldo desconhecido e catálogo parcial', async () => {
  const d = deps();
  d.loadCatalog = async () => [{ id: 'p1', nome: 'Pomada', publicado: true, estoque: null, estoque_informado: false }];
  d.agendaSource = async () => 'postgres';
  d.queryRead = async () => ({ rows: [] });
  const sources = await loadBrainSources({ empresaId, legacyEmpresaId: empresaId, commerceLojaId: lojaId, legacyLojaId: lojaId, legacyScopeVerified: true }, d);
  assert.equal(sources.catalog[0].estoque, null);
  assert.equal(sources.quality.fontes.catalogo.status, 'limitado');
  assert.match(sources.quality.fontes.catalogo.detail, /não foram presumidos como zero/);
});

test('consultas parametrizam empresa e loja, compras confirmadas e origem dos fatos', async () => {
  const previous = db.queryRead; const calls = [];
  db.queryRead = async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; };
  try {
    await loadOrders(empresaId, lojaId); await loadCatalog(empresaId, lojaId); await loadActiveFacts(empresaId, lojaId);
    assert.deepEqual(calls.map(c => c.params.slice(0, 2)), Array.from({ length: 3 }, () => [empresaId, lojaId]));
    assert.ok(calls[0].params[2].includes('paid'));
    assert.ok(!calls[0].params[2].includes('pending_payment'));
    assert.match(calls[0].sql, /o\.loja_id = \$2/);
    assert.match(calls[0].sql, /o\.criado_em < CURRENT_TIMESTAMP/);
    assert.match(calls[1].sql, /loc.loja_id = \$2/);
    assert.match(calls[1].sql, /COUNT\(DISTINCT \(il\.variant_id::text \|\| ':' \|\| il\.location_id::text\)\)::int AS niveis/);
    assert.match(calls[1].sql, /niveis_esperados/);
    assert.match(calls[1].sql, /COUNT\(DISTINCT \(il\.variant_id::text \|\| ':' \|\| il\.location_id::text\)\) = COUNT\(DISTINCT iv\.id\) \* COUNT\(DISTINCT loc\.id\)/);
    assert.match(calls[1].sql, /pc.price_list_id = vp.price_list_id/);
    assert.match(calls[2].sql, /s.id = f.fonte_resumo_id AND s.loja_id = \$2/);
    for (const call of calls) assert.doesNotMatch(call.sql, /\$2::uuid IS NULL/);
  } finally { db.queryRead = previous; }
});

test('loadCatalog preserva null quando não existe nível de estoque Commerce', async () => {
  const previous = db.queryRead; let sql = '';
  db.queryRead = async (query, params) => {
    sql = query;
    assert.deepEqual(params, [empresaId, lojaId]);
    return { rows: [{ id: 'p1', nome: 'Pomada', publicado: true, estoque: null, estoque_informado: false }] };
  };
  try {
    const rows = await loadCatalog(empresaId, lojaId);
    assert.equal(rows[0].estoque, null);
    assert.equal(rows[0].estoque_informado, false);
    assert.match(sql, /CASE WHEN COUNT\(DISTINCT iv\.id\) > 0 AND COUNT\(DISTINCT loc\.id\) > 0/);
    assert.match(sql, /COUNT\(DISTINCT \(il\.variant_id::text \|\| ':' \|\| il\.location_id::text\)\) = COUNT\(DISTINCT iv\.id\) \* COUNT\(DISTINCT loc\.id\)/);
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
