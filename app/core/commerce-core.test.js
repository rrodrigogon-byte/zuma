import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustInventory,
  CommerceError,
  createPendingOrder,
  ORDER_TRANSITIONS,
  assertUuid,
  reserveInventory,
  tenantContext,
  transitionOrder,
} from './commerce-core.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const usuarioId = '33333333-3333-4333-8333-333333333333';
const storefrontId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const locationId = '66666666-6666-4666-8666-666666666666';
const variantId = '77777777-7777-4777-8777-777777777777';
const reservationId = '88888888-8888-4888-8888-888888888888';

function queryRecorder(resolver) {
  const calls = [];
  return {
    calls,
    trx: { query: async (sql, values = []) => { calls.push({ sql, values }); return resolver(sql, values); } },
  };
}

test('tenantContext rejeita ids inválidos e não aceita escopo sem empresa', () => {
  assert.deepEqual(tenantContext({ empresaId, lojaId, usuarioId }), { empresaId, lojaId, usuarioId });
  assert.throws(() => tenantContext({ empresaId: 'empresa-falsa' }), error => error instanceof CommerceError && error.code === 'INVALID_ID');
  assert.equal(assertUuid(empresaId, 'empresaId'), empresaId);
});

test('ORDER_TRANSITIONS impede avanço fora da máquina de estados', async () => {
  const { trx } = queryRecorder(sql => {
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'paid', storefront_id: storefrontId, total: '100.00' }] };
    return { rows: [] };
  });
  await assert.rejects(
    () => transitionOrder(trx, { empresaId, usuarioId }, { orderId, status: 'delivered' }),
    error => error instanceof CommerceError && error.code === 'INVALID_ORDER_TRANSITION',
  );
  assert.deepEqual(ORDER_TRANSITIONS.paid, ['processing', 'cancelled', 'refunded']);
});

test('transitionOrder grava atualização e eventos no mesmo fluxo transacional', async () => {
  const { trx, calls } = queryRecorder(sql => {
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'paid', storefront_id: storefrontId, total: '100.00' }] };
    return { rows: [] };
  });
  const result = await transitionOrder(trx, { empresaId, usuarioId }, {
    orderId,
    status: 'processing',
    origin: 'test',
    correlationId: 'test-correlation',
  });
  assert.equal(result.status, 'processing');
  assert.equal(calls.filter(call => call.sql.includes('UPDATE commerce_orders')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_order_events')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_audit_logs')).length, 1);
});

test('reserveInventory trava saldo, rejeita estoque insuficiente e registra movimentação', async () => {
  let level = { id: 'level-1', disponivel: 10, reservado: 0, comprometido: 0 };
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_idempotency_keys')) return { rows: [] };
    if (sql.includes('FROM commerce_inventory_levels')) return { rows: [level] };
    if (sql.includes('UPDATE commerce_inventory_levels')) { level = { ...level, disponivel: values[3], reservado: values[4] }; return { rows: [] }; }
    return { rows: [] };
  });
  const result = await reserveInventory(trx, { empresaId, usuarioId }, {
    locationId,
    variantId,
    orderId,
    reservationId,
    quantity: 3,
    idempotencyKey: 'reserve-test-1',
  });
  assert.deepEqual(result, { id: reservationId, location_id: locationId, variant_id: variantId, quantidade: 3, status: 'pending', order_id: orderId });
  assert.equal(level.disponivel, 7);
  assert.equal(calls.filter(call => call.sql.includes('FROM commerce_inventory_levels') && call.sql.includes('FOR UPDATE')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_inventory_movements')).length, 1);

  const insufficient = queryRecorder(sql => sql.includes('FROM commerce_inventory_levels')
    ? { rows: [{ id: 'level-1', disponivel: 0, reservado: 0, comprometido: 0 }] }
    : { rows: [] });
  await assert.rejects(
    () => reserveInventory(insufficient.trx, { empresaId }, { locationId, variantId, quantity: 1 }),
    error => error instanceof CommerceError && error.code === 'INSUFFICIENT_STOCK',
  );
});

