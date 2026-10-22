import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import {
  DinoOperationalError,
  claimDinoEffects,
  completeDinoEffect,
  dinoOutboxHealth,
  enqueueDinoEffect,
  expireDinoOperationalRecords,
  failDinoEffect,
  fingerprintPayload,
  heartbeatDinoEffect,
  retryDelay,
  sanitizePayload,
} from './dino-operational-outbox.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const effectId = '33333333-3333-4333-8333-333333333333';
const leaseToken = '44444444-4444-4444-8444-444444444444';
const financialEntryId = '55555555-5555-4555-8555-555555555555';
const context = { empresaId, lojaId };
const payload = { amount: 10, nested: { b: true, a: 'safe' } };
const fingerprint = fingerprintPayload(payload);
const task = {
  id: effectId,
  empresa_id: empresaId,
  loja_id: lojaId,
  efeito: 'charge.create',
  status: 'processing',
  attempts: 1,
  lease_token: leaseToken,
};

function row(overrides = {}) {
  return {
    id: effectId,
    empresa_id: empresaId,
    loja_id: lojaId,
    efeito: 'charge.create',
    idempotency_key: 'charge-1',
    fingerprint,
    payload_sanitizado: payload,
    status: 'pending',
    attempts: 0,
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

test('helpers fazem sanitização fail-closed e fingerprint estável', () => {
  assert.deepEqual(sanitizePayload({ z: 1, a: { b: true } }), { a: { b: true }, z: 1 });
  assert.equal(fingerprintPayload({ a: 1, b: 2 }), fingerprintPayload({ b: 2, a: 1 }));
  assert.throws(() => sanitizePayload({ access_token: 'do-not-store' }), error => error.code === 'DINO_PAYLOAD_SECRET');
  assert.equal(retryDelay(1), 12);
  assert.equal(retryDelay(99), 1800);
});

test('enqueue replay idêntico retorna o mesmo registro e não duplica', async () => {
  const calls = [];
  const existing = row({ status: 'processing', attempts: 1 });
  let insert = true;
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql, params) {
        calls.push({ sql, params });
        if (sql.includes('INSERT INTO')) {
          if (insert) { insert = false; return { rowCount: 1, rows: [row({ status: 'pending' })] }; }
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [existing] };
      },
    }),
  });
  try {
    const first = await enqueueDinoEffect(context, { effect: 'charge.create', idempotencyKey: 'charge-1', fingerprint, payload });
    const replay = await enqueueDinoEffect(context, { effect: 'charge.create', idempotencyKey: 'charge-1', fingerprint, payload });
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO')).length, 2);
    assert.match(calls[0].sql, /ON CONFLICT \(empresa_id, loja_id, idempotency_key\) DO NOTHING/);
  } finally { restore(); }
});

test('enqueue divergente falha com HTTP 409 e DINO_OUTBOX_CONFLICT', async () => {
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql) {
        if (sql.includes('INSERT INTO')) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [row({ payload_sanitizado: { amount: 99 } })] };
      },
    }),
  });
  try {
    await assert.rejects(
      () => enqueueDinoEffect(context, { effect: 'charge.create', idempotencyKey: 'charge-1', fingerprint, payload }),
      error => error instanceof DinoOperationalError && error.code === 'DINO_OUTBOX_CONFLICT' && error.status === 409,
    );
  } finally { restore(); }
});

test('claim usa SKIP LOCKED, lease e incremento atômico de attempts', async () => {
  let captured;
  const restore = useDb({
    transaction: async callback => callback({
      async query(sql, params) {
        captured = { sql, params };
        return { rowCount: 1, rows: [row({ status: 'processing', attempts: 1, lease_token: leaseToken })] };
      },
    }),
  });
  try {
    const claimed = await claimDinoEffects({ workerId: 'worker-a', limit: 2, leaseSeconds: 45, maxAttempts: 4 });
    assert.equal(claimed[0].status, 'processing');
    assert.match(captured.sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(captured.sql, /attempts = t\.attempts \+ 1/);
    assert.match(captured.sql, /lease_until = CURRENT_TIMESTAMP/);
    assert.match(captured.sql, /status IN \('pending', 'failed'\)/);
    assert.deepEqual(captured.params, [4, 2, 45]);
  } finally { restore(); }
});

test('heartbeat exige tenant, status e token; token antigo nunca conclui', async () => {
  const calls = [];
  const restore = useDb({ query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SET lease_until')) return { rowCount: 1, rows: [row({ status: 'processing', lease_token: leaseToken })] };
    return { rowCount: 0, rows: [] };
  } });
  try {
    const heartbeat = await heartbeatDinoEffect(task, { leaseSeconds: 30 });
    assert.equal(heartbeat.status, 'processing');
    await assert.rejects(
      () => completeDinoEffect({ ...task, lease_token: '66666666-6666-4666-8666-666666666666' }, { ok: true }, db),
      error => error.code === 'DINO_OUTBOX_LEASE_LOST',
    );
    assert.equal(calls.filter(call => call.sql.includes("status = 'processing'")).length, 2);
  } finally { restore(); }
});

