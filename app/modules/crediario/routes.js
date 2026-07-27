/**
 * Routes: Crediário Próprio
 * SetPoint Ultra — Módulo ERP Comercial
 * Rota base: /api/v1/crediario
 */
import { Router } from 'express';
import { authMiddleware } from '../../core/security.js';
import * as svc from './service.js';

const router = Router();
router.use(authMiddleware);

// ── Contas ────────────────────────────────────────────────────────────────────
router.get('/contas',                    async (req, res) => { try { res.json(await svc.listarContas(req.tenantId, req.query)) } catch(e) { res.status(400).json({ ok:false, error: e.message }) } });
router.post('/contas',                   async (req, res) => { try { res.status(201).json(await svc.criarConta(req.tenantId, req.body)) } catch(e) { res.status(400).json({ ok:false, error: e.message }) } });
router.get('/contas/:id/carne',          async (req, res) => { try { res.json(await svc.buscarCarne(req.tenantId, req.params.id)) } catch(e) { res.status(400).json({ ok:false, error: e.message }) } });
router.post('/contas/:id/renegociar',    async (req, res) => { try { res.json(await svc.renegociarConta(req.tenantId, req.params.id, req.body)) } catch(e) { res.status(400).json({ ok:false, error: e.message }) } });

// ── Parcelas ──────────────────────────────────────────────────────────────────
router.post('/parcelas/:id/pagar',       async (req, res) => { try { res.json(await svc.registrarPagamento(req.tenantId, req.params.id, req.body)) } catch(e) { res.status(400).json({ ok:false, error: e.message }) } });

// ── Operações em lote ─────────────────────────────────────────────────────────
router.post('/atualizar-juros',          async (req, res) => { try { res.json(await svc.atualizarJurosVencidos(req.tenantId)) } catch(e) { res.status(500).json({ ok:false, error: e.message }) } });
router.post('/regua-cobranca',           async (req, res) => { try { res.json(await svc.executarReguaCobranca({ id: req.tenantId, ...req.tenant })) } catch(e) { res.status(500).json({ ok:false, error: e.message }) } });

// ── Relatórios ────────────────────────────────────────────────────────────────
router.get('/inadimplencia',             async (req, res) => { try { res.json(await svc.relatorioInadimplencia(req.tenantId)) } catch(e) { res.status(500).json({ ok:false, error: e.message }) } });
router.get('/resumo',                    async (req, res) => { try { res.json(await svc.resumoCrediario(req.tenantId)) } catch(e) { res.status(500).json({ ok:false, error: e.message }) } });

export default router;
