// Testes com PostgreSQL real: prazo/teto de reserva, expiração, pagamento tardio e frete obrigatório.
// Rodar com COMMERCE_CHECKOUT_TEST_DATABASE_URL apontando para um banco descartável já com o schema
// e um storefront publicado (o mesmo usado nos testes de integração). Sem a variável, pula.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const url = process.env.COMMERCE_CHECKOUT_TEST_DATABASE_URL || '';
const enabled = Boolean(url);
if (enabled) process.env.DATABASE_URL = url;
const core = enabled ? await import('./commerce-core.js') : null;
const routes = enabled ? await import('./commerce-routes.js') : null;
const { db } = enabled ? await import('./database.js') : { db: null };

const q = (sql, values = []) => db.query(sql, values);
let fixture = null;
async function setup() {
  if (fixture) return fixture;
  // Banco descartável: publica no storefront os produtos físicos ativos que já têm preço web.
  await q(`INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
           SELECT DISTINCT s.empresa_id, s.id, p.id, vp.price_list_id, true
             FROM commerce_storefronts s
             JOIN commerce_products p ON p.empresa_id = s.empresa_id AND p.status = 'active' AND p.tipo = 'physical'
             JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id
             JOIN commerce_variant_prices vp ON vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
            WHERE NOT EXISTS (SELECT 1 FROM commerce_product_channels c WHERE c.storefront_id = s.id AND c.product_id = p.id)
           ON CONFLICT DO NOTHING`);
  const row = (await q(`
    SELECT s.id AS storefront_id, s.empresa_id, s.loja_id, l.location_id, l.variant_id
      FROM commerce_storefronts s
      JOIN commerce_product_channels pc ON pc.empresa_id = s.empresa_id AND pc.storefront_id = s.id AND pc.publicado = true
      JOIN commerce_product_variants v ON v.empresa_id = s.empresa_id AND v.product_id = pc.product_id AND v.ativo = true
      JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active' AND p.tipo = 'physical'
      JOIN commerce_inventory_levels l ON l.empresa_id = v.empresa_id AND l.variant_id = v.id
     LIMIT 1`)).rows[0];
  assert.ok(row, 'banco de teste precisa de um produto físico publicado com saldo');
  fixture = row;
  return row;
}
const setStock = async (f, disponivel) => q(`UPDATE commerce_inventory_levels SET disponivel = $3, reservado = 0, comprometido = 0 WHERE empresa_id = $1 AND variant_id = $2`, [f.empresa_id, f.variant_id, disponivel]);
const level = async (f) => (await q(`SELECT disponivel::int, reservado::int, comprometido::int FROM commerce_inventory_levels WHERE empresa_id = $1 AND variant_id = $2`, [f.empresa_id, f.variant_id])).rows[0];
const status = async (f, id) => (await q(`SELECT status FROM commerce_orders WHERE empresa_id = $1 AND id = $2`, [f.empresa_id, id])).rows[0].status;
let seq = 0;
const order = (f, quantity, extra = {}) => core.withCommerceTransaction(trx => core.createPendingOrder(trx, { empresaId: f.empresa_id, lojaId: f.loja_id }, {
  storefrontId: f.storefront_id, items: [{ variantId: f.variant_id, quantity }],
  customer: { nome: 'Cliente Teste', email: `reserva-${Date.now()}-${seq}@example.invalid` }, idempotencyKey: `teste-reserva-${Date.now()}-${seq++}`, ...extra,
}));
const move = (f, id, to) => core.withCommerceTransaction(trx => core.transitionOrder(trx, { empresaId: f.empresa_id }, { orderId: id, status: to, origin: 'teste' }));

if (enabled) after(async () => { await db.end?.().catch?.(() => {}); });
const pgTest = (name, fn) => test(name, { skip: !enabled }, fn);

