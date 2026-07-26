/**
 * Rotas: Business Intelligence e Relatórios
 * SetPoint Ultra — Dashboard, DRE, Curva ABC, Fluxo de Caixa
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/dashboard', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const dashboard = await svc.obterDashboard(req.tenantId);
    res.json({ sucesso: true, dashboard });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/dre', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const dre = await svc.gerarDRE(req.tenantId, parseInt(mes), parseInt(ano));
    res.json({ sucesso: true, dre });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/curva-abc', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const curva = await svc.gerarCurvaABC(req.tenantId, data_inicio, data_fim);
    res.json({ sucesso: true, curva });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/fluxo-caixa', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const fluxo = await svc.gerarFluxoCaixa(req.tenantId, parseInt(req.query.dias || 30));
    res.json({ sucesso: true, fluxo });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/ranking-vendedores', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const ranking = await svc.rankingVendedores(req.tenantId, data_inicio, data_fim);
    res.json({ sucesso: true, ranking });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
