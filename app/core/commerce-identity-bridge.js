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
  const result = await db.query(
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
  const uniqueStores = [...new Set(result.rows.map(row => row.loja_id).filter(Boolean))];
  if (!lojaId && uniqueStores.length > 1) throw new CommerceError('selecione a loja antes de acessar o Commerce Core', 'STORE_SELECTION_REQUIRED', { stores: uniqueStores });
  const row = result.rows[0];
  if (lojaId && row.loja_id && row.loja_id !== lojaId) throw new CommerceError('loja fora do escopo da membership', 'STORE_SCOPE_MISMATCH');
  return tenantContext({ empresaId: row.empresa_id, lojaId: row.loja_id || lojaId || null, usuarioId: row.usuario_id });
}

export { requestedScope };
