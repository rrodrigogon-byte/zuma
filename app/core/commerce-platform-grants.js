import { db as defaultDatabase } from './database.js';
import { CommerceError, assertUuid } from './commerce-core.js';

const PLATFORM_ROLE = 'platform_owner';
const SOURCE_ROLE = 'store_admin';
const GRANT_ACTION = 'platform_granted';
const REVOKE_ACTION = 'platform_revoked';
const GLOBAL_LOCK_KEY = 'commerce-platform-grants';
const MAX_ACTOR_ID = 100;

function text(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value) {
  const email = text(value, 320).toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new CommerceError('a identidade SQL possui e-mail inválido', 'IDENTITY_EMAIL_INVALID');
  }
  return email;
}

function queryMethod(database) {
  if (database && typeof database.query === 'function') return database.query.bind(database);
  throw new CommerceError('banco Commerce indisponível', 'DATABASE_UNAVAILABLE');
}

function readMethod(database) {
  if (database && typeof database.queryRead === 'function') return database.queryRead.bind(database);
  return queryMethod(database);
}

async function inTransaction(database, callback) {
  if (!database || typeof database.transaction !== 'function') {
    throw new CommerceError('a operação de administrador global requer uma transação Commerce', 'TRANSACTION_REQUIRED');
  }
  return database.transaction(callback);
}

function normalizeDeps(legacyUsers, reservedEmail, database) {
  if (legacyUsers && !Array.isArray(legacyUsers) && typeof legacyUsers === 'object') {
    return {
      legacyUsers: Array.isArray(legacyUsers.legacyUsers) ? legacyUsers.legacyUsers : [],
      reservedEmail: typeof legacyUsers.reservedEmail === 'function' ? legacyUsers.reservedEmail : () => false,
      database: legacyUsers.database || defaultDatabase,
    };
  }
  return {
    legacyUsers: Array.isArray(legacyUsers) ? legacyUsers : [],
    reservedEmail: typeof reservedEmail === 'function' ? reservedEmail : () => false,
    database: database || defaultDatabase,
  };
}

function parseExpiry(value, { allowPast = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new CommerceError('validade do administrador global inválida', 'PLATFORM_GRANT_EXPIRATION_INVALID');
  }
  const parsed = new Date(value);
  if (!allowPast && parsed.getTime() <= Date.now()) {
    throw new CommerceError('a validade do administrador global deve estar no futuro', 'PLATFORM_GRANT_EXPIRATION_INVALID');
  }
  return parsed.toISOString();
}

function sameInstant(left, right) {
  if (left == null || right == null) return left == null && right == null;
  const l = Date.parse(left);
  const r = Date.parse(right);
  return Number.isFinite(l) && Number.isFinite(r) && l === r;
}

function actorId(actor, { required = false } = {}) {
  const value = actor?.id ?? actor?.userId ?? actor?.accountId;
  if (value == null || !String(value).trim()) {
    if (required) throw new CommerceError('ator sem identificador estável', 'ACTOR_ID_REQUIRED');
    return 'legacy-platform-admin';
  }
  return String(value).trim().slice(0, MAX_ACTOR_ID);
}

function publicAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone ?? null,
    ativo: row.ativo,
    origem: row.origem,
  };
}

async function lockGlobal(trx) {
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [GLOBAL_LOCK_KEY]);
}

