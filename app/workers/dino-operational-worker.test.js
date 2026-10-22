import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../core/database.js';
import { createDinoNpsProcessHandler, runDinoOperationalBatch, startDinoOperationalWorker } from './dino-operational-worker.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';
const leaseToken = '44444444-4444-4444-8444-444444444444';

function task(overrides = {}) {
  return {
    id: taskId,
    empresa_id: empresaId,
    loja_id: lojaId,
    efeito: 'charge.create',
    status: 'processing',
    attempts: 1,
    lease_token: leaseToken,
    payload_sanitizado: { amount: 10 },
    ...overrides,
  };
}

function useDb({ query, transaction } = {}) {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  if (query) db.query = query;
  if (transaction) db.transaction = transaction;
  return () => {
    db.query = originalQuery;
    db.transaction = originalTransaction;
  };
}

function resultFor(sql, params) {
  if (sql.includes("status = 'succeeded'")) return { rowCount: 1, rows: [{ status: 'succeeded', id: taskId }] };
  if (sql.includes("status = 'failed'")) return { rowCount: 1, rows: [{ status: 'failed', id: taskId, dead_letter: params[4] }] };
  return { rowCount: 0, rows: [] };
}

test('worker com handler ausente nunca inventa sucesso e envia a dead-letter', async () => {
  const queries = [];
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (sql.includes('WITH candidates')) return { rowCount: 1, rows: [task()] };
        return { rowCount: 0, rows: [] };
      },
    }),
    query: async (sql, params) => {
      queries.push({ sql, params });
      return resultFor(sql, params);
    },
  });
  try {
    const summary = await runDinoOperationalBatch({ workerId: 'worker-a', handlers: {}, now: new Date('2026-01-01T00:00:00Z') });
    assert.equal(summary.claimed, 1);
    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.deadLettered, 1);
    assert.equal(summary.retried, 0);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params[4], true);
    assert.match(queries[0].params[5], /DINO_HANDLER_MISSING/);
  } finally { restore(); }
});

test('worker executa handler injetado e conclui com resultado', async () => {
  let handled = 0;
  const queries = [];
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (sql.includes('WITH candidates')) return { rowCount: 1, rows: [task()] };
        return { rowCount: 0, rows: [] };
      },
    }),
    query: async (sql, params) => {
      queries.push({ sql, params });
      return resultFor(sql, params);
    },
  });
  try {
    const summary = await runDinoOperationalBatch({
      workerId: 'worker-a',
      handlers: { 'charge.create': async claimed => { handled += 1; assert.equal(claimed.id, taskId); return { ok: true }; } },
      now: new Date('2026-01-01T00:00:00Z'),
    });
    assert.equal(handled, 1);
    assert.equal(summary.completed, 1);
    assert.equal(summary.failed, 0);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /status = 'succeeded'/);
  } finally { restore(); }
});

test('worker registra falha retryable com backoff sem marcar sucesso', async () => {
  const queries = [];
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (sql.includes('WITH candidates')) return { rowCount: 1, rows: [task()] };
        return { rowCount: 0, rows: [] };
      },
    }),
    query: async (sql, params) => {
      queries.push({ sql, params });
      return resultFor(sql, params);
    },
  });
  try {
    const summary = await runDinoOperationalBatch({
      workerId: 'worker-a',
      handlers: { 'charge.create': async () => { throw Object.assign(new Error('provider timeout'), { code: 'TIMEOUT', retryable: true }); } },
    });
    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.retried, 1);
    assert.equal(summary.deadLettered, 0);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params[4], false);
    assert.equal(queries[0].params[6], 12);
  } finally { restore(); }
});

test('lease perdido não conclui nem tenta inventar recuperação', async () => {
  const queries = [];
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (sql.includes('WITH candidates')) return { rowCount: 1, rows: [task()] };
        return { rowCount: 0, rows: [] };
      },
    }),
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rowCount: 0, rows: [] };
    },
  });
  try {
    const summary = await runDinoOperationalBatch({ workerId: 'worker-a', handlers: { 'charge.create': async () => ({ ok: true }) } });
    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.leaseLost, 1);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /status = 'succeeded'/);
  } finally { restore(); }
});

test('duas execuções não duplicam tarefa já reivindicada', async () => {
  let claims = 0;
  let handled = 0;
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (!sql.includes('WITH candidates')) return { rowCount: 0, rows: [] };
        claims += 1;
        return claims === 1 ? { rowCount: 1, rows: [task()] } : { rowCount: 0, rows: [] };
      },
    }),
    query: async sql => sql.includes("status = 'succeeded'")
      ? { rowCount: 1, rows: [{ status: 'succeeded' }] }
      : { rowCount: 0, rows: [] },
  });
  try {
    const handlers = { 'charge.create': async () => { handled += 1; return { ok: true }; } };
    const first = await runDinoOperationalBatch({ workerId: 'worker-a', handlers });
    const second = await runDinoOperationalBatch({ workerId: 'worker-b', handlers });
    assert.equal(first.completed, 1);
    assert.equal(second.claimed, 0);
    assert.equal(handled, 1);
  } finally { restore(); }
});

test('flag desligada não inicia loop nem consulta banco', () => {
  const previous = process.env.DINO_OPERATIONAL_WORKER_ENABLED;
  delete process.env.DINO_OPERATIONAL_WORKER_ENABLED;
  try {
    const worker = startDinoOperationalWorker({ handlers: {} });
    assert.equal(worker.started, false);
    assert.equal(worker.reason, 'disabled');
  } finally {
    if (previous === undefined) delete process.env.DINO_OPERATIONAL_WORKER_ENABLED;
    else process.env.DINO_OPERATIONAL_WORKER_ENABLED = previous;
  }
});

test('handler nps.process só conclui com resposta canônica existente no mesmo escopo', async () => {
  let consultas = 0;
  const handler = createDinoNpsProcessHandler({
    canonicalEnabled: () => '1',
    db: { queryRead: async (sql, params) => {
      consultas += 1;
      assert.match(sql, /empresa_id = \$2 AND loja_id = \$3/);
      assert.deepEqual(params, [taskId, empresaId, lojaId]);
      return { rows: [{ id: taskId }] };
    } },
  });
  const result = await handler({ empresa_id: empresaId, loja_id: lojaId, payload_sanitizado: { responseId: taskId } });
  assert.deepEqual(result, { verified: true, responseId: taskId });
  assert.equal(consultas, 1);

  const missing = createDinoNpsProcessHandler({ canonicalEnabled: () => true, db: { queryRead: async () => ({ rows: [] }) } });
  await assert.rejects(
    () => missing({ empresa_id: empresaId, loja_id: lojaId, payload_sanitizado: { responseId: taskId } }),
    error => error.code === 'DINO_NPS_RESPONSE_NOT_FOUND' && error.retryable === false,
  );
});

test('handler nps.process com flag desligada não consulta o banco', async () => {
  let consultas = 0;
  const handler = createDinoNpsProcessHandler({ canonicalEnabled: () => false, db: { queryRead: async () => { consultas += 1; return { rows: [{ id: taskId }] }; } } });
  await assert.rejects(
    () => handler({ empresa_id: empresaId, loja_id: lojaId, payload_sanitizado: { responseId: taskId } }),
    error => error.code === 'DINO_NPS_CANONICAL_DISABLED' && error.retryable === false,
  );
  assert.equal(consultas, 0);
});
