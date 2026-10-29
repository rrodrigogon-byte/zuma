// Rotas do Customer 360. Montadas dentro de /api/admin/barbearia, portanto
// herdam auth + requireStaff + resolverEscopoBarbearia (empresa/unidade da
// sessão) já aplicados no server.js. Leitura mascarada por padrão; toda ação
// sobre dados pessoais fica auditada.

import {
  anonymizeCommerceCustomers,
  auditCustomerAccess,
  buildCustomer360,
  buildPortfolio,
  duplicateSuggestions,
  loadCommerceAccessHistory,
  loadCommerceDirectory,
  loadCommerceFacets,
  loadCommercePortfolioMetrics,
  localMetricsByClient,
  maskEmail,
  maskPhone,
  mergeCustomerDirectory,
  normalizePhone,
  parseRef,
  queryPortfolio,
  resolveIdentity,
  revealField,
  searchCustomerDirectory,
  summarizePortfolio,
} from './core/customer-360.js';
import * as store from './customer360-store.js';
import { montarHistoricoCliente } from './cliente-historico-kytto.js';

const MANAGE_ROLES = new Set(['admin', 'organizador']);

const EQUIVALENCIAS_DINO = new Set([
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  'emp-kytto-001',
  'dino',
]);

function empresasEquivalentes(empresaId) {
  const chave = String(empresaId || '');
  if (EQUIVALENCIAS_DINO.has(chave)) return Array.from(EQUIVALENCIAS_DINO);
  return [chave];
}
const EXPORT_ROLES = new Set(['admin']);
const REVEAL_FIELDS = new Set(['telefone', 'email', 'documento', 'endereco']);
const ANON_CONFIRMATION = 'ANONIMIZAR';

export function canReveal(user) { return Boolean(user && (user.platformAdmin || MANAGE_ROLES.has(user.role))); }
export const canManage = canReveal;
export function canExport(user) { return Boolean(user && (user.platformAdmin || EXPORT_ROLES.has(user.role))); }

function operatorLabel(user) {
  return user ? `${user.nome || user.email || user.id} (${user.role})` : 'anônimo';
}

function httpError(message, status = 400, code = 'CUSTOMER360_INVALID') {
  return Object.assign(new Error(message), { status, code });
}

/**
 * @param {import('express').Express} app
 * @param {object} deps funções já existentes no server.js (injeção para manter o server intacto e testável)
 */
