import { auditLog, assertUuid, tenantContext } from './commerce-core.js';
import { CommerceError } from './commerce-error.js';
import {
  lockCommerceCustomerIdentity,
  normalizeCustomerEmail,
  normalizeCustomerInput,
  normalizeBrazilianPhone,
  resolveCommerceCustomer,
  resolveCommerceCustomerAddress,
} from './commerce-customer-identity.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, max = 255) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function email(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = normalizeCustomerEmail(value);
  if (!EMAIL.test(normalized || '')) throw new CommerceError('email inválido', 'VALIDATION_ERROR');
  return normalized;
}
function phone(value) {
  if (value === undefined || value === null || value === '') return null;
  return normalizeBrazilianPhone(value);
}
function mapUniqueConflict(error) {
  if (error?.code !== '23505') throw error;
  const constraint = String(error.constraint || '');
  if (constraint.includes('email')) throw new CommerceError('já existe cliente com este email', 'CUSTOMER_EMAIL_CONFLICT');
  if (constraint.includes('telefone')) throw new CommerceError('já existe cliente com este telefone', 'CUSTOMER_PHONE_CONFLICT');
  throw new CommerceError('contato já associado a outro cliente', 'CONTACT_CONFLICT');
}
function nullableText(value, max = 240) {
  const normalized = text(value, max);
  return normalized || null;
}
function cep(value) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  if (!normalized) return null;
  if (normalized.length !== 8) throw new CommerceError('CEP deve conter 8 dígitos', 'ADDRESS_CEP_INVALID');
  return normalized;
}
function state(value) {
  const normalized = text(value, 2).toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z]{2}$/.test(normalized)) throw new CommerceError('UF inválida', 'ADDRESS_STATE_INVALID');
  return normalized;
}
function addressValues(input = {}) {
  const destinatario = text(input.destinatario, 240);
  if (!destinatario) throw new CommerceError('destinatário do endereço é obrigatório', 'ADDRESS_REQUIRED');
  return {
    rotulo: text(input.rotulo || 'principal', 60) || 'principal',
    destinatario,
    cep: cep(input.cep),
    logradouro: nullableText(input.logradouro, 240),
    numero: nullableText(input.numero, 30),
    complemento: nullableText(input.complemento, 120),
    bairro: nullableText(input.bairro, 120),
    cidade: nullableText(input.cidade, 120),
    estado: state(input.estado),
    referencia: nullableText(input.referencia, 240),
    padrao: input.padrao === true,
  };
}
async function customerInTenant(client, context, customerIdInput, { allowBlocked = true } = {}) {
  const { empresaId } = tenantContext(context);
  const customerId = assertUuid(customerIdInput, 'customerId');
  const result = await client.query(
    `SELECT id, nome, email, telefone, documento_mascarado, consentimentos, metadados, bloqueado
       FROM commerce_customers
      WHERE empresa_id = $1 AND id = $2${allowBlocked ? '' : ' AND bloqueado = false'}
      LIMIT 1`,
    [empresaId, customerId],
  );
  if (!result.rows[0]) throw new CommerceError('cliente não encontrado no tenant', 'CUSTOMER_NOT_FOUND');
  return result.rows[0];
}

export async function createCustomer(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const normalized = normalizeCustomerInput(input);
  if (!normalized.nome) throw new CommerceError('nome é obrigatório', 'CUSTOMER_REQUIRED');
  try {
    const resolved = await resolveCommerceCustomer(trx, { ...context, empresaId, skipIdentityAudit: true }, normalized);
    if (!resolved.created) {
      if (normalized.email) throw new CommerceError('já existe cliente com este email', 'CUSTOMER_EMAIL_CONFLICT');
      if (normalized.telefone) throw new CommerceError('já existe cliente com este telefone', 'CUSTOMER_PHONE_CONFLICT');
      throw new CommerceError('cliente já existente', 'CONTACT_CONFLICT');
    }
    await auditLog(trx, { ...context, empresaId }, { entidade: 'customer', entidadeId: resolved.customer.id, acao: 'created', depois: { contactFields: [normalized.email ? 'email' : null, normalized.telefone ? 'telefone' : null].filter(Boolean) } });
    return resolved.customer;
  } catch (error) {
    mapUniqueConflict(error);
  }
}

