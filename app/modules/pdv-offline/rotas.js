import express from 'express';
import * as svc from './servico.js';
import { ErroDominio, responderErro } from '../acesso/banco.js';

/**
 * /api/pdv-offline — gestão (login + escopo da empresa) e endpoints do agente local
 * (credencial do terminal: cabeçalhos X-Terminal-Id e X-Terminal-Token).
 */
export function createPdvOfflineRouter({ db, escopoDaRequisicao, auth, requireStaff, fuso = 'America/Cuiaba' }) {
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
  // fila de impressão: teste de periférico e impressão enviada pelo sistema
  router.get('/impressoes', ...gestao('settings.write', async ({ req, empresaId, lojaRestrita }) => ({ impressoes: await svc.listarImpressoes(db, empresaId, { lojaId: lojaRestrita || req.query.loja_id || null }) })));
  router.post('/impressoes', ...gestao('settings.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.enfileirarImpressao(db, empresaId, req.body || {}, { usuario, lojaRestrita }), 201));
  router.get('/terminais/:id/eventos', ...gestao('settings.write', async ({ req, empresaId, lojaRestrita }) => {
    const [t] = (await svc.listarTerminais(db, empresaId, { lojaId: lojaRestrita })).filter((x) => x.id === req.params.id);
    if (!t) throw new ErroDominio('NOT_FOUND', 'Terminal não encontrado', 404);
    return { eventos: await svc.listarEventosDoAgente(db, empresaId, { terminalId: t.id }) };
  }));
  router.get('/conflitos', ...gestao('payments.read', async ({ req, empresaId, lojaRestrita }) => ({ conflitos: await svc.listarConflitos(db, empresaId, { lojaId: lojaRestrita, todos: req.query.todos === '1' }) })));
  router.patch('/conflitos/:id', ...gestao('payments.write', ({ req, empresaId, lojaRestrita, usuario }) => svc.resolverConflito(db, empresaId, req.params.id, req.body?.resolucao, { usuario, lojaRestrita, fuso })));

  // agente local
  router.post('/terminal/heartbeat', terminal(({ req, terminal: t }) => svc.heartbeat(db, t, req.body || {})));
  // um trabalho por vez; 204 = fila vazia (é o que o agente espera)
  router.get('/terminal/fila-impressao', async (req, res) => {
    try {
      const token = req.get('x-terminal-token') || String(req.get('authorization') || '').replace(/^Terminal\s+/i, '');
      const t = await svc.autenticarTerminal(db, req.get('x-terminal-id'), token);
      const trabalho = await svc.proximoTrabalho(db, t);
      return trabalho ? res.json({ trabalho }) : res.status(204).end();
    } catch (error) { return responderErro(res, error); }
  });
  router.post('/terminal/fila-impressao/:id/resultado', terminal(({ req, terminal: t }) => svc.resultadoDoTrabalho(db, t, req.params.id, req.body || {})));
  router.post('/terminal/eventos', terminal(({ req, terminal: t }) => svc.registrarEventosDoAgente(db, t, req.body?.eventos), 202));
  router.post('/sincronizar', terminal(({ req, terminal: t }) => svc.sincronizar(db, t, req.body || {}, { fuso })));
  return router;
}
