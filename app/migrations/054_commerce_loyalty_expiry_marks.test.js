import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('./054_commerce_loyalty_expiry_marks.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 054 só cria a tabela de marcas de expiração, sem mexer no livro de pontos', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_loyalty_expiry_marks/);
  assert.doesNotMatch(migration, /^\s*(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/im);
  assert.match(runner, /'054_commerce_loyalty_expiry_marks\.sql'/);
});
