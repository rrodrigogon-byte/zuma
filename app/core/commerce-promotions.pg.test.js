import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import pg from 'pg';
import {
  applyPromotionToOrder,
  createPromotion,
  previewPromotion,
  updatePromotion,
} from './commerce-promotions.js';
import { CommerceError } from './commerce-core.js';

const connectionString = process.env.COMMERCE_PROMOTIONS_TEST_DATABASE_URL || '';
const enabled = Boolean(connectionString);

function assertSafeTestUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('COMMERCE_PROMOTIONS_TEST_DATABASE_URL deve ser uma URL PostgreSQL local descartável *_test'); }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const socket = url.searchParams.get('host') || '';
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      || !database.endsWith('_test')
      || url.searchParams.get('sslmode') === 'require'
      || (socket && socket !== '/var/run/postgresql')) {
    throw new Error('COMMERCE_PROMOTIONS_TEST_DATABASE_URL deve apontar a PostgreSQL local descartável *_test');
  }
  return database;
}

const databaseName = enabled ? assertSafeTestUrl(connectionString) : null;
const pool = enabled ? new pg.Pool({ connectionString, ssl: false, max: 8 }) : null;

if (pool) after(async () => { await pool.end(); });

const pgTest = (name, fn) => test(name, { skip: !pool }, fn);
const id = () => randomUUID();
const code = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
const iso = value => new Date(value).toISOString();

