import bcrypt from 'bcryptjs';
import { db } from './database.js';
import { CommerceError, assertUuid } from './commerce-core.js';
import { assertPassword, normalizeEmail } from './commerce-operational-invites.js';
import { assertTenantOwnerSurvives } from './commerce-admin-users.js';
import { createCustomer } from './commerce-customers.js';

export const ACCOUNT_ROLE_CODES = Object.freeze(['tenant_owner', 'store_admin', 'catalog_manager', 'inventory_manager', 'order_operator', 'finance', 'support', 'customer']);

export function assertAccountManager(actor) {
  if (actor?.pgAccount || actor?.pgOperational || actor?.role !== 'admin' || !(actor.platformAdmin === true || actor.mainAdmin === true)) {
    throw new CommerceError('Somente a administração da plataforma pode gerenciar contas multiempresa.', 'PERMISSION_DENIED');
  }
}
function name(value) {
  const result = String(value || '').normalize('NFC').trim();
  if (!result || result.length > 255) throw new CommerceError('Informe um nome com até 255 caracteres.', 'VALIDATION_ERROR');
  return result;
}
function phone(value) { return String(value || '').trim().slice(0, 30) || null; }
function publicAccount(row) {
  return { id: row.id, nome: row.nome, email: row.email, telefone: row.telefone, ativo: row.ativo, origem: row.origem, criadoEm: row.criado_em };
}
function grants(input) {
  if (!Array.isArray(input) || !input.length || input.length > 20) throw new CommerceError('Selecione de 1 a 20 vínculos empresariais.', 'VALIDATION_ERROR');
  const seen = new Set();
  return input.map(item => {
    const empresaId = assertUuid(item.empresaId, 'empresaId');
    const lojaId = item.lojaId ? assertUuid(item.lojaId, 'lojaId') : null;
    const roleCode = String(item.roleCode || '');
    if (!ACCOUNT_ROLE_CODES.includes(roleCode)) throw new CommerceError('Perfil empresarial inválido; este formulário não concede administração da plataforma.', 'PERMISSION_DENIED');
    if (roleCode === 'tenant_owner' && lojaId) throw new CommerceError('Administrador da empresa deve ter escopo de empresa inteira.', 'MEMBERSHIP_SCOPE_INVALID');
    const key = `${empresaId}:${lojaId || '*'}`;
    if (seen.has(key)) throw new CommerceError('Vínculo empresarial duplicado.', 'VALIDATION_ERROR');
    seen.add(key);
    let expiresAt = null;
    if (item.expiresAt != null && item.expiresAt !== '') {
      if (typeof item.expiresAt !== 'string' || !Number.isFinite(Date.parse(item.expiresAt))) throw new CommerceError('Validade de acesso inválida.', 'MEMBERSHIP_EXPIRATION_INVALID');
      expiresAt = new Date(item.expiresAt).toISOString();
    }
    return { empresaId, lojaId, roleCode, expiresAt, ativo: item.ativo !== false };
  }).sort((a, b) => `${a.empresaId}:${a.lojaId || ''}`.localeCompare(`${b.empresaId}:${b.lojaId || ''}`));
}
async function audit(trx, actor, accountId, action, empresaId = null, details = {}) {
  await trx.query(`INSERT INTO commerce_account_audit (account_id, actor_id, acao, empresa_id, detalhes) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [accountId, String(actor.id), action, empresaId, JSON.stringify(details)]);
}
async function lockMailbox(trx, email) {
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-operational-email:${email}`]);
}
async function lockCompanies(trx, items) {
  for (const empresaId of [...new Set(items.map(item => item.empresaId))].sort()) {
    await trx.query(`SELECT pg_advisory_xact_lock(hashtextextended('commerce-membership:' || $1::text, 0))`, [empresaId]);
  }
}
async function validateGrant(trx, item) {
  const company = await trx.query('SELECT id FROM empresas WHERE id = $1 AND ativa = true FOR SHARE', [item.empresaId]);
  if (!company.rows[0]) throw new CommerceError('Empresa inexistente ou inativa.', 'TENANT_NOT_FOUND');
  if (item.lojaId) {
    const store = await trx.query('SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2 AND ativa = true', [item.empresaId, item.lojaId]);
    if (!store.rows[0]) throw new CommerceError('Unidade não pertence à empresa ou está inativa.', 'STORE_NOT_FOUND');
  }
  const role = await trx.query('SELECT id, codigo FROM commerce_roles WHERE empresa_id IS NULL AND codigo = $1 AND sistema = true LIMIT 1', [item.roleCode]);
  if (!role.rows[0]) throw new CommerceError('Perfil empresarial não configurado.', 'ROLE_NOT_FOUND');
  return role.rows[0];
}
async function localUser(trx, account, empresaId) {
  const mapped = await trx.query(`SELECT u.id FROM commerce_account_users au JOIN usuarios u ON u.id = au.usuario_id AND u.empresa_id = au.empresa_id WHERE au.account_id = $1 AND au.empresa_id = $2 AND u.ativo = true`, [account.id, empresaId]);
  if (mapped.rows[0]) return mapped.rows[0].id;
  const existing = await trx.query('SELECT id FROM usuarios WHERE empresa_id = $1 AND lower(btrim(email)) = $2', [empresaId, account.email]);
  if (existing.rows.length) throw new CommerceError('Este e-mail já pertence a outra identidade nesta empresa. Selecione a identidade existente; não há combinação automática.', 'IDENTITY_ALREADY_EXISTS');
  const created = await trx.query(`INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, ativo) VALUES ($1,$2,$3,$4,'gerente',true) RETURNING id`, [empresaId, account.email, account.senha_hash, account.nome]);
  await trx.query('INSERT INTO commerce_account_users (account_id, empresa_id, usuario_id) VALUES ($1,$2,$3)', [account.id, empresaId, created.rows[0].id]);
  return created.rows[0].id;
}
async function putGrant(trx, actor, account, item) {
  const role = await validateGrant(trx, item);
  const userId = await localUser(trx, account, item.empresaId);
  const current = await trx.query(`SELECT m.*, r.codigo AS role_codigo FROM commerce_memberships m JOIN commerce_roles r ON r.id=m.role_id WHERE m.empresa_id=$1 AND m.usuario_id=$2 AND m.loja_id IS NOT DISTINCT FROM $3::uuid FOR UPDATE OF m`, [item.empresaId, userId, item.lojaId]);
  if (current.rows[0]?.role_codigo === 'platform_owner') throw new CommerceError('Não é permitido alterar administrador da plataforma por este formulário.', 'PERMISSION_DENIED');
  await assertTenantOwnerSurvives(trx, item.empresaId, current.rows[0], { ativo: item.ativo, roleCodigo: item.roleCode, expiresAt: item.expiresAt });
  const membership = current.rows[0]
    ? await trx.query(`UPDATE commerce_memberships SET role_id=$2, ativo=$3, expires_at=$4::timestamptz, atualizado_em=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`, [current.rows[0].id, role.id, item.ativo, item.expiresAt])
    : await trx.query(`INSERT INTO commerce_memberships (empresa_id,usuario_id,loja_id,role_id,ativo,expires_at) VALUES ($1,$2,$3,$4,$5,$6::timestamptz) RETURNING id`, [item.empresaId, userId, item.lojaId, role.id, item.ativo, item.expiresAt]);
  await audit(trx, actor, account.id, 'access_saved', item.empresaId, { membershipId: membership.rows[0].id, usuarioId: userId, roleCode: item.roleCode, lojaId: item.lojaId, ativo: item.ativo, expiresAt: item.expiresAt });
  return membership.rows[0].id;
}

