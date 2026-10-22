import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDinoCustomerAssistant } from './dino-customer-assistant.js';

const now = new Date('2026-05-31T16:00:00.000Z');
const base = {
  customerId: 'cli-1',
  identityVerified: true,
  storeId: 'loja-1',
  now,
  services: [
    { id: 'corte', nome: 'Corte', categoria: 'Cabelo', ativo: true, intervaloRecomendacaoDias: 14 },
    { id: 'barba', nome: 'Barba', categoria: 'Barba', ativo: true, intervaloRecomendacaoDias: 30 },
    { id: 'pigmentacao', nome: 'Pigmentação', categoria: 'Coloração', ativo: true, intervaloRecomendacaoDias: 20 },
    { id: 'sem-regra', nome: 'Sem regra', categoria: 'Geral', ativo: true, intervaloRecomendacaoDias: 0 },
  ],
  products: [
    { id: 'pomada', nome: 'Pomada', ativo: true, estoqueAtual: 5, precoVenda: 49.9, intervaloRecompraDias: 30 },
    { id: 'shampoo', nome: 'Shampoo', ativo: true, estoqueAtual: 2, precoVenda: 29.9, intervaloRecompraDias: 30 },
    { id: 'indisponivel', nome: 'Produto sem estoque', ativo: true, estoqueAtual: 0, precoVenda: 20, intervaloRecompraDias: 30 },
    { id: 'inativo', nome: 'Produto inativo', ativo: false, estoqueAtual: 8, precoVenda: 19, intervaloRecompraDias: 1 },
  ],
  appointments: [
    { id: 'a1', clienteId: 'cli-1', lojaId: 'loja-1', status: 'concluido', servicoId: 'corte', servicoNome: 'Corte', dataAgenda: '2026-05-24' },
    { id: 'a2', clienteId: 'cli-1', lojaId: 'loja-1', status: 'agendado', servicoId: 'corte', servicoNome: 'Corte', dataAgenda: '2026-06-10' },
    { id: 'a3', clienteId: 'cli-1', lojaId: 'loja-1', status: 'cancelado', servicoId: 'pigmentacao', servicoNome: 'Pigmentação', dataAgenda: '2026-05-20' },
    { id: 'a4', clienteId: 'cli-outro', lojaId: 'loja-1', status: 'concluido', servicoId: 'barba', servicoNome: 'Barba', dataAgenda: '2026-05-01' },
  ],
  historicalAppointments: [
    { id: 'hist-1', clienteId: 'cli-1', lojaId: 'loja-1', status: 'concluido', servicoId: 'barba', servicoNome: 'Barba', dataAgenda: '2026-05-01' },
    { id: 'hist-2', clienteId: 'cli-1', lojaId: 'loja-1', status: 'concluido', servicoId: 'sem-regra', servicoNome: 'Sem regra', dataAgenda: '2026-05-25' },
  ],
  comandas: [
    { id: 'c1', clienteId: 'cli-1', lojaId: 'loja-1', status: 'paga', atualizadoEm: '2026-05-24T17:00:00.000Z', itens: [
      { id: 'i1', tipo: 'servico', servicoId: 'corte', nome: 'Corte' },
      { id: 'i2', tipo: 'produto', produtoId: 'shampoo', nome: 'Shampoo', quantidade: 1 },
    ] },
    { id: 'c2', clienteId: 'cli-1', lojaId: 'loja-1', status: 'pendente', atualizadoEm: '2026-05-31T10:00:00.000Z', itens: [
      { tipo: 'servico', servicoId: 'pigmentacao', nome: 'Pigmentação' },
      { tipo: 'produto', produtoId: 'pomada', nome: 'Pomada', quantidade: 1 },
    ] },
    { id: 'c3', clienteId: 'cli-1', lojaId: 'outra-loja', status: 'paga', atualizadoEm: '2026-04-01T12:00:00.000Z', itens: [
      { tipo: 'servico', servicoId: 'pigmentacao', nome: 'Pigmentação' },
    ] },
  ],
  retailSales: [
    { id: 'v1', clienteId: 'cli-1', lojaId: 'loja-1', status: 'pago', criadoEm: '2026-05-01T15:00:00.000Z', itens: [
      { produtoId: 'pomada', nome: 'Pomada', quantidade: 1 },
      { produtoId: 'indisponivel', nome: 'Produto sem estoque', quantidade: 1 },
      { produtoId: 'inativo', nome: 'Produto inativo', quantidade: 1 },
    ] },
    { id: 'v2', clienteId: 'cli-1', lojaId: 'loja-1', status: 'pendente', criadoEm: '2026-04-01T15:00:00.000Z', itens: [
      { produtoId: 'pomada', nome: 'Pomada', quantidade: 1 },
    ] },
  ],
};

