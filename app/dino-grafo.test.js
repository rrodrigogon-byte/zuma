import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brandOf, buildCustomerGraph, customerEgo, daysUntilBirthday, graphSummary, habitualInterval, isCustomerPhoneUnambiguous, momentScore, nextBestOffers, SEND_THRESHOLD,
} from './dino-grafo.js';

const NOW = new Date('2026-09-28T15:00:00Z');
const d = (days) => new Date(NOW.valueOf() - days * 86400000).toISOString();
const consent = (marketing = true) => ({ whatsapp: { atendimento: { concedido: true }, marketing: { concedido: marketing } } });
const completeIdentityQuality = () => ({ fontes: Object.fromEntries(['clients', 'appointments', 'commands', 'retailSales', 'pedidos'].map((name) => [name, { status: 'ok' }])) });

function fixture() {
  const clients = [
    { id: 'c1', nome: 'Diego', telefone: '(65) 99999-0001', consentimentos: consent(), dataNascimento: '1990-10-02' },
    { id: 'c2', nome: 'Lucas', telefone: '65999990002', consentimentos: consent(), indicadoPor: 'c1' },
    { id: 'c3', nome: 'Marcos', telefone: '65999990003', consentimentos: consent() },
    { id: 'c4', nome: 'Pedro', telefone: '65999990004', consentimentos: consent(false) },
    { id: 'cli-padrao-balcao', nome: 'Balcão', padrao: true },
  ];
  const cmd = (clienteId, days, itens, profissionalId = 'bruno') => ({ id: `${clienteId}-${days}`, clienteId, status: 'paga', fechadaEm: d(days), profissionalId, itens });
  const corte = { tipo: 'servico', servicoId: 's1', nome: 'Corte Masculino', subtotal: 45 };
  const commands = [
    cmd('c1', 84, [corte]), cmd('c1', 56, [corte]), cmd('c1', 28, [corte, { tipo: 'produto', nome: 'Dior Sauvage EDT', subtotal: 800 }]),
    cmd('c2', 30, [corte]),
    cmd('c3', 40, [corte, { tipo: 'produto', nome: 'Armaf Club de Nuit Intense', subtotal: 449 }], 'bruno'),
    cmd('c4', 20, [corte, { tipo: 'produto', nome: 'Armaf Club de Nuit Intense', subtotal: 449 }], 'bruno'),
    cmd('c4', 60, [{ tipo: 'servico', nome: 'Corte + Barba', subtotal: 75 }], 'bruno'),
    cmd('cli-padrao-balcao', 1, [corte]),
  ];
  const catalog = [
    { id: 'p1', nome: 'Armaf Club de Nuit Intense', preco: 449, custo: 250, estoque: 10 },
    { id: 'p2', nome: 'Dior Sauvage EDT', preco: 800, estoque: 2 },
    { id: 'p3', nome: 'Lattafa Asad', preco: 350, custo: 200, estoque: 3 },
    { id: 'p4', nome: 'Xerjoff Erba Pura', preco: 2600, estoque: 0 },
  ];
  const services = [{ id: 's1', nome: 'Corte Masculino', preco: 45 }, { id: 's2', nome: 'Corte + Barba', preco: 75 }, { id: 's3', nome: 'Corte Premium com o Dino', preco: 1000 }];
  const facts = [{ telefone: '5565999990002', categoria: 'produto_interesse', valor: 'Lattafa Asad', status: 'ativo' }, { telefone: '5565999990002', categoria: 'produto_interesse', valor: 'Creed', status: 'contestado' }];
  return { clients, commands, catalog, services, professionals: [{ id: 'bruno', nome: 'Bruno' }], facts };
}

test('marca: reconhece marcas de duas palavras', () => {
  assert.equal(brandOf('Tom Ford Oud Wood'), 'tom ford');
  assert.equal(brandOf('Armaf Club de Nuit'), 'armaf');
});

test('intervalo habitual usa a mediana e ignora visitas no mesmo dia', () => {
  assert.equal(habitualInterval([d(84), d(56), d(28), d(28)]), 28);
  assert.equal(habitualInterval([d(10)]), null);
});

