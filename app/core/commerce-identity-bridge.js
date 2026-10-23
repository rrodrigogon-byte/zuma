import { CommerceError, tenantContext } from './commerce-core.js';
import { restricaoDePermissao } from './perfis-acesso.js';
import { db } from './database.js';
import { accountRequestIdentity } from './commerce-accounts.js';

function clean(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function requestedScope(req) {
  return {
    empresaId: clean(req.headers['x-empresa-id']),
    lojaId: clean(req.headers['x-loja-id']),
  };
}

/**
 * A sessão legada é apenas uma pista de identidade. O escopo efetivo sempre
 * vem de usuarios + commerce_memberships no PostgreSQL. Nenhum tenant enviado
 * pelo navegador é aceito sem ser associado ao e-mail/usuário autenticado.
 */
export async function resolveCommerceIdentity(req) {
  const user = req.user;
  if (user?.pgAccount === true) {
    const context = accountRequestIdentity(user, requestedScope(req));
    if (context.lojaId) {
      const store = await db.queryRead('SELECT 1 FROM lojas WHERE id=$1 AND empresa_id=$2 AND ativa=true', [context.lojaId, context.empresaId]);
      if (!store.rows[0]) throw new CommerceError('Unidade fora do escopo da empresa.', 'STORE_SCOPE_MISMATCH');
    }
    return tenantContext(context);
  }
  if (user?.pgOperational === true) {
    const empresaId = clean(user.empresaId);
    const lojaId = clean(req.headers['x-loja-id']);
    if (!empresaId || !user.id || (req.headers['x-empresa-id'] && clean(req.headers['x-empresa-id']) !== empresaId)) {
      throw new CommerceError('empresa fora do escopo da sessão', 'TENANT_CONTEXT_REQUIRED');
    }
    const result = await db.queryRead(
      `SELECT u.id AS usuario_id, m.empresa_id
         FROM usuarios u
         JOIN commerce_memberships m ON m.empresa_id = u.empresa_id AND m.usuario_id = u.id
         JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
        WHERE u.id = $1 AND u.empresa_id = $2 AND u.ativo = true
          AND m.ativo = true AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
          AND m.loja_id IS NULL AND r.codigo = 'store_admin'
        LIMIT 1`,
      [user.id, empresaId],
    );
    if (!result.rows[0]) throw new CommerceError('administrador operacional sem vínculo ativo', 'PERMISSION_DENIED');
    if (lojaId) {
      const store = await db.queryRead('SELECT 1 FROM lojas WHERE id = $1 AND empresa_id = $2 AND ativa = true LIMIT 1', [lojaId, empresaId]);
      if (!store.rows[0]) throw new CommerceError('loja fora do escopo da sessão', 'STORE_SCOPE_MISMATCH');
    }
    return tenantContext({ empresaId, lojaId: lojaId || null, usuarioId: user.id });
  }
  if (!user?.email) throw new CommerceError('sessão sem e-mail para resolver identidade do Commerce Core', 'TENANT_CONTEXT_REQUIRED');
  // Convite aceito pertence somente à identidade SQL assinada, nunca a uma
  // conta JSON homônima (incluindo JWT legado criado antes do convite).
  const reserved = await db.queryRead(
    `SELECT 1 FROM commerce_operational_invites
      WHERE email_norm = $1 AND status IN ('pending_email','sent','used') LIMIT 1`,
    [String(user.email).trim().toLowerCase()],
  );
  if (reserved.rows[0]) throw new CommerceError('identidade convidada requer sessão canônica', 'PERMISSION_DENIED');
  // Um e-mail pode existir em duas linhas de usuarios de empresas diferentes.
  // O JWT JSON legado não vincula um id SQL imutável: escolher o tenant pelo
  // header permitiria agir como a outra pessoa. Negar até haver migração de
  // identidade canônica, inclusive quando ambas as memberships estão ativas.
  const email = String(user.email).trim().toLowerCase();
  const identityMatches = await db.queryRead(
    `SELECT u.id FROM usuarios u WHERE lower(btrim(u.email)) = $1 AND u.ativo = true LIMIT 2`,
    [email],
  );
  if (identityMatches.rows.length > 1 && user.mainAdmin !== true && user.platformAdmin !== true) {
    throw new CommerceError('identidade ambígua; acesso requer validação administrativa', 'IDENTITY_AMBIGUOUS');
  }
  const requested = requestedScope(req);
  const signedEmpresa = clean(user.empresaId);
  const signedLoja = clean(user.lojaId);
  const empresaId = requested.empresaId || signedEmpresa;
  const lojaId = requested.lojaId || signedLoja;
  const values = [email];
  const predicates = ['lower(u.email) = $1', 'u.ativo = true', 'm.ativo = true', '(m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)'];
  if (empresaId) {
    values.push(empresaId);
    predicates.push(`m.empresa_id = $${values.length}`);
  }
  if (lojaId) {
    values.push(lojaId);
    predicates.push(`(m.loja_id = $${values.length} OR m.loja_id IS NULL)`);
  }
  const result = await db.queryRead(
    `SELECT u.id AS usuario_id, m.empresa_id, m.loja_id, m.role_id, m.expires_at
       FROM usuarios u
       JOIN commerce_memberships m ON m.usuario_id = u.id AND m.empresa_id = u.empresa_id
      WHERE ${predicates.join(' AND ')}
      ORDER BY CASE WHEN m.loja_id IS NOT NULL THEN 0 ELSE 1 END, m.atualizado_em DESC
      LIMIT 20`,
    values,
  );
  if (!result.rows.length) throw new CommerceError('usuário sem membership ativa no Commerce Core', 'TENANT_CONTEXT_REQUIRED');
  const uniqueTenants = [...new Set(result.rows.map(row => row.empresa_id))];
  if (!empresaId && uniqueTenants.length > 1) throw new CommerceError('selecione a empresa antes de acessar o Commerce Core', 'TENANT_SELECTION_REQUIRED', { tenants: uniqueTenants });
  const tenantWideMembership = result.rows.find(row => row.loja_id === null);
  const uniqueStores = [...new Set(result.rows.map(row => row.loja_id).filter(Boolean))];
  // A membership sem loja representa o tenant inteiro. Ela autoriza o usuário
  // a visualizar e administrar as lojas do próprio tenant, sem exigir um
  // X-Loja-Id arbitrário no primeiro carregamento do backoffice.
  if (!lojaId && !tenantWideMembership && uniqueStores.length > 1) throw new CommerceError('selecione a loja antes de acessar o Commerce Core', 'STORE_SELECTION_REQUIRED', { stores: uniqueStores });
  const row = lojaId
    ? (result.rows.find(item => item.loja_id === lojaId) || tenantWideMembership || result.rows[0])
    : (tenantWideMembership || result.rows[0]);
  if (lojaId && row.loja_id && row.loja_id !== lojaId) throw new CommerceError('loja fora do escopo da membership', 'STORE_SCOPE_MISMATCH');
  return tenantContext({ empresaId: row.empresa_id, lojaId: row.loja_id || lojaId || null, usuarioId: row.usuario_id, membershipExpiresAt: row.expires_at });
}

export async function requireCommercePermission(req, permissionInput) {
  const permission = clean(permissionInput, 120);
  if (!permission) throw new CommerceError('permissão do Commerce é obrigatória', 'PERMISSION_DENIED');
  if (req.user?.pgOperational === true && permission === 'users.write') {
    throw new CommerceError('gestão de usuários indisponível para este perfil', 'PERMISSION_DENIED');
  }
  // perfil operador/profissional limita o vínculo (core/perfis-acesso.js)
  const restricao = restricaoDePermissao(req, permission);
  if (restricao) throw new CommerceError(restricao, 'PERMISSION_DENIED', { permission, perfil: true });
  const context = await resolveCommerceIdentity(req);
  const result = await db.queryRead(
    `SELECT 1
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = $1 OR r.empresa_id IS NULL)
       JOIN commerce_role_permissions rp ON rp.role_id = r.id
       JOIN commerce_permissions p ON p.id = rp.permission_id AND p.codigo = $2
      WHERE m.empresa_id = $1 AND m.usuario_id = $3 AND m.ativo = true
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND (m.loja_id IS NULL OR m.loja_id = $4)
      LIMIT 1`,
    [context.empresaId, permission, context.usuarioId, context.lojaId],
  );
  if (!result.rows[0]) throw new CommerceError('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission });
  return context;
}

export { requestedScope };
