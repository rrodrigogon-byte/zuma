import crypto from 'crypto';
import { db } from './database.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ORDER_TRANSITIONS = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['paid', 'payment_failed', 'fraud_review', 'cancelled'],
  payment_failed: ['pending_payment', 'cancelled'],
  fraud_review: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['ready', 'shipped', 'ready_for_pickup', 'cancelled'],
  ready: ['shipped', 'ready_for_pickup', 'cancelled'],
  shipped: ['delivered', 'returned'],
  ready_for_pickup: ['picked_up', 'cancelled'],
  delivered: ['completed', 'returned'],
  picked_up: ['completed', 'returned'],
  completed: ['returned', 'partially_refunded', 'refunded'],
  cancelled: [],
  refunded: [],
  partially_refunded: [],
  returned: [],
};

export class CommerceError extends Error {
  constructor(message, code = 'COMMERCE_ERROR', details = {}) {
    super(message);
    this.name = 'CommerceError';
    this.code = code;
    this.details = details;
  }
}

export function assertUuid(value, field = 'id') {
  if (!UUID.test(String(value || ''))) throw new CommerceError(`${field} inválido`, 'INVALID_ID', { field });
  return String(value);
}

export function tenantContext(input = {}) {
  const empresaId = assertUuid(input.empresaId, 'empresaId');
  const lojaId = input.lojaId ? assertUuid(input.lojaId, 'lojaId') : null;
  const usuarioId = input.usuarioId ? assertUuid(input.usuarioId, 'usuarioId') : null;
  return { empresaId, lojaId, usuarioId };
}

export function requestId(input) {
  const value = String(input || '').trim();
  return value ? value.slice(0, 160) : crypto.randomUUID();
}

export async function withCommerceTransaction(callback) {
  return db.transaction(async trx => callback(trx));
}

export async function resolveStorefront(trx, context, storefrontId) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(storefrontId, 'storefrontId');
  const result = await trx.query(
    `SELECT id, empresa_id, loja_id, codigo, nome, canal, status, moeda, timezone, configuracoes
       FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2 AND status = 'active'
      LIMIT 1`,
    [empresaId, id],
  );
  if (!result.rows[0]) throw new CommerceError('storefront não encontrado ou inativo', 'STOREFRONT_NOT_FOUND');
  if (context.lojaId && result.rows[0].loja_id && result.rows[0].loja_id !== context.lojaId) {
    throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
  }
  return result.rows[0];
}

