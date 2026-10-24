import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEquipeDesempenho, UNATTRIBUTED_PROFESSIONAL_ID } from './dino-equipe-desempenho.js';

const EMP = 'emp-sintetica';
const STORE = 'loja-a';
const PERIOD = { empresaId: EMP, lojaId: STORE, inicio: '2026-03-01', fim: '2026-03-02' };

const clone = (value) => structuredClone(value);
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function snapshot() {
  return {
    barbearias: {
      [EMP]: {
        configuracao: { taxasPagamento: {} },
        profissionais: {
          p1: { id: 'p1', empresaId: EMP, nome: 'Ana', ativo: true, percentualComissao: 50, percentualComissaoProduto: 10, descontaTaxaMaquininha: true, descontaMaterial: false },
          p2: { id: 'p2', empresaId: EMP, nome: 'Beto Outra Unidade', lojaId: 'loja-b', ativo: true, percentualComissao: 50, percentualComissaoProduto: 10 },
          p3: { id: 'p3', empresaId: EMP, nome: 'Clara Sem Movimento', lojaId: STORE, ativo: true, percentualComissao: 50, percentualComissaoProduto: 10 },
          p4: { id: 'p4', empresaId: 'outra-empresa', nome: 'Não Vazar', ativo: true, percentualComissao: 99 },
        },
        servicos: { s1: { id: 's1', empresaId: EMP, nome: 'Corte', preco: 100, custoMaterial: 0 } },
        produtosRevenda: { pr1: { id: 'pr1', empresaId: EMP, nome: 'Pomada', precoVenda: 40, custoUnitario: 10 } },
        agendamentos: {
          a1: { id: 'a1', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataAgenda: '2026-03-01', dataHora: '2026-03-01T13:00:00.000Z', financeiroLancamentoId: 'fin-a1' },
          aOldCovered: { id: 'a-old-covered', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataAgenda: '2026-03-01', dataHora: '2026-03-01T14:00:00.000Z' },
          aOtherStore: { id: 'a-other-store', empresaId: EMP, lojaId: 'loja-b', profissionalId: 'p2', servicoId: 's1', status: 'concluido', dataAgenda: '2026-03-01', dataHora: '2026-03-01T15:00:00.000Z' },
          aLegacy: { id: 'a-legacy', empresaId: EMP, profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataAgenda: '2026-03-01', dataHora: '2026-03-01T16:00:00.000Z' },
          aNoShow: { id: 'a-no-show', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'nao_compareceu', dataAgenda: '2026-03-02', dataHora: '2026-03-02T13:00:00.000Z' },
          aCanceled: { id: 'a-canceled', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'cancelado', dataAgenda: '2026-03-02', dataHora: '2026-03-02T14:00:00.000Z' },
        },
        comandas: {
          c1: {
            id: 'c1', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'paga', fechadaEm: '2026-03-01T15:00:00.000Z',
            desconto: 20, itens: [
              { id: 'ci-s', tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 100 },
              { id: 'ci-p', tipo: 'produto', produtoId: 'pr1', nome: 'Pomada', profissionalId: 'p1', quantidade: 1, subtotal: 40 },
            ], pagamentos: [{ id: 'pay-c1', meio: 'pix', valor: 120 }],
          },
          cOld: {
            id: 'c-old', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', agendamentoId: 'a-old-covered', status: 'paga', fechadaEm: '2026-02-28T15:00:00.000Z',
            itens: [{ id: 'ci-old', tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 100 }], pagamentos: [{ meio: 'dinheiro', valor: 100 }],
          },
          cEmConta: {
            id: 'c-account', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'em_conta', fechadaEm: '2026-03-01T16:00:00.000Z',
            itens: [{ id: 'ci-account', tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 100 }], pagamentos: [{ meio: 'conta', valor: 100 }],
          },
          cOtherStore: {
            id: 'c-other', empresaId: EMP, lojaId: 'loja-b', profissionalId: 'p2', status: 'paga', fechadaEm: '2026-03-01T17:00:00.000Z',
            itens: [{ tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p2', quantidade: 1, subtotal: 100 }], pagamentos: [{ meio: 'pix', valor: 100 }],
          },
          cLegacy: {
            id: 'c-legacy', empresaId: EMP, profissionalId: 'p1', status: 'paga', fechadaEm: '2026-03-01T18:00:00.000Z',
            itens: [{ tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 100 }], pagamentos: [{ meio: 'dinheiro', valor: 100 }],
          },
        },
        vendasRevenda: {
          vUnknown: { id: 'v-unknown', empresaId: EMP, lojaId: STORE, profissionalId: 'user-account-1', status: 'pago', criadoEm: '2026-03-02T15:00:00.000Z', total: 40, itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 1, subtotal: 40 }] },
          vOther: { id: 'v-other', empresaId: EMP, lojaId: 'loja-b', profissionalId: 'p2', status: 'pago', criadoEm: '2026-03-02T16:00:00.000Z', total: 40, itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 1, subtotal: 40 }] },
          vLegacy: { id: 'v-legacy', empresaId: EMP, profissionalId: 'p1', status: 'pago', criadoEm: '2026-03-02T17:00:00.000Z', total: 40, itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 1, subtotal: 40 }] },
        },
      },
      'outra-empresa': {
        profissionais: { pOther: { id: 'pOther', empresaId: 'outra-empresa', nome: 'Outra Empresa', ativo: true } },
      },
    },
    financeiroKytto: {
      empresas: {
        [EMP]: {
          lancamentos: {
            'fin-a1': { id: 'fin-a1', empresaId: EMP, tipo: 'receita', status: 'pago', origem: 'barbearia_atendimento', valor: 50, meioPagamento: 'pix', pagoEm: '2026-03-01T17:00:00.000Z', lojaId: STORE, chaveIdempotencia: `barbearia_atendimento:${EMP}:a1` },
            'fin-wrong': { id: 'fin-wrong', empresaId: EMP, tipo: 'receita', status: 'pago', origem: 'manual', valor: 999, pagoEm: '2026-03-01T12:00:00.000Z', lojaId: STORE },
          },
        },
      },
    },
    barbeariaRepasses: {
      [EMP]: {
        repasses: {
          repLegacy: { id: 'repLegacy', profissionalId: 'p1', profissionalNome: 'Ana', status: 'pago', valorPago: 77, pagoEm: '2026-03-01T20:00:00.000Z' },
        },
      },
    },
    clientesKytto: { empresas: { [EMP]: { clientes: { contact1: { id: 'contact1', nome: 'Cliente Não Funcionário', telefone: '65999999999' } } } } },
  };
}

