import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  migrationFiles,
  runCommerceSchemaMigrations,
  stripTopLevelTransactionControl,
} from './run-commerce-schema-migrations.js';

test('runner remove somente BEGIN/COMMIT top-level da migration 046 e preserva checksum original', () => {
  const original = readFileSync(new URL('./046_barbershop_appointment_notifications.sql', import.meta.url), 'utf8');
  const hashBefore = createHash('sha256').update(original).digest('hex');
  const normalized = stripTopLevelTransactionControl(original);
  const hashAfter = createHash('sha256').update(original).digest('hex');
  assert.equal(hashAfter, hashBefore);
  assert.doesNotMatch(normalized, /^\s*(?:BEGIN|COMMIT)\s*;/im);
  assert.match(normalized, /ALTER TABLE tarefas_integracao_canais/);
  assert.match(normalized, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefas_notificar_agendamento/);
});

test('normalizador não remove palavras em comentários, strings, dollar quote ou bloco interno', () => {
  const sql = `-- BEGIN;\nSELECT 'COMMIT;' AS literal;\nDO $$ BEGIN PERFORM 1; END $$;\nSELECT (1 + 2);`;
  assert.equal(stripTopLevelTransactionControl(sql), sql);
});

test('normalizador aceita formas top-level BEGIN WORK e START TRANSACTION', () => {
  const sql = 'BEGIN WORK;\nSELECT 1;\nCOMMIT WORK;\nSTART TRANSACTION;\nSELECT 2;\nCOMMIT;';
  const normalized = stripTopLevelTransactionControl(sql);
  assert.doesNotMatch(normalized, /\b(?:BEGIN WORK|START TRANSACTION|COMMIT(?: WORK)?)\s*;/i);
  assert.match(normalized, /SELECT 1;/);
  assert.match(normalized, /SELECT 2;/);
});

test('runner preserva 084 e registra 085 como próxima migration', () => {
  assert.equal(migrationFiles.at(-1), '085_ai_automation_log_store_scope.sql');
  assert.equal(migrationFiles.at(-2), '084_dino_forecast_ai.sql');
  assert.equal(migrationFiles.at(-3), '083_dino_operational_foundations.sql');
});

test('migration 083 contém as tabelas, constraints e índices críticos da fundação', () => {
  const sql = readFileSync(new URL('./083_dino_operational_foundations.sql', import.meta.url), 'utf8');
  for (const table of [
    'dino_effect_outbox',
    'dino_reversal_actions',
    'dino_reversal_links',
    'dino_inventory_reservations',
    'dino_inventory_reservation_events',
    'dino_waitlist_offers',
    'dino_nps_responses',
    'dino_scope_quarantine',
    'dino_webhook_events',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  for (const fragment of [
    'empresa_id UUID NOT NULL',
    'loja_id UUID NOT NULL',
    'efeito VARCHAR',
    'idempotency_key VARCHAR',
    'fingerprint CHAR(64)',
    'payload_sanitizado JSONB',
    'attempts INTEGER NOT NULL',
    'next_retry_at TIMESTAMPTZ',
    'lease_token UUID',
    'lease_until TIMESTAMPTZ',
    'dead_letter BOOLEAN',
    'manual_required BOOLEAN',
    'financial_entry_id UUID',
    'provider_invoice_slug VARCHAR',
    'CONSTRAINT uq_dino_reversal_action_idempotency',
    'CONSTRAINT fk_dino_reversal_link_action',
    'CONSTRAINT fk_dino_inventory_reservation_event_reservation',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_dino_waitlist_offer_active_hold',
    'CONSTRAINT uq_dino_nps_response_appointment',
    'CONSTRAINT chk_dino_scope_quarantine_without_store',
    'CONSTRAINT uq_dino_webhook_event_dedup',
    'idx_dino_webhook_rate_limit',
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(sql, /nota SMALLINT NOT NULL/);
  assert.match(sql, /CHECK \(nota BETWEEN 0 AND 10\)/);
  assert.match(sql, /WHERE status IN \('offered', 'held'\)/);
});

test('migration 084 contém histórico e alertas idempotentes de projeção', () => {
  const sql = readFileSync(new URL('./084_dino_forecast_ai.sql', import.meta.url), 'utf8');
  for (const fragment of [
    'dino_forecast_ai_insights',
    'dino_forecast_ai_alerts',
    'fk_dino_forecast_ai_insight_store',
    'fk_dino_forecast_ai_alert_store',
    'uq_dino_forecast_ai_snapshot',
    'uq_dino_forecast_ai_alert',
    "status IN ('pending', 'ready', 'fallback', 'failed')",
  ]) assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('manifesto de checksums cobre a migration 084 para o health check de produção', () => {
  const sql = readFileSync(new URL('./084_dino_forecast_ai.sql', import.meta.url), 'utf8');
  const checksums = JSON.parse(readFileSync(new URL('./checksums.json', import.meta.url), 'utf8'));
  assert.equal(checksums['084_dino_forecast_ai.sql'], createHash('sha256').update(sql).digest('hex'));
});

test('manifesto de checksums cobre a migration 085 do escopo de automações', () => {
  const sql = readFileSync(new URL('./085_ai_automation_log_store_scope.sql', import.meta.url), 'utf8');
  const checksums = JSON.parse(readFileSync(new URL('./checksums.json', import.meta.url), 'utf8'));
  assert.equal(checksums['085_ai_automation_log_store_scope.sql'], createHash('sha256').update(sql).digest('hex'));
});

test('runner usa o mesmo client para lock, controle, migrations, checksum e unlock', async () => {
  const hadDatabaseUrl = Object.hasOwn(process.env, 'DATABASE_URL');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://unit-test.invalid/ignored';
  const calls = [];
  const client = {
    async query(text, params = []) {
      calls.push({ client: this, text, params });
      if (text.includes('SELECT checksum FROM commerce_schema_migrations')) return { rows: [] };
      return { rows: [] };
    },
  };
  let acquired = 0;
  let released = 0;
  const db = {
    async acquireClient() {
      acquired += 1;
      return client;
    },
    releaseClient(releasedClient) {
      assert.equal(releasedClient, client);
      released += 1;
    },
  };
  try {
    const result = await runCommerceSchemaMigrations({ db });
    assert.equal(result.files.at(-1), '085_ai_automation_log_store_scope.sql');
    assert.equal(result.applied.at(-1), '085_ai_automation_log_store_scope.sql');
  } finally {
    if (hadDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    else delete process.env.DATABASE_URL;
  }
  assert.equal(acquired, 1);
  assert.equal(released, 1);
  assert.ok(calls.length > 4);
  assert.equal(new Set(calls.map(({ client: callClient }) => callClient)).size, 1);
  assert.equal(calls.filter(({ text }) => text.includes('pg_advisory_lock')).length, 1);
  assert.equal(calls.filter(({ text }) => text.includes('pg_advisory_unlock')).length, 1);
});
