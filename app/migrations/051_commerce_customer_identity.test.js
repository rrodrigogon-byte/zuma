import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { migrationFiles } from './run-commerce-schema-migrations.js';

const sql = readFileSync(new URL('./051_commerce_customer_identity.sql', import.meta.url), 'utf8');

test('migration 051 vem logo depois da 050 (migrations novas entram depois dela)', () => {
  const index = migrationFiles.indexOf('051_commerce_customer_identity.sql');
  assert.ok(index > 0);
  assert.equal(migrationFiles[index - 1], '050_commerce_order_satisfaction.sql');
  assert.ok(migrationFiles.slice(index + 1).every((file) => file > '051'), 'nada anterior à 051 depois dela');
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

test('migration 051 não aborta o deploy com clientes duplicados: registra para revisão e só cria o índice sem conflito', () => {
  assert.doesNotMatch(sql, /RAISE EXCEPTION/i, 'conflito em dado antigo não pode travar o deploy');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS commerce_customer_identity_review/i);
  for (const tipo of ['email', 'telefone', 'endereco', 'endereco_padrao']) assert.match(sql, new RegExp(`'${tipo}'`));
  assert.match(sql, /IF phone_conflicts > 0 THEN[\s\S]+ELSE[\s\S]+uq_commerce_customer_telefone_normalizado/);
  assert.match(sql, /IF email_conflicts > 0 THEN[\s\S]+ELSE[\s\S]+uq_commerce_customer_email_normalizado/);
});
