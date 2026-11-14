import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPRESA_STALLONE_ID,
  LOJA_STALLONE_ID,
  CONFIGURACAO_PADRAO_STALLONE,
  configurarPadraoStallone,
  obterConfiguracoesTef,
  listarTerminaisTef,
  testarConexaoTerminal,
  processarTransacaoTef,
  listarTransacoesTef,
  conciliarLoteTefComExtrato,
  resumoPrevisaoRecebiveis,
  obterDadosFiscaisNfeCard,
  ADQUIRENTES_BRASIL,
} from './core/tef-multimaquininhas-brasil.js';

test('1. Configuração Oficial de TEF da Stallone Nutre Sport (Tangará da Serra/MT)', () => {
  const cfg = configurarPadraoStallone(EMPRESA_STALLONE_ID);
  assert.equal(cfg.empresaId, EMPRESA_STALLONE_ID);
  assert.equal(cfg.cnpj, '56.099.531/0001-38');
  assert.equal(cfg.razaoSocial, 'STALLONE NUTRE SPORT LTDA');
  assert.equal(cfg.configurado, true);
  assert.equal(cfg.status, 'configurado');
  assert.equal(cfg.adquirentePadrao, 'vero_sicredi');
  assert.equal(cfg.terminais.length, 4);

  // Validação das taxas contratuais negociadas
  const taxasSicredi = cfg.taxasNegociadas.vero_sicredi;
  assert.equal(taxasSicredi.debito, 0.95);
  assert.equal(taxasSicredi.creditoAvista, 1.85);
  assert.equal(taxasSicredi.creditoParcelado2a6, 2.40);
  assert.equal(taxasSicredi.pix, 0.00);

  const taxasStone = cfg.taxasNegociadas.stone;
  assert.equal(taxasStone.debito, 1.15);
  assert.equal(taxasStone.creditoAvista, 2.10);
  assert.equal(taxasStone.creditoParcelado2a6, 2.90);
});

test('2. Parametrização e Telemetria dos 4 Terminais Físicos / Mobile da Stallone', () => {
  const terminais = listarTerminaisTef(EMPRESA_STALLONE_ID);
  assert.equal(terminais.length, 4);

  const [t1, t2, t3, t4] = terminais;

  // Caixa 01: Balcão Principal
  assert.equal(t1.id, 'term-stal-01');
  assert.equal(t1.adquirenteId, 'vero_sicredi');
  assert.equal(t1.serialNumber, 'GER-STAL-9301');
  assert.equal(t1.tipoConexao, 'clisitef');

  // Caixa 02: Consultoria Fitness
  assert.equal(t2.id, 'term-stal-02');
  assert.equal(t2.adquirenteId, 'stone');
  assert.equal(t2.serialNumber, 'STN-STAL-P202');
  assert.equal(t2.tipoConexao, 'stone_connect');

  // Totem 01: Autoatendimento
  assert.equal(t3.id, 'term-stal-03');
  assert.equal(t3.adquirenteId, 'pagbank');
  assert.equal(t3.serialNumber, 'PAX-STAL-3003');
  assert.equal(t3.tipoConexao, 'plugpag');

  // Terminal Móvel 01: Eventos e Feiras MT
  assert.equal(t4.id, 'term-stal-04');
  assert.equal(t4.adquirenteId, 'cielo');
  assert.equal(t4.serialNumber, 'CIE-STAL-LIO4');
  assert.equal(t4.tipoConexao, 'cielo_lio');

  // Teste de conexão real / diagnóstico com latência
  const teste = testarConexaoTerminal(EMPRESA_STALLONE_ID, t1.id, {
    modoDiagnostico: true,
    latenciaRealMs: 14,
    firmwarePinpad: 'PCI-PTS 5.x / EMV L1-L2 Ready',
  });
  assert.equal(teste.sucesso, true);
  assert.equal(teste.status, 'conectado');
  assert.equal(teste.latenciaMs, 14);
});

