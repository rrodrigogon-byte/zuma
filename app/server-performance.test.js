import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('HTTP real: métricas só para administração da plataforma, sem cache nem parâmetros pessoais', async () => {
  const dir = fs.mkdtempSync('/tmp/kytto-metrics-');
  const file = path.join(dir, 'db.json'), port = 37000 + process.pid % 1000;
  const password = 'fixture-local-metrics';
  const senhaHash = bcrypt.hashSync(password, 4);
  fs.writeFileSync(file, JSON.stringify({ usuarios: [
    { id: 1, nome: 'Admin', email: 'admin@fixture.invalid', senhaHash, role: 'admin', ativo: true, platformAdmin: true },
    { id: 2, nome: 'Empresa', email: 'tenant@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
  ] }));
  const proc = spawn(process.execPath, ['app/server.js'], { cwd: new URL('..', import.meta.url), env: {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', DB_PATH: file, PORT: String(port), JWT_SECRET: 'local-metrics-jwt',
    COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', GEMINI_API_KEY: '',
  }, stdio: 'ignore' });
  const request = async (route, token, body) => fetch(`http://127.0.0.1:${port}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (proc.exitCode !== null) throw new Error('Servidor local encerrou');
      try { ready = (await request('/api/info')).status === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true);
    const login = async user => (await (await request('/api/admin/login', '', { user, pass: password })).json()).token;
    const admin = await login('admin@fixture.invalid'), tenant = await login('tenant@fixture.invalid');
    const upload = '/api/admin/barbearia/avec-mix/preview';
    assert.equal((await request('/api/admin/barbearia/avec-mix/report')).status, 401);
    assert.equal((await request('/api/admin/barbearia/avec-mix/report', tenant)).status, 400);
    const largeBody = { report: 'x'.repeat(1100000) };
    assert.equal((await request(upload, '', largeBody)).status, 401);
    assert.equal((await request(upload, tenant, largeBody)).status, 403);
    const invalidUpload = await request(upload, admin, { report: {} });
    assert.equal(invalidUpload.status, 400);
    assert.match(invalidUpload.headers.get('cache-control'), /no-store/);
    const endpoint = '/api/admin/platform/performance';
    assert.equal((await request(endpoint)).status, 401);
    assert.equal((await request(endpoint, tenant)).status, 403);
    const response = await request(`${endpoint}?cliente=SEGREDO`, admin);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.ok(result.requests.routes.length);
    assert.equal(JSON.stringify(result).includes('SEGREDO'), false);
  } finally {
    proc.kill('SIGTERM');
    if (proc.exitCode === null) await once(proc, 'exit');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
