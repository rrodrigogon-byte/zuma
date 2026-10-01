import assert from 'node:assert/strict';
import test from 'node:test';
import { automationResults, planAutomations, quietHours, renderMessage, variantFor } from './ai-automations.js';
import { buildCustomerGraph } from '../dino-grafo.js';

const NOW = new Date('2026-09-28T15:00:00Z'); // 11h em Cuiabá
const d = (days) => new Date(NOW.valueOf() - days * 86400000).toISOString();
const h = (hours) => new Date(NOW.valueOf() - hours * 3600000).toISOString();
const consent = (marketing) => ({ whatsapp: { atendimento: { concedido: true }, marketing: { concedido: marketing } } });
const ALL_ON = { ativo: true, autonomia: 1, automacoes: { reativacao: true, pos_atendimento: true, aniversario: true, aviso_estoque: true } };

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
  };
  return { sources, graph: buildCustomerGraph(sources, { now: NOW }) };
}

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
  const rows = [{ automacao: 'reativacao', telefone: phone, status: 'enviada', motivo: 'variante A', criado_em: d(60) }];
  const [r] = automationResults(rows, graph);
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
