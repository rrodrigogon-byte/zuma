// Carrega, para uma empresa, tudo o que o grafo e as automações precisam:
// cadastro, agenda, comandas e balcão (store JSON da barbearia) + catálogo, pedidos
// e fatos da memória (PostgreSQL). Falha de uma fonte não derruba as outras.

import * as barbearia from './barbearia-erp-kytto.js';
import * as clientes from './clientes-contas-kytto.js';
import { db } from './core/database.js';
import { buildCustomerGraph, PURCHASE_STATUSES } from './dino-grafo.js';
import { memoryPhone, whatsappConsentMap } from './core/ai-memory.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadCatalog(empresaId, lojaId = null) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT DISTINCT ON (p.id) p.id, p.nome, c.nome AS categoria, p.status = 'active' AS publicado,
            vp.preco::float AS preco, NULLIF(vp.custo, 0)::float AS custo, stock.estoque
       FROM commerce_products p
       LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
       LEFT JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true
       LEFT JOIN LATERAL (
         SELECT COALESCE(vp.preco_promocional, vp.preco) AS preco, vp.custo FROM commerce_variant_prices vp
          JOIN commerce_price_lists pl ON pl.empresa_id = vp.empresa_id AND pl.id = vp.price_list_id AND pl.ativo = true
          WHERE vp.empresa_id = p.empresa_id AND vp.variant_id = v.id
            AND EXISTS (SELECT 1 FROM commerce_product_channels pc
              JOIN commerce_storefronts sf ON sf.empresa_id = pc.empresa_id AND sf.id = pc.storefront_id
              WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.publicado = true AND sf.status = 'active'
                AND pc.price_list_id = vp.price_list_id AND ($2::uuid IS NULL OR sf.loja_id = $2))
            AND (vp.vigencia_inicio IS NULL OR vp.vigencia_inicio <= CURRENT_TIMESTAMP)
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
          ORDER BY vp.vigencia_inicio DESC NULLS LAST LIMIT 1
       ) vp ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(GREATEST(il.disponivel - il.reservado, 0)), 0)::int AS estoque
         FROM commerce_inventory_levels il
         JOIN commerce_inventory_locations loc ON loc.empresa_id = il.empresa_id AND loc.id = il.location_id AND loc.ativo = true
         WHERE il.empresa_id = p.empresa_id AND il.variant_id = v.id AND ($2::uuid IS NULL OR loc.loja_id = $2)
       ) stock ON true
      WHERE p.empresa_id = $1 AND p.tipo = 'physical' AND p.status <> 'archived'
      ORDER BY p.id, (stock.estoque > 0 AND vp.preco > 0) DESC NULLS LAST, vp.preco ASC NULLS LAST, v.id LIMIT 2000`,
    [empresaId, lojaId],
  );
  return result.rows;
}

export async function loadOrders(empresaId, lojaId = null) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT o.id, o.status, cc.id AS "customerId", cc.metadados, regexp_replace(COALESCE(cc.telefone, ''), '\\D', '', 'g') AS telefone, cc.nome, o.criado_em AS "criadoEm",
            COALESCE(json_agg(json_build_object('produtoId', p.id, 'nome', oi.nome_snapshot, 'subtotal', oi.subtotal, 'categoria', cat.nome)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS itens
       FROM commerce_orders o
       JOIN commerce_customers cc ON cc.empresa_id = o.empresa_id AND cc.id = o.customer_id
       LEFT JOIN commerce_order_items oi ON oi.empresa_id = o.empresa_id AND oi.order_id = o.id
       LEFT JOIN commerce_product_variants v ON v.empresa_id = o.empresa_id AND v.id = oi.variant_id
       LEFT JOIN commerce_products p ON p.empresa_id = o.empresa_id AND p.id = v.product_id
       LEFT JOIN commerce_categories cat ON cat.empresa_id = o.empresa_id AND cat.id = p.category_id
      WHERE o.empresa_id = $1 AND o.status = ANY($3::text[])
        AND ($2::uuid IS NULL OR o.loja_id = $2)
        AND o.criado_em >= CURRENT_TIMESTAMP - INTERVAL '365 days'
      GROUP BY o.id, cc.id, cc.telefone, cc.nome, o.criado_em
      ORDER BY o.criado_em DESC, o.id LIMIT 5000`,
    [empresaId, lojaId, PURCHASE_STATUSES],
  );
  return result.rows;
}