export async function accountManagementOptions(actor, database = db) {
  assertAccountManager(actor);
  const [companies, stores, roles] = await Promise.all([
    database.queryRead('SELECT id, nome FROM empresas WHERE ativa = true ORDER BY nome, id'),
    database.queryRead('SELECT id, empresa_id AS "empresaId", nome FROM lojas WHERE ativa = true ORDER BY nome, id'),
    database.queryRead(`SELECT id, codigo, nome FROM commerce_roles WHERE empresa_id IS NULL AND sistema=true AND codigo = ANY($1::text[]) ORDER BY nome`, [ACCOUNT_ROLE_CODES]),
  ]);
  return { canManage: true, companies: companies.rows, stores: stores.rows, roles: roles.rows };
}
export async function listAccounts(actor, query = '', database = db) {
  assertAccountManager(actor);
  const search = String(query).trim().slice(0, 120).replace(/[\\%_]/g, '\\$&');
  const result = await database.queryRead(`SELECT id, nome, email, telefone, ativo, origem, criado_em FROM commerce_accounts WHERE ($1='' OR nome ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%') ORDER BY nome,id LIMIT 100`, [search]);
  return { items: result.rows.map(publicAccount) };
}
export async function accountDetails(actor, accountId, database = db) {
  assertAccountManager(actor);
  const id = assertUuid(accountId, 'accountId');
  const account = await database.queryRead('SELECT id,nome,email,telefone,ativo,origem,criado_em FROM commerce_accounts WHERE id=$1', [id]);
  if (!account.rows[0]) throw new CommerceError('Conta não encontrada.', 'ACCOUNT_NOT_FOUND');
  const access = await database.queryRead(`SELECT m.id, au.empresa_id AS "empresaId", e.nome AS "empresaNome", au.usuario_id AS "usuarioId", m.loja_id AS "lojaId", l.nome AS "lojaNome", r.codigo AS "roleCode", r.nome AS "roleNome", m.ativo, m.expires_at AS "expiresAt"
    FROM commerce_account_users au JOIN empresas e ON e.id=au.empresa_id
    JOIN commerce_memberships m ON m.usuario_id=au.usuario_id AND m.empresa_id=au.empresa_id
    JOIN commerce_roles r ON r.id=m.role_id AND (r.empresa_id IS NULL OR r.empresa_id=m.empresa_id)
    LEFT JOIN lojas l ON l.id=m.loja_id AND l.empresa_id=m.empresa_id WHERE au.account_id=$1 ORDER BY e.nome,l.nome NULLS FIRST,m.id`, [id]);
  return { account: publicAccount(account.rows[0]), access: access.rows };
}

