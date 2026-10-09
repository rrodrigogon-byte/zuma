import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db as defaultDb } from './database.js';

const INVITE_TTL_HOURS = 24;
const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class OperationalInviteError extends Error {
  constructor(message, code, details = undefined) {
    super(message);
    this.name = 'OperationalInviteError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function normalizeEmail(email) {
  const normalized = String(email ?? '').normalize('NFC').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized) || normalized.length > 320) {
    throw new OperationalInviteError('e-mail inválido', 'INVALID_EMAIL');
  }
  return normalized;
}

function assertUuid(value, field) {
  const normalized = String(value ?? '').trim();
  if (!UUID_RE.test(normalized)) throw new OperationalInviteError(`${field} inválido`, 'INVALID_ID', { field });
  return normalized;
}

function assertName(value) {
  const name = String(value ?? '').normalize('NFC').trim();
  if (!name || name.length > 255) throw new OperationalInviteError('nome inválido', 'INVALID_NAME');
  return name;
}

function assertPassword(password) {
  const value = String(password ?? '');
  if (
    value.length < 12
    || Buffer.byteLength(value, 'utf8') > 72
    || !/[a-z]/u.test(value)
    || !/[A-Z]/u.test(value)
    || !/[0-9]/u.test(value)
    || !/[^A-Za-z0-9\s]/u.test(value)
  ) {
    throw new OperationalInviteError('senha deve ter ao menos 12 caracteres e no máximo 72 bytes, com maiúscula, minúscula, número e símbolo', 'WEAK_PASSWORD');
  }
  return value;
}

function tokenHash(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function tokenForInvite() {
  return randomBytes(32).toString('base64url');
}

function queryMethod(database, read = false) {
  if (read && typeof database?.queryRead === 'function') return database.queryRead.bind(database);
  if (typeof database?.query === 'function') return database.query.bind(database);
  throw new OperationalInviteError('interface PostgreSQL indisponível', 'DATABASE_UNAVAILABLE');
}

function txMethod(transaction) {
  if (typeof transaction?.query !== 'function') throw new OperationalInviteError('transação PostgreSQL inválida', 'DATABASE_UNAVAILABLE');
  return transaction;
}

function resolveDatabase(options = {}) {
  return options.database || options.db || defaultDb;
}

async function inTransaction(database, callback, suppliedTrx = null) {
  if (suppliedTrx) return callback(txMethod(suppliedTrx));
  if (typeof database?.transaction !== 'function') throw new OperationalInviteError('transação PostgreSQL indisponível', 'DATABASE_UNAVAILABLE');
  return database.transaction(callback);
}

function mapOperationalUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id ?? row.empresaId,
    email: row.email,
    nome: row.nome_completo ?? row.nome,
    senhaHash: row.senha_hash ?? row.senhaHash,
    role: 'organizador',
    ativo: row.ativo === true,
  };
}

function inviteResult(row, extra = {}) {
  return {
    inviteId: row.id,
    empresaId: row.empresa_id,
    email: row.email_norm,
    nome: row.nome,
    status: row.status,
    expiresAt: row.expira_em,
    ...extra,
  };
}

function isSuccessfulSend(result) {
  return result?.ok === true && result?.sent !== false && result?.simulado !== true;
}

async function markInviteSent(database, inviteId, suppliedTrx = null) {
  return inTransaction(database, async trx => {
    const result = await trx.query(
      `UPDATE commerce_operational_invites
          SET status = 'sent', enviado_em = COALESCE(enviado_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending_email' AND expira_em > CURRENT_TIMESTAMP
        RETURNING id, empresa_id, email_norm, nome, status, expira_em`,
      [inviteId],
    );
    if (!result.rows[0]) throw new OperationalInviteError('convite não está pendente ou expirou', 'OPERATIONAL_INVITE_NOT_PENDING');
    await trx.query(
      `INSERT INTO commerce_audit_logs (empresa_id, entidade, entidade_id, acao, depois)
       VALUES ($1, 'operational_invite', $2, 'sent', $3::jsonb)`,
      [result.rows[0].empresa_id, inviteId, JSON.stringify({ status: 'sent', role: 'store_admin', scope: 'tenant' })],
    );
    return result.rows[0];
  }, suppliedTrx);
}

