import crypto from 'node:crypto';
import { CommerceError } from './commerce-core.js';

const ELIGIBLE_ORDER_STATUSES = new Set(['delivered', 'picked_up', 'completed']);
const ELIGIBLE_FULFILLMENT_STATUSES = new Set(['delivered', 'picked_up']);

function normalizedInput(input = {}) {
  const rating = Number.parseInt(String(input.rating ?? ''), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new CommerceError('Selecione uma nota de 1 a 5.', 'SATISFACTION_RATING_INVALID');
  }
  if (typeof input.wouldRecommend !== 'boolean') {
    throw new CommerceError('Informe se recomendaria a experiência.', 'SATISFACTION_RECOMMENDATION_REQUIRED');
  }
  const idempotencyKey = String(input.idempotencyKey || '').trim().slice(0, 160);
  if (idempotencyKey.length < 24) {
    throw new CommerceError('Chave idempotente da pesquisa ausente ou inválida.', 'SATISFACTION_IDEMPOTENCY_REQUIRED');
  }
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ rating, wouldRecommend: input.wouldRecommend })).digest('hex');
  return { rating, wouldRecommend: input.wouldRecommend, idempotencyKey, payloadHash };
}

export function satisfactionEligible(orderStatus, fulfillments = []) {
  if (ELIGIBLE_ORDER_STATUSES.has(String(orderStatus || '').toLowerCase())) return true;
  return fulfillments.some(item => ELIGIBLE_FULFILLMENT_STATUSES.has(String(item?.status || '').toLowerCase()));
}

export async function submitOrderSatisfaction(trx, context, publicCode, input = {}) {
  const empresaId = context?.empresaId;
  const storefrontId = context?.storefrontId;
  if (!empresaId || !storefrontId) throw new CommerceError('storefront público inválido', 'STOREFRONT_NOT_FOUND');
  const code = String(publicCode || '').trim().toUpperCase().slice(0, 80);
  if (!code) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
  const survey = normalizedInput(input);

  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${empresaId}:satisfaction-key:${survey.idempotencyKey}`]);
  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${empresaId}:${storefrontId}:${code}:satisfaction`]);
  const orderResult = await trx.query(
    `SELECT o.id, o.status, s.loja_id,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('status', f.status)) FROM commerce_fulfillments f WHERE f.empresa_id = o.empresa_id AND f.order_id = o.id), '[]'::jsonb) AS fulfillments
       FROM commerce_orders o
       JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
      WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3
      LIMIT 1
      FOR UPDATE OF o`,
    [empresaId, storefrontId, code],
  );
  const order = orderResult.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
  if (!satisfactionEligible(order.status, order.fulfillments || [])) {
    throw new CommerceError('A pesquisa fica disponível após a entrega, retirada ou conclusão do pedido.', 'SATISFACTION_NOT_AVAILABLE');
  }

  await trx.query(
    `DELETE FROM commerce_order_satisfaction
      WHERE empresa_id = $1 AND retencao_ate <= CURRENT_TIMESTAMP
        AND (order_id = $2 OR idempotency_key = $3)`,
    [empresaId, order.id, survey.idempotencyKey],
  );

  const existingResult = await trx.query(
    `SELECT id, order_id, nota, recomendaria, idempotency_key, payload_hash, criado_em
       FROM commerce_order_satisfaction
      WHERE empresa_id = $1 AND retencao_ate > CURRENT_TIMESTAMP
        AND (order_id = $2 OR idempotency_key = $3)
      LIMIT 1`,
    [empresaId, order.id, survey.idempotencyKey],
  );
  const existing = existingResult.rows[0];
  if (existing) {
    if (existing.order_id === order.id && existing.idempotency_key === survey.idempotencyKey && existing.payload_hash === survey.payloadHash) {
      return { submitted: true, rating: Number(existing.nota), wouldRecommend: existing.recomendaria, submittedAt: existing.criado_em, idempotentReplay: true };
    }
    if (existing.idempotency_key === survey.idempotencyKey) {
      throw new CommerceError('A chave idempotente já foi usada com outra avaliação ou conteúdo.', 'SATISFACTION_IDEMPOTENCY_CONFLICT');
    }
    throw new CommerceError('A avaliação deste pedido já foi enviada.', 'SATISFACTION_ALREADY_SUBMITTED');
  }

  let inserted;
  try {
    inserted = await trx.query(
      `INSERT INTO commerce_order_satisfaction
        (empresa_id, storefront_id, order_id, nota, recomendaria, idempotency_key, payload_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nota, recomendaria, criado_em`,
      [empresaId, storefrontId, order.id, survey.rating, survey.wouldRecommend, survey.idempotencyKey, survey.payloadHash],
    );
  } catch (error) {
    if (error?.code === '23505') throw new CommerceError('A avaliação ou chave idempotente já foi registrada.', 'SATISFACTION_IDEMPOTENCY_CONFLICT');
    throw error;
  }
  const created = inserted.rows[0];
  const correlationId = `satisfaction-${crypto.randomUUID()}`;
  await trx.query(
    `INSERT INTO commerce_audit_logs
      (empresa_id, loja_id, entidade, entidade_id, acao, depois, correlation_id)
     VALUES ($1, $2, 'order_satisfaction', $3, 'submitted', $4::jsonb, $5)`,
    [empresaId, order.loja_id || null, created.id, JSON.stringify({ minimized: true }), correlationId],
  );
  return { submitted: true, rating: Number(created.nota), wouldRecommend: created.recomendaria, submittedAt: created.criado_em, idempotentReplay: false };
}
