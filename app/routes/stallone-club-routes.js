import { Router } from "express";
import {
  STALLONE_EMPRESA_ID,
  listarPlanosStalloneClub,
  criarAssinaturaStalloneClub,
  processarCobrancaCicloAssinatura,
  consultarAssinaturaPorCpf,
  listarTodasAssinaturasAsync,
  obterResumoMetricasClube,
  pausarAssinatura,
  reativarAssinatura,
  cancelarAssinatura,
} from "../core/stallone-club-assinaturas.js";

export function createStalloneClubRoutes() {
  const router = Router();

  // Catálogo público de planos da Box Mensal Stallone
  router.get("/planos", (_req, res) => {
    return res.json({
      sucesso: true,
      planos: listarPlanosStalloneClub()
    });
  });

  // Métricas executivas do Clube de Assinaturas (MRR, ARR, contagem, cashback)
  router.get(["/metricas", "/admin/metricas"], async (req, res) => {
    try {
      const empresaId = req.query.empresaId || req.headers["x-empresa-id"] || STALLONE_EMPRESA_ID;
      const metricas = await obterResumoMetricasClube(empresaId);
      return res.json({
        sucesso: true,
        metricas
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Adesão pública / e-commerce / balcão
  router.post(["/assinar", "/adesao"], (req, res) => {
    try {
      const dados = req.body || {};
      const resultado = criarAssinaturaStalloneClub({
        ...dados,
        empresaId: dados.empresaId || STALLONE_EMPRESA_ID
      });
      return res.status(201).json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Consulta por CPF
  router.get("/assinatura/:cpf", (req, res) => {
    try {
      const { cpf } = req.params;
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      const assinatura = consultarAssinaturaPorCpf(empresaId, cpf);
      if (!assinatura) {
        return res.status(404).json({ sucesso: false, erro: "Nenhuma assinatura localizada para este CPF." });
      }
      return res.json({ sucesso: true, assinatura });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: listagem de assinaturas sincronizada (PostgreSQL + Memória)
  router.get(["/assinaturas", "/admin/assinaturas"], async (req, res) => {
    try {
      const empresaId = req.query.empresaId || req.headers["x-empresa-id"] || STALLONE_EMPRESA_ID;
      const assinaturas = await listarTodasAssinaturasAsync(empresaId);
      return res.json({
        sucesso: true,
        total: assinaturas.length,
        assinaturas
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: processar ciclo de cobrança (TEF / PIX / Recorrente)
  router.post(["/assinaturas/:id/processar-ciclo", "/admin/assinaturas/:id/processar-ciclo"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const resultado = processarCobrancaCicloAssinatura(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: pausar assinatura
  router.post(["/assinaturas/:id/pausar", "/admin/assinaturas/:id/pausar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const motivo = req.body?.motivo;
      const resultado = pausarAssinatura(empresaId, id, motivo);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: reativar assinatura
  router.post(["/assinaturas/:id/reativar", "/admin/assinaturas/:id/reativar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const resultado = reativarAssinatura(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: cancelar assinatura
  router.post(["/assinaturas/:id/cancelar", "/admin/assinaturas/:id/cancelar"], (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const motivo = req.body?.motivo;
      const resultado = cancelarAssinatura(empresaId, id, motivo);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
