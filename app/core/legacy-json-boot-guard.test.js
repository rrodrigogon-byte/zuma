import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { assertDurableLegacyJson } from './legacy-json-boot-guard.js';

const admin = { id: 1, role: 'admin', ativo: true, email: 'fixture@example.invalid', senhaHash: 'fixture-hash' };
function disk({ mount = true, primary = { usuarios: [admin] }, backup,
  link, target = '/var/data/db.json' } = {}) {
  const files = new Map();
  if (primary !== null) files.set('/var/data/db.json', JSON.stringify(primary));
  if (backup !== undefined) files.set('/var/data/db.json.bak', JSON.stringify(backup));
  const missing = () => Object.assign(new Error('missing'), { code: 'ENOENT' });
  return {
    readFileSync: p => {
      if (p === '/proc/self/mountinfo') return mount ? '0 0 0:1 / /var/data rw - ext4 /dev/sda rw\n' : '0 0 0:1 / / rw - ext4 /dev/sda rw\n';
      if (!files.has(p)) throw missing();
      return files.get(p);
    },
    lstatSync: p => {
      if (!files.has(p) && p !== link) throw missing();
      return { isFile: () => true, isSymbolicLink: () => p === link };
    },
    realpathSync: p => p === '/var/data' ? p : target,
  };
}
const renderEnv = { NODE_ENV: 'production', RENDER: 'true', GCS_BUCKET: '', DB_PATH: '/var/data/db.json' };
const failsClosed = (env, io) => assert.throws(() => assertDurableLegacyJson({ env, io }), { message: 'LEGACY_DB_DURABILITY_REQUIRED' });

test('Render requer arquivo principal íntegro com conta admin ativa em disco montado', () => {
  assert.equal(assertDurableLegacyJson({ env: renderEnv, io: disk() }), true);
  failsClosed({ ...renderEnv, DB_PATH: '' }, disk());
  failsClosed({ ...renderEnv, DB_PATH: 'app/data/db.json' }, disk());
  failsClosed({ ...renderEnv, DB_PATH: '/var/data/../tmp/db.json' }, disk());
  failsClosed(renderEnv, disk({ mount: false }));
  failsClosed(renderEnv, disk({ primary: null, backup: { usuarios: [admin] } }));
  failsClosed(renderEnv, disk({ primary: { usuarios: [] } }));
  failsClosed(renderEnv, disk({ primary: { usuarios: [{}] }, backup: { usuarios: [admin] } }));
  failsClosed(renderEnv, disk({ primary: { usuarios: [{ ...admin, ativo: false }] } }));
  failsClosed(renderEnv, disk({ target: '/tmp/db.json' }));
  failsClosed(renderEnv, disk({ link: '/var/data/db.json.bak', backup: { usuarios: [admin] } }));
  failsClosed(renderEnv, disk({ link: '/var/data/db.json.tmp' }));
});

test('ambiente local e runtime GCS mantêm contratos anteriores', () => {
  assert.equal(assertDurableLegacyJson({ env: { ...renderEnv, RENDER: undefined, DB_PATH: '' }, io: disk({ mount: false }) }), true);
  assert.equal(assertDurableLegacyJson({ env: { ...renderEnv, NODE_ENV: 'test', DB_PATH: '' }, io: disk({ mount: false }) }), true);
  assert.equal(assertDurableLegacyJson({ env: { ...renderEnv, GCS_BUCKET: 'configured', DB_PATH: '' }, io: disk({ mount: false }) }), true);
});

test('importação real de db.js falha antes de criar usuário quando Render perdeu DB_PATH', () => {
  const proc = spawnSync(process.execPath, ['--input-type=module', '-e', 'import("./app/db.js")'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, RENDER: 'true', NODE_ENV: 'production', DB_PATH: '', GCS_BUCKET: '' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.notEqual(proc.status, 0);
  assert.match(proc.stderr, /LEGACY_DB_DURABILITY_REQUIRED/);
});
