import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import {
  buildIdentityGraph, customerSegment,
  auditCustomerAccess, buildCustomer360, buildRef, loadCommerceDirectory, loadCommerceFacets, maskDocument, maskEmail, maskPhone,
  mergeCustomerDirectory, normalizePhone, parseRef, resolveIdentity, revealField, safeInet, searchCustomerDirectory,
} from './customer-360.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';

const localClients = [
  { id: 'cli-1', nome: 'João Silva', telefone: '(65) 99336-0000', email: 'Joao@Email.com', cpfCnpj: '123.456.789-09', endereco: 'Rua A, 10', limiteCreditoMensal: 300, saldoDevedor: 80, diasVencimento: 30,
    consentimentos: { whatsapp: { atendimento: { concedido: true, atualizadoEm: '2026-09-01T10:00:00Z' }, marketing: { concedido: false } }, email: { atendimento: { concedido: false }, marketing: { concedido: false } } }, criadoEm: '2026-01-10T10:00:00Z' },
  { id: 'cli-2', nome: 'Maria Souza', telefone: '65 98888-1111', email: '', criadoEm: '2026-02-01T10:00:00Z' },
];
const commerceCustomers = [
  { id: CUSTOMER, nome: 'Joao S.', telefone: '+55 65 99336-0000', email: 'outro@loja.com', documento_mascarado: '***.***.789-09', bloqueado: false, criado_em: '2026-03-01T10:00:00Z' },
  { id: '44444444-4444-4444-8444-444444444444', nome: 'Carlos Loja', telefone: '11 97777-2222', email: 'carlos@loja.com' },
];

test('normaliza e mascara dados pessoais', () => {
  assert.equal(normalizePhone('(65) 99336-0000'), '5565993360000');
  assert.equal(normalizePhone('+55 65 99336-0000'), '5565993360000');
  assert.equal(normalizePhone('123'), '');
  assert.equal(maskPhone('5565993360000'), '(65) •••••-0000');
  assert.equal(maskEmail('joao@email.com'), 'jo•••@email.com');
  assert.equal(maskDocument('123.456.789-09'), '•••.•••.789-09');
  assert.equal(safeInet('::ffff:10.0.0.1'), '::ffff:10.0.0.1');
  assert.equal(safeInet('undefined'), null);
});

test('ref aceita somente formatos seguros', () => {
  assert.deepEqual(parseRef('dino:cli-1'), { kind: 'dino', id: 'cli-1' });
  assert.deepEqual(parseRef(`loja:${CUSTOMER}`), { kind: 'loja', id: CUSTOMER });
  assert.equal(parseRef('loja:nao-uuid'), null);
  assert.equal(parseRef('tel:12'), null);
  assert.equal(parseRef('dino:../etc'), null);
  assert.equal(buildRef('tel', '(65) 99336-0000'), 'tel:5565993360000');
});

test('diretório junta barbearia e loja pelo telefone e busca sem acento', () => {
  const directory = mergeCustomerDirectory({ localClients, commerceCustomers });
  assert.equal(directory.length, 3);
  const joao = directory.find((item) => item.ref === 'dino:cli-1');
  assert.deepEqual(joao.fontes, ['barbearia', 'loja']);
  assert.equal(joao.telefone, '(65) •••••-0000');
  assert.equal(searchCustomerDirectory(directory, 'joao').items[0].ref, 'dino:cli-1');
  assert.equal(searchCustomerDirectory(directory, 'JOÃO silva').total, 1);
  assert.equal(searchCustomerDirectory(directory, '97777').items[0].ref, 'loja:44444444-4444-4444-8444-444444444444');
  assert.equal(searchCustomerDirectory(directory, 'ninguem').total, 0);
  assert.ok(!('_search' in searchCustomerDirectory(directory, '').items[0]));
});

