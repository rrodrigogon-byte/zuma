/**
 * Rotas do Módulo BAR
 * SetPoint Ultra - Comanda Eletrônica
 */

import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as comandaController from './controllers/comanda.js';
import * as divisaoController from './controllers/divisao.js';
import * as kdsController from './controllers/kds.js';

const router = express.Router();

// Aplicar middlewares globais
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('bar'));

// ============================================================================
// ROTAS DE COMANDA
// ============================================================================

/**
 * GET /api/bar/comandas
 * Listar todas as comandas do estabelecimento
 */
router.get(
  '/comandas',
  requirePermission('comanda:view'),
  comandaController.listarComandas
);

/**
 * GET /api/bar/comandas/:id
 * Obter detalhes de uma comanda
 */
router.get(
  '/comandas/:id',
  requirePermission('comanda:view'),
  comandaController.obterComanda
);

/**
 * POST /api/bar/comandas
 * Abrir nova comanda
 */
router.post(
  '/comandas',
  requirePermission('comanda:create'),
  comandaController.abrirComanda
);

/**
 * PUT /api/bar/comandas/:id
 * Atualizar comanda
 */
router.put(
  '/comandas/:id',
  requirePermission('comanda:edit'),
  comandaController.atualizarComanda
);

/**
 * POST /api/bar/comandas/:id/fechar
 * Fechar comanda
 */
router.post(
  '/comandas/:id/fechar',
  requirePermission('comanda:edit'),
  comandaController.fecharComanda
);

/**
 * POST /api/bar/comandas/:id/cancelar
 * Cancelar comanda
 */
router.post(
  '/comandas/:id/cancelar',
  requirePermission('comanda:edit'),
  comandaController.cancelarComanda
);

// ============================================================================
// ROTAS DE ITENS DA COMANDA
// ============================================================================

/**
 * POST /api/bar/comandas/:id/itens
 * Adicionar item à comanda
 */
router.post(
  '/comandas/:id/itens',
  requirePermission('comanda:edit'),
  comandaController.adicionarItem
);

/**
 * PUT /api/bar/comandas/:comandaId/itens/:itemId
 * Atualizar item da comanda
 */
router.put(
  '/comandas/:comandaId/itens/:itemId',
  requirePermission('comanda:edit'),
  comandaController.atualizarItem
);

/**
 * DELETE /api/bar/comandas/:comandaId/itens/:itemId
 * Remover item da comanda
 */
router.delete(
  '/comandas/:comandaId/itens/:itemId',
  requirePermission('comanda:edit'),
  comandaController.removerItem
);

/**
 * PUT /api/bar/comandas/:comandaId/itens/:itemId/status
 * Atualizar status do item (pendente, preparando, pronto, servido)
 */
router.put(
  '/comandas/:comandaId/itens/:itemId/status',
  requirePermission('comanda:edit'),
  comandaController.atualizarStatusItem
);

// ============================================================================
// ROTAS DE DIVISÃO DE CONTA
// ============================================================================

/**
 * POST /api/bar/comandas/:id/divisoes
 * Criar divisão de conta
 */
router.post(
  '/comandas/:id/divisoes',
  requirePermission('comanda:edit'),
  divisaoController.criarDivisao
);

/**
 * GET /api/bar/comandas/:id/divisoes
 * Listar divisões de uma comanda
 */
router.get(
  '/comandas/:id/divisoes',
  requirePermission('comanda:view'),
  divisaoController.listarDivisoes
);

/**
 * POST /api/bar/comandas/:comandaId/divisoes/:divisaoId/itens
 * Adicionar item à divisão
 */
router.post(
  '/comandas/:comandaId/divisoes/:divisaoId/itens',
  requirePermission('comanda:edit'),
  divisaoController.adicionarItemDivisao
);

/**
 * DELETE /api/bar/comandas/:comandaId/divisoes/:divisaoId/itens/:itemId
 * Remover item da divisão
 */
router.delete(
  '/comandas/:comandaId/divisoes/:divisaoId/itens/:itemId',
  requirePermission('comanda:edit'),
  divisaoController.removerItemDivisao
);

/**
 * POST /api/bar/comandas/:comandaId/divisoes/:divisaoId/pagar
 * Processar pagamento de uma divisão
 */
router.post(
  '/comandas/:comandaId/divisoes/:divisaoId/pagar',
  requirePermission('pagamentos:process'),
  divisaoController.pagarDivisao
);

// ============================================================================
// ROTAS DE KITCHEN DISPLAY SYSTEM (KDS)
// ============================================================================

/**
 * GET /api/bar/kds/pedidos
 * Obter pedidos para o KDS
 */
router.get(
  '/kds/pedidos',
  requirePermission('comanda:view'),
  kdsController.obterPedidos
);

/**
 * PUT /api/bar/kds/pedidos/:itemId/status
 * Atualizar status do pedido no KDS
 */
router.put(
  '/kds/pedidos/:itemId/status',
  requirePermission('comanda:edit'),
  kdsController.atualizarStatusPedido
);

/**
 * GET /api/bar/kds/resumo
 * Obter resumo de pedidos para o KDS
 */
router.get(
  '/kds/resumo',
  requirePermission('comanda:view'),
  kdsController.obterResumoPedidos
);

// ============================================================================
// ROTAS DE MESAS
// ============================================================================

/**
 * GET /api/bar/mesas
 * Listar todas as mesas
 */
router.get(
  '/mesas',
  requirePermission('comanda:view'),
  comandaController.listarMesas
);

/**
 * POST /api/bar/mesas
 * Criar nova mesa
 */
router.post(
  '/mesas',
  requirePermission('comanda:edit'),
  comandaController.criarMesa
);

/**
 * PUT /api/bar/mesas/:id
 * Atualizar mesa
 */
router.put(
  '/mesas/:id',
  requirePermission('comanda:edit'),
  comandaController.atualizarMesa
);

/**
 * DELETE /api/bar/mesas/:id
 * Deletar mesa
 */
router.delete(
  '/mesas/:id',
  requirePermission('comanda:edit'),
  comandaController.deletarMesa
);

/**
 * GET /api/bar/mesas/:id/comanda
 * Obter comanda aberta de uma mesa
 */
router.get(
  '/mesas/:id/comanda',
  requirePermission('comanda:view'),
  comandaController.obterComandaMesa
);

// ============================================================================
// ROTAS DE RELATÓRIOS
// ============================================================================

/**
 * GET /api/bar/relatorios/vendas
 * Relatório de vendas
 */
router.get(
  '/relatorios/vendas',
  requirePermission('relatorios:view'),
  comandaController.relatorioVendas
);

/**
 * GET /api/bar/relatorios/produtos
 * Relatório de produtos mais vendidos
 */
router.get(
  '/relatorios/produtos',
  requirePermission('relatorios:view'),
  comandaController.relatorioProdutos
);

/**
 * GET /api/bar/relatorios/garcom
 * Relatório por garçom
 */
router.get(
  '/relatorios/garcom',
  requirePermission('relatorios:view'),
  comandaController.relatorioGarcom
);

export default router;
