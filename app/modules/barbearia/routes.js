/**
 * Rotas: Barbearia e Salão de Beleza (v2 — EXPANDIDO)
 * SetPoint Ultra — Agendamento Online, Rateio, Pacotes, Assinaturas
 * Mantém compatibilidade com controllers legados (agendamento.js, servico.js)
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware, requireModule } from '../../core/tenant.js';
import * as agendamentoController from './controllers/agendamento.js';
import * as servicoController from './controllers/servico.js';
import * as svc from './service.js';

const router = express.Router();

// ── ROTA PÚBLICA: Agendamento Online (sem auth) ───────────────────────────────
router.get('/publico/:tenantSlug/disponibilidade', async (req, res) => {
  try {
    const { profissional_id, data } = req.query;
    const { db } = await import('../../core/database.js');
    const tenantResult = await db.query(
      'SELECT id FROM estabelecimentos WHERE slug = $1 OR id::text = $1',
      [req.params.tenantSlug]
    );
    if (!tenantResult.rows[0]) return res.status(404).json({ erro: 'Estabelecimento não encontrado' });
    const slots = await svc.verificarDisponibilidade(tenantResult.rows[0].id, profissional_id, data);
    res.json({ sucesso: true, slots });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/publico/:tenantSlug/agendar', async (req, res) => {
  try {
    const { db } = await import('../../core/database.js');
    const tenantResult = await db.query(
      'SELECT id FROM estabelecimentos WHERE slug = $1 OR id::text = $1',
      [req.params.tenantSlug]
    );
    if (!tenantResult.rows[0]) return res.status(404).json({ erro: 'Estabelecimento não encontrado' });
    const ag = await svc.criarAgendamento(tenantResult.rows[0].id, { ...req.body, origem: 'link_publico' });
    res.status(201).json({ sucesso: true, agendamento: ag, mensagem: 'Agendamento realizado! Você receberá uma confirmação.' });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── ROTAS AUTENTICADAS ────────────────────────────────────────────────────────
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireModule('barbearia'));

// ── AGENDAMENTOS (legado + novo) ──────────────────────────────────────────────
router.get('/agendamentos', requirePermission('agendamentos:view'), agendamentoController.listarAgendamentos);
router.post('/agendamentos', requirePermission('agendamentos:create'), agendamentoController.criarAgendamento);
router.get('/agendamentos/:id', requirePermission('agendamentos:view'), agendamentoController.obterAgendamento);
router.put('/agendamentos/:id', requirePermission('agendamentos:edit'), agendamentoController.atualizarAgendamento);
router.post('/agendamentos/:id/confirmar', requirePermission('agendamentos:edit'), agendamentoController.confirmarAgendamento);
router.post('/agendamentos/:id/cancelar', requirePermission('agendamentos:edit'), agendamentoController.cancelarAgendamento);

// ── SERVIÇOS ──────────────────────────────────────────────────────────────────
router.get('/servicos', requirePermission('servicos:view'), servicoController.listarServicos);
router.post('/servicos', requirePermission('servicos:edit'), servicoController.criarServico);
router.put('/servicos/:id', requirePermission('servicos:edit'), servicoController.atualizarServico);
router.delete('/servicos/:id', requirePermission('servicos:edit'), servicoController.deletarServico);

// ── PROFISSIONAIS ─────────────────────────────────────────────────────────────
router.get('/profissionais', requirePermission('barbearia:view'), async (req, res) => {
  try {
    const profissionais = await svc.listarProfissionais(req.tenantId);
    res.json({ sucesso: true, profissionais });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/profissionais', requirePermission('barbearia:edit'), async (req, res) => {
  try {
    const prof = await svc.criarProfissional(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, profissional: prof });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── DISPONIBILIDADE ───────────────────────────────────────────────────────────
router.get('/disponibilidade', requirePermission('barbearia:view'), async (req, res) => {
  try {
    const slots = await svc.verificarDisponibilidade(req.tenantId, req.query.profissional_id, req.query.data);
    res.json({ sucesso: true, slots });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/link-agendamento', requirePermission('barbearia:view'), async (req, res) => {
  try {
    const link = await svc.gerarLinkAgendamento(req.tenantId);
    res.json({ sucesso: true, link });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

// ── RATEIO ────────────────────────────────────────────────────────────────────
router.get('/rateio/:profissionalId/calcular', requirePermission('financeiro:view'), async (req, res) => {
  try {
    const rateio = await svc.calcularRateio(req.tenantId, req.query.agendamento_id, req.query.forma_pagamento);
    res.json({ sucesso: true, rateio });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.get('/rateio/:profissionalId/extrato', requirePermission('financeiro:view'), async (req, res) => {
  try {
    const extrato = await svc.gerarExtratoRepasse(req.tenantId, req.params.profissionalId, req.query.data_inicio, req.query.data_fim);
    res.json({ sucesso: true, extrato });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/rateio/:profissionalId/fechar', requirePermission('financeiro:edit'), async (req, res) => {
  try {
    const rateio = await svc.fecharRateio(req.tenantId, req.params.profissionalId, req.body.data_inicio, req.body.data_fim);
    res.status(201).json({ sucesso: true, rateio });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/rateio/:rateioId/pagar', requirePermission('financeiro:edit'), async (req, res) => {
  try {
    const rateio = await svc.pagarRateio(req.params.rateioId, req.tenantId);
    res.json({ sucesso: true, rateio });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── PACOTES E ASSINATURAS ─────────────────────────────────────────────────────
router.get('/pacotes', requirePermission('barbearia:view'), async (req, res) => {
  try {
    const { db } = await import('../../core/database.js');
    const { rows } = await db.query(
      'SELECT * FROM barbearia_pacotes WHERE tenant_id = $1 AND ativo = TRUE ORDER BY valor_mensal',
      [req.tenantId]
    );
    res.json({ sucesso: true, pacotes: rows });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/pacotes', requirePermission('barbearia:edit'), async (req, res) => {
  try {
    const pacote = await svc.criarPacote(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, pacote });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.post('/assinaturas', requirePermission('barbearia:edit'), async (req, res) => {
  try {
    const assinatura = await svc.assinarPacote(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, assinatura });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.get('/assinaturas/cliente/:clienteId', requirePermission('barbearia:view'), async (req, res) => {
  try {
    const assinatura = await svc.verificarAssinatura(req.tenantId, req.params.clienteId);
    res.json({ sucesso: true, assinatura });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

export default router;
