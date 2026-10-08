import { CommerceError, assertUuid, auditLog, commerceCheckoutLimits, tenantContext } from './commerce-core.js';

const PROMOTION_TYPES = new Set(['percentage', 'fixed']);

function text(value, max = 160) { return String(value || '').trim().slice(0, max); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function cents(value) { return Math.max(0, Math.round(number(value) * 100)); }
function money(value) { return round(value); }
function fromCents(value) { return money(number(value) / 100); }

function decimal(value, field = 'valor') {
  if (typeof value === 'boolean' || value === null || value === undefined) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  if (typeof value === 'string' && !value.trim()) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  if (!['number', 'string'].includes(typeof value)) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  return parsed;
}

function usageLimit(value, field, currentUses = 0) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new CommerceError(`${field} inválido`, 'PROMOTION_INVALID');
  if (parsed < Number(currentUses || 0)) throw new CommerceError(`${field} não pode ficar abaixo dos usos já realizados`, 'PROMOTION_USAGE_LIMIT_CONFLICT');
  return parsed;
}

function promotionDiscountCents(baseCents, promotion) {
  const base = Math.max(0, Number.isInteger(baseCents) ? baseCents : 0);
  if (promotion.tipo === 'percentage') return Math.min(base, Math.max(0, Math.round(base * number(promotion.valor) / 100)));
  if (promotion.tipo === 'fixed') return Math.min(base, cents(promotion.valor));
  throw new CommerceError('tipo de promoção ainda não habilitado no checkout', 'PROMOTION_TYPE_UNSUPPORTED');
}

/** Cálculo único usado pela prévia e pela aplicação no pedido. Valores são centavos. */
export function calculatePromotionDiscount(base, promotion) {
  return fromCents(promotionDiscountCents(cents(base), promotion));
}

