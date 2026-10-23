import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/**
 * /api/pdv-offline — gestão (login + escopo da empresa) e endpoints do agente local
 * (credencial do terminal: cabeçalhos X-Terminal-Id e X-Terminal-Token).
 */
export function createPdvOfflineRouter({ db, escopoDaRequisicao, auth, requireStaff }) {
  if (!db || typeof escopoDaRequisicao !== 'function' || typeof auth !== 'function') throw new Error('createPdvOfflineRouter: dependências obrigatórias');
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const gestao = (permissao, fn, status = 200) => [auth, requireStaff, async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, permissao);
      return res.status(status).json(await fn({ req, empresaId, lojaRestrita, usuario: String(req.user?.nome || req.user?.email || 'gestor') }));
    } catch (error) { return responderErro(res, error); }
  }];
  const terminal = (fn, status = 200) => async (req, res) => {
    try {
      const token = req.get('x-terminal-token') || String(req.get('authorization') || '').replace(/^Terminal\s+/i, '');
      const t = await svc.autenticarTerminal(db, req.get('x-terminal-id'), token);
      return res.status(status).json(await fn({ req, terminal: t }));
    } catch (error) { return responderErro(res, error); }
  };

  router.get('/terminais', ...gestao('settings.write', async ({ empresaId, lojaRestrita }) => ({ terminais: await svc.listarTerminais(db, empresaId, { lojaId: lojaRestrita }) })));
  router.post('/terminais', ...gestao('settings.write', ({ req, empresaId, lojaRestrita }) => svc.criarTerminal(db, empresaId, req.body || {}, { lojaRestrita }), 201));
  router.patch('/terminais/:id', ...gestao('settings.write', async ({ req, empresaId, lojaRestrita }) => ({ terminal: await svc.atualizarTerminal(db, empresaId, req.params.id, req.body || {}, { lojaRestrita }) })));
  router.post('/terminais/:id/rotacionar-token', ...gestao('settings.write', ({ req, empresaId, lojaRestrita }) => svc.rotacionarToken(db, empresaId, req.params.id, { lojaRestrita })));
  router.get('/dispositivos', ...gestao('settings.write', async ({ req, empresaId, lojaRestrita }) => {
    if (lojaRestrita && req.query.loja_id && req.query.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada', 404);
    return { dispositivos: await svc.listarDispositivos(db, empresaId, { lojaId: lojaRestrita || req.query.loja_id || null }) };
  }));
  router.post('/dispositivos', ...gestao('settings.write', async ({ req, empresaId, lojaRestrita }) => ({ dispositivo: await svc.criarDispositivo(db, empresaId, req.body || {}, { lojaRestrita }) }), 201));
  router.get('/conflitos', ...gestao('payments.read', async ({ req, empresaId, lojaRestrita }) => ({ conflitos: await svc.listarConflitos(db, empresaId, { lojaId: lojaRestrita, todos: req.query.todos === '1' }) })));
  router.patch('/conflitos/:id', ...gestao('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.resolverConflito(db, empresaId, req.params.id, req.body?.resolucao, { usuario, lojaRestrita })));

  // agente local
  router.post('/terminal/heartbeat', terminal(({ req, terminal: t }) => svc.heartbeat(db, t, req.body || {})));
  router.get('/terminal/fila-impressao', terminal(() => ({ trabalhos: [] })));
  router.post('/terminal/eventos', terminal(({ req }) => ({ sucesso: true, recebidos: Array.isArray(req.body?.eventos) ? Math.min(req.body.eventos.length, 100) : 0 }), 202));
  router.post('/sincronizar', terminal(({ req, terminal: t }) => svc.sincronizar(db, t, req.body || {})));
  return router;
}
