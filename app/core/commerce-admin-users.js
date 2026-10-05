import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';

function text(value, max = 120) { return String(value || '').trim().slice(0, max); }

function parseMembershipExpiration(input = {}) {
  const hasCamel = Object.prototype.hasOwnProperty.call(input, 'expiresAt');
  const hasSnake = Object.prototype.hasOwnProperty.call(input, 'expires_at');
  if (!hasCamel && !hasSnake) return { provided: false, value: undefined };
  const raw = hasCamel ? input.expiresAt : input.expires_at;
  if (raw === null) return { provided: true, value: null };
  if (typeof raw !== 'string' || !raw.trim()) throw new CommerceError('validade da membership inválida', 'MEMBERSHIP_EXPIRATION_INVALID');
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw new CommerceError('validade da membership inválida', 'MEMBERSHIP_EXPIRATION_INVALID');
  return { provided: true, value: new Date(timestamp).toISOString() };
}

function effectiveMembership(row) {
  if (row?.ativo !== true) return false;
  if (row.expires_at == null) return true;
  const timestamp = Date.parse(row.expires_at);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

const ROLE_RANK = Object.freeze({
  customer: 10,
  support: 30,
  order_operator: 40,
  catalog_manager: 50,
  inventory_manager: 50,
  finance: 50,
  store_admin: 70,
  tenant_owner: 90,
  platform_owner: 100,
});

function rank(role) {
  return ROLE_RANK[String(role?.codigo || '').trim().toLowerCase()] || 60;
}

async function lockTenantMembershipMutations(trx, empresaId) {
  await trx.query(`SELECT pg_advisory_xact_lock(hashtextextended('commerce-membership:' || $1::text, 0))`, [empresaId]);
}

async function actorAuthorization(trx, context) {
  const result = await trx.query(
    `SELECT r.id, r.codigo, r.empresa_id, m.loja_id
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE m.empresa_id = $1 AND m.usuario_id = $2 AND m.ativo = true
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND (m.loja_id IS NULL OR m.loja_id = $3::uuid)
        AND EXISTS (
          SELECT 1 FROM commerce_role_permissions rp
          JOIN commerce_permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = r.id AND p.codigo = 'users.write'
        )
      ORDER BY CASE r.codigo WHEN 'platform_owner' THEN 100 WHEN 'tenant_owner' THEN 90 ELSE 60 END DESC
      FOR UPDATE OF m`,
    [context.empresaId, context.usuarioId, context.lojaId],
  );
  const actor = result.rows.sort((a, b) => rank(b) - rank(a))[0];
  if (!actor) throw new CommerceError('permissão insuficiente para administrar memberships', 'PERMISSION_DENIED');
  return actor;
}

async function targetRole(trx, empresaId, roleId) {
  const result = await trx.query(
    `SELECT r.id, r.codigo, r.empresa_id
       FROM commerce_roles r
      WHERE r.id = $1 AND (r.empresa_id IS NULL OR r.empresa_id = $2)
      LIMIT 1`,
    [roleId, empresaId],
  );
  if (!result.rows[0]) throw new CommerceError('papel não encontrado no tenant', 'PERMISSION_DENIED');
  return result.rows[0];
}

function assertAssignable(actor, role, lojaId, { existingTenantOwner = false } = {}) {
  if (rank(role) > rank(actor)) throw new CommerceError('o ator não pode atribuir um papel acima do próprio', 'PERMISSION_DENIED');
  if (!existingTenantOwner && String(role.codigo) === 'tenant_owner' && String(actor.codigo) !== 'platform_owner') {
    throw new CommerceError('somente platform_owner pode atribuir tenant_owner', 'PERMISSION_DENIED');
  }
  if (String(role.codigo) === 'platform_owner' && String(actor.codigo) !== 'platform_owner') {
    throw new CommerceError('somente platform_owner pode atribuir platform_owner', 'PERMISSION_DENIED');
  }
  if (['platform_owner', 'tenant_owner'].includes(String(role.codigo)) && lojaId) {
    throw new CommerceError('papéis owner devem possuir escopo do tenant, não de uma loja', 'MEMBERSHIP_SCOPE_INVALID');
  }
}

function assertActorStoreScope(actor, lojaId) {
  if (actor?.loja_id && String(actor.loja_id) !== String(lojaId || '')) {
    throw new CommerceError('o ator não pode administrar memberships fora da própria loja', 'PERMISSION_DENIED');
  }
}

async function assertTenantOwnerSurvives(trx, empresaId, membership, desired = {}) {
  if (!membership || String(membership.role_codigo) !== 'tenant_owner' || !effectiveMembership(membership)) return;
  const desiredActive = desired.ativo === undefined ? membership.ativo === true : desired.ativo === true;
  const desiredRole = desired.roleCodigo || membership.role_codigo;
  const desiredExpiration = desired.expiresAt === undefined ? membership.expires_at : desired.expiresAt;
  const desiredEffective = desiredActive && (desiredExpiration == null || Date.parse(desiredExpiration) > Date.now());
  const removesOwner = !desiredEffective || desiredRole !== 'tenant_owner';
  if (!removesOwner) return;
  const owners = await trx.query(
    `SELECT COUNT(*)::integer AS total
       FROM commerce_memberships m
       JOIN usuarios u ON u.empresa_id = m.empresa_id AND u.id = m.usuario_id AND u.ativo = true
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE m.empresa_id = $1 AND m.id <> $2 AND m.loja_id IS NULL AND m.ativo = true
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND r.codigo = 'tenant_owner'`,
    [empresaId, membership.id],
  );
  if (Number(owners.rows[0]?.total || 0) === 0) {
    throw new CommerceError('o último tenant_owner ativo não pode ser removido ou desativado', 'LAST_TENANT_OWNER_REQUIRED');
  }
}

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
    `SELECT m.id, m.usuario_id, m.loja_id, m.ativo, m.expires_at, m.mfa_obrigatorio, m.criado_em, m.atualizado_em,
            u.email, u.nome_completo, r.id AS role_id, r.codigo AS role_codigo, r.nome AS role_nome,
            l.nome AS loja_nome
       FROM commerce_memberships m
       JOIN usuarios u ON u.empresa_id = m.empresa_id AND u.id = m.usuario_id
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
       LEFT JOIN lojas l ON l.empresa_id = m.empresa_id AND l.id = m.loja_id
      WHERE m.empresa_id = $1
      ORDER BY m.atualizado_em DESC
      LIMIT 500`,
    [empresaId],
  );
  return { items: result.rows };
}

