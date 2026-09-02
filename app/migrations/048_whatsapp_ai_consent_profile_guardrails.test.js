import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./048_whatsapp_ai_consent_profile_guardrails.sql', import.meta.url);
const runnerUrl = new URL('./run-commerce-schema-migrations.js', import.meta.url);

test('migration 048 registra guardrails aditivos e mantém recursos inativos por padrão', async () => {
  const [sql, runner] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(runnerUrl, 'utf8'),
  ]);
  assert.match(runner, /'048_whatsapp_ai_consent_profile_guardrails\.sql'/);
  assert.match(sql, /opportunity_count SMALLINT NOT NULL DEFAULT 0/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS whatsapp_ai_policy_events/);
  assert.match(sql, /CHECK \(tipo IN \(/);
  assert.match(sql, /sensitive_input_blocked/);
  assert.match(sql, /idx_eventos_integracao_channel_received/);
  assert.doesNotMatch(sql, /UPDATE\s+canais_integracao\s+SET\s+status\s*=\s*'ativo'/i);
  assert.doesNotMatch(sql, /personalization_enabled[^\n]*true|opportunities_enabled[^\n]*true/i);
  assert.doesNotMatch(sql, /FEATURE_WHATSAPP_AI\s*=|EVOLUTION_API_KEY\s*=|GEMINI_API_KEY\s*=/i);
});
