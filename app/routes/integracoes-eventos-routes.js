import { Router } from 'express';
import { kyttoEventBus, sincronizarNossaGenteUltra } from '../modules/eventos/kytto-eventbus.js';
import { listarCotacoes, obterCurvaAbc, aprovarCotacao } from '../modules/compras/cotacao-inteligente-suite.js';

export function createIntegracoesEventosRouter() {
  const router = Router();

  // 1. Barramento de Eventos Internos (EventBus)
  router.get('/eventos/historico', (req, res) => {
    try {
      const eventos = kyttoEventBus.listarHistorico(req.query);
      return res.json({ ok: true, total: eventos.length, eventos });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get('/eventos/metricas', (req, res) => {
    try {
      const metricas = kyttoEventBus.obterMetricas();
      return res.json({ ok: true, metricas });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/eventos/disparar', (req, res) => {
    try {
      const { tipo, payload, origem, destino } = req.body;
      if (!tipo || !payload) {
        return res.status(400).json({ ok: false, error: 'Campos tipo e payload são obrigatórios.' });
      }
      const evt = kyttoEventBus.dispararEventoInterno({ tipo, payload, origem, destino });
      return res.json({ ok: true, evento: evt });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 2. Sincronização por Evento Interno Nossa Gente × Ultra
  router.post('/integracoes/sincronizar-nossa-gente-ultra', (req, res) => {
    try {
      const { entidade = 'colaborador', operacao = 'ATUALIZAR_CADASTRO', dados = {} } = req.body;
      const resultado = sincronizarNossaGenteUltra({ entidade, operacao, dados });
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 3. Cotações Multiformecedor com KyttoIA
  router.get('/cotacoes', (req, res) => {
    try {
      const cotacoes = listarCotacoes();
      return res.json({ ok: true, total: cotacoes.length, cotacoes });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get('/cotacoes/curva-abc', (req, res) => {
    try {
      const curva = obterCurvaAbc();
      return res.json({ ok: true, curva });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/cotacoes/aprovar', (req, res) => {
    try {
      const { cotacaoId, fornecedorVencedorId, usuarioAprovador } = req.body;
      if (!cotacaoId) {
        return res.status(400).json({ ok: false, error: 'cotacaoId é obrigatório.' });
      }
      const resultado = aprovarCotacao({ cotacaoId, fornecedorVencedorId, usuarioAprovador });
      return res.json(resultado);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
