/**
 * Rotas da API de Auditoria DIMP vs Documentos Fiscais
 */
import { Router } from 'express';
import { executarAuditoriaDimpFiscal, regularizarPendenciasDimp, ADQUIRENTES_DIMP } from '../core/auditoria-dimp-fiscal.js';

export function createDimpRoutes({ auth, obterEmpresaId }) {
  const router = Router();
  if (typeof auth === 'function') {
    router.use(auth);
  }

  // Lista adquirentes e bandeiras homologadas
  router.get('/adquirentes', (req, res) => {
    return res.json({
      sucesso: true,
      adquirentes: Object.values(ADQUIRENTES_DIMP)
    });
  });

  // Executa auditoria do período
  router.get('/auditar', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const mes = req.query.mes || '10';
      const ano = req.query.ano || '2026';
      const auditoria = executarAuditoriaDimpFiscal({ empresaId, mes, ano });
      return res.json(auditoria);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Regulariza em lote pendências de cartão e Pix emitindo as notas fiscais
  router.post('/regularizar-lote', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const itensRegularizar = req.body.itens || [];
      const resultado = regularizarPendenciasDimp({ empresaId, itensRegularizar });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
