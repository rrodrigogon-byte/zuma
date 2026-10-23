import assert from 'node:assert/strict';
import test from 'node:test';
import { automationGuards, automationResults, enqueueAutomations, markAutomationTaskBlocked, planAutomations, processAutomationTask, quietHours, renderMessage, runAutomationRound, variantFor } from './ai-automations.js';
import { buildCustomerGraph } from '../dino-grafo.js';
import { db } from './database.js';

const NOW = new Date('2026-09-28T15:00:00Z'); // 11h em Cuiabá
const d = (days) => new Date(NOW.valueOf() - days * 86400000).toISOString();
const h = (hours) => new Date(NOW.valueOf() - hours * 3600000).toISOString();
const consent = (marketing) => ({ whatsapp: { atendimento: { concedido: true }, marketing: { concedido: marketing } } });
const ALL_ON = { ativo: true, autonomia: 1, automacoes: { reativacao: true, pos_atendimento: true, aniversario: true, aviso_estoque: true } };
const identityQuality = () => ({ fontes: Object.fromEntries(['clients', 'appointments', 'commands', 'retailSales', 'pedidos'].map((name) => [name, { status: 'ok' }])) });
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const STORE_ID = '22222222-2222-4222-8222-222222222222';

function scenario() {
  const clients = [
    { id: 'a', nome: 'Ana Souza', telefone: '65999990001', consentimentos: consent(true) },
    { id: 'b', nome: 'Beto', telefone: '65999990002', consentimentos: consent(false) },
    { id: 'c', nome: 'Caio', telefone: '65999990003', consentimentos: consent(true), dataNascimento: '1995-10-01' },
    { id: 'e', nome: 'Edu', telefone: '65999990005', consentimentos: consent(true) },
  ];
  const cmd = (clienteId, at, profissionalId = 'p1') => ({ id: `${clienteId}-${at}`, clienteId, status: 'paga', fechadaEm: at, profissionalId, itens: [{ tipo: 'servico', nome: 'Corte Masculino', subtotal: 45 }] });
  const commands = [
    cmd('a', d(110)), cmd('a', d(80)), cmd('a', d(50)), // habitual 30, sem vir há 50 → reativação
    cmd('b', d(110)), cmd('b', d(80)), cmd('b', d(50)), // sem consentimento de marketing
    cmd('c', h(5)), // pós-atendimento (e aniversário em 3 dias)
    cmd('e', d(40)),
  ];
  const sources = {
    clients, commands, professionals: [{ id: 'p1', nome: 'Bruno' }],
    catalog: [{ id: 'x1', nome: 'Lattafa Asad', preco: 350, estoque: 2 }],
    facts: [{ telefone: '5565999990005', categoria: 'produto_interesse', valor: 'Lattafa Asad', status: 'ativo' }],
    configuracao: { nomePublico: 'Barbearia Dino' },
    quality: identityQuality(),
  };
  return { sources, graph: buildCustomerGraph(sources, { now: NOW }) };
}

test('todos os guards consultam log da unidade ativa e falham sem loja válida', async () => {
  const calls = [];
  const guards = await automationGuards(COMPANY_ID, STORE_ID, {
    now: NOW,
    queryRead: async (sql, params) => {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ total: 3 }] };
      if (/SELECT automacao, telefone, referencia/.test(sql)) return { rows: [{ automacao: 'reativacao', telefone: '5565999990001', referencia: 'ref-1' }] };
      return { rows: [{ telefone: '5565999990001', ultimo: NOW.toISOString() }] };
    },
  });
  assert.equal(calls.length, 4);
  for (const { sql, params } of calls) {
    assert.match(sql, /empresa_id = \$1 AND loja_id = \$2/);
    assert.deepEqual(params.slice(0, 2), [COMPANY_ID, STORE_ID]);
  }
  const refsQuery = calls.find(({ sql }) => /SELECT automacao, telefone, referencia/.test(sql));
  assert.match(refsQuery.sql, /status IN \('enfileirada','enviada','falhou'\)/);
  assert.equal(guards.sentToday, 3);
  assert.ok(guards.recentMarketing.has('5565999990001'));
  assert.ok(guards.recentAny.has('5565999990001'));
  assert.ok(guards.sentRefs.has('reativacao|5565999990001|ref-1'));
  let queried = false;
  await assert.rejects(automationGuards(COMPANY_ID, null, { queryRead: async () => { queried = true; return { rows: [] }; } }), { code: 'STORE_SCOPE_REQUIRED' });
  assert.equal(queried, false);
});

