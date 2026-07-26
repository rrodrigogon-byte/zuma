/**
 * ============================================================================
 * ROTAS DE PAGAMENTOS - ERP MODULAR
 * ============================================================================
 */

import express from 'express';
import { autenticar, autorizar } from '../../routes/auth.js';
import * as pagamentosController from './controllers/pagamentos.js';

const router = express.Router();

// Middleware de autenticação
router.use(autenticar);

/**
 * POST /pagamentos/processar
 * Processar pagamento
 */
router.post('/processar', autorizar('admin', 'gerente', 'caixa'), pagamentosController.processarPagamento);

/**
 * POST /pagamentos/:pagamento_id/reembolsar
 * Reembolsar pagamento
 */
router.post('/:pagamento_id/reembolsar', autorizar('admin', 'gerente'), pagamentosController.reembolsarPagamento);

/**
 * GET /pagamentos
 * Listar pagamentos
 */
router.get('/', pagamentosController.listarPagamentos);

/**
 * POST /pagamentos/reconciliar
 * Reconciliar pagamentos com adquirente
 */
router.post('/reconciliar', autorizar('admin', 'gerente'), pagamentosController.reconciliarPagamentos);

export default router;
