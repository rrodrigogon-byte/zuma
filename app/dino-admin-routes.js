import zlib from 'zlib';
// ============================================================================
// ADMIN DA EMPRESA (tenant) — Financeiro, Auditoria e BI da barbearia.
// Tudo sob /api/admin/barbearia (auth + requireStaff + escopo de empresa já
// aplicados em server.js). Os módulos equivalentes antigos em /api/admin/*
// eram globais da plataforma; estes separam os dados por empresa.
// ============================================================================

import * as dinoBi from './dino-bi.js';
import { PAID_ORDER_STATUSES } from './core/customer-360.js';
import { legacyEmpresaIdFromCommerce, legacyLojaIdFromCommerce } from './core/legacy-commerce-scope.js';

const BASE = '/api/admin/barbearia';
const GESTORES = new Set(['admin', 'organizador']);

export const CATEGORIAS_BARBEARIA = {
  receita: ['Serviços', 'Revenda', 'Loja online', 'Assinaturas e pacotes', 'Gorjetas', 'Outros'],
  despesa: ['Aluguel', 'Produtos e insumos', 'Pessoal/RH', 'Pró-labore', 'Utilities (Água/Luz)', 'Internet e telefone', 'Marketing', 'Impostos/Taxas', 'Taxas de cartão', 'Manutenção', 'Equipamentos', 'Serviços Terceiros', 'Comissões', 'Outros'],
};

/** Mesmas datas, mês a mês (dia 31 vira o último dia dos meses menores). */
export function monthlyDates(start, count) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) ? String(start) : new Date().toISOString().slice(0, 10);
  const [year, month, day] = base.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const target = new Date(Date.UTC(year, month - 1 + index, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, last));
    return target.toISOString().slice(0, 10);
  });
}

// Operador (perfil de toda empresa) lança despesa e lê as categorias; o resto do financeiro é da gestão.
// A trava da barbearia (server.js) já confere que o lançamento do operador é despesa.
function gestorOuOperador(req, res) {
  if (String(req.user?.role || '') === 'operador') return true;
  return gestor(req, res);
}

function gestor(req, res) {
  if (GESTORES.has(String(req.user?.role || ''))) return true;
  res.status(403).json({ error: 'Disponível para administradores e gestores da empresa.', code: 'TENANT_MANAGER_REQUIRED' });
  return false;
}

function view(lancamento) {
  if (!lancamento) return lancamento;
  return { ...lancamento, obs: lancamento.observacao || '' };
}

function respondFinanceError(res, error) {
  const code = String(error?.code || 'FINANCIAL_UNAVAILABLE');
  const status = code === 'FINANCIAL_SCOPE_REQUIRED' ? 409 : 400;
  res.status(status).json({
    error: status === 409 ? 'Selecione a empresa e a unidade ativa para consultar o Financeiro.' : (error?.message || 'Não foi possível carregar o Financeiro.'),
    code,
  });
}

function sanitizeEntry(body = {}) {
  const out = {};
  for (const key of ['tipo', 'categoria', 'descricao', 'valor', 'vencimento', 'status', 'meioPagamento', 'pagoEm']) {
    if (body[key] !== undefined && body[key] !== '') out[key] = body[key];
  }
  if (body.obs !== undefined || body.observacao !== undefined) out.observacao = body.obs ?? body.observacao;
  return out;
}

/**
 * Detalhe de vendas da loja online no recorte: top produtos e custo (CMV).
 * O custo só é informado quando TODOS os itens vendidos têm custo na lista de
 * preços; caso contrário volta null e a loja fica fora do lucro estimado.
 */
