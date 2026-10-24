import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Somente binários locais. Nunca consulta DSNs ou instala um servidor.
export function postgres16TestBin() {
  const candidates = [process.env.PG_TEST_BIN, '/usr/lib/postgresql/16/bin', '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin'].filter(Boolean);
  for (const candidate of candidates) {
    if (!['initdb', 'pg_ctl', 'createdb'].every(name => existsSync(join(candidate, name)))) continue;
    const version = spawnSync(join(candidate, 'initdb'), ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (version.status === 0 && /\(PostgreSQL\) 16\./.test(version.stdout)) return candidate;
  }
  throw new Error('PostgreSQL 16 local ausente; configure PG_TEST_BIN. Nenhum banco remoto será usado.');
}