test('contrato, escopo estrito, catálogo company-wide, dedup, em_conta e congelamento', () => {
  const root = snapshot();
  const before = clone(root);
  freeze(root);
  const result = buildEquipeDesempenho(root, PERIOD);
  assert.deepEqual(root, before, 'snapshot congelado não sofre mutação');
  assert.deepEqual(result.scope, { empresaId: EMP, lojaId: STORE });
  assert.deepEqual(result.period, { inicio: '2026-03-01', fim: '2026-03-02', days: 2, timeZone: 'America/Cuiaba', previousInicio: '2026-02-27', previousFim: '2026-02-28' });
  assert.equal(result.ok, true);
  assert.equal(result.readOnly, true);
  assert.equal(result.writePerformed, false);
  assert.deepEqual(result.employees.map((item) => item.id), ['p1', 'p3']);
  assert.equal(result.employees.some((item) => item.name.includes('Outra Unidade')), false);
  assert.equal(result.employees.some((item) => item.name.includes('Cliente')), false);
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(ana.services, 3, 'comanda paga + em_conta + recebimento de agenda entram na receita apurada');
  assert.equal(ana.products, 1, 'venda com profissional cadastrado é atribuída; venda com usuário sem profissional não');
  assert.equal(ana.completed, 2, 'agenda conta somente unidade exata');
  assert.equal(ana.noShow, 1);
  assert.equal(ana.canceled, 1);
  assert.equal(ana.ticketAverage, 78.57, 'ticket é receita de serviço / quantidade de serviços');
  assert.equal(ana.paidTransfers, null, 'repasse sem loja não prova unidade');
  assert.equal(result.summary.paidTransfers, null);
  assert.equal(result.summary.revenue, 310, 'comanda 120 + em_conta 100 + agenda 50 + venda não atribuída 40');
  assert.equal(result.summary.services, 3);
  assert.equal(result.summary.products, 2, 'produto da comanda e venda não atribuída continuam no agregado');
  assert.equal(result.quality.unscopedExcluded, 3, 'legacy sem unidade é excluído, sem contar outra unidade');
  assert.equal(result.quality.unattributedEvents, 1, 'venda atribuída a conta sem profissional é apenas qualidade');
  assert.equal(result.quality.transfersAvailable, false);
  assert.ok(result.quality.commissionWarnings.some(warning => /Taxa.*não configurada|Configuração.*ausente/.test(warning)));
  assert.equal(ana.heatmap.length, 168);
  assert.equal(ana.daily.length, 2);
  assert.ok(ana.topServices[0].quantity >= 2);
  assert.ok(result.definitions.some((text) => text.includes('não é nota de RH')));
});

