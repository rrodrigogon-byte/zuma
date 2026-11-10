/**
 * Rotas da API Administrativa do Kytto Delivery, Logística & KDS
 */
import { Router } from 'express';
import {
  listarPedidosDeliveryCompleto,
  obterFilaKds,
  listarEntregadores,
  cadastrarEntregador,
  listarZonasFrete,
  salvarZonaFrete,
  atualizarStatusPedidoAvancado,
  despacharRotaAgrupada,
  fecharAcertoMotoboy,
  gerarComandaTermicaTexto,
  apurarCmvDelivery
} from '../core/delivery-gestao-entregas.js';

export function createDeliveryAdminRouter({ obterEmpresaIdDoUsuario }) {
  const router = Router();

  function resolverEmpresa(req) {
    if (typeof obterEmpresaIdDoUsuario === 'function') {
      const id = obterEmpresaIdDoUsuario(req);
      if (id) return id;
    }
    return req.headers['x-empresa-id'] || req.user?.empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  }

  // Listar todos os pedidos de delivery
  router.get('/pedidos', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const pedidos = listarPedidosDeliveryCompleto(empresaId);
      res.json({ sucesso: true, pedidos });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Fila KDS (Kitchen Display System / Monitor de Produção)
  router.get('/kds', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const fila = obterFilaKds(empresaId);
      res.json({ sucesso: true, fila });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Avançar estágio do KDS
  router.post('/kds/:id/avancar', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { id } = req.params;
      const { novoStatus } = req.body || {};
      const resultado = await atualizarStatusPedidoAvancado(empresaId, id, novoStatus || 'pronto_expedicao');
      res.json({ sucesso: true, ...resultado });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Atualizar status do pedido (com despacho para motoboy e régua WhatsApp)
  router.patch('/pedidos/:id/status', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { id } = req.params;
      const { status, entregadorId } = req.body || {};
      const resultado = await atualizarStatusPedidoAvancado(empresaId, id, status, entregadorId);
      res.json({ sucesso: true, ...resultado });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Gerar Comanda Térmica (ESC/POS 80mm) para Impressão
  router.get('/pedidos/:id/comanda-termica', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { id } = req.params;
      const pedidos = listarPedidosDeliveryCompleto(empresaId);
      const pedido = pedidos.find(p => p.id === id);
      if (!pedido) return res.status(404).json({ sucesso: false, erro: 'Pedido não encontrado.' });

      const comandaTexto = gerarComandaTermicaTexto(pedido);
      res.json({
        sucesso: true,
        pedidoId: pedido.id,
        comandaTexto
      });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Despacho Agrupado de Múltiplos Pedidos para a Mesma Rota
  router.post('/despacho-agrupado', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { entregadorId, pedidosIds } = req.body || {};
      if (!entregadorId || !Array.isArray(pedidosIds) || pedidosIds.length === 0) {
        return res.status(400).json({ sucesso: false, erro: 'Entregador e lista de pedidos são obrigatórios.' });
      }
      const resultado = await despacharRotaAgrupada(empresaId, entregadorId, pedidosIds);
      res.json({ sucesso: true, ...resultado });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Zonas de Frete de Tangará da Serra MT
  router.get('/zonas-frete', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const zonas = listarZonasFrete(empresaId);
      res.json({ sucesso: true, zonas });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  router.post('/zonas-frete', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const zona = salvarZonaFrete(empresaId, req.body);
      res.json({ sucesso: true, zona });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Listar entregadores
  router.get('/entregadores', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const entregadores = listarEntregadores(empresaId);
      res.json({ sucesso: true, entregadores });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Cadastrar entregador
  router.post('/entregadores', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const novo = cadastrarEntregador(empresaId, req.body);
      res.json({ sucesso: true, entregador: novo });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Fechar acerto do motoboy no dia
  router.post('/entregadores/:id/fechar-acerto', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { id } = req.params;
      const { observacoes } = req.body || {};
      const resultado = fecharAcertoMotoboy(empresaId, id, observacoes);
      res.json({ sucesso: true, fechamento: resultado });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Apuração de CMV Teórico vs Real
  router.get('/cmv', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const relatorio = apurarCmvDelivery(empresaId);
      res.json({ sucesso: true, relatorio });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
