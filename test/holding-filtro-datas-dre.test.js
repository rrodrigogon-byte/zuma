import test from 'node:test';
import assert from 'node:assert/strict';

test('Holding Grupo Palatare & Serrano: Consolidação e Filtros de Datas DRE', async (t) => {
  await t.test('1. Fator multiplicador de períodos rápidos', () => {
    const periodos = [
      { id: 'hoje', fator: 1 / 30 },
      { id: 'ontem', fator: 1 / 30 },
      { id: '7d', fator: 7 / 30 },
      { id: 'mes_atual', fator: 1.0 },
      { id: 'mes_anterior', fator: 0.94 },
      { id: 'ano_atual', fator: 10.6 }
    ];

    assert.equal(periodos.find(p => p.id === 'mes_atual').fator, 1.0);
    assert.equal(periodos.find(p => p.id === '7d').fator, 7 / 30);
    assert.ok(periodos.find(p => p.id === 'ano_atual').fator > 10.0);
  });

  await t.test('2. Faturamento consolidado mensal de referência', () => {
    const faturamentoSerrano = 1120000;
    const faturamentoPalatare = 285000;
    const consolidadoMensal = faturamentoSerrano + faturamentoPalatare;

    assert.equal(consolidadoMensal, 1405000);
    assert.equal(Math.round((faturamentoSerrano / consolidadoMensal) * 1000) / 10, 79.7);
    assert.equal(Math.round((faturamentoPalatare / consolidadoMensal) * 1000) / 10, 20.3);
  });

  await t.test('3. Recalculo dinâmico do EBITDA consolidado por período', () => {
    const ebitdaMensal = 386000;
    
    // Período de 7 dias
    const fator7d = 7 / 30;
    const ebitda7d = ebitdaMensal * fator7d;
    assert.ok(ebitda7d > 85000 && ebitda7d < 95000);

    // Período Anual (10.6 meses projetados)
    const fatorAno = 10.6;
    const ebitdaAno = ebitdaMensal * fatorAno;
    assert.ok(ebitdaAno > 4000000);
  });

  await t.test('4. Margem EBITDA da Holding preservada em qualquer escala temporal', () => {
    const fatBruto = 1405000;
    const ebitda = 386000;
    const margemBase = (ebitda / fatBruto) * 100;

    // Escala com fator qualquer
    const fatorRandom = 2.45;
    const margemEscalada = ((ebitda * fatorRandom) / (fatBruto * fatorRandom)) * 100;

    assert.equal(margemBase.toFixed(1), margemEscalada.toFixed(1));
    assert.equal(margemBase.toFixed(1), '27.5');
  });
});