async function withRollback(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return await callback(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function withReadOnlyRollback(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    return await callback(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function runTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createFixture(client) {
  const f = {
    empresa: id(),
    loja: id(),
    storefront: id(),
    unpublishedStorefront: id(),
    product: id(),
    variant: id(),
    priceList: id(),
    foreignEmpresa: id(),
    foreignPromotion: id(),
    foreignCode: id(),
  };
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  await client.query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [f.empresa, `Promoções ${suffix}`, `9${suffix.slice(0, 13)}`, `Promoções ${suffix}`,
      f.foreignEmpresa, `Tenant estrangeiro ${suffix}`, `8${suffix.slice(0, 13)}`, `Tenant estrangeiro ${suffix}`],
  );
  await client.query(
    `INSERT INTO lojas (id, empresa_id, codigo, nome)
     VALUES ($1, $2, $3, $4)`,
    [f.loja, f.empresa, `promo-${suffix}`, 'Loja de promoções'],
  );
  await client.query(
    `INSERT INTO commerce_storefronts (id, empresa_id, loja_id, codigo, nome, canal, status)
     VALUES ($1, $2, $3, $4, $5, 'web', 'active'),
            ($6, $2, $3, $7, $8, 'web', 'active')`,
    [f.storefront, f.empresa, null, `web-${suffix}`, 'Vitrine publicada', f.unpublishedStorefront, `unpub-${suffix}`, 'Vitrine sem publicação'],
  );
  await client.query(
    `INSERT INTO commerce_products (id, empresa_id, slug, nome, tipo, status, publicado_em)
     VALUES ($1, $2, $3, 'Produto de teste', 'physical', 'active', CURRENT_TIMESTAMP)`,
    [f.product, f.empresa, `produto-${suffix}`],
  );
  await client.query(
    `INSERT INTO commerce_product_variants (id, empresa_id, product_id, sku, nome, ativo)
     VALUES ($1, $2, $3, $4, 'Unidade', true)`,
    [f.variant, f.empresa, f.product, `SKU-${suffix}`],
  );
  await client.query(
    `INSERT INTO commerce_price_lists (id, empresa_id, codigo, nome, canal, ativo)
     VALUES ($1, $2, $3, 'Tabela web', 'web', true)`,
    [f.priceList, f.empresa, `web-${suffix}`],
  );
  await client.query(
    `INSERT INTO commerce_variant_prices (id, empresa_id, price_list_id, variant_id, preco, vigencia_inicio)
     VALUES ($1, $2, $3, $4, 12.34, CURRENT_TIMESTAMP - INTERVAL '1 minute')`,
    [id(), f.empresa, f.priceList, f.variant],
  );
  await client.query(
    `INSERT INTO commerce_product_channels (id, empresa_id, storefront_id, product_id, price_list_id, publicado)
     VALUES ($1, $2, $3, $4, $5, true), ($6, $2, $7, $4, $5, false)`,
    [id(), f.empresa, f.storefront, f.product, f.priceList, id(), f.unpublishedStorefront],
  );
  return f;
}

async function insertPromotion(client, f, options = {}) {
  const promotionId = options.id || id();
  const promotionCodeId = options.codeId || id();
  const promotionCode = options.code || code('PROMO');
  await client.query(
    `INSERT INTO commerce_promotions
       (id, empresa_id, nome, tipo, valor, regras, inicio, fim, limite_uso, usos, ativo)
     VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7, $8, $9, $10)`,
    [promotionId, f.empresa, options.nome || promotionCode, options.tipo || 'percentage', options.valor ?? 10,
      options.inicio || iso(Date.now() - 60 * 60 * 1000), options.fim ?? iso(Date.now() + 60 * 60 * 1000),
      options.limiteUso ?? null, options.usos ?? 0, options.ativo ?? true],
  );
  if (options.withCode !== false) {
    await client.query(
      `INSERT INTO commerce_promotion_codes (id, empresa_id, promotion_id, codigo, uso_maximo, usos, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [promotionCodeId, f.empresa, promotionId, promotionCode, options.usoMaximo ?? null, options.codeUsos ?? 0, options.codeAtivo ?? true],
    );
  }
  return { promotionId, promotionCodeId, promotionCode };
}

async function insertForeignPromotion(client, f, promotionCode) {
  await client.query(
    `INSERT INTO commerce_promotions (id, empresa_id, nome, tipo, valor, inicio, ativo)
     VALUES ($1, $2, 'Cupom de outro tenant', 'percentage', 10, CURRENT_TIMESTAMP - INTERVAL '1 hour', true)`,
    [f.foreignPromotion, f.foreignEmpresa],
  );
  await client.query(
    `INSERT INTO commerce_promotion_codes (id, empresa_id, promotion_id, codigo, ativo)
     VALUES ($1, $2, $3, $4, true)`,
    [f.foreignCode, f.foreignEmpresa, f.foreignPromotion, promotionCode],
  );
}

async function insertOrder(client, f, options = {}) {
  const orderId = options.id || id();
  await client.query(
    `INSERT INTO commerce_orders
       (id, empresa_id, storefront_id, status, origem, subtotal, desconto, frete, impostos, total, public_code, loja_id)
     VALUES ($1, $2, $3, $4, 'web', $5, 0, 0, 0, $5, $6, $7)`,
    [orderId, f.empresa, options.storefrontId || f.storefront, options.status || 'pending_payment', options.subtotal ?? 37.02, `P-${randomUUID().slice(0, 12)}`, f.loja],
  );
  return orderId;
}

async function tenantSnapshot(client, empresa) {
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM commerce_orders WHERE empresa_id = $1) AS orders,
       (SELECT count(*)::int FROM commerce_order_promotions WHERE empresa_id = $1) AS order_promotions,
       (SELECT count(*)::int FROM commerce_payments WHERE empresa_id = $1) AS payments,
       (SELECT count(*)::int FROM commerce_inventory_reservations WHERE empresa_id = $1) AS reservations,
       (SELECT count(*)::int FROM commerce_inventory_movements WHERE empresa_id = $1) AS movements,
       (SELECT COALESCE(sum(disponivel), 0)::numeric FROM commerce_inventory_levels WHERE empresa_id = $1) AS available_stock,
       (SELECT COALESCE(sum(reservado), 0)::numeric FROM commerce_inventory_levels WHERE empresa_id = $1) AS reserved_stock`,
    [empresa],
  );
  return result.rows[0];
}

function assertPromotionNotFound(promise) {
  return assert.rejects(promise, error => error instanceof CommerceError && error.code === 'PROMOTION_NOT_FOUND');
}

pgTest('preview real é READ ONLY, usa catálogo publicado/preço válido, arredonda centavos e não cria pedido, estoque ou pagamento', async () => {
  const seed = await pool.connect();
  await seed.query('BEGIN');
  const f = await createFixture(seed);
  const good = await insertPromotion(seed, f, { code: 'GOOD_ROUNDING', valor: 10 });
  await seed.query('COMMIT').catch(async () => { await seed.query('ROLLBACK').catch(() => {}); throw new Error('seed commit falhou'); });
  seed.release();
  const before = await tenantSnapshot(pool, f.empresa);
  const statements = [];
  await withReadOnlyRollback(async readOnly => {
      const readonlyClient = {
        async query(sql, values = []) {
          statements.push(String(sql));
          return readOnly.query(sql, values);
        },
      };
      const result = await previewPromotion(readonlyClient, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.storefront }, {
        codigo: good.promotionCode,
        // A client-side price is deliberately ignored: only the published DB price is used.
        subtotal: 999999,
        items: [{ variantId: f.variant, quantity: 3 }],
      });
      assert.deepEqual({ subtotal: result.subtotal, desconto: result.desconto, subtotalComDesconto: result.subtotalComDesconto }, {
        subtotal: 37.02, desconto: 3.7, subtotalComDesconto: 33.32,
      });
      assert.equal((await readOnly.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    });
    assert.ok(statements.length >= 2);
    assert.equal(statements.some(sql => /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/i.test(sql)), false);
  assert.deepEqual(await tenantSnapshot(pool, f.empresa), before);
});

pgTest('preview rejeita scheduled, expired, disabled, exhausted, code exhausted, cross-tenant e storefront não publicado', async () => {
  await withRollback(async client => {
    const f = await createFixture(client);
    await insertPromotion(client, f, { code: 'SCHEDULED', inicio: iso(Date.now() + 60 * 60 * 1000) });
    await insertPromotion(client, f, { code: 'EXPIRED', fim: iso(Date.now() - 60 * 60 * 1000) });
    await insertPromotion(client, f, { code: 'DISABLED', ativo: false });
    await insertPromotion(client, f, { code: 'PROMO_EXHAUSTED', limiteUso: 1, usos: 1 });
    await insertPromotion(client, f, { code: 'CODE_EXHAUSTED', usoMaximo: 1, codeUsos: 1 });
    const foreignCode = 'FOREIGN_SHARED_CODE';
    await insertForeignPromotion(client, f, foreignCode);
    const baseInput = { items: [{ variantId: f.variant, quantity: 1 }] };
    for (const invalidCode of ['SCHEDULED', 'EXPIRED', 'DISABLED', 'PROMO_EXHAUSTED', 'CODE_EXHAUSTED', foreignCode]) {
      await assertPromotionNotFound(previewPromotion(client, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.storefront }, { ...baseInput, codigo: invalidCode }));
    }
    await assert.rejects(
      previewPromotion(client, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.unpublishedStorefront }, { ...baseInput, codigo: 'SCHEDULED' }),
      error => error.code === 'PROMOTION_NOT_FOUND',
    );
    const valid = await insertPromotion(client, f, { code: 'VALID_UNPUBLISHED_CHECK' });
    await assert.rejects(
      previewPromotion(client, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.unpublishedStorefront }, { ...baseInput, codigo: valid.promotionCode }),
      error => error.code === 'ITEM_UNAVAILABLE',
    );
  });
});

pgTest('aplicação usa o mesmo desconto em centavos da prévia e é idempotente sem segundo uso', async () => {
  await withRollback(async client => {
    const f = await createFixture(client);
    const good = await insertPromotion(client, f, { code: 'APPLY_ROUNDING', valor: 10 });
    const orderId = await insertOrder(client, f, { subtotal: 37.02 });
    const preview = await previewPromotion(client, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.storefront }, {
      codigo: good.promotionCode, items: [{ variantId: f.variant, quantity: 3 }],
    });
    const first = await applyPromotionToOrder(client, { empresaId: f.empresa, lojaId: f.loja }, { orderId, codigo: good.promotionCode });
    const second = await applyPromotionToOrder(client, { empresaId: f.empresa, lojaId: f.loja }, { orderId, codigo: good.promotionCode });
    assert.equal(first.desconto, preview.desconto);
    assert.equal(first.total, preview.subtotalComDesconto);
    assert.deepEqual(second, first);
    const persisted = await client.query(
      `SELECT p.usos AS promotion_usos, c.usos AS code_usos,
              (SELECT count(*)::int FROM commerce_order_promotions op WHERE op.empresa_id = $1 AND op.order_id = $2) AS applications,
              o.desconto, o.total
         FROM commerce_promotions p
         JOIN commerce_promotion_codes c ON c.empresa_id = p.empresa_id AND c.promotion_id = p.id
         JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = $2
        WHERE p.id = $3`,
      [f.empresa, orderId, good.promotionId],
    );
    assert.deepEqual(persisted.rows[0], { promotion_usos: 1, code_usos: 1, applications: 1, desconto: '3.70', total: '33.32' });
  });
});

pgTest('criação com código duplicado reverte promoção, auditoria e código na mesma transação', async () => {
  let committed;
  const setup = await pool.connect();
  try {
    await setup.query('BEGIN');
    committed = await createFixture(setup);
    await insertPromotion(setup, committed, { code: 'DUPLICATE_ATOMIC' });
    await setup.query('COMMIT');
  } finally {
    setup.release();
  }
  try {
    const before = (await pool.query(
      `SELECT
         (SELECT count(*)::int FROM commerce_promotions WHERE empresa_id = $1) AS promotions,
         (SELECT count(*)::int FROM commerce_promotion_codes WHERE empresa_id = $1) AS codes,
         (SELECT count(*)::int FROM commerce_audit_logs WHERE empresa_id = $1) AS audit`,
      [committed.empresa],
    )).rows[0];
    await assert.rejects(
      withRollback(client => createPromotion(client, { empresaId: committed.empresa, lojaId: committed.loja }, {
        nome: 'Promoção que deve reverter', tipo: 'percentage', valor: 15,
        inicio: new Date(Date.now() - 1000).toISOString(), codigo: 'DUPLICATE_ATOMIC', usoMaximo: 1,
      })),
      error => error?.code === '23505',
    );
    const after = (await pool.query(
      `SELECT
         (SELECT count(*)::int FROM commerce_promotions WHERE empresa_id = $1) AS promotions,
         (SELECT count(*)::int FROM commerce_promotion_codes WHERE empresa_id = $1) AS codes,
         (SELECT count(*)::int FROM commerce_audit_logs WHERE empresa_id = $1) AS audit`,
      [committed.empresa],
    )).rows[0];
    assert.deepEqual(after, before);
  } finally {
    // Fixtures committed ficam exclusivamente no banco local descartável.
    // Não apagar tenants: a auditoria append-only deve continuar íntegra.
  }
});

pgTest('update valida datas, limites e booleanos fail-closed, tenant mismatch e audita alteração atômica', async () => {
  await withRollback(async client => {
    const f = await createFixture(client);
    const promotion = await insertPromotion(client, f, { code: 'UPDATE_VALIDATION', limiteUso: 5, usos: 2 });
    const before = (await client.query('SELECT nome, inicio, fim, limite_uso, ativo FROM commerce_promotions WHERE id = $1', [promotion.promotionId])).rows[0];
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, { fim: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }), error => error.code === 'PROMOTION_DATE_INVALID');
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, { inicio: 123 }), error => error.code === 'PROMOTION_DATE_INVALID');
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, { limiteUso: 1 }), error => error.code === 'PROMOTION_USAGE_LIMIT_CONFLICT');
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, { limiteUso: true }), error => error.code === 'PROMOTION_INVALID');
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, { ativo: 1 }), error => error.code === 'PROMOTION_INVALID');
    assert.deepEqual((await client.query('SELECT nome, inicio, fim, limite_uso, ativo FROM commerce_promotions WHERE id = $1', [promotion.promotionId])).rows[0], before);
    const auditBefore = Number((await client.query(`SELECT count(*)::int AS total FROM commerce_audit_logs WHERE empresa_id = $1 AND entidade = 'promotion' AND entidade_id = $2`, [f.empresa, promotion.promotionId])).rows[0].total);
    const updated = await updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, promotion.promotionId, {
      nome: 'Atualizada atomicamente', limiteUso: 3, fim: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), ativo: false,
    });
    assert.equal(updated.nome, 'Atualizada atomicamente');
    assert.equal(Number(updated.limite_uso), 3);
    assert.equal(updated.ativo, false);
    const auditAfter = Number((await client.query(`SELECT count(*)::int AS total FROM commerce_audit_logs WHERE empresa_id = $1 AND entidade = 'promotion' AND entidade_id = $2 AND acao = 'updated'`, [f.empresa, promotion.promotionId])).rows[0].total);
    assert.equal(auditAfter, auditBefore + 1);
    const foreignPromotion = id();
    await client.query(`INSERT INTO commerce_promotions (id, empresa_id, nome, tipo, valor, inicio, ativo) VALUES ($1, $2, 'Fora', 'percentage', 5, CURRENT_TIMESTAMP, true)`, [foreignPromotion, f.foreignEmpresa]);
    await assert.rejects(updatePromotion(client, { empresaId: f.empresa, lojaId: f.loja }, foreignPromotion, { nome: 'não deve atualizar' }), error => error.code === 'PROMOTION_NOT_FOUND');
  });
});

