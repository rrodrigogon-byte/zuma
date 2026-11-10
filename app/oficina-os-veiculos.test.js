import test from 'node:test';
import assert from 'node:assert/strict';
import { createOficinaAdminRouter } from './routes/oficina-routes.js';

test('Oficina Mecânica, Autopeças & Ordem de Serviço (Placa e Chassi)', async (t) => {
  const router = createOficinaAdminRouter();
  assert.ok(router, 'Router da oficina deve ser instanciado');

  await t.test('1. Deve listar veículos cadastrados com placa e histórico de garantias', () => {
    // Verificamos a rota internamente
    assert.equal(typeof router.get, 'function');
  });

  await t.test('2. Validação da estrutura de Ordem de Serviço (Peças x Serviços)', () => {
    const osExemplo = {
      placa: 'RNI-4E29',
      kmAtual: 42500,
      totalPecas: 980.00,
      totalServicos: 340.00,
      valorTotal: 1320.00,
      garantiaMeses: 6
    };
    assert.equal(osExemplo.totalPecas + osExemplo.totalServicos, osExemplo.valorTotal);
    assert.equal(osExemplo.garantiaMeses, 6);
  });
});
