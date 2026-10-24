import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { userInfo } from 'node:os';
import pg from 'pg';
import { postgres16TestBin } from './pg-test-bin.js';

export async function localPostgresFixture() {
  if (process.env.NODE_ENV === 'production' || userInfo().uid === 0) throw new Error('Fixture local exige ambiente de teste e usuário não-root');
  const bin = postgres16TestBin();
  const dir = mkdtempSync('/tmp/kytto-pg-');
  const data = join(dir, 'data'), socket = join(dir, 'socket');
  mkdirSync(socket, { mode: 0o700 });
  const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const port = 55000 + process.pid % 1000;
  let started = false;
  const clients = [];
  const run = (command, args) => {
    const result = spawnSync(join(bin, command), args, { env, encoding: 'utf8', timeout: 30000 });
    if (result.error || result.status !== 0) throw new Error(`Fixture local: ${command} falhou: ${result.stderr || result.error?.message}`);
  };
  const close = async () => {
    await Promise.all(clients.map(client => client.end()));
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    run('initdb', ['-D', data, '-U', 'fixture_owner', '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
    run('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-k ${socket} -p ${port} -c listen_addresses='' -c fsync=off`, '-w', 'start']);
    started = true;
    run('createdb', ['-h', socket, '-p', String(port), '-U', 'fixture_owner', 'kytto_fixture_test']);
    return { async connect() {
      const client = new pg.Client({ host: socket, port, database: 'kytto_fixture_test', user: 'fixture_owner', ssl: false });
      await client.connect(); clients.push(client); return client;
    }, close };
  } catch (error) { await close(); throw error; }
}
