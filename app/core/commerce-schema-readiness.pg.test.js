import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { checkCommerceSchemaReadiness } from './commerce-schema-readiness.js';
import { migrationFiles } from '../migrations/run-commerce-schema-migrations.js';

const connectionString = process.env.COMMERCE_READINESS_TEST_DATABASE_URL || '';
const enabled = Boolean(connectionString);
if (enabled && !/_test(?:\?|$)/.test(connectionString)) {
  throw new Error('COMMERCE_READINESS_TEST_DATABASE_URL deve apontar apenas a banco local descartável *_test');
}

test('readiness de migrations é fail-closed em PostgreSQL real', { skip: !enabled }, async () => {
  const client = new pg.Client({ connectionString, ssl: false });
  await client.connect();
  const db = { queryRead: (sql, values) => client.query(sql, values) };
  try {
    assert.deepEqual(await checkCommerceSchemaReadiness(db), { ready: true });
    const target = migrationFiles.at(-1);
    await client.query('BEGIN');
    await client.query('DELETE FROM commerce_schema_migrations WHERE arquivo = $1', [target]);
    assert.deepEqual(await checkCommerceSchemaReadiness(db), { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' });
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    await client.query('UPDATE commerce_schema_migrations SET checksum = $2 WHERE arquivo = $1', [target, '0'.repeat(64)]);
    assert.deepEqual(await checkCommerceSchemaReadiness(db), { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' });
    await client.query('ROLLBACK');
    assert.deepEqual(await checkCommerceSchemaReadiness(db), { ready: true });
  } finally {
    await client.end();
  }
});
