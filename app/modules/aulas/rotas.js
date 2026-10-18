// Rotas da agenda de aulas (item 5). Montar sob a trava /api/admin, ex.: /api/admin/clube/aulas
import express from 'express';
import * as svc from './servico.js';
import { responderErro, exigirData } from '../acesso/banco.js';

/**
 * @param {object} o
 * @param {object} o.db
 * @param {Function} o.empresaDaRequisicao
 * @param {Function} [o.enviarAvisos]  (avisos[]) => Promise — manda pelo WhatsApp os avisos devolvidos pelo serviço
 */
export function createAulasAdminRouter({ db, empresaDaRequisicao, enviarAvisos = async () => {} }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '128kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (fn) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const r = await fn({ req, res, empresaId });
      if (r && Array.isArray(r.avisos) && r.avisos.length) await enviarAvisos(r.avisos).catch((e) => console.error('[aulas] avisos', String(e?.message || '').slice(0, 200)));
      if (!res.headersSent) res.json(r);
    } catch (error) { responderErro(res, error); }
  };

  router.get('/modalidades', rota(({ empresaId }) => svc.listarModalidades(db, empresaId)));
  router.post('/modalidades', rota(async ({ req, res, empresaId }) => { res.status(201).json(await svc.salvarModalidade(db, empresaId, req.body || {})); }));
  router.put('/modalidades/:id', rota(({ req, empresaId }) => svc.salvarModalidade(db, empresaId, req.body || {}, req.params.id)));

  router.post('/turmas', rota(async ({ req, res, empresaId }) => {
    const turma = await svc.salvarTurma(db, empresaId, req.body || {});
    // já deixa as próximas 2 semanas na grade
    const hoje = new Date().toISOString().slice(0, 10);
    const ate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    await svc.gerarOcorrencias(db, empresaId, { de: hoje, ate });
    res.status(201).json(turma);
  }));
  router.post('/ocorrencias/gerar', rota(({ req, empresaId }) => svc.gerarOcorrencias(db, empresaId, { de: req.body?.de, ate: req.body?.ate })));

  router.get('/grade', rota(({ req, empresaId }) => {
    const de = exigirData(req.query.de, 'de');
    const ate = exigirData(req.query.ate, 'ate');
    return svc.listarGrade(db, empresaId, { de: `${de}T00:00:00Z`, ate: `${ate}T23:59:59Z`, modalidadeId: req.query.modalidadeId || null });
  }));
  router.get('/ocorrencias/:id/lista', rota(({ req, empresaId }) => svc.listaDaAula(db, empresaId, req.params.id)));
  router.post('/ocorrencias/:id/cancelar', rota(({ req, empresaId }) => svc.cancelarAula(db, empresaId, req.params.id, req.body?.motivo)));

  router.post('/reservas', rota(async ({ req, res, empresaId }) => {
    res.status(201).json(await svc.reservar(db, empresaId, { ocorrenciaId: req.body?.ocorrenciaId, customerId: req.body?.customerId, origem: 'recepcao' }));
  }));
  router.post('/reservas/:id/cancelar', rota(({ req, empresaId }) => svc.cancelarReserva(db, empresaId, { reservaId: req.params.id })));
  router.post('/reservas/:id/presenca', rota(({ req, empresaId }) => svc.marcarPresencaManual(db, empresaId, req.params.id, req.body?.presente !== false)));
  router.post('/fila', rota(({ req, empresaId }) => svc.entrarNaFila(db, empresaId, { ocorrenciaId: req.body?.ocorrenciaId, customerId: req.body?.customerId })));

  return router;
}
