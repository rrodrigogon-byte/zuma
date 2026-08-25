import crypto from 'crypto';
import express from 'express';
import { db } from './database.js';
import { customerReport, inventoryReport, salesReport } from './commerce-reports.js';
import { createPaymentAttempt, verifyPaymentWebhook } from './payment-adapters.js';
import {
  CommerceError,
  adjustInventory,
  archiveCatalogProduct,
  createCatalogProduct,
  createCategory,
  createFulfillment,
  createInventoryLocation,
  createPendingOrder,
  listPublishedProducts,
  publishCatalogProduct,
  setVariantPrice,
  createShippingMethod,
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
    INVALID_ORDER_STATUS: 400,
    INVALID_ORDER_TRANSITION: 409,
    TENANT_CONTEXT_REQUIRED: 401,
    PERMISSION_DENIED: 403,
    CATEGORY_REQUIRED: 400,
    CATEGORY_NOT_FOUND: 404,
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
    LOCATION_REQUIRED: 400,
    STORE_NOT_FOUND: 404,
    INVALID_REPORT_PERIOD: 400,
    PAYMENT_PROVIDER_NOT_CONFIGURED: 503,
    PAYMENT_METHOD_INVALID: 400,
    PAYMENT_IDEMPOTENCY_REQUIRED: 400,
    PAYMENT_ACCOUNT_NOT_CONFIGURED: 409,
    PAYMENT_ORDER_STATE_INVALID: 409,
    PAYMENT_ADAPTER_INVALID_RESPONSE: 502,
    PAYMENT_PROVIDER_ERROR: 502,
    PAYMENT_WEBHOOK_INVALID: 400,
    PAYMENT_AMOUNT_MISMATCH: 422,
    SHIPPING_METHOD_INVALID: 400,
    SHIPPING_METHOD_NOT_FOUND: 404,
    FULFILLMENT_NOT_FOUND: 404,
    INVALID_FULFILLMENT_TRANSITION: 409,
  };
  const status = statusByCode[error?.code] || 500;
  return res.status(status).json({ error: status >= 500 ? 'erro interno do Commerce Core' : error.message, code: error?.code || 'COMMERCE_ERROR', details: error?.details || {} });
}

function adminContext(req) {
  if (!req.user?.empresaId) throw new CommerceError('sessão sem empresa efetiva; ativação do Commerce Core requer membership PostgreSQL', 'TENANT_CONTEXT_REQUIRED');
  return tenantContext({ empresaId: req.user.empresaId, lojaId: req.user.lojaId, usuarioId: req.user.id });
}

