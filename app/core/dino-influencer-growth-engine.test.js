import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERFIL_DINO,
  PROTOCOLO_RESET_ALGORITMO,
  MATRIZ_REELS_VIRAL,
  processarGatilhoDirect,
  PLANOS_CLUBE_DINO_HIBRIDO,
  calcularPotencialAceleracaoDino,
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
