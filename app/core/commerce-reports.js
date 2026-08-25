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
  return { period: { from, to }, summary: result.rows[0], top: top.rows };
}
