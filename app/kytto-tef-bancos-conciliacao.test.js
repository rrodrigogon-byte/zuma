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
  salvarConfiguracoesTef,
  adicionarTerminalTef,
} from './core/tef-multimaquininhas-brasil.js';

function configurarTefEmpresaTeste(empresaId) {
  salvarConfiguracoesTef(empresaId, {
    razaoSocial: 'DINO BARBEARIA LTDA',
    cnpj: '50.073.355/0002-60',
    inscricaoMunicipal: '30297',
    adquirentePadrao: 'stone',
    adquirentesAtivas: ['stone', 'cielo'],
    taxasNegociadas: {
      stone: { debito: 1.15, creditoAvista: 2.69, creditoParcelado2a6: 3.49, creditoParcelado7a12: 4.19, pix: 0.49 },
      cielo: { debito: 1.39, creditoAvista: 2.99, creditoParcelado2a6: 3.79, creditoParcelado7a12: 4.59, pix: 0.70 },
    },
  });
  return adicionarTerminalTef(empresaId, {
    nome: 'Pinpad Caixa Principal',
    adquirenteId: 'stone',
    modelo: 'Gertec PPC930',
    serialNumber: `SN-${empresaId}`,
  });
}

test('1. Catálogo de Bancos Brasileiros', () => {
  assert.ok(BANCOS_BRASIL.length >= 12, 'Deve conter os principais bancos do Brasil');
  const sicredi = BANCOS_BRASIL.find((b) => b.codigo === '748');
  assert.ok(sicredi, 'Sicredi (748) deve estar no catálogo');
  assert.equal(sicredi.nome, 'Sicredi');
});

test('2. Identificação Inteligente de Banco por Código ou Extrato', () => {
  assert.equal(identificarBanco('748').nome, 'Sicredi');
  assert.equal(identificarBanco('EXTRATO BRADESCO 237').nome, 'Bradesco');
  assert.equal(identificarBanco('NU PAGAMENTOS S.A.').nome, 'Nubank');
  assert.equal(identificarBanco('SANTANDER BRASIL').nome, 'Santander');
});

test('3. Categorização Automática de Linhas de Extrato', () => {
  const tarifa = categorizarLinhaBancaria('TAR MANUT PACOTE CONTA', -49.9);
  assert.equal(tarifa.categoria, 'Tarifas Bancárias');
  assert.equal(tarifa.tipo, 'despesa');

  const repasseStone = categorizarLinhaBancaria('STONE PAGAMENTOS S.A. LIQ', 1540.8);
  assert.equal(repasseStone.categoria, 'Recebimento de Cartões / TEF');
  assert.equal(repasseStone.tipo, 'receita');

  const pix = categorizarLinhaBancaria('PIX RECEBIDO CLIENTE JOAO', 120.0);
  assert.equal(pix.categoria, 'Recebimento via PIX');
  assert.equal(pix.tipo, 'receita');
});

test('4. Catálogo Oficial de Adquirentes e Maquininhas de Cartão (sem taxas fixas em código)', () => {
  assert.ok(ADQUIRENTES_BRASIL.length >= 8, 'Deve conter as principais adquirentes do mercado');
  for (const adq of ADQUIRENTES_BRASIL) {
    assert.equal(adq.taxasPadrao, null, 'Adquirente não deve embutir taxas fixas em código');
  }
});

test('5. Catálogo Oficial de Bandeiras no Brasil', () => {
  const ids = BANDEIRAS_BRASIL.map((b) => b.id);
  assert.ok(ids.includes('visa'));
  assert.ok(ids.includes('mastercard'));
  assert.ok(ids.includes('elo'));
  assert.ok(ids.includes('pix_pinpad'));
});

test('6. Processamento de Transação TEF e Comprovantes (após cadastro real de terminal e contrato)', () => {
  const empresaId = 'emp-teste-tef-01';
  configurarTefEmpresaTeste(empresaId);
  const trx = processarTransacaoTef({
    empresaId,
    valor: 250.0,
    modalidade: 'credito_avista',
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    clienteNome: 'Rodrigo Gonçalves',
  });

  assert.ok(trx.id.startsWith('tef-'));
  assert.equal(trx.valor, 250.0);
  assert.equal(trx.status, 'autorizada');
  assert.ok(trx.valorLiquido < 250.0);
  assert.ok(trx.valorTaxaMdr > 0);
  assert.ok(trx.comprovanteCliente.includes('DINO BARBEARIA'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER'));
});

test('7. Conciliação de Lote de Cartões com Extrato Bancário', () => {
  const empresaId = 'emp-teste-tef-conciliacao';
  configurarTefEmpresaTeste(empresaId);

  const t1 = processarTransacaoTef({ empresaId, valor: 100.0, modalidade: 'debito', adquirenteId: 'stone' });
  const t2 = processarTransacaoTef({ empresaId, valor: 200.0, modalidade: 'debito', adquirenteId: 'stone' });

  const valorTotalLiquido = Number((t1.valorLiquido + t2.valorLiquido).toFixed(2));

  const resultado = conciliarLoteTefComExtrato(empresaId, {
    extratoLinhaId: 'ext-stone-deposito-01',
    adquirenteId: 'stone',
    dataDeposito: '2026-11-10',
    valorDeposito: valorTotalLiquido,
  });

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.totalTransacoesConciliadas, 2);
  assert.equal(resultado.somaLiquida, valorTotalLiquido);
  assert.equal(resultado.diferencaCentavos, 0);

  const lista = listarTransacoesTef(empresaId);
  const conciliadas = lista.filter((t) => t.status === 'conciliada');
  assert.equal(conciliadas.length, 2);
});

test('8. Resumo da Agenda de Recebíveis Futuros', () => {
  const empresaId = 'emp-teste-agenda-cartoes';
  configurarTefEmpresaTeste(empresaId);
  processarTransacaoTef({ empresaId, valor: 300.0, modalidade: 'credito_avista', adquirenteId: 'stone' });
  processarTransacaoTef({ empresaId, valor: 150.0, modalidade: 'debito', adquirenteId: 'cielo' });

  const resumo = resumoPrevisaoRecebiveis(empresaId);
  assert.equal(resumo.totalTransacoesPendentes, 2);
  assert.equal(resumo.totalBrutoPendente, 450.0);
  assert.ok(resumo.totalLiquidoPendente < 450.0);
  assert.ok(resumo.totalTaxasMdr > 0);
  assert.ok(resumo.porAdquirente['Stone / Ton']);
  assert.ok(resumo.porAdquirente['Cielo']);
  assert.ok(resumo.agendaDiaria.length > 0);
});
