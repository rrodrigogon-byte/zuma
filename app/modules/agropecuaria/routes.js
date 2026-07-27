/**
 * Rotas: Agropecuária, Petshop e Clínica Veterinária
 * SetPoint Ultra
 */
import express from 'express';
import { authMiddleware, requirePermission } from '../../core/auth.js';
import { tenantMiddleware } from '../../core/tenant.js';
import * as svc from './service.js';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── RECEITUÁRIOS ──────────────────────────────────────────────────────────────
router.get('/receituarios', requirePermission('agro:view'), async (req, res) => {
  try {
    const { data_inicio, data_fim, tipo } = req.query;
    const receituarios = await svc.relatorioReceituarios(req.tenantId, data_inicio, data_fim, tipo);
    res.json({ sucesso: true, receituarios });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/receituarios', requirePermission('agro:edit'), async (req, res) => {
  try {
    const rec = await svc.emitirReceituario(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, receituario: rec });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── PETS ──────────────────────────────────────────────────────────────────────
router.get('/pets/cliente/:clienteId', requirePermission('petshop:view'), async (req, res) => {
  try {
    const pets = await svc.listarPetsPorCliente(req.tenantId, req.params.clienteId);
    res.json({ sucesso: true, pets });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/pets', requirePermission('petshop:edit'), async (req, res) => {
  try {
    const pet = await svc.cadastrarPet(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, pet });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.put('/pets/:id', requirePermission('petshop:edit'), async (req, res) => {
  try {
    const pet = await svc.atualizarPet(req.params.id, req.tenantId, req.body);
    res.json({ sucesso: true, pet });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── PRONTUÁRIO ────────────────────────────────────────────────────────────────
router.get('/pets/:petId/prontuario', requirePermission('petshop:view'), async (req, res) => {
  try {
    const prontuario = await svc.obterProntuario(req.tenantId, req.params.petId);
    res.json({ sucesso: true, ...prontuario });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/pets/:petId/atendimentos', requirePermission('petshop:edit'), async (req, res) => {
  try {
    const atendimento = await svc.registrarAtendimento(req.tenantId, req.params.petId, req.body);
    res.status(201).json({ sucesso: true, atendimento });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

// ── VACINAS ───────────────────────────────────────────────────────────────────
router.post('/pets/:petId/vacinas', requirePermission('petshop:edit'), async (req, res) => {
  try {
    const vacina = await svc.registrarVacina(req.tenantId, req.params.petId, req.body);
    res.status(201).json({ sucesso: true, vacina });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

router.get('/vacinas/reforco-proximo', requirePermission('petshop:view'), async (req, res) => {
  try {
    const vacinas = await svc.buscarVacinasReforcoProximo(req.tenantId, req.query.dias || 15);
    res.json({ sucesso: true, vacinas });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

// ── AGENDAMENTOS ──────────────────────────────────────────────────────────────
router.get('/agendamentos/hoje', requirePermission('petshop:view'), async (req, res) => {
  try {
    const agendamentos = await svc.listarAgendamentosHoje(req.tenantId);
    res.json({ sucesso: true, agendamentos });
  } catch (e) { res.status(500).json({ sucesso: false, erro: e.message }); }
});

router.post('/agendamentos', requirePermission('petshop:edit'), async (req, res) => {
  try {
    const agendamento = await svc.agendarServico(req.tenantId, req.body);
    res.status(201).json({ sucesso: true, agendamento });
  } catch (e) { res.status(400).json({ sucesso: false, erro: e.message }); }
});

export default router;
