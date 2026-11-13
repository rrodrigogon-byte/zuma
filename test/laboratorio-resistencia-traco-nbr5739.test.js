import test from 'node:test';
import assert from 'node:assert/strict';
import { obterComparativoResistenciaNbr5739PorTraco } from '../app/modules/concreto/servico.js';
import { CONCRETO_EMPRESA_ID } from '../app/concreto-usina-seed.js';

test('Módulo Concreto - Comparativo NBR 5739 por Traço', async (t) => {
  await t.test('deve retornar estrutura com normas, prensa e resumo geral', () => {
    const res = obterComparativoResistenciaNbr5739PorTraco(CONCRETO_EMPRESA_ID);
    assert.equal(res.ok, true);
    assert.ok(Array.isArray(res.normas));
    assert.ok(res.normas.some(n => n.includes('5739')));
    assert.ok(res.prensaEletroHidraulica);
    assert.equal(res.resumoGeral.totalTracos >= 6, true);
    assert.equal(res.resumoGeral.conformidadePercentual, 100);
  });

  await t.test('deve conter os traços FCK 20 a 40 e Traço Sustentável Bio-Concreto com curvas de ganho', () => {
    const res = obterComparativoResistenciaNbr5739PorTraco(CONCRETO_EMPRESA_ID);
    const tracos = res.tracos;
    assert.ok(tracos.length >= 6);

    const fck30 = tracos.find(t => t.fckProjeto === 30 && !t.esg);
    assert.ok(fck30);
    assert.ok(fck30.fc7d > 0);
    assert.ok(fck30.fc28d >= fck30.fckProjeto);
    assert.ok(fck30.fcjDosagem > fck30.fckProjeto);
    assert.equal(fck30.conforme, true);
    assert.equal(fck30.curvaEvolucao.length, 5); // 3d, 7d, 14d, 28d, 63d

    const sustentavel = tracos.find(t => t.esg);
    assert.ok(sustentavel);
    assert.equal(sustentavel.fckProjeto, 30);
    assert.ok(sustentavel.fc63d > sustentavel.fc28d, 'Ganho pozolânico aos 63 dias deve superar os 28 dias');
  });
});
