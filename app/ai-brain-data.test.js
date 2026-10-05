import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBrainGraph, loadBrainSources, loadOrders, loadCatalog, loadActiveFacts } from './ai-brain-data.js';
import { db } from './core/database.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const deps = () => ({ loadCatalog: async () => [], loadOrders: async () => [], loadActiveFacts: async () => [], loadConsents: async () => new Map(),
  listarClientes: () => [], listarAgendamentos: () => [], listarComandasBarbearia: () => [], listarVendasRevenda: () => [],
  listarProdutosRevenda: () => [], listarServicos: () => [], listarProfissionais: () => [], obterConfiguracao: () => ({}) });

test('fontes vazias e falhas têm estados distintos e não expõem mensagens internas', async () => {
  const d = deps(); d.loadOrders = async () => { throw new Error('secret database details'); };
  const { sources, graph } = await loadBrainGraph({ empresaId }, d);
  assert.deepEqual(sources.quality.fontes.pedidos, { status: 'indisponivel', registros: null });
  assert.deepEqual(sources.quality.fontes.catalogo, { status: 'ok', registros: 0 });
  assert.equal(graph.quality.fontes.pedidos.status, 'indisponivel');
  assert.ok(!JSON.stringify(sources).includes('secret'));
});

test('limite de leitura é cobertura parcial, não base completa', async () => {
  const d = deps(); d.loadCatalog = async () => Array.from({ length: 2000 }, (_, i) => ({ id: String(i), nome: 'P' }));
  const s = await loadBrainSources({ empresaId }, d);
  assert.equal(s.quality.fontes.catalogo.status, 'limitado');
});

test('loja selecionada é enviada ao SQL e ao legado; registros sem loja são excluídos', async () => {
  const d = deps(); const calls = [];
  for (const key of ['loadOrders', 'loadCatalog', 'loadActiveFacts']) d[key] = async (...args) => { calls.push(args); return []; };
  d.listarClientes = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  d.listarComandasBarbearia = (id, filters) => { assert.equal(filters.lojaId, 'legacy-store'); return [{ clienteId: 'a', lojaId: 'legacy-store' }, { clienteId: 'b' }, { clienteId: 'c', lojaId: 'other' }]; };
  const s = await loadBrainSources({ empresaId, commerceLojaId: lojaId, legacyLojaId: 'legacy-store' }, d);
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [empresaId, lojaId]));
  assert.deepEqual(s.clients.map(c => c.id), ['a']);
  assert.equal(s.commands.length, 1);
  assert.equal(s.identityClients.length, 3, 'detecta colisões mesmo em cadastros fora da loja');
});

test('catálogos não deduplicam produtos diferentes apenas pelo nome', async () => {
  const d = deps(); d.loadCatalog = async () => [{ id: 'p1', nome: 'Mesmo' }]; d.listarProdutosRevenda = () => [{ id: 'p1', nome: 'Mesmo' }];
  assert.deepEqual((await loadBrainSources({ empresaId }, d)).catalog.map(p => p.id), ['p1', 'local:p1']);
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