test('momento é máximo perto da data de volta ou do aniversário', () => {
  assert.equal(momentScore({ daysSince: 28, interval: 28 }), 1);
  assert.ok(momentScore({ daysSince: 5, interval: 28 }) < 0.5);
  assert.equal(momentScore({ daysSince: 5, interval: 28, birthdayIn: 3 }), 1);
  assert.equal(daysUntilBirthday('1990-10-02', NOW), 4);
});

test('grafo liga clientes pelo telefone e ignora o cliente balcão', () => {
  const graph = buildCustomerGraph(fixture(), { now: NOW });
  assert.equal(graph.customers.size, 4);
  const diego = graph.customers.get('5565999990001');
  assert.equal(diego.interval, 28);
  assert.equal(diego.favoriteProfessional, 'bruno');
  assert.equal(diego.indicou.size, 1);
  const lucas = graph.customers.get('5565999990002');
  assert.equal(lucas.interests.length, 1, 'fato contestado não entra');
  const summary = graphSummary(graph);
  assert.equal(summary.relacoes.INDICOU, 1);
  assert.ok(summary.relacoes.COMPROU >= 3);
});

test('janela executiva usa apenas eventos datados nos últimos 365 dias e separa fatos sem data', () => {
  const client = { id: 'window-client', nome: 'Cliente de teste', telefone: '5565999990123' };
  const command = (id, at) => ({ id, clienteId: client.id, status: 'paga', fechadaEm: at, itens: [{ tipo: 'produto', produtoId: id, nome: `Produto ${id}`, subtotal: 20 }] });
  const input = {
    clients: [client],
    commands: [command('recent', d(10)), command('old', d(400)), command('future', new Date(NOW.valueOf() + 86400000).toISOString())],
    facts: [{ telefone: client.telefone, categoria: 'servico_interesse', valor: 'Barba', status: 'ativo' }],
  };
  const metricsGraph = buildCustomerGraph(input, { now: NOW, relationshipWindowDays: 365, includeUndated: false });
  const networkGraph = buildCustomerGraph(input, { now: NOW, relationshipWindowDays: 365, includeUndated: true });
  const metricsCustomer = metricsGraph.customers.get(client.telefone);
  const networkCustomer = networkGraph.customers.get(client.telefone);
  assert.equal(metricsCustomer.visits.length, 1);
  assert.equal(metricsCustomer.products.size, 1);
  assert.equal(metricsCustomer.interests.length, 0);
  assert.equal(metricsGraph.edges.filter((edge) => edge.source === 'commands').length, 1);
  assert.equal(networkCustomer.visits.length, 1);
  assert.ok(networkGraph.edges.some((edge) => edge.source === 'facts' && edge.at === null));
  assert.ok(!networkGraph.edges.some((edge) => edge.at === d(400) || edge.at === new Date(NOW.valueOf() + 86400000).toISOString()));
});

test('telefone ambíguo não pode identificar uma memória única dentro do grafo', () => {
  const data = fixture();
  data.quality = completeIdentityQuality();
  data.clients.push({ id: 'duplicate-c1', nome: 'Outro cadastro', telefone: data.clients[0].telefone, consentimentos: consent() });
  const graph = buildCustomerGraph(data, { now: NOW });
  assert.equal(isCustomerPhoneUnambiguous(graph, data.clients[0].telefone), false);
  const unique = fixture();
  unique.quality = completeIdentityQuality();
  assert.equal(isCustomerPhoneUnambiguous(buildCustomerGraph(unique, { now: NOW }), '5565999990001'), true);
  for (const source of ['clients', 'appointments', 'commands', 'retailSales', 'pedidos']) {
    const incomplete = fixture();
    incomplete.quality = completeIdentityQuality();
    incomplete.quality.fontes[source].status = 'limitado';
    assert.equal(isCustomerPhoneUnambiguous(buildCustomerGraph(incomplete, { now: NOW }), '5565999990001'), false, `${source} parcial não comprova identidade única`);
  }
  assert.equal(isCustomerPhoneUnambiguous(buildCustomerGraph(fixture(), { now: NOW }), '5565999990001'), false, 'ausência de qualidade também falha fechado');
});