test('3. Processamento de Transações TEF com Cálculo MDR e Regras Fiscais SEFAZ-MT (NFC-e)', () => {
  // Transação Débito Vero Sicredi: R$ 259,90 (Whey Protein DUX)
  const txDebito = processarTransacaoTef({
    empresaId: EMPRESA_STALLONE_ID,
    valor: 259.90,
    modalidade: 'debito',
    parcelas: 1,
    adquirenteId: 'vero_sicredi',
    bandeiraId: 'mastercard',
    terminalId: 'term-stal-01',
    clienteNome: 'Marcos Vinicius',
    referenciaVenda: 'VD-TEST-01',
    operador: 'Silvester Natal',
  });

  assert.equal(txDebito.valor, 259.90);
  assert.equal(txDebito.taxaMdrPercentual, 0.95);
  assert.equal(txDebito.valorTaxaMdr, 2.47);
  assert.equal(txDebito.valorLiquido, 257.43);
  assert.equal(txDebito.status, 'autorizada');
  assert.ok(txDebito.nsu);
  assert.ok(txDebito.codigoAutorizacao);

  // Espelho de tags fiscais NFC-e (SEFAZ-MT)
  const fiscalDebito = obterDadosFiscaisNfeCard(txDebito);
  assert.equal(fiscalDebito.tpIntegra, 1); // 1 = Pagamento integrado
  assert.equal(fiscalDebito.CNPJ, '92702067000196'); // Banrisul Cartões / Vero Sicredi
  assert.equal(fiscalDebito.tBand, '02'); // 02 = Mastercard
  assert.equal(fiscalDebito.cAut, txDebito.codigoAutorizacao);

  // Transação Crédito Parcelado Stone: R$ 680,00 em 3x (Creatina Creapure + Vitaminas)
  const txCredito = processarTransacaoTef({
    empresaId: EMPRESA_STALLONE_ID,
    valor: 680.00,
    modalidade: 'credito_parcelado',
    parcelas: 3,
    adquirenteId: 'stone',
    bandeiraId: 'elo',
    terminalId: 'term-stal-02',
    clienteNome: 'Rodrigo Fontana',
    referenciaVenda: 'VD-TEST-02',
    operador: 'Silvester Natal',
  });

  assert.equal(txCredito.valor, 680.00);
  assert.equal(txCredito.taxaMdrPercentual, 2.90);
  assert.equal(txCredito.valorTaxaMdr, 19.72);
  assert.equal(txCredito.valorLiquido, 660.28);

  const fiscalCredito = obterDadosFiscaisNfeCard(txCredito);
  assert.equal(fiscalCredito.tpIntegra, 1);
  assert.equal(fiscalCredito.CNPJ, '16501555000157'); // Stone Pagamentos S.A.
  assert.equal(fiscalCredito.tBand, '06'); // 06 = Elo
});

test('4. Conciliação de Lote de Cartões com Extrato Bancário Sicredi e Agenda de Recebíveis', () => {
  const transacoes = listarTransacoesTef(EMPRESA_STALLONE_ID);
  assert.ok(transacoes.length >= 6);

  // Resumo de previsões de recebíveis
  const previsao = resumoPrevisaoRecebiveis(EMPRESA_STALLONE_ID);
  assert.ok(previsao.totalTransacoesPendentes > 0);
  assert.ok(previsao.totalBrutoPendente > 0);
  assert.ok(previsao.totalLiquidoPendente > 0);

  // Conciliar depósito no extrato Sicredi (ex.: R$ 257,43 referente ao débito)
  const resultado = conciliarLoteTefComExtrato(EMPRESA_STALLONE_ID, {
    extratoLinhaId: 'EXT-SICREDI-TEST-01',
    adquirenteId: 'vero_sicredi',
    valorDeposito: 257.43,
  });

  assert.equal(resultado.sucesso, true);
  assert.ok(resultado.totalTransacoesConciliadas >= 1);
  assert.equal(resultado.valorDeposito, 257.43);
});