export async function listPublishedProducts(context, options = {}) {
  const { empresaId } = tenantContext(context);
  const storefrontId = assertUuid(options.storefrontId, 'storefrontId');
  const values = [empresaId, storefrontId];
  const predicates = [
    'p.empresa_id = $1',
    "p.status = 'active'",
    `EXISTS (
      SELECT 1 FROM commerce_storefronts s
       WHERE s.empresa_id = p.empresa_id AND s.id = $2 AND s.status = 'active'
    )`,
    `EXISTS (
      SELECT 1 FROM commerce_product_channels pc
       WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id
         AND pc.storefront_id = $2 AND pc.publicado = true
    )`,
  ];
  if (options.categoryId) { values.push(assertUuid(options.categoryId, 'categoryId')); predicates.push(`p.category_id = $${values.length}`); }
  if (options.query) { values.push(`%${String(options.query).trim()}%`); predicates.push(`(p.nome ILIKE $${values.length} OR p.descricao ILIKE $${values.length})`); }
  const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 100);
  const offset = Math.max(Number(options.offset) || 0, 0);
  values.push(limit, offset);
  const result = await db.query(
    `SELECT p.id, p.slug, p.nome, p.tipo, p.descricao, p.descricao_curta,
            c.id AS category_id, c.nome AS category_name,
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
              'id', v.id, 'sku', v.sku, 'nome', v.nome, 'atributos', v.atributos,
              'estoque', COALESCE(stock.disponivel, 0),
              'prices', COALESCE(prices.items, '[]'::jsonb)
            )) FILTER (WHERE v.id IS NOT NULL), '[]'::jsonb) AS variants,
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
              'url', m.public_url, 'altText', m.alt_text, 'ordem', m.ordem
            )) FILTER (WHERE m.id IS NOT NULL), '[]'::jsonb) AS media
       FROM commerce_products p
       JOIN commerce_product_channels pc
         ON pc.empresa_id = p.empresa_id AND pc.product_id = p.id
        AND pc.storefront_id = $2 AND pc.publicado = true
       LEFT JOIN commerce_categories c
         ON c.empresa_id = p.empresa_id AND c.id = p.category_id
       LEFT JOIN commerce_product_variants v
         ON v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true
       LEFT JOIN commerce_product_media m
         ON m.empresa_id = p.empresa_id AND m.product_id = p.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(il.disponivel), 0) AS disponivel
           FROM commerce_inventory_levels il
           JOIN commerce_inventory_locations l
             ON l.empresa_id = il.empresa_id AND l.id = il.location_id AND l.ativo = true
          WHERE il.empresa_id = p.empresa_id AND il.variant_id = v.id
       ) stock ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'priceListId', vp.price_list_id,
           'preco', vp.preco,
           'precoPromocional', vp.preco_promocional,
           'vigenciaInicio', vp.vigencia_inicio,
           'vigenciaFim', vp.vigencia_fim
         ) ORDER BY vp.vigencia_inicio DESC) AS items
           FROM commerce_variant_prices vp
           JOIN commerce_price_lists pl
             ON pl.empresa_id = vp.empresa_id AND pl.id = vp.price_list_id
          WHERE vp.empresa_id = p.empresa_id
            AND vp.variant_id = v.id
            AND (pc.price_list_id IS NULL OR vp.price_list_id = pc.price_list_id)
            AND pl.ativo = true
            AND pl.canal = 'web'
            AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
       ) prices ON true
      WHERE ${predicates.join(' AND ')}
      GROUP BY p.id, c.id, c.nome, pc.price_list_id
      ORDER BY p.atualizado_em DESC, p.nome ASC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return result.rows;
}

export async function reserveInventory(trx, context, input) {
  const { empresaId, usuarioId } = tenantContext(context);
  const locationId = assertUuid(input.locationId, 'locationId');
  const variantId = assertUuid(input.variantId, 'variantId');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new CommerceError('quantidade deve ser um inteiro positivo', 'INVALID_QUANTITY');
  const reservationId = input.reservationId ? assertUuid(input.reservationId, 'reservationId') : crypto.randomUUID();
  const orderId = input.orderId ? assertUuid(input.orderId, 'orderId') : null;
  const idem = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 160) : null;

  if (idem) {
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ locationId, variantId, quantity, orderId })).digest('hex');
    const existing = await trx.query(
      `SELECT request_hash, response_body
         FROM commerce_idempotency_keys
        WHERE empresa_id = $1 AND scope = 'inventory.reserve' AND key = $2
        FOR UPDATE`,
      [empresaId, idem],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
      if (existing.rows[0].response_body) return existing.rows[0].response_body;
    } else {
      await trx.query(
        `INSERT INTO commerce_idempotency_keys
          (empresa_id, scope, key, request_hash, expires_at)
         VALUES ($1, 'inventory.reserve', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [empresaId, idem, requestHash],
      );
    }
  }

  const locked = await trx.query(
    `SELECT id, disponivel, reservado, comprometido
       FROM commerce_inventory_levels
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3
      FOR UPDATE`,
    [empresaId, locationId, variantId],
  );
  const level = locked.rows[0];
  if (!level) throw new CommerceError('saldo de estoque não configurado', 'INVENTORY_LEVEL_NOT_FOUND');
  if (Number(level.disponivel) < quantity) throw new CommerceError('estoque insuficiente', 'INSUFFICIENT_STOCK', { available: Number(level.disponivel) });

  const nextAvailable = Number(level.disponivel) - quantity;
  await trx.query(
    `UPDATE commerce_inventory_levels
        SET disponivel = $4, reservado = reservado + $5, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3`,
    [empresaId, locationId, variantId, nextAvailable, quantity],
  );
  await trx.query(
    `INSERT INTO commerce_inventory_reservations
      (id, empresa_id, order_id, location_id, variant_id, quantidade, status, expira_em)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
    [reservationId, empresaId, orderId, locationId, variantId, quantity, input.expiresAt || null],
  );
  await trx.query(
    `INSERT INTO commerce_inventory_movements
      (empresa_id, location_id, variant_id, tipo, quantidade, saldo_anterior, saldo_posterior,
       referencia_tipo, referencia_id, idempotency_key, usuario_id, observacao)
     VALUES ($1, $2, $3, 'reserva', $4, $5, $6, 'order', $7, $8, $9, $10)`,
    [empresaId, locationId, variantId, quantity, Number(level.disponivel), nextAvailable, orderId, idem, usuarioId, 'Reserva de checkout'],
  );
  const result = { id: reservationId, location_id: locationId, variant_id: variantId, quantidade: quantity, status: 'pending', order_id: orderId };
  if (idem) {
    await trx.query(
      `UPDATE commerce_idempotency_keys SET response_status = 201, response_body = $3::jsonb
        WHERE empresa_id = $1 AND scope = 'inventory.reserve' AND key = $2`,
      [empresaId, idem, JSON.stringify(result)],
    );
  }
  return result;
}

async function settleOrderReservations(trx, context, orderId, nextStatus) {
  const { empresaId, usuarioId } = tenantContext(context);
  const release = ['payment_failed', 'cancelled'].includes(nextStatus);
  const commit = nextStatus === 'paid';
  if (!release && !commit) return;
  const reservations = await trx.query(
    `SELECT id, location_id, variant_id, quantidade, status
       FROM commerce_inventory_reservations
      WHERE empresa_id = $1 AND order_id = $2 AND status IN ('pending','confirmed')
      FOR UPDATE`,
    [empresaId, orderId],
  );
  for (const reservation of reservations.rows) {
    const levelResult = await trx.query(
      `SELECT disponivel, reservado, comprometido
         FROM commerce_inventory_levels
        WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3
        FOR UPDATE`,
      [empresaId, reservation.location_id, reservation.variant_id],
    );
    const level = levelResult.rows[0];
    if (!level) throw new CommerceError('saldo da reserva não encontrado', 'INVENTORY_STATE_CONFLICT');
    const quantity = Number(reservation.quantidade);
    let nextAvailable = Number(level.disponivel);
    let nextReserved = Number(level.reservado);
    let nextCommitted = Number(level.comprometido);
    let status = reservation.status;
    let movementType = null;
    if (commit && reservation.status === 'pending') {
      if (nextReserved < quantity) throw new CommerceError('reserva inconsistente no estoque', 'INVENTORY_STATE_CONFLICT');
      nextReserved -= quantity;
      nextCommitted += quantity;
      status = 'confirmed';
      movementType = 'compromisso';
    } else if (release && reservation.status === 'pending') {
      if (nextReserved < quantity) throw new CommerceError('reserva inconsistente no estoque', 'INVENTORY_STATE_CONFLICT');
      nextReserved -= quantity;
      nextAvailable += quantity;
      status = 'released';
      movementType = 'liberacao';
    } else if (release && reservation.status === 'confirmed') {
      if (nextCommitted < quantity) throw new CommerceError('compromisso inconsistente no estoque', 'INVENTORY_STATE_CONFLICT');
      nextCommitted -= quantity;
      nextAvailable += quantity;
      status = 'released';
      movementType = 'liberacao';
    }
    if (!movementType) continue;
    await trx.query(
      `UPDATE commerce_inventory_levels
          SET disponivel = $4, reservado = $5, comprometido = $6, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3`,
      [empresaId, reservation.location_id, reservation.variant_id, nextAvailable, nextReserved, nextCommitted],
    );
    await trx.query(
      `UPDATE commerce_inventory_reservations SET status = $4, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 AND order_id = $3`,
      [empresaId, reservation.id, orderId, status],
    );
    await trx.query(
      `INSERT INTO commerce_inventory_movements
        (empresa_id, location_id, variant_id, tipo, quantidade, saldo_anterior, saldo_posterior,
         referencia_tipo, referencia_id, idempotency_key, usuario_id, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'order', $8, $9, $10, $11)`,
      [empresaId, reservation.location_id, reservation.variant_id, movementType, quantity, Number(level.disponivel), nextAvailable, orderId, `${orderId}:${nextStatus}:${reservation.variant_id}`, usuarioId, `Pedido ${nextStatus}`],
    );
  }
}

export async function transitionOrder(trx, context, input) {
  const { empresaId, usuarioId } = tenantContext(context);
  const orderId = assertUuid(input.orderId, 'orderId');
  const nextStatus = String(input.status || '');
  const allowed = Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, nextStatus);
  if (!allowed) throw new CommerceError('status de pedido inválido', 'INVALID_ORDER_STATUS');
  const locked = await trx.query(
    `SELECT id, status, storefront_id, total
       FROM commerce_orders
      WHERE empresa_id = $1 AND id = $2
      FOR UPDATE`,
    [empresaId, orderId],
  );
  const order = locked.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
  if (order.status === nextStatus) return order;
  if (!ORDER_TRANSITIONS[order.status]?.includes(nextStatus)) {
    throw new CommerceError(`transição ${order.status} → ${nextStatus} não permitida`, 'INVALID_ORDER_TRANSITION');
  }
  await settleOrderReservations(trx, { empresaId, usuarioId }, orderId, nextStatus);
  await trx.query(
    `UPDATE commerce_orders SET status = $3, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2`,
    [empresaId, orderId, nextStatus],
  );
  await trx.query(
    `INSERT INTO commerce_order_events
      (empresa_id, order_id, de_status, para_status, origem, usuario_id, correlation_id, payload_resumido)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [empresaId, orderId, order.status, nextStatus, input.origin || 'admin', usuarioId, requestId(input.correlationId), JSON.stringify(input.payload || {})],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs
      (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id)
     SELECT $1, s.loja_id, $6, 'order', $2, 'status_changed', $7::jsonb,
            jsonb_build_object('status', $4), $5
       FROM commerce_storefronts s
      WHERE s.empresa_id = $1 AND s.id = $3`,
    [empresaId, orderId, order.storefront_id, nextStatus, requestId(input.correlationId), usuarioId, JSON.stringify({ status: order.status })],
  );
  return { ...order, status: nextStatus };
}

export async function createPendingOrder(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const storefront = await resolveStorefront(trx, { ...context, empresaId }, input.storefrontId);
  const shippingMethodId = input.shippingMethodId ? assertUuid(input.shippingMethodId, 'shippingMethodId') : null;
  if (shippingMethodId) {
    const method = await trx.query(
      `SELECT id FROM commerce_shipping_methods
        WHERE empresa_id = $1 AND storefront_id = $2 AND id = $3 AND ativo = true
        LIMIT 1`,
      [empresaId, storefront.id, shippingMethodId],
    );
    if (!method.rows[0]) throw new CommerceError('método de entrega não encontrado para o storefront', 'SHIPPING_METHOD_NOT_FOUND');
  }
  const lines = Array.isArray(input.items) ? input.items.map(item => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new CommerceError('quantidade deve ser um inteiro positivo', 'INVALID_QUANTITY');
    return { variantId: assertUuid(item.variantId, 'variantId'), quantity };
  }) : [];
  if (!lines.length) throw new CommerceError('o carrinho está vazio', 'EMPTY_CART');
  const uniqueVariantIds = [...new Set(lines.map(line => line.variantId))];
  const idem = input.idempotencyKey ? String(input.idempotencyKey).trim().slice(0, 180) : null;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    storefrontId: storefront.id,
    lines,
    customerId: input.customerId || null,
    customer: input.customer || null,
    shippingAddress: input.shippingAddress || null,
    billingAddress: input.billingAddress || null,
    shippingMethodId,
    locationId: input.locationId || null,
    shippingAmount: input.shippingAmount || 0,
    discountAmount: input.discountAmount || 0,
    taxAmount: input.taxAmount || 0,
    note: input.note || '',
  })).digest('hex');

  if (idem) {
    const existing = await trx.query(
      `SELECT request_hash, response_body
         FROM commerce_idempotency_keys
        WHERE empresa_id = $1 AND scope = 'order.create' AND key = $2
        FOR UPDATE`,
      [empresaId, idem],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
      if (existing.rows[0].response_body) return existing.rows[0].response_body;
    } else {
      await trx.query(
        `INSERT INTO commerce_idempotency_keys
          (empresa_id, scope, key, request_hash, expires_at)
         VALUES ($1, 'order.create', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [empresaId, idem, requestHash],
      );
    }
  }

  const variants = await trx.query(
    `SELECT v.id, v.sku, v.nome AS variant_name, p.nome AS product_name, p.tipo AS product_type,
            COALESCE(vp.preco_promocional, vp.preco) AS price,
            COALESCE(vp.preco_promocional IS NOT NULL, false) AS promotional
       FROM commerce_product_variants v
       JOIN commerce_products p
         ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active'
       JOIN commerce_variant_prices vp
         ON vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
       JOIN commerce_product_channels pc
         ON pc.empresa_id = v.empresa_id AND pc.product_id = p.id
        AND pc.storefront_id = $3 AND pc.price_list_id = vp.price_list_id AND pc.publicado = true
       JOIN commerce_price_lists pl
         ON pl.empresa_id = vp.empresa_id AND pl.id = vp.price_list_id
        AND pl.ativo = true AND pl.canal = 'web'
      WHERE v.empresa_id = $1
        AND v.id = ANY($2::uuid[])
        AND v.ativo = true
        AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
        AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
      ORDER BY vp.vigencia_inicio DESC`,
    [empresaId, uniqueVariantIds, storefront.id],
  );
  const priced = new Map();
  for (const row of variants.rows) if (!priced.has(row.id)) priced.set(row.id, row);
  if (priced.size !== uniqueVariantIds.length) throw new CommerceError('um ou mais itens não estão disponíveis no catálogo', 'ITEM_UNAVAILABLE');

  let customerId = input.customerId ? assertUuid(input.customerId, 'customerId') : null;
  const customer = input.customer || {};
  const customerName = String(customer.nome || '').trim();
  const customerEmail = String(customer.email || '').trim().toLowerCase() || null;
  if (!customerId && !customerName) throw new CommerceError('nome do cliente é obrigatório', 'CUSTOMER_REQUIRED');
  if (!customerId && customerEmail) {
    const existing = await trx.query(
      `SELECT id FROM commerce_customers WHERE empresa_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [empresaId, customerEmail],
    );
    customerId = existing.rows[0]?.id || null;
  }
  if (!customerId) {
    const created = await trx.query(
      `INSERT INTO commerce_customers (empresa_id, nome, email, telefone, consentimentos)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [empresaId, customerName, customerEmail, String(customer.telefone || '').trim() || null, JSON.stringify(customer.consentimentos || {})],
    );
    customerId = created.rows[0].id;
  } else {
    const verifiedCustomer = await trx.query(
      `SELECT id FROM commerce_customers WHERE empresa_id = $1 AND id = $2 AND bloqueado = false LIMIT 1`,
      [empresaId, customerId],
    );
    if (!verifiedCustomer.rows[0]) throw new CommerceError('cliente fora do escopo ou bloqueado', 'CUSTOMER_NOT_FOUND');
  }

  const orderId = crypto.randomUUID();
  const publicCode = `KC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const normalizedLines = lines.map(line => {
    const variant = priced.get(line.variantId);
    const price = Number(variant.price);
    return { ...line, variant, price, subtotal: price * line.quantity };
  });
  const subtotal = normalizedLines.reduce((sum, line) => sum + line.subtotal, 0);
  // O checkout público não pode definir valores comerciais no navegador.
  // Frete, descontos e impostos devem ser calculados por serviços server-side
  // antes de serem habilitados; até lá, permanecem zero e explícitos.
  const shipping = 0;
  const discount = 0;
  const taxes = 0;
  const total = subtotal;
  const status = 'pending_payment';

  await trx.query(
    `INSERT INTO commerce_orders
      (id, empresa_id, storefront_id, customer_id, public_code, status, origem, moeda,
       subtotal, desconto, frete, impostos, total, endereco_entrega, endereco_cobranca, observacao, shipping_method_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'web', $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16)`,
    [orderId, empresaId, storefront.id, customerId, publicCode, status, storefront.moeda || 'BRL', subtotal, discount, shipping, taxes, total,
      JSON.stringify(input.shippingAddress || null), JSON.stringify(input.billingAddress || null), String(input.note || '').slice(0, 1000) || null, shippingMethodId],
  );
  for (const line of normalizedLines) {
    await trx.query(
      `INSERT INTO commerce_order_items
        (empresa_id, order_id, variant_id, sku_snapshot, nome_snapshot, atributos_snapshot,
         quantidade, preco_unitario, desconto, subtotal)
       SELECT $1, $2, v.id, v.sku, COALESCE(v.nome, p.nome), v.atributos, $3, $4, 0, $5
         FROM commerce_product_variants v
         JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
        WHERE v.empresa_id = $1 AND v.id = $6`,
      [empresaId, orderId, line.quantity, line.price, line.subtotal, line.variantId],
    );
  }

  const physical = normalizedLines.filter(line => line.variant.product_type === 'physical' || line.variant.product_type === 'ticket');
  if (physical.length) {
    let locationId = input.locationId ? assertUuid(input.locationId, 'locationId') : null;
    if (locationId) {
      const location = await trx.query(
        `SELECT id FROM commerce_inventory_locations
          WHERE empresa_id = $1 AND id = $2 AND (loja_id = $3 OR loja_id IS NULL) AND ativo = true
          LIMIT 1`,
        [empresaId, locationId, storefront.loja_id],
      );
      if (!location.rows[0]) throw new CommerceError('local de estoque fora do escopo da loja', 'INVENTORY_LOCATION_SCOPE_MISMATCH');
    } else {
      const location = await trx.query(
        `SELECT id FROM commerce_inventory_locations
          WHERE empresa_id = $1 AND (loja_id = $2 OR loja_id IS NULL) AND ativo = true
          ORDER BY CASE WHEN loja_id = $2 THEN 0 ELSE 1 END, criado_em ASC LIMIT 1`,
        [empresaId, storefront.loja_id],
      );
      locationId = location.rows[0]?.id || null;
    }
    if (!locationId) throw new CommerceError('local de estoque não configurado', 'INVENTORY_LOCATION_REQUIRED');
    for (const line of physical) {
      await reserveInventory(trx, { empresaId }, {
        locationId,
        variantId: line.variantId,
        orderId,
        quantity: line.quantity,
        idempotencyKey: idem ? `${idem}:${line.variantId}` : null,
        expiresAt: input.reservationExpiresAt || null,
      });
    }
  }
  await trx.query(
    `INSERT INTO commerce_order_events
      (empresa_id, order_id, de_status, para_status, origem, usuario_id, correlation_id, payload_resumido)
     VALUES ($1, $2, NULL, $3, 'checkout', $4, $5, $6::jsonb)`,
    [empresaId, orderId, status, context.usuarioId || null, requestId(input.correlationId), JSON.stringify({ lineCount: normalizedLines.length })],
  );
  const result = { id: orderId, publicCode, status, currency: storefront.moeda || 'BRL', subtotal, discount, shipping, taxes, total, customerId, shippingMethodId };
  if (idem) {
    await trx.query(
      `UPDATE commerce_idempotency_keys SET response_status = 201, response_body = $3::jsonb
        WHERE empresa_id = $1 AND scope = 'order.create' AND key = $2`,
      [empresaId, idem, JSON.stringify(result)],
    );
  }
  return result;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || `item-${crypto.randomBytes(4).toString('hex')}`;
}

export async function createCategory(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const nome = String(input.nome || '').trim();
  if (!nome) throw new CommerceError('nome da categoria é obrigatório', 'CATEGORY_REQUIRED');
  const slug = slugify(input.slug || nome);
  const parentId = input.parentId ? assertUuid(input.parentId, 'parentId') : null;
  if (parentId) {
    const parent = await trx.query('SELECT id FROM commerce_categories WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, parentId]);
    if (!parent.rows[0]) throw new CommerceError('categoria pai não encontrada no tenant', 'CATEGORY_NOT_FOUND');
  }
  const result = await trx.query(
    `INSERT INTO commerce_categories (empresa_id, parent_id, slug, nome, descricao, ativo, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [empresaId, parentId, slug, nome, String(input.descricao || '').slice(0, 4000) || null, input.ativo !== false, Number(input.ordem) || 0],
  );
  return result.rows[0];
}

