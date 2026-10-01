import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const url = process.env.COMMERCE_USER_DIRECTORY_TEST_DATABASE_URL;
const enabled = Boolean(url && /(?:localhost|127\.0\.0\.1|\/var\/run\/postgresql)/.test(url) && /user_directory_test/.test(url));

async function call(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

test('HTTP/PG real: diretório nega troca de tenant/loja e não retorna documentos', { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString: url, ssl: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-user-directory-'));
  const dbPath = path.join(dir, 'db.json');
  const password = 'senha-sintetica-123';
  const hash = bcrypt.hashSync(password, 4);
  const a = randomUUID(); const b = randomUUID(); const storeA = randomUUID(); const storeB = randomUUID();
  const email = 'tenant-directory@example.invalid';
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 10, usuarios: [
    { id: 1, nome: 'Admin Local', email: 'global-directory@example.invalid', senhaHash: hash, role: 'admin', ativo: true },
    { id: 2, nome: 'Gestor Local', email, senhaHash: hash, role: 'admin', ativo: true, empresaId: a, lojaId: storeA },
    { id: 3, nome: 'Conta Legada B', email: 'legacy-b@example.invalid', senhaHash: hash, role: 'staff', ativo: false, empresaId: b, lojaId: storeB },
  ] }));
  let processServer;
  try {
    const createTenant = (id, cnpj, name) => pool.query(
      'INSERT INTO empresas (id, nome, razao_social, cnpj, tipo_negocio) VALUES ($1,$2,$2,$3,$4)',
      [id, name, cnpj, 'outro'],
    );
    const cnpj = () => `9${randomInt(10 ** 12, 10 ** 13)}`;
    await createTenant(a, cnpj(), 'Empresa Teste A');
    await createTenant(b, cnpj(), 'Empresa Teste B');
    await pool.query('INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)', [storeA, a, 'unit-a', 'Unidade A', storeB, b, 'unit-b', 'Unidade B']);
    const ownerRole = (await pool.query("SELECT id FROM commerce_roles WHERE empresa_id IS NULL AND codigo = 'tenant_owner'")).rows[0].id;
    const users = [];
    for (const [company, personEmail, store] of [[a, email, storeA], [b, email, storeB], [b, 'only-b@example.invalid', storeB]]) {
      const id = randomUUID(); users.push(id);
      await pool.query("INSERT INTO usuarios (id, empresa_id, nome_completo, email, senha_hash, role, cpf) VALUES ($1,$2,'Pessoa Sintética',$3,'not-a-real-password','admin',NULL)", [id, company, personEmail]);
      await pool.query('INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id) VALUES ($1,$2,$3,$4)', [company, id, store, ownerRole]);
    }
    const port = 33200 + Math.floor(Math.random() * 500);
    const base = `http://127.0.0.1:${port}`;
    processServer = spawn(process.execPath, ['server.js'], { cwd: path.resolve('app'), env: {
      ...process.env, PORT: String(port), NODE_ENV: 'development', DB_PATH: dbPath,
      DATABASE_URL: url, DB_SSL: 'false', COMMERCE_CORE_ENABLED: '1', SEED_DEMO: '0',
      JWT_SECRET: 'user-directory-local-only', ADMIN_USER: 'global-directory@example.invalid',
      PLATFORM_ADMIN_EMAILS: 'global-directory@example.invalid', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '',
    }, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (processServer.exitCode !== null) throw new Error('local server exited');
      try { if ((await call(base, '/api/info')).status === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'servidor local iniciou');
    const login = async (user) => {
      const answer = await call(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user, pass: password }) });
      assert.equal(answer.status, 200);
      return { Authorization: `Bearer ${answer.data.token}` };
    };
    const tenant = await login(email);
    const global = await login('global-directory@example.invalid');
    const tenantDirectory = await call(base, '/api/admin/usuarios-diretorio', { headers: tenant });
    assert.equal(tenantDirectory.status, 200);
    assert.equal(tenantDirectory.data.usuarios.length, 2, 'uma conta JSON e uma conta SQL da unidade A');
    assert.equal(tenantDirectory.data.usuarios.some(user => user.email === 'only-b@example.invalid'), false);
    assert.ok(tenantDirectory.data.usuarios.every(user => user.cpf === undefined && user.senhaHash === undefined));
    const spoofTenant = await call(base, '/api/admin/usuarios-diretorio', { headers: { ...tenant, 'X-Empresa-Id': b, 'X-Loja-Id': storeB } });
    assert.equal(spoofTenant.status, 403);
    const spoofStore = await call(base, '/api/admin/usuarios-diretorio', { headers: { ...tenant, 'X-Loja-Id': storeB } });
    assert.notEqual(spoofStore.status, 200);
    const globalDirectory = await call(base, '/api/admin/usuarios-diretorio', { headers: global });
    assert.equal(globalDirectory.status, 200);
    assert.equal(globalDirectory.data.usuarios.filter(item => [a, b].includes(item.empresaId)).length, 5, 'três SQL e duas JSON com empresa, incluindo inativos');
  } finally {
    processServer?.kill('SIGTERM');
    await pool.query('DELETE FROM empresas WHERE id = ANY($1::uuid[])', [[a, b]]).catch(() => {});
    await pool.end();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