test('período inválido, leap day, denominadores zero e filtro de profissional', () => {
  const root = snapshot();
  assert.throws(() => buildEquipeDesempenho(root, { ...PERIOD, inicio: '2026-03-02', fim: '2026-03-01' }), (error) => error.code === 'PERIOD_INVALID');
  assert.throws(() => buildEquipeDesempenho(root, { ...PERIOD, inicio: '2026-01-01', fim: '2026-04-04' }), (error) => error.code === 'PERIOD_INVALID');
  assert.throws(() => buildEquipeDesempenho(root, { ...PERIOD, lojaId: '' }), (error) => error.code === 'EXPLICIT_SCOPE_REQUIRED');
  assert.throws(() => buildEquipeDesempenho(root, { ...PERIOD, profissionalId: 'p2' }), (error) => error.code === 'PROFESSIONAL_NOT_FOUND');
  const zero = buildEquipeDesempenho(root, { empresaId: EMP, lojaId: STORE, inicio: '2024-02-28', fim: '2024-03-01' });
  const clara = zero.employees.find((item) => item.id === 'p3');
  assert.equal(zero.period.days, 3);
  assert.equal(zero.period.previousInicio, '2024-02-25');
  assert.equal(clara.attendanceRate, null);
  assert.equal(clara.ticketAverage, null);
  assert.equal(clara.revenueTrendPct, null);
});

test('repasses com unidade exata ficam disponíveis e são somados pelo pagoEm', () => {
  const root = snapshot();
  delete root.barbeariaRepasses[EMP].repasses.repLegacy;
  root.barbeariaRepasses[EMP].repasses.repStore = { id: 'repStore', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'pago', valorPago: 12.34, pagoEm: '2026-03-02T20:00:00.000Z' };
  const result = buildEquipeDesempenho(root, PERIOD);
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(result.quality.transfersAvailable, true);
  assert.equal(result.summary.paidTransfers, 12.34);
  assert.equal(ana.paidTransfers, 12.34);
});

test('custo de outra unidade não entra na comissão: ausência de baseline fica explícita', () => {
  const root = snapshot();
  root.barbearias[EMP].servicos.sCross = {
    id: 'sCross', empresaId: EMP, lojaId: 'loja-b', nome: 'Serviço cross-unit', preco: 50,
    consumoInterno: [{ produtoId: 'prCross', quantidade: 2 }],
  };
  root.barbearias[EMP].produtosRevenda.prCross = { id: 'prCross', empresaId: EMP, lojaId: 'loja-b', nome: 'Material cross-unit', custoUnitario: 7 };
  root.barbearias[EMP].profissionais.p1.descontaMaterial = true;
  root.barbearias[EMP].comandas.cCross = {
    id: 'cCross', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'paga', fechadaEm: '2026-03-02T19:00:00.000Z',
    itens: [{ tipo: 'servico', servicoId: 'sCross', profissionalId: 'p1', quantidade: 1, subtotal: 50 }], pagamentos: [{ meio: 'dinheiro', valor: 50 }],
  };
  const result = buildEquipeDesempenho(root, PERIOD);
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(ana.serviceRevenue, 285.71);
  assert.ok(result.quality.commissionWarnings.some((warning) => warning.includes('não usou custos de outras unidades')));
  const withoutOtherUnitCost = clone(root);
  withoutOtherUnitCost.barbearias[EMP].produtosRevenda.prCross.custoUnitario = 123456;
  assert.equal(buildEquipeDesempenho(withoutOtherUnitCost, PERIOD).employees.find(item => item.id === 'p1').commission, ana.commission);
  assert.equal(result.summary.revenue, 360);
});

