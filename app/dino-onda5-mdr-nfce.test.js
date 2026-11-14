import test from 'node:test';
import assert from 'node:assert';
import {
  conciliarVendasMdr,
  emitirLoteNFCe,
  TAXAS_MDR_PADRAO
} from './modules/financeiro/conciliacao-mdr-lote-nfce.js';

test('1. Financeiro: Conciliação de taxas MDR e saldo líquido real', () => {
  const vendasSimuladas = [
    { id: 'v1', valorTotal: 100.00, formaPagamento: 'debito' },           // 1,19% = 1,19 -> 98,81 líquido
    { id: 'v2', valorTotal: 200.00, formaPagamento: 'credito_vista' },     // 2,49% = 4,98 -> 195,02 líquido
    { id: 'v3', valorTotal: 300.00, formaPagamento: 'credito_parcelado', parcelas: 3 }, // 3,89% = 11,67 -> 288,33 líquido
    { id: 'v4', valorTotal: 50.00, formaPagamento: 'pix' },               // 0,79% = 0,40 -> 49,60 líquido
    { id: 'v5', valorTotal: 50.00, formaPagamento: 'dinheiro' }           // 0,00% = 0,00 -> 50,00 líquido
  ];

  const resultado = conciliarVendasMdr(vendasSimuladas, 'Cielo / Stone');
  assert.strictEqual(resultado.totalVendas, 5);
  assert.strictEqual(resultado.totalBruto, 700.00);
  assert.strictEqual(resultado.totalTaxasRetidasMdr, 18.24); // 1.19 + 4.98 + 11.67 + 0.40 = 18.24
  assert.strictEqual(resultado.totalLiquidoProjetado, 681.76); // 700 - 18.24 = 681.76
  assert.ok(resultado.taxaEfetivaMediaPercent > 2.0);
});

test('2. Fiscal: Emissão e autorização em lote de NFC-e SEFAZ', async () => {
  const comandas = [
    { id: 'cmd-01', total: 90.00, clienteNome: 'Marcos Silva', itens: [{ nome: 'Corte Dino' }] },
    { id: 'cmd-02', total: 135.00, clienteNome: 'Roberto Santos', itens: [{ nome: 'Combo Corte e Barba' }] },
    { id: 'cmd-03', total: 45.00, clienteNome: 'Lucas Oliveira', itens: [{ nome: 'Pomada Matte Dino' }] }
  ];

  const res = await emitirLoteNFCe(comandas, {
    cnpj: '50.073.355/0001-89',
    razaoSocial: 'DINO BARBEARIA & PERFUMARIA LTDA'
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.lote.totalDocumentos, 3);
  assert.strictEqual(res.lote.valorTotalLote, 270.00);
  assert.strictEqual(res.lote.documentos[0].status, '100-Autorizado SEFAZ-MT');
  assert.ok(res.lote.documentos[0].chaveAcesso.startsWith('51261150073355000189'));
});
