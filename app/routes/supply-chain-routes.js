/**
 * Rotas da API de Supply Chain, Cotações RFQ e 3-Way Matching
 */
import { Router } from 'express';
import {
  listarCotacoes,
  criarCotacao,
  aprovarCotacaoGerarPedido,
  listarPedidosCompra,
  executarConferencia3WayMatching,
  STATUS_COTACAO,
  STATUS_PEDIDO_COMPRA
} from '../core/supply-chain-cotacoes.js';

export function createSupplyChainRoutes({ auth, obterEmpresaId }) {
  const router = Router();
  if (typeof auth === 'function') {
    router.use(auth);
  }

  // Lista cotações ativas
  router.get('/cotacoes', (req, res) => {
    const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
    const cotacoes = listarCotacoes({ empresaId });
    return res.json({ sucesso: true, total: cotacoes.length, cotacoes });
  });

  // Cria nova cotação
  router.post('/cotacoes', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const nova = criarCotacao({ empresaId, ...req.body });
      return res.status(201).json({ sucesso: true, cotacao: nova });
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Aprova proposta e gera Pedido de Compra
  router.post('/cotacoes/:id/aprovar', (req, res) => {
    try {
      const { fornecedorIdEscolhido } = req.body;
      const resultado = aprovarCotacaoGerarPedido({
        rfqId: req.params.id,
        fornecedorIdEscolhido
      });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Lista pedidos de compra
  router.get('/pedidos-compra', (req, res) => {
    const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
    const pedidos = listarPedidosCompra({ empresaId });
    return res.json({ sucesso: true, total: pedidos.length, pedidos });
  });

  // Executa conferência 3-Way Matching
  router.post('/pedidos-compra/:id/3-way-matching', (req, res) => {
    try {
      const resultado = executarConferencia3WayMatching({
        pedidoCompraId: req.params.id,
        ...req.body
      });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
