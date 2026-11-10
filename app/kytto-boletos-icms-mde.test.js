import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emitirBoletoHibrido,
  modulo10,
  modulo11,
  calcularFatorVencimento,
  gerarPixCopiaEColaHibrido,
  renderizarBoletoHtml,
  BANCOS_BOLETO,
} from './core/boleto-hibrido-brasil.js';
import {
  calcularIcmsStMt,
  calcularMvaAjustada,
  ALIQUOTAS_MT,
} from './core/tributacao-icms-st-mt.js';
import {
  manifestarNota,
  listarNotasDestinadas,
  processarEntradaMercadoria,
  EVENTOS_MDE,
} from './core/manifestacao-destinatario-mde.js';

test('1. Boleto Bancário Híbrido: Cálculo FEBRABAN e Módulo 10/11', () => {
  // Teste módulo 10
  const dv10 = modulo10('748911000');
  assert.equal(typeof dv10, 'number');
  assert.ok(dv10 >= 0 && dv10 <= 9);

  // Teste módulo 11
  const dv11 = modulo11('7489100000000010000');
  assert.equal(typeof dv11, 'number');
  assert.ok(dv11 >= 1 && dv11 <= 9);

  // Teste fator de vencimento
  const fator = calcularFatorVencimento('2026-11-20');
  assert.equal(fator.length, 4);
  assert.ok(Number(fator) > 1000);
});

test('2. Emissão de Boleto Sicredi (748) com Pix Copia e Cola Dinâmico', () => {
  const boleto = emitirBoletoHibrido({
    banco: '748',
    valor: 350.50,
    vencimento: '2026-11-25',
    nossoNumero: '12345678',
    cooperativa: '0812',
    codigoBeneficiario: '50073',
    pagadorNome: 'Guilherme Cunha',
    pagadorDocumento: '111.222.333-44',
  });

  assert.equal(boleto.banco, '748');
  assert.equal(boleto.bancoApelido, 'Sicredi');
  assert.equal(boleto.valor, 350.50);
  assert.equal(boleto.valorFormatado, 'R$ 350,50');
  assert.equal(boleto.codigoBarras.length, 44);
  assert.ok(boleto.linhaDigitavel.length >= 47);
  assert.ok(boleto.pixCopiaECola.startsWith('00020126'));
  assert.ok(boleto.pixCopiaECola.includes('5406350.50')); // Valor no EMV Pix

  // Teste de renderização HTML
  const html = renderizarBoletoHtml(boleto);
  assert.ok(html.includes('PAGAMENTO INSTANTÂNEO PIX HÍBRIDO'));
  assert.ok(html.includes(boleto.linhaDigitavel));
  assert.ok(html.includes('DINO BARBEARIA LTDA'));
});

test('3. Emissão de Boleto Sicoob (756) com Carteira 1', () => {
  const boletoSicoob = emitirBoletoHibrido({
    banco: '756',
    valor: 500.00,
    vencimento: '2026-12-05',
    nossoNumero: '87654321',
    cooperativa: '3005',
    codigoBeneficiario: '1234567',
    pagadorNome: 'Rodrigo Gonçalves',
  });

  assert.equal(boletoSicoob.banco, '756');
  assert.equal(boletoSicoob.bancoApelido, 'Sicoob');
  assert.equal(boletoSicoob.codigoBarras.length, 44);
  assert.ok(boletoSicoob.codigoBarras.startsWith('7569'));
});

test('4. Tributação MT: MVA Ajustada em Operações Interestaduais', () => {
  // Compras de SP (7%) com interna MT (17%) e MVA original de 40%
  const mvaAjustada = calcularMvaAjustada({
    mvaOriginal: 40.0,
    aliquotaInterestadual: 7.0,
    aliquotaInterna: 17.0,
  });

  // Fórmula: [((1 + 0.40) * (1 - 0.07)) / (1 - 0.17)] - 1 = [(1.4 * 0.93) / 0.83] - 1 = [1.302 / 0.83] - 1 = 1.5686 - 1 = 56.86%
  assert.ok(mvaAjustada > 40.0, 'MVA ajustada deve ser maior que a original');
  assert.ok(Math.abs(mvaAjustada - 56.8675) < 0.1, `MVA esperada ~56.87%, obtida: ${mvaAjustada}%`);
});

