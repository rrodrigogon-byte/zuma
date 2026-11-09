import test from 'node:test';
import assert from 'node:assert/strict';
import { BANCOS_BRASIL, identificarBanco, categorizarLinhaBancaria } from './core/bancos-brasil-catalogo.js';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  processarTransacaoTef,
  listarTransacoesTef,
  conciliarLoteTefComExtrato,
  resumoPrevisaoRecebiveis,
  obterConfiguracoesTef,
  salvarConfiguracoesTef
} from './core/tef-multimaquininhas-brasil.js';

test('1. Catálogo de Bancos Brasileiros', () => {
  assert.ok(BANCOS_BRASIL.length >= 12, 'Deve conter os principais bancos do Brasil');

  const sicredi = BANCOS_BRASIL.find(b => b.codigo === '748');
  assert.ok(sicredi, 'Sicredi (748) deve estar no catálogo');
  assert.equal(sicredi.nome, 'Sicredi');

  const sicoob = BANCOS_BRASIL.find(b => b.codigo === '756');
  assert.ok(sicoob, 'Sicoob (756) deve estar no catálogo');

  const itau = BANCOS_BRASIL.find(b => b.codigo === '341');
  assert.ok(itau, 'Itaú (341) deve estar no catálogo');

  const bb = BANCOS_BRASIL.find(b => b.codigo === '001');
  assert.ok(bb, 'Banco do Brasil (001) deve estar no catálogo');

  const caixa = BANCOS_BRASIL.find(b => b.codigo === '104');
  assert.ok(caixa, 'Caixa (104) deve estar no catálogo');

  const nubank = BANCOS_BRASIL.find(b => b.codigo === '260');
  assert.ok(nubank, 'Nubank (260) deve estar no catálogo');
});

test('2. Identificação Inteligente de Banco por Código ou Extrato', () => {
  const b1 = identificarBanco('748');
  assert.equal(b1.nome, 'Sicredi');

  const b2 = identificarBanco('EXTRATO BRADESCO 237');
  assert.equal(b2.nome, 'Bradesco');

  const b3 = identificarBanco('NU PAGAMENTOS S.A.');
  assert.equal(b3.nome, 'Nubank');

  const b4 = identificarBanco('SANTANDER BRASIL');
  assert.equal(b4.nome, 'Santander');
});

test('3. Categorização Automática de Linhas de Extrato', () => {
  const tarifa = categorizarLinhaBancaria('TAR MANUT PACOTE CONTA', -49.90);
  assert.equal(tarifa.categoria, 'Tarifas Bancárias');
  assert.equal(tarifa.tipo, 'despesa');

  const repasseStone = categorizarLinhaBancaria('STONE PAGAMENTOS S.A. LIQ', 1540.80);
  assert.equal(repasseStone.categoria, 'Recebimento de Cartões / TEF');
  assert.equal(repasseStone.tipo, 'receita');

  const pix = categorizarLinhaBancaria('PIX RECEBIDO CLIENTE JOAO', 120.00);
  assert.equal(pix.categoria, 'Recebimento via PIX');
  assert.equal(pix.tipo, 'receita');
});

test('4. Catálogo Oficial de Adquirentes e Maquininhas de Cartão', () => {
  assert.ok(ADQUIRENTES_BRASIL.length >= 8, 'Deve conter as principais adquirentes do mercado');
  
  const stone = ADQUIRENTES_BRASIL.find(a => a.id === 'stone');
  assert.ok(stone, 'Stone deve estar homologada');
  assert.ok(stone.modelosMaquininhas.length > 0);

  const pagbank = ADQUIRENTES_BRASIL.find(a => a.id === 'pagbank');
  assert.ok(pagbank, 'PagBank deve estar homologado');

  const cielo = ADQUIRENTES_BRASIL.find(a => a.id === 'cielo');
  assert.ok(cielo, 'Cielo deve estar homologada');

  const rede = ADQUIRENTES_BRASIL.find(a => a.id === 'rede');
  assert.ok(rede, 'Rede (Itaú) deve estar homologada');

  const vero = ADQUIRENTES_BRASIL.find(a => a.id === 'vero_sicredi');
  assert.ok(vero, 'Vero / Sicredi Cartões deve estar homologada');

  const sitef = ADQUIRENTES_BRASIL.find(a => a.id === 'sitef_fiserv');
  assert.ok(sitef, 'SiTef Fiserv deve estar homologado');
});

