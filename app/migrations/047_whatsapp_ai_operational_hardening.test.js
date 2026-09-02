import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./047_whatsapp_ai_operational_hardening.sql', import.meta.url);
const runnerUrl = new URL('./run-commerce-schema-migrations.js', import.meta.url);

test('migration 047 é registrada, aditiva e não ativa provedores ou canais', async () => {
  const [sql, runner] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(runnerUrl, 'utf8'),
  ]);
  assert.match(runner, /'047_whatsapp_ai_operational_hardening\.sql'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS lease_token UUID/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS delivery_status VARCHAR\(20\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS whatsapp_ai_provider_runs/);
  assert.match(sql, /ai_circuit_open_until/);
  assert.match(sql, /handoff_requested_at/);
  assert.match(sql, /delivery_started_at/);
  assert.match(sql, /status IN \('pendente','processando','enviado'.*'incerto'/s);
  assert.doesNotMatch(sql, /UPDATE\s+canais_integracao\s+SET\s+status\s*=\s*'ativo'/i);
  assert.doesNotMatch(sql, /FEATURE_WHATSAPP_AI\s*=|EVOLUTION_API_KEY\s*=|GEMINI_API_KEY\s*=/i);
});