test('transitionOrder confirma reserva quando o pagamento é aprovado', async () => {
  let level = { disponivel: 7, reservado: 3, comprometido: 0 };
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('SELECT id, status, storefront_id')) return { rows: [{ id: orderId, status: 'pending_payment', storefront_id: storefrontId, total: '100.00' }] };
    if (sql.includes('SELECT id, location_id, variant_id')) return { rows: [{ id: reservationId, location_id: locationId, variant_id: variantId, quantidade: 3, status: 'pending' }] };
    if (sql.includes('SELECT disponivel, reservado, comprometido')) return { rows: [level] };
    if (sql.includes('UPDATE commerce_inventory_levels')) { level = { disponivel: values[3], reservado: values[4], comprometido: values[5] }; return { rows: [] }; }
    return { rows: [] };
  });
  const result = await transitionOrder(trx, { empresaId, usuarioId }, { orderId, status: 'paid', origin: 'payment_webhook' });
  assert.equal(result.status, 'paid');
  assert.deepEqual(level, { disponivel: 7, reservado: 0, comprometido: 3 });
  assert.equal(calls.filter(call => call.sql.includes("'compromisso'") || call.values.includes('compromisso')).length, 1);
});

test('adjustInventory retorna a mesma resposta para uma chave repetida', async () => {
  let level = { disponivel: 4 };
  let storedResponse = null;
  let storedHash = null;
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes("scope = 'inventory.adjust'") && sql.includes('SELECT')) return { rows: storedResponse ? [{ request_hash: storedHash, response_body: storedResponse }] : [] };
    if (sql.includes("'inventory.adjust'") && sql.includes('INSERT INTO commerce_idempotency_keys')) { storedHash = values[2]; return { rows: [] }; }
    if (sql.includes('FROM commerce_inventory_levels')) return { rows: [level] };
    if (sql.includes('UPDATE commerce_inventory_levels')) { level = { disponivel: values[3] }; return { rows: [] }; }
    if (sql.includes('UPDATE commerce_idempotency_keys')) { storedResponse = JSON.parse(values[2]); return { rows: [] }; }
    return { rows: [] };
  });
  const input = { locationId, variantId, delta: 2, idempotencyKey: 'adjust-test-1' };
  const first = await adjustInventory(trx, { empresaId, usuarioId }, input);
  const second = await adjustInventory(trx, { empresaId, usuarioId }, input);
  assert.deepEqual(second, first);
  assert.equal(level.disponivel, 6);
  assert.equal(calls.filter(call => call.sql.includes('UPDATE commerce_inventory_levels')).length, 1);
});

test('createPendingOrder reserva estoque para produto físico', async () => {
  let available = 5;
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, codigo: 'web', nome: 'Web', status: 'active', moeda: 'BRL', timezone: 'America/Sao_Paulo' }] };
    if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: variantId, sku: 'SKU-1', variant_name: 'Tamanho único', product_name: 'Produto físico', product_type: 'physical', price: '29.90', promotional: false }] };
    if (sql.includes('SELECT id FROM commerce_customers')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_customers')) return { rows: [{ id: '99999999-9999-4999-8999-999999999999' }] };
    if (sql.includes('SELECT id FROM commerce_inventory_locations')) return { rows: [{ id: locationId }] };
    if (sql.includes('FROM commerce_inventory_levels')) return { rows: [{ id: 'level-1', disponivel: available, reservado: 0, comprometido: 0 }] };
    if (sql.includes('UPDATE commerce_inventory_levels')) { available = values[3]; return { rows: [] }; }
    return { rows: [] };
  });
  const result = await createPendingOrder(trx, { empresaId, lojaId, usuarioId }, {
    storefrontId,
    items: [{ variantId, quantity: 2 }],
    customer: { nome: 'Cliente de teste' },
    locationId,
    shippingAmount: 999,
    discountAmount: 999,
    taxAmount: 999,
  });
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.total, 59.8);
  assert.equal(available, 3);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_inventory_reservations')).length, 1);
});
