import assert from 'node:assert/strict';
import test from 'node:test';
import { satisfactionEligible, submitOrderSatisfaction } from './commerce-satisfaction.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const storefrontId = '22222222-2222-4222-8222-222222222222';
const lojaId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const satisfactionId = '55555555-5555-4555-8555-555555555555';
const context = { empresaId, storefrontId, lojaId };
const input = { rating: 5, wouldRecommend: true, comment: 'não deve ser armazenado', idempotencyKey: 'satisfaction-KC-TEST-12345678901234567890' };

function housekeeping(sql) {
  if (sql.includes('pg_advisory_xact_lock') || sql.includes('DELETE FROM commerce_order_satisfaction')) return { rows: [] };
  return null;
}

test('elegibilidade exige entrega, retirada ou conclusão', () => {
  assert.equal(satisfactionEligible('pending_payment', []), false);
  assert.equal(satisfactionEligible('delivered', []), true);
  assert.equal(satisfactionEligible('processing', [{ status: 'picked_up' }]), true);
});

test('bloqueia pesquisa antes da conclusão do pedido', async () => {
  const trx = { query: async sql => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'pending_payment', loja_id: lojaId, fulfillments: [] }] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await assert.rejects(() => submitOrderSatisfaction(trx, context, 'KC-TEST', input), error => error.code === 'SATISFACTION_NOT_AVAILABLE');
});

test('grava uma única avaliação tenant-scoped, sem texto livre, e audita com correlação server-side', async () => {
  const calls = [];
  const trx = { query: async (sql, params) => {
    calls.push({ sql, params });
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'completed', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_order_satisfaction')) return { rows: [{ id: satisfactionId, nota: 5, recomendaria: true, criado_em: '2026-09-25T23:00:00Z' }] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  const result = await submitOrderSatisfaction(trx, context, 'kc-test', input);
  assert.equal(result.submitted, true);
  assert.equal(result.idempotentReplay, false);
  const insert = calls.find(call => call.sql.includes('INSERT INTO commerce_order_satisfaction'));
  const advisoryLocks = calls.filter(call => call.sql.includes('pg_advisory_xact_lock'));
  const replayRead = calls.find(call => call.sql.includes('SELECT id, order_id, nota'));
  assert.equal(advisoryLocks.length, 2);
  assert.match(advisoryLocks[0].params[0], /satisfaction-key/);
  assert.match(replayRead.sql, /retencao_ate > CURRENT_TIMESTAMP/);
  assert.deepEqual(insert.params.slice(0, 3), [empresaId, storefrontId, orderId]);
  assert.doesNotMatch(insert.sql, /comentario/);
  assert.equal(insert.params.includes(input.comment), false);
  const audit = calls.find(call => call.sql.includes('INSERT INTO commerce_audit_logs'));
  assert.deepEqual(JSON.parse(audit.params[3]), { minimized: true });
  assert.equal(audit.params[4] === input.idempotencyKey, false);
  assert.match(audit.params[4], /^satisfaction-/);
});

test('replay idempotente devolve a primeira avaliação sem novo insert', async () => {
  let payloadHash = '';
  const firstPass = { query: async (sql, params) => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'delivered', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_order_satisfaction')) { payloadHash = params[6]; return { rows: [{ id: satisfactionId, nota: 5, recomendaria: true, criado_em: '2026-09-25T23:00:00Z' }] }; }
    return { rows: [] };
  } };
  await submitOrderSatisfaction(firstPass, context, 'KC-TEST', input);
  const replay = { query: async sql => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'delivered', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [{ id: satisfactionId, order_id: orderId, nota: 5, recomendaria: true, idempotency_key: input.idempotencyKey, payload_hash: payloadHash, criado_em: '2026-09-25T23:00:00Z' }] };
    throw new Error('não deve inserir novamente');
  } };
  const result = await submitOrderSatisfaction(replay, context, 'KC-TEST', input);
  assert.equal(result.idempotentReplay, true);
});

test('rejeita chave idempotente reaproveitada em outro pedido', async () => {
  const trx = { query: async sql => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'completed', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [{ id: satisfactionId, order_id: '66666666-6666-4666-8666-666666666666', nota: 4, recomendaria: true, idempotency_key: input.idempotencyKey, payload_hash: 'x'.repeat(64), criado_em: '2026-09-25T23:00:00Z' }] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await assert.rejects(() => submitOrderSatisfaction(trx, context, 'KC-TEST', input), error => error.code === 'SATISFACTION_IDEMPOTENCY_CONFLICT');
});

test('rejeita a mesma chave idempotente com conteúdo diferente no mesmo pedido', async () => {
  const trx = { query: async sql => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'completed', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [{ id: satisfactionId, order_id: orderId, nota: 4, recomendaria: false, idempotency_key: input.idempotencyKey, payload_hash: 'x'.repeat(64), criado_em: '2026-09-25T23:00:00Z' }] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await assert.rejects(() => submitOrderSatisfaction(trx, context, 'KC-TEST', input), error => error.code === 'SATISFACTION_IDEMPOTENCY_CONFLICT');
});

test('traduz violação única concorrente para conflito idempotente', async () => {
  const trx = { query: async sql => {
    const common = housekeeping(sql); if (common) return common;
    if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, status: 'completed', loja_id: lojaId, fulfillments: [] }] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_order_satisfaction')) throw Object.assign(new Error('unique'), { code: '23505' });
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await assert.rejects(() => submitOrderSatisfaction(trx, context, 'KC-TEST', input), error => error.code === 'SATISFACTION_IDEMPOTENCY_CONFLICT');
});
