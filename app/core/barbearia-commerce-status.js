import { db } from './database.js';
import { tenantContext } from './commerce-core.js';
import { listStorefronts } from './commerce-storefronts.js';
import { listPaymentAccounts } from './commerce-payment-admin.js';
import { listShippingAccounts } from './commerce-shipping.js';

const readClient = { query: (text, values = []) => db.queryRead(text, values) };

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusMap(rows = []) {
  return Object.fromEntries(rows.map(row => [String(row.status || 'unknown'), numeric(row.total)]));
}

function safeStorefront(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    canal: row.canal,
    status: row.status,
    moeda: row.moeda,
    timezone: row.timezone,
    lojaId: row.loja_id || null,
    lojaCodigo: row.loja_codigo || null,
    lojaNome: row.loja_nome || row.nome_fantasia || null,
    produtosPublicados: numeric(row.produtos_publicados),
    pedidos: numeric(row.pedidos),
  };
}

function publicUrl(alias, primaryDomain) {
  if (alias) return `/ecommerce/${encodeURIComponent(alias)}`;
  if (primaryDomain) return `https://${primaryDomain}`;
  return null;
}

export function buildBarbeariaCommerceStatus(snapshot = {}) {
  const storefronts = Array.isArray(snapshot.storefronts) ? snapshot.storefronts : [];
  const aliases = Array.isArray(snapshot.aliases) ? snapshot.aliases : [];
  const domains = snapshot.domains || {};
  const catalog = snapshot.catalog || {};
  const inventory = snapshot.inventory || {};
  const orderRows = Array.isArray(snapshot.orders) ? snapshot.orders : [];
  const fulfillmentRows = Array.isArray(snapshot.fulfillments) ? snapshot.fulfillments : [];
  const paymentRows = Array.isArray(snapshot.payments) ? snapshot.payments : [];
  const paymentAccounts = Array.isArray(snapshot.paymentAccounts) ? snapshot.paymentAccounts : [];
  const shippingAccounts = Array.isArray(snapshot.shippingAccounts) ? snapshot.shippingAccounts : [];
  const shipping = snapshot.shipping || {};
  const webhooks = snapshot.webhooks || {};
  const activeStorefronts = storefronts.filter(item => item.status === 'active');
  const storefront = activeStorefronts[0] || storefronts[0] || null;
  const activeAlias = aliases.find(item => item.ativo && (!storefront || item.storefront_id === storefront.id)) || aliases.find(item => item.ativo) || null;
  const readyPaymentAccounts = paymentAccounts.filter(item => item.ativo && item.ready).length;
  const readyShippingAccounts = shippingAccounts.filter(item => item.ativo && item.ready).length;
  const orderCounts = statusMap(orderRows);
  const fulfillmentCounts = statusMap(fulfillmentRows);
  const paymentCounts = statusMap(paymentRows);
  const openOrders = Object.entries(orderCounts).reduce((total, [status, count]) => ['delivered', 'cancelled', 'refunded'].includes(status) ? total : total + count, 0);
  const fulfillmentAttention = numeric(fulfillmentCounts.pending) + numeric(fulfillmentCounts.preparing) + numeric(fulfillmentCounts.ready) + numeric(fulfillmentCounts.failed);
  const pendingPayments = numeric(paymentCounts.pending) + numeric(paymentCounts.authorized) + numeric(paymentCounts.processing);
  const failedWebhooks = numeric(webhooks.payment_failed) + numeric(webhooks.shipping_failed);
  const hasPublicAddress = Boolean(activeAlias?.alias || domains.primary_verified);
  const checks = [
    { id: 'storefront', label: 'Storefront ativo', ok: activeStorefronts.length > 0, required: true },
    { id: 'public_address', label: 'Alias ou domínio público verificado', ok: hasPublicAddress, required: true },
    { id: 'catalog', label: 'Produto publicado', ok: numeric(catalog.published_products) > 0, required: true },
    { id: 'price', label: 'Variantes publicadas com preço', ok: numeric(catalog.published_variants) > 0 && numeric(catalog.variants_without_price) === 0, required: true },
    { id: 'inventory', label: 'Estoque disponível', ok: numeric(inventory.available) > 0, required: true },
    { id: 'shipping', label: 'Retirada ou entrega ativa', ok: numeric(shipping.active_methods) > 0, required: true },
    { id: 'payment', label: 'Conta de pagamento pronta', ok: readyPaymentAccounts > 0, required: true },
    { id: 'database', label: 'Commerce Core acessível', ok: snapshot.databaseHealthy === true, required: true },
    { id: 'domain', label: 'Domínio próprio verificado', ok: numeric(domains.verified) > 0, required: false },
    { id: 'shipping_account', label: 'Conta logística pronta para entrega', ok: readyShippingAccounts > 0, required: false },
  ];
  const required = checks.filter(item => item.required);
  const completed = required.filter(item => item.ok).length;
  const blockers = required.filter(item => !item.ok).map(item => ({ id: item.id, label: item.label }));
  const warnings = checks.filter(item => !item.required && !item.ok).map(item => ({ id: item.id, label: item.label }));
  const readiness = required.length ? Math.round((completed / required.length) * 100) : 0;
  const status = !snapshot.databaseHealthy
    ? 'indisponivel'
    : storefronts.length === 0
      ? 'aguardando_provisionamento'
      : blockers.length === 0
        ? 'operacional'
        : 'configuracao_pendente';
  return {
    contrato: 'commerce-core-v1',
    fonteVerdade: 'commerce-core-postgresql',
    separado: true,
    estoqueCompartilhado: false,
    sincronizacaoAutomatica: false,
    status,
    geradoEm: snapshot.generatedAt || new Date().toISOString(),
    contexto: snapshot.context || null,
    storefront: safeStorefront(storefront),
    alias: activeAlias ? { alias: activeAlias.alias, brandKey: activeAlias.brand_key, ativo: activeAlias.ativo } : null,
    urlPublica: publicUrl(activeAlias?.alias, domains.primary_verified),
    catalogo: {
      produtos: numeric(catalog.total_products),
      publicados: numeric(catalog.published_products),
      variantes: numeric(catalog.total_variants),
      variantesPublicadas: numeric(catalog.published_variants),
      semPreco: numeric(catalog.variants_without_price),
    },
    estoque: {
      localizacoes: numeric(inventory.locations),
      skus: numeric(inventory.skus),
      disponivel: numeric(inventory.available),
      reservado: numeric(inventory.reserved),
      comprometido: numeric(inventory.committed),
      estoqueBaixo: numeric(inventory.low_stock),
    },
    pedidos: {
      total: Object.values(orderCounts).reduce((sum, value) => sum + numeric(value), 0),
      abertos: openOrders,
      porStatus: orderCounts,
    },
    fulfillment: {
      emAtencao: fulfillmentAttention,
      porStatus: fulfillmentCounts,
    },
    pagamentos: {
      contas: paymentAccounts.length,
      contasProntas: readyPaymentAccounts,
      aguardando: pendingPayments,
      porStatus: paymentCounts,
    },
    frete: {
      metodos: numeric(shipping.total_methods),
      metodosAtivos: numeric(shipping.active_methods),
      retiradaAtiva: numeric(shipping.pickup_methods) > 0,
      contas: shippingAccounts.length,
      contasProntas: readyShippingAccounts,
    },
    dominios: {
      total: numeric(domains.total),
      verificados: numeric(domains.verified),
      principal: domains.primary_verified || null,
    },
    saude: {
      banco: snapshot.databaseHealthy ? 'healthy' : 'unhealthy',
      webhooksComFalha: failedWebhooks,
      fulfillmentEmAtencao: fulfillmentAttention,
      pagamentosAguardando: pendingPayments,
    },
    prontidao: {
      percentual: readiness,
      pronto: blockers.length === 0,
      checks,
      bloqueadores: blockers,
      avisos: warnings,
    },
    links: {
      admin: '/admin/ecommerce',
      storefronts: '/admin/ecommerce?tab=stores',
      catalogo: '/admin/ecommerce?tab=catalog',
      estoque: '/admin/ecommerce?tab=inventory',
      pedidos: '/admin/ecommerce?tab=orders',
      fulfillment: '/admin/ecommerce?tab=shipping',
      pagamentos: '/admin/ecommerce?tab=payments',
      frete: '/admin/ecommerce?tab=shipping',
      dominios: '/admin/ecommerce?tab=domains',
    },
  };
}

