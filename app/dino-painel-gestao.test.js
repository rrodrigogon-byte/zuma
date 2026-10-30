import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPainelGestao, buildComparativo, salvarMetasPainel, obterMetasPainel, categoriaDoServico } from './dino-painel-gestao.js';

const EMP = 'emp-painel';
const LOJA = 'loja-a';
const AGORA = Date.parse('2026-10-29T14:00:00.000Z'); // 10:00 em Cuiabá

function raiz() {
  return {
    barbearias: {
      [EMP]: {
        configuracao: { taxasPagamento: {}, horarioAbertura: '08:00', horarioFechamento: '20:00', intervaloMinutos: 30, diasFuncionamento: [1, 2, 3, 4, 5, 6] },
        profissionais: {
          p1: { id: 'p1', empresaId: EMP, nome: 'Bruno Mendes', apelido: 'Bruno', ativo: true, percentualComissao: 50 },
          p2: { id: 'p2', empresaId: EMP, nome: 'Natani', ativo: true, percentualComissao: 45 },
          p3: { id: 'p3', empresaId: EMP, nome: 'Folga Quinta', ativo: true, percentualComissao: 40, diasTrabalho: [1, 2] },
        },
        servicos: {
          s1: { id: 's1', empresaId: EMP, lojaId: LOJA, nome: 'Corte', categoria: 'Cabelo', preco: 60, custoMaterial: 0 },
          s2: { id: 's2', empresaId: EMP, lojaId: LOJA, nome: 'Barba', categoria: 'Barba', preco: 40, custoMaterial: 0 },
          s3: { id: 's3', empresaId: EMP, lojaId: LOJA, nome: 'Hidratação', categoria: 'Cabelo', preco: 30, custoMaterial: 0 },
        },
        produtosRevenda: { pr1: { id: 'pr1', empresaId: EMP, lojaId: LOJA, nome: 'Pomada', precoVenda: 40, custoUnitario: 10 } },
        agendamentos: {
          a1: { id: 'a1', empresaId: EMP, lojaId: LOJA, profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataAgenda: '2026-10-29', horaLocal: '09:00', dataHora: '2026-10-29T13:00:00.000Z', duracaoMinutos: 30, valor: 60 },
          a2: { id: 'a2', empresaId: EMP, lojaId: LOJA, profissionalId: 'p1', servicoId: 's1', status: 'agendado', dataAgenda: '2026-10-29', horaLocal: '11:00', dataHora: '2026-10-29T15:00:00.000Z', duracaoMinutos: 30, valor: 60 },
          a3: { id: 'a3', empresaId: EMP, lojaId: LOJA, profissionalId: 'p2', servicoId: 's2', status: 'cancelado', dataAgenda: '2026-10-29', horaLocal: '11:00', dataHora: '2026-10-29T15:00:00.000Z', duracaoMinutos: 30, valor: 40 },
          a4: { id: 'a4', empresaId: EMP, lojaId: LOJA, profissionalId: 'p2', servicoId: 's2', status: 'confirmado', dataAgenda: '2026-10-29', horaLocal: '09:30', dataHora: '2026-10-29T13:30:00.000Z', duracaoMinutos: 30, valor: 40 },
          a5: { id: 'a5', empresaId: EMP, lojaId: LOJA, profissionalId: 'p2', servicoId: 's1', status: 'agendado', dataAgenda: '2026-10-29', horaLocal: '15:00', dataHora: '2026-10-29T19:00:00.000Z', duracaoMinutos: 30, valor: 60, usarPlano: true, assinaturaId: 'ass1' },
        },
        comandas: {
          c1: {
            id: 'c1', empresaId: EMP, lojaId: LOJA, profissionalId: 'p1', agendamentoId: 'a1', status: 'paga', fechadaEm: '2026-10-29T13:40:00.000Z',
            itens: [
              { id: 'i1', tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 60 },
              { id: 'i2', tipo: 'servico', servicoId: 's3', nome: 'Hidratação', profissionalId: 'p1', quantidade: 1, subtotal: 30 },
              { id: 'i3', tipo: 'produto', produtoId: 'pr1', nome: 'Pomada', profissionalId: 'p1', quantidade: 1, subtotal: 40 },
            ],
            pagamentos: [{ id: 'pg1', meio: 'pix', valor: 130 }],
          },
          cBalcao: {
            id: 'cBalcao', empresaId: EMP, lojaId: LOJA, profissionalId: 'p2', status: 'paga', fechadaEm: '2026-10-29T12:30:00.000Z',
            itens: [{ id: 'i4', tipo: 'servico', servicoId: 's2', nome: 'Barba', profissionalId: 'p2', quantidade: 1, subtotal: 40 }],
            pagamentos: [{ id: 'pg2', meio: 'dinheiro', valor: 40 }],
          },
          cOntem: {
            id: 'cOntem', empresaId: EMP, lojaId: LOJA, profissionalId: 'p1', status: 'paga', fechadaEm: '2026-10-28T18:00:00.000Z',
            itens: [{ id: 'i5', tipo: 'servico', servicoId: 's1', nome: 'Corte', profissionalId: 'p1', quantidade: 1, subtotal: 60 }],
            pagamentos: [{ id: 'pg3', meio: 'pix', valor: 60 }],
          },
        },
        vendasRevenda: {},
      },
    },
    barbeariaCaptacao: {
      [EMP]: {
        assinaturas: { ass1: { pagamentos: [{ id: 'asspag1', valor: 150, meio: 'pix', registradoEm: '2026-10-29T13:10:00.000Z' }] } },
        metasProfissionais: { '2026-10': { p2: { receita: 2700 } } },
      },
    },
    financeiroKytto: { empresas: { [EMP]: { lancamentos: {} } } },
  };
}

