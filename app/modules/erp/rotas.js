// ============================================================================
// ROTAS REST: KYTTO ERP 360
// Propostas Comerciais, Ordens de Serviço, Expedição/Romaneios e Patrimônio
// ============================================================================
import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

export function createErpAdminRouter({ db, escopoDaRequisicao }) {
  if (!db || typeof escopoDaRequisicao !== 'function') {
    throw new Error('createErpAdminRouter: db e escopoDaRequisicao são obrigatórios');
  }

  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const rota = (permissao, fn, status = 200) => async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      const usuario = String(req.user?.nome || req.user?.email || 'equipe');
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // ── KPIS GERAIS DO ERP ───────────────────────────────────────────────────
  router.get('/kpis', rota('catalog.read', ({ empresaId }) => svc.obterKpisErp(db, empresaId)));

  // ── PROPOSTAS COMERCIAIS & ORÇAMENTOS ────────────────────────────────────
  router.get('/propostas', rota('catalog.read', ({ req, empresaId }) => svc.listarPropostas(db, empresaId, {
    status: req.query.status,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/propostas/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterProposta(db, empresaId, req.params.id)));

  router.post('/propostas', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarProposta(db, empresaId, req.body || {}, usuario), 201));

  router.put('/propostas/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarProposta(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/propostas/:id/status', rota('catalog.write', ({ req, empresaId, usuario }) => svc.alterarStatusProposta(db, empresaId, req.params.id, req.body || {}, usuario)));

  router.post('/propostas/:id/converter', rota('catalog.write', ({ req, empresaId, usuario }) => svc.converterPropostaEmVenda(db, empresaId, req.params.id, req.body || {}, usuario)));

  // ── ORDENS DE SERVIÇO & MANUTENÇÃO (OS 360) ──────────────────────────────
  router.get('/os', rota('catalog.read', ({ req, empresaId }) => svc.listarOS(db, empresaId, {
    status: req.query.status,
    prioridade: req.query.prioridade,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/os/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterOS(db, empresaId, req.params.id)));

  router.post('/os', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarOS(db, empresaId, req.body || {}, usuario), 201));

  router.put('/os/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarOS(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/os/:id/status', rota('catalog.write', ({ req, empresaId, usuario }) => svc.atualizarStatusOS(db, empresaId, req.params.id, req.body?.status, usuario)));

  router.post('/os/:id/faturar', rota('catalog.write', ({ req, empresaId, usuario }) => svc.faturarOS(db, empresaId, req.params.id, usuario)));

  router.post('/os/:id/assinatura', rota('catalog.write', ({ req, empresaId }) => svc.salvarAssinaturaOS(db, empresaId, req.params.id, req.body?.assinatura)));

  // ── EXPEDIÇÃO, LOGÍSTICA & ROMANEIOS ─────────────────────────────────────
  router.get('/romaneios', rota('catalog.read', ({ req, empresaId }) => svc.listarRomaneios(db, empresaId, {
    status: req.query.status,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.get('/romaneios/:id', rota('catalog.read', ({ req, empresaId }) => svc.obterRomaneio(db, empresaId, req.params.id)));

  router.post('/romaneios', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarRomaneio(db, empresaId, req.body || {}, usuario), 201));

  router.put('/romaneios/:id', rota('catalog.write', ({ req, empresaId, usuario }) => svc.salvarRomaneio(db, empresaId, { ...(req.body || {}), id: req.params.id }, usuario)));

  router.post('/romaneios/:id/entrega/:entregaId', rota('catalog.write', ({ req, empresaId }) => svc.atualizarStatusEntrega(db, empresaId, req.params.id, req.params.entregaId, req.body || {})));

  // ── PATRIMÔNIO & ATIVOS IMOBILIZADOS ─────────────────────────────────────
  router.get('/ativos', rota('catalog.read', ({ req, empresaId }) => svc.listarAtivos(db, empresaId, {
    categoria: req.query.categoria,
    busca: req.query.busca || req.query.q,
    limit: Number(req.query.limit || 50),
    offset: Number(req.query.offset || 0)
  })));

  router.post('/ativos', rota('catalog.write', ({ req, empresaId }) => svc.salvarAtivo(db, empresaId, req.body || {}), 201));

  router.put('/ativos/:id', rota('catalog.write', ({ req, empresaId }) => svc.salvarAtivo(db, empresaId, { ...(req.body || {}), id: req.params.id })));

  router.post('/ativos/:id/manutencao', rota('catalog.write', ({ req, empresaId }) => svc.registrarManutencaoAtivo(db, empresaId, req.params.id, req.body || {})));

  return router;
}