test('runAutomationRound transmite unidade ativa aos guards e reporta cobertura de identidade', async () => {
  const { graph, sources } = scenario();
  const calls = [];
  const result = await runAutomationRound({
    empresaId: COMPANY_ID, lojaId: STORE_ID, loadGraph: async () => ({ graph, sources }), now: NOW, dryRun: true,
    getSettings: async () => ALL_ON,
    loadGuards: async (empresaId, lojaId) => {
      calls.push([empresaId, lojaId]);
      return { recentMarketing: new Map(), recentAny: new Map(), sentRefs: new Set(), sentToday: 2, quiet: false };
    },
  });
  assert.deepEqual(calls, [[COMPANY_ID, STORE_ID]]);
  assert.equal(result.identityCoverage.status, 'ok');
  assert.equal(result.guards.sentToday, 2);
});

test('planeja cada automação só para quem pode receber', () => {
  const { graph, sources } = scenario();
  const planned = planAutomations({ graph, sources, settings: ALL_ON, now: NOW });
  const by = Object.fromEntries(planned.map((p) => [p.cliente, p]));
  assert.equal(by['Ana Souza'].automacao, 'reativacao');
  assert.match(by['Ana Souza'].mensagem, /Oi, Ana!.*Bruno/s);
  assert.match(by['Ana Souza'].mensagem, /responda SAIR/);
  assert.equal(by.Beto, undefined, 'sem consentimento de marketing, nada de reativação');
  assert.equal(by.Caio.automacao, 'pos_atendimento', 'uma por cliente, pós-atendimento tem prioridade');
  assert.equal(by.Edu.automacao, 'aviso_estoque');
  assert.match(by.Edu.mensagem, /Lattafa Asad/);
});

test('respeita automações desligadas, envio repetido e intervalo de 14 dias', () => {
  const { graph, sources } = scenario();
  const onlyReactivation = { ...ALL_ON, automacoes: { reativacao: true } };
  const planned = planAutomations({ graph, sources, settings: onlyReactivation, now: NOW });
  assert.deepEqual(planned.map((p) => p.cliente), ['Ana Souza']);
  const again = planAutomations({ graph, sources, settings: onlyReactivation, now: NOW, sentRefs: new Set([`reativacao|${planned[0].telefone}|${planned[0].referencia}`]) });
  assert.equal(again.length, 0);
  const cooldown = planAutomations({ graph, sources, settings: onlyReactivation, now: NOW, recentMarketing: new Map([[planned[0].telefone, NOW.valueOf() - 3 * 86400000]]) });
  assert.equal(cooldown.length, 0);
});

test('cobertura de identidade ausente ou parcial bloqueia toda automação', () => {
  const { sources } = scenario();
  for (const name of ['clients', 'appointments', 'commands', 'retailSales', 'pedidos']) {
    const incomplete = { ...sources, quality: identityQuality() };
    incomplete.quality.fontes[name].status = 'limitado';
    const graph = buildCustomerGraph(incomplete, { now: NOW });
    assert.deepEqual(planAutomations({ graph, sources: incomplete, settings: ALL_ON, now: NOW }), [], `${name} parcial`);
  }
  const missing = { ...sources };
  delete missing.quality;
  const graph = buildCustomerGraph(missing, { now: NOW });
  assert.deepEqual(planAutomations({ graph, sources: missing, settings: ALL_ON, now: NOW }), []);
});

test('horário silencioso das 21h às 8h de Cuiabá', () => {
  assert.equal(quietHours(new Date('2026-09-28T15:00:00Z')), false); // 11h
  assert.equal(quietHours(new Date('2026-09-29T01:30:00Z')), true); // 21h30
  assert.equal(quietHours(new Date('2026-09-28T11:30:00Z')), true); // 7h30
});

test('variante B só existe no nível 3 e é estável por telefone', () => {
  assert.equal(variantFor('5565999990001', 1), 'A');
  const v = variantFor('5565999990001', 3);
  assert.equal(variantFor('5565999990001', 3), v);
  assert.notEqual(renderMessage('reativacao', 'A', { nome: 'Ana' }), renderMessage('reativacao', 'B', { nome: 'Ana' }));
});

test('resultado mede volta em até 14 dias por variante', () => {
  const { graph } = scenario();
  const phone = '5565999990001';
  const rows = [
    { automacao: 'reativacao', telefone: phone, status: 'enviada', motivo: 'variante A', criado_em: d(60) },
    { automacao: 'campanha', telefone: phone, status: 'enviada', motivo: 'marketing', criado_em: d(60) },
  ];
  const [r] = automationResults(rows, graph);
  assert.equal(automationResults(rows, graph).length, 1, 'campanha não aparece como resultado do Cérebro');
  assert.equal(r.enviadas, 1);
  assert.equal(r.voltaram, 1, 'voltou 10 dias depois');
});