async function revokeInviteById(database, inviteId, suppliedTrx = null) {
  return inTransaction(database, async trx => {
    const result = await trx.query(
      `UPDATE commerce_operational_invites
          SET status = 'revoked', revogado_em = COALESCE(revogado_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('pending_email', 'sent')
        RETURNING id, empresa_id, email_norm, nome, status, expira_em`,
      [inviteId],
    );
    return result.rows[0] || null;
  }, suppliedTrx);
}

/**
 * Sends an already-created invite. The token is accepted only in-process and
 * is never read back from PostgreSQL. Successful sender resolution is the only
 * event that changes pending_email to sent.
 */
export async function sendOperationalInvite({ inviteId, token, sendInvite }, options = {}) {
  const database = resolveDatabase(options);
  const id = assertUuid(inviteId, 'inviteId');
  if (typeof sendInvite !== 'function') throw new OperationalInviteError('sender de convite obrigatório', 'INVITE_SENDER_REQUIRED');
  const clearToken = String(token ?? '');
  if (clearToken.length < 32) throw new OperationalInviteError('token de convite inválido', 'INVALID_INVITE_TOKEN');

  const row = await inTransaction(database, async trx => {
    const result = await trx.query(
      `SELECT id, empresa_id, email_norm, nome, status, expira_em
         FROM commerce_operational_invites
        WHERE id = $1 AND token_hash = $2
        FOR UPDATE`,
      [id, tokenHash(clearToken)],
    );
    const invite = result.rows[0];
    if (!invite || invite.status !== 'pending_email' || new Date(invite.expira_em).getTime() <= Date.now()) {
      throw new OperationalInviteError('convite inválido', 'OPERATIONAL_INVITE_INVALID');
    }
    return invite;
  }, options.trx);

  let sent = false;
  let failureCode = 'OPERATIONAL_INVITE_SEND_FAILED';
  try {
    // No logs, return values, or error details contain the token or e-mail.
    const senderResult = await sendInvite({
      inviteId: row.id,
      empresaId: row.empresa_id,
      email: row.email_norm,
      nome: row.nome,
      token: clearToken,
      expiresAt: row.expira_em,
    });
    sent = isSuccessfulSend(senderResult);
    if (['MAIL_REJECTED', 'MAIL_UNCERTAIN', 'MAIL_NOT_CONFIGURED'].includes(senderResult?.code)) {
      failureCode = senderResult.code;
    }
  } catch {
    sent = false;
  }
  if (!sent) {
    await revokeInviteById(database, id, options.trx);
    throw new OperationalInviteError('não foi possível enviar o convite', failureCode);
  }
  const marked = await markInviteSent(database, id, options.trx);
  return { ok: true, ...inviteResult(marked) };
}

/**
 * Reserves a normalized e-mail and optionally dispatches it. The clear token
 * exists only in this invocation and is supplied to the in-process sender.
 */