test('identidade resolve a mesma pessoa a partir da barbearia, da loja ou do telefone', () => {
  const fromLocal = resolveIdentity('dino:cli-1', { localClients, commerceCustomers });
  assert.equal(fromLocal.local.length, 1);
  assert.equal(fromLocal.commerce.length, 1);
  assert.deepEqual(fromLocal.matchedBy, ['telefone']);
  assert.equal(fromLocal.ambiguous, true); // nomes diferentes: "João Silva" x "Joao S." viram alerta de possível duplicidade
  const fromStore = resolveIdentity(`loja:${CUSTOMER}`, { localClients, commerceCustomers });
  assert.equal(fromStore.local[0].id, 'cli-1');
  const fromPhone = resolveIdentity('tel:65993360000', { localClients, commerceCustomers });
  assert.equal(fromPhone.local.length + fromPhone.commerce.length, 2);
  assert.equal(resolveIdentity('dino:inexistente', { localClients, commerceCustomers }), null);
});

test('Customer 360 mantém customers Commerce conflitantes separados e exige seleção explícita', () => {
  const sharedPhone = '5565999990000';
  const customers = [
    { id: CUSTOMER, nome: 'Cliente A', telefone_normalizado: sharedPhone, email_normalizado: 'a@example.invalid' },
    { id: '44444444-4444-4444-8444-444444444444', nome: 'Cliente B', telefone_normalizado: sharedPhone, email_normalizado: 'b@example.invalid' },
  ];
  const graph = buildIdentityGraph({ commerceCustomers: customers });
  assert.equal(graph.persons.length, 2);
  assert.equal(graph.persons.every(person => person.commerce.length === 1 && person.contactConflict === true), true);
  const byPhone = resolveIdentity(`tel:${sharedPhone}`, { commerceCustomers: customers });
  assert.equal(byPhone.contactConflict, true);
  assert.equal(byPhone.commerce.length, 0);
  assert.deepEqual(byPhone.matchedBy, ['conflito de contato']);
  const explicit = resolveIdentity(`loja:${CUSTOMER}`, { commerceCustomers: customers });
  assert.equal(explicit.commerce[0].id, CUSTOMER);
  assert.equal(explicit.contactConflict, true);
});

test('diretório Commerce consulta e retorna os contatos canônicos', async () => {
  const original = db.queryRead;
  let captured = '';
  db.queryRead = async (sql) => { captured = sql; return { rows: [] }; };
  try {
    await loadCommerceDirectory({ empresaId: EMPRESA }, { query: 'EMAIL@EXAMPLE.INVALID' });
    assert.match(captured, /email_normalizado/);
    assert.match(captured, /telefone_normalizado/);
  } finally { db.queryRead = original; }
});