async function ensureDefaultPriceList(trx, empresaId) {
  const found = await trx.query(
    `SELECT id FROM commerce_price_lists WHERE empresa_id = $1 AND codigo = 'web-default' LIMIT 1`,
    [empresaId],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await trx.query(
    `INSERT INTO commerce_price_lists (empresa_id, codigo, nome, canal, moeda, ativo)
     VALUES ($1, 'web-default', 'Tabela web padrão', 'web', 'BRL', true)
     ON CONFLICT (empresa_id, codigo) DO UPDATE SET ativo = true
     RETURNING id`,
    [empresaId],
  );
  return created.rows[0].id;
}

export async function createCatalogProduct(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const nome = String(input.nome || '').trim();
  if (!nome) throw new CommerceError('nome do produto é obrigatório', 'PRODUCT_REQUIRED');
  const slug = slugify(input.slug || nome);
  const status = ['draft', 'active', 'archived'].includes(input.status) ? input.status : 'draft';
  const categoryId = input.categoryId ? assertUuid(input.categoryId, 'categoryId') : null;
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  if (categoryId) {
    const category = await trx.query('SELECT id FROM commerce_categories WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, categoryId]);
    if (!category.rows[0]) throw new CommerceError('categoria não encontrada no tenant', 'CATEGORY_NOT_FOUND');
  }
  if (storefrontId) await resolveStorefront(trx, context, storefrontId);
  const productResult = await trx.query(
    `INSERT INTO commerce_products
      (empresa_id, category_id, slug, nome, tipo, status, descricao, descricao_curta, dados_fiscais, seo, criado_por, publicado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, CASE WHEN $6 = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END)
     RETURNING *`,
    [empresaId, categoryId, slug, nome, input.tipo || 'physical', status, String(input.descricao || '').slice(0, 10000) || null, String(input.descricaoCurta || '').slice(0, 500) || null, JSON.stringify(input.dadosFiscais || {}), JSON.stringify(input.seo || {}), usuarioId],
  );
  const product = productResult.rows[0];
  const variant = input.variant || {};
  const sku = String(variant.sku || input.sku || `${slug}-${crypto.randomBytes(3).toString('hex')}`).slice(0, 100);
  const variantResult = await trx.query(
    `INSERT INTO commerce_product_variants
      (empresa_id, product_id, sku, barcode, nome, atributos, peso_gramas, largura_cm, altura_cm, comprimento_cm, ativo)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     RETURNING *`,
    [empresaId, product.id, sku, String(variant.barcode || '').trim() || null, String(variant.nome || '').trim() || null, JSON.stringify(variant.atributos || {}), variant.pesoGramas == null ? null : Math.max(0, Number(variant.pesoGramas) || 0), variant.larguraCm == null ? null : Math.max(0, Number(variant.larguraCm) || 0), variant.alturaCm == null ? null : Math.max(0, Number(variant.alturaCm) || 0), variant.comprimentoCm == null ? null : Math.max(0, Number(variant.comprimentoCm) || 0), variant.ativo !== false],
  );
  const price = input.preco == null ? null : Math.max(0, Number(input.preco) || 0);
  if (price != null) {
    const priceListId = input.priceListId ? assertUuid(input.priceListId, 'priceListId') : await ensureDefaultPriceList(trx, empresaId);
    const promotional = input.precoPromocional == null || input.precoPromocional === '' ? null : Math.max(0, Number(input.precoPromocional) || 0);
    if (promotional != null && promotional >= price) throw new CommerceError('preço promocional deve ser menor que o preço de venda', 'INVALID_PROMOTIONAL_PRICE');
    await trx.query(
      `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco, preco_promocional, custo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [empresaId, priceListId, variantResult.rows[0].id, price, promotional, input.custo == null ? null : Math.max(0, Number(input.custo) || 0)],
    );
    if (storefrontId) {
      await trx.query(
        `INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (empresa_id, storefront_id, product_id)
         DO UPDATE SET price_list_id = EXCLUDED.price_list_id, publicado = EXCLUDED.publicado`,
        [empresaId, storefrontId, product.id, priceListId, status === 'active' && input.publicado === true],
      );
    }
  }
  if (input.media?.url) {
    await trx.query(
      `INSERT INTO commerce_product_media (empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [empresaId, product.id, variantResult.rows[0].id, String(input.media.storageKey || input.media.url).slice(0, 500), String(input.media.url).slice(0, 1000), String(input.media.mimeType || 'image/*').slice(0, 120), String(input.media.altText || nome).slice(0, 255), Number(input.media.ordem) || 0],
    );
  }
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'product', $4, 'created', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, product.id, JSON.stringify({ nome, slug, status, variantId: variantResult.rows[0].id })],
  );
  return { ...product, variant: variantResult.rows[0] };
}

export async function updateCatalogProduct(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  const allowed = { nome: 'nome', slug: 'slug', tipo: 'tipo', status: 'status', descricao: 'descricao', descricaoCurta: 'descricao_curta', categoryId: 'category_id', dadosFiscais: 'dados_fiscais', seo: 'seo' };
  const sets = [];
  const values = [empresaId, id];
  for (const [inputKey, column] of Object.entries(allowed)) {
    if (input[inputKey] === undefined) continue;
    let value = input[inputKey];
    if (inputKey === 'categoryId') value = value ? assertUuid(value, 'categoryId') : null;
    if (inputKey === 'slug') value = slugify(value);
    if (['dadosFiscais', 'seo'].includes(inputKey)) value = JSON.stringify(value || {});
    if (['nome', 'descricao', 'descricaoCurta'].includes(inputKey)) value = String(value || '').slice(0, inputKey === 'nome' ? 300 : inputKey === 'descricaoCurta' ? 500 : 10000) || null;
    values.push(value);
    sets.push(`${column} = $${values.length}${['dados_fiscais','seo'].includes(column) ? '::jsonb' : ''}`);
  }
  if (input.status === 'active') sets.push('publicado_em = COALESCE(publicado_em, CURRENT_TIMESTAMP)');
  if (!sets.length) throw new CommerceError('nenhum campo editável informado', 'NO_CHANGES');
  const result = await trx.query(`UPDATE commerce_products SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  if (!result.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'product', $4, 'updated', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, id, JSON.stringify({ fields: Object.keys(input).filter(key => allowed[key]) })],
  );
  return result.rows[0];
}

export async function archiveCatalogProduct(trx, context, productId) {
  return updateCatalogProduct(trx, context, productId, { status: 'archived' });
}

export async function publishCatalogProduct(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  await resolveStorefront(trx, context, storefrontId);
  const product = await trx.query('SELECT id, status FROM commerce_products WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, id]);
  if (!product.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  const priceListId = input.priceListId ? assertUuid(input.priceListId, 'priceListId') : await ensureDefaultPriceList(trx, empresaId);
  const publicado = input.publicado !== false;
  await trx.query(
    `INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empresa_id, storefront_id, product_id)
     DO UPDATE SET price_list_id = EXCLUDED.price_list_id, publicado = EXCLUDED.publicado`,
    [empresaId, storefrontId, id, priceListId, publicado],
  );
  if (publicado && product.rows[0].status !== 'active') {
    await trx.query(`UPDATE commerce_products SET status = 'active', publicado_em = COALESCE(publicado_em, CURRENT_TIMESTAMP) WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  }
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'product_channel', $4, $5, $6::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, id, publicado ? 'published' : 'unpublished', JSON.stringify({ storefrontId, priceListId })],
  );
  return { productId: id, storefrontId, priceListId, publicado };
}

