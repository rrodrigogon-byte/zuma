import crypto from 'node:crypto';
import { CommerceError } from './commerce-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max = 255) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function normalizeCustomerEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 320);
  if (!email) return null;
  if (!EMAIL.test(email)) throw new CommerceError('e-mail do cliente inválido', 'VALIDATION_ERROR', { field: 'email' });
  return email;
}

export function normalizeBrazilianPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (/^[1-9]\d{9,10}$/.test(digits)) return `55${digits}`;
  if (/^55[1-9]\d{9,10}$/.test(digits)) return digits;
  throw new CommerceError('telefone brasileiro inválido', 'VALIDATION_ERROR', { field: 'telefone' });
}

export function normalizeCustomerInput(input = {}) {
  return {
    customerId: input.customerId ? String(input.customerId).trim() : null,
    nome: clean(input.nome ?? input.name, 240),
    email: normalizeCustomerEmail(input.email),
    telefone: normalizeBrazilianPhone(input.telefone ?? input.phone),
    documentoMascarado: clean(input.documentoMascarado ?? input.documento_mascarado, 40) || null,
    consentimentos: input.consentimentos && typeof input.consentimentos === 'object' && !Array.isArray(input.consentimentos)
      ? input.consentimentos
      : {},
    metadados: input.metadados && typeof input.metadados === 'object' && !Array.isArray(input.metadados)
      ? input.metadados
      : {},
  };
}

function identityLockKeys(empresaId, identity) {
  const keys = [];
  if (identity.customerId) keys.push(`id:${identity.customerId}`);
  if (identity.email) keys.push(`email:${identity.email}`);
  if (identity.telefone) keys.push(`phone:${identity.telefone}`);
  return [...new Set(keys)].sort().map(key => `commerce-customer:${empresaId}:${key}`);
}

export async function lockCommerceCustomerIdentity(trx, empresaId, identity) {
  for (const key of identityLockKeys(empresaId, identity)) {
    await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  }
}

function customerConflict(details = {}) {
  throw new CommerceError(
    'e-mail e telefone pertencem a cadastros diferentes; confirme os dados antes de continuar',
    'CONTACT_CONFLICT',
    details,
  );
}

