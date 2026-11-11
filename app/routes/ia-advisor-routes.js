/**
 * Rotas da API para Kytto Advisor - Copilot Executivo & Operacional
 */

import { Router } from 'express';
import {
  calcularForecastFaturamento,
  auditarAnomaliasERiscos,
  simularCenario,
  sugerirCrossSelling,
} from '../core/ia-advisor-executivo.js';
import { query as consultar } from '../db-pg.js';

async function obterBaseFinanceiraRealMes(empresaId) {
  if (!empresaId) return { receitaRealizadaPg: 0, custosAtuaisPg: 0, despesasAtuaisPg: 0 };
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  try {
    const res = await consultar(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0)::numeric(14,2) AS receitas,
         COALESCE(SUM(CASE WHEN tipo = 'despesa' AND COALESCE(natureza_dre, '') ILIKE '%custo%' THEN valor ELSE 0 END), 0)::numeric(14,2) AS custos,
         COALESCE(SUM(CASE WHEN tipo = 'despesa' AND COALESCE(natureza_dre, '') NOT ILIKE '%custo%' THEN valor ELSE 0 END), 0)::numeric(14,2) AS despesas
       FROM fin_lancamentos
       WHERE empresa_id = $1
         AND status != 'cancelado'
         AND TO_CHAR(data_competencia, 'YYYY-MM') = $2`,
      [empresaId, competencia]
    );
    const row = res.rows?.[0] || {};
    return {
      receitaRealizadaPg: Number(row.receitas || 0),
      custosAtuaisPg: Number(row.custos || 0),
      despesasAtuaisPg: Number(row.despesas || 0),
    };
  } catch (_e) {
    return { receitaRealizadaPg: 0, custosAtuaisPg: 0, despesasAtuaisPg: 0 };
  }
}

export function createIaAdvisorRouter({ obterEmpresaId = () => null } = {}) {
  const router = Router();

  router.get('/forecast', async (req, res) => {
    try {
      const empresaId = obterEmpresaId(req) || req.query.empresaId;
      const basePg = await obterBaseFinanceiraRealMes(empresaId);
      const forecast = calcularForecastFaturamento(empresaId, basePg);
      res.json(forecast);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_FORECAST_ERROR' });
    }
  });

  router.get('/auditoria-riscos', (req, res) => {
    try {
      const empresaId = obterEmpresaId(req) || req.query.empresaId;
      const auditoria = auditarAnomaliasERiscos(empresaId);
      res.json(auditoria);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_AUDIT_ERROR' });
    }
  });

  router.post('/simulador-cenarios', async (req, res) => {
    try {
      const empresaId = obterEmpresaId(req) || req.body?.empresaId;
      const basePg = await obterBaseFinanceiraRealMes(empresaId);
      const parametros = { ...(req.body || {}), ...basePg };
      const simulacao = simularCenario(empresaId, parametros);
      res.json(simulacao);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_SIMULATOR_ERROR' });
    }
  });

  router.get('/cross-selling', (req, res) => {
    try {
      const { servico } = req.query;
      const recomendacoes = sugerirCrossSelling(servico);
      res.json({ servico, recomendacoes });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'IA_CROSS_SELLING_ERROR' });
    }
  });

  router.get('/dashboard', async (req, res) => {
    try {
      const empresaId = obterEmpresaId(req) || req.query.empresaId;
      const basePg = await obterBaseFinanceiraRealMes(empresaId);
      const forecast = calcularForecastFaturamento(empresaId, basePg);
      const auditoria = auditarAnomaliasERiscos(empresaId);

      const acoesPrioritarias = [];
      if (forecast.receitaRealizada > 0) {
        acoesPrioritarias.push({
          prioridade: 1,
          categoria: 'Financeiro',
          titulo: 'Acompanhamento de Faturamento Mensal',
          descricao: forecast.metaEmpresa
            ? `Faturamento realizado em ${forecast.receitaRealizadaFormatada}. Restam ${formatarMoeda(Math.max(0, forecast.metaEmpresa - forecast.receitaRealizada))} para atingir a meta cadastrada.`
            : `Faturamento realizado no mês: ${forecast.receitaRealizadaFormatada} (média diária de ${forecast.mediaDiariaFormatada}). Defina uma meta mensal para calcular o percentual de atingimento.`,
        });
      }
      if (auditoria.riscos?.some((r) => r.tipo === 'ruptura_estoque')) {
        acoesPrioritarias.push({
          prioridade: acoesPrioritarias.length + 1,
          categoria: 'Estoque',
          titulo: 'Ponto de pedido atingido',
          descricao: auditoria.riscos.find((r) => r.tipo === 'ruptura_estoque')?.titulo,
        });
      }
      if (auditoria.riscos?.some((r) => r.tipo === 'churn_vip')) {
        acoesPrioritarias.push({
          prioridade: acoesPrioritarias.length + 1,
          categoria: 'CRM',
          titulo: 'Campanha de retorno de clientes',
          descricao: auditoria.riscos.find((r) => r.tipo === 'churn_vip')?.titulo,
        });
      }

      res.json({
        empresaId,
        geradoEm: new Date().toISOString(),
        semDados: Boolean(forecast.semDados && acoesPrioritarias.length === 0),
        scoreSaude: forecast.semDados ? null : auditoria.scoreSaudeOperacional,
        forecast,
        auditoria,
        acoesPrioritarias,
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