export async function setVariantPrice(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  const variantId = assertUuid(input.variantId, 'variantId');
  const price = Number(input.preco);
  if (!Number.isFinite(price) || price < 0) throw new CommerceError('preço de venda inválido', 'INVALID_PRICE');
  const promotional = input.precoPromocional == null || input.precoPromocional === '' ? null : Number(input.precoPromocional);
  if (promotional != null && (!Number.isFinite(promotional) || promotional < 0 || promotional >= price)) throw new CommerceError('preço promocional deve ser menor que o preço de venda', 'INVALID_PROMOTIONAL_PRICE');
  const variant = await trx.query(
    `SELECT v.id FROM commerce_product_variants v
      WHERE v.empresa_id = $1 AND v.id = $2 AND v.product_id = $3 LIMIT 1`,
    [empresaId, variantId, id],
  );
  if (!variant.rows[0]) throw new CommerceError('variante não encontrada no produto/tenant', 'VARIANT_NOT_FOUND');
  const priceListId = input.priceListId ? assertUuid(input.priceListId, 'priceListId') : await ensureDefaultPriceList(trx, empresaId);
  await trx.query(
    `UPDATE commerce_variant_prices
        SET vigencia_fim = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND price_list_id = $2 AND variant_id = $3
        AND vigencia_fim IS NULL`,
    [empresaId, priceListId, variantId],
  );
  const result = await trx.query(
    `INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco, preco_promocional, custo, vigencia_inicio)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
    [empresaId, priceListId, variantId, price, promotional, input.custo == null ? null : Math.max(0, Number(input.custo) || 0)],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'variant_price', $4, 'updated', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, variantId, JSON.stringify({ productId: id, priceListId, price, promotional })],
  );
  return result.rows[0];
}

export const FULFILLMENT_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['shipped', 'out_for_delivery', 'picked_up', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  delivered: [],
  picked_up: [],
  failed: ['preparing', 'cancelled'],
  cancelled: [],
};

export async function createShippingMethod(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  await resolveStorefront(trx, context, storefrontId);
  const codigo = String(input.codigo || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80);
  const nome = String(input.nome || '').trim();
  const tipo = String(input.tipo || '').trim();
  if (!codigo || !nome || !['pickup', 'delivery', 'carrier', 'digital', 'service'].includes(tipo)) throw new CommerceError('código, nome e tipo de entrega válidos são obrigatórios', 'SHIPPING_METHOD_INVALID');
  const result = await trx.query(
    `INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
    [empresaId, storefrontId, codigo, nome, tipo, input.ativo !== false, JSON.stringify(input.configuracao || {})],
  );
  return result.rows[0];
}

