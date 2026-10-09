import { CommerceError } from './commerce-core.js';
import { db } from './database.js';

const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const STORE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
const BUSINESS_TYPES = new Set(['bar', 'restaurante', 'loja', 'barbearia', 'clube', 'supermercado', 'outro']);

function text(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function digits(value, max = 32) {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

function email(value) {
  const normalized = text(value, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new CommerceError('e-mail do administrador inválido', 'TENANT_ADMIN_EMAIL_INVALID');
  }
  return normalized;
}

function cnpj(value) {
  const normalized = digits(value, 14);
  if (normalized.length !== 14 || /^(\d)\1{13}$/.test(normalized)) {
    throw new CommerceError('CNPJ deve possuir 14 dígitos válidos', 'TENANT_CNPJ_INVALID');
  }
  const calculate = (base, weights) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const result = 11 - (total % 11);
    return result >= 10 ? '0' : String(result);
  };
  const first = calculate(normalized.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calculate(`${normalized.slice(0, 12)}${first}`, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  if (!normalized.endsWith(`${first}${second}`)) {
    throw new CommerceError('CNPJ deve possuir 14 dígitos válidos', 'TENANT_CNPJ_INVALID');
  }
  return normalized;
}

function phone(value) {
  const normalized = digits(value, 13);
  if (normalized.length < 10 || normalized.length > 13) {
    throw new CommerceError('telefone deve incluir DDD e número válidos', 'TENANT_PHONE_INVALID');
  }
  return normalized.startsWith('55') ? `+${normalized}` : `+55${normalized}`;
}

function httpsUrl(value) {
  const normalized = text(value, 600);
  return /^https:\/\//i.test(normalized) ? normalized : '';
}

function addressConfig(input = {}) {
  const postalCode = digits(input.postalCode || input.cep, 8);
  const state = text(input.state || input.uf, 2).toUpperCase();
  if (postalCode && postalCode.length !== 8) throw new CommerceError('CEP deve possuir 8 dígitos', 'TENANT_POSTAL_CODE_INVALID');
  if (state && !/^[A-Z]{2}$/.test(state)) throw new CommerceError('UF inválida', 'TENANT_STATE_INVALID');
  return {
    street: text(input.street || input.logradouro, 180),
    number: text(input.number || input.numero, 30),
    complement: text(input.complement || input.complemento, 100),
    neighborhood: text(input.neighborhood || input.bairro, 100),
    city: text(input.city || input.cidade, 100),
    state,
    postalCode,
  };
}

function policiesConfig(input = {}) {
  return {
    privacyUrl: httpsUrl(input.privacyUrl),
    returnsUrl: httpsUrl(input.returnsUrl),
    shippingUrl: httpsUrl(input.shippingUrl),
    termsUrl: httpsUrl(input.termsUrl),
  };
}

function alias(value) {
  const normalized = text(value, 80).toLowerCase();
  if (!ALIAS_PATTERN.test(normalized)) {
    throw new CommerceError('alias deve ter 2–80 caracteres minúsculos, números, hífen ou sublinhado', 'STOREFRONT_ALIAS_INVALID');
  }
  return normalized;
}

function brandKey(value) {
  const normalized = text(value || 'default', 80).toLowerCase();
  if (!ALIAS_PATTERN.test(normalized)) {
    throw new CommerceError('identidade visual inválida', 'STOREFRONT_BRAND_INVALID');
  }
  return normalized;
}

function storeCode(value) {
  const normalized = text(value, 30).toUpperCase();
  if (!STORE_CODE_PATTERN.test(normalized)) {
    throw new CommerceError('código da unidade inválido', 'STORE_CODE_INVALID');
  }
  return normalized;
}

function storefrontCode(value) {
  const normalized = text(value, 80).toLowerCase();
  if (!ALIAS_PATTERN.test(normalized)) {
    throw new CommerceError('código do storefront inválido', 'STOREFRONT_CODE_INVALID');
  }
  return normalized;
}

function color(value, fallback) {
  const candidate = text(value, 16);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : fallback;
}

function publicConfig(input = {}, fallbackName = '') {
  const address = addressConfig(input.address || {});
  return {
    displayName: text(input.displayName || fallbackName, 120),
    tagline: text(input.tagline, 240),
    logoUrl: httpsUrl(input.logoUrl),
    contact: {
      phone: input.phone ? phone(input.phone) : '',
      email: input.email ? email(input.email) : '',
    },
    address,
    pickup: {
      instructions: text(input.pickup?.instructions, 500),
      leadTimeHours: Math.max(0, Math.min(720, Number(input.pickup?.leadTimeHours) || 0)),
    },
    policies: policiesConfig(input.policies || {}),
    colors: {
      accent: color(input.colors?.accent, '#6E7CE0'),
      accentStrong: color(input.colors?.accentStrong, '#4B57A6'),
      background: color(input.colors?.background, '#101114'),
      surface: color(input.colors?.surface, '#181A20'),
      text: color(input.colors?.text, '#F4F5F7'),
    },
  };
}

function validateProvisioningInput(input = {}) {
  if (input.confirmAdminAccess !== true) throw new CommerceError('confirme explicitamente a concessão de acesso administrativo ao tenant', 'TENANT_ADMIN_ACCESS_CONFIRMATION_REQUIRED');
  if (input.confirmPublicContact !== true) throw new CommerceError('confirme explicitamente endereço e contato públicos do tenant', 'TENANT_PUBLIC_CONTACT_CONFIRMATION_REQUIRED');
  const tenantCnpj = cnpj(input.cnpj);
  const nome = text(input.nomeFantasia || input.nome, 255);
  const razaoSocial = text(input.razaoSocial, 255);
  if (!nome || !razaoSocial) throw new CommerceError('nome fantasia e razão social são obrigatórios', 'TENANT_IDENTITY_REQUIRED');
  const tipoNegocio = BUSINESS_TYPES.has(String(input.tipoNegocio || 'outro')) ? String(input.tipoNegocio || 'outro') : 'outro';
  const adminEmail = email(input.adminEmail);
  const storeAlias = alias(input.alias);
  const brand = brandKey(input.brandKey || storeAlias);
  const unitCode = storeCode(input.lojaCodigo || `${storeAlias}-matriz`);
  const channelCode = storefrontCode(input.storefrontCodigo || `${storeAlias}-web`);
  const publicDetails = publicConfig({
    ...(input.publicConfig || {}),
    phone: input.phone || input.publicConfig?.phone,
    email: input.contactEmail || input.publicConfig?.email,
    address: input.address || input.publicConfig?.address,
    pickup: input.pickup || input.publicConfig?.pickup,
    policies: input.policies || input.publicConfig?.policies,
  }, nome);
  if (!publicDetails.contact.phone || !publicDetails.address.street || !publicDetails.address.number || !publicDetails.address.neighborhood || !publicDetails.address.city || !publicDetails.address.state || !publicDetails.address.postalCode) {
    throw new CommerceError('telefone e endereço público completo são obrigatórios', 'TENANT_PUBLIC_CONTACT_REQUIRED');
  }
  return {
    cnpj: tenantCnpj,
    nome,
    razaoSocial,
    tipoNegocio,
    adminEmail,
    adminName: text(input.adminName, 255),
    storeAlias,
    brand,
    unitCode,
    channelCode,
    timezone: text(input.timezone || 'America/Sao_Paulo', 64),
    public: publicDetails,
  };
}

async function assertAliasAvailable(trx, storeAlias, empresaId = null) {
  const result = await trx.query(
    `SELECT a.empresa_id, a.storefront_id, a.alias
       FROM commerce_storefront_aliases a
      WHERE lower(a.alias) = lower($1)
      LIMIT 1
      FOR UPDATE`,
    [storeAlias],
  );
  if (result.rows[0] && (!empresaId || result.rows[0].empresa_id !== empresaId)) {
    throw new CommerceError('alias público já pertence a outro tenant', 'STOREFRONT_ALIAS_CONFLICT');
  }
  return result.rows[0] || null;
}

async function resolveSourceUser(trx, adminEmail) {
  const result = await trx.query(
    `SELECT id, email, senha_hash, nome_completo
       FROM usuarios
      WHERE lower(email) = $1 AND ativo = true
      ORDER BY data_atualizacao DESC NULLS LAST, data_criacao ASC
      LIMIT 1
      FOR SHARE`,
    [adminEmail],
  );
  if (!result.rows[0]) {
    throw new CommerceError('o administrador informado ainda não possui uma identidade autenticada no SetPoint', 'TENANT_ADMIN_USER_NOT_FOUND');
  }
  return result.rows[0];
}

async function upsertTenantUser(trx, empresaId, sourceUser, input) {
  const result = await trx.query(
    `INSERT INTO usuarios (empresa_id, email, senha_hash, nome_completo, ativo, role, permissoes)
     VALUES ($1, $2, $3, $4, true, 'admin', $5::jsonb)
     ON CONFLICT (empresa_id, email)
     DO UPDATE SET ativo = true, nome_completo = EXCLUDED.nome_completo,
                   permissoes = usuarios.permissoes || EXCLUDED.permissoes,
                   data_atualizacao = CURRENT_TIMESTAMP
     RETURNING id, empresa_id, email, nome_completo, ativo, role`,
    [empresaId, sourceUser.email, sourceUser.senha_hash, input.adminName || sourceUser.nome_completo || sourceUser.email, JSON.stringify({ tenantOwner: true })],
  );
  return result.rows[0];
}

async function ensureTenantMembership(trx, empresaId, usuarioId, lojaId) {
  const role = await trx.query(
    `SELECT id FROM commerce_roles
      WHERE empresa_id IS NULL AND codigo = 'tenant_owner'
      LIMIT 1`,
  );
  if (!role.rows[0]) throw new CommerceError('papel tenant_owner não foi inicializado', 'TENANT_ROLE_NOT_FOUND');
  await trx.query(
    `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
     VALUES ($1, $2, NULL, $3, true)
     ON CONFLICT (empresa_id, usuario_id) WHERE loja_id IS NULL
     DO UPDATE SET role_id = EXCLUDED.role_id, ativo = true, atualizado_em = CURRENT_TIMESTAMP`,
    [empresaId, usuarioId, role.rows[0].id],
  );
  await trx.query(
    `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja, ativo)
     VALUES ($1, $2, 'admin', true)
     ON CONFLICT (usuario_id, loja_id)
     DO UPDATE SET role_loja = 'admin', ativo = true, data_atualizacao = CURRENT_TIMESTAMP`,
    [usuarioId, lojaId],
  );
}

export async function provisionCommerceTenant(input = {}) {
  const payload = validateProvisioningInput(input);
  return db.transaction(async trx => {
    const sourceUser = await resolveSourceUser(trx, payload.adminEmail);
    const existingCompany = await trx.query(
      `SELECT id, nome, cnpj, razao_social, ativa, tipo_negocio
         FROM empresas
        WHERE cnpj = $1
        LIMIT 1
        FOR UPDATE`,
      [payload.cnpj],
    );
    let empresa = existingCompany.rows[0] || null;
    if (empresa && String(empresa.nome || '').trim().toLowerCase() !== payload.nome.toLowerCase()) {
      throw new CommerceError('CNPJ informado já pertence a outra empresa', 'TENANT_CNPJ_CONFLICT');
    }
    if (!empresa) {
      const created = await trx.query(
        `INSERT INTO empresas (nome, cnpj, razao_social, ativa, tipo_negocio)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id, nome, cnpj, razao_social, ativa, tipo_negocio`,
        [payload.nome, payload.cnpj, payload.razaoSocial, payload.tipoNegocio],
      );
      empresa = created.rows[0];
    } else if (empresa.ativa === false) {
      throw new CommerceError('empresa existente está inativa e exige reativação explícita', 'TENANT_INACTIVE');
    }

    const existingAlias = await assertAliasAvailable(trx, payload.storeAlias, empresa.id);
    const usuario = await upsertTenantUser(trx, empresa.id, sourceUser, payload);
    const lojaResult = await trx.query(
      `INSERT INTO lojas (empresa_id, codigo, nome, nome_fantasia, timezone, ativa, configuracoes)
       VALUES ($1, $2, $3, $3, $4, true, $5::jsonb)
       ON CONFLICT (empresa_id, codigo)
       DO UPDATE SET nome = EXCLUDED.nome, nome_fantasia = EXCLUDED.nome_fantasia,
                     timezone = EXCLUDED.timezone, ativa = true,
                     configuracoes = lojas.configuracoes || EXCLUDED.configuracoes,
                     data_atualizacao = CURRENT_TIMESTAMP
       RETURNING id, empresa_id, codigo, nome, nome_fantasia, timezone, ativa`,
      [empresa.id, payload.unitCode, payload.nome, payload.timezone, JSON.stringify({ commerceStorefront: true, brandKey: payload.brand, contact: payload.public.contact, address: payload.public.address, pickup: payload.public.pickup })],
    );
    const loja = lojaResult.rows[0];
    await ensureTenantMembership(trx, empresa.id, usuario.id, loja.id);

    const storefrontResult = await trx.query(
      `INSERT INTO commerce_storefronts (empresa_id, loja_id, codigo, nome, canal, status, moeda, timezone, configuracoes)
       VALUES ($1, $2, $3, $4, 'web', 'draft', 'BRL', $5, $6::jsonb)
       ON CONFLICT (empresa_id, codigo)
       DO UPDATE SET loja_id = EXCLUDED.loja_id, nome = EXCLUDED.nome,
                     timezone = EXCLUDED.timezone,
                     configuracoes = commerce_storefronts.configuracoes || EXCLUDED.configuracoes,
                     atualizado_em = CURRENT_TIMESTAMP
       RETURNING id, empresa_id, loja_id, codigo, nome, canal, status, moeda, timezone, configuracoes`,
      [empresa.id, loja.id, payload.channelCode, `${payload.nome} · E-commerce`, payload.timezone, JSON.stringify({ brandKey: payload.brand, public: payload.public })],
    );
    const storefront = storefrontResult.rows[0];

    if (existingAlias && existingAlias.storefront_id !== storefront.id) {
      throw new CommerceError('alias já está associado a outro storefront deste tenant', 'STOREFRONT_ALIAS_CONFLICT');
    }
    const aliasResult = await trx.query(
      `INSERT INTO commerce_storefront_aliases (empresa_id, storefront_id, alias, brand_key, public_config, ativo)
       VALUES ($1, $2, $3, $4, $5::jsonb, true)
       ON CONFLICT (lower(alias))
       DO UPDATE SET brand_key = EXCLUDED.brand_key,
                     public_config = EXCLUDED.public_config,
                     ativo = true,
                     atualizado_em = CURRENT_TIMESTAMP
       WHERE commerce_storefront_aliases.empresa_id = EXCLUDED.empresa_id
         AND commerce_storefront_aliases.storefront_id = EXCLUDED.storefront_id
       RETURNING empresa_id, storefront_id, alias`,
      [empresa.id, storefront.id, payload.storeAlias, payload.brand, JSON.stringify(payload.public)],
    );
    if (!aliasResult.rows[0]) throw new CommerceError('alias público já pertence a outro tenant', 'STOREFRONT_ALIAS_CONFLICT');
    await trx.query(
      `INSERT INTO commerce_inventory_locations (empresa_id, loja_id, codigo, nome, tipo, ativo)
       VALUES ($1, $2, $3, $4, 'store', true)
       ON CONFLICT (empresa_id, codigo)
       DO UPDATE SET nome = EXCLUDED.nome, ativo = true`,
      [empresa.id, loja.id, `${payload.channelCode}-estoque`.slice(0, 80), `${payload.nome} · Estoque`],
    );
    await trx.query(
      `INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
       VALUES ($1, $2, 'retirada', 'Retirada no estabelecimento', 'pickup', true, $3::jsonb)
       ON CONFLICT (empresa_id, storefront_id, codigo)
       DO UPDATE SET nome = EXCLUDED.nome, ativo = true, configuracao = EXCLUDED.configuracao`,
      [empresa.id, storefront.id, JSON.stringify({
        instructions: payload.public.pickup.instructions || 'A retirada será combinada com o estabelecimento.',
        leadTimeHours: payload.public.pickup.leadTimeHours,
        address: payload.public.address,
        contact: payload.public.contact,
        brandKey: payload.brand,
      })],
    );
    return {
      empresa,
      usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome_completo },
      loja,
      storefront,
      alias: payload.storeAlias,
      brandKey: payload.brand,
      created: !existingCompany.rows[0],
    };
  });
}

export async function listCommerceTenants() {
  const result = await db.queryRead(
    `SELECT e.id, e.nome, e.cnpj, e.razao_social, e.ativa, e.tipo_negocio,
            e.grupo_id, g.nome AS grupo_nome,
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
              'id', s.id, 'codigo', s.codigo, 'nome', s.nome, 'status', s.status,
              'lojaId', s.loja_id, 'aliases', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'alias', a.alias, 'brandKey', a.brand_key, 'ativo', a.ativo,
                'publicConfig', a.public_config
              ) ORDER BY a.alias) FROM commerce_storefront_aliases a
                WHERE a.empresa_id = s.empresa_id AND a.storefront_id = s.id), '[]'::jsonb)
            )) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) AS storefronts
       FROM empresas e
       LEFT JOIN grupos_empresariais g ON g.id = e.grupo_id
       LEFT JOIN commerce_storefronts s ON s.empresa_id = e.id AND s.status <> 'archived'
      GROUP BY e.id, g.nome
      ORDER BY e.nome ASC`,
  );
  return { items: result.rows };
}

export async function resolveStorefrontAlias(storeAlias) {
  const normalized = alias(storeAlias);
  const result = await db.queryRead(
    `SELECT a.alias, a.brand_key, a.public_config, s.id, s.empresa_id, s.loja_id,
            s.codigo, s.nome, s.canal, s.status, s.moeda, s.timezone, s.configuracoes
       FROM commerce_storefront_aliases a
       JOIN commerce_storefronts s
         ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
       JOIN empresas e ON e.id = a.empresa_id
      WHERE lower(a.alias) = lower($1) AND a.ativo = true
        AND s.status = 'active' AND e.ativa = true
      LIMIT 1`,
    [normalized],
  );
  if (!result.rows[0]) throw new CommerceError('storefront não encontrado para este alias', 'STOREFRONT_NOT_FOUND');
  return result.rows[0];
}

export { addressConfig, cnpj, phone, publicConfig, validateProvisioningInput };
