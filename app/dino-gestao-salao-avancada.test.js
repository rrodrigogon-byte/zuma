import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDiagnosticoGargalos } from './dino-gestao-salao-avancada.js';

test('gerarDiagnosticoGargalos identifica baixa conversao de produtos e calcula perda estimada', () => {
  const diag = gerarDiagnosticoGargalos({
    revenue: 5000,
    services: 100,
    products: 1, // apenas 1 produto para 100 atendimentos!
    completed: 100,
    noShow: 2,
    canceled: 5,
    ticketAverage: 50,
    topServices: [
      { name: 'Corte Tradicional', quantity: 70, revenue: 3500 },
      { name: 'Barba Terapia', quantity: 10, revenue: 450 }
    ]
  });

  assert.ok(Array.isArray(diag.gargalos));
  assert.ok(diag.gargalos.length > 0);

  const perdaProd = diag.gargalos.find(g => g.tipo === 'produtos_baixos');
  assert.ok(perdaProd);
  assert.ok(perdaProd.perdaEstimada > 0);
  assert.equal(perdaProd.severidade, 'alta');

  const perdaBarba = diag.gargalos.find(g => g.tipo === 'cross_sell_barba');
  assert.ok(perdaBarba);
  assert.ok(perdaBarba.perdaEstimada > 0);

  assert.ok(Array.isArray(diag.sugestoesIA));
  assert.ok(diag.sugestoesIA.length > 0);
});
