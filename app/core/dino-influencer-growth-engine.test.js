import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERFIL_DINO,
  PROTOCOLO_RESET_ALGORITMO,
  MATRIZ_REELS_VIRAL,
  processarGatilhoDirect,
  PLANOS_CLUBE_DINO_HIBRIDO,
  calcularPotencialAceleracaoDino,
  obterHistoricoMetricasDiarias,
  registrarMetricasDiarias,
  gerarInsightsDiariosKyttoIA,
  formatarReportDiarioWhatsApp,
} from './dino-influencer-growth-engine.js';

test('dino-influencer: perfil oficial e metricas do SocialBlade estao corretos', () => {
  assert.equal(PERFIL_DINO.handle, '@odinovisagista');
  assert.equal(PERFIL_DINO.metricasSocialBlade.seguidores, 17020);
  assert.equal(PERFIL_DINO.metricasSocialBlade.seguindo, 8234);
  assert.equal(PERFIL_DINO.metricasSocialBlade.variacao30Dias, -124);
  assert.equal(PERFIL_DINO.metricasSocialBlade.mediaDiariaSeguidores, -4.0);
  assert.ok(PERFIL_DINO.regiaoAtendida.includes('Tangará da Serra'));
  assert.ok(PERFIL_DINO.regiaoAtendida.includes('Campo Novo do Parecis'));
});

test('dino-influencer: protocolo de unfollow e reset de algoritmo sao seguros', () => {
  assert.equal(PROTOCOLO_RESET_ALGORITMO.fase1_desintoxicacao_following.unfollowDiarioRecomendado, 60);
  assert.equal(PROTOCOLO_RESET_ALGORITMO.fase1_desintoxicacao_following.metaSeguindo, 750);
});

test('dino-influencer: matriz de reels possui roteiros com ganchos e produtos mapeados', () => {
  assert.ok(MATRIZ_REELS_VIRAL.length >= 7);
  const r1 = MATRIZ_REELS_VIRAL.find((r) => r.id === 'R1');
  assert.ok(r1.titulo.includes('Calor'));
  assert.equal(r1.palavraChaveDirect, 'CALOR');
});

test('dino-influencer: processarGatilhoDirect formata respostas com links e canais', () => {
  const respArabe = processarGatilhoDirect({ palavraChave: 'ARABE', nomeSeguidor: 'Carlos Silva' });
  assert.ok(respArabe.texto.includes('Carlos'));
  assert.ok(respArabe.texto.includes('Lattafa Asad'));
  assert.ok(respArabe.whatsappDireto.includes('wa.me/5565993360000'));

  const respVisagismo = processarGatilhoDirect({ palavraChave: 'VISAGISMO', nomeSeguidor: 'Mateus' });
  assert.ok(respVisagismo.texto.includes('Mateus'));
  assert.ok(respVisagismo.texto.includes('30% OFF'));
});

test('dino-influencer: planos de clube hibrido e calculo financeiro estao validos', () => {
  assert.equal(PLANOS_CLUBE_DINO_HIBRIDO.length, 3);
  const vip = PLANOS_CLUBE_DINO_HIBRIDO.find((p) => p.planoId === 'cavalheiro_vip');
  assert.equal(vip.mensalidade, 249.00);

  const potencial = calcularPotencialAceleracaoDino();
  assert.ok(potencial.faturamentoNovoBruto > 100000);
  assert.ok(potencial.faturamentoNovoBrutoFormatado.includes('R$'));
  assert.ok(potencial.impactoAnualProjetado > 1200000);
});

test('dino-influencer: historico de metricas diárias e cálculo de saldo ganhos/perdidos', async () => {
  const historico = await obterHistoricoMetricasDiarias({ dias: 14 });
  assert.ok(historico.historico.length >= 14);
  assert.ok(historico.hoje.seguidoresTotal >= 17020);
  assert.equal(historico.hoje.seguidoresSaldo, historico.hoje.seguidoresGanhos - historico.hoje.seguidoresPerdidos);
  assert.ok(historico.resumoPeriodo.totalGanhos > 0);
  assert.ok(historico.resumoPeriodo.totalPerdidos > 0);
});

test('dino-influencer: registrarMetricasDiarias atualiza store em memória e preserva integridade', async () => {
  const novoDia = await registrarMetricasDiarias({
    dataReferencia: '2026-11-15',
    seguidoresGanhos: 25,
    seguidoresPerdidos: 10,
    unfollowsDia: 60,
    reelsPublicados: 1,
    directsRecebidos: 20,
    borrifadasRealizadas: 50,
    vendasPerfumesQtd: 8,
    vendasPerfumesValor: 3040,
    assinantesClubeNovos: 3,
    receitaTotalDia: 4031
  });
  assert.equal(novoDia.seguidoresSaldo, 15);
  assert.equal(novoDia.seguidoresGanhos, 25);
  assert.equal(novoDia.seguidoresPerdidos, 10);
  assert.equal(novoDia.receitaTotalDia, 4031);
});

test('dino-influencer: gerarInsightsDiariosKyttoIA gera 5 insights clínicos estruturados', async () => {
  const resultado = await gerarInsightsDiariosKyttoIA();
  assert.equal(resultado.motorIA, 'Motor KyttoIA 2.5 Flash');
  assert.equal(resultado.insights.length, 5);
  assert.ok(resultado.insights[0].categoria.includes('Balanço de Seguidores'));
  assert.ok(resultado.insights[1].categoria.includes('Desintoxicação'));
  assert.ok(resultado.insights[4].categoria.includes('Missão Tática'));
});

test('dino-influencer: formatarReportDiarioWhatsApp gera mensagem executiva completa', async () => {
  const report = await formatarReportDiarioWhatsApp();
  assert.ok(report.includes('[CANAL OFICIAL DE GOVERNANÇA & GESTÃO DINO]'));
  assert.ok(report.includes('INSIGHTS DIÁRIOS & SOCIAL GROWTH DINO 360°'));
  assert.ok(report.includes('Motor KyttoIA 2.5 Flash'));
  assert.ok(report.includes('Seguidores Totais:'));
  assert.ok(report.includes('Ganhos no Dia:'));
  assert.ok(report.includes('Perdidos no Dia:'));
  assert.ok(report.includes('Saldo Líquido:'));
  assert.ok(report.includes('MISSÃO TÁTICA DE AMANHÃ PARA O DINO'));
  assert.ok(report.includes('https://kytto.com.br/admin/barbearia-erp?tab=Dino+Influencer+%26+Perfumaria+360%C2%B0'));
});
