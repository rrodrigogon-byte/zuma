import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { expireCommerceReservations, purgeExpiredCommercePublicData } from './commerce-retention.js';

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
  const reservationScheduleAt = serverSource.lastIndexOf('startCommerceReservationExpiryCleanup()');
  const listenAt = serverSource.lastIndexOf('app.listen(PORT');
  assert.ok(purgeAt > 0 && scheduleAt > purgeAt && reservationScheduleAt > scheduleAt && listenAt > reservationScheduleAt);
  assert.match(serverSource, /FATAL: falha no boot seguro do SetPoint/);
  assert.doesNotMatch(serverSource, /function commercePublicLimit/);
});

test('expiração concorrente sai sem DML quando outra instância possui o lease', async () => {
  const calls = [];
  const database = { transaction: async callback => callback({ query: async (sql, values = []) => {
    calls.push({ sql, values });
    return { rows: [{ acquired: false }] };
  } }) };
  assert.deepEqual(await expireCommerceReservations(database), { expiredOrders: 0, leaseAcquired: false });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /pg_try_advisory_xact_lock/);
});

test('expiração não seleciona pedidos com pagamento autorizado ou capturado', async () => {
  const calls = [];
  const database = { transaction: async callback => callback({ query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
    return { rows: [] };
  } }) };
  assert.deepEqual(await expireCommerceReservations(database), { expiredOrders: 0, failedOrders: [], leaseAcquired: true });
  assert.match(calls[1].sql, /NOT EXISTS[\s\S]*commerce_payments[\s\S]*authorized','captured/);
});

test('um pedido com erro não trava a expiração dos outros (savepoint por pedido)', async () => {
  const ruim = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const bom = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const empresa = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const calls = [];
  const database = { transaction: async callback => callback({ query: async (sql, values = []) => {
    calls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
    if (sql.includes('FOR UPDATE OF o SKIP LOCKED')) return { rows: [{ empresa_id: empresa, id: ruim, status: 'pending_payment' }, { empresa_id: empresa, id: bom, status: 'pending_payment' }] };
    if (sql.includes('FROM commerce_orders') && sql.includes('FOR UPDATE') && values[1] === ruim) { const error = new Error('conflito'); error.code = 'INVENTORY_STATE_CONFLICT'; throw error; }
    if (sql.includes('FROM commerce_orders') && sql.includes('FOR UPDATE') && values[1] === bom) return { rows: [{ id: bom, status: 'pending_payment', storefront_id: null, total: '10.00' }] };
    return { rows: [] };
  } }) };
  const result = await expireCommerceReservations(database);
  assert.equal(result.expiredOrders, 1);
  assert.deepEqual(result.failedOrders, [{ orderId: ruim, code: 'INVENTORY_STATE_CONFLICT' }]);
  assert.ok(calls.includes('ROLLBACK TO SAVEPOINT'), 'desfaz só o pedido com erro');
  assert.ok(calls.filter(c => c.startsWith('SAVEPOINT')).length === 2);
});