pgTest('prazo de reserva é do servidor e o navegador não o define', async () => {
  const f = await setup(); await setStock(f, 10);
  assert.equal(routes.sanitizePublicOrderInput({ reservationExpiresAt: '2099-01-01' }).reservationExpiresAt, undefined);
  const created = await order(f, 1);
  const r = (await q(`SELECT expira_em FROM commerce_inventory_reservations WHERE order_id = $1`, [created.id])).rows[0];
  const minutes = (new Date(r.expira_em) - Date.now()) / 60000;
  assert.ok(minutes > 25 && minutes <= 31, `expira em ~30 min (${minutes})`);
});

pgTest('teto de unidades impede que um pedido segure todo o estoque', async () => {
  const f = await setup(); await setStock(f, 500);
  await assert.rejects(() => order(f, 21), e => e.code === 'QUANTITY_LIMIT_EXCEEDED');
  assert.equal((await level(f)).disponivel, 500);
});

pgTest('reserva vencida cancela o pedido e devolve o estoque (varredura com lease)', async () => {
  const f = await setup(); await setStock(f, 5);
  const { expireCommerceReservations } = await import('./commerce-retention.js');
  const created = await order(f, 2);
  assert.deepEqual(await level(f), { disponivel: 3, reservado: 2, comprometido: 0 });
  await q(`UPDATE commerce_inventory_reservations SET expira_em = now() - interval '1 minute' WHERE order_id = $1`, [created.id]);
  const swept = await expireCommerceReservations(db, { empresaId: f.empresa_id });
  assert.ok(swept.expiredOrders >= 1, JSON.stringify(swept));
  assert.equal(await status(f, created.id), 'cancelled');
  assert.deepEqual(await level(f), { disponivel: 5, reservado: 0, comprometido: 0 });
});

pgTest('loja com forma de entrega ativa exige escolha (sem frete zero forjado)', async () => {
  const f = await setup(); await setStock(f, 3);
  const method = await q(`INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao) VALUES ($1, $2, 'teste-retirada', 'Retirada teste', 'pickup', true, '{}') RETURNING id`, [f.empresa_id, f.storefront_id]);
  try {
    await assert.rejects(() => order(f, 1), e => e.code === 'SHIPPING_METHOD_REQUIRED');
    const ok = await order(f, 1, { shippingMethodId: method.rows[0].id });
    assert.equal(Number(ok.shipping), 0);
  } finally {
    await q(`UPDATE commerce_orders SET shipping_method_id = NULL WHERE shipping_method_id = $1`, [method.rows[0].id]);
    await q(`DELETE FROM commerce_shipping_methods WHERE id = $1`, [method.rows[0].id]);
  }
});

pgTest('reembolso devolve os pontos de fidelidade; pontos vencidos expiram sem ficar negativo', async () => {
  const f = await setup(); await setStock(f, 5);
  const loyalty = await import('./loyalty-advanced.js');
  await q(`INSERT INTO commerce_loyalty_settings (empresa_id, loja_id, ativo, pontos_por_real, valor_minimo_compra, validade_dias)
           VALUES ($1, $2, true, 1, 0, 30)
           ON CONFLICT DO NOTHING`, [f.empresa_id, f.loja_id]);
  await q(`UPDATE commerce_loyalty_settings SET ativo = true, pontos_por_real = 1, validade_dias = 30 WHERE empresa_id = $1 AND loja_id = $2`, [f.empresa_id, f.loja_id]);
  const created = await order(f, 1);
  const paid = await move(f, created.id, 'paid');
  assert.equal(paid.loyalty?.credited, true, JSON.stringify(paid.loyalty));
  const account = async () => (await q(`SELECT a.saldo_pontos::int AS s FROM commerce_loyalty_accounts a JOIN commerce_orders o ON o.customer_id = a.customer_id AND o.empresa_id = a.empresa_id WHERE o.id = $1`, [created.id])).rows[0].s;
  const earned = await account();
  assert.ok(earned > 0);
  await move(f, created.id, 'refunded');
  assert.equal(await account(), 0, 'pontos estornados');
  const replay = await core.withCommerceTransaction(trx => loyalty.reverseOrderLoyaltyPoints(trx, { empresaId: f.empresa_id, orderId: created.id }));
  assert.equal(replay.replay, true, 'estorno não duplica');

  const second = await order(f, 1);
  await move(f, second.id, 'paid');
  // O ledger é imutável; no banco descartável, desliga o gatilho só para simular o vencimento.
  await q(`ALTER TABLE commerce_loyalty_ledger DISABLE TRIGGER USER`);
  try { await q(`UPDATE commerce_loyalty_ledger SET expira_em = now() - interval '1 day' WHERE referencia_id = $1 AND tipo = 'credito'`, [second.id]); }
  finally { await q(`ALTER TABLE commerce_loyalty_ledger ENABLE TRIGGER USER`); }
  const result = await loyalty.expireLoyaltyPoints(db);
  assert.ok(result.expiredPoints > 0);
  const after = (await q(`SELECT a.saldo_pontos::int AS s FROM commerce_loyalty_accounts a JOIN commerce_orders o ON o.customer_id = a.customer_id AND o.empresa_id = a.empresa_id WHERE o.id = $1`, [second.id])).rows[0].s;
  assert.equal(after, 0);
  assert.equal((await loyalty.expireLoyaltyPoints(db)).expiredPoints, 0, 'não expira duas vezes');
});