export async function listMembershipCandidates(trx, contextInput, queryInput = '') {
  const { empresaId } = tenantContext(contextInput);
  const query = text(queryInput, 120);
  const search = query ? `%${query}%` : null;
  const result = await trx.query(
    `SELECT u.id, u.nome_completo AS nome, u.email
       FROM usuarios u
      WHERE u.empresa_id = $1 AND u.ativo = true
        AND ($2::text IS NULL OR u.nome_completo ILIKE $2 OR u.email ILIKE $2)
      ORDER BY u.nome_completo ASC, u.id ASC
      LIMIT 25`,
    [empresaId, search],
  );
  return { items: result.rows.map(row => ({ id: row.id, nome: row.nome, email: row.email })) };
}

export async function createMembership(trx, contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const { empresaId, usuarioId } = context;
  const targetUserId = assertUuid(input.usuarioId, 'usuarioId');
  const roleId = assertUuid(input.roleId, 'roleId');
  const lojaId = input.lojaId ? assertUuid(input.lojaId, 'lojaId') : null;
  const expiration = parseMembershipExpiration(input);

  await lockTenantMembershipMutations(trx, empresaId);
  const actor = await actorAuthorization(trx, context);
  const role = await targetRole(trx, empresaId, roleId);
  assertActorStoreScope(actor, lojaId);
  assertAssignable(actor, role, lojaId);

  const user = await trx.query(`SELECT id FROM usuarios WHERE empresa_id = $1 AND id = $2 AND ativo = true LIMIT 1`, [empresaId, targetUserId]);
  if (!user.rows[0]) throw new CommerceError('usuário não encontrado no tenant', 'USER_NOT_FOUND');
  if (lojaId) {
    const loja = await trx.query(`SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2 AND ativa = true LIMIT 1`, [empresaId, lojaId]);
    if (!loja.rows[0]) throw new CommerceError('loja não encontrada no tenant', 'STORE_NOT_FOUND');
  }
  const existing = await trx.query(
    `SELECT m.id, m.ativo, m.expires_at, r.codigo AS role_codigo
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE m.empresa_id = $1 AND m.usuario_id = $2 AND m.loja_id IS NOT DISTINCT FROM $3::uuid
      FOR UPDATE OF m`,
    [empresaId, targetUserId, lojaId],
  );
  await assertTenantOwnerSurvives(trx, empresaId, existing.rows[0], {
    ativo: input.ativo !== false,
    roleCodigo: role.codigo,
    expiresAt: expiration.provided ? expiration.value : existing.rows[0]?.expires_at,
  });
  if (String(existing.rows[0]?.role_codigo) === 'tenant_owner' && String(actor.codigo) !== 'platform_owner') {
    throw new CommerceError('somente platform_owner pode alterar tenant_owner', 'PERMISSION_DENIED');
  }

  const result = existing.rows[0]
    ? await trx.query(
      `UPDATE commerce_memberships
          SET role_id = $4, ativo = $5${input.mfaObrigatorio !== undefined ? ', mfa_obrigatorio = $6' : ''}${expiration.provided ? `, expires_at = $${input.mfaObrigatorio !== undefined ? 7 : 6}::timestamptz` : ''}, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND usuario_id = $2 AND loja_id IS NOT DISTINCT FROM $3::uuid
        RETURNING *`,
      [empresaId, targetUserId, lojaId, roleId, input.ativo !== false, ...(input.mfaObrigatorio !== undefined ? [input.mfaObrigatorio === true] : []), ...(expiration.provided ? [expiration.value] : [])],
    )
    : await trx.query(
      `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo, mfa_obrigatorio, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
       RETURNING *`,
      [empresaId, targetUserId, lojaId, roleId, input.ativo !== false, input.mfaObrigatorio === true, expiration.value ?? null],
    );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois)
     VALUES ($1, $2, $3, 'membership', $4, $5, $6::jsonb, $7::jsonb)`,
    [
      empresaId,
      lojaId,
      usuarioId,
      result.rows[0].id,
      existing.rows[0] ? 'updated' : 'created',
      JSON.stringify(existing.rows[0] || {}),
      JSON.stringify({ targetUserId, roleId, roleCode: role.codigo, ativo: result.rows[0].ativo, expiresAt: result.rows[0].expires_at ?? null, mfaObrigatorio: result.rows[0].mfa_obrigatorio }),
    ],
  );
  return result.rows[0];
}

export async function updateMembership(trx, contextInput, membershipId, input = {}) {
  const context = tenantContext(contextInput);
  const { empresaId, usuarioId } = context;
  const id = assertUuid(membershipId, 'membershipId');

  await lockTenantMembershipMutations(trx, empresaId);
  const actor = await actorAuthorization(trx, context);
  const currentResult = await trx.query(
    `SELECT m.*, r.codigo AS role_codigo
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id IS NULL OR r.empresa_id = m.empresa_id)
      WHERE m.empresa_id = $1 AND m.id = $2
      FOR UPDATE OF m`,
    [empresaId, id],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('membership não encontrada no tenant', 'MEMBERSHIP_NOT_FOUND');
  assertActorStoreScope(actor, current.loja_id);
  if (rank(current) > rank(actor)) throw new CommerceError('o ator não pode alterar uma membership acima do próprio papel', 'PERMISSION_DENIED');

  let role = { id: current.role_id, codigo: current.role_codigo };
  if (input.roleId !== undefined) role = await targetRole(trx, empresaId, assertUuid(input.roleId, 'roleId'));
  assertAssignable(actor, role, current.loja_id, { existingTenantOwner: String(current.role_codigo) === 'tenant_owner' });
  const expiration = parseMembershipExpiration(input);
  await assertTenantOwnerSurvives(trx, empresaId, current, {
    ativo: input.ativo,
    roleCodigo: role.codigo,
    expiresAt: expiration.provided ? expiration.value : current.expires_at,
  });
  if (String(current.role_codigo) === 'tenant_owner' && String(actor.codigo) !== 'platform_owner') {
    throw new CommerceError('somente platform_owner pode alterar tenant_owner', 'PERMISSION_DENIED');
  }

  const sets = [];
  const values = [empresaId, id];
  if (input.ativo !== undefined) { values.push(input.ativo === true); sets.push(`ativo = $${values.length}`); }
  if (input.mfaObrigatorio !== undefined) { values.push(input.mfaObrigatorio === true); sets.push(`mfa_obrigatorio = $${values.length}`); }
  if (input.roleId !== undefined) { values.push(role.id); sets.push(`role_id = $${values.length}`); }
  if (expiration.provided) { values.push(expiration.value); sets.push(`expires_at = $${values.length}::timestamptz`); }
  if (!sets.length) throw new CommerceError('nenhum campo de membership informado', 'NO_CHANGES');

  const result = await trx.query(`UPDATE commerce_memberships SET ${sets.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois)
     VALUES ($1, $2, $3, 'membership', $4, 'updated', $5::jsonb, $6::jsonb)`,
    [empresaId, result.rows[0].loja_id || null, usuarioId, id, JSON.stringify({ roleId: current.role_id, roleCode: current.role_codigo, ativo: current.ativo, expiresAt: current.expires_at ?? null, mfaObrigatorio: current.mfa_obrigatorio }), JSON.stringify({ fields: Object.keys(input), roleId: result.rows[0].role_id, roleCode: role.codigo, ativo: result.rows[0].ativo, expiresAt: result.rows[0].expires_at ?? null, mfaObrigatorio: result.rows[0].mfa_obrigatorio })],
  );
  return result.rows[0];
}