test('heatmap exclui agenda já consolidada, produtos e usa início local mesmo com fechamento em outro dia', () => {
  const root = snapshot();
  delete root.financeiroKytto.empresas[EMP].lancamentos['fin-a1'];
  delete root.barbearias[EMP].agendamentos.a1;
  delete root.barbearias[EMP].agendamentos.aOldCovered;
  delete root.barbearias[EMP].comandas.cEmConta;
  root.barbearias[EMP].agendamentos.aCross = {
    id: 'a-cross-date', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'concluido',
    dataAgenda: '2026-03-01', dataHora: '2026-03-01T04:00:00.000Z', financeiroLancamentoId: 'fin-cross-date',
  };
  root.financeiroKytto.empresas[EMP].lancamentos['fin-cross-date'] = {
    id: 'fin-cross-date', empresaId: EMP, tipo: 'receita', status: 'pago', origem: 'barbearia_atendimento', valor: 30,
    meioPagamento: 'pix', pagoEm: '2026-03-04T17:00:00.000Z', lojaId: STORE, chaveIdempotencia: `barbearia_atendimento:${EMP}:a-cross-date`,
  };
  root.barbearias[EMP].comandas.c1.agendamentoId = 'a-cross-date';
  root.barbearias[EMP].comandas.c1.fechadaEm = '2026-03-02T23:30:00.000Z';
  const result = buildEquipeDesempenho(root, PERIOD);
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(ana.heatmap.reduce((sum, cell) => sum + cell.quantity, 0), 1, 'a agenda coberta não aparece de novo');
  assert.equal(ana.heatmap.reduce((sum, cell) => sum + cell.revenue, 0), 85.71, 'heatmap exclui produto e agenda duplicada');
  assert.equal(ana.heatmap.filter((cell) => cell.quantity > 0).length, 1);
  assert.equal(ana.heatmap.some((cell) => cell.day === 1 && cell.quantity > 0), false, 'fechamento não vira início no mapa');
});

test('venda usa criadoEm canônico, deduplica comanda vinculada e não soma pagamento tardio como nova venda', () => {
  const root = snapshot();
  root.barbearias[EMP].vendasRevenda.vCreated = {
    id: 'v-created', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'pago',
    criadoEm: '2026-03-02T10:00:00.000Z', pagoEm: '2026-03-05T10:00:00.000Z', total: 20,
    itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 1, subtotal: 20 }],
  };
  root.barbearias[EMP].vendasRevenda.vLinked = {
    id: 'v-linked', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', comandaId: 'c1', status: 'pago',
    criadoEm: '2026-03-01T10:00:00.000Z', total: 120, itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 3, subtotal: 120 }],
  };
  const result = buildEquipeDesempenho(root, PERIOD);
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(ana.products, 2, 'produto da comanda e venda criada no período');
  assert.equal(result.summary.products, 3, 'venda sem profissional permanece no agregado, sem duplicar vínculo');
  assert.equal(result.summary.revenue, 330);
  assert.equal(ana.daily.find((day) => day.date === '2026-03-02').revenue, 20);
});

test('recibo de agenda exige conclusão, origem, chave e unidade exatas mesmo quando pago em outra data', () => {
  const root = snapshot();
  root.barbearias[EMP].agendamentos.aCrossReceipt = {
    id: 'a-cross-receipt', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', servicoId: 's1', status: 'concluido',
    dataAgenda: '2026-03-01', dataHora: '2026-03-01T05:00:00.000Z', financeiroLancamentoId: 'fin-cross-receipt',
  };
  root.financeiroKytto.empresas[EMP].lancamentos['fin-cross-receipt'] = {
    id: 'fin-cross-receipt', empresaId: EMP, tipo: 'receita', status: 'pago', origem: 'barbearia_atendimento', valor: 25,
    pagoEm: '2026-03-05T10:00:00.000Z', lojaId: STORE, chaveIdempotencia: `barbearia_atendimento:${EMP}:a-cross-receipt`,
  };
  const valid = buildEquipeDesempenho(root, PERIOD);
  assert.equal(valid.summary.revenue, 335);
  root.financeiroKytto.empresas[EMP].lancamentos['fin-cross-receipt'].chaveIdempotencia = 'wrong-key';
  const invalid = buildEquipeDesempenho(root, PERIOD);
  assert.equal(invalid.summary.revenue, 310, 'recibo sem chave correta não é receita apurada');
});

