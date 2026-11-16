import test from 'node:test';
import assert from 'node:assert/strict';
import * as sorteiosServico from '../app/modules/sorteios/servico.js';

test('Sorteios - Filtro de Período e Geração por Datas', async (t) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  await t.test('1. Normalização de datas aceita atalhos e datas personalizadas', () => {
    const r1 = sorteiosServico.normalizarIntervaloDatas({ periodo: 'este_mes' });
    assert.ok(r1.inicioIso);
    assert.ok(r1.fimIso);

    const r2 = sorteiosServico.normalizarIntervaloDatas({
      dataInicio: '2026-10-01',
      dataFim: '2026-11-16'
    });
    assert.equal(r2.dataInicioStr, '2026-10-01');
    assert.equal(r2.dataFimStr, '2026-11-16');
  });

  await t.test('2. Obtenção de clientes elegíveis filtra apenas clientes atendidos', async () => {
    const res = await sorteiosServico.obterClientesElegiveisPeriodo({
      empresaId,
      periodo: '3_meses',
      apenasAtendidos: true,
      valorMinimo: 0,
    });
    assert.ok(Array.isArray(res.clientes));
    assert.ok(res.total >= 0);
  });

  await t.test('3. Obter prévia do período retorna contadores e amostra de participantes', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    const campId = campanhas[0]?.id;
    assert.ok(campId);

    const previa = await sorteiosServico.obterPreviaPeriodo({
      empresaId,
      campanhaId: campId,
      periodo: '3_meses',
      apenasAtendidos: true,
    });
    assert.equal(previa.ok, true);
    assert.ok(typeof previa.totalClientesElegiveis === 'number');
    assert.ok(typeof previa.totalNovosParaGerar === 'number');
    assert.ok(Array.isArray(previa.previa));
  });

  await t.test('4. Geração por período personalizado atualiza bilhetes e contadores da campanha', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    const camp = campanhas[0];
    assert.ok(camp);

    const totalAntes = camp.totalBilhetes || 0;
    const res = await sorteiosServico.gerarBilhetesPorPeriodo({
      empresaId,
      campanhaId: camp.id,
      dataInicio: '2026-11-01',
      dataFim: '2026-11-16',
      apenasAtendidos: true,
      emitidoPor: 'Teste Automatizado Dino',
    });

    assert.equal(res.ok, true);
    assert.ok(res.totalBilhetesCampanha >= totalAntes);
    assert.ok(res.mensagem.includes('Foram emitidos com sucesso'));
  });
});
