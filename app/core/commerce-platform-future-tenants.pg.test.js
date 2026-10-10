import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { db } from './database.js';
import { resolveAccountUser } from './commerce-accounts.js';
import { provisionCommerceTenant } from './commerce-tenants.js';

const DSN = process.env.COMMERCE_PLATFORM_FUTURE_TENANTS_TEST_DATABASE_URL || '';
const parsedDsn = DSN ? new URL(DSN) : null;
const enabled = Boolean(parsedDsn && ['localhost', '127.0.0.1', '::1'].includes(parsedDsn.hostname)
  && /test/.test(parsedDsn.pathname));
const PASSWORD_HASH = '$2b$04$C6UzMDM.H6dfI/f/IKcEe.7D7j8Q6Y6QqfV6x6m9mJ5dQ4fJzqW6K';

function cnpjFromSeed(seed) {
  const digits = String(seed).replace(/\D/g, '').padStart(12, '7').slice(-12);
  const calculate = (base, weights) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const result = 11 - (total % 11);
    return result >= 10 ? '0' : String(result);
  };
  const first = calculate(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(`${digits}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${digits}${first}${second}`;
}

function tenantInput({ suffix, cnpj, nome, email, alias, sourceUserId, accountId } = {}) {
  return {
    nomeFantasia: nome,
    razaoSocial: `${nome} Comércio e Serviços Ltda.`,
    cnpj,
    tipoNegocio: 'barbearia',
    adminEmail: email,
    adminName: `Administrador ${nome}`,
    ...(sourceUserId ? { adminSourceUserId: sourceUserId } : {}),
    ...(accountId ? { adminAccountId: accountId } : {}),
    alias: `${alias}-${suffix}`,
    brandKey: `${alias}-${suffix}`,
    lojaCodigo: `${alias.toUpperCase().slice(0, 12)}-${suffix.slice(0, 8).toUpperCase()}`,
    storefrontCodigo: `${alias}-${suffix}`,
    confirmAdminAccess: true,
    confirmPublicContact: true,
    phone: '+5565993360000',
    address: {
      street: 'Rua de Teste',
      number: '80 W',
      neighborhood: 'Centro',
      city: 'Tangará da Serra',
      state: 'MT',
      postalCode: '78300055',
    },
    pickup: { instructions: 'Retirada no estabelecimento após confirmação.', leadTimeHours: 2 },
  };
}

async function scalar(client, sql, params = []) {
  return (await client.query(sql, params)).rows[0]?.value;
}

async function company(client, label, seed, ids) {
  const row = (await client.query(
    `INSERT INTO empresas (nome, cnpj, razao_social, ativa, tipo_negocio)
     VALUES ($1, $2, $1, true, 'barbearia') RETURNING id`,
    [`Future ${label}`, cnpjFromSeed(seed)],
  )).rows[0];
  ids.companies.push(row.id);
  return row.id;
}

async function user(client, empresaId, email, name, ids) {
  const row = (await client.query(
    `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo)
     VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id`,
    [empresaId, email, PASSWORD_HASH, name],
  )).rows[0];
  ids.users.push(row.id);
  return row.id;
}

async function canonicalAccount(client, sourceUserId, email, name, empresaId, ids) {
  const account = (await client.query(
    `INSERT INTO commerce_accounts (email, nome, senha_hash, ativo, origem, origem_id)
     VALUES ($1, $2, $3, true, 'commerce', $4) RETURNING id`,
    [email, name, PASSWORD_HASH, sourceUserId],
  )).rows[0];
  ids.accounts.push(account.id);
  await client.query(
    `INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id)
     VALUES ($1, $2, $3)`,
    [account.id, empresaId, sourceUserId],
  );
  await client.query(
    `INSERT INTO commerce_platform_grants (account_id, ativo, expires_at, granted_by)
     VALUES ($1, true, NULL, 'future-tenant-test')`,
    [account.id],
  );
  return account.id;
}

async function membershipRole(client, empresaId, email) {
  const row = (await client.query(
    `SELECT r.codigo
       FROM usuarios u
       JOIN commerce_memberships m ON m.empresa_id = u.empresa_id AND m.usuario_id = u.id
       JOIN commerce_roles r ON r.id = m.role_id
      WHERE u.empresa_id = $1 AND u.email = $2 AND m.loja_id IS NULL
      ORDER BY m.id DESC
      LIMIT 1`,
    [empresaId, email],
  )).rows[0];
  return row?.codigo || null;
}

async function countRows(client, table, where, params) {
  return Number(await scalar(client, `SELECT count(*)::int AS value FROM ${table} WHERE ${where}`, params));
}

const testName = 'PostgreSQL: future tenant identity resolution, global sync, own-global mapping, replay e ambiguity zero-DML';
test(testName, { skip: !enabled && 'somente DSN PostgreSQL local é permitido para este teste' }, async () => {
  process.env.DATABASE_URL = DSN;
  process.env.DB_SSL = 'false';
  const client = new pg.Client({ connectionString: DSN, ssl: false });
  const ids = { companies: [], users: [], accounts: [] };
  const suffix = crypto.randomBytes(7).toString('hex');
  const uniqueEmail = `future-unique-${suffix}@example.invalid`;
  const otherGlobalEmail = `future-other-global-${suffix}@example.invalid`;
  const ownGlobalEmail = `future-own-global-${suffix}@example.invalid`;
  const ambiguousEmail = `future-ambiguous-${suffix}@example.invalid`;
  let dbClosed = false;

  try {
    await client.connect();
    const sourceCompany = await company(client, 'source', `${Date.now()}1${suffix}`, ids);
    const otherCompany = await company(client, 'other', `${Date.now()}2${suffix}`, ids);
    const uniqueSourceId = await user(client, sourceCompany, uniqueEmail, 'Fonte única', ids);
    const otherSourceId = await user(client, otherCompany, otherGlobalEmail, 'Fonte global independente', ids);
    const otherAccountId = await canonicalAccount(client, otherSourceId, otherGlobalEmail, 'Global independente', otherCompany, ids);

    const firstInput = tenantInput({
      suffix,
      cnpj: cnpjFromSeed(`${Date.now()}3${suffix}`),
      nome: `Future Unique ${suffix}`,
      email: uniqueEmail,
      alias: 'future-unique',
      sourceUserId: uniqueSourceId,
    });
    const first = await provisionCommerceTenant(firstInput);
    const firstTenantId = first.empresa.id;
    ids.companies.push(firstTenantId);

    assert.equal(await countRows(client, 'usuarios', 'empresa_id = $1 AND email = $2', [firstTenantId, uniqueEmail]), 1);
    assert.equal(await countRows(client, 'commerce_account_users', 'account_id = $1 AND empresa_id = $2', [otherAccountId, firstTenantId]), 1, 'outro global é mapeado no tenant novo');
    assert.equal(await countRows(client, 'usuarios', 'empresa_id = $1 AND email = $2', [firstTenantId, otherGlobalEmail]), 1, 'sync global cria uma identidade local distinta');
    assert.equal(await membershipRole(client, firstTenantId, uniqueEmail), 'tenant_owner');
    assert.equal(await membershipRole(client, firstTenantId, otherGlobalEmail), 'platform_owner');

    const firstCounts = {
      users: await countRows(client, 'usuarios', 'empresa_id = $1', [firstTenantId]),
      mappings: await countRows(client, 'commerce_account_users', 'empresa_id = $1', [firstTenantId]),
      memberships: await countRows(client, 'commerce_memberships', 'empresa_id = $1', [firstTenantId]),
    };
    const replay = await provisionCommerceTenant(firstInput);
    assert.equal(replay.created, false);
    assert.deepEqual({
      users: await countRows(client, 'usuarios', 'empresa_id = $1', [firstTenantId]),
      mappings: await countRows(client, 'commerce_account_users', 'empresa_id = $1', [firstTenantId]),
      memberships: await countRows(client, 'commerce_memberships', 'empresa_id = $1', [firstTenantId]),
    }, firstCounts, 'replay não duplica identidades, mappings ou memberships');

    const ownSourceId = await user(client, sourceCompany, ownGlobalEmail, 'Fonte global própria', ids);
    const ownAccountId = await canonicalAccount(client, ownSourceId, ownGlobalEmail, 'Global próprio', sourceCompany, ids);
    const ownInput = tenantInput({
      suffix,
      cnpj: cnpjFromSeed(`${Date.now()}4${suffix}`),
      nome: `Future Own Global ${suffix}`,
      email: ownGlobalEmail,
      alias: 'future-own',
      sourceUserId: ownSourceId,
      accountId: ownAccountId,
    });
    const own = await provisionCommerceTenant(ownInput);
    const ownTenantId = own.empresa.id;
    ids.companies.push(ownTenantId);

    assert.equal(await countRows(client, 'commerce_account_users', 'account_id = $1 AND empresa_id = $2', [ownAccountId, ownTenantId]), 1, 'mapping canônico é criado antes do sync global');
    assert.equal(await membershipRole(client, ownTenantId, ownGlobalEmail), 'tenant_owner', 'último tenant_owner não é substituído por platform_owner');
    const ownSession = await resolveAccountUser(ownAccountId, db);
    assert.equal(ownSession?.platformAdmin, true, 'conta global continua autorizada pela sessão Commerce');
    assert.equal(ownSession?.tenantBound, false);
    assert.ok(ownSession.accountAccess.some(row => row.empresa_id === ownTenantId && row.role_codigo === 'tenant_owner'));

    const ownCounts = {
      users: await countRows(client, 'usuarios', 'empresa_id = $1', [ownTenantId]),
      mappings: await countRows(client, 'commerce_account_users', 'empresa_id = $1', [ownTenantId]),
      memberships: await countRows(client, 'commerce_memberships', 'empresa_id = $1', [ownTenantId]),
    };
    const ownReplay = await provisionCommerceTenant(ownInput);
    assert.equal(ownReplay.created, false);
    assert.deepEqual({
      users: await countRows(client, 'usuarios', 'empresa_id = $1', [ownTenantId]),
      mappings: await countRows(client, 'commerce_account_users', 'empresa_id = $1', [ownTenantId]),
      memberships: await countRows(client, 'commerce_memberships', 'empresa_id = $1', [ownTenantId]),
    }, ownCounts, 'replay own-global é idempotente');

    const ambiguousA = await company(client, 'ambiguous-a', `${Date.now()}5${suffix}`, ids);
    const ambiguousB = await company(client, 'ambiguous-b', `${Date.now()}6${suffix}`, ids);
    await user(client, ambiguousA, ambiguousEmail, 'Ambígua A', ids);
    await user(client, ambiguousB, ambiguousEmail, 'Ambígua B', ids);
    const ambiguousCnpj = cnpjFromSeed(`${Date.now()}7${suffix}`);
    const beforeAmbiguousCompanies = await countRows(client, 'empresas', 'cnpj = $1', [ambiguousCnpj]);
    const beforeAmbiguousUsers = await countRows(client, 'usuarios', 'email = $1', [ambiguousEmail]);
    await assert.rejects(
      provisionCommerceTenant(tenantInput({
        suffix,
        cnpj: ambiguousCnpj,
        nome: `Future Ambiguous ${suffix}`,
        email: ambiguousEmail,
        alias: 'future-ambiguous',
      })),
      error => error.code === 'IDENTITY_AMBIGUOUS',
    );
    assert.equal(await countRows(client, 'empresas', 'cnpj = $1', [ambiguousCnpj]), beforeAmbiguousCompanies, 'ambiguidade não cria empresa');
    assert.equal(await countRows(client, 'usuarios', 'email = $1', [ambiguousEmail]), beforeAmbiguousUsers, 'ambiguidade não cria usuário');
  } finally {
    try {
      if (client._connected) {
        await client.query('BEGIN');
        if (ids.accounts.length) {
          await client.query('DELETE FROM commerce_platform_grant_memberships WHERE account_id = ANY($1::uuid[]) OR empresa_id = ANY($2::uuid[])', [ids.accounts, ids.companies]);
          await client.query('ALTER TABLE commerce_account_audit DISABLE TRIGGER trg_commerce_account_audit_immutable');
          await client.query('DELETE FROM commerce_account_audit WHERE account_id = ANY($1::uuid[]) OR empresa_id = ANY($2::uuid[])', [ids.accounts, ids.companies]);
          await client.query('ALTER TABLE commerce_account_audit ENABLE TRIGGER trg_commerce_account_audit_immutable');
          await client.query('DELETE FROM commerce_account_users WHERE account_id = ANY($1::uuid[]) OR empresa_id = ANY($2::uuid[])', [ids.accounts, ids.companies]);
          await client.query('DELETE FROM commerce_platform_grants WHERE account_id = ANY($1::uuid[])', [ids.accounts]);
          await client.query('DELETE FROM commerce_accounts WHERE id = ANY($1::uuid[])', [ids.accounts]);
        } else if (ids.companies.length) {
          await client.query('DELETE FROM commerce_platform_grant_memberships WHERE empresa_id = ANY($1::uuid[])', [ids.companies]);
          await client.query('ALTER TABLE commerce_account_audit DISABLE TRIGGER trg_commerce_account_audit_immutable');
          await client.query('DELETE FROM commerce_account_audit WHERE empresa_id = ANY($1::uuid[])', [ids.companies]);
          await client.query('ALTER TABLE commerce_account_audit ENABLE TRIGGER trg_commerce_account_audit_immutable');
          await client.query('DELETE FROM commerce_account_users WHERE empresa_id = ANY($1::uuid[])', [ids.companies]);
        }
        if (ids.companies.length) {
          await client.query('ALTER TABLE auditoria DISABLE TRIGGER ALL');
          await client.query('ALTER TABLE auditoria_imutavel DISABLE TRIGGER ALL');
          await client.query('ALTER TABLE usuarios_lojas DISABLE TRIGGER ALL');
          await client.query('DELETE FROM auditoria_imutavel WHERE empresa_id = ANY($1::uuid[])', [ids.companies]);
          await client.query('DELETE FROM empresas WHERE id = ANY($1::uuid[])', [ids.companies]);
          await client.query('ALTER TABLE usuarios_lojas ENABLE TRIGGER ALL');
          await client.query('ALTER TABLE auditoria_imutavel ENABLE TRIGGER ALL');
          await client.query('ALTER TABLE auditoria ENABLE TRIGGER ALL');
        }
        await client.query('COMMIT');
      }
    } finally {
      await client.end().catch(() => {});
      await db.close().catch(() => {});
      dbClosed = true;
    }
  }
  assert.equal(dbClosed, true);
});
