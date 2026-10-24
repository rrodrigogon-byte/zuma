import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { localPostgresFixture } from '../app/tests/local-postgres-fixture.js';
const fixture = await localPostgresFixture();
try {
  const client = await fixture.connect();
  const { user, host, port, database } = client.connectionParameters;
  const url = new URL(`postgresql://${user}@localhost:${port}/${database}`);
  url.searchParams.set('host',host);
  const env = Object.fromEntries(['PATH','HOME','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  const child = spawn(process.execPath,['--test','--test-concurrency=1','app/core/suprimentos.pg.test.js'], { cwd: new URL('..',import.meta.url),env:{...env,NODE_ENV:'test',CLUBE_PG_TEST_URL:url.href},stdio:'inherit' });
  const [code] = await once(child,'exit');
  process.exitCode = code ?? 1;
} finally { await fixture.close(); }
