import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executarAuditoriaDimpFiscal,
  regularizarPendenciasDimp
} from './core/auditoria-dimp-fiscal.js';

import {
  listarCotacoes,
  criarCotacao,
  aprovarCotacaoGerarPedido,
  listarPedidosCompra,
  executarConferencia3WayMatching,
  STATUS_COTACAO,
  STATUS_PEDIDO_COMPRA
} from './core/supply-chain-cotacoes.js';

test('1. Auditoria Preventiva DIMP vs Fiscal deve calcular divergências e risco de malha fina', () => {
  const auditoria = executarAuditoriaDimpFiscal({
    empresaId: 'emp-dino-01',
    mes: '10',
    ano: '2026',
    transacoesMeiosPagamento: [
      { adquirente: 'REDE', tipo: 'CARTAO_CREDITO', valor: 3000 },
      { adquirente: 'CIELO', tipo: 'CARTAO_DEBITO', valor: 2000 },
      { adquirente: 'STONE', tipo: 'PIX', valor: 4000 },
    ],
    documentosFiscais: [{ modelo: '65', valorTotal: 3000 }],
    vendasSemDocumento: [{ idVenda: 'venda-fixture', valorFaltante: 6000 }],
  });

  assert.equal(auditoria.sucesso, true);
  assert.equal(auditoria.periodo, '10/2026');
  assert.equal(auditoria.totaisMeiosPagamento.totalGeral, 9000);
  assert.equal(auditoria.totaisDocumentosFiscais.totalGeral, 3000);

  // Identificação da diferença não faturada
  assert.equal(auditoria.analiseDivergencia.diferencaNaoFaturada, 6000);
  assert.equal(auditoria.analiseDivergencia.nivelRisco, 'ALTO');
  assert.ok(auditoria.vendasPendentesEmissao.length > 0, 'Deve listar vendas pendentes de emissão');

  // Adquirentes declaradas
  assert.ok(auditoria.resumoAdquirentes.length >= 3, 'Deve conter pelo menos 3 adquirentes com movimentação');
});

test('2. DIMP valida uma pendência em homologação e mantém a emissão em aberto', () => {
  const empresaId = 'empresa-fixture';
  const item = { idVenda: 'venda-fixture', valorFaltante: 42 };
  assert.throws(() => regularizarPendenciasDimp({ empresaId, itensRegularizar: [item, item] }), /confirmação individual/);
  assert.throws(() => regularizarPendenciasDimp({ empresaId, itensRegularizar: [item], tpAmb: 1 }), /Homologação/);
  const resultado = regularizarPendenciasDimp({ empresaId, itensRegularizar: [item] });
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.quantidadeNotasEmitidas, 0);
  assert.equal(resultado.totalRegularizado, 0);
  assert.deepEqual(resultado.notasEmitidas, []);
  assert.equal(resultado.validacao.status, 'VALIDACAO_LOCAL');
  assert.equal(resultado.validacao.valor, 42);
});

test('3. Supply Chain: Deve listar cotações RFQ e comparar propostas de fornecedores (CIF vs FOB)', () => {
  const cotacoes = listarCotacoes({ empresaId: 'emp-dino-01' });
  assert.ok(cotacoes.length > 0, 'Deve listar cotações');

  const rfq = cotacoes[0];
  assert.equal(rfq.status, STATUS_COTACAO.RESPONDIDA);
  assert.equal(rfq.itensSolicitados.length, 3);
  assert.equal(rfq.propostasFornecedores.length, 2);

  const melhorProposta = rfq.propostasFornecedores.find(p => p.melhorPrecoGeral);
  assert.ok(melhorProposta, 'Deve identificar a proposta de melhor preço');
  assert.equal(melhorProposta.razaoSocial, 'Cosméticos do Brasil Distribuidora LTDA');
  assert.equal(melhorProposta.tipoFrete, 'CIF (Incluso)');
});

test('4. Supply Chain: Deve aprovar a melhor proposta e gerar automaticamente o Pedido de Compra (PO)', () => {
  const cotacoes = listarCotacoes({ empresaId: 'emp-dino-01' });
  const rfq = cotacoes[0];

  const resultado = aprovarCotacaoGerarPedido({
    rfqId: rfq.id,
    fornecedorIdEscolhido: 'forn-01'
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.cotacao.status, STATUS_COTACAO.APROVADA);
  assert.ok(resultado.pedidoCompra, 'Deve ter gerado o pedido de compra');
  assert.equal(resultado.pedidoCompra.fornecedor.cnpj, '12.345.678/0001-90');
  assert.equal(resultado.pedidoCompra.status, STATUS_PEDIDO_COMPRA.ENVIADO_FORNECEDOR);
});

test('5. Supply Chain: Deve executar conferência cega 3-Way Matching (Pedido x NF-e x Estoque)', () => {
  const pedidos = listarPedidosCompra({ empresaId: 'emp-dino-01' });
  assert.ok(pedidos.length > 0);
  const po = pedidos[0];

  const matching = executarConferencia3WayMatching({
    pedidoCompraId: po.id,
    notaFiscalMde: {
      chaveAcesso: '51261012345678000190550010000088991234567890',
      valorTotal: po.valorTotal
    }
  });

  assert.equal(matching.sucesso, true);
  assert.equal(matching.statusMatching, 'APROVADO_SEM_DIVERGENCIA');
  assert.equal(matching.dadosConferidos.diferencaValor, 0);
});
