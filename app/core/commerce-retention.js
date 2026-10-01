import { db } from './database.js';
import { assertUuid, transitionOrder } from './commerce-core.js';
import { expireLoyaltyPoints } from './loyalty-advanced.js';

export async function purgeExpiredCommercePublicData(database = db) {
  const satisfaction = await database.query(
    `DELETE FROM commerce_order_satisfaction
      WHERE retencao_ate <= CURRENT_TIMESTAMP`,
  );
  const rateLimits = await database.query(
    `DELETE FROM commerce_public_rate_limits WHERE expires_at <= CURRENT_TIMESTAMP - INTERVAL '1 day'`,
  );
  return { satisfactionDeleted: satisfaction.rowCount || 0, rateLimitsDeleted: rateLimits.rowCount || 0 };
}

export function startCommerceRetentionCleanup({ intervalMs = 6 * 60 * 60 * 1000, logger = console } = {}) {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    try {
      const result = await purgeExpiredCommercePublicData();
      if (result.satisfactionDeleted || result.rateLimitsDeleted) logger.info?.('Retenção Commerce concluída.', result);
    } catch (error) {
      logger.error?.('Falha na retenção Commerce:', error?.code || error?.message || 'UNKNOWN');
    }
  };
  const timer = setInterval(run, Math.max(60_000, intervalMs));
  timer.unref?.();
  return () => { stopped = true; clearInterval(timer); };
}

// Pontos de fidelidade vencidos: roda a cada 6 horas.
export function startLoyaltyExpiry({ intervalMs = 6 * 60 * 60 * 1000, logger = console } = {}) {
  const run = async () => {
    try {
      const result = await expireLoyaltyPoints(db);
      if (result.expiredPoints) logger.info?.('Pontos de fidelidade expirados.', result);
    } catch (error) {
      logger.error?.('Falha ao expirar pontos de fidelidade:', error?.code || error?.message || 'UNKNOWN');
    }
  };
  const timer = setInterval(run, Math.max(60_000, intervalMs));
  timer.unref?.();
  return () => clearInterval(timer);
}

// Pedido que falhou ao expirar fica de fora por 1 hora (nesta instância) para não ocupar,
// ciclo após ciclo, o lugar dos que podem ser expirados.
const failingExpiryOrders = new Map();
const EXPIRY_RETRY_MS = 60 * 60 * 1000;

export async function expireCommerceReservations(database = db, { limit = 100, empresaId = null } = {}) {
  const nowMs = Date.now();
  for (const [id, until] of failingExpiryOrders) if (until <= nowMs) failingExpiryOrders.delete(id);
  const skipIds = [...failingExpiryOrders.keys()].slice(0, 1000);
  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  const tenantId = empresaId ? assertUuid(empresaId, 'empresaId') : null;
  return database.transaction(async trx => {
    const lease = await trx.query(`SELECT pg_try_advisory_xact_lock(hashtext('commerce-reservation-expiry')) AS acquired`);
    if (lease.rows[0]?.acquired !== true) return { expiredOrders: 0, leaseAcquired: false };
    const orders = await trx.query(
      `SELECT o.empresa_id, o.id, o.status
         FROM commerce_orders o
        WHERE o.status IN ('draft','pending_payment','payment_failed','fraud_review')
          AND ($2::uuid IS NULL OR o.empresa_id = $2)
          AND NOT (o.id = ANY($3::uuid[]))
          AND NOT EXISTS (
            SELECT 1 FROM commerce_payments p
             WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id
               AND p.status IN ('authorized','captured')
          )
          AND EXISTS (
            SELECT 1 FROM commerce_inventory_reservations r
             WHERE r.empresa_id = o.empresa_id AND r.order_id = o.id
               AND r.status = 'pending' AND r.expira_em <= CURRENT_TIMESTAMP
          )
        ORDER BY o.criado_em ASC, o.id ASC
        FOR UPDATE OF o SKIP LOCKED
        LIMIT $1`,
      [safeLimit, tenantId, skipIds],
    );
    // Um pedido com problema não pode travar a expiração de todos os outros: cada um
    // roda num savepoint próprio e, se falhar, é pulado e registrado.
    let expired = 0;
    const failed = [];
    for (const order of orders.rows) {
      await trx.query('SAVEPOINT reservation_expiry_order');
      try {
        await transitionOrder(trx, { empresaId: order.empresa_id }, {
          orderId: order.id,
          status: 'cancelled',
          origin: 'reservation_expiry',
          correlationId: `reservation-expiry:${order.id}`,
          payload: { reason: 'reservation_ttl_elapsed' },
        });
        await trx.query('RELEASE SAVEPOINT reservation_expiry_order');
        failingExpiryOrders.delete(order.id);
        expired += 1;
      } catch (error) {
        await trx.query('ROLLBACK TO SAVEPOINT reservation_expiry_order');
        failed.push({ orderId: order.id, code: error?.code || 'UNKNOWN' });
        failingExpiryOrders.set(order.id, Date.now() + EXPIRY_RETRY_MS);
      }
    }
    return { expiredOrders: expired, failedOrders: failed, leaseAcquired: true };
  });
}

export function startCommerceReservationExpiryCleanup({ intervalMs = 60_000, logger = console } = {}) {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    try {
      const result = await expireCommerceReservations();
      if (result.expiredOrders) logger.info?.('Reservas Commerce expiradas.', { expiredOrders: result.expiredOrders });
      if (result.failedOrders?.length) logger.error?.('Falha ao expirar reservas de alguns pedidos:', result.failedOrders.slice(0, 10));
    } catch (error) {
      logger.error?.('Falha ao expirar reservas Commerce:', error?.code || error?.message || 'UNKNOWN');
    }
  };
  void run();
  const timer = setInterval(run, Math.max(30_000, intervalMs));
  timer.unref?.();
  return () => { stopped = true; clearInterval(timer); };
}