async function auditIdentityMutation(trx, context, { entity, entityId, action, metadata = {} }) {
  if (context?.skipIdentityAudit) return;
  const correlationId = String(context?.correlationId || crypto.randomUUID()).slice(0, 100);
  await trx.query(
    `INSERT INTO commerce_audit_logs
      (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [context.empresaId, context.lojaId || null, context.usuarioId || null, entity, entityId, action, JSON.stringify(metadata), correlationId],
  );
}

function chooseCandidate(rows, identity) {
  const byId = identity.customerId ? rows.find(row => row.id === identity.customerId) : null;
  const byEmail = identity.email ? rows.find(row => row.email_normalizado === identity.email) : null;
  const byPhone = identity.telefone ? rows.find(row => row.telefone_normalizado === identity.telefone) : null;
  const ids = new Set([byId?.id, byEmail?.id, byPhone?.id].filter(Boolean));
  if (ids.size > 1) customerConflict({ reason: 'identifiers_resolve_to_different_customers' });
  if (identity.customerId && !byId) throw new CommerceError('cliente fora do escopo ou bloqueado', 'CUSTOMER_NOT_FOUND');
  return byId || byEmail || byPhone || null;
}

function canonicalCustomerPatch(existing, identity) {
  const email = existing.email_normalizado || identity.email || null;
  const telefone = existing.telefone_normalizado || identity.telefone || null;
  if (existing.email_normalizado && identity.email && existing.email_normalizado !== identity.email) customerConflict({ reason: 'customer_email_mismatch' });
  if (existing.telefone_normalizado && identity.telefone && existing.telefone_normalizado !== identity.telefone) customerConflict({ reason: 'customer_phone_mismatch' });
  return {
    nome: identity.nome || existing.nome,
    email,
    telefone,
  };
}

export async function resolveCommerceCustomer(trx, context, input = {}) {
  const empresaId = String(context?.empresaId || '').trim();
  if (!UUID.test(empresaId)) throw new CommerceError('empresaId inválido', 'INVALID_ID', { field: 'empresaId' });
  const identity = normalizeCustomerInput(input);
  if (identity.customerId && !UUID.test(identity.customerId)) throw new CommerceError('customerId inválido', 'INVALID_ID', { field: 'customerId' });
  if (!identity.customerId && !identity.nome) throw new CommerceError('nome do cliente é obrigatório', 'CUSTOMER_REQUIRED');

  await lockCommerceCustomerIdentity(trx, empresaId, identity);
  const candidates = await trx.query(
    `SELECT id, nome, email, telefone, email_normalizado, telefone_normalizado, consentimentos, bloqueado
       FROM commerce_customers
      WHERE empresa_id = $1
        AND (($2::uuid IS NOT NULL AND id = $2)
          OR ($3::text IS NOT NULL AND email_normalizado = $3)
          OR ($4::text IS NOT NULL AND telefone_normalizado = $4))
      ORDER BY id
      FOR UPDATE`,
    [empresaId, identity.customerId, identity.email, identity.telefone],
  );
  const existing = chooseCandidate(candidates.rows, identity);
  if (existing?.bloqueado) throw new CommerceError('cliente fora do escopo ou bloqueado', 'CUSTOMER_NOT_FOUND');
  if (existing) {
    canonicalCustomerPatch(existing, identity);
    await auditIdentityMutation(trx, context, {
      entity: 'customer', entityId: existing.id, action: 'identity_resolved',
      metadata: { source: String(context?.identitySource || 'commerce').slice(0, 40), created: false, existingRecordChanged: false, verificationMethod: 'contact_match_unverified', authorizationState: 'not_verified', financialPrivileges: false, contactFields: [identity.email ? 'email' : null, identity.telefone ? 'telefone' : null].filter(Boolean) },
    });
    return { customer: existing, created: false };
  }

  try {
    const created = await trx.query(
      `INSERT INTO commerce_customers (empresa_id, nome, email, telefone, documento_mascarado, consentimentos, metadados)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       RETURNING *`,
      [empresaId, identity.nome, identity.email, identity.telefone, identity.documentoMascarado, JSON.stringify(identity.consentimentos), JSON.stringify(identity.metadados)],
    );
    await auditIdentityMutation(trx, context, {
      entity: 'customer', entityId: created.rows[0].id, action: 'identity_created',
      metadata: { source: String(context?.identitySource || 'commerce').slice(0, 40), created: true, verificationMethod: 'contact_supplied_unverified', authorizationState: 'not_verified', financialPrivileges: false, contactFields: [identity.email ? 'email' : null, identity.telefone ? 'telefone' : null].filter(Boolean), consentKeys: Object.keys(identity.consentimentos).slice(0, 20) },
    });
    return { customer: created.rows[0], created: true };
  } catch (error) {
    if (error?.code === '23505') customerConflict({ reason: 'concurrent_unique_conflict' });
    throw error;
  }
}

export function normalizeCustomerAddress(input = {}, fallbackRecipient = '', { allowPartial = false } = {}) {
  if (!input || typeof input !== 'object' || input.modo === 'retirada') return null;
  if (!allowPartial && !['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado'].some(key => String(input[key] || '').trim())) return null;
  const normalized = {
    rotulo: clean(input.rotulo || input.label || 'principal', 80) || 'principal',
    destinatario: clean(input.destinatario || fallbackRecipient, 200),
    cep: String(input.cep || '').replace(/\D/g, '').slice(0, 8) || null,
    logradouro: clean(input.logradouro, 255) || null,
    numero: clean(input.numero, 30) || null,
    complemento: clean(input.complemento, 160) || null,
    bairro: clean(input.bairro, 120) || null,
    cidade: clean(input.cidade, 120) || null,
    estado: clean(input.estado, 2).toUpperCase() || null,
    referencia: clean(input.referencia, 255) || null,
  };
  const complete = normalized.destinatario && normalized.logradouro && normalized.numero && normalized.cidade && /^[A-Z]{2}$/.test(normalized.estado || '') && /^\d{8}$/.test(normalized.cep || '');
  if ((!allowPartial && !complete) || !normalized.destinatario || (normalized.cep && !/^\d{8}$/.test(normalized.cep)) || (normalized.estado && !/^[A-Z]{2}$/.test(normalized.estado))) {
    throw new CommerceError('endereço do cliente incompleto', 'ADDRESS_REQUIRED');
  }
  return normalized;
}

export function customerAddressFingerprint(address) {
  if (!address) return null;
  const parts = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado'].map(key => {
    const value = String(address[key] || '').trim().replace(/\s+/g, ' ');
    return key === 'cep' ? value.replace(/\D/g, '') : value.toLowerCase();
  });
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function resolveCommerceCustomerAddress(trx, context, customerIdInput, input = {}, fallbackRecipient = '', options = {}) {
  const empresaId = String(context?.empresaId || '').trim();
  const customerId = String(customerIdInput || '').trim();
  if (!UUID.test(empresaId)) throw new CommerceError('empresaId inválido', 'INVALID_ID', { field: 'empresaId' });
  if (!UUID.test(customerId)) throw new CommerceError('customerId inválido', 'INVALID_ID', { field: 'customerId' });
  const address = normalizeCustomerAddress(input, fallbackRecipient, options);
  if (!address) return null;
  const fingerprint = customerAddressFingerprint(address);
  const requestedDefault = input.padrao === true;
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-address-customer:${empresaId}:${customerId}`]);
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-address:${empresaId}:${customerId}:${fingerprint}`]);
  const existing = await trx.query(
    `SELECT * FROM commerce_customer_addresses
      WHERE empresa_id = $1 AND customer_id = $2 AND endereco_fingerprint = $3
      LIMIT 1 FOR UPDATE`,
    [empresaId, customerId, fingerprint],
  );
  if (existing.rows[0]) {
    if (requestedDefault && !existing.rows[0].padrao) {
      await trx.query(`UPDATE commerce_customer_addresses SET padrao = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND customer_id = $2 AND padrao = true`, [empresaId, customerId]);
      const selected = await trx.query(`UPDATE commerce_customer_addresses SET padrao = true, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`, [empresaId, existing.rows[0].id]);
      await auditIdentityMutation(trx, context, { entity: 'customer_address', entityId: selected.rows[0].id, action: 'address_reused', metadata: { source: String(context?.identitySource || 'commerce').slice(0, 40), customerId, deduplicated: true, defaultChanged: true } });
      return { address: selected.rows[0], created: false };
    }
    await auditIdentityMutation(trx, context, { entity: 'customer_address', entityId: existing.rows[0].id, action: 'address_reused', metadata: { source: String(context?.identitySource || 'commerce').slice(0, 40), customerId, deduplicated: true } });
    return { address: existing.rows[0], created: false };
  }
  if (requestedDefault) await trx.query(`UPDATE commerce_customer_addresses SET padrao = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND customer_id = $2 AND padrao = true`, [empresaId, customerId]);
  const created = await trx.query(
    `INSERT INTO commerce_customer_addresses
      (empresa_id, customer_id, rotulo, destinatario, cep, logradouro, numero, complemento, bairro, cidade, estado, referencia, padrao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
       $13 OR NOT EXISTS (SELECT 1 FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = $2))
     RETURNING *`,
    [empresaId, customerId, address.rotulo, address.destinatario, address.cep, address.logradouro, address.numero, address.complemento, address.bairro, address.cidade, address.estado, address.referencia, requestedDefault],
  );
  await auditIdentityMutation(trx, context, { entity: 'customer_address', entityId: created.rows[0].id, action: 'address_created', metadata: { source: String(context?.identitySource || 'commerce').slice(0, 40), customerId, deduplicated: false } });
  return { address: created.rows[0], created: true };
}
