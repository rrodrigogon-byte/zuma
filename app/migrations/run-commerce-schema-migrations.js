import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dbPg from '../db-pg.js';

const migrationDir = path.dirname(fileURLToPath(import.meta.url));
const migrationFiles = [
  '001_erp_foundation.sql',
  '003_multiloja_auditoria_imutavel.sql',
  '019_commerce_core.sql',
  '020_commerce_legacy_import.sql',
  '021_commerce_promotions_permissions.sql',
  '022_commerce_order_promotions.sql',
  '023_commerce_domain_verification.sql',
  '024_commerce_order_shipping.sql',
  '025_commerce_fulfillment_permissions.sql',
  '026_commerce_payment_account_link.sql',
  '027_commerce_shipping_quotes.sql',
  '028_commerce_admin_indexes.sql',
  '029_commerce_orders_schema_hardening.sql',
  '030_commerce_read_model_hardening.sql',
  '031_commerce_payments_schema_hardening.sql',
  '032_commerce_order_store_scope.sql',
  '033_commerce_storefront_templates.sql',
  '034_commerce_multistore_access.sql',
  '035_agro_open_public_store_mapping.sql',
  '036_commerce_manual_shipping_table.sql',
  '037_commerce_storefront_aliases.sql',
  '038_whatsapp_ai_conversations.sql',
  '039_crm_campaigns_governance.sql',
  '040_commerce_own_delivery.sql',
  '041_commerce_customer_credit.sql',
  '042_dino_own_delivery_defaults.sql',
  '043_commerce_abandoned_cart_recovery.sql',
  '044_commerce_loyalty_legacy_compat.sql',
  '044_commerce_loyalty_trigger_compat.sql',
  '044_loyalty_levels_rewards.sql',
  '045_commerce_loyalty_ledger.sql',
  '046_barbershop_appointment_notifications.sql',
];
const advisoryLockKey = 825410732;

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function hasManagedDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD)
  );
}

async function ensureControlTable() {
  await dbPg.query(`
    CREATE TABLE IF NOT EXISTS commerce_schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      arquivo VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applyMigration(fileName) {
  const filePath = path.join(migrationDir, fileName);
  const sql = await readFile(filePath, 'utf8');
  const hash = checksum(sql);
  const existing = await dbPg.query(
    'SELECT checksum FROM commerce_schema_migrations WHERE arquivo = $1',
    [fileName]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].checksum !== hash) {
      throw new Error(
        `A migration ${fileName} já foi aplicada com outro checksum; crie uma nova migration incremental.`
      );
    }
    console.log(`↷ ${fileName} já aplicada`);
    return false;
  }

  console.log(`→ Aplicando ${fileName}`);
  const client = await dbPg.beginTransaction();
  try {
    await dbPg.queryInTransaction(client, sql);
    await dbPg.queryInTransaction(
      client,
      'INSERT INTO commerce_schema_migrations (arquivo, checksum) VALUES ($1, $2)',
      [fileName, hash]
    );
    await dbPg.commit(client);
    console.log(`✓ ${fileName} aplicada`);
    return true;
  } catch (error) {
    await dbPg.rollback(client);
    throw new Error(`Falha na migration ${fileName}: ${error.message}`);
  }
}

export async function runCommerceSchemaMigrations({ dryRun = false } = {}) {
  if (dryRun) {
    console.log('Dry-run: nenhuma conexão ou escrita foi executada.');
    for (const fileName of migrationFiles) console.log(`- ${fileName}`);
    return { applied: [], files: [...migrationFiles], dryRun: true };
  }

  if (!hasManagedDatabaseUrl()) {
    if (process.env.COMMERCE_SCHEMA_REQUIRED === '1') {
      throw new Error('Schema do Commerce Core requer DATABASE_URL/POSTGRES_URL ou DB_HOST + DB_NAME + DB_USER + DB_PASSWORD; fallback local bloqueado.');
    }
    console.warn('Schema Commerce Core não executado: conexão PostgreSQL gerenciada ausente; serviço legado preservado.');
    return { applied: [], files: [...migrationFiles], dryRun: false, skipped: true };
  }

  await ensureControlTable();
  await dbPg.query('SELECT pg_advisory_lock($1)', [advisoryLockKey]);
  const applied = [];
  try {
    for (const fileName of migrationFiles) {
      if (await applyMigration(fileName)) applied.push(fileName);
    }
    return { applied, files: [...migrationFiles], dryRun: false };
  } finally {
    await dbPg.query('SELECT pg_advisory_unlock($1)', [advisoryLockKey]);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  runCommerceSchemaMigrations({ dryRun })
    .then(({ applied, files }) => {
      console.log(`Schema Commerce Core concluído. Arquivos: ${files.length}; novos: ${applied.length}.`);
    })
    .catch((error) => {
      console.error(`Erro no schema Commerce Core: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (!dryRun) await dbPg.closePool();
    });
}

export { migrationFiles };