test('ficha 360 consolida indicadores, mascara por padrão e revela só na exportação', () => {
  const identity = resolveIdentity('dino:cli-1', { localClients, commerceCustomers });
  const now = new Date('2026-09-25T12:00:00Z');
  const local = {
    appointments: [
      { id: 'a1', dataHora: '2026-08-01T13:00:00Z', status: 'concluido', servicoNome: 'Corte', profissionalNome: 'Dino', valor: 45 },
      { id: 'a2', dataHora: '2026-09-01T13:00:00Z', status: 'concluido', servicoNome: 'Barba', valor: 30 },
      { id: 'a3', dataHora: '2026-09-30T13:00:00Z', status: 'agendado', servicoNome: 'Corte' },
      { id: 'a4', dataHora: '2026-07-01T13:00:00Z', status: 'nao_compareceu' },
    ],
    comandas: [{ id: 'c1', status: 'paga', total: 75, totalPago: 75, atualizadoEm: '2026-09-01T14:00:00Z' }],
    retailSales: [{ id: 'v1', status: 'pago', total: 25, criadoEm: '2026-09-01T14:10:00Z', itens: [{}] }],
    receivables: [{ id: 'r1', status: 'pendente', valor: 80, descricao: 'Comanda', dataVencimento: '2026-10-01' }],
    loyaltyMember: { id: 'fid-1', pontos: 120, pontosAcumulados: 150, nivel: 'bronze' },
    loyaltyMoves: [{ criadoEm: '2026-09-01T14:00:00Z', pontos: 75, origem: 'barbearia_comanda', valor: 75 }],
    subscriptions: [],
  };
  const commerce = {
    orders: { items: [{ id: 'o1', public_code: 'KC-1', status: 'paid', total: '398.00', criado_em: '2026-09-10T10:00:00Z', itens: 1 }, { id: 'o2', public_code: 'KC-2', status: 'cancelled', total: '50.00', criado_em: '2026-09-11T10:00:00Z' }] },
    credit: { items: [{ id: 'k1', limite_credito: '500', saldo_devedor: '20', prazo_dias: 30, status: 'active' }] },
    loyalty: { items: [{ loja_id: LOJA, saldo_pontos: 398, pontos_acumulados: 398 }] },
    carts: { items: [{ id: 'k', status: 'abandoned', subtotal: '2600', itens: 1, last_activity_at: '2026-09-20T10:00:00Z' }] },
    whatsapp: { unavailable: true, items: [], reason: 'tabela_ausente' },
    campaigns: { items: [] },
    consents: { items: [{ canal: 'whatsapp', finalidade: 'marketing', concedido: true, origem: 'checkout', atualizado_em: '2026-09-02T10:00:00Z' }] },
  };
  const profile = buildCustomer360(identity, { local, commerce, now });
  assert.equal(profile.perfil.telefone, '(65) •••••-0000');
  assert.equal(profile.perfil.documento, '•••.•••.789-09');
  assert.equal(profile.perfil.endereco, 'Endereço cadastrado');
  assert.deepEqual(profile.perfil.camposRevelaveis, ['telefone', 'email', 'documento', 'endereco']);
  assert.equal(profile.indicadores.receitaBarbearia, 100);
  assert.equal(profile.indicadores.receitaLoja, 398);
  assert.equal(profile.indicadores.valorVitalicio, 498);
  assert.equal(profile.indicadores.visitas, 2);
  assert.equal(profile.indicadores.faltas, 1);
  assert.equal(profile.indicadores.pedidos, 2);
  assert.equal(profile.indicadores.pedidosPagos, 1);
  assert.equal(profile.indicadores.pontos, 518);
  assert.equal(profile.indicadores.aReceber, 100);
  assert.equal(profile.indicadores.limiteCredito, 800);
  assert.equal(profile.indicadores.carrinhosAbertos, 1);
  assert.equal(profile.indicadores.retornoMedioDias, 31);
  assert.equal(profile.indicadores.segmento, 'recorrente');
  assert.equal(profile.proximos.length, 1);
  assert.equal(profile.relacionamento.consentimentos.length, 5);
  assert.equal(profile.fontes.find((item) => item.fonte === 'whatsapp').disponivel, false);
  assert.ok(profile.linhaDoTempo.length >= 8);
  assert.ok(profile.linhaDoTempo[0].em >= profile.linhaDoTempo.at(-1).em);
  const exported = buildCustomer360(identity, { local, commerce, now, reveal: true });
  assert.equal(exported.perfil.telefone, '5565993360000');
  assert.equal(exported.perfil.documento, '123.456.789-09');
  assert.equal(exported.perfil.mascarado, false);
  assert.equal(revealField(identity, 'email'), 'joao@email.com');
  assert.equal(revealField(identity, 'senha'), null);
});

test('facetas Commerce são tenant/loja-scoped e degradam por fonte', async () => {
  const original = db.queryRead;
  const calls = [];
  db.queryRead = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('whatsapp_ai_sessions')) { const error = new Error('relation does not exist'); error.code = '42P01'; throw error; }
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: 'o1', public_code: 'KC-1', status: 'paid', total: '10', criado_em: '2026-09-01' }] };
    return { rows: [] };
  };
  try {
    const result = await loadCommerceFacets({ empresaId: EMPRESA, lojaId: LOJA }, { customerIds: [CUSTOMER, 'nao-uuid'], phones: ['(65) 99336-0000'], emails: ['A@B.com'] });
    assert.equal(result.orders.items.length, 1);
    assert.equal(result.whatsapp.unavailable, true);
    assert.equal(result.whatsapp.reason, 'tabela_ausente');
    assert.equal(result.credit.items.length, 0);
    const orders = calls.find((call) => call.sql.includes('FROM commerce_orders'));
    assert.deepEqual(orders.params, [EMPRESA, [CUSTOMER], LOJA]);
    assert.match(orders.sql, /o\.empresa_id = \$1/);
    assert.match(orders.sql, /loja_id = \$3/);
    const consents = calls.find((call) => call.sql.includes('consentimentos_cliente'));
    assert.deepEqual(consents.params, [EMPRESA, ['5565993360000'], ['a@b.com']]);
    for (const call of calls) assert.equal(call.params[0], EMPRESA);
  } finally { db.queryRead = original; }
});

