import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import pg from 'pg';
import {
  acceptOperationalInvite,
  findOperationalByEmail,
  issueOperationalInvite,
  isOperationalEmailReserved,
  resolveOperationalById,
  sendOperationalInvite,
} from './commerce-operational-invites.js';

const connectionString = process.env.COMMERCE_OPERATIONAL_INVITE_TEST_DATABASE_URL || '';
const localOnly = /^(?:localhost|127(?:\.\d{1,3}){3}|::1)(?::\d+)?$/iu;
let parsedHost = '';
try { parsedHost = new URL(connectionString).hostname; } catch { /* disabled below */ }
const enabled = Boolean(connectionString) && localOnly.test(parsedHost)
  && /(?:^|[_-])test(?:[_-]|$)/iu.test(new URL(connectionString).pathname.slice(1));
const pool = enabled ? new pg.Pool({ connectionString, ssl: false, max: 6 }) : null;
const migrationSql = await readFile(new URL('../migrations/064_commerce_operational_invites.sql', import.meta.url), 'utf8');
const expirationSql = await readFile(new URL('../migrations/065_commerce_membership_expiration.sql', import.meta.url), 'utf8');

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (sql, values = []) => client.query(sql, values) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fixture(label) {
  const empresaId = randomUUID();
  const suffix = empresaId.replaceAll('-', '').slice(0, 12);
  await pool.query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio)
     VALUES ($1, $2, $3, $2, 'loja')`,
    [empresaId, `Convite ${label} ${suffix}`, `91${suffix}`.slice(0, 14)],
  );
  return empresaId;
}

before(async () => {
  if (!enabled) return;
  await pool.query(migrationSql);
  await pool.query(expirationSql);
});
after(async () => {
  if (!pool) return;
  await pool.end();
});

// Fixtures com UUIDs únicos são descartadas junto com o banco local; não apagar
// empresas em testes, pois os logs de auditoria do Commerce são append-only.
const pgTest = (name, fn) => test(name, { skip: !enabled }, fn);

pgTest('reserva e-mail normalizado atomicamente entre tenants', async () => {
  const tenantA = await fixture('A');
  const tenantB = await fixture('B');
  const input = {
    email: `owner-${randomUUID().slice(0, 8)}@example.invalid`,
    nome: 'Pessoa Sintética',
  };
  const results = await Promise.allSettled([
    issueOperationalInvite({ empresaId: tenantA, ...input }, { database: { transaction } }),
    issueOperationalInvite({ empresaId: tenantB, ...input, email: input.email.toUpperCase() }, { database: { transaction } }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'somente uma transação deve reservar a caixa postal');
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason?.code === 'OPERATIONAL_EMAIL_RESERVED').length, 1);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS n FROM commerce_operational_invites WHERE email_norm = lower($1) AND status = 'pending_email'`,
    [input.email],
  );
  assert.equal(count.rows[0].n, 1);
});

pgTest('sender confirmado marca sent, aceita uma vez e cria operador tenant-wide', async () => {
  const empresaId = await fixture('accept');
  const email = `accept-${randomUUID().slice(0, 8)}@example.invalid`;
  let clearToken = '';
  const created = await issueOperationalInvite({
    empresaId,
    email,
    nome: 'Pessoa Sintética',
    sendInvite: async payload => { clearToken = payload.token; return { ok: true }; },
  }, { database: { transaction } });
  assert.equal(created.status, 'sent');
  assert.equal(clearToken.length, 43);
  const stored = await pool.query('SELECT token_hash, status FROM commerce_operational_invites WHERE id = $1', [created.inviteId]);
  assert.equal(stored.rows[0].status, 'sent');
  assert.equal(stored.rows[0].token_hash.length, 64);
  assert.notEqual(stored.rows[0].token_hash, clearToken);

  const owner = await acceptOperationalInvite({ token: clearToken, password: 'Senha-Sintetica-123!' }, { database: { transaction } });
  assert.equal(owner.email, email);
  assert.equal(owner.role, 'organizador');
  assert.equal(owner.empresaId, empresaId);
  const membership = await pool.query(
    `SELECT m.loja_id, m.ativo, r.codigo
       FROM commerce_memberships m JOIN commerce_roles r ON r.id = m.role_id
      WHERE m.empresa_id = $1 AND m.usuario_id = $2`,
    [empresaId, owner.id],
  );
  assert.deepEqual(membership.rows, [{ loja_id: null, ativo: true, codigo: 'store_admin' }]);
  const userManagement = await pool.query(
    `SELECT COUNT(*)::integer AS total FROM commerce_memberships m
       JOIN commerce_role_permissions rp ON rp.role_id = m.role_id
       JOIN commerce_permissions p ON p.id = rp.permission_id
      WHERE m.empresa_id = $1 AND m.usuario_id = $2 AND p.codigo = 'users.write'`,
    [empresaId, owner.id],
  );
  assert.equal(userManagement.rows[0].total, 0);
  await assert.rejects(
    () => acceptOperationalInvite({ token: clearToken, password: 'Senha-Sintetica-123!' }, { database: { transaction } }),
    error => error.code === 'OPERATIONAL_INVITE_INVALID',
  );
});

pgTest('falha do sender revoga e e-mail de usuário existente fica reservado', async () => {
  const empresaId = await fixture('revoke');
  const email = `reserved-${randomUUID().slice(0, 8)}@example.invalid`;
  let token = '';
  await assert.rejects(
    () => issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética', sendInvite: async payload => { token = payload.token; return { ok: false }; } }, { database: { transaction } }),
    error => error.code === 'OPERATIONAL_INVITE_SEND_FAILED',
  );
  assert.equal(token.length, 43);
  const status = await pool.query('SELECT status FROM commerce_operational_invites WHERE email_norm = $1', [email]);
  assert.equal(status.rows[0].status, 'revoked');
  assert.equal(await isOperationalEmailReserved(email, { database: pool }), false);
});