test('oferta individual só sai com score ≥ 0,60, produto em estoque e consentimento', () => {
  const clients = [
    { id: 'x', nome: 'Xande', telefone: '65999990010', consentimentos: consent(true) },
    { id: 'y', nome: 'Yuri', telefone: '65999990011', consentimentos: consent(true) },
    { id: 'z', nome: 'Zeca', telefone: '65999990012', consentimentos: consent(true) },
  ]
  const corte = { tipo: 'servico', nome: 'Corte Masculino', subtotal: 45 }
  const cmd = (id, clienteId, at, extra = []) => ({ id, clienteId, status: 'paga', fechadaEm: at, profissionalId: 'p1', itens: [corte, ...extra] })
  const perfume = { tipo: 'produto', nome: 'Armaf Club de Nuit Intense', subtotal: 449 }
  const commands = [cmd('1', 'x', d(90)), cmd('2', 'x', d(60)), cmd('3', 'x', d(30)), cmd('4', 'y', d(10), [perfume]), cmd('5', 'z', d(12), [perfume])]
  const sources = {
    clients, commands, professionals: [{ id: 'p1', nome: 'Bruno' }],
    catalog: [{ id: 'arm', nome: 'Armaf Club de Nuit Intense', preco: 449, custo: 200, estoque: 5 }],
    facts: [{ telefone: '5565999990010', categoria: 'produto_interesse', valor: 'Armaf Club de Nuit', status: 'ativo' }],
    quality: identityQuality(),
  }
  const graph = buildCustomerGraph(sources, { now: NOW })
  const planned = planAutomations({ graph, sources, settings: { ...ALL_ON, automacoes: { oferta_individual: true } }, now: NOW })
  assert.equal(planned.length, 1)
  assert.equal(planned[0].cliente, 'Xande')
  assert.match(planned[0].mensagem, /Armaf Club de Nuit Intense \(R\$\s?449,00\)/)
  const semEstoque = { ...sources, catalog: [{ ...sources.catalog[0], estoque: 0 }] }
  assert.equal(planAutomations({ graph: buildCustomerGraph(semEstoque, { now: NOW }), sources: semEstoque, settings: { ...ALL_ON, automacoes: { oferta_individual: true } }, now: NOW }).length, 0)
})

test('no máximo uma mensagem automática por cliente a cada 24 h, qualquer que seja', () => {
  const { graph, sources } = scenario()
  const all = planAutomations({ graph, sources, settings: ALL_ON, now: NOW })
  const edu = all.find((p) => p.cliente === 'Edu')
  const again = planAutomations({ graph, sources, settings: ALL_ON, now: NOW, recentAny: new Map([[edu.telefone, NOW.valueOf() - 3600000]]) })
  assert.ok(!again.some((p) => p.cliente === 'Edu'))
})

test('consentimento no envio fecha em segurança', async () => {
  const { sendTimeConsent } = await import('./ai-automations.js')
  const E = '11111111-1111-4111-8111-111111111111'
  const phone = '5565999990001'
  const local = [{ telefone: '65999990001', consentimentos: consent(true) }]
  assert.equal((await sendTimeConsent(E, phone, 'marketing', { consentMap: async () => { throw new Error('db') }, localClients: local })).ok, false)
  assert.equal((await sendTimeConsent(E, phone, 'marketing', { consentMap: async () => new Map(), localClients: local })).ok, true)
  assert.equal((await sendTimeConsent(E, phone, 'marketing', { consentMap: async () => new Map([[phone, { marketing: false }]]), localClients: local })).ok, false, 'revogação no CRM vence')
  assert.equal((await sendTimeConsent(E, phone, 'atendimento', { consentMap: async () => new Map([[phone, { optOut: true }]]), localClients: local })).reason, 'opt_out')
  assert.equal((await sendTimeConsent(E, phone, 'marketing', { consentMap: async () => new Map(), localClients: [] })).ok, false)
})


test('revalidação no envio recusa telefones duplicados e titulares anonimizados', async () => {
  const { sendTimeConsent } = await import('./ai-automations.js');
  const phone = '5565999990001';
  const consentMap = async () => new Map([[phone, { marketing: true }]]);
  const client = { id: 'a', telefone: phone, consentimentos: consent(true) };
  const duplicate = await sendTimeConsent('empresa', phone, 'marketing', { consentMap, localClients: [client, { ...client, id: 'b' }] });
  assert.deepEqual(duplicate, { ok: false, reason: 'identidade_ambigua' });
  const anonymous = await sendTimeConsent('empresa', phone, 'marketing', { consentMap, localClients: [{ ...client, anonimizadoEm: d(1) }] });
  assert.deepEqual(anonymous, { ok: false, reason: 'cliente_anonimizado' });
});

