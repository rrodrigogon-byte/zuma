import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./run-destructive-database-checks.sh', import.meta.url), 'utf8');

test('runner destrutivo aborta em produção e exige opt-in inequívoco', () => {
  assert.match(source, /NODE_ENV:-.*production/);
  assert.match(source, /exit 64/);
  assert.match(source, /ALLOW_DESTRUCTIVE_DB_TESTS:-/);
  assert.match(source, /I_UNDERSTAND_THIS_RECREATES_A_DISPOSABLE_DATABASE/);
  assert.match(source, /DATABASE_URL:-/);
});