test('evidências e textos de recomendações são strings sem PII nem ids de origem', () => {
  const result = buildEquipeDesempenho(snapshot(), PERIOD);
  for (const employee of result.employees) {
    for (const note of [...employee.strengths, ...employee.attention, ...employee.suggestions]) {
      assert.equal(typeof note.text, 'string');
      if (note.evidence !== undefined) {
        assert.equal(typeof note.evidence, 'string');
        assert.equal(note.evidence.includes('contact1'), false);
        assert.equal(note.evidence.includes('fin-'), false);
      }
    }
  }
  assert.equal(result.employees.some((employee) => employee.name.includes('Cliente')), false);
});

test('repasses de outra unidade ou somente legados não geram valor zero disponível', () => {
  const root = snapshot();
  root.barbeariaRepasses[EMP].repasses = {
    other: { id: 'other', empresaId: EMP, lojaId: 'loja-b', profissionalId: 'p1', status: 'pago', valorPago: 99, pagoEm: '2026-03-01T10:00:00.000Z' },
  };
  const result = buildEquipeDesempenho(root, PERIOD);
  assert.equal(result.quality.transfersAvailable, false);
  assert.equal(result.summary.paidTransfers, null);
  assert.equal(result.employees.find((item) => item.id === 'p1').paidTransfers, null);
});

test('quantidade inválida não vira unidade financeira e gera aviso objetivo de qualidade', () => {
  const root = snapshot();
  root.barbearias[EMP].vendasRevenda.vInvalidQuantity = {
    id: 'v-invalid-quantity', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'pago', criadoEm: '2026-03-02T10:00:00.000Z', total: 30,
    itens: [{ produtoId: 'pr1', nome: 'Pomada', quantidade: 0, subtotal: 30 }],
  };
  const result = buildEquipeDesempenho(root, PERIOD);
  assert.equal(result.summary.products, 2);
  assert.ok(result.quality.commissionWarnings.some((warning) => warning.includes('Quantidade inválida')));
});

