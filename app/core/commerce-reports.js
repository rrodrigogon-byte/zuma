import { db } from './database.js';
import { CommerceError, tenantContext } from './commerce-core.js';

function dateParam(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new CommerceError('período inválido', 'INVALID_REPORT_PERIOD');
  return date.toISOString();
}

function period(input = {}) {
  const to = dateParam(input.to, new Date().toISOString());
  const from = dateParam(input.from, new Date(Date.now() - 30 * 86400000).toISOString());
  if (new Date(from) >= new Date(to)) throw new CommerceError('a data inicial deve ser anterior à final', 'INVALID_REPORT_PERIOD');
  return { from, to };
}

function storeFilter(context, values, alias = 'o') {
  if (!context.lojaId) return '';
  values.push(context.lojaId);
  return ` AND ${alias}.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $${values.length})`;
}

export async function salesReport(contextInput, options = {}) {
  const context = tenantContext(contextInput);
  const { from, to } = period(options);
  const values = [context.empresaId, from, to];
  const store = storeFilter(context, values);
  const summary = await db.query(
    `SELECT COUNT(*)::integer AS orders,
            COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled','refunded')), 0)::numeric AS gross_total,
            COALESCE(AVG(o.total) FILTER (WHERE o.status NOT IN ('cancelled','refunded')), 0)::numeric AS average_ticket,
            COUNT(*) FILTER (WHERE o.status IN ('cancelled','refunded'))::integer AS cancelled_orders
       FROM commerce_orders o
      WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz${store}`,
    values,
  );
  const daily = await db.query(
    `SELECT date_trunc('day', o.criado_em)::date AS day,
            COUNT(*)::integer AS orders,
            COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled','refunded')), 0)::numeric AS total
       FROM commerce_orders o
      WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz${store}
      GROUP BY 1 ORDER BY 1 ASC`,
    values,
  );
  return { period: { from, to }, summary: summary.rows[0], daily: daily.rows };
}

export async function inventoryReport(contextInput) {
  const context = tenantContext(contextInput);
  const values = [context.empresaId];
  let locationPredicate = '';
  if (context.lojaId) {
    values.push(context.lojaId);
    locationPredicate = ` AND (l.loja_id = $${values.length} OR l.loja_id IS NULL)`;
  }
  const result = await db.query(
    `SELECT p.id AS product_id, p.nome AS product_name, v.id AS variant_id, v.sku,
            COALESCE(SUM(il.disponivel), 0)::integer AS available,
            COALESCE(SUM(il.reservado), 0)::integer AS reserved,
            COALESCE(SUM(il.comprometido), 0)::integer AS committed,
            COALESCE(SUM(il.minimo), 0)::integer AS minimum,
            BOOL_OR(COALESCE(il.disponivel, 0) <= COALESCE(il.minimo, 0)) AS low_stock
       FROM commerce_inventory_levels il
       JOIN commerce_inventory_locations l ON l.empresa_id = il.empresa_id AND l.id = il.location_id AND l.ativo = true
       JOIN commerce_product_variants v ON v.empresa_id = il.empresa_id AND v.id = il.variant_id
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
      WHERE il.empresa_id = $1${locationPredicate}
      GROUP BY p.id, p.nome, v.id, v.sku
      ORDER BY low_stock DESC, p.nome ASC, v.sku ASC`,
    values,
  );
  return { items: result.rows };
}

