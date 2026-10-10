import express from 'express';
import { db } from './database.js';
import { assertAccountManager } from './commerce-accounts.js';
import { grantPlatformAdministrator, revokePlatformAdministrator } from './commerce-platform-grants.js';

function failure(res, error) {
  const code = error?.code || 'PLATFORM_GRANT_UNAVAILABLE';
  const status = ['PERMISSION_DENIED', 'SELF_ESCALATION', 'SELF_REVOCATION', 'SELF_REVOCATION_DENIED', 'ACTOR_ID_REQUIRED'].includes(code) ? 403
    : ['INVALID_ID', 'VALIDATION_ERROR', 'GLOBAL_CONFIRMATION_REQUIRED', 'MEMBERSHIP_EXPIRATION_INVALID', 'PLATFORM_GRANT_EXPIRATION_INVALID', 'PLATFORM_GRANT_CONFIRMATION_REQUIRED', 'IDENTITY_EMAIL_INVALID'].includes(code) ? 400
      : ['ACCOUNT_NOT_FOUND', 'USER_NOT_FOUND', 'PLATFORM_GRANT_NOT_FOUND'].includes(code) ? 404
        : ['IDENTITY_ALREADY_EXISTS', 'PLATFORM_GRANT_CONFLICT', 'LAST_TENANT_OWNER_REQUIRED', 'ACCOUNT_INACTIVE', 'IDENTITY_AMBIGUOUS'].includes(code) ? 409 : 503;
  return res.status(status).json({ error: status === 503 ? 'Gestão global temporariamente indisponível.' : status === 403 ? 'Acesso global não autorizado para esta operação.' : error.message, code });
}

export function createPlatformAdministratorRouter({ getLegacyUsers, reservedEmail }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    try { assertAccountManager(req.user); return next(); } catch (error) { return failure(res, error); }
  });
  router.get('/', async (req, res) => {
    try {
      const query = String(req.query.query || '').trim().slice(0, 120);
      const items = (await db.queryRead(`SELECT g.account_id AS "accountId", a.nome, a.email, g.ativo, g.expires_at AS "expiresAt"
        FROM commerce_platform_grants g JOIN commerce_accounts a ON a.id=g.account_id
        ORDER BY g.criado_em DESC LIMIT 100`)).rows;
      let candidates = [];
      if (query.length >= 3) {
        const search = query.replace(/[\\%_]/g, '\\$&');
        const result = await db.queryRead(`SELECT u.id AS "sourceUserId", u.nome_completo AS nome, u.email, e.nome AS "empresaNome"
          FROM usuarios u JOIN empresas e ON e.id=u.empresa_id AND e.ativa=true
          LEFT JOIN commerce_account_users au ON au.usuario_id=u.id
          WHERE u.ativo=true AND (u.email ILIKE '%'||$1||'%' OR u.nome_completo ILIKE '%'||$1||'%')
            AND NOT EXISTS (SELECT 1 FROM commerce_platform_grants gp WHERE gp.account_id=au.account_id AND gp.ativo=true)
          ORDER BY u.nome_completo,u.id LIMIT 25`, [search]);
        const legacy = getLegacyUsers();
        candidates = result.rows.filter(row => !reservedEmail(row.email) && !legacy.some(user => String(user.email).trim().toLowerCase() === row.email.trim().toLowerCase()));
      }
      return res.json({ candidates, items });
    } catch (error) { return failure(res, error); }
  });
  router.post('/', async (req, res) => {
    try {
      const result = await grantPlatformAdministrator(req.user, {
        sourceUserId: req.body?.sourceUserId, confirmGlobal: req.body?.confirmGlobal === true,
        expiresAt: req.body?.expiresAt,
      }, { legacyUsers: getLegacyUsers(), reservedEmail });
      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) { return failure(res, error); }
  });
  router.post('/:accountId/revoke', async (req, res) => {
    if (req.body?.confirmRevoke !== true) return res.status(400).json({ error: 'Confirme a revogação global.', code: 'GLOBAL_CONFIRMATION_REQUIRED' });
    try { return res.json(await revokePlatformAdministrator(req.user, req.params.accountId, { legacyUsers: getLegacyUsers() })); }
    catch (error) { return failure(res, error); }
  });
  return router;
}