test('período futuro vazio mantém catálogo profissional e não fabrica movimento', () => {
  const result = buildEquipeDesempenho(snapshot(), { empresaId: EMP, lojaId: STORE, inicio: '2099-01-01', fim: '2099-01-02' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.employees.map((item) => item.id), ['p1', 'p3']);
  assert.equal(result.summary.revenue, 0);
  assert.equal(result.summary.services, 0);
  assert.equal(result.summary.products, 0);
  assert.equal(result.employees.every((item) => item.hasActivity === false), true);
});

test('horário operacional permanece quando a comanda fecha fora do período financeiro', () => {
  const root = snapshot();
  root.barbearias[EMP].agendamentos = { a1: root.barbearias[EMP].agendamentos.a1 };
  root.barbearias[EMP].comandas = { c1: { ...root.barbearias[EMP].comandas.c1, agendamentoId: 'a1', fechadaEm: '2026-03-05T17:00:00Z' } };
  root.barbearias[EMP].vendasRevenda = {};
  const result = buildEquipeDesempenho(root, PERIOD);
  const employee = result.employees.find(item => item.id === 'p1');
  assert.equal(result.summary.revenue, 0);
  assert.equal(result.summary.completed, 1);
  assert.equal(employee.heatmap.reduce((sum, cell) => sum + cell.quantity, 0), 1);
  assert.equal(employee.heatmap.find(cell => cell.quantity)?.hour, 9);
  assert.equal(employee.heatmap.reduce((sum, cell) => sum + cell.revenue, 0), 0);
  assert.equal(employee.daily.reduce((sum, row) => sum + row.revenue, 0), 0);
});

test('repasses exatos coexistindo com legado sem unidade ficam indisponíveis, nunca um total aparentemente completo', () => {
  const root = snapshot();
  root.barbeariaRepasses[EMP].repasses.exact = { id: 'exact', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', status: 'pago', valorPago: 10, pagoEm: '2026-03-01T12:00:00Z' };
  root.barbeariaRepasses[EMP].repasses.other = { id: 'other', empresaId: EMP, lojaId: 'loja-b', profissionalId: 'p1', status: 'pago', valorPago: 30, pagoEm: '2026-03-01T12:00:00Z' };
  const result = buildEquipeDesempenho(root, PERIOD);
  assert.equal(result.summary.paidTransfers, null);
  assert.equal(result.quality.transfersAvailable, false);
  assert.equal(result.employees.find(item => item.id === 'p1').paidTransfers, null);
  assert.ok(result.quality.commissionWarnings.some(item => item.includes('repasses pagos sem unidade comprovada')));
  delete root.barbeariaRepasses[EMP].repasses.repLegacy;
  assert.equal(buildEquipeDesempenho(root, PERIOD).summary.paidTransfers, 10);
});

test('comandas com mesmo atendimento são ambíguas e excluídas sem escolha financeira ou mutação', () => {
  const root = snapshot();
  root.barbearias[EMP].agendamentos = { a1: root.barbearias[EMP].agendamentos.a1 };
  root.barbearias[EMP].comandas = {
    c1: { ...root.barbearias[EMP].comandas.c1, agendamentoId: 'a1' },
    c2: { ...root.barbearias[EMP].comandas.c1, id: 'c2', agendamentoId: 'a1' },
  };
  root.barbearias[EMP].vendasRevenda = { linked: { id: 'linked', empresaId: EMP, lojaId: STORE, profissionalId: 'p1', comandaId: 'c1', status: 'pago', criadoEm: '2026-03-01T12:00:00Z', total: 999, itens: [{ tipo: 'produto', quantidade: 1, subtotal: 999 }] } };
  const before = clone(root); freeze(root);
  const result = buildEquipeDesempenho(root, PERIOD);
  assert.equal(result.summary.revenue, 0);
  assert.equal(result.summary.commission, 0);
  assert.equal(result.summary.services, 0);
  assert.equal(result.quality.ambiguousCommandsExcluded, 2);
  assert.ok(result.quality.commissionWarnings.some(item => item.includes('Receita e comissão são parciais')));
  assert.equal(result.summary.completed, 1);
  assert.equal(result.employees.find(item => item.id === 'p1').heatmap.reduce((sum, cell) => sum + cell.quantity, 0), 1);
  assert.deepEqual(root, before);
});

test('histórico Avec atribui serviços ao profissional e total consolida Financeiro e e-commerce sem duplicar o detalhamento', () => {
  const root = snapshot();
  root.barbearias[EMP].historicoAtendimentos = {
    hist1: {
      id: 'hist1', empresaId: EMP, lojaId: STORE, somenteHistorico: true, status: 'concluido',
      dataAgenda: '2026-03-01', clienteNome: 'Cliente histórico', profissionalId: 'p1', profissionalNome: 'Ana',
      servicoId: 's1', servicoNome: 'Corte Avec', valor: 80, total: 80, quantidade: 1,
    },
  };
  root.financeiroKytto.empresas[EMP].lancamentos.histFin = {
    id: 'histFin', empresaId: EMP, lojaId: STORE, origem: 'avec-import-financeiro-20261022',
    metadata: { historicoAvec: true }, tipo: 'receita', status: 'pago', valor: 200, dataOperacao: '2026-03-01T12:00:00.000Z', pagoEm: '2026-03-01T12:00:00.000Z',
  };
  const result = buildEquipeDesempenho(root, { ...PERIOD, commerceCurrent: { revenue: 300, orders: 2 } });
  const ana = result.employees.find((item) => item.id === 'p1');
  assert.equal(ana.historicalServices, 1);
  assert.equal(ana.historicalServiceRevenue, 80);
  assert.equal(ana.serviceRevenue, 315.71);
  assert.equal(result.summary.historicalFinanceRevenue, 200);
  assert.equal(result.summary.commerceRevenue, 300);
  assert.equal(result.summary.commerceOrders, 2);
  assert.equal(result.summary.historicalAttributedServiceRevenue, 80);
  assert.equal(result.summary.revenue, 810, 'o detalhamento histórico é atribuído, mas não é somado novamente ao extrato pago');
});

test('histórico completo: período desde o 1º registro, ex-profissional com valor fica ativo e histórico sem vínculo vira linha própria', () => {
  const root = snapshot();
  root.barbearias[EMP].profissionais.p5 = { id: 'p5', empresaId: EMP, nome: 'Ex Avec', lojaId: STORE, ativo: false };
  root.barbearias[EMP].historicoAtendimentos = {
    h1: { id: 'h1', empresaId: EMP, lojaId: STORE, somenteHistorico: true, status: 'concluido', dataAgenda: '2023-05-10', clienteNome: 'Cliente A', profissionalId: 'p5', servicoNome: 'Corte Avec', valor: 50, quantidade: 1 },
    h2: { id: 'h2', empresaId: EMP, lojaId: STORE, somenteHistorico: true, status: 'concluido', dataAgenda: '2024-01-02', clienteNome: 'Cliente B', profissionalId: null, profissionalNome: 'Não informado', servicoNome: 'Barba Avec', valor: 30, quantidade: 1 },
  };
  const before = clone(root); freeze(root);
  const result = buildEquipeDesempenho(root, { empresaId: EMP, lojaId: STORE, fim: '2026-03-02', historico: true, lean: true });
  assert.equal(result.period.inicio, '2023-05-10');
  assert.equal(result.period.historico, true);
  assert.equal(result.seriesGranularity, 'month');
  const ex = result.employees.find((item) => item.id === 'p5');
  assert.equal(ex.revenue, 50);
  assert.equal(ex.active, true, 'quem tem valor aparece ativo');
  assert.equal(ex.registeredActive, false);
  assert.equal(ex.activeByMovement, true);
  assert.equal(ex.heatmap, undefined, 'lista enxuta não carrega mapa por pessoa');
  const sem = result.employees.find((item) => item.id === UNATTRIBUTED_PROFESSIONAL_ID);
  assert.equal(sem.revenue, 30);
  assert.equal(sem.synthetic, true);
  assert.equal(sem.commission, 0);
  assert.equal(result.summary.unattributedHistoricalRevenue, 30);
  const serie = result.teamSeries.reduce((sum, item) => sum + item.revenue, 0);
  const pessoas = result.employees.reduce((sum, item) => sum + item.revenue, 0);
  assert.ok(Math.abs(serie - pessoas) < 0.05, `série da equipe (${serie}) = soma das linhas (${pessoas})`);
  assert.equal(result.teamSeries[0].date, '2023-05');
  assert.ok(result.summary.activeByMovement >= 1);
  assert.equal(result.employees.find((item) => item.id === 'p3').active, true);
  assert.deepEqual(root, before);
});

test('detalhe por profissional traz linhas para drill-down (ano/mês/dia/atendimento) com série mensal no histórico', () => {
  const root = snapshot();
  root.barbearias[EMP].historicoAtendimentos = {
    h1: { id: 'h1', empresaId: EMP, lojaId: STORE, somenteHistorico: true, status: 'concluido', dataAgenda: '2024-12-30', clienteNome: 'Cliente A', profissionalId: 'p1', servicoNome: 'Corte Avec', frenteAtuacao: 'Cabelo', valor: 50, quantidade: 1 },
  };
  const detail = buildEquipeDesempenho(root, { empresaId: EMP, lojaId: STORE, fim: '2026-03-02', historico: true, profissionalId: 'p1' });
  const ana = detail.employees[0];
  assert.equal(detail.employees.length, 1);
  assert.ok(Array.isArray(ana.rows) && ana.rows.length >= 1);
  const hist = ana.rows.find((row) => row.origin === 'historico_avec');
  assert.deepEqual({ date: hist.date, client: hist.client, group: hist.group, revenue: hist.revenue, type: hist.type }, { date: '2024-12-30', client: 'Cliente A', group: 'Cabelo', revenue: 50, type: 'servico' });
  assert.ok(ana.daily.every((item) => /^\d{4}-\d{2}$/.test(item.date)));
  assert.equal(ana.daily.find((item) => item.date === '2024-12').revenue, 50);
  const sem = buildEquipeDesempenho(root, { ...PERIOD, profissionalId: UNATTRIBUTED_PROFESSIONAL_ID });
  assert.equal(sem.employees.length, 0, 'sem histórico sem vínculo no recorte, nada é inventado');
  assert.throws(() => buildEquipeDesempenho(root, { ...PERIOD, inicio: '2025-01-01' }), (error) => error.code === 'PERIOD_INVALID', 'fora do modo histórico o limite de 93 dias continua');
});
