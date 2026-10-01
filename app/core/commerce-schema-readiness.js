import { readFileSync } from 'node:fs';
import { migrationFiles } from '../migrations/run-commerce-schema-migrations.js';

// O pre-deploy é a única rotina que aplica migrations; o health apenas compara
// o ledger com o manifesto versionado. Nunca retorna nomes/checksums ao cliente.
const expectedChecksums = JSON.parse(readFileSync(new URL('../migrations/checksums.json', import.meta.url), 'utf8'));

export async function checkCommerceSchemaReadiness(database, files = migrationFiles, checksums = expectedChecksums) {
  if (!Array.isArray(files) || files.length === 0 || files.some(name => !checksums[name])) {
    return { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' };
  }
  const result = await database.queryRead(
    'SELECT arquivo, checksum FROM commerce_schema_migrations WHERE arquivo = ANY($1::text[])',
    [files],
  );
  const recorded = new Map((result.rows || []).map(row => [row.arquivo, String(row.checksum || '').trim()]));
  const ready = files.every(name => recorded.get(name) === checksums[name]);
  return ready ? { ready: true } : { ready: false, code: 'COMMERCE_SCHEMA_NOT_READY' };
}
