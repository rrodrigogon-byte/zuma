import express from 'express';
import * as MultiLojaService from './service.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try { res.json(await MultiLojaService.listarLojas(req.tenantId)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json((await MultiLojaService.criarLoja(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json((await MultiLojaService.atualizarLoja(req.tenantId, req.params.id, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/dre', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    res.json(await MultiLojaService.drePorLoja(req.tenantId, mes || new Date().getMonth() + 1, ano || new Date().getFullYear()));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/transferencias', async (req, res) => {
  try { res.json(await MultiLojaService.listarTransferencias(req.tenantId, req.query)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/transferencias', async (req, res) => {
  try { res.status(201).json(await MultiLojaService.criarTransferencia(req.tenantId, { ...req.body, usuario_id: req.usuarioId })); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/transferencias/:id/confirmar', async (req, res) => {
  try { res.json(await MultiLojaService.confirmarTransferencia(req.tenantId, req.params.id, req.usuarioId)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id/usuarios', async (req, res) => {
  try { res.json(await MultiLojaService.listarUsuariosPorLoja(req.tenantId, req.params.id)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/permissoes', async (req, res) => {
  try {
    const { usuario_id, permissoes } = req.body;
    res.json((await MultiLojaService.definirPermissoesUsuarioLoja(req.tenantId, usuario_id, req.params.id, permissoes)).rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

export default router;
