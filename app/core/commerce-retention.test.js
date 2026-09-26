import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { purgeExpiredCommercePublicData } from './commerce-retention.js';

const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('retenção remove avaliações vencidas e contadores públicos expirados', async () => {
  const calls = [];
  const database = { query: async sql => {
    calls.push(sql);
    return { rowCount: calls.length === 1 ? 3 : 7, rows: [] };
  } };
  const result = await purgeExpiredCommercePublicData(database);
  assert.deepEqual(result, { satisfactionDeleted: 3, rateLimitsDeleted: 7 });
  assert.match(calls[0], /retencao_ate <= CURRENT_TIMESTAMP/);
  assert.match(calls[1], /expires_at <= CURRENT_TIMESTAMP/);
});

test('servidor purga antes do listen e mantém retenção periódica com Commerce Core ativo', () => {
  const purgeAt = serverSource.lastIndexOf('await purgeExpiredCommercePublicData()');
  const scheduleAt = serverSource.lastIndexOf('startCommerceRetentionCleanup()');
  const listenAt = serverSource.lastIndexOf('app.listen(PORT');
  assert.ok(purgeAt > 0 && scheduleAt > purgeAt && listenAt > scheduleAt);
  assert.match(serverSource, /FATAL: falha no boot seguro do SetPoint/);
  assert.doesNotMatch(serverSource, /function commercePublicLimit/);
});
