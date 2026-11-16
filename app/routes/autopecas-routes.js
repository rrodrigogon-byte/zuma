import express from 'express';
import {
  GRUPOS_AUTOPECAS,
  MONTADORAS_MODELOS,
  CATALAGO_AUTOPECAS_DEFAULT,
  buscarAutopecas,
  salvarAutopeca
} from '../modules/autopecas/autopecas-suite.js';

export function createAutoPecasAdminRouter() {
  const router = express.Router();

  // Listar peças com filtros
  router.get('/pecas', (req, res) => {
    const { termo, montadora, modelo, placa, grupo } = req.query;
    const pecas = buscarAutopecas({ termo, montadora, modelo, placa, grupo });
    res.json({ ok: true, total: pecas.length, pecas });
  });

  // Obter grupos e montadoras
  router.get('/grupos', (req, res) => {
    res.json({ ok: true, grupos: GRUPOS_AUTOPECAS });
  });

  router.get('/montadoras', (req, res) => {
    res.json({ ok: true, montadoras: MONTADORAS_MODELOS });
  });

  // Salvar / atualizar autopeça
  router.post('/pecas', (req, res) => {
    try {
      const peca = salvarAutopeca(req.body);
      res.json({ ok: true, mensagem: 'Autopeça cadastrada com sucesso', peca });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.put('/pecas/:id', (req, res) => {
    try {
      const peca = salvarAutopeca({ ...req.body, id: req.params.id });
      res.json({ ok: true, mensagem: 'Autopeça atualizada com sucesso', peca });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // Transferir peça para OS da Oficina (Kytto Auto)
  router.post('/requisicao-oficina', (req, res) => {
    const { pecaId, quantidade = 1, osId, numeroOs } = req.body;
    const peca = CATALAGO_AUTOPECAS_DEFAULT.find(p => p.id === pecaId);
    if (!peca) {
      return res.status(404).json({ ok: false, error: 'Peça não localizada no estoque' });
    }
    if (peca.estoqueAtual < quantidade) {
      return res.status(400).json({ ok: false, error: 'Estoque insuficiente para requisição' });
    }

    peca.estoqueAtual -= Number(quantidade);
    res.json({
      ok: true,
      mensagem: `${quantidade}x ${peca.nome} requisitada com sucesso para ${numeroOs || osId || 'OS da Oficina'}`,
      peca,
      estoqueRestante: peca.estoqueAtual
    });
  });

  return router;
}

export function createAutoPecasPublicoRouter() {
  const router = express.Router();

  // Catálogo público do E-commerce de Autopeças
  router.get('/catalogo', (req, res) => {
    const { termo, montadora, modelo, placa, grupo } = req.query;
    let pecas = buscarAutopecas({ termo, montadora, modelo, placa, grupo });
    // Filtrar apenas publicadas no e-commerce
    pecas = pecas.filter(p => p.publicadoEcommerce !== false);

    res.json({
      ok: true,
      lojaNome: 'Kytto Auto Peças & Acessórios Tangará',
      cidade: 'Tangará da Serra / MT',
      whatsapp: '+55 65 99352-2260',
      total: pecas.length,
      pecas,
      grupos: GRUPOS_AUTOPECAS,
      montadoras: MONTADORAS_MODELOS
    });
  });

  // Detalhes da peça
  router.get('/peca/:id', (req, res) => {
    const peca = CATALAGO_AUTOPECAS_DEFAULT.find(p => p.id === req.params.id || p.sku === req.params.id);
    if (!peca) {
      return res.status(404).json({ ok: false, error: 'Autopeça não encontrada' });
    }
    res.json({ ok: true, peca });
  });

  return router;
}