export async function createAccount(actor, input, { legacyUsers = [], reservedEmail = () => false, database = db } = {}) {
  assertAccountManager(actor);
  const email = normalizeEmail(input.email);
  const nome = name(input.nome);
  const desired = grants(input.access);
  if (reservedEmail(email) || legacyUsers.some(user => normalizeLoose(user.email) === email)) throw new CommerceError('E-mail já cadastrado ou reservado. Use Associar conta existente selecionando seu cadastro.', 'IDENTITY_ALREADY_EXISTS');
  const senha = assertPassword(input.senha);
  if (senha.length > 72 || Buffer.byteLength(senha, 'utf8') > 72) throw new CommerceError('Senha deve ter até 72 bytes.', 'VALIDATION_ERROR');
  const hash = await bcrypt.hash(senha, 12);
  try {
    return await database.transaction(async trx => {
      await lockMailbox(trx, email);
      const conflicts = await trx.query(`SELECT 1 FROM usuarios WHERE lower(btrim(email))=$1 UNION ALL SELECT 1 FROM commerce_accounts WHERE email=$1 UNION ALL SELECT 1 FROM commerce_operational_invites WHERE email_norm=$1 AND status IN ('pending_email','sent','used') LIMIT 1`, [email]);
      if (conflicts.rows.length || legacyUsers.some(user => normalizeLoose(user.email) === email)) throw new CommerceError('E-mail já cadastrado ou com convite pendente.', 'IDENTITY_ALREADY_EXISTS');
      const account = (await trx.query(`INSERT INTO commerce_accounts (email,nome,telefone,senha_hash) VALUES ($1,$2,$3,$4) RETURNING *`, [email,nome,phone(input.telefone),hash])).rows[0];
      await lockCompanies(trx, desired);
      for (const item of desired) await putGrant(trx, actor, account, item);
      await audit(trx, actor, account.id, 'created', null, { empresas: [...new Set(desired.map(item => item.empresaId))] });
      return { account: publicAccount(account) };
    });
  } catch (error) { if (error?.code === '23505') throw new CommerceError('Identidade ou vínculo já cadastrado.', 'IDENTITY_ALREADY_EXISTS'); throw error; }
}
const normalizeLoose = value => String(value || '').normalize('NFC').trim().toLowerCase();

