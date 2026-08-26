import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function nullableText(value, max = 240) {
  const normalized = text(value, max);
  return normalized || null;
}

function email(value) {
  const normalized = text(value, 320).toLowerCase();
  if (!normalized) return null;
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new CommerceError('email inválido', 'CUSTOMER_EMAIL_INVALID');
  return normalized;
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

async function customerInTenant(client, context, customerId, { allowBlocked = true } = {}) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(customerId, 'customerId');
  const result = await client.query(
    `SELECT id, nome, email, telefone, documento_mascarado, consentimentos, metadados, bloqueado
       FROM commerce_customers
      WHERE empresa_id = $1 AND id = $2${allowBlocked ? '' : ' AND bloqueado = false'}
      LIMIT 1`,
    [empresaId, id],
  );
  if (!result.rows[0]) throw new CommerceError('cliente não encontrado no tenant', 'CUSTOMER_NOT_FOUND');
  return result.rows[0];
}

export async function createCustomer(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const nome = text(input.nome, 240);
  if (!nome) throw new CommerceError('nome do cliente é obrigatório', 'CUSTOMER_REQUIRED');
  const customerEmail = email(input.email);
  if (customerEmail) {
    const existing = await trx.query(
      `SELECT id FROM commerce_customers WHERE empresa_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [empresaId, customerEmail],
    );
    if (existing.rows[0]) throw new CommerceError('já existe cliente com este email no tenant', 'CUSTOMER_EMAIL_CONFLICT');
  }
  const result = await trx.query(
    `INSERT INTO commerce_customers
      (empresa_id, usuario_id, nome, email, telefone, documento_mascarado, consentimentos, metadados)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING *`,
    [empresaId, null, nome, customerEmail, nullableText(input.telefone, 30), nullableText(input.documentoMascarado || input.documento_mascarado, 40), JSON.stringify(input.consentimentos || {}), JSON.stringify(input.metadados || {})],
  );
  const customer = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'customer', $3, 'created', $4::jsonb)`,
    [empresaId, usuarioId || null, customer.id, JSON.stringify({ nome: customer.nome, email: customer.email })],
  );
  return customer;
}

export async function updateCustomer(trx, context, customerId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const current = await customerInTenant(trx, context, customerId);
  const updates = [];
  const values = [empresaId, current.id];
  const add = (column, value) => { values.push(value); updates.push(`${column} = $${values.length}`); };
  if (Object.prototype.hasOwnProperty.call(input, 'nome')) {
    const nome = text(input.nome, 240);
    if (!nome) throw new CommerceError('nome do cliente é obrigatório', 'CUSTOMER_REQUIRED');
    add('nome', nome);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'email')) add('email', email(input.email));
  if (Object.prototype.hasOwnProperty.call(input, 'telefone')) add('telefone', nullableText(input.telefone, 30));
  if (Object.prototype.hasOwnProperty.call(input, 'documentoMascarado') || Object.prototype.hasOwnProperty.call(input, 'documento_mascarado')) add('documento_mascarado', nullableText(input.documentoMascarado || input.documento_mascarado, 40));
  if (Object.prototype.hasOwnProperty.call(input, 'bloqueado')) add('bloqueado', input.bloqueado === true);
  if (Object.prototype.hasOwnProperty.call(input, 'consentimentos')) add('consentimentos', JSON.stringify(input.consentimentos || {}));
  if (Object.prototype.hasOwnProperty.call(input, 'metadados')) add('metadados', JSON.stringify(input.metadados || {}));
  if (!updates.length) return current;
  const requestedEmail = Object.prototype.hasOwnProperty.call(input, 'email') ? email(input.email) : current.email;
  const duplicate = await trx.query(
    `SELECT id FROM commerce_customers
      WHERE empresa_id = $1 AND email IS NOT NULL AND lower(email) = lower($2) AND id <> $3 LIMIT 1`,
    [empresaId, requestedEmail, current.id],
  );
  if (duplicate.rows[0]) throw new CommerceError('já existe cliente com este email no tenant', 'CUSTOMER_EMAIL_CONFLICT');
  const result = await trx.query(
    `UPDATE commerce_customers SET ${updates.join(', ')}, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    values,
  );
  const customer = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, antes, depois)
     VALUES ($1, $2, 'customer', $3, 'updated', $4::jsonb, $5::jsonb)`,
    [empresaId, usuarioId || null, current.id, JSON.stringify(current), JSON.stringify(customer)],
  );
  return customer;
}