export async function issueOperationalInvite({ empresaId, email, nome, legacyEmailAvailable = true, sendInvite } = {}, options = {}) {
  const database = resolveDatabase(options);
  const tenantId = assertUuid(empresaId, 'empresaId');
  const emailNorm = normalizeEmail(email);
  const name = assertName(nome);
  if (legacyEmailAvailable === false) throw new OperationalInviteError('e-mail já possui cadastro legado', 'OPERATIONAL_EMAIL_RESERVED');
  if (typeof legacyEmailAvailable === 'function' && !(await legacyEmailAvailable(emailNorm))) {
    throw new OperationalInviteError('e-mail já possui cadastro legado', 'OPERATIONAL_EMAIL_RESERVED');
  }

  const clearToken = tokenForInvite();
  const hash = tokenHash(clearToken);
  const created = await inTransaction(database, async trx => {
    // Same advisory key across all tenants makes e-mail reservation atomic even
    // before the partial unique index is evaluated.
    await trx.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`commerce-operational-email:${emailNorm}`],
    );
    const company = await trx.query(
      `SELECT id FROM empresas WHERE id = $1 AND COALESCE(ativa, true) = true FOR UPDATE`,
      [tenantId],
    );
    if (!company.rows[0]) throw new OperationalInviteError('empresa inexistente ou inativa', 'TENANT_NOT_ACTIVE');
    const role = await trx.query(
      `SELECT id FROM commerce_roles WHERE empresa_id IS NULL AND codigo = 'store_admin' AND sistema = true LIMIT 1`,
    );
    if (!role.rows[0]) throw new OperationalInviteError('role store_admin indisponível', 'OPERATIONAL_ROLE_NOT_CONFIGURED');

    // Expired pending rows no longer reserve a mailbox; they are revoked rather
    // than silently reused, preserving the audit trail and fail-closed status.
    await trx.query(
      `UPDATE commerce_operational_invites
          SET status = 'revoked', revogado_em = COALESCE(revogado_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
        WHERE email_norm = $1 AND status IN ('pending_email', 'sent') AND expira_em <= CURRENT_TIMESTAMP`,
      [emailNorm],
    );
    const user = await trx.query(
      `SELECT 1 FROM usuarios WHERE lower(btrim(email)) = $1
       UNION ALL SELECT 1 FROM commerce_accounts WHERE email = $1 LIMIT 1`,
      [emailNorm],
    );
    if (user.rows[0]) throw new OperationalInviteError('e-mail já está associado a um usuário', 'OPERATIONAL_EMAIL_RESERVED');
    const existing = await trx.query(
      `SELECT 1 FROM commerce_operational_invites WHERE email_norm = $1 AND status IN ('pending_email', 'sent', 'used') LIMIT 1`,
      [emailNorm],
    );
    if (existing.rows[0]) throw new OperationalInviteError('e-mail já está reservado', 'OPERATIONAL_EMAIL_RESERVED');

    try {
      const inserted = await trx.query(
        `INSERT INTO commerce_operational_invites
          (empresa_id, email_norm, nome, token_hash, status, expira_em)
         VALUES ($1, $2, $3, $4, 'pending_email', CURRENT_TIMESTAMP + INTERVAL '24 hours')
         RETURNING id, empresa_id, email_norm, nome, status, expira_em`,
        [tenantId, emailNorm, name, hash],
      );
      await trx.query(
        `INSERT INTO commerce_audit_logs (empresa_id, entidade, entidade_id, acao, depois)
         VALUES ($1, 'operational_invite', $2, 'issued', $3::jsonb)`,
        [tenantId, inserted.rows[0].id, JSON.stringify({ status: 'pending_email', role: 'store_admin', scope: 'tenant' })],
      );
      return inserted.rows[0];
    } catch (error) {
      if (error?.code === '23505') throw new OperationalInviteError('e-mail já está reservado', 'OPERATIONAL_EMAIL_RESERVED');
      throw error;
    }
  }, options.trx);

  if (typeof sendInvite !== 'function') return { ok: true, ...inviteResult(created) };
  return sendOperationalInvite({ inviteId: created.id, token: clearToken, sendInvite }, options);
}

export async function revokeOperationalInvite(input, options = {}) {
  const database = resolveDatabase(options);
  const inviteId = typeof input === 'string' ? input : input?.inviteId;
  const id = assertUuid(inviteId, 'inviteId');
  const row = await revokeInviteById(database, id, options.trx);
  return row ? inviteResult(row) : { inviteId: id, status: 'unchanged' };
}

