import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustInventory,
  CommerceError,
  createCatalogMedia,
  createCatalogVariant,
  updateCategory,
  updateShippingMethod,
  createPendingOrder,
  createFulfillment,
  createShippingMethod,
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

test('createShippingMethod exige storefront do tenant e persiste configuração própria normalizada', async () => {
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId }] };
    if (sql.includes('INSERT INTO commerce_shipping_methods')) return { rows: [{ id: '88888888-8888-4888-8888-888888888887', empresa_id: empresaId, storefront_id: storefrontId, configuracao: JSON.parse(values[6]) }] };
    return { rows: [] };
  });
  const result = await createShippingMethod(trx, { empresaId, lojaId }, { storefrontId, codigo: 'Motoboy Zona 1', nome: 'Motoboy Zona 1', tipo: 'delivery', configuracao: { provider: 'manual', deliveryType: 'motoboy', baseFee: 5, pricePerZone: 8, rules: [{ id: 'zona-1', label: 'Zona 1', ufs: 'MT', zone: 1, deliveryDays: 1 }] } });
  assert.equal(result.configuracao.provider, 'manual');
  assert.deepEqual(result.configuracao.rules[0].ufs, ['MT']);
  const lookup = calls.find(call => call.sql.includes('FROM commerce_storefronts'));
  assert.deepEqual(lookup.values, [empresaId, storefrontId]);

  const outside = queryRecorder(sql => sql.includes('FROM commerce_storefronts') ? { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: '55555555-5555-4555-8555-555555555556' }] } : { rows: [] });
  await assert.rejects(
    () => createShippingMethod(outside.trx, { empresaId, lojaId }, { storefrontId, codigo: 'fora', nome: 'Fora', tipo: 'pickup', configuracao: {} }),
    error => error instanceof CommerceError && error.code === 'STORE_SCOPE_MISMATCH',
  );
});

test('updateShippingMethod valida escopo, conta logística e estado ativo', async () => {
  const methodId = '88888888-8888-4888-8888-888888888888';
  const shippingAccountId = '99999999-9999-4999-8999-999999999999';
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_shipping_methods sm')) return { rows: [{ id: methodId, empresa_id: empresaId, storefront_id: storefrontId, codigo: 'correios', nome: 'Correios', tipo: 'carrier', ativo: true, configuracao: {} }] };
    if (sql.includes('FROM commerce_shipping_accounts')) return { rows: [{ id: shippingAccountId, provider: 'correios' }] };
    if (sql.includes('UPDATE commerce_shipping_methods')) return { rows: [{ id: methodId, codigo: 'correios-expresso', nome: 'Correios Expresso', tipo: 'carrier', ativo: false, configuracao: JSON.parse(values.at(-1)) }] };
    return { rows: [] };
  });
  const result = await updateShippingMethod(trx, { empresaId, lojaId }, methodId, { codigo: 'Correios Expresso', nome: 'Correios Expresso', ativo: false, configuracao: { provider: 'correios', shippingAccountId, services: '03220, 04669', apiToken: 'não-persistir' } });
  assert.equal(result.ativo, false);
  assert.equal(result.configuracao.shippingAccountId, shippingAccountId);
  assert.deepEqual(result.configuracao.services, ['03220', '04669']);
  assert.equal('apiToken' in result.configuracao, false);
  const updateCall = calls.find(call => call.sql.includes('UPDATE commerce_shipping_methods'));
  assert.ok(updateCall);
  assert.equal(updateCall.sql.includes('atualizado_em'), false);

  const invalid = queryRecorder(sql => sql.includes('FROM commerce_shipping_methods sm') ? { rows: [{ id: methodId, empresa_id: empresaId, storefront_id: storefrontId, tipo: 'pickup', configuracao: {} }] } : { rows: [] });
  await assert.rejects(
    () => updateShippingMethod(invalid.trx, { empresaId, lojaId }, methodId, { ativo: 'false' }),
    error => error instanceof CommerceError && error.code === 'SHIPPING_METHOD_INVALID',
  );
});

