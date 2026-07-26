/**
 * ============================================================================
 * ROTAS DE CAIXA DIÁRIO - ERP MODULAR KYTTO
 * ============================================================================
 * Arquivo: app/routes/caixa-diario.js
 * Descrição: Endpoints para abertura, fechamento, sangria, suprimento
 * Versão: 2.0
 * ============================================================================
 */

import express from 'express';
import { authMiddleware, requireRole } from '../core/auth.js';
import { tenantMiddleware } from '../core/tenant.js';
import * as caixaDiarioController from '../modules/caixa/controllers/caixa-diario.js';

const router = express.Router();

// Aplicar middleware de autenticação e tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * ============================================================================
 * ABERTURA DE CAIXA
 * ============================================================================
 */

/**
 * POST /caixa-diario/abrir
 * Abrir novo caixa
 * Roles: admin, gerente, caixa, operador
 */
router.post('/abrir', requireRole(['admin', 'gerente', 'caixa', 'operador']), caixaDiarioController.abrirCaixa);

/**
 * GET /caixa-diario/aberto
 * Obter caixa aberto do dia
 * Roles: admin, gerente, caixa, operador, vendedor, garcom
 */
router.get('/aberto', requireRole(['admin', 'gerente', 'caixa', 'operador', 'vendedor', 'garcom']), caixaDiarioController.obterCaixaAberto);

/**
 * ============================================================================
 * SANGRIA E SUPRIMENTO
 * ============================================================================
 */

/**
 * POST /caixa-diario/sangria
 * Registrar sangria (retirada de dinheiro)
 * Roles: admin, gerente, caixa
 */
router.post('/sangria', requireRole(['admin', 'gerente', 'caixa']), caixaDiarioController.registrarSangria);

/**
 * POST /caixa-diario/suprimento
 * Registrar suprimento (adição de dinheiro)
 * Roles: admin, gerente, caixa
 */
router.post('/suprimento', requireRole(['admin', 'gerente', 'caixa']), caixaDiarioController.registrarSuprimento);

/**
 * ============================================================================
 * FECHAMENTO DE CAIXA
 * ============================================================================
 */

/**
 * POST /caixa-diario/fechar
 * Fechar caixa com resumo
 * Roles: admin, gerente
 */
router.post('/fechar', requireRole(['admin', 'gerente']), caixaDiarioController.fecharCaixa);

/**
 * ============================================================================
 * CONSULTAS E RELATÓRIOS
 * ============================================================================
 */

/**
 * GET /caixa-diario/:caixa_id/movimentacoes
 * Obter movimentações de um caixa
 * Roles: admin, gerente, caixa, operador
 */
router.get('/:caixa_id/movimentacoes', requireRole(['admin', 'gerente', 'caixa', 'operador']), caixaDiarioController.obterMovimentacoes);

/**
 * GET /caixa-diario/relatorio/diario
 * Obter relatório diário de caixas
 * Roles: admin, gerente
 */
router.get('/relatorio/diario', requireRole(['admin', 'gerente']), caixaDiarioController.relatoriosDiario);

export default router;
