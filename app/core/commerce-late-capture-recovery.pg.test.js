import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';
import { recoverExpiredPaidOrder } from './commerce-core.js';

const enabled = process.env.COMMERCE_RECOVERY_TEST_DB === 'dino_recovery_local_test'
  && process.env.PGHOST === '/var/run/postgresql' && process.env.PGUSER === 'postgres';
const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const store = '33333333-3333-4333-8333-333333333333';
const storefront = '44444444-4444-4444-8444-444444444444';
const order = '55555555-5555-4555-8555-555555555555';
const payment = '66666666-6666-4666-8666-666666666666';
const account = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const method = '77777777-7777-4777-8777-777777777777';
const location = '88888888-8888-4888-8888-888888888888';
const variant = '99999999-9999-4999-8999-999999999999';
const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const context = { empresaId: tenant, lojaId: store, usuarioId: user };
const input = { orderId: order, storefrontId: storefront, idempotencyKey: 'recovery-synthetic-unique-001', reason: 'Captura confirmada para retirada no teste',
  verifyCaptured: async paymentRow => ({ status: 'captured', providerPaymentId: paymentRow.provider_payment_id, amount: Number(paymentRow.amount), summary: { verifiedBy: 'payment_check' } }) };

async function fixture() {
  const db = new Client({ host: '/var/run/postgresql', user: 'postgres', database: process.env.COMMERCE_RECOVERY_TEST_DB, ssl: false });
  await db.connect();
  await db.query(`CREATE TEMP TABLE commerce_orders(id uuid, empresa_id uuid, storefront_id uuid, loja_id uuid, status text, total numeric, shipping_method_id uuid, shipping_quote_id uuid, customer_id uuid, public_code text, atualizado_em timestamptz)`);
  await db.query(`CREATE TEMP TABLE commerce_order_events(empresa_id uuid, order_id uuid, de_status text, para_status text, origem text, usuario_id uuid, correlation_id text, payload_resumido jsonb)`);
  await db.query(`CREATE TEMP TABLE commerce_idempotency_keys(empresa_id uuid, scope text, key text, request_hash text, expires_at timestamptz, response_status int, response_body jsonb, UNIQUE(empresa_id,scope,key))`);
  await db.query(`CREATE TEMP TABLE commerce_payments(id uuid, empresa_id uuid, order_id uuid, status text, provider text, provider_payment_id text, amount numeric, method text, payment_account_id uuid, metadata jsonb, refunded_at timestamptz, atualizado_em timestamptz)`);
  await db.query(`CREATE TEMP TABLE commerce_payment_accounts(id uuid, empresa_id uuid, ambiente text, secret_ref text, public_config jsonb)`);
  await db.query(`CREATE TEMP TABLE commerce_shipping_methods(id uuid, empresa_id uuid, storefront_id uuid, tipo text, ativo boolean)`);
  await db.query(`CREATE TEMP TABLE commerce_storefronts(id uuid, empresa_id uuid, loja_id uuid, status text)`);
  await db.query(`CREATE TEMP TABLE lojas(id uuid, empresa_id uuid, ativa boolean)`);
  await db.query(`CREATE TEMP TABLE commerce_fulfillments(empresa_id uuid, order_id uuid)`);
  await db.query(`CREATE TEMP TABLE commerce_loyalty_ledger(empresa_id uuid, referencia_tipo text, referencia_id uuid)`);
  await db.query(`CREATE TEMP TABLE commerce_loyalty_settings(empresa_id uuid, loja_id uuid, ativo boolean, pontos_por_real numeric, valor_minimo_compra numeric, validade_dias int)`);
  await db.query(`CREATE TEMP TABLE commerce_order_items(empresa_id uuid, order_id uuid, variant_id uuid, quantidade int)`);
  await db.query(`CREATE TEMP TABLE commerce_inventory_reservations(id uuid DEFAULT gen_random_uuid(), empresa_id uuid, order_id uuid, location_id uuid, variant_id uuid, quantidade int, status text, expira_em timestamptz, atualizado_em timestamptz)`);
  await db.query(`CREATE TEMP TABLE commerce_inventory_locations(id uuid, empresa_id uuid, loja_id uuid, ativo boolean)`);
  await db.query(`CREATE TEMP TABLE commerce_product_variants(id uuid, empresa_id uuid, product_id uuid, ativo boolean)`);
  await db.query(`CREATE TEMP TABLE commerce_products(id uuid, empresa_id uuid, status text)`);
  await db.query(`CREATE TEMP TABLE commerce_inventory_levels(id uuid DEFAULT gen_random_uuid(), empresa_id uuid, location_id uuid, variant_id uuid, disponivel int, reservado int, comprometido int, atualizado_em timestamptz)`);
  await db.query(`CREATE TEMP TABLE commerce_inventory_movements(empresa_id uuid, location_id uuid, variant_id uuid, tipo text, quantidade int, saldo_anterior int, saldo_posterior int, referencia_tipo text, referencia_id uuid, idempotency_key text, usuario_id uuid, observacao text)`);
  await db.query(`CREATE TEMP TABLE commerce_audit_logs(empresa_id uuid, loja_id uuid, usuario_id uuid, entidade text, entidade_id uuid, acao text, antes jsonb, depois jsonb, correlation_id text)`);
  await db.query('INSERT INTO lojas VALUES ($1,$2,true)', [store, tenant]);
  await db.query(`INSERT INTO commerce_storefronts VALUES ($1,$2,$3,'active')`, [storefront, tenant, store]);
  await db.query(`INSERT INTO commerce_shipping_methods VALUES ($1,$2,$3,'pickup',true)`, [method, tenant, storefront]);
  await db.query(`INSERT INTO commerce_orders VALUES ($1,$2,$3,$4,'cancelled',85,$5,null,null,'KC-SYNTHETIC',now())`, [order, tenant, storefront, store, method]);
  await db.query(`INSERT INTO commerce_order_events(empresa_id,order_id,de_status,para_status,origem) VALUES ($1,$2,'pending_payment','cancelled','reservation_expiry')`, [tenant, order]);
  await db.query(`INSERT INTO commerce_payment_accounts VALUES ($1,$2,'sandbox','test-reference','{}')`, [account, tenant]);
  await db.query(`INSERT INTO commerce_payments(id,empresa_id,order_id,status,provider,provider_payment_id,amount,method,payment_account_id,metadata) VALUES ($1,$2,$3,'captured','infinitepay','tx-synthetic',85,'pix',$4,$5::jsonb)`, [payment, tenant, order, account, JSON.stringify({ lateCapture: { state: 'refund_required' } })]);
  await db.query('INSERT INTO commerce_products VALUES ($1,$2,$3)', [product, tenant, 'active']);
  await db.query('INSERT INTO commerce_product_variants VALUES ($1,$2,$3,true)', [variant, tenant, product]);
  await db.query('INSERT INTO commerce_inventory_locations VALUES ($1,$2,$3,true)', [location, tenant, store]);
  await db.query('INSERT INTO commerce_order_items VALUES ($1,$2,$3,1)', [tenant, order, variant]);
  await db.query(`INSERT INTO commerce_inventory_reservations(empresa_id,order_id,location_id,variant_id,quantidade,status) VALUES ($1,$2,$3,$4,1,'released')`, [tenant, order, location, variant]);
  await db.query('INSERT INTO commerce_inventory_levels(empresa_id,location_id,variant_id,disponivel,reservado,comprometido) VALUES ($1,$2,$3,10,0,0)', [tenant, location, variant]);
  return db;
}