export async function createFulfillment(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const orderId = assertUuid(input.orderId, 'orderId');
  const order = await trx.query(`SELECT id, storefront_id, status, endereco_entrega FROM commerce_orders WHERE empresa_id = $1 AND id = $2 FOR UPDATE`, [empresaId, orderId]);
  if (!order.rows[0]) throw new CommerceError('pedido não encontrado no tenant', 'ORDER_NOT_FOUND');
  const shippingMethodId = input.shippingMethodId ? assertUuid(input.shippingMethodId, 'shippingMethodId') : null;
  if (shippingMethodId) {
    const method = await trx.query(`SELECT id FROM commerce_shipping_methods WHERE empresa_id = $1 AND storefront_id = $2 AND id = $3 AND ativo = true LIMIT 1`, [empresaId, order.rows[0].storefront_id, shippingMethodId]);
    if (!method.rows[0]) throw new CommerceError('método de entrega não encontrado para a loja', 'SHIPPING_METHOD_NOT_FOUND');
  }
  const result = await trx.query(
    `INSERT INTO commerce_fulfillments (empresa_id, order_id, shipping_method_id, status, endereco_entrega)
     VALUES ($1, $2, $3, 'pending', COALESCE($4::jsonb, $5::jsonb)) RETURNING *`,
    [empresaId, orderId, shippingMethodId, input.enderecoEntrega ? JSON.stringify(input.enderecoEntrega) : null, JSON.stringify(order.rows[0].endereco_entrega || null)],
  );
  return result.rows[0];
}