test('sem identificadores nenhuma consulta é feita', async () => {
  const original = db.queryRead;
  let called = false;
  db.queryRead = async () => { called = true; return { rows: [] }; };
  try {
    const result = await loadCommerceFacets({ empresaId: EMPRESA }, {});
    assert.equal(called, false);
    assert.deepEqual(result.orders.items, []);
  } finally { db.queryRead = original; }
});

test('auditoria de acesso nunca lança e refaz sem usuário quando a FK composta falha', async () => {
  const original = db.query;
  const params = [];
  db.query = async (sql, values) => {
    params.push(values);
    if (values[2]) { const error = new Error('fk'); error.code = '23503'; throw error; }
    return { rows: [] };
  };
  try {
    assert.equal(await auditCustomerAccess({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: 'u1' }, { acao: 'reveal', ref: 'dino:cli-1', campo: 'telefone', motivo: 'retorno de ligação', ip: 'x' }), true);
    assert.equal(params.length, 2);
    assert.equal(params[1][2], null);
    assert.equal(params[1][5], null, 'IP inválido não vai para a coluna INET');
    assert.match(params[1][4], /"campo":"telefone"/);
    assert.equal(await auditCustomerAccess(null, { acao: 'view', ref: 'x' }), false);
  } finally { db.query = original; }
});

test('vínculo manual une cadastros sem contato em comum e separação impede união por contato', () => {
  const carlos = `loja:44444444-4444-4444-8444-444444444444`;
  const linked = resolveIdentity('dino:cli-2', { localClients, commerceCustomers, links: [{ a: 'dino:cli-2', b: carlos }] });
  assert.deepEqual(linked.refs.sort(), ['dino:cli-2', carlos].sort());
  assert.deepEqual(linked.matchedBy, ['vínculo manual']);
  const split = resolveIdentity('dino:cli-1', { localClients, commerceCustomers, separations: [{ a: 'dino:cli-1', b: `loja:${CUSTOMER}` }] });
  assert.deepEqual(split.refs, ['dino:cli-1']);
  assert.equal(split.commerce.length, 0);
  const graph = buildIdentityGraph({ localClients, commerceCustomers, separations: [{ a: 'dino:cli-1', b: `loja:${CUSTOMER}` }] });
  assert.equal(graph.persons.length, 4);
  const fromStore = resolveIdentity(`loja:${CUSTOMER}`, { localClients, commerceCustomers });
  assert.equal(fromStore.commerce[0].id, CUSTOMER, 'a semente é o registro principal');
  assert.equal(fromStore.canonicalRef, 'dino:cli-1');
});

test('segmento segue a mesma regra para ficha e carteira', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const day = 86400000;
  assert.equal(customerSegment({ nowMs: now }), 'sem_historico');
  assert.equal(customerSegment({ lastActivityMs: now - 100 * day, engagements: 9, nowMs: now }), 'inativo');
  assert.equal(customerSegment({ lastActivityMs: now - 60 * day, engagements: 9, nowMs: now }), 'em_risco');
  assert.equal(customerSegment({ lastActivityMs: now - day, lifetimeValue: 1200, engagements: 1, nowMs: now }), 'vip');
  assert.equal(customerSegment({ lastActivityMs: now - day, engagements: 1, nowMs: now }), 'novo');
  assert.equal(customerSegment({ lastActivityMs: now - day, engagements: 3, nowMs: now }), 'recorrente');
});

import {
  anonymizeCommerceCustomers, buildPortfolio, duplicateSuggestions, loadCommercePortfolioMetrics,
  localMetricsByClient, queryPortfolio, summarizePortfolio,
} from './customer-360.js';