async function snap(db) {
  const [o, p, levels, r, audit, loyalty, events] = await Promise.all([
    db.query('SELECT status FROM commerce_orders WHERE id=$1', [order]),
    db.query(`SELECT status, metadata #>> '{lateCapture,state}' AS review FROM commerce_payments WHERE id=$1`, [payment]),
    db.query('SELECT disponivel,reservado,comprometido FROM commerce_inventory_levels WHERE variant_id=$1', [variant]),
    db.query('SELECT status,count(*)::int AS n FROM commerce_inventory_reservations WHERE order_id=$1 GROUP BY status ORDER BY status', [order]),
    db.query(`SELECT count(*)::int AS n FROM commerce_audit_logs WHERE acao='late_capture_recovered'`),
    db.query('SELECT count(*)::int AS n FROM commerce_loyalty_ledger'),
    db.query(`SELECT count(*)::int AS n FROM commerce_order_events WHERE origem='late_capture_recovery'`),
  ]);
  return { order: o.rows[0].status, payment: p.rows[0], level: levels.rows[0], reservations: r.rows, audits: audit.rows[0].n, loyalty: loyalty.rows[0].n, events: events.rows[0].n };
}

test('captura tardia: reserva nova e compromisso atômicos, pedido pago e replay sem duplicidade', { skip: !enabled }, async () => {
  const db = await fixture();
  try {
    await db.query('BEGIN');
    assert.equal((await recoverExpiredPaidOrder(db, context, input)).status, 'paid');
    await db.query('COMMIT');
    const after = await snap(db);
    assert.deepEqual(after.level, { disponivel: 9, reservado: 0, comprometido: 1 });
    assert.deepEqual(after.reservations, [{ status: 'confirmed', n: 1 }, { status: 'released', n: 1 }]);
    assert.equal(after.payment.review, 'accepted_for_fulfillment');
    assert.equal(after.order, 'paid');
    assert.equal(after.audits, 1);
    assert.equal(after.events, 1);
    await db.query('BEGIN');
    assert.equal((await recoverExpiredPaidOrder(db, context, input)).status, 'paid');
    await db.query('COMMIT');
    assert.deepEqual(await snap(db), after);
    await db.query('BEGIN');
    await assert.rejects(() => recoverExpiredPaidOrder(db, context, { ...input, reason: 'Motivo diferente e potencialmente perigoso' }), e => e.code === 'IDEMPOTENCY_CONFLICT');
    await db.query('ROLLBACK');
    await db.query('BEGIN');
    await assert.rejects(() => recoverExpiredPaidOrder(db, { ...context, empresaId: other }, input), e => e.code === 'ORDER_NOT_FOUND');
    await db.query('ROLLBACK');
  } finally { await db.end(); }
});

