/**
 * ============================================================================
 * ROTAS DE CATÁLOGO - ERP MODULAR KYTTO
 * ============================================================================
 * Arquivo: app/routes/catalogo.js
 * Descrição: Endpoints para CRUD de produtos com classificação fiscal
 * Versão: 2.0
 * ============================================================================
 */

import express from 'express';
import { authMiddleware, requireRole } from '../core/auth.js';
import { tenantMiddleware } from '../core/tenant.js';
import * as produtoController from '../modules/catalogo/controllers/produto.js';

const router = express.Router();

// Aplicar middleware de autenticação e tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * ============================================================================
 * PRODUTOS
 * ============================================================================
 */

/**
 * POST /catalogo/produtos
 * Criar novo produto
 * Roles: admin, gerente, vendedor
 */
router.post('/produtos', requireRole(['admin', 'gerente', 'vendedor']), produtoController.criarProduto);

/**
 * GET /catalogo/produtos
 * Listar produtos
 * Roles: admin, gerente, vendedor, garcom, caixa, operador
 */
router.get('/produtos', requireRole(['admin', 'gerente', 'vendedor', 'garcom', 'caixa', 'operador']), produtoController.listarProdutos);

/**
 * GET /catalogo/produtos/:produto_id
 * Obter detalhes de um produto
 * Roles: admin, gerente, vendedor, garcom, caixa, operador
 */
router.get('/produtos/:produto_id', requireRole(['admin', 'gerente', 'vendedor', 'garcom', 'caixa', 'operador']), produtoController.obterProduto);

/**
 * PUT /catalogo/produtos/:produto_id
 * Atualizar produto
 * Roles: admin, gerente, vendedor
 */
router.put('/produtos/:produto_id', requireRole(['admin', 'gerente', 'vendedor']), produtoController.atualizarProduto);

/**
 * DELETE /catalogo/produtos/:produto_id
 * Deletar produto (soft delete)
 * Roles: admin, gerente
 */
router.delete('/produtos/:produto_id', requireRole(['admin', 'gerente']), produtoController.deletarProduto);

export default router;
