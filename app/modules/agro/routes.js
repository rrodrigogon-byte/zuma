import express from 'express';
import * as AgroService from './service.js';

const router = express.Router();

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const data = await AgroService.dashboardAgro(req.tenantId);
    res.json(data);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Safras
router.get('/safras', async (req, res) => {
  try { res.json(await AgroService.listarSafras(req.tenantId, req.query)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/safras', async (req, res) => {
  try { res.status(201).json((await AgroService.criarSafra(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

// Talhões
router.post('/talhoes', async (req, res) => {
  try { res.status(201).json((await AgroService.criarTalhao(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/talhoes/:id/colheita', async (req, res) => {
  try { res.status(201).json(await AgroService.registrarColheita(req.tenantId, req.params.id, req.body)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

// Balança
router.get('/tickets', async (req, res) => {
  try { res.json(await AgroService.listarTicketsBalanca(req.tenantId, req.query)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/tickets', async (req, res) => {
  try { res.status(201).json((await AgroService.abrirTicketBalanca(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.put('/tickets/:id/saida', async (req, res) => {
  try {
    const { peso_saida_kg, umidade_percentual, impureza_percentual } = req.body;
    res.json(await AgroService.registrarPesagemSaida(req.tenantId, req.params.id, peso_saida_kg, umidade_percentual, impureza_percentual));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Romaneios
router.get('/romaneios', async (req, res) => {
  try { res.json(await AgroService.listarRomaneios(req.tenantId, req.query)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/romaneios', async (req, res) => {
  try { res.status(201).json((await AgroService.criarRomaneio(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

// Notas do Produtor
router.get('/notas-produtor', async (req, res) => {
  try { res.json(await AgroService.listarNotasProdutor(req.tenantId, req.query)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/notas-produtor', async (req, res) => {
  try { res.status(201).json((await AgroService.emitirNotaProdutor(req.tenantId, req.body)).rows[0]); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

// Silos
router.get('/silos', async (req, res) => {
  try { res.json(await AgroService.listarSilos(req.tenantId)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});
router.post('/silos/:id/movimentar', async (req, res) => {
  try {
    const { tipo, quantidade_kg, produto_id, observacoes } = req.body;
    res.json(await AgroService.movimentarSilo(req.tenantId, req.params.id, tipo, quantidade_kg, produto_id, observacoes));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

export default router;
