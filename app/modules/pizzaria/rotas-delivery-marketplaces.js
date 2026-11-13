/**
 * ============================================================================
 * ROTAS DO HUB DE DELIVERY MULTICANAL PARA PIZZARIAS (iFood, Keeta & WhatsApp)
 * ============================================================================
 */
import { Router } from 'express';
import {
  obterConfiguracaoCanais,
  atualizarCanal,
  testarConexaoCanal,
  sincronizarCardapioMarketplace,
  listarPedidosMulticanal,
  atualizarStatusPedidoDelivery,
  simularPedidoMarketplace,
  obterRelatorioConciliacaoCanais,
  receberWebhookExterno
} from './delivery-marketplaces.js';
import { PALATARE_EMPRESA_ID } from '../../palatare-pizzaria-seed.js';

export function criarRotasDeliveryMarketplaces({ auth, requireStaff, resolverEmpresa }) {
  const router = Router();

  function getEmpresa(req) {
    if (typeof resolverEmpresa === 'function') {
      const e = resolverEmpresa(req);
      if (e) return e;
    }
    return req.headers['x-empresa-id'] || req.user?.empresaId || PALATARE_EMPRESA_ID;
  }

  // Obter canais e status de conexões
  router.get('/canais', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const dados = obterConfiguracaoCanais(empresaId);
      res.json(dados);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  // Atualizar configurações do canal (ligar/desligar, chaves, taxas)
  router.patch('/canais/:id', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const resultado = atualizarCanal(empresaId, req.params.id, req.body || {});
      res.json(resultado);
    } catch (e) {
      res.status(400).json({ sucesso: false, erro: e.message });
    }
  });

  // Testar conexão / Ping na API do parceiro
  router.post('/canais/:id/testar', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const resultado = testarConexaoCanal(empresaId, req.params.id);
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  // Sincronizar cardápio de pizzas com o marketplace
  router.post('/canais/:id/sincronizar-cardapio', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const resultado = sincronizarCardapioMarketplace(empresaId, req.params.id);
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  // Listar pedidos multicanal
  router.get('/pedidos', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const filtros = {
        canal: req.query.canal || 'todos',
        status: req.query.status || 'todos'
      };
      const resultado = listarPedidosMulticanal(empresaId, filtros);
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  // Atualizar status do pedido
  router.patch('/pedidos/:id/status', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const { status, motoboy } = req.body || {};
      if (!status) return res.status(400).json({ sucesso: false, erro: 'Status obrigatório' });
      const resultado = atualizarStatusPedidoDelivery(empresaId, req.params.id, status, { motoboy });
      res.json(resultado);
    } catch (e) {
      res.status(400).json({ sucesso: false, erro: e.message });
    }
  });

  // Simular pedido de teste de marketplace
  router.post('/simular-pedido', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const { canalId, tipo } = req.body || {};
      const resultado = simularPedidoMarketplace(empresaId, canalId || 'ifood', tipo);
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  // Relatório de conciliação e comissões por canal
  router.get('/conciliacao', auth, requireStaff, (req, res) => {
    try {
      const empresaId = getEmpresa(req);
      const resultado = obterRelatorioConciliacaoCanais(empresaId);
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: e.message });
    }
  });

  return router;
}

/**
 * Cria rotas de Webhook públicas para recepção de eventos de terceiros
 */
export function criarRotasWebhooksDelivery() {
  const router = Router();

  router.post('/ifood', (req, res) => {
    const resultado = receberWebhookExterno('ifood', req.body, req.headers);
    res.status(200).json(resultado);
  });

  router.post('/keeta', (req, res) => {
    const resultado = receberWebhookExterno('keeta', req.body, req.headers);
    res.status(200).json(resultado);
  });

  router.post('/opendelivery', (req, res) => {
    const resultado = receberWebhookExterno('opendelivery', req.body, req.headers);
    res.status(200).json(resultado);
  });

  return router;
}
