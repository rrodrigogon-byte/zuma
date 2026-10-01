// ============================================================================
// ADMIN DA EMPRESA (tenant) — Financeiro, Auditoria e BI da barbearia.
// Tudo sob /api/admin/barbearia (auth + requireStaff + escopo de empresa já
// aplicados em server.js). Os módulos equivalentes antigos em /api/admin/*
// eram globais da plataforma; estes separam os dados por empresa.
// ============================================================================

import * as dinoBi from './dino-bi.js';
import { PAID_ORDER_STATUSES } from './core/customer-360.js';

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

function gestor(req, res) {
  if (GESTORES.has(String(req.user?.role || ''))) return true;
  res.status(403).json({ error: 'Disponível para administradores e gestores da empresa.', code: 'TENANT_MANAGER_REQUIRED' });
  return false;
}

function view(lancamento) {
  if (!lancamento) return lancamento;
  return { ...lancamento, obs: lancamento.observacao || '' };
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
  const values = [context.empresaId, from, to, PAID_ORDER_STATUSES];
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
    commerceDb, requireCommercePermission, dashboardPeriod, audit, save, salesReport,
  } = deps;

  // ── Financeiro da empresa ────────────────────────────────────────────────
  app.get(`${BASE}/financeiro/lancamentos`, (req, res) => {
    if (!gestor(req, res)) return;
    const itens = financeiroKytto.listarLancamentos(legacyEmpresaId(req), req.query || {}).map(view);
    res.json(itens);
  });

  app.get(`${BASE}/financeiro/resumo`, (req, res) => {
    if (!gestor(req, res)) return;
    res.json(financeiroKytto.resumoFinanceiro(legacyEmpresaId(req)));
  });

  app.get(`${BASE}/financeiro/fluxo`, (req, res) => {
    if (!gestor(req, res)) return;
    res.json(financeiroKytto.fluxoFinanceiro(legacyEmpresaId(req), 12));
  });

  app.get(`${BASE}/financeiro/categorias`, (req, res) => {
    if (!gestor(req, res)) return;
    res.json(CATEGORIAS_BARBEARIA);
  });

  app.post(`${BASE}/financeiro/lancamentos`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const empresaId = legacyEmpresaId(req);
      const dados = sanitizeEntry(req.body || {});
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
    pendentes.forEach((item) => financeiroKytto.cancelarLancamento(empresaId, item.id, req.user?.email || req.user?.nome || 'gestor'));
    audit(req, 'FINANCEIRO SERIE ENCERRADA', `serie=${req.params.serieId}; parcelas=${pendentes.length}`);
    save();
    res.json({ ok: true, canceladas: pendentes.length });
  });

  app.patch(`${BASE}/financeiro/lancamentos/:id`, (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const lancamento = financeiroKytto.atualizarLancamento(legacyEmpresaId(req), req.params.id, sanitizeEntry(req.body || {}));
      if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado nesta empresa.' });
      audit(req, 'FINANCEIRO ATUALIZACAO', `id=${lancamento.id}; status=${lancamento.status}`);
      save();
      res.json(view(lancamento));
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  // Exclusão = cancelamento (mantém a trilha contábil).
  app.delete(`${BASE}/financeiro/lancamentos/:id`, (req, res) => {
    if (!gestor(req, res)) return;
    const lancamento = financeiroKytto.cancelarLancamento(legacyEmpresaId(req), req.params.id, req.user?.email || req.user?.nome || 'gestor');
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado nesta empresa.' });
    audit(req, 'FINANCEIRO CANCELAMENTO', `id=${lancamento.id}`);
    save();
    res.json({ ok: true, lancamento: view(lancamento) });
  });

  // ── Auditoria da empresa ─────────────────────────────────────────────────
  app.get(`${BASE}/auditoria`, async (req, res) => {
    if (!gestor(req, res)) return;
    const empresaId = legacyEmpresaId(req);
    const limite = Math.max(20, Math.min(500, Number(req.query?.limite) || 300));
    const local = (deps.db().auditoria || [])
      .filter((item) => item.empresaId && String(item.empresaId) === String(empresaId))
      .slice(-limite)
      .map((item) => ({ id: `json-${item.id}`, ts: item.ts, user: item.user, acao: item.acao, detalhe: item.detalhe || '', fonte: 'sistema' }));
    let banco = [];
    let bancoDisponivel = false;
    try {
      const context = await requireCommercePermission(req, 'reports.read');
      const rows = await commerceDb.queryRead(
        `SELECT l.id, l.criado_em, l.entidade, l.acao, l.depois, COALESCE(u.nome, l.depois->>'operador', l.usuario_id::text, 'sistema') AS usuario
           FROM commerce_audit_logs l
           LEFT JOIN usuarios u ON u.id = l.usuario_id
          WHERE l.empresa_id = $1
          ORDER BY l.criado_em DESC LIMIT $2`,
        [context.empresaId, limite],
      ).catch(() => commerceDb.queryRead(
        `SELECT id, criado_em, entidade, acao, depois, COALESCE(depois->>'operador', usuario_id::text, 'sistema') AS usuario
           FROM commerce_audit_logs WHERE empresa_id = $1 ORDER BY criado_em DESC LIMIT $2`,
        [context.empresaId, limite],
      ));
      bancoDisponivel = true;
      banco = rows.rows.map((row) => {
        const depois = row.depois && typeof row.depois === 'object' ? row.depois : {};
        const detalhe = ['ref', 'campo', 'motivo', 'status', 'instance', 'total']
          .filter((key) => depois[key] !== undefined && depois[key] !== null && depois[key] !== '')
          .map((key) => `${key}=${String(depois[key]).slice(0, 80)}`).join('; ');
        return { id: `db-${row.id}`, ts: new Date(row.criado_em).toISOString(), user: row.usuario, acao: `${row.entidade}.${row.acao}`, detalhe, fonte: 'banco' };
      });
    } catch { /* Commerce indisponível ou sem permissão: segue só com a trilha local. */ }
    const itens = [...local, ...banco].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, limite);
    res.json({ ok: true, itens, fontes: { sistema: true, banco: bancoDisponivel } });
  });

  // ── BI da barbearia ──────────────────────────────────────────────────────
  app.get(`${BASE}/bi`, async (req, res) => {
    if (!gestor(req, res)) return;
    try {
      const empresaId = legacyEmpresaId(req);
      const lojaId = legacyLojaId(req);
      const range = dashboardPeriod(req.query?.periodo || req.query?.period || 30, new Date());
      const window = { fromDate: range.fromDate, toDate: range.toDate, days: range.days };
      let commerce = null;
      try {
        const context = await requireCommercePermission(req, 'reports.read');
        const [sales, detail] = await Promise.all([
          salesReport(context, { from: range.from, to: range.to }),
          loadCommerceSalesDetail(commerceDb, context, range.from, range.to).catch(() => ({ cost: null, topProducts: [] })),
        ]);
        commerce = {
          revenue: Number(sales?.summary?.gross_total || 0),
          orders: Number(sales?.summary?.orders || 0),
          cost: detail.cost,
          topProducts: detail.topProducts,
        };
      } catch { commerce = null; }
      const bi = dinoBi.buildBarbershopBi({
        appointments: barbeariaErpKytto.listarAgendamentos(empresaId, { lojaId }),
        commands: barbeariaErpKytto.listarComandasBarbearia(empresaId, { lojaId }),
        retailSales: barbeariaErpKytto.listarVendasRevenda(empresaId, { lojaId }),
        products: barbeariaErpKytto.listarProdutosRevenda(empresaId, { incluirInativos: true }),
        professionals: barbeariaErpKytto.listarProfissionais(empresaId, { incluirInativos: true }),
        customers: clientesKytto.listarClientes(empresaId),
        financeEntries: financeiroKytto.listarLancamentos(empresaId, {}),
        commerce,
      }, window);
      res.json({ ok: true, ...bi });
    } catch (error) {
      res.status(400).json({ error: error.message || 'Não foi possível montar o BI.' });
    }
  });
}