/**
 * Consumes a sent invite exactly once. The row lock, mailbox advisory lock,
 * user check and user/membership/invite writes all share one transaction.
 */
export async function acceptOperationalInvite({ token, password, legacyEmailAvailable } = {}, options = {}) {
  const database = resolveDatabase(options);
  const clearToken = String(token ?? '');
  if (clearToken.length < 32) throw new OperationalInviteError('convite inválido', 'OPERATIONAL_INVITE_INVALID');
  const strongPassword = assertPassword(password);
  const passwordHash = await bcrypt.hash(strongPassword, BCRYPT_ROUNDS);
  const hash = tokenHash(clearToken);

  return inTransaction(database, async trx => {
    // Emissão e aceite usam a mesma ordem de locks: caixa postal, convite,
    // empresa. Não prender a linha antes de esperar a reserva da identidade.
    const candidate = await trx.query(
      `SELECT email_norm FROM commerce_operational_invites WHERE token_hash = $1`,
      [hash],
    );
    if (!candidate.rows[0]) throw new OperationalInviteError('convite inválido', 'OPERATIONAL_INVITE_INVALID');
    await trx.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`commerce-operational-email:${candidate.rows[0].email_norm}`],
    );
    const inviteResultQuery = await trx.query(
      `SELECT i.id, i.empresa_id, i.email_norm, i.nome, i.status, i.expira_em
         FROM commerce_operational_invites i
        WHERE i.token_hash = $1
        FOR UPDATE`,
      [hash],
    );
    const invite = inviteResultQuery.rows[0];
    if (!invite || invite.status !== 'sent' || new Date(invite.expira_em).getTime() <= Date.now()) {
      throw new OperationalInviteError('convite inválido', 'OPERATIONAL_INVITE_INVALID');
    }
    if (legacyEmailAvailable === false) {
      throw new OperationalInviteError('e-mail já possui cadastro legado', 'OPERATIONAL_EMAIL_RESERVED');
    }
    if (typeof legacyEmailAvailable === 'function') {
      let available = false;
      try { available = await legacyEmailAvailable(invite.email_norm); } catch { available = false; }
      if (!available) throw new OperationalInviteError('e-mail já possui cadastro legado', 'OPERATIONAL_EMAIL_RESERVED');
    }
    const company = await trx.query(
      `SELECT id FROM empresas WHERE id = $1 AND COALESCE(ativa, true) = true FOR UPDATE`,
      [invite.empresa_id],
    );
    if (!company.rows[0]) throw new OperationalInviteError('empresa inexistente ou inativa', 'TENANT_NOT_ACTIVE');
    const userRows = await trx.query(
      `SELECT id FROM usuarios WHERE lower(btrim(email)) = $1 FOR UPDATE`,
      [invite.email_norm],
    );
    if (userRows.rows.length) throw new OperationalInviteError('e-mail já está associado a um usuário', 'OPERATIONAL_EMAIL_RESERVED');
    const roleRows = await trx.query(
      `SELECT id FROM commerce_roles WHERE empresa_id IS NULL AND codigo = 'store_admin' AND sistema = true LIMIT 1`,
    );
    if (!roleRows.rows[0]) throw new OperationalInviteError('role store_admin indisponível', 'OPERATIONAL_ROLE_NOT_CONFIGURED');

    let user;
    try {
      const userResult = await trx.query(
        `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo)
         VALUES ($1, $2, $3, $4, 'gerente', true)
         RETURNING id, empresa_id, email, nome_completo, senha_hash, ativo`,
        [invite.empresa_id, invite.email_norm, passwordHash, invite.nome],
      );
      user = userResult.rows[0];
      await trx.query(
        `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
         VALUES ($1, $2, NULL, $3, true)`,
        [invite.empresa_id, user.id, roleRows.rows[0].id],
      );
      await trx.query(
        `UPDATE commerce_operational_invites
            SET status = 'used', usado_em = CURRENT_TIMESTAMP, usuario_id = $2, atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $1 AND status = 'sent'
          RETURNING id`,
        [invite.id, user.id],
      );
      await trx.query(
        `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
         VALUES ($1, $2, 'operational_invite', $3, 'accepted', $4::jsonb)`,
        [invite.empresa_id, user.id, invite.id, JSON.stringify({ role: 'store_admin', scope: 'tenant', status: 'used' })],
      );
    } catch (error) {
      if (error?.code === '23505') throw new OperationalInviteError('e-mail já está associado a um usuário', 'OPERATIONAL_EMAIL_RESERVED');
      throw error;
    }
    return mapOperationalUser(user);
  }, options.trx);
}

