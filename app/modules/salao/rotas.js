import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

/** /api/admin/salao — reservas de mesa e lista de espera da empresa ativa. */
export function createSalaoAdminRouter({ db, escopoDaRequisicao, fuso = svc.FUSO_PADRAO }) {
  if (!db || typeof escopoDaRequisicao !== 'function') throw new Error('createSalaoAdminRouter: db e escopoDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'equipe') }));
    } catch (error) { return responderErro(res, error); }
  };
  router.get('/reservas', rota('customers.read', async ({ req, empresaId, lojaRestrita }) => ({ reservas: await svc.listarReservas(db, empresaId, { de: req.query.de, ate: req.query.ate, fuso, lojaId: lojaRestrita }) })));
  router.get('/reservas/visao', rota('customers.read', ({ req, empresaId, lojaRestrita }) => svc.visaoDoDia(db, empresaId, { data: req.query.data, fuso, lojaId: lojaRestrita })));
  router.post('/reservas', rota('customers.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.criarReserva(db, empresaId, req.body || {}, { usuario, fuso, lojaId: lojaRestrita }), 201));
  router.post('/reservas/:id/status', rota('customers.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.mudarStatusReserva(db, empresaId, req.params.id, String(req.body?.status || ''), { usuario, lojaRestrita })));
  router.get('/fila', rota('customers.read', async ({ req, empresaId, lojaRestrita }) => ({ fila: await svc.listarFila(db, empresaId, { fuso, lojaId: lojaRestrita, todas: req.query.todas === '1' }) })));
  router.post('/fila', rota('customers.write', ({ req, empresaId, lojaRestrita }) => svc.entrarNaFila(db, empresaId, req.body || {}, { fuso, lojaId: lojaRestrita }), 201));
  router.post('/fila/:id/chamar', rota('customers.write', ({ req, empresaId, lojaRestrita }) => svc.chamar(db, empresaId, req.params.id, { mesaNum: req.body?.mesaNum, lojaRestrita })));
  router.post('/fila/:id/finalizar', rota('customers.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.finalizar(db, empresaId, req.params.id, String(req.body?.status || ''), { usuario, lojaRestrita })));
  return router;
}
