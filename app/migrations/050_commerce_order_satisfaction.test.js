import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('./050_commerce_order_satisfaction.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 050 cria pesquisa tenant-scoped e idempotente sem alterar migrations históricas', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_order_satisfaction/);
  assert.match(migration, /UNIQUE \(empresa_id, order_id\)/);
  assert.match(migration, /UNIQUE \(empresa_id, idempotency_key\)/);
  assert.match(migration, /CHECK \(nota BETWEEN 1 AND 5\)/);
  assert.match(migration, /FOREIGN KEY \(empresa_id, storefront_id, order_id\)/);
  assert.match(migration, /REFERENCES commerce_orders \(empresa_id, storefront_id, id\)/);
  assert.doesNotMatch(migration, /comentario VARCHAR/);
  assert.match(migration, /retencao_ate TIMESTAMPTZ NOT NULL DEFAULT \(CURRENT_TIMESTAMP \+ INTERVAL '365 days'\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_public_rate_limits/);
  assert.match(migration, /idx_commerce_order_satisfaction_tenant_date/);
  assert.match(runner, /'049_commerce_cart_sync_ordering\.sql',\s*'050_commerce_order_satisfaction\.sql'/);
});
