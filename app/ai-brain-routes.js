// Rotas do "Cérebro do atendente": configuração (liga/desliga, autonomia, teto),
// provedores de IA, ciclo de aprendizado, propostas para aprovar, memória por
// cliente (ver, contestar, apagar), grafo/próxima oferta e automações.
// Tudo por empresa: dados do Commerce (PostgreSQL) pelo contexto de permissão,
// dados da barbearia pelo id legado da empresa ativa.

import { parseRef } from './core/customer-360.js';
import {
  AUTOMATIONS, AUTONOMY_LEVELS, customerMemory, forgetCustomer, getBrainSettings, memoryPhone, saveBrainSettings,
  searchCustomerMemory, setFactStatus,
} from './core/ai-memory.js';
import { routerStatus, spentTodayCents } from './core/ai-router.js';
import { decideProposal, learningQuality, listLearningRuns, listProposals, runLearningCycle } from './core/ai-learning.js';
import { automationResults, DAILY_CAP, runAutomationRound } from './core/ai-automations.js';
import { customerEgo, graphSummary, nextBestOffers } from './dino-grafo.js';
import { loadBrainGraph } from './ai-brain-data.js';

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

export function registerAiBrainRoutes(app, deps) {
  const {
    legacyEmpresaId, legacyLojaId, requireCommercePermission, audit = () => {}, clientesKytto, commerceDb,
    listarAgendamentosBarbearia, loadGraph = null,
  } = deps;

  const note = (req, acao, detalhe) => { try { audit(req, acao, JSON.stringify(detalhe ?? {}).slice(0, 600)); } catch { /* auditoria não bloqueia */ } };

  function isGestor(req) { return Boolean(req.user && (req.user.platformAdmin || GESTORES.has(String(req.user.role || '')))); }

  async function scope(req, res, permission = 'customers.read') {
    if (!isGestor(req)) { res.status(403).json({ error: 'Disponível para administradores e gestores da empresa.', code: 'TENANT_MANAGER_REQUIRED' }); return null; }
    if (process.env.COMMERCE_CORE_ENABLED !== '1') { res.status(409).json({ error: 'O cérebro do atendente precisa do banco da loja (Commerce Core) ativo.', code: 'COMMERCE_REQUIRED' }); return null; }
    try {
      const context = await requireCommercePermission(req, permission);
      return { context, empresaId: context.empresaId, lojaId: context.lojaId || null, legacy: legacyEmpresaId(req), legacyLoja: legacyLojaId?.(req) };
    } catch (error) {
      res.status(error?.code === 'PERMISSION_DENIED' ? 403 : 409).json({ error: 'Sem acesso ao banco da loja para esta empresa.', code: error?.code || 'COMMERCE_SCOPE' });
      return null;
    }
  }

  const graphFor = (s) => (loadGraph
    ? loadGraph(s)
    : loadBrainGraph({ legacyEmpresaId: s.legacy, empresaId: s.empresaId, lojaId: s.legacyLoja }, listarAgendamentosBarbearia ? { listarAgendamentos: listarAgendamentosBarbearia } : {}));

  async function whatsappLoja(empresaId, fallback) {
    if (fallback) return fallback;
    const result = await commerceDb.queryRead(
      `SELECT loja_id FROM canais_integracao WHERE empresa_id = $1 AND provedor = 'whatsapp' ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
      [empresaId],
    ).catch(() => ({ rows: [] }));
    return result.rows[0]?.loja_id || null;
  }

  async function phoneFromRef(s, ref) {
    const parsed = parseRef(ref);
    if (!parsed) throw httpError('Cliente inválido.', 400, 'CUSTOMER_REF_INVALID');
    if (parsed.kind === 'tel') return memoryPhone(parsed.id);
    if (parsed.kind === 'dino') {
      const cliente = clientesKytto.obterCliente(s.legacy, parsed.id);
      return memoryPhone(cliente?.telefone);
    }
    if (parsed.kind === 'loja') {
      const result = await commerceDb.queryRead('SELECT telefone FROM commerce_customers WHERE empresa_id = $1 AND id = $2 LIMIT 1', [s.empresaId, parsed.id]).catch(() => ({ rows: [] }));
      return memoryPhone(result.rows[0]?.telefone);
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
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.dia || '')) ? req.body.dia : undefined;
      const result = await runLearningCycle({ empresaId: s.empresaId, ...(dia ? { dia } : {}), force: true });
      note(req, 'cerebro_ia_aprender', result);
      res.json(result);
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
      const phone = await phoneFromRef(s, req.params.ref);
      if (!phone) return res.json({ disponivel: false, motivo: 'sem_telefone', facts: [], summaries: [] });
      const memory = await customerMemory(s.empresaId, phone);
      const q = String(req.query.q || '').trim();
      const busca = q ? await searchCustomerMemory(s.empresaId, phone, q) : null;
      res.json({ disponivel: true, facts: memory.facts, summaries: memory.summaries, busca });
    } catch (error) { send(res, error); }
  });

  app.patch(`${BASE}/memoria/fatos/:id`, async (req, res) => {
    const s = await scope(req, res, 'customers.write'); if (!s) return;
    try {
      const fact = await setFactStatus(s.empresaId, req.params.id, String(req.body?.status || ''), operator(req.user));
      note(req, 'cerebro_ia_fato', { status: fact.status });
      res.json(fact);
    } catch (error) { send(res, error); }
  });

  app.delete(`${BASE}/memoria/:ref`, async (req, res) => {
    const s = await scope(req, res, 'customers.write'); if (!s) return;
    try {
      if (req.body?.confirmacao !== FORGET_CONFIRMATION) throw httpError(`Digite ${FORGET_CONFIRMATION} para confirmar.`, 400, 'CONFIRMATION_REQUIRED');
      const phone = await phoneFromRef(s, req.params.ref);
      if (!phone) throw httpError('Este cliente não tem telefone; não há memória do WhatsApp.', 400, 'NO_PHONE');
      const result = await forgetCustomer(s.empresaId, phone);
      note(req, 'cerebro_ia_esquecer', { removidos: result.removidos, telefoneFinal: phone.slice(-4) });
      res.json({ ok: true, removidos: result.removidos });
    } catch (error) { send(res, error); }
  });

  // ── Grafo e próxima melhor oferta ───────────────────────────────────────
  app.get(`${BASE}/grafo`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      const { graph, sources } = await graphFor(s);
      const ofertas = nextBestOffers(graph, { catalog: sources.catalog, services: sources.services, limit: Math.min(100, Number(req.query.limit) || 40) });
      res.json({ resumo: graphSummary(graph), ofertas });
    } catch (error) { send(res, error); }
  });

  app.get(`${BASE}/grafo/cliente/:token`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      if (!/^k[0-9a-z]{4,30}$/.test(String(req.params.token || ''))) throw httpError('Cliente inválido.', 400, 'TOKEN_INVALID');
      const { graph, sources } = await graphFor(s);
      if (!graph.byToken.has(req.params.token)) throw httpError('Cliente não encontrado no grafo.', 404, 'NOT_FOUND');
      const ego = customerEgo(graph, req.params.token);
      if (!ego) throw httpError('Cliente não encontrado no grafo.', 404, 'NOT_FOUND');
      const key = graph.byToken.get(req.params.token);
      const ofertas = nextBestOffers(graph, { catalog: sources.catalog, services: sources.services, limit: 500 })
        .find((row) => graph.byToken.get(row.cliente.chave) === key) || null;
      res.json({ ego, ofertas, cliente: ofertas?.cliente || null });
    } catch (error) { send(res, error); }
  });

  // ── Automações ──────────────────────────────────────────────────────────
  app.get(`${BASE}/automacoes/previa`, async (req, res) => {
    const s = await scope(req, res); if (!s) return;
    try {
      const lojaId = await whatsappLoja(s.empresaId, s.lojaId);
      const loaded = await graphFor(s);
      const round = await runAutomationRound({ empresaId: s.empresaId, lojaId, loadGraph: async () => loaded, dryRun: true });
      const log = await commerceDb.queryRead(
        `SELECT automacao, telefone, status, motivo, criado_em FROM ai_automation_log
          WHERE empresa_id = $1 AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '90 days'`,
        [s.empresaId],
      ).then((r) => r.rows).catch(() => []);
      const planned = (round.planned || []).map(({ telefone, ...item }) => ({ ...item, telefoneFinal: telefone.slice(-4) }));
      res.json({ ...round, planned, resultados: automationResults(log, loaded.graph), canalLoja: Boolean(lojaId) });
    } catch (error) { send(res, error); }
  });

  app.post(`${BASE}/automacoes/executar`, async (req, res) => {
    const s = await scope(req, res, 'settings.write'); if (!s) return;
    try {
      const lojaId = await whatsappLoja(s.empresaId, s.lojaId);
      const result = await runAutomationRound({ empresaId: s.empresaId, lojaId, loadGraph: () => graphFor(s) });
      note(req, 'cerebro_ia_automacoes', { queued: result.queued || 0, blocked: result.blocked || 0, reason: result.reason || null });
      res.json(result);
    } catch (error) { send(res, error); }
  });
}

