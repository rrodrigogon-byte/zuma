// Escopo de empresa decidido no servidor (PostgreSQL real): dono de empresa que entra por
// /api/auth/login não vira administrador da plataforma, e-mails de administração não podem
// ser cadastrados, módulos globais ficam fechados para empresas e conta desativada perde o
// acesso na hora. Roda com SERVER_SCOPE_TEST_DATABASE_URL apontando para um banco descartável
// com as migrations aplicadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DSN = process.env.SERVER_SCOPE_TEST_DATABASE_URL;
const APP = path.dirname(fileURLToPath(import.meta.url));
const SENHA = 'senha-teste-123';

async function request(base, url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...headers }, body });
  const text = await response.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { response, body: parsed };
}

async function aguardar(base, processo) {
  for (let i = 0; i < 100; i += 1) {
    if (processo.exitCode !== null) throw new Error('servidor saiu no boot');
    try { const r = await fetch(`${base}/api/info`); if (r.ok) return; } catch { /* ainda subindo */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('servidor não subiu');
}

test('escopo de empresa, e-mails reservados, módulos globais e revogação', { skip: !DSN && 'defina SERVER_SCOPE_TEST_DATABASE_URL' }, async () => {
  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  const suffix = crypto.randomBytes(4).toString('hex');
  const role = (await client.query(`SELECT id FROM commerce_roles WHERE codigo = 'tenant_owner' LIMIT 1`)).rows[0].id;
  const empresa = async nome => (await client.query(
    `INSERT INTO empresas (nome, cnpj, razao_social, tipo_negocio, ativa) VALUES ($1, $2, $1, 'barbearia', true) RETURNING id`,
    [`${nome} ${suffix}`, `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-14).padStart(14, '1')],
  )).rows[0].id;
  const vincular = async (empresaId, email) => {
    const usuario = (await client.query(
      `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo) VALUES ($1, $2, 'x', $2, 'admin', true) RETURNING id`,
      [empresaId, email],
    )).rows[0].id;
    await client.query(`INSERT INTO commerce_memberships (empresa_id, usuario_id, role_id, ativo) VALUES ($1, $2, $3, true)`, [empresaId, usuario, role]);
  };
  const empA = await empresa('Loja A');
  const empB = await empresa('Loja B');
  const dono = `dono-${suffix}@dino.test`;
  const multi = `multi-${suffix}@dino.test`;
  await vincular(empA, dono);
  await vincular(empA, multi);
  await vincular(empB, multi);
  await vincular(empA, 'admin');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escopo-'));
  const dbPath = path.join(dir, 'db.json');
  const hash = bcrypt.hashSync(SENHA, 4);
  const u = (id, email, roleName) => ({ id, nome: `U${id}`, email, senhaHash: hash, role: roleName, ativo: true });
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 50,
    usuarios: [u(1, 'admin', 'admin'), u(2, dono, 'admin'), u(3, multi, 'admin'), u(4, 'evento@setpoint.test', 'organizador'), u(5, 'sem-vinculo@dino.test', 'staff')],
    lancamentos: [{ id: 7, tipo: 'receita', valor: 100, descricao: 'evento', status: 'pendente', vencimento: '2026-01-01' }],
    pagamentos: [{ id: 11, tipo: 'loja', valor: 10, status: 'pendente' }],
  }));
  const port = 34000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: APP,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'escopo-jwt', COMMERCE_CORE_ENABLED: '1', DATABASE_URL: DSN, DB_SSL: 'false', ADMIN_USER: 'admin', PLATFORM_ADMIN_EMAILS: 'boss@plat.test', SEED_DEMO: '0', WHATSAPP_CONNECTION_WATCHDOG: 'false', AI_AUTOMATION_SCHEDULER: 'false', AI_LEARNING_SCHEDULER: 'false' },
    stdio: 'ignore',
  });
  try {
    await aguardar(base, processo);
    const siteLogin = async email => ({ Authorization: `Bearer ${(await request(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha: SENHA }) })).body.token}` });
    const painelLogin = async email => ({ Authorization: `Bearer ${(await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: email, pass: SENHA }) })).body.token}` });

    // 1) Token do site (sem empresaId) do dono da empresa não vira acesso global.
    const donoSite = await siteLogin(dono);
    const usuarios = await request(base, '/api/admin/usuarios', { headers: donoSite });
    assert.equal(usuarios.response.status, 200);
    assert.ok(!usuarios.body.some(item => item.email === 'admin' || item.email === 'evento@setpoint.test'), 'não lista contas globais');
    const reset = await request(base, '/api/admin/usuarios/1/reset-senha', { method: 'POST', headers: donoSite, body: '{}' });
    assert.notEqual(reset.response.status, 200, 'não reseta a senha do admin principal');
    assert.equal((await request(base, '/api/admin/financeiro/lancamentos', { headers: donoSite })).response.status, 403);

    // 2) Módulos globais negados por padrão para empresa (inclusive com o token do painel).
    const donoPainel = await painelLogin(dono);
    for (const [method, url] of [['POST', '/api/admin/carteira'], ['POST', '/api/admin/cupons'], ['DELETE', '/api/admin/torneios/1'], ['PATCH', '/api/admin/pagamentos/11'], ['GET', '/api/admin/inscricoes'], ['GET', '/api/admin/loja/pedidos']]) {
      const result = await request(base, url, { method, headers: donoPainel, body: method === 'GET' ? undefined : '{}' });
      assert.equal(result.response.status, 403, `${method} ${url}`);
      assert.equal(result.body.code, 'TENANT_USE_SCOPED_MODULE');
    }
    const notif = await request(base, '/api/admin/notificacoes', { headers: donoPainel });
    assert.deepEqual(notif.body, { notificacoes: [], total: 0 });
    assert.equal((await request(base, '/api/admin/barbearia/servicos', { headers: donoPainel })).response.status, 200, 'módulo da empresa continua liberado');

    // 3) E-mail de administração da plataforma não pode ser cadastrado.
    assert.equal((await request(base, '/api/auth/register', { method: 'POST', body: JSON.stringify({ nome: 'X', email: 'Boss@Plat.test', senha: 'abcdef1' }) })).response.status, 409);
    assert.equal((await request(base, '/api/auth/registro', { method: 'POST', body: JSON.stringify({ nome: 'X', email: 'boss@plat.test', senha: 'abcdef1' }) })).response.status, 409);
    assert.equal((await request(base, '/api/admin/usuarios', { method: 'POST', headers: donoPainel, body: JSON.stringify({ nome: 'X', email: 'boss@plat.test', senha: 'abcdef1', role: 'admin' }) })).response.status, 409);
    assert.equal((await request(base, '/api/admin/platform/commerce-tenants', { headers: donoPainel })).response.status, 403);

    // 4) Admin principal com vínculo numa empresa continua com os módulos do evento.
    const admin = await painelLogin('admin');
    const config = await request(base, '/api/admin/inscricoes', { headers: admin });
    assert.equal(config.response.status, 200, 'admin principal não perde inscrições');

    // 5) Vínculo com duas empresas: precisa escolher a empresa; nunca cai na principal.
    const multiSite = await siteLogin(multi);
    const servicos = await request(base, '/api/admin/barbearia/servicos', { headers: multiSite });
    assert.equal(servicos.response.status, 409);
    assert.equal(servicos.body.code, 'EMPRESA_REQUIRED');
    assert.equal((await request(base, '/api/admin/cupons', { headers: multiSite })).response.status, 403);

    const semVinculo = await siteLogin('sem-vinculo@dino.test');
    const semEmpresa = await request(base, '/api/admin/barbearia/servicos', { headers: semVinculo });
    assert.equal(semEmpresa.response.status, 409, 'staff sem membership não cai na empresa principal');
    assert.equal(semEmpresa.body.code, 'EMPRESA_REQUIRED');

    // 6) Conta desativada perde o acesso na hora; papel rebaixado vale já.
    const evento = await painelLogin('evento@setpoint.test');
    assert.equal((await request(base, '/api/admin/inscricoes', { headers: evento })).response.status, 200);
    const desativar = await request(base, '/api/admin/usuarios/4', { method: 'PATCH', headers: admin, body: JSON.stringify({ ativo: false }) });
    assert.equal(desativar.response.status, 200, JSON.stringify(desativar.body));
    const depois = await request(base, '/api/admin/inscricoes', { headers: evento });
    assert.equal(depois.response.status, 401);
    assert.equal(depois.body.code, 'SESSION_REVOKED');
  } finally {
    processo.kill('SIGTERM');
    await client.query(`DELETE FROM commerce_memberships WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM usuarios WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM empresas WHERE id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.end();
  }
});
