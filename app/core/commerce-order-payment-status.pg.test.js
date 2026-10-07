import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';
import { lateCaptureReviewExistsSql } from './commerce-order-payment-status.js';

const name = process.env.COMMERCE_ORDER_STATUS_TEST_DB;
const enabled = name === 'dino_order_status_local_test'
  && process.env.PGHOST === '/var/run/postgresql'
  && process.env.PGUSER === 'postgres';

test('PostgreSQL: tentativa posterior falha não esconde captura tardia; outro tenant não contamina', { skip: !enabled }, async () => {
  const client = new Client({ host: '/var/run/postgresql', user: 'postgres', database: name, ssl: false });
  await client.connect();
  try {
    await client.query('CREATE TEMP TABLE commerce_orders (id uuid, empresa_id uuid, public_code text)');
    await client.query('CREATE TEMP TABLE commerce_payments (empresa_id uuid, order_id uuid, status text, metadata jsonb, criado_em timestamptz)');
    const tenant = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    const order = '33333333-3333-4333-8333-333333333333';
    const otherOrder = '44444444-4444-4444-8444-444444444444';
    await client.query('INSERT INTO commerce_orders VALUES ($1,$2,$3),($4,$5,$6)', [order, tenant, 'KC-SYNTHETIC', otherOrder, other, 'KC-OTHER']);
    const insert = (company, id, status, metadata, at) => client.query('INSERT INTO commerce_payments VALUES ($1,$2,$3,$4::jsonb,$5::timestamptz)', [company, id, status, JSON.stringify(metadata), at]);
    const query = () => client.query(`SELECT o.public_code, CASE WHEN ${lateCaptureReviewExistsSql} THEN 'captured' ELSE (SELECT p.status FROM commerce_payments p WHERE p.empresa_id=o.empresa_id AND p.order_id=o.id ORDER BY p.criado_em DESC LIMIT 1) END AS payment_status, CASE WHEN ${lateCaptureReviewExistsSql} THEN 'refund_required' ELSE NULL END AS payment_review_status FROM commerce_orders o WHERE o.empresa_id = $1 AND o.public_code = $2`, [tenant, 'KC-SYNTHETIC']);
    await insert(other, otherOrder, 'captured', { lateCapture: { state: 'refund_required' } }, '2026-10-07 09:00:00Z');
    await insert(tenant, order, 'captured', {}, '2026-10-07 09:01:00Z');
    await insert(tenant, order, 'failed', {}, '2026-10-07 09:02:00Z');
    assert.deepEqual((await query()).rows.map(row => [row.payment_status, row.payment_review_status]), [['failed', null]]);
    await insert(tenant, order, 'captured', { lateCapture: { state: 'refund_required' } }, '2026-10-07 09:00:00Z');
    assert.deepEqual((await query()).rows.map(row => [row.payment_status, row.payment_review_status]), [['captured', 'refund_required']]);
  } finally { await client.end(); }
});
