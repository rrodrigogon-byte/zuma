/**
 * Rotas: Varejo Geral
 * SetPoint Ultra — Orçamentos, Entregas, Multi-Estoque, Tabelas de Preço
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── ORÇAMENTOS ────────────────────────────────────────────────────────────────
router.get('/orcamentos', requirePermission('vendas:view'), async (req, res) => {
  try {
    const orcamentos = await svc.listarOrcamentos(req.tenantId, req.query);
    res.json({ sucesso: true, orcamentos });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/orcamentos', requirePermission('vendas:create'), async (req, res) => {
  try {
    const resultado = await svc.criarOrcamento(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/orcamentos/:id/converter', requirePermission('vendas:create'), async (req, res) => {
  try {
    const pedido = await svc.converterOrcamentoPedido(req.params.id, req.tenantId);
    res.status(201).json({ sucesso: true, pedido });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── ESTOQUES MÚLTIPLOS ────────────────────────────────────────────────────────
router.get('/estoques', requirePermission('estoque:view'), async (req, res) => {
  try {
    const estoques = await svc.listarEstoques(req.tenantId);
    res.json({ sucesso: true, estoques });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/estoques', requirePermission('estoque:edit'), async (req, res) => {
  try {
    const estoque = await svc.criarEstoque(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, estoque });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/estoques/transferir', requirePermission('estoque:edit'), async (req, res) => {
  try {
    const resultado = await svc.transferirEstoque(req.tenantId, req.body);
    res.json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── TABELAS DE PREÇO ──────────────────────────────────────────────────────────
router.get('/tabelas-preco', requirePermission('produtos:view'), async (req, res) => {
  try {
    const tabelas = await svc.listarTabelasPreco(req.tenantId);
    res.json({ sucesso: true, tabelas });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/tabelas-preco', requirePermission('produtos:edit'), async (req, res) => {
  try {
    const tabela = await svc.criarTabelaPreco(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, tabela });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/tabelas-preco/aplicar', requirePermission('vendas:create'), async (req, res) => {
  try {
    const { cliente_id, produtos } = req.body;
    const precosAjustados = await svc.aplicarTabelaPreco(req.tenantId, cliente_id, produtos);
    res.json({ sucesso: true, produtos: precosAjustados });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── ENTREGAS ──────────────────────────────────────────────────────────────────
router.get('/entregas/roteiro', requirePermission('entregas:view'), async (req, res) => {
  try {
    const roteiro = await svc.roteirizarEntregasDia(req.tenantId, req.query.data || new Date().toISOString().split('T')[0]);
    res.json({ sucesso: true, roteiro });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/entregas/romaneio', requirePermission('entregas:view'), async (req, res) => {
  try {
    const romaneio = await svc.gerarRomaneio(req.tenantId, req.query.data, req.query.motorista_id);
    res.json({ sucesso: true, romaneio });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/entregas', requirePermission('entregas:edit'), async (req, res) => {
  try {
    const entrega = await svc.criarEntrega(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, entrega });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.patch('/entregas/:id/status', requirePermission('entregas:edit'), async (req, res) => {
  try {
    const entrega = await svc.atualizarStatusEntrega(req.params.id, req.tenantId, req.body.status, req.body);
    res.json({ sucesso: true, entrega });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

export default router;
