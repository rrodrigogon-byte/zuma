// Rotas do "Cérebro do atendente": configuração (liga/desliga, autonomia, teto),
// provedores de IA, ciclo de aprendizado, propostas para aprovar, memória por
// cliente (ver, contestar, apagar), grafo/próxima oferta e automações.
// Tudo por empresa: dados do Commerce (PostgreSQL) pelo contexto de permissão,
// dados da barbearia pelo id legado da empresa ativa.

import { parseRef } from './core/customer-360.js';
import {
  AUTOMATIONS, AUTONOMY_LEVELS, customerMemory, forgetCustomer, getBrainSettings, getFactPhone, memoryPhone, saveBrainSettings,
  searchCustomerMemory, setFactStatus,
} from './core/ai-memory.js';
import { routerStatus, spentTodayCents } from './core/ai-router.js';
import { currentDay, decideProposal, learningQuality, listLearningRuns, listProposals, previousDay, runLearningCycle } from './core/ai-learning.js';
import { autoApproveHighConfidenceLearnings, runTrexAutoLearner } from './core/trex-auto-learner.js';
import { automationResults, DAILY_CAP, runAutomationRound } from './core/ai-automations.js';
import { buildCustomerGraph, customerEgo, customerToken, customerView, graphSummary, isCustomerPhoneUnambiguous, nextBestOffers, PURCHASE_STATUSES } from './dino-grafo.js';
import { loadBrainExecutiveSources, loadBrainGraph } from './ai-brain-data.js';
import { buildExecutiveGraph } from './dino-grafo-executivo.js';
import { redactNetworkText, scopedCustomerRef } from './dino-grafo-rede.js';
import { runAiTask as defaultRunAiTask } from './core/ai-router.js';
import { matchesLegacyStoreScope } from './core/legacy-store-scope.js';
import { commerceEmpresaIdFromLegacy, commerceLojaIdFromLegacy } from './core/legacy-commerce-scope.js';

const BASE = '/api/admin/barbearia/cerebro-ia';
const GESTORES = new Set(['admin', 'organizador']);
const FORGET_CONFIRMATION = 'APAGAR';

function httpError(message, status = 400, code = 'CEREBRO_INVALID') {
  return Object.assign(new Error(message), { status, code });
}

function send(res, error) {
  const status = Number(error?.status) || (['PERMISSION_DENIED'].includes(error?.code) ? 403 : 500);
  if (status >= 500) console.warn('[Cérebro] erro:', String(error?.code || error?.message || 'erro').slice(0, 160));
  res.status(status).json({ error: status >= 500 ? 'Não foi possível concluir agora.' : error.message, code: error?.code || 'CEREBRO_ERROR' });
}

function operator(user) { return user ? `${user.nome || user.email || user.id} (${user.role})` : 'sistema'; }

function aggregateOffers(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const best = row?.melhor;
    const name = String(best?.nome || '').trim().slice(0, 100);
    const type = String(best?.tipo || 'produto').trim().slice(0, 40);
    if (!name) continue;
    const key = `${type}\u0000${name}`;
    const current = grouped.get(key) || { name, type, count: 0 };
    current.count += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 20);
}

function safeUnitLabel(scope, sources = {}) {
  const configuration = sources?.configuracao && typeof sources.configuracao === 'object' ? sources.configuracao : {};
  const stores = configuration.lojas && typeof configuration.lojas === 'object' ? configuration.lojas : {};
  const scopedStore = stores[String(scope?.legacyLoja || '')] || stores[String(scope?.lojaId || '')] || {};
  const candidates = [
    scopedStore.nomePublico, scopedStore.nome, scopedStore.name,
    configuration.nomeUnidade, configuration.nomePublico, configuration.nome,
  ];
  for (const candidate of candidates) {
    const label = String(candidate || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!label || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(label)) continue;
    if (/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d[\d\s().-]{7,}\d/.test(label)) continue;
    return label;
  }
  return 'Unidade ativa';
}

function keyForScopedCustomerRef(graph, scope, ref) {
  for (const key of graph?.customers?.keys?.() || []) {
    if (scopedCustomerRef(scope, key) === ref) return key;
  }
  return undefined;
}

