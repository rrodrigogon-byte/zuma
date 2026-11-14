import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processarCicloAutonomoBalanca,
  executarDosagemMalhaFechadaNBR7212,
  auditarInviolabilidadeAguaTrajeto,
  registrarRupturaAutomaticaPrensa,
  gerarMedicaoPeriodicaObra
} from '../app/modules/concreto/servico.js';

test('1. PILAR 1: Balança 80t & Portaria Zero-Touch (Piloto Automático)', async () => {
  // Ciclo 1: Entrada da Betoneira (Captura da Tara)
  const resEntrada = await processarCicloAutonomoBalanca({
    placaLpr: 'QBF-6M02',
    pesoAtualKg: 12920,
    modo: 'automatico'
  });

  assert.equal(resEntrada.ok, true, 'Ciclo de entrada deve ter sucesso');
  assert.equal(resEntrada.fase, 'entrada_tara_concluida', 'Fase deve ser entrada_tara_concluida');
  assert.equal(resEntrada.veiculo.taraEntradaKg, 12920, 'Tara capturada deve ser 12.920 kg');
  assert.equal(resEntrada.hardware.cancelaEntrada, 'aberta', 'Cancela de entrada deve estar aberta');
  assert.equal(resEntrada.hardware.semaforoEntrada, 'verde', 'Semáforo de entrada deve estar verde');

  // Ciclo 2: Saída da Betoneira Carregada (Captura do Peso Bruto, Cálculo Líquido e Emissão de Ticket / MDF-e)
  const resSaida = await processarCicloAutonomoBalanca({
    placaLpr: 'QBF-6M02',
    pesoAtualKg: 33540,
    modo: 'automatico'
  });

  assert.equal(resSaida.ok, true, 'Ciclo de saída deve ter sucesso');
  assert.equal(resSaida.fase, 'saida_concluida_mdfe_emitido', 'Fase deve ser saida_concluida_mdfe_emitido');
  assert.equal(resSaida.pesoLiquidoKg, 20620, 'Peso líquido deve ser 20.620 kg (33.540 - 12.920)');
  assert.ok(resSaida.volumeM3 >= 8.0, 'Volume deve ser compatível com concreto usinado (~8.66 m³)');
  assert.ok(resSaida.ticket.numeroTicket.includes('TKT-BAL'), 'Ticket oficial deve ser emitido');
  assert.equal(resSaida.hardware.cancelaSaida, 'aberta', 'Cancela de saída deve ser liberada');
  assert.equal(resSaida.hardware.semaforoSaida, 'verde', 'Semáforo de saída deve ser verde');
});

test('2. PILAR 2: Central Dosadora em Malha Fechada de Umidade NBR 7212', () => {
  const batelada = executarDosagemMalhaFechadaNBR7212({
    fck: 30,
    volumeM3: 8.0,
    umidadeAreiaMovelPercent: 6.0, // 6% de umidade superficial na areia
    umidadeBritaPercent: 1.0,
    slumpAlvo: '14 ± 2 cm'
  });

  assert.equal(batelada.ok, true, 'Batelada deve ser calculada com sucesso');
  assert.ok(batelada.loteBatelada.sensoresMicroondas.umidadeAreiaPercent === 6.0);
  
  // A água livre contida nos agregados deve ser descontada da água do dosador
  assert.ok(batelada.loteBatelada.balancoMassa.aguaEfetiva.aguaAbatidaUmidadeLitros > 300, 'Mais de 300L de água contida nos agregados devem ser abatidos');
  assert.ok(batelada.loteBatelada.balancoMassa.cimento.conforme, 'Cimento deve estar dentro da tolerância NBR 7212 (±1%)');
  assert.ok(batelada.loteBatelada.balancoMassa.aguaEfetiva.conforme, 'Água deve estar dentro da tolerância NBR 7212 (±1%)');
  assert.ok(batelada.loteBatelada.telemetriaMisturador.tempoMisturaSegundos >= 90, 'Tempo de mistura deve ser de pelo menos 90s');
  assert.ok(batelada.loteBatelada.telemetriaMisturador.correnteAmperes > 60, 'Corrente do misturador deve ser telemetrada');
});

