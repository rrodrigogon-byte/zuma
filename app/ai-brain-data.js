// Carrega, para uma empresa, tudo o que o grafo e as automações precisam:
// cadastro, agenda, comandas e balcão (store JSON da barbearia) + catálogo, pedidos
// e fatos da memória (PostgreSQL). Falha de uma fonte não derruba as outras.

import * as barbearia from './barbearia-erp-kytto.js';
import * as clientes from './clientes-contas-kytto.js';
import { db } from './core/database.js';
import { buildCustomerGraph } from './dino-grafo.js';
import { memoryPhone, whatsappConsentMap } from './core/ai-memory.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function safe(promiseFactory, fallback) {
  try { return await promiseFactory(); } catch (error) {
    if (error?.code !== '42P01') console.warn('[Cérebro] fonte indisponível:', String(error?.code || error?.message || 'erro').slice(0, 80));
    return fallback;
  }
}

export async function loadCatalog(empresaId) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT p.id, p.nome, c.nome AS categoria, p.status = 'active' AS publicado,
            MIN(vp.preco)::float AS preco, MIN(NULLIF(vp.custo, 0))::float AS custo,
            COALESCE(SUM(GREATEST(il.disponivel - il.reservado, 0)), 0)::int AS estoque
       FROM commerce_products p
       LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
       LEFT JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id AND v.ativo = true
       LEFT JOIN LATERAL (
         SELECT preco, custo FROM commerce_variant_prices vp
          WHERE vp.empresa_id = p.empresa_id AND vp.variant_id = v.id
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
          ORDER BY vp.vigencia_inicio DESC NULLS LAST LIMIT 1
       ) vp ON true
       LEFT JOIN commerce_inventory_levels il ON il.empresa_id = p.empresa_id AND il.variant_id = v.id
      WHERE p.empresa_id = $1 AND p.tipo = 'physical' AND p.status <> 'archived'
      GROUP BY p.id, p.nome, c.nome, p.status
      LIMIT 2000`,
    [empresaId],
  );
  return result.rows;
}

export async function loadOrders(empresaId) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT regexp_replace(COALESCE(cc.telefone, ''), '\\D', '', 'g') AS telefone, cc.nome, o.criado_em AS "criadoEm",
            COALESCE(json_agg(json_build_object('nome', oi.nome_snapshot, 'subtotal', oi.subtotal, 'categoria', cat.nome)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS itens
       FROM commerce_orders o
       JOIN commerce_customers cc ON cc.empresa_id = o.empresa_id AND cc.id = o.customer_id
       LEFT JOIN commerce_order_items oi ON oi.empresa_id = o.empresa_id AND oi.order_id = o.id
       LEFT JOIN commerce_product_variants v ON v.empresa_id = o.empresa_id AND v.id = oi.variant_id
       LEFT JOIN commerce_products p ON p.empresa_id = o.empresa_id AND p.id = v.product_id
       LEFT JOIN commerce_categories cat ON cat.empresa_id = o.empresa_id AND cat.id = p.category_id
      WHERE o.empresa_id = $1 AND o.status NOT IN ('draft','cancelled','refunded','returned')
        AND o.criado_em >= CURRENT_TIMESTAMP - INTERVAL '365 days'
      GROUP BY o.id, cc.telefone, cc.nome, o.criado_em
      LIMIT 5000`,
    [empresaId],
  );
  return result.rows;
}

export async function loadActiveFacts(empresaId) {
  if (!UUID.test(String(empresaId || ''))) return [];
  const result = await db.queryRead(
    `SELECT telefone, categoria, valor, status, criado_em FROM ai_customer_facts
      WHERE empresa_id = $1 AND status = 'ativo' AND (valido_ate IS NULL OR valido_ate >= CURRENT_DATE)
      LIMIT 20000`,
    [empresaId],
  );
  return result.rows;
}

/**
 * @param {object} scope { legacyEmpresaId, empresaId (uuid do Commerce), lojaId }
 * @param {object} deps  funções opcionais (para testes ou para usar as mesmas do server)
 */
export async function loadBrainSources(scope = {}, deps = {}) {
  const legacy = String(scope.legacyEmpresaId || scope.empresaId || 'principal');
  const lojaId = scope.lojaId || undefined;
  const listarClientes = deps.listarClientes || ((id) => clientes.listarClientes(id).map((c) => clientes.obterCliente(id, c.id) || c));
  const listarAgendamentos = deps.listarAgendamentos || ((id, filtros) => barbearia.listarAgendamentos(id, filtros));
  const [catalog, orders, rawFacts, consents] = await Promise.all([
    safe(() => (deps.loadCatalog || loadCatalog)(scope.empresaId), []),
    safe(() => (deps.loadOrders || loadOrders)(scope.empresaId), []),
    safe(() => (deps.loadActiveFacts || loadActiveFacts)(scope.empresaId), []),
    safe(() => (deps.loadConsents || whatsappConsentMap)(scope.empresaId), null),
  ]);
  // Memória só entra no grafo (e nas ofertas) de quem autorizou a personalização.
  const facts = consents ? rawFacts.filter((fact) => consents.get(memoryPhone(fact.telefone))?.personalizacao === true) : [];
  const local = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  const localProducts = local(() => barbearia.listarProdutosRevenda(legacy, { incluirInativos: false }), []);
  const mergedCatalog = [...catalog];
  const seen = new Set(catalog.map((item) => String(item.nome).toLowerCase()));
  for (const item of localProducts) {
    if (seen.has(String(item.nome).toLowerCase())) continue;
    mergedCatalog.push({ id: `local:${item.id}`, nome: item.nome, categoria: item.categoria || 'Balcão', preco: Number(item.precoVenda || 0), custo: Number(item.custoUnitario || 0), estoque: Number(item.estoqueAtual || 0), publicado: item.ativo !== false, origem: 'balcao' });
  }
  return {
    clients: local(() => listarClientes(legacy), []),
    appointments: local(() => listarAgendamentos(legacy, lojaId ? { lojaId } : {}), []),
    commands: local(() => barbearia.listarComandasBarbearia(legacy, lojaId ? { lojaId } : {}), []),
    retailSales: local(() => barbearia.listarVendasRevenda(legacy, lojaId ? { lojaId } : {}), []),
    services: local(() => barbearia.listarServicos(legacy, { incluirInativos: false }), []),
    professionals: local(() => barbearia.listarProfissionais(legacy, { incluirInativos: true }), []),
    configuracao: local(() => barbearia.obterConfiguracao(legacy), {}),
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
