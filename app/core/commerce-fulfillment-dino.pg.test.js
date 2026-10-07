import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createFulfillment, updateFulfillment } from './commerce-core.js';

const connectionString = process.env.COMMERCE_FULFILLMENT_TEST_DATABASE_URL;
const empresaId = '10000000-0000-4000-8000-000000000106';
const lojaId = '10000000-0000-4000-8000-000000000107';
const storefrontId = '10000000-0000-4000-8000-000000000103';
const orderId = '10000000-0000-4000-8000-000000000111';
const methodId = '10000000-0000-4000-8000-000000000109';
const quoteId = '10000000-0000-4000-8000-000000000110';
const accountId = '10000000-0000-4000-8000-000000000112';

function safeLocalTestUrl(value) {
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    return ['postgresql:', 'postgres:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && database.endsWith('_test')
      && (!url.searchParams.has('host') || url.searchParams.get('host') === '/var/run/postgresql');
  } catch { return false; }
}

// Só roda com COMMERCE_FULFILLMENT_TEST_DATABASE_URL explícita, local e *_test.
// TEMP tables mascaram schema compartilhado; a transação é revertida sempre.
test('PG: fulfillment Dino rejeita destino nacional/override sem INSERT e preserva motoboy local', { skip: !connectionString }, async () => {
  assert.ok(safeLocalTestUrl(connectionString), 'banco de teste precisa ser local e terminar em _test');
  const client = new pg.Client({ connectionString, ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE commerce_storefronts (empresa_id uuid, id uuid, loja_id uuid, codigo text) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_orders (
      empresa_id uuid, id uuid, storefront_id uuid, loja_id uuid, status text, total numeric, frete numeric, endereco_entrega jsonb,
      shipping_method_id uuid, shipping_quote_id uuid
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_shipping_methods (
      empresa_id uuid, id uuid, storefront_id uuid, tipo text, codigo text, configuracao jsonb, ativo boolean
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_shipping_quotes (
      empresa_id uuid, id uuid, storefront_id uuid, order_id uuid, shipping_method_id uuid,
      shipping_account_id uuid, provider text, destino_cep text, status text, selected_option_id text, selected_amount numeric
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_shipping_accounts (empresa_id uuid, id uuid, storefront_id uuid) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_payments (empresa_id uuid, id uuid, order_id uuid, status text, captured_at timestamptz, amount numeric) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_fulfillments (
      id uuid DEFAULT gen_random_uuid(), empresa_id uuid, order_id uuid, shipping_method_id uuid, shipping_quote_id uuid,
      shipping_account_id uuid, status varchar(30), endereco_entrega jsonb, ocorrencias jsonb DEFAULT '[]'::jsonb,
      tracking_code varchar(160), carrier varchar(120), provider_shipment_id varchar(180), tracking_url text, label_url text,
      enviado_em timestamptz, entregue_em timestamptz, atualizado_em timestamptz
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_audit_logs (empresa_id uuid, usuario_id uuid, entidade text, entidade_id uuid, acao text, depois jsonb) ON COMMIT DROP`);
    await client.query('INSERT INTO commerce_storefronts VALUES ($1,$2,$3,$4)', [empresaId, storefrontId, lojaId, 'dino-web']);
    await client.query(`INSERT INTO commerce_orders VALUES ($1,$2,$3,$4,'paid',113,13,$5::jsonb,$6,$7)`,
      [empresaId, orderId, storefrontId, lojaId, JSON.stringify({ cep: '78300055', estado: 'MT' }), methodId, quoteId]);
    await client.query(`INSERT INTO commerce_shipping_methods VALUES ($1,$2,$3,'delivery','dino-motoboy',$4::jsonb,true)`,
      [empresaId, methodId, storefrontId, JSON.stringify({ provider: 'manual', deliveryType: 'motoboy', rules: [{ cepFrom: '78300000', cepTo: '78309999' }] })]);
    await client.query(`INSERT INTO commerce_shipping_quotes VALUES ($1,$2,$3,$4,$5,NULL,'manual','78300055','used','local',13)`,
      [empresaId, quoteId, storefrontId, orderId, methodId]);
    await client.query(`INSERT INTO commerce_payments VALUES ($1,$2,$3,'captured',CURRENT_TIMESTAMP,113)`,
      [empresaId, accountId, orderId]);

    const context = { empresaId, lojaId };
    for (const input of [
      { enderecoEntrega: { cep: '18715106', estado: 'SP' } },
      { shippingAccountId: '10000000-0000-4000-8000-000000000113' },
    ]) {
      await assert.rejects(() => createFulfillment(client, context, { orderId, ...input }), error => error.code === 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
      assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 0);
    }
    await client.query(`UPDATE commerce_orders SET endereco_entrega = '{"cep":"18715106","estado":"SP"}'::jsonb WHERE id = $1`, [orderId]);
    await assert.rejects(() => createFulfillment(client, context, { orderId }), error => error.code === 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 0);
    await client.query(`UPDATE commerce_orders SET endereco_entrega = '{"cep":"78300055","estado":"MT"}'::jsonb WHERE id = $1`, [orderId]);
    await assert.rejects(() => createFulfillment(client, { empresaId, lojaId: '10000000-0000-4000-8000-000000000108' }, { orderId }), error => error.code === 'ORDER_NOT_FOUND');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 0);
    await client.query(`UPDATE commerce_payments SET status = 'pending' WHERE order_id = $1`, [orderId]);
    await assert.rejects(() => createFulfillment(client, context, { orderId }), error => error.code === 'FULFILLMENT_PAYMENT_NOT_CAPTURED');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 0);
    await client.query(`UPDATE commerce_payments SET status = 'captured' WHERE order_id = $1`, [orderId]);
    assert.equal((await createFulfillment(client, context, { orderId })).status, 'pending');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 1);
    await assert.rejects(() => createFulfillment(client, context, { orderId }), error => error.code === 'FULFILLMENT_ALREADY_EXISTS');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_fulfillments')).rows[0].n, 1);
    const fulfillmentId = (await client.query('SELECT id FROM commerce_fulfillments WHERE order_id = $1', [orderId])).rows[0].id;
    const notice = 'Pagamento confirmado; aguardando separação para retirada.';
    const pending = await updateFulfillment(client, context, fulfillmentId, { status: 'pending', ocorrencia: notice });
    assert.equal(pending.status, 'pending');
    assert.equal(pending.ocorrencias.length, 1);
    assert.equal(pending.ocorrencias[0].description, notice);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_audit_logs')).rows[0].n, 1);
    await client.query(`UPDATE commerce_orders SET endereco_entrega = '{"cep":"18715106","estado":"SP"}'::jsonb WHERE id = $1`, [orderId]);
    await assert.rejects(() => updateFulfillment(client, context, fulfillmentId, { status: 'preparing' }), error => error.code === 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
    assert.equal((await client.query('SELECT status FROM commerce_fulfillments WHERE id = $1', [fulfillmentId])).rows[0].status, 'pending');
    await client.query(`UPDATE commerce_orders SET endereco_entrega = '{"cep":"78300055","estado":"MT"}'::jsonb WHERE id = $1`, [orderId]);
    assert.equal((await updateFulfillment(client, context, fulfillmentId, { status: 'preparing' })).status, 'preparing');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_audit_logs')).rows[0].n, 2);

    const pickupOrderId = '10000000-0000-4000-8000-000000000114';
    const pickupMethodId = '10000000-0000-4000-8000-000000000115';
    await client.query(`INSERT INTO commerce_shipping_methods VALUES ($1,$2,$3,'pickup','retirada','{}'::jsonb,true)`, [empresaId, pickupMethodId, storefrontId]);
    await client.query(`INSERT INTO commerce_orders VALUES ($1,$2,$3,$4,'paid',100,0,NULL,$5,NULL)`, [empresaId, pickupOrderId, storefrontId, lojaId, pickupMethodId]);
    await client.query(`INSERT INTO commerce_payments VALUES ($1,$2,$3,'captured',CURRENT_TIMESTAMP,100)`, [empresaId, '10000000-0000-4000-8000-000000000116', pickupOrderId]);
    const pickup = await createFulfillment(client, context, { orderId: pickupOrderId });
    assert.equal(pickup.status, 'pending');
    const updatedPickup = await updateFulfillment(client, context, pickup.id, { status: 'pending', ocorrencia: notice });
    assert.equal(updatedPickup.status, 'pending');
    assert.equal(updatedPickup.ocorrencias.length, 1);
    assert.equal(updatedPickup.ocorrencias[0].description, notice);
    assert.equal(updatedPickup.entregue_em, null);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM commerce_audit_logs')).rows[0].n, 3);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
