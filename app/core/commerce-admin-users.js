import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';

function text(value, max = 120) { return String(value || '').trim().slice(0, max); }

export async function listRoles(trx, context) {
  const { empresaId } = tenantContext(context);
  const result = await trx.query(
    `SELECT r.id, r.codigo, r.nome, r.sistema,
            COALESCE(jsonb_agg(p.codigo ORDER BY p.codigo) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS permissoes
       FROM commerce_roles r
       LEFT JOIN commerce_role_permissions rp ON rp.role_id = r.id
       LEFT JOIN commerce_permissions p ON p.id = rp.permission_id
      WHERE r.empresa_id IS NULL OR r.empresa_id = $1
      GROUP BY r.id
      ORDER BY r.sistema DESC, r.nome ASC`,
    [empresaId],
  );
  return { items: result.rows };
}

export async function listMemberships(trx, context) {
  const { empresaId } = tenantContext(context);
  const result = await trx.query(
    `SELECT m.id, m.usuario_id, m.loja_id, m.ativo, m.mfa_obrigatorio, m.criado_em, m.atualizado_em,
            u.email, u.nome_completo, r.id AS role_id, r.codigo AS role_codigo, r.nome AS role_nome,
            l.nome AS loja_nome
       FROM commerce_memberships m
       JOIN usuarios u ON u.empresa_id = m.empresa_id AND u.id = m.usuario_id
       JOIN commerce_roles r ON r.id = m.role_id
       LEFT JOIN lojas l ON l.empresa_id = m.empresa_id AND l.id = m.loja_id
      WHERE m.empresa_id = $1
      ORDER BY m.atualizado_em DESC
      LIMIT 500`,
    [empresaId],
  );
  return { items: result.rows };
}

export async function createMembership(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const targetUserId = assertUuid(input.usuarioId, 'usuarioId');
  const roleId = assertUuid(input.roleId, 'roleId');
  const lojaId = input.lojaId ? assertUuid(input.lojaId, 'lojaId') : null;
  const user = await trx.query(`SELECT id FROM usuarios WHERE empresa_id = $1 AND id = $2 AND ativo = true LIMIT 1`, [empresaId, targetUserId]);
  if (!user.rows[0]) throw new CommerceError('usuário não encontrado no tenant', 'USER_NOT_FOUND');
  const role = await trx.query(`SELECT id FROM commerce_roles WHERE id = $1 AND (empresa_id IS NULL OR empresa_id = $2) LIMIT 1`, [roleId, empresaId]);
  if (!role.rows[0]) throw new CommerceError('papel não encontrado no tenant', 'ROLE_NOT_FOUND');
  if (lojaId) {
    const loja = await trx.query(`SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2 AND ativa = true LIMIT 1`, [empresaId, lojaId]);
    if (!loja.rows[0]) throw new CommerceError('loja não encontrada no tenant', 'STORE_NOT_FOUND');
  }
  const result = await trx.query(
    `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo, mfa_obrigatorio)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (empresa_id, usuario_id, loja_id)
     DO UPDATE SET role_id = EXCLUDED.role_id, ativo = EXCLUDED.ativo, mfa_obrigatorio = EXCLUDED.mfa_obrigatorio, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`,
    [empresaId, targetUserId, lojaId, roleId, input.ativo !== false, input.mfaObrigatorio === true],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'membership', $4, 'upserted', $5::jsonb)`,
    [empresaId, lojaId, usuarioId, result.rows[0].id, JSON.stringify({ targetUserId, roleId, ativo: input.ativo !== false })],
  );
  return result.rows[0];
}

export async function updateMembership(trx, context, membershipId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(membershipId, 'membershipId');
  const sets = [];
  const values = [empresaId, id];
  if (input.ativo !== undefined) { values.push(input.ativo === true); sets.push(`ativo = $${values.length}`); }
  if (input.mfaObrigatorio !== undefined) { values.push(input.mfaObrigatorio === true); sets.push(`mfa_obrigatorio = $${values.length}`); }
  if (input.roleId !== undefined) {
    const roleId = assertUuid(input.roleId, 'roleId');
    const role = await trx.query(`SELECT id FROM commerce_roles WHERE id = $1 AND (empresa_id IS NULL OR empresa_id = $2) LIMIT 1`, [roleId, empresaId]);
    if (!role.rows[0]) throw new CommerceError('papel não encontrado no tenant', 'ROLE_NOT_FOUND');
    values.push(roleId); sets.push(`role_id = $${values.length}`);
  }
  if (!sets.length) throw new CommerceError('nenhum campo de membership informado', 'NO_CHANGES');
  const result = await trx.query(`UPDATE commerce_memberships SET ${sets.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  if (!result.rows[0]) throw new CommerceError('membership não encontrada no tenant', 'MEMBERSHIP_NOT_FOUND');
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'membership', $4, 'updated', $5::jsonb)`,
    [empresaId, result.rows[0].loja_id || null, usuarioId, id, JSON.stringify({ fields: Object.keys(input) })],
  );
  return result.rows[0];
}
