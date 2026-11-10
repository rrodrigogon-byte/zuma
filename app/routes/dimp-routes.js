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

  // Regularização assistida individual (Emissão em lote bloqueada por diretriz fiscal SEFAZ-MT)
  router.post('/regularizar-lote', (req, res) => {
    try {
      const empresaId = typeof obterEmpresaId === 'function' ? obterEmpresaId(req) : req.empresaId;
      const itensRegularizar = req.body.itens || [];
      
      // Bloqueia emissão automática em lote sem confirmação manual
      if (!req.body.confirmacaoManualExplicita) {
        return res.status(403).json({
          sucesso: false,
          erro: "Emissão em lote desativada por política de segurança fiscal (SEFAZ-MT). Ative a flag de emissão individual assistida."
        });
      }

      // Limita a 1 documento por chamada assistida para evitar disparos massivos descontrolados
      if (itensRegularizar.length > 1) {
        return res.status(400).json({
          sucesso: false,
          erro: "Diretriz SEFAZ: autorizada emissão de apenas 1 documento fiscal por validação assistida."
        });
      }

      const resultado = regularizarPendenciasDimp({ empresaId, itensRegularizar });
      return res.json(resultado);
    } catch (err) {
      return res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
