import { mergePublicPolicies } from './commerce-public-policies.js';
import { CommerceError, assertUuid, auditLog, tenantContext } from './commerce-core.js';

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$/;
const CHANNELS = new Set(['web', 'pos', 'marketplace', 'api', 'evento']);
const STATUSES = new Set(['draft', 'active', 'paused', 'archived']);

function text(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function storefrontCode(value) {
  const code = text(value, 80).toLowerCase();
  if (!CODE_PATTERN.test(code)) throw new CommerceError('código da loja deve ter 2–80 caracteres alfanuméricos, hífen ou sublinhado', 'STOREFRONT_CODE_INVALID');
  return code;
}

function storefrontName(value) {
  const name = text(value, 200);
  if (!name) throw new CommerceError('nome da loja é obrigatório', 'STOREFRONT_NAME_REQUIRED');
  return name;
}

async function resolveOperationalStore(trx, context, requestedStoreId) {
  const { empresaId, lojaId: activeStoreId } = tenantContext(context);
  const lojaId = requestedStoreId ? assertUuid(requestedStoreId, 'lojaId') : activeStoreId;
  if (activeStoreId && lojaId !== activeStoreId) throw new CommerceError('loja fora do escopo da sua membership', 'STORE_SCOPE_MISMATCH');
  if (!lojaId) return null;
  const result = await trx.query(
    `SELECT id, codigo, nome, nome_fantasia, timezone, ativa
       FROM lojas
      WHERE empresa_id = $1 AND id = $2
      LIMIT 1`,
    [empresaId, lojaId],
  );
  if (!result.rows[0] || result.rows[0].ativa === false) throw new CommerceError('loja operacional não encontrada ou inativa', 'STORE_NOT_FOUND');
  return result.rows[0];
}

async function createOperationalStore(trx, context, input, code, name) {
  const { empresaId, usuarioId, lojaId: activeStoreId } = tenantContext(context);
  if (activeStoreId) throw new CommerceError('selecione uma membership de tenant para criar uma nova loja', 'STORE_SCOPE_MISMATCH');
  const unitCode = text(input.lojaCodigo || code, 30).toUpperCase();
  const unitName = text(input.lojaNome || name, 100);
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(unitCode)) throw new CommerceError('código da unidade inválido', 'STORE_CODE_INVALID');
  const result = await trx.query(
    `INSERT INTO lojas (empresa_id, codigo, nome, nome_fantasia, timezone, ativa, configuracoes)
     VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)
     RETURNING id, codigo, nome, nome_fantasia, timezone, ativa`,
    [empresaId, unitCode, unitName, text(input.nomeFantasia || name, 255) || null, text(input.timezone || 'America/Sao_Paulo', 64), JSON.stringify({ commerceStorefront: true })],
  );
  const loja = result.rows[0];
  if (usuarioId) {
    await trx.query(
      `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja, ativo)
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT (usuario_id, loja_id) DO UPDATE SET ativo = true, role_loja = EXCLUDED.role_loja`,
      [usuarioId, loja.id],
    );
    await trx.query(
      `INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
       SELECT $1, $2, $3, r.id, true
         FROM commerce_roles r
        WHERE r.empresa_id IS NULL AND r.codigo = 'store_admin'
       ON CONFLICT (empresa_id, usuario_id, loja_id)
       DO UPDATE SET role_id = EXCLUDED.role_id, ativo = true, atualizado_em = CURRENT_TIMESTAMP`,
      [empresaId, usuarioId, loja.id],
    );
  }
  return loja;
}

