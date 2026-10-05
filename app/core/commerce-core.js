import crypto from 'crypto';
import { db } from './database.js';
import { CommerceError } from './commerce-error.js';
import { normalizeCustomerInput, resolveCommerceCustomer, resolveCommerceCustomerAddress } from './commerce-customer-identity.js';
import { isDinoLocalManualMethod, normalizeCep, normalizeOwnDeliveryConfig, resolveShippingSelection } from './commerce-shipping.js';
import { markCartConverted } from './commerce-abandoned-carts.js';
import { creditPaidOrderLoyaltyPoints, reverseOrderLoyaltyPoints } from './loyalty-advanced.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_RESERVATION_TTL_MINUTES = Math.min(24 * 60, Math.max(5, Number.parseInt(process.env.COMMERCE_RESERVATION_TTL_MINUTES || '30', 10) || 30));

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  const entries = Object.keys(value)
    .filter(key => value[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

function canonicalHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export const ORDER_TRANSITIONS = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['paid', 'payment_failed', 'fraud_review', 'cancelled'],
  // Pedido com pagamento recusado já devolveu o estoque: não volta a aguardar pagamento
  // (voltaria sem reserva e venderia o que não tem). O cliente faz um pedido novo.
  payment_failed: ['cancelled'],
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

export { CommerceError } from './commerce-error.js';

const envInt = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};
export const commerceCheckoutLimits = () => ({
  maxLineQuantity: envInt('COMMERCE_MAX_LINE_QUANTITY', 20, 1, 10000),
  maxOrderUnits: envInt('COMMERCE_MAX_ORDER_UNITS', 60, 1, 100000),
  reservationTtlMinutes: ORDER_RESERVATION_TTL_MINUTES,
});

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

const AUDIT_SENSITIVE_KEYS = new Set(['secret_ref', 'secretRef', 'webhookSecret', 'webhookSecretRef', 'accessToken', 'access_token', 'token', 'password', 'pan', 'cvv']);

function safeAuditValue(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => safeAuditValue(item, depth + 1));
  if (typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 2000) : value;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, AUDIT_SENSITIVE_KEYS.has(key) ? '[REDACTED]' : safeAuditValue(item, depth + 1)]));
}