pgTest('reserva vai para o local que tem saldo, não sempre para o primeiro', async () => {
  const f = await setup(); await setStock(f, 0);
  const extra = await q(`INSERT INTO commerce_inventory_locations (empresa_id, loja_id, codigo, nome, ativo) VALUES ($1, $2, $3, 'Depósito teste', true) RETURNING id`, [f.empresa_id, f.loja_id, `dep-${Date.now()}`]);
  try {
    await q(`INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel, reservado, comprometido) VALUES ($1, $2, $3, 4, 0, 0)`, [f.empresa_id, extra.rows[0].id, f.variant_id]);
    const created = await order(f, 2);
    const r = (await q(`SELECT location_id FROM commerce_inventory_reservations WHERE order_id = $1`, [created.id])).rows[0];
    assert.equal(r.location_id, extra.rows[0].id);
    await move(f, created.id, 'cancelled');
  } finally {
    await q(`DELETE FROM commerce_inventory_movements WHERE location_id = $1`, [extra.rows[0].id]);
    await q(`DELETE FROM commerce_inventory_reservations WHERE location_id = $1`, [extra.rows[0].id]);
    await q(`DELETE FROM commerce_inventory_levels WHERE location_id = $1`, [extra.rows[0].id]);
    await q(`DELETE FROM commerce_inventory_locations WHERE id = $1`, [extra.rows[0].id]);
  }
});

pgTest('crediário: marcar na conta confirma o pedido e o cancelamento devolve o limite', async () => {
  const f = await setup(); await setStock(f, 3);
  const { createCreditPayment } = await import('./commerce-credit.js');
  const created = await order(f, 1);
  const customer = (await q(`SELECT customer_id, total FROM commerce_orders WHERE id = $1`, [created.id])).rows[0];
  const acct = await q(`INSERT INTO commerce_customer_credit_accounts (empresa_id, storefront_id, customer_id, limite_credito, prazo_dias, status)
                        VALUES ($1, $2, $3, 5000, 30, 'active') RETURNING id`, [f.empresa_id, f.storefront_id, customer.customer_id]);
  const pago = await createCreditPayment({ empresaId: f.empresa_id }, { orderId: created.id, idempotencyKey: `cred-${created.id}` });
  assert.equal(pago.provider, 'crediario');
  assert.equal(await status(f, created.id), 'paid');
  const saldo = async () => Number((await q(`SELECT saldo_devedor FROM commerce_customer_credit_accounts WHERE id = $1`, [acct.rows[0].id])).rows[0].saldo_devedor);
  assert.equal(await saldo(), Number(customer.total));
  await move(f, created.id, 'cancelled');
  assert.equal(await saldo(), 0, 'cancelamento abate o saldo devedor');
  const charge = (await q(`SELECT status FROM commerce_customer_credit_entries WHERE order_id = $1 AND tipo = 'charge'`, [created.id])).rows[0];
  assert.equal(charge.status, 'cancelled');
});