export async function loadCommerceSalesDetail(commerceDb, context, from, to) {
  const values = [context.empresaId, from, to, PAID_ORDER_STATUSES, context.lojaId || null];
  const rows = await commerceDb.queryRead(
    `SELECT i.nome_snapshot AS nome,
            SUM(i.quantidade)::numeric AS quantidade,
            SUM(i.subtotal)::numeric AS receita,
            SUM(i.quantidade * COALESCE(c.custo, 0))::numeric AS custo,
            COUNT(*) FILTER (WHERE c.custo IS NULL OR c.custo <= 0)::int AS sem_custo
       FROM commerce_order_items i
       JOIN commerce_orders o ON o.empresa_id = i.empresa_id AND o.id = i.order_id
       LEFT JOIN LATERAL (
         SELECT MAX(p.custo) AS custo FROM commerce_variant_prices p
          WHERE p.empresa_id = i.empresa_id AND p.variant_id = i.variant_id
       ) c ON true
      WHERE o.empresa_id = $1 AND o.criado_em >= $2::timestamptz AND o.criado_em < $3::timestamptz
        AND ($5::uuid IS NULL OR o.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $5::uuid))
        AND o.status = ANY($4::text[]) -- só pedidos pagos entram no lucro (pendente de pagamento não é receita)
      GROUP BY i.nome_snapshot
      ORDER BY SUM(i.subtotal) DESC`,
    values,
  );
  const items = rows.rows.map((row) => ({ nome: row.nome, quantidade: Number(row.quantidade || 0), receita: Number(row.receita || 0), custo: Number(row.custo || 0), semCusto: Number(row.sem_custo || 0) }));
  const revenue = items.reduce((sum, item) => sum + item.receita, 0);
  const missingCost = items.some((item) => item.semCusto > 0);
  return {
    revenueItems: Number(revenue.toFixed(2)),
    cost: items.length && !missingCost ? Number(items.reduce((sum, item) => sum + item.custo, 0).toFixed(2)) : (items.length ? null : 0),
    topProducts: items.slice(0, 10).map(({ semCusto, ...item }) => ({ ...item, margem: !semCusto && item.receita > 0 ? Number((((item.receita - item.custo) / item.receita) * 100).toFixed(1)) : null })),
  };
}

