// Rotas do Painel de gestão da barbearia (dia e comparativo). Leitura para a gestão
// da empresa; a única escrita é a meta diária (equipe e individual).
import { buildPainelGestao, buildComparativo, obterMetasPainel, salvarMetasPainel, PainelGestaoError } from './dino-painel-gestao.js';

export const PAINEL_GESTAO_PATH = '/api/admin/barbearia/painel-gestao';
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 12;
const cache = new Map();

function cacheGet(chave, versao) {
  const hit = cache.get(chave);
  if (!hit) return null;
  if (hit.versao !== versao || Date.now() - hit.em > CACHE_TTL_MS) { cache.delete(chave); return null; }
  return hit.valor;
}
function cacheSet(chave, versao, valor) {
  for (const [k, item] of cache) if (item.versao !== versao || Date.now() - item.em > CACHE_TTL_MS) cache.delete(k);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(chave, { versao, em: Date.now(), valor });
}

function gestor(req) {
  const manager = ['admin', 'organizador'].includes(String(req.user?.role || ''));
  const contaPermitida = req.user?.pgAccount !== true || req.user?.platformAdmin === true || req.user?.mainAdmin === true || ['platform_owner', 'tenant_owner', 'store_admin'].includes(req.user?.commerceRoleCode);
  return manager && contaPermitida;
}

function escopo(req, legacyEmpresaId, legacyLojaId) {
  const empresaId = String(legacyEmpresaId(req) || '');
  const lojaId = String(legacyLojaId(req) || '');
  if (!empresaId || empresaId === 'principal' || !lojaId) throw new PainelGestaoError('Selecione uma empresa e uma unidade autorizadas.', 'EXPLICIT_SCOPE_REQUIRED', 409);
  return { empresaId, lojaId };
}

function erro(res, error) {
  const status = error instanceof PainelGestaoError ? error.status : ['PERIOD_INVALID', 'EXPLICIT_SCOPE_REQUIRED'].includes(error?.code) ? 400 : 503;
  const mensagem = status === 503 ? 'Não foi possível montar o painel agora. Tente novamente.' : error.message;
  res.status(status).json({ code: error?.code || 'PAINEL_INDISPONIVEL', error: mensagem });
}

export function registerPainelGestaoRoutes(app, { db, save, audit = () => {}, legacyEmpresaId, legacyLojaId, dataVersion = () => null }) {
  const versao = () => { try { return dataVersion(); } catch { return null; } };
  const negar = (res) => res.status(403).json({ code: 'TENANT_MANAGER_REQUIRED', error: 'O painel de gestão é reservado à gestão da empresa.' });

  app.get(PAINEL_GESTAO_PATH, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!gestor(req)) return negar(res);
    try {
      const { empresaId, lojaId } = escopo(req, legacyEmpresaId, legacyLojaId);
      const data = typeof req.query.data === 'string' ? req.query.data : '';
      const minuto = Math.floor(Date.now() / 60_000);
      const chave = JSON.stringify(['dia', empresaId, lojaId, data, minuto]);
      const v = versao();
      const salvo = req.query.fresh === '1' ? null : cacheGet(chave, v);
      if (salvo) return res.json(salvo);
      const resultado = buildPainelGestao(db(), { empresaId, lojaId, data });
      cacheSet(chave, v, resultado);
      res.json(resultado);
    } catch (error) { erro(res, error); }
  });

  app.get(`${PAINEL_GESTAO_PATH}/comparativo`, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!gestor(req)) return negar(res);
    try {
      const { empresaId, lojaId } = escopo(req, legacyEmpresaId, legacyLojaId);
      const q = Object.fromEntries(['inicioA', 'fimA', 'inicioB', 'fimB', 'profissionalId'].map((k) => [k, typeof req.query[k] === 'string' ? req.query[k] : '']));
      const chave = JSON.stringify(['cmp', empresaId, lojaId, q]);
      const v = versao();
      const salvo = req.query.fresh === '1' ? null : cacheGet(chave, v);
      if (salvo) return res.json(salvo);
      const resultado = buildComparativo(db(), { empresaId, lojaId, ...q });
      cacheSet(chave, v, resultado);
      res.json(resultado);
    } catch (error) { erro(res, error); }
  });

  app.get(`${PAINEL_GESTAO_PATH}/metas`, (req, res) => {
    if (!gestor(req)) return negar(res);
    try {
      const { empresaId } = escopo(req, legacyEmpresaId, legacyLojaId);
      res.json({ ok: true, metas: obterMetasPainel(db(), empresaId) });
    } catch (error) { erro(res, error); }
  });

  app.put(`${PAINEL_GESTAO_PATH}/metas`, (req, res) => {
    if (!gestor(req)) return negar(res);
    try {
      const { empresaId } = escopo(req, legacyEmpresaId, legacyLojaId);
      const raiz = db();
      const cadastro = raiz?.barbearias?.[empresaId]?.profissionais || {};
      const validos = new Set(Object.values(cadastro).filter((item) => String(item?.empresaId) === empresaId).map((item) => String(item.id)));
      const metas = salvarMetasPainel(raiz, empresaId, req.body || {}, { profissionaisValidos: validos, usuario: req.user?.email || req.user?.nome || '' });
      save();
      cache.clear();
      audit(req, 'METAS DIÁRIAS DO PAINEL', `equipe=${metas.metaEquipe ?? '-'}; individuais=${Object.keys(metas.individuais).length}`);
      res.json({ ok: true, metas });
    } catch (error) { erro(res, error); }
  });
}
