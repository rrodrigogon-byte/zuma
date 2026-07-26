/**
 * Rotas: Fiscal Nacional Completo
 * SetPoint Ultra — NFC-e, NF-e, NF-Se, Contingência, Cancelamento
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── CONFIGURAÇÃO FISCAL ───────────────────────────────────────────────────────
router.get('/config', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const config = await svc.obterConfigFiscal(req.tenantId);
    // Ocultar token sensível na resposta
    if (config) delete config.token_provedor;
    res.json({ sucesso: true, config });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/config', requirePermission('fiscal:admin'), async (req, res) => {
  try {
    const config = await svc.salvarConfigFiscal(req.tenantId, req.body);
    delete config.token_provedor;
    res.json({ sucesso: true, config });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── EMISSÃO ───────────────────────────────────────────────────────────────────
router.post('/nfce', requirePermission('fiscal:emitir'), async (req, res) => {
  try {
    const doc = await svc.emitirNFCe(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, documento: doc });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/nfe', requirePermission('fiscal:emitir'), async (req, res) => {
  try {
    const doc = await svc.emitirNFe(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, documento: doc });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/nfse', requirePermission('fiscal:emitir'), async (req, res) => {
  try {
    const doc = await svc.emitirNFSe(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, documento: doc });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── CANCELAMENTO ──────────────────────────────────────────────────────────────
router.post('/documentos/:id/cancelar', requirePermission('fiscal:cancelar'), async (req, res) => {
  try {
    const doc = await svc.cancelarDocumento(req.params.id, req.tenantId, req.body.justificativa);
    res.json({ sucesso: true, documento: doc });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── CONSULTAS ─────────────────────────────────────────────────────────────────
router.get('/documentos', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const docs = await svc.listarDocumentos(req.tenantId, req.query);
    res.json({ sucesso: true, documentos: docs });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

// ── CONTINGÊNCIA ──────────────────────────────────────────────────────────────
router.get('/contingencia/:tipo', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const contingencia = await svc.verificarContingencia(req.tenantId, req.params.tipo);
    res.json({ sucesso: true, em_contingencia: !!contingencia, contingencia });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/contingencia/:tipo/ativar', requirePermission('fiscal:admin'), async (req, res) => {
  try {
    await svc.ativarContingencia(req.tenantId, req.params.tipo, req.body.motivo);
    res.json({ sucesso: true, mensagem: 'Contingência ativada. Documentos serão emitidos offline.' });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/contingencia/:tipo/desativar', requirePermission('fiscal:admin'), async (req, res) => {
  try {
    await svc.desativarContingencia(req.tenantId, req.params.tipo);
    res.json({ sucesso: true, mensagem: 'Contingência desativada. Documentos pendentes serão reprocessados.' });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

export default router;