export function registerDinoAdminRoutes(app, deps) {
  const {
    legacyEmpresaId, legacyLojaId, financeiroKytto, barbeariaErpKytto, clientesKytto,
    commerceDb, requireCommercePermission, audit, save, salesReport,
  } = deps;

  // ── Financeiro da empresa ────────────────────────────────────────────────
  app.get(`${BASE}/financeiro/lancamentos`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const itens = financeiroKytto.listarLancamentos(legacyEmpresaId(req), { ...(req.query || {}), lojaId: legacyLojaId(req) }).map(view);
      const jsonStr = JSON.stringify(itens);
      const acceptEncoding = req.headers["accept-encoding"] || "";
      if (acceptEncoding.includes("gzip") && jsonStr.length > 2048) {
        zlib.gzip(Buffer.from(jsonStr, "utf8"), (err, buffer) => {
          if (err) return res.json(itens);
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Encoding": "gzip",
            "Content-Length": buffer.length,
          });
          res.end(buffer);
        });
      } else {
        res.json(itens);
      }
    } catch (error) { respondFinanceError(res, error); }
  });

  app.get(`${BASE}/financeiro/resumo`, (req, res) => {
    if (!gestor(req, res)) return;
    try { res.json(financeiroKytto.resumoFinanceiro(legacyEmpresaId(req), { ...(req.query || {}), lojaId: legacyLojaId(req) })); }
    catch (error) { respondFinanceError(res, error); }
  });

  app.get(`${BASE}/financeiro/fluxo`, (req, res) => {
    if (!gestor(req, res)) return;
    try { res.json(financeiroKytto.fluxoFinanceiro(legacyEmpresaId(req), 12, new Date(), { lojaId: legacyLojaId(req) })); }
    catch (error) { respondFinanceError(res, error); }
  });

  app.get(`${BASE}/financeiro/dre`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const mes = req.query?.mes || new Date().toISOString().slice(0, 7);
      res.json(financeiroKytto.dreGerencial(legacyEmpresaId(req), { ...(req.query || {}), mes, lojaId: legacyLojaId(req) }));
    } catch (error) { respondFinanceError(res, error); }
  });

  app.get(`${BASE}/financeiro/categorias`, (req, res) => {
    if (!gestorOuOperador(req, res)) return;
    res.json(CATEGORIAS_BARBEARIA);
  });

  app.post(`${BASE}/financeiro/lancamentos`, (req, res) => {
    if (!gestorOuOperador(req, res)) return;
    if (String(req.user?.role || '') === 'operador' && String(req.body?.tipo || '').toLowerCase() !== 'despesa') {
      return res.status(403).json({ error: 'O operador lança só despesas.', code: 'PROFILE_RESTRICTED' });
    }
    try {
      const empresaId = legacyEmpresaId(req);
      const lojaId = legacyLojaId(req);
      const dados = { ...sanitizeEntry(req.body || {}), lojaId };
      const meses = Math.floor(Number(req.body?.recorrencia?.meses || 1));
      if (!Number.isFinite(meses) || meses < 1 || meses > 24) throw new Error('A recorrência vai de 1 a 24 meses.');
      const vencimentos = meses > 1 ? monthlyDates(dados.vencimento, meses) : [dados.vencimento];
      const serieId = meses > 1 ? `serie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` : null;
      const criados = vencimentos.map((vencimento, index) => {
        const lancamento = financeiroKytto.registrarLancamento(empresaId, {
          ...dados,
          vencimento,
          // Só a primeira parcela pode nascer paga; as futuras ficam pendentes.
          status: index === 0 ? (dados.status || 'pendente') : 'pendente',
          descricao: serieId ? `${dados.descricao || 'Lançamento'} (${index + 1}/${meses})` : dados.descricao,
          origem: 'manual',
          usuario: req.user?.email || req.user?.nome || '',
        });
        if (serieId) {
          const stored = deps.db().financeiroKytto?.empresas?.[String(empresaId)]?.lancamentos?.[lancamento.id];
          if (stored) Object.assign(stored, { serieId, serieParcela: index + 1, serieTotal: meses });
          return { ...lancamento, serieId, serieParcela: index + 1, serieTotal: meses };
        }
        return lancamento;
      });
      audit(req, 'FINANCEIRO LANCAMENTO', `id=${criados[0].id}; tipo=${criados[0].tipo}; valor=${criados[0].valor}${serieId ? `; serie=${serieId}; parcelas=${meses}` : ''}`);
      save();
      res.status(201).json(serieId ? { ...view(criados[0]), serie: { id: serieId, parcelas: criados.map(view) } } : view(criados[0]));
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  // Encerra uma série recorrente: cancela as parcelas ainda pendentes.
  app.delete(`${BASE}/financeiro/series/:serieId`, (req, res) => {
    if (!gestor(req, res)) return;
    const empresaId = legacyEmpresaId(req);
    const pendentes = financeiroKytto.listarLancamentos(empresaId, {}).filter((item) => item.serieId === String(req.params.serieId) && item.status === 'pendente');
    if (!pendentes.length) return res.status(404).json({ error: 'Nenhuma parcela pendente nesta série.' });
    pendentes.forEach((item) => financeiroKytto.cancelarLancamento(empresaId, item.id, { usuario: req.user?.email || req.user?.nome || 'gestor', permitirAutomatico: true }));
    audit(req, 'FINANCEIRO SERIE ENCERRADA', `serie=${req.params.serieId}; parcelas=${pendentes.length}`);
    save();
    res.json({ ok: true, canceladas: pendentes.length });
  });

  app.patch(`${BASE}/financeiro/lancamentos/:id`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const lojaId = legacyLojaId(req);
      const dados = sanitizeEntry(req.body || {});
      if (req.body?.lojaId !== undefined) dados.lojaId = req.body.lojaId;
      const lancamento = financeiroKytto.atualizarLancamento(legacyEmpresaId(req), req.params.id, dados, { lojaId, permitirAutomatico: true });
      if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado nesta empresa.' });
      audit(req, 'FINANCEIRO ATUALIZACAO', `id=${lancamento.id}; status=${lancamento.status}`);
      save();
      res.json(view(lancamento));
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  // Liquidação em lote de lançamentos (ex: marcar selecionados ou vencidos como pagos)
  app.post(`${BASE}/financeiro/lancamentos/liquidar-lote`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const empresaId = legacyEmpresaId(req);
      const lojaId = legacyLojaId(req);
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (!ids.length) return res.status(400).json({ error: 'Nenhum lançamento informado para liquidação.' });
      const dataPagamento = req.body?.dataPagamento || new Date().toISOString();
      const liquidados = [];
      for (const id of ids) {
        const item = financeiroKytto.obterLancamento(empresaId, id, { lojaId });
        if (item && item.status === 'pendente') {
          const atualizado = financeiroKytto.atualizarLancamento(empresaId, id, { status: 'pago', pagoEm: dataPagamento }, { lojaId, permitirAutomatico: true });
          if (atualizado) liquidados.push(atualizado.id);
        }
      }
      audit(req, 'FINANCEIRO LIQUIDACAO LOTE', `quantidade=${liquidados.length}`);
      save();
      res.json({ ok: true, liquidados: liquidados.length, ids: liquidados });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  // Exclusão = cancelamento (mantém a trilha contábil).
  app.delete(`${BASE}/financeiro/lancamentos/:id`, (req, res) => {
    if (!gestor(req, res)) return;
    const lancamento = financeiroKytto.cancelarLancamento(legacyEmpresaId(req), req.params.id, { usuario: req.user?.email || req.user?.nome || 'gestor', lojaId: legacyLojaId(req), permitirAutomatico: true });
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado nesta empresa.' });
    audit(req, 'FINANCEIRO CANCELAMENTO', `id=${lancamento.id}`);
    save();
    res.json({ ok: true, lancamento: view(lancamento) });
  });

  // ── Auditoria da empresa ─────────────────────────────────────────────────
  app.get(`${BASE}/auditoria`, async (req, res) => {
    if (!gestor(req, res)) return;
    const coreEnabled = process.env.COMMERCE_CORE_ENABLED === '1';
    let context = null;
    if (coreEnabled) {
      try {
        context = await requireCommercePermission(req, 'audit.read');
      } catch (error) {
        const selection = error?.code === 'STORE_SELECTION_REQUIRED';
        const denied = error?.code === 'PERMISSION_DENIED' || error?.code === 'STORE_SCOPE_MISMATCH';
        return res.status(selection ? 409 : denied ? 403 : 503).json({
          error: 'Auditoria indisponível para esta sessão.',
          code: selection ? 'STORE_SELECTION_REQUIRED' : denied ? 'PERMISSION_DENIED' : 'COMMERCE_AUDIT_UNAVAILABLE',
        });
      }
    }
    const empresaId = legacyEmpresaId(req);
    if (context && String(context.empresaId) !== String(empresaId)) {
      return res.status(403).json({ error: 'Auditoria indisponível para esta sessão.', code: 'STORE_SCOPE_MISMATCH' });
    }
    const limite = Math.max(20, Math.min(500, Number(req.query?.limite) || 300));
    const local = (deps.db().auditoria || [])
      .filter((item) => item.empresaId && String(item.empresaId) === String(empresaId))
      // Logs JSON antigos não têm garantia de loja: não exibi-los a membership
      // limitada a uma loja quando o Core está ativo.
      .filter((item) => !context?.lojaId || String(item.lojaId || '') === String(context.lojaId))
      .slice(-limite)
      .map((item) => ({ id: `json-${item.id}`, ts: item.ts, user: item.user, acao: item.acao, detalhe: item.detalhe || '', fonte: 'sistema' }));
    let banco = [];
    let bancoDisponivel = false;
    if (context) {
      try {
      const lojaPredicate = context.lojaId ? ' AND l.loja_id = $3' : '';
      const values = [context.empresaId, limite, ...(context.lojaId ? [context.lojaId] : [])];
      const rows = await commerceDb.queryRead(
        `SELECT l.id, l.criado_em, l.entidade, l.acao, l.depois, COALESCE(u.nome, l.depois->>'operador', l.usuario_id::text, 'sistema') AS usuario
           FROM commerce_audit_logs l
           LEFT JOIN usuarios u ON u.id = l.usuario_id AND u.empresa_id = l.empresa_id
          WHERE l.empresa_id = $1${lojaPredicate}
          ORDER BY l.criado_em DESC LIMIT $2`,
        values,
      ).catch(() => commerceDb.queryRead(
        `SELECT id, criado_em, entidade, acao, depois, COALESCE(depois->>'operador', usuario_id::text, 'sistema') AS usuario
           FROM commerce_audit_logs l WHERE l.empresa_id = $1${lojaPredicate} ORDER BY criado_em DESC LIMIT $2`,
        values,
      ));
      bancoDisponivel = true;
      banco = rows.rows.map((row) => {
        const depois = row.depois && typeof row.depois === 'object' ? row.depois : {};
        const detalhe = ['ref', 'campo', 'motivo', 'status', 'instance', 'total']
          .filter((key) => depois[key] !== undefined && depois[key] !== null && depois[key] !== '')
          .map((key) => `${key}=${String(depois[key]).slice(0, 80)}`).join('; ');
        return { id: `db-${row.id}`, ts: new Date(row.criado_em).toISOString(), user: row.usuario, acao: `${row.entidade}.${row.acao}`, detalhe, fonte: 'banco' };
      });
      } catch {
        return res.status(503).json({ error: 'Auditoria indisponível para esta sessão.', code: 'COMMERCE_AUDIT_UNAVAILABLE' });
      }
    }
    const itens = [...local, ...banco].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, limite);
    res.json({ ok: true, itens, fontes: { sistema: !context?.lojaId, banco: bancoDisponivel } });
  });

  // ── BI da barbearia ──────────────────────────────────────────────────────
  app.get(`${BASE}/bi`, async (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const empresaId = legacyEmpresaId(req);
      const lojaId = legacyLojaId(req);
      if (!empresaId || empresaId === 'principal' || !lojaId) return res.status(409).json({ error: 'Selecione uma empresa e unidade autorizadas para consultar o BI.', code: 'EXPLICIT_SCOPE_REQUIRED' });
      const allowed = new Set(['periodo', 'period', 'inicio', 'fim', 'comparar']);
      if (Object.keys(req.query || {}).some((key) => !allowed.has(key)) || Object.values(req.query || {}).some((value) => typeof value !== 'string')) return res.status(400).json({ error: 'Informe apenas período, início, fim e comparação válidos.', code: 'BI_QUERY_INVALID' });
      const range = dinoBi.biPeriod(req.query || {}, new Date());
      const window = { fromDate: range.fromDate, toDate: range.toDate, days: range.days };
      const previousWindow = { fromDate: range.previousFromDate, toDate: range.previousToDate, days: range.days };
      const comparar = ['1', 'true'].includes(String(req.query?.comparar || '').toLowerCase());
      let commerce = null; let commercePrevious = null; let commerceCoverage = 'indisponivel';
      try {
        const context = await requireCommercePermission(req, 'reports.read');
        if (legacyEmpresaIdFromCommerce(context?.empresaId) !== String(empresaId) || legacyLojaIdFromCommerce(context?.lojaId, context?.empresaId) !== String(lojaId)) throw Object.assign(new Error('Escopo Commerce não corresponde à unidade ativa.'), { code: 'STORE_SCOPE_MISMATCH' });
        const loadCommerce = async (from, to) => {
          const sales = await salesReport(context, { from, to });
          let detail = { cost: null, topProducts: [], available: false };
          try { detail = { ...(await loadCommerceSalesDetail(commerceDb, context, from, to)), available: true }; } catch { /* o subtotal confirmado permanece legível, com custo declarado indisponível */ }
          return {
            // No BI, faturamento Commerce é somente pedido em estado confirmado.
            // Pendências e capturas por data de liquidação são retornadas à parte.
            revenue: Number(sales?.summary?.confirmed_total || 0),
            orders: Number(sales?.summary?.confirmed_orders || 0),
            grossOrders: Number(sales?.summary?.gross_total || 0),
            pending: Number(sales?.summary?.pending_total || 0),
            pendingOrders: Number(sales?.summary?.pending_orders || 0),
            captured: Number(sales?.summary?.captured_total || 0),
            daily: Array.isArray(sales?.daily) ? sales.daily.map((item) => ({ day: item.day, total: Number(item.confirmed_total || 0) })) : [],
            capturedDaily: Array.isArray(sales?.capturedDaily) ? sales.capturedDaily.map((item) => ({ day: item.day, total: Number(item.total || 0) })) : [],
            cost: detail.cost,
            topProducts: detail.topProducts,
            detailAvailable: detail.available,
          };
        };
        [commerce, commercePrevious] = await Promise.all([
          loadCommerce(range.from, range.to),
          comparar ? loadCommerce(range.previousFrom, range.previousTo) : Promise.resolve(null),
        ]);
        commerceCoverage = commerce?.detailAvailable ? 'ok' : 'limitado';
      } catch { commerce = null; commercePrevious = null; }
      const exactUnit = (item) => String(item?.lojaId || '') === String(lojaId);
      const appointments = barbeariaErpKytto.listarAgendamentos(empresaId, { lojaId }).filter(exactUnit);
      const commands = barbeariaErpKytto.listarComandasBarbearia(empresaId, { lojaId }).filter(exactUnit);
      const retailSales = barbeariaErpKytto.listarVendasRevenda(empresaId, { lojaId }).filter(exactUnit);
      const historicalServices = barbeariaErpKytto.listarHistoricoAtendimentos(empresaId, { lojaId }).filter(exactUnit);
      const scopedCustomerIds = new Set([...appointments, ...commands, ...historicalServices].map((item) => String(item?.clienteId || '')).filter(Boolean));
      const customers = clientesKytto.listarClientes(empresaId).filter((item) => scopedCustomerIds.has(String(item?.id || '')));
      const common = {
        appointments,
        commands,
        retailSales,
        historicalServices,
        products: barbeariaErpKytto.listarProdutosRevenda(empresaId, { incluirInativos: true, lojaId }),
        professionals: barbeariaErpKytto.listarProfissionais(empresaId, { incluirInativos: true }),
        customers,
        financeEntries: financeiroKytto.listarLancamentos(empresaId, { lojaId }),
      };
      const bi = dinoBi.buildBarbershopBi({ ...common, commerce }, window);
      const previous = comparar ? dinoBi.buildBarbershopBi({ ...common, commerce: commercePrevious }, previousWindow) : null;
      res.set('Cache-Control', 'no-store');
      res.set('Pragma', 'no-cache');
      res.json({
        ok: true, readOnly: true, writePerformed: false, ...bi,
        cobertura: {
          operacao: 'ok', financeiro: 'ok', comercio: commerceCoverage,
          clientes: customers.length ? 'ok' : 'limitado',
        },
        comparacao: previous ? { periodo: previous.periodo, resumo: dinoBi.biComparisonSummary(previous), resultado: previous.resultado } : null,
      });
    } catch (error) {
      res.status(error instanceof RangeError ? 400 : 400).json({ error: error.message || 'Não foi possível montar o BI.' });
    }
  });
}
