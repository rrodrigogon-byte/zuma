import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// No inherited DSN or provider credential is passed into any child process.
if (process.env.NODE_ENV === 'production') throw new Error('Executor sintético proibido em produção');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bin = '/usr/lib/postgresql/16/bin';
for (const name of ['initdb', 'pg_ctl', 'psql', 'createdb']) if (!existsSync(join(bin, name))) throw new Error('PostgreSQL 16 local é necessário; nenhuma instalação/DSN remota será usada');
if (userInfo().uid === 0) throw new Error('Execute como usuário local não-root');
const dir = mkdtempSync(join(tmpdir(), 'dino-agenda-pg-'));
const data = join(dir, 'data');
const socket = join(dir, 'socket');
mkdirSync(socket, { mode: 0o700 });
const database = 'dino_agenda_test';
const owner = 'dino_fixture_owner';
const port = 55432; // socket is unique and TCP is disabled, so it cannot reach another cluster
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
let started = false;
function run(name, args) {
  const r = spawnSync(join(bin, name), args, { env, cwd: root, encoding: 'utf8', timeout: 90000 });
  if (r.error || r.status !== 0) throw new Error(`${name} falhou na fixture local: ${r.error?.message || r.stderr.slice(-1000)}`);
}
try {
  run('initdb', ['-D', data, '-U', owner, '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-k ${socket} -p ${port} -c listen_addresses='' -c fsync=off`, '-w', 'start']);
  started = true;
  run('createdb', ['-h', socket, '-p', String(port), '-U', owner, database]);
  for (const file of ['001_erp_foundation.sql', '003_multiloja_auditoria_imutavel.sql', '038_whatsapp_ai_conversations.sql']) {
    run('psql', ['-h', socket, '-p', String(port), '-U', owner, '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', join(root, 'app/migrations', file)]);
    console.log(`Migration histórica aplicada somente na fixture: ${file}`);
  }
  const marker = crypto.randomUUID();
  const manifest = join(dir, 'fixture.json');
  writeFileSync(manifest, JSON.stringify({ marker, socket, port, database, owner }), { mode: 0o600 });
  const testEnv = { ...env, NODE_ENV: 'test', DB_PATH: join(dir, 'legacy.json'), DINO_AGENDA_FIXTURE: manifest, DINO_AGENDA_FIXTURE_MARKER: marker };
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'app/core/barbershop-agenda-real.pg.test.js'], { env: testEnv, cwd: root, stdio: 'inherit', timeout: 120000 });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (started) {
    const stopped = spawnSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env, encoding: 'utf8', timeout: 30000 });
    if (stopped.status !== 0) {
      console.error('Não foi possível parar a fixture; diretório preservado para diagnóstico local.');
      process.exitCode = 1;
    } else { rmSync(dir, { recursive: true, force: true }); console.log('Fixture PostgreSQL própria encerrada e removida.'); }
  } else rmSync(dir, { recursive: true, force: true });
}
