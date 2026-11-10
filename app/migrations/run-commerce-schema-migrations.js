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
  '047_whatsapp_ai_operational_hardening.sql',
  '048_whatsapp_ai_consent_profile_guardrails.sql',
  '049_commerce_cart_sync_ordering.sql',
  '050_commerce_order_satisfaction.sql',
  '051_commerce_customer_identity.sql',
  '052_ai_brain_memory_learning.sql',
  '053_commerce_phone_verification.sql',
  '054_commerce_loyalty_expiry_marks.sql',
  '055_commerce_order_contact_snapshot.sql',
  '056_commerce_variant_backorder.sql',
  '060_kytto_json_snapshots.sql',
  '061_whatsapp_crm_interactions.sql',
  '062_dino_resumo_diario.sql',
  '063_whatsapp_channel_instance_owner.sql',
  '064_commerce_operational_invites.sql',
  '065_commerce_membership_expiration.sql',
  '066_grupos_empresariais.sql',
  '067_commerce_accounts.sql',
  '068_commerce_platform_grants.sql',
  '069_commerce_postal_codes.sql',
  '070_whatsapp_channel_profiles.sql',
  '071_whatsapp_launch_channel.sql',
  '072_whatsapp_waha_internal_channels.sql',
  '073_clube_acesso_controle.sql',
  '074_clube_contratos_digitais.sql',
  '075_clube_aulas_agenda.sql',
  '076_clube_retencao.sql',
  '077_clube_parceiros.sql',
  '078_clube_cobrancas.sql',
  '079_clube_importacoes.sql',
  '080_clube_quadras.sql',
  '081_bar_pdv_multiempresa.sql',
  '082_financeiro_cadastros_multiempresa.sql',
  '083_dino_operational_foundations.sql',
  '084_dino_forecast_ai.sql',
  '085_ai_automation_log_store_scope.sql',
  '090_financeiro_razao.sql',
  '091_estoque_compras.sql',
  '092_fiscal_multiempresa.sql',
  '093_conciliacao_bancaria.sql',
  '094_salao_reservas.sql',
  '095_pdv_offline_multiempresa.sql',
  '096_varejo_supermercado.sql',
  '097_pdv_offline_unidade_no_razao.sql',
  '098_financeiro_ajustes_auditoria.sql',
  '099_pdv_offline_impressao.sql',
  '100_fiscal_completo.sql',
  '101_varejo_balanca.sql',
  '102_perfis_acesso.sql',
  '103_barbershop_history_archive.sql',
  '104_avec_revenue_mix.sql',
  '105_account_password_recovery.sql',
  '106_fiscal_producao.sql',
  '107_fiscal_automatica.sql',
  '108_fiscal_ibs_cbs.sql',
  '109_supermercado_atacarejo_ressuprimento.sql',
  '110_supermercado_enterprise_wms_tributario_coletor.sql',
  '111_supermercado_fase3_pedidos_edi_fidelidade_dre.sql',
  '112_supermercado_onda4_esl_rotisseria_trocas_tesouraria.sql',
  '113_supermercado_fase5_picking_desperdicio_conciliacao_acordos.sql',
  '114_remover_empresa_indevida_barbearia_imperial.sql',
  '115_supermercado_fase6_antifurto_rastreabilidade_planograma_kiosk.sql',
  '116_supermercado_fase7_auditoria_fraude_tabloide_trade.sql',
  '117_empresas_canonicas_e_lancamentos_todas_empresas.sql',
  '118_negocios_multi_negocio_governance.sql',
  '119_supermercado_seed_enterprise_operacoes.sql',
  '120_corrigir_emitentes_fiscais_todas_empresas.sql',
];
const advisoryLockKey = 825410732;

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export function stripTopLevelTransactionControl(sql) {
  let depth = 0;
  let state = 'normal';
  let dollarTag = '';
  let statement = '';
  let output = '';

  function appendStatement(terminator = '') {
    const normalized = statement.trim().replace(/^(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/\s*)*/g, '').trim().toUpperCase();
    if (depth === 0 && /^(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+WORK)?)$/.test(normalized)) {
      output += statement.replace(/[^\r\n]/g, ' ') + (terminator ? ' ' : '');
    } else {
      output += statement + terminator;
    }
    statement = '';
  }

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] || '';
    if (state === 'line-comment') {
      statement += char;
      if (char === '\n') state = 'normal';
      continue;
    }
    if (state === 'block-comment') {
      statement += char;
      if (char === '*' && next === '/') { statement += next; index += 1; state = 'normal'; }
      continue;
    }
    if (state === 'single-quote') {
      statement += char;
      if (char === "'" && next === "'") { statement += next; index += 1; }
      else if (char === "'") state = 'normal';
      continue;
    }
    if (state === 'double-quote') {
      statement += char;
      if (char === '"' && next === '"') { statement += next; index += 1; }
      else if (char === '"') state = 'normal';
      continue;
    }
    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) { statement += dollarTag; index += dollarTag.length - 1; state = 'normal'; }
      else statement += char;
      continue;
    }
    if (char === '-' && next === '-') { statement += char + next; index += 1; state = 'line-comment'; continue; }
    if (char === '/' && next === '*') { statement += char + next; index += 1; state = 'block-comment'; continue; }
    if (char === "'") { statement += char; state = 'single-quote'; continue; }
    if (char === '"') { statement += char; state = 'double-quote'; continue; }
    if (char === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; statement += dollarTag; index += dollarTag.length - 1; state = 'dollar-quote'; continue; }
    }
    if (char === '(') depth += 1;
    else if (char === ')' && depth > 0) depth -= 1;
    if (char === ';') appendStatement(';');
    else statement += char;
  }
  appendStatement();
  return output;
}

function hasManagedDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD)
  );
}

async function ensureControlTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS commerce_schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      arquivo VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applyMigration(client, fileName) {
  const filePath = path.join(migrationDir, fileName);
  const sql = await readFile(filePath, 'utf8');
  const hash = checksum(sql);
  const existing = await client.query(
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
  try {
    await client.query('BEGIN');
    await client.query(stripTopLevelTransactionControl(sql));
    await client.query(
      'INSERT INTO commerce_schema_migrations (arquivo, checksum) VALUES ($1, $2)',
      [fileName, hash]
    );
    await client.query('COMMIT');
    console.log(`✓ ${fileName} aplicada`);
    return true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.message = `${error.message}; rollback também falhou: ${rollbackError.message}`;
    }
    throw new Error(`Falha na migration ${fileName}: ${error.message}`);
  }
}

export async function runCommerceSchemaMigrations({ dryRun = false, db = dbPg } = {}) {
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

  const client = await db.acquireClient();
  let lockAcquired = false;
  try {
    await ensureControlTable(client);
    await client.query('SELECT pg_advisory_lock($1)', [advisoryLockKey]);
    lockAcquired = true;
    const applied = [];
    for (const fileName of migrationFiles) {
      if (await applyMigration(client, fileName)) applied.push(fileName);
    }
    return { applied, files: [...migrationFiles], dryRun: false };
  } finally {
    try {
      if (lockAcquired) await client.query('SELECT pg_advisory_unlock($1)', [advisoryLockKey]);
    } finally {
      db.releaseClient(client);
    }
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
