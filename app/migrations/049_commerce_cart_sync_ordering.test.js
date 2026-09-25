import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('./049_commerce_cart_sync_ordering.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 049 adiciona somente a versão monotônica do sync de carrinho', () => {
  assert.match(migration, /ALTER TABLE commerce_carts/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS client_sync_version BIGINT NOT NULL DEFAULT 0/);
  assert.match(migration, /CHECK \(client_sync_version >= 0\)/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
  assert.match(runner, /'049_commerce_cart_sync_ordering\.sql'/);
});