export async function updateFulfillment(trx, context, fulfillmentId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(fulfillmentId, 'fulfillmentId');
  const locked = await trx.query(`SELECT id, order_id, status, ocorrencias FROM commerce_fulfillments WHERE empresa_id = $1 AND id = $2 FOR UPDATE`, [empresaId, id]);
  const current = locked.rows[0];
  if (!current) throw new CommerceError('fulfillment não encontrado no tenant', 'FULFILLMENT_NOT_FOUND');
  const nextStatus = String(input.status || current.status);
  if (nextStatus !== current.status && !FULFILLMENT_TRANSITIONS[current.status]?.includes(nextStatus)) throw new CommerceError(`transição de entrega ${current.status} → ${nextStatus} não permitida`, 'INVALID_FULFILLMENT_TRANSITION');
  const occurrence = input.ocorrencia ? { at: new Date().toISOString(), status: nextStatus, description: String(input.ocorrencia).slice(0, 500) } : null;
  const occurrences = occurrence ? [...(Array.isArray(current.ocorrencias) ? current.ocorrencias : []), occurrence].slice(-100) : current.ocorrencias || [];
  const result = await trx.query(
    `UPDATE commerce_fulfillments SET status = $3, tracking_code = COALESCE($4, tracking_code), carrier = COALESCE($5, carrier), ocorrencias = $6::jsonb,
       enviado_em = CASE WHEN $3 = 'shipped' AND enviado_em IS NULL THEN CURRENT_TIMESTAMP ELSE enviado_em END,
       entregue_em = CASE WHEN $3 IN ('delivered','picked_up') AND entregue_em IS NULL THEN CURRENT_TIMESTAMP ELSE entregue_em END,
       atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [empresaId, id, nextStatus, input.trackingCode ? String(input.trackingCode).slice(0, 160) : null, input.carrier ? String(input.carrier).slice(0, 120) : null, JSON.stringify(occurrences)],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, 'fulfillment', $3, 'updated', $4::jsonb)`,
    [empresaId, usuarioId, id, JSON.stringify({ from: current.status, to: nextStatus, orderId: current.order_id })],
  );
  return result.rows[0];
}

