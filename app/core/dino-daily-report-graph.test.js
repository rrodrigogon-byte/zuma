import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import {
  compilarMetricasReportGrafico,
  gerarImagemReportGrafico,
  montarLegendaReportGraficos,
  GUARDRAILS_META_INFO,
  GRUPO_GESTAO_DINO_NOME,
  TELEFONE_GUILHERME_DINO,
  verificarEEnviarReportGraficosDiario
} from './dino-daily-report-graph.js';

test('compilarMetricasReportGrafico gera estrutura válida de KPIs e funil', async () => {
  const metricas = await compilarMetricasReportGrafico();
  assert.ok(metricas);
  assert.ok(metricas.dataIso);
  assert.ok(metricas.dataFormatada);
  assert.equal(typeof metricas.totalMensagens, 'number');
  assert.equal(typeof metricas.tmrTrexSegundos, 'number');
  assert.equal(typeof metricas.tmrHumanoMinutos, 'number');
  assert.ok(metricas.tmrTrexSegundos < metricas.tmrHumanoMinutos * 60, 'T-Rex deve ser mais veloz que humano');
  assert.ok(metricas.receitaConfirmada > 0);
  assert.ok(metricas.perdaCancelamento > 0);
});

test('gerarImagemReportGrafico produz arquivo PNG válido e não vazio', async () => {
  const metricas = await compilarMetricasReportGrafico();
  const testOut = '/tmp/test_report_dino.png';
  if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

  const gerado = await gerarImagemReportGrafico(metricas, testOut);
  assert.ok(fs.existsSync(gerado));
  const stats = fs.statSync(gerado);
  assert.ok(stats.size > 50000, `Arquivo PNG deve ter tamanho compatível com alta definição (>50KB), obtido: ${stats.size} bytes`);
});

test('montarLegendaReportGraficos formata mensagem executiva do T-Rex sem termos de spam', async () => {
  const metricas = await compilarMetricasReportGrafico();
  const legenda = montarLegendaReportGraficos(metricas);
  assert.ok(legenda.includes('T-REX'));
  assert.ok(legenda.includes('WhatsApp Gestão Dino'));
  assert.ok(legenda.includes('08H00'));
  assert.ok(!legenda.includes('bit.ly'), 'Não deve conter links encurtadores');
});

test('Guardrails da Meta estão definidos e protegem contra banimento', () => {
  assert.ok(GUARDRAILS_META_INFO.length >= 7);
  assert.equal(GRUPO_GESTAO_DINO_NOME, 'Gestão Dino');
  assert.equal(TELEFONE_GUILHERME_DINO, '5565996722055');
});
