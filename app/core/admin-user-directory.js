// Contas legadas e Commerce têm identidades distintas: nunca unir por e-mail.
// A autorização é decidida pelo servidor antes de chamar este módulo.
export const DIRECTORY_SQL = `
  SELECT u.id, u.empresa_id, u.nome_completo, u.email, u.ativo, e.nome AS empresa_nome,
         m.id AS membership_id, m.ativo AS membership_ativo, m.loja_id,
         l.nome AS loja_nome, r.codigo AS role_codigo, r.nome AS role_nome,
         COALESCE((SELECT array_agg(p.codigo ORDER BY p.codigo)
                     FROM commerce_role_permissions rp
                     JOIN commerce_permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = r.id), ARRAY[]::varchar[]) AS role_permissions
    FROM usuarios u
    JOIN empresas e ON e.id = u.empresa_id
    LEFT JOIN commerce_memberships m ON m.empresa_id = u.empresa_id AND m.usuario_id = u.id
         AND ($2::uuid IS NULL OR m.loja_id = $2 OR m.loja_id IS NULL)
    LEFT JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = u.empresa_id OR r.empresa_id IS NULL)
    LEFT JOIN lojas l ON l.empresa_id = u.empresa_id AND l.id = m.loja_id
   WHERE ($1::uuid IS NULL OR u.empresa_id = $1)
     AND ($2::uuid IS NULL OR m.id IS NOT NULL)
   ORDER BY e.nome, u.nome_completo, u.id, m.id`;

function compact(value) { return String(value || '').trim(); }

export function projectCommerceAccounts(rows = []) {
  const accounts = new Map();
  for (const row of rows) {
    const key = `${row.empresa_id}:${row.id}`;
    if (!accounts.has(key)) accounts.set(key, {
      key: `commerce:${key}`, id: row.id, origem: 'commerce',
      empresaId: row.empresa_id, empresaNome: row.empresa_nome,
      nome: row.nome_completo, email: row.email, ativo: row.ativo === true,
      vinculos: [], permissoes: [], acessoAtivo: false,
    });
    const account = accounts.get(key);
    if (!row.membership_id) continue;
    const role = {
      codigo: compact(row.role_codigo), nome: compact(row.role_nome),
      lojaId: row.loja_id || null, lojaNome: row.loja_nome || null,
      ativo: row.membership_ativo === true,
    };
    account.vinculos.push(role);
    if (account.ativo && role.ativo) {
      account.acessoAtivo = true;
      account.permissoes = [...new Set([...account.permissoes, ...(row.role_permissions || [])])].sort();
    }
  }
  return [...accounts.values()];
}

export function projectLegacyAccounts(users = [], { allCompanies = false, empresaId = null, lojaId = null, companyNames = new Map() } = {}) {
  return users.filter(user => allCompanies || (empresaId && String(user.empresaId || '') === String(empresaId)
    && (!lojaId || String(user.lojaId || '') === String(lojaId))))
    .map(user => ({
      key: `legacy:${user.id}`, id: user.id, origem: 'legado',
      empresaId: user.empresaId || null,
      empresaNome: user.empresaId ? companyNames.get(String(user.empresaId)) || String(user.empresaId) : 'Plataforma',
      nome: user.nome || '', email: user.email || '', ativo: user.ativo !== false, acessoAtivo: user.ativo !== false,
      vinculos: [{ codigo: String(user.role || ''), nome: String(user.role || ''), lojaId: user.lojaId || null, lojaNome: null, ativo: user.ativo !== false }],
      // Papéis JSON não têm uma matriz de permissions SQL: não presumir autoridade.
      permissoes: [],
    }));
}

export async function listAdminUserDirectory({ commerceDb, legacyUsers, allCompanies, empresaId = null, lojaId = null, coreEnabled }) {
  if (coreEnabled !== true && !allCompanies) {
    return { usuarios: projectLegacyAccounts(legacyUsers, { empresaId, lojaId }), fontes: ['legado'], completo: false };
  }
  if (coreEnabled !== true) {
    return { usuarios: projectLegacyAccounts(legacyUsers, { allCompanies }), fontes: ['legado'], completo: false };
  }
  const result = await commerceDb.queryRead(DIRECTORY_SQL, [allCompanies ? null : empresaId, allCompanies ? null : lojaId]);
  const commerce = projectCommerceAccounts(result.rows || []);
  const names = new Map(commerce.map(account => [String(account.empresaId), account.empresaNome]));
  const legacy = projectLegacyAccounts(legacyUsers, { allCompanies, empresaId, lojaId, companyNames: names });
  return {
    usuarios: [...legacy, ...commerce].sort((a, b) => `${a.empresaNome} ${a.nome}`.localeCompare(`${b.empresaNome} ${b.nome}`, 'pt-BR')),
    fontes: ['legado', 'commerce'], completo: true,
  };
}