test('5. Tributação MT: Cálculo de ICMS-ST para Perfumaria/Cosméticos da Dino', () => {
  const calculo = calcularIcmsStMt({
    valorOperacao: 100.00,
    frete: 10.00,
    mva: 40.0,
    operacaoInterestadual: false,
    aliquotaInternaSt: 17.0,
    incideFcp: true,
    aliquotaFcp: 2.0,
    crt: '1', // Simples Nacional
    ncm: '33051000', // Xampus
    cest: '2001900',
  });

  assert.equal(calculo.ncm, '33051000');
  assert.equal(calculo.cest, '2001900');
  assert.equal(calculo.cfop, '5405');
  assert.equal(calculo.icmsSt.mvaAplicada, 40.0);
  
  // Base ST = (100 + 10) * 1.40 = 154.00
  assert.equal(calculo.icmsSt.baseCalculoSt, 154.00);
  // Débito ST Total = 154.00 * (17% + 2%) = 154 * 0.19 = 29.26
  assert.equal(calculo.icmsSt.valorDebitoStTotal, 29.26);
  assert.ok(calculo.totalItemComSt > 100.00);
});

test('6. Manifestação do Destinatário (MD-e): Ciência da Emissão (210210)', () => {
  const chave = '51261150073355000260550010000098761123456789';
  const evento = manifestarNota({
    chaveAcesso: chave,
    tipoEvento: '210210',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0',
    usuario: 'guilherme_dino',
  });

  assert.equal(evento.tipoEvento, '210210');
  assert.equal(evento.descricaoEvento, 'Ciência da Emissão');
  assert.equal(evento.statusSefaz, '135');
  assert.ok(evento.protocolo.startsWith('15126'));
});

test('7. Manifestação do Destinatário (MD-e): Confirmação da Operação (210200)', () => {
  const chave = '51261150073355000260550010000098761123456789';
  const evento = manifestarNota({
    chaveAcesso: chave,
    tipoEvento: '210200',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa914ef0',
    usuario: 'gerente_caixa',
  });

  assert.equal(evento.tipoEvento, '210200');
  assert.equal(evento.descricaoEvento, 'Confirmação da Operação');
});

test('8. Manifestação do Destinatário: Validação de Justificativa na Operação Não Realizada', () => {
  const chave = '51261150073355000260550010000098761123456789';
  assert.throws(() => {
    manifestarNota({
      chaveAcesso: chave,
      tipoEvento: '210240',
      justificativa: 'Curto', // Menor que 15 caracteres
    });
  }, /no mínimo 15 caracteres/);

  const eventoValido = manifestarNota({
    chaveAcesso: chave,
    tipoEvento: '210240',
    justificativa: 'Carga avariada durante o transporte e devolvida ao emitente.',
  });
  assert.equal(eventoValido.tipoEvento, '210240');
});

test('9. Gestão de Estoque: Recálculo do Custo Médio Ponderado na Entrada', () => {
  // Cenário: Tínhamos 10 pomadas no estoque compradas a R$ 20,00 cada (Total: R$ 200,00)
  // Recebemos nova remessa de 20 pomadas a R$ 26,00 cada (Total: R$ 520,00)
  // Total Geral: 30 pomadas / R$ 720,00 => Novo Custo Médio: R$ 24,00 por unidade
  const resultado = processarEntradaMercadoria({
    estoqueAtualQtd: 10,
    custoAtualUnitario: 20.00,
    quantidadeEntrada: 20,
    custoEntradaUnitario: 26.00,
  });

  assert.equal(resultado.qtdFinal, 30);
  assert.equal(resultado.valorTotalEstoqueFinal, 720.00);
  assert.equal(resultado.novoCustoMedioUnitario, 24.00);
});
