import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DSN = process.env.PLATFORM_GRANTS_SERVER_TEST_DATABASE_URL;
const APP = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = 'Senha-Local-Forte-123!';
const testDsn = DSN ? new URL(DSN) : null;
const enabled = Boolean(testDsn && ['localhost', '127.0.0.1', '::1'].includes(testDsn.hostname) && /test/.test(testDsn.pathname));

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { response, body: await response.json().catch(() => ({})) };
}

async function waitForServer(base, child) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`server.js encerrou durante o boot: ${child.exitCode}`);
    try {
      const { response } = await request(base, '/api/info');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('timeout aguardando server.js');
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function syntheticCnpj(sequence) {
  return `9${String(sequence).replace(/\D/g, '').padStart(13, '0').slice(-13)}`;
}

async function login(base, email, expectedStatus = 200) {
  const result = await request(base, '/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ user: email, pass: PASSWORD }),
  });
  assert.equal(result.response.status, expectedStatus, `${email}: ${JSON.stringify(result.body)}`);
  return result;
}

test('PostgreSQL real: grant global, identidade canônica, isolamento live, expiração e revogação', { skip: !enabled && 'defina PLATFORM_GRANTS_SERVER_TEST_DATABASE_URL' }, async () => {
  const sql = new pg.Client({ connectionString: DSN, ssl: false });
  await sql.connect();
  const suffix = crypto.randomBytes(7).toString('hex');
  const hash = bcrypt.hashSync(PASSWORD, 4);
  const companies = [];
  const stores = [];
  const users = [];
  const invites = [];
  let accountId = null;
  let expiredAccountId = null;
  let child;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-grants-server-'));
  const dbPath = path.join(dir, 'db.json');
  const port = 35400 + Math.floor(Math.random() * 250);
  const base = `http://127.0.0.1:${port}`;

  const company = async (label, number) => {
    const row = (await sql.query(
      `INSERT INTO empresas (nome, cnpj, razao_social, tipo_negocio, ativa)
       VALUES ($1, $2, $1, 'outro', true) RETURNING id`,
      [`Grant ${label} ${suffix}`, syntheticCnpj(`${Date.now()}${number}${suffix}`)],
    )).rows[0];
    companies.push(row.id);
    return row.id;
  };
  const store = async (empresaId, code, name) => {
    const row = (await sql.query(
      `INSERT INTO lojas (empresa_id, codigo, nome, ativa) VALUES ($1, $2, $3, true) RETURNING id`,
      [empresaId, `${code}-${suffix}`, name],
    )).rows[0];
    stores.push(row.id);
    return row.id;
  };
  const localUser = async (empresaId, email, name, role = 'gerente') => {
    const row = (await sql.query(
      `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [empresaId, email, hash, name, role],
    )).rows[0];
    users.push(row.id);
    return row.id;
  };
  const membership = async (empresaId, usuarioId, roleCode, lojaId = null) => {
    const row = (await sql.query(
      `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
       SELECT $1, $2, $3, id, true FROM commerce_roles
        WHERE empresa_id IS NULL AND codigo = $4 LIMIT 1
       RETURNING id`,
      [empresaId, usuarioId, lojaId, roleCode],
    )).rows[0];
    assert.ok(row, `role ${roleCode} seed ausente`);
    return row.id;
  };
  const operationalIdentity = async (empresaId, email, name) => {
    const usuarioId = await localUser(empresaId, email, name);
    const invite = (await sql.query(
      `INSERT INTO commerce_operational_invites
         (empresa_id, email_norm, nome, token_hash, status, expira_em, enviado_em, usado_em, usuario_id)
       VALUES ($1, $2, $3, $4, 'used', CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5)
       RETURNING id`,
      [empresaId, email, name, crypto.createHash('sha256').update(`invite-${suffix}-${email}`).digest('hex'), usuarioId],
    )).rows[0];
    invites.push(invite.id);
    await membership(empresaId, usuarioId, 'store_admin');
    return usuarioId;
  };

  try {
    const A = await company('A', 1);
    const B = await company('B', 2);
    const C = await company('C', 3);
    const lojaA = await store(A, 'a', 'Unidade A');
    const lojaB = await store(B, 'b', 'Unidade B');
    const lojaC = await store(C, 'c', 'Unidade C');
    const storefrontA = (await sql.query(
      `INSERT INTO commerce_storefronts (empresa_id, loja_id, codigo, nome, canal, status)
       VALUES ($1, $2, $3, 'Vitrine A', 'web', 'active') RETURNING id`,
      [A, lojaA, `storefront-a-${suffix}`],
    )).rows[0].id;
    const storefrontB = (await sql.query(
      `INSERT INTO commerce_storefronts (empresa_id, loja_id, codigo, nome, canal, status)
       VALUES ($1, $2, $3, 'Vitrine B', 'web', 'active') RETURNING id`,
      [B, lojaB, `storefront-b-${suffix}`],
    )).rows[0].id;
    const activeCompanyIds = (await sql.query(
      'SELECT id FROM empresas WHERE COALESCE(ativa, true) = true ORDER BY id',
    )).rows.map(row => row.id);
    await sql.query(
      `INSERT INTO commerce_customers (empresa_id, nome, email)
       VALUES ($1, 'Cliente sintético A', $2), ($3, 'Cliente sintético B', $4), ($5, 'Cliente sintético C', $6)`,
      [A, `customer-a-${suffix}@example.invalid`, B, `customer-b-${suffix}@example.invalid`, C, `customer-c-${suffix}@example.invalid`],
    );

    const sourceEmail = `source-${suffix}@example.invalid`;
    const expiredEmail = `expired-${suffix}@example.invalid`;
    const sourceUserId = await operationalIdentity(A, sourceEmail, 'Fonte sintética A');
    const expiredSourceUserId = await operationalIdentity(B, expiredEmail, 'Fonte sintética expirada');
    const otherAdminId = await localUser(A, `other-admin-${suffix}@example.invalid`, 'Outro administrador sintético');
    await membership(A, otherAdminId, 'tenant_owner');

    const sourceSnapshot = (await sql.query(
      `SELECT u.id, u.email, u.nome_completo, u.senha_hash, u.ativo,
              m.ativo AS membership_ativo, m.loja_id, r.codigo AS role_code
         FROM usuarios u
         JOIN commerce_memberships m ON m.empresa_id=u.empresa_id AND m.usuario_id=u.id
         JOIN commerce_roles r ON r.id=m.role_id
        WHERE u.id=$1 ORDER BY m.id`,
      [sourceUserId],
    )).rows;
    const otherSnapshot = (await sql.query(
      `SELECT u.id, u.email, u.nome_completo, u.senha_hash, u.ativo,
              m.ativo AS membership_ativo, m.loja_id, r.codigo AS role_code
         FROM usuarios u
         JOIN commerce_memberships m ON m.empresa_id=u.empresa_id AND m.usuario_id=u.id
         JOIN commerce_roles r ON r.id=m.role_id
        WHERE u.id=$1 ORDER BY m.id`,
      [otherAdminId],
    )).rows;
    assert.equal(sourceSnapshot.length, 1);
    assert.equal(otherSnapshot.length, 1);
    assert.equal(sourceSnapshot[0].senha_hash, hash);
    assert.equal(otherSnapshot[0].senha_hash, hash);

    fs.writeFileSync(dbPath, JSON.stringify({
      seq: 100,
      usuarios: [
        { id: 1, nome: 'Admin legado sintético', email: 'legacy-admin@example.invalid', senhaHash: hash, role: 'admin', platformAdmin: true, ativo: true },
        { id: 2, nome: 'Admin principal sintético', email: 'legacy-main@example.invalid', senhaHash: hash, role: 'admin', ativo: true },
        { id: 3, nome: 'Staff legado sintético', email: 'legacy-staff@example.invalid', senhaHash: hash, role: 'staff', ativo: true },
      ],
    }));

    child = spawn(process.execPath, ['server.js'], {
      cwd: APP,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(port),
        DB_PATH: dbPath,
        JWT_SECRET: `platform-grants-${suffix}`,
        COMMERCE_CORE_ENABLED: '1',
        DATABASE_URL: DSN,
        DB_SSL: 'false',
        ADMIN_USER: 'legacy-main@example.invalid',
        PLATFORM_ADMIN_EMAILS: 'legacy-admin@example.invalid',
        SEED_DEMO: '0',
        OPERATIONAL_INVITES_ENABLED: '1',
        WHATSAPP_CONNECTION_WATCHDOG: 'false',
        WPP_BASE_URL: '',
        WPP_APIKEY: '',
        RESEND_API_KEY: '',
        OPERATIONAL_INVITE_RESEND_API_KEY: '',
        GEMINI_API_KEY: '',
        OPENAI_API_KEY: '',
        AI_AUTOMATION_SCHEDULER: 'false',
        AI_LEARNING_SCHEDULER: 'false',
      },
      stdio: 'ignore',
    });
    await waitForServer(base, child);

    const legacyAdmin = auth((await login(base, 'legacy-admin@example.invalid')).body.token);
    const mainAdmin = auth((await login(base, 'legacy-main@example.invalid')).body.token);
    const staffLogin = await login(base, 'legacy-staff@example.invalid');
    const staff = auth(staffLogin.body.token);
    const oldOperational = auth((await login(base, sourceEmail)).body.token);

    const candidateSearch = await request(base, `/api/admin/platform/administrators?query=${encodeURIComponent(sourceEmail)}`, { headers: legacyAdmin });
    assert.equal(candidateSearch.response.status, 200, JSON.stringify(candidateSearch.body));
    assert.ok(candidateSearch.body.candidates.some(candidate => candidate.sourceUserId === sourceUserId));
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: mainAdmin })).response.status, 200, 'mainAdmin legado também é ator manager');
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: staff })).response.status, 403, 'staff legado não é ator manager');
    assert.equal((await request(base, '/api/admin/platform/administrators', { method: 'POST', headers: oldOperational, body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }) })).response.status, 403, 'store_admin operacional não concede global');
    assert.equal((await request(base, '/api/admin/commerce/users/roles', { headers: oldOperational })).response.status, 403, 'store_admin não recebe users.write global');

    const rejectedPlatformOwnerForm = await request(base, '/api/admin/platform/accounts', {
      method: 'POST',
      headers: legacyAdmin,
      body: JSON.stringify({ nome: 'Não deve criar platform owner', email: `rejected-${suffix}@example.invalid`, senha: PASSWORD, access: [{ empresaId: A, roleCode: 'platform_owner' }] }),
    });
    assert.equal(rejectedPlatformOwnerForm.response.status, 403, 'formulário normal não concede platform_owner');

    const auditProbe = `platform_audit_probe_${suffix}`;
    await sql.query(`CREATE FUNCTION ${auditProbe}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.acao='platform_granted' THEN RAISE EXCEPTION 'local audit failure probe'; END IF; RETURN NEW; END; $$`);
    await sql.query(`CREATE TRIGGER ${auditProbe} BEFORE INSERT ON commerce_account_audit FOR EACH ROW EXECUTE FUNCTION ${auditProbe}()`);
    try {
      const failedAudit = await request(base, '/api/admin/platform/administrators', {
        method: 'POST', headers: legacyAdmin,
        body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }),
      });
      assert.equal(failedAudit.response.status, 503);
      assert.equal((await sql.query('SELECT count(*)::int AS n FROM commerce_accounts WHERE email=$1', [sourceEmail])).rows[0].n, 0, 'falha de auditoria reverte conta e concessões');
      assert.equal((await sql.query(`SELECT r.codigo FROM commerce_memberships m JOIN commerce_roles r ON r.id=m.role_id WHERE m.usuario_id=$1 AND m.loja_id IS NULL`, [sourceUserId])).rows[0].codigo, 'store_admin');
    } finally {
      await sql.query(`DROP TRIGGER ${auditProbe} ON commerce_account_audit`);
      await sql.query(`DROP FUNCTION ${auditProbe}()`);
    }
    const concurrentGrants = await Promise.all([legacyAdmin, mainAdmin].map(headers => request(base, '/api/admin/platform/administrators', {
      method: 'POST', headers,
      body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }),
    })));
    assert.deepEqual(concurrentGrants.map(item => item.response.status).sort(), [200, 201], 'duas concessões simultâneas geram uma criação e um replay');
    assert.equal(concurrentGrants[0].body.accountId, concurrentGrants[1].body.accountId);
    const grant = concurrentGrants.find(item => item.response.status === 201);
    assert.equal(grant.response.status, 201, JSON.stringify(grant.body));
    assert.equal(grant.body.ok, true);
    accountId = grant.body.accountId;
    assert.match(accountId, /^[0-9a-f-]{36}$/i);
    assert.doesNotMatch(JSON.stringify(grant.body), /senha|password|senha_hash|token|\$2[aby]\$/i);

    const accountRows = (await sql.query('SELECT id, email, nome, senha_hash, origem, origem_id FROM commerce_accounts WHERE email=$1', [sourceEmail])).rows;
    assert.equal(accountRows.length, 1, 'grant não duplica a conta canônica');
    assert.equal(accountRows[0].id, accountId);
    assert.equal(accountRows[0].senha_hash, hash, 'grant preserva o hash bcrypt da identidade SQL');
    assert.equal(accountRows[0].origem, 'commerce');
    assert.equal(String(accountRows[0].origem_id), String(sourceUserId));
    assert.equal((await sql.query('SELECT count(*)::int AS n FROM commerce_account_users WHERE account_id=$1', [accountId])).rows[0].n, activeCompanyIds.length, 'conta canônica é sincronizada para todas as empresas ativas');
    const sourceDuringGrant = (await sql.query(
      `SELECT u.id, u.email, u.nome_completo, u.senha_hash, u.ativo,
              m.ativo AS membership_ativo, m.loja_id, r.codigo AS role_code
         FROM usuarios u JOIN commerce_memberships m ON m.empresa_id=u.empresa_id AND m.usuario_id=u.id
         JOIN commerce_roles r ON r.id=m.role_id WHERE u.id=$1 ORDER BY m.id`, [sourceUserId],
    )).rows;
    assert.equal(sourceDuringGrant.length, 1);
    assert.equal(sourceDuringGrant[0].role_code, 'platform_owner', 'a identidade fonte recebe a membership global durante a concessão');
    assert.equal(sourceDuringGrant[0].email, sourceSnapshot[0].email);
    assert.equal(sourceDuringGrant[0].senha_hash, sourceSnapshot[0].senha_hash, 'a senha da identidade fonte permanece a mesma');
    assert.deepEqual((await sql.query(
      `SELECT u.id, u.email, u.nome_completo, u.senha_hash, u.ativo,
              m.ativo AS membership_ativo, m.loja_id, r.codigo AS role_code
         FROM usuarios u JOIN commerce_memberships m ON m.empresa_id=u.empresa_id AND m.usuario_id=u.id
         JOIN commerce_roles r ON r.id=m.role_id WHERE u.id=$1 ORDER BY m.id`, [otherAdminId],
    )).rows, otherSnapshot, 'outros administradores não são alterados');

    const firstAuditCount = (await sql.query('SELECT count(*)::int AS n FROM commerce_account_audit WHERE account_id=$1', [accountId])).rows[0].n;
    const duplicate = await request(base, '/api/admin/platform/administrators', {
      method: 'POST',
      headers: mainAdmin,
      body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }),
    });
    assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.body));
    assert.equal(duplicate.body.ok, true);
    assert.equal(duplicate.body.accountId, accountId);
    assert.equal(duplicate.body.idempotent, true);
    const secondAuditCount = (await sql.query('SELECT count(*)::int AS n FROM commerce_account_audit WHERE account_id=$1', [accountId])).rows[0].n;
    assert.equal(secondAuditCount, firstAuditCount, 'grant idempotente não cria auditoria duplicada');

    await sql.query(`UPDATE commerce_memberships m SET ativo=false FROM commerce_account_users au
      WHERE au.account_id=$1 AND au.empresa_id=$2 AND m.empresa_id=au.empresa_id AND m.usuario_id=au.usuario_id AND m.loja_id IS NULL`, [accountId, B]);
    const repair = await request(base, '/api/admin/platform/administrators', { method: 'POST', headers: mainAdmin,
      body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }) });
    assert.equal(repair.response.status, 200);
    assert.equal((await sql.query(`SELECT m.ativo FROM commerce_memberships m JOIN commerce_account_users au ON au.usuario_id=m.usuario_id AND au.empresa_id=m.empresa_id
      WHERE au.account_id=$1 AND au.empresa_id=$2 AND m.loja_id IS NULL`, [accountId, B])).rows[0].ativo, true, 'replay repara drift de acesso');
    assert.equal((await sql.query('SELECT count(*)::int AS n FROM commerce_account_audit WHERE account_id=$1', [accountId])).rows[0].n, secondAuditCount + 1, 'somente reparo efetivo é auditado');

    const canonicalLogin = await login(base, sourceEmail);
    assert.equal(canonicalLogin.body.user.pgAccount, true);
    assert.equal(canonicalLogin.body.user.platformAdmin, true);
    assert.equal(canonicalLogin.body.user.tenantBound, false);
    const canonicalToken = auth(canonicalLogin.body.token);
    assert.deepEqual(new Set(canonicalLogin.body.sessao.empresas_acessiveis.map(item => item.id)), new Set(activeCompanyIds), 'sessão global cobre todas as empresas ativas');
    assert.equal((await request(base, '/api/auth/me', { headers: canonicalToken })).response.status, 200);
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: canonicalToken })).response.status, 200);
    assert.equal((await request(base, '/api/auth/me', { headers: oldOperational })).response.status, 401, 'JWT operacional antigo falha fechado e não recebe elevação automática');

    const listing = await request(base, `/api/admin/platform/administrators?query=${encodeURIComponent(sourceEmail)}`, { headers: canonicalToken });
    assert.equal(listing.response.status, 200, JSON.stringify(listing.body));
    assert.ok(listing.body.items.some(item => item.accountId === accountId));
    assert.equal(listing.body.candidates.some(candidate => candidate.sourceUserId === sourceUserId), false, 'fonte já global não volta como candidata');
    assert.doesNotMatch(JSON.stringify(listing.body), /senha|password|senha_hash|token|\$2[aby]\$/i);

    const tenants = await request(base, '/api/admin/platform/commerce-tenants', { headers: canonicalToken });
    assert.equal(tenants.response.status, 200, JSON.stringify(tenants.body));
    assert.ok(JSON.stringify(tenants.body).includes(String(A)) && JSON.stringify(tenants.body).includes(String(B)) && JSON.stringify(tenants.body).includes(String(C)));
    for (const empresaId of companies) {
      const customers = await request(base, '/api/admin/commerce/customers', { headers: { ...canonicalToken, 'X-Empresa-Id': empresaId } });
      assert.equal(customers.response.status, 200, `${empresaId}: ${JSON.stringify(customers.body)}`);
      assert.ok(Array.isArray(customers.body.items));
      const roles = await request(base, '/api/admin/commerce/users/roles', { headers: { ...canonicalToken, 'X-Empresa-Id': empresaId } });
      assert.equal(roles.response.status, 200, `users.write ${empresaId}: ${JSON.stringify(roles.body)}`);
    }
    const wrongStorefront = await request(base, `/api/admin/commerce/reports/customers?storefrontId=${storefrontB}`, { headers: { ...canonicalToken, 'X-Empresa-Id': A } });
    assert.equal(wrongStorefront.response.status, 409, JSON.stringify(wrongStorefront.body));
    assert.equal(wrongStorefront.body.code, 'STORE_SCOPE_MISMATCH', 'global não contorna validação cross-store');
    assert.notEqual(storefrontA, storefrontB);

    assert.equal((await request(base, `/api/admin/platform/administrators/${accountId}/revoke`, { method: 'POST', headers: canonicalToken, body: JSON.stringify({ confirmRevoke: true }) })).response.status, 403, 'self revoke é negado');
    assert.equal((await request(base, `/api/admin/platform/administrators/${accountId}/revoke`, { method: 'POST', headers: legacyAdmin, body: JSON.stringify({ confirmRevoke: false }) })).response.status, 400, 'revogação exige confirmação');

    const revoked = await request(base, `/api/admin/platform/administrators/${accountId}/revoke`, {
      method: 'POST',
      headers: mainAdmin,
      body: JSON.stringify({ confirmRevoke: true }),
    });
    assert.equal(revoked.response.status, 200, JSON.stringify(revoked.body));
    assert.equal(revoked.body.ok, true);
    assert.equal((await request(base, '/api/auth/me', { headers: canonicalToken })).response.status, 200, 'JWT canônico antigo continua sendo a conta original');
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: canonicalToken })).response.status, 403, 'JWT antigo não conserva poder global após revogação');
    assert.deepEqual((await sql.query(
      `SELECT u.id, u.email, u.nome_completo, u.senha_hash, u.ativo,
              m.ativo AS membership_ativo, m.loja_id, r.codigo AS role_code
         FROM usuarios u JOIN commerce_memberships m ON m.empresa_id=u.empresa_id AND m.usuario_id=u.id
         JOIN commerce_roles r ON r.id=m.role_id WHERE u.id=$1 ORDER BY m.id`, [sourceUserId],
    )).rows, sourceSnapshot, 'a revogação restaura exatamente a membership original da identidade fonte');
    const restoredCanonical = await login(base, sourceEmail);
    assert.equal(restoredCanonical.body.user.pgAccount, true);
    assert.equal(restoredCanonical.body.user.platformAdmin, false);
    assert.deepEqual(restoredCanonical.body.sessao.empresas_acessiveis.map(item => item.id), [A], 'revogação restaura o escopo original');
    const restoredCanonicalToken = auth(restoredCanonical.body.token);
    assert.equal((await request(base, '/api/admin/platform/administrators', { method: 'POST', headers: restoredCanonicalToken, body: JSON.stringify({ sourceUserId, confirmGlobal: true, expiresAt: null }) })).response.status, 403, 'conta canônica não global não pode conceder global nem a si mesma');
    const restoredOperational = await request(base, '/api/auth/me', { headers: oldOperational });
    assert.equal(restoredOperational.response.status, 200);
    assert.equal(restoredOperational.body.platformAdmin, false);
    assert.equal(restoredOperational.body.pgAccount, undefined);
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: oldOperational })).response.status, 403);

    const expiredOldOperational = auth((await login(base, expiredEmail)).body.token);
    const expiryGrant = await request(base, '/api/admin/platform/administrators', {
      method: 'POST',
      headers: legacyAdmin,
      body: JSON.stringify({ sourceUserId: expiredSourceUserId, confirmGlobal: true, expiresAt: new Date(Date.now() + 120_000).toISOString() }),
    });
    assert.equal(expiryGrant.response.status, 201, JSON.stringify(expiryGrant.body));
    expiredAccountId = expiryGrant.body.accountId;
    const expiredLogin = await login(base, expiredEmail);
    assert.equal(expiredLogin.body.user.platformAdmin, true);
    const expiredCanonical = auth(expiredLogin.body.token);
    await sql.query('UPDATE commerce_platform_grants SET expires_at = CURRENT_TIMESTAMP - INTERVAL \'1 minute\' WHERE account_id=$1', [expiredAccountId]);
    assert.equal((await request(base, '/api/auth/me', { headers: expiredCanonical })).response.status, 401, 'JWT canônico falha fechado na expiração live');
    const expiredNewLogin = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: expiredEmail, pass: PASSWORD }) });
    assert.ok([401, 403].includes(expiredNewLogin.response.status), JSON.stringify(expiredNewLogin.body));
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: expiredCanonical })).response.status, 401);
    assert.equal((await request(base, '/api/auth/me', { headers: expiredOldOperational })).response.status, 401, 'JWT operacional antigo também falha fechado enquanto a membership platform_owner permanece');
    assert.equal((await request(base, '/api/admin/platform/administrators', { headers: expiredOldOperational })).response.status, 401);

    const expiredRevoked = await request(base, `/api/admin/platform/administrators/${expiredAccountId}/revoke`, {
      method: 'POST',
      headers: legacyAdmin,
      body: JSON.stringify({ confirmRevoke: true }),
    });
    assert.equal(expiredRevoked.response.status, 200, JSON.stringify(expiredRevoked.body));
    const restoredExpired = await login(base, expiredEmail);
    assert.equal(restoredExpired.body.user.platformAdmin, false, 'revogação restaura o perfil original após expiração');
    assert.deepEqual(restoredExpired.body.sessao.empresas_acessiveis.map(item => item.id), [B]);
    assert.equal((await request(base, '/api/auth/me', { headers: expiredOldOperational })).response.status, 200, 'revogação restaura também o login operacional antigo');
  } finally {
    if (child && child.exitCode === null) child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 200));
    await sql.end();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
