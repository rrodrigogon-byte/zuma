import assert from 'node:assert/strict';
import test from 'node:test';
import { consumePublicRateLimit, publicRequestFingerprint } from './commerce-public-rate-limit.js';

process.env.PUBLIC_RATE_LIMIT_SECRET = 'test-only-public-rate-limit-secret-32-bytes';

const context = { empresaId: '11111111-1111-4111-8111-111111111111', storefrontId: '22222222-2222-4222-8222-222222222222' };

test('fingerprint público usa HMAC estável sem expor o IP', () => {
  const req = { ip: '203.0.113.10', headers: { 'user-agent': 'Browser Test' } };
  const first = publicRequestFingerprint(req);
  const second = publicRequestFingerprint(req);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes('203.0.113.10'), false);
  assert.notEqual(first, publicRequestFingerprint({ ip: '203.0.113.11', headers: { 'user-agent': 'Browser Test' } }));
});

test('fingerprint falha fechado em qualquer ambiente sem segredo configurado', () => {
  const previous = { jwt: process.env.JWT_SECRET, dedicated: process.env.PUBLIC_RATE_LIMIT_SECRET };
  delete process.env.JWT_SECRET;
  delete process.env.PUBLIC_RATE_LIMIT_SECRET;
  try {
    assert.throws(() => publicRequestFingerprint({ ip: '203.0.113.10', headers: {} }), error => error.code === 'PUBLIC_RATE_LIMIT_SECRET_REQUIRED');
  } finally {
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
    if (previous.dedicated === undefined) delete process.env.PUBLIC_RATE_LIMIT_SECRET; else process.env.PUBLIC_RATE_LIMIT_SECRET = previous.dedicated;
  }
});

test('contador compartilhado é tenant/storefront-scoped e bloqueia acima do limite', async () => {
  const calls = [];
  const trx = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO commerce_public_rate_limits')) return { rows: [{ request_count: 6, retry_after_seconds: 421 }] };
    if (sql.includes('DELETE FROM commerce_public_rate_limits')) return { rows: [] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  const result = await consumePublicRateLimit(trx, context, { scope: 'satisfaction-order', subject: 'KC-TEST', fingerprintValue: 'fingerprint', limit: 5, windowSeconds: 600 });
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterSeconds, 421);
  assert.deepEqual(calls[0].params.slice(0, 3), [context.empresaId, context.storefrontId, 'satisfaction-order']);
  assert.match(calls[0].params[3], /^[a-f0-9]{64}$/);
  assert.equal(calls[0].params[3].includes('KC-TEST'), false);
});
