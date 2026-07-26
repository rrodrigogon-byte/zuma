/**
 * ============================================================================
 * ROTAS DE PIPAS - MÓDULO BAR
 * ============================================================================
 * Arquivo: app/modules/bar/routes-pipas.js
 * Descrição: Endpoints para controle de pipas/barris com dispositivos
 * Versão: 1.0
 * ============================================================================
 */

import express from 'express';
import { authMiddleware, requireRole } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as pipasController from './controllers/pipas.js';

const router = express.Router();

// Aplicar middleware de autenticação e tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * ============================================================================
 * CADASTRO DE PIPAS
 * ============================================================================
 */

/**
 * POST /bar/pipas
 * Cadastrar nova pipa
 * Roles: admin, gerente, garcom
 */
router.post('/', requireRole(['admin', 'gerente', 'garcom']), pipasController.cadastrarPipa);

/**
 * ============================================================================
 * LEITURA DE NÍVEL
 * ============================================================================
 */

/**
 * POST /bar/pipas/:pipa_id/leitura
 * Registrar leitura de nível (manual ou dispositivo)
 * Roles: admin, gerente, garcom, operador
 */
router.post('/:pipa_id/leitura', requireRole(['admin', 'gerente', 'garcom', 'operador']), pipasController.registrarLeitura);

/**
 * GET /bar/pipas/:pipa_id/leituras
 * Obter histórico de leituras
 * Roles: admin, gerente, garcom, operador
 */
router.get('/:pipa_id/leituras', requireRole(['admin', 'gerente', 'garcom', 'operador']), pipasController.obterHistoricoLeituras);

/**
 * ============================================================================
 * CONSULTAS
 * ============================================================================
 */

/**
 * GET /bar/pipas
 * Listar pipas
 * Roles: admin, gerente, garcom, operador, caixa
 */
router.get('/', requireRole(['admin', 'gerente', 'garcom', 'operador', 'caixa']), pipasController.listarPipas);

/**
 * GET /bar/pipas/:pipa_id
 * Obter detalhes de uma pipa
 * Roles: admin, gerente, garcom, operador, caixa
 */
router.get('/:pipa_id', requireRole(['admin', 'gerente', 'garcom', 'operador', 'caixa']), pipasController.obterPipa);

/**
 * ============================================================================
 * ATUALIZAR STATUS
 * ============================================================================
 */

/**
 * PUT /bar/pipas/:pipa_id/status
 * Atualizar status de pipa
 * Roles: admin, gerente
 */
router.put('/:pipa_id/status', requireRole(['admin', 'gerente']), pipasController.atualizarStatusPipa);

/**
 * ============================================================================
 * INTEGRAÇÃO COM DISPOSITIVOS FÍSICOS
 * ============================================================================
 */

/**
 * POST /bar/pipas/dispositivo/registrar-leitura
 * Endpoint para integração com dispositivos (balança, sensor ultrassônico, etc)
 * Roles: admin, gerente, operador (sem autenticação JWT, apenas com API key do dispositivo)
 * 
 * Nota: Este endpoint pode ser protegido com API key adicional do dispositivo
 */
router.post('/dispositivo/registrar-leitura', pipasController.registrarLeituraDispositivo);

export default router;
