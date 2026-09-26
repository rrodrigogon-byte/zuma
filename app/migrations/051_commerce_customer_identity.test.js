import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { migrationFiles } from './run-commerce-schema-migrations.js';

const sql = readFileSync(new URL('./051_commerce_customer_identity.sql', import.meta.url), 'utf8');

test('migration 051 é a última registrada e mantém 050 imediatamente anterior', () => {
  assert.equal(migrationFiles.at(-2), '050_commerce_order_satisfaction.sql');
  assert.equal(migrationFiles.at(-1), '051_commerce_customer_identity.sql');
});

test('migration 051 usa colunas geradas e unicidade tenant-scoped sem merge de customers', () => {
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
  assert.match(sql, /email_normalizado[\s\S]+GENERATED ALWAYS AS/i);
  assert.match(sql, /telefone_normalizado[\s\S]+GENERATED ALWAYS AS/i);
  assert.match(sql, /ON commerce_customers \(empresa_id, email_normalizado\)/i);
  assert.match(sql, /ON commerce_customers \(empresa_id, telefone_normalizado\)/i);
  assert.match(sql, /duplicate normalized customer emails require manual review/i);
  assert.match(sql, /duplicate normalized customer phones require manual review/i);
  assert.match(sql, /CUSTOMER_IDENTITY_PREFLIGHT_EMAIL_CONFLICT/);
  assert.match(sql, /CUSTOMER_IDENTITY_PREFLIGHT_PHONE_CONFLICT/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+commerce_customers|UPDATE\s+commerce_customers\s+SET\s+id/i);
});

test('migration 051 deduplica endereço por fingerprint dentro do mesmo customer e tenant', () => {
  assert.match(sql, /endereco_fingerprint CHAR\(64\)/i);
  assert.match(sql, /digest\([\s\S]+'sha256'/i);
  assert.match(sql, /ON commerce_customer_addresses \(empresa_id, customer_id, endereco_fingerprint\)/i);
  assert.match(sql, /ON commerce_customer_addresses \(empresa_id, customer_id\)[\s\S]+WHERE padrao = true/i);
  assert.match(sql, /CUSTOMER_IDENTITY_PREFLIGHT_ADDRESS_CONFLICT/);
  assert.match(sql, /CUSTOMER_IDENTITY_PREFLIGHT_DEFAULT_ADDRESS_CONFLICT/);
});
