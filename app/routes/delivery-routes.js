/**
 * Rotas da API Administrativa do Kytto Delivery & Gestão de Entregas
 */
import { Router } from 'express';
import {
  listarPedidosDeliveryCompleto,
  listarEntregadores,
  cadastrarEntregador,
  atualizarStatusPedidoAvancado,
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

  // Atualizar status do pedido (com despacho para motoboy e régua WhatsApp)
  router.patch('/pedidos/:id/status', (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { id } = req.params;
      const { status, entregadorId } = req.body || {};

      const resultado = atualizarStatusPedidoAvancado(empresaId, id, status, { entregadorId });
      res.json({ sucesso: true, ...resultado });
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