export async function auditLog(trx, context, input = {}) {
  const { empresaId, lojaId, usuarioId } = tenantContext(context);
  const entidade = String(input.entidade || '').trim().slice(0, 100);
  const acao = String(input.acao || '').trim().slice(0, 100);
  if (!entidade || !acao) throw new CommerceError('entidade e ação são obrigatórias na auditoria', 'AUDIT_INVALID');
  const entidadeId = input.entidadeId ? assertUuid(input.entidadeId, 'entidadeId') : null;
  const auditLojaId = input.lojaId ? assertUuid(input.lojaId, 'lojaId') : lojaId;
  if (auditLojaId && lojaId && auditLojaId !== lojaId) throw new CommerceError('loja da auditoria fora do escopo', 'STORE_SCOPE_MISMATCH');
  await trx.query(
    `INSERT INTO commerce_audit_logs
      (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
    [empresaId, auditLojaId, usuarioId, entidade, entidadeId, acao, JSON.stringify(safeAuditValue(input.antes ?? null)), JSON.stringify(safeAuditValue(input.depois ?? null)), requestId(input.correlationId)],
  );
  return { empresaId, lojaId: auditLojaId, usuarioId, entidade, entidadeId, acao };
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
  if (context.lojaId && context.corporateAccess !== true && result.rows[0].loja_id !== context.lojaId) {
    throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
  }
  return result.rows[0];
}

function hasVerifiedCapability(context, capability) {
  const values = context?.capabilities instanceof Set
    ? [...context.capabilities]
    : Array.isArray(context?.capabilities) ? context.capabilities : [];
  return values.includes(capability);
}

function requireVerifiedCapability(context, capability) {
  if (!hasVerifiedCapability(context, capability)) {
    throw new CommerceError('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission: capability });
  }
}

export async function resolveCatalogResourceScope(trx, context, input = {}) {
  const { empresaId, lojaId } = tenantContext(context);
  const corporateAccess = context?.corporateAccess === true;
  const mutation = input.mutation === true;
  let productId = input.productId ? assertUuid(input.productId, 'productId') : null;
  let variant = null;
  let media = null;

  if (input.variantId) {
    const variantId = assertUuid(input.variantId, 'variantId');
    const result = await trx.query(
      'SELECT id, product_id FROM commerce_product_variants WHERE empresa_id = $1 AND id = $2 LIMIT 1',
      [empresaId, variantId],
    );
    variant = result.rows[0] || null;
    if (!variant || (productId && variant.product_id !== productId)) throw new CommerceError('variante não encontrada no produto/tenant', 'VARIANT_NOT_FOUND');
    productId = variant.product_id;
  }

  if (input.mediaId) {
    const mediaId = assertUuid(input.mediaId, 'mediaId');
    const result = await trx.query(
      `SELECT id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem, criado_em
         FROM commerce_product_media WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
      [empresaId, mediaId],
    );
    media = result.rows[0] || null;
    if (!media || (productId && media.product_id !== productId)) throw new CommerceError('mídia não encontrada no tenant', 'MEDIA_NOT_FOUND');
    productId = media.product_id;
  }

  if (!productId) throw new CommerceError('produto é obrigatório para validar o escopo', 'PRODUCT_NOT_FOUND');
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  if (lojaId && !corporateAccess && !storefrontId) throw new CommerceError('storefrontId é obrigatório para operar catálogo no escopo da loja', 'STOREFRONT_REQUIRED');
  const storefront = storefrontId ? await resolveStorefront(trx, context, storefrontId) : null;
  if (mutation && lojaId && !corporateAccess && storefront?.loja_id !== lojaId) {
    throw new CommerceError('storefront global ou de outra loja exige autorização corporativa', 'STORE_SCOPE_MISMATCH');
  }

  const productResult = await trx.query(
    `SELECT p.id, p.status,
            EXISTS (
              SELECT 1 FROM commerce_product_channels authorized
              JOIN commerce_storefronts scoped_storefront
                ON scoped_storefront.empresa_id = authorized.empresa_id AND scoped_storefront.id = authorized.storefront_id
             WHERE authorized.empresa_id = p.empresa_id AND authorized.product_id = p.id
               AND ($3::uuid IS NULL OR authorized.storefront_id = $3)
               AND ($4::uuid IS NULL OR scoped_storefront.loja_id = $4 OR scoped_storefront.loja_id IS NULL)
            ) AS authorized_channel,
            EXISTS (
              SELECT 1 FROM commerce_product_channels shared
             WHERE shared.empresa_id = p.empresa_id AND shared.product_id = p.id
               AND $3::uuid IS NOT NULL AND shared.storefront_id <> $3
            ) AS outside_selected_channel
       FROM commerce_products p
      WHERE p.empresa_id = $1 AND p.id = $2
      ${input.lock ? 'FOR UPDATE OF p' : ''}`,
    [empresaId, productId, storefrontId, lojaId],
  );
  const product = productResult.rows[0];
  if (!product) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  if (input.requireChannel !== false && !corporateAccess && !product.authorized_channel) {
    throw new CommerceError('produto fora do escopo do storefront selecionado', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH');
  }
  if (mutation && storefrontId && !corporateAccess && product.outside_selected_channel) {
    throw new CommerceError('produto compartilhado com outro storefront exige autorização corporativa', 'PRODUCT_SHARED_SCOPE_MISMATCH');
  }
  return { empresaId, lojaId, corporateAccess, storefrontId, storefront, product, variant, media };
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
  const result = await db.queryRead(
    `SELECT p.id, p.slug, p.nome, p.tipo, p.descricao, p.descricao_curta,
            c.id AS category_id, c.nome AS category_name,
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
              'id', v.id, 'sku', v.sku, 'nome', v.nome, 'atributos', v.atributos,
              'estoque', COALESCE(stock.disponivel, 0),
              'permiteCompraSemEstoque', v.permite_compra_sem_estoque,
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
         SELECT COALESCE(MAX(il.disponivel), 0) AS disponivel
          FROM commerce_inventory_levels il
           JOIN commerce_inventory_locations l
             ON l.empresa_id = il.empresa_id AND l.id = il.location_id AND l.ativo = true
           JOIN commerce_storefronts selected_storefront
             ON selected_storefront.empresa_id = p.empresa_id AND selected_storefront.id = $2 AND selected_storefront.status = 'active'
          WHERE il.empresa_id = p.empresa_id AND il.variant_id = v.id
            AND (l.loja_id IS NULL OR l.loja_id = selected_storefront.loja_id)
            AND (
              NULLIF(selected_storefront.configuracoes->>'inventoryLocationId', '') IS NULL
              OR l.id::text = selected_storefront.configuracoes->>'inventoryLocationId'
            )
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

// A vitrine não oferece split fulfillment: toda a reserva de um pedido físico
// precisa caber em um único local. O catálogo usa MAX(disponivel) pela mesma
// regra. No checkout, os locais e saldos relevantes são travados antes da
// escolha para que a regra não mude entre a seleção e reserveInventory().
async function selectInventoryLocation(trx, { empresaId, storefront, lines, requestedLocationId = null }) {
  const configuredLocationId = storefront.configuracoes?.inventoryLocationId
    ? assertUuid(storefront.configuracoes.inventoryLocationId, 'configuracoes.inventoryLocationId')
    : null;
  if (configuredLocationId && requestedLocationId && configuredLocationId !== requestedLocationId) {
    throw new CommerceError('o local operacional configurado não pode ser substituído', 'INVENTORY_LOCATION_SCOPE_MISMATCH');
  }
  const locationId = configuredLocationId || requestedLocationId;
  const locationValues = [empresaId, storefront.loja_id];
  const locationPredicates = [
    'l.empresa_id = $1',
    '(l.loja_id = $2 OR l.loja_id IS NULL)',
    'l.ativo = true',
  ];
  if (locationId) {
    locationValues.push(locationId);
    locationPredicates.push(`l.id = $${locationValues.length}`);
  }
  const locations = await trx.query(
    `SELECT l.id, l.loja_id, l.criado_em
       FROM commerce_inventory_locations l
      WHERE ${locationPredicates.join(' AND ')}
      ORDER BY CASE WHEN l.loja_id = $2 THEN 0 ELSE 1 END, l.criado_em ASC, l.id ASC
      FOR UPDATE`,
    locationValues,
  );
  if (!locations.rows.length) {
    if (locationId) throw new CommerceError('local de estoque fora do escopo da loja', 'INVENTORY_LOCATION_SCOPE_MISMATCH');
    throw new CommerceError('local de estoque não configurado', 'INVENTORY_LOCATION_REQUIRED');
  }

  const locationIds = locations.rows.map(row => row.id);
  const variantIds = lines.map(line => line.variantId);
  const levels = await trx.query(
    `SELECT location_id, variant_id, disponivel, v.permite_compra_sem_estoque
       FROM commerce_inventory_levels il
       JOIN commerce_product_variants v
         ON v.empresa_id = il.empresa_id AND v.id = il.variant_id
      WHERE il.empresa_id = $1
        AND location_id = ANY($2::uuid[])
        AND variant_id = ANY($3::uuid[])
      ORDER BY location_id, variant_id
      FOR UPDATE`,
    [empresaId, locationIds, variantIds],
  );
  const available = new Map(levels.rows.map(row => [`${row.location_id}:${row.variant_id}`, Number(row.disponivel)]));
  const allowsBackorder = new Map(lines.map(line => [line.variantId, line.variant?.permite_compra_sem_estoque === true]));
  for (const row of levels.rows) {
    if (row.permite_compra_sem_estoque === true) allowsBackorder.set(row.variant_id, true);
  }
  const candidates = locations.rows
    .map(location => {
      const capacities = lines.map(line => {
        const balance = available.get(`${location.id}:${line.variantId}`) || 0;
        return allowsBackorder.get(line.variantId) === true && balance < line.quantity
          ? Number.POSITIVE_INFINITY
          : Math.floor(balance / line.quantity);
      });
      return { location, capacity: Math.min(...capacities) };
    })
    .filter(candidate => candidate.capacity > 0 || candidate.capacity === Number.POSITIVE_INFINITY);
  if (!candidates.length) {
    throw new CommerceError('estoque insuficiente em um único local para todos os itens', 'INSUFFICIENT_STOCK', {
      availableLocations: locations.rows.map(row => row.id),
    });
  }
  candidates.sort((left, right) => {
    if (right.capacity !== left.capacity) return right.capacity - left.capacity;
    const leftStoreRank = left.location.loja_id === storefront.loja_id ? 0 : 1;
    const rightStoreRank = right.location.loja_id === storefront.loja_id ? 0 : 1;
    if (leftStoreRank !== rightStoreRank) return leftStoreRank - rightStoreRank;
    const createdDifference = new Date(left.location.criado_em).getTime() - new Date(right.location.criado_em).getTime();
    return createdDifference || left.location.id.localeCompare(right.location.id);
  });
  const selected = candidates[0].location;
  return {
    locationId: selected.id,
    backorderVariantIds: lines
      .filter(line => (available.get(`${selected.id}:${line.variantId}`) || 0) < line.quantity && allowsBackorder.get(line.variantId) === true)
      .map(line => line.variantId),
  };
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

async function settleOrderReservations(trx, context, orderId, currentStatus, nextStatus) {
  const { empresaId, usuarioId } = tenantContext(context);
  let release = ['payment_failed', 'cancelled'].includes(nextStatus);
  if (nextStatus === 'refunded' && currentStatus === 'paid') {
    const shipped = await trx.query(
      `SELECT 1 FROM commerce_fulfillments
        WHERE empresa_id = $1 AND order_id = $2
          AND status IN ('shipped','out_for_delivery','delivered','picked_up')
        LIMIT 1`,
      [empresaId, orderId],
    );
    release = !shipped.rows[0];
  }
  const commit = nextStatus === 'paid';
  if (!release && !commit) return;
  const reservations = await trx.query(
    `SELECT id, location_id, variant_id, quantidade, status
       FROM commerce_inventory_reservations
      WHERE empresa_id = $1 AND order_id = $2 AND status IN ('pending','confirmed')
      ORDER BY variant_id, location_id, id
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

// Pedido marcado na conta (crediário) e depois cancelado ou devolvido: a cobrança em aberto
// é cancelada e sai do saldo devedor do cliente. Cobrança já quitada fica para acerto manual.
async function reverseOrderCreditCharge(trx, { empresaId, orderId }) {
  const charge = (await trx.query(
    `SELECT id, account_id, valor FROM commerce_customer_credit_entries
      WHERE empresa_id = $1 AND order_id = $2 AND tipo = 'charge' AND status = 'open' FOR UPDATE`,
    [empresaId, orderId],
  ).catch(error => (error?.code === '42P01' ? { rows: [] } : Promise.reject(error)))).rows[0];
  if (!charge) return null;
  await trx.query(`UPDATE commerce_customer_credit_entries SET status = 'cancelled', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [empresaId, charge.id]);
  await trx.query(
    `UPDATE commerce_customer_credit_accounts SET saldo_devedor = GREATEST(0, saldo_devedor - $3), atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`,
    [empresaId, charge.account_id, Number(charge.valor)],
  );
  return { reversed: true, amount: Number(charge.valor) };
}

export async function transitionOrder(trx, context, input) {
  const { empresaId, usuarioId } = tenantContext(context);
  const orderId = assertUuid(input.orderId, 'orderId');
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  const nextStatus = String(input.status || '');
  const allowed = Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, nextStatus);
  if (!allowed) throw new CommerceError('status de pedido inválido', 'INVALID_ORDER_STATUS');
  const locked = await trx.query(
    `SELECT id, status, storefront_id, total
       FROM commerce_orders
      WHERE empresa_id = $1 AND id = $2
        AND ($3::uuid IS NULL OR storefront_id = $3)
        AND ($4::uuid IS NULL OR loja_id = $4)
      FOR UPDATE`,
    [empresaId, orderId, storefrontId, context.corporateAccess === true ? null : context.lojaId || null],
  );
  const order = locked.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
  if (order.status === nextStatus) return order;
  if (!ORDER_TRANSITIONS[order.status]?.includes(nextStatus)) {
    throw new CommerceError(`transição ${order.status} → ${nextStatus} não permitida`, 'INVALID_ORDER_TRANSITION');
  }
  await settleOrderReservations(trx, { empresaId, usuarioId }, orderId, order.status, nextStatus);
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
            jsonb_build_object('status', $4::text), $5
       FROM commerce_storefronts s
      WHERE s.empresa_id = $1 AND s.id = $3`,
    [empresaId, orderId, order.storefront_id, nextStatus, requestId(input.correlationId), usuarioId, JSON.stringify({ status: order.status })],
  );
  const loyalty = nextStatus === 'paid'
    ? await creditPaidOrderLoyaltyPoints(trx, { empresaId, orderId, usuarioId })
    : ['refunded', 'returned', 'cancelled'].includes(nextStatus)
      ? await reverseOrderLoyaltyPoints(trx, { empresaId, orderId, usuarioId, motivo: nextStatus })
      : null;
  if (['refunded', 'returned', 'cancelled'].includes(nextStatus)) await reverseOrderCreditCharge(trx, { empresaId, orderId });
  return { ...order, status: nextStatus, ...(loyalty ? { loyalty } : {}) };
}

export async function createPendingOrder(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const idem = String(input.idempotencyKey || '').trim().slice(0, 180);
  if (!idem) throw new CommerceError('chave de idempotência é obrigatória para criar o pedido', 'ORDER_IDEMPOTENCY_REQUIRED');
  const storefront = await resolveStorefront(trx, { ...context, empresaId }, input.storefrontId);
  if (!storefront.loja_id) throw new CommerceError('storefront precisa de uma unidade operacional ativa antes do checkout', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
  const normalizedCustomer = normalizeCustomerInput({ ...(input.customer || {}), customerId: input.customerId || input.customer?.customerId });
  const shippingMethodId = input.shippingMethodId ? assertUuid(input.shippingMethodId, 'shippingMethodId') : null;
  let shippingMethod = null;
  if (shippingMethodId) {
    const method = await trx.query(
      `SELECT id, tipo FROM commerce_shipping_methods
        WHERE empresa_id = $1 AND storefront_id = $2 AND id = $3 AND ativo = true
        LIMIT 1`,
      [empresaId, storefront.id, shippingMethodId],
    );
    shippingMethod = method.rows[0] || null;
    if (!shippingMethod) throw new CommerceError('método de entrega não encontrado para o storefront', 'SHIPPING_METHOD_NOT_FOUND');
  }
  const lineQuantities = new Map();
  if (Array.isArray(input.items)) for (const item of input.items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new CommerceError('quantidade deve ser um inteiro positivo', 'INVALID_QUANTITY');
    const variantId = assertUuid(item.variantId, 'variantId');
    lineQuantities.set(variantId, (lineQuantities.get(variantId) || 0) + quantity);
  }
  const lines = [...lineQuantities.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
  if (!lines.length) throw new CommerceError('o carrinho está vazio', 'EMPTY_CART');
  {
    const limits = commerceCheckoutLimits();
    const perVariant = new Map();
    for (const line of lines) perVariant.set(line.variantId, (perVariant.get(line.variantId) || 0) + line.quantity);
    if ([...perVariant.values()].some(qty => qty > limits.maxLineQuantity)) throw new CommerceError(`máximo de ${limits.maxLineQuantity} unidades por produto em um pedido`, 'QUANTITY_LIMIT_EXCEEDED', { max: limits.maxLineQuantity });
    if (lines.reduce((sum, line) => sum + line.quantity, 0) > limits.maxOrderUnits) throw new CommerceError(`máximo de ${limits.maxOrderUnits} unidades por pedido`, 'QUANTITY_LIMIT_EXCEEDED', { max: limits.maxOrderUnits });
  }
  if (!shippingMethodId) {
    const active = await trx.query(`SELECT 1 FROM commerce_shipping_methods WHERE empresa_id = $1 AND storefront_id = $2 AND ativo = true LIMIT 1`, [empresaId, storefront.id]);
    if (active.rows?.[0]) throw new CommerceError('escolha a forma de entrega', 'SHIPPING_METHOD_REQUIRED');
  }
  const uniqueVariantIds = [...new Set(lines.map(line => line.variantId))];
  if (shippingMethod?.tipo === 'delivery' || shippingMethod?.tipo === 'carrier') {
    if (!input.shippingQuoteId || !input.shippingOptionId) throw new CommerceError('delivery exige cotação e opção de frete válidas', 'SHIPPING_QUOTE_REQUIRED');
  } else if (input.shippingQuoteId || input.shippingOptionId) {
    throw new CommerceError('cotação de frete só pode ser usada com método delivery/carrier', 'SHIPPING_QUOTE_INVALID');
  }
  const requestHash = canonicalHash({
    storefrontId: storefront.id,
    lines,
    customerId: normalizedCustomer.customerId,
    customer: {
      nome: normalizedCustomer.nome,
      email: normalizedCustomer.email,
      telefone: normalizedCustomer.telefone,
      consentimentos: normalizedCustomer.consentimentos,
    },
    shippingAddress: input.shippingAddress || null,
    billingAddress: input.billingAddress || null,
    shippingMethodId,
    shippingQuoteId: input.shippingQuoteId || null,
    shippingOptionId: input.shippingOptionId || null,
    locationId: input.locationId || null,
    note: input.note || '',
    promotionCode: String(input.promotionCode || '').trim().toUpperCase() || null,
    ...(input.cartSessionKey ? { cartSessionHash: crypto.createHash('sha256').update(String(input.cartSessionKey)).digest('hex') } : {}),
  });

  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commerce-order-create:${empresaId}:${idem}`]);
  const existing = await trx.query(
    `SELECT request_hash, response_body
       FROM commerce_idempotency_keys
      WHERE empresa_id = $1 AND scope = 'order.create' AND key = $2
      FOR UPDATE`,
    [empresaId, idem],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
    if (existing.rows[0].response_body) {
      await markCartConverted(trx, { ...context, empresaId, lojaId: storefront.loja_id }, { cartSessionKey: input.cartSessionKey, storefrontId: storefront.id, orderId: existing.rows[0].response_body.id, customerId: existing.rows[0].response_body.customerId });
      return existing.rows[0].response_body;
    }
    throw new CommerceError('a criação deste pedido ainda está em processamento', 'ORDER_IDEMPOTENCY_IN_PROGRESS');
  }
  await trx.query(
    `INSERT INTO commerce_idempotency_keys
      (empresa_id, scope, key, request_hash, expires_at)
     VALUES ($1, 'order.create', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
    [empresaId, idem, requestHash],
  );

  const shippingSelection = (shippingMethod?.tipo === 'delivery' || shippingMethod?.tipo === 'carrier')
    ? await resolveShippingSelection(trx, { ...context, empresaId }, { shippingQuoteId: input.shippingQuoteId, shippingOptionId: input.shippingOptionId, shippingAddress: input.shippingAddress }, { storefrontId: storefront.id, shippingMethodId, lines })
    : null;

  const variants = await trx.query(
    `SELECT v.id, v.sku, v.nome AS variant_name, p.nome AS product_name, p.tipo AS product_type,
            v.permite_compra_sem_estoque,
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

  const identityContext = { ...context, empresaId, identitySource: 'checkout', correlationId: input.correlationId };
  // Contatos que resolvem para customers diferentes exigem revisão humana.
  // Nem chamadas internas nem flags no payload podem transformar esse conflito
  // em pedido convidado/pagável ou persistir um snapshot de dados não verificados.
  const customerResolution = await resolveCommerceCustomer(trx, identityContext, normalizedCustomer);
  const customerId = customerResolution.customer.id;
  const customerAddressResolution = await resolveCommerceCustomerAddress(
    trx,
    identityContext,
    customerId,
    shippingSelection?.address || input.shippingAddress,
    customerResolution.customer.nome,
  );

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
  const shipping = shippingSelection?.amount || 0;
  const discount = 0;
  const taxes = 0;
  const total = Number((subtotal + shipping + taxes - discount).toFixed(2));
  const status = 'pending_payment';

  await trx.query(
    `INSERT INTO commerce_orders
      (id, empresa_id, storefront_id, loja_id, customer_id, customer_snapshot, public_code, status, origem, moeda,
       subtotal, desconto, frete, impostos, total, endereco_entrega, endereco_cobranca, observacao, shipping_method_id, shipping_quote_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'web', $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19)`,
    [orderId, empresaId, storefront.id, storefront.loja_id || null, customerId, '{}', publicCode, status, storefront.moeda || 'BRL', subtotal, discount, shipping, taxes, total,
      JSON.stringify(shippingSelection?.address || input.shippingAddress || null), JSON.stringify(input.billingAddress || null), String(input.note || '').slice(0, 1000) || null, shippingMethodId, shippingSelection?.quote.id || null],
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
  let inventorySelection = null;
  if (physical.length) {
    inventorySelection = await selectInventoryLocation(trx, {
      empresaId,
      storefront,
      lines: physical,
      requestedLocationId: input.locationId ? assertUuid(input.locationId, 'locationId') : null,
    });
    for (const line of physical) {
      if (inventorySelection.backorderVariantIds.includes(line.variantId)) continue;
      await reserveInventory(trx, { empresaId }, {
        locationId: inventorySelection.locationId,
        variantId: line.variantId,
        orderId,
        quantity: line.quantity,
        idempotencyKey: `${idem}:${line.variantId}`,
        expiresAt: new Date(Date.now() + ORDER_RESERVATION_TTL_MINUTES * 60_000).toISOString(),
      });
    }
  }
  if (shippingSelection) {
    await trx.query(`UPDATE commerce_shipping_quotes SET status = 'used', order_id = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [empresaId, shippingSelection.quote.id, orderId]);
  }
  await trx.query(
    `INSERT INTO commerce_order_events
      (empresa_id, order_id, de_status, para_status, origem, usuario_id, correlation_id, payload_resumido)
     VALUES ($1, $2, NULL, $3, 'checkout', $4, $5, $6::jsonb)`,
    [empresaId, orderId, status, context.usuarioId || null, requestId(input.correlationId), JSON.stringify({ lineCount: normalizedLines.length, backorder: physical.some(line => inventorySelection?.backorderVariantIds?.includes(line.variantId)), shipping: shippingSelection ? { quoteId: shippingSelection.quote.id, optionId: shippingSelection.optionId, amount: shippingSelection.amount } : null, identity: { linked: true, resolution: 'customer' } })],
  );
  const result = { id: orderId, publicCode, status, currency: storefront.moeda || 'BRL', subtotal, discount, shipping, taxes, total, customerId, customerAddressId: customerAddressResolution?.address?.id || null, shippingMethodId, shippingQuoteId: shippingSelection?.quote.id || null, shippingOptionId: shippingSelection?.optionId || null, shippingOption: shippingSelection?.option || null };
  await markCartConverted(trx, { ...context, empresaId, lojaId: storefront.loja_id }, { cartSessionKey: input.cartSessionKey, storefrontId: storefront.id, orderId, customerId });
  const finalResult = typeof input.finalizeResponse === 'function' ? await input.finalizeResponse(result) : result;
  if (!finalResult || typeof finalResult !== 'object' || Array.isArray(finalResult)) throw new CommerceError('resposta final do pedido é inválida', 'ORDER_RESPONSE_INVALID');
  await trx.query(
    `UPDATE commerce_idempotency_keys SET response_status = 201, response_body = $3::jsonb
      WHERE empresa_id = $1 AND scope = 'order.create' AND key = $2`,
    [empresaId, idem, JSON.stringify(finalResult)],
  );
  return finalResult;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || `item-${crypto.randomBytes(4).toString('hex')}`;
}

export async function createCategory(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
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

async function resolveProductChannelPriceList(trx, context, productId, storefrontId) {
  const { empresaId } = tenantContext(context);
  const product = assertUuid(productId, 'productId');
  const storefront = assertUuid(storefrontId, 'storefrontId');
  await resolveStorefront(trx, context, storefront);
  const channel = await trx.query(
    `SELECT price_list_id
       FROM commerce_product_channels
      WHERE empresa_id = $1 AND product_id = $2 AND storefront_id = $3
      FOR UPDATE`,
    [empresaId, product, storefront],
  );
  if (!channel.rows[0]) throw new CommerceError('produto fora do escopo do storefront selecionado', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH');
  if (channel.rows[0].price_list_id) return channel.rows[0].price_list_id;
  const priceListId = await ensureDefaultPriceList(trx, empresaId);
  await trx.query(
    `UPDATE commerce_product_channels
        SET price_list_id = $4
      WHERE empresa_id = $1 AND product_id = $2 AND storefront_id = $3`,
    [empresaId, product, storefront, priceListId],
  );
  return priceListId;
}

export async function createCatalogProduct(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const nome = String(input.nome || '').trim();
  if (!nome) throw new CommerceError('nome do produto é obrigatório', 'PRODUCT_REQUIRED');
  const slug = slugify(input.slug || nome);
  const status = ['draft', 'active', 'archived'].includes(input.status) ? input.status : 'draft';
  if (status === 'active' || input.publicado === true) requireVerifiedCapability(context, 'catalog.publish');
  if (['estoque', 'stock', 'targetStock', 'locationId'].some(key => input[key] !== undefined)) requireVerifiedCapability(context, 'inventory.write');
  const categoryId = input.categoryId ? assertUuid(input.categoryId, 'categoryId') : null;
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  if (categoryId) {
    const category = await trx.query('SELECT id FROM commerce_categories WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, categoryId]);
    if (!category.rows[0]) throw new CommerceError('categoria não encontrada no tenant', 'CATEGORY_NOT_FOUND');
  }
  if (storefrontId) {
    const storefront = await resolveStorefront(trx, context, storefrontId);
    if (context.lojaId && context.corporateAccess !== true && storefront.loja_id !== context.lojaId) throw new CommerceError('storefront global ou de outra loja exige autorização corporativa', 'STORE_SCOPE_MISMATCH');
  } else if (context.lojaId && context.corporateAccess !== true) {
    throw new CommerceError('storefrontId é obrigatório para criar produto no escopo da loja', 'STOREFRONT_REQUIRED');
  }
  const productResult = await trx.query(
    `INSERT INTO commerce_products
      (empresa_id, category_id, slug, nome, tipo, status, descricao, descricao_curta, dados_fiscais, seo, criado_por, publicado_em)
     VALUES ($1, $2, $3, $4, $5, $6::varchar, $7, $8, $9::jsonb, $10::jsonb, $11, CASE WHEN $6::varchar = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END)
     RETURNING *`,
    [empresaId, categoryId, slug, nome, input.tipo || 'physical', status, String(input.descricao || '').slice(0, 10000) || null, String(input.descricaoCurta || '').slice(0, 500) || null, JSON.stringify(input.dadosFiscais || {}), JSON.stringify(input.seo || {}), usuarioId],
  );
  const product = productResult.rows[0];
  const variant = input.variant || {};
  const sku = String(variant.sku || input.sku || `${slug}-${crypto.randomBytes(3).toString('hex')}`).slice(0, 100);
  const variantResult = await trx.query(
    `INSERT INTO commerce_product_variants
      (empresa_id, product_id, sku, barcode, nome, atributos, peso_gramas, largura_cm, altura_cm, comprimento_cm, ativo, permite_compra_sem_estoque)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [empresaId, product.id, sku, String(variant.barcode || '').trim() || null, String(variant.nome || '').trim() || null, JSON.stringify(variant.atributos || {}), variant.pesoGramas == null ? null : Math.max(0, Number(variant.pesoGramas) || 0), variant.larguraCm == null ? null : Math.max(0, Number(variant.larguraCm) || 0), variant.alturaCm == null ? null : Math.max(0, Number(variant.alturaCm) || 0), variant.comprimentoCm == null ? null : Math.max(0, Number(variant.comprimentoCm) || 0), variant.ativo !== false, variant.permiteCompraSemEstoque === true],
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
    if (!allowedMediaUrl(input.media.url)) throw new CommerceError('use uma imagem enviada pelo painel ou um endereço https autorizado', 'MEDIA_URL_NOT_ALLOWED');
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

export async function updateCatalogProduct(trx, context, productId, input = {}, options = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(productId, 'productId');
  if (input.status === 'active') requireVerifiedCapability(context, 'catalog.publish');
  await resolveCatalogResourceScope(trx, context, { productId: id, storefrontId: input.storefrontId || options.storefrontId, mutation: true, lock: true });
  const currentResult = await trx.query(
    'SELECT id, status FROM commerce_products WHERE empresa_id = $1 AND id = $2 FOR UPDATE',
    [empresaId, id],
  );
  if (!currentResult.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  if (input.status === 'archived' && options.allowArchive !== true) {
    throw new CommerceError('arquivamento deve usar a operação dedicada', 'PRODUCT_ARCHIVE_REQUIRED');
  }
  if (currentResult.rows[0].status === 'archived') {
    const nonStatusChanges = Object.keys(input).filter(key => !['status', 'storefrontId'].includes(key));
    if (input.status !== 'archived' || nonStatusChanges.length) {
      throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
    }
  }
  const allowed = { nome: 'nome', slug: 'slug', tipo: 'tipo', status: 'status', descricao: 'descricao', descricaoCurta: 'descricao_curta', categoryId: 'category_id', dadosFiscais: 'dados_fiscais', seo: 'seo' };
  const sets = [];
  const values = [empresaId, id];
  for (const [inputKey, column] of Object.entries(allowed)) {
    if (input[inputKey] === undefined) continue;
    let value = input[inputKey];
    if (inputKey === 'categoryId') {
      value = value ? assertUuid(value, 'categoryId') : null;
      if (value) {
        const category = await trx.query('SELECT id FROM commerce_categories WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, value]);
        if (!category.rows[0]) throw new CommerceError('categoria não encontrada no tenant', 'CATEGORY_NOT_FOUND');
      }
    }
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

export async function archiveCatalogProduct(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  requireVerifiedCapability(context, 'catalog.write');
  requireVerifiedCapability(context, 'catalog.publish');
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`catalog-product-state:${empresaId}:${id}`]);
  await resolveCatalogResourceScope(trx, context, { productId: id, storefrontId: input.storefrontId, mutation: true, lock: true });
  await trx.query('SELECT storefront_id FROM commerce_product_channels WHERE empresa_id = $1 AND product_id = $2 ORDER BY storefront_id FOR UPDATE', [empresaId, id]);
  const archived = await updateCatalogProduct(trx, context, productId, { status: 'archived' }, { allowArchive: true, storefrontId: input.storefrontId });
  const channels = await trx.query(
    `UPDATE commerce_product_channels
        SET publicado = false
      WHERE empresa_id = $1 AND product_id = $2 AND publicado = true
      RETURNING storefront_id`,
    [empresaId, archived.id],
  );
  if (channels.rows.length) {
    await trx.query(
      `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
       VALUES ($1, $2, $3, 'product_channel', $4, 'unpublished_on_archive', $5::jsonb)`,
      [empresaId, context.lojaId || null, usuarioId, archived.id, JSON.stringify({ storefrontCount: channels.rows.length })],
    );
  }
  return archived;
}

export async function publishCatalogProduct(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  requireVerifiedCapability(context, 'catalog.write');
  requireVerifiedCapability(context, 'catalog.publish');
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`catalog-product-state:${empresaId}:${id}`]);
  await resolveCatalogResourceScope(trx, context, { productId: id, storefrontId, mutation: true, requireChannel: false, lock: true });
  const product = await trx.query('SELECT id, status FROM commerce_products WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresaId, id]);
  if (!product.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  if (input.publicado !== false && product.rows[0].status === 'archived') throw new CommerceError('produto arquivado não pode ser publicado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const priceListId = input.priceListId ? assertUuid(input.priceListId, 'priceListId') : await ensureDefaultPriceList(trx, empresaId);
  const priceList = await trx.query(
    `SELECT pl.id FROM commerce_price_lists pl
      JOIN commerce_storefronts s ON s.empresa_id = pl.empresa_id AND s.id = $3
     WHERE pl.empresa_id = $1 AND pl.id = $2 AND pl.ativo = true AND pl.canal = 'web' AND pl.moeda = s.moeda
     LIMIT 1`,
    [empresaId, priceListId, storefrontId],
  );
  if (!priceList.rows[0]) throw new CommerceError('lista de preços inativa ou incompatível com o storefront', 'PRICE_LIST_SCOPE_MISMATCH');
  await trx.query('SELECT storefront_id FROM commerce_product_channels WHERE empresa_id = $1 AND product_id = $2 AND storefront_id = $3 FOR UPDATE', [empresaId, id, storefrontId]);
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

export function allowedMediaUrl(value) {
  const url = String(value || '').trim();
  if (/^\/api\/(storefront|commerce)\/media\/[0-9a-f-]{36}$/i.test(url)) return true;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const hosts = String(process.env.COMMERCE_MEDIA_ALLOWED_HOSTS || 'storage.googleapis.com').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  return hosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}

export async function saveCatalogProductWorkspace(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  requireVerifiedCapability(context, 'inventory.write');
  if (input.published === true || input.product?.status === 'active') requireVerifiedCapability(context, 'catalog.publish');
  const idempotencyKey = String(input.idempotencyKey || '').trim().slice(0, 180);
  if (!idempotencyKey) throw new CommerceError('chave de idempotência é obrigatória', 'CATALOG_PRODUCT_IDEMPOTENCY_REQUIRED');

  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  const locationId = assertUuid(input.locationId, 'locationId');
  const productInput = input.product && typeof input.product === 'object' && !Array.isArray(input.product) ? input.product : {};
  const variantInput = input.variant && typeof input.variant === 'object' && !Array.isArray(input.variant) ? input.variant : {};
  const mediaInput = input.media && typeof input.media === 'object' && !Array.isArray(input.media) ? input.media : null;
  const desiredStatus = ['draft', 'active'].includes(productInput.status) ? productInput.status : 'draft';
  const published = input.published === true;
  if (published && desiredStatus !== 'active') throw new CommerceError('somente produto ativo pode ser publicado', 'PRODUCT_STATE_CONFLICT');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new CommerceError('preço de venda inválido', 'INVALID_PRICE');
  const promotionalPrice = input.promotionalPrice == null || input.promotionalPrice === '' ? null : Number(input.promotionalPrice);
  if (promotionalPrice != null && (!Number.isFinite(promotionalPrice) || promotionalPrice < 0 || promotionalPrice >= price)) throw new CommerceError('preço promocional deve ser menor que o preço de venda', 'INVALID_PROMOTIONAL_PRICE');
  const targetStock = Number(input.targetStock);
  if (!Number.isInteger(targetStock) || targetStock < 0) throw new CommerceError('estoque deve ser um inteiro maior ou igual a zero', 'INVALID_QUANTITY');
  // Estoque visto quando o formulário foi aberto. Sem ele, uma venda feita enquanto o
  // formulário estava aberto seria apagada ao salvar (o alvo antigo sobrescreveria o saldo).
  const expectedStock = input.expectedStock == null || input.expectedStock === '' ? null : Number(input.expectedStock);
  if (expectedStock != null && (!Number.isInteger(expectedStock) || expectedStock < 0)) throw new CommerceError('estoque de referência inválido', 'INVALID_QUANTITY');
  // Imagem só de origem controlada: mídia enviada pela própria plataforma ou HTTPS de host permitido.
  if (mediaInput?.url && !allowedMediaUrl(mediaInput.url)) throw new CommerceError('imagem precisa ser enviada pelo upload da loja ou vir de um endereço HTTPS permitido', 'MEDIA_URL_NOT_ALLOWED');

  const normalizedRequest = {
    productId: input.productId ? assertUuid(input.productId, 'productId') : null,
    storefrontId,
    locationId,
    product: { ...productInput, status: desiredStatus },
    variant: variantInput,
    media: mediaInput,
    price,
    promotionalPrice,
    targetStock,
    expectedStock,
    published,
  };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(normalizedRequest)).digest('hex');
  const existing = await trx.query(
    `SELECT request_hash, response_body
       FROM commerce_idempotency_keys
      WHERE empresa_id = $1 AND scope = 'catalog.product.save' AND key = $2
      FOR UPDATE`,
    [empresaId, idempotencyKey],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
    if (existing.rows[0].response_body) return existing.rows[0].response_body;
  } else {
    const inserted = await trx.query(
      `INSERT INTO commerce_idempotency_keys (empresa_id, scope, key, request_hash, expires_at)
       VALUES ($1, 'catalog.product.save', $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
       ON CONFLICT (empresa_id, scope, key) DO NOTHING
       RETURNING key`,
      [empresaId, idempotencyKey, requestHash],
    );
    if (!inserted.rows[0]) {
      const raced = await trx.query(
        `SELECT request_hash, response_body
           FROM commerce_idempotency_keys
          WHERE empresa_id = $1 AND scope = 'catalog.product.save' AND key = $2
          FOR UPDATE`,
        [empresaId, idempotencyKey],
      );
      if (!raced.rows[0] || raced.rows[0].request_hash !== requestHash) throw new CommerceError('chave de idempotência reutilizada com payload diferente', 'IDEMPOTENCY_CONFLICT');
      if (raced.rows[0].response_body) return raced.rows[0].response_body;
    }
  }

  const storefront = await resolveStorefront(trx, context, storefrontId);
  const inventoryLojaId = storefront.loja_id || context.lojaId || null;
  const location = await trx.query(
    `SELECT id
       FROM commerce_inventory_locations
      WHERE empresa_id = $1 AND id = $2 AND ativo = true
        AND ($3::uuid IS NULL OR loja_id = $3 OR loja_id IS NULL)
      LIMIT 1`,
    [empresaId, locationId, inventoryLojaId],
  );
  if (!location.rows[0]) throw new CommerceError('local de estoque fora do escopo da loja', 'INVENTORY_LOCATION_SCOPE_MISMATCH');

  let product;
  let variant;
  if (normalizedRequest.productId) {
    const current = await trx.query(
      `SELECT p.id, p.status, pc.price_list_id, pc.publicado
         FROM commerce_products p
         JOIN commerce_product_channels pc
           ON pc.empresa_id = p.empresa_id
          AND pc.product_id = p.id
          AND pc.storefront_id = $3
        WHERE p.empresa_id = $1 AND p.id = $2
        FOR UPDATE OF p, pc`,
      [empresaId, normalizedRequest.productId, storefrontId],
    );
    if (!current.rows[0]) throw new CommerceError('produto fora do escopo do storefront selecionado', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH');
    if (current.rows[0].status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
    // Tirar da vitrine ou voltar para rascunho é uma decisão de publicação, não de edição.
    const unpublishes = (current.rows[0].status === 'active' && desiredStatus !== 'active') || (current.rows[0].publicado === true && !published);
    if (unpublishes && input.canPublish !== true) throw new CommerceError('só quem pode publicar produtos pode tirá-los da vitrine', 'PERMISSION_DENIED');
    const priceListId = current.rows[0].price_list_id || await ensureDefaultPriceList(trx, empresaId);
    product = await updateCatalogProduct(trx, context, normalizedRequest.productId, normalizedRequest.product, { storefrontId });
    const variantResult = variantInput.id
      ? await trx.query('SELECT * FROM commerce_product_variants WHERE empresa_id = $1 AND id = $2 AND product_id = $3 FOR UPDATE', [empresaId, assertUuid(variantInput.id, 'variantId'), product.id])
      : await trx.query('SELECT * FROM commerce_product_variants WHERE empresa_id = $1 AND product_id = $2 ORDER BY criado_em ASC LIMIT 1 FOR UPDATE', [empresaId, product.id]);
    if (!variantResult.rows[0]) throw new CommerceError('variante principal não encontrada no produto', 'VARIANT_NOT_FOUND');
    variant = await updateCatalogVariant(trx, context, variantResult.rows[0].id, {
      sku: variantInput.sku,
      nome: variantInput.nome,
      barcode: variantInput.barcode,
      atributos: variantInput.atributos,
      pesoGramas: variantInput.pesoGramas,
      larguraCm: variantInput.larguraCm,
      alturaCm: variantInput.alturaCm,
      comprimentoCm: variantInput.comprimentoCm,
      ativo: variantInput.ativo,
      permiteCompraSemEstoque: variantInput.permiteCompraSemEstoque,
      storefrontId,
      preco: price,
      precoPromocional: promotionalPrice,
      priceListId,
    });
    await publishCatalogProduct(trx, context, product.id, { storefrontId, publicado: published, priceListId });
    if (mediaInput?.url) await createCatalogMedia(trx, context, product.id, { ...mediaInput, variantId: variant.id, storefrontId });
  } else {
    product = await createCatalogProduct(trx, context, {
      ...normalizedRequest.product,
      storefrontId,
      publicado: published,
      variant: variantInput,
      media: mediaInput,
      preco: price,
      precoPromocional: promotionalPrice,
    });
    variant = product.variant;
  }

  const level = await trx.query(
    `SELECT disponivel
       FROM commerce_inventory_levels
      WHERE empresa_id = $1 AND location_id = $2 AND variant_id = $3
      FOR UPDATE`,
    [empresaId, locationId, variant.id],
  );
  const currentStock = Number(level.rows[0]?.disponivel || 0);
  if (normalizedRequest.productId && expectedStock == null && targetStock !== currentStock) throw new CommerceError('recarregue o produto antes de alterar o estoque', 'INVENTORY_BASELINE_REQUIRED');
  if (normalizedRequest.productId && expectedStock != null && expectedStock !== currentStock) {
    throw new CommerceError(`o estoque mudou enquanto o formulário estava aberto (agora ${currentStock}); recarregue e confira`, 'INVENTORY_CHANGED', { current: currentStock, expected: expectedStock });
  }
  const delta = targetStock - currentStock;
  const inventory = delta === 0
    ? { empresaId, locationId, variantId: variant.id, disponivel: currentStock, delta: 0 }
    : await adjustInventory(trx, context, {
        locationId,
        variantId: variant.id,
        delta,
        tipo: delta > 0 ? 'entrada' : 'saida',
        observacao: 'Ajuste pelo workspace de produtos',
      });

  const response = {
    productId: product.id,
    variantId: variant.id,
    status: desiredStatus,
    published,
    inventory,
  };
  await trx.query(
    `UPDATE commerce_idempotency_keys
        SET response_status = 200, response_body = $3::jsonb
      WHERE empresa_id = $1 AND scope = 'catalog.product.save' AND key = $2`,
    [empresaId, idempotencyKey, JSON.stringify(response)],
  );
  return response;
}

export async function setVariantPrice(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(productId, 'productId');
  const variantId = assertUuid(input.variantId, 'variantId');
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  const requestedPriceListId = input.priceListId ? assertUuid(input.priceListId, 'priceListId') : null;
  const initialChannel = storefrontId
    ? await trx.query(
        `SELECT pc.price_list_id
           FROM commerce_product_channels pc
           JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id AND s.status = 'active'
          WHERE pc.empresa_id = $1 AND pc.product_id = $2 AND pc.storefront_id = $3`,
        [empresaId, id, storefrontId],
      )
    : { rows: [] };
  if (storefrontId && !initialChannel.rows[0]) throw new CommerceError('produto fora do escopo do storefront selecionado', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH');
  const initialChannelPriceListId = initialChannel.rows[0]?.price_list_id || null;
  const lockPriceListId = requestedPriceListId || initialChannelPriceListId;
  await trx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`variant-price:${empresaId}:${lockPriceListId || `storefront:${storefrontId || 'default'}`}:${variantId}`]);
  await resolveCatalogResourceScope(trx, context, { productId: id, variantId, storefrontId, mutation: true, lock: true });
  const price = Number(input.preco);
  if (!Number.isFinite(price) || price < 0) throw new CommerceError('preço de venda inválido', 'INVALID_PRICE');
  const promotional = input.precoPromocional == null || input.precoPromocional === '' ? null : Number(input.precoPromocional);
  if (promotional != null && (!Number.isFinite(promotional) || promotional < 0 || promotional >= price)) throw new CommerceError('preço promocional deve ser menor que o preço de venda', 'INVALID_PROMOTIONAL_PRICE');
  const variant = await trx.query(
    `SELECT v.id, p.status AS product_status
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
      WHERE v.empresa_id = $1 AND v.id = $2 AND v.product_id = $3
      FOR UPDATE OF v, p`,
    [empresaId, variantId, id],
  );
  if (!variant.rows[0]) throw new CommerceError('variante não encontrada no produto/tenant', 'VARIANT_NOT_FOUND');
  if (variant.rows[0].product_status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const channel = storefrontId
    ? await trx.query(
        `SELECT pc.price_list_id
           FROM commerce_product_channels pc
           JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id AND s.status = 'active'
          WHERE pc.empresa_id = $1 AND pc.product_id = $2 AND pc.storefront_id = $3
          FOR UPDATE OF pc`,
        [empresaId, id, storefrontId],
      )
    : { rows: [] };
  if (storefrontId && !channel.rows[0]) throw new CommerceError('produto fora do escopo do storefront selecionado', 'PRODUCT_STOREFRONT_SCOPE_MISMATCH');
  const channelPriceListId = channel.rows[0]?.price_list_id || null;
  if (channelPriceListId !== initialChannelPriceListId) throw new CommerceError('vínculo da lista de preços mudou durante a atualização', 'PRICE_LIST_CONCURRENT_CHANGE');
  const priceListId = requestedPriceListId
    ? requestedPriceListId
    : channelPriceListId || await ensureDefaultPriceList(trx, empresaId);
  if (channelPriceListId && priceListId !== channelPriceListId) throw new CommerceError('lista de preços não está vinculada ao canal selecionado', 'PRICE_LIST_SCOPE_MISMATCH');
  const priceList = await trx.query(
    `SELECT pl.id
       FROM commerce_price_lists pl
       LEFT JOIN commerce_storefronts s ON s.empresa_id = pl.empresa_id AND s.id = $3
      WHERE pl.empresa_id = $1 AND pl.id = $2 AND pl.ativo = true AND pl.canal = 'web'
        AND ($3::uuid IS NULL OR pl.moeda = s.moeda)
      LIMIT 1`,
    [empresaId, priceListId, storefrontId],
  );
  if (!priceList.rows[0]) throw new CommerceError('lista de preços inativa ou incompatível com o storefront', 'PRICE_LIST_SCOPE_MISMATCH');
  if (storefrontId && !channelPriceListId) {
    await trx.query(
      `UPDATE commerce_product_channels SET price_list_id = $4
        WHERE empresa_id = $1 AND product_id = $2 AND storefront_id = $3`,
      [empresaId, id, storefrontId, priceListId],
    );
  }
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
    [empresaId, context.lojaId || null, usuarioId, variantId, JSON.stringify({ productId: id, storefrontId, priceListId, price, promotional })],
  );
  return result.rows[0];
}

export async function updateCategory(trx, context, categoryId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(categoryId, 'categoryId');
  const currentResult = await trx.query('SELECT * FROM commerce_categories WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresaId, id]);
  if (!currentResult.rows[0]) throw new CommerceError('categoria não encontrada no tenant', 'CATEGORY_NOT_FOUND');
  const current = currentResult.rows[0];
  const allowed = { nome: 'nome', slug: 'slug', descricao: 'descricao', ativo: 'ativo', ordem: 'ordem' };
  const sets = [];
  const values = [empresaId, id];
  for (const [key, column] of Object.entries(allowed)) {
    if (input[key] === undefined) continue;
    let value = input[key];
    if (key === 'nome') value = String(value || '').trim().slice(0, 180);
    if (key === 'slug') value = slugify(value);
    if (key === 'descricao') value = String(value || '').slice(0, 4000) || null;
    if (key === 'ativo' && typeof value !== 'boolean') throw new CommerceError('ativo da categoria deve ser booleano', 'CATEGORY_INVALID');
    if (key === 'ordem') value = Number.isInteger(Number(value)) ? Number(value) : 0;
    if (key === 'nome' && !value) throw new CommerceError('nome da categoria é obrigatório', 'CATEGORY_REQUIRED');
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (input.parentId !== undefined) {
    const parentId = input.parentId ? assertUuid(input.parentId, 'parentId') : null;
    if (parentId === id) throw new CommerceError('categoria não pode ser pai dela mesma', 'CATEGORY_SELF_PARENT');
    if (parentId) {
      const parent = await trx.query('SELECT id FROM commerce_categories WHERE empresa_id = $1 AND id = $2 LIMIT 1', [empresaId, parentId]);
      if (!parent.rows[0]) throw new CommerceError('categoria pai não encontrada no tenant', 'CATEGORY_NOT_FOUND');
    }
    values.push(parentId);
    sets.push(`parent_id = $${values.length}`);
  }
  if (!sets.length) throw new CommerceError('nenhum campo editável informado', 'NO_CHANGES');
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  const result = await trx.query(`UPDATE commerce_categories SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  await trx.query(`INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois) VALUES ($1, $2, $3, 'category', $4, 'updated', $5::jsonb, $6::jsonb)`, [empresaId, context.lojaId || null, usuarioId, id, JSON.stringify({ nome: current.nome, ativo: current.ativo }), JSON.stringify({ fields: Object.keys(input).filter(key => allowed[key] || key === 'parentId') })]);
  return result.rows[0];
}

export async function createCatalogVariant(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(productId, 'productId');
  await resolveCatalogResourceScope(trx, context, { productId: id, storefrontId: input.storefrontId, mutation: true, lock: true });
  const product = await trx.query('SELECT id, nome, status FROM commerce_products WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresaId, id]);
  if (!product.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  if (product.rows[0].status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const sku = String(input.sku || '').trim().slice(0, 100);
  if (!sku) throw new CommerceError('SKU da variante é obrigatório', 'VARIANT_REQUIRED');
  const result = await trx.query(`INSERT INTO commerce_product_variants (empresa_id, product_id, sku, barcode, nome, atributos, peso_gramas, largura_cm, altura_cm, comprimento_cm, ativo, permite_compra_sem_estoque) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12) RETURNING *`, [empresaId, id, sku, String(input.barcode || '').trim() || null, String(input.nome || '').trim() || null, JSON.stringify(input.atributos && typeof input.atributos === 'object' ? input.atributos : {}), input.pesoGramas == null ? null : Math.max(0, Number(input.pesoGramas) || 0), input.larguraCm == null ? null : Math.max(0, Number(input.larguraCm) || 0), input.alturaCm == null ? null : Math.max(0, Number(input.alturaCm) || 0), input.comprimentoCm == null ? null : Math.max(0, Number(input.comprimentoCm) || 0), input.ativo !== false, input.permiteCompraSemEstoque === true]);
  const variant = result.rows[0];
  if (input.preco !== undefined) {
    const priceListId = input.storefrontId
      ? await resolveProductChannelPriceList(trx, context, id, input.storefrontId)
      : input.priceListId;
    await setVariantPrice(trx, context, id, { ...input, variantId: variant.id, priceListId, storefrontId: input.storefrontId });
  }
  if (input.media?.url) {
    if (!allowedMediaUrl(input.media.url)) throw new CommerceError('use uma imagem enviada pelo painel ou um endereço https autorizado', 'MEDIA_URL_NOT_ALLOWED');
    await createCatalogMedia(trx, context, id, { ...input.media, variantId: variant.id, storefrontId: input.storefrontId });
  }
  await trx.query(`INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois) VALUES ($1, $2, $3, 'variant', $4, 'created', $5::jsonb)`, [empresaId, context.lojaId || null, usuarioId, variant.id, JSON.stringify({ productId: id, sku })]);
  return variant;
}

export async function updateCatalogVariant(trx, context, variantId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(variantId, 'variantId');
  await resolveCatalogResourceScope(trx, context, { variantId: id, storefrontId: input.storefrontId, mutation: true, lock: true });
  const currentResult = await trx.query(
    `SELECT v.*, p.status AS product_status
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
      WHERE v.empresa_id = $1 AND v.id = $2
      FOR UPDATE OF v, p`,
    [empresaId, id],
  );
  if (!currentResult.rows[0]) throw new CommerceError('variante não encontrada no tenant', 'VARIANT_NOT_FOUND');
  const current = currentResult.rows[0];
  if (current.product_status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const allowed = { sku: 'sku', barcode: 'barcode', nome: 'nome', pesoGramas: 'peso_gramas', larguraCm: 'largura_cm', alturaCm: 'altura_cm', comprimentoCm: 'comprimento_cm', ativo: 'ativo', permiteCompraSemEstoque: 'permite_compra_sem_estoque' };
  const sets = [];
  const values = [empresaId, id];
  for (const [key, column] of Object.entries(allowed)) {
    if (input[key] === undefined) continue;
    let value = input[key];
    if (['sku', 'barcode', 'nome'].includes(key)) value = String(value || '').trim().slice(0, key === 'sku' ? 100 : key === 'barcode' ? 80 : 200) || null;
    if (['pesoGramas', 'larguraCm', 'alturaCm', 'comprimentoCm'].includes(key)) value = value == null || value === '' ? null : Math.max(0, Number(value) || 0);
    if (['ativo', 'permiteCompraSemEstoque'].includes(key) && typeof value !== 'boolean') throw new CommerceError(`${key === 'ativo' ? 'ativo' : 'permiteCompraSemEstoque'} da variante deve ser booleano`, 'VARIANT_INVALID');
    if (key === 'sku' && !value) throw new CommerceError('SKU da variante é obrigatório', 'VARIANT_REQUIRED');
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (input.atributos !== undefined) { values.push(JSON.stringify(input.atributos && typeof input.atributos === 'object' ? input.atributos : {})); sets.push(`atributos = $${values.length}::jsonb`); }
  if (!sets.length && input.preco === undefined) throw new CommerceError('nenhum campo editável informado', 'NO_CHANGES');
  if (sets.length) {
    sets.push('atualizado_em = CURRENT_TIMESTAMP');
    await trx.query(`UPDATE commerce_product_variants SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2`, values);
  }
  if (input.preco !== undefined) {
    const priceListId = input.storefrontId
      ? await resolveProductChannelPriceList(trx, context, current.product_id, input.storefrontId)
      : input.priceListId;
    await setVariantPrice(trx, context, current.product_id, { ...input, variantId: id, priceListId, storefrontId: input.storefrontId });
  }
  await trx.query(`INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois) VALUES ($1, $2, $3, 'variant', $4, 'updated', $5::jsonb)`, [empresaId, context.lojaId || null, usuarioId, id, JSON.stringify({ productId: current.product_id, fields: Object.keys(input) })]);
  const result = await trx.query('SELECT * FROM commerce_product_variants WHERE empresa_id = $1 AND id = $2', [empresaId, id]);
  return result.rows[0];
}

export async function archiveCatalogVariant(trx, context, variantId, input = {}) {
  requireVerifiedCapability(context, 'catalog.write');
  return updateCatalogVariant(trx, context, variantId, { ativo: false, storefrontId: input.storefrontId });
}

export async function createCatalogMedia(trx, context, productId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(productId, 'productId');
  await resolveCatalogResourceScope(trx, context, { productId: id, storefrontId: input.storefrontId, mutation: true, lock: true });
  const product = await trx.query('SELECT id, status FROM commerce_products WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresaId, id]);
  if (!product.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
  if (product.rows[0].status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const url = String(input.url || input.publicUrl || '').trim().slice(0, 1000);
  if (!url) throw new CommerceError('URL da mídia é obrigatória', 'MEDIA_REQUIRED');
  const variantId = input.variantId ? assertUuid(input.variantId, 'variantId') : null;
  if (variantId) {
    const variant = await trx.query('SELECT id FROM commerce_product_variants WHERE empresa_id = $1 AND id = $2 AND product_id = $3 LIMIT 1', [empresaId, variantId, id]);
    if (!variant.rows[0]) throw new CommerceError('variante não pertence ao produto', 'VARIANT_NOT_FOUND');
  }
  const mediaId = input.mediaId ? assertUuid(input.mediaId, 'mediaId') : null;
  const storageKey = String(input.storageKey || url).slice(0, 500);
  const mimeType = String(input.mimeType || 'image/*').slice(0, 120);
  const altText = String(input.altText || '').slice(0, 255) || null;
  const ordem = Number.isInteger(Number(input.ordem)) ? Number(input.ordem) : 0;
  const result = mediaId
    ? await trx.query(`INSERT INTO commerce_product_media (id, empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [mediaId, empresaId, id, variantId, storageKey, url, mimeType, altText, ordem])
    : await trx.query(`INSERT INTO commerce_product_media (empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [empresaId, id, variantId, storageKey, url, mimeType, altText, ordem]);
  await trx.query(`INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois) VALUES ($1, $2, $3, 'product_media', $4, 'created', $5::jsonb)`, [empresaId, context.lojaId || null, usuarioId, result.rows[0].id, JSON.stringify({ productId: id, variantId })]);
  return result.rows[0];
}

export async function listCatalogMedia(client, context, productId, input = {}) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(productId, 'productId');
  await resolveCatalogResourceScope(client, context, { productId: id, storefrontId: input.storefrontId });
  const result = await client.query('SELECT id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem, criado_em FROM commerce_product_media WHERE empresa_id = $1 AND product_id = $2 ORDER BY ordem ASC, criado_em ASC', [empresaId, id]);
  return { items: result.rows };
}

export async function deleteCatalogMedia(trx, context, mediaId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  requireVerifiedCapability(context, 'catalog.write');
  const id = assertUuid(mediaId, 'mediaId');
  const scope = await resolveCatalogResourceScope(trx, context, { mediaId: id, storefrontId: input.storefrontId, mutation: true, lock: true });
  const current = await trx.query(
    `SELECT m.id, m.product_id, p.status AS product_status
       FROM commerce_product_media m
       JOIN commerce_products p ON p.empresa_id = m.empresa_id AND p.id = m.product_id
      WHERE m.empresa_id = $1 AND m.id = $2
      FOR UPDATE OF m, p`,
    [empresaId, id],
  );
  if (!current.rows[0]) throw new CommerceError('mídia não encontrada no tenant', 'MEDIA_NOT_FOUND');
  if (current.rows[0].product_status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
  const result = await trx.query('DELETE FROM commerce_product_media WHERE empresa_id = $1 AND id = $2 RETURNING id, product_id, storage_key', [empresaId, id]);
  await trx.query(`INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois) VALUES ($1, $2, $3, 'product_media', $4, 'deleted', $5::jsonb)`, [empresaId, context.lojaId || null, usuarioId, id, JSON.stringify({ productId: result.rows[0].product_id })]);
  return { ...result.rows[0], storage_key: scope.media.storage_key };
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

function normalizeExternalShippingMethodConfig(input, provider, shippingAccountId) {
  const normalized = { provider, shippingAccountId };
  const originCep = String(input.origemCep || input.originPostalCode || '').replace(/\D/g, '');
  if (originCep) {
    if (originCep.length !== 8) throw new CommerceError('CEP de origem do método deve ter 8 dígitos', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'origemCep' });
    normalized.origemCep = originCep;
  }
  const rawServices = Array.isArray(input.services) ? input.services : String(input.services || '').split(',');
  const services = [...new Set(rawServices.map(value => String(value || '').trim()).filter(Boolean))];
  if (services.length > 40 || services.some(value => !/^[A-Za-z0-9_-]{1,32}$/.test(value))) throw new CommerceError('serviços logísticos inválidos', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'services' });
  if (services.length) normalized.services = services;
  if (input.options !== undefined) {
    if (!input.options || Array.isArray(input.options) || typeof input.options !== 'object') throw new CommerceError('opções logísticas devem ser um objeto', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'options' });
    const options = {};
    for (const field of ['receipt', 'ownHand']) {
      if (input.options[field] !== undefined && typeof input.options[field] !== 'boolean') throw new CommerceError(`opção ${field} deve ser booleana`, 'SHIPPING_METHOD_CONFIG_INVALID', { field: `options.${field}` });
      if (input.options[field] !== undefined) options[field] = input.options[field];
    }
    if (Object.keys(options).length) normalized.options = options;
  }
  return normalized;
}

async function validateShippingMethodConfiguration(trx, empresaId, storefrontId, tipo, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new CommerceError('configuração do método deve ser um objeto', 'SHIPPING_METHOD_CONFIG_INVALID');
  if (!['delivery', 'carrier'].includes(tipo)) return {};
  const provider = String(input.provider || '').trim().toLowerCase();
  if (!provider) throw new CommerceError('provedor do método de entrega é obrigatório', 'SHIPPING_PROVIDER_UNSUPPORTED');
  if (provider === 'manual') return normalizeOwnDeliveryConfig(input);
  if (!['melhorenvio', 'correios'].includes(provider)) throw new CommerceError('provedor logístico não suportado', 'SHIPPING_PROVIDER_UNSUPPORTED', { provider });
  const accountId = assertUuid(input.shippingAccountId || input.accountId, 'shippingAccountId');
  const account = await trx.query(`SELECT id, provider FROM commerce_shipping_accounts WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND provider = $4 AND ativo = true LIMIT 1`, [empresaId, accountId, storefrontId, provider]);
  if (!account.rows[0]) throw new CommerceError('conta logística ativa não pertence ao storefront ou provedor do método', 'SHIPPING_ACCOUNT_SCOPE_MISMATCH');
  return normalizeExternalShippingMethodConfig(input, provider, accountId);
}

export async function createShippingMethod(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  await resolveStorefront(trx, context, storefrontId);
  const codigo = String(input.codigo || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80);
  const nome = String(input.nome || '').trim().slice(0, 160);
  const tipo = String(input.tipo || '').trim();
  if (!codigo || !nome || !['pickup', 'delivery', 'carrier', 'digital', 'service'].includes(tipo)) throw new CommerceError('código, nome e tipo de entrega válidos são obrigatórios', 'SHIPPING_METHOD_INVALID');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') throw new CommerceError('ativo do método deve ser booleano', 'SHIPPING_METHOD_INVALID');
  const configuracao = await validateShippingMethodConfiguration(trx, empresaId, storefrontId, tipo, input.configuracao || {});
  const result = await trx.query(
    `INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
    [empresaId, storefrontId, codigo, nome, tipo, input.ativo !== false, JSON.stringify(configuracao)],
  );
  return result.rows[0];
}

export async function updateShippingMethod(trx, context, methodId, input = {}) {
  const { empresaId, lojaId } = tenantContext(context);
  const id = assertUuid(methodId, 'shippingMethodId');
  const currentResult = await trx.query(`SELECT sm.* FROM commerce_shipping_methods sm JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id WHERE sm.empresa_id = $1 AND sm.id = $2 AND ($3::uuid IS NULL OR s.loja_id = $3) FOR UPDATE`, [empresaId, id, lojaId || null]);
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('método de entrega não encontrado no escopo da loja', 'SHIPPING_METHOD_NOT_FOUND');
  const values = [empresaId, id];
  const sets = [];
  if (input.codigo !== undefined) {
    const codigo = String(input.codigo || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80);
    if (!codigo) throw new CommerceError('código de entrega inválido', 'SHIPPING_METHOD_INVALID');
    values.push(codigo); sets.push(`codigo = $${values.length}`);
  }
  if (input.nome !== undefined) {
    const nome = String(input.nome || '').trim().slice(0, 160);
    if (!nome) throw new CommerceError('nome de entrega inválido', 'SHIPPING_METHOD_INVALID');
    values.push(nome); sets.push(`nome = $${values.length}`);
  }
  if (input.tipo !== undefined) {
    const tipo = String(input.tipo || '').trim();
    if (!['pickup', 'delivery', 'carrier', 'digital', 'service'].includes(tipo)) throw new CommerceError('tipo de entrega inválido', 'SHIPPING_METHOD_INVALID');
    values.push(tipo); sets.push(`tipo = $${values.length}`);
  }
  if (input.ativo !== undefined) {
    if (typeof input.ativo !== 'boolean') throw new CommerceError('ativo do método deve ser booleano', 'SHIPPING_METHOD_INVALID');
    values.push(input.ativo); sets.push(`ativo = $${values.length}`);
  }
  if (input.configuracao !== undefined) {
    const nextType = input.tipo === undefined ? current.tipo : String(input.tipo);
    const config = await validateShippingMethodConfiguration(trx, empresaId, current.storefront_id, nextType, input.configuracao);
    values.push(JSON.stringify(config)); sets.push(`configuracao = $${values.length}::jsonb`);
  }
  if (!sets.length) throw new CommerceError('nenhuma alteração informada', 'NO_CHANGES');
  const result = await trx.query(`UPDATE commerce_shipping_methods SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2 RETURNING *`, values);
  return result.rows[0];
}

export async function createFulfillment(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const orderId = assertUuid(input.orderId, 'orderId');
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  const order = await trx.query(`SELECT o.id, o.storefront_id, o.loja_id, o.status, o.total, o.frete, o.endereco_entrega, o.shipping_method_id, o.shipping_quote_id, s.codigo AS storefront_code, s.loja_id AS storefront_loja_id FROM commerce_orders o JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id WHERE o.empresa_id = $1 AND o.id = $2 AND ($3::uuid IS NULL OR o.storefront_id = $3) AND ($4::uuid IS NULL OR o.loja_id = $4) FOR UPDATE OF o`, [empresaId, orderId, storefrontId, context.corporateAccess === true ? null : context.lojaId || null]);
  if (!order.rows[0]) throw new CommerceError('pedido não encontrado no tenant', 'ORDER_NOT_FOUND');
  if (!['paid', 'processing', 'ready', 'shipped', 'ready_for_pickup'].includes(order.rows[0].status)) throw new CommerceError('fulfillment só pode ser criado após pagamento confirmado', 'FULFILLMENT_ORDER_NOT_PAID');
  const dino = order.rows[0].storefront_code === 'dino-web';
  if (dino && order.rows[0].loja_id !== order.rows[0].storefront_loja_id) throw new CommerceError('loja do pedido Dino não corresponde à vitrine', 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
  if (dino && (input.enderecoEntrega !== undefined || input.shippingAccountId !== undefined
    || (input.shippingMethodId !== undefined && String(input.shippingMethodId).toLowerCase() !== String(order.rows[0].shipping_method_id || '').toLowerCase())
    || (input.shippingQuoteId !== undefined && String(input.shippingQuoteId).toLowerCase() !== String(order.rows[0].shipping_quote_id || '').toLowerCase())
    || !order.rows[0].shipping_method_id)) {
    throw new CommerceError('fulfillment Dino deve herdar destino e seleção logística do pedido', 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
  }
  if (dino) {
    const existing = await trx.query(`SELECT id FROM commerce_fulfillments WHERE empresa_id = $1 AND order_id = $2 LIMIT 1`, [empresaId, orderId]);
    if (existing.rows[0]) throw new CommerceError('pedido Dino já possui fulfillment', 'FULFILLMENT_ALREADY_EXISTS');
    const captured = await trx.query(`SELECT id FROM commerce_payments WHERE empresa_id = $1 AND order_id = $2 AND status = 'captured' AND captured_at IS NOT NULL AND amount = $3 LIMIT 1`, [empresaId, orderId, order.rows[0].total]);
    if (!captured.rows[0]) throw new CommerceError('pedido Dino sem pagamento capturado confirmado', 'FULFILLMENT_PAYMENT_NOT_CAPTURED');
  }
  const shippingMethodId = input.shippingMethodId ? assertUuid(input.shippingMethodId, 'shippingMethodId') : order.rows[0].shipping_method_id || null;
  const shippingQuoteId = input.shippingQuoteId ? assertUuid(input.shippingQuoteId, 'shippingQuoteId') : order.rows[0].shipping_quote_id || null;
  let shippingAccountId = input.shippingAccountId ? assertUuid(input.shippingAccountId, 'shippingAccountId') : null;
  let shippingMethodType = null;
  let selectedMethod = null;
  if (shippingMethodId) {
    const method = await trx.query(`SELECT id, tipo, codigo, configuracao FROM commerce_shipping_methods WHERE empresa_id = $1 AND storefront_id = $2 AND id = $3 AND ativo = true LIMIT 1 FOR SHARE`, [empresaId, order.rows[0].storefront_id, shippingMethodId]);
    if (!method.rows[0]) throw new CommerceError('método de entrega não encontrado para a loja', 'SHIPPING_METHOD_NOT_FOUND');
    selectedMethod = method.rows[0];
    shippingMethodType = selectedMethod.tipo;
  }
  if (dino && shippingMethodType !== 'pickup' && shippingMethodType !== 'delivery') throw new CommerceError('método Dino sem operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  if (dino && shippingMethodType === 'pickup' && shippingQuoteId) throw new CommerceError('retirada Dino não aceita cotação de entrega', 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
  if (['delivery', 'carrier'].includes(shippingMethodType) && !shippingQuoteId) throw new CommerceError('fulfillment de entrega exige cotação selecionada', 'SHIPPING_QUOTE_REQUIRED');
  if (shippingQuoteId) {
    const quote = await trx.query(`SELECT id, storefront_id, order_id, shipping_method_id, shipping_account_id, provider, destino_cep, status, selected_option_id, selected_amount FROM commerce_shipping_quotes WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND order_id = $4 LIMIT 1 FOR SHARE`, [empresaId, shippingQuoteId, order.rows[0].storefront_id, orderId]);
    if (!quote.rows[0] || (shippingMethodId && quote.rows[0].shipping_method_id !== shippingMethodId)) throw new CommerceError('cotação não pertence ao método ou pedido informado', 'SHIPPING_QUOTE_MISMATCH');
    if (dino) {
      const destinationCep = normalizeCep(order.rows[0].endereco_entrega?.cep);
      const selectedAmount = Number(quote.rows[0].selected_amount);
      if (quote.rows[0].provider !== 'manual' || quote.rows[0].shipping_account_id != null || quote.rows[0].destino_cep !== destinationCep
        || quote.rows[0].status !== 'used' || !quote.rows[0].selected_option_id
        || quote.rows[0].selected_amount == null || !Number.isFinite(selectedAmount)
        || Math.abs(selectedAmount - Number(order.rows[0].frete)) > 0.001
        || !isDinoLocalManualMethod({ ...selectedMethod, storefront_code: 'dino-web' }, destinationCep)) {
        throw new CommerceError('entrega Dino fora da operação local habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
      }
    }
    shippingAccountId = shippingAccountId || quote.rows[0].shipping_account_id;
  }
  if (shippingAccountId) {
    const account = await trx.query(`SELECT id FROM commerce_shipping_accounts WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 LIMIT 1`, [empresaId, shippingAccountId, order.rows[0].storefront_id]);
    if (!account.rows[0]) throw new CommerceError('conta logística não pertence ao storefront do pedido', 'SHIPPING_ACCOUNT_SCOPE_MISMATCH');
  }
  const result = await trx.query(
    `INSERT INTO commerce_fulfillments (empresa_id, order_id, shipping_method_id, shipping_quote_id, shipping_account_id, status, endereco_entrega)
     VALUES ($1, $2, $3, $4, $5, 'pending', COALESCE($6::jsonb, $7::jsonb)) RETURNING *`,
    [empresaId, orderId, shippingMethodId, shippingQuoteId, shippingAccountId, input.enderecoEntrega ? JSON.stringify(input.enderecoEntrega) : null, JSON.stringify(order.rows[0].endereco_entrega || null)],
  );
  return result.rows[0];
}

export async function updateFulfillment(trx, context, fulfillmentId, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const id = assertUuid(fulfillmentId, 'fulfillmentId');
  const storefrontId = input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
  const locked = await trx.query(`SELECT f.id, f.order_id, f.status, f.ocorrencias, f.endereco_entrega AS fulfillment_address, f.shipping_method_id, f.shipping_quote_id, f.shipping_account_id,
      o.status AS order_status, o.total AS order_total, o.frete AS order_shipping, o.endereco_entrega AS order_address,
      o.shipping_method_id AS order_method_id, o.shipping_quote_id AS order_quote_id, o.storefront_id, o.loja_id,
      s.codigo AS storefront_code, s.loja_id AS storefront_loja_id
    FROM commerce_fulfillments f JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
    WHERE f.empresa_id = $1 AND f.id = $2 AND ($3::uuid IS NULL OR o.storefront_id = $3) AND ($4::uuid IS NULL OR o.loja_id = $4) FOR UPDATE OF f, o`, [empresaId, id, storefrontId, context.corporateAccess === true ? null : context.lojaId || null]);
  const current = locked.rows[0];
  if (!current) throw new CommerceError('fulfillment não encontrado no tenant', 'FULFILLMENT_NOT_FOUND');
  if (current.storefront_code === 'dino-web') {
    if (input.providerShipmentId || input.labelUrl || input.trackingUrl) throw new CommerceError('Dino não possui transportadora habilitada para este fulfillment', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
    if (current.loja_id !== current.storefront_loja_id
      || current.shipping_method_id !== current.order_method_id || current.shipping_quote_id !== current.order_quote_id
      || current.shipping_account_id != null || canonicalJson(current.fulfillment_address) !== canonicalJson(current.order_address)) {
      throw new CommerceError('fulfillment Dino diverge do pedido original', 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
    }
    if (!['paid', 'processing', 'ready', 'shipped', 'ready_for_pickup'].includes(current.order_status)) throw new CommerceError('pedido Dino não está pago', 'FULFILLMENT_ORDER_NOT_PAID');
    const captured = await trx.query(`SELECT id FROM commerce_payments WHERE empresa_id = $1 AND order_id = $2 AND status = 'captured' AND captured_at IS NOT NULL AND amount = $3 LIMIT 1`, [empresaId, current.order_id, current.order_total]);
    if (!captured.rows[0]) throw new CommerceError('pedido Dino sem pagamento capturado confirmado', 'FULFILLMENT_PAYMENT_NOT_CAPTURED');
    const method = await trx.query(`SELECT tipo, codigo, configuracao FROM commerce_shipping_methods WHERE empresa_id = $1 AND storefront_id = $2 AND id = $3 AND ativo = true LIMIT 1 FOR SHARE`, [empresaId, current.storefront_id, current.shipping_method_id]);
    if (!method.rows[0]) throw new CommerceError('método Dino não está ativo', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
    if (method.rows[0].tipo === 'pickup') {
      if (current.shipping_quote_id) throw new CommerceError('retirada Dino com cotação divergente', 'FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED');
    } else {
      const destinationCep = normalizeCep(current.order_address?.cep);
      if (method.rows[0].tipo !== 'delivery' || !isDinoLocalManualMethod({ ...method.rows[0], storefront_code: 'dino-web' }, destinationCep)) throw new CommerceError('entrega Dino fora da operação local habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
      const quote = await trx.query(`SELECT provider, destino_cep, status, selected_option_id, selected_amount, shipping_account_id FROM commerce_shipping_quotes WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND order_id = $4 AND shipping_method_id = $5 LIMIT 1 FOR SHARE`, [empresaId, current.shipping_quote_id, current.storefront_id, current.order_id, current.shipping_method_id]);
      const selected = quote.rows[0];
      if (!selected || selected.provider !== 'manual' || selected.shipping_account_id != null || selected.destino_cep !== destinationCep || selected.status !== 'used'
        || !selected.selected_option_id || selected.selected_amount == null || !Number.isFinite(Number(selected.selected_amount))
        || Math.abs(Number(selected.selected_amount) - Number(current.order_shipping)) > 0.001) throw new CommerceError('cotação local Dino não corresponde ao pedido', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
    }
  }
  const nextStatus = String(input.status || current.status);
  if (nextStatus !== current.status && !FULFILLMENT_TRANSITIONS[current.status]?.includes(nextStatus)) throw new CommerceError(`transição de entrega ${current.status} → ${nextStatus} não permitida`, 'INVALID_FULFILLMENT_TRANSITION');
  const occurrence = input.ocorrencia ? { at: new Date().toISOString(), status: nextStatus, description: String(input.ocorrencia).slice(0, 500) } : null;
  const occurrences = occurrence ? [...(Array.isArray(current.ocorrencias) ? current.ocorrencias : []), occurrence].slice(-100) : current.ocorrencias || [];
  const result = await trx.query(
    `UPDATE commerce_fulfillments SET status = $3, tracking_code = COALESCE($4, tracking_code), carrier = COALESCE($5, carrier), provider_shipment_id = COALESCE($7, provider_shipment_id), tracking_url = COALESCE($8, tracking_url), label_url = COALESCE($9, label_url), ocorrencias = $6::jsonb,
       enviado_em = CASE WHEN $3 = 'shipped' AND enviado_em IS NULL THEN CURRENT_TIMESTAMP ELSE enviado_em END,
       entregue_em = CASE WHEN $3 IN ('delivered','picked_up') AND entregue_em IS NULL THEN CURRENT_TIMESTAMP ELSE entregue_em END,
       atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [empresaId, id, nextStatus, input.trackingCode ? String(input.trackingCode).slice(0, 160) : null, input.carrier ? String(input.carrier).slice(0, 120) : null, JSON.stringify(occurrences), input.providerShipmentId ? String(input.providerShipmentId).slice(0, 180) : null, input.trackingUrl ? String(input.trackingUrl).slice(0, 600) : null, input.labelUrl ? String(input.labelUrl).slice(0, 600) : null],
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
  requireVerifiedCapability(context, 'inventory.write');
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
  requireVerifiedCapability(context, 'inventory.write');
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


// Pagamento capturado num pedido já cancelado: não reabre o pedido nem mexe no estoque,
// mas deixa rastro para a equipe estornar.
export async function flagPaymentAfterCancellation(trx, context, { orderId, provider, eventKey }) {
  const { empresaId } = tenantContext(context);
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id)
     SELECT o.empresa_id, o.loja_id, NULL, 'order', o.id, 'payment_after_cancel', jsonb_build_object('status', o.status),
            jsonb_build_object('provider', $3::text, 'acao_necessaria', 'estornar_pagamento'), $4
       FROM commerce_orders o WHERE o.empresa_id = $1 AND o.id = $2`,
    [empresaId, assertUuid(orderId, 'orderId'), String(provider || '').slice(0, 40), requestId(eventKey)],
  );
}