pgTest('crédito vencido cujos pontos já foram gastos é marcado e não trava a fila de expiração', async () => {
  const f = await setup(); await setStock(f, 5);
  const loyalty = await import('./loyalty-advanced.js');
  await q(`UPDATE commerce_loyalty_settings SET ativo = true, pontos_por_real = 1, validade_dias = 30 WHERE empresa_id = $1 AND loja_id = $2`, [f.empresa_id, f.loja_id]);
  const created = await order(f, 1);
  await move(f, created.id, 'paid');
  const credit = (await q(`SELECT id, account_id, pontos FROM commerce_loyalty_ledger WHERE referencia_id = $1 AND tipo = 'credito'`, [created.id])).rows[0];
  assert.ok(credit, 'pedido pago gerou pontos');
  // Cliente gasta todos os pontos; depois o crédito vence.
  const saldo = Number((await q(`SELECT saldo_pontos FROM commerce_loyalty_accounts WHERE id = $1`, [credit.account_id])).rows[0].saldo_pontos);
  const acct = (await q(`SELECT empresa_id, loja_id, customer_id FROM commerce_loyalty_accounts WHERE id = $1`, [credit.account_id])).rows[0];
  await q(`INSERT INTO commerce_loyalty_ledger (empresa_id, loja_id, account_id, customer_id, tipo, pontos, saldo_anterior, saldo_posterior, descricao, referencia_tipo, referencia_id)
           VALUES ($1, $2, $3, $4, 'resgate', $5, $6, 0, 'teste resgate', 'teste', gen_random_uuid())`, [acct.empresa_id, acct.loja_id, credit.account_id, acct.customer_id, -saldo, saldo]);
  await q(`UPDATE commerce_loyalty_accounts SET saldo_pontos = 0 WHERE id = $1`, [credit.account_id]);
  await q(`ALTER TABLE commerce_loyalty_ledger DISABLE TRIGGER USER`);
  try { await q(`UPDATE commerce_loyalty_ledger SET expira_em = now() - interval '1 day' WHERE id = $1`, [credit.id]); }
  finally { await q(`ALTER TABLE commerce_loyalty_ledger ENABLE TRIGGER USER`); }
  await loyalty.expireLoyaltyPoints(db);
  const mark = (await q(`SELECT pontos_expirados FROM commerce_loyalty_expiry_marks WHERE ledger_id = $1`, [credit.id])).rows[0];
  assert.ok(mark, 'crédito avaliado fica marcado');
  assert.equal(Number(mark.pontos_expirados), 0);
  const again = await q(`SELECT 1 FROM commerce_loyalty_ledger c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM commerce_loyalty_expiry_marks m WHERE m.ledger_id = c.id)`, [credit.id]);
  assert.equal(again.rows.length, 0, 'não volta para a fila');
});

pgTest('crediário: chave de idempotência de outro pedido não devolve o pagamento alheio', async () => {
  const f = await setup(); await setStock(f, 4);
  const { createCreditPayment } = await import('./commerce-credit.js');
  const a = await order(f, 1);
  const b = await order(f, 1);
  const customer = (await q(`SELECT customer_id FROM commerce_orders WHERE id = $1`, [a.id])).rows[0];
  await q(`INSERT INTO commerce_customer_credit_accounts (empresa_id, storefront_id, customer_id, limite_credito, prazo_dias, status)
           VALUES ($1, $2, $3, 5000, 30, 'active') ON CONFLICT (empresa_id, storefront_id, customer_id) DO UPDATE SET status = 'active'`, [f.empresa_id, f.storefront_id, customer.customer_id]);
  const key = `cred-compartilhada-${a.id}`;
  await createCreditPayment({ empresaId: f.empresa_id }, { orderId: a.id, idempotencyKey: key });
  await assert.rejects(() => createCreditPayment({ empresaId: f.empresa_id }, { orderId: b.id, idempotencyKey: key }), e => e.code === 'IDEMPOTENCY_CONFLICT');
  assert.equal(await status(f, b.id), 'pending_payment');
  await move(f, a.id, 'cancelled'); await move(f, b.id, 'cancelled');
});
