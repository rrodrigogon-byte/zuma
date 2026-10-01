import { CommerceError, assertUuid, auditLog, tenantContext } from './commerce-core.js';

const PROMOTION_TYPES = new Set(['percentage', 'fixed']);

function text(value, max = 160) { return String(value || '').trim().slice(0, max); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }

export async function listPromotionTemplates(client, context) {
  const { empresaId } = tenantContext(context);
  const result = await client.query(
    `SELECT id, empresa_id, codigo, nome, descricao, tipo, valor, regras, ativo, sistema, criado_em, atualizado_em
       FROM commerce_promotion_templates
      WHERE ativo = true AND (empresa_id IS NULL OR empresa_id = $1)
      ORDER BY CASE WHEN empresa_id IS NULL THEN 0 ELSE 1 END, nome ASC
      LIMIT 100`,
    [empresaId],
  );
  return { items: result.rows };
}

export async function createPromotionTemplate(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const codigo = text(input.codigo, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const nome = text(input.nome);
  const tipo = text(input.tipo, 30);
  const valor = number(input.valor);
  if (!codigo || !nome || !PROMOTION_TYPES.has(tipo) || valor <= 0) throw new CommerceError('código, nome, tipo e valor de template válidos são obrigatórios', 'PROMOTION_TEMPLATE_INVALID');
  if (tipo === 'percentage' && valor > 100) throw new CommerceError('percentual do template deve estar entre 0 e 100', 'PROMOTION_TEMPLATE_INVALID');
  const result = await trx.query(
    `INSERT INTO commerce_promotion_templates (empresa_id, codigo, nome, descricao, tipo, valor, regras, ativo, sistema, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, true, false, $8)
     RETURNING *`,
    [empresaId, codigo, nome, text(input.descricao, 500) || null, tipo, valor, JSON.stringify(input.regras || {}), usuarioId],
  );
  await auditLog(trx, context, { entidade: 'promotion_template', entidadeId: result.rows[0].id, acao: 'created', depois: { codigo, nome, tipo, valor } });
  return result.rows[0];
}

export async function createPromotion(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  let template = null;
  if (input.templateId) {
    const templateResult = await trx.query(
      `SELECT id, nome, tipo, valor, regras FROM commerce_promotion_templates
        WHERE id = $1 AND ativo = true AND (empresa_id IS NULL OR empresa_id = $2)
        LIMIT 1`,
      [assertUuid(input.templateId, 'templateId'), empresaId],
    );
    template = templateResult.rows[0];
    if (!template) throw new CommerceError('template promocional não encontrado no tenant', 'PROMOTION_TEMPLATE_NOT_FOUND');
  }
  const nome = text(input.nome || template?.nome);
  const tipo = text(input.tipo || template?.tipo, 30);
  const valor = number(input.valor == null || input.valor === '' ? template?.valor : input.valor);
  const regras = input.regras || template?.regras || {};
  const inicio = input.inicio || new Date().toISOString();
  const fim = input.fim || null;
  if (!nome || !PROMOTION_TYPES.has(tipo) || valor <= 0) throw new CommerceError('nome, tipo e valor de promoção válidos são obrigatórios', 'PROMOTION_INVALID');
  if (tipo === 'percentage' && valor > 100) throw new CommerceError('percentual da promoção deve estar entre 0 e 100', 'PROMOTION_INVALID');
  const result = await trx.query(
    `INSERT INTO commerce_promotions (empresa_id, nome, tipo, valor, regras, inicio, fim, limite_uso, ativo, template_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8, $9, $10)
     RETURNING *`,
    [empresaId, nome, tipo, valor, JSON.stringify(regras), inicio, fim, input.limiteUso == null ? null : Math.max(1, Number(input.limiteUso) || 1), input.ativo !== false, template?.id || null],
  );
  const promotion = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'promotion', $4, 'created', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, promotion.id, JSON.stringify({ nome, tipo, valor })],
  );
  return promotion;
}