test('5. Catálogo Oficial de Bandeiras no Brasil', () => {
  const ids = BANDEIRAS_BRASIL.map(b => b.id);
  assert.ok(ids.includes('visa'), 'Visa');
  assert.ok(ids.includes('mastercard'), 'Mastercard');
  assert.ok(ids.includes('elo'), 'Elo');
  assert.ok(ids.includes('amex'), 'Amex');
  assert.ok(ids.includes('hipercard'), 'Hipercard');
  assert.ok(ids.includes('alelo'), 'Alelo');
  assert.ok(ids.includes('sodexo_pluxee'), 'Pluxee (Sodexo)');
  assert.ok(ids.includes('ticket'), 'Ticket');
  assert.ok(ids.includes('vr'), 'VR');
  assert.ok(ids.includes('pix_pinpad'), 'Pix no Pinpad');
});

test('6. Processamento de Transação TEF e Comprovantes', () => {
  const empresaId = 'emp-teste-tef-01';
  const trx = processarTransacaoTef({
    empresaId,
    valor: 250.00,
    modalidade: 'credito_avista',
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    clienteNome: 'Rodrigo Gonçalves'
  });

  assert.ok(trx.id.startsWith('tef-'));
  assert.equal(trx.valor, 250.00);
  assert.equal(trx.status, 'autorizada');
  assert.ok(trx.nsu.length >= 6, 'NSU deve ser gerado');
  assert.ok(trx.codigoAutorizacao.startsWith('AUT'));
  assert.ok(trx.valorLiquido < 250.00, 'Valor líquido deve descontar a taxa MDR');
  assert.ok(trx.valorTaxaMdr > 0, 'Valor da taxa MDR deve ser apurado');
  assert.ok(trx.comprovanteCliente.includes('DINO BARBEARIA'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER'));
});

test('7. Conciliação de Lote de Cartões com Extrato Bancário', () => {
  const empresaId = 'emp-teste-tef-conciliacao';

  // Cria duas transações no TEF
  const t1 = processarTransacaoTef({ empresaId, valor: 100.00, modalidade: 'debito', adquirenteId: 'stone' });
  const t2 = processarTransacaoTef({ empresaId, valor: 200.00, modalidade: 'debito', adquirenteId: 'stone' });

  const valorTotalLiquido = Number((t1.valorLiquido + t2.valorLiquido).toFixed(2));

  // Simula o depósito da Stone no extrato bancário
  const resultado = conciliarLoteTefComExtrato(empresaId, {
    extratoLinhaId: 'ext-stone-deposito-01',
    adquirenteId: 'stone',
    dataDeposito: '2026-11-10',
    valorDeposito: valorTotalLiquido
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.totalTransacoesConciliadas, 2);
  assert.equal(resultado.somaLiquida, valorTotalLiquido);
  assert.equal(resultado.diferencaCentavos, 0);

  // Verifica se o status mudou para conciliada
  const lista = listarTransacoesTef(empresaId);
  const conciliadas = lista.filter(t => t.status === 'conciliada');
  assert.equal(conciliadas.length, 2);
});

test('8. Resumo da Agenda de Recebíveis Futuros', () => {
  const empresaId = 'emp-teste-agenda-cartoes';
  processarTransacaoTef({ empresaId, valor: 300.00, modalidade: 'credito_avista', adquirenteId: 'stone' });
  processarTransacaoTef({ empresaId, valor: 150.00, modalidade: 'debito', adquirenteId: 'cielo' });

  const resumo = resumoPrevisaoRecebiveis(empresaId);
  assert.equal(resumo.totalTransacoesPendentes, 2);
  assert.equal(resumo.totalBrutoPendente, 450.00);
  assert.ok(resumo.totalLiquidoPendente < 450.00);
  assert.ok(resumo.totalTaxasMdr > 0);
  assert.ok(resumo.porAdquirente['Stone / Ton']);
  assert.ok(resumo.porAdquirente['Cielo']);
  assert.ok(resumo.agendaDiaria.length > 0);
});