test('carteira soma barbearia + loja por pessoa, segmenta, filtra, ordena e pagina', () => {
  const now = Date.now();
  const iso = (days) => new Date(now - days * 86400000).toISOString();
  const locals = [
    { id: 'cli-1', nome: 'João Silva', telefone: '(65) 99336-0000' },
    { id: 'cli-2', nome: 'Maria Souza', telefone: '65 98888-1111' },
    { id: 'cli-3', nome: 'Pedro Antigo', telefone: '65 97777-0000' },
  ];
  const localMetrics = localMetricsByClient({
    clients: locals,
    appointments: [
      { clienteId: 'cli-1', status: 'concluido', dataHora: iso(3) }, { clienteId: 'cli-1', status: 'concluido', dataHora: iso(40) },
      { clienteId: '', clienteTelefone: '65993360000', status: 'concluido', dataHora: iso(70) },
      { clienteId: 'cli-3', status: 'concluido', dataHora: iso(200) },
      { clienteId: 'cli-2', status: 'nao_compareceu', dataHora: iso(2) },
    ],
    comandas: [{ clienteId: 'cli-1', status: 'paga', totalPago: 75, atualizadoEm: iso(3) }],
    retailSales: [],
    receivables: [{ clienteId: 'cli-2', status: 'pendente', valor: 50 }],
    loyaltyMembers: [{ clienteId: 'cli-1', pontos: 75 }],
  });
  assert.equal(localMetrics.get('cli-1').visitas, 3);
  assert.equal(localMetrics.get('cli-2').faltas, 1);
  const directory = mergeCustomerDirectory({ localClients: locals, commerceCustomers });
  const commerceMetrics = {
    orders: { map: new Map([[CUSTOMER, { pedidos: 2, pedidos_pagos: 1, receita: '1398.00', ultimo_pedido: iso(1) }]]) },
    carts: { map: new Map([[CUSTOMER, { carrinhos: 1 }]]) },
    credit: { map: new Map() },
  };
  const rows = buildPortfolio(directory, { localMetrics, commerceMetrics, tagsByRef: { 'dino:cli-1': ['vip'] } });
  const joao = rows.find((row) => row.ref === 'dino:cli-1');
  assert.equal(joao.metricas.valorVitalicio, 1473);
  assert.equal(joao.metricas.segmento, 'vip');
  assert.equal(joao.metricas.carrinhosAbertos, 1);
  assert.deepEqual(joao.etiquetas, ['vip']);
  assert.equal(rows.find((row) => row.ref === 'dino:cli-3').metricas.segmento, 'inativo');
  assert.equal(rows.find((row) => row.ref === 'dino:cli-2').metricas.segmento, 'sem_historico');
  const summary = summarizePortfolio(rows);
  assert.equal(summary.clientes, rows.length);
  assert.equal(summary.porSegmento.vip, 1);
  assert.equal(summary.comSaldo, 1);
  assert.equal(summary.ambasFontes, 1);
  assert.deepEqual(queryPortfolio(rows, { segmento: 'vip' }).items.map((row) => row.ref), ['dino:cli-1']);
  assert.deepEqual(queryPortfolio(rows, { fonte: 'ambas' }).items.map((row) => row.ref), ['dino:cli-1']);
  assert.deepEqual(queryPortfolio(rows, { saldo: true }).items.map((row) => row.ref), ['dino:cli-2']);
  assert.deepEqual(queryPortfolio(rows, { carrinho: true }).items.map((row) => row.ref), ['dino:cli-1']);
  assert.deepEqual(queryPortfolio(rows, { etiqueta: 'VIP' }).items.map((row) => row.ref), ['dino:cli-1']);
  assert.equal(queryPortfolio(rows, { ordem: 'sumidos' }).items[0].ref, 'dino:cli-3');
  const paged = queryPortfolio(rows, { tamanho: 5, pagina: 9 });
  assert.equal(paged.pagina, paged.paginas);
  assert.ok(!('_person' in paged.items[0]) && !('_search' in paged.items[0]));
});