export async function createPromotionCode(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const promotionId = assertUuid(input.promotionId, 'promotionId');
  const codigo = text(input.codigo, 80).toUpperCase();
  if (!codigo) throw new CommerceError('código do cupom é obrigatório', 'PROMOTION_CODE_INVALID');
  const promotion = await trx.query(`SELECT id FROM commerce_promotions WHERE empresa_id = $1 AND id = $2 LIMIT 1`, [empresaId, promotionId]);
  if (!promotion.rows[0]) throw new CommerceError('promoção não encontrada no tenant', 'PROMOTION_NOT_FOUND');
  const result = await trx.query(
    `INSERT INTO commerce_promotion_codes (empresa_id, promotion_id, codigo, uso_maximo, ativo)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [empresaId, promotionId, codigo, input.usoMaximo == null ? null : Math.max(1, Number(input.usoMaximo) || 1), input.ativo !== false],
  );
  return result.rows[0];
}

export async function listPromotions(trx, context) {
  const { empresaId } = tenantContext(context);
  const result = await trx.query(
    `SELECT p.id, p.nome, p.tipo, p.valor, p.inicio, p.fim, p.limite_uso, p.usos, p.ativo, p.template_id,
            t.nome AS template_nome,
            COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'codigo', c.codigo, 'usoMaximo', c.uso_maximo, 'usos', c.usos, 'ativo', c.ativo)) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS codigos
       FROM commerce_promotions p
       LEFT JOIN commerce_promotion_templates t ON t.id = p.template_id
       LEFT JOIN commerce_promotion_codes c ON c.empresa_id = p.empresa_id AND c.promotion_id = p.id
      WHERE p.empresa_id = $1
      GROUP BY p.id, t.nome
      ORDER BY p.inicio DESC, p.nome ASC
      LIMIT 500`,
    [empresaId],
  );
  return { items: result.rows };
}

export async function applyPromotionToOrder(trx, context, input = {}) {
  const { empresaId, usuarioId } = tenantContext(context);
  const orderId = assertUuid(input.orderId, 'orderId');
  const codigo = text(input.codigo, 80).toUpperCase();
  if (!codigo) throw new CommerceError('cupom é obrigatório', 'PROMOTION_CODE_INVALID');
  const orderResult = await trx.query(
    `SELECT id, storefront_id, customer_id, status, subtotal, desconto, frete, impostos, total
       FROM commerce_orders
      WHERE empresa_id = $1 AND id = $2
      FOR UPDATE`,
    [empresaId, orderId],
  );
  const order = orderResult.rows[0];
  if (!order) throw new CommerceError('pedido não encontrado no tenant', 'ORDER_NOT_FOUND');
  if (!['draft', 'pending_payment'].includes(order.status)) throw new CommerceError('cupom só pode ser aplicado antes do processamento do pedido', 'PROMOTION_ORDER_STATE_INVALID');
  const already = await trx.query(
    `SELECT id, codigo, tipo, desconto
       FROM commerce_order_promotions
      WHERE empresa_id = $1 AND order_id = $2
      LIMIT 1`,
    [empresaId, orderId],
  );
  if (already.rows[0]) {
    const applied = already.rows[0];
    if (String(applied.codigo || '').toUpperCase() !== codigo) throw new CommerceError('o pedido já possui outra promoção aplicada', 'PROMOTION_ALREADY_APPLIED');
    return { orderId, codigo: applied.codigo, tipo: applied.tipo, desconto: round(applied.desconto), total: round(order.total) };
  }
  const promotionResult = await trx.query(
    `SELECT p.id AS promotion_id, p.tipo, p.valor, p.regras, c.id AS promotion_code_id, c.codigo
       FROM commerce_promotion_codes c
       JOIN commerce_promotions p ON p.empresa_id = c.empresa_id AND p.id = c.promotion_id
      WHERE c.empresa_id = $1 AND c.codigo = $2 AND c.ativo = true AND p.ativo = true
        AND p.inicio <= CURRENT_TIMESTAMP AND (p.fim IS NULL OR p.fim > CURRENT_TIMESTAMP)
        AND (p.limite_uso IS NULL OR p.usos < p.limite_uso)
        AND (c.uso_maximo IS NULL OR c.usos < c.uso_maximo)
      FOR UPDATE OF p, c`,
    [empresaId, codigo],
  );
  const promotion = promotionResult.rows[0];
  if (!promotion) throw new CommerceError('cupom não encontrado, expirado ou sem uso disponível', 'PROMOTION_NOT_FOUND');
  const base = round(order.subtotal);
  let discount = 0;
  if (promotion.tipo === 'percentage') discount = round(Math.min(base, base * number(promotion.valor) / 100));
  else if (promotion.tipo === 'fixed') discount = round(Math.min(base, number(promotion.valor)));
  else throw new CommerceError('tipo de promoção ainda não habilitado no checkout', 'PROMOTION_TYPE_UNSUPPORTED');
  const total = round(Math.max(0, number(order.total) - discount));
  // Pedido de valor zero não tem como ser pago (gateway e crediário exigem valor) e ficaria
  // reservando estoque até vencer.
  if (total < 0.01) throw new CommerceError('este cupom zera o pedido; fale com a loja para liberar a compra', 'PROMOTION_ZERO_TOTAL');
  await trx.query(`UPDATE commerce_orders SET desconto = $3, total = $4, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [empresaId, orderId, discount, total]);
  await trx.query(
    `INSERT INTO commerce_order_promotions (empresa_id, order_id, promotion_id, promotion_code_id, codigo, tipo, valor_base, desconto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [empresaId, orderId, promotion.promotion_id, promotion.promotion_code_id, promotion.codigo, promotion.tipo, base, discount],
  );
  await trx.query(`UPDATE commerce_promotions SET usos = usos + 1 WHERE empresa_id = $1 AND id = $2`, [empresaId, promotion.promotion_id]);
  await trx.query(`UPDATE commerce_promotion_codes SET usos = usos + 1 WHERE empresa_id = $1 AND id = $2`, [empresaId, promotion.promotion_code_id]);
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'order_promotion', $4, 'applied', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, orderId, JSON.stringify({ codigo: promotion.codigo, desconto: discount })],
  );
  return { orderId, codigo: promotion.codigo, tipo: promotion.tipo, desconto: discount, total };
}