function scopedOfferRows(rows, graph, scope) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const key = graph?.byToken?.get(row?.cliente?.chave);
    const ref = key === undefined ? null : scopedCustomerRef(scope, key);
    return ref ? { ...row, cliente: { ...row.cliente, chave: ref } } : null;
  }).filter(Boolean);
}

function scopedEgoResponse(ego, graph, scope) {
  const rawNodes = Array.isArray(ego?.nodes) ? ego.nodes : [];
  const rankByType = (type) => new Map(rawNodes.filter((node) => String(node?.tipo || '') === type)
    .map((node, index) => [String(node.id), index + 1]));
  const clientRanks = rankByType('cliente');
  const professionalRanks = rankByType('profissional');
  const ids = new Map();
  const nodes = [];
  for (const node of rawNodes) {
    const rawId = String(node?.id || '');
    if (!rawId) continue;
    const separator = rawId.indexOf(':');
    const prefix = separator > 0 ? rawId.slice(0, separator) : 'node';
    let id;
    if (prefix === 'c') {
      const key = graph?.byToken?.get(rawId.slice(separator + 1));
      const ref = key === undefined ? null : scopedCustomerRef(scope, key);
      if (!ref) continue;
      id = `c:${ref}`;
    } else {
      id = `${prefix}:${customerToken(`cerebro-ego|${scope.empresaId}|${scope.lojaId}|${rawId}`)}`;
    }
    ids.set(rawId, id);
    const tipo = String(node.tipo || 'outro');
    const rank = tipo === 'cliente' ? clientRanks.get(rawId) : tipo === 'profissional' ? professionalRanks.get(rawId) : null;
    const rotulo = tipo === 'cliente' ? `Cliente ${String(rank || 1).padStart(2, '0')}`
      : tipo === 'profissional' ? `Profissional ${String(rank || 1).padStart(2, '0')}`
        : tipo === 'interesse' ? 'Interesse agrupado'
          : redactNetworkText(node.rotulo, tipo === 'produto' ? 'Produto' : tipo === 'servico' ? 'Serviço' : 'Entidade observada');
    nodes.push({ id, tipo, rotulo });
  }
  const visible = new Set(nodes.map((node) => node.id));
  const links = (Array.isArray(ego?.links) ? ego.links : []).flatMap((link) => {
    const from = ids.get(link.from);
    const to = ids.get(link.to);
    if (!visible.has(from) || !visible.has(to)) return [];
    const peso = Number(link.peso);
    return [{ from, to, rel: String(link.rel || 'RELACAO').slice(0, 40), peso: Number.isFinite(peso) ? Math.max(0, peso) : null }];
  });
  return { truncado: Boolean(ego?.truncado), nodes, links };
}

function aiPayload(report) {
  const metrics = report.metrics || {};
  return {
    period: report.period,
    windows: {
      selectedPeriod: report.network?.windows?.selectedPeriod || null,
      relationshipHistory: report.network?.windows?.relationshipHistory || null,
      undatedRelationships: report.network?.windows?.undatedRelationships || null,
      currentOverduePosition: report.network?.windows?.currentOverduePosition || null,
      stockSnapshot: report.network?.windows?.stockSnapshot || null,
    },
    metrics: {
      customers: metrics.customers,
      operations: metrics.operations,
      finance: metrics.finance,
      commerce: metrics.commerce,
      inventory: {
        products: metrics.inventory?.products,
        lowStock: metrics.inventory?.lowStock,
        outOfStock: metrics.inventory?.outOfStock,
      },
      offers: (Array.isArray(metrics.offers) ? metrics.offers : []).map(({ type, count }) => ({ type, count })),
    },
    coverage: Object.fromEntries(Object.entries(report.quality?.sources || {}).map(([key, source]) => [key, source.status])),
    signals: (Array.isArray(report.signals) ? report.signals : []).map(({ area, severity }) => ({ area, severity })),
  };
}