test('estoque indisponível ou captura duvidosa: zero pedido pago, zero crédito, zero DML persistido', { skip: !enabled }, async () => {
  const db = await fixture();
  try {
    await db.query('UPDATE commerce_inventory_levels SET disponivel=0');
    const before = await snap(db);
    await db.query('BEGIN');
    await assert.rejects(() => recoverExpiredPaidOrder(db, context, input), e => e.code === 'INSUFFICIENT_STOCK');
    await db.query('ROLLBACK');
    assert.deepEqual(await snap(db), before);
    await db.query('UPDATE commerce_inventory_levels SET disponivel=10');
    await db.query(`UPDATE commerce_payments SET status='refunded'`);
    const refunded = await snap(db);
    await db.query('BEGIN');
    await assert.rejects(() => recoverExpiredPaidOrder(db, context, input), e => e.code === 'ORDER_RECOVERY_PAYMENT_CONFLICT');
    await db.query('ROLLBACK');
    assert.deepEqual(await snap(db), refunded);
  } finally { await db.end(); }
});

test('captura dupla ou logística/loyalty/fulfillment prévio: recuperação recusa sem efeitos', { skip: !enabled }, async () => {
  for (const scenario of ['second_payment', 'capture_conflict', 'refunded_at', 'fulfillment', 'loyalty', 'delivery', 'other_store']) {
    const db = await fixture();
    try {
      if (scenario === 'second_payment') await db.query(`INSERT INTO commerce_payments(id,empresa_id,order_id,status,provider,provider_payment_id,amount,method,payment_account_id,metadata) VALUES (gen_random_uuid(),$1,$2,'captured','infinitepay','tx-other',85,'pix',$3,'{}')`, [tenant, order, account]);
      if (scenario === 'capture_conflict') await db.query(`INSERT INTO commerce_audit_logs(empresa_id,entidade,entidade_id,acao) VALUES ($1,'payment',$2,'provider_capture_conflict')`, [tenant, payment]);
      if (scenario === 'refunded_at') await db.query(`UPDATE commerce_payments SET refunded_at=now()`);
      if (scenario === 'fulfillment') await db.query('INSERT INTO commerce_fulfillments VALUES ($1,$2)', [tenant, order]);
      if (scenario === 'loyalty') await db.query(`INSERT INTO commerce_loyalty_ledger VALUES ($1,'commerce_order',$2)`, [tenant, order]);
      if (scenario === 'delivery') await db.query(`UPDATE commerce_shipping_methods SET tipo='delivery'`);
      if (scenario === 'other_store') await db.query('UPDATE commerce_inventory_locations SET loja_id=$1', [other]);
      const before = await snap(db);
      await db.query('BEGIN');
      await assert.rejects(() => recoverExpiredPaidOrder(db, context, input), error => {
        assert.match(error.code, /^ORDER_RECOVERY_/);
        return true;
      }, scenario);
      await db.query('ROLLBACK');
      assert.deepEqual(await snap(db), before, scenario);
    } finally { await db.end(); }
  }
});

test('prova externa revogada entre sync e lock: sem pedido pago nem estoque comprometido', { skip: !enabled }, async () => {
  const db = await fixture();
  try {
    const before = await snap(db);
    for (const fakeStatus of ['pending', 'refunded', 'failed']) {
      await db.query('BEGIN');
      await assert.rejects(() => recoverExpiredPaidOrder(db, context, {
        ...input, verifyCaptured: async () => ({ status: fakeStatus, providerPaymentId: 'tx-synthetic', amount: 85, summary: { verifiedBy: 'payment_check' } }),
      }), e => e.code === 'ORDER_RECOVERY_PAYMENT_CONFLICT');
      await db.query('ROLLBACK');
      assert.deepEqual(await snap(db), before);
    }
    await db.query('BEGIN');
    await assert.rejects(() => recoverExpiredPaidOrder(db, context, {
      ...input, verifyCaptured: async () => ({ status: 'captured', providerPaymentId: 'tx-different', amount: 85, summary: { verifiedBy: 'payment_check' } }),
    }), e => e.code === 'ORDER_RECOVERY_PAYMENT_CONFLICT');
    await db.query('ROLLBACK');
    assert.deepEqual(await snap(db), before);
  } finally { await db.end(); }
});
