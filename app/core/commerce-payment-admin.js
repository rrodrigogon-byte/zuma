import { paymentProviders } from './payment-adapters.js';
import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';

const SECRET_REF = /^env:[A-Z][A-Z0-9_]{2,}$/;
const PROVIDERS = [
  { code: 'mercadopago', name: 'Mercado Pago', adapter: true, methods: ['pix'], secretRefs: ['env:MP_ACCESS_TOKEN', 'env:MP_WEBHOOK_SECRET'] },
  { code: 'infinitepay', name: 'InfinitePay Checkout', adapter: true, methods: ['pix', 'credit_card'], secretRefs: ['env:INFINITEPAY_HANDLE'] },
  { code: 'stripe', name: 'Stripe', adapter: false, methods: [], secretRefs: [] },
  { code: 'pagarme', name: 'Pagar.me', adapter: false, methods: [], secretRefs: [] },
  { code: 'stone', name: 'Stone', adapter: false, methods: [], secretRefs: [] },
];

function providerDefinition(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  const definition = PROVIDERS.find(item => item.code === normalized);
  if (!definition) throw new CommerceError('provedor de pagamento não suportado pelo catálogo de adapters', 'PAYMENT_PROVIDER_UNSUPPORTED', { provider: normalized });
  return definition;
}

function secretRef(value, field = 'secretRef') {
  const normalized = String(value || '').trim();
  if (!SECRET_REF.test(normalized)) throw new CommerceError(`${field} deve ser uma referência env:VARIAVEL, nunca um segredo`, 'PAYMENT_SECRET_REF_INVALID', { field });
  return normalized;
}

function booleanInput(value, field) {
  if (value !== true && value !== false) throw new CommerceError(`${field} deve ser booleano`, 'PAYMENT_ACCOUNT_INVALID', { field });
  return value;
}

function publicHttpsUrl(value, field) {
  const normalized = String(value || '').trim().slice(0, 500);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid');
    return parsed.toString();
  } catch {
    throw new CommerceError(`${field} deve ser uma URL HTTPS pública sem credenciais`, 'PAYMENT_ACCOUNT_INVALID', { field });
  }
}

function normalizeInfinitePayHandle(value) {
  return String(value || '').trim().replace(/^\$/, '').slice(0, 120);
}

