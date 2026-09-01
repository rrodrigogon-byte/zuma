import assert from 'node:assert/strict';
import test from 'node:test';
import { answerDinoOperationalQuestion, buildDinoOperationalSnapshot } from './dino-assistant.js';

const snapshot = buildDinoOperationalSnapshot({
  data: '2026-09-01',
  agenda: [
    { status: 'agendado', valor: 80 },
    { status: 'concluido', valor: 120 },
    { status: 'cancelado', valor: 999 },
  ],
  servicos: [{ ativo: true }, { ativo: false }],
  profissionais: [{ ativo: true }, { ativo: true }],
  financeiro: { recMes: 900, despMes: 300, saldo: 600 },
  caixas: [{ status: 'aberto' }, { status: 'fechado' }],
  commerce: { produtosPublicados: 12, pedidosAbertos: 3, pedidosTotal: 9, pagamentosPendentes: 2 },
});

test('snapshot Dino exclui cancelamentos e agrega somente números operacionais', () => {
  assert.deepEqual(snapshot.agenda, { total: 2, pendentes: 1, concluidos: 1, valorProjetado: 200 });
  assert.deepEqual(snapshot.equipe, { profissionaisAtivos: 2, servicosAtivos: 1 });
  assert.deepEqual(snapshot.caixa, { abertos: 1, total: 2 });
  assert.equal(snapshot.financeiro.saldoHoje, 600);
  assert.deepEqual(snapshot.commerce, { produtosPublicados: 12, pedidosAbertos: 3, pedidosTotal: 9, pagamentosPendentes: 2 });
});

test('assistente local responde sobre caixa e preserva confirmação humana', () => {
  const answer = answerDinoOperationalQuestion('Como está o caixa e o faturamento?', snapshot);
  assert.match(answer, /receitas/i);
  assert.match(answer, /R\$\s?900/);
  assert.match(answer, /1 aberto/);
  assert.match(answer, /somente informativa/i);
  assert.doesNotMatch(answer, /executei|transferi|paguei/i);
});

test('assistente local responde sobre perfumaria pelo Commerce do tenant', () => {
  const answer = answerDinoOperationalQuestion('Como estão produtos, pedidos e pagamentos da perfumaria?', snapshot);
  assert.match(answer, /12 produto/);
  assert.match(answer, /3 pedido/);
  assert.match(answer, /2 pagamento/);
});

test('pergunta genérica retorna resumo sem inventar dados pessoais', () => {
  const answer = answerDinoOperationalQuestion('Me dê um resumo', snapshot);
  assert.match(answer, /2 atendimento/);
  assert.match(answer, /3 pedido/);
  assert.doesNotMatch(answer, /cpf|documento|telefone|cliente/i);
});
