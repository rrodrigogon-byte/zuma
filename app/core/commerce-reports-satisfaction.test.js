import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { customerReport } from './commerce-reports.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';

test('relatório de clientes agrega satisfação real com escopo de loja', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*)::integer AS new_customers')) return { rows: [{ new_customers: 2, blocked_customers: 0 }] };
    if (sql.includes('LEFT JOIN commerce_orders')) return { rows: [] };
    if (sql.includes('FROM commerce_order_satisfaction')) return { rows: [{ responses: 3, average_rating: '4.67', recommend_count: 3, recommendation_rate: '100.0' }] };
    throw new Error(`consulta inesperada: ${sql}`);
  };
  let result;
  try {
    result = await customerReport({ empresaId, lojaId }, { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' });
  } finally { db.query = original; }
  assert.equal(result.satisfaction.responses, 3);
  assert.equal(result.satisfaction.average_rating, '4.67');
  const satisfactionCall = calls.find(call => call.sql.includes('FROM commerce_order_satisfaction'));
  assert.match(satisfactionCall.sql, /JOIN commerce_orders o ON o\.empresa_id = s\.empresa_id AND o\.storefront_id = s\.storefront_id AND o\.id = s\.order_id/);
  assert.match(satisfactionCall.sql, /s\.retencao_ate > CURRENT_TIMESTAMP/);
  assert.match(satisfactionCall.sql, /sf\.loja_id = \$4/);
  assert.deepEqual(satisfactionCall.params, [empresaId, '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', lojaId]);
});
