/**
 * Rotas do Módulo LOJA
 * SetPoint Ultra - PDV e Vendas
 */

import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as pdvController from './controllers/pdv.js';
import * as vendedorController from './controllers/vendedor.js';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('loja'));

// ============================================================================
// ROTAS DE PDV
// ============================================================================

router.get('/pdv/carrinho', requirePermission('vendas:view'), pdvController.obterCarrinho);
router.post('/pdv/carrinho/itens', requirePermission('vendas:create'), pdvController.adicionarAoCarrinho);
router.put('/pdv/carrinho/itens/:itemId', requirePermission('vendas:create'), pdvController.atualizarItemCarrinho);
router.delete('/pdv/carrinho/itens/:itemId', requirePermission('vendas:create'), pdvController.removerDoCarrinho);
router.post('/pdv/carrinho/limpar', requirePermission('vendas:create'), pdvController.limparCarrinho);
router.post('/pdv/venda', requirePermission('vendas:create'), pdvController.finalizarVenda);

// ============================================================================
// ROTAS DE VENDEDOR
// ============================================================================

router.get('/vendedores', requirePermission('usuarios:view'), vendedorController.listarVendedores);
router.post('/vendedores', requirePermission('usuarios:edit'), vendedorController.criarVendedor);
router.get('/vendedores/:id/comissoes', requirePermission('relatorios:view'), vendedorController.obterComissoes);

export default router;