test('categorias: corte, barba, combo e extras pelo nome mesmo na categoria Cabelo', () => {
  assert.equal(categoriaDoServico({ categoria: 'Cabelo' }, 'Corte'), 'Cabelo');
  assert.equal(categoriaDoServico({ categoria: 'Barba' }, 'Barba'), 'Barba');
  assert.equal(categoriaDoServico({ categoria: 'Cabelo e Barba' }, 'Corte + barba'), 'Cabelo e barba');
  assert.equal(categoriaDoServico({ categoria: 'Cabelo' }, 'Hidratação'), 'Serviços extras');
  assert.equal(categoriaDoServico({ categoria: 'SPA' }, 'Spa dos pés'), 'Serviços extras');
  assert.equal(categoriaDoServico({ categoria: 'Club' }, 'Corte Club'), 'Club');
  assert.equal(categoriaDoServico({}, 'Corte e barba'), 'Cabelo e barba');
});

test('painel do dia: realizado, meta, projeção pela agenda, ranking e alertas', () => {
  const root = raiz();
  salvarMetasPainel(root, EMP, { metaEquipe: 1000, individuais: { p1: 500 } });
  const painel = buildPainelGestao(root, { empresaId: EMP, lojaId: LOJA, agoraMs: AGORA });
  assert.equal(painel.data, '2026-10-29');
  assert.equal(painel.ehHoje, true);
  assert.equal(painel.horaAtual, '10:00');
  assert.equal(painel.kpis.realizado, 170, 'comanda 130 + balcão 40; ontem não entra');
  assert.equal(painel.kpis.servicos, 130);
  assert.equal(painel.kpis.produtos, 40);
  assert.equal(painel.kpis.meta, 1000);
  assert.equal(painel.kpis.falta, 830);
  assert.equal(painel.kpis.percentualMeta, 17);
  assert.equal(painel.kpis.atendimentosConcluidos, 2, 'a1 concluído + comanda de balcão');
  assert.equal(painel.kpis.agendaRestante, 100, 'a2 (60) + a4 atrasado (40); a5 é do plano');
  assert.equal(painel.kpis.projecaoFechamento, 270);
  assert.equal(painel.kpis.gapEstimado, 730);
  assert.deepEqual(painel.pacotes, { quantidade: 1, valor: 150, itens: [{ assinaturaId: 'ass1', valor: 150, meio: 'pix' }] });
  const cat = Object.fromEntries(painel.categorias.map((item) => [item.categoria, item.valor]));
  assert.deepEqual(cat, { Cabelo: 60, Barba: 40, 'Serviços extras': 30, Produtos: 40 });
  assert.deepEqual(painel.extras, [{ servico: 'Hidratação', quantidade: 1, valor: 30 }]);

  assert.deepEqual(painel.ranking.map((item) => item.profissionalId), ['p1', 'p2'], 'quem folga e não tem agenda fica fora');
  const bruno = painel.ranking[0];
  assert.equal(bruno.nome, 'Bruno');
  assert.equal(bruno.total, 130);
  assert.equal(bruno.servicos, 90);
  assert.equal(bruno.produtos, 40);
  assert.equal(bruno.meta, 500);
  assert.equal(bruno.percentualMeta, 26);
  assert.equal(bruno.extrasQuantidade, 1);
  assert.equal(bruno.agenda.concluidos, 1);
  assert.equal(bruno.agenda.proximos, 1);
  assert.equal(bruno.agenda.pontualidade, 'em_dia');
  assert.equal(bruno.horarioLivre, '10:00');
  const nati = painel.ranking[1];
  assert.equal(nati.meta, 100, 'meta mensal 2.700 / 27 dias de trabalho em outubro');
  assert.equal(nati.metaOrigem, 'meta_mensal');
  assert.equal(nati.agenda.cancelamentos, 1);
  assert.equal(nati.agenda.atrasos[0].minutos, 30);
  assert.equal(nati.agenda.pontualidade, 'atraso');
  assert.deepEqual(painel.alertas.map((item) => item.tipo).sort(), ['atraso', 'cancelamento']);
  assert.equal(painel.acoes.length, 3);

  const agora = painel.curva.find((ponto) => ponto.agora);
  assert.equal(agora.realizado, 170);
  assert.equal(painel.curva.find((ponto) => ponto.hora === '09h').realizado, 40, 'balcão às 08:30');
  assert.equal(painel.curva.at(-1).projecao, 270);
  assert.equal(painel.curva.find((ponto) => ponto.hora === '12h').projecao, 270);
});

