// Execute somente em banco local descartável *_test já migrado: nunca usar banco produtivo.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const url = process.env.COMMERCE_CHECKOUT_CONTACT_TEST_DATABASE_URL || '';
function localTestDatabase(value) {
  try {
    const parsed = new URL(value);
    const socketHost = parsed.searchParams.get('host');
    return ['postgresql:', 'postgres:'].includes(parsed.protocol)
      && ['localhost', '127.0.0.1'].includes(parsed.hostname)
      && (!socketHost || socketHost === '/var/run/postgresql')
      && /_test$/.test(decodeURIComponent(parsed.pathname.slice(1)));
  } catch { return false; }
}
if (url && !localTestDatabase(url)) {
  throw new Error('COMMERCE_CHECKOUT_CONTACT_TEST_DATABASE_URL deve apontar a PostgreSQL local descartável *_test');
}
const enabled = Boolean(url);
if (enabled) process.env.DATABASE_URL = url;
const { db } = enabled ? await import('./database.js') : { db: null };
const { createPendingOrder, withCommerceTransaction } = enabled ? await import('./commerce-core.js') : {};
const { resolveCommerceCustomer } = enabled ? await import('./commerce-customer-identity.js') : {};
if (enabled) after(async () => { await db.close(); });

test('PG local: CONTACT_CONFLICT revoga chave e mantém zero pedido/pagamento/reserva/loyalty', { skip: !enabled }, async () => {
  const fixture = (await db.query(`
    SELECT s.empresa_id, s.loja_id, s.id AS storefront_id,
           p.id AS product_id, v.id AS variant_id, vp.price_list_id
      FROM commerce_storefronts s
      JOIN commerce_products p ON p.empresa_id = s.empresa_id AND p.status = 'active'
      JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true
      JOIN commerce_variant_prices vp ON vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
      JOIN commerce_price_lists pl ON pl.empresa_id = vp.empresa_id AND pl.id = vp.price_list_id
       AND pl.ativo = true AND pl.canal = 'web'
     WHERE s.status = 'active' AND s.loja_id IS NOT NULL
       AND vp.vigencia_inicio <= CURRENT_TIMESTAMP AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
     ORDER BY s.id, p.id LIMIT 1`)).rows[0];
  assert.ok(fixture, 'schema local descartável precisa de vitrine/produto/preço web de teste');
  const f = fixture;
  await db.query(`INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
                  VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING`, [f.empresa_id, f.storefront_id, f.product_id, f.price_list_id]);
  const method = (await db.query(`INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
                                  VALUES ($1,$2,$3,'Retirada fixture', 'pickup',true,'{}') RETURNING id`,
    [f.empresa_id, f.storefront_id, `contact-test-${Date.now()}`])).rows[0];
  const customerA = await withCommerceTransaction(trx => resolveCommerceCustomer(trx, { empresaId: f.empresa_id, lojaId: f.loja_id, identitySource: 'fixture' },
    { nome: 'Fixture A', email: `contact-a-${Date.now()}@example.invalid` }));
  const customerB = await withCommerceTransaction(trx => resolveCommerceCustomer(trx, { empresaId: f.empresa_id, lojaId: f.loja_id, identitySource: 'fixture' },
    { nome: 'Fixture B', telefone: '11998887777' }));
  assert.notEqual(customerA.customer.id, customerB.customer.id);
  const email = customerA.customer.email_normalizado;
  const phone = customerB.customer.telefone_normalizado;
  const key = `contact-conflict-pg-${Date.now()}`;
  const counts = async () => (await db.query(`
    SELECT (SELECT count(*) FROM commerce_orders WHERE empresa_id=$1) AS orders,
           (SELECT count(*) FROM commerce_order_items WHERE empresa_id=$1) AS order_items,
           (SELECT count(*) FROM commerce_order_events WHERE empresa_id=$1) AS order_events,
           (SELECT count(*) FROM commerce_payments WHERE empresa_id=$1) AS payments,
           (SELECT count(*) FROM commerce_fulfillments WHERE empresa_id=$1) AS fulfillments,
           (SELECT count(*) FROM commerce_inventory_reservations WHERE empresa_id=$1) AS reservations,
           (SELECT count(*) FROM commerce_inventory_movements WHERE empresa_id=$1) AS movements,
           (SELECT COALESCE(sum(disponivel),0)::text || ':' || COALESCE(sum(reservado),0)::text || ':' || COALESCE(sum(comprometido),0)::text FROM commerce_inventory_levels WHERE empresa_id=$1) AS stock,
           (SELECT count(*) FROM commerce_loyalty_ledger WHERE empresa_id=$1) AS loyalty,
           (SELECT count(*) FROM commerce_customer_addresses WHERE empresa_id=$1) AS addresses,
           (SELECT count(*) FROM commerce_carts WHERE empresa_id=$1) AS carts,
           (SELECT count(*) FROM commerce_cart_items WHERE empresa_id=$1) AS cart_items,
           (SELECT count(*) FROM commerce_cart_recovery_events WHERE empresa_id=$1) AS cart_events,
           (SELECT count(*) FROM commerce_audit_logs WHERE empresa_id=$1) AS audit,
           (SELECT count(*) FROM commerce_idempotency_keys WHERE empresa_id=$1 AND scope='order.create' AND key=$2) AS key_count`,
    [f.empresa_id, key])).rows[0];
  const before = await counts();
  const attempt = () => withCommerceTransaction(trx => createPendingOrder(trx, { empresaId: f.empresa_id, lojaId: f.loja_id }, {
    storefrontId: f.storefront_id, shippingMethodId: method.id, shippingAddress: { modo: 'retirada' },
    items: [{ variantId: f.variant_id, quantity: 1 }],
    customer: { nome: 'Fixture', email, telefone: phone }, idempotencyKey: key,
    allowUnverifiedGuest: true,
  }));
  for (let i = 0; i < 2; i += 1) {
    await assert.rejects(attempt, error => error?.code === 'CONTACT_CONFLICT' && error?.details?.reason === 'identifiers_resolve_to_different_customers');
    assert.deepEqual(await counts(), before, 'a transação deve reverter todos os writes, inclusive idempotência');
  }
});
