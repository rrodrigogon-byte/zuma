import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

/**
 * /api/admin/unidades — cadastro das unidades da empresa ativa.
 * `empresaDaRequisicao(req)` resolve e autoriza a empresa (requireCommercePermission no server.js).
 */
export function createUnidadesAdminRouter({ db, empresaDaRequisicao }) {
  if (!db || typeof empresaDaRequisicao !== 'function') throw new Error('createUnidadesAdminRouter: db e empresaDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const executar = (fn, status = 200) => async (req, res) => {
    try {
      const escopo = await empresaDaRequisicao(req);
      const { empresaId, lojaRestrita = null } = typeof escopo === 'string' ? { empresaId: escopo } : escopo;
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  router.get('/', executar(async ({ req, empresaId, lojaRestrita }) => {
    const unidades = await svc.listarUnidades(db, empresaId, { incluirInativas: req.query.incluir_inativas === 'true', lojaRestrita });
    return { unidades, lojas: unidades, empresaToda: !lojaRestrita };
  }));
  router.post('/', executar(async ({ req, empresaId, lojaRestrita }) => ({ unidade: await svc.criarUnidade(db, empresaId, req.body || {}, { lojaRestrita }) }), 201));
  router.patch('/:id', executar(async ({ req, empresaId, lojaRestrita }) => ({ unidade: await svc.atualizarUnidade(db, empresaId, req.params.id, req.body || {}, { lojaRestrita }) })));
  router.get('/:id/auditoria', executar(({ req, empresaId, lojaRestrita }) => svc.verificarAuditoria(db, empresaId, req.params.id, { lojaRestrita })));
  return router;
}
