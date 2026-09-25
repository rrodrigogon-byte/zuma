import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { registerCustomer360Routes, canExport, canReveal } from './customer360-routes.js';

function fakeDeps({ commerce = false, audits = [] } = {}) {
  const clientes = {
    'cli-1': { id: 'cli-1', empresaId: 'e1', nome: 'João Silva', telefone: '(65) 99336-0000', email: 'joao@email.com', cpfCnpj: '123.456.789-09', endereco: 'Rua A, 10', limiteCreditoMensal: 100, saldoDevedor: 0, consentimentos: {} },
    'cli-2': { id: 'cli-2', empresaId: 'e1', nome: 'Maria', telefone: '65 98888-1111' },
  };
  return {
    legacyEmpresaId: () => 'e1',
    legacyLojaId: () => '',
    clientesKytto: {
      listarClientes: () => Object.values(clientes),
      obterCliente: (_, id) => clientes[id] || null,
      listarContasReceber: () => [{ id: 'r1', clienteId: 'cli-1', status: 'pendente', valor: 40 }],
    },
    barbeariaErpKytto: {
      listarComandasBarbearia: () => [{ id: 'c1', clienteId: 'cli-1', status: 'paga', total: 75, totalPago: 75, atualizadoEm: '2026-09-01T10:00:00Z' }],
      listarVendasRevenda: () => [],
      listarAssinaturas: () => [],
      listarPlanos: () => [],
    },
    canaisFidelidadeKytto: { obterFidelidade: () => ({ membros: [{ id: 'f1', clienteId: 'cli-1', pontos: 75, nivel: 'bronze' }], movimentos: [] }) },
    listarAgendamentosBarbearia: () => [{ id: 'a1', clienteId: '', clienteTelefone: '65993360000', status: 'concluido', dataHora: '2026-09-01T10:00:00Z', valor: 45 }],
    requireCommercePermission: async () => { const error = new Error('x'); error.code = 'PERMISSION_DENIED'; throw error; },
    audit: (req, acao, detalhe) => audits.push({ acao, detalhe, user: req.user?.role }),
    save: () => {},
    commerceEnabled: () => commerce,
    customerStore: fakeStore(),
  };
}

function fakeStore() {
  const state = { links: [], separations: [], notes: [], tags: {}, anonymized: null };
  return {
    state,
    identityRules: () => ({ links: state.links, separations: state.separations }),
    linkRecords: (_, pair) => { state.separations = state.separations.filter((item) => !(item.a === pair.a && item.b === pair.b)); state.links.push({ a: pair.a, b: pair.b }); },
    separateRecords: (_, pair) => { state.links = state.links.filter((item) => !(item.a === pair.a && item.b === pair.b)); state.separations.push({ a: pair.a, b: pair.b }); },
    listNotes: (_, refs) => state.notes.filter((note) => note.refs.some((ref) => refs.includes(ref))),
    addNote: (_, { refs, texto, autor }) => { const note = { id: `n${state.notes.length + 1}`, refs, texto, autor, em: '2026-09-25T00:00:00Z' }; state.notes.push(note); return note; },
    removeNote: (_, { noteId }) => { state.notes = state.notes.filter((note) => note.id !== noteId); },
    listTags: (_, refs) => refs.flatMap((ref) => state.tags[ref] || []),
    setTags: (_, { canonicalRef, tags }) => { state.tags[canonicalRef] = tags.map((tag) => String(tag).toLowerCase()); return state.tags[canonicalRef]; },
    allTags: () => Object.values(state.tags).flat().map((tag) => ({ tag, total: 1 })),
    tagsByRef: () => state.tags,
    anonymizeLocalCustomer: (_, input) => { state.anonymized = input; return { clientes: input.clientIds.length }; },
  };
}

