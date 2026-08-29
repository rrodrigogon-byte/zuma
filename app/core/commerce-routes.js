import crypto from 'node:crypto';
import express from 'express';
import { db } from './database.js';
import { customerReport, inventoryReport, salesReport } from './commerce-reports.js';
import { canTransitionPaymentStatus, createPaymentAttempt, paymentAccountReady, paymentProviders, syncPaymentAttempt, validatePaymentMethod, verifyPaymentWebhook } from './payment-adapters.js';
import { createPaymentAccount, listPaymentAccounts, listPaymentProviders, listPayments, updatePaymentAccount } from './commerce-payment-admin.js';
import { resolveCommerceIdentity } from './commerce-identity-bridge.js';
import { applyPromotionToOrder, createPromotion, createPromotionCode, listPromotions } from './commerce-promotions.js';
import { createMembership, listMemberships, listRoles, updateMembership } from './commerce-admin-users.js';
import { createCustomer, createCustomerAddress, deleteCustomerAddress, getCustomer, listCustomerAddresses, updateCustomer, updateCustomerAddress } from './commerce-customers.js';
import { createStorefrontDomain, listStorefrontDomains, setPrimaryStorefrontDomain, verifyStorefrontDomain } from './commerce-domains.js';
import { createShippingAccount, failShippingLabel, finalizeShippingLabel, listShippingAccounts, listShippingProviders, lookupPostalCode, prepareShippingLabel, publicShippingMethod, quoteShipping, shippingAccountReady, updateShippingAccount, updateShippingTracking } from './commerce-shipping.js';
import { shippingProviders } from './shipping-adapters.js';
import {
  CommerceError,
  auditLog,
  adjustInventory,
  archiveCatalogProduct,
  archiveCatalogVariant,
  createCatalogMedia,
  createCatalogProduct,
  createCatalogVariant,
  createCategory,
  createFulfillment,
  createInventoryLocation,
  createPendingOrder,
  listPublishedProducts,
  publishCatalogProduct,
  setVariantPrice,
  updateCategory,
  updateCatalogVariant,
  deleteCatalogMedia,
  listCatalogMedia,
  createShippingMethod,
  updateShippingMethod,
  tenantContext,
  transitionOrder,
  updateCatalogProduct,
  updateFulfillment,
  withCommerceTransaction,
} from './commerce-core.js';

function publicHost(req) {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return (forwarded || req.hostname || '').split(':')[0].toLowerCase();
}

async function resolvePublicStorefront(req) {
  const dominio = publicHost(req);
  if (!dominio) throw new CommerceError('domínio da loja não resolvido', 'STOREFRONT_DOMAIN_REQUIRED');
  const result = await db.query(
    `SELECT s.id, s.empresa_id, s.loja_id, s.codigo, s.nome, s.canal, s.status, s.moeda, s.timezone
       FROM commerce_store_domains d
       JOIN commerce_storefronts s
         ON s.empresa_id = d.empresa_id AND s.id = d.storefront_id
      WHERE lower(d.dominio) = lower($1) AND d.verificado_em IS NOT NULL AND s.status = 'active'
      LIMIT 1`,
    [dominio],
  );
  if (!result.rows[0]) throw new CommerceError('storefront não encontrado para este domínio', 'STOREFRONT_NOT_FOUND');
  return result.rows[0];
}

export function parsePagination(req, defaultLimit = 100, maxLimit = 500) {
  const parsedLimit = Number.parseInt(String(req.query.limit || defaultLimit), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset || 0), 10);
  return { limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit, offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0 };
}

function statusCounts(rows = []) {
  return rows.reduce((result, row) => {
    result[String(row.status)] = Number(row.total || 0);
    return result;
  }, {});
}

