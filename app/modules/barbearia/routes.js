/**
 * Rotas do Módulo BARBEARIA
 * SetPoint Ultra - Agendamentos e Serviços
 */

import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as agendamentoController from './controllers/agendamento.js';
import * as servicoController from './controllers/servico.js';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('barbearia'));

// ============================================================================
// ROTAS DE AGENDAMENTOS
// ============================================================================

router.get('/agendamentos', requirePermission('agendamentos:view'), agendamentoController.listarAgendamentos);
router.post('/agendamentos', requirePermission('agendamentos:create'), agendamentoController.criarAgendamento);
router.get('/agendamentos/:id', requirePermission('agendamentos:view'), agendamentoController.obterAgendamento);
router.put('/agendamentos/:id', requirePermission('agendamentos:edit'), agendamentoController.atualizarAgendamento);
router.post('/agendamentos/:id/confirmar', requirePermission('agendamentos:edit'), agendamentoController.confirmarAgendamento);
router.post('/agendamentos/:id/cancelar', requirePermission('agendamentos:edit'), agendamentoController.cancelarAgendamento);

// ============================================================================
// ROTAS DE SERVIÇOS
// ============================================================================

router.get('/servicos', requirePermission('servicos:view'), servicoController.listarServicos);
router.post('/servicos', requirePermission('servicos:edit'), servicoController.criarServico);
router.put('/servicos/:id', requirePermission('servicos:edit'), servicoController.atualizarServico);
router.delete('/servicos/:id', requirePermission('servicos:edit'), servicoController.deletarServico);

export default router;
