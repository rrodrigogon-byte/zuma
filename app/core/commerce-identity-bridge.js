import { CommerceError, tenantContext } from './commerce-core.js';
import { db } from './database.js';

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
  if (!user?.email) throw new CommerceError('sessão sem e-mail para resolver identidade do Commerce Core', 'TENANT_CONTEXT_REQUIRED');
  const requested = requestedScope(req);
  const signedEmpresa = clean(user.empresaId);
  const signedLoja = clean(user.lojaId);
  const empresaId = requested.empresaId || signedEmpresa;
  const lojaId = requested.lojaId || signedLoja;
  const values = [String(user.email).trim().toLowerCase()];
  const predicates = ['lower(u.email) = $1', 'u.ativo = true', 'm.ativo = true'];
  if (empresaId) {
    values.push(empresaId);
    predicates.push(`m.empresa_id = $${values.length}`);
  }
  if (lojaId) {
    values.push(lojaId);
    predicates.push(`(m.loja_id = $${values.length} OR m.loja_id IS NULL)`);
  }
  const result = await db.queryRead(
    `SELECT u.id AS usuario_id, m.empresa_id, m.loja_id, m.role_id
       FROM usuarios u
       JOIN commerce_memberships m ON m.usuario_id = u.id
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
  return tenantContext({ empresaId: row.empresa_id, lojaId: row.loja_id || lojaId || null, usuarioId: row.usuario_id });
}

export async function requireCommercePermission(req, permissionInput) {
  const permission = clean(permissionInput, 120);
  if (!permission) throw new CommerceError('permissão do Commerce é obrigatória', 'PERMISSION_DENIED');
  const context = await resolveCommerceIdentity(req);
  const result = await db.queryRead(
    `SELECT 1
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = $1 OR r.empresa_id IS NULL)
       JOIN commerce_role_permissions rp ON rp.role_id = r.id
       JOIN commerce_permissions p ON p.id = rp.permission_id AND p.codigo = $2
      WHERE m.empresa_id = $1 AND m.usuario_id = $3 AND m.ativo = true
        AND (m.loja_id IS NULL OR m.loja_id = $4)
      LIMIT 1`,
    [context.empresaId, permission, context.usuarioId, context.lojaId],
  );
  if (!result.rows[0]) throw new CommerceError('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission });
  return context;
}

export { requestedScope };
