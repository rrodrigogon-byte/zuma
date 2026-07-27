/**
 * Rotas: Compras e Gestão de Fornecedores
 * SetPoint Ultra
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── FORNECEDORES ──────────────────────────────────────────────────────────────
router.get('/fornecedores', requirePermission('compras:view'), async (req, res) => {
  try {
    const fornecedores = await svc.listarFornecedores(req.tenantId, req.query);
    res.json({ sucesso: true, fornecedores });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/fornecedores', requirePermission('compras:edit'), async (req, res) => {
  try {
    const fornecedor = await svc.criarFornecedor(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, fornecedor });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.put('/fornecedores/:id', requirePermission('compras:edit'), async (req, res) => {
  try {
    const fornecedor = await svc.atualizarFornecedor(req.params.id, req.tenantId, req.body);
    res.json({ sucesso: true, fornecedor });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── PEDIDOS DE COMPRA ─────────────────────────────────────────────────────────
router.get('/pedidos', requirePermission('compras:view'), async (req, res) => {
  try {
    const pedidos = await svc.listarPedidos(req.tenantId, req.query);
    res.json({ sucesso: true, pedidos });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/pedidos', requirePermission('compras:edit'), async (req, res) => {
  try {
    const resultado = await svc.criarPedidoCompra(req.tenantId, req.body, req.user.id);
    res.status(201).json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/pedidos/:id/aprovar', requirePermission('compras:aprovar'), async (req, res) => {
  try {
    const pedido = await svc.aprovarPedidoCompra(req.params.id, req.tenantId, req.user.id);
    res.json({ sucesso: true, pedido });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/pedidos/:id/receber', requirePermission('compras:edit'), async (req, res) => {
  try {
    const resultado = await svc.registrarRecebimento(req.params.id, req.tenantId, req.body.itens);
    res.json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── COTAÇÕES ──────────────────────────────────────────────────────────────────
router.post('/cotacoes', requirePermission('compras:edit'), async (req, res) => {
  try {
    const cotacao = await svc.criarCotacao(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, cotacao });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.get('/cotacoes/:id/comparar', requirePermission('compras:view'), async (req, res) => {
  try {
    const comparativo = await svc.compararCotacao(req.params.id, req.tenantId);
    res.json({ sucesso: true, comparativo });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
