import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/** /api/admin/varejo — preços por unidade, promoções, lotes, etiquetas e transferências. */
export function createVarejoAdminRouter({ db, escopoDaRequisicao }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createVarejoAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      const pedida = String(req.query.lojaId ?? req.body?.lojaId ?? '').trim() || null;
      if (lojaRestrita && pedida && pedida !== lojaRestrita) throw new ErroDominio('STORE_SCOPE_MISMATCH', 'Unidade fora do seu acesso', 403);
      const lojaId = lojaRestrita || pedida;
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, lojaId, usuario: String(req.user?.nome || req.user?.email || 'equipe') }));
    } catch (error) { return responderErro(res, error); }
  };
  const empresaToda = (lojaRestrita, acao) => { if (lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', `${acao} exige permissão na empresa toda`, 403); };

  router.get('/produtos', rota('catalog.read', async ({ req, empresaId, lojaId }) => ({ produtos: await svc.listarProdutos(db, empresaId, { lojaId, q: req.query.q || '' }) })));
  router.get('/produtos/codigo/:codigo', rota('catalog.read', ({ req, empresaId, lojaId }) => svc.buscarPorCodigo(db, empresaId, req.params.codigo, { lojaId })));
  router.patch('/produtos/:id', rota('catalog.write', ({ req, empresaId, lojaRestrita, lojaId }) => {
    const corpo = { ...(req.body || {}) };
    // preço base, departamento, PLU etc. valem para a empresa toda; usuário de unidade só mexe no preço da unidade
    if (lojaRestrita && Object.keys(corpo).some((k) => !['precoUnidade', 'lojaId'].includes(k))) empresaToda(lojaRestrita, 'Alterar o cadastro do produto');
    return svc.configurarProduto(db, empresaId, req.params.id, corpo, { lojaId });
  }));
  router.get('/promocoes', rota('promotions.read', async ({ empresaId, lojaId }) => ({ promocoes: await svc.listarPromocoes(db, empresaId, { lojaId }) })));
  router.post('/promocoes', rota('promotions.write', ({ req, empresaId, lojaRestrita, lojaId, usuario }) => svc.criarPromocao(db, empresaId, req.body || {}, { usuario, lojaId: lojaRestrita || (req.body?.daUnidade ? lojaId : null) }), 201));
  router.patch('/promocoes/:id/status', rota('promotions.write', ({ req, empresaId, lojaRestrita }) => svc.mudarStatusPromocao(db, empresaId, req.params.id, String(req.body?.status || ''), { lojaRestrita })));
  router.get('/lotes', rota('inventory.read', async ({ empresaId, lojaId }) => ({ lotes: await svc.listarLotes(db, empresaId, { lojaId }) })));
  router.post('/lotes', rota('inventory.write', ({ req, empresaId, lojaId }) => svc.registrarLote(db, empresaId, req.body || {}, { lojaId }), 201));
  router.get('/etiquetas', rota('catalog.read', async ({ empresaId, lojaId }) => ({ etiquetas: await svc.listarEtiquetas(db, empresaId, { lojaId }) })));
  router.post('/etiquetas', rota('catalog.write', ({ req, empresaId, lojaId, usuario }) => svc.gerarEtiquetas(db, empresaId, req.body || {}, { usuario, lojaId }), 201));
  router.get('/transferencias', rota('inventory.read', async ({ empresaId, lojaId }) => ({ transferencias: await svc.listarTransferencias(db, empresaId, { lojaId }) })));
  router.post('/transferencias', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.criarTransferencia(db, empresaId, req.body || {}, { usuario, lojaRestrita }), 201));
  router.post('/transferencias/:id/:acao(enviar|receber|cancelar)', rota('inventory.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.acaoTransferencia(db, empresaId, req.params.id, req.params.acao, { recebidos: req.body?.recebidos, motivoFalta: req.body?.motivoFalta, usuario, lojaRestrita })));
  return router;
}
