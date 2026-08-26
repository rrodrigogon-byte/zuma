import { db as pgdb } from '../core/database.js';
import { db as legacyDb } from '../db.js';

const IDENTITY_ONLY_HASH = '!commerce-core-identity-only!';
const STAFF_ROLES = new Set(['admin', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'operador']);

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const item = process.argv.find(value => value.startsWith(prefix));
  return item ? item.slice(prefix.length).trim() : fallback;
}

function clean(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function email(value) {
  const normalized = clean(value).toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) ? normalized : '';
}

function safeHash(value) {
  const hash = clean(value, 255);
  return /^(\$2[aby]?\$|\$argon2|\$scrypt|\$pbkdf2)/i.test(hash) ? hash : IDENTITY_ONLY_HASH;
}

function roleOf(record, source) {
  if (source === 'admin') return 'admin';
  const role = clean(record.role || record.perfil || record.tipo, 40).toLowerCase();
  return STAFF_ROLES.has(role) ? role : 'operador';
}

function commerceRole(legacyRole) {
  if (legacyRole === 'admin') return 'tenant_owner';
  if (['gerente', 'operador'].includes(legacyRole)) return 'store_admin';
  if (['vendedor', 'caixa', 'garcom', 'barbeiro'].includes(legacyRole)) return 'order_operator';
  return 'support';
}

function normalizeRecord(record, source) {
  const recordEmail = email(record.email || record.usuario || record.login || record.emailLogin);
  if (!recordEmail) return null;
  const fullName = clean(record.nome_completo || record.nomeCompleto || record.nome || record.name || record.razao_social || recordEmail.split('@')[0], 255);
  const permissions = record.permissoes && typeof record.permissoes === 'object' && !Array.isArray(record.permissoes) ? record.permissoes : {};
  return {
    email: recordEmail,
    nomeCompleto: fullName || recordEmail,
    role: roleOf(record, source),
    senhaHash: safeHash(record.senha_hash || record.senhaHash || record.passwordHash),
    permissoes: JSON.stringify(permissions),
    origem: source,
  };
}

function collectRecords(source) {
  const byEmail = new Map();
  for (const record of Array.isArray(source.usuarios) ? source.usuarios : []) {
    const normalized = normalizeRecord(record, 'usuario');
    if (normalized && normalized.role !== 'cliente') byEmail.set(normalized.email, normalized);
  }
  for (const record of Array.isArray(source.admins) ? source.admins : []) {
    const normalized = normalizeRecord(record, 'admin');
    if (normalized) byEmail.set(normalized.email, normalized);
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

async function summarize(empresaId) {
  const source = legacyDb();
  const records = collectRecords(source);
  const existing = await pgdb.query('SELECT count(*)::int AS count FROM usuarios WHERE empresa_id = $1', [empresaId]);
  return {
    source: 'legacy-json-store',
    candidates: records.length,
    existingUsers: Number(existing.rows[0]?.count || 0),
    safeHashes: records.filter(record => record.senhaHash !== IDENTITY_ONLY_HASH).length,
    identityOnly: records.filter(record => record.senhaHash === IDENTITY_ONLY_HASH).length,
  };
}

async function apply(empresaId) {
  if (process.env.IDENTITY_IMPORT_CONFIRM !== 'IMPORT_LEGACY_IDENTITY') {
    throw new Error('aplicação bloqueada: defina IDENTITY_IMPORT_CONFIRM=IMPORT_LEGACY_IDENTITY');
  }
  const source = legacyDb();
  const records = collectRecords(source);
  return pgdb.transaction(async trx => {
    const company = await trx.query('SELECT id FROM empresas WHERE id = $1 FOR SHARE', [empresaId]);
    if (!company.rows[0]) throw new Error('empresa de destino não encontrada');
    let users = 0;
    let memberships = 0;
    for (const record of records) {
      const result = await trx.query(
        `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, role, permissoes, ativo)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, true)
         ON CONFLICT (empresa_id, email) DO UPDATE SET
           nome_completo = EXCLUDED.nome_completo,
           role = EXCLUDED.role,
           permissoes = EXCLUDED.permissoes,
           ativo = true,
           data_atualizacao = CURRENT_TIMESTAMP
         RETURNING id`,
        [empresaId, record.email, record.senhaHash, record.nomeCompleto, record.role, record.permissoes],
      );
      const userId = result.rows[0].id;
      users += 1;
      const membership = await trx.query(
        `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
         SELECT $1, $2, NULL, r.id, true
           FROM commerce_roles r
          WHERE r.empresa_id IS NULL AND r.codigo = $3
         ON CONFLICT (empresa_id, usuario_id, loja_id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           ativo = true,
           atualizado_em = CURRENT_TIMESTAMP
         RETURNING id`,
        [empresaId, userId, commerceRole(record.role)],
      );
      if (membership.rows[0]) memberships += 1;
      await trx.query(
        `INSERT INTO commerce_legacy_imports
          (empresa_id, loja_id, source, entity, legacy_key, target_id, payload_hash, metadata)
         VALUES ($1, NULL, 'legacy-json', 'identity', $2, $3, encode(digest($2, 'sha256'), 'hex'), $4::jsonb)
         ON CONFLICT (empresa_id, source, entity, legacy_key) DO UPDATE SET
           target_id = EXCLUDED.target_id,
           metadata = EXCLUDED.metadata`,
        [empresaId, record.email, userId, JSON.stringify({ origem: record.origem, senhaMigrada: record.senhaHash !== IDENTITY_ONLY_HASH })],
      );
    }
    return { users, memberships, candidates: records.length };
  });
}

const empresaId = arg('empresa-id');
if (!empresaId) throw new Error('uso: node migrations/import-legacy-identity.js --empresa-id=UUID [--apply]');

try {
  const summary = await summarize(empresaId);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'dry-run', summary }, null, 2));
  } else {
    const imported = await apply(empresaId);
    console.log(JSON.stringify({ mode: 'apply', imported }, null, 2));
  }
} finally {
  await pgdb.close();
}