function assertInfinitePayEndpoints(config, domains = []) {
  const allowedHosts = new Set((Array.isArray(domains) ? domains : []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
  const redirect = new URL(config.redirectUrl);
  const webhook = new URL(config.webhookUrl);
  if (!allowedHosts.has(redirect.hostname.toLowerCase()) || !allowedHosts.has(webhook.hostname.toLowerCase())) {
    throw new CommerceError('URLs InfinitePay devem usar um domínio verificado do storefront', 'PAYMENT_ACCOUNT_INVALID', { field: 'publicConfig' });
  }
  if (!/^\/checkout(?:\/[^/?#]+)?\/?$/.test(redirect.pathname) || webhook.pathname !== '/api/webhooks/infinitepay/payments') {
    throw new CommerceError('rotas de retorno ou webhook InfinitePay são inválidas', 'PAYMENT_ACCOUNT_INVALID', { field: 'publicConfig' });
  }
}

async function verifiedStorefrontDomains(trx, empresaId, storefrontId) {
  const result = await trx.query(
    `SELECT dominio FROM commerce_store_domains WHERE empresa_id = $1 AND storefront_id = $2 AND verificado_em IS NOT NULL`,
    [empresaId, storefrontId],
  );
  return result.rows.map(row => row.dominio);
}

function publicConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const config = {};
  if (source.webhookSecretRef) config.webhookSecretRef = secretRef(source.webhookSecretRef, 'webhookSecretRef');
  if (source.webhookUrl) config.webhookUrl = publicHttpsUrl(source.webhookUrl, 'webhookUrl');
  if (source.redirectUrl) config.redirectUrl = publicHttpsUrl(source.redirectUrl, 'redirectUrl');
  if (source.handle) config.handle = normalizeInfinitePayHandle(source.handle);
  if (Array.isArray(source.methods)) config.methods = [...new Set(source.methods.map(value => String(value).toLowerCase()).filter(value => ['pix', 'credit_card', 'debit_card', 'boleto'].includes(value)))].slice(0, 10);
  return config;
}

function envReferenceConfigured(reference) {
  const value = String(reference || '').trim();
  return SECRET_REF.test(value) && Boolean(process.env[value.slice(4)]);
}

function accountCredentialsConfigured(account, provider) {
  if (!paymentProviders.get(provider) || !envReferenceConfigured(account?.secret_ref)) return false;
  if (provider === 'mercadopago') return envReferenceConfigured(account?.public_config?.webhookSecretRef);
  if (provider === 'infinitepay') {
    const config = account?.public_config || {};
    const environmentHandle = normalizeInfinitePayHandle(process.env[String(account.secret_ref).slice(4)]);
    const configuredHandle = normalizeInfinitePayHandle(config.handle);
    const methods = Array.isArray(config.methods) ? config.methods : [];
    return Boolean(configuredHandle && environmentHandle && configuredHandle === environmentHandle
      && config.redirectUrl && config.webhookUrl && methods.includes('pix') && methods.includes('credit_card'));
  }
  return true;
}

function safePublicConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    ...(source.webhookUrl ? { webhookUrl: String(source.webhookUrl).slice(0, 500) } : {}),
    ...(source.redirectUrl ? { redirectUrl: String(source.redirectUrl).slice(0, 500) } : {}),
    ...(source.handle ? { handle: String(source.handle).slice(0, 120) } : {}),
    ...(Array.isArray(source.methods) ? { methods: source.methods.slice(0, 10) } : {}),
  };
}

function accountRow(row) {
  const secretConfigured = envReferenceConfigured(row.secret_ref);
  const webhookConfigured = row.provider === 'mercadopago'
    ? envReferenceConfigured(row.public_config?.webhookSecretRef)
    : row.provider === 'infinitepay' ? Boolean(row.public_config?.webhookUrl) : true;
  const registered = Boolean(paymentProviders.get(row.provider));
  return {
    id: row.id,
    storefront_id: row.storefront_id,
    storefront_name: row.storefront_name || null,
    provider: row.provider,
    ambiente: row.ambiente,
    nome: row.nome,
    ativo: row.ativo,
    registered,
    ready: registered && accountCredentialsConfigured(row, row.provider),
    public_config: safePublicConfig(row.public_config),
    secret_configured: secretConfigured,
    webhook_configured: webhookConfigured,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

export function listPaymentProviders() {
  return {
    items: PROVIDERS.map(item => ({
      code: item.code,
      name: item.name,
      adapter: item.adapter,
      methods: item.methods,
      registered: Boolean(paymentProviders.get(item.code)),
    })),
  };
}

export async function listPaymentAccounts(client, contextInput) {
  const context = tenantContext(contextInput);
  const result = await client.query(
    `SELECT a.id, a.storefront_id, s.nome AS storefront_name, a.provider, a.ambiente, a.nome,
            a.public_config, a.secret_ref, a.ativo, a.criado_em, a.atualizado_em
       FROM commerce_payment_accounts a
       LEFT JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
      WHERE a.empresa_id = $1
        AND ($2::uuid IS NULL OR s.loja_id = $2 OR a.storefront_id IS NULL)
      ORDER BY a.atualizado_em DESC, a.nome ASC`,
    [context.empresaId, context.lojaId],
  );
  return { items: result.rows.map(accountRow) };
}

export async function createPaymentAccount(trx, contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const definition = providerDefinition(input.provider);
  const nome = String(input.nome || '').trim().slice(0, 120);
  if (!nome) throw new CommerceError('nome da conta de pagamento é obrigatório', 'PAYMENT_ACCOUNT_INVALID');
  const ambiente = String(input.ambiente || 'sandbox').toLowerCase();
  if (!['sandbox', 'production'].includes(ambiente)) throw new CommerceError('ambiente de pagamento inválido', 'PAYMENT_ACCOUNT_INVALID');
  const secretRefValue = secretRef(input.secretRef);
  const config = publicConfig(input.publicConfig);
  const ativo = input.ativo === undefined ? false : booleanInput(input.ativo, 'ativo');
  if (definition.code === 'mercadopago' && !config.webhookSecretRef) {
    throw new CommerceError('Mercado Pago exige webhookSecretRef por referência de ambiente', 'PAYMENT_ACCOUNT_INVALID');
  }
  if (definition.code === 'infinitepay' && (!config.handle || !config.redirectUrl || !config.webhookUrl || !config.methods?.includes('pix') || !config.methods?.includes('credit_card'))) {
    throw new CommerceError('InfinitePay exige handle, URLs públicas e métodos Pix/cartão', 'PAYMENT_ACCOUNT_INVALID');
  }
  if (ativo && !accountCredentialsConfigured({ secret_ref: secretRefValue, public_config: config }, definition.code)) {
    throw new CommerceError('não é possível ativar uma conta sem credenciais presentes no secret manager e adapter registrado', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  }
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  if (!storefrontId) throw new CommerceError('storefrontId é obrigatório para conta de pagamento', 'PAYMENT_ACCOUNT_INVALID');
  if (storefrontId) {
    const storefront = await trx.query(
      `SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND id = $2 AND status = 'active' AND ($3::uuid IS NULL OR loja_id = $3) LIMIT 1`,
      [context.empresaId, storefrontId, context.lojaId],
    );
    if (!storefront.rows[0]) throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
    if (definition.code === 'infinitepay') assertInfinitePayEndpoints(config, await verifiedStorefrontDomains(trx, context.empresaId, storefrontId));
  }
  const result = await trx.query(
    `INSERT INTO commerce_payment_accounts
      (empresa_id, storefront_id, provider, ambiente, nome, secret_ref, public_config, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING id, storefront_id, provider, ambiente, nome, public_config, secret_ref, ativo, criado_em, atualizado_em`,
    [context.empresaId, storefrontId, definition.code, ambiente, nome, secretRefValue, JSON.stringify(config), ativo],
  );
  return accountRow(result.rows[0]);
}

export async function updatePaymentAccount(trx, contextInput, idInput, input = {}) {
  const context = tenantContext(contextInput);
  const id = assertUuid(idInput, 'paymentAccountId');
  const existing = await trx.query(
    `SELECT a.id, a.provider, a.public_config, a.secret_ref, a.ativo, a.storefront_id
       FROM commerce_payment_accounts a
       LEFT JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
      WHERE a.empresa_id = $1 AND a.id = $2
        AND ($3::uuid IS NULL OR s.loja_id = $3 OR a.storefront_id IS NULL)
      FOR UPDATE OF a`,
    [context.empresaId, id, context.lojaId],
  );
  const current = existing.rows[0];
  if (!current) throw new CommerceError('conta de pagamento não encontrada', 'PAYMENT_ACCOUNT_NOT_FOUND');
  const definition = providerDefinition(current.provider);
  let nextSecretRef = current.secret_ref;
  let nextPublicConfig = current.public_config || {};
  let nextAtivo = current.ativo;
  const sets = [];
  const values = [context.empresaId, id];
  if (input.nome !== undefined) {
    const nome = String(input.nome || '').trim().slice(0, 120);
    if (!nome) throw new CommerceError('nome da conta de pagamento é obrigatório', 'PAYMENT_ACCOUNT_INVALID');
    values.push(nome); sets.push(`nome = $${values.length}`);
  }
  if (input.ambiente !== undefined) {
    const ambiente = String(input.ambiente).toLowerCase();
    if (!['sandbox', 'production'].includes(ambiente)) throw new CommerceError('ambiente de pagamento inválido', 'PAYMENT_ACCOUNT_INVALID');
    values.push(ambiente); sets.push(`ambiente = $${values.length}`);
  }
  if (input.secretRef !== undefined) {
    nextSecretRef = secretRef(input.secretRef);
    values.push(nextSecretRef); sets.push(`secret_ref = $${values.length}`);
  }
  if (input.publicConfig !== undefined) {
    nextPublicConfig = { ...nextPublicConfig, ...publicConfig(input.publicConfig) };
    if (definition.code === 'mercadopago' && !nextPublicConfig.webhookSecretRef) throw new CommerceError('Mercado Pago exige webhookSecretRef por referência de ambiente', 'PAYMENT_ACCOUNT_INVALID');
    if (definition.code === 'infinitepay') {
      if (!nextPublicConfig.handle || !nextPublicConfig.redirectUrl || !nextPublicConfig.webhookUrl || !nextPublicConfig.methods?.includes('pix') || !nextPublicConfig.methods?.includes('credit_card')) throw new CommerceError('InfinitePay exige handle, URLs públicas e métodos Pix/cartão', 'PAYMENT_ACCOUNT_INVALID');
      assertInfinitePayEndpoints(nextPublicConfig, await verifiedStorefrontDomains(trx, context.empresaId, current.storefront_id));
    }
    values.push(JSON.stringify(nextPublicConfig)); sets.push(`public_config = $${values.length}::jsonb`);
  }
  if (input.ativo !== undefined) {
    nextAtivo = booleanInput(input.ativo, 'ativo');
    values.push(nextAtivo); sets.push(`ativo = $${values.length}`);
  }
  if (!sets.length) throw new CommerceError('nenhuma alteração informada', 'NO_CHANGES');
  if (nextAtivo && !accountCredentialsConfigured({ secret_ref: nextSecretRef, public_config: nextPublicConfig }, definition.code)) {
    throw new CommerceError('não é possível manter ativa uma conta sem credenciais presentes no secret manager e adapter registrado', 'PAYMENT_ACCOUNT_NOT_CONFIGURED');
  }
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  const result = await trx.query(
    `UPDATE commerce_payment_accounts SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2
     RETURNING id, storefront_id, provider, ambiente, nome, public_config, secret_ref, ativo, criado_em, atualizado_em`,
    values,
  );
  return accountRow(result.rows[0]);
}

export async function listPayments(client, contextInput, options = {}) {
  const context = tenantContext(contextInput);
  const parsedLimit = Number.parseInt(options.limit, 10);
  const parsedOffset = Number.parseInt(options.offset, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : 100;
  const offset = Number.isFinite(parsedOffset) ? Math.min(10000, Math.max(0, parsedOffset)) : 0;
  const values = [context.empresaId, context.lojaId];
  const predicates = ['p.empresa_id = $1', '($2::uuid IS NULL OR o.loja_id = $2)'];
  const status = String(options.status || '').trim().toLowerCase();
  if (status && /^[a-z_]+$/.test(status)) { values.push(status); predicates.push(`p.status = $${values.length}`); }
  const query = String(options.q || '').trim().slice(0, 160);
  if (query) { values.push(`%${query}%`); predicates.push(`(o.public_code ILIKE $${values.length} OR c.nome ILIKE $${values.length} OR p.provider_payment_id ILIKE $${values.length})`); }
  const where = predicates.join(' AND ');
  const count = await client.query(
    `SELECT COUNT(*)::int AS total
       FROM commerce_payments p
       JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
       LEFT JOIN commerce_customers c ON c.empresa_id = p.empresa_id AND c.id = o.customer_id
      WHERE ${where}`,
    values,
  );
  const result = await client.query(
    `SELECT p.id, p.order_id, o.public_code AS order_code, p.provider, p.method, p.status,
            p.amount, p.fee, p.provider_payment_id, p.criado_em, p.atualizado_em,
            c.nome AS customer_name
       FROM commerce_payments p
       JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
       LEFT JOIN commerce_customers c ON c.empresa_id = p.empresa_id AND c.id = o.customer_id
      WHERE ${where}
      ORDER BY p.criado_em DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  const total = Number(count.rows[0]?.total || 0);
  return { items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } };
}
