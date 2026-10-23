import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('./085_ai_automation_log_store_scope.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 085 associa novos logs à unidade sem backfill ambíguo', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS loja_id UUID/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_lojas_empresa_id_id\s+ON lojas \(empresa_id, id\)/);
  assert.ok(
    migration.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS uq_lojas_empresa_id_id') < migration.indexOf('FOREIGN KEY (empresa_id, loja_id)'),
    'alvo UNIQUE composto deve existir antes da FK composta',
  );
  assert.match(migration, /FOREIGN KEY \(empresa_id, loja_id\)\s+REFERENCES lojas \(empresa_id, id\)/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS uq_ai_automation_ref/);
  assert.match(migration, /ON ai_automation_log \(empresa_id, loja_id, automacao, telefone, referencia\)\s+WHERE loja_id IS NOT NULL/);
  assert.match(migration, /ON ai_automation_log \(empresa_id, automacao, telefone, referencia\)\s+WHERE loja_id IS NULL/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|INSERT|DELETE|TRUNCATE)\s+FROM?\b/i, 'não atribui nem altera linhas existentes');
  assert.match(migration, /NULL apenas para histórico antigo não atribuível/);
  assert.match(runner, /'085_ai_automation_log_store_scope\.sql'/);
});