function normalizedLines(input = {}) {
  const lineQuantities = new Map();
  if (Array.isArray(input.items)) for (const item of input.items) {
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new CommerceError('quantidade deve ser um inteiro positivo', 'INVALID_QUANTITY');
    const variantId = assertUuid(item?.variantId, 'variantId');
    lineQuantities.set(variantId, (lineQuantities.get(variantId) || 0) + quantity);
  }
  const lines = [...lineQuantities.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
  if (!lines.length) throw new CommerceError('o carrinho está vazio', 'EMPTY_CART');
  const limits = commerceCheckoutLimits();
  if (lines.some(line => line.quantity > limits.maxLineQuantity) || lines.reduce((sum, line) => sum + line.quantity, 0) > limits.maxOrderUnits) {
    throw new CommerceError(`máximo de ${limits.maxOrderUnits} unidades por pedido`, 'QUANTITY_LIMIT_EXCEEDED', { max: limits.maxOrderUnits });
  }
  return lines;
}

function readQuery(client) {
  return client?.queryRead ? client.queryRead.bind(client) : client.query.bind(client);
}

/**
 * Calcula a prévia sem transação de escrita: somente o catálogo publicado da
 * vitrine selecionada e a promoção vigente entram no resultado.
 */
export async function previewPromotion(client, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const storefrontId = assertUuid(input.storefrontId || context.storefrontId, 'storefrontId');
  const codigo = text(input.codigo, 80).toUpperCase();
  if (!codigo) throw new CommerceError('cupom é obrigatório', 'PROMOTION_CODE_INVALID');
  const lines = normalizedLines(input);
  const query = readQuery(client);
  const promotionResult = await query(
    `SELECT p.id AS promotion_id, p.tipo, p.valor, p.inicio, p.fim, c.codigo
       FROM commerce_promotion_codes c
       JOIN commerce_promotions p ON p.empresa_id = c.empresa_id AND p.id = c.promotion_id
      WHERE c.empresa_id = $1 AND c.codigo = $2 AND c.ativo = true AND p.ativo = true
        AND p.inicio <= CURRENT_TIMESTAMP AND (p.fim IS NULL OR p.fim > CURRENT_TIMESTAMP)
        AND (p.limite_uso IS NULL OR p.usos < p.limite_uso)
        AND (c.uso_maximo IS NULL OR c.usos < c.uso_maximo)
      LIMIT 1`,
    [empresaId, codigo],
  );
  const promotion = promotionResult.rows[0];
  if (!promotion) throw new CommerceError('cupom não encontrado, expirado ou sem uso disponível', 'PROMOTION_NOT_FOUND');

  // Esta seleção é deliberadamente equivalente ao trecho de createPendingOrder:
  // sem subtotal, preço, desconto ou lista de preços confiados ao navegador.
  const variants = await query(
    `SELECT v.id,
            COALESCE(vp.preco_promocional, vp.preco) AS price
       FROM commerce_product_variants v
       JOIN commerce_products p
         ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active'
       JOIN commerce_variant_prices vp
         ON vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
       JOIN commerce_product_channels pc
         ON pc.empresa_id = v.empresa_id AND pc.product_id = p.id
        AND pc.storefront_id = $3 AND pc.price_list_id = vp.price_list_id AND pc.publicado = true
       JOIN commerce_storefronts s
         ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id AND s.status = 'active'
       JOIN commerce_price_lists pl
         ON pl.empresa_id = vp.empresa_id AND pl.id = vp.price_list_id
        AND pl.ativo = true AND pl.canal = 'web'
      WHERE v.empresa_id = $1
        AND v.id = ANY($2::uuid[])
        AND v.ativo = true
        AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
        AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
      ORDER BY vp.vigencia_inicio DESC`,
    [empresaId, lines.map(line => line.variantId), storefrontId],
  );
  const priced = new Map();
  for (const row of variants.rows) if (!priced.has(row.id)) priced.set(row.id, row);
  if (priced.size !== lines.length) throw new CommerceError('um ou mais itens não estão disponíveis no catálogo', 'ITEM_UNAVAILABLE');
  const subtotalCents = lines.reduce((sum, line) => sum + cents(priced.get(line.variantId).price) * line.quantity, 0);
  const desconto = fromCents(promotionDiscountCents(subtotalCents, promotion));
  return {
    codigo: promotion.codigo,
    tipo: promotion.tipo,
    subtotal: fromCents(subtotalCents),
    desconto,
    subtotalComDesconto: fromCents(subtotalCents - promotionDiscountCents(subtotalCents, promotion)),
    inicio: promotion.inicio instanceof Date ? promotion.inicio.toISOString() : promotion.inicio,
    fim: promotion.fim instanceof Date ? promotion.fim.toISOString() : promotion.fim,
  };
}

function promotionDate(value, field, nullable = false) {
  if (nullable && value === null) return null;
  if (value === undefined || value === null || value === '' || typeof value === 'boolean' || typeof value === 'number') throw new CommerceError(`${field} inválido`, 'PROMOTION_DATE_INVALID');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new CommerceError(`${field} inválido`, 'PROMOTION_DATE_INVALID');
  return parsed.toISOString();
}

function promotionSummary(promotion) {
  return {
    nome: promotion.nome,
    tipo: promotion.tipo,
    valor: money(promotion.valor),
    inicio: promotion.inicio instanceof Date ? promotion.inicio.toISOString() : promotion.inicio,
    fim: promotion.fim instanceof Date ? promotion.fim.toISOString() : promotion.fim,
    limiteUso: promotion.limite_uso == null ? null : Number(promotion.limite_uso),
    ativo: promotion.ativo === true,
    usos: Number(promotion.usos || 0),
  };
}

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
  const valorInput = input.valor == null || input.valor === '' ? template?.valor : input.valor;
  const valor = decimal(valorInput);
  const regras = input.regras || template?.regras || {};
  // null/omitted inicio retains the legacy "start now" behavior; other invalid
  // primitive values must not silently become a valid date.
  const inicio = input.inicio === undefined || input.inicio === null ? new Date().toISOString() : input.inicio;
  const fim = input.fim === undefined || input.fim === null || input.fim === '' ? null : input.fim;
  if (!nome || !PROMOTION_TYPES.has(tipo) || valor <= 0) throw new CommerceError('nome, tipo e valor de promoção válidos são obrigatórios', 'PROMOTION_INVALID');
  if (tipo === 'percentage' && valor > 100) throw new CommerceError('percentual da promoção deve estar entre 0 e 100', 'PROMOTION_INVALID');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') throw new CommerceError('ativo deve ser booleano', 'PROMOTION_INVALID');
  const inicioDate = promotionDate(inicio, 'inicio');
  const fimDate = fim === null ? null : promotionDate(fim, 'fim');
  if (fimDate !== null && new Date(fimDate).getTime() <= new Date(inicioDate).getTime()) throw new CommerceError('fim deve ser posterior ao início', 'PROMOTION_DATE_INVALID');
  const limiteUso = usageLimit(input.limiteUso, 'limite de uso');
  const result = await trx.query(
    `INSERT INTO commerce_promotions (empresa_id, nome, tipo, valor, regras, inicio, fim, limite_uso, ativo, template_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8, $9, $10)
     RETURNING *`,
    [empresaId, nome, tipo, valor, JSON.stringify(regras), inicioDate, fimDate, limiteUso, input.ativo !== false, template?.id || null],
  );
  const promotion = result.rows[0];
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'promotion', $4, 'created', $5::jsonb)`,
    [empresaId, context.lojaId || null, usuarioId, promotion.id, JSON.stringify({ nome, tipo, valor })],
  );
  if (input.codigo !== undefined && input.codigo !== null && text(input.codigo, 80)) {
    const code = await createPromotionCode(trx, context, {
      promotionId: promotion.id,
      codigo: input.codigo,
      usoMaximo: input.usoMaximo,
      ativo: input.codigoAtivo,
    });
    promotion.codigo = code.codigo;
    promotion.codigos = [code];
  }
  return promotion;
}

export async function createPromotionCode(trx, context, input = {}) {
  const { empresaId } = tenantContext(context);
  const promotionId = assertUuid(input.promotionId, 'promotionId');
  const codigo = text(input.codigo, 80).toUpperCase();
  if (!codigo) throw new CommerceError('código do cupom é obrigatório', 'PROMOTION_CODE_INVALID');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') throw new CommerceError('ativo deve ser booleano', 'PROMOTION_CODE_INVALID');
  const usoMaximo = usageLimit(input.usoMaximo, 'limite de uso do código');
  const promotion = await trx.query(`SELECT id FROM commerce_promotions WHERE empresa_id = $1 AND id = $2 LIMIT 1`, [empresaId, promotionId]);
  if (!promotion.rows[0]) throw new CommerceError('promoção não encontrada no tenant', 'PROMOTION_NOT_FOUND');
  const result = await trx.query(
    `INSERT INTO commerce_promotion_codes (empresa_id, promotion_id, codigo, uso_maximo, ativo)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [empresaId, promotionId, codigo, usoMaximo, input.ativo !== false],
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