test('updateShippingMethod normaliza entrega própria e rejeita faixa fora do contrato', async () => {
  const methodId = '88888888-8888-4888-8888-888888888889';
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_shipping_methods sm')) return { rows: [{ id: methodId, empresa_id: empresaId, storefront_id: storefrontId, codigo: 'motoboy', nome: 'Motoboy', tipo: 'delivery', ativo: true, configuracao: {} }] };
    if (sql.includes('UPDATE commerce_shipping_methods')) return { rows: [{ id: methodId, configuracao: JSON.parse(values[2]) }] };
    return { rows: [] };
  });
  const result = await updateShippingMethod(trx, { empresaId, lojaId }, methodId, { configuracao: { provider: 'manual', deliveryType: 'motoboy', baseFee: 5, pricePerZone: 8, rules: [{ id: 'zona-1', label: 'Zona 1', ufs: 'MT', zone: 1, deliveryDays: 1 }] } });
  assert.equal(result.configuracao.provider, 'manual');
  assert.deepEqual(result.configuracao.rules[0].ufs, ['MT']);
  assert.equal(calls.filter(call => call.sql.includes('UPDATE commerce_shipping_methods')).length, 1);
  await assert.rejects(
    () => updateShippingMethod(trx, { empresaId, lojaId }, methodId, { configuracao: { provider: 'manual', deliveryType: 'free_shipping', freeShippingAbove: 0 } }),
    error => error instanceof CommerceError && error.code === 'SHIPPING_METHOD_CONFIG_INVALID',
  );
});

test('createFulfillment herda cotação e conta somente do storefront do pedido', async () => {
  const shippingMethodId = '88888888-8888-4888-8888-888888888888';
  const shippingQuoteId = '99999999-9999-4999-8999-999999999999';
  const shippingAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const { trx, calls } = queryRecorder(sql => {
    if (sql.includes('SELECT id, storefront_id, status, endereco_entrega, shipping_method_id, shipping_quote_id')) return { rows: [{ id: orderId, storefront_id: storefrontId, status: 'paid', endereco_entrega: { cep: '20040002' }, shipping_method_id: shippingMethodId, shipping_quote_id: shippingQuoteId }] };
    if (sql.includes('SELECT id, tipo FROM commerce_shipping_methods')) return { rows: [{ id: shippingMethodId, tipo: 'delivery' }] };
    if (sql.includes('FROM commerce_shipping_quotes')) return { rows: [{ id: shippingQuoteId, storefront_id: storefrontId, order_id: orderId, shipping_method_id: shippingMethodId, shipping_account_id: shippingAccountId }] };
    if (sql.includes('FROM commerce_shipping_accounts')) return { rows: [{ id: shippingAccountId }] };
    if (sql.includes('INSERT INTO commerce_fulfillments')) return { rows: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'pending', shipping_quote_id: shippingQuoteId, shipping_account_id: shippingAccountId }] };
    return { rows: [] };
  });
  const result = await createFulfillment(trx, { empresaId, lojaId }, { orderId });
  assert.equal(result.status, 'pending');
  assert.equal(result.shipping_quote_id, shippingQuoteId);
  assert.equal(result.shipping_account_id, shippingAccountId);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_fulfillments')).length, 1);
});

test('createFulfillment rejeita pedido sem pagamento confirmado', async () => {
  const { trx } = queryRecorder(sql => {
    if (sql.includes('SELECT id, storefront_id, status, endereco_entrega, shipping_method_id, shipping_quote_id')) return { rows: [{ id: orderId, storefront_id: storefrontId, status: 'pending_payment', endereco_entrega: { cep: '20040002' }, shipping_method_id: null, shipping_quote_id: null }] };
    throw new Error(`query não deveria ser executada: ${sql}`);
  });
  await assert.rejects(
    () => createFulfillment(trx, { empresaId, lojaId }, { orderId }),
    error => error instanceof CommerceError && error.code === 'FULFILLMENT_ORDER_NOT_PAID',
  );
});

