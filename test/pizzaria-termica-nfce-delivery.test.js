import test from 'node:test';
import assert from 'node:assert/strict';
import { simularPedidoMarketplace } from '../app/modules/pizzaria/delivery-marketplaces.js';
import { gerarComandaCozinhaEscPos, gerarCupomMotoboyEscPos, gerarPreviaNfcePizzaria } from '../app/modules/pizzaria/pizzaria-suite-completa.js';
import { PALATARE_EMPRESA_ID } from '../app/palatare-pizzaria-seed.js';

test('Módulo Pizzaria - Impressão Térmica 80mm ESC/POS e NFC-e SEFAZ-MT para Pedidos de Delivery', async (t) => {
  await t.test('1. Deve simular pedido de delivery iFood e Keeta com dados completos', () => {
    const res = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'ifood', 'pizza_especial');
    assert.equal(res.sucesso, true);
    assert.ok(res.pedido);
    assert.equal(res.pedido.canal, 'ifood');
    assert.ok(res.pedido.clienteNome);
    assert.ok(res.pedido.itens.length > 0);
  });

  await t.test('2. Deve gerar comanda de cozinha 80mm ESC/POS para pedido delivery iFood', () => {
    const res = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'ifood', 'pizza_especial');
    const pedido = {
      ...res.pedido,
      comanda: res.pedido.codigoExibicao,
      cliente: res.pedido.clienteNome,
      origem: res.pedido.canalNome
    };
    const impressao = gerarComandaCozinhaEscPos(pedido);
    assert.ok(impressao.rawText);
    assert.equal(impressao.larguraMm, 80);
    assert.ok(impressao.rawText.includes('PALATARE FORNERIA ARTESANAL'));
    assert.ok(impressao.rawText.includes(res.pedido.codigoExibicao));
    assert.ok(impressao.escPosBytesBase64.length > 50);
  });

  await t.test('3. Deve gerar cupom de entrega para motoboy com endereço de Tangará da Serra', () => {
    const res = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'keeta', 'pizza_familia');
    const pedido = {
      ...res.pedido,
      comanda: res.pedido.codigoExibicao,
      cliente: res.pedido.clienteNome,
      telefone: res.pedido.clienteTelefone,
      endereco: res.pedido.enderecoEntrega
    };
    const entregador = { id: 'mb-01', nome: 'Luciano Silva', placa: 'QBD-8902' };
    const cupom = gerarCupomMotoboyEscPos(pedido, entregador);
    assert.ok(cupom.rawText);
    assert.ok(cupom.rawText.includes('CUPOM DE ENTREGA'));
    assert.ok(cupom.rawText.includes(res.pedido.clienteNome));
    assert.ok(cupom.rawText.includes(entregador.nome));
  });

  await t.test('4. Deve gerar NFC-e SEFAZ-MT com chave de 44 dígitos e QR Code oficial', () => {
    const res = simularPedidoMarketplace(PALATARE_EMPRESA_ID, 'ifood', 'pizza_especial');
    const nfce = gerarPreviaNfcePizzaria(res.pedido);
    assert.equal(nfce.ok, true);
    assert.equal(nfce.chaveAcesso.length, 44);
    assert.ok(nfce.chaveAcesso.startsWith('51')); // Mato Grosso
    assert.ok(nfce.qrCodeUrl.includes('sefaz.mt.gov.br'));
    assert.equal(nfce.emitente.cnpj, '31.002.650/0001-08');
  });
});
