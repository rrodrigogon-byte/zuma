// Carrega, para uma empresa, tudo o que o grafo e as automações precisam:
// cadastro, agenda, comandas e balcão (store JSON da barbearia) + catálogo, pedidos
// e fatos da memória (PostgreSQL). Falha de uma fonte não derruba as outras.

import * as barbearia from './barbearia-erp-kytto.js';
import * as clientes from './clientes-contas-kytto.js';
import { listarCaixas } from './caixa-diario-kytto.js';
import { listarLancamentos } from './financeiro-central-kytto.js';
import { db } from './core/database.js';
import { scheduleStats } from './dino-bi.js';
import { buildCustomerGraph, PURCHASE_STATUSES } from './dino-grafo.js';
import { memoryPhone, whatsappConsentMap } from './core/ai-memory.js';
import { agendaSource as resolverFonteAgenda } from './core/barbershop-agenda.js';
import { matchesLegacyStoreScope } from './core/legacy-store-scope.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FINANCE_ROWS = 5000;
const MAX_CASH_ROWS = 500;
const MAX_INVENTORY_ROWS = 2000;
const MAX_ORDER_STATUS_ROWS = 100;
const MAX_APPOINTMENT_ROWS = 5000;

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.valueOf()) ? null : date;
}

function inWindow(value, from, to) {
  const date = asDate(value);
  return Boolean(date && date >= from && date < to);
}

function dayInWindow(value, from, to) {
  const day = String(value || '').slice(0, 10);
  return Boolean(day && day >= from && day <= to);
}

function state(name, status, records, detail = '') {
  const registros = records == null || !Number.isFinite(Number(records)) ? null : Number(records);
  return { status, registros, ...(detail ? { detail } : {}) };
}