test('quota diária é recalculada sob lock por empresa+unidade antes de enfileirar', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('SELECT COUNT(*)::int AS total FROM ai_automation_log')) return { rows: [{ total: 59 }] };
    if (sql.includes('SELECT id FROM canais_integracao')) return { rows: [{ id: 'channel' }] };
    if (sql.includes('INSERT INTO ai_automation_log')) return { rows: [{ id: 'log' }] };
    if (sql.includes('INSERT INTO tarefas_integracao_canais')) return { rows: [{ id: 'task' }] };
    throw new Error(`SQL inesperado: ${sql}`);
  } });
  const planned = [
    { telefone: '5565999990001', automacao: 'reativacao', referencia: 'r1', mensagem: 'Oi', variante: 'A' },
    { telefone: '5565999990002', automacao: 'reativacao', referencia: 'r2', mensagem: 'Oi', variante: 'A' },
  ];
  try {
    const result = await enqueueAutomations(COMPANY_ID, STORE_ID, planned, { sentToday: 0 });
    assert.deepEqual(result, { queued: 1, blocked: 1, reason: 'teto_diario_parcial' });
    const lockIndex = calls.findIndex(call => call.sql.includes('pg_advisory_xact_lock'));
    const countIndex = calls.findIndex(call => call.sql.includes('SELECT COUNT(*)::int AS total FROM ai_automation_log'));
    assert.ok(lockIndex >= 0 && countIndex > lockIndex, 'serializa antes de ler quota');
    assert.match(calls[lockIndex].sql, /hashtextextended/);
    assert.match(calls[countIndex].sql, /empresa_id = \$1 AND loja_id = \$2/);
    assert.deepEqual(calls[countIndex].params, [COMPANY_ID, STORE_ID]);
    assert.match(calls[countIndex].sql, /AT TIME ZONE/);
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO tarefas_integracao_canais')).length, 1);
  } finally { db.transaction = original; }
});

test('task duplicada não conta como enfileiramento e remove apenas log recém-criado', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('SELECT COUNT(*)::int AS total FROM ai_automation_log')) return { rows: [{ total: 0 }] };
    if (sql.includes('SELECT id FROM canais_integracao')) return { rows: [{ id: 'channel' }] };
    if (sql.includes('INSERT INTO ai_automation_log')) return { rows: [{ id: 'new-log' }] };
    if (sql.includes('INSERT INTO tarefas_integracao_canais')) return { rows: [] };
    if (sql.includes('DELETE FROM ai_automation_log')) return { rows: [], rowCount: 1 };
    throw new Error(`SQL inesperado: ${sql}`);
  } });
  try {
    const item = { telefone: '5565999990001', automacao: 'reativacao', referencia: 'r1', mensagem: 'Oi', variante: 'A' };
    const result = await enqueueAutomations(COMPANY_ID, STORE_ID, [item]);
    assert.deepEqual(result, { queued: 0, blocked: 1, reason: 'duplicado' });
    const cleanup = calls.find(call => call.sql.includes('DELETE FROM ai_automation_log'));
    assert.deepEqual(cleanup.params, ['new-log', COMPANY_ID, STORE_ID]);
  } finally { db.transaction = original; }
});

test('skip da automação atualiza somente log enfileirado da empresa+loja e registra motivo sanitizado', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: '33333333-3333-4333-8333-333333333333' }], rowCount: 1 };
  };
  const task = { empresa_id: COMPANY_ID, loja_id: STORE_ID, payload: { logId: '33333333-3333-4333-8333-333333333333' } };
  try {
    assert.deepEqual(await markAutomationTaskBlocked(task, 'cliente_pediu_sair'), { blocked: true });
    assert.match(calls[0].sql, /status = 'bloqueada'/);
    assert.match(calls[0].sql, /empresa_id = \$2 AND loja_id = \$3 AND status = 'enfileirada'/);
    assert.deepEqual(calls[0].params, [task.payload.logId, COMPANY_ID, STORE_ID, 'cliente_pediu_sair']);
  } finally { db.query = original; }
});

test('retry após crash lê status do log: enviado é idempotente e reserva iniciada fica incerta', async () => {
  const original = db.query;
  const task = {
    empresa_id: COMPANY_ID, loja_id: STORE_ID, delivery_started_at: NOW.toISOString(),
    payload: { logId: '33333333-3333-4333-8333-333333333333', automacao: 'reativacao', telefone: '5565999990001', variante: 'A' },
  };
  let status = 'enviada';
  db.query = async () => ({ rows: [{ status, automacao: 'reativacao', telefone: '5565999990001' }] });
  try {
    assert.deepEqual(await processAutomationTask(task), { sent: true, idempotent: true, automacao: 'reativacao', variante: 'A' });
    status = 'enfileirada';
    await assert.rejects(processAutomationTask(task), { code: 'AUTOMATION_DELIVERY_UNKNOWN' });
  } finally { db.query = original; }
});
