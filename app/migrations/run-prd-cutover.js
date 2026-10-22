#!/usr/bin/env node
/**
 * Corte PRD aprovado para iniciar a operação Dino.
 *
 * Este runner permanece inerte até PRD_CUTOVER_CONFIRM conter exatamente
 * PRD_CUTOVER_AGRO_DINO_20261022. Uma execução bem-sucedida é marcada em
 * commerce_legacy_imports para impedir repetição acidental.
 *
 * Escopo deliberadamente limitado:
 * - cria snapshot gzip lógico antes de qualquer mutação;
 * - apaga somente pedidos/pagamentos operacionais Commerce do AGRO OPEN TTC;
 * - preserva cadastros, produtos, configurações, créditos/dívidas e histórico
 *   da Barbearia Dino;
 * - define disponível = 10 para todas as variantes Commerce do AGRO OPEN TTC
 *   e da Barbearia Dino, criando níveis ausentes.
 *
 * A migração Avec completa não é inferida por este arquivo. Ela exige um
 * export estruturado da origem e deve usar importação idempotente separada.
 */
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { db } from '../core/database.js';

const CONFIRMATION = 'PRD_CUTOVER_AGRO_DINO_20261022';
const RUN_KEY = 'prd-cutover-agro-dino-20261022-v1';
const AGRO = {
  empresaId: '2e041110-db20-4fd1-8278-12bd3dead008',
  lojaId: '17b057ab-a13f-4fee-ae42-bc70578ec756',
  storefrontId: 'b08e0344-6738-438e-b5c0-32d36e0b3912',
  locationCode: 'main',
  expectedName: 'AGRO OPEN TTC',
};
const DINO = {
  empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
  storefrontId: '94ce95de-f36d-4ced-ad92-40f4208a7e06',
  locationCode: 'dino-web-estoque',
  expectedName: 'Barbearia Dino',
};
const SNAPSHOT_TABLES = [
  'commerce_orders',
  'commerce_order_items',
  'commerce_order_events',
  'commerce_payments',
  'commerce_fulfillments',
  'commerce_order_promotions',
  'commerce_order_satisfaction',
  'commerce_inventory_reservations',
];

function json(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? Number(item) : item));
}

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getTarget(trx, target) {
  const result = await trx.query(
    `SELECT e.id, e.nome, e.ativa, l.id AS loja_id, l.nome AS loja_nome,
            s.id AS storefront_id, loc.id AS location_id, loc.codigo AS location_code
       FROM empresas e
       JOIN lojas l ON l.empresa_id = e.id AND l.id = $2 AND l.ativa = true
       JOIN commerce_storefronts s ON s.empresa_id = e.id AND s.id = $3 AND s.status = 'active'
       JOIN commerce_inventory_locations loc
         ON loc.empresa_id = e.id AND loc.loja_id = l.id AND loc.codigo = $4 AND loc.ativo = true
      WHERE e.id = $1 AND e.nome = $5 AND e.ativa = true
      LIMIT 1`,
    [target.empresaId, target.lojaId, target.storefrontId, target.locationCode, target.expectedName],
  );
  if (!result.rows[0]) {
    throw new Error(`escopo PRD não confere para ${target.expectedName}`);
  }
  return result.rows[0];
}

async function rowsForOrders(trx, table, empresaId, orderIds) {
  if (table === 'commerce_orders') {
    return (await trx.query(`SELECT * FROM ${table} WHERE empresa_id = $1 ORDER BY criado_em, id`, [empresaId])).rows;
  }
  if (!orderIds.length) return [];
  const orderColumn = table === 'commerce_order_satisfaction' ? 'order_id' : 'order_id';
  return (await trx.query(`SELECT * FROM ${table} WHERE empresa_id = $1 AND ${orderColumn} = ANY($2::uuid[]) ORDER BY id`, [empresaId, orderIds])).rows;
}

async function createSnapshot(trx, payload) {
  const raw = Buffer.from(json(payload), 'utf8');
  const compressed = gzipSync(raw, { level: 9 });
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const result = await trx.query(
    `INSERT INTO kytto_json_snapshots
       (tipo, dia_local, bytes_original, bytes_gzip, sha256, origem, verificado_em, conteudo)
     VALUES ($1, $2::date, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
     RETURNING id, sha256, bytes_original, bytes_gzip`,
    ['manual', nowDate(), raw.length, compressed.length, sha256, 'prd-cutover', compressed],
  );
  return result.rows[0];
}

async function setInventoryToTen(trx, target, context) {
  const variants = (await trx.query(
    `SELECT id FROM commerce_product_variants
      WHERE empresa_id = $1
      ORDER BY id`,
    [target.empresaId],
  )).rows;
  let updated = 0;
  let created = 0;
  for (const variant of variants) {
    const result = await trx.query(
      `INSERT INTO commerce_inventory_levels
         (empresa_id, location_id, variant_id, disponivel)
       VALUES ($1, $2, $3, 10)
       ON CONFLICT (empresa_id, location_id, variant_id)
       DO UPDATE SET disponivel = 10, atualizado_em = CURRENT_TIMESTAMP
       RETURNING (xmax = 0) AS created`,
      [target.empresaId, context.location_id, variant.id],
    );
    if (result.rows[0]?.created) created += 1;
    else updated += 1;
  }
  return { variants: variants.length, updated, created };
}

