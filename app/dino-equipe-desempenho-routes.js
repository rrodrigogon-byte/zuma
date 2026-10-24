import { buildEquipeDesempenho, buildEquipeItens, ITEM_VIEWS } from './dino-equipe-desempenho.js';
import { DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID, legacyEmpresaIdFromCommerce, legacyLojaIdFromCommerce } from './core/legacy-commerce-scope.js';

export const EQUIPE_PERFORMANCE_PATH = '/api/admin/barbearia/equipe/desempenho';
export function equipePerformanceNoStore(req, res, next) {
  if (req.path?.replace(/\/$/, '') === EQUIPE_PERFORMANCE_PATH) {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
  }
  next();
}

// Cache curto por escopo autorizado: o cálculo percorre a base inteira da empresa.
// Invalida quando o banco grava (dataVersion) ou após o TTL (pedidos Commerce vêm de outra base).
const CACHE_TTL_MS = 90_000;
const CACHE_MAX = 60;
const performanceCache = new Map();
function cacheGet(key, version) {
  const hit = performanceCache.get(key);
  if (!hit) return null;
  if (hit.version !== version || Date.now() - hit.at > CACHE_TTL_MS) { performanceCache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, version, value) {
  if (performanceCache.size >= CACHE_MAX) performanceCache.delete(performanceCache.keys().next().value);
  performanceCache.set(key, { version, at: Date.now(), value });
}
export function clearEquipePerformanceCache() { performanceCache.clear(); }

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
export function registerEquipePerformanceRoutes(app, { db, legacyEmpresaId, legacyLojaId, requireCommercePermission, salesReport, coreEnabled = () => process.env.COMMERCE_CORE_ENABLED === '1', dataVersion = () => null }) {
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
      const allowedQueries = new Set(['inicio', 'fim', 'profissionalId', 'empresaId', 'lojaId', 'historico', 'fresh', 'visao', 'chave']);
      if (Object.keys(req.query || {}).some(key => !allowedQueries.has(key)) || Object.values(req.query || {}).some(value => typeof value !== 'string')) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Informe apenas período e profissional válidos.' });
      const profissionalId = req.query.profissionalId || '';
      if (profissionalId.length > 120) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Filtro de profissional inválido.' });
      const historico = req.query.historico === '1';
      const visao = req.query.visao || '';
      const chave = req.query.chave || '';
      if ((visao && !ITEM_VIEWS.includes(visao)) || chave.length > 300 || (chave && !visao) || (visao && profissionalId)) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Visão ou item inválido.' });
      if (historico && !req.query.fim) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Informe a data final do histórico.' });
      if (req.query.historico !== undefined && !['0', '1'].includes(req.query.historico)) return res.status(400).json({ code: 'PERFORMANCE_QUERY_INVALID', error: 'Filtro de histórico inválido.' });
      // A chave só é montada depois de autorização e escopo validados acima.
      const cacheKey = JSON.stringify([empresaId, lojaId, historico ? '' : req.query.inicio, req.query.fim, historico, profissionalId, visao, chave, coreEnabled()]);
      let version = null;
      try { version = dataVersion(); } catch { version = null; }
      const fromCache = () => {
        if (req.query.fresh === '1') return false;
        const cached = cacheGet(cacheKey, version);
        if (!cached) return false;
        res.set('X-Performance-Cache', 'hit');
        res.json(cached);
        return true;
      };
      if (coreEnabled()) {
        const context = await requireCommercePermission(req, 'reports.read');
        if (legacyEmpresaIdFromCommerce(context?.empresaId) !== empresaId || legacyLojaIdFromCommerce(context?.lojaId, context?.empresaId) !== lojaId) return res.status(403).json({ code: 'STORE_SCOPE_MISMATCH', error: 'O contexto do relatório não corresponde à unidade autorizada.' });
        // Permissão reports.read e escopo já conferidos: só então o cache pode responder.
        if (fromCache()) return;
        // Visões por item não usam o total do e-commerce (pedidos não têm profissional nem serviço).
        if (!visao && typeof salesReport !== 'function') return res.status(503).json({ code: 'PERFORMANCE_UNAVAILABLE', error: 'Relatório Commerce indisponível.' });
        const range = commerceWindow({ inicio: historico ? '2000-01-01' : req.query.inicio, fim: req.query.fim });
        const sales = visao ? null : await salesReport(context, range);
        req.equipeCommerce = {
          // Pedidos pendentes não representam faturamento nem produção da equipe.
          revenue: Number(sales?.summary?.confirmed_total || 0),
          orders: Number(sales?.summary?.confirmed_orders || 0),
        };
      } else if (fromCache()) return;
      const result = visao
        ? buildEquipeItens(db(), { empresaId, lojaId, inicio: req.query.inicio, fim: req.query.fim, historico, visao, chave })
        : buildEquipeDesempenho(db(), { empresaId, lojaId, inicio: req.query.inicio, fim: req.query.fim, profissionalId, historico, lean: !profissionalId, commerceCurrent: req.equipeCommerce });
      cacheSet(cacheKey, version, result);
      res.set('X-Performance-Cache', 'miss');
      res.json(result);
    } catch (error) {
      const denied = ['PERMISSION_DENIED', 'STORE_SCOPE_MISMATCH', 'TENANT_CONTEXT_REQUIRED'].includes(error?.code);
      const invalid = ['PERIOD_INVALID', 'PERIODO_INVALIDO', 'EXPLICIT_SCOPE_REQUIRED', 'PROFESSIONAL_NOT_FOUND', 'PERFORMANCE_QUERY_INVALID'].includes(error?.code);
      res.status(denied ? 403 : invalid || error instanceof RangeError ? 400 : 503).json({ code: denied ? 'PERMISSION_DENIED' : invalid ? error.code : 'PERFORMANCE_UNAVAILABLE', error: denied ? 'Esta sessão não pode consultar o desempenho da equipe.' : invalid ? 'Confira o período, a unidade e o filtro de profissional.' : 'Não foi possível carregar o desempenho. Tente novamente.' });
    }
  });
  app.all(EQUIPE_PERFORMANCE_PATH, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Allow', 'GET');
    res.status(405).json({ code: 'READ_ONLY_ENDPOINT', error: 'Esta tela permite apenas consulta.' });
  });
}