test('próxima oferta: Diego recebe Armaf (clientes parecidos do Bruno compraram), nunca item esgotado ou já comprado', () => {
  const data = fixture();
  const graph = buildCustomerGraph(data, { now: NOW });
  const rows = nextBestOffers(graph, { catalog: data.catalog, services: data.services });
  const diego = rows.find((r) => r.cliente.nome === 'Diego');
  assert.equal(diego.melhor.nome, 'Armaf Club de Nuit Intense');
  assert.ok(diego.melhor.motivos.some((m) => /parecido/.test(m)));
  const all = rows.flatMap((r) => [r.melhor, ...r.alternativas]).map((o) => o.nome);
  assert.ok(!all.includes('Xerjoff Erba Pura'));
  assert.ok(!all.includes('Corte Premium com o Dino'), 'serviço premium de R$ 1.000 não é sugerido automaticamente');
  assert.ok(!(diego.melhor.nome === 'Dior Sauvage EDT'));
});

test('saldo textual inválido permanece desconhecido e bloqueia envio da recomendação', () => {
  const data = fixture();
  const malformed = { id: 'bad-stock', nome: 'Cera especial', preco: 40, estoque: 'abc', estoqueInformado: true, publicado: true };
  const rows = nextBestOffers(buildCustomerGraph(data, { now: NOW }), { catalog: [malformed] });
  const offer = rows[0]?.melhor;
  assert.equal(offer.estoqueConhecido, false);
  assert.equal(offer.estoque, null);
  assert.equal(offer.disponibilidade, 'nao_verificada');
  assert.equal(rows[0].enviar, false);
});

test('interesse registrado na memória puxa a oferta do Lucas para o Lattafa', () => {
  const data = fixture();
  const rows = nextBestOffers(buildCustomerGraph(data, { now: NOW }), { catalog: data.catalog, services: data.services });
  const lucas = rows.find((r) => r.cliente.nome === 'Lucas');
  assert.equal(lucas.melhor.nome, 'Lattafa Asad');
  assert.equal(lucas.melhor.partes.interesse, 1);
});

test('sem consentimento de marketing a oferta nunca é marcada para envio', () => {
  const data = fixture();
  const rows = nextBestOffers(buildCustomerGraph(data, { now: NOW }), { catalog: data.catalog, services: data.services });
  const pedro = rows.find((r) => r.cliente.nome === 'Pedro');
  assert.equal(pedro.enviar, false);
  assert.ok(rows.every((r) => !r.enviar || (r.melhor.score >= SEND_THRESHOLD && r.cliente.consentimento.marketing)));
  const onlyConsented = nextBestOffers(buildCustomerGraph(data, { now: NOW }), { catalog: data.catalog, onlyConsented: true });
  assert.ok(!onlyConsented.some((r) => r.cliente.nome === 'Pedro'));
});

test('ego do cliente traz os vizinhos com rótulos legíveis e sem telefone completo', () => {
  const graph = buildCustomerGraph(fixture(), { now: NOW });
  const ego = customerEgo(graph, '5565999990001');
  assert.equal(JSON.stringify(ego).includes('5565999990001'), false);
  assert.ok(ego.nodes.some((n) => n.tipo === 'profissional' && n.rotulo === 'Bruno'));
  assert.ok(ego.links.some((l) => l.rel === 'INDICOU'));
  const view = nextBestOffers(graph, { catalog: fixture().catalog })[0].cliente;
  assert.equal(JSON.stringify(view).includes('5565999990001'), false);
});

test('consentimento do CRM: SAIR e revogação vencem o cadastro local; sem a fonte, fecha', () => {
  const data = fixture();
  const consents = new Map([['5565999990001', { optOut: true, marketing: false, personalizacao: null }], ['5565999990003', { marketing: false, personalizacao: true, optOut: false }], ['5565999990004', { marketing: true, personalizacao: false, optOut: false }]]);
  const graph = buildCustomerGraph({ ...data, consents }, { now: NOW });
  assert.equal(graph.customers.get('5565999990001').consent.optOut, true);
  assert.equal(graph.customers.get('5565999990003').consent.marketing, false);
  assert.equal(graph.customers.get('5565999990004').consent.marketing, true, 'opt-in dado pelo WhatsApp vale');
  const closed = buildCustomerGraph({ ...data, consents: null }, { now: NOW });
  assert.ok([...closed.customers.values()].every((c) => c.consent.marketing === false && c.consent.optOut === true));
});

