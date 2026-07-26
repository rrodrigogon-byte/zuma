/**
 * Rotas do Módulo ESTOQUE
 * SetPoint Ultra - Movimentação, Inventário, Receitas
 */

import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as movimentacaoController from './controllers/movimentacao.js';
import * as inventarioController from './controllers/inventario.js';
import * as receitaController from './controllers/receita.js';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('estoque'));

// ============================================================================
// ROTAS DE MOVIMENTAÇÃO
// ============================================================================

router.post('/movimentacoes/entrada', requirePermission('estoque:edit'), movimentacaoController.registrarEntrada);
router.post('/movimentacoes/saida', requirePermission('estoque:edit'), movimentacaoController.registrarSaida);
router.post('/movimentacoes/ajuste', requirePermission('estoque:edit'), movimentacaoController.registrarAjuste);
router.get('/movimentacoes/historico', requirePermission('estoque:view'), movimentacaoController.obterHistorico);
router.get('/movimentacoes/rastrear-lote', requirePermission('estoque:view'), movimentacaoController.rastrearLote);

// ============================================================================
// ROTAS DE INVENTÁRIO
// ============================================================================

router.post('/inventarios', requirePermission('estoque:edit'), inventarioController.criarInventario);
router.post('/inventarios/:id/contagem', requirePermission('estoque:edit'), inventarioController.registrarContagem);
router.post('/inventarios/:id/finalizar', requirePermission('estoque:edit'), inventarioController.finalizarInventario);
router.get('/inventarios/divergencias', requirePermission('estoque:view'), inventarioController.obterDivergencias);

// ============================================================================
// ROTAS DE RECEITAS
// ============================================================================

router.post('/receitas', requirePermission('estoque:edit'), receitaController.criarReceita);
router.get('/receitas/:id', requirePermission('estoque:view'), receitaController.obterReceita);
router.get('/receitas', requirePermission('estoque:view'), receitaController.listarReceitas);
router.put('/receitas/:id', requirePermission('estoque:edit'), receitaController.atualizarReceita);
router.get('/receitas/:id/custo', requirePermission('estoque:view'), receitaController.calcularCusto);

export default router;
