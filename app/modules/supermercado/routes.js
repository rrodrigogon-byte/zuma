/**
 * Routes: Supermercado
 * SetPoint Ultra — Módulo ERP Comercial
 */
import { Router } from 'express';
import { requireAuth, requireOrg } from '../../core/auth.js';
import * as svc from './service.js';

const router = Router();

// ── Produtos ─────────────────────────────────────────────────────────────────
router.get('/produtos', requireAuth, requireOrg, async (req, res) => {
  try {
    const produtos = await svc.listarProdutos(req.tenantId, req.query);
    res.json({ ok: true, produtos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/produtos/buscar/:codigo', requireAuth, async (req, res) => {
  try {
    const produto = await svc.buscarPorCodigoBarras(req.tenantId, req.params.codigo);
    if (!produto) return res.status(404).json({ ok: false, error: 'Produto não encontrado' });
    res.json({ ok: true, produto });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/produtos', requireAuth, requireOrg, async (req, res) => {
  try {
    const produto = await svc.criarProduto(req.tenantId, req.body);
    res.status(201).json({ ok: true, produto });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.put('/produtos/:id', requireAuth, requireOrg, async (req, res) => {
  try {
    const produto = await svc.atualizarProduto(req.tenantId, req.params.id, req.body);
    res.json({ ok: true, produto });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Setores ───────────────────────────────────────────────────────────────────
router.get('/setores', requireAuth, requireOrg, async (req, res) => {
  try {
    const setores = await svc.listarSetores(req.tenantId);
    res.json({ ok: true, setores });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/setores', requireAuth, requireOrg, async (req, res) => {
  try {
    const setor = await svc.criarSetor(req.tenantId, req.body);
    res.status(201).json({ ok: true, setor });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Lotes e Validade ──────────────────────────────────────────────────────────
router.get('/lotes', requireAuth, requireOrg, async (req, res) => {
  try {
    const lotes = await svc.listarLotes(req.tenantId, req.query);
    res.json({ ok: true, lotes });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/lotes/alerta', requireAuth, requireOrg, async (req, res) => {
  try {
    const total = await svc.contarLotesVencendo(req.tenantId, req.query.dias || 7);
    res.json({ ok: true, total });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/lotes', requireAuth, requireOrg, async (req, res) => {
  try {
    const lote = await svc.registrarLote(req.tenantId, req.body);
    res.status(201).json({ ok: true, lote });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Promoções ─────────────────────────────────────────────────────────────────
router.get('/promocoes', requireAuth, requireOrg, async (req, res) => {
  try {
    const promocoes = await svc.listarPromocoes(req.tenantId, req.query.ativas === 'true');
    res.json({ ok: true, promocoes });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/promocoes', requireAuth, requireOrg, async (req, res) => {
  try {
    const promocao = await svc.criarPromocao(req.tenantId, req.body);
    res.status(201).json({ ok: true, promocao });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Fichas Técnicas (Açougue/Padaria) ─────────────────────────────────────────
router.get('/fichas-tecnicas', requireAuth, requireOrg, async (req, res) => {
  try {
    const fichas = await svc.listarFichasTecnicas(req.tenantId, req.query.tipo);
    res.json({ ok: true, fichas });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/fichas-tecnicas', requireAuth, requireOrg, async (req, res) => {
  try {
    const ficha = await svc.criarFichaTecnica(req.tenantId, req.body);
    res.status(201).json({ ok: true, ficha });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Etiquetas ─────────────────────────────────────────────────────────────────
router.get('/etiqueta/:produtoId', requireAuth, async (req, res) => {
  try {
    const dados = await svc.gerarDadosEtiqueta(req.tenantId, req.params.produtoId);
    res.json({ ok: true, etiqueta: dados });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Inventário ────────────────────────────────────────────────────────────────
router.post('/inventario', requireAuth, requireOrg, async (req, res) => {
  try {
    const inv = await svc.iniciarInventario(req.tenantId, req.body);
    res.status(201).json({ ok: true, inventario: inv });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.post('/inventario/:id/contagem', requireAuth, requireOrg, async (req, res) => {
  try {
    const resultado = await svc.registrarContagemInventario(req.tenantId, req.params.id, req.body.itens);
    res.json({ ok: true, ...resultado });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.post('/inventario/:id/fechar', requireAuth, requireOrg, async (req, res) => {
  try {
    const inv = await svc.fecharInventario(req.tenantId, req.params.id, req.body.aplicar_ajustes);
    res.json({ ok: true, inventario: inv });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// ── Relatórios ────────────────────────────────────────────────────────────────
router.get('/relatorios/vendas-setor', requireAuth, requireOrg, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const dados = await svc.relatorioVendasPorSetor(req.tenantId, data_inicio, data_fim);
    res.json({ ok: true, dados });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/relatorios/curva-abc', requireAuth, requireOrg, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const dados = await svc.curvABC(req.tenantId, data_inicio, data_fim);
    res.json({ ok: true, dados });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

export default router;