export async function findOperationalByEmail(email, options = {}) {
  const database = resolveDatabase(options);
  const emailNorm = normalizeEmail(email);
  const query = queryMethod(database, true);
  const result = await query(
    `SELECT u.id, u.empresa_id, u.email, u.nome_completo, u.senha_hash, u.ativo
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id AND COALESCE(e.ativa, true) = true
       JOIN commerce_operational_invites i ON i.usuario_id = u.id AND i.empresa_id = u.empresa_id
         AND i.email_norm = lower(btrim(u.email)) AND i.status = 'used'
       JOIN commerce_memberships m ON m.empresa_id = u.empresa_id AND m.usuario_id = u.id
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE lower(btrim(u.email)) = $1
        AND u.ativo = true AND m.ativo = true AND m.loja_id IS NULL
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND r.empresa_id IS NULL AND r.codigo = 'store_admin'
      ORDER BY u.id
      LIMIT 2`,
    [emailNorm],
  );
  // Duplicate legacy e-mails fail closed; never guess a tenant or password.
  return result.rows.length === 1 ? mapOperationalUser(result.rows[0]) : null;
}

export async function resolveOperationalById(input, maybeEmpresaId, options = {}) {
  const payload = typeof input === 'object' && input !== null
    ? input
    : { userId: input, empresaId: maybeEmpresaId };
  const database = resolveDatabase(payload.database || payload.db ? payload : options);
  const userId = assertUuid(payload.userId ?? payload.id, 'userId');
  const empresaId = assertUuid(payload.empresaId, 'empresaId');
  const query = queryMethod(database, true);
  const result = await query(
    `SELECT u.id, u.empresa_id, u.email, u.nome_completo, u.senha_hash, u.ativo
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id AND COALESCE(e.ativa, true) = true
       JOIN commerce_operational_invites i ON i.usuario_id = u.id AND i.empresa_id = u.empresa_id
         AND i.email_norm = lower(btrim(u.email)) AND i.status = 'used'
       JOIN commerce_memberships m ON m.empresa_id = u.empresa_id AND m.usuario_id = u.id
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE u.id = $1 AND u.empresa_id = $2
        AND u.ativo = true AND m.ativo = true AND m.loja_id IS NULL
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND r.empresa_id IS NULL AND r.codigo = 'store_admin'
      LIMIT 2`,
    [userId, empresaId],
  );
  return result.rows.length === 1 ? mapOperationalUser(result.rows[0]) : null;
}

export async function isOperationalEmailReserved(email, options = {}) {
  const database = resolveDatabase(options);
  const emailNorm = normalizeEmail(email);
  const query = queryMethod(database, true);
  const result = await query(
    `SELECT 1 AS reserved
       FROM usuarios
      WHERE lower(btrim(email)) = $1
      UNION ALL
     SELECT 1 AS reserved FROM commerce_accounts WHERE email = $1
      UNION ALL
     SELECT 1 AS reserved
       FROM commerce_operational_invites
      WHERE email_norm = $1 AND status IN ('pending_email', 'sent', 'used')
      LIMIT 1`,
    [emailNorm],
  );
  return Boolean(result.rows[0]);
}

export { normalizeEmail, assertPassword, tokenHash };
