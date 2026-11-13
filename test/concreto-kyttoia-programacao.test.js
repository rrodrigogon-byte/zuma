import test from 'node:test';
import assert from 'node:assert/strict';
import { simularSlumpLossML, executarAnaliseEscalaKyttoIA } from '../app/modules/concreto/ia-programacao.js';
import { analisarEscalaProgramacaoKyttoIA, aplicarEscalaSugeridaKyttoIA } from '../app/modules/concreto/servico.js';

test('1. simularSlumpLossML - Predição de perda de abatimento e evaporação ACI 305R', () => {
  // Cenário padrão: dia quente em Tangará da Serra/MT (34°C, 50% UR, 35 min)
  const res = simularSlumpLossML({
    slumpInicialCm: 14.0,
    temperaturaAmbienteC: 34.0,
    umidadeRelativaPct: 50.0,
    tempoViagemMin: 35.0,
    tipoAditivo: 'retardador_pr',
    volumeM3: 8.0,
    velocidadeVentoKmH: 15.0
  });

  assert.equal(res.ok, true);
  assert.equal(res.slumpInicialUsinaCm, 14.0);
  assert.equal(res.temperaturaAmbienteC, 34.0);
  assert.equal(res.tempoViagemMin, 35.0);
  assert.ok(res.perdaCalculadaCm > 0, 'Perda de abatimento deve ser maior que zero');
  assert.ok(res.slumpObraPrevistoCm < 14.0, 'Slump na obra deve ser menor que o inicial');
  assert.ok(res.slumpObraPrevistoCm >= 12.0, 'Com retardador PR, o slump na obra deve permanecer seguro');
  assert.ok(res.taxaEvaporacaoKgM2H > 0, 'Taxa de evaporação superficial deve ser positiva');
  assert.ok(['baixo', 'moderado', 'critico'].includes(res.riscoFissuracao));
  assert.ok(res.curvaTempoSlump.length >= 10, 'Deve conter curva de abatimento em intervalos de 15 min');
  assert.equal(res.curvaTempoSlump[0].slumpCm, 14.0, 'No minuto 0 o slump deve ser o inicial');
  assert.ok(res.curvaTempoSlump[10].slumpCm <= 14.0, 'Slump deve decrescer ao longo do tempo');
});

test('2. simularSlumpLossML - Detecção de slump inviável para bombeamento (< 10cm) e alerta corretivo', () => {
  // Cenário severo: 42°C, 20% UR, 90 min sem aditivo
  const res = simularSlumpLossML({
    slumpInicialCm: 10.0,
    temperaturaAmbienteC: 42.0,
    umidadeRelativaPct: 20.0,
    tempoViagemMin: 90.0,
    tipoAditivo: 'sem_aditivo',
    volumeM3: 8.0,
    velocidadeVentoKmH: 25.0
  });

  assert.equal(res.ok, true);
  assert.ok(res.slumpObraPrevistoCm < 10.0);
  assert.equal(res.statusBombeabilidade, 'inviavel');
  assert.ok(res.dosagemCompensatoriaMlM3 > 0, 'Deve sugerir dosagem compensatória de superplastificante');
  assert.equal(res.riscoFissuracao, 'critico', 'Taxa extrema deve disparar risco crítico de fissuração');
});

test('3. executarAnaliseEscalaKyttoIA - Otimização de frota, carrossel e prevenção de gargalos NBR 7212', () => {
  const analise = executarAnaliseEscalaKyttoIA([], '2026-11-13', {
    temperaturaAmbienteC: 32.0,
    umidadeRelativaPct: 55.0
  });

  assert.equal(analise.ok, true);
  assert.ok(analise.scoreEficiencia >= 70 && analise.scoreEficiencia <= 100);
  assert.ok(analise.totalViagens >= 3);
  assert.ok(analise.volumeTotalM3 > 0);
  assert.ok(analise.betoneirasUtilizadas.length > 0);
  assert.ok(analise.sugestoesEscala.length >= 3);

  // Validar campos de cada viagem escalada
  const vg1 = analise.sugestoesEscala[0];
  assert.ok(vg1.betoneira);
  assert.ok(vg1.motorista);
  assert.ok(vg1.placa);
  assert.ok(vg1.horarioSaidaUsina);
  assert.ok(vg1.horarioChegadaObraPrevisto);
  assert.ok(vg1.horarioFimDescargaPrevisto);
  assert.ok(vg1.tempoTotalCuraPegaMinutos <= vg1.limitePegaNbr7212Minutos);
  assert.ok(vg1.slumpPrevistoObraCm > 0);

  // Validar timeline usinagem Convicta
  assert.ok(analise.timelineUsinagem.length >= 3);
  assert.ok(analise.timelineUsinagem[0].inicioCarregamentoMin !== undefined);

  // Validar benchmarks NBR e referências de mercado
  assert.ok(analise.benchmarkMercadoNBR.normasRegulamentadoras.length >= 4);
  const nbr7212 = analise.benchmarkMercadoNBR.normasRegulamentadoras.find(n => n.codigo.includes('7212'));
  assert.ok(nbr7212, 'Deve conter referência explícita à NBR 7212');

  // Validar ecossistema aberto GitHub e MCPs
  assert.ok(analise.ecossistemaAberto.repositoriosGitHub.length >= 3);
  assert.ok(analise.ecossistemaAberto.mcpsRecomendados.length >= 3);
  assert.ok(analise.diagnosticoKyttoIA.includes('KyttoIA'));
  assert.ok(!analise.diagnosticoKyttoIA.includes('Gemini'), 'Diretriz de marca: jamais exibir Gemini');
});

test('4. analisarEscalaProgramacaoKyttoIA e aplicarEscalaSugeridaKyttoIA - Integração do serviço', async () => {
  const analise = await analisarEscalaProgramacaoKyttoIA();
  assert.equal(analise.ok, true);
  assert.ok(analise.totalViagens > 0);

  const aplicacao = await aplicarEscalaSugeridaKyttoIA(analise.sugestoesEscala);
  assert.equal(aplicacao.ok, true);
});