export async function updateCustomer(trx, context, customerIdInput, input = {}) {
  const { empresaId } = tenantContext(context);
  const customerId = assertUuid(customerIdInput, 'customerId');
  const target = {
    customerId,
    email: Object.prototype.hasOwnProperty.call(input, 'email') ? email(input.email) : null,
    telefone: Object.prototype.hasOwnProperty.call(input, 'telefone') ? phone(input.telefone) : null,
  };
  await lockCommerceCustomerIdentity(trx, empresaId, target);
  const currentResult = await trx.query(`SELECT * FROM commerce_customers WHERE empresa_id = $1 AND id = $2 LIMIT 1 FOR UPDATE`, [empresaId, customerId]);
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('cliente não encontrado', 'CUSTOMER_NOT_FOUND');
  const mutableFields = ['nome', 'email', 'telefone', 'documentoMascarado', 'documento_mascarado', 'consentimentos', 'metadados', 'bloqueado'];
  if (!mutableFields.some(key => Object.prototype.hasOwnProperty.call(input, key))) return current;

  const nextEmail = Object.prototype.hasOwnProperty.call(input, 'email') ? target.email : current.email_normalizado;
  const nextPhone = Object.prototype.hasOwnProperty.call(input, 'telefone') ? target.telefone : current.telefone_normalizado;
  const contacts = await trx.query(
    `SELECT id, email_normalizado, telefone_normalizado
       FROM commerce_customers
      WHERE empresa_id = $1 AND id <> $2
        AND (($3::text IS NOT NULL AND email_normalizado = $3)
          OR ($4::text IS NOT NULL AND telefone_normalizado = $4))
      ORDER BY id FOR UPDATE`,
    [empresaId, customerId, nextEmail, nextPhone],
  );
  if (contacts.rows.some(row => row.email_normalizado === nextEmail)) throw new CommerceError('já existe cliente com este email', 'CUSTOMER_EMAIL_CONFLICT');
  if (contacts.rows.some(row => row.telefone_normalizado === nextPhone)) throw new CommerceError('já existe cliente com este telefone', 'CUSTOMER_PHONE_CONFLICT');

  const next = {
    nome: Object.prototype.hasOwnProperty.call(input, 'nome') ? text(input.nome, 240) : current.nome,
    email: Object.prototype.hasOwnProperty.call(input, 'email') ? nextEmail : current.email,
    telefone: Object.prototype.hasOwnProperty.call(input, 'telefone') ? nextPhone : current.telefone,
    documento: Object.prototype.hasOwnProperty.call(input, 'documentoMascarado') || Object.prototype.hasOwnProperty.call(input, 'documento_mascarado') ? text(input.documentoMascarado || input.documento_mascarado, 40) || null : current.documento_mascarado,
    consentimentos: Object.prototype.hasOwnProperty.call(input, 'consentimentos') ? object(input.consentimentos) : current.consentimentos,
    metadados: Object.prototype.hasOwnProperty.call(input, 'metadados') ? object(input.metadados) : current.metadados,
    bloqueado: Object.prototype.hasOwnProperty.call(input, 'bloqueado') ? input.bloqueado === true : current.bloqueado,
  };
  if (!next.nome) throw new CommerceError('nome é obrigatório', 'CUSTOMER_REQUIRED');
  try {
    const updated = await trx.query(
      `UPDATE commerce_customers SET nome = $3, email = $4, telefone = $5, documento_mascarado = $6,
              consentimentos = $7::jsonb, metadados = $8::jsonb, bloqueado = $9, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresaId, customerId, next.nome, next.email, next.telefone, next.documento, JSON.stringify(next.consentimentos), JSON.stringify(next.metadados), next.bloqueado],
    );
    await auditLog(trx, { ...context, empresaId }, {
      entidade: 'customer', entidadeId: customerId, acao: 'updated',
      antes: { bloqueado: current.bloqueado },
      depois: { bloqueado: updated.rows[0].bloqueado, changedFields: Object.keys(input).filter(key => mutableFields.includes(key)) },
    });
    return updated.rows[0];
  } catch (error) {
    mapUniqueConflict(error);
  }
}

export async function createCustomerAddress(trx, context, customerIdInput, input = {}) {
  const { empresaId } = tenantContext(context);
  const customerId = assertUuid(customerIdInput, 'customerId');
  const customer = await trx.query(`SELECT id, nome FROM commerce_customers WHERE empresa_id = $1 AND id = $2 AND bloqueado = false LIMIT 1`, [empresaId, customerId]);
  if (!customer.rows[0]) throw new CommerceError('cliente não encontrado', 'CUSTOMER_NOT_FOUND');
  const resolved = await resolveCommerceCustomerAddress(trx, { ...context, empresaId, skipIdentityAudit: true }, customerId, input, customer.rows[0].nome, { allowPartial: true });
  await auditLog(trx, { ...context, empresaId }, { entidade: 'customer_address', entidadeId: resolved.address.id, acao: resolved.created ? 'created' : 'reused', depois: { customerId, deduplicated: !resolved.created } });
  return resolved.address;
}

export async function listCustomerAddresses(client, context, customerIdInput) {
  const { empresaId } = tenantContext(context);
  const customer = await customerInTenant(client, context, customerIdInput);
  const result = await client.query(
    `SELECT id, customer_id, rotulo, destinatario, cep, logradouro, numero, complemento,
            bairro, cidade, estado, referencia, padrao, criado_em, atualizado_em
       FROM commerce_customer_addresses
      WHERE empresa_id = $1 AND customer_id = $2
      ORDER BY padrao DESC, atualizado_em DESC`,
    [empresaId, customer.id],
  );
  return { items: result.rows };
}

export async function updateCustomerAddress(trx, context, customerIdInput, addressIdInput, input = {}) {
  const { empresaId } = tenantContext(context);
  const customer = await customerInTenant(trx, context, customerIdInput, { allowBlocked: false });
  const addressId = assertUuid(addressIdInput, 'addressId');
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-address-customer:${empresaId}:${customer.id}`]);
  const currentResult = await trx.query(
    `SELECT * FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 FOR UPDATE`,
    [empresaId, customer.id, addressId],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('endereço não encontrado no tenant', 'ADDRESS_NOT_FOUND');
  const merged = addressValues({ ...current, ...input, padrao: Object.prototype.hasOwnProperty.call(input, 'padrao') ? input.padrao : current.padrao });
  if (merged.padrao) await trx.query('UPDATE commerce_customer_addresses SET padrao = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND customer_id = $2 AND id <> $3 AND padrao = true', [empresaId, customer.id, addressId]);
  try {
    const result = await trx.query(
      `UPDATE commerce_customer_addresses SET rotulo = $4, destinatario = $5, cep = $6, logradouro = $7, numero = $8,
         complemento = $9, bairro = $10, cidade = $11, estado = $12, referencia = $13, padrao = $14, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 RETURNING *`,
      [empresaId, customer.id, addressId, merged.rotulo, merged.destinatario, merged.cep, merged.logradouro, merged.numero, merged.complemento, merged.bairro, merged.cidade, merged.estado, merged.referencia, merged.padrao],
    );
    const address = result.rows[0];
    await auditLog(trx, { ...context, empresaId }, { entidade: 'customer_address', entidadeId: addressId, acao: 'updated', depois: { customerId: customer.id, changedFields: Object.keys(input) } });
    return address;
  } catch (error) {
    if (error?.code === '23505') throw new CommerceError('endereço equivalente já cadastrado para o cliente', 'ADDRESS_CONFLICT');
    throw error;
  }
}

export async function deleteCustomerAddress(trx, context, customerIdInput, addressIdInput) {
  const { empresaId } = tenantContext(context);
  const customer = await customerInTenant(trx, context, customerIdInput, { allowBlocked: false });
  const addressId = assertUuid(addressIdInput, 'addressId');
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`commerce-address-customer:${empresaId}:${customer.id}`]);
  const current = await trx.query('DELETE FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 RETURNING id, padrao', [empresaId, customer.id, addressId]);
  if (!current.rows[0]) throw new CommerceError('endereço não encontrado no tenant', 'ADDRESS_NOT_FOUND');
  await auditLog(trx, { ...context, empresaId }, { entidade: 'customer_address', entidadeId: addressId, acao: 'deleted', antes: { customerId: customer.id, padrao: current.rows[0].padrao } });
  return { id: addressId, deleted: true };
}

export async function getCustomer(client, context, customerIdInput) {
  return customerInTenant(client, context, customerIdInput);
}