test('telefone do grafo usa a forma canônica do opt-out (12 e 13 dígitos são o mesmo cliente)', async () => {
  const { graphPhone } = await import('./dino-grafo.js');
  assert.equal(graphPhone('556599990000'), '5565999990000');
  assert.equal(graphPhone('(65) 99999-0000'), '5565999990000');
  assert.equal(graphPhone('65 3322-1100'), '556533221100', 'fixo não ganha o 9');
});


test('telefone compartilhado não mistura pessoas nem libera mensagens', () => {
  const a = fixture().clients[0];
  const graph = buildCustomerGraph({ clients: [a, { ...a, id: 'other', nome: 'Outra pessoa' }],
    commands: [{ clienteId: a.id, status: 'paga', fechadaEm: d(1), itens: [{ tipo: 'produto', nome: 'Perfume', subtotal: 80 }] }],
    facts: [{ telefone: a.telefone, categoria: 'produto_interesse', valor: 'Perfume', status: 'ativo' }],
    consents: new Map([['5565999990001', { marketing: true }]]) });
  assert.equal(graph.customers.size, 2);
  assert.equal(graph.customers.get('id:c1').totalGasto, 80);
  assert.equal(graph.customers.get('id:other').totalGasto, 0);
  assert.ok([...graph.customers.values()].every(c => c.automationBlocked && !c.interests.length));
  assert.equal(graphSummary(graph).qualidade.telefonesAmbiguos, 1);
});

test('anonimização não é revertida por comandas, telefone ou memória', () => {
  const a = { ...fixture().clients[0], anonimizadoEm: d(1) };
  const graph = buildCustomerGraph({ clients: [a], commands: [
    { clienteId: a.id, clienteTelefone: a.telefone, status: 'paga', itens: [{ tipo: 'produto', nome: 'P', subtotal: 10 }] },
    { clienteTelefone: a.telefone, status: 'paga', itens: [{ tipo: 'produto', nome: 'P', subtotal: 10 }] }],
    facts: [{ telefone: a.telefone, status: 'ativo', valor: 'P' }],
    orders: [{ status: 'paid', telefone: a.telefone, itens: [{ nome: 'P', subtotal: 10 }] }] });
  assert.equal(graph.customers.size, 0);
  assert.equal(graph.edges.length, 0);
});

test('somente pedidos confirmados contam; duplicatas, homologação e reembolsos não', () => {
  const order = { id: 'o1', customerId: 'customer1', telefone: '65999990001', status: 'paid', itens: [
    { produtoId: 'p1', nome: 'Produto', subtotal: 100 }, { produtoId: 'test', nome: 'Homologação InfinitePay', subtotal: 3 }] };
  const graph = buildCustomerGraph({ orders: [order, order, ...['pending_payment', 'payment_failed', 'draft', 'cancelled', 'refunded', 'partially_refunded', 'fraud_review', undefined].map((status, i) => ({ ...order, id: `bad${i}`, status }))] });
  assert.equal(graph.edges.length, 1);
  assert.equal([...graph.customers.values()][0].totalGasto, 100);
  assert.equal(graph.quality.excluidos.pedidosNaoConfirmados, 8);
  assert.equal(graph.quality.excluidos.itensTeste, 1);
});

test('IDs de produto preservam itens homônimos e origem local/Commerce', () => {
  const graph = buildCustomerGraph({ orders: [{ telefone: '65999990001', status: 'paid', itens: [
    { produtoId: 'p1', nome: 'Mesmo nome', subtotal: 10 }, { produtoId: 'p2', nome: 'Mesmo nome', subtotal: 20 }] }],
    commands: [{ clienteTelefone: '65999990001', status: 'paga', fechadaEm: d(1), itens: [{ tipo: 'produto', produtoId: 'p1', nome: 'Mesmo nome', subtotal: 5 }] }] });
  const c = [...graph.customers.values()][0];
  assert.equal(c.products.size, 3);
  assert.equal(c.totalGasto, 35);
  assert.ok(customerEgo(graph, c.key).nodes.filter(n => n.tipo === 'produto').every(n => n.rotulo === 'Mesmo nome'));
});