function safeAnalysis(value) {
  const text = (input, max = 500) => (typeof input === 'string' ? input.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const array = (input) => (Array.isArray(input) ? input.filter((item) => typeof item === 'string').slice(0, 5).map((item) => text(item, 280)).filter(Boolean) : []);
  return { summary: text(value?.summary, 900), actions: array(value?.actions), caveats: array(value?.caveats) };
}

export function verifiedLegacyScope(req, context) {
  const user = req?.user || {};
  if (user.pgAccount === true || user.pgOperational === true) return null;
  const signedCompany = String(user.empresaId || '').trim();
  const commerceCompany = String(context?.empresaId || '').trim();
  const signedStore = String(user.lojaId || '').trim();
  const commerceStore = String(context?.lojaId || '').trim();
  if (matchesLegacyStoreScope({ legacyEmpresaId: signedCompany, legacyLojaId: signedStore, empresaId: commerceCompany, commerceLojaId: commerceStore })) {
    return { empresaId: signedCompany, lojaId: signedStore };
  }
  // O ERP da empresa fica sob o mesmo UUID do Commerce (convenção usada também pelo agendador
  // das automações). Valem ainda: a ponte explícita da Dino (id legado emp-kytto-001 / loja
  // dino-web-estoque) e o administrador da plataforma, cujo acesso à empresa e à unidade já foi
  // conferido pelo Commerce (requireCommercePermission) antes desta função.
  const bridgedCompany = commerceEmpresaIdFromLegacy(signedCompany);
  const bridgedStore = commerceLojaIdFromLegacy(signedStore, signedCompany);
  const sameAsCommerce = { legacyEmpresaId: commerceCompany, legacyLojaId: commerceStore, empresaId: commerceCompany, commerceLojaId: commerceStore };
  if (!matchesLegacyStoreScope(sameAsCommerce)) return null;
  const bridged = bridgedCompany === commerceCompany && bridgedStore === commerceStore;
  if (bridged || user.platformAdmin === true) return { empresaId: commerceCompany, lojaId: commerceStore };
  return null;
}

export function registerAiBrainRoutes(app, deps) {
  const {
    requireCommercePermission, audit = () => {}, commerceDb, runAutomationRound: runRound = runAutomationRound,
    listarAgendamentosBarbearia, loadGraph = null, loadExecutiveSources = loadBrainExecutiveSources,
    runAiTask = defaultRunAiTask, getBrainSettings: getSettings = getBrainSettings, getFactPhone: loadFactPhone = getFactPhone,
  } = deps;

  const note = (req, acao, detalhe) => { try { audit(req, acao, JSON.stringify(detalhe ?? {}).slice(0, 600)); } catch { /* auditoria não bloqueia */ } };

  function isGestor(req) { return Boolean(req.user && (req.user.platformAdmin || GESTORES.has(String(req.user.role || '')))); }

  async function scope(req, res, permission = 'customers.read') {
    if (!isGestor(req)) { res.status(403).json({ error: 'Disponível para administradores e gestores da empresa.', code: 'TENANT_MANAGER_REQUIRED' }); return null; }
    if (process.env.COMMERCE_CORE_ENABLED !== '1') { res.status(409).json({ error: 'O cérebro do atendente precisa do banco da loja (Commerce Core) ativo.', code: 'COMMERCE_REQUIRED' }); return null; }
    try {
      const context = await requireCommercePermission(req, permission);
      const legacyScope = verifiedLegacyScope(req, context);
      return {
        context, empresaId: context.empresaId, lojaId: context.lojaId || null,
        legacy: legacyScope?.empresaId || null, legacyLoja: legacyScope?.lojaId || null,
        legacyScopeVerified: Boolean(legacyScope),
      };
    } catch (error) {
      res.status(error?.code === 'PERMISSION_DENIED' ? 403 : 409).json({ error: 'Sem acesso ao banco da loja para esta empresa.', code: error?.code || 'COMMERCE_SCOPE' });
      return null;
    }
  }

  const graphFor = (s) => (loadGraph
    ? loadGraph(s)
    : loadBrainGraph({ legacyEmpresaId: s.legacy, empresaId: s.empresaId, legacyLojaId: s.legacyLoja, commerceLojaId: s.lojaId, legacyScopeVerified: s.legacyScopeVerified }, listarAgendamentosBarbearia ? { listarAgendamentos: listarAgendamentosBarbearia } : {}));

  function requireActiveStore(s) {
    if (!s?.lojaId) throw httpError('Selecione uma unidade ativa para consultar o grafo e as automações.', 409, 'STORE_SCOPE_REQUIRED');
  }

  async function executiveFor(s, days, now = new Date()) {
    requireActiveStore(s);
    const end = new Date(now);
    const start = new Date(end.valueOf() - days * 86400000);
    const from = start.toISOString();
    const to = end.toISOString();
    const loaded = await graphFor(s);
    const graphHistory = buildCustomerGraph(loaded.sources, { now: end, relationshipWindowDays: 365, includeUndated: false });
    const graphNetwork = buildCustomerGraph(loaded.sources, { now: end, relationshipWindowDays: 365, includeUndated: true });
    const candidates = nextBestOffers(graphHistory, { catalog: loaded.sources.catalog, services: loaded.sources.services, limit: 500 });
    const unverifiedStockOffers = candidates.filter((row) => row?.melhor?.tipo === 'produto' && row.melhor.estoqueConhecido !== true).length;
    const extra = await loadExecutiveSources({ scope: s, from, to, days, graphSources: loaded.sources });
    const graphStatus = extra.quality?.graph?.status || 'indisponivel';
    const recommendationSourceStatuses = ['catalogo', 'produtosLocais', 'services']
      .map((name) => loaded.sources?.quality?.fontes?.[name]?.status || 'desconhecido');
    const recommendationSourcesUnavailable = recommendationSourceStatuses.every((status) => status === 'indisponivel');
    const recommendationSourcesPartial = recommendationSourceStatuses.some((status) => status !== 'ok');
    const offerStatus = graphStatus === 'indisponivel' || recommendationSourcesUnavailable
      ? 'indisponivel'
      : candidates.length >= 500 || graphStatus !== 'ok' || recommendationSourcesPartial || unverifiedStockOffers > 0 ? 'limitado' : 'ok';
    const offerDetails = [];
    if (candidates.length >= 500) offerDetails.push('Limite de 500 recomendações observadas; a contagem de oportunidades é parcial.');
    if (recommendationSourcesPartial && !recommendationSourcesUnavailable) offerDetails.push('Catálogo, revenda local ou serviços com cobertura parcial/indisponível; a lista de oportunidades é incompleta.');
    if (unverifiedStockOffers > 0) offerDetails.push(`${unverifiedStockOffers} recomendação(ões) de produto sem saldo verificado; oportunidade não confirma disponibilidade.`);
    const quality = {
      ...extra.quality,
      offers: { status: offerStatus, records: candidates.length, unverifiedStockOffers,
        ...(offerDetails.length ? { detail: offerDetails.join(' ') } : {}) },
    };
    return buildExecutiveGraph({
      days, from, to, now: end, graph: graphSummary(graphHistory),
      schedule: extra.schedule, finance: extra.finance, cash: extra.cash,
      commerce: extra.commerce, offers: aggregateOffers(candidates), quality,
      graphModel: graphNetwork, graphSources: loaded.sources, businessLabel: safeUnitLabel(s, loaded.sources),
      scope: { empresaId: s.empresaId, lojaId: s.lojaId },
    });
  }

  async function whatsappLoja(s) {
    if (!s?.empresaId || !s?.lojaId) return null;
    const result = await commerceDb.queryRead(
      `SELECT loja_id FROM canais_integracao WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND status = 'ativo' ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
      [s.empresaId, s.lojaId],
    ).catch(() => ({ rows: [] }));
    const lojaId = String(result.rows[0]?.loja_id || '');
    return lojaId === String(s.lojaId) ? lojaId : null;
  }

  async function phoneFromRef(s, ref) {
    const parsed = parseRef(ref);
    if (!parsed) throw httpError('Cliente inválido.', 400, 'CUSTOMER_REF_INVALID');
    if (parsed.kind === 'tel') {
      const phone = memoryPhone(parsed.id);
      if (!phone || !s.lojaId) return '';
      const loaded = await graphFor(s);
      return isCustomerPhoneUnambiguous(loaded.graph, phone) ? phone : '';
    }
    if (parsed.kind === 'dino') {
      if (!s.legacyScopeVerified || !s.legacy || !s.legacyLoja) return '';
      const loaded = await graphFor(s);
      const cliente = (loaded.sources?.clients || []).find((client) => String(client.id) === String(parsed.id));
      const phone = memoryPhone(cliente?.telefone);
      return isCustomerPhoneUnambiguous(loaded.graph, phone) ? phone : '';
    }
    if (parsed.kind === 'loja') {
      if (!s.lojaId) return '';
      const result = await commerceDb.queryRead(
        `SELECT cc.telefone FROM commerce_customers cc
          WHERE cc.empresa_id = $1 AND cc.id = $2
            AND EXISTS (
              SELECT 1 FROM commerce_orders o
               WHERE o.empresa_id = cc.empresa_id AND o.customer_id = cc.id
                 AND o.loja_id = $3 AND o.status = ANY($4::text[])
            )
          LIMIT 1`,
        [s.empresaId, parsed.id, s.lojaId, PURCHASE_STATUSES],
      ).catch(() => ({ rows: [] }));
      const phone = memoryPhone(result.rows[0]?.telefone);
      if (!phone) return '';
      const loaded = await graphFor(s);
      return isCustomerPhoneUnambiguous(loaded.graph, phone) ? phone : '';
    }
    return '';
  }

  // ── Visão geral e configuração ──────────────────────────────────────────
  app.get(BASE, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      const [settings, quality, runs, gasto, uso] = await Promise.all([
        getBrainSettings(s.empresaId),
        learningQuality(s.empresaId, 30).catch(() => null),
        listLearningRuns(s.empresaId, 7).catch(() => []),
        spentTodayCents(s.empresaId),
        commerceDb.queryRead(
          `SELECT provedor, status, fallback, COUNT(*)::int AS chamadas, COALESCE(SUM(custo_centavos),0)::float AS custo
             FROM ai_router_runs WHERE empresa_id = $1 AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY provedor, status, fallback ORDER BY provedor`,
          [s.empresaId],
        ).then((r) => r.rows).catch(() => []),
      ]);
      res.json({
        settings, niveis: AUTONOMY_LEVELS,
        automacoes: Object.entries(AUTOMATIONS).map(([id, a]) => ({ id, ...a, ativa: settings.automacoes[id] === true })),
        ia: routerStatus(), gastoHojeCentavos: Math.round(gasto * 100) / 100, qualidade: quality, execucoes: runs, uso7dias: uso,
        tetoAutomacoesDia: DAILY_CAP,
      });
    } catch (error) { send(res, error); }
  });

  app.put(`${BASE}/config`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const before = await getBrainSettings(s.empresaId);
      const settings = await saveBrainSettings(s.empresaId, req.body || {}, operator(req.user));
      note(req, 'cerebro_ia_config', { antes: before, depois: settings });
      res.json({ settings });
    } catch (error) { send(res, error); }
  });

  // ── Aprendizado ─────────────────────────────────────────────────────────
  app.post(`${BASE}/aprender`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const hoje = currentDay();
      const ontem = previousDay();
      let dia = req.body?.dia;
      if (dia === 'hoje') dia = hoje;
      else if (dia === 'ontem') dia = ontem;
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia || ''))) {
        dia = undefined;
      }
      const result = await runLearningCycle({ empresaId: s.empresaId, ...(dia ? { dia } : {}), force: true });
      const trexLearner = await runTrexAutoLearner({
        empresaId: s.empresaId,
        lojaId: s.lojaId || null,
        dia: dia || hoje,
        force: true
      }).catch((e) => ({ erro: e?.message }));
      const autoAprovadas = await autoApproveHighConfidenceLearnings(s.empresaId).catch(() => 0);
      const consolidado = {
        ...result,
        trexAudit: trexLearner,
        propostasAutoAprovadas: autoAprovadas,
        diaExecutado: dia || ontem
      };
      note(req, 'cerebro_ia_aprender', consolidado);
      res.json(consolidado);
    } catch (error) { send(res, error); }
  });

  app.post(`${BASE}/reanalisar-historico-completo`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const { runFullHistoricalAnalysis } = await import('./core/trex-historical-learner.js');
      const resultado = await runFullHistoricalAnalysis({ empresaId: s.empresaId });
      note(req, 'cerebro_ia_reanalisar_historico', resultado);
      res.json(resultado);
    } catch (error) { send(res, error); }
  });

  app.get(`${BASE}/estatisticas-aprendizado`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      const { db } = await import('./core/database.js');
      const [fatosRes, resumosRes, clientesRes] = await Promise.all([
        db.queryRead(
          `SELECT categoria, count(*)::int as total FROM ai_customer_facts WHERE empresa_id = $1 GROUP BY categoria ORDER BY total DESC`,
          [s.empresaId]
        ).catch(() => ({ rows: [] })),
        db.queryRead(
          `SELECT resultado, count(*)::int as total FROM ai_conversation_summaries WHERE empresa_id = $1 GROUP BY resultado`,
          [s.empresaId]
        ).catch(() => ({ rows: [] })),
        db.queryRead(
          `SELECT count(distinct telefone)::int as clientes_com_fatos FROM ai_customer_facts WHERE empresa_id = $1`,
          [s.empresaId]
        ).catch(() => ({ rows: [{ clientes_com_fatos: 0 }] }))
      ]);
      const totalFatos = fatosRes.rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
      const totalResumos = resumosRes.rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
      res.json({
        ok: true,
        empresaId: s.empresaId,
        totalFatos,
        totalResumos,
        clientesComFatos: Number(clientesRes.rows[0]?.clientes_com_fatos || 0),
        categorias: fatosRes.rows,
        resultadosConversas: resumosRes.rows
      });
    } catch (error) { send(res, error); }
  });

  app.post(`${BASE}/trex/consolidar-aprendizado`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const { consolidateLearnedProposals, getDynamicLearnedGuidance } = await import('./core/trex-auto-learner.js');
      const resultado = await consolidateLearnedProposals(s.empresaId);
      const diretrizes = await getDynamicLearnedGuidance(s.empresaId);
      res.json({ ok: true, resultado, diretrizes });
    } catch (error) { send(res, error); }
  });

  app.get(`${BASE}/propostas`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try { res.json({ items: await listProposals(s.empresaId, { status: String(req.query.status || 'proposto') }) }); } catch (error) { send(res, error); }
  });

  app.post(`${BASE}/propostas/:id/decisao`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const result = await decideProposal(s.empresaId, req.params.id, { decisao: req.body?.decisao, proposta: req.body?.proposta, operador: operator(req.user) });
      note(req, 'cerebro_ia_proposta', { decisao: result.status, tipo: result.tipo });
      res.json(result);
    } catch (error) { send(res, error); }
  });

  // ── Memória por cliente (usada no Customer 360) ─────────────────────────
  app.get(`${BASE}/memoria/:ref`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      requireActiveStore(s);
      const phone = await phoneFromRef(s, req.params.ref);
      if (!phone) return res.json({ disponivel: false, motivo: 'sem_telefone', facts: [], summaries: [] });
      const memory = await customerMemory(s.empresaId, phone, { lojaId: s.lojaId });
      const q = String(req.query.q || '').trim();
      const busca = q ? await searchCustomerMemory(s.empresaId, phone, q, { lojaId: s.lojaId }) : null;
      res.json({ disponivel: true, facts: memory.facts, summaries: memory.summaries, busca });
    } catch (error) { send(res, error); }
  });

  app.patch(`${BASE}/memoria/fatos/:id`, async (req, res) => {
    const s = await scope(req, res, 'customers.write'); if (!s) return;
    try {
      requireActiveStore(s);
      const phone = await loadFactPhone(s.empresaId, req.params.id, s.lojaId);
      if (!phone) throw httpError('Fato não encontrado.', 404, 'NOT_FOUND');
      const loaded = await graphFor(s);
      if (!isCustomerPhoneUnambiguous(loaded.graph, phone)) throw httpError('Fato não encontrado.', 404, 'NOT_FOUND');
      const fact = await setFactStatus(s.empresaId, req.params.id, String(req.body?.status || ''), operator(req.user), s.lojaId);
      note(req, 'cerebro_ia_fato', { status: fact.status });
      res.json(fact);
    } catch (error) { send(res, error); }
  });

  app.delete(`${BASE}/memoria/:ref`, async (req, res) => {
    const s = await scope(req, res, 'customers.write'); if (!s) return;
    try {
      requireActiveStore(s);
      if (req.body?.confirmacao !== FORGET_CONFIRMATION) throw httpError(`Digite ${FORGET_CONFIRMATION} para confirmar.`, 400, 'CONFIRMATION_REQUIRED');
      const phone = await phoneFromRef(s, req.params.ref);
      if (!phone) throw httpError('Este cliente não tem telefone; não há memória do WhatsApp.', 400, 'NO_PHONE');
      const result = await forgetCustomer(s.empresaId, phone, { lojaId: s.lojaId });
      note(req, 'cerebro_ia_esquecer', { removidos: result.removidos, telefoneFinal: phone.slice(-4) });
      res.json({ ok: true, removidos: result.removidos });
    } catch (error) { send(res, error); }
  });

  // ── Grafo e próxima melhor oferta ───────────────────────────────────────
  app.get(`${BASE}/grafo`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      requireActiveStore(s);
      const { graph, sources } = await graphFor(s);
      const eligibleOffers = nextBestOffers(graph, { catalog: sources.catalog, services: sources.services, limit: Math.min(100, Number(req.query.limit) || 40) })
        .filter((row) => {
          const key = graph.byToken?.get(row?.cliente?.chave);
          return key !== undefined && isCustomerPhoneUnambiguous(graph, graph.customers.get(key)?.phone);
        });
      const ofertas = scopedOfferRows(eligibleOffers, graph, s);
      res.set('Cache-Control', 'no-store');
      const clientes = [...graph.customers.entries()].filter(([, customer]) => isCustomerPhoneUnambiguous(graph, customer?.phone)).slice(0, 200).map(([key, customer]) => ({
        ...customerView(customer, graph), chave: scopedCustomerRef(s, key),
      })).filter((customer) => customer.chave);
      res.json({ resumo: graphSummary(graph), ofertas, clientes, clientesLimitados: graph.customers.size > clientes.length });
    } catch (error) { send(res, error); }
  });

  app.get(`${BASE}/grafo/executivo`, async (req, res) => {
    const s = await scope(req, res, 'reports.read'); if (!s) return;
    try {
      requireActiveStore(s);
      const days = Number(req.query.dias || 30);
      if (![30, 90].includes(days)) throw httpError('dias deve ser 30 ou 90.', 400, 'PERIOD_INVALID');
      const result = await executiveFor(s, days);
      res.set('Cache-Control', 'no-store'); res.json(result);
    } catch (error) { send(res, error); }
  });
  app.post(`${BASE}/grafo/executivo/analisar`, async (req, res) => {
    const s = await scope(req, res, 'reports.read'); if (!s) return;
    try {
      requireActiveStore(s);
      // A segunda autorização é independente: a chamada pode gerar custo de IA.
      const actionScope = await requireCommercePermission(req, 'settings.write');
      if (String(actionScope?.empresaId || '') !== String(s.empresaId) || String(actionScope?.lojaId || '') !== String(s.lojaId || '')) {
        throw httpError('O escopo mudou durante a autorização.', 403, 'PERMISSION_DENIED');
      }
      const days = Number(req.body?.dias || 30);
      if (![30, 90].includes(days)) throw httpError('dias deve ser 30 ou 90.', 400, 'PERIOD_INVALID');
      const settings = await getSettings(s.empresaId);
      const capCents = Number(settings?.tetoDiarioCentavos);
      if (!Number.isFinite(capCents) || capCents < 0) throw httpError('Configure um teto diário de IA válido antes da análise.', 409, 'AI_BUDGET_NOT_CONFIGURED');
      const report = await executiveFor(s, days);
      const result = await runAiTask('previsao_gerencial', {
        empresaId: s.empresaId, capCents, json: true, maxTokens: 700,
        system: 'Analise somente os indicadores agregados fornecidos. Separe operações, caixa, pedidos e receitas/despesas pagas no período selecionado (30/90 dias), histórico relacional datado para clientes e oportunidades (até 365 dias), posição atual dos recebíveis vencidos na data da consulta e snapshot atual de estoque; não misture nem atribua os vencidos ao período 30/90. Relações sem data têm contagem temporal desconhecida. Não infira causalidade, probabilidades calibradas ou margem garantida. Não invente nomes, contatos ou ações individuais. Retorne JSON estrito com summary (string), actions (array de strings) e caveats (array de strings). Sugira apenas verificações agregadas e reversíveis para avaliação humana.',
        user: JSON.stringify(aiPayload(report)),
      });
      const analysis = safeAnalysis(result?.data);
      if (!analysis.summary && !analysis.actions.length && !analysis.caveats.length) throw httpError('A IA não retornou uma análise válida.', 503, 'AI_RESPONSE_INVALID');
      res.set('Cache-Control', 'no-store'); res.json({ analysis });
    } catch (error) {
      if (error?.code === 'BUDGET_EXCEEDED') return res.status(409).json({ error: 'O teto diário de IA foi atingido; os indicadores determinísticos continuam disponíveis.', code: error.code });
      if (error?.code === 'NO_PROVIDER_CONFIGURED') return res.status(503).json({ error: 'Nenhum provedor de IA está configurado; os indicadores determinísticos continuam disponíveis.', code: error.code });
      if (error?.code === 'ALL_PROVIDERS_FAILED') return res.status(503).json({ error: 'A análise por IA está indisponível; os indicadores determinísticos continuam disponíveis.', code: error.code });
      send(res, error);
    }
  });
  app.get(`${BASE}/grafo/cliente/:token`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      requireActiveStore(s);
      if (!/^k[0-9a-z]{4,30}$/.test(String(req.params.token || ''))) throw httpError('Cliente inválido.', 400, 'TOKEN_INVALID');
      const { graph, sources } = await graphFor(s);
      const key = keyForScopedCustomerRef(graph, s, req.params.token);
      if (key === undefined) throw httpError('Cliente não encontrado no grafo.', 404, 'NOT_FOUND');
      const customer = graph.customers.get(key);
      if (!isCustomerPhoneUnambiguous(graph, customer?.phone)) throw httpError('Cliente não encontrado no grafo.', 404, 'NOT_FOUND');
      const rawEgo = customerEgo(graph, customerToken(String(key)));
      if (!rawEgo) throw httpError('Cliente não encontrado no grafo.', 404, 'NOT_FOUND');
      const ego = scopedEgoResponse(rawEgo, graph, s);
      const rawOffer = nextBestOffers(graph, { catalog: sources.catalog, services: sources.services, limit: 500 })
        .find((row) => graph.byToken.get(row.cliente.chave) === key) || null;
      const ofertas = rawOffer ? scopedOfferRows([rawOffer], graph, s)[0] || null : null;
      const cliente = { ...customerView(customer, graph), chave: req.params.token };
      res.set('Cache-Control', 'no-store');
      res.json({ ego, ofertas, cliente });
    } catch (error) { send(res, error); }
  });

  // ── Automações ──────────────────────────────────────────────────────────
  app.get(`${BASE}/automacoes/previa`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      requireActiveStore(s);
      const lojaId = await whatsappLoja(s);
      if (!lojaId) {
        return res.json({ skipped: true, reason: 'canal_inativo', planned: [], identityCoverage: { status: 'indisponivel' },
          resultados: [], resultadosStatus: 'indisponivel', resultadosDetalhe: 'Sem canal WhatsApp ativo nesta unidade; histórico e prévia indisponíveis.', canalLoja: false });
      }
      const loaded = await graphFor(s);
      const round = await runRound({ empresaId: s.empresaId, lojaId, loadGraph: async () => loaded, dryRun: true });
      let log = [];
      let resultadosStatus = 'ok';
      try {
        log = (await commerceDb.queryRead(
          `SELECT automacao, telefone, status, motivo, criado_em FROM ai_automation_log
            WHERE empresa_id = $1 AND loja_id = $2 AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '90 days'`,
          [s.empresaId, s.lojaId],
        )).rows;
      } catch { resultadosStatus = 'indisponivel'; }
      const planned = (round.planned || []).map(({ telefone, ...item }) => ({ ...item, telefoneFinal: telefone.slice(-4) }));
      res.json({ ...round, planned, resultados: automationResults(log, loaded.graph),
        resultadosStatus,
        resultadosDetalhe: resultadosStatus === 'ok'
          ? 'O histórico e os limites exibidos consideram somente registros vinculados à unidade ativa; registros antigos sem unidade não são atribuídos.'
          : 'Não foi possível ler o histórico desta unidade; resultado indisponível, não zero.',
        canalLoja: Boolean(lojaId) });
    } catch (error) { send(res, error); }
  });

  app.post(`${BASE}/automacoes/executar`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      requireActiveStore(s);
      const lojaId = await whatsappLoja(s);
      if (!lojaId) return res.json({ skipped: true, reason: 'canal_inativo', queued: 0, blocked: 0 });
      const result = await runRound({ empresaId: s.empresaId, lojaId, loadGraph: () => graphFor(s) });
      note(req, 'cerebro_ia_automacoes', { queued: result.queued || 0, blocked: result.blocked || 0, reason: result.reason || null });
      res.json(result);
    } catch (error) { send(res, error); }
  });
}