async function storefrontInTenant(trx, context, storefrontId, forUpdate = false) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(storefrontId, 'storefrontId');
  const result = await trx.query(
    `SELECT s.id, s.empresa_id, s.loja_id, s.codigo, s.nome, s.canal, s.status,
            s.moeda, s.timezone, s.configuracoes
       FROM commerce_storefronts s
      WHERE s.empresa_id = $1 AND s.id = $2
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [empresaId, id],
  );
  const storefront = result.rows[0];
  if (!storefront) throw new CommerceError('storefront não encontrado no tenant', 'STOREFRONT_NOT_FOUND');
  if (context.lojaId && storefront.loja_id && storefront.loja_id !== context.lojaId) throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
  return storefront;
}

export async function listStorefronts(client, context) {
  const { empresaId, lojaId } = tenantContext(context);
  const result = await client.query(
    `SELECT s.id, s.codigo, s.nome, s.canal, s.status, s.moeda, s.timezone,
            s.loja_id, s.configuracoes, s.criado_em, s.atualizado_em,
            l.codigo AS loja_codigo, l.nome AS loja_nome, l.nome_fantasia,
            COALESCE((SELECT COUNT(*)::int FROM commerce_product_channels pc WHERE pc.empresa_id = s.empresa_id AND pc.storefront_id = s.id AND pc.publicado = true), 0) AS produtos_publicados,
            COALESCE((SELECT COUNT(*)::int FROM commerce_orders o WHERE o.empresa_id = s.empresa_id AND o.storefront_id = s.id), 0) AS pedidos,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'dominio', d.dominio, 'principal', d.principal, 'status', CASE WHEN d.verificado_em IS NULL THEN 'pending' ELSE 'verified' END) ORDER BY d.principal DESC, d.dominio ASC) FROM commerce_store_domains d WHERE d.empresa_id = s.empresa_id AND d.storefront_id = s.id), '[]'::jsonb) AS dominios
       FROM commerce_storefronts s
       LEFT JOIN lojas l ON l.empresa_id = s.empresa_id AND l.id = s.loja_id
      WHERE s.empresa_id = $1
        AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
        AND s.status <> 'archived'
      ORDER BY CASE WHEN s.loja_id = $2 THEN 0 ELSE 1 END, s.nome ASC`,
    [empresaId, lojaId],
  );
  return { items: result.rows };
}

export async function createStorefront(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const code = storefrontCode(input.codigo);
  const name = storefrontName(input.nome);
  const canal = CHANNELS.has(String(input.canal || 'web')) ? String(input.canal || 'web') : 'web';
  const status = input.status && STATUSES.has(String(input.status)) ? String(input.status) : 'active';
  const moeda = text(input.moeda || 'BRL', 3).toUpperCase();
  const timezone = text(input.timezone || 'America/Sao_Paulo', 64);
  if (!/^[A-Z]{3}$/.test(moeda)) throw new CommerceError('moeda deve usar código ISO de três letras', 'STOREFRONT_CURRENCY_INVALID');
  const duplicate = await trx.query('SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND codigo = $2 LIMIT 1', [empresaId, code]);
  if (duplicate.rows[0]) throw new CommerceError('já existe um storefront com este código no tenant', 'STOREFRONT_CONFLICT');
  let loja = await resolveOperationalStore(trx, context, input.lojaId);
  if (!loja && input.criarUnidade !== false) loja = await createOperationalStore(trx, context, input, code, name);
  if (!loja && status !== 'draft') throw new CommerceError('storefront sem unidade operacional só pode permanecer em rascunho', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
  const created = await trx.query(
    `INSERT INTO commerce_storefronts (empresa_id, loja_id, codigo, nome, canal, status, moeda, timezone, configuracoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [empresaId, loja?.id || null, code, name, canal, status, moeda, timezone, JSON.stringify(input.configuracoes || {})],
  );
  const storefront = created.rows[0];
  if (loja) {
    await trx.query(
      `INSERT INTO commerce_inventory_locations (empresa_id, loja_id, codigo, nome, tipo, ativo)
       VALUES ($1, $2, $3, $4, 'store', true)
       ON CONFLICT (empresa_id, codigo) DO NOTHING`,
      [empresaId, loja.id, `${code}-estoque`.slice(0, 80), `${name} · Estoque`],
    );
  }
  await auditLog(trx, context, {
    entidade: 'storefront', entidadeId: storefront.id, acao: 'created',
    lojaId: loja?.id || null,
    depois: { codigo: code, nome: name, canal, status, lojaId: loja?.id || null },
  });
  return { ...storefront, loja: loja || null };
}

