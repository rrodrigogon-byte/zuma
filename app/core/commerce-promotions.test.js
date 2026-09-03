import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPromotionToOrder } from './commerce-promotions.js';
import { CommerceError } from './commerce-core.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';

function existingPromotionTrx(codigo = 'DINO10') {
  const calls = [];
  return {
    calls,
    trx: {
      async query(sql, values = []) {
        calls.push({ sql, values });
        if (sql.includes('FROM commerce_orders')) return { rows: [{ id: orderId, storefront_id: '44444444-4444-4444-8444-444444444444', customer_id: null, status: 'pending_payment', subtotal: '30.00', desconto: '3.00', frete: '0.00', impostos: '0.00', total: '27.00' }] };
        if (sql.includes('FROM commerce_order_promotions')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', codigo, tipo: 'percentage', desconto: '3.00' }] };
        throw new Error(`query inesperada: ${sql}`);
      },
    },
  };
}

test('replay do mesmo cupom retorna o desconto existente sem incrementar uso novamente', async () => {
  const { trx, calls } = existingPromotionTrx('DINO10');
  const result = await applyPromotionToOrder(trx, { empresaId, lojaId }, { orderId, codigo: ' dino10 ' });
  assert.deepEqual(result, { orderId, codigo: 'DINO10', tipo: 'percentage', desconto: 3, total: 27 });
  assert.equal(calls.filter(call => call.sql.includes('UPDATE commerce_promotions')).length, 0);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_order_promotions')).length, 0);
});

test('replay com cupom diferente preserva a promoção já aplicada e retorna conflito', async () => {
  const { trx } = existingPromotionTrx('DINO10');
  await assert.rejects(
    () => applyPromotionToOrder(trx, { empresaId, lojaId }, { orderId, codigo: 'OUTRO20' }),
    error => error instanceof CommerceError && error.code === 'PROMOTION_ALREADY_APPLIED',
  );
});