export async function importAccount(actor, input, { legacyUsers = [], reservedEmail = () => false, database = db } = {}) {
  assertAccountManager(actor);
  if (!['legacy','commerce'].includes(input.source)) throw new CommerceError('Selecione a origem da identidade existente.', 'VALIDATION_ERROR');
  const desired = grants(input.access);
  return database.transaction(async trx => {
    let source;
    if (input.source === 'legacy') {
      const legacy = legacyUsers.find(item => String(item.id) === String(input.sourceId));
      if (!legacy || legacy.ativo === false || legacy.platformAdmin || reservedEmail(normalizeLoose(legacy.email))) throw new CommerceError('Identidade existente não disponível para associação.', 'ACCOUNT_NOT_FOUND');
      source = { id:String(legacy.id), nome:legacy.nome, email:legacy.email, senha_hash:legacy.senhaHash, telefone:legacy.telefone };
    } else {
      const sourceId = assertUuid(input.sourceId, 'sourceId');
      source = (await trx.query(`SELECT id, empresa_id, nome_completo AS nome, email, senha_hash FROM usuarios WHERE id=$1 AND ativo=true FOR UPDATE`, [sourceId])).rows[0];
      if (!source) throw new CommerceError('Identidade existente não encontrada.', 'ACCOUNT_NOT_FOUND');
      const privileged = await trx.query(`SELECT 1 FROM commerce_memberships m JOIN commerce_roles r ON r.id=m.role_id WHERE m.usuario_id=$1 AND r.codigo='platform_owner' LIMIT 1`, [sourceId]);
      if (privileged.rows.length || reservedEmail(normalizeLoose(source.email))) throw new CommerceError('A conta de administração da plataforma não pode ser importada por este formulário.', 'PERMISSION_DENIED');
    }
    const email = normalizeEmail(source.email);
    if (!/^\$2[aby]\$\d\d\$/.test(String(source.senha_hash || ''))) throw new CommerceError('A identidade não possui credencial compatível. Regularize a senha na origem antes de associar.', 'VALIDATION_ERROR');
    await lockMailbox(trx, email);
    const otherLegacy = legacyUsers.some(item => normalizeLoose(item.email) === email && !(input.source === 'legacy' && String(item.id) === source.id));
    const otherSql = await trx.query('SELECT id FROM usuarios WHERE lower(btrim(email))=$1 AND ($2::uuid IS NULL OR id<>$2::uuid)', [email, input.source === 'commerce' ? source.id : null]);
    if (otherLegacy || otherSql.rows.length) throw new CommerceError('E-mail ambíguo entre identidades. Não há combinação automática por e-mail.', 'IDENTITY_ALREADY_EXISTS');
    const pending = await trx.query(`SELECT 1 FROM commerce_operational_invites WHERE email_norm=$1 AND status IN ('pending_email','sent') LIMIT 1`, [email]);
    if (pending.rows.length) throw new CommerceError('Aguarde ou regularize o convite pendente antes de associar.', 'IDENTITY_ALREADY_EXISTS');
    const account = (await trx.query(`INSERT INTO commerce_accounts (email,nome,telefone,senha_hash,origem,origem_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [email,name(source.nome),phone(source.telefone),source.senha_hash,input.source,String(source.id)])).rows[0];
    if (input.source === 'commerce') await trx.query('INSERT INTO commerce_account_users (account_id,empresa_id,usuario_id) VALUES ($1,$2,$3)', [account.id,source.empresa_id,source.id]);
    await lockCompanies(trx, desired);
    for (const item of desired) await putGrant(trx, actor, account, item);
    await audit(trx, actor, account.id, 'imported', null, { source: input.source, sourceId: String(source.id) });
    return { account: publicAccount(account) };
  });
}
export async function saveAccountAccess(actor, accountId, input, database = db) {
  assertAccountManager(actor);
  const id = assertUuid(accountId, 'accountId');
  const desired = grants(input.access);
  return database.transaction(async trx => {
    const account = (await trx.query('SELECT * FROM commerce_accounts WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!account || !account.ativo) throw new CommerceError('Conta não encontrada ou inativa.', 'ACCOUNT_NOT_FOUND');
    await lockCompanies(trx, desired);
    for (const item of desired) await putGrant(trx, actor, account, item);
    return { ok:true };
  });
}
export async function setAccountActive(actor, accountId, ativo, database = db) {
  assertAccountManager(actor);
  if (typeof ativo !== 'boolean') throw new CommerceError('Estado de conta inválido.', 'VALIDATION_ERROR');
  const id = assertUuid(accountId, 'accountId');
  return database.transaction(async trx => {
    const account = (await trx.query('SELECT id FROM commerce_accounts WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!account) throw new CommerceError('Conta não encontrada.', 'ACCOUNT_NOT_FOUND');
    if (!ativo) {
      const owners = await trx.query(`SELECT m.*,r.codigo AS role_codigo FROM commerce_account_users au JOIN commerce_memberships m ON m.usuario_id=au.usuario_id AND m.empresa_id=au.empresa_id JOIN commerce_roles r ON r.id=m.role_id WHERE au.account_id=$1 AND r.codigo='tenant_owner'`, [id]);
      await lockCompanies(trx, owners.rows.map(row => ({ empresaId:row.empresa_id })));
      for (const row of owners.rows) await assertTenantOwnerSurvives(trx, row.empresa_id, row, { ativo:false });
    }
    await trx.query('UPDATE commerce_accounts SET ativo=$2, atualizado_em=CURRENT_TIMESTAMP WHERE id=$1', [id,ativo]);
    await audit(trx, actor, id, ativo ? 'activated' : 'deactivated');
    return { ok:true };
  });
}

export async function createManagedCustomers(actor, input, database = db) {
  assertAccountManager(actor);
  const desired = grants((input.empresas || []).map(empresaId => ({ empresaId, roleCode:'customer' })));
  const nome = name(input.nome);
  return database.transaction(async trx => {
    const items = [];
    for (const item of desired) {
      await validateGrant(trx, item);
      const customer = await createCustomer(trx, { empresaId:item.empresaId, usuarioId:null, lojaId:null }, { nome, email:input.email || null, telefone:input.telefone || null });
      await audit(trx, actor, null, 'customer_created', item.empresaId, { customerId:customer.id });
      items.push({ empresaId:item.empresaId, customerId:customer.id });
    }
    return { items };
  });
}

export async function findAccountByEmail(email, database = db) {
  const result = await database.queryRead('SELECT * FROM commerce_accounts WHERE email=$1 LIMIT 1', [normalizeLoose(email)]);
  return result.rows[0] || null;
}
export async function accountByLegacyId(legacyId, database = db) {
  const result = await database.queryRead(`SELECT * FROM commerce_accounts WHERE origem='legacy' AND origem_id=$1 LIMIT 1`, [String(legacyId)]);
  return result.rows[0] || null;
}
export async function linkedAccountForLocalUser(userId, database = db) {
  const result = await database.queryRead(`SELECT a.id,a.ativo FROM commerce_account_users au JOIN commerce_accounts a ON a.id=au.account_id WHERE au.usuario_id=$1`, [userId]);
  return result.rows[0] || null;
}
export function accountCredential(account, legacyUsers = []) {
  if (account.origem !== 'legacy') return account.senha_hash;
  const source = legacyUsers.find(item => String(item.id) === account.origem_id && item.ativo !== false && normalizeLoose(item.email) === account.email);
  return source?.senhaHash || null;
}
export async function resolveAccountUser(accountId, { legacyUsers = [], database = db } = {}) {
  const id = assertUuid(accountId, 'accountId');
  const account = (await database.queryRead('SELECT * FROM commerce_accounts WHERE id=$1 AND ativo=true', [id])).rows[0];
  if (!account || !accountCredential(account, legacyUsers)) return null;
  const access = await activeAccountAccess(id, database);
  if (!access.length) return null;
  const panel = access.some(row => row.role_codigo !== 'customer');
  const admin = access.some(row => ['tenant_owner','store_admin'].includes(row.role_codigo));
  return { id:account.id, nome:account.nome, email:account.email, telefone:account.telefone, ativo:true, role:admin ? 'admin' : panel ? 'organizador' : 'cliente', pgAccount:true, tenantBound:true, platformAdmin:false, accountAccess:access };
}
async function activeAccountAccess(accountId, database = db) {
  return (await database.queryRead(`SELECT au.usuario_id, m.empresa_id, m.loja_id, m.expires_at, r.codigo AS role_codigo, e.nome AS empresa_nome
    FROM commerce_account_users au JOIN commerce_accounts a ON a.id=au.account_id AND a.ativo=true
    JOIN usuarios u ON u.id=au.usuario_id AND u.empresa_id=au.empresa_id AND u.ativo=true
    JOIN empresas e ON e.id=au.empresa_id AND e.ativa=true
    JOIN commerce_memberships m ON m.usuario_id=au.usuario_id AND m.empresa_id=au.empresa_id AND m.ativo=true AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
    JOIN commerce_roles r ON r.id=m.role_id AND (r.empresa_id IS NULL OR r.empresa_id=m.empresa_id)
    LEFT JOIN lojas l ON l.id=m.loja_id AND l.empresa_id=m.empresa_id
    WHERE au.account_id=$1 AND (m.loja_id IS NULL OR l.ativa=true) AND r.codigo<>'platform_owner' ORDER BY m.empresa_id,m.loja_id NULLS FIRST`, [accountId])).rows;
}
export async function accountSession(user, database = db) {
  const rows = await activeAccountAccess(user.id, database);
  const companyIds = [...new Set(rows.map(row => row.empresa_id))];
  const companies = companyIds.map(id => ({ id, nome:rows.find(row => row.empresa_id===id).empresa_nome }));
  const stores = companyIds.length ? (await database.queryRead(`SELECT DISTINCT l.id,l.empresa_id AS "empresaId",l.codigo,l.nome,l.ativa
    FROM lojas l JOIN commerce_account_users au ON au.empresa_id=l.empresa_id AND au.account_id=$1
    JOIN commerce_memberships m ON m.empresa_id=au.empresa_id AND m.usuario_id=au.usuario_id AND m.ativo=true AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
    WHERE l.ativa=true AND l.empresa_id=ANY($2::uuid[]) AND (m.loja_id IS NULL OR m.loja_id=l.id) ORDER BY l.empresa_id,l.nome`, [user.id,companyIds])).rows : [];
  const company = companies.length===1 ? companies[0] : null;
  const store = stores.length===1 ? stores[0] : null;
  return { empresas_acessiveis:companies, lojas_acessiveis:stores, empresa:company, empresaId:company?.id || null, loja:store, lojaId:store?.id || null };
}
export function accountRequestIdentity(user, requested = {}) {
  const rows = user.accountAccess || [];
  const companies = [...new Set(rows.map(row => row.empresa_id))];
  const empresaId = requested.empresaId || (companies.length===1 ? companies[0] : null);
  if (!empresaId) throw new CommerceError('Selecione uma empresa autorizada.', 'TENANT_SELECTION_REQUIRED');
  assertUuid(empresaId, 'empresaId');
  const candidates = rows.filter(row => row.empresa_id===empresaId);
  if (!candidates.length) throw new CommerceError('Empresa não autorizada para esta conta.', 'PERMISSION_DENIED');
  const lojaId = requested.lojaId || null;
  if (lojaId) assertUuid(lojaId, 'lojaId');
  const chosen = lojaId ? candidates.find(row => row.loja_id===lojaId) || candidates.find(row => !row.loja_id) : candidates.find(row => !row.loja_id) || (new Set(candidates.map(row => row.loja_id)).size===1 ? candidates[0] : null);
  if (!chosen) throw new CommerceError('Selecione uma unidade autorizada.', 'STORE_SELECTION_REQUIRED');
  const rank = code => ({ tenant_owner:90, store_admin:70, customer:10 }[code] || 50);
  const effective = candidates.filter(row => !row.loja_id || row.loja_id === (lojaId || chosen.loja_id)).sort((a,b) => rank(b.role_codigo)-rank(a.role_codigo))[0];
  return { empresaId, lojaId:lojaId || chosen.loja_id || null, usuarioId:chosen.usuario_id, membershipExpiresAt:chosen.expires_at, roleCode:effective.role_codigo };
}