test('ego truncado nunca devolve relações com nós ausentes', () => {
  const graph = buildCustomerGraph({ orders: [{ telefone: '65999990001', status: 'paid', itens: Array.from({ length: 75 }, (_, i) => ({ produtoId: `p${i}`, nome: `Produto ${i}`, subtotal: 1 })) }] });
  const ego = customerEgo(graph, '5565999990001');
  const ids = new Set(ego.nodes.map(n => n.id));
  assert.equal(ego.nodes.length, 40);
  assert.equal(ego.truncado, true);
  assert.ok(ego.links.every(l => ids.has(l.from) && ids.has(l.to)));
});

test('falha ou limite em uma fonte bloqueia envios sem mascarar a qualidade', () => {
  for (const status of ['indisponivel', 'limitado']) {
    const graph = buildCustomerGraph({ ...fixture(), quality: { fontes: { pedidos: { status } } } });
    assert.ok([...graph.customers.values()].every(c => c.automationBlocked));
    assert.equal(graphSummary(graph).qualidade.fontes.pedidos.status, status);
  }
});

test('Commerce e cadastro local sem vínculo comprovado mantêm históricos distintos', () => {
  const graph = buildCustomerGraph({ clients: [fixture().clients[0]], orders: [{ customerId: 'remote', telefone: '65999990001', status: 'paid', itens: [{ nome: 'P', subtotal: 10 }] }] });
  assert.equal(graph.customers.size, 2);
  assert.equal(graph.customers.get('id:c1').totalGasto, 0);
  assert.equal(graph.customers.get('commerce:remote').totalGasto, 10);
  assert.ok([...graph.customers.values()].every(c => c.identityUnresolved));
});

test('sem custo conhecido margem é zero; preço alto não inventa lucro', () => {
  const data = fixture();
  const rows = nextBestOffers(buildCustomerGraph(data, { now: NOW }), { catalog: [{ id: 'expensive', nome: 'Perfume caro', preco: 5000, estoque: 1 }], services: [] });
  assert.ok(rows.length);
  assert.ok(rows.every(row => row.melhor.partes.margem === 0));
});

test('saldo desconhecido não vira ruptura nem autorização de envio de oferta', () => {
  const customer = { id: 'unknown-stock-client', nome: 'Cliente', telefone: '65999990001', consentimentos: consent() };
  const graph = buildCustomerGraph({ clients: [customer], commands: [
    { clienteId: customer.id, status: 'paga', fechadaEm: d(20), itens: [{ tipo: 'servico', nome: 'Corte', subtotal: 40 }] },
  ] }, { now: NOW });
  const rows = nextBestOffers(graph, { services: [], catalog: [
    { id: 'unknown', nome: 'Produto sem nível', preco: 100, estoque: null, estoqueInformado: false },
    { id: 'known-zero', nome: 'Produto esgotado', preco: 100, estoque: 0, estoqueInformado: true },
  ] });
  const offer = rows.find((row) => row.melhor.id === 'unknown');
  assert.ok(offer);
  assert.equal(offer.melhor.estoque, null);
  assert.equal(offer.melhor.estoqueConhecido, false);
  assert.equal(offer.melhor.disponibilidade, 'nao_verificada');
  assert.ok(offer.melhor.motivos.includes('disponibilidade não verificada'));
  assert.equal(offer.enviar, false);
  assert.equal(rows.some((row) => row.melhor.id === 'known-zero'), false);
});

test('arestas do grafo preservam a origem de comandas, PDV e pedidos Commerce', () => {
  const graph = buildCustomerGraph({
    clients: [{ id: 'source-client', telefone: '65999990001' }],
    commands: [{ clienteId: 'source-client', status: 'paga', fechadaEm: d(2), itens: [{ tipo: 'produto', produtoId: 'same', nome: 'Pomada', subtotal: 20 }] }],
    retailSales: [{ clienteTelefone: '65999990001', status: 'pago', pagoEm: d(1), itens: [{ produtoId: 'same', nome: 'Pomada', subtotal: 20 }] }],
    orders: [{ id: 'commerce-order', telefone: '65999990001', status: 'paid', criadoEm: d(1), itens: [{ produtoId: 'same', nome: 'Pomada', subtotal: 20 }] }],
  }, { now: NOW });
  const purchaseEdges = graph.edges.filter((edge) => edge.rel === 'COMPROU');
  assert.deepEqual(new Set(purchaseEdges.map((edge) => edge.source)), new Set(['commands', 'retailSales', 'orders']));
});