export async function listCustomerAddresses(client, context, customerId) {
  const customer = await customerInTenant(client, context, customerId);
  const result = await client.query(
    `SELECT id, customer_id, rotulo, destinatario, cep, logradouro, numero, complemento,
            bairro, cidade, estado, referencia, padrao, criado_em, atualizado_em
       FROM commerce_customer_addresses
      WHERE empresa_id = $1 AND customer_id = $2
      ORDER BY padrao DESC, atualizado_em DESC`,
    [tenantContext(context).empresaId, customer.id],
  );
  return { items: result.rows };
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

export async function createCustomerAddress(trx, context, customerId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const customer = await customerInTenant(trx, context, customerId, { allowBlocked: false });
  const value = addressValues(input);
  if (value.padrao) {
    await trx.query('UPDATE commerce_customer_addresses SET padrao = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND customer_id = $2', [empresaId, customer.id]);
  }
  const result = await trx.query(
    `INSERT INTO commerce_customer_addresses
      (empresa_id, customer_id, rotulo, destinatario, cep, logradouro, numero, complemento, bairro, cidade, estado, referencia, padrao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [empresaId, customer.id, value.rotulo, value.destinatario, value.cep, value.logradouro, value.numero, value.complemento, value.bairro, value.cidade, value.estado, value.referencia, value.padrao],
  );
  const address = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'customer_address', $3, 'created', $4::jsonb)`,
    [empresaId, usuarioId || null, address.id, JSON.stringify({ customerId: customer.id, padrao: address.padrao })],
  );
  return address;
}

export async function updateCustomerAddress(trx, context, customerId, addressId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const customer = await customerInTenant(trx, context, customerId, { allowBlocked: false });
  const id = assertUuid(addressId, 'addressId');
  const currentResult = await trx.query(
    `SELECT * FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 FOR UPDATE`,
    [empresaId, customer.id, id],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('endereço não encontrado no tenant', 'ADDRESS_NOT_FOUND');
  const merged = addressValues({ ...current, ...input, padrao: Object.prototype.hasOwnProperty.call(input, 'padrao') ? input.padrao : current.padrao });
  if (merged.padrao) await trx.query('UPDATE commerce_customer_addresses SET padrao = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND customer_id = $2 AND id <> $3', [empresaId, customer.id, id]);
  const result = await trx.query(
    `UPDATE commerce_customer_addresses SET rotulo = $4, destinatario = $5, cep = $6, logradouro = $7, numero = $8,
       complemento = $9, bairro = $10, cidade = $11, estado = $12, referencia = $13, padrao = $14, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 RETURNING *`,
    [empresaId, customer.id, id, merged.rotulo, merged.destinatario, merged.cep, merged.logradouro, merged.numero, merged.complemento, merged.bairro, merged.cidade, merged.estado, merged.referencia, merged.padrao],
  );
  const address = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, antes, depois)
     VALUES ($1, $2, 'customer_address', $3, 'updated', $4::jsonb, $5::jsonb)`,
    [empresaId, usuarioId || null, id, JSON.stringify(current), JSON.stringify(address)],
  );
  return address;
}

export async function deleteCustomerAddress(trx, context, customerId, addressId) {
  const { empresaId, usuarioId } = tenantContext(context);
  const customer = await customerInTenant(trx, context, customerId, { allowBlocked: false });
  const id = assertUuid(addressId, 'addressId');
  const current = await trx.query('DELETE FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = $2 AND id = $3 RETURNING *', [empresaId, customer.id, id]);
  if (!current.rows[0]) throw new CommerceError('endereço não encontrado no tenant', 'ADDRESS_NOT_FOUND');
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, antes)
     VALUES ($1, $2, 'customer_address', $3, 'deleted', $4::jsonb)`,
    [empresaId, usuarioId || null, id, JSON.stringify(current.rows[0])],
  );
  return { id, deleted: true };
}

export async function getCustomer(client, context, customerId) {
  return customerInTenant(client, context, customerId);
}
