import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';

function domainName(value) {
  const domain = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!domain || domain.length > 255 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new CommerceError('domínio inválido; informe um hostname completo', 'DOMAIN_INVALID');
  }
  return domain;
}

async function storefrontInTenant(client, context, storefrontId) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(storefrontId, 'storefrontId');
  const result = await client.query(
    `SELECT id, empresa_id, loja_id, codigo, nome, canal, status
       FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2 AND status = 'active'
      LIMIT 1`,
    [empresaId, id],
  );
  if (!result.rows[0]) throw new CommerceError('storefront não encontrado ou inativo no tenant', 'STOREFRONT_NOT_FOUND');
  return result.rows[0];
}

export async function listStorefrontDomains(client, context, storefrontId = null) {
  const { empresaId } = tenantContext(context);
  const values = [empresaId];
  const predicates = ['d.empresa_id = $1'];
  if (storefrontId) {
    values.push(assertUuid(storefrontId, 'storefrontId'));
    predicates.push(`d.storefront_id = $${values.length}`);
  }
  const result = await client.query(
    `SELECT d.id, d.storefront_id, d.dominio, d.principal, d.verificado_em, d.criado_em,
            d.verification_token, s.nome AS storefront_name, s.codigo AS storefront_code
       FROM commerce_store_domains d
       JOIN commerce_storefronts s ON s.empresa_id = d.empresa_id AND s.id = d.storefront_id
      WHERE ${predicates.join(' AND ')}
      ORDER BY d.principal DESC, d.dominio ASC`,
    values,
  );
  return {
    items: result.rows.map(row => ({
      ...row,
      verification_name: `_kytto-verify.${row.dominio}`,
      verification_value: row.verification_token ? `kytto-verify=${row.verification_token}` : null,
      status: row.verificado_em ? 'verified' : 'pending',
    })),
  };
}

export async function createStorefrontDomain(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const storefront = await storefrontInTenant(trx, context, input.storefrontId);
  const dominio = domainName(input.dominio);
  const token = randomBytes(24).toString('hex');
  const existing = await trx.query('SELECT id FROM commerce_store_domains WHERE dominio = $1 LIMIT 1', [dominio]);
  if (existing.rows[0]) throw new CommerceError('domínio já cadastrado', 'DOMAIN_CONFLICT');
  if (input.principal === true) await trx.query('UPDATE commerce_store_domains SET principal = false WHERE empresa_id = $1 AND storefront_id = $2', [empresaId, storefront.id]);
  const result = await trx.query(
    `INSERT INTO commerce_store_domains (empresa_id, storefront_id, dominio, principal, verification_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, storefront_id, dominio, principal, verificado_em, criado_em, verification_token`,
    [empresaId, storefront.id, dominio, input.principal === true, token],
  );
  const row = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'storefront_domain', $3, 'created', $4::jsonb)`,
    [empresaId, usuarioId || null, row.id, JSON.stringify({ dominio, storefrontId: storefront.id, principal: row.principal })],
  );
  return { ...row, status: 'pending', verification_name: `_kytto-verify.${dominio}`, verification_value: `kytto-verify=${token}` };
}

export async function verifyStorefrontDomain(trx, context, domainId) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(domainId, 'domainId');
  const found = await trx.query(
    `SELECT id, dominio, storefront_id, verification_token, verificado_em
       FROM commerce_store_domains
      WHERE empresa_id = $1 AND id = $2
      FOR UPDATE`,
    [empresaId, id],
  );
  const domain = found.rows[0];
  if (!domain) throw new CommerceError('domínio não encontrado no tenant', 'DOMAIN_NOT_FOUND');
  if (domain.verificado_em) return { ...domain, status: 'verified' };
  let records = [];
  try {
    records = await dns.resolveTxt(`_kytto-verify.${domain.dominio}`);
  } catch {
    throw new CommerceError('registro TXT de verificação não encontrado', 'DOMAIN_NOT_VERIFIED');
  }
  const flattened = records.flat().map(value => String(value).trim());
  const expected = `kytto-verify=${domain.verification_token}`;
  if (!flattened.includes(expected)) throw new CommerceError('registro TXT não corresponde ao desafio deste domínio', 'DOMAIN_NOT_VERIFIED');
  const result = await trx.query(
    `UPDATE commerce_store_domains SET verificado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 RETURNING id, storefront_id, dominio, principal, verificado_em, criado_em`,
    [empresaId, id],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'storefront_domain', $3, 'verified', $4::jsonb)`,
    [empresaId, usuarioId || null, id, JSON.stringify({ dominio: domain.dominio })],
  );
  return { ...result.rows[0], status: 'verified' };
}

export async function setPrimaryStorefrontDomain(trx, context, domainId) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(domainId, 'domainId');
  const found = await trx.query('SELECT id, storefront_id, dominio, verificado_em FROM commerce_store_domains WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresaId, id]);
  if (!found.rows[0]) throw new CommerceError('domínio não encontrado no tenant', 'DOMAIN_NOT_FOUND');
  if (!found.rows[0].verificado_em) throw new CommerceError('somente domínio verificado pode ser principal', 'DOMAIN_NOT_VERIFIED');
  await trx.query('UPDATE commerce_store_domains SET principal = false WHERE empresa_id = $1 AND storefront_id = $2', [empresaId, found.rows[0].storefront_id]);
  const result = await trx.query('UPDATE commerce_store_domains SET principal = true WHERE empresa_id = $1 AND id = $2 RETURNING id, storefront_id, dominio, principal, verificado_em', [empresaId, id]);
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'storefront_domain', $3, 'primary_changed', $4::jsonb)`,
    [empresaId, usuarioId || null, id, JSON.stringify({ dominio: found.rows[0].dominio })],
  );
  return result.rows[0];
}
