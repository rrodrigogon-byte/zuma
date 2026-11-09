/**
 * Rotas da API para Kytto Advisor - Copilot Executivo & Operacional
 * 
 * Kytto ERP - Inteligência Artificial para Gestão
 */

import { Router } from 'express';
import { 
  calcularForecastFaturamento, 
  auditarAnomaliasERiscos, 
  simularCenario, 
  sugerirCrossSelling 
} from '../core/ia-advisor-executivo.js';
import { EMPRESA_DINO_ID } from '../modules/empresas/servico.js';

export function createIaAdvisorRouter({ obterEmpresaId = () => null } = {}) {
  const router = Router();

  // Forecast preditivo de faturamento do mês
  router.get('/forecast', (req, res) => {
    try {
      const empresaId = req.query.empresaId || obterEmpresaId(req);
      const forecast = calcularForecastFaturamento(empresaId);
      res.json(forecast);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_FORECAST_ERROR' });
    }
  });

  // Auditoria contínua de anomalias e riscos operacionais
  router.get('/auditoria-riscos', (req, res) => {
    try {
      const empresaId = req.query.empresaId || obterEmpresaId(req);
      const auditoria = auditarAnomaliasERiscos(empresaId);
      res.json(auditoria);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_AUDIT_ERROR' });
    }
  });

  // Simulador de Cenários Interativo "What-If"
  router.post('/simulador-cenarios', (req, res) => {
    try {
      const empresaId = req.body.empresaId || obterEmpresaId(req);
      const parametros = req.body || {};
      const simulacao = simularCenario(empresaId, parametros);
      res.json(simulacao);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_SIMULATOR_ERROR' });
    }
  });

  // Recomendação preditiva de Venda Casada (Cross-Selling)
  router.get('/cross-selling', (req, res) => {
    try {
      const { servico } = req.query;
      const recomendacoes = sugerirCrossSelling(servico);
      res.json({ servico, recomendacoes });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_CROSS_SELLING_ERROR' });
    }
  });

  // Painel Geral Unificado do Advisor (KPIs + Riscos + Forecast)
  router.get('/dashboard', (req, res) => {
    try {
      const empresaId = req.query.empresaId || obterEmpresaId(req);
      const forecast = calcularForecastFaturamento(empresaId);
      const auditoria = auditarAnomaliasERiscos(empresaId);

      res.json({
        empresaId,
        geradoEm: new Date().toISOString(),
        scoreSaude: auditoria.scoreSaudeOperacional,
        forecast,
        auditoria,
        acoesPrioritarias: [
          {
            prioridade: 1,
            categoria: 'Financeiro',
            titulo: 'Revisar metas da semana',
            descricao: `Faturamento atual em ${forecast.receitaRealizadaFormatada}. Faltam ${formatarMoeda(Math.max(0, forecast.metaEmpresa - forecast.receitaRealizada))} para bater a meta.`
          },
          {
            prioridade: 2,
            categoria: 'Estoque',
            titulo: 'Ponto de pedido atingido',
            descricao: auditoria.riscos.find(r => r.tipo === 'ruptura_estoque')?.titulo || 'Níveis de estoque normais.'
          },
          {
            prioridade: 3,
            categoria: 'CRM',
            titulo: 'Campanha de resgate VIP',
            descricao: auditoria.riscos.find(r => r.tipo === 'churn_vip')?.titulo || 'Base VIP com frequência ativa.'
          }
        ]
      });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_DASHBOARD_ERROR' });
    }
  });

  return router;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
