import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  processarCicloTransporteGeofenceNBR7212,
  calcularAceitacaoEstatisticaNBR12655,
  monitorarSilosRessuprimentoAutonomo,
  auditarTelemetriaBombaDesgasteNBR15649,
  calcularBalancoCarbonoRecicladorESG
} from '../app/modules/concreto/servico.js';

test('1. SUPERAÇÃO 1: Ciclo de Transporte & Geofencing NBR 7212 (Virtual TrackIt)', () => {
  // Cenário A: Caminhão chegou ao canteiro e aguardou 45 min (15 min excedentes)
  const res1 = processarCicloTransporteGeofenceNBR7212('BT-05', {
    distanciaCanteiroM: 80,
    rpmTambor: 2.5,
    sentidoRotacao: 'agitacao',
    minutosDesdeCarregamento: 48,
    minutosEmCanteiro: 45,
    franquiaEsperaMin: 30,
    valorHoraDemurrage: 180.00
  });

  assert.equal(res1.ok, true);
  assert.equal(res1.geofence.dentroGeofenceCanteiro, true);
  assert.equal(res1.estagioAtual, 'espera_descarga_canteiro');
  assert.equal(res1.geofence.minutosEstadiaExcedente, 15);
  assert.equal(res1.geofence.valorDemurrageGerado, 180.00); // 1 hora cheia faturada
  assert.equal(res1.conformidadeNBR7212.statusTempo, 'DENTRO_DO_PRAZO_VALIDO');
  assert.equal(res1.inviolabilidadeAgua.violacaoDetectada, false);

  // Cenário B: Caminhão violou prazo de 90 min e injetou 40L de água
  const res2 = processarCicloTransporteGeofenceNBR7212('BT-05', {
    distanciaCanteiroM: 60,
    rpmTambor: 12.0,
    sentidoRotacao: 'descarga',
    minutosDesdeCarregamento: 105, // > 90 min
    minutosEmCanteiro: 55,
    sensorVazaoAguaL: 40
  });

  assert.equal(res2.conformidadeNBR7212.statusTempo, 'PRAZO_EXPIRADO_RISCO_PEGA');
  assert.equal(res2.inviolabilidadeAgua.violacaoDetectada, true);
  assert.equal(res2.inviolabilidadeAgua.perdaGarantiaEstrutural, true);
});

test('2. SUPERAÇÃO 2: Aceitação Estatística Rigorosa NBR 12655 (Amostragem Parcial e Total)', () => {
  // Cenário A: Lote Conforme Aprovado (fck 30 MPa, idade 28 dias)
  const loteAprovado = {
    loteId: 'LOTE-VIGAS-T1',
    fckProjetoMPa: 30,
    idadeDias: 28,
    tipoControle: 'amostragem_parcial',
    amostrasRupturaMPa: [33.5, 35.8, 32.1, 34.6, 36.2, 33.0],
    elementoEstrutural: 'Vigas Pavimento 01'
  };

  const res1 = calcularAceitacaoEstatisticaNBR12655(loteAprovado);
  assert.equal(res1.ok, true);
  assert.equal(res1.decisaoNormativa.aprovado, true);
  assert.equal(res1.decisaoNormativa.status, 'LOTE_ESTRUTURAL_CONFORME_APROVADO');
  assert.ok(res1.estatisticas.resistenciaCaracteristicaEstimadaFckEst >= 30);
  assert.ok(res1.certificadoAutenticidade.startsWith('NBR12655-'));

  // Cenário B: Lote Não Conforme (fck 35 MPa, rupturas baixas)
  const loteReprovado = {
    loteId: 'LOTE-PILARES-CRITICOS',
    fckProjetoMPa: 35,
    idadeDias: 28,
    tipoControle: 'amostragem_parcial',
    amostrasRupturaMPa: [26.0, 27.5, 25.8, 28.1, 26.9, 25.4],
    elementoEstrutural: 'Pilares Centrais'
  };

  const res2 = calcularAceitacaoEstatisticaNBR12655(loteReprovado);
  assert.equal(res2.ok, true);
  assert.equal(res2.decisaoNormativa.aprovado, false);
  assert.equal(res2.decisaoNormativa.status, 'NAO_CONFORMIDADE_ESTRUTURAL_CRITICA');
  assert.ok(res2.decisaoNormativa.margemSegurancaMPa < 0);
  assert.ok(res2.decisaoNormativa.parecerTecnico.includes('Esclerometria NBR 7584'));
});

test('3. SUPERAÇÃO 3: Gestão Preditiva de Silos e Ressuprimento Autônomo', () => {
  const res = monitorarSilosRessuprimentoAutonomo();
  assert.equal(res.ok, true);
  assert.equal(res.silos.length, 3);
  assert.ok(res.resumoCCO.totalEstoqueCimentoTon > 0);

  // Silo 02 (CP V-ARI) está próximo do limite de segurança e deve ter PO automática
  const silo2 = res.silos.find(s => s.id === 'silo-02');
  assert.ok(silo2);
  assert.equal(silo2.necessitaRessuprimento, true);
  assert.ok(silo2.ordemCompraDisparada);
  assert.equal(silo2.ordemCompraDisparada.status, 'DISPARADO_AUTOMATICO_VIA_API');
  assert.equal(silo2.ordemCompraDisparada.quantidadeTon, 35.0);
});

test('4. SUPERAÇÃO 4: Telemetria de Bombas de Concreto, Pressão e Vento NBR 15649', () => {
  // Cenário A: Operação Estável com Vento Normal
  const resNormal = auditarTelemetriaBombaDesgasteNBR15649('BOMBA-01', {
    volumeBombeadoHojeM3: 72.0,
    pressaoHidraulicaBar: 175,
    velocidadeVentoKmh: 18.0,
    m3AcumuladosTubulacao: 14000
  });

  assert.equal(resNormal.ok, true);
  assert.equal(resNormal.statusOperacional, 'OPERACAO_NORMAL_CONFORME');
  assert.equal(resNormal.telemetriaAoVivo.bloqueioLancaPorSeguranca, false);
  assert.ok(resNormal.auditoriaDesgasteTubulacaoNBR15649.m3RestantesAteTroca > 0);

  // Cenário B: Rajada de Vento Crítica (> 48 km/h)
  const resVento = auditarTelemetriaBombaDesgasteNBR15649('BOMBA-01', {
    velocidadeVentoKmh: 54.2
  });

  assert.equal(resVento.statusOperacional, 'OPERACAO_INTERROMPIDA_VENTO_CRITICO');
  assert.equal(resVento.telemetriaAoVivo.bloqueioLancaPorSeguranca, true);
  assert.ok(resVento.alertaSeguranca.includes('VENTO SUPEROU 48 KM/H'));
});

test('5. SUPERAÇÃO 5: Balanço de Carbono ESG & Reciclador Ecológico (NBR ISO 14064)', () => {
  const res = calcularBalancoCarbonoRecicladorESG(80.0, 30);
  assert.equal(res.ok, true);
  assert.equal(res.volumeTotalM3, 80.0);
  assert.ok(res.pegadaCarbonoGEE.pegadaTotalKgCO2e > 0);
  assert.ok(res.pegadaCarbonoGEE.pegadaUnitariaKgCO2ePorM3 > 0);
  assert.ok(res.recicladorSustentabilidadeRioSepotuba.aguaPreservadaLençolL > 0);
  assert.equal(res.recicladorSustentabilidadeRioSepotuba.efluenteDescartadoSoloLitros, 0);
  assert.ok(res.certificadoESGVerde.startsWith('ESG-GREEN-'));
});