export async function loadBarbeariaCommerceStatus(contextInput) {
  const context = tenantContext(contextInput);
  const values = [context.empresaId, context.lojaId || null];
  const [storefrontResult, aliases, catalog, inventory, orders, fulfillments, payments, webhooks, paymentAccounts, shippingMethods, shippingAccounts, domains, database] = await Promise.all([
    listStorefronts(readClient, context),
    db.queryRead(
      `SELECT a.storefront_id, a.alias, a.brand_key, a.ativo
         FROM commerce_storefront_aliases a
         JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
        WHERE a.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
        ORDER BY a.ativo DESC, a.atualizado_em DESC`,
      values,
    ),
    db.queryRead(
      `SELECT
         (SELECT COUNT(*)::int FROM commerce_products p WHERE p.empresa_id = $1 AND p.status <> 'archived') AS total_products,
         (SELECT COUNT(DISTINCT pc.product_id)::int
            FROM commerce_product_channels pc
            JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id
            JOIN commerce_products p ON p.empresa_id = pc.empresa_id AND p.id = pc.product_id AND p.status = 'active'
           WHERE pc.empresa_id = $1 AND pc.publicado = true AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)) AS published_products,
         (SELECT COUNT(*)::int FROM commerce_product_variants v JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id WHERE v.empresa_id = $1 AND v.ativo = true AND p.status <> 'archived') AS total_variants,
         (SELECT COUNT(DISTINCT v.id)::int
            FROM commerce_product_variants v
            JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active'
            JOIN commerce_product_channels pc ON pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.publicado = true
            JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id
           WHERE v.empresa_id = $1 AND v.ativo = true AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)) AS published_variants,
         (SELECT COUNT(DISTINCT v.id)::int
            FROM commerce_product_variants v
            JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active'
            JOIN commerce_product_channels pc ON pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.publicado = true
            JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id
           WHERE v.empresa_id = $1 AND v.ativo = true AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
             AND NOT EXISTS (
               SELECT 1 FROM commerce_variant_prices vp
                WHERE vp.empresa_id = v.empresa_id AND vp.variant_id = v.id AND vp.price_list_id = pc.price_list_id
                  AND vp.vigencia_inicio <= CURRENT_TIMESTAMP AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
             )) AS variants_without_price`,
      values,
    ),
    db.queryRead(
      `SELECT COUNT(DISTINCT l.id)::int AS locations,
              COUNT(DISTINCT il.variant_id)::int AS skus,
              COALESCE(SUM(il.disponivel), 0)::int AS available,
              COALESCE(SUM(il.reservado), 0)::int AS reserved,
              COALESCE(SUM(il.comprometido), 0)::int AS committed,
              COUNT(*) FILTER (WHERE COALESCE(il.disponivel, 0) <= COALESCE(il.minimo, 0))::int AS low_stock
         FROM commerce_inventory_locations l
         LEFT JOIN commerce_inventory_levels il ON il.empresa_id = l.empresa_id AND il.location_id = l.id
        WHERE l.empresa_id = $1 AND l.ativo = true AND ($2::uuid IS NULL OR l.loja_id = $2 OR l.loja_id IS NULL)`,
      values,
    ),
    db.queryRead(
      `SELECT o.status, COUNT(*)::int AS total
         FROM commerce_orders o
         JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
        WHERE o.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
        GROUP BY o.status`,
      values,
    ),
    db.queryRead(
      `SELECT f.status, COUNT(*)::int AS total
         FROM commerce_fulfillments f
         JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
         JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
        WHERE f.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
        GROUP BY f.status`,
      values,
    ),
    db.queryRead(
      `SELECT p.status, COUNT(*)::int AS total
         FROM commerce_payments p
         JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
         JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
        WHERE p.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)
        GROUP BY p.status`,
      values,
    ),
    db.queryRead(
      `SELECT
         (SELECT COUNT(*)::int FROM commerce_payment_webhooks WHERE empresa_id = $1 AND status = 'failed') AS payment_failed,
         (SELECT COUNT(*)::int FROM commerce_shipping_webhooks WHERE empresa_id = $1 AND status = 'failed') AS shipping_failed`,
      [context.empresaId],
    ),
    listPaymentAccounts(readClient, context),
    db.queryRead(
      `SELECT COUNT(*)::int AS total_methods,
              COUNT(*) FILTER (WHERE sm.ativo = true)::int AS active_methods,
              COUNT(*) FILTER (WHERE sm.ativo = true AND sm.tipo = 'pickup')::int AS pickup_methods
         FROM commerce_shipping_methods sm
         JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id
        WHERE sm.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)`,
      values,
    ),
    listShippingAccounts(readClient, context),
    db.queryRead(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE d.verificado_em IS NOT NULL)::int AS verified,
              MAX(d.dominio) FILTER (WHERE d.principal = true AND d.verificado_em IS NOT NULL) AS primary_verified
         FROM commerce_store_domains d
         JOIN commerce_storefronts s ON s.empresa_id = d.empresa_id AND s.id = d.storefront_id
        WHERE d.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2 OR s.loja_id IS NULL)`,
      values,
    ),
    db.queryRead('SELECT 1 AS ok'),
  ]);
  return buildBarbeariaCommerceStatus({
    generatedAt: new Date().toISOString(),
    context: { empresaId: context.empresaId, lojaId: context.lojaId || null },
    storefronts: storefrontResult.items,
    aliases: aliases.rows,
    catalog: catalog.rows[0] || {},
    inventory: inventory.rows[0] || {},
    orders: orders.rows,
    fulfillments: fulfillments.rows,
    payments: payments.rows,
    webhooks: webhooks.rows[0] || {},
    paymentAccounts: paymentAccounts.items,
    shipping: shippingMethods.rows[0] || {},
    shippingAccounts: shippingAccounts.items,
    domains: domains.rows[0] || {},
    databaseHealthy: database.rows[0]?.ok === 1,
  });
}

export function unavailableBarbeariaCommerceStatus(reason = 'temporariamente_indisponivel') {
  return {
    contrato: 'commerce-core-v1',
    fonteVerdade: 'commerce-core-postgresql',
    separado: true,
    estoqueCompartilhado: false,
    sincronizacaoAutomatica: false,
    status: reason,
    geradoEm: new Date().toISOString(),
    prontidao: { percentual: 0, pronto: false, checks: [], bloqueadores: [{ id: reason, label: reason === 'desativado' ? 'Commerce Core desativado' : reason === 'sem_permissao' ? 'Acesso de relatórios Commerce não concedido' : reason === 'sem_membership' ? 'Tenant ainda não provisionado para este usuário' : 'Commerce temporariamente indisponível' }], avisos: [] },
    links: { admin: '/admin/ecommerce' },
  };
}