export async function updateStorefront(trx, context, storefrontId, input = {}) {
  const { empresaId } = tenantContext(context);
  const current = await storefrontInTenant(trx, context, storefrontId, true);
  const allowed = [];
  const values = [empresaId, current.id];
  const nextStatus = input.status !== undefined ? String(input.status) : current.status;
  if (!STATUSES.has(nextStatus)) throw new CommerceError('status do storefront inválido', 'STOREFRONT_STATUS_INVALID');
  let nextStoreId = current.loja_id;
  let requestedStore = null;
  if (input.lojaId !== undefined) {
    const requestedStoreId = String(input.lojaId || '').trim() || null;
    if (!requestedStoreId && context.lojaId) throw new CommerceError('loja fora do escopo da sua membership', 'STORE_SCOPE_MISMATCH');
    requestedStore = requestedStoreId ? await resolveOperationalStore(trx, context, requestedStoreId) : null;
    nextStoreId = requestedStore?.id || null;
  }
  if (nextStatus === 'active' && nextStoreId && !requestedStore) {
    try {
      requestedStore = await resolveOperationalStore(trx, context, nextStoreId);
    } catch (error) {
      if (error?.code !== 'STORE_NOT_FOUND') throw error;
      throw new CommerceError('vincule uma unidade operacional ativa antes de manter o storefront ativo', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
    }
  }
  if (nextStatus === 'active' && !requestedStore) throw new CommerceError('vincule uma unidade operacional antes de ativar o storefront', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
  if (input.nome !== undefined) { const value = storefrontName(input.nome); values.push(value); allowed.push(`nome = $${values.length}`); }
  if (input.codigo !== undefined) { const value = storefrontCode(input.codigo); values.push(value); allowed.push(`codigo = $${values.length}`); }
  if (input.canal !== undefined) { const value = String(input.canal); if (!CHANNELS.has(value)) throw new CommerceError('canal do storefront inválido', 'STOREFRONT_CHANNEL_INVALID'); values.push(value); allowed.push(`canal = $${values.length}`); }
  if (input.status !== undefined) { values.push(nextStatus); allowed.push(`status = $${values.length}`); }
  if (input.moeda !== undefined) { const value = text(input.moeda, 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(value)) throw new CommerceError('moeda deve usar código ISO de três letras', 'STOREFRONT_CURRENCY_INVALID'); values.push(value); allowed.push(`moeda = $${values.length}`); }
  if (input.timezone !== undefined) { values.push(text(input.timezone, 64)); allowed.push(`timezone = $${values.length}`); }
  if (input.publicPolicies !== undefined) {
    if (input.configuracoes !== undefined) throw new CommerceError('edite políticas separadamente das demais configurações', 'PUBLIC_POLICIES_CONFLICT');
    values.push(JSON.stringify(mergePublicPolicies(current.configuracoes || {}, input.publicPolicies))); allowed.push(`configuracoes = $${values.length}::jsonb`);
  } else if (input.configuracoes !== undefined) { values.push(JSON.stringify(input.configuracoes || {})); allowed.push(`configuracoes = $${values.length}::jsonb`); }
  if (input.lojaId !== undefined && input.lojaId !== current.loja_id) {
    values.push(requestedStore?.id || null); allowed.push(`loja_id = $${values.length}`);
  }
  if (!allowed.length) throw new CommerceError('nenhum campo editável informado', 'NO_CHANGES');
  const result = await trx.query(`UPDATE commerce_storefronts SET ${allowed.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  if (input.publicPolicies !== undefined) {
    // O alias é a fonte pública prioritária. Atualizar só policies no mesmo
    // tenant/canal mantém domínio e alias coerentes, sem substituir a marca.
    const policies = mergePublicPolicies({}, input.publicPolicies).public.policies;
    await trx.query(`UPDATE commerce_storefront_aliases
      SET public_config = jsonb_set(COALESCE(public_config, '{}'::jsonb), '{policies}', (CASE WHEN jsonb_typeof(public_config->'policies') = 'object' THEN public_config->'policies' ELSE '{}'::jsonb END) || $3::jsonb, true), atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND storefront_id = $2`, [empresaId, current.id, JSON.stringify(policies)]);
  }
  await auditLog(trx, context, { entidade: 'storefront', entidadeId: current.id, acao: 'updated', lojaId: current.loja_id || null, antes: { nome: current.nome, codigo: current.codigo, status: current.status, lojaId: current.loja_id }, depois: { fields: Object.keys(input).slice(0, 20) } });
  return result.rows[0];
}

export { storefrontCode };
