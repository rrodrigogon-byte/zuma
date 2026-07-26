/**
 * Rotas: Loja de Moda
 * SetPoint Ultra — Grade, Crediário, Condicional, Vale-Presente, Comissões
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── PRODUTOS E GRADE ──────────────────────────────────────────────────────────
router.get('/produtos', requirePermission('produtos:view'), async (req, res) => {
  try {
    const produtos = await svc.listarProdutos(req.tenantId, req.query);
    res.json({ sucesso: true, produtos });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/produtos', requirePermission('produtos:edit'), async (req, res) => {
  try {
    const resultado = await svc.criarProdutoComGrade(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.get('/produtos/buscar/:codigo', requirePermission('vendas:create'), async (req, res) => {
  try {
    const variacao = await svc.buscarVariacaoPorCodigo(req.tenantId, req.params.codigo);
    if (!variacao) return res.status(404).json({ sucesso: false, erro: 'Produto não encontrado' });
    res.json({ sucesso: true, variacao });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.patch('/grades/:gradeId/estoque', requirePermission('estoque:edit'), async (req, res) => {
  try {
    const { quantidade, operacao } = req.body;
    const grade = await svc.atualizarEstoqueGrade(req.params.gradeId, quantidade, operacao);
    res.json({ sucesso: true, grade });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── CREDIÁRIO ─────────────────────────────────────────────────────────────────
router.get('/crediario/clientes', requirePermission('financeiro:view'), async (req, res) => {
  try {
    const { rows } = await (await import('../../core/database.js')).db.query(
      `SELECT * FROM loja_crediario_clientes WHERE tenant_id = $1 ORDER BY nome`,
      [req.tenantId]
    );
    res.json({ sucesso: true, clientes: rows });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/crediario/clientes', requirePermission('financeiro:edit'), async (req, res) => {
  try {
    const cliente = await svc.criarClienteCrediario(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, cliente });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/crediario/vendas', requirePermission('vendas:create'), async (req, res) => {
  try {
    const venda = await svc.realizarVendaCrediario(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, venda });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/crediario/parcelas/:parcelaId/pagar', requirePermission('financeiro:edit'), async (req, res) => {
  try {
    const parcela = await svc.pagarParcela(req.params.parcelaId, req.body.valor_pago);
    res.json({ sucesso: true, parcela });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.get('/crediario/inadimplentes', requirePermission('financeiro:view'), async (req, res) => {
  try {
    const parcelas = await svc.listarParcelasVencidas(req.tenantId);
    res.json({ sucesso: true, parcelas });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

// ── CONDICIONAL (MALINHA) ─────────────────────────────────────────────────────
router.get('/condicionais', requirePermission('vendas:view'), async (req, res) => {
  try {
    const { rows } = await (await import('../../core/database.js')).db.query(
      `SELECT c.*, COUNT(ci.id) AS total_pecas
       FROM loja_condicionais c
       LEFT JOIN loja_condicionais_itens ci ON ci.condicional_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.tenantId]
    );
    res.json({ sucesso: true, condicionais: rows });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/condicionais', requirePermission('vendas:create'), async (req, res) => {
  try {
    const cond = await svc.abrirCondicional(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, condicional: cond });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/condicionais/:id/retornar', requirePermission('vendas:edit'), async (req, res) => {
  try {
    const resultado = await svc.retornarCondicional(req.params.id, req.body.itens_retornados);
    res.json({ sucesso: true, ...resultado });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── VALE-PRESENTE ─────────────────────────────────────────────────────────────
router.post('/vale-presente', requirePermission('vendas:create'), async (req, res) => {
  try {
    const vale = await svc.emitirValePresente(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, vale });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/vale-presente/utilizar', requirePermission('vendas:create'), async (req, res) => {
  try {
    const { codigo, valor } = req.body;
    const vale = await svc.utilizarValePresente(req.tenantId, codigo, valor);
    res.json({ sucesso: true, vale });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── COMISSÕES ─────────────────────────────────────────────────────────────────
router.get('/comissoes', requirePermission('relatorios:view'), async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const comissoes = await svc.calcularComissoesPeriodo(req.tenantId, data_inicio, data_fim);
    res.json({ sucesso: true, comissoes });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
