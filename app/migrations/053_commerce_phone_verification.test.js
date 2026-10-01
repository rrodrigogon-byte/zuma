import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('./053_commerce_phone_verification.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 053 só cria a tabela de confirmação por código e não guarda o código em texto', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_phone_verifications \(/);
  assert.match(migration, /codigo_hash CHAR\(64\)/);
  assert.doesNotMatch(migration, /\bcodigo VARCHAR|DROP TABLE|TRUNCATE|DELETE FROM|UPDATE /i);
  assert.match(runner, /'053_commerce_phone_verification\.sql'/);
});
