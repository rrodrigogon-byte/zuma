import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DinoReversalError,
  createDinoReversalMemoryAdapter,
  executeDinoReversal,
  getDinoReversalStatus,
  requestDinoReversal,
} from './dino-reversal-coordinator.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const OUTRA_LOJA = '33333333-3333-4333-8333-333333333333';
const baseContext = { empresaId: EMPRESA, lojaId: LOJA };
const baseInput = {
  sourceType: 'comanda', sourceId: 'comanda-1', motivo: 'pagamento duplicado',
  operador: 'operador-1', approvedBy: 'gestor-1', confirmado: true,
  actionId: 'action-1', idempotencyKey: 'dino-reversal-1',
};

function source(overrides = {}) {
  return {
    id: 'comanda-1', empresaId: EMPRESA, lojaId: LOJA,
    pagamentos: [{ id: 'pag-1', meio: 'pix', valor: 100, providerPaymentId: 'provider-1' }],
    financeiroLancamentoIds: [], clienteId: 'customer-1', fidelidadeValorPontuado: 0,
    ...overrides,
  };
}

function allEffects({ calls = [], auditPayloads = [], failInventoryOnce = false } = {}) {
  let inventoryCalls = 0;
  return {
    payment: async () => ({ status: 'manual_required', pending: ['gateway_refund_adapter'], refundRequired: true }),
    financial: async () => { calls.push('financial'); return { status: 'completed' }; },
    cash: async () => { calls.push('cash'); return { status: 'completed' }; },
    inventory: async () => {
      inventoryCalls += 1;
      if (failInventoryOnce && inventoryCalls === 1) throw Object.assign(new Error('temporário'), { code: 'INVENTORY_TIMEOUT', retryable: true });
      calls.push('inventory');
      return { status: 'completed', released: 1 };
    },
    loyalty: async () => { calls.push('loyalty'); return { status: 'completed', points: 10 }; },
    commission: async () => { calls.push('commission'); return { status: 'completed', compensation: 5 }; },
    audit: async payload => { auditPayloads.push(payload); calls.push('audit'); return { status: 'completed', sanitized: true }; },
    source: async () => ({ status: 'completed', sourceId: 'comanda-1' }),
  };
}

test('request é idempotente sob concorrência e conflito de fingerprint é 409', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const [first, second] = await Promise.all([
    requestDinoReversal(baseContext, baseInput, { adapter }),
    requestDinoReversal(baseContext, baseInput, { adapter }),
  ]);
  assert.equal([first, second].filter(item => item.replayed === false).length, 1);
  assert.equal([first, second].filter(item => item.replayed === true).length, 1);
  await assert.rejects(
    () => requestDinoReversal(baseContext, { ...baseInput, actionId: 'action-2', motivo: 'outro motivo' }, { adapter }),
    error => error instanceof DinoReversalError && error.status === 409 && error.code === 'DINO_REVERSAL_IDEMPOTENCY_CONFLICT',
  );
});

test('escopo de loja diferente é bloqueado antes de criar ação', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const original = source();
  await assert.rejects(
    () => executeDinoReversal({ empresaId: EMPRESA, lojaId: OUTRA_LOJA }, { ...baseInput, actionId: 'action-cross', idempotencyKey: 'dino-reversal-cross' }, {
      adapter, resolveSource: () => original, effects: allEffects(),
    }),
    error => error.code === 'DINO_SOURCE_SCOPE_MISMATCH' && error.status === 409,
  );
  assert.equal(adapter.state.actions.size, 0);
});

test('gateway ausente nunca inventa sucesso e retorna manual_required', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const result = await executeDinoReversal(baseContext, baseInput, {
    adapter, source: source(), effects: allEffects(),
  });
  assert.equal(result.status, 'manual_required');
  assert.equal(result.effects.find(item => item.effect === 'payment').status, 'manual_required');
  assert.equal(result.effects.find(item => item.effect === 'payment').result.refundRequired, true);
});

test('efeitos concluídos não repetem após falha intermediária e podem ser reprocessados', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const calls = [];
  let fail = true;
  const effects = {
    payment: async () => { calls.push('payment'); return { status: 'completed' }; },
    inventory: async () => { calls.push('inventory'); if (fail) { fail = false; throw Object.assign(new Error('timeout'), { retryable: true }); } return { status: 'completed' }; },
    loyalty: async () => { calls.push('loyalty'); return { status: 'completed' }; },
    commission: async () => { calls.push('commission'); return { status: 'completed' }; },
    audit: async () => { calls.push('audit'); return { status: 'completed' }; },
    source: async () => ({ status: 'completed' }),
  };
  const first = await executeDinoReversal(baseContext, { ...baseInput, actionId: 'action-fail', idempotencyKey: 'dino-reversal-fail' }, { adapter, source: source({ pagamentos: [{ meio: 'dinheiro', valor: 50 }] }), effects });
  assert.equal(first.status, 'pending');
  const second = await executeDinoReversal(baseContext, { ...baseInput, actionId: 'action-fail', idempotencyKey: 'dino-reversal-fail' }, { adapter, source: source({ pagamentos: [{ meio: 'dinheiro', valor: 50 }] }), effects });
  assert.equal(second.status, 'completed');
  assert.deepEqual(calls.filter(item => item === 'payment'), ['payment']);
  assert.deepEqual(calls.filter(item => item === 'inventory'), ['inventory', 'inventory']);
});

test('auditoria recebe somente contexto operacional sanitizado', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const payloads = [];
  const result = await executeDinoReversal(baseContext, { ...baseInput, actionId: 'action-audit', idempotencyKey: 'dino-reversal-audit', payload: { note: 'ok' } }, {
    adapter, source: source({ pagamentos: [{ meio: 'dinheiro', valor: 10 }] }), effects: {
      payment: async () => ({ status: 'completed' }),
      financial: async () => ({ status: 'skipped' }),
      cash: async () => ({ status: 'skipped' }),
      inventory: async () => ({ status: 'completed' }),
      loyalty: async () => ({ status: 'completed' }),
      commission: async () => ({ status: 'completed' }),
      audit: async payload => { payloads.push(payload); return { status: 'completed' }; },
      source: async () => ({ status: 'completed' }),
    },
  });
  assert.equal(result.status, 'completed');
  assert.equal(payloads.length, 1);
  assert.equal('source' in payloads[0], true);
  assert.equal('authorization' in payloads[0].input.payload, false);
  const auditJson = JSON.stringify(payloads[0]);
  assert.equal(auditJson.includes('clienteNome'), false);
  assert.equal(auditJson.includes('Lucas Novo'), false);
});

test('status retorna efeitos e replay exato', async () => {
  const adapter = createDinoReversalMemoryAdapter();
  const input = { ...baseInput, actionId: 'action-status', idempotencyKey: 'dino-reversal-status' };
  await requestDinoReversal(baseContext, input, { adapter });
  const status = await getDinoReversalStatus(baseContext, { actionId: 'action-status' }, { adapter });
  assert.equal(status.found, true);
  assert.equal(status.actionId, 'action-status');
  assert.equal(status.replayed, true);
});