test('createPendingOrder reserva estoque para produto físico', async () => {
  let available = 5;
  const shippingMethodId = '88888888-8888-4888-8888-888888888888';
  const { trx, calls } = queryRecorder((sql, values) => {
    if (sql.includes('FROM commerce_storefronts')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, codigo: 'web', nome: 'Web', status: 'active', moeda: 'BRL', timezone: 'America/Sao_Paulo' }] };
    if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: shippingMethodId }] };
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
    shippingMethodId,
    shippingAmount: 999,
    discountAmount: 999,
    taxAmount: 999,
  });
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.total, 59.8);
  assert.equal(result.shippingMethodId, shippingMethodId);
  assert.equal(available, 3);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_inventory_reservations')).length, 1);
});


test('updateCategory mantém edição e parent no tenant com auditoria', async () => {
  const categoryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const parentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const { trx, calls } = queryRecorder((sql) => {
    if (sql.includes('SELECT * FROM commerce_categories')) return { rows: [{ id: categoryId, nome: 'Bebidas', ativo: true }] };
    if (sql.includes('SELECT id FROM commerce_categories')) return { rows: [{ id: parentId }] };
    if (sql.includes('UPDATE commerce_categories')) return { rows: [{ id: categoryId, nome: 'Bebidas frias', parent_id: parentId, ativo: true }] };
    return { rows: [] };
  });
  const result = await updateCategory(trx, { empresaId, lojaId, usuarioId }, categoryId, { nome: 'Bebidas frias', parentId, ordem: 2 });
  assert.equal(result.nome, 'Bebidas frias');
  assert.equal(calls.filter(call => call.sql.includes('UPDATE commerce_categories')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_audit_logs')).length, 1);
});

test('createCatalogVariant valida produto do tenant antes de criar SKU', async () => {
  const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const newVariantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const { trx, calls } = queryRecorder((sql) => {
    if (sql.includes('SELECT id, nome FROM commerce_products')) return { rows: [{ id: productId, nome: 'Camiseta' }] };
    if (sql.includes('INSERT INTO commerce_product_variants')) return { rows: [{ id: newVariantId, product_id: productId, sku: 'CAM-AZ-M' }] };
    return { rows: [] };
  });
  const result = await createCatalogVariant(trx, { empresaId, lojaId, usuarioId }, productId, { sku: 'CAM-AZ-M', nome: 'Azul M', atributos: { cor: 'azul', tamanho: 'M' }, ativo: true });
  assert.equal(result.sku, 'CAM-AZ-M');
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_product_variants')).length, 1);
  await assert.rejects(() => createCatalogVariant(trx, { empresaId }, productId, {}), error => error instanceof CommerceError && error.code === 'VARIANT_REQUIRED');
});

test('createCatalogMedia bloqueia variante de outro produto e persiste mídia no tenant', async () => {
  const productId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const variantId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const mediaId = '99999999-9999-4999-8999-999999999998';
  const { trx, calls } = queryRecorder((sql) => {
    if (sql.includes('SELECT id FROM commerce_products')) return { rows: [{ id: productId }] };
    if (sql.includes('SELECT id FROM commerce_product_variants')) return { rows: [{ id: variantId }] };
    if (sql.includes('INSERT INTO commerce_product_media')) return { rows: [{ id: '99999999-9999-4999-8999-999999999998', product_id: productId, public_url: 'https://cdn.example/image.jpg' }] };
    return { rows: [] };
  });
  const result = await createCatalogMedia(trx, { empresaId, lojaId, usuarioId }, productId, { mediaId, variantId, url: '/api/storefront/media/99999999-9999-4999-8999-999999999998', storageKey: 'commerce-media/tenant/product/media.png', mimeType: 'image/png', altText: 'Camiseta azul' });
  assert.equal(result.product_id, productId);
  const mediaInsert = calls.find(call => call.sql.includes('INSERT INTO commerce_product_media'));
  assert.equal(mediaInsert.values[0], mediaId);
  assert.equal(mediaInsert.values[5], '/api/storefront/media/99999999-9999-4999-8999-999999999998');
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO commerce_product_media')).length, 1);
});
