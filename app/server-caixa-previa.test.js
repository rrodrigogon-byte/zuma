import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const senha = 'fixture-preview-only';

test('HTTP real: prévia exige gestão e unidade, compara só empresa autorizada e não grava configurações/financeiro', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-caixa-preview-'));
  const file = path.join(dir, 'db.json');
  const port = 33100 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const senhaHash = bcrypt.hashSync(senha, 4);
  fs.writeFileSync(file, JSON.stringify({ seq: 10, usuarios: [
    { id: 1, nome: 'Fixture A', email: 'a@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
    { id: 2, nome: 'Fixture B', email: 'b@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-b', lojaId: 'unit-b' },
    { id: 3, nome: 'Fixture Staff', email: 'staff@fixture.invalid', senhaHash, role: 'staff', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
  ] }));
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.join(ROOT, 'app'), env: {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', NODE_ENV: 'test', DB_PATH: file, PORT: String(port), JWT_SECRET: 'fixture-preview-jwt-only', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', GEMINI_API_KEY: '',
  }, stdio: 'ignore' });
  const req = async (route, body, token) => {
    const res = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json().catch(() => ({})) };
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { if (proc.exitCode !== null) throw new Error('Servidor de fixture encerrou.'); try { ready = (await req('/api/info')).status === 200; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 120)); }
    assert.equal(ready, true);
    const login = async user => { const r = await req('/api/admin/login', { user, pass: senha }); assert.equal(r.status, 200); return r.body.token; };
    const a = await login('a@fixture.invalid');
    const b = await login('b@fixture.invalid');
    const staff = await login('staff@fixture.invalid');
    const created = await req('/api/admin/barbearia/servicos', { nome: 'Servico fixture A', preco: 100, duracaoMinutos: 30, custoMaterial: 1 }, a);
    assert.equal(created.status, 201);
    const service = created.body.servico.id;
    const endpoint = '/api/admin/barbearia/caixa/previa-taxas-materiais';
    const payload = { empresaId: 'tenant-a', lojaId: 'unit-a', idempotencyKey: 'fixture-preview-1', taxas: [{ meio: 'pix', percentual: 2, fonte: 'fixture' }], materiais: [{ servicoId: service, quantidade: 1, unidade: 'un', custoUnitario: 1, fonte: 'fixture' }], simulacoes: [{ servicoId: service, bruto: 100, meio: 'pix' }] };
    const businessState = () => { const data = JSON.parse(fs.readFileSync(file, 'utf8')); delete data.auditoria; delete data.seq; return data; };
    const before = businessState();
    assert.equal((await req(endpoint, payload)).status, 401);
    assert.equal((await req(endpoint, payload, staff)).status, 403);
    const first = await req(endpoint, payload, a);
    assert.equal(first.status, 200);
    assert.equal(first.cache, 'no-store');
    assert.deepEqual(first.body.escopo, { empresaId: 'tenant-a', lojaId: 'unit-a' });
    assert.equal(first.body.somenteLeitura, true);
    assert.equal(first.body.gravacaoAplicada, false);
    assert.equal(first.body.linhas[0].liquido, 97);
    assert.equal(first.body.linhas[0].conciliado, false);
    assert.equal((await req(endpoint, payload, a)).body.idempotente, true);
    assert.equal((await req(endpoint, { ...payload, simulacoes: [{ servicoId: service, bruto: 101, meio: 'pix' }] }, a)).status, 409);
    assert.equal((await req(endpoint, payload, b)).status, 409);
    assert.equal((await req(endpoint, { ...payload, lojaId: 'unit-b' }, a)).status, 409);
    const foreign = await req(endpoint, { ...payload, idempotencyKey: 'fixture-foreign', simulacoes: [{ servicoId: 'foreign-service', bruto: 100, meio: 'pix' }] }, a);
    assert.equal(foreign.status, 409);
    assert.equal(foreign.body.code, 'SERVICE_SCOPE_MISMATCH');
    assert.deepEqual(businessState(), before);
    assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).auditoria.some(item => item.acao === `POST ${endpoint}`));
  } finally {
    proc.kill('SIGTERM');
    await Promise.race([once(proc, 'exit'), new Promise(r => setTimeout(r, 3000))]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
