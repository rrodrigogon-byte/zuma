import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrainExecutiveSources } from './ai-brain-data.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const FROM = '2026-09-22T18:00:00.000Z';
const TO = '2026-10-22T18:00:00.000Z';

function scope() {
  return { legacy: COMPANY, legacyLoja: STORE, legacyScopeVerified: true, empresaId: COMPANY, lojaId: STORE };
}

test('loader executivo limita fontes Financeiro/Caixa à loja legado e Commerce à empresa+loja', async () => {
  const calls = [];
  const result = await loadBrainExecutiveSources({ scope: scope(), from: FROM, to: TO, graphSources: { appointments: [], orders: [], catalog: [], quality: { fontes: { appointments: { status: 'ok', registros: 0 }, produtosLocais: { status: 'ok', registros: 0 } }, estoqueLocalEscopo: 'omitido_sem_vinculo_loja' } } }, {
    listLedger: (company, filters) => { calls.push(['ledger', company, filters]); return []; },
    listCash: (company, filters) => { calls.push(['cash', company, filters]); return []; },
    queryRead: async (sql, params) => { calls.push(['commerce', sql, params]); return { rows: sql.includes('commerce_payments') ? [{ transactions: 0, amount: 0 }] : [] }; },
  });
  assert.deepEqual(calls[0], ['ledger', COMPANY, { lojaId: STORE }]);
  assert.deepEqual(calls[1], ['cash', COMPANY, { status: 'fechado', lojaId: STORE }]);
  const commerceCalls = calls.filter((call) => call[0] === 'commerce');
  assert.equal(commerceCalls.length, 3);
  assert.ok(commerceCalls.every((call) => call[2][0] === COMPANY && call[2][1] === STORE));
  assert.ok(commerceCalls.every((call) => !/INSERT|UPDATE|DELETE/i.test(call[1])));
  assert.equal(result.quality.localInventory.status, 'indisponivel');
  assert.equal(result.quality.appointments.status, 'ok');
  assert.equal(result.quality.payments.status, 'ok');
});

test('falha de uma consulta Commerce não derruba as demais fontes', async () => {
  let index = 0;
  const result = await loadBrainExecutiveSources({ scope: scope(), from: FROM, to: TO, graphSources: { appointments: [], orders: [], catalog: [], quality: { fontes: { appointments: { status: 'ok' }, produtosLocais: { status: 'ok' } } } } }, {
    listLedger: () => [{ tipo: 'receita', status: 'pago', valor: 20 }],
    listCash: () => [],
    queryRead: async () => {
      index += 1;
      if (index === 1) throw new Error('database details must not escape');
      return { rows: [] };
    },
  });
  assert.equal(result.quality.orders.status, 'indisponivel');
  assert.equal(result.quality.payments.status, 'ok');
  assert.equal(result.quality.inventory.status, 'limitado');
  assert.equal(result.quality.finance.status, 'ok');
  assert.equal(JSON.stringify(result).includes('database details'), false);
});

test('sem vínculo legado da unidade não consulta Financeiro/Caixa tenant-wide', async () => {
  const calls = [];
  const result = await loadBrainExecutiveSources({
    scope: { legacy: 'legacy-company', legacyLoja: 'legacy-store', legacyScopeVerified: false, empresaId: COMPANY, lojaId: STORE }, from: FROM, to: TO,
    graphSources: { appointments: [], orders: [], catalog: [], quality: { estoqueLocalEscopo: 'nao_mapeado', fontes: { appointments: { status: 'ok' }, produtosLocais: { status: 'indisponivel' } } } },
  }, {
    listLedger: () => { calls.push('ledger'); return []; },
    listCash: () => { calls.push('cash'); return []; },
    queryRead: async (sql) => { calls.push(sql); return { rows: [] }; },
  });
  assert.equal(calls.includes('ledger'), false);
  assert.equal(calls.includes('cash'), false);
  assert.equal(result.quality.finance.status, 'indisponivel');
  assert.equal(result.quality.cash.status, 'indisponivel');
  assert.equal(result.quality.localInventory.status, 'indisponivel');
  assert.ok(calls.filter((call) => typeof call === 'string').every((sql) => /o\.loja_id = \$2|loc\.loja_id = \$2/.test(sql)));
});

test('estoque local preserva mínimo legado para detectar risco de ruptura', async () => {
  const result = await loadBrainExecutiveSources({
    scope: scope(), from: FROM, to: TO,
    graphSources: {
      appointments: [], orders: [], retailSales: [],
      catalog: [{ id: 'local:pomada', nome: 'Pomada', estoque: 2, estoqueMinimo: 5 }],
      quality: { estoqueLocalEscopo: 'unidade_escopada', fontes: { appointments: { status: 'ok' }, produtosLocais: { status: 'ok' }, pedidos: { status: 'ok' } } },
    },
  }, { listLedger: () => [], listCash: () => [], queryRead: async () => ({ rows: [] }) });
  const local = result.commerce.inventory.find((item) => item.id === 'local:pomada');
  assert.equal(local.available, 2);
  assert.equal(local.minimum, 5);
});