export async function loadActiveFacts(empresaId, lojaId = null) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT f.telefone, f.categoria, f.valor, f.status, f.criado_em FROM ai_customer_facts f
      WHERE f.empresa_id = $1 AND f.status = 'ativo' AND (valido_ate IS NULL OR valido_ate >= CURRENT_DATE)
      AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM ai_conversation_summaries s WHERE s.empresa_id = f.empresa_id AND s.id = f.fonte_resumo_id AND s.loja_id = $2))
      ORDER BY f.criado_em DESC, f.id LIMIT 20000`,
    [empresaId, lojaId],
  );
  return result.rows;
}

/**
 * @param {object} scope { legacyEmpresaId, empresaId (uuid do Commerce), lojaId }
 * @param {object} deps  funções opcionais (para testes ou para usar as mesmas do server)
 */
export async function loadBrainSources(scope = {}, deps = {}) {
  const legacy = String(scope.legacyEmpresaId || scope.empresaId || 'principal');
  const lojaId = scope.legacyLojaId || scope.lojaId || scope.commerceLojaId || undefined;
  const commerceLojaId = scope.commerceLojaId || null;
  const quality = { fontes: {} };
  const read = async (name, fn, fallback, limit = null) => {
    try {
      const value = await fn();
      quality.fontes[name] = { status: limit && value?.length >= limit ? 'limitado' : 'ok', registros: Array.isArray(value) ? value.length : value instanceof Map ? value.size : null };
      return value;
    } catch {
      quality.fontes[name] = { status: 'indisponivel', registros: null };
      return fallback;
    }
  };
  const listarClientes = deps.listarClientes || ((id) => clientes.listarClientes(id).map((c) => clientes.obterCliente(id, c.id) || c));
  const listarAgendamentos = deps.listarAgendamentos || ((id, filtros) => barbearia.listarAgendamentos(id, filtros));
  const [catalog, orders, rawFacts, consents] = await Promise.all([
    read('catalogo', () => (deps.loadCatalog || loadCatalog)(scope.empresaId, commerceLojaId), [], 2000),
    read('pedidos', () => (deps.loadOrders || loadOrders)(scope.empresaId, commerceLojaId), [], 5000),
    read('memoria', () => (deps.loadActiveFacts || loadActiveFacts)(scope.empresaId, commerceLojaId), [], 20000),
    read('consentimentos', () => (deps.loadConsents || whatsappConsentMap)(scope.empresaId), null),
  ]);
  // Memória só entra no grafo (e nas ofertas) de quem autorizou a personalização.
  const facts = consents ? rawFacts.filter((fact) => consents.get(memoryPhone(fact.telefone))?.personalizacao === true) : [];
  const local = read;
  const localProducts = await local('produtosLocais', () => lojaId ? [] : (deps.listarProdutosRevenda || barbearia.listarProdutosRevenda)(legacy, { incluirInativos: false }), []);
  const mergedCatalog = [...catalog];
  for (const item of localProducts) {
    mergedCatalog.push({ id: `local:${item.id}`, nome: item.nome, categoria: item.categoria || 'Balcão', preco: Number(item.precoVenda || 0), custo: Number(item.custoUnitario || 0), estoque: Number(item.estoqueAtual || 0), publicado: item.ativo !== false, origem: 'balcao' });
  }
  const identityClients = await local('clients', () => listarClientes(legacy), []);
  const appointments = await local('appointments', () => listarAgendamentos(legacy, lojaId ? { lojaId } : {}), []);
  const commands = await local('commands', () => (deps.listarComandasBarbearia || barbearia.listarComandasBarbearia)(legacy, lojaId ? { lojaId } : {}), []);
  const retailSales = await local('retailSales', () => (deps.listarVendasRevenda || barbearia.listarVendasRevenda)(legacy, lojaId ? { lojaId } : {}), []);
  // O legado admite registros sem loja no filtro; o grafo não pode atribuí-los a uma loja.
  const inStore = rows => lojaId ? rows.filter(r => String(r.lojaId || '') === String(lojaId)) : rows;
  const scopedIds = new Set([...inStore(appointments), ...inStore(commands), ...inStore(retailSales)].map(r => String(r.clienteId)));
  return {
    identityClients,
    clients: lojaId || commerceLojaId ? identityClients.filter(c => scopedIds.has(String(c.id))) : identityClients,
    appointments: inStore(appointments),
    commands: inStore(commands),
    retailSales: inStore(retailSales),
    services: await local('services', () => (deps.listarServicos || barbearia.listarServicos)(legacy, { incluirInativos: false }), []),
    professionals: await local('professionals', () => (deps.listarProfissionais || barbearia.listarProfissionais)(legacy, { incluirInativos: true }), []),
    configuracao: await local('configuracao', () => (deps.obterConfiguracao || barbearia.obterConfiguracao)(legacy), {}),
    quality: { ...quality, estoqueLocalEscopo: lojaId ? 'omitido_sem_vinculo_loja' : 'empresa', memoriaEscopo: commerceLojaId ? 'somente_fatos_com_fonte_nesta_loja' : 'empresa' },
    catalog: mergedCatalog,
    orders,
    facts,
    consents,
  };
}

export async function loadBrainGraph(scope, deps = {}, { now = new Date() } = {}) {
  const sources = await loadBrainSources(scope, deps);
  return { sources, graph: buildCustomerGraph(sources, { now }) };
}

