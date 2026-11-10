import express from 'express';
import {
  calcularTributacaoReforma,
  simularImpactoCargaTributaria,
  CONFIG_REFORMA_TRIBUTARIA
} from '../core/reforma-tributaria-ibs-cbs.js';

export function createReformaTributariaRouter() {
  const router = express.Router();

  router.get('/config', (req, res) => {
    res.json({
      ok: true,
      config: CONFIG_REFORMA_TRIBUTARIA
    });
  });

  router.post('/calcular', (req, res) => {
    try {
      const { valorOperacao, tipoOperacao, anoCompetencia, ufDestino } = req.body || {};
      const resultado = calcularTributacaoReforma({
        valorOperacao: Number(valorOperacao) || 100,
        tipoOperacao: tipoOperacao || 'servico',
        anoCompetencia: Number(anoCompetencia) || 2026,
        ufDestino: ufDestino || 'MT'
      });
      res.json({ ok: true, resultado });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/simular', (req, res) => {
    try {
      const { faturamentoMensal, regimeAtual, segmento } = req.body || {};
      const simulacao = simularImpactoCargaTributaria({
        faturamentoMensal: Number(faturamentoMensal) || 50000,
        regimeAtual: regimeAtual || 'simples_nacional',
        segmento: segmento || 'barbearia_salao'
      });
      res.json({ ok: true, simulacao });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  return router;
}
