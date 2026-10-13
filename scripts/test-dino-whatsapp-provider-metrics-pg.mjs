import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir, userInfo } from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

if (process.env.NODE_ENV === 'production') throw new Error('Executor sintético proibido em produção')
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const bin = '/usr/lib/postgresql/16/bin'
for (const name of ['initdb', 'pg_ctl', 'psql', 'createdb']) {
  if (!existsSync(join(bin, name))) throw new Error('PostgreSQL 16 local é necessário; nenhuma instalação/DSN remota será usada')
}
if (userInfo().uid === 0) throw new Error('Execute como usuário local não-root')
const dir = mkdtempSync(join(tmpdir(), 'dino-whatsapp-provider-pg-'))
const data = join(dir, 'data')
const socket = join(dir, 'socket')
mkdirSync(socket, { mode: 0o700 })
const database = 'dino_whatsapp_provider_test'
const owner = 'dino_whatsapp_provider_fixture_owner'
const reader = 'dino_whatsapp_provider_readonly'
const port = 55434
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
let started = false
function run(name, args, options = {}) {
  const result = spawnSync(join(bin, name), args, { env, cwd: root, encoding: 'utf8', timeout: 90000, ...options })
  if (result.error || result.status !== 0) throw new Error(`${name} falhou na fixture local: ${result.error?.message || result.stderr?.slice(-2000) || result.stdout?.slice(-2000)}`)
  return result
}
try {
  run('initdb', ['-D', data, '-U', owner, '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-k ${socket} -p ${port} -c listen_addresses='' -c fsync=off`, '-w', 'start'])
  started = true
  run('createdb', ['-h', socket, '-p', String(port), '-U', owner, database])
  const setupPath = join(dir, 'provider-fixture.sql')
  writeFileSync(setupPath, `
CREATE TABLE whatsapp_ai_provider_runs (
  id INTEGER PRIMARY KEY,
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  latency_ms INTEGER,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL
);
INSERT INTO whatsapp_ai_provider_runs (id, empresa_id, loja_id, status, latency_ms, criado_em) VALUES
  (1, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 100, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
  (2, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 200, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (3, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 300, CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  (4, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'failed', 400, CURRENT_TIMESTAMP - INTERVAL '4 hours'),
  (5, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'skipped', 0, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  (6, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'failed', -10, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
  (7, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 50, CURRENT_TIMESTAMP - INTERVAL '7 hours'),
  (8, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 9000, CURRENT_TIMESTAMP - INTERVAL '25 hours'),
  (9, '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'success', 50, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (10, '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', 'success', 777, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (11, '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 'skipped', 0, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (12, '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'success', 800, CURRENT_TIMESTAMP + INTERVAL '2 hours'),
  (13, '11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'failed', NULL, CURRENT_TIMESTAMP - INTERVAL '2 hours');
CREATE ROLE dino_whatsapp_provider_readonly LOGIN;
GRANT CONNECT ON DATABASE dino_whatsapp_provider_test TO dino_whatsapp_provider_readonly;
GRANT USAGE ON SCHEMA public TO dino_whatsapp_provider_readonly;
GRANT SELECT ON whatsapp_ai_provider_runs TO dino_whatsapp_provider_readonly;
` , { mode: 0o600 })
  run('psql', ['-h', socket, '-p', String(port), '-U', owner, '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', setupPath])
  const marker = crypto.randomUUID()
  const manifest = join(dir, 'fixture.json')
  writeFileSync(manifest, JSON.stringify({ marker, socket, port, database, owner, reader }), { mode: 0o600 })
  const testEnv = {
    ...env,
    NODE_ENV: 'test',
    DINO_WHATSAPP_PROVIDER_FIXTURE: manifest,
    DINO_WHATSAPP_PROVIDER_FIXTURE_MARKER: marker,
  }
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'app/core/whatsapp-ai-provider-metrics.real.pg.test.js'], { env: testEnv, cwd: root, stdio: 'inherit', timeout: 120000 })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  if (started) {
    const stopped = spawnSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env, encoding: 'utf8', timeout: 30000 })
    if (stopped.status !== 0) {
      console.error('Não foi possível parar a fixture; diretório preservado para diagnóstico local.')
      process.exitCode = 1
    } else {
      rmSync(dir, { recursive: true, force: true })
      console.log('Fixture PostgreSQL própria encerrada e removida.')
    }
  } else rmSync(dir, { recursive: true, force: true })
}