function jsonError(res, error) {
  const statusByCode = {
    INVALID_ID: 400,
    EMPTY_CART: 400,
    CUSTOMER_REQUIRED: 400,
    STOREFRONT_DOMAIN_REQUIRED: 400,
    STOREFRONT_NOT_FOUND: 404,
    ITEM_UNAVAILABLE: 409,
    INSUFFICIENT_STOCK: 409,
    INVENTORY_LEVEL_NOT_FOUND: 409,
    INVENTORY_LOCATION_REQUIRED: 409,
    IDEMPOTENCY_CONFLICT: 409,
    CUSTOMER_NOT_FOUND: 404,
    ORDER_NOT_FOUND: 404,
    INVALID_ORDER_STATUS: 400,
    INVALID_ORDER_TRANSITION: 409,
    TENANT_CONTEXT_REQUIRED: 401,
    TENANT_SELECTION_REQUIRED: 400,
    STORE_SELECTION_REQUIRED: 400,
    PERMISSION_DENIED: 403,
    CATEGORY_REQUIRED: 400,
    CATEGORY_NOT_FOUND: 404,
    CATEGORY_INVALID: 400,
    CATEGORY_SELF_PARENT: 400,
    PRODUCT_REQUIRED: 400,
    PRODUCT_NOT_FOUND: 404,
    NO_CHANGES: 400,
    INVALID_PROMOTIONAL_PRICE: 400,
    INVALID_INVENTORY_DELTA: 400,
    INVALID_QUANTITY: 400,
    INVENTORY_STATE_CONFLICT: 409,
    INVENTORY_LOCATION_SCOPE_MISMATCH: 409,
    INVALID_PRICE: 400,
    VARIANT_NOT_FOUND: 404,
    VARIANT_REQUIRED: 400,
    VARIANT_INVALID: 400,
    MEDIA_REQUIRED: 400,
    MEDIA_NOT_FOUND: 404,
    LOCATION_REQUIRED: 400,
    STORE_NOT_FOUND: 404,
    INVALID_REPORT_PERIOD: 400,
    PAYMENT_PROVIDER_NOT_CONFIGURED: 503,
    PAYMENT_METHOD_INVALID: 400,
    PAYMENT_IDEMPOTENCY_REQUIRED: 400,
    PAYMENT_ACCOUNT_NOT_CONFIGURED: 409,
    PAYMENT_ATTEMPT_IN_PROGRESS: 409,
    PAYMENT_ORDER_STATE_INVALID: 409,
    PAYMENT_ADAPTER_INVALID_RESPONSE: 502,
    PAYMENT_PROVIDER_ERROR: 502,
    PAYMENT_PROVIDER_TIMEOUT: 504,
    PAYMENT_WEBHOOK_INVALID: 400,
    PAYMENT_WEBHOOK_AMBIGUOUS: 409,
    PAYMENT_AMOUNT_MISMATCH: 422,
    PAYMENT_PROVIDER_UNSUPPORTED: 400,
    PAYMENT_SECRET_REF_INVALID: 400,
    PAYMENT_ACCOUNT_INVALID: 400,
    PAYMENT_ACCOUNT_NOT_FOUND: 404,
    PAYMENT_NOT_FOUND: 404,
    PAYMENT_PROVIDER_PAYMENT_NOT_FOUND: 409,
    PAYMENT_PROVIDER_STATUS_INVALID: 502,
    PAYMENT_PROVIDER_STATUS_UNAVAILABLE: 503,
    AUDIT_INVALID: 400,
    SHIPPING_METHOD_INVALID: 400,
    SHIPPING_METHOD_NOT_FOUND: 404,
    SHIPPING_CEP_INVALID: 400,
    SHIPPING_CEP_NOT_FOUND: 404,
    SHIPPING_CEP_PROVIDER_ERROR: 502,
    SHIPPING_CEP_PROVIDER_TIMEOUT: 504,
    SHIPPING_ADDRESS_REQUIRED: 400,
    SHIPPING_ADDRESS_INCOMPLETE: 400,
    SHIPPING_ADDRESS_STATE_INVALID: 400,
    SHIPPING_ADDRESS_DOCUMENT_REQUIRED: 400,
    SHIPPING_ADDRESS_DOCUMENT_INVALID: 422,
    SHIPPING_ITEMS_REQUIRED: 400,
    SHIPPING_PACKAGE_DATA_REQUIRED: 422,
    SHIPPING_PROVIDER_UNSUPPORTED: 400,
    SHIPPING_PROVIDER_NOT_CONFIGURED: 503,
    SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE: 409,
    SHIPPING_SERVICE_CODES_REQUIRED: 422,
    SHIPPING_TRACKING_INVALID: 400,
    SHIPPING_WEBHOOK_UNSUPPORTED: 409,
    SHIPPING_ACCOUNT_INVALID: 400,
    SHIPPING_ACCOUNT_NOT_FOUND: 404,
    SHIPPING_ACCOUNT_NOT_CONFIGURED: 409,
    SHIPPING_SECRET_REF_INVALID: 400,
    SHIPPING_PROVIDER_ERROR: 502,
    SHIPPING_PROVIDER_TIMEOUT: 504,
    SHIPPING_NO_OPTIONS: 422,
    SHIPPING_ADAPTER_INVALID_RESPONSE: 502,
    SHIPPING_QUOTE_REQUIRED: 400,
    SHIPPING_QUOTE_INVALID: 400,
    SHIPPING_QUOTE_EXPIRED: 409,
    SHIPPING_QUOTE_MISMATCH: 409,
    SHIPPING_OPTION_INVALID: 400,
    SHIPPING_INVOICE_REQUIRED: 422,
    SHIPPING_ORDER_NOT_PAID: 409,
    SHIPPING_ORIGIN_INCOMPLETE: 422,
    SHIPPING_ORIGIN_DOCUMENT_INVALID: 422,
    SHIPPING_SHIPMENT_NOT_FOUND: 409,
    SHIPPING_ACCOUNT_SCOPE_MISMATCH: 409,
    SHIPPING_WEBHOOK_INVALID: 400,
    SHIPPING_OPERATION_IN_PROGRESS: 409,
    SHIPPING_OPERATION_CONFLICT: 409,
    FULFILLMENT_NOT_FOUND: 404,
    FULFILLMENT_ORDER_NOT_PAID: 409,
    INVALID_FULFILLMENT_TRANSITION: 409,
    PROMOTION_INVALID: 400,
    PROMOTION_CODE_INVALID: 400,
    PROMOTION_NOT_FOUND: 404,
    PROMOTION_ORDER_STATE_INVALID: 409,
    PROMOTION_ALREADY_APPLIED: 409,
    PROMOTION_TYPE_UNSUPPORTED: 400,
    USER_NOT_FOUND: 404,
    ROLE_NOT_FOUND: 404,
    MEMBERSHIP_NOT_FOUND: 404,
    STORE_SCOPE_MISMATCH: 409,
    STORE_SELECTION_REQUIRED: 400,
  };
  const status = statusByCode[error?.code] || 500;
  return res.status(status).json({ error: status >= 500 ? 'erro interno do Commerce Core' : error.message, code: error?.code || 'COMMERCE_ERROR', details: error?.details || {} });
}

async function adminContext(req) {
  return resolveCommerceIdentity(req);
}