pgTest('lookups exigem membership store_admin ativa e retornam null para duplicidade', async () => {
  const empresaId = await fixture('lookup');
  const email = `lookup-${randomUUID().slice(0, 8)}@example.invalid`;
  let token = '';
  const database = { transaction, queryRead: (sql, values = []) => pool.query(sql, values) };
  const invite = await issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética', sendInvite: async payload => { token = payload.token; return { ok: true }; } }, { database });
  const owner = await acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database });
  assert.deepEqual(await findOperationalByEmail(email, { database }), owner);
  assert.deepEqual(await resolveOperationalById({ userId: owner.id, empresaId, database }), owner);
  assert.equal(await isOperationalEmailReserved(email, { database }), true);
  assert.equal(invite.status, 'sent');
  await pool.query(`UPDATE commerce_memberships SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE empresa_id = $1 AND usuario_id = $2`, [empresaId, owner.id]);
  assert.equal(await findOperationalByEmail(email, { database }), null);
  assert.equal(await resolveOperationalById({ userId: owner.id, empresaId, database }), null);
  await pool.query(`UPDATE commerce_memberships SET expires_at = NULL, ativo = false WHERE empresa_id = $1 AND usuario_id = $2`, [empresaId, owner.id]);
  assert.equal(await resolveOperationalById({ userId: owner.id, empresaId, database }), null);
});

pgTest('empresa desativada após envio impede aceite com zero usuário e zero membership', async () => {
  const empresaId = await fixture('inactive-accept');
  const email = `inactive-${randomUUID()}@example.invalid`;
  let token = '';
  const database = { transaction, queryRead: (sql, values = []) => pool.query(sql, values) };
  const invite = await issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética',
    sendInvite: async payload => { token = payload.token; return { ok: true }; } }, { database });
  await pool.query('UPDATE empresas SET ativa = false WHERE id = $1', [empresaId]);
  await assert.rejects(() => acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database }), error => error.code === 'TENANT_NOT_ACTIVE');
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM usuarios WHERE empresa_id=$1) AS users,
    (SELECT count(*)::int FROM commerce_memberships WHERE empresa_id=$1) AS memberships,
    (SELECT status FROM commerce_operational_invites WHERE id=$2) AS status`, [empresaId, invite.inviteId]);
  assert.deepEqual(counts.rows[0], { users: 0, memberships: 0, status: 'sent' });
});

pgTest('desativar empresa bloqueia login e sessão operacional anteriormente válidos', async () => {
  const empresaId = await fixture('inactive-login');
  const email = `inactive-login-${randomUUID()}@example.invalid`;
  let token = '';
  const database = { transaction, queryRead: (sql, values = []) => pool.query(sql, values) };
  await issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética',
    sendInvite: async payload => { token = payload.token; return { ok: true }; } }, { database });
  const user = await acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database });
  assert.equal((await findOperationalByEmail(email, { database })).id, user.id);
  await pool.query('UPDATE empresas SET ativa = false WHERE id = $1', [empresaId]);
  assert.equal(await findOperationalByEmail(email, { database }), null);
  assert.equal(await resolveOperationalById({ userId: user.id, empresaId, database }), null);
});

pgTest('falha de auditoria no aceite reverte usuário, membership e consumo do convite', async () => {
  const empresaId = await fixture('audit-rollback');
  const email = `audit-rollback-${randomUUID()}@example.invalid`;
  let token = '';
  const database = { transaction, queryRead: (sql, values = []) => pool.query(sql, values) };
  const invite = await issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética',
    sendInvite: async payload => { token = payload.token; return { ok: true }; } }, { database });
  const failingDatabase = { transaction: callback => transaction(trx => callback({ query: (sql, values) => {
    if (sql.includes('INSERT INTO commerce_audit_logs')) throw new Error('synthetic audit failure');
    return trx.query(sql, values);
  } })) };
  await assert.rejects(() => acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database: failingDatabase }));
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM usuarios WHERE empresa_id=$1) AS users,
    (SELECT count(*)::int FROM commerce_memberships WHERE empresa_id=$1) AS memberships,
    (SELECT status FROM commerce_operational_invites WHERE id=$2) AS status`, [empresaId, invite.inviteId]);
  assert.deepEqual(result.rows[0], { users: 0, memberships: 0, status: 'sent' });
});

pgTest('dois aceites simultâneos resultam em um usuário, um acesso e uma auditoria', async () => {
  const empresaId = await fixture('concurrent-accept');
  const email = `concurrent-accept-${randomUUID()}@example.invalid`;
  let token = '';
  const database = { transaction, queryRead: (sql, values = []) => pool.query(sql, values) };
  const invite = await issueOperationalInvite({ empresaId, email, nome: 'Pessoa Sintética',
    sendInvite: async payload => { token = payload.token; return { ok: true }; } }, { database });
  const results = await Promise.allSettled([
    acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database }),
    acceptOperationalInvite({ token, password: 'Senha-Sintetica-123!' }, { database }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason?.code === 'OPERATIONAL_INVITE_INVALID').length, 1);
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM usuarios WHERE empresa_id=$1) AS users,
    (SELECT count(*)::int FROM commerce_memberships WHERE empresa_id=$1) AS memberships,
    (SELECT count(*)::int FROM commerce_audit_logs WHERE empresa_id=$1 AND entidade_id=$2 AND entidade='operational_invite' AND acao='accepted') AS audits`, [empresaId, invite.inviteId]);
  assert.deepEqual(counts.rows[0], { users: 1, memberships: 1, audits: 1 });
});