pgTest('dois clientes concorrentes respeitam limite de uso 1 e somente uma aplicação persiste', async () => {
  let committed;
  const setup = await pool.connect();
  try {
    await setup.query('BEGIN');
    committed = await createFixture(setup);
    const coupon = await insertPromotion(setup, committed, { code: 'RACE_LIMIT_ONE', limiteUso: 1, usos: 0, usoMaximo: 1, codeUsos: 0 });
    const orderA = await insertOrder(setup, committed, { subtotal: 37.02 });
    const orderB = await insertOrder(setup, committed, { subtotal: 37.02 });
    await setup.query('COMMIT');
    committed.coupon = coupon;
    committed.orderA = orderA;
    committed.orderB = orderB;
  } finally {
    setup.release();
  }
  try {
    const attempt = orderId => runTransaction(client => applyPromotionToOrder(client, { empresaId: committed.empresa, lojaId: committed.loja }, { orderId, codigo: committed.coupon.promotionCode }));
    const results = await Promise.allSettled([attempt(committed.orderA), attempt(committed.orderB)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const rejection = results.find(result => result.status === 'rejected').reason;
    assert.equal(rejection.code, 'PROMOTION_NOT_FOUND');
    const persisted = (await pool.query(
      `SELECT p.usos AS promotion_usos, c.usos AS code_usos,
              (SELECT count(*)::int FROM commerce_order_promotions WHERE empresa_id = $1) AS applications
         FROM commerce_promotions p
         JOIN commerce_promotion_codes c ON c.empresa_id = p.empresa_id AND c.promotion_id = p.id
        WHERE p.id = $2`,
      [committed.empresa, committed.coupon.promotionId],
    )).rows[0];
    assert.deepEqual(persisted, { promotion_usos: 1, code_usos: 1, applications: 1 });
  } finally {
    // Fixtures committed ficam exclusivamente no banco local descartável.
    // Não apagar tenants: a auditoria append-only deve continuar íntegra.
  }
});

test('guard do teste PG não infere DATABASE_URL de produção', { skip: Boolean(pool) }, () => {
  assert.equal(databaseName, null);
});

pgTest('aplicação não alcança pedido de outra vitrine ou unidade do mesmo tenant e deixa zero mutation', async () => {
  await withRollback(async client => {
    const f = await createFixture(client);
    const coupon = await insertPromotion(client, f, { code: 'STORE_SCOPED' });
    const orderId = await insertOrder(client, f, { storefrontId: f.unpublishedStorefront });
    const before = await tenantSnapshot(client, f.empresa);
    await assert.rejects(
      applyPromotionToOrder(client, { empresaId: f.empresa, lojaId: f.loja, storefrontId: f.storefront }, { orderId, codigo: coupon.promotionCode, storefrontId: f.storefront }),
      error => error.code === 'ORDER_NOT_FOUND',
    );
    await assert.rejects(
      applyPromotionToOrder(client, { empresaId: f.empresa, lojaId: randomUUID() }, { orderId, codigo: coupon.promotionCode }),
      error => error.code === 'ORDER_NOT_FOUND',
    );
    assert.deepEqual(await tenantSnapshot(client, f.empresa), before);
    const counters = (await client.query('SELECT p.usos, o.desconto FROM commerce_promotions p JOIN commerce_orders o ON o.empresa_id = p.empresa_id WHERE p.id=$1 AND o.id=$2', [coupon.promotionId, orderId])).rows[0];
    assert.deepEqual(counters, { usos: 0, desconto: '0.00' });
  });
});
