/**
 * Rotas: Oficina Mecânica e Assistência Técnica
 * SetPoint Ultra — OS, Checklist, Orçamento, WhatsApp, Garantia
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── VEÍCULOS ──────────────────────────────────────────────────────────────────
router.get('/veiculos/buscar/:placa', requirePermission('oficina:view'), async (req, res) => {
  try {
    const veiculo = await svc.buscarVeiculoPorPlaca(req.tenantId, req.params.placa);
    if (!veiculo) return res.status(404).json({ sucesso: false, erro: 'Veículo não encontrado' });
    res.json({ sucesso: true, veiculo });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/veiculos', requirePermission('oficina:edit'), async (req, res) => {
  try {
    const veiculo = await svc.cadastrarVeiculo(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, veiculo });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── ORDENS DE SERVIÇO ─────────────────────────────────────────────────────────
router.get('/os', requirePermission('oficina:view'), async (req, res) => {
  try {
    const ordens = await svc.listarOS(req.tenantId, req.query);
    res.json({ sucesso: true, ordens });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/os', requirePermission('oficina:edit'), async (req, res) => {
  try {
    const os = await svc.abrirOS(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, os });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/os/:id/orcamento', requirePermission('oficina:edit'), async (req, res) => {
  try {
    const totais = await svc.adicionarOrcamento(req.params.id, req.tenantId, req.body);
    res.json({ sucesso: true, ...totais });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/os/:id/enviar-whatsapp', requirePermission('oficina:edit'), async (req, res) => {
  try {
    const dados = await svc.enviarOrcamentoWhatsApp(req.params.id, req.tenantId);
    res.json({ sucesso: true, ...dados });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/os/:id/aprovar', requirePermission('oficina:edit'), async (req, res) => {
  try {
    const os = await svc.aprovarOS(req.params.id, req.tenantId, req.body.aprovado_por || req.user?.nome);
    res.json({ sucesso: true, os });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// Rota pública para aprovação via link (sem autenticação)
router.post('/os/:id/aprovar-publico', async (req, res) => {
  try {
    const os = await svc.aprovarOS(req.params.id, req.query.tenant, 'cliente_whatsapp');
    res.json({ sucesso: true, mensagem: 'Orçamento aprovado com sucesso! Em breve entraremos em contato.', os });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/os/:id/finalizar', requirePermission('oficina:edit'), async (req, res) => {
  try {
    await svc.finalizarOS(req.params.id, req.tenantId, req.body);
    res.json({ sucesso: true, mensagem: 'OS finalizada com sucesso' });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── GARANTIAS ─────────────────────────────────────────────────────────────────
router.get('/garantias/veiculo/:veiculoId', requirePermission('oficina:view'), async (req, res) => {
  try {
    const garantias = await svc.verificarGarantias(req.tenantId, req.params.veiculoId);
    res.json({ sucesso: true, garantias });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
