import test from 'node:test';
import assert from 'node:assert/strict';
import * as bi from './dino-bi.js';

const window = { fromDate: new Date('2026-09-01T00:00:00Z'), toDate: new Date('2026-10-01T00:00:00Z'), days: 30 };
const professionals = [{ id: 'p1', nome: 'Bruno', percentualComissao: 50, percentualComissaoProduto: 10 }];
const products = [{ id: 'r1', nome: 'Pomada', custoUnitario: 20 }];

const input = {
  professionals,
  products,
  appointments: [
    { id: 'a1', status: 'concluido', servicoId: 's1', servicoNome: 'Corte', valor: 60, profissionalId: 'p1', clienteId: 'c1', dataHora: '2026-09-02T13:00:00Z' },
    { id: 'a2', status: 'concluido', servicoId: 's1', servicoNome: 'Corte', valor: 60, profissionalId: 'p1', clienteId: 'c1', dataHora: '2026-09-20T13:00:00Z' },
    { id: 'a3', status: 'nao_compareceu', servicoId: 's1', dataHora: '2026-09-05T13:00:00Z' },
    { id: 'a4', status: 'cancelado', servicoId: 's1', dataHora: '2026-09-06T13:00:00Z' },
    { id: 'a5', status: 'concluido', servicoId: 's1', valor: 60, profissionalId: 'p1', clienteId: 'c2', dataHora: '2026-09-10T13:00:00Z', origem: 'agendamento_online' },
    { id: 'fora', status: 'concluido', servicoId: 's1', valor: 999, dataHora: '2026-08-10T13:00:00Z' },
  ],
  commands: [
    { id: 'k1', status: 'paga', agendamentoId: 'a5', profissionalId: 'p1', clienteId: 'c2', fechadaEm: '2026-09-10T14:00:00Z', pagamentos: [{ meio: 'pix', valor: 100 }], itens: [
      { tipo: 'servico', servicoId: 's1', nome: 'Corte', quantidade: 1, subtotal: 60 },
      { tipo: 'produto', produtoId: 'r1', nome: 'Pomada', quantidade: 1, subtotal: 40 },
    ] },
  ],
  retailSales: [],
  customers: [{ id: 'c2', criadoEm: '2026-09-10T12:00:00Z' }, { id: 'padrao', padrao: true, criadoEm: '2026-09-10T12:00:00Z' }],
  financeEntries: [
    { tipo: 'despesa', status: 'pago', categoria: 'Aluguel', valor: 50, pagoEm: '2026-09-15T12:00:00Z' },
    { tipo: 'despesa', status: 'pago', categoria: 'Comissões', valor: 999, pagoEm: '2026-09-15T12:00:00Z' },
    { tipo: 'despesa', status: 'pago', categoria: 'Produtos', origem: 'estoque', valor: 999, pagoEm: '2026-09-15T12:00:00Z' },
    { tipo: 'despesa', status: 'pendente', categoria: 'Luz', valor: 999, vencimento: '2026-09-20' },
  ],
};

test('serviços não contam duas vezes o atendimento que virou comanda', () => {
  const rows = bi.servicesPerformed(input, window);
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((sum, row) => sum + row.receita, 0), 180);
});

test('resultado estimado desconta comissão, custo da revenda e despesas pagas (sem duplicar)', () => {
  const services = bi.servicesPerformed(input, window);
  const retail = bi.retailSold(input, window);
  const result = bi.estimateResult({ services, retail, professionals, financeEntries: input.financeEntries }, window);
  // receita 180 serviços + 40 revenda; comissão 90 + 4; CMV 20; despesas 50
  assert.equal(result.receita, 220);
  assert.equal(result.comissoes, 94);
  assert.equal(result.cmvRevenda, 20);
  assert.equal(result.despesasPagas, 50);
  assert.equal(result.resultado, 56);
  assert.equal(result.margem, 25.5);
});

test('loja online entra no resultado só com custo conhecido', () => {
  const base = { services: [], retail: [], professionals, financeEntries: [] };
  const semCusto = bi.estimateResult({ ...base, commerce: { revenue: 500, cost: null } }, window);
  assert.equal(semCusto.receita, 0);
  assert.ok(semCusto.notas.some((nota) => nota.includes('Loja online')));
  const comCusto = bi.estimateResult({ ...base, commerce: { revenue: 500, cost: 300 } }, window);
  assert.equal(comCusto.resultado, 200);
});

test('BI completo: agenda, clientes, pagamentos e ranking', () => {
  const report = bi.buildBarbershopBi(input, window);
  assert.equal(report.agenda.total, 5);
  assert.equal(report.agenda.faltas, 1);
  assert.equal(report.agenda.taxaComparecimento, 75);
  assert.equal(report.agenda.participacaoOnline, 20);
  assert.equal(report.clientes.ativos, 2);
  assert.equal(report.clientes.recorrentes, 1);
  assert.equal(report.clientes.novosCadastros, 1);
  assert.equal(report.pagamentos[0].metodo, 'pix');
  assert.equal(report.profissionais[0].nome, 'Bruno');
  assert.equal(report.profissionais[0].atendimentos, 3);
  assert.equal(report.revenda[0].margem, 50);
  assert.equal(report.lojaOnline.disponivel, false);
});
