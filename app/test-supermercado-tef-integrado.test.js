import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  CONFIGURACAO_PADRAO_DINO,
  obterConfiguracoesTef,
  salvarConfiguracoesTef,
  listarTerminaisTef,
  adicionarTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef,
  listarTransacoesTef,
  conciliarLoteTefComExtrato
} from './core/tef-multimaquininhas-brasil.js';

test('1. Validação Completa do Catálogo Oficial de Adquirentes e Bandeiras do Brasil', () => {
  assert.ok(ADQUIRENTES_BRASIL.length >= 8, 'Deve suportar pelo menos 8 adquirentes oficiais');
  const adqsEsperadas = ['stone', 'pagbank', 'cielo', 'rede', 'getnet', 'safrapay', 'vero_sicredi', 'sitef_fiserv'];
  for (const a of adqsEsperadas) {
    const achou = ADQUIRENTES_BRASIL.find(x => x.id === a);
    assert.ok(achou, `Adquirente ${a} deve estar catalogada`);
    assert.ok(achou.taxasPadrao.debito > 0, `Taxa de débito deve existir para ${a}`);
    assert.ok(achou.prazoLiquidacao.debito, `Prazo de liquidação deve existir para ${a}`);
  }

  assert.ok(BANDEIRAS_BRASIL.length >= 10, 'Deve suportar principais bandeiras');
  const bandeirasEsperadas = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'alelo', 'sodexo', 'ticket', 'vr'];
  for (const b of bandeirasEsperadas) {
    const achou = BANDEIRAS_BRASIL.find(x => x.id === b);
    assert.ok(achou, `Bandeira ${b} deve estar cadastrada`);
  }
});

test('2. Gestão de Terminais Pinpad e Teste de Conexão com Latência', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const terminais = listarTerminaisTef(empresaId);
  assert.ok(terminais.length >= 3, 'Barbearia Dino / Supermercado deve ter terminais homologados');

  const term01 = terminais[0];
  const teste = testarConexaoTerminal(empresaId, term01.id);
  assert.equal(teste.sucesso, true);
  assert.equal(teste.status, 'conectado');
  assert.ok(teste.latenciaMs >= 10, 'Deve medir latência real de comunicação');
  assert.ok(teste.firmwarePinpad.includes('PCI-PTS'), 'Firmware homologado PCI');
});

test('3. Processamento de Transação TEF Débito com Comprovante Fiscal', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 148.90,
    modalidade: 'debito',
    adquirenteId: 'stone',
    bandeiraId: 'visa',
    operador: 'Operador Caixa 01'
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.valor, 148.90);
  assert.equal(trx.modalidade, 'debito');
  assert.ok(trx.nsu.length >= 6, 'NSU deve ser gerado');
  assert.ok(trx.codigoAutorizacao.startsWith('AUT'), 'Autorização deve ter prefixo AUT');
  assert.ok(trx.tid.startsWith('TID'), 'TID deve ter identificador único');
  assert.ok(trx.taxaMdrPercentual > 0, 'Taxa MDR deve ser aplicada');
  assert.ok(trx.valorLiquido < trx.valor, 'Valor líquido deve deduzir MDR');
  assert.equal(trx.previsaoLiquidacao, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  // Validação dos Comprovantes Térmicos de 80mm
  assert.ok(trx.comprovanteCliente.includes('COMPROVANTE DE PAGAMENTO VIA TEF'));
  assert.ok(trx.comprovanteCliente.includes('VALOR TOTAL: R$ 148.90'));
  assert.ok(trx.comprovanteEstabelecimento.includes('VIA ESTABELECIMENTO'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER'));
});

test('4. Processamento de Transação TEF Crédito Parcelado com Cálculo MDR', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 450.00,
    modalidade: 'credito_parcelado',
    parcelas: 3,
    adquirenteId: 'cielo',
    bandeiraId: 'mastercard',
    operador: 'Operador Caixa 01'
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.parcelas, 3);
  assert.ok(trx.taxaMdrPercentual > 2.0, 'Taxa MDR para parcelado deve ser superior a à vista');
  assert.ok(trx.valorLiquido < 450.00);
});

test('5. Processamento de Voucher Alimentação / Refeição no TEF (Alelo, Sodexo, VR)', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 89.90,
    modalidade: 'voucher',
    adquirenteId: 'sitef_fiserv',
    bandeiraId: 'alelo',
    operador: 'Operador Caixa 01'
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.bandeiraNome, 'Alelo');
  assert.ok(trx.comprovanteCliente.includes('ALELO'));
});

test('6. Conciliação Automática de Lote TEF com Extrato Bancário', () => {
  const empresaId = 'emp-teste-tef-lote-conciliado';
  const t1 = processarTransacaoTef({ empresaId, valor: 200.00, modalidade: 'debito', adquirenteId: 'stone' });
  const t2 = processarTransacaoTef({ empresaId, valor: 300.00, modalidade: 'debito', adquirenteId: 'stone' });

  const totalEsperado = Number((t1.valorLiquido + t2.valorLiquido).toFixed(2));

  const resultado = conciliarLoteTefComExtrato(empresaId, {
    extratoLinhaId: 'ext-998877',
    adquirenteId: 'stone',
    valorDeposito: totalEsperado,
    dataDeposito: new Date().toISOString().slice(0, 10)
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.totalTransacoesConciliadas, 2);
  assert.equal(resultado.diferencaCentavos, 0);

  const lista = listarTransacoesTef(empresaId, { status: 'conciliada' });
  assert.equal(lista.length, 2);
  assert.equal(lista[0].conciliadoComExtrato, true);
});