export async function updatePromotion(trx, context, promotionId, input = {}) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(promotionId, 'promotionId');
  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commerce-promotion:${empresaId}:${id}`]);
  const currentResult = await trx.query(
    `SELECT id, empresa_id, nome, tipo, valor, inicio, fim, limite_uso, usos, ativo
       FROM commerce_promotions
      WHERE empresa_id = $1 AND id = $2
      FOR UPDATE`,
    [empresaId, id],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('promoção não encontrada no tenant', 'PROMOTION_NOT_FOUND');
  const allowed = ['nome', 'tipo', 'valor', 'inicio', 'fim', 'limiteUso', 'ativo'];
  if (Object.keys(input || {}).some(key => !allowed.includes(key))) throw new CommerceError('campo de promoção não suportado', 'PROMOTION_INVALID');
  if (!Object.keys(input || {}).some(key => allowed.includes(key))) throw new CommerceError('nenhuma alteração de promoção informada', 'NO_CHANGES');

  const nome = input.nome === undefined ? current.nome : text(input.nome);
  const tipo = input.tipo === undefined ? current.tipo : text(input.tipo, 30);
  const valor = input.valor === undefined ? decimal(current.valor) : decimal(input.valor);
  const inicio = input.inicio === undefined ? (current.inicio instanceof Date ? current.inicio.toISOString() : current.inicio) : promotionDate(input.inicio, 'inicio');
  const fim = input.fim === undefined
    ? (current.fim instanceof Date ? current.fim.toISOString() : current.fim)
    : promotionDate(input.fim, 'fim', true);
  const limiteUso = input.limiteUso === undefined
    ? (current.limite_uso == null ? null : usageLimit(Number(current.limite_uso), 'limite de uso', current.usos))
    : usageLimit(input.limiteUso, 'limite de uso', current.usos);
  const ativo = input.ativo === undefined ? current.ativo === true : input.ativo;
  if (!nome || !PROMOTION_TYPES.has(tipo) || !Number.isFinite(valor) || valor <= 0 || (tipo === 'percentage' && valor > 100)) throw new CommerceError('nome, tipo e valor de promoção válidos são obrigatórios', 'PROMOTION_INVALID');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') throw new CommerceError('ativo deve ser booleano', 'PROMOTION_INVALID');
  const inicioMs = new Date(inicio).getTime();
  const fimMs = fim == null ? null : new Date(fim).getTime();
  if (!Number.isFinite(inicioMs) || (fimMs !== null && (!Number.isFinite(fimMs) || fimMs <= inicioMs))) throw new CommerceError('fim deve ser posterior ao início', 'PROMOTION_DATE_INVALID');

  const result = await trx.query(
    `UPDATE commerce_promotions
        SET nome = $3, tipo = $4, valor = $5, inicio = $6::timestamptz, fim = $7::timestamptz,
            limite_uso = $8, ativo = $9
      WHERE empresa_id = $1 AND id = $2
      RETURNING *`,
    [empresaId, id, nome, tipo, valor, inicio, fim, limiteUso, ativo],
  );
  const promotion = result.rows[0];
  await auditLog(trx, context, { entidade: 'promotion', entidadeId: id, acao: 'updated', antes: promotionSummary(current), depois: promotionSummary(promotion) });
  return promotion;
}

export async function updatePromotionCode(trx, context, codeId, input = {}) {
  const { empresaId } = tenantContext(context);
  const id = assertUuid(codeId, 'promotionCodeId');
  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commerce-promotion-code:${empresaId}:${id}`]);
  const currentResult = await trx.query(
    `SELECT c.id, c.codigo, c.uso_maximo, c.usos, c.ativo
       FROM commerce_promotion_codes c
      WHERE c.empresa_id = $1 AND c.id = $2
      FOR UPDATE`,
    [empresaId, id],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('código de promoção não encontrado no tenant', 'PROMOTION_NOT_FOUND');
  const codigo = input.codigo === undefined ? current.codigo : text(input.codigo, 80).toUpperCase();
  const usoMaximo = input.usoMaximo === undefined
    ? (current.uso_maximo == null ? null : Number(current.uso_maximo))
    : (input.usoMaximo === null || input.usoMaximo === '' ? null : Number(input.usoMaximo));
  const ativo = input.ativo === undefined ? current.ativo === true : input.ativo;
  if (!codigo) throw new CommerceError('código do cupom é obrigatório', 'PROMOTION_CODE_INVALID');
  if (usoMaximo !== null && (!Number.isInteger(usoMaximo) || usoMaximo < 1 || usoMaximo < Number(current.usos || 0))) throw new CommerceError('limite de uso do código inválido ou abaixo dos usos já realizados', 'PROMOTION_USAGE_LIMIT_CONFLICT');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') throw new CommerceError('ativo deve ser booleano', 'PROMOTION_CODE_INVALID');
  const duplicate = await trx.query(
    `SELECT id FROM commerce_promotion_codes WHERE empresa_id = $1 AND codigo = $2 AND id <> $3 LIMIT 1`,
    [empresaId, codigo, id],
  );
  if (duplicate.rows[0]) throw new CommerceError('código de cupom já existe no tenant', 'PROMOTION_CODE_CONFLICT');
  const result = await trx.query(
    `UPDATE commerce_promotion_codes SET codigo = $3, uso_maximo = $4, ativo = $5
      WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [empresaId, id, codigo, usoMaximo, ativo],
  );
  const updated = result.rows[0];
  await auditLog(trx, context, {
    entidade: 'promotion_code', entidadeId: id, acao: 'updated',
    antes: { codigo: current.codigo, usoMaximo: current.uso_maximo == null ? null : Number(current.uso_maximo), usos: Number(current.usos || 0), ativo: current.ativo === true },
    depois: { codigo: updated.codigo, usoMaximo: updated.uso_maximo == null ? null : Number(updated.uso_maximo), usos: Number(updated.usos || 0), ativo: updated.ativo === true },
  });
  return updated;
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
  const base = fromCents(cents(order.subtotal));
  const discount = calculatePromotionDiscount(base, promotion);
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
