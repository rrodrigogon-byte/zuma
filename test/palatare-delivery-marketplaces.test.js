import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterConfiguracaoCanais,
  atualizarCanal,
  testarConexaoCanal,
  sincronizarCardapioMarketplace,
  listarPedidosMulticanal,
  atualizarStatusPedidoDelivery,
  simularPedidoMarketplace,
  obterRelatorioConciliacaoCanais,
  receberWebhookExterno
} from '../app/modules/pizzaria/delivery-marketplaces.js';
import { PALATARE_EMPRESA_ID } from '../app/palatare-pizzaria-seed.js';

test('1. Hub de Delivery: canais iFood, Keeta, WhatsApp e Open Delivery inicializados', () => {
  const { sucesso, canais, resumo } = obterConfiguracaoCanais(PALATARE_EMPRESA_ID);
  assert.equal(sucesso, true);
  assert.ok(canais.length >= 4, 'Deve conter pelo menos 4 canais de delivery');

  const ifood = canais.find(c => c.id === 'ifood');
  assert.ok(ifood, 'Canal iFood deve existir');
  assert.equal(ifood.tipo, 'marketplace');
  assert.equal(ifood.statusConexao, 'conectado');
  assert.equal(ifood.comissaoPercentualPadrao, 23.0);

  const keeta = canais.find(c => c.id === 'keeta');
  assert.ok(keeta, 'Canal Keeta deve existir');
  assert.equal(keeta.tipo, 'marketplace');
  assert.equal(keeta.statusConexao, 'conectado');

  const wpp = canais.find(c => c.id === 'whatsapp_proprio');
  assert.ok(wpp, 'Canal WhatsApp próprio deve existir');
  assert.equal(wpp.tipo, 'proprio');
  assert.equal(wpp.comissaoPercentualPadrao, 0.0, 'WhatsApp próprio deve ter 0% de comissão');

  assert.ok(resumo.totalCanaisAtivos >= 3);
});

test('2. Conexão e sincronização de cardápio com iFood e Keeta', () => {
  const pingIfood = testarConexaoCanal(PALATARE_EMPRESA_ID, 'ifood');
  assert.equal(pingIfood.sucesso, true);
  assert.equal(pingIfood.status, 'conectado');
  assert.ok(pingIfood.latenciaMs > 0);

  const syncKeeta = sincronizarCardapioMarketplace(PALATARE_EMPRESA_ID, 'keeta');
  assert.equal(syncKeeta.sucesso, true);
  assert.ok(syncKeeta.itensSincronizados >= 40);
});

test('3. Listagem e ciclo de vida de pedidos multicanal', () => {
  const lista = listarPedidosMulticanal(PALATARE_EMPRESA_ID);
  assert.equal(lista.sucesso, true);
  assert.ok(lista.pedidos.length >= 3, 'Deve conter pedidos iniciais');

  const p1 = lista.pedidos[0];
  const atualizado = atualizarStatusPedidoDelivery(PALATARE_EMPRESA_ID, p1.id, 'despachado', {
    motoboy: { nome: 'Carlos Motoboy', status: 'Em trânsito' }
  });
  assert.equal(atualizado.sucesso, true);
  assert.equal(atualizado.novoStatus, 'despachado');
  assert.equal(atualizado.pedido.motoboy.nome, 'Carlos Motoboy');
});

test('4. Simulação de pedido iFood e Keeta para homologação', () => {
  const simIfood = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'ifood');
  assert.equal(simIfood.sucesso, true);
  assert.ok(simIfood.pedido.codigoExibicao.startsWith('#IF-'));
  assert.equal(simIfood.pedido.canal, 'ifood');
  assert.ok(simIfood.pedido.totalBruto > 0);

  const simKeeta = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'keeta');
  assert.equal(simKeeta.sucesso, true);
  assert.ok(simKeeta.pedido.codigoExibicao.startsWith('#KT-'));
  assert.equal(simKeeta.pedido.canal, 'keeta');
});

test('5. Conciliação financeira e comparativo de taxas de delivery', () => {
  const rel = obterRelatorioConciliacaoCanais(PALATARE_EMPRESA_ID);
  assert.equal(rel.sucesso, true);
  assert.ok(rel.totalBruto > 0);
  assert.ok(rel.economiaGeradaWhatsApp >= 0);
  assert.ok(rel.porCanal.length >= 4);

  const whats = rel.porCanal.find(c => c.id === 'whatsapp_proprio');
  assert.equal(whats.taxaEfetivaPercentual, 0);
});

test('6. Recepção de Webhook externo (iFood e Keeta)', () => {
  const wbIfood = receberWebhookExterno('ifood', {
    eventType: 'ORDER_CREATED',
    orderId: 'if-test-9999'
  });
  assert.equal(wbIfood.sucesso, true);
  assert.ok(wbIfood.eventoId.startsWith('ev-'));
});
