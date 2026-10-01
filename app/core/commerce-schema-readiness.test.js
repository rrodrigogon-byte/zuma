import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCommerceSchemaReadiness } from './commerce-schema-readiness.js';

const files = ['051_commerce_customer_identity.sql', '052_ai_brain_memory_learning.sql'];
const checksums = Object.fromEntries(files.map((name, index) => [name, `hash-${index}`]));

function fakeDatabase(rows, seen) {
  return {
    async queryRead(sql, values) {
      seen.push({ sql, values });
      return { rows };
    },
  };
}

test('health exige todas as migrations gerenciadas e seus checksums', async () => {
  const seen = [];
  const rows = files.map(name => ({ arquivo: name, checksum: checksums[name] }));
  assert.deepEqual(await checkCommerceSchemaReadiness(fakeDatabase(rows, seen), files, checksums), { ready: true });
  assert.equal(seen.length, 1);
  assert.match(seen[0].sql, /^SELECT arquivo, checksum FROM commerce_schema_migrations/);
  assert.deepEqual(seen[0].values, [files]);
});

test('health falha fechado quando há migration ausente ou checksum divergente', async () => {
  const seen = [];
  for (const rows of [
    [{ arquivo: files[0], checksum: checksums[files[0]] }],
    files.map(name => ({ arquivo: name, checksum: 'outro-hash' })),
    [],
  ]) {
    const result = await checkCommerceSchemaReadiness(fakeDatabase(rows, seen), files, checksums);
    assert.deepEqual(result, { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' });
    assert.ok(!JSON.stringify(result).includes('hash'));
  }
});

test('health rejeita manifesto inconsistente antes de consultar o banco', async () => {
  const seen = [];
  assert.deepEqual(
    await checkCommerceSchemaReadiness(fakeDatabase([], seen), ['migration-desconhecida.sql'], checksums),
    { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' },
  );
  assert.equal(seen.length, 0);
});

test('health não esconde falhas de conexão em um resultado ready', async () => {
  await assert.rejects(
    checkCommerceSchemaReadiness({ async queryRead() { throw new Error('database offline'); } }, files, checksums),
    /database offline/,
  );
});
