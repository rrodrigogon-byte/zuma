import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';
import { recoverExpiredPaidOrder } from './commerce-core.js';
import { createCommerceAdminRouter } from './commerce-routes.js';
import { paymentProviders } from './payment-adapters.js';
import { db as commerceDb } from './database.js';

const enabled = process.env.COMMERCE_RECOVERY_SCHEMA_DB === 'dino_recovery_schema_test'
  && process.env.PGHOST === '/var/run/postgresql' && process.env.PGUSER === 'postgres';
const tenant = '11111111-1111-4111-8111-111111111111';
const store = '22222222-2222-4222-8222-222222222222';
const user = '33333333-3333-4333-8333-333333333333';
const storefront = '44444444-4444-4444-8444-444444444444';
const order = '55555555-5555-4555-8555-555555555555';
const payment = '66666666-6666-4666-8666-666666666666';
const account = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const method = '77777777-7777-4777-8777-777777777777';
const location = '88888888-8888-4888-8888-888888888888';
const variant = '99999999-9999-4999-8999-999999999999';
const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('schema Commerce completo: recuperar captura/estoque em transação de teste sem persistir dados', { skip: !enabled }, async () => {
  const db = new Client({ host: '/var/run/postgresql', user: 'postgres', database: process.env.COMMERCE_RECOVERY_SCHEMA_DB, ssl: false });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query(`INSERT INTO empresas(id,nome,cnpj,razao_social) VALUES ($1,'Empresa sintética','99999999999991','Empresa sintética')`, [tenant]);
    await db.query(`INSERT INTO lojas(id,empresa_id,codigo,nome) VALUES ($1,$2,'TEST-STORE','Unidade sintética')`, [store,tenant]);
    await db.query(`INSERT INTO usuarios(id,empresa_id,email,senha_hash,nome_completo,role) VALUES ($1,$2,'fixture@example.invalid','test-only-hash','Operador teste','admin')`, [user,tenant]);
    await db.query(`INSERT INTO commerce_storefronts(id,empresa_id,loja_id,codigo,nome,status) VALUES ($1,$2,$3,'test-web','Vitrine sintética','active')`, [storefront,tenant,store]);
    await db.query(`INSERT INTO commerce_shipping_methods(id,empresa_id,storefront_id,codigo,nome,tipo) VALUES ($1,$2,$3,'pickup','Retirada sintética','pickup')`, [method,tenant,storefront]);
    await db.query(`INSERT INTO commerce_inventory_locations(id,empresa_id,loja_id,codigo,nome) VALUES ($1,$2,$3,'TEST-LOC','Estoque sintético')`, [location,tenant,store]);
    await db.query(`INSERT INTO commerce_products(id,empresa_id,slug,nome,status) VALUES ($1,$2,'fixture-product','Produto teste','active')`, [product,tenant]);
    await db.query(`INSERT INTO commerce_product_variants(id,empresa_id,product_id,sku,nome) VALUES ($1,$2,$3,'SKU-TEST','Item teste')`, [variant,tenant,product]);
    await db.query(`INSERT INTO commerce_inventory_levels(empresa_id,location_id,variant_id,disponivel,reservado,comprometido) VALUES ($1,$2,$3,10,0,0)`, [tenant,location,variant]);
    await db.query(`INSERT INTO commerce_orders(id,empresa_id,storefront_id,loja_id,public_code,status,subtotal,total,shipping_method_id) VALUES ($1,$2,$3,$4,'KC-SYNTHETIC-RECOVERY','cancelled',85,85,$5)`, [order,tenant,storefront,store,method]);
    await db.query(`INSERT INTO commerce_order_items(empresa_id,order_id,variant_id,nome_snapshot,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,'Item teste',1,85,85)`, [tenant,order,variant]);
    await db.query(`INSERT INTO commerce_order_events(empresa_id,order_id,de_status,para_status,origem) VALUES ($1,$2,'pending_payment','cancelled','reservation_expiry')`, [tenant,order]);
    await db.query(`INSERT INTO commerce_payment_accounts(id,empresa_id,storefront_id,provider,ambiente,nome,secret_ref,ativo) VALUES ($1,$2,$3,'infinitepay','sandbox','Conta sintética','env:RECOVERY_TEST_TOKEN',true)`, [account,tenant,storefront]);
    await db.query(`INSERT INTO commerce_payments(id,empresa_id,order_id,provider,method,status,amount,provider_payment_id,payment_account_id,metadata) VALUES ($1,$2,$3,'infinitepay','pix','captured',85,'tx-synthetic',$4,$5::jsonb)`, [payment,tenant,order,account,JSON.stringify({ lateCapture: { state: 'refund_required' } })]);
    await db.query(`INSERT INTO commerce_inventory_reservations(empresa_id,order_id,location_id,variant_id,quantidade,status) VALUES ($1,$2,$3,$4,1,'released')`, [tenant,order,location,variant]);
    const context = { empresaId: tenant, lojaId: store, usuarioId: user };
    const input = { orderId: order, storefrontId: storefront, idempotencyKey: 'schema-test-recovery-unique-001', reason: 'Recuperação testada com saldo confirmado',
      verifyCaptured: async paymentRow => ({ status: 'captured', providerPaymentId: paymentRow.provider_payment_id, amount: Number(paymentRow.amount), summary: { verifiedBy: 'payment_check' } }) };
    await db.query('SAVEPOINT direct_core');
    assert.equal((await recoverExpiredPaidOrder(db, context, input)).status, 'paid');
    assert.equal((await recoverExpiredPaidOrder(db, context, input)).status, 'paid');
    const orderRow = (await db.query('SELECT status FROM commerce_orders WHERE id=$1',[order])).rows[0];
    const level = (await db.query('SELECT disponivel,reservado,comprometido FROM commerce_inventory_levels WHERE variant_id=$1',[variant])).rows[0];
    const review = (await db.query(`SELECT metadata #>> '{lateCapture,state}' AS state FROM commerce_payments WHERE id=$1`,[payment])).rows[0];
    assert.equal(orderRow.status,'paid');
    assert.deepEqual({ available: level.disponivel, reserved: level.reservado, committed: level.comprometido },{ available: 9, reserved: 0, committed: 1 });
    assert.equal(review.state,'accepted_for_fulfillment');
    assert.equal((await db.query(`SELECT count(*)::int AS total FROM commerce_audit_logs WHERE empresa_id=$1 AND entidade_id=$2 AND acao='late_capture_recovered'`,[tenant,order])).rows[0].total,1);
    await db.query('ROLLBACK TO SAVEPOINT direct_core');
    await db.query('RELEASE SAVEPOINT direct_core');
    await db.query(`INSERT INTO commerce_memberships(empresa_id,usuario_id,role_id) SELECT $1,$2,id FROM commerce_roles WHERE codigo='platform_owner' AND empresa_id IS NULL LIMIT 1`,[tenant,user]);
    const original = { query: commerceDb.query, queryRead: commerceDb.queryRead, transaction: commerceDb.transaction,
      adapter: paymentProviders.get('infinitepay'), token: process.env.RECOVERY_TEST_TOKEN };
    process.env.RECOVERY_TEST_TOKEN = 'synthetic-configured';
    let call = 0;
    let secondStatus = 'pending';
    commerceDb.query = commerceDb.queryRead = (sql,params) => db.query(sql,params);
    commerceDb.transaction = async fn => {
      await db.query('SAVEPOINT route_call');
      try { const value = await fn(db); await db.query('RELEASE SAVEPOINT route_call'); return value; }
      catch (error) { await db.query('ROLLBACK TO SAVEPOINT route_call'); await db.query('RELEASE SAVEPOINT route_call'); throw error; }
    };
    paymentProviders.adapters.set('infinitepay', { getStatus: async ({ payment: p }) => {
      call++;
      return { status: call % 2 === 0 ? secondStatus : 'captured', amount: Number(p.amount), providerPaymentId: p.provider_payment_id,
        summary: { paid: true, captureMethod: 'pix', verifiedBy: 'payment_check' } };
    } });
    try {
      const layer = createCommerceAdminRouter().stack.find(entry => entry.route?.path === '/orders/:id/recover-late-capture');
      assert.ok(layer);
      const handler = layer.route.stack.at(-1).handle;
      const request = () => ({ user: { id: user, mainAdmin: true }, commerceAdminContext: { ...context },
        params: { id: order }, query: {}, headers: {}, get: name => name === 'Idempotency-Key' ? 'route-synthetic-recovery-unique-001' : null,
        body: { storefrontId: storefront, confirmPickup: true, reasonCode: 'HONOR_CAPTURED_PICKUP_ORDER', reason: 'Retirada autorizada com captura verificada' } });
      const response = () => ({ statusCode: 200, status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; } });
      const denied = response();
      await handler(request(),denied);
      assert.equal(denied.statusCode,409,'gateway fica inconclusivo depois da primeira consulta');
      assert.equal((await db.query('SELECT status FROM commerce_orders WHERE id=$1',[order])).rows[0].status,'cancelled');
      assert.equal((await db.query('SELECT disponivel FROM commerce_inventory_levels WHERE variant_id=$1',[variant])).rows[0].disponivel,10);
      secondStatus = 'captured';
      const approved = response();
      await handler(request(),approved);
      assert.equal(approved.statusCode,200);
      assert.equal(approved.body.status,'paid');
      assert.equal((await db.query('SELECT status FROM commerce_orders WHERE id=$1',[order])).rows[0].status,'paid');
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM commerce_audit_logs WHERE acao='late_capture_recovered' AND entidade_id=$1`,[order])).rows[0].n,1);
    } finally {
      commerceDb.query=original.query; commerceDb.queryRead=original.queryRead; commerceDb.transaction=original.transaction;
      if (original.adapter) paymentProviders.adapters.set('infinitepay',original.adapter); else paymentProviders.adapters.delete('infinitepay');
      if (original.token === undefined) delete process.env.RECOVERY_TEST_TOKEN; else process.env.RECOVERY_TEST_TOKEN=original.token;
    }
  } finally { await db.query('ROLLBACK').catch(() => {}); await db.end(); }
});
