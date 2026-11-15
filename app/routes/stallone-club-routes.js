import { Router } from 'express';
import {
  STALLONE_EMPRESA_ID,
  listarPlanosStalloneClub,
  criarAssinaturaStalloneClub,
  processarCobrancaCicloAssinatura,
  consultarAssinaturaPorCpf,
  listarTodasAssinaturas
} from '../core/stallone-club-assinaturas.js';

export function createStalloneClubRoutes() {
  const router = Router();

  // Catálogo público de planos da Box Mensal Stallone
  router.get('/planos', (_req, res) => {
    return res.json({
      sucesso: true,
      planos: listarPlanosStalloneClub()
    });
  });

  // Adesão pública / e-commerce
  router.post('/assinar', (req, res) => {
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
  router.get('/assinatura/:cpf', (req, res) => {
    try {
      const { cpf } = req.params;
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      const assinatura = consultarAssinaturaPorCpf(empresaId, cpf);
      if (!assinatura) {
        return res.status(404).json({ sucesso: false, erro: 'Nenhuma assinatura localizada para este CPF.' });
      }
      return res.json({ sucesso: true, assinatura });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: listagem de assinaturas
  router.get('/admin/assinaturas', (req, res) => {
    try {
      const empresaId = req.query.empresaId || STALLONE_EMPRESA_ID;
      const assinaturas = listarTodasAssinaturas(empresaId);
      return res.json({
        sucesso: true,
        total: assinaturas.length,
        assinaturas
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Painel administrativo: processar ciclo de cobrança
  router.post('/admin/assinaturas/:id/processar-ciclo', (req, res) => {
    try {
      const { id } = req.params;
      const empresaId = req.body?.empresaId || STALLONE_EMPRESA_ID;
      const resultado = processarCobrancaCicloAssinatura(empresaId, id);
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