test('complete persiste estado financeiro somente com o lease atual', async () => {
  let captured;
  const restore = useDb({ query: async (sql, params) => {
    captured = { sql, params };
    return { rowCount: 1, rows: [row({ status: 'succeeded', financial_entry_id: financialEntryId })] };
  } });
  try {
    const completed = await completeDinoEffect(task, { resultado: { provider: 'ok' }, financial_entry_id: financialEntryId }, db);
    assert.equal(completed.status, 'succeeded');
    assert.deepEqual(completed.resultado, { provider: 'ok' });
    assert.equal(captured.params[4], financialEntryId);
    assert.match(captured.sql, /status = 'succeeded'/);
    assert.match(captured.sql, /lease_token = \$4::uuid/);
  } finally { restore(); }
});

test('fail retryable agenda backoff e não retryable vai a dead-letter/manual_required', async () => {
  const captures = [];
  const restore = useDb({ query: async (sql, params) => {
    captures.push({ sql, params });
    return { rowCount: 1, rows: [row({ status: 'failed' })] };
  } });
  try {
    const retry = await failDinoEffect(task, Object.assign(new Error('timeout'), { code: 'TIMEOUT', retryable: true }), { maxAttempts: 3 });
    const dead = await failDinoEffect({ ...task, attempts: 3 }, Object.assign(new Error('invalid'), { code: 'INVALID', retryable: false }), { maxAttempts: 3 });
    assert.equal(retry.deadLettered, false);
    assert.equal(retry.retryDelay, 12);
    assert.equal(dead.deadLettered, true);
    assert.equal(captures[0].params[4], false);
    assert.equal(captures[1].params[4], true);
    assert.match(captures[1].params[5], /^INVALID:/);
    assert.match(captures[1].sql, /manual_required/);
  } finally { restore(); }
});

test('expiração é transacional, TTL-only e preserva evidência', async () => {
  const calls = [];
  const restore = useDb({ transaction: async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 2, rows: [{ id: effectId }, { id: leaseToken }] };
    },
  }) });
  try {
    const result = await expireDinoOperationalRecords({ empresaId, lojaId, now: '2026-01-01T00:00:00.000Z' });
    assert.deepEqual(result, { reservations: 2, offers: 2, outbox: 2, total: 6, now: '2026-01-01T00:00:00.000Z' });
    assert.equal(calls.length, 3);
    assert.match(calls[0].sql, /status = 'held'/);
    assert.match(calls[1].sql, /status IN \('offered', 'held'\)/);
    assert.match(calls[2].sql, /status = 'processing'/);
    assert.match(calls[2].sql, /lease_token = NULL/);
  } finally { restore(); }
});

test('health agrega contagem tenant+loja, atraso, dead-letter e idade', async () => {
  const restore = useDb({ query: async () => ({ rows: [
    { status: 'pending', count: '2', delayed: '1', dead_letter: '0', average_age_seconds: '4', max_age_seconds: '6' },
    { status: 'failed', count: '1', delayed: '1', dead_letter: '1', average_age_seconds: '8', max_age_seconds: '8' },
  ] }) });
  try {
    const health = await dinoOutboxHealth(context);
    assert.equal(health.total, 3);
    assert.equal(health.delayed, 2);
    assert.equal(health.deadLetter, 1);
    assert.equal(health.counts.pending, 2);
    assert.equal(health.latency.averageAgeSeconds, 16 / 3);
  } finally { restore(); }
});