async function withServer(user, deps, run) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  registerCustomer360Routes(app, deps);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/admin/barbearia/clientes-360`;
  try { await run(base); } finally { server.close(); }
}

test('papéis: revelar para admin/organizador, exportar só admin', () => {
  assert.equal(canReveal({ role: 'admin' }), true);
  assert.equal(canReveal({ role: 'organizador' }), true);
  assert.equal(canReveal({ role: 'staff' }), false);
  assert.equal(canExport({ role: 'organizador' }), false);
  assert.equal(canExport({ role: 'staff', platformAdmin: true }), true);
});

test('busca, ficha mascarada com auditoria e loja degradada sem derrubar', async () => {
  const audits = [];
  await withServer({ id: 'u', nome: 'Ana', role: 'staff' }, fakeDeps({ commerce: true, audits }), async (base) => {
    const search = await (await fetch(`${base}?q=joao`)).json();
    assert.equal(search.total, 1);
    assert.equal(search.items[0].ref, 'dino:cli-1');
    assert.equal(search.items[0].telefone, '(65) •••••-0000');
    assert.deepEqual(search.fontes.loja, { disponivel: false, motivo: 'sem_permissao' });

    const response = await fetch(`${base}/dino:cli-1`);
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.perfil.nome, 'João Silva');
    assert.equal(profile.perfil.telefone, '(65) •••••-0000');
    assert.equal(profile.indicadores.visitas, 1, 'agendamento sem clienteId ligado pelo telefone');
    assert.equal(profile.indicadores.receitaBarbearia, 75);
    assert.equal(profile.indicadores.aReceber, 40);
    assert.equal(profile.indicadores.pontos, 75);
    assert.equal(profile.fontes.find((item) => item.fonte === 'pedidos').motivo, 'sem_permissao');
    assert.deepEqual(profile.permissoes, { revelar: false, exportar: false, gerenciar: false, anonimizar: false, verAcessos: false });
    assert.deepEqual(audits.map((item) => item.acao), ['VIEW CUSTOMER360']);

    assert.equal((await fetch(`${base}/dino:nao-existe`)).status, 404);
    assert.equal((await fetch(`${base}/..%2Fetc`)).status, 400);
    const forbidden = await fetch(`${base}/dino:cli-1/revelar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campo: 'telefone', motivo: 'ligar para cliente' }) });
    assert.equal(forbidden.status, 403);
    assert.equal((await fetch(`${base}/dino:cli-1/exportar`)).status, 403);
  });
});