async function requirePermission(req, permission) {
  const context = await adminContext(req);
  const result = await db.query(
    `SELECT 1
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = $1 OR r.empresa_id IS NULL)
       JOIN commerce_role_permissions rp ON rp.role_id = r.id
       JOIN commerce_permissions p ON p.id = rp.permission_id AND p.codigo = $2
      WHERE m.empresa_id = $1 AND m.usuario_id = $3 AND m.ativo = true
        AND (m.loja_id IS NULL OR m.loja_id = $4)
      LIMIT 1`,
    [context.empresaId, permission, context.usuarioId, context.lojaId],
  );
  if (!result.rows[0]) throw new CommerceError('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission });
  return context;
}

export function createCommercePublicRouter() {
  const router = express.Router();
  router.get('/context', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const [paymentAccounts, shippingAccounts] = await Promise.all([
        db.query(`SELECT id, provider, ambiente, secret_ref, public_config, ativo FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true`, [storefront.empresa_id, storefront.id]),
        db.query(`SELECT id, provider, secret_ref, public_config, ativo FROM commerce_shipping_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true`, [storefront.empresa_id, storefront.id]),
      ]);
      const paymentsReady = paymentAccounts.rows.some(paymentAccountReady);
      const shippingReady = shippingAccounts.rows.some(shippingAccountReady);
      res.json({ storefront: { id: storefront.id, codigo: storefront.codigo, nome: storefront.nome, moeda: storefront.moeda, timezone: storefront.timezone }, capabilities: { catalog: true, cart: true, checkout: true, payments: paymentsReady, shipping: shippingReady } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/products', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const products = await listPublishedProducts({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { storefrontId: storefront.id, query: req.query.q, categoryId: req.query.categoryId, limit: req.query.limit, offset: req.query.offset });
      res.json({ storefrontId: storefront.id, items: products });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/address/:cep', async (req, res) => {
    try { res.json(await lookupPostalCode(req.params.cep)); } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping-methods', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(
        `SELECT sm.id, sm.codigo, sm.nome, sm.tipo, sm.configuracao,
                a.id AS active_shipping_account_id, a.provider AS active_shipping_provider, a.secret_ref AS active_shipping_secret_ref, a.public_config AS active_shipping_public_config, a.ativo AS active_shipping_account
           FROM commerce_shipping_methods sm
           LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = sm.empresa_id AND a.storefront_id = sm.storefront_id AND a.id::text = COALESCE(sm.configuracao->>'shippingAccountId', sm.configuracao->>'accountId') AND a.ambiente = 'production' AND a.ativo = true
          WHERE sm.empresa_id = $1 AND sm.storefront_id = $2 AND sm.ativo = true
          ORDER BY sm.nome ASC`,
        [storefront.empresa_id, storefront.id],
      );
      res.json({ storefrontId: storefront.id, items: result.rows.map(row => publicShippingMethod({ ...row, shipping_account_ready: shippingAccountReady({ id: row.active_shipping_account_id, provider: row.active_shipping_provider, secret_ref: row.active_shipping_secret_ref, public_config: row.active_shipping_public_config, ativo: row.active_shipping_account }) })) });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/quotes', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await quoteShipping(db, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { ...req.body, storefrontId: storefront.id });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payment-methods', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(`SELECT id, provider, ambiente, secret_ref, public_config, ativo FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true ORDER BY provider`, [storefront.empresa_id, storefront.id]);
      const items = [];
      for (const account of result.rows) {
        if (!paymentAccountReady(account)) continue;
        const methods = Array.isArray(account.public_config?.methods) && account.public_config.methods.length ? account.public_config.methods : ['pix'];
        for (const method of methods) {
          try { items.push({ provider: account.provider, method: validatePaymentMethod(method), ambiente: account.ambiente }); } catch { /* configuração inválida não é publicada */ }
        }
      }
      res.json({ storefrontId: storefront.id, available: items.length > 0, items: items.filter((item, index, all) => all.findIndex(candidate => candidate.provider === item.provider && candidate.method === item.method && candidate.ambiente === item.ambiente) === index) });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:publicCode/payments', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const method = validatePaymentMethod(req.body?.method);
      const provider = String(req.body?.provider || '').trim().toLowerCase();
      const order = await db.query(`SELECT o.id FROM commerce_orders o WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3 LIMIT 1`, [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()]);
      if (!order.rows[0]) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
      const account = await db.query(`SELECT id, provider, ambiente FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND provider = $3 AND ambiente = 'production' AND ativo = true ORDER BY provider LIMIT 1`, [storefront.empresa_id, storefront.id, provider]);
      if (!account.rows[0]) throw new CommerceError('nenhum gateway ativo para este storefront', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
      const result = await createPaymentAttempt({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { orderId: order.rows[0].id, provider, method, environment: account.rows[0].ambiente, accountId: account.rows[0].id, idempotencyKey: String(req.body?.idempotencyKey || '').trim().slice(0, 180) });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:publicCode/payments/return', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req)
      const transactionNsu = String(req.body?.transactionNsu || req.body?.transaction_nsu || '').trim().slice(0, 180)
      const slug = String(req.body?.slug || req.body?.invoice_slug || '').trim().slice(0, 180)
      if (!transactionNsu || !slug) throw new CommerceError('retorno InfinitePay sem identificadores suficientes', 'PAYMENT_WEBHOOK_INVALID')
      const order = await db.query(`SELECT id FROM commerce_orders WHERE empresa_id = $1 AND storefront_id = $2 AND public_code = $3 LIMIT 1`, [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()])
      if (!order.rows[0]) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND')
      const payment = await db.query(`SELECT p.id FROM commerce_payments p WHERE p.empresa_id = $1 AND p.order_id = $2 AND p.provider = 'infinitepay' ORDER BY p.criado_em DESC LIMIT 1`, [storefront.empresa_id, order.rows[0].id])
      if (!payment.rows[0]) throw new CommerceError('tentativa InfinitePay não encontrada', 'PAYMENT_NOT_FOUND')
      await withCommerceTransaction(trx => trx.query(`UPDATE commerce_payments SET provider_payment_id = COALESCE(provider_payment_id, $3), metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [storefront.empresa_id, payment.rows[0].id, transactionNsu, JSON.stringify({ checkout: { orderNsu: String(req.params.publicCode || '').toUpperCase(), transactionNsu, slug } })]))
      const result = await syncPaymentAttempt({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, payment.rows[0].id)
      res.json(result)
    } catch (error) { jsonError(res, error) }
  })
  router.post('/orders', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await withCommerceTransaction(async trx => {
        const order = await createPendingOrder(trx, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { ...req.body, storefrontId: storefront.id, correlationId: req.requestId || '' });
        const promotionCode = String(req.body?.promotionCode || '').trim();
        if (!promotionCode) return order;
        const promotion = await applyPromotionToOrder(trx, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { orderId: order.id, codigo: promotionCode });
        return { ...order, discount: promotion.desconto, total: promotion.total, promotionCode: promotion.codigo };
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/orders/:publicCode', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(
        `SELECT o.id, o.public_code, o.status, o.moeda, o.subtotal, o.desconto, o.frete, o.impostos, o.total,
                (SELECT p.status FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id ORDER BY p.criado_em DESC LIMIT 1) AS payment_status,
                CASE WHEN o.endereco_entrega IS NULL THEN NULL ELSE jsonb_build_object('cidade', o.endereco_entrega->>'cidade', 'estado', o.endereco_entrega->>'estado', 'cep', CASE WHEN length(o.endereco_entrega->>'cep') = 8 THEN left(o.endereco_entrega->>'cep', 5) || '***' ELSE NULL END) END AS endereco_entrega, o.shipping_method_id, o.shipping_quote_id, o.criado_em, o.atualizado_em,
                COALESCE(jsonb_agg(jsonb_build_object('nome', i.nome_snapshot, 'sku', i.sku_snapshot, 'quantidade', i.quantidade, 'preco', i.preco_unitario, 'subtotal', i.subtotal)) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'trackingCode', f.tracking_code, 'trackingUrl', f.tracking_url, 'carrier', f.carrier, 'labelUrl', f.label_url, 'ocorrencias', f.ocorrencias) ORDER BY f.criado_em DESC)
                            FROM commerce_fulfillments f WHERE f.empresa_id = o.empresa_id AND f.order_id = o.id), '[]'::jsonb) AS fulfillments
           FROM commerce_orders o
           LEFT JOIN commerce_order_items i ON i.empresa_id = o.empresa_id AND i.order_id = o.id
          WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3
          GROUP BY o.id
          LIMIT 1`,
        [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()],
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'pedido não encontrado', code: 'ORDER_NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (error) { jsonError(res, error); }
  });
  return router;
}

export function createCommerceWebhookRouter() {
  const router = express.Router();
  router.post('/:provider/shipping', async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const adapter = shippingProviders.get(provider);
      if (!adapter) throw new CommerceError('provedor logístico não suportado', 'SHIPPING_PROVIDER_UNSUPPORTED');
      const providerShipmentId = String(req.body?.data?.id || req.body?.id || '').trim();
      if (!providerShipmentId) throw new CommerceError('webhook logístico sem id do envio', 'SHIPPING_WEBHOOK_INVALID');
      const owner = await db.query(
        `SELECT f.id AS fulfillment_id, f.empresa_id, f.order_id, f.provider_shipment_id, s.loja_id,
                a.secret_ref, a.public_config, a.provider, a.ambiente
           FROM commerce_fulfillments f
           JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, (SELECT q.shipping_account_id FROM commerce_shipping_quotes q WHERE q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id))
          WHERE f.provider_shipment_id = $1 AND a.provider = $2
          LIMIT 2`,
        [providerShipmentId, provider],
      );
      if (!owner.rows[0]) return res.status(200).json({ ok: true, ignored: true });
      if (owner.rows.length > 1) throw new CommerceError('webhook associado a mais de um fulfillment persistido', 'SHIPPING_WEBHOOK_AMBIGUOUS');
      const ownerRow = owner.rows[0];
      const verified = await adapter.verifyWebhook({ payload: req.body || {}, signature: req.headers['x-me-signature'] || req.headers['x-signature'] || '', context: { rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})), account: { secret_ref: ownerRow.secret_ref, public_config: ownerRow.public_config }, dataId: providerShipmentId, requestId: req.headers['x-request-id'] || '' } });
      if (String(verified.providerShipmentId || '') !== providerShipmentId) throw new CommerceError('webhook não corresponde ao shipment persistido', 'SHIPPING_WEBHOOK_INVALID');
      const eventId = String(verified.eventId || '').trim().slice(0, 180);
      if (!eventId) throw new CommerceError('webhook logístico sem identificador de evento', 'SHIPPING_WEBHOOK_INVALID');
      const payloadHash = crypto.createHash('sha256').update(req.rawBody || JSON.stringify(req.body || {})).digest('hex');
      const result = await withCommerceTransaction(async trx => {
        const inserted = await trx.query(
          `INSERT INTO commerce_shipping_webhooks
            (empresa_id, provider, provider_event_id, provider_shipment_id, event_type, signature_valid, status, payload_hash, payload_resumido)
           VALUES ($1, $2, $3, $4, $5, true, 'received', $6, $7::jsonb)
           ON CONFLICT (empresa_id, provider, provider_event_id) DO NOTHING
           RETURNING id`,
          [ownerRow.empresa_id, provider, eventId, providerShipmentId, String(verified.eventType || 'order.status').slice(0, 100), payloadHash, JSON.stringify(verified.summary || {})],
        );
        if (!inserted.rows[0]) return { duplicate: true };
        const updated = await updateShippingTracking(trx, { empresaId: ownerRow.empresa_id, lojaId: ownerRow.loja_id }, ownerRow.fulfillment_id, verified);
        await auditLog(trx, { empresaId: ownerRow.empresa_id, lojaId: ownerRow.loja_id }, { entidade: 'fulfillment', entidadeId: ownerRow.fulfillment_id, acao: 'provider_webhook', depois: { provider, eventId, eventType: verified.eventType, status: verified.providerStatus, trackingCode: verified.trackingCode } });
        await trx.query(`UPDATE commerce_shipping_webhooks SET status = 'processed', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
        return { fulfillmentId: ownerRow.fulfillment_id, orderId: ownerRow.order_id, status: updated.status, providerStatus: verified.providerStatus };
      });
      res.json({ ok: true, ...result });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/:provider/payments', async (req, res) => {
    const provider = String(req.params.provider || '').trim().toLowerCase();
    try {
      const dataId = String(req.query['data.id'] || req.body?.data?.id || req.body?.transaction_nsu || req.body?.transactionNsu || '').trim().slice(0, 180);
      const orderNsu = String(req.body?.order_nsu || req.body?.orderNsu || '').trim().slice(0, 180);
      if (!dataId && !orderNsu) throw new CommerceError('webhook sem identificador do pagamento', 'PAYMENT_WEBHOOK_INVALID');
      const owner = await db.query(
        `SELECT p.empresa_id, p.payment_account_id, a.secret_ref, a.public_config
           FROM commerce_payments p
           JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
           LEFT JOIN commerce_payment_accounts a
             ON a.empresa_id = p.empresa_id AND a.id = p.payment_account_id
          WHERE p.provider = $1
            AND (p.provider_payment_id = $2 OR ($1 = 'infinitepay' AND (o.public_code = $3 OR o.id::text = $3)))
          LIMIT 2`,
        [provider, dataId || null, orderNsu || null],
      );
      if (!owner.rows[0]) return res.status(200).json({ ok: true, ignored: true });
      if (owner.rows.length > 1) throw new CommerceError('webhook associado a mais de uma tentativa persistida', 'PAYMENT_WEBHOOK_AMBIGUOUS');
      const ownerRow = owner.rows[0];
      if (!ownerRow.payment_account_id || !ownerRow.secret_ref) throw new CommerceError('conta de pagamento do webhook não está vinculada', 'PAYMENT_WEBHOOK_INVALID');
      const verified = await verifyPaymentWebhook(provider, req.body || {}, req.headers['x-signature'] || req.headers['x-webhook-signature'] || '', {
        rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
        requestId: req.headers['x-request-id'] || '',
        dataId,
        orderNsu,
        account: { secret_ref: ownerRow.secret_ref, public_config: ownerRow.public_config },
        empresaId: ownerRow.empresa_id,
      });
      const empresaId = tenantContext({ empresaId: ownerRow.empresa_id }).empresaId;
      const eventId = String(verified.eventId || '').trim().slice(0, 180);
      if (!eventId) throw new CommerceError('webhook sem identificador do provedor', 'PAYMENT_WEBHOOK_INVALID');
      const payloadHash = crypto.createHash('sha256').update(req.rawBody || JSON.stringify(req.body || {})).digest('hex');
      const result = await withCommerceTransaction(async trx => {
        const inserted = await trx.query(
          `INSERT INTO commerce_payment_webhooks
            (empresa_id, provider, provider_event_id, event_type, signature_valid, status, payload_hash, payload_resumido)
           VALUES ($1, $2, $3, $4, true, 'received', $5, $6::jsonb)
           ON CONFLICT (provider, provider_event_id) DO NOTHING
           RETURNING id`,
          [empresaId, provider, eventId, String(verified.eventType || verified.type || 'payment.updated').slice(0, 100), payloadHash, JSON.stringify(verified.summary || {})],
        );
        if (!inserted.rows[0]) return { duplicate: true };
        const payment = await trx.query(
          `SELECT p.id, p.order_id, p.amount, p.status, p.provider_payment_id, o.status AS order_status
             FROM commerce_payments p
             JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
            WHERE p.empresa_id = $1 AND p.provider = $2
              AND (p.provider_payment_id = $3 OR ($2 = 'infinitepay' AND (o.public_code = $4 OR o.id::text = $4)))
            FOR UPDATE OF p`,
          [empresaId, provider, String(verified.providerPaymentId || '').slice(0, 180), orderNsu || null],
        );
        if (!payment.rows[0]) {
          await trx.query(`UPDATE commerce_payment_webhooks SET status = 'ignored', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
          return { ignored: true };
        }
        const current = payment.rows[0];
        if (provider === 'infinitepay' && verified.providerPaymentId && !current.provider_payment_id) {
          await trx.query(`UPDATE commerce_payments SET provider_payment_id = $3, metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [empresaId, current.id, String(verified.providerPaymentId).slice(0, 180), JSON.stringify({ checkout: { orderNsu, transactionNsu: String(verified.providerPaymentId).slice(0, 180), slug: verified.summary?.slug || null } })]);
        }
        if (verified.amount != null && Math.abs(Number(verified.amount) - Number(current.amount)) > 0.01) {
          await trx.query(`UPDATE commerce_payment_webhooks SET status = 'failed', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
          throw new CommerceError('valor do webhook diverge do pedido', 'PAYMENT_AMOUNT_MISMATCH');
        }
        const statusMap = { authorized: 'authorized', paid: 'captured', captured: 'captured', failed: 'failed', cancelled: 'cancelled', refunded: 'refunded', partially_refunded: 'partially_refunded' };
        const nextPaymentStatus = statusMap[String(verified.status || '').toLowerCase()];
        if (!nextPaymentStatus) throw new CommerceError('status de webhook não suportado', 'PAYMENT_WEBHOOK_INVALID');
        if (!canTransitionPaymentStatus(current.status, nextPaymentStatus)) {
          await trx.query(`UPDATE commerce_payment_webhooks SET status = 'ignored', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
          return { stale: true, paymentId: current.id, orderId: current.order_id, status: current.status };
        }
        await trx.query(
          `UPDATE commerce_payments SET status = $3, authorized_at = CASE WHEN $3 = 'authorized' THEN COALESCE(authorized_at, CURRENT_TIMESTAMP) ELSE authorized_at END,
                  captured_at = CASE WHEN $3 = 'captured' THEN COALESCE(captured_at, CURRENT_TIMESTAMP) ELSE captured_at END,
                  refunded_at = CASE WHEN $3 IN ('refunded','partially_refunded') THEN COALESCE(refunded_at, CURRENT_TIMESTAMP) ELSE refunded_at END,
                  metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
            WHERE empresa_id = $1 AND id = $2`,
          [empresaId, current.id, nextPaymentStatus, JSON.stringify({ webhookEventId: eventId })],
        );
        if (nextPaymentStatus === 'captured' && ['draft', 'pending_payment', 'payment_failed'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'paid', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'failed' && ['draft', 'pending_payment'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'payment_failed', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'partially_refunded' && current.order_status === 'completed') await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'partially_refunded', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'refunded' && ['paid', 'completed'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'refunded', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        await trx.query(`UPDATE commerce_payment_webhooks SET status = 'processed', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
        return { paymentId: current.id, orderId: current.order_id, status: nextPaymentStatus };
      });
      res.json({ ok: true, ...result });
    } catch (error) { jsonError(res, error); }
  });
  return router;
}

export function createCommerceAdminRouter() {
  const router = express.Router();
  router.get('/users/roles', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      res.json(await listRoles(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/users/memberships', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      res.json(await listMemberships(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/users/memberships', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      const result = await withCommerceTransaction(trx => createMembership(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/users/memberships/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      const result = await withCommerceTransaction(trx => updateMembership(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/storefront/domains', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      res.json(await listStorefrontDomains(db, context, req.query.storefrontId || null));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => createStorefrontDomain(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains/:id/verify', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => verifyStorefrontDomain(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains/:id/primary', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => setPrimaryStorefrontDomain(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/storefront', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const result = await db.query(
        `SELECT id, codigo, nome, canal, moeda, timezone, loja_id
           FROM commerce_storefronts
          WHERE empresa_id = $1 AND status = 'active'
            AND ($2::uuid IS NULL OR loja_id = $2 OR loja_id IS NULL)
          ORDER BY CASE WHEN loja_id = $2 THEN 0 ELSE 1 END, nome ASC`,
        [context.empresaId, context.lojaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/products', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const values = [context.empresaId];
      const predicates = ['p.empresa_id = $1'];
      if (context.lojaId) {
        values.push(context.lojaId);
        predicates.push(`EXISTS (SELECT 1 FROM commerce_product_channels pc JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND s.loja_id = $${values.length})`);
      }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`p.status = $${values.length}`); }
      const { limit, offset } = parsePagination(req, 100, 500);
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_products p LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id WHERE ${predicates.join(' AND ')}`, values);
      const result = await db.query(
        `SELECT p.id, p.slug, p.nome, p.tipo, p.status, p.descricao, p.descricao_curta, p.category_id,
                c.nome AS category_name, p.criado_em, p.atualizado_em,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', v.id,
                    'sku', v.sku,
                    'nome', v.nome,
                    'atributos', v.atributos,
                    'barcode', v.barcode,
                    'pesoGramas', v.peso_gramas,
                    'larguraCm', v.largura_cm,
                    'alturaCm', v.altura_cm,
                    'comprimentoCm', v.comprimento_cm,
                    'ativo', v.ativo,
                    'preco', vp.preco,
                    'precoPromocional', vp.preco_promocional,
                    'estoque', COALESCE((SELECT SUM(il.disponivel) FROM commerce_inventory_levels il WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id), 0)
                  ) ORDER BY v.criado_em ASC)
                    FROM commerce_product_variants v
                    LEFT JOIN LATERAL (
                      SELECT price.preco, price.preco_promocional
                        FROM commerce_variant_prices price
                       JOIN commerce_product_channels channel
                         ON channel.empresa_id = price.empresa_id
                        AND channel.price_list_id = price.price_list_id
                        AND channel.product_id = p.id
                        AND channel.storefront_id = ANY(ARRAY(SELECT s2.id FROM commerce_storefronts s2 WHERE s2.empresa_id = p.empresa_id ${context.lojaId ? `AND s2.loja_id = $${values.length}` : ''}))
                        AND channel.publicado = true
                       WHERE price.empresa_id = v.empresa_id AND price.variant_id = v.id
                         AND price.vigencia_inicio <= CURRENT_TIMESTAMP
                         AND (price.vigencia_fim IS NULL OR price.vigencia_fim > CURRENT_TIMESTAMP)
                       ORDER BY price.vigencia_inicio DESC LIMIT 1
                    ) vp ON true
                   WHERE v.empresa_id = p.empresa_id AND v.product_id = p.id
                ), '[]'::jsonb) AS variants,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', m.id,
                    'variantId', m.variant_id,
                    'storageKey', m.storage_key,
                    'publicUrl', m.public_url,
                    'mimeType', m.mime_type,
                    'altText', m.alt_text,
                    'ordem', m.ordem
                  ) ORDER BY m.ordem ASC, m.criado_em ASC)
                    FROM commerce_product_media m
                   WHERE m.empresa_id = p.empresa_id AND m.product_id = p.id
                ), '[]'::jsonb) AS media
           FROM commerce_products p
           LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY p.atualizado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/categories', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const result = await db.query(
        `SELECT id, parent_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
           FROM commerce_categories
          WHERE empresa_id = $1
          ORDER BY ordem ASC, nome ASC`,
        [context.empresaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/categories', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => createCategory(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => createCatalogProduct(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/categories/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => updateCategory(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products/:id/variants', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => createCatalogVariant(trx, context, req.params.id, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/variants/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => updateCatalogVariant(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/variants/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => archiveCatalogVariant(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/products/:id/media', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      res.json(await listCatalogMedia(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products/:id/media', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => createCatalogMedia(trx, context, req.params.id, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/media/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => deleteCatalogMedia(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products/:id/publish', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => publishCatalogProduct(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/products/:id/price', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => setVariantPrice(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/products/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, req.body?.status === 'active' ? 'catalog.publish' : 'catalog.write');
      const result = await withCommerceTransaction(trx => updateCatalogProduct(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/products/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => archiveCatalogProduct(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/promotions', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.read');
      res.json(await listPromotions(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => createPromotion(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions/codes', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => createPromotionCode(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:id/promotion', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => applyPromotionToOrder(trx, context, { ...req.body, orderId: req.params.id }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(trx => createShippingMethod(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/shipping/methods/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const method = await updateShippingMethod(trx, context, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'shipping_method', entidadeId: method.id, acao: 'updated', depois: { nome: method.nome, tipo: method.tipo, ativo: method.ativo, configuracao: method.configuracao } });
        return method;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.read');
      const values = [context.empresaId];
      const predicates = ['sm.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      const result = await db.query(
        `SELECT sm.id, sm.storefront_id, sm.codigo, sm.nome, sm.tipo, sm.ativo, sm.configuracao
           FROM commerce_shipping_methods sm
           JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY sm.nome ASC`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/providers', async (req, res) => {
    try { await requirePermission(req, 'fulfillment.read'); res.json(listShippingProviders()); } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/accounts', async (req, res) => {
    try { const context = await requirePermission(req, 'fulfillment.read'); res.json(await listShippingAccounts(db, context)); } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await createShippingAccount(trx, context, req.body);
        await auditLog(trx, context, { entidade: 'shipping_account', entidadeId: account.id, acao: 'created', depois: account });
        return account;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/shipping/accounts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await updateShippingAccount(trx, context, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'shipping_account', entidadeId: account.id, acao: 'updated', depois: account });
        return account;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/label', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const prepared = await withCommerceTransaction(trx => prepareShippingLabel(trx, context, req.params.id));
      if (prepared.replay) return res.json(prepared.fulfillment);
      const adapter = shippingProviders.get(prepared.account.provider);
      if (!adapter) throw new CommerceError('adapter logístico indisponível', 'SHIPPING_PROVIDER_NOT_CONFIGURED');
      let external;
      try {
        external = await adapter.createShipment({ account: prepared.account, selectedOption: prepared.selectedOption, from: prepared.from, to: prepared.to, products: prepared.products, volumes: prepared.volumes, shipmentOptions: req.body || {}, idempotencyKey: prepared.operationKey });
      } catch (error) {
        await withCommerceTransaction(trx => failShippingLabel(trx, context, req.params.id, prepared.operationKey, error));
        throw error;
      }
      const finalized = await withCommerceTransaction(trx => finalizeShippingLabel(trx, context, req.params.id, prepared.operationKey, { ...external, carrier: prepared.selectedOption.carrier }));
      res.status(201).json(finalized);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/track', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const owner = await db.query(`SELECT f.id, f.provider_shipment_id, a.provider, a.ambiente, a.secret_ref, a.public_config FROM commerce_fulfillments f LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, (SELECT q.shipping_account_id FROM commerce_shipping_quotes q WHERE q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id)) WHERE f.empresa_id = $1 AND f.id = $2 AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM commerce_orders o JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id WHERE o.empresa_id = f.empresa_id AND o.id = f.order_id AND s.loja_id = $3)) LIMIT 1`, [context.empresaId, req.params.id, context.lojaId]);
      if (!owner.rows[0]) throw new CommerceError('fulfillment não encontrado', 'FULFILLMENT_NOT_FOUND');
      if (!owner.rows[0].provider_shipment_id || !owner.rows[0].provider) throw new CommerceError('fulfillment ainda não possui shipment no provedor', 'SHIPPING_SHIPMENT_NOT_FOUND');
      const adapter = shippingProviders.get(owner.rows[0].provider);
      if (!adapter) throw new CommerceError('adapter logístico indisponível', 'SHIPPING_PROVIDER_NOT_CONFIGURED');
      const external = await adapter.track({ account: { provider: owner.rows[0].provider, ambiente: owner.rows[0].ambiente, secret_ref: owner.rows[0].secret_ref, public_config: owner.rows[0].public_config }, providerShipmentId: owner.rows[0].provider_shipment_id });
      const updated = await withCommerceTransaction(async trx => {
        const row = await updateShippingTracking(trx, context, owner.rows[0].id, external);
        await auditLog(trx, context, { entidade: 'fulfillment', entidadeId: owner.rows[0].id, acao: 'provider_tracking_sync', depois: { provider: owner.rows[0].provider, providerStatus: external.providerStatus, trackingCode: external.trackingCode } });
        return row;
      });
      res.json(updated);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(trx => createFulfillment(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/fulfillments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.read');
      const values = [context.empresaId];
      const predicates = ['f.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`f.status = $${values.length}`); }
      const result = await db.query(
        `SELECT f.id, f.order_id, f.status, f.tracking_code, f.carrier, f.ocorrencias, f.criado_em, f.atualizado_em,
                o.public_code, o.total, s.nome AS storefront_name, f.shipping_quote_id, f.shipping_account_id, f.provider_shipment_id, f.tracking_url, f.label_url, f.shipping_operation_status
           FROM commerce_fulfillments f
           JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY f.atualizado_em DESC
          LIMIT 500`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/fulfillments/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(trx => updateFulfillment(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/inventory/locations', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.write');
      const result = await withCommerceTransaction(trx => createInventoryLocation(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/inventory/locations', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.read');
      const result = await db.query(
        `SELECT id, loja_id, codigo, nome, tipo, ativo, criado_em
           FROM commerce_inventory_locations
          WHERE empresa_id = $1 AND ($2::uuid IS NULL OR loja_id = $2 OR loja_id IS NULL)
          ORDER BY nome ASC`,
        [context.empresaId, context.lojaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/inventory/levels', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.read');
      const values = [context.empresaId];
      const predicates = ['l.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`(l.loja_id = $${values.length} OR l.loja_id IS NULL)`); }
      const result = await db.query(
        `SELECT il.id, il.location_id, il.variant_id, il.disponivel, il.reservado, il.comprometido, il.minimo,
                l.codigo AS location_code, l.nome AS location_name, v.sku, COALESCE(v.nome, p.nome) AS product_name
           FROM commerce_inventory_levels il
           JOIN commerce_inventory_locations l ON l.empresa_id = il.empresa_id AND l.id = il.location_id
           JOIN commerce_product_variants v ON v.empresa_id = il.empresa_id AND v.id = il.variant_id
           JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY p.nome ASC, v.sku ASC
          LIMIT 500`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/inventory/adjust', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.write');
      const result = await withCommerceTransaction(trx => adjustInventory(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      const { limit, offset } = parsePagination(req, 100, 500);
      const values = [context.empresaId];
      const predicates = ['empresa_id = $1'];
      const query = String(req.query.q || '').trim().slice(0, 160);
      if (query) { values.push(`%${query}%`); predicates.push(`(nome ILIKE $${values.length} OR email ILIKE $${values.length})`); }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_customers WHERE ${where}`, values);
      const result = await db.query(
        `SELECT id, nome, email, telefone, documento_mascarado, bloqueado, criado_em, atualizado_em
           FROM commerce_customers
          WHERE ${where}
          ORDER BY atualizado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => createCustomer(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/customers/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => updateCustomer(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await getCustomer(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers/:id/addresses', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await listCustomerAddresses(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/customers/:id/addresses', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => createCustomerAddress(trx, context, req.params.id, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/customers/:id/addresses/:addressId', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => updateCustomerAddress(trx, context, req.params.id, req.params.addressId, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/customers/:id/addresses/:addressId', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => deleteCustomerAddress(trx, context, req.params.id, req.params.addressId));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments/providers', async (req, res) => {
    try {
      await requirePermission(req, 'payments.read');
      res.json(listPaymentProviders());
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.read');
      res.json(await listPaymentAccounts(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/payments/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await createPaymentAccount(trx, context, req.body);
        await auditLog(trx, context, { entidade: 'payment_account', entidadeId: account.id, acao: 'created', depois: account });
        return account;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/payments/accounts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await updatePaymentAccount(trx, context, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'payment_account', entidadeId: account.id, acao: 'updated', depois: account });
        return account;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.read');
      res.json(await listPayments(db, context, req.query));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:id/payments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const result = await createPaymentAttempt(context, { ...req.body, orderId: req.params.id });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/payments/:id/sync', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const result = await syncPaymentAttempt(context, req.params.id);
      await withCommerceTransaction(trx => auditLog(trx, context, { entidade: 'payment', entidadeId: result.paymentId, acao: 'status_reconciled', correlationId: req.requestId || '', depois: { orderId: result.orderId, provider: result.provider, status: result.status, changed: result.changed, stale: Boolean(result.stale) } }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/operations/health', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const scope = [context.empresaId, context.lojaId || null];
      const [payments, fulfillments, paymentWebhooks, shippingWebhooks] = await Promise.all([
        db.query(`SELECT p.status, COUNT(*)::int AS total
                    FROM commerce_payments p
                    JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
                    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
                   WHERE p.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2)
                   GROUP BY p.status`, scope),
        db.query(`SELECT f.status, COUNT(*)::int AS total
                    FROM commerce_fulfillments f
                    JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
                    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
                   WHERE f.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2)
                   GROUP BY f.status`, scope),
        db.query(`SELECT status, COUNT(*)::int AS total FROM commerce_payment_webhooks WHERE empresa_id = $1 GROUP BY status`, [context.empresaId]),
        db.query(`SELECT status, COUNT(*)::int AS total FROM commerce_shipping_webhooks WHERE empresa_id = $1 GROUP BY status`, [context.empresaId]),
      ]);
      res.json({
        generatedAt: new Date().toISOString(),
        payments: statusCounts(payments.rows),
        fulfillments: statusCounts(fulfillments.rows),
        webhooks: { payments: statusCounts(paymentWebhooks.rows), shipping: statusCounts(shippingWebhooks.rows) },
      });
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/orders/:id', async (req, res) => {
    try {
      const permission = ['refunded', 'partially_refunded'].includes(req.body?.status) ? 'orders.refund' : 'orders.write';
      const context = await requirePermission(req, permission);
      const result = await withCommerceTransaction(trx => transitionOrder(trx, context, { ...req.body, orderId: req.params.id }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/sales', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await salesReport(context, { from: req.query.from, to: req.query.to }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/inventory', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await inventoryReport(context));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await customerReport(context, { from: req.query.from, to: req.query.to }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/audit', async (req, res) => {
    try {
      const context = await requirePermission(req, 'audit.read');
      const requestedLimit = Number(req.query.limit);
      const requestedOffset = Number(req.query.offset);
      const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
      const offset = Number.isInteger(requestedOffset) ? Math.min(100000, Math.max(0, requestedOffset)) : 0;
      const values = [context.empresaId];
      const predicates = ['empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`loja_id = $${values.length}`); }
      for (const [key, column] of [['entity', 'entidade'], ['action', 'acao']]) {
        const value = String(req.query[key] || '').trim().slice(0, 80);
        if (value && /^[a-z0-9_-]+$/i.test(value)) { values.push(value); predicates.push(`${column} = $${values.length}`); }
      }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_audit_logs WHERE ${where}`, values);
      const result = await db.query(
        `SELECT id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id, ip_address, criado_em
           FROM commerce_audit_logs
          WHERE ${where}
          ORDER BY criado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      res.json({ items: result.rows, pagination: { limit, offset, total: count.rows[0]?.total || 0, hasMore: offset + result.rows.length < Number(count.rows[0]?.total || 0) } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/orders', async (req, res) => {
    try {
      const context = await requirePermission(req, 'orders.read');
      const { limit, offset } = parsePagination(req, 100, 500);
      const values = [context.empresaId];
      const predicates = ['o.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`o.status = $${values.length}`); }
      const query = String(req.query.q || '').trim().slice(0, 160);
      if (query) { values.push(`%${query}%`); predicates.push(`(o.public_code ILIKE $${values.length} OR c.nome ILIKE $${values.length} OR c.email ILIKE $${values.length})`); }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_orders o JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id WHERE ${where}`, values);
      const result = await db.query(
        `SELECT o.id, o.public_code, o.status, o.origem, o.subtotal, o.desconto, o.frete, o.impostos, o.total, o.shipping_method_id, o.shipping_quote_id, o.criado_em, o.atualizado_em,
                c.nome AS customer_name, c.email AS customer_email,
                (SELECT p.status FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id ORDER BY p.criado_em DESC LIMIT 1) AS payment_status,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', i.nome_snapshot, 'sku', i.sku_snapshot, 'quantidade', i.quantidade, 'preco', i.preco_unitario, 'subtotal', i.subtotal) ORDER BY i.id ASC) FROM commerce_order_items i WHERE i.empresa_id = o.empresa_id AND i.order_id = o.id), '[]'::jsonb) AS items
           FROM commerce_orders o
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
          WHERE ${where}
          ORDER BY o.criado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  return router;
}
