import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brandOf, buildCustomerGraph, customerEgo, daysUntilBirthday, graphSummary, habitualInterval, momentScore, nextBestOffers, SEND_THRESHOLD,
} from './dino-grafo.js';

const NOW = new Date('2026-09-28T15:00:00Z');
const d = (days) => new Date(NOW.valueOf() - days * 86400000).toISOString();
const consent = (marketing = true) => ({ whatsapp: { atendimento: { concedido: true }, marketing: { concedido: marketing } } });

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
    { id: 'p3', nome: 'Lattafa Asad', preco: 350, estoque: 3 },
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
