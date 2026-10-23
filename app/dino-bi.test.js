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
    { id: 'a1', status: 'concluido', servicoId: 's1', servicoNome: 'Corte', valor: 60, profissionalId: 'p1', clienteId: 'c1', financeiroLancamentoId: 'fin-a1', dataHora: '2026-09-02T13:00:00Z' },
    { id: 'a2', status: 'concluido', servicoId: 's1', servicoNome: 'Corte', valor: 60, profissionalId: 'p1', clienteId: 'c1', financeiroLancamentoId: 'fin-a2', dataHora: '2026-09-20T13:00:00Z' },
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
    { id: 'fin-a1', tipo: 'receita', origem: 'barbearia_atendimento', status: 'pago', valor: 60, pagoEm: '2026-09-02T13:10:00Z' },
    { id: 'fin-a2', tipo: 'receita', origem: 'barbearia_atendimento', status: 'pago', valor: 60, pagoEm: '2026-09-20T13:10:00Z' },
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

test('atendimento concluído sem lançamento pago não entra como receita, meta ou comissão', () => {
  const semRecebimento = {
    ...input,
    appointments: [...input.appointments, { id: 'sem-recebimento', status: 'concluido', servicoId: 's1', valor: 999, profissionalId: 'p1', dataHora: '2026-09-25T13:00:00Z' }],
  };
  const rows = bi.servicesPerformed(semRecebimento, window);
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

test('despesas históricas Avec ficam no Financeiro, mas não contaminam o lucro operacional', () => {
  const services = bi.servicesPerformed(input, window);
  const result = bi.estimateResult({
    services,
    retail: [],
    professionals,
    financeEntries: [
      { tipo: 'despesa', status: 'pago', categoria: 'Aluguel', valor: 50, pagoEm: '2026-09-15T12:00:00Z' },
      { tipo: 'despesa', status: 'pago', categoria: 'ALUGUEL', valor: 1000, origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, pagoEm: '2026-09-15T12:00:00Z' },
    ],
  }, window);
  assert.equal(result.despesasPagas, 50);
});

test('BI consolidado inclui histórico Avec pago sem alterar o modo operacional explícito', () => {
  const result = bi.estimateResult({
    services: [],
    retail: [],
    professionals,
    financeEntries: [
      { tipo: 'receita', status: 'pago', valor: 200, origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, pagoEm: '2026-09-15T12:00:00Z' },
      { tipo: 'despesa', status: 'pago', valor: 40, origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, pagoEm: '2026-09-15T12:00:00Z' },
    ],
    includeHistoricalFinance: true,
  }, window);
  assert.equal(result.receitaOperacional, 0);
  assert.equal(result.receitaHistoricaAvec, 200);
  assert.equal(result.despesasHistoricasAvec, 40);
  assert.equal(result.resultadoOperacional, 0);
  assert.equal(result.resultado, 160);
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

test('período BI aceita intervalo completo de Cuiabá e constrói janela anterior equivalente', () => {
  const period = bi.biPeriod({ inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal(period.days, 30);
  assert.equal(period.from, '2026-09-01T04:00:00.000Z');
  assert.equal(period.to, '2026-10-01T04:00:00.000Z');
  assert.equal(period.previousFrom, '2026-08-02T04:00:00.000Z');
  assert.equal(period.previousTo, '2026-09-01T04:00:00.000Z');
  assert.throws(() => bi.biPeriod({ inicio: '2026-10-02', fim: '2026-10-01' }), RangeError);
  assert.throws(() => bi.biPeriod({ inicio: '2025-01-01', fim: '2026-02-01' }), RangeError);
});

test('BI apresenta bruto consolidado e série diária sem transformar o histórico Avec em venda operacional', () => {
  const report = bi.buildBarbershopBi({
    ...input,
    customers: [{ id: 'c1', tipo: 'pf', dataNascimento: '1990-09-20', origem: 'Avec' }, { id: 'c2', tipo: 'pj', origem: 'Indicação' }],
    financeEntries: [...input.financeEntries,
      { id: 'avec-1', tipo: 'receita', status: 'pago', valor: 200, meioPagamento: 'pix', origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true }, pagoEm: '2026-09-15T12:00:00Z' },
    ],
    historicalServices: [{ id: 'hist-1', somenteHistorico: true, status: 'concluido', lojaId: 'loja-a', profissionalId: 'p1', clienteId: 'c1', servicoId: 's-hist', servicoNome: 'Barba histórica', valor: 35, dataAgenda: '2026-09-15' }],
    commerce: { revenue: 300, orders: 2, cost: null, daily: [{ day: '2026-09-15', total: 300 }], topProducts: [] },
  }, window);
  assert.equal(report.resultado.receitaLojaBruta, 300);
  assert.equal(report.resultado.receitaLojaIncluida, 0, 'custo Commerce desconhecido não falsifica o resultado');
  assert.equal(report.resumo.faturamentoBruto, 720);
  assert.equal(report.resumo.historicoFinanceiroAvec, 200);
  assert.equal(report.fontesReceita.find((item) => item.id === 'ecommerce').receita, 300);
  assert.equal(report.serieDiaria.find((item) => item.dia === '2026-09-15').total, 500);
  assert.ok(report.pagamentos.some((item) => item.metodo === 'histórico avec · pix' && item.valor === 200));
  assert.equal(report.perfilClientes.sexoDisponivel, false);
  assert.equal(report.perfilClientes.nascimentoInformado, 1);
  assert.equal(report.operacao.itensServicoHistoricos, 1);
  assert.equal(report.profissionais[0].receitaServicos, 215, 'serviço histórico fica atribuído à equipe');
  assert.equal(bi.biComparisonSummary(report).faturamentoBruto, 720);
});

test('BI interpreta datas sem horário como datas civis de Cuiabá e perfila somente atendidos no recorte', () => {
  const range = bi.biPeriod({ inicio: '2026-09-01', fim: '2026-09-01' });
  const report = bi.buildBarbershopBi({
    professionals,
    products: [],
    commands: [{ id: 'primeiro-dia', status: 'paga', fechadaEm: '2026-09-01', clienteId: 'c-no-recorte', itens: [{ tipo: 'servico', servicoId: 's', nome: 'Corte', subtotal: 50 }] }],
    historicalServices: [
      { somenteHistorico: true, status: 'concluido', dataAgenda: '2026-09-01', clienteId: 'c-no-recorte', servicoNome: 'Barba', valor: 30 },
      { somenteHistorico: true, status: 'concluido', dataAgenda: '2026-09-02', clienteId: 'c-fora', servicoNome: 'Fora', valor: 999 },
    ],
    customers: [
      { id: 'c-no-recorte', tipo: 'pf', origem: 'Importação Avec', dataNascimento: '1990-01-10' },
      { id: 'c-fora', tipo: 'pf', origem: 'Indicação', dataNascimento: '1991-01-10' },
    ],
    financeEntries: [],
  }, range);
  assert.equal(report.servicos.length, 2, 'o primeiro dia inclui comando e detalhe histórico');
  assert.equal(report.perfilClientes.cadastrosCobertos, 1);
  assert.equal(report.perfilClientes.origensCadastro[0].nome, 'Importação Avec');
  assert.equal(report.perfilClientes.nascimentoInformado, 1);
});
