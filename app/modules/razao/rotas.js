import express from 'express';
import * as svc from './servico.js';
import * as fontes from './fontes.js';
import { ErroDominio, exigirUuid, responderErro } from '../acesso/banco.js';

/**
 * /api/admin/razao — Financeiro da empresa sobre o razão único.
 *
 * `escopoDaRequisicao(req, permissao)` resolve e autoriza a empresa e devolve
 * { empresaId, lojaRestrita }: com a permissão presa a uma unidade, a leitura e a escrita ficam
 * nessa unidade. `fonteJson(empresaId)` devolve { chaveLegada, lancamentos, mapaUnidades } do
 * financeiro JSON antigo daquela empresa, ou null.
 */
export function createRazaoAdminRouter({ db, escopoDaRequisicao, fonteJson = null, ativo = () => process.env.FINANCEIRO_RAZAO === '1', fuso = svc.FUSO_PADRAO, intervaloSyncMs = 60_000 }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createRazaoAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const ultimaLeitura = new Map();
  async function lerFontes(empresaId, { forcar = false } = {}) {
    const agora = Date.now();
    if (!forcar && agora - (ultimaLeitura.get(empresaId) || 0) < intervaloSyncMs) return null;
    ultimaLeitura.set(empresaId, agora);
    const resultado = await fontes.sincronizarEmpresa(db, empresaId, { fuso });
    const json = typeof fonteJson === 'function' ? await fonteJson(empresaId) : null;
    if (json?.chaveLegada) {
      try { resultado.push(await fontes.sincronizarJson(db, empresaId, { ...json, fuso })); } catch (error) { resultado.push({ fonte: 'json', erro: String(error?.message || error).slice(0, 160) }); }
    }
    return resultado;
  }

  // Unidade pedida na consulta: '' / 'todas' = empresa toda; 'sem' = só sem unidade; uuid = a unidade.
  function unidadePedida(req, lojaRestrita) {
    const pedida = String(req.query.lojaId || req.body?.lojaId || '').trim();
    if (lojaRestrita) {
      if (pedida && pedida !== 'todas' && pedida !== lojaRestrita) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      return lojaRestrita;
    }
    return pedida || null;
  }

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, typeof permissao === 'function' ? permissao(req) : permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'gestor') }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  router.get('/estado', rota('payments.read', async ({ empresaId }) => ({ ativo: ativo() === true, fontes: await fontes.saudeDasFontes(db, empresaId) })));

  router.post('/sincronizar', rota('payments.write', async ({ empresaId }) => ({ fontes: await lerFontes(empresaId, { forcar: true }) })));

  router.get('/resumo', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.resumo(db, empresaId, { lojaId: unidadePedida(req, lojaRestrita), fuso });
  }));
  router.get('/fluxo', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => svc.fluxo(db, empresaId, { meses: req.query.meses, lojaId: unidadePedida(req, lojaRestrita), fuso })));
  router.get('/dre', rota('reports.read', ({ req, empresaId, lojaRestrita }) => svc.dre(db, empresaId, { de: req.query.de, ate: req.query.ate, lojaId: unidadePedida(req, lojaRestrita), centroCustoId: req.query.centroCustoId || null })));

  router.get('/lancamentos', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.listar(db, empresaId, { ...req.query, lojaId: unidadePedida(req, lojaRestrita) });
  }));
  router.post('/lancamentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    const corpo = { ...(req.body || {}) };
    if (lojaRestrita) corpo.lojaId = lojaRestrita;
    return svc.criarManual(db, empresaId, corpo, { usuario, fuso });
  }, 201));

  async function exigirNoAlcance(empresaId, id, lojaRestrita) {
    const l = await svc.obter(db, empresaId, id);
    if (lojaRestrita && l.lojaId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Lançamento não encontrado nesta empresa', 404);
    return l;
  }
  router.patch('/lancamentos/:id', rota('payments.write', async ({ req, empresaId, lojaRestrita }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    const corpo = { ...(req.body || {}) };
    if (lojaRestrita) delete corpo.lojaId;
    return svc.atualizar(db, empresaId, req.params.id, corpo, { fuso });
  }));
  router.post('/lancamentos/:id/baixar', rota('payments.write', async ({ req, empresaId, lojaRestrita }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.baixar(db, empresaId, req.params.id, { pagoEm: req.body?.pagoEm, meioPagamento: req.body?.meioPagamento }, { fuso });
  }));
  router.post('/lancamentos/:id/cancelar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.cancelar(db, empresaId, req.params.id, { usuario, motivo: req.body?.motivo });
  }));
  router.post('/lancamentos/:id/estornar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await exigirNoAlcance(empresaId, req.params.id, lojaRestrita);
    return svc.estornar(db, empresaId, req.params.id, { usuario, motivo: req.body?.motivo, fuso });
  }));
  router.post('/series/:serieId/cancelar', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Cancelar série exige permissão na empresa toda', 403);
    return svc.cancelarSerie(db, empresaId, req.params.serieId, { usuario, motivo: req.body?.motivo });
  }));

  router.get('/categorias', rota('payments.read', ({ empresaId }) => svc.listarCategorias(db, empresaId)));
  router.post('/categorias', rota('settings.write', ({ req, empresaId }) => svc.criarCategoria(db, empresaId, req.body || {}), 201));
  router.get('/centros-custo', rota('payments.read', async ({ empresaId }) => ({ centros: await svc.listarCentros(db, empresaId) })));
  router.post('/centros-custo', rota('settings.write', ({ req, empresaId }) => svc.salvarCentro(db, empresaId, req.body || {}), 201));
  router.patch('/centros-custo/:id', rota('settings.write', ({ req, empresaId }) => svc.salvarCentro(db, empresaId, req.body || {}, exigirUuid(req.params.id, 'centro de custo'))));

  router.get('/fechamentos', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => ({ fechamentos: await svc.listarFechamentos(db, empresaId, { lojaId: unidadePedida(req, lojaRestrita) }) })));
  router.get('/fechamentos/previa', rota('payments.read', async ({ req, empresaId, lojaRestrita }) => {
    await lerFontes(empresaId);
    return svc.totaisDoDia(db, empresaId, { data: req.query.data || svc.hojeNoFuso(new Date(), fuso), lojaId: unidadePedida(req, lojaRestrita), fuso });
  }));
  router.post('/fechamentos', rota('payments.write', async ({ req, empresaId, lojaRestrita, usuario }) => {
    await lerFontes(empresaId, { forcar: true });
    return svc.fecharDia(db, empresaId, { data: req.body?.data, lojaId: unidadePedida(req, lojaRestrita), responsavel: usuario, observacao: req.body?.observacao, fuso });
  }, 201));

  return router;
}

/** Rotas só da administração da plataforma: simular e aplicar a importação do JSON antigo. */
export function createRazaoPlataformaRouter({ db, fonteJson }) {
  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  router.post('/importar-legado', async (req, res) => {
    try {
      const empresaId = exigirUuid(req.body?.empresaId, 'empresa');
      const json = await fonteJson(empresaId);
      if (!json?.chaveLegada) throw new ErroDominio('NOT_FOUND', 'Esta empresa não tem financeiro no banco antigo', 404);
      res.json(await fontes.importarJsonLegado(db, empresaId, { ...json, aplicar: req.body?.aplicar === true }));
    } catch (error) {
      responderErro(res, error);
    }
  });
  return router;
}