async function lockMailbox(trx, email) {
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-operational-email:${email}`]);
}

async function lockCompany(trx, empresaId) {
  await trx.query("SELECT pg_advisory_xact_lock(hashtextextended('commerce-membership:' || $1::text, 0))", [empresaId]);
}

async function lockCompanies(trx, companies) {
  const ids = [...new Set(companies.map(row => String(row.id || row.empresa_id || row.empresaId)))].sort();
  for (const empresaId of ids) await lockCompany(trx, empresaId);
  return ids;
}

async function listActiveCompanies(trx) {
  const result = await trx.query('SELECT id FROM empresas WHERE COALESCE(ativa, true) = true ORDER BY id');
  const companies = result.rows.map(row => ({ id: row.id }));
  await lockCompanies(trx, companies);
  return companies;
}

async function authorizeActor(actor, trx) {
  const legacyAllowed = String(actor?.role || '').toLowerCase() === 'admin'
    && (actor?.mainAdmin === true || actor?.platformAdmin === true)
    && actor?.pgAccount !== true
    && actor?.pgOperational !== true;
  if (legacyAllowed) return { actorId: actorId(actor), sqlGlobal: false };

  if (actor?.pgAccount === true) {
    const accountId = assertUuid(actor.id ?? actor.accountId, 'actorAccountId');
    const result = await trx.query(
      `SELECT g.account_id, g.ativo, g.expires_at, g.granted_by, a.ativo AS account_ativo
         FROM commerce_platform_grants g
         JOIN commerce_accounts a ON a.id = g.account_id
        WHERE g.account_id = $1 AND g.ativo = true AND a.ativo = true
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        LIMIT 1`,
      [accountId],
    );
    if (!result.rows[0]) throw new CommerceError('a conta SQL não possui administrador global ativo', 'PERMISSION_DENIED');
    return { actorId: accountId, sqlGlobal: true, grant: result.rows[0] };
  }

  throw new CommerceError('somente a administração global pode conceder ou revogar este acesso', 'PERMISSION_DENIED');
}

async function loadAcceptedSourceUser(trx, sourceUserId, { lock = true } = {}) {
  const sourceId = assertUuid(sourceUserId, 'sourceUserId');
  const lockClause = lock ? ' FOR UPDATE' : '';
  const result = await trx.query(
    `SELECT u.id, u.empresa_id, u.email, u.nome_completo, u.telefone, u.senha_hash, u.ativo
       FROM usuarios u
      WHERE u.id = $1 AND u.ativo = true
        AND EXISTS (
          SELECT 1 FROM commerce_operational_invites i
           WHERE i.usuario_id = u.id AND i.empresa_id = u.empresa_id
             AND i.status = 'used'
        )${lockClause}`,
    [sourceId],
  );
  return result.rows[0] || null;
}

async function assertSourceEligibility(trx, source, legacyUsers, reservedEmail) {
  if (!source) throw new CommerceError('identidade operacional aceita não encontrada ou inativa', 'ACCOUNT_NOT_FOUND');
  const email = normalizeEmail(source.email);
  const sqlMailbox = await trx.query(
    `SELECT id, empresa_id
       FROM usuarios
      WHERE lower(btrim(email)) = $1
      ORDER BY id`,
    [email],
  );
  if (!sqlMailbox.rows.some(row => String(row.id) === String(source.id))) {
    throw new CommerceError('a caixa postal da identidade SQL não é única', 'IDENTITY_AMBIGUOUS');
  }
  if (sqlMailbox.rows.length > 1) {
    const linked = await trx.query(
      `SELECT au.usuario_id
         FROM commerce_account_users au
         JOIN commerce_accounts a ON a.id = au.account_id
        WHERE a.origem = 'commerce' AND a.origem_id = $1
          AND au.usuario_id = ANY($2::uuid[])
        ORDER BY au.usuario_id`,
      [String(source.id), sqlMailbox.rows.map(row => row.id)],
    );
    if (linked.rows.length !== sqlMailbox.rows.length) {
      throw new CommerceError('a caixa postal da identidade SQL não é única', 'IDENTITY_AMBIGUOUS');
    }
  }
  if (legacyUsers.some(user => text(user?.email, 320).toLowerCase() === email)) {
    throw new CommerceError('a identidade SQL possui homônimo legado', 'IDENTITY_AMBIGUOUS');
  }
  if (await Promise.resolve(reservedEmail(email))) {
    throw new CommerceError('a caixa postal está reservada para outra identidade', 'IDENTITY_ALREADY_EXISTS');
  }
  const pending = await trx.query(
    `SELECT 1 FROM commerce_operational_invites
      WHERE email_norm = $1 AND status IN ('pending_email', 'sent')
      LIMIT 1`,
    [email],
  );
  if (pending.rows[0]) throw new CommerceError('a identidade possui convite pendente', 'IDENTITY_ALREADY_EXISTS');
  const company = await trx.query(
    'SELECT id FROM empresas WHERE id = $1 AND COALESCE(ativa, true) = true LIMIT 1',
    [source.empresa_id],
  );
  if (!company.rows[0]) throw new CommerceError('a empresa original da identidade está inativa', 'TENANT_NOT_FOUND');
  const membership = await trx.query(
    `SELECT m.id, m.ativo, m.expires_at, m.role_id, r.codigo AS role_codigo
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id
      WHERE m.empresa_id = $1 AND m.usuario_id = $2 AND m.loja_id IS NULL
        AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      ORDER BY m.atualizado_em DESC NULLS LAST, m.id
      LIMIT 1`,
    [source.empresa_id, source.id],
  );
  const role = membership.rows[0]?.role_codigo;
  const membershipActive = membership.rows[0]?.ativo === true
    && (membership.rows[0]?.expires_at == null || Date.parse(membership.rows[0].expires_at) > Date.now());
  let priorPromotion = false;
  if (membershipActive && role === PLATFORM_ROLE) {
    const linkedGrant = await trx.query(
      `SELECT 1 FROM commerce_account_users au
       JOIN commerce_accounts a ON a.id = au.account_id AND a.ativo = true
       JOIN commerce_platform_grants g ON g.account_id = a.id AND g.ativo = true
       JOIN commerce_platform_grant_memberships s ON s.account_id = a.id
         AND s.empresa_id = au.empresa_id AND s.usuario_id = au.usuario_id
         AND s.membership_id = $3
       WHERE au.usuario_id = $1 AND au.empresa_id = $2
         AND a.origem = 'commerce' AND a.origem_id = $1::text
       LIMIT 1`,
      [source.id, source.empresa_id, membership.rows[0].id],
    );
    priorPromotion = Boolean(linkedGrant.rows[0]);
  }
  if (!membershipActive || (role !== SOURCE_ROLE && !priorPromotion)) {
    throw new CommerceError('a identidade não possui membership operacional store_admin aceita', 'PERMISSION_DENIED');
  }
  return { email, membership: membership.rows[0] || null };
}

async function findAccountForSource(trx, source, email) {
  const byUser = await trx.query(
    `SELECT a.*
       FROM commerce_account_users au
       JOIN commerce_accounts a ON a.id = au.account_id
      WHERE au.usuario_id = $1
      FOR UPDATE OF a`,
    [source.id],
  );
  const byOrigin = await trx.query(
    `SELECT * FROM commerce_accounts
      WHERE origem = 'commerce' AND origem_id = $1
      FOR UPDATE`,
    [String(source.id)],
  );
  const accounts = new Map([...byUser.rows, ...byOrigin.rows].map(account => [String(account.id), account]));
  if (accounts.size > 1) throw new CommerceError('a identidade está ligada a mais de uma conta Commerce', 'IDENTITY_AMBIGUOUS');
  let account = [...accounts.values()][0] || null;
  const sameEmail = await trx.query('SELECT * FROM commerce_accounts WHERE email = $1 FOR UPDATE', [email]);
  for (const row of sameEmail.rows) {
    if (!account) throw new CommerceError('o e-mail já pertence a uma conta Commerce não ligada à identidade de origem', 'IDENTITY_ALREADY_EXISTS');
    if (String(row.id) !== String(account.id)) throw new CommerceError('e-mail ligado a outra conta Commerce', 'IDENTITY_ALREADY_EXISTS');
  }
  if (account && account.email !== email) throw new CommerceError('a conta ligada possui e-mail divergente', 'IDENTITY_AMBIGUOUS');
  if (account && account.ativo !== true) throw new CommerceError('a conta Commerce ligada está inativa', 'ACCOUNT_INACTIVE');
  return account;
}

async function ensureAccountAndOriginalLink(trx, source, email, account) {
  if (!account) {
    const result = await trx.query(
      `INSERT INTO commerce_accounts (email, nome, telefone, senha_hash, ativo, origem, origem_id)
       VALUES ($1, $2, $3, $4, true, 'commerce', $5)
       RETURNING *`,
      [email, source.nome_completo, source.telefone || null, source.senha_hash, String(source.id)],
    );
    account = result.rows[0];
  }
  const link = await trx.query(
    `SELECT account_id, empresa_id, usuario_id
       FROM commerce_account_users
      WHERE account_id = $1 AND empresa_id = $2
      FOR UPDATE`,
    [account.id, source.empresa_id],
  );
  if (link.rows[0] && String(link.rows[0].usuario_id) !== String(source.id)) {
    throw new CommerceError('a conta já possui outra identidade na empresa original', 'IDENTITY_AMBIGUOUS');
  }
  if (!link.rows[0]) {
    try {
      await trx.query(
        `INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id)
         VALUES ($1, $2, $3)`,
        [account.id, source.empresa_id, source.id],
      );
    } catch (error) {
      if (error?.code === '23505') throw new CommerceError('a identidade local já está ligada a outra conta', 'IDENTITY_ALREADY_EXISTS');
      throw error;
    }
  }
  return account;
}

async function roleId(trx, codigo) {
  const result = await trx.query(
    `SELECT id, codigo FROM commerce_roles
      WHERE empresa_id IS NULL AND codigo = $1 AND sistema = true
      LIMIT 1`,
    [codigo],
  );
  if (!result.rows[0]) throw new CommerceError(`papel ${codigo} não configurado`, 'ROLE_NOT_FOUND');
  return result.rows[0].id;
}

async function wouldRemoveLastTenantOwner(trx, empresaId, membershipId) {
  const result = await trx.query(
    `SELECT COUNT(*)::int AS total
       FROM commerce_memberships m
       JOIN usuarios u ON u.empresa_id = m.empresa_id AND u.id = m.usuario_id AND u.ativo = true
       JOIN commerce_roles r ON r.id = m.role_id
      WHERE m.empresa_id = $1 AND m.id <> $2 AND m.loja_id IS NULL
        AND m.ativo = true AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
        AND r.codigo = 'tenant_owner'`,
    [empresaId, membershipId],
  );
  return Number(result.rows[0]?.total || 0) === 0;
}

async function ensureTenantMembership(trx, account, empresaId, platformRoleId) {
  let createdLocal = false;
  let localUser;
  const mapped = await trx.query(
    `SELECT au.account_id, au.empresa_id, au.usuario_id,
            u.id AS local_id, u.email, u.nome_completo, u.senha_hash, u.ativo
       FROM commerce_account_users au
       JOIN usuarios u ON u.id = au.usuario_id AND u.empresa_id = au.empresa_id
      WHERE au.account_id = $1 AND au.empresa_id = $2
      FOR UPDATE OF au, u`,
    [account.id, empresaId],
  );
  if (mapped.rows[0]) {
    localUser = mapped.rows[0];
  } else {
    const conflict = await trx.query(
      `SELECT id FROM usuarios
        WHERE empresa_id = $1 AND lower(btrim(email)) = $2
        LIMIT 1
        FOR UPDATE`,
      [empresaId, account.email],
    );
    if (conflict.rows[0]) throw new CommerceError('o e-mail já pertence a outra identidade nesta empresa', 'IDENTITY_ALREADY_EXISTS');
    const created = await trx.query(
      `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo)
       VALUES ($1, $2, $3, $4, 'gerente', true)
       RETURNING id, empresa_id, email, nome_completo, senha_hash, ativo`,
      [empresaId, account.email, account.senha_hash, account.nome],
    );
    localUser = created.rows[0];
    createdLocal = true;
    try {
      await trx.query(
        `INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id)
         VALUES ($1, $2, $3)`,
        [account.id, empresaId, localUser.id],
      );
    } catch (error) {
      if (error?.code === '23505') throw new CommerceError('a identidade local já foi ligada durante a concessão', 'IDENTITY_ALREADY_EXISTS');
      throw error;
    }
  }

  const userId = localUser.local_id || localUser.id;
  if (localUser.ativo !== true) throw new CommerceError('a identidade local ligada está inativa', 'ACCOUNT_INACTIVE');
  const currentResult = await trx.query(
    `SELECT m.*, r.codigo AS role_codigo
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id
      WHERE m.empresa_id = $1 AND m.usuario_id = $2 AND m.loja_id IS NULL
        AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      FOR UPDATE OF m`,
    [empresaId, userId],
  );
  const current = currentResult.rows[0] || null;
  const snapshotResult = await trx.query(
    `SELECT * FROM commerce_platform_grant_memberships
      WHERE account_id = $1 AND empresa_id = $2
      FOR UPDATE`,
    [account.id, empresaId],
  );
  const snapshot = snapshotResult.rows[0] || null;

  if (current && current.role_codigo === 'tenant_owner'
      && current.ativo === true
      && (current.expires_at == null || Date.parse(current.expires_at) > Date.now())
      && await wouldRemoveLastTenantOwner(trx, empresaId, current.id)) {
    // A concessão global é revalidada pela conta, não exige remover o dono
    // empresarial. Preserva o último proprietário e seus direitos originais.
    return { createdLocal, changed: false };
  }

  if (!current) {
    const inserted = await trx.query(
      `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo, expires_at)
       VALUES ($1, $2, NULL, $3, true, NULL)
       RETURNING id`,
      [empresaId, userId, platformRoleId],
    );
    await trx.query(
      `INSERT INTO commerce_platform_grant_memberships
        (account_id, empresa_id, usuario_id, membership_id, previous_role_id, previous_active, previous_expires_at, created_local)
       VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5)
       ON CONFLICT (account_id, empresa_id) DO NOTHING`,
      [account.id, empresaId, userId, inserted.rows[0].id, createdLocal],
    );
    return { createdLocal, changed: true };
  }

  if (!snapshot) {
    await trx.query(
      `INSERT INTO commerce_platform_grant_memberships
        (account_id, empresa_id, usuario_id, membership_id, previous_role_id, previous_active, previous_expires_at, created_local)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id, empresa_id) DO NOTHING`,
      [account.id, empresaId, userId, current.id, current.role_id, current.ativo, current.expires_at, createdLocal],
    );
  }

  if (current.role_codigo !== PLATFORM_ROLE || current.ativo !== true || current.expires_at != null) {
    await trx.query(
      `UPDATE commerce_memberships
          SET role_id = $3, ativo = true, expires_at = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2`,
      [empresaId, current.id, platformRoleId],
    );
    return { createdLocal, changed: true };
  }
  // A pre-existing platform_owner is never downgraded. Its snapshot is kept
  // only as an explicit no-op marker and is skipped during revocation.
  return { createdLocal, changed: false };
}

async function syncAccountToCompanies(trx, account, companies) {
  const platformRoleId = await roleId(trx, PLATFORM_ROLE);
  let changed = 0;
  let createdLocalUsers = 0;
  for (const company of companies) {
    const result = await ensureTenantMembership(trx, account, company.id, platformRoleId);
    if (result.changed) changed += 1;
    if (result.createdLocal) createdLocalUsers += 1;
  }
  return { changed, createdLocalUsers };
}

async function accountGrantForUpdate(trx, accountId) {
  const result = await trx.query(
    `SELECT g.account_id, g.ativo, g.expires_at, g.granted_by, g.criado_em, g.atualizado_em,
            a.email, a.nome, a.telefone, a.senha_hash, a.origem, a.origem_id, a.ativo AS account_ativo
       FROM commerce_platform_grants g
       JOIN commerce_accounts a ON a.id = g.account_id
      WHERE g.account_id = $1
      FOR UPDATE OF g, a`,
    [accountId],
  );
  return result.rows[0] || null;
}

function resultShape(accountId, grant, idempotent) {
  return {
    ok: true,
    accountId: String(accountId),
    ativo: grant?.ativo === true,
    expiresAt: grant?.expires_at ?? null,
    idempotent: idempotent === true,
  };
}

export async function grantPlatformAdministrator(actor, input = {}, legacyUsers = [], reservedEmail = () => false, database = defaultDatabase) {
  const deps = normalizeDeps(legacyUsers, reservedEmail, database);
  if (input?.confirmGlobal !== true) throw new CommerceError('confirmação explícita de acesso global obrigatória', 'GLOBAL_CONFIRMATION_REQUIRED');
  const expiresAt = parseExpiry(input.expiresAt);
  const sourceUserId = assertUuid(input.sourceUserId, 'sourceUserId');

  return inTransaction(deps.database, async trx => {
    await lockGlobal(trx);
    // Authorization is deliberately before source/account lookup and before
    // every write. A denied actor must not be able to use a failed grant as a
    // side channel to create a canonical account or local identities.
    const actorAuthorization = await authorizeActor(actor, trx);
    let source = await loadAcceptedSourceUser(trx, sourceUserId, { lock: false });
    if (!source) throw new CommerceError('identidade operacional aceita não encontrada ou inativa', 'ACCOUNT_NOT_FOUND');
    await lockMailbox(trx, normalizeEmail(source.email));
    source = await loadAcceptedSourceUser(trx, sourceUserId, { lock: true });
    const sourceEligibility = await assertSourceEligibility(trx, source, deps.legacyUsers, deps.reservedEmail);
    const companies = await listActiveCompanies(trx);
    const existingAccount = await findAccountForSource(trx, source, sourceEligibility.email);
    if (actorAuthorization.sqlGlobal && existingAccount && String(actorAuthorization.actorId) === String(existingAccount.id)) {
      throw new CommerceError('um administrador global não pode conceder acesso à própria conta', 'SELF_ESCALATION');
    }
    const account = await ensureAccountAndOriginalLink(trx, source, sourceEligibility.email, existingAccount);
    const current = await accountGrantForUpdate(trx, account.id);

    if (current && current.account_ativo !== true) throw new CommerceError('a conta Commerce está inativa', 'ACCOUNT_INACTIVE');
    if (current && current.ativo === true && sameInstant(current.expires_at, expiresAt)) {
      const repaired = await syncAccountToCompanies(trx, account, companies);
      if (repaired.changed || repaired.createdLocalUsers) {
        await trx.query(
          `INSERT INTO commerce_account_audit (account_id, actor_id, acao, empresa_id, detalhes)
           VALUES ($1, $2, 'platform_granted', NULL, $3::jsonb)`,
          [account.id, actorAuthorization.actorId, JSON.stringify({ reconciliation: true, changedMemberships: repaired.changed, createdLocalUsers: repaired.createdLocalUsers })],
        );
      }
      return resultShape(account.id, current, true);
    }

    const synced = await syncAccountToCompanies(trx, account, companies);
    const grant = await trx.query(
      `INSERT INTO commerce_platform_grants (account_id, ativo, expires_at, granted_by)
       VALUES ($1, true, $2::timestamptz, $3)
       ON CONFLICT (account_id) DO UPDATE SET
         ativo = true,
         expires_at = EXCLUDED.expires_at,
         granted_by = EXCLUDED.granted_by,
         atualizado_em = CURRENT_TIMESTAMP
       RETURNING account_id, ativo, expires_at, granted_by`,
      [account.id, expiresAt, actorAuthorization.actorId],
    );
    await trx.query(
      `INSERT INTO commerce_account_audit (account_id, actor_id, acao, empresa_id, detalhes)
       VALUES ($1, $2, $3, NULL, $4::jsonb)`,
      [account.id, actorAuthorization.actorId, GRANT_ACTION, JSON.stringify({ sourceUserId, expiresAt, companies: companies.length, changedMemberships: synced.changed, createdLocalUsers: synced.createdLocalUsers })],
    );
    return resultShape(account.id, grant.rows[0], false);
  });
}

export async function revokePlatformAdministrator(actor, accountId, options = {}) {
  const id = assertUuid(accountId, 'accountId');
  const deps = normalizeDeps(options, null, null, null);
  return inTransaction(deps.database, async trx => {
    await lockGlobal(trx);
    const authorization = await authorizeActor(actor, trx);
    if (authorization.sqlGlobal && String(authorization.actorId) === String(id)) {
      throw new CommerceError('o administrador global não pode revogar a própria conta', 'SELF_REVOCATION_DENIED');
    }
    const current = await accountGrantForUpdate(trx, id);
    if (!current) throw new CommerceError('administrador global não encontrado', 'PLATFORM_GRANT_NOT_FOUND');
    await lockMailbox(trx, normalizeEmail(current.email));
    const snapshotCompanies = await trx.query(
      `SELECT empresa_id AS id
         FROM commerce_platform_grant_memberships
        WHERE account_id = $1
        ORDER BY empresa_id`,
      [id],
    );
    await lockCompanies(trx, snapshotCompanies.rows);

    if (current.ativo !== true) return resultShape(id, current, true);
    const snapshots = await trx.query(
      `SELECT s.*, m.role_id AS current_role_id, r.codigo AS current_role_codigo,
              m.ativo AS current_active, m.expires_at AS current_expires_at
         FROM commerce_platform_grant_memberships s
         LEFT JOIN commerce_memberships m ON m.id = s.membership_id
         LEFT JOIN commerce_roles r ON r.id = m.role_id
        WHERE s.account_id = $1
        ORDER BY s.empresa_id
        FOR UPDATE OF s`,
      [id],
    );
    for (const snapshot of snapshots.rows) {
      if (snapshot.current_role_codigo !== PLATFORM_ROLE) continue;
      if (snapshot.previous_role_id == null) {
        await trx.query(
          `UPDATE commerce_memberships
              SET ativo = false, expires_at = NULL, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $1 AND empresa_id = $2 AND usuario_id = $3 AND role_id = $4`,
          [snapshot.membership_id, snapshot.empresa_id, snapshot.usuario_id, snapshot.current_role_id],
        );
        if (snapshot.created_local === true) {
          await trx.query(
            `UPDATE usuarios u SET ativo = false, data_atualizacao = CURRENT_TIMESTAMP
              WHERE u.id = $1 AND u.empresa_id = $2
                AND NOT EXISTS (
                  SELECT 1 FROM commerce_memberships other
                   WHERE other.usuario_id = u.id AND other.empresa_id = u.empresa_id
                     AND other.id <> $3 AND other.ativo = true
                )`,
            [snapshot.usuario_id, snapshot.empresa_id, snapshot.membership_id],
          );
        }
      } else if (snapshot.previous_role_id !== snapshot.current_role_id) {
        await trx.query(
          `UPDATE commerce_memberships
              SET role_id = $4, ativo = $5, expires_at = $6::timestamptz, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $1 AND empresa_id = $2 AND usuario_id = $3 AND role_id = $7`,
          [snapshot.membership_id, snapshot.empresa_id, snapshot.usuario_id, snapshot.previous_role_id, snapshot.previous_active, snapshot.previous_expires_at, snapshot.current_role_id],
        );
      }
    }
    const authorizationActor = actorId(actor);
    await trx.query('UPDATE commerce_platform_grants SET ativo = false, atualizado_em = CURRENT_TIMESTAMP WHERE account_id = $1 AND ativo = true', [id]);
    await trx.query('DELETE FROM commerce_platform_grant_memberships WHERE account_id = $1', [id]);
    await trx.query(
      `INSERT INTO commerce_account_audit (account_id, actor_id, acao, empresa_id, detalhes)
       VALUES ($1, $2, $3, NULL, $4::jsonb)`,
      [id, authorizationActor, REVOKE_ACTION, JSON.stringify({ restoredMemberships: snapshots.rows.length })],
    );
    return { ok: true, accountId: String(id), ativo: false, expiresAt: null, idempotent: false };
  });
}

export async function findActivePlatformGrant(accountId, database = defaultDatabase) {
  const id = assertUuid(accountId, 'accountId');
  const query = readMethod(database);
  const result = await query(
    `SELECT g.account_id, g.ativo, g.expires_at, g.granted_by, g.criado_em, g.atualizado_em
       FROM commerce_platform_grants g
       JOIN commerce_accounts a ON a.id = g.account_id AND a.ativo = true
      WHERE g.account_id = $1 AND g.ativo = true
        AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
      LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function syncActivePlatformGrantsForTenant(trx, empresaId) {
  if (!trx || typeof trx.query !== 'function') throw new CommerceError('sync de administrador global requer transação', 'TRANSACTION_REQUIRED');
  const tenantId = assertUuid(empresaId, 'empresaId');
  await lockGlobal(trx);
  await lockCompany(trx, tenantId);
  const grants = await trx.query(
    `SELECT a.*
       FROM commerce_platform_grants g
       JOIN commerce_accounts a ON a.id = g.account_id AND a.ativo = true
      WHERE g.ativo = true AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
      ORDER BY a.id
      FOR UPDATE OF g, a`,
  );
  const platformRoleId = await roleId(trx, PLATFORM_ROLE);
  let changed = 0;
  let createdLocalUsers = 0;
  for (const account of grants.rows) {
    const result = await ensureTenantMembership(trx, account, tenantId, platformRoleId);
    if (result.changed) {
      changed += 1;
      await trx.query(
        `INSERT INTO commerce_account_audit (account_id, actor_id, acao, empresa_id, detalhes)
         VALUES ($1, 'system-provisioning', 'platform_tenant_added', $2, $3::jsonb)`,
        [account.id, tenantId, JSON.stringify({ createdLocal: result.createdLocal === true })],
      );
    }
    if (result.createdLocal) createdLocalUsers += 1;
  }
  return { empresaId: tenantId, grants: grants.rows.length, changed, createdLocalUsers };
}