test('histórico une agenda, comanda paga e importação sem duplicar mesmo serviço no mesmo dia', () => {
  const result = buildDinoCustomerAssistant(base);
  assert.equal(result.disponivel, true);
  const corte = result.historicoServicos.find((item) => item.serviceId === 'corte');
  assert.equal(corte.atendimentos, 1, 'agenda e comanda no mesmo dia contam uma ocorrência');
  assert.equal(corte.ultimaRealizacaoEm, '2026-05-24');
  assert.equal(corte.diasDesdeUltima, 7);
  const barba = result.historicoServicos.find((item) => item.serviceId === 'barba');
  assert.equal(barba.diasDesdeUltima, 30);
  assert.ok(barba.origens.includes('historico_importado'));
  assert.ok(!result.historicoServicos.some((item) => item.servicoId === 'pigmentacao'), 'cancelamentos, pendências, outra unidade e outro cliente são excluídos');
});

test('oportunidades respeitam intervalo, agenda futura, serviço atual e serviços recentes', () => {
  const result = buildDinoCustomerAssistant(base);
  assert.deepEqual(result.servicosParaOferecer.map((item) => item.servicoId), ['barba']);
  assert.ok(result.servicosRecentes.some((item) => item.servicoId === 'sem-regra' && item.diasDesdeUltima === 6));
  assert.ok(result.servicosRecentes.some((item) => item.servicoId === 'sem-regra' && item.motivo === 'intervalo_nao_configurado'));
  const booked = buildDinoCustomerAssistant({ ...base, appointments: [...base.appointments, { id: 'a5', clienteId: 'cli-1', lojaId: 'loja-1', status: 'confirmado', servicoId: 'barba', dataAgenda: '2026-06-10' }] });
  assert.deepEqual(booked.servicosParaOferecer, [], 'não oferece procedimento já agendado');
  const duringBarba = buildDinoCustomerAssistant({ ...base, currentServiceId: 'barba' });
  assert.deepEqual(duringBarba.servicosParaOferecer, [], 'não sugere o serviço do atendimento atual');
});

test('produtos dependem de compra paga/faturada, intervalo vencido, estoque e unidade conhecida', () => {
  const result = buildDinoCustomerAssistant(base);
  assert.deepEqual(result.oportunidadesProdutos.map((item) => item.produtoId), ['pomada']);
  assert.equal(result.oportunidadesProdutos[0].diasDesdeUltima, 30);
  assert.ok(result.produtosRecentes.some((item) => item.produtoId === 'shampoo'));
  assert.ok(!result.oportunidadesProdutos.some((item) => ['indisponivel', 'inativo'].includes(item.produtoId)));
  assert.ok(result.historicoProdutos.some((item) => item.produtoId === 'inativo'), 'compra permanece no histórico mesmo após inativação do cadastro');
  assert.equal(result.historicoProdutos.find((item) => item.produtoId === 'pomada').compras, 1, 'venda pendente não conta como compra');
});

test('histórico com unidade indefinida aparece como contexto, mas não gera oferta automática', () => {
  const unscoped = buildDinoCustomerAssistant({
    ...base,
    appointments: [], comandas: [], retailSales: [],
    historicalAppointments: base.historicalAppointments.map(({ lojaId, ...item }) => item),
  });
  assert.equal(unscoped.historicoServicos.find((item) => item.serviceId === 'barba').unidadeIndefinida, true);
  assert.equal(unscoped.servicosParaOferecer.length, 0);
  assert.ok(unscoped.servicosRecentes.some((item) => item.servicoId === 'barba' && item.motivo === 'unidade_nao_identificada'));
});

test('sem vínculo individual confirmado não mostra histórico nem recomendações', () => {
  const result = buildDinoCustomerAssistant({ ...base, identityVerified: false });
  assert.equal(result.disponivel, false);
  assert.equal(result.motivo, 'vinculo_nao_confirmado');
  assert.deepEqual(result.servicosParaOferecer, []);
  assert.deepEqual(result.historicoProdutos, []);
});

test('sem unidade selecionada não mistura histórico ou oportunidades de lojas diferentes', () => {
  const result = buildDinoCustomerAssistant({ ...base, storeId: '' });
  assert.equal(result.disponivel, false);
  assert.equal(result.motivo, 'unidade_nao_selecionada');
  assert.deepEqual(result.historicoServicos, []);
  assert.deepEqual(result.oportunidadesProdutos, []);
});