function localProductSales(sources, from, to) {
  const counts = new Map();
  const add = (productId, at) => {
    if (!productId || !inWindow(at, from, to)) return;
    const key = `local:${productId}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const command of Array.isArray(sources.commands) ? sources.commands : []) {
    if (command.status !== 'paga') continue;
    for (const item of Array.isArray(command.itens) ? command.itens : []) {
      if (item.tipo === 'produto') add(item.produtoId, command.fechadaEm || command.atualizadoEm || command.criadoEm);
    }
  }
  for (const sale of Array.isArray(sources.retailSales) ? sources.retailSales : []) {
    if (sale.status !== 'pago' || sale.comandaId) continue;
    for (const item of Array.isArray(sale.itens) ? sale.itens : []) add(item.produtoId, sale.pagoEm || sale.criadoEm);
  }
  return counts;
}

function commerceProductSales(sources, from, to) {
  const counts = new Map();
  for (const order of Array.isArray(sources.orders) ? sources.orders : []) {
    if (!PURCHASE_STATUSES.includes(order.status) || !inWindow(order.criadoEm, from, to)) continue;
    for (const item of Array.isArray(order.itens) ? order.itens : []) {
      if (item.produtoId) counts.set(String(item.produtoId), (counts.get(String(item.produtoId)) || 0) + 1);
    }
  }
  return counts;
}

async function readList(name, loader, limit, fallback = []) {
  try {
    const result = await loader();
    const rows = Array.isArray(result) ? result : [];
    return {
      value: rows.slice(0, limit),
      quality: state(name, rows.length >= limit ? 'limitado' : 'ok', rows.length,
        rows.length >= limit ? `Limite de ${limit} registros; cobertura parcial.` : ''),
    };
  } catch {
    return { value: fallback, quality: state(name, 'indisponivel', null) };
  }
}

async function readQuery(name, queryRead, sql, params, limit) {
  try {
    const result = await queryRead(sql, params);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    return {
      value: rows.slice(0, limit),
      quality: state(name, rows.length >= limit ? 'limitado' : 'ok', rows.length,
        rows.length >= limit ? `Limite de ${limit} linhas; cobertura parcial.` : ''),
    };
  } catch {
    return { value: [], quality: state(name, 'indisponivel', null) };
  }
}

export async function loadCatalog(empresaId, lojaId = null) {
  if (!UUID.test(String(empresaId || ''))) return [];
  if (!UUID.test(String(lojaId || ''))) throw new Error('Unidade Commerce é obrigatória para ler o catálogo.');
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
  if (!UUID.test(String(lojaId || ''))) throw new Error('Unidade Commerce é obrigatória para ler pedidos.');
  const result = await db.queryRead(
    `SELECT o.id, o.status, cc.id AS "customerId", cc.metadados, regexp_replace(COALESCE(cc.telefone, ''), '\\D', '', 'g') AS telefone, cc.nome, o.criado_em AS "criadoEm",
            COALESCE(json_agg(json_build_object('produtoId', p.id, 'nome', oi.nome_snapshot, 'subtotal', oi.subtotal, 'categoria', cat.nome)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS itens
       FROM commerce_orders o
       JOIN commerce_customers cc ON cc.empresa_id = o.empresa_id AND cc.id = o.customer_id
       LEFT JOIN commerce_order_items oi ON oi.empresa_id = o.empresa_id AND oi.order_id = o.id
       LEFT JOIN commerce_product_variants v ON v.empresa_id = o.empresa_id AND v.id = oi.variant_id
       LEFT JOIN commerce_products p ON p.empresa_id = o.empresa_id AND p.id = v.product_id
       LEFT JOIN commerce_categories cat ON cat.empresa_id = p.empresa_id AND cat.id = p.category_id
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
  if (!UUID.test(String(lojaId || ''))) throw new Error('Unidade Commerce é obrigatória para ler fatos ativos.');
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
  const commerceLojaId = scope.commerceLojaId || scope.lojaId || null;
  const candidateLegacyCompany = scope.legacyEmpresaId || '';
  const candidateLegacyStore = scope.legacyLojaId || '';
  const legacyScopeVerified = scope.legacyScopeVerified === true
    && matchesLegacyStoreScope({ legacyEmpresaId: candidateLegacyCompany, legacyLojaId: candidateLegacyStore, empresaId: scope.empresaId, commerceLojaId });
  const legacy = legacyScopeVerified ? String(candidateLegacyCompany || '') : '';
  const legacyLojaId = legacyScopeVerified ? (candidateLegacyStore || undefined) : undefined;
  const legacyUnitUsable = legacyScopeVerified && Boolean(legacy) && (!commerceLojaId || Boolean(legacyLojaId));
  const commerceScopeUsable = UUID.test(String(scope.empresaId || '')) && UUID.test(String(commerceLojaId || ''));
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
  const readCommerce = (name, fn, fallback, limit = null) => {
    if (commerceScopeUsable) return read(name, fn, fallback, limit);
    quality.fontes[name] = { status: 'indisponivel', registros: null, detail: 'Empresa/unidade ativa ausente ou inválida; consulta Commerce sem filtro foi bloqueada.' };
    return Promise.resolve(fallback);
  };
  const listarClientes = deps.listarClientes || ((id) => clientes.listarClientes(id).map((c) => clientes.obterCliente(id, c.id) || c));
  const listarAgendamentos = deps.listarAgendamentos || ((id, filtros) => barbearia.listarAgendamentos(id, filtros));
  const queryRead = deps.queryRead || ((sql, params) => db.queryRead(sql, params));
  let agendaFonte = '';
  const loadAppointments = async () => {
    if (!commerceScopeUsable) throw new Error('Empresa/unidade Commerce ausente ou inválida para consultar a agenda.');
    if (!commerceLojaId) {
      if (!legacyScopeVerified || !legacy) throw new Error('Escopo legado não validado para consultar a agenda.');
      agendaFonte = 'barbearia';
      return listarAgendamentos(legacy, legacyLojaId ? { lojaId: legacyLojaId } : {});
    }
    agendaFonte = await (deps.agendaSource || resolverFonteAgenda)({
      legacyEmpresaId: legacy, legacyLojaId, empresaId: scope.empresaId, lojaId: commerceLojaId,
    }, { strictStoreMapping: true });
    if (agendaFonte === 'barbearia') {
      if (!legacyLojaId) throw new Error('Unidade ativa sem vínculo Kytto para ler a agenda legada.');
      return listarAgendamentos(legacy, { lojaId: legacyLojaId });
    }
    if (agendaFonte !== 'postgres') throw new Error('Fonte canônica de agenda indisponível.');
    const result = await queryRead(
      `SELECT a.id::text AS id, a.empresa_id::text AS empresa_id, a.loja_id::text AS loja_id,
              a.cliente_id::text AS cliente_id, a.cliente_nome, a.cliente_telefone,
              a.servico_id::text AS servico_id, s.nome AS servico_nome, s.preco::float AS servico_preco,
              a.usuario_profissional_id::text AS profissional_id, u.nome_completo AS profissional_nome,
              a.data_agendamento AS data_hora, a.status, a.duracao_minutos, a.valor::float AS valor, a.observacoes
         FROM agendamentos a
         LEFT JOIN servicos s ON s.id = a.servico_id AND s.empresa_id = a.empresa_id AND s.loja_id = a.loja_id
         LEFT JOIN usuarios u ON u.id = a.usuario_profissional_id AND u.empresa_id = a.empresa_id
          AND EXISTS (SELECT 1 FROM usuarios_lojas ul WHERE ul.usuario_id = u.id AND ul.loja_id = a.loja_id AND ul.ativo = true)
        WHERE a.empresa_id = $1 AND a.loja_id = $2 AND a.tipo_agendamento = 'barbearia'
        ORDER BY a.data_agendamento DESC, a.id LIMIT $3`,
      [scope.empresaId, commerceLojaId, MAX_APPOINTMENT_ROWS],
    );
    if (!Array.isArray(result?.rows)) throw new Error('Leitura da agenda PostgreSQL incompleta.');
    return result.rows
      .filter((row) => String(row.empresa_id || '') === String(scope.empresaId || '')
        && String(row.loja_id || '') === String(commerceLojaId))
      .map((row) => ({
        id: String(row.id || ''), clienteId: row.cliente_id ? String(row.cliente_id) : '',
        clienteNome: String(row.cliente_nome || ''), clienteTelefone: String(row.cliente_telefone || ''),
        servicoId: row.servico_id ? String(row.servico_id) : '', servicoNome: String(row.servico_nome || ''),
        servicoPreco: Number(row.servico_preco || 0), profissionalId: row.profissional_id ? String(row.profissional_id) : '',
        profissionalNome: String(row.profissional_nome || ''), dataHora: row.data_hora, status: String(row.status || ''),
        duracaoMinutos: Number(row.duracao_minutos || 30), valor: Number(row.valor || 0),
        observacoes: String(row.observacoes || ''), lojaId: String(row.loja_id || ''),
      }));
  };
  const [catalog, orders, rawFacts, consents] = await Promise.all([
    readCommerce('catalogo', () => (deps.loadCatalog || loadCatalog)(scope.empresaId, commerceLojaId), [], 2000),
    readCommerce('pedidos', () => (deps.loadOrders || loadOrders)(scope.empresaId, commerceLojaId), [], 5000),
    readCommerce('memoria', () => (deps.loadActiveFacts || loadActiveFacts)(scope.empresaId, commerceLojaId), [], 20000),
    readCommerce('consentimentos', () => (deps.loadConsents || whatsappConsentMap)(scope.empresaId), null),
  ]);
  // Memória só entra no grafo (e nas ofertas) de quem autorizou a personalização.
  const facts = consents ? rawFacts.filter((fact) => consents.get(memoryPhone(fact.telefone))?.personalizacao === true) : [];
  const local = read;
  const semUnidadeLegada = (name) => {
    quality.fontes[name] = { status: 'indisponivel', registros: null, detail: 'A unidade ativa não possui vínculo Kytto comprovado; a fonte legada não foi consultada sem filtro de loja.' };
    return [];
  };
  const localProducts = legacyUnitUsable
    ? await local('produtosLocais', () => (deps.listarProdutosRevenda || barbearia.listarProdutosRevenda)(legacy, { incluirInativos: false, ...(legacyLojaId ? { lojaId: legacyLojaId, incluirSemLoja: true } : {}) }), [])
    : semUnidadeLegada('produtosLocais');
  const scopedLocalProducts = legacyLojaId
    ? localProducts.filter((item) => String(item.lojaId || '') === String(legacyLojaId))
    : localProducts;
  if (scopedLocalProducts.length !== localProducts.length && quality.fontes.produtosLocais) {
    quality.fontes.produtosLocais = { ...quality.fontes.produtosLocais, status: 'limitado', registros: scopedLocalProducts.length, detail: 'Registros sem unidade ou de outra loja foram descartados; cobertura parcial.' };
  }
  const mergedCatalog = [...catalog];
  for (const item of scopedLocalProducts) {
    const minimum = item.estoqueMinimo == null || item.estoqueMinimo === '' ? null : Math.max(0, Number(item.estoqueMinimo) || 0);
    mergedCatalog.push({ id: `local:${item.id}`, nome: item.nome, categoria: item.categoria || 'Balcão', preco: Number(item.precoVenda || 0), custo: Number(item.custoUnitario || 0), estoque: Number(item.estoqueAtual || 0), estoqueMinimo: minimum, publicado: item.ativo !== false, origem: 'balcao' });
  }
  const identityClients = legacyUnitUsable
    ? await local('clients', () => listarClientes(legacy), [])
    : semUnidadeLegada('clients');
  const appointments = await local('appointments', loadAppointments, [], MAX_APPOINTMENT_ROWS);
  if (quality.fontes.appointments && agendaFonte) {
    quality.fontes.appointments.fonte = agendaFonte;
    const agendaFonteLabel = agendaFonte === 'postgres' ? 'PostgreSQL' : agendaFonte === 'barbearia' ? 'agenda JSON da Barbearia' : 'não identificada';
    quality.fontes.appointments.detail = [quality.fontes.appointments.detail, `Fonte canônica: ${agendaFonteLabel}.`].filter(Boolean).join(' ').slice(0, 220);
    if (!legacyScopeVerified && commerceLojaId && quality.fontes.appointments.status !== 'indisponivel') {
      quality.fontes.appointments.status = 'limitado';
      quality.fontes.appointments.detail = [quality.fontes.appointments.detail, 'Agenda legada não foi associada sem vínculo assinado de empresa/unidade.'].filter(Boolean).join(' ').slice(0, 220);
    }
  }
  const commands = legacyUnitUsable
    ? await local('commands', () => (deps.listarComandasBarbearia || barbearia.listarComandasBarbearia)(legacy, legacyLojaId ? { lojaId: legacyLojaId } : {}), [])
    : semUnidadeLegada('commands');
  const retailSales = legacyUnitUsable
    ? await local('retailSales', () => (deps.listarVendasRevenda || barbearia.listarVendasRevenda)(legacy, legacyLojaId ? { lojaId: legacyLojaId } : {}), [])
    : semUnidadeLegada('retailSales');
  // Reaplicar o filtro exato mesmo depois de validar o vínculo, por defesa em profundidade.
  const inLegacyStore = (rows) => legacyLojaId
    ? rows.filter((row) => String(row.lojaId || '') === String(legacyLojaId))
    : commerceLojaId ? [] : rows;
  const inStoreAppointments = (rows) => agendaFonte === 'postgres'
    ? rows.filter((row) => String(row.lojaId || '') === String(commerceLojaId))
    : inLegacyStore(rows);
  const scopedAppointments = inStoreAppointments(appointments);
  const scopedCommands = inLegacyStore(commands);
  const scopedRetailSales = inLegacyStore(retailSales);
  const scopedIds = new Set([...scopedAppointments, ...scopedCommands, ...scopedRetailSales].map(r => String(r.clienteId)));
  const services = legacyUnitUsable
    ? await local('services', () => (deps.listarServicos || barbearia.listarServicos)(legacy, { incluirInativos: false }), [])
    : semUnidadeLegada('services');
  const professionals = legacyUnitUsable
    ? await local('professionals', () => (deps.listarProfissionais || barbearia.listarProfissionais)(legacy, { incluirInativos: true }), [])
    : semUnidadeLegada('professionals');
  const professionalById = new Map(professionals.map((item) => [String(item.id), item]));
  for (const appointment of scopedAppointments) {
    if (appointment.profissionalId && appointment.profissionalNome && !professionalById.has(String(appointment.profissionalId))) {
      professionalById.set(String(appointment.profissionalId), { id: String(appointment.profissionalId), nome: appointment.profissionalNome });
    }
  }
  return {
    identityClients,
    clients: legacyLojaId || commerceLojaId ? identityClients.filter(c => scopedIds.has(String(c.id))) : identityClients,
    appointments: scopedAppointments,
    commands: scopedCommands,
    retailSales: scopedRetailSales,
    services,
    professionals: [...professionalById.values()],
    configuracao: legacyScopeVerified ? await local('configuracao', () => (deps.obterConfiguracao || barbearia.obterConfiguracao)(legacy), {}) : semUnidadeLegada('configuracao'),
    quality: { ...quality, estoqueLocalEscopo: legacyLojaId ? 'unidade_escopada' : commerceLojaId ? 'nao_mapeado' : 'indisponivel', memoriaEscopo: commerceScopeUsable ? 'somente_fatos_com_fonte_nesta_loja' : 'indisponivel' },
    catalog: mergedCatalog,
    orders,
    facts,
    consents,
  };
}

/** Dados extras da visão executiva. Cada fonte falha de forma independente e é limitada. */
export async function loadBrainExecutiveSources({ scope = {}, from, to, graphSources = {} } = {}, deps = {}) {
  const commerceEmpresaId = String(scope.empresaId || '');
  const commerceLojaId = scope.lojaId || scope.commerceLojaId || null;
  const candidateLegacyCompany = String(scope.legacy || scope.legacyEmpresaId || '');
  const candidateLegacyStore = scope.legacyLoja || scope.legacyLojaId || null;
  const legacyScopeVerified = scope.legacyScopeVerified === true
    && matchesLegacyStoreScope({ legacyEmpresaId: candidateLegacyCompany, legacyLojaId: candidateLegacyStore, empresaId: commerceEmpresaId, commerceLojaId });
  const legacyEmpresaId = legacyScopeVerified ? candidateLegacyCompany : '';
  const legacyLojaId = legacyScopeVerified ? candidateLegacyStore : null;
  const fromDate = asDate(from);
  const toDate = asDate(to);
  if (!fromDate || !toDate || fromDate >= toDate) throw Object.assign(new Error('Período inválido.'), { status: 400, code: 'PERIOD_INVALID' });
  if (!UUID.test(commerceEmpresaId) || !UUID.test(String(commerceLojaId || ''))) {
    throw Object.assign(new Error('Empresa e unidade ativa são obrigatórias para o grafo executivo.'), { status: 409, code: 'STORE_SCOPE_REQUIRED' });
  }
  const queryRead = deps.queryRead || ((sql, params) => db.queryRead(sql, params));
  const listLedger = deps.listLedger || listarLancamentos;
  const listCash = deps.listCash || listarCaixas;

  const legacyScopeUnavailable = (name) => ({ value: [], quality: state(name, 'indisponivel', null, 'A unidade ativa não tem vínculo Kytto comprovado; leitura legada sem filtro de loja foi bloqueada.') });
  const [financeResult, cashResult] = legacyLojaId ? await Promise.all([
    readList('finance', () => listLedger(legacyEmpresaId, { lojaId: legacyLojaId }), MAX_FINANCE_ROWS),
    readList('cash', async () => {
      const rows = await listCash(legacyEmpresaId, { status: 'fechado', lojaId: legacyLojaId });
      return rows.filter((row) => dayInWindow(row.data || row.fechadoEm || row.fechado_em, fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)));
    }, MAX_CASH_ROWS),
  ]) : [legacyScopeUnavailable('finance'), legacyScopeUnavailable('cash')];

  const scheduleQuality = graphSources.quality?.fontes?.appointments || state('appointments', 'indisponivel', null);
  const schedule = scheduleStats(Array.isArray(graphSources.appointments) ? graphSources.appointments : [], { fromDate, toDate });
  const orderSql = `SELECT o.status, COUNT(*)::int AS total
      FROM commerce_orders o
     WHERE o.empresa_id = $1 AND o.loja_id = $2
       AND o.criado_em >= $3::timestamptz AND o.criado_em < $4::timestamptz
     GROUP BY o.status ORDER BY o.status`;
  const paymentSql = `SELECT COUNT(*)::int AS transactions, COALESCE(SUM(p.amount), 0)::float AS amount
      FROM commerce_payments p
      JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
     WHERE p.empresa_id = $1 AND p.status = 'captured'
       AND o.loja_id = $2
       AND p.captured_at >= $3::timestamptz AND p.captured_at < $4::timestamptz`;
  const inventorySql = `SELECT p.id::text AS id, p.nome AS name,
            COALESCE(SUM(GREATEST(il.disponivel - il.reservado, 0)), 0)::int AS available,
            COALESCE(SUM(il.minimo), 0)::int AS minimum
       FROM commerce_inventory_levels il
       JOIN commerce_inventory_locations loc ON loc.empresa_id = il.empresa_id AND loc.id = il.location_id AND loc.ativo = true
       JOIN commerce_product_variants v ON v.empresa_id = il.empresa_id AND v.id = il.variant_id AND v.ativo = true
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
      WHERE il.empresa_id = $1 AND p.tipo = 'physical' AND p.status <> 'archived'
        AND loc.loja_id = $2
      GROUP BY p.id, p.nome
      ORDER BY (COALESCE(SUM(GREATEST(il.disponivel - il.reservado, 0)), 0) <= COALESCE(SUM(il.minimo), 0)) DESC, p.nome
      LIMIT ${MAX_INVENTORY_ROWS}`;

  let ordersResult = { value: [], quality: state('orders', 'indisponivel', null) };
  let paymentsResult = { value: [], quality: state('payments', 'indisponivel', null) };
  let inventoryResult = { value: [], quality: state('inventory', 'indisponivel', null) };
  if (UUID.test(commerceEmpresaId) && UUID.test(String(commerceLojaId))) {
    const params = [commerceEmpresaId, commerceLojaId, fromDate.toISOString(), toDate.toISOString()];
    [ordersResult, paymentsResult, inventoryResult] = await Promise.all([
      readQuery('orders', queryRead, orderSql, params, MAX_ORDER_STATUS_ROWS),
      readQuery('payments', queryRead, paymentSql, params, 2),
      readQuery('inventory', queryRead, inventorySql, [commerceEmpresaId, commerceLojaId], MAX_INVENTORY_ROWS),
    ]);
  }

  const commerceSold = commerceProductSales(graphSources, fromDate, toDate);
  const commerceInventory = inventoryResult.value.map((item) => ({ ...item, sold: commerceSold.get(String(item.id)) || 0 }));
  const localSold = localProductSales(graphSources, fromDate, toDate);
  const localProducts = (Array.isArray(graphSources.catalog) ? graphSources.catalog : [])
    .filter((item) => String(item.id || '').startsWith('local:'))
    .map((item) => ({
      id: String(item.id), name: String(item.nome || 'Produto local'),
      available: Math.max(0, Number(item.estoque) || 0),
      minimum: item.estoqueMinimo == null ? null : Math.max(0, Number(item.estoqueMinimo) || 0),
      sold: localSold.get(String(item.id)) || 0, origem: 'balcao',
    }));
  const localQuality = graphSources.quality?.fontes?.produtosLocais || state('localInventory', 'indisponivel', null);
  const localInventoryQuality = ['nao_mapeado', 'omitido_sem_vinculo_loja'].includes(graphSources.quality?.estoqueLocalEscopo)
    ? state('localInventory', 'indisponivel', null, 'Estoque de revenda não foi consultado porque falta vínculo seguro entre a unidade ativa e a loja Kytto.')
    : normalizeSource(localQuality);
  const inventoryQuality = inventoryResult.quality;
  if (inventoryQuality.status === 'ok' && inventoryResult.value.length === 0) {
    inventoryQuality.status = 'limitado';
    inventoryQuality.detail = 'Nenhum saldo de estoque em local ativo foi encontrado; não foi possível avaliar disponibilidade.';
  } else if (inventoryQuality.status === 'ok') {
    inventoryQuality.detail = 'Considera saldos registrados em locais ativos; produtos sem nível de estoque não são inferidos como saldo zero.';
  }
  const salesCoverage = [ordersResult.quality.status, graphSources.quality?.fontes?.pedidos?.status];
  if (inventoryQuality.status !== 'indisponivel' && salesCoverage.some((status) => status !== 'ok')) {
    inventoryQuality.status = 'limitado';
    inventoryQuality.detail = [inventoryQuality.detail, 'A demanda por produto depende de pedidos; uma das fontes de pedidos não tem cobertura completa.'].filter(Boolean).join(' ').slice(0, 220);
  }
  const orderStatusTotal = ordersResult.value.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const payment = paymentsResult.value[0] || null;
  return {
    schedule,
    finance: financeResult.value,
    cash: cashResult.value,
    commerce: {
      ordersByStatus: ordersResult.value,
      payments: payment ? { transactions: Number(payment.transactions) || 0, amount: Number(payment.amount) || 0 } : null,
      inventory: [...commerceInventory, ...localProducts],
    },
    quality: {
      graph: graphStatesQuality(graphSources),
      appointments: normalizeSource(scheduleQuality),
      finance: financeResult.quality,
      cash: cashResult.quality,
      orders: ordersResult.quality,
      payments: paymentsResult.quality,
      inventory: inventoryQuality,
      localInventory: localInventoryQuality,
      ...(orderStatusTotal === 0 && ordersResult.quality.status === 'ok' ? { orders: { ...ordersResult.quality, detail: 'Nenhum pedido no período.' } } : {}),
    },
  };
}

function normalizeSource(source) {
  const input = source && typeof source === 'object' ? source : {};
  const status = ['ok', 'limitado', 'indisponivel'].includes(input.status) ? input.status : 'indisponivel';
  const rawRecords = input.records ?? input.registros;
  const records = rawRecords == null || !Number.isFinite(Number(rawRecords)) ? null : Number(rawRecords);
  return { status, registros: records, ...(input.detail || input.detalhe ? { detail: String(input.detail || input.detalhe).slice(0, 220) } : {}) };
}

function graphStatesQuality(sources = {}) {
  const states = Object.values(sources.quality?.fontes || {}).map((item) => item?.status);
  if (!states.length) return state('graph', 'indisponivel', null);
  if (states.some((status) => status === 'indisponivel' || status === 'limitado')) {
    return state('graph', 'limitado', null, 'O grafo contém fontes com cobertura parcial ou indisponível.');
  }
  return state('graph', 'ok', Object.keys(sources.quality?.fontes || {}).length);
}

export async function loadBrainGraph(scope, deps = {}, { now = new Date() } = {}) {
  const sources = await loadBrainSources(scope, deps);
  return { sources, graph: buildCustomerGraph(sources, { now }) };
}