async function requirePermission(req, permission) {
  const context = adminContext(req);
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
      res.json({ storefront: { id: storefront.id, codigo: storefront.codigo, nome: storefront.nome, moeda: storefront.moeda, timezone: storefront.timezone }, capabilities: { catalog: true, cart: true, checkout: true, payments: false, shipping: false } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/products', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const products = await listPublishedProducts({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { storefrontId: storefront.id, query: req.query.q, categoryId: req.query.categoryId, limit: req.query.limit, offset: req.query.offset });
      res.json({ storefrontId: storefront.id, items: products });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await withCommerceTransaction(trx => createPendingOrder(trx, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { ...req.body, storefrontId: storefront.id }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/orders/:publicCode', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(
        `SELECT o.id, o.public_code, o.status, o.moeda, o.subtotal, o.desconto, o.frete, o.impostos, o.total, o.criado_em, o.atualizado_em,
                COALESCE(jsonb_agg(jsonb_build_object('nome', i.nome_snapshot, 'sku', i.sku_snapshot, 'quantidade', i.quantidade, 'preco', i.preco_unitario, 'subtotal', i.subtotal)) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
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
  router.post('/:provider/payments', async (req, res) => {
    const provider = String(req.params.provider || '').trim().toLowerCase();
    try {
      const verified = await verifyPaymentWebhook(provider, req.body || {}, req.headers['x-signature'] || req.headers['x-webhook-signature'] || '', { rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})) });
      const empresaId = tenantContext({ empresaId: verified.empresaId }).empresaId;
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
          `SELECT id, order_id, amount, status FROM commerce_payments
            WHERE empresa_id = $1 AND provider = $2 AND provider_payment_id = $3
            FOR UPDATE`,
          [empresaId, provider, String(verified.providerPaymentId || '').slice(0, 180)],
        );
        if (!payment.rows[0]) {
          await trx.query(`UPDATE commerce_payment_webhooks SET status = 'ignored', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
          return { ignored: true };
        }
        const current = payment.rows[0];
        if (verified.amount != null && Math.abs(Number(verified.amount) - Number(current.amount)) > 0.01) {
          await trx.query(`UPDATE commerce_payment_webhooks SET status = 'failed', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
          throw new CommerceError('valor do webhook diverge do pedido', 'PAYMENT_AMOUNT_MISMATCH');
        }
        const statusMap = { authorized: 'authorized', paid: 'captured', captured: 'captured', failed: 'failed', cancelled: 'cancelled', refunded: 'refunded', partially_refunded: 'partially_refunded' };
        const nextPaymentStatus = statusMap[String(verified.status || '').toLowerCase()];
        if (!nextPaymentStatus) throw new CommerceError('status de webhook não suportado', 'PAYMENT_WEBHOOK_INVALID');
        await trx.query(
          `UPDATE commerce_payments SET status = $3, authorized_at = CASE WHEN $3 = 'authorized' THEN COALESCE(authorized_at, CURRENT_TIMESTAMP) ELSE authorized_at END,
                  captured_at = CASE WHEN $3 = 'captured' THEN COALESCE(captured_at, CURRENT_TIMESTAMP) ELSE captured_at END,
                  refunded_at = CASE WHEN $3 IN ('refunded','partially_refunded') THEN COALESCE(refunded_at, CURRENT_TIMESTAMP) ELSE refunded_at END,
                  metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
            WHERE empresa_id = $1 AND id = $2`,
          [empresaId, current.id, nextPaymentStatus, JSON.stringify({ webhookEventId: eventId })],
        );
        if (nextPaymentStatus === 'captured') await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'paid', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'failed') await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'payment_failed', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
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
      const result = await db.query(
        `SELECT p.id, p.slug, p.nome, p.tipo, p.status, p.descricao, p.descricao_curta, p.category_id, p.criado_em, p.atualizado_em,
                COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', v.id, 'sku', v.sku, 'nome', v.nome, 'atributos', v.atributos)) FILTER (WHERE v.id IS NOT NULL), '[]'::jsonb) AS variants
           FROM commerce_products p
           LEFT JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id
          WHERE ${predicates.join(' AND ')}
          GROUP BY p.id
          ORDER BY p.atualizado_em DESC
          LIMIT 100`,
        values,
      );
      res.json({ items: result.rows });
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
  router.post('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(trx => createShippingMethod(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.read');
      const values = [context.empresaId];
      const predicates = ['sm.empresa_id = $1', 'sm.ativo = true'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      const result = await db.query(
        `SELECT sm.id, sm.storefront_id, sm.codigo, sm.nome, sm.tipo, sm.configuracao
           FROM commerce_shipping_methods sm
           JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY sm.nome ASC`,
        values,
      );
      res.json({ items: result.rows });
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
                o.public_code, o.total, s.nome AS storefront_name
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
      const result = await db.query(
        `SELECT id, nome, email, telefone, documento_mascarado, bloqueado, criado_em, atualizado_em
           FROM commerce_customers
          WHERE empresa_id = $1
          ORDER BY atualizado_em DESC
          LIMIT 500`,
        [context.empresaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:id/payments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const result = await createPaymentAttempt(context, { ...req.body, orderId: req.params.id });
      res.status(201).json(result);
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
      const result = await db.query(
        `SELECT id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id, ip_address, criado_em
           FROM commerce_audit_logs
          WHERE empresa_id = $1
          ORDER BY criado_em DESC
          LIMIT 500`,
        [context.empresaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/orders', async (req, res) => {
    try {
      const context = await requirePermission(req, 'orders.read');
      const values = [context.empresaId];
      const predicates = ['o.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`o.status = $${values.length}`); }
      const result = await db.query(
        `SELECT o.id, o.public_code, o.status, o.origem, o.total, o.criado_em, o.atualizado_em,
                c.nome AS customer_name, c.email AS customer_email
           FROM commerce_orders o
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY o.criado_em DESC
          LIMIT 100`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  return router;
}
