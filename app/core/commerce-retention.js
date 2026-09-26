import { db } from './database.js';

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
