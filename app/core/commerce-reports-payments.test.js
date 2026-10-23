import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { salesReport } from './commerce-reports.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
test('relatório separa valor de pedidos das capturas, com período e escopo tenant/loja', async () => {
  const original = db.query, calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT p.method')) return { rows: [{ method:'pix', transactions:2, value:'6.00' }] };
    if (sql.includes("p.captured_at AT TIME ZONE 'America/Cuiaba'")) return { rows: [{ day:'2026-09-02', transactions:2, total:'6.00' }] };
    if (sql.includes("AT TIME ZONE 'America/Cuiaba'")) return { rows: [{ day:'2026-09-01', orders_total:4, orders_non_cancelled:2, pending_orders:1, cancelled_orders:1, refunded_orders:1, confirmed_orders:1, total:'13206.00', confirmed_total:'6.00' }] };
    return { rows: [{ orders_total:4, orders_non_cancelled:2, pending_orders:1, cancelled_orders:1, refunded_orders:1, confirmed_orders:1, cancelled_or_refunded_orders:2, gross_total:'13206.00', confirmed_total:'6.00', pending_total:'13200.00' }] };
  };
  try {
    const result = await salesReport({ empresaId, lojaId }, {from:'2026-09-01',to:'2026-10-01'});
    assert.equal(result.summary.orders_total, 4);
    assert.equal(result.summary.orders_non_cancelled, 2);
    assert.equal(result.summary.pending_orders, 1);
    assert.equal(result.summary.cancelled_orders, 1);
    assert.equal(result.summary.refunded_orders, 1);
    assert.equal(result.summary.gross_total, '13206.00');
    assert.equal(result.summary.confirmed_orders, 1);
    assert.equal(result.summary.confirmed_total, '6.00');
    assert.equal(result.summary.pending_total, '13200.00');
    assert.equal(result.daily[0].cancelled_orders, 1);
    assert.equal(result.daily[0].pending_orders, 1);
    assert.equal(result.daily[0].confirmed_total, '6.00');
    assert.deepEqual(result.capturedPayments, [{method:'pix',transactions:2,value:'6.00'}]);
    assert.deepEqual(result.capturedDaily, [{day:'2026-09-02', transactions:2, total:'6.00'}]);
    const summary = calls.find(c=>c.sql.includes('FROM commerce_orders o') && !c.sql.includes("date_trunc('day'"));
    assert.match(summary.sql, /o\.status = 'pending_payment'/);
    assert.match(summary.sql, /o\.status = 'cancelled'/);
    assert.match(summary.sql, /o\.status = 'refunded'/);
    assert.match(summary.sql, /SUM\(o\.total\) FILTER \(WHERE o\.status NOT IN \('cancelled','refunded'\)\)/);
    assert.match(summary.sql, /o\.status = ANY\(\$4::text\[\]\)/);
    const capture = calls.find(c=>c.sql.includes('SELECT p.method'));
    assert.match(capture.sql, /p\.status = 'captured'/);
    assert.match(capture.sql, /p\.captured_at >= \$2/);
    assert.match(capture.sql, /p\.captured_at < \$3/);
    assert.match(capture.sql, /o\.empresa_id = p\.empresa_id AND o\.id = p\.order_id/);
    assert.match(capture.sql, /loja_id = \$4/);
    assert.deepEqual(capture.params,[empresaId,'2026-09-01T00:00:00.000Z','2026-10-01T00:00:00.000Z', lojaId]);
    const daily = calls.find(c => c.sql.includes("AT TIME ZONE 'America/Cuiaba'") && c.sql.includes('commerce_orders'));
    assert.match(daily.sql, /confirmed_total/);
  } finally {db.query=original;}
});
