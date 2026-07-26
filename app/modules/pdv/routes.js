/**
 * Rotas do Módulo PDV
 * SetPoint Ultra - PDV, Caixa, Vendas
 */

import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as caixaController from './controllers/caixa.js';
import * as vendaController from './controllers/venda.js';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('pdv'));

// ============================================================================
// ROTAS DE CAIXA
// ============================================================================

router.post('/caixa/abrir', requirePermission('caixa:edit'), caixaController.abrirCaixa);
router.post('/caixa/fechar', requirePermission('caixa:edit'), caixaController.fecharCaixa);
router.get('/caixa/aberto', requirePermission('caixa:view'), caixaController.obterCaixaAberto);
router.post('/caixa/sangria', requirePermission('caixa:edit'), caixaController.registrarSangria);
router.post('/caixa/suprimento', requirePermission('caixa:edit'), caixaController.registrarSuprimento);

// ============================================================================
// ROTAS DE VENDA
// ============================================================================

router.post('/vendas', requirePermission('vendas:create'), vendaController.criarVenda);
router.get('/vendas/:id', requirePermission('vendas:view'), vendaController.obterVenda);
router.post('/vendas/:id/cancelar', requirePermission('vendas:edit'), vendaController.cancelarVenda);
router.get('/vendas', requirePermission('vendas:view'), vendaController.listarVendas);

export default router;
