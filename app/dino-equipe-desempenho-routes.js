import { buildEquipeDesempenho } from './dino-equipe-desempenho.js';
import { DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID, legacyEmpresaIdFromCommerce, legacyLojaIdFromCommerce } from './core/legacy-commerce-scope.js';

export const EQUIPE_PERFORMANCE_PATH = '/api/admin/barbearia/equipe/desempenho';
export function equipePerformanceNoStore(req, res, next) {
  if (req.path?.replace(/\/$/, '') === EQUIPE_PERFORMANCE_PATH) {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
  }
  next();
}

function commerceWindow(period) {
  // America/Cuiaba permanece UTC-4; o intervalo é inclusivo nas datas exibidas.
  const from = new Date(`${period.inicio}T04:00:00.000Z`);
  const to = new Date(`${period.fim}T04:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function scopeValueMatches(field, actualLegacy, candidate) {
  const value = String(candidate || '').trim();
  if (value === String(actualLegacy || '').trim()) return true;
  if (field === 'empresaId') return legacyEmpresaIdFromCommerce(value) === String(actualLegacy || '').trim();
  return legacyLojaIdFromCommerce(value, value === DINO_COMMERCE_LOJA_ID ? DINO_COMMERCE_EMPRESA_ID : '') === String(actualLegacy || '').trim();
}

// O prefixo /api/admin/barbearia já exige auth, requireStaff e resolução da identidade.
// Não chama save/audit, não calcula salário, não dispara campanhas nem pagamentos.
export function registerEquipePerformanceRoutes(app, { db, legacyEmpresaId, legacyLojaId, requireCommercePermission, salesReport, coreEnabled = () => process.env.COMMERCE_CORE_ENABLED === '1' }) {
  app.get(EQUIPE_PERFORMANCE_PATH, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    const manager = ['admin', 'organizador'].includes(String(req.user?.role || ''));
    const allowedAccount = req.user?.pgAccount !== true || req.user?.platformAdmin === true || req.user?.mainAdmin === true || ['platform_owner', 'tenant_owner', 'store_admin'].includes(req.user?.commerceRoleCode);
    if (!manager || !allowedAccount) return res.status(403).json({ code: 'TENANT_MANAGER_REQUIRED', error: 'O desempenho da equipe é reservado à gestão da empresa.' });
    try {
      const empresaId = String(legacyEmpresaId(req) || '');
      const lojaId = String(legacyLojaId(req) || '');
      if (!empresaId || empresaId === 'principal' || !lojaId) return res.status(409).json({ code: 'EXPLICIT_SCOPE_REQUIRED', error: 'Selecione uma empresa e uma unidade autorizadas.' });
      for (const [field, expected] of [['empresaId', empresaId], ['lojaId', lojaId]]) {
        if (req.query?.[field] !== undefined && !scopeValueMatches(field, expected, req.query[field])) return res.status(403).json({ code: 'STORE_SCOPE_MISMATCH', error: 'O contexto não corresponde à empresa e unidade autorizadas.' });
      }
      for (const [header, expected] of [['x-empresa-id', empresaId], ['x-loja-id', lojaId]]) {
        const field = header === 'x-empresa-id' ? 'empresaId' : 'lojaId';
        if (req.headers[header] && !scopeValueMatches(field, expected, req.headers[header])) return res.status(403).json({ code: 'STORE_SCOPE_MISMATCH', error: 'O contexto não corresponde à empresa e unidade autorizadas.' });
      }
      const allowedQueries = new Set(['inicio', 'fim', 'profissionalId', 'empresaId', 'lojaId']);
      if (Object.keys(req.query || {}).some(key => !allowedQueries.has(key)) || Object.values(req.query || {}).some(value => typeof value !== 'string')) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Informe apenas período e profissional válidos.' });
      const profissionalId = req.query.profissionalId || '';
      if (profissionalId.length > 120) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Filtro de profissional inválido.' });
      if (coreEnabled()) {
        const context = await requireCommercePermission(req, 'reports.read');
        if (legacyEmpresaIdFromCommerce(context?.empresaId) !== empresaId || legacyLojaIdFromCommerce(context?.lojaId, context?.empresaId) !== lojaId) return res.status(403).json({ code: 'STORE_SCOPE_MISMATCH', error: 'O contexto do relatório não corresponde à unidade autorizada.' });
        if (typeof salesReport !== 'function') return res.status(503).json({ code: 'PERFORMANCE_UNAVAILABLE', error: 'Relatório Commerce indisponível.' });
        const range = commerceWindow({ inicio: req.query.inicio, fim: req.query.fim });
        const sales = await salesReport(context, range);
        req.equipeCommerce = {
          revenue: Number(sales?.summary?.gross_total || 0),
          orders: Number(sales?.summary?.orders_non_cancelled ?? sales?.summary?.orders ?? 0),
        };
      }
      const result = buildEquipeDesempenho(db(), { empresaId, lojaId, inicio: req.query.inicio, fim: req.query.fim, profissionalId, commerceCurrent: req.equipeCommerce });
      res.json(result);
    } catch (error) {
      const denied = ['PERMISSION_DENIED', 'STORE_SCOPE_MISMATCH', 'TENANT_CONTEXT_REQUIRED'].includes(error?.code);
      const invalid = ['PERIOD_INVALID', 'PERIODO_INVALIDO', 'EXPLICIT_SCOPE_REQUIRED', 'PROFESSIONAL_NOT_FOUND'].includes(error?.code);
      res.status(denied ? 403 : invalid || error instanceof RangeError ? 400 : 503).json({ code: denied ? 'PERMISSION_DENIED' : invalid ? error.code : 'PERFORMANCE_UNAVAILABLE', error: denied ? 'Esta sessão não pode consultar o desempenho da equipe.' : invalid ? 'Confira o período, a unidade e o filtro de profissional.' : 'Não foi possível carregar o desempenho. Tente novamente.' });
    }
  });
  app.all(EQUIPE_PERFORMANCE_PATH, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Allow', 'GET');
    res.status(405).json({ code: 'READ_ONLY_ENDPOINT', error: 'Esta tela permite apenas consulta.' });
  });
}