export function registerCustomer360Routes(app, deps) {
  const {
    legacyEmpresaId, legacyLojaId, clientesKytto, barbeariaErpKytto, canaisFidelidadeKytto,
    listarAgendamentosBarbearia, requireCommercePermission, audit, save,
    coberturasDoCliente = null,
    commerceEnabled = () => process.env.COMMERCE_CORE_ENABLED === '1',
    customerStore = store,
  } = deps;
  const BASE = '/api/admin/barbearia/clientes-360';

  async function commerceContext(req, permission = 'customers.read') {
    if (!commerceEnabled()) return { context: null, reason: 'desativado' };
    try {
      return { context: await requireCommercePermission(req, permission), reason: null };
    } catch (error) {
      const code = String(error?.code || '');
      if (code === 'PERMISSION_DENIED') throw httpError('Seu perfil não tem acesso ao Customer 360.', 403, 'CUSTOMER360_FORBIDDEN');
      if (['TENANT_CONTEXT_REQUIRED', 'TENANT_SELECTION_REQUIRED', 'STORE_SELECTION_REQUIRED', 'STORE_SCOPE_MISMATCH'].includes(code)) {
        throw httpError('Selecione uma empresa e loja autorizadas antes de consultar clientes.', 403, 'CUSTOMER360_SCOPE_REQUIRED');
      }
      throw httpError('A autorização Commerce está temporariamente indisponível.', 503, 'CUSTOMER360_COMMERCE_UNAVAILABLE');
    }
  }

  function localClients(req) {
    const empresaId = legacyEmpresaId(req);
    const empresas = empresasEquivalentes(empresaId);
    const map = new Map();
    for (const emp of empresas) {
      try {
        const lista = clientesKytto.listarClientes(emp);
        for (const cliente of lista) {
          if (!cliente.padrao && cliente.id !== 'cli-padrao-balcao' && !map.has(cliente.id)) {
            map.set(cliente.id, clientesKytto.obterCliente(emp, cliente.id) || cliente);
          }
        }
      } catch {}
    }
    return Array.from(map.values());
  }

  async function sourcesFor(req, { query = '', limit = 500 } = {}) {
    const { context, reason } = await commerceContext(req);
    let commerceCustomers = [];
    let commerceStatus = { disponivel: Boolean(context), motivo: context ? null : reason };
    if (context) {
      try { commerceCustomers = await loadCommerceDirectory(context, { query, limit }); }
      catch (error) {
        if (['PERMISSION_DENIED', 'TENANT_CONTEXT_REQUIRED', 'TENANT_SELECTION_REQUIRED', 'STORE_SELECTION_REQUIRED', 'STORE_SCOPE_MISMATCH'].includes(error?.code)) {
          throw httpError('Escopo Commerce não autorizado para consulta de clientes.', 403, 'CUSTOMER360_FORBIDDEN');
        }
        commerceStatus = { disponivel: false, motivo: 'temporariamente_indisponivel' };
        console.warn('Customer 360: diretório Commerce indisponível:', error?.code || error?.message);
      }
    }
    return { context, commerceCustomers, commerceStatus, locals: localClients(req), rules: customerStore.identityRules(legacyEmpresaId(req)) };
  }

  function localData(req, { includeHistorical = false, customerId = '' } = {}) {
    const empresaId = legacyEmpresaId(req);
    const empresas = empresasEquivalentes(empresaId);
    const lojaId = legacyLojaId(req);
    const fidelidade = canaisFidelidadeKytto.obterFidelidade(empresaId);

    const appointments = [];
    const comandas = [];
    const retailSales = [];
    let historicalCustomer = null;
    const historicalAppointments = [];
    const servicesMap = new Map();
    const productsMap = new Map();
    const receivables = [];

    for (const emp of empresas) {
      try { appointments.push(...listarAgendamentosBarbearia(emp, { lojaId })); } catch {}
      try { comandas.push(...barbeariaErpKytto.listarComandasBarbearia(emp, { lojaId })); } catch {}
      try { retailSales.push(...barbeariaErpKytto.listarVendasRevenda(emp, { lojaId })); } catch {}
      if (includeHistorical && customerId) {
        try { historicalAppointments.push(...(barbeariaErpKytto.listarHistoricoAtendimentos?.(emp, { lojaId, clienteId: customerId, limite: 50000 }) || [])); } catch {}
      }
      try {
        for (const s of (barbeariaErpKytto.listarServicos?.(emp, { incluirInativos: true }) || [])) {
          if (!servicesMap.has(s.id)) servicesMap.set(s.id, s);
        }
      } catch {}
      try {
        for (const p of (barbeariaErpKytto.listarProdutosRevenda?.(emp, { incluirInativos: true }) || [])) {
          if (!lojaId || !p.lojaId || String(p.lojaId) === String(lojaId)) {
            if (!productsMap.has(p.id)) productsMap.set(p.id, p);
          }
        }
      } catch {}
      try { receivables.push(...clientesKytto.listarContasReceber(emp)); } catch {}
    }

    return {
      appointments,
      comandas,
      retailSales,
      historicalAppointments,
      historicalCustomer,
      services: Array.from(servicesMap.values()),
      products: Array.from(productsMap.values()),
      storeId: lojaId,
      receivables,
      fidelidade,
    };
  }

  async function loadProfile(req, ref) {
    const parsed = parseRef(ref);
    if (!parsed) return { status: 400, body: { error: 'Identificador de cliente inválido.', code: 'CUSTOMER360_REF_INVALID' } };
    const { context, commerceCustomers, commerceStatus, locals, rules } = await sourcesFor(req, { limit: 5000 });
    let commerceList = commerceCustomers;
    if (context && parsed.kind === 'loja' && !commerceList.some((item) => item.id === parsed.id)) {
      try { commerceList = [...commerceList, ...(await loadCommerceDirectory(context, { query: parsed.id, limit: 5 })).filter((item) => item.id === parsed.id)]; } catch { /* segue degradado */ }
    }
    let identity = resolveIdentity(parsed, { localClients: locals, commerceCustomers: commerceList, ...rules });
    if (!identity && parsed.kind === 'dino') {
      const matchLocal = locals.find((item) => String(item.id) === parsed.id || String(item.clienteId) === parsed.id);
      if (matchLocal?.telefone) {
        const phoneParsed = parseRef(`tel:${matchLocal.telefone}`);
        if (phoneParsed) identity = resolveIdentity(phoneParsed, { localClients: locals, commerceCustomers: commerceList, ...rules });
      }
    }
    if (!identity) return { status: 404, body: { error: 'Cliente não encontrado nesta empresa.', code: 'CUSTOMER360_NOT_FOUND' } };

    const empresaId = legacyEmpresaId(req);
    const singleLocalId = identity.local.length === 1 ? String(identity.local[0].id) : '';
    const data = localData(req, { includeHistorical: Boolean(singleLocalId), customerId: singleLocalId });
    const localIds = new Set(identity.local.map((item) => String(item.id)));
    const phones = new Set(identity.phones);
    
    // Injeta histórico do Avec se a base JSON estiver vazia para esse cliente
    if (!data.historicalAppointments.length) {
      try {
        const { carregarBaseConsolidada } = await import('./dino-recuperacao-avec.js');
        const base = await carregarBaseConsolidada();
        const qTel = identity.phones[0] ? identity.phones[0].slice(-8) : '';
        const qNome = identity.names?.[0] ? identity.names[0] : (identity.local[0]?.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const cli = base.find((c) => {
          if (singleLocalId && (c.key === singleLocalId || c.key.includes(singleLocalId))) return true;
          if (qTel && c.telefone && c.telefone.includes(qTel)) return true;
          if (qNome && c.nome && c.nome.toLowerCase().includes(qNome)) return true;
          return false;
        });
        if (cli && cli.historicoItens?.length) {
          data.historicalAppointments = cli.historicoItens.map((h, i) => ({
            id: `avec-${cli.key}-${i}`,
            clienteId: singleLocalId || '',
            clienteTelefone: cli.telefone,
            clienteNome: cli.nome,
            dataAgenda: h.data,
            hora: h.hora || '10:00',
            servicoNome: h.servico,
            profissionalNome: h.profissional,
            valor: h.total,
            comandaId: h.comanda,
            origem: 'avec',
          }));
        }
      } catch (e) { console.error('Erro ao injetar histórico Avec no C360:', e); }
    }
    const belongs = (item) => (item.clienteId && localIds.has(String(item.clienteId))) || (!item.clienteId && item.clienteTelefone && phones.has(normalizePhone(item.clienteTelefone)));
    const member = data.fidelidade.membros.find((item) => localIds.has(String(item.clienteId))) || data.fidelidade.membros.find((item) => item.telefone && phones.has(normalizePhone(item.telefone))) || null;
    const planos = barbeariaErpKytto.listarPlanos(empresaId, { incluirInativos: true });
    const local = {
      appointments: data.appointments.filter(belongs),
      comandas: data.comandas.filter(belongs),
      retailSales: data.retailSales.filter(belongs),
      historicalAppointments: data.historicalAppointments.filter(belongs),
      services: data.services,
      products: data.products,
      storeId: data.storeId,
      receivables: data.receivables.filter((item) => localIds.has(String(item.clienteId))),
      loyaltyMember: member,
      loyaltyMoves: member ? data.fidelidade.movimentos.filter((item) => item.membroId === member.id) : [],
      subscriptions: barbeariaErpKytto.listarAssinaturas(empresaId, {}).filter((item) => localIds.has(String(item.clienteId)))
        .map((item) => ({ ...item, planoNome: planos.find((plano) => plano.id === item.planoId)?.nome || '' })),
    };
    const commerceFacets = context
      ? await loadCommerceFacets(context, { customerIds: identity.commerce.map((item) => item.id), phones: identity.phones, emails: identity.emails })
      : Object.fromEntries(['orders', 'credit', 'loyalty', 'carts', 'whatsapp', 'campaigns', 'consents'].map((key) => [key, { unavailable: true, items: [], reason: commerceStatus.motivo }]));
    const allRefs = [...new Set([identity.ref, identity.canonicalRef, ...identity.refs, ...identity.phones.map((phone) => `tel:${phone}`)])].filter(Boolean);
    return { identity, local, commerce: commerceFacets, context, commerceStatus, allRefs, comandasUnidade: data.comandas };
  }

  // Histórico completo (consumo, família, gostos e sugestões de venda). Se falhar,
  // a ficha continua abrindo com o que já mostrava antes.
  function historicoDaFicha(req, loaded, profile) {
    try {
      const empresaId = legacyEmpresaId(req);
      const cliente = loaded.identity.local.find((item) => !item.anonimizadoEm) || null;
      const coberturas = coberturasDoCliente && cliente
        ? loaded.identity.local.flatMap((item) => { try { return coberturasDoCliente(empresaId, item.id) || []; } catch { return []; } })
        : [];
      return montarHistoricoCliente({
        cliente,
        comandas: loaded.local.comandas,
        vendas: loaded.local.retailSales,
        comandasEmpresa: loaded.comandasUnidade || [],
        profissionais: barbeariaErpKytto.listarProfissionais?.(empresaId, { incluirInativos: true }) || [],
        produtos: loaded.local.products,
        planosAtivos: barbeariaErpKytto.listarPlanos(empresaId, {}),
        coberturas,
        historicoAvec: loaded.local.historicalAppointments || [], overrideVisitas: loaded.local.historicalCustomer ? loaded.local.historicalCustomer.totalVisitas : null,
        perfil360: profile,
        maskPhone,
      });
    } catch (error) {
      console.warn('Customer 360: histórico do cliente indisponível:', error?.message || error);
      return null;
    }
  }

  function sendError(res, error, fallback) {
    if (error?.status && error.status < 500) return res.status(error.status).json({ error: error.message, code: error.code || 'CUSTOMER360_INVALID' });
    if (error?.status === 503) return res.status(503).json({ error: 'Customer 360 temporariamente indisponível.', code: 'CUSTOMER360_UNAVAILABLE' });
    console.error(fallback, error?.code || error?.message || error);
    return res.status(500).json({ error: fallback, code: 'CUSTOMER360_UNAVAILABLE' });
  }

  function registerJsonAudit(req, acao, detalhe) {
    try { audit(req, acao, detalhe); save(); } catch (error) { console.warn('Customer 360: auditoria JSON indisponível:', error?.message); }
  }

  async function trail(req, loaded, acao, extra = {}) {
    registerJsonAudit(req, `${acao.toUpperCase()} CUSTOMER360`, [`ref=${loaded.identity.ref}`, extra.campo && `campo=${extra.campo}`, extra.motivo && `motivo=${String(extra.motivo).slice(0, 120)}`].filter(Boolean).join('; '));
    await auditCustomerAccess(loaded.context, { acao, ref: loaded.identity.ref, campo: extra.campo || null, motivo: extra.motivo || null, ip: req.ip, userAgent: req.get('user-agent'), operador: operatorLabel(req.user) });
  }

  function recordCards(identity) {
    return [
      ...identity.local.map((record) => ({ ref: `dino:${record.id}`, fonte: 'barbearia', nome: record.nome, telefone: maskPhone(record.telefone), email: maskEmail(record.email), criadoEm: record.criadoEm || null, anonimizado: Boolean(record.anonimizadoEm) })),
      ...identity.commerce.map((record) => ({ ref: `loja:${record.id}`, fonte: 'loja', nome: record.nome, telefone: maskPhone(record.telefone), email: maskEmail(record.email), criadoEm: record.criado_em || null, anonimizado: Boolean(record.metadados?.anonimizadoEm), bloqueado: Boolean(record.bloqueado) })),
    ];
  }

  // ─────────────── busca rápida ───────────────
  app.get(BASE, async (req, res) => {
    try {
      const query = String(req.query?.q || '').slice(0, 80);
      const limit = Math.max(1, Math.min(50, Number(req.query?.limit) || 20));
      const { commerceCustomers, commerceStatus, locals, rules } = await sourcesFor(req, { query, limit: query ? 200 : 500 });
      const directory = mergeCustomerDirectory({ localClients: locals, commerceCustomers, ...rules });
      const result = searchCustomerDirectory(directory.filter((item) => !item.anonimizado), query, { limit });
      res.json({ ok: true, ...result, fontes: { barbearia: { disponivel: true }, loja: commerceStatus } });
    } catch (error) { return sendError(res, error, 'Não foi possível buscar clientes.'); }
  });

  // Cache em memória de alta performance para a carteira (TTL 45s)
  const portfolioCache = new Map();
  function invalidatePortfolioCache(empresaId) {
    if (!empresaId) {
      portfolioCache.clear();
      return;
    }
    const prefix = `${String(empresaId)}:`;
    for (const key of portfolioCache.keys()) {
      if (key.startsWith(prefix) || key === String(empresaId)) {
        portfolioCache.delete(key);
      }
    }
  }

  // ─────────────── carteira ───────────────
  app.get(`${BASE}/carteira`, async (req, res) => {
    try {
      const empresaId = String(legacyEmpresaId(req) || '');
      const lojaId = String(legacyLojaId(req) || '');
      const cacheKey = `${empresaId}:${lojaId}`;
      const forceRefresh = req.query?.refresh === '1' || req.query?.force === '1';
      const now = Date.now();
      const TTL = 45000;

      let cached = forceRefresh ? null : portfolioCache.get(cacheKey);
      if (!cached || (now - cached.timestamp > TTL)) {
        const { context, commerceCustomers, commerceStatus, locals, rules } = await sourcesFor(req, { limit: 5000 });
        const data = localData(req);
        const localMetrics = localMetricsByClient({ clients: locals, appointments: data.appointments, comandas: data.comandas, retailSales: data.retailSales, receivables: data.receivables, loyaltyMembers: data.fidelidade.membros });
        const commerceMetrics = context ? await loadCommercePortfolioMetrics(context) : undefined;
        const directory = mergeCustomerDirectory({ localClients: locals, commerceCustomers, ...rules });
        const tagsByRef = customerStore.tagsByRef(legacyEmpresaId(req));
        const rows = buildPortfolio(directory, { localMetrics, commerceMetrics, tagsByRef });
        const active = rows.filter((row) => !row.anonimizado);
        const resumo = summarizePortfolio(active);
        const etiquetas = customerStore.allTags(legacyEmpresaId(req));
        const metricsStatus = commerceMetrics
          ? ['orders', 'carts', 'credit'].filter((key) => commerceMetrics[key].unavailable).map((key) => ({ fonte: key, motivo: commerceMetrics[key].reason }))
          : [];
        cached = {
          active,
          resumo,
          etiquetas,
          fontes: { barbearia: { disponivel: true }, loja: commerceStatus, metricasIndisponiveis: metricsStatus },
          timestamp: now,
        };
        portfolioCache.set(cacheKey, cached);
      }

      const q = req.query || {};
      const page = queryPortfolio(cached.active, {
        q: String(q.q || '').slice(0, 80), segmento: String(q.segmento || ''), fonte: String(q.fonte || ''),
        saldo: q.saldo === '1' || q.saldo === 'true', carrinho: q.carrinho === '1' || q.carrinho === 'true',
        etiqueta: String(q.etiqueta || '').slice(0, 32), ordem: String(q.ordem || 'valor'), pagina: q.pagina, tamanho: q.tamanho,
      });
      res.json({ ok: true, resumo: cached.resumo, ...page, etiquetas: cached.etiquetas, fontes: cached.fontes });
    } catch (error) { return sendError(res, error, 'Não foi possível montar a carteira de clientes.'); }
  });

  // ─────────────── possíveis duplicados ───────────────
  app.get(`${BASE}/duplicados`, async (req, res) => {
    try {
      const { commerceCustomers, commerceStatus, locals, rules } = await sourcesFor(req, { limit: 5000 });
      const items = duplicateSuggestions({ localClients: locals.filter((item) => !item.anonimizadoEm), commerceCustomers: commerceCustomers.filter((item) => !item.metadados?.anonimizadoEm), ...rules });
      res.json({ ok: true, total: items.length, items, podeGerenciar: canManage(req.user), fontes: { loja: commerceStatus } });
    } catch (error) { return sendError(res, error, 'Não foi possível listar possíveis duplicados.'); }
  });

  function pairFromBody(req) {
    const a = String(req.body?.a || ''); const b = String(req.body?.b || '');
    const pa = parseRef(a); const pb = parseRef(b);
    if (!pa || !pb || pa.kind === 'tel' || pb.kind === 'tel' || a === b) throw httpError('Informe dois cadastros válidos (barbearia ou loja).');
    return { a, b, motivo: String(req.body?.motivo || '').slice(0, 240) };
  }

  app.post(`${BASE}/vinculos`, async (req, res) => {
    try {
      if (!canManage(req.user)) throw httpError('Seu perfil não pode unificar cadastros.', 403, 'CUSTOMER360_FORBIDDEN');
      const { context } = await commerceContext(req, 'customers.write');
      if (commerceEnabled() && !context) throw httpError('Commerce indisponível para validar a alteração.', 503, 'CUSTOMER360_COMMERCE_UNAVAILABLE');
      const pair = pairFromBody(req);
      customerStore.linkRecords(legacyEmpresaId(req), { ...pair, operador: operatorLabel(req.user) });
      registerJsonAudit(req, 'LINK CUSTOMER360', `ref=${pair.a}; com=${pair.b}${pair.motivo ? `; motivo=${pair.motivo}` : ''}`);
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.json({ ok: true, ...pair });
    } catch (error) { return sendError(res, error, 'Não foi possível vincular os cadastros.'); }
  });

  app.post(`${BASE}/separacoes`, async (req, res) => {
    try {
      if (!canManage(req.user)) throw httpError('Seu perfil não pode separar cadastros.', 403, 'CUSTOMER360_FORBIDDEN');
      const { context } = await commerceContext(req, 'customers.write');
      if (commerceEnabled() && !context) throw httpError('Commerce indisponível para validar a alteração.', 503, 'CUSTOMER360_COMMERCE_UNAVAILABLE');
      const pair = pairFromBody(req);
      customerStore.separateRecords(legacyEmpresaId(req), { ...pair, operador: operatorLabel(req.user) });
      registerJsonAudit(req, 'SPLIT CUSTOMER360', `ref=${pair.a}; de=${pair.b}${pair.motivo ? `; motivo=${pair.motivo}` : ''}`);
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.json({ ok: true, ...pair });
    } catch (error) { return sendError(res, error, 'Não foi possível separar os cadastros.'); }
  });

  // ─────────────── ficha ───────────────
  app.get(`${BASE}/:ref`, async (req, res) => {
    try {
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const profile = buildCustomer360(loaded.identity, { local: loaded.local, commerce: loaded.commerce });
      await trail(req, loaded, 'view');
      const empresaId = legacyEmpresaId(req);
      const historico = historicoDaFicha(req, loaded, profile);
      res.json({
        ok: true, ...profile,
        canonicalRef: loaded.identity.canonicalRef,
        registros: recordCards(loaded.identity),
        notas: customerStore.listNotes(empresaId, loaded.allRefs),
        etiquetas: customerStore.listTags(empresaId, loaded.allRefs),
        etiquetasDisponiveis: customerStore.allTags(empresaId).map((item) => item.tag),
        clienteBarbeariaId: loaded.identity.local[0]?.id || null,
        historico,
        anonimizado: [...loaded.identity.local, ...loaded.identity.commerce].length > 0 && [...loaded.identity.local, ...loaded.identity.commerce].every((record) => record.anonimizadoEm || record.metadados?.anonimizadoEm),
        permissoes: { revelar: canReveal(req.user), exportar: canExport(req.user), gerenciar: canManage(req.user), anonimizar: canExport(req.user), verAcessos: canExport(req.user) },
      });
    } catch (error) { return sendError(res, error, 'Não foi possível carregar a ficha do cliente.'); }
  });

  app.post(`${BASE}/:ref/revelar`, async (req, res) => {
    try {
      if (!canReveal(req.user)) return res.status(403).json({ error: 'Seu perfil não pode revelar dados pessoais.', code: 'CUSTOMER360_REVEAL_FORBIDDEN' });
      const campo = String(req.body?.campo || '');
      const motivo = String(req.body?.motivo || '').trim();
      if (!REVEAL_FIELDS.has(campo)) return res.status(400).json({ error: 'Campo inválido.', code: 'CUSTOMER360_FIELD_INVALID' });
      if (motivo.length < 5) return res.status(400).json({ error: 'Informe o motivo do acesso (mínimo 5 caracteres).', code: 'CUSTOMER360_REASON_REQUIRED' });
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const valor = revealField(loaded.identity, campo);
      await trail(req, loaded, 'reveal', { campo, motivo });
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, campo, valor: valor || '' });
    } catch (error) { return sendError(res, error, 'Não foi possível revelar o dado.'); }
  });

  app.get(`${BASE}/:ref/exportar`, async (req, res) => {
    try {
      if (!canExport(req.user)) return res.status(403).json({ error: 'Somente administradores podem exportar os dados do titular.', code: 'CUSTOMER360_EXPORT_FORBIDDEN' });
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const profile = buildCustomer360(loaded.identity, { local: loaded.local, commerce: loaded.commerce, reveal: true });
      await trail(req, loaded, 'export');
      const empresaId = legacyEmpresaId(req);
      const payload = {
        documento: 'Exportação de dados pessoais do titular (LGPD, art. 18)',
        geradoEm: new Date().toISOString(),
        geradoPor: operatorLabel(req.user),
        controlador: { empresaId },
        titular: profile.perfil,
        registrosDeOrigem: {
          barbearia: loaded.identity.local.map(({ consentimentoHistorico, ...item }) => ({ ...item, consentimentoHistorico: consentimentoHistorico || [] })),
          loja: loaded.identity.commerce,
        },
        anotacoesInternas: customerStore.listNotes(empresaId, loaded.allRefs),
        etiquetas: customerStore.listTags(empresaId, loaded.allRefs),
        ficha: profile,
      };
      const safeRef = profile.ref.replace(/[^A-Za-z0-9_-]/g, '_');
      res.set('Cache-Control', 'no-store');
      res.set('Content-Disposition', `attachment; filename="titular-${safeRef}.json"`);
      res.json(payload);
    } catch (error) { return sendError(res, error, 'Não foi possível exportar os dados do titular.'); }
  });

  // ─────────────── anotações e etiquetas ───────────────
  app.post(`${BASE}/:ref/notas`, async (req, res) => {
    try {
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const nota = customerStore.addNote(legacyEmpresaId(req), { refs: loaded.allRefs, texto: req.body?.texto, autor: operatorLabel(req.user), fixada: req.body?.fixada === true });
      registerJsonAudit(req, 'NOTE CUSTOMER360', `ref=${loaded.identity.ref}; nota=${nota.id}`);
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.status(201).json({ ok: true, nota });
    } catch (error) { return sendError(res, error, 'Não foi possível salvar a anotação.'); }
  });

  app.delete(`${BASE}/:ref/notas/:notaId`, async (req, res) => {
    try {
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      customerStore.removeNote(legacyEmpresaId(req), { refs: loaded.allRefs, noteId: String(req.params.notaId), autor: operatorLabel(req.user), isAdmin: canExport(req.user) });
      registerJsonAudit(req, 'NOTE-DELETE CUSTOMER360', `ref=${loaded.identity.ref}; nota=${req.params.notaId}`);
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.json({ ok: true });
    } catch (error) { return sendError(res, error, 'Não foi possível remover a anotação.'); }
  });

  app.put(`${BASE}/:ref/etiquetas`, async (req, res) => {
    try {
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const etiquetas = customerStore.setTags(legacyEmpresaId(req), { refs: loaded.allRefs, canonicalRef: loaded.identity.canonicalRef, tags: req.body?.etiquetas });
      registerJsonAudit(req, 'TAGS CUSTOMER360', `ref=${loaded.identity.ref}; etiquetas=${etiquetas.join(',')}`);
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.json({ ok: true, etiquetas });
    } catch (error) { return sendError(res, error, 'Não foi possível salvar as etiquetas.'); }
  });

  // ─────────────── LGPD: quem acessou e anonimização ───────────────
  app.get(`${BASE}/:ref/acessos`, async (req, res) => {
    try {
      if (!canExport(req.user)) return res.status(403).json({ error: 'Somente administradores veem o histórico de acessos.', code: 'CUSTOMER360_FORBIDDEN' });
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const commerce = await loadCommerceAccessHistory(loaded.context, loaded.allRefs);
      const items = !commerce.unavailable && commerce.items.length
        ? commerce.items.map((row) => ({ em: row.criado_em, usuario: row.operador || 'usuário do Commerce', acao: row.acao, detalhe: [row.campo && `campo=${row.campo}`, row.motivo && `motivo=${row.motivo}`].filter(Boolean).join('; ') }))
        : store.localAccessHistory(loaded.allRefs);
      res.json({ ok: true, fonte: !commerce.unavailable && commerce.items.length ? 'commerce_audit_logs' : 'auditoria_local', items });
    } catch (error) { return sendError(res, error, 'Não foi possível carregar o histórico de acessos.'); }
  });

  app.post(`${BASE}/:ref/anonimizar`, async (req, res) => {
    try {
      if (!canExport(req.user)) throw httpError('Somente administradores podem anonimizar um titular.', 403, 'CUSTOMER360_FORBIDDEN');
      if (String(req.body?.confirmacao || '') !== ANON_CONFIRMATION) throw httpError(`Digite ${ANON_CONFIRMATION} para confirmar.`, 400, 'CUSTOMER360_CONFIRMATION_REQUIRED');
      const motivo = String(req.body?.motivo || '').trim();
      if (motivo.length < 10) throw httpError('Descreva o motivo (pedido do titular, protocolo etc.).', 400, 'CUSTOMER360_REASON_REQUIRED');
      const loaded = await loadProfile(req, req.params.ref);
      if (loaded.status) return res.status(loaded.status).json(loaded.body);
      const { identity } = loaded;
      let commerceResult = null;
      if (commerceEnabled()) {
        const { context } = await commerceContext(req, 'customers.write');
        if (!context) throw httpError('Commerce indisponível para validar a anonimização. Nada foi alterado.', 503, 'CUSTOMER360_COMMERCE_UNAVAILABLE');
        if (identity.commerce.length || identity.phones.length || identity.emails.length) {
          commerceResult = await anonymizeCommerceCustomers(context, { customerIds: identity.commerce.map((item) => item.id), phones: identity.phones, emails: identity.emails, operador: operatorLabel(req.user) });
        }
      }
      await trail(req, loaded, 'anonymize', { motivo });
      const localResult = customerStore.anonymizeLocalCustomer(legacyEmpresaId(req), { clientIds: identity.local.map((item) => item.id), phones: identity.phones, refs: loaded.allRefs, operador: operatorLabel(req.user) });
      invalidatePortfolioCache(legacyEmpresaId(req));
      res.json({ ok: true, barbearia: localResult, loja: commerceResult, preservado: 'Valores, datas e status de atendimentos, comandas, pedidos e pagamentos foram mantidos por obrigação legal/fiscal, sem dados pessoais.' });
    } catch (error) { return sendError(res, error, 'Não foi possível anonimizar o titular.'); }
  });
}