async function execute() {
  if (process.env.PRD_CUTOVER_CONFIRM !== CONFIRMATION) {
    console.log(JSON.stringify({ skipped: true, reason: 'PRD_CUTOVER_CONFIRM não habilitado' }));
    return { skipped: true };
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_HOST) {
    throw new Error('conexão PostgreSQL ausente');
  }

  const result = await db.transaction(async (trx) => {
    const already = await trx.query(
      `SELECT metadata FROM commerce_legacy_imports
        WHERE empresa_id = $1 AND source = 'prd-cutover' AND entity = 'cutover' AND legacy_key = $2
        LIMIT 1`,
      [AGRO.empresaId, RUN_KEY],
    );
    if (already.rows[0]) {
      return { alreadyApplied: true, summary: already.rows[0].metadata };
    }

    const agroContext = await getTarget(trx, AGRO);
    const dinoContext = await getTarget(trx, DINO);
    const agroOrders = (await trx.query(
      `SELECT id FROM commerce_orders WHERE empresa_id = $1 ORDER BY criado_em, id`,
      [AGRO.empresaId],
    )).rows.map(row => row.id);
    const before = {
      agro: {
        orders: agroOrders.length,
        payments: Number((await trx.query('SELECT count(*)::int AS n FROM commerce_payments WHERE empresa_id = $1', [AGRO.empresaId])).rows[0].n),
      },
      inventory: {
        agro: Number((await trx.query('SELECT count(*)::int AS n FROM commerce_inventory_levels WHERE empresa_id = $1', [AGRO.empresaId])).rows[0].n),
        dino: Number((await trx.query('SELECT count(*)::int AS n FROM commerce_inventory_levels WHERE empresa_id = $1', [DINO.empresaId])).rows[0].n),
      },
      variants: {
        agro: Number((await trx.query('SELECT count(*)::int AS n FROM commerce_product_variants WHERE empresa_id = $1', [AGRO.empresaId])).rows[0].n),
        dino: Number((await trx.query('SELECT count(*)::int AS n FROM commerce_product_variants WHERE empresa_id = $1', [DINO.empresaId])).rows[0].n),
      },
    };

    const snapshot = {
      runKey: RUN_KEY,
      generatedAt: new Date().toISOString(),
      scope: { agro: AGRO, dino: DINO },
      before,
      rows: {},
    };
    for (const table of SNAPSHOT_TABLES) {
      snapshot.rows[`agro.${table}`] = await rowsForOrders(trx, table, AGRO.empresaId, agroOrders);
    }
    snapshot.rows['agro.commerce_payments'] = (await trx.query(
      'SELECT * FROM commerce_payments WHERE empresa_id = $1 ORDER BY criado_em, id',
      [AGRO.empresaId],
    )).rows;
    snapshot.rows['agro.commerce_inventory_levels'] = (await trx.query(
      'SELECT * FROM commerce_inventory_levels WHERE empresa_id = $1 ORDER BY location_id, variant_id',
      [AGRO.empresaId],
    )).rows;
    snapshot.rows['dino.commerce_inventory_levels'] = (await trx.query(
      'SELECT * FROM commerce_inventory_levels WHERE empresa_id = $1 ORDER BY location_id, variant_id',
      [DINO.empresaId],
    )).rows;
    const snapshotRef = await createSnapshot(trx, snapshot);

    if (agroOrders.length) {
      const ids = agroOrders;
      await trx.query('DELETE FROM commerce_inventory_reservations WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_order_satisfaction WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_order_promotions WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_fulfillments WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_payments WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_order_events WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_order_items WHERE empresa_id = $1 AND order_id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
      await trx.query('DELETE FROM commerce_orders WHERE empresa_id = $1 AND id = ANY($2::uuid[])', [AGRO.empresaId, ids]);
    }
    await trx.query('DELETE FROM commerce_payments WHERE empresa_id = $1', [AGRO.empresaId]);

    const stock = {
      agro: await setInventoryToTen(trx, AGRO, agroContext),
      dino: await setInventoryToTen(trx, DINO, dinoContext),
    };
    const summary = {
      runKey: RUN_KEY,
      snapshot: snapshotRef,
      deleted: { agroOrders: before.agro.orders, agroPayments: before.agro.payments },
      stock,
      preserved: ['empresas', 'lojas', 'commerce_products', 'commerce_product_variants', 'commerce_customers', 'commerce_customer_credit_accounts', 'commerce_customer_credit_entries', 'commerce_storefronts', 'Barbearia Dino history'],
    };

    await trx.query(
      `INSERT INTO auditoria (empresa_id, loja_id, tabela, operacao, registro_id, dados_anterior, dados_novo)
       VALUES ($1, $2, 'prd_cutover', 'cutover', $3, $4::jsonb, $5::jsonb)`,
      [AGRO.empresaId, AGRO.lojaId, RUN_KEY, json(before), json(summary)],
    );
    await trx.query(
      `INSERT INTO commerce_legacy_imports
         (empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash, metadata)
       VALUES ($1, $2, 'prd-cutover', 'cutover', $3, gen_random_uuid(), $4, $5::jsonb)`,
      [AGRO.empresaId, AGRO.lojaId, RUN_KEY, snapshotRef.sha256, json(summary)],
    );
    return { alreadyApplied: false, summary };
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

execute().catch(async (error) => {
  console.error(`Corte PRD não executado: ${error.message}`);
  await db.close();
  process.exitCode = 1;
});