test('revelar exige motivo, retorna o valor e audita; exportar entrega JSON completo', async () => {
  const audits = [];
  await withServer({ id: 'u', nome: 'Rodrigo', role: 'admin' }, fakeDeps({ audits }), async (base) => {
    const post = (body) => fetch(`${base}/dino:cli-1/revelar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ campo: 'telefone' })).status, 400);
    assert.equal((await post({ campo: 'senha', motivo: 'qualquer motivo' })).status, 400);
    const ok = await post({ campo: 'documento', motivo: 'emissão de nota fiscal' });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await ok.json(), { ok: true, campo: 'documento', valor: '123.456.789-09' });

    const exported = await fetch(`${base}/dino:cli-1/exportar`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /attachment; filename="titular-dino_cli-1\.json"/);
    const payload = await exported.json();
    assert.equal(payload.titular.telefone, '5565993360000');
    assert.equal(payload.titular.documento, '123.456.789-09');
    assert.equal(payload.registrosDeOrigem.barbearia[0].id, 'cli-1');
    assert.match(payload.documento, /LGPD/);
    assert.deepEqual(audits.map((item) => item.acao), ['REVEAL CUSTOMER360', 'EXPORT CUSTOMER360']);
    assert.match(audits[0].detalhe, /campo=documento; motivo=emissão de nota fiscal/);
  });
});

test('carteira, duplicados, vínculos, notas, etiquetas e anonimização pela API', async () => {
  const audits = [];
  const deps = fakeDeps({ audits });
  const storeState = deps.customerStore.state;
  await withServer({ id: 'u', nome: 'Rodrigo', role: 'admin' }, deps, async (base) => {
    const json = (method, path, body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const carteira = await (await fetch(`${base}/carteira?ordem=valor`)).json();
    assert.equal(carteira.resumo.clientes, 2);
    assert.equal(carteira.items[0].ref, 'dino:cli-1');
    assert.equal(carteira.items[0].metricas.valorVitalicio, 75);
    assert.equal(carteira.items[0].metricas.visitas, 1);
    assert.equal((await (await fetch(`${base}/carteira?segmento=inativo`)).json()).total, 0);

    const duplicados = await (await fetch(`${base}/duplicados`)).json();
    assert.equal(duplicados.podeGerenciar, true);

    assert.equal((await json('POST', '/vinculos', { a: 'dino:cli-1', b: 'dino:cli-1' })).status, 400);
    assert.equal((await json('POST', '/vinculos', { a: 'dino:cli-1', b: 'dino:cli-2', motivo: 'mesma pessoa' })).status, 200);
    const linked = await (await fetch(`${base}/dino:cli-2`)).json();
    assert.deepEqual(linked.registros.map((item) => item.ref).sort(), ['dino:cli-1', 'dino:cli-2']);
    assert.ok(linked.identidade.vinculadoPor.includes('vínculo manual'));
    assert.equal((await json('POST', '/separacoes', { a: 'dino:cli-1', b: 'dino:cli-2' })).status, 200);
    assert.deepEqual(storeState.separations, [{ a: 'dino:cli-1', b: 'dino:cli-2' }]);

    const nota = await json('POST', '/dino:cli-1/notas', { texto: 'Cliente prefere o Dino' });
    assert.equal(nota.status, 201);
    const etiquetas = await (await json('PUT', '/dino:cli-1/etiquetas', { etiquetas: ['VIP'] })).json();
    assert.deepEqual(etiquetas.etiquetas, ['vip']);
    const profile = await (await fetch(`${base}/dino:cli-1`)).json();
    assert.equal(profile.notas[0].texto, 'Cliente prefere o Dino');
    assert.deepEqual(profile.etiquetas, ['vip']);
    assert.equal(profile.clienteBarbeariaId, 'cli-1');
    assert.equal(profile.permissoes.anonimizar, true);
    assert.equal((await json('DELETE', `/dino:cli-1/notas/${profile.notas[0].id}`)).status, 200);

    const acessos = await (await fetch(`${base}/dino:cli-1/acessos`)).json();
    assert.equal(acessos.fonte, 'auditoria_local');

    assert.equal((await json('POST', '/dino:cli-1/anonimizar', { confirmacao: 'sim', motivo: 'pedido do titular por e-mail' })).status, 400);
    assert.equal((await json('POST', '/dino:cli-1/anonimizar', { confirmacao: 'ANONIMIZAR', motivo: 'curto' })).status, 400);
    const anon = await json('POST', '/dino:cli-1/anonimizar', { confirmacao: 'ANONIMIZAR', motivo: 'pedido do titular protocolo 123' });
    assert.equal(anon.status, 200);
    assert.deepEqual(storeState.anonymized.clientIds, ['cli-1']);
    assert.match((await anon.json()).preservado, /obrigação legal/);
    assert.ok(audits.some((item) => item.acao === 'ANONYMIZE CUSTOMER360'));
  });
});

test('staff não unifica, não vê acessos e não anonimiza', async () => {
  await withServer({ id: 'u', nome: 'Ana', role: 'staff' }, fakeDeps(), async (base) => {
    const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/vinculos', { a: 'dino:cli-1', b: 'dino:cli-2' })).status, 403);
    assert.equal((await fetch(`${base}/dino:cli-1/acessos`)).status, 403);
    assert.equal((await post('/dino:cli-1/anonimizar', { confirmacao: 'ANONIMIZAR', motivo: 'pedido do titular protocolo 123' })).status, 403);
    assert.equal((await post('/dino:cli-1/notas', { texto: 'staff pode anotar' })).status, 201);
  });
});

test('anonimização recusa quando há cadastro na loja e a sessão não pode alterá-lo', async () => {
  const deps = fakeDeps({ commerce: true });
  deps.requireCommercePermission = async (_req, permission) => {
    if (permission === 'customers.read') return { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: null, usuarioId: 'u' };
    const error = new Error('x'); error.code = 'PERMISSION_DENIED'; throw error;
  };
  const core = await import('./core/customer-360.js');
  const { db } = await import('./core/database.js');
  const original = db.queryRead;
  db.queryRead = async (sql) => (sql.includes('FROM commerce_customers') ? { rows: [{ id: '33333333-3333-4333-8333-333333333333', nome: 'João', telefone: '65993360000' }] } : { rows: [] });
  try {
    await withServer({ id: 'u', nome: 'Rodrigo', role: 'admin' }, deps, async (base) => {
      const res = await fetch(`${base}/dino:cli-1/anonimizar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmacao: 'ANONIMIZAR', motivo: 'pedido do titular protocolo 123' }) });
      assert.equal(res.status, 409);
      assert.equal(deps.customerStore.state.anonymized, null, 'nada foi anonimizado');
    });
  } finally { db.queryRead = original; }
  assert.ok(core);
});