export async function customerReport(contextInput, options = {}) {
  const context = tenantContext(contextInput);
  const { from, to } = period(options);
  const values = [context.empresaId, from, to];
  const result = await db.query(
    `SELECT COUNT(*)::integer AS new_customers,
            COUNT(*) FILTER (WHERE c.bloqueado = true)::integer AS blocked_customers
       FROM commerce_customers c
      WHERE c.empresa_id = $1 AND c.criado_em >= $2::timestamptz AND c.criado_em < $3::timestamptz`,
    values,
  );
  const top = await db.query(
    `SELECT c.id, c.nome, c.email, COUNT(o.id)::integer AS orders, COALESCE(SUM(o.total), 0)::numeric AS total
       FROM commerce_customers c
       LEFT JOIN commerce_orders o
         ON o.empresa_id = c.empresa_id AND o.customer_id = c.id
        AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz
        AND o.status NOT IN ('cancelled','refunded')
      WHERE c.empresa_id = $1
      GROUP BY c.id, c.nome, c.email
      ORDER BY total DESC, orders DESC
      LIMIT 100`,
    values,
  );
  const satisfactionValues = [context.empresaId, from, to];
  let satisfactionStore = '';
  if (context.lojaId) {
    satisfactionValues.push(context.lojaId);
    satisfactionStore = ` AND sf.loja_id = $${satisfactionValues.length}`;
  }
  const satisfaction = await db.query(
    `SELECT COUNT(*)::integer AS responses,
            ROUND(COALESCE(AVG(s.nota), 0)::numeric, 2) AS average_rating,
            COUNT(*) FILTER (WHERE s.recomendaria = true)::integer AS recommend_count,
            CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE s.recomendaria = true)::numeric / COUNT(*)::numeric) * 100, 1) END AS recommendation_rate
       FROM commerce_order_satisfaction s
       JOIN commerce_orders o ON o.empresa_id = s.empresa_id AND o.storefront_id = s.storefront_id AND o.id = s.order_id
       JOIN commerce_storefronts sf ON sf.empresa_id = o.empresa_id AND sf.id = o.storefront_id
      WHERE s.empresa_id = $1 AND s.retencao_ate > CURRENT_TIMESTAMP AND s.criado_em >= $2::timestamptz AND s.criado_em < $3::timestamptz${satisfactionStore}`,
    satisfactionValues,
  );
  return { period: { from, to }, summary: result.rows[0], top: top.rows, satisfaction: satisfaction.rows[0] || { responses: 0, average_rating: 0, recommend_count: 0, recommendation_rate: 0 } };
}


export async function fulfillmentReport(contextInput, options = {}) {
  const context = tenantContext(contextInput);
  const { from, to } = period(options);
  const values = [context.empresaId, from, to];
  const store = storeFilter(context, values);
  const summary = await db.query(
    `WITH scoped_orders AS (
       SELECT o.id, o.storefront_id, o.status, o.total
         FROM commerce_orders o
         JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
        WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz${store}
     )
     SELECT (SELECT COUNT(*)::integer FROM scoped_orders) AS orders,
            (SELECT COUNT(*)::integer FROM scoped_orders WHERE status NOT IN ('cancelled','refunded')) AS active_orders,
            (SELECT COALESCE(SUM(total), 0)::numeric FROM scoped_orders WHERE status NOT IN ('cancelled','refunded')) AS gross_total,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status IN ('pending','preparing','ready'))::integer AS awaiting_dispatch,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'shipped')::integer AS shipped,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'delivered')::integer AS delivered,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'failed')::integer AS failed
       FROM scoped_orders o
       LEFT JOIN commerce_fulfillments f ON f.empresa_id = $1 AND f.order_id = o.id`,
    values,
  );
  const providers = await db.query(
    `SELECT COALESCE(q.provider, 'pickup') AS provider, COUNT(DISTINCT f.id)::integer AS fulfillments,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'delivered')::integer AS delivered,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status IN ('pending','preparing','ready'))::integer AS pending
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
       JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
       LEFT JOIN commerce_shipping_quotes q ON q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id
      WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz${store}
      GROUP BY 1 ORDER BY fulfillments DESC, provider ASC`,
    values,
  );
  const recentValues = [context.empresaId, from, to];
  const recentStore = storeFilter(context, recentValues);
  recentValues.push(50);
  const recent = await db.query(
    `SELECT o.public_code, o.status AS order_status, o.total, o.criado_em, o.atualizado_em,
            c.nome AS customer_name, c.email AS customer_email,
            f.status AS fulfillment_status, f.carrier, f.tracking_code, f.tracking_url,
            f.label_url, f.ocorrencias, q.provider
       FROM commerce_orders o
       JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
       LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
       LEFT JOIN commerce_fulfillments f ON f.empresa_id = o.empresa_id AND f.id = (
         SELECT latest.id FROM commerce_fulfillments latest
          WHERE latest.empresa_id = o.empresa_id AND latest.order_id = o.id
          ORDER BY latest.atualizado_em DESC NULLS LAST LIMIT 1
       )
       LEFT JOIN commerce_shipping_quotes q ON q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id
      WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz${recentStore}
      ORDER BY o.criado_em DESC
      LIMIT $${recentValues.length}`,
    recentValues,
  );
  return { period: { from, to }, summary: summary.rows[0] || {}, providers: providers.rows, recent: recent.rows };
}
