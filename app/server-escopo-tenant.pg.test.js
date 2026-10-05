// Escopo de empresa decidido no servidor (PostgreSQL real): dono de empresa que entra por
// /api/auth/login não vira administrador da plataforma, e-mails de administração não podem
// ser cadastrados, módulos globais ficam fechados para empresas e conta desativada perde o
// acesso na hora. Roda com SERVER_SCOPE_TEST_DATABASE_URL apontando para um banco descartável
// com as migrations aplicadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  await vincular(empB, 'admin');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escopo-'));
  const dbPath = path.join(dir, 'db.json');
  const mailStub = path.join(dir, 'mail-stub.mjs');
  fs.writeFileSync(mailStub, `const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  if (String(url) === 'https://api.resend.com/emails') {
    const payload = JSON.parse(options.body);
    return Promise.resolve({ ok: true, json: async () => payload.to[0].startsWith('ambiguous-') ? {} : { id: 'local-mock-id' } });
  }
  return originalFetch(url, options);
};\n`);
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
  let providerState = 'open';
  const provider = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method !== 'GET' || req.url !== '/api/v1/whats-app/instances/local-mock/status') {
      res.writeHead(404).end('{}'); return;
    }
    res.writeHead(200).end(JSON.stringify({ state: providerState }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const providerUrl = `http://127.0.0.1:${provider.address().port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: APP,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'escopo-jwt', COMMERCE_CORE_ENABLED: '1', OPERATIONAL_INVITES_ENABLED: '1', RESEND_API_KEY: 'local-test-not-real', EMAIL_FROM: 'Local Test <test@example.invalid>', NODE_OPTIONS: `--import=${mailStub}`, DATABASE_URL: DSN, DB_SSL: 'false', ADMIN_USER: 'admin', PLATFORM_ADMIN_EMAILS: 'boss@plat.test', SEED_DEMO: '0', WHATSAPP_CONNECTION_WATCHDOG: 'false', WPP_BASE_URL: 'http://127.0.0.1:1', WPP_APIKEY: 'local-only-no-network', WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_URL: providerUrl, CHATBOT_BACKEND_INSTANCE: 'local-mock', CHATBOT_BACKEND_KEY: 'local-status-check-only-key', AI_AUTOMATION_SCHEDULER: 'false', AI_LEARNING_SCHEDULER: 'false' },
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
    const claims = jwt.verify(donoPainel.Authorization.slice(7), 'escopo-jwt');
    for (const modified of [{ empresaId: empB }, { empresaId: empA, lojaId: crypto.randomUUID() }]) {
      const forged = { Authorization: `Bearer ${jwt.sign({ ...claims, ...modified }, 'escopo-jwt')}` };
      const denied = await request(base, '/api/admin/barbearia/servicos', { headers: forged });
      assert.equal(denied.response.status, 401, 'empresa ou unidade do token não pode furar a membership');
      assert.equal(denied.body.code, 'SESSION_REVOKED');
    }
    await client.query(`UPDATE commerce_memberships SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
      WHERE empresa_id = $1 AND usuario_id = (SELECT id FROM usuarios WHERE empresa_id = $1 AND email = $2)`, [empA, dono]);
    const vencido = await request(base, '/api/admin/barbearia/servicos', { headers: donoPainel });
    assert.equal(vencido.response.status, 401);
    assert.equal(vencido.body.code, 'SESSION_REVOKED');
    assert.equal((await request(base, '/api/admin/barbearia/servicos', { headers: donoSite })).response.status, 401);
    await client.query(`UPDATE commerce_memberships SET expires_at = NULL, ativo = false
      WHERE empresa_id = $1 AND usuario_id = (SELECT id FROM usuarios WHERE empresa_id = $1 AND email = $2)`, [empA, dono]);
    assert.equal((await request(base, '/api/admin/barbearia/servicos', { headers: donoPainel })).response.status, 401);
    await client.query(`UPDATE commerce_memberships SET ativo = true
      WHERE empresa_id = $1 AND usuario_id = (SELECT id FROM usuarios WHERE empresa_id = $1 AND email = $2)`, [empA, dono]);
    assert.equal((await request(base, '/api/admin/barbearia/servicos', { headers: donoPainel })).response.status, 200);

    // 3) E-mail de administração da plataforma não pode ser cadastrado.
    assert.equal((await request(base, '/api/auth/register', { method: 'POST', body: JSON.stringify({ nome: 'X', email: 'Boss@Plat.test', senha: 'abcdef1' }) })).response.status, 409);
    assert.equal((await request(base, '/api/auth/registro', { method: 'POST', body: JSON.stringify({ nome: 'X', email: 'boss@plat.test', senha: 'abcdef1' }) })).response.status, 409);
    assert.equal((await request(base, '/api/admin/usuarios', { method: 'POST', headers: donoPainel, body: JSON.stringify({ nome: 'X', email: 'boss@plat.test', senha: 'abcdef1', role: 'admin' }) })).response.status, 409);
    assert.equal((await request(base, '/api/admin/platform/commerce-tenants', { headers: donoPainel })).response.status, 403);

    // 4) Admin principal com vínculo numa empresa continua com os módulos do evento.
    const admin = await painelLogin('admin');
    const config = await request(base, '/api/admin/inscricoes', { headers: admin });
    assert.equal(config.response.status, 200, 'admin principal não perde inscrições');
    const globalLegacy = await request(base, '/api/admin/barbearia/integracoes', { headers: admin });
    assert.equal(globalLegacy.response.status, 200);
    assert.equal(globalLegacy.body.whatsapp.envioManualDisponivel, true, 'admin global sem unidade preserva WPP legado');
    for (const selectedEmpresa of [empA, empB]) {
      const allowed = await request(base, '/api/admin/barbearia/servicos', {
        headers: { ...admin, 'X-Empresa-Id': selectedEmpresa },
      });
      assert.equal(allowed.response.status, 200, 'admin principal global mantém escopo tenant autorizado mesmo com SQL homônimo');
    }

    const lojaComCanal = (await client.query(`INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1, $2, $3) RETURNING id`,
      [empA, `teste-${suffix}`, `Barbearia sintética ${suffix}`])).rows[0].id;
    await client.query(`INSERT INTO canais_integracao
      (empresa_id, loja_id, provedor, nome, status, configuracao)
      VALUES ($1, $2, 'whatsapp', 'Canal sintético', 'ativo', '{"instance":"local-mock"}'::jsonb)`,
    [empA, lojaComCanal]);
    const adminDaUnidade = { ...admin, 'X-Empresa-Id': empA, 'X-Loja-Id': lojaComCanal };
    const estado = await request(base, '/api/admin/barbearia/integracoes', { headers: adminDaUnidade });
    assert.equal(estado.response.status, 200);
    assert.equal(estado.body.whatsapp.ai.channel.status, 'ativo');
    assert.equal(estado.body.whatsapp.ai.connection.state, 'open', 'instância local corresponde ao canal autorizado');
    assert.deepEqual(Object.keys(estado.body.whatsapp.ai.connection).sort(), ['checkedAt', 'state']);
    providerState = 'close';
    const desconectado = await request(base, '/api/admin/barbearia/integracoes', { headers: adminDaUnidade });
    assert.equal(desconectado.body.whatsapp.ai.connection.state, 'close', 'desconexão live não fica verde por cache de configuração');
    await client.query(`UPDATE canais_integracao SET configuracao = '{"instance":"other-instance"}'::jsonb
      WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp'`, [empA, lojaComCanal]);
    const outraInstancia = await request(base, '/api/admin/barbearia/integracoes', { headers: adminDaUnidade });
    assert.equal(outraInstancia.body.whatsapp.ai.connection.state, 'unknown', 'instância diferente não herda estado de outra linha');
    assert.equal(estado.body.whatsapp.envioManualDisponivel, false, 'WPP legado não substitui canal Commerce da unidade');
    const overview = await request(base, '/api/admin/barbearia/overview', { headers: adminDaUnidade });
    assert.equal(overview.response.status, 200);
    assert.equal(overview.body.integracoes.whatsapp.ai.channel.status, 'ativo');
    assert.equal(overview.body.integracoes.whatsapp.envioManualDisponivel, false);
    const tentativaLegada = await request(base, '/api/admin/barbearia/whatsapp/enviar', {
      method: 'POST', headers: adminDaUnidade, body: JSON.stringify({ confirmado: true }),
    });
    assert.equal(tentativaLegada.response.status, 409, 'bloqueado antes de qualquer egress');
    assert.equal(tentativaLegada.body.code, 'WHATSAPP_LEGACY_SCOPE_DENIED');

    // O endpoint real deve aceitar status='active', negar tenant/draft e só confirmar
    // e-mail se o emissor local retornar um ID explícito; nada chega ao Resend.
    await client.query(`INSERT INTO commerce_storefronts (empresa_id, codigo, nome, status)
      VALUES ($1, 'dino-web', 'Dino teste', 'active')`, [empA]);
    const convite = (empresaId, email) => request(base, '/api/admin/operational-invites', {
      method: 'POST', headers: admin,
      body: JSON.stringify({ empresaId, nome: 'Operador Sintético', email, role: 'store_admin' }),
    });
    assert.equal((await request(base, '/api/admin/operational-invites', {
      method: 'POST', headers: donoPainel,
      body: JSON.stringify({ empresaId: empA, nome: 'Operador Sintético', email: 'denied@example.invalid', role: 'store_admin' }),
    })).response.status, 403);
    assert.equal((await convite(empB, 'outro@example.invalid')).response.status, 404);
    await client.query(`UPDATE commerce_storefronts SET status = 'draft' WHERE empresa_id = $1`, [empA]);
    assert.equal((await convite(empA, 'draft@example.invalid')).response.status, 404);
    await client.query(`UPDATE commerce_storefronts SET status = 'active' WHERE empresa_id = $1`, [empA]);
    const enviado = await convite(empA, 'invite-ok@example.invalid');
    assert.equal(enviado.response.status, 202, JSON.stringify(enviado.body));
    assert.deepEqual(enviado.body, { ok: true, status: 'sent' });
    const ambiguo = await convite(empA, 'ambiguous-invite@example.invalid');
    assert.equal(ambiguo.response.status, 503);
    assert.ok(!JSON.stringify(ambiguo.body).includes('ambiguous-invite@example.invalid'));
    const invites = await client.query(`SELECT email_norm, status FROM commerce_operational_invites WHERE empresa_id = $1 ORDER BY email_norm`, [empA]);
    assert.deepEqual(invites.rows, [
      { email_norm: 'ambiguous-invite@example.invalid', status: 'revoked' },
      { email_norm: 'invite-ok@example.invalid', status: 'sent' },
    ]);

    // 5) Mesmo e-mail em dois usuarios SQL diferentes: JWT legado não prova
    // nenhuma das identidades; nem um header de seleção pode decidir por ele.
    const multiSite = await siteLogin(multi);
    const servicos = await request(base, '/api/admin/barbearia/servicos', { headers: multiSite });
    assert.equal(servicos.response.status, 401);
    assert.equal(servicos.body.code, 'SESSION_REVOKED');
    for (const selectedEmpresa of [empA, empB]) {
      const ambiguous = await request(base, '/api/admin/barbearia/servicos', {
        headers: { ...multiSite, 'X-Empresa-Id': selectedEmpresa },
      });
      assert.equal(ambiguous.response.status, 401, 'e-mail homônimo não seleciona identidade de outro tenant');
      assert.equal(ambiguous.body.code, 'SESSION_REVOKED');
    }
    assert.equal((await request(base, '/api/admin/cupons', { headers: multiSite })).response.status, 401);

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
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
    await client.query(`DELETE FROM commerce_operational_invites WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM commerce_storefronts WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM commerce_memberships WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM usuarios WHERE empresa_id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.query(`DELETE FROM empresas WHERE id = ANY($1::uuid[])`, [[empA, empB]]).catch(() => {});
    await client.end();
  }
});