test('fila de duplicados: repetido na mesma base, contato igual com nome diferente e mesmo nome sem contato', () => {
  const locals = [
    { id: 'a', nome: 'Bruno Lima', telefone: '65 91111-1111' },
    { id: 'b', nome: 'Bruno Lima', telefone: '(65) 91111-1111' },
    { id: 'c', nome: 'Carla Dias', telefone: '65 92222-2222' },
  ];
  const stores = [
    { id: '55555555-5555-4555-8555-555555555555', nome: 'C. Dias', telefone: '65922222222' },
    { id: '66666666-6666-4666-8666-666666666666', nome: 'Carla Dias', email: 'carla@x.com' },
  ];
  const items = duplicateSuggestions({ localClients: locals, commerceCustomers: stores });
  assert.deepEqual(items.map((item) => item.confianca), ['alta', 'media', 'baixa']);
  assert.match(items[0].motivo, /repetido na barbearia/);
  assert.equal(items[0].a.telefone, '(65) •••••-1111', 'fila sai mascarada');
  const decided = duplicateSuggestions({ localClients: locals, commerceCustomers: stores, separations: [{ a: 'dino:a', b: 'dino:b' }], links: [{ a: 'dino:c', b: 'loja:66666666-6666-4666-8666-666666666666' }] });
  assert.equal(decided.some((item) => item.a.ref === 'dino:a' && item.b.ref === 'dino:b'), false);
  assert.equal(decided.some((item) => item.confianca === 'baixa'), false, 'mesmo nome já vinculado sai da fila');
});

test('métricas da loja por cliente são tenant/loja-scoped e degradam', async () => {
  const original = db.queryRead;
  const calls = [];
  db.queryRead = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('commerce_customer_credit_accounts')) { const error = new Error('x'); error.code = '42P01'; throw error; }
    if (sql.includes('FROM commerce_orders')) return { rows: [{ customer_id: CUSTOMER, pedidos: 2, receita: '10' }] };
    return { rows: [] };
  };
  try {
    const metrics = await loadCommercePortfolioMetrics({ empresaId: EMPRESA, lojaId: LOJA });
    assert.equal(metrics.orders.map.get(CUSTOMER).pedidos, 2);
    assert.equal(metrics.credit.unavailable, true);
    assert.equal(calls[0].params[0], EMPRESA);
    assert.deepEqual(calls[0].params.at(-1), LOJA);
    assert.ok(calls.every((call) => call.params[0] === EMPRESA));
  } finally { db.queryRead = original; }
});

test('anonimização da loja usa savepoints, tolera tabela ausente e audita só ids', async () => {
  const original = db.transaction;
  const statements = [];
  db.transaction = async (callback) => callback({ async query(sql, params) {
    statements.push({ sql, params });
    if (sql.startsWith('UPDATE whatsapp_ai_messages')) { const error = new Error('no table'); error.code = '42P01'; throw error; }
    return { rowCount: sql.startsWith('UPDATE commerce_customers') ? 1 : 0, rows: [] };
  } });
  try {
    const result = await anonymizeCommerceCustomers({ empresaId: EMPRESA, lojaId: LOJA }, { customerIds: [CUSTOMER, 'x'], phones: ['(65) 99336-0000'], emails: ['A@B.com'], operador: 'Rodrigo (admin)' });
    assert.equal(result.clientes_loja, 1);
    assert.equal(result.mensagens_whatsapp, 'tabela_ausente');
    assert.equal(result.sessoes_whatsapp, 0, 'passo seguinte continuou após o erro');
    assert.ok(statements.some((item) => item.sql.startsWith('ROLLBACK TO SAVEPOINT')));
    const update = statements.find((item) => item.sql.startsWith('UPDATE commerce_customers'));
    assert.deepEqual(update.params, [EMPRESA, [CUSTOMER]]);
    const auditRow = statements.find((item) => item.sql.includes("'anonymize'"));
    assert.doesNotMatch(auditRow.params[2], /99336|a@b\.com/i, 'auditoria sem dado pessoal');
    assert.ok(statements.filter((item) => /^(UPDATE|DELETE|INSERT)/.test(item.sql)).every((item) => item.params[0] === EMPRESA));
  } finally { db.transaction = original; }
});

test('grupo extenso por contato conserva identidade, ordem e motivo sem todos os pares', () => {
  const localClients = Array.from({ length: 2000 }, (_, i) => ({ id: `grupo-${i}`, nome: 'Cliente', telefone: '65999999999' }));
  const result = buildIdentityGraph({ localClients });
  assert.equal(result.persons.length, 1);
  assert.equal(result.persons[0].local.length, 2000);
  assert.equal(result.persons[0].ref, 'dino:grupo-0');
  assert.deepEqual(result.persons[0].matchedBy, ['telefone']);
  assert.equal(result.persons[0].ambiguous, true);
});