test('3. PILAR 3: Virtual Verifi & Inviolabilidade de Água em Trânsito (IoT)', () => {
  // Teste de leitura normal em trânsito
  const normal = auditarInviolabilidadeAguaTrajeto({
    veiculoCodigo: 'BT-04',
    litrosAdicionados: 0,
    pressaoHidraulicaBar: 195
  });
  assert.equal(normal.ok, true);
  assert.equal(normal.alertaEmitido, false);
  assert.equal(normal.auditoria.violacaoDetectada, false);
  assert.equal(normal.auditoria.lacreInviolavel, true);

  // Teste de adulteração com adição clandestina de 40L de água na obra
  const violacao = auditarInviolabilidadeAguaTrajeto({
    veiculoCodigo: 'BT-04',
    litrosAdicionados: 40,
    pressaoHidraulicaBar: 160 // Queda de pressão do balão
  });
  assert.equal(violacao.ok, true);
  assert.equal(violacao.alertaEmitido, true, 'Deve emitir alerta de violação');
  assert.equal(violacao.auditoria.violacaoDetectada, true, 'Violação deve ser detectada');
  assert.equal(violacao.auditoria.lacreInviolavel, false, 'Lacre de água deve ser rompido');
  assert.ok(violacao.auditoria.impactoFckMpa > 0, 'Deve quantificar a perda de resistência FCK');
  assert.ok(violacao.auditoria.classificacaoRisco.includes('PERDA DE GARANTIA ESTRUTURAL'));
});

test('4. PILAR 4: Prensa Servo-Hidráulica & Ruptura Automática NBR 5739', () => {
  // Cilindro padrão de 100x200mm rompido com 285.4 kN
  const ensaio = registrarRupturaAutomaticaPrensa({
    loteId: 'LOTE-2026/085',
    cpId: 'CP-01-28D',
    diametroMm: 100,
    alturaMm: 200,
    cargaMaximaKn: 285.4,
    tipoRuptura: 'conica_nbr5739_tipo_a',
    velocidadeMpaS: 0.45
  });

  assert.equal(ensaio.ok, true);
  // Área para d=100mm = 7853.98 mm² -> 285400 N / 7853.98 = ~36.34 MPa
  assert.ok(ensaio.tensaoMpa >= 36.0 && ensaio.tensaoMpa <= 37.0, `Tensão calculada (${ensaio.tensaoMpa} MPa) deve estar próxima de 36.34 MPa`);
  assert.equal(ensaio.conformeNorma, true, 'Velocidade 0.45 MPa/s deve ser conforme NBR 5739 (0.45 ± 0.15)');
  assert.ok(ensaio.registroRuptura.autenticacaoKyttoIA.includes('PRENSA-NBR5739'));
});

test('5. PILAR 5: Medição Consolidada de Obras & Retenções Tributárias LC 116', () => {
  const medicao = gerarMedicaoPeriodicaObra({
    clienteNome: 'Construtora Alvorada Ltda',
    obraNome: 'Residencial Manacá',
    periodoInicio: '2026-11-01',
    periodoFim: '2026-11-15',
    horasBombaLancada: 12,
    valorHoraBomba: 400.0,
    aliquotaIssqn: 3.0,
    aliquotaInss: 11.0
  });

  assert.equal(medicao.ok, true);
  const fin = medicao.medicao.demonstrativoFinanceiro;
  assert.ok(fin.valorBrutoTotal > 0, 'Valor bruto deve ser calculado');
  assert.ok(fin.deducaoMateriaisLc116 > 0, 'Dedução de materiais LC 116 deve ser aplicada (70%)');
  assert.ok(fin.baseCalculoIssqn < fin.valorBrutoTotal, 'Base de ISSQN deve ser reduzida pela dedução legal de materiais');
  assert.ok(fin.valorIssqnRetido > 0, 'ISSQN retido na fonte deve ser apurado');
  assert.ok(fin.valorInssRetido > 0, 'INSS retido na fonte deve ser apurado');
  assert.ok(fin.valorLiquidoFaturado < fin.valorBrutoTotal, 'Valor líquido faturado deve refletir as retenções na fonte');
  assert.ok(medicao.medicao.dreUnitarioPorM3.margemContribuicaoM3 > 0, 'DRE por m³ deve apresentar margem de contribuição positiva');
});
