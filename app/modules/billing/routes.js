/**
 * Routes: Billing & Assinaturas SaaS
 * SetPoint Ultra
 */
import express from 'express';
import { authMiddleware, adminOnly } from '../../core/security.js';
import * as svc from './service.js';

const router = express.Router();

// Todas as rotas requerem autenticação de super-admin
router.use(authMiddleware);

// GET /api/v1/billing/tenants
router.get('/tenants', adminOnly, async (req, res) => {
  try {
    const tenants = await svc.listarTenants(req.user.id, req.query);
    res.json(tenants);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/v1/billing/tenants
router.post('/tenants', adminOnly, async (req, res) => {
  try {
    const result = await svc.criarTenant(req.body);
    res.status(201).json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/v1/billing/cobrancas
router.get('/cobrancas', adminOnly, async (req, res) => {
  try {
    const cobrancas = await svc.listarCobrancas(req.query);
    res.json(cobrancas);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/v1/billing/cobrancas/:id/pagar
router.post('/cobrancas/:id/pagar', adminOnly, async (req, res) => {
  try {
    const result = await svc.registrarPagamento(req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/v1/billing/metricas
router.get('/metricas', adminOnly, async (req, res) => {
  try {
    const metricas = await svc.calcularMetricas();
    res.json(metricas);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/v1/billing/suspender-inadimplentes (webhook/cron)
router.post('/suspender-inadimplentes', adminOnly, async (req, res) => {
  try {
    const result = await svc.suspenderTenantesInadimplentes();
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
