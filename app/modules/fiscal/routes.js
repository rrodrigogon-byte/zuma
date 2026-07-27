/**
 * Rotas: Fiscal Nacional Completo (MOTOR PRÓPRIO)
 * SetPoint Ultra — NFC-e, NF-e, NF-Se, Contingência, Cancelamento, DANFE
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';
import { gerarDanfeNFCePdf } from '../../core/danfe-generator.js';
import { db } from '../../core/database.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── CONFIGURAÇÃO FISCAL E CERTIFICADO ─────────────────────────────────────────
router.get('/config', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const config = await svc.obterConfigFiscal(req.tenantId);
    if (config) delete config.certificado_senha; // Ocultar senha
    res.json({ sucesso: true, config });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/config', requirePermission('fiscal:admin'), async (req, res) => {
  try {
    const config = await svc.salvarConfigFiscal(req.tenantId, req.body);
    delete config.certificado_senha;
    res.json({ sucesso: true, config });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/certificado', requirePermission('fiscal:admin'), async (req, res) => {
  try {
    // req.body.pfx_base64 e req.body.senha
    const resultado = await svc.uploadCertificadoA1(req.tenantId, req.body.pfx_base64, req.body.senha);
    res.json(resultado);
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── EMISSÃO ───────────────────────────────────────────────────────────────────
router.post('/nfce', requirePermission('fiscal:emitir'), async (req, res) => {
  try {
    const doc = await svc.emitirNFCe(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, documento: doc });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── IMPRESSÃO (DANFE) ─────────────────────────────────────────────────────────
router.get('/documentos/:id/danfe', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM fiscal_documentos WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    const doc = result.rows[0];
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado' });
    if (!doc.xml_retorno) return res.status(400).json({ erro: 'XML não disponível. Documento ainda em processamento ou contingência.' });

    // Em produção, o URL do QR Code vem da SEFAZ, aqui simulamos a montagem se necessário
    const urlQrCode = `http://www.sefaz.mt.gov.br/nfce/consultanfce?chNFe=${doc.chave_acesso}`;
    const htmlDanfe = await gerarDanfeNFCePdf(doc.xml_retorno, urlQrCode);

    res.send(htmlDanfe); // Retorna HTML direto para o navegador imprimir na bobina térmica
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

// ── CONSULTAS E CANCELAMENTO ──────────────────────────────────────────────────
router.get('/documentos', requirePermission('fiscal:view'), async (req, res) => {
  try {
    const docs = await svc.listarDocumentos(req.tenantId, req.query);
    res.json({ sucesso: true, documentos: docs });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
