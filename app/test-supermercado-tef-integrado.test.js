import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  salvarConfiguracoesTef,
  adicionarTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef,
  listarTransacoesTef,
  conciliarLoteTefComExtrato,
} from './core/tef-multimaquininhas-brasil.js';

function prepararEmpresaTefSupermercado(empresaId) {
  salvarConfiguracoesTef(empresaId, {
    razaoSocial: 'SUPERMERCADO TESTE LTDA',
    cnpj: '50.073.355/0001-89',
    adquirentePadrao: 'stone',
    adquirentesAtivas: ['stone', 'cielo', 'sitef_fiserv'],
    taxasNegociadas: {
      stone: { debito: 1.15, creditoAvista: 2.69, creditoParcelado2a6: 3.49, creditoParcelado7a12: 4.19, voucher: 3.5, pix: 0.49 },
      cielo: { debito: 1.39, creditoAvista: 2.99, creditoParcelado2a6: 3.79, creditoParcelado7a12: 4.59, voucher: 3.9, pix: 0.7 },
      sitef_fiserv: { debito: 1.1, creditoAvista: 2.5, creditoParcelado2a6: 3.2, creditoParcelado7a12: 3.9, voucher: 3.8, pix: 0.45 },
    },
  });
  return adicionarTerminalTef(empresaId, {
    nome: 'Pinpad PDV 01',
    adquirenteId: 'stone',
    modelo: 'Gertec PPC930',
    serialNumber: `SN-PDV-${empresaId}`,
  });
}

test('1. Validação Completa do Catálogo Oficial de Adquirentes e Bandeiras do Brasil', () => {
  assert.ok(ADQUIRENTES_BRASIL.length >= 8, 'Deve suportar pelo menos 8 adquirentes oficiais');
  const adqsEsperadas = ['stone', 'pagbank', 'cielo', 'rede', 'getnet', 'safrapay', 'vero_sicredi', 'sitef_fiserv'];
  for (const a of adqsEsperadas) {
    const achou = ADQUIRENTES_BRASIL.find((x) => x.id === a);
    assert.ok(achou, `Adquirente ${a} deve estar catalogada`);
    assert.equal(achou.taxasPadrao, null, `Adquirente ${a} não deve ter taxas fixas em código`);
    assert.ok(achou.prazoLiquidacao.debito, `Prazo de liquidação deve existir para ${a}`);
  }

  assert.ok(BANDEIRAS_BRASIL.length >= 10, 'Deve suportar principais bandeiras');
});

test('2. Gestão de Terminais Pinpad e Teste de Conexão via Agente Local', () => {
  const empresaId = `emp-pdv-pinpad-${Date.now()}`;
  const term01 = prepararEmpresaTefSupermercado(empresaId);

  const teste = testarConexaoTerminal(empresaId, term01.id, {
    agenteLocalConectado: true,
    latenciaRealMs: 14,
    firmwarePinpad: 'Gertec PPC930 PCI-PTS 5.x',
  });
  assert.equal(teste.sucesso, true);
  assert.equal(teste.status, 'conectado');
  assert.ok(teste.latenciaMs >= 10);
  assert.ok(teste.firmwarePinpad.includes('PCI-PTS'));
});

test('3. Processamento de Transação TEF Débito com Comprovante Fiscal', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  prepararEmpresaTefSupermercado(empresaId);
  const trx = processarTransacaoTef({
    empresaId,
    valor: 148.9,
    modalidade: 'debito',
    adquirenteId: 'stone',
    bandeiraId: 'visa',
    operador: 'Operador Caixa 01',
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.valor, 148.9);
  assert.equal(trx.modalidade, 'debito');
  assert.ok(trx.nsu.length >= 6);
  assert.ok(trx.codigoAutorizacao.startsWith('AUT'));
  assert.ok(trx.tid.startsWith('TID'));
  assert.ok(trx.taxaMdrPercentual > 0);
  assert.ok(trx.valorLiquido < trx.valor);
  assert.ok(trx.comprovanteCliente.includes('COMPROVANTE DE PAGAMENTO VIA TEF'));
  assert.ok(trx.comprovanteCliente.includes('VALOR TOTAL: R$ 148.90'));
  assert.ok(trx.comprovanteEstabelecimento.includes('VIA ESTABELECIMENTO'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER'));
});

test('4. Processamento de Transação TEF Crédito Parcelado com Cálculo MDR', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 450.0,
    modalidade: 'credito_parcelado',
    parcelas: 3,
    adquirenteId: 'cielo',
    bandeiraId: 'mastercard',
    operador: 'Operador Caixa 01',
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.parcelas, 3);
  assert.ok(trx.taxaMdrPercentual > 2.0);
  assert.ok(trx.valorLiquido < 450.0);
});

test('5. Processamento de Voucher Alimentação / Refeição no TEF (Alelo, Sodexo, VR)', () => {
  const empresaId = 'emp-teste-supermercado-tef';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 89.9,
    modalidade: 'voucher',
    adquirenteId: 'sitef_fiserv',
    bandeiraId: 'alelo',
    operador: 'Operador Caixa 01',
  });

  assert.equal(trx.status, 'autorizada');
  assert.equal(trx.bandeiraNome, 'Alelo');
  assert.ok(trx.comprovanteCliente.includes('ALELO'));
});

test('6. Conciliação Automática de Lote TEF com Extrato Bancário', () => {
  const empresaId = 'emp-teste-tef-lote-conciliado';
  prepararEmpresaTefSupermercado(empresaId);
  const t1 = processarTransacaoTef({ empresaId, valor: 200.0, modalidade: 'debito', adquirenteId: 'stone' });
  const t2 = processarTransacaoTef({ empresaId, valor: 300.0, modalidade: 'debito', adquirenteId: 'stone' });

  const totalEsperado = Number((t1.valorLiquido + t2.valorLiquido).toFixed(2));

  const resultado = conciliarLoteTefComExtrato(empresaId, {
    extratoLinhaId: 'ext-998877',
    adquirenteId: 'stone',
    valorDeposito: totalEsperado,
    dataDeposito: new Date().toISOString().slice(0, 10),
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.totalTransacoesConciliadas, 2);
  assert.equal(resultado.diferencaCentavos, 0);

  const lista = listarTransacoesTef(empresaId, { status: 'conciliada' });
  assert.equal(lista.length, 2);
  assert.equal(lista[0].conciliadoComExtrato, true);
});
