// Suítes reais do ERP em PostgreSQL descartável: não lê DSNs nem credenciais remotas.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { localPostgresFixture } from '../app/tests/local-postgres-fixture.js';
const suites = ['unidades', 'a2', 'bar-a1', 'razao', 'razao-rotas', 'suprimentos', 'conciliacao', 'salao', 'pdv-offline', 'varejo', 'fiscal', 'fiscal-completo'];
const fixture = await localPostgresFixture();
try {
  const client = await fixture.connect();
  const { user, host, port, database } = client.connectionParameters;
  const url = new URL(`postgresql://${user}@localhost:${port}/${database}`);
  url.searchParams.set('host', host);
  const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const run = async (args, localEnv) => {
    const child = spawn(process.execPath, args, { cwd: new URL('..', import.meta.url), env: { ...env, NODE_ENV: 'test', ...localEnv }, stdio: 'inherit' });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error('Validação local do ERP falhou; consulte o resultado dos testes.');
  };
  await run(['--test', '--test-concurrency=1', ...suites.map(name => `app/core/${name}.pg.test.js`)], { CLUBE_PG_TEST_URL: url.href });
  if (process.argv.includes('--e2e')) {
    await run(['app/migrations/run-commerce-schema-migrations.js'], { DATABASE_URL: url.href, DB_SSL: 'false', COMMERCE_SCHEMA_REQUIRED: '1' });
    await run(['--test', 'app/backoffice-ondas.e2e.pg.test.js'], { BACKOFFICE_E2E_DATABASE_URL: url.href });
  }
} finally { await fixture.close(); }