export async function createInventoryLocation(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const nome = String(input.nome || '').trim();
  const codigo = String(input.codigo || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80);
  if (!nome || !codigo) throw new CommerceError('nome e código do local são obrigatórios', 'LOCATION_REQUIRED');
  const lojaId = input.lojaId ? assertUuid(input.lojaId, 'lojaId') : context.lojaId || null;
  if (lojaId) {
    const loja = await trx.query('SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2 AND ativa = true LIMIT 1', [empresaId, lojaId]);
    if (!loja.rows[0]) throw new CommerceError('loja não encontrada no tenant', 'STORE_NOT_FOUND');
  }
  const result = await trx.query(
    `INSERT INTO commerce_inventory_locations (empresa_id, loja_id, codigo, nome, tipo, ativo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [empresaId, lojaId, codigo, nome, input.tipo || 'store', input.ativo !== false],
  );
  return result.rows[0];
}

export async function adjustInventory(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const locationId = assertUuid(input.locationId, 'locationId');
  const variantId = assertUuid(input.variantId, 'variantId');
  const delta = Number(input.delta);
  if (!Number.isInteger(delta) || delta === 0) throw new CommerceError('informe uma variação de estoque inteira diferente de zero', 'INVALID_INVENTORY_DELTA');
  const idem = input.idempotencyKey ? String(input.idempotencyKey).trim().slice(0, 180) : null;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ locationId, variantId, delta, tipo: input.tipo || null })).digest('hex');
  if (idem) {
    const existing = await trx.query(
      `SELECT request_hash, response_body FROM commerce_idempotency_keys
        WHERE empresa_id = $1 AND scope = 'inventory.adjust' AND key = $2 FOR UPDATE`,
      [empresaId, idem],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
      if (existing.rows[0].response_body) return existing.rows[0].response_body;
    } else {
      await trx.query(
        `INSERT INTO commerce_idempotency_keys (empresa_id, scope, key, request_hash, expires_at)
         VALUES ($1, 'inventory.adjust', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [empresaId, idem, requestHash],
      );
    }
  }
  await trx.query(
    `INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id)
     VALUES ($1, $2, $3) ON CONFLICT (empresa_id, location_id, variant_id) DO NOTHING`,
    [empresaId, locationId, variantId],
  );
  const locked = await trx.query(
    `SELECT disponivel FROM commerce_inventory_levels
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3 FOR UPDATE`,
    [empresaId, locationId, variantId],
  );
  if (!locked.rows[0]) throw new CommerceError('local, variante ou saldo não encontrado no tenant', 'INVENTORY_LEVEL_NOT_FOUND');
  const before = Number(locked.rows[0].disponivel);
  const after = before + delta;
  if (after < 0) throw new CommerceError('o ajuste não pode deixar estoque negativo', 'INSUFFICIENT_STOCK', { available: before });
  await trx.query(
    `UPDATE commerce_inventory_levels SET disponivel = $4, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3`,
    [empresaId, locationId, variantId, after],
  );
  const tipo = input.tipo || (delta > 0 ? 'entrada' : 'saida');
  await trx.query(
    `INSERT INTO commerce_inventory_movements
      (empresa_id, location_id, variant_id, tipo, quantidade, saldo_anterior, saldo_posterior,
       referencia_tipo, referencia_id, idempotency_key, usuario_id, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8, $9, $10, $11)`,
    [empresaId, locationId, variantId, tipo, Math.abs(delta), before, after, input.referenceId ? assertUuid(input.referenceId, 'referenceId') : null, idem, usuarioId, String(input.observacao || '').slice(0, 500) || null],
  );
  const result = { empresaId, locationId, variantId, disponivel: after, delta };
  if (idem) {
    await trx.query(
      `UPDATE commerce_idempotency_keys SET response_status = 201, response_body = $3::jsonb
        WHERE empresa_id = $1 AND scope = 'inventory.adjust' AND key = $2`,
      [empresaId, idem, JSON.stringify(result)],
    );
  }
  return result;
}

export async function healthcheck() {
  const result = await db.query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}
