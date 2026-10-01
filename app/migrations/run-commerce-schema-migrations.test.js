import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stripTopLevelTransactionControl } from './run-commerce-schema-migrations.js';

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
