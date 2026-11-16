import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_MESTRE_STALLONE,
  gerenciadorEstoqueStallone,
  listarCatalogoMulticanalStallone,
  obterResumoEstoqueMulticanalStallone,
  baixarEstoquePdvStallone,
  reservarEstoqueEcommerceStallone,
  ajustarEstoqueMulticanalStallone,
  obterProdutoPorCodigoStallone
} from './estoque-multicanal-stallone.js';

test('1. Catálogo Mestre Oficial Stallone: conformidade e atributos fiscais/multicanal', () => {
  assert.equal(CATALOGO_MESTRE_STALLONE.length, 8, 'Deve conter os 8 produtos oficiais da Stallone');
  
  const creatina = CATALOGO_MESTRE_STALLONE.find(p => p.sku === 'CREAT-CREAPURE-300G');
  assert.ok(creatina, 'Creatina Creapure deve existir');
  assert.equal(creatina.ncm, '21069090');
  assert.equal(creatina.cfop, '5102');
  assert.equal(creatina.precoVenda, 99.00);
  assert.ok(creatina.destaquePdv, 'Deve ser destaque no PDV');

  const whey = CATALOGO_MESTRE_STALLONE.find(p => p.sku === 'WHEY-PREM-900G');
  assert.ok(whey);
  assert.equal(whey.precoVenda, 189.90);
});

test('2. Visão de Estoque Multicanal: Estoque Balcão = Físico - Reservado Online', () => {
  const produto = obterProdutoPorCodigoStallone('CREAT-CREAPURE-300G');
  assert.ok(produto);
  assert.equal(
    produto.estoqueBalcaoDisponivel,
    produto.estoqueFisico - produto.estoqueOnlineReservado,
    'Estoque do balcão deve ser exatamente a sobra após reservas da loja online'
  );
  assert.ok(produto.diasAteRuptura > 0, 'Motor KyttoIA deve calcular dias até ruptura');
});

test('3. Baixa de Estoque no PDV: reflete instantaneamente na disponibilidade multicanal', () => {
  const antes = obterProdutoPorCodigoStallone('CREAT-CREAPURE-300G');
  const qtdVenda = 2;

  const resultado = baixarEstoquePdvStallone({
    itemId: 'CREAT-CREAPURE-300G',
    quantidade: qtdVenda,
    vendaId: 'VND-TEST-001',
    usuario: 'Operador Teste PDV'
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.itemAtualizado.estoqueFisico, antes.estoqueFisico - qtdVenda);
  assert.equal(
    resultado.itemAtualizado.estoqueBalcaoDisponivel,
    antes.estoqueBalcaoDisponivel - qtdVenda
  );
});

test('4. Bloqueio de Venda no Balcão: protege as reservas ativas da Loja Online', () => {
  const produto = obterProdutoPorCodigoStallone('WHEY-ISO-900G');
  const qtdExcessiva = produto.estoqueBalcaoDisponivel + 50;

  assert.throws(
    () => {
      baixarEstoquePdvStallone({
        itemId: 'WHEY-ISO-900G',
        quantidade: qtdExcessiva,
        vendaId: 'VND-EXCESSIVA'
      });
    },
    /Estoque insuficiente no balcão/,
    'Deve barrar venda de unidades reservadas para clientes do e-commerce'
  );
});

test('5. Reserva Online: novo pedido no E-commerce bloqueia estoque no PDV', () => {
  const antes = obterProdutoPorCodigoStallone('PRE-TREINO-PRO-300G');
  const qtdPedidoOnline = 3;

  const res = reservarEstoqueEcommerceStallone({
    itemId: 'PRE-TREINO-PRO-300G',
    quantidade: qtdPedidoOnline,
    pedidoId: 'ECOM-99881',
    clienteNome: 'Atleta E-commerce'
  });

  assert.equal(res.sucesso, true);
  assert.equal(
    res.itemAtualizado.estoqueOnlineReservado,
    antes.estoqueOnlineReservado + qtdPedidoOnline
  );
  assert.equal(
    res.itemAtualizado.estoqueBalcaoDisponivel,
    antes.estoqueBalcaoDisponivel - qtdPedidoOnline
  );
});

test('6. Ajuste Manual de Inventário: altera saldo físico e audita movimentação', () => {
  const resultado = ajustarEstoqueMulticanalStallone({
    itemId: 'COQ-BLENDER-700',
    novoEstoqueFisico: 55,
    motivo: 'Contagem física trimestral',
    usuario: 'Gerente Auditor'
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.itemAtualizado.estoqueFisico, 55);
});

test('7. Resumo Executivo Multicanal e Alertas do Motor KyttoIA', () => {
  const resumo = obterResumoEstoqueMulticanalStallone();
  assert.equal(resumo.sucesso, true);
  assert.equal(resumo.metricas.totalSkus, 8);
  assert.ok(resumo.metricas.valorEstoqueVenda > 0);
  assert.ok(resumo.metricas.valorEstoqueCusto > 0);
  assert.ok(resumo.metricas.margemMediaPercentual > 0);
  assert.ok(Array.isArray(resumo.alertasRuptura));
  assert.ok(Array.isArray(resumo.historicoMovimentacoesRecentes));
});

test('8. Busca flexível por SKU, EAN ou Nome parcial', () => {
  const porEan = obterProdutoPorCodigoStallone('7898560990012');
  assert.ok(porEan);
  assert.equal(porEan.sku, 'CREAT-CREAPURE-300G');

  const lista = listarCatalogoMulticanalStallone({ busca: 'creatina' });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].sku, 'CREAT-CREAPURE-300G');
});