test('painel de dia passado não tem agenda restante e a meta cai na soma das individuais', () => {
  const root = raiz();
  const painel = buildPainelGestao(root, { empresaId: EMP, lojaId: LOJA, data: '2026-10-28', agoraMs: AGORA });
  assert.equal(painel.ehHoje, false);
  assert.equal(painel.kpis.realizado, 60);
  assert.equal(painel.kpis.agendaRestante, 0);
  assert.equal(painel.kpis.meta, 100, 'só a Nati tem meta (mensal)');
  assert.equal(painel.kpis.metaOrigem, 'soma_individuais');
  assert.equal(painel.curva.at(-1).realizado, 60);
});

test('metas: salvar, limpar e validar profissional', () => {
  const root = raiz();
  const validos = new Set(['p1', 'p2']);
  assert.deepEqual(salvarMetasPainel(root, EMP, { metaEquipe: '3000', individuais: { p1: 1000 } }, { profissionaisValidos: validos }).individuais, { p1: 1000 });
  assert.equal(obterMetasPainel(root, EMP).metaEquipe, 3000);
  assert.equal(salvarMetasPainel(root, EMP, { metaEquipe: '', individuais: { p1: null } }).metaEquipe, null);
  assert.deepEqual(obterMetasPainel(root, EMP).individuais, {});
  assert.throws(() => salvarMetasPainel(root, EMP, { individuais: { x9: 10 } }, { profissionaisValidos: validos }), /Profissional/);
  assert.throws(() => salvarMetasPainel(root, EMP, { metaEquipe: -5 }), /Meta inválida/);
});

test('comparativo entre dois dias', () => {
  const root = raiz();
  const cmp = buildComparativo(root, { empresaId: EMP, lojaId: LOJA, inicioA: '2026-10-29', fimA: '2026-10-29', inicioB: '2026-10-28', fimB: '2026-10-28' });
  assert.equal(cmp.kpis.faturamento.a, 170);
  assert.equal(cmp.kpis.faturamento.b, 60);
  assert.equal(cmp.kpis.faturamento.variacao, 183.3);
  assert.equal(cmp.kpis.atendimentos.a, 2);
  assert.equal(cmp.categorias.find((item) => item.categoria === 'Cabelo').b, 60);
  assert.equal(cmp.profissionais[0].profissionalId, 'p1');
  assert.equal(cmp.profissionais[0].a.faturamento, 130);
  assert.equal(cmp.profissionais[0].b.faturamento, 60);
  const soBruno = buildComparativo(root, { empresaId: EMP, lojaId: LOJA, inicioA: '2026-10-29', fimA: '2026-10-29', inicioB: '2026-10-28', fimB: '2026-10-28', profissionalId: 'p1' });
  assert.equal(soBruno.kpis.faturamento.a, 130);
  assert.throws(() => buildComparativo(root, { empresaId: EMP, lojaId: LOJA, inicioA: '2026-01-01', fimA: '2026-06-01', inicioB: '2026-10-28', fimB: '2026-10-28' }), /93 dias/);
});

test('comparativo: período do Avec fecha com o extrato pago (categorias, não atribuído e curva)', () => {
  const root = raiz();
  root.financeiroKytto.empresas[EMP].lancamentos = {
    f1: { id: 'f1', empresaId: EMP, lojaId: LOJA, tipo: 'receita', status: 'pago', valor: 300, pagoEm: '2026-09-10', origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true } },
    f2: { id: 'f2', empresaId: EMP, lojaId: LOJA, tipo: 'receita', status: 'pago', valor: 200, pagoEm: '2026-09-12T15:00:00.000Z', origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true } },
    f3: { id: 'f3', empresaId: EMP, lojaId: LOJA, tipo: 'despesa', status: 'pago', valor: 999, pagoEm: '2026-09-12', origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true } },
  };
  const cmp = buildComparativo(root, { empresaId: EMP, lojaId: LOJA, inicioA: '2026-10-28', fimA: '2026-10-29', inicioB: '2026-09-01', fimB: '2026-09-30' });
  assert.equal(cmp.b.faturamento, 500, 'só receitas pagas do extrato');
  assert.equal(cmp.b.naoDetalhado, 500);
  assert.equal(cmp.b.serie.at(-1).acumulado, 500, 'a curva fecha com o faturamento');
  assert.equal(cmp.b.serie.find((p) => p.data === '2026-09-10').acumulado, 300);
  assert.equal(cmp.b.ocupacao, null, 'sem agenda no período: sem dado');
  assert.equal(cmp.b.produtos, null, 'produto do Avec não detalhado: sem dado');
  const categoria = cmp.categorias.find((item) => item.categoria === 'Não detalhado no Avec');
  assert.equal(categoria.b, 500);
  const naoAtribuido = cmp.profissionais.find((item) => item.sintetico);
  assert.equal(naoAtribuido.b.faturamento, 500);
  assert.equal(cmp.profissionais.at(-1).sintetico, true, 'linha sintética fica por último');
  assert.equal(cmp.a.serie.at(-1).acumulado, cmp.a.faturamento);
  assert.ok(cmp.kpis.clientes);
});
