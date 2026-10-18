// Rotas de quadras e reservas do clube. Montar sob a trava /api/admin, ex.: /api/admin/clube/quadras
//   GET/PUT  /config                 horário de funcionamento e regras (PUT pede settings.write)
//   GET      /cadastro               quadras (?todas=1 inclui desativadas)
//   POST     /cadastro               nova quadra · PUT /cadastro/:id edita · POST /cadastro/lote cria várias
//   GET      /grade?data=&modalidade= grade do dia (quadras × horários) com quem reservou
//   GET      /livres?data=&modalidade=&duracao=  horários livres
//   GET      /reservas?customerId=   próximas reservas do sócio
//   POST     /reservas               reserva da recepção (sócio, avulso ou bloqueio)
//   POST     /reservas/:id/cancelar
import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

export function createQuadrasAdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao = null }) {
  if (typeof empresaDaRequisicao !== 'function') throw new Error('empresaDaRequisicao é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const rota = (fn, status = 200) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : null;
      res.status(status).json(await fn({ req, empresaId, operador, corpo: req.body || {} }));
    } catch (error) { responderErro(res, error); }
  };

  router.get('/config', rota(({ empresaId }) => svc.obterConfig(db, empresaId)));
  router.put('/config', rota(({ empresaId, corpo }) => svc.salvarConfig(db, empresaId, corpo)));

  router.get('/cadastro', rota(({ req, empresaId }) => svc.listarQuadras(db, empresaId, { todas: req.query.todas === '1', modalidade: req.query.modalidade || '' })));
  router.post('/cadastro/lote', rota(({ empresaId, corpo }) => svc.criarQuadrasEmLote(db, empresaId, corpo), 201));
  router.post('/cadastro', rota(({ empresaId, corpo }) => svc.salvarQuadra(db, empresaId, corpo), 201));
  router.put('/cadastro/:id', rota(({ req, empresaId, corpo }) => svc.salvarQuadra(db, empresaId, corpo, req.params.id)));

  router.get('/grade', rota(({ req, empresaId }) => svc.grade(db, empresaId, { data: req.query.data || null, modalidade: req.query.modalidade || '' })));
  router.get('/livres', rota(({ req, empresaId }) => svc.horariosLivres(db, empresaId, {
    data: req.query.data, modalidade: req.query.modalidade || '', duracaoMin: req.query.duracao || null, aPartirDe: req.query.hora || '', limite: 40,
  })));
  router.get('/reservas', rota(({ req, empresaId }) => svc.reservasDoCliente(db, empresaId, req.query.customerId)));
  router.post('/reservas', rota(({ empresaId, operador, corpo }) => svc.reservar(db, empresaId, {
    quadraId: corpo.quadraId, customerId: corpo.customerId || null, data: corpo.data, hora: corpo.hora, duracaoMin: corpo.duracaoMin,
    tipo: corpo.tipo || 'socio', titulo: corpo.titulo || null, observacao: corpo.observacao || null, origem: 'recepcao', operador,
  }), 201));
  router.post('/reservas/:id/cancelar', rota(({ req, empresaId, operador }) => svc.cancelarReserva(db, empresaId, { reservaId: req.params.id, operador })));
  return router;
}
