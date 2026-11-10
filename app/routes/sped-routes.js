/**
 * Rotas da API Administrativa do SPED Fiscal (EFD ICMS/IPI) & Validador Pré-PVA
 */
import { Router } from 'express';
import { gerarSpedFiscalEfd, validarArquivoPvaSped } from '../core/sped-efd-avancado.js';

export function createSpedAdminRouter({ obterEmpresaIdDoUsuario }) {
  const router = Router();

  function resolverEmpresa(req) {
    if (typeof obterEmpresaIdDoUsuario === 'function') {
      const id = obterEmpresaIdDoUsuario(req);
      if (id) return id;
    }
    return req.headers['x-empresa-id'] || req.user?.empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  }

  // Gerar arquivo SPED EFD ICMS/IPI
  router.post('/efd-icms-ipi/gerar', async (req, res) => {
    try {
      const empresaId = resolverEmpresa(req);
      const { periodo, contador } = req.body || {};

      const empresa = {
        id: empresaId,
        nome: 'Dino Barbearia Ltda',
        nomeFantasia: 'Dino Barbearia',
        cnpj: '50073355000260',
        inscricaoEstadual: '142291919',
        email: 'financeiro@dinobarbearia.com.br'
      };

      // Documentos fictícios/reais de saída para a escrituração do período
      const documentosSaida = [
        {
          modelo: '65',
          numero: '1042',
          chaveAcesso: '51261050073355000260650010000010421876543210',
          dataEmissao: '2026-10-15',
          valorTotal: 600.00,
          valorIcms: 102.00,
          status: 'autorizado'
        },
        {
          modelo: '55',
          numero: '315',
          chaveAcesso: '51261050073355000260550010000003151876543219',
          dataEmissao: '2026-10-20',
          valorTotal: 1250.00,
          valorIcms: 212.50,
          status: 'autorizado'
        }
      ];

      const resultado = await gerarSpedFiscalEfd({
        empresa,
        periodo: periodo || { mes: 10, ano: 2026 },
        documentosSaida,
        contador
      });

      const validacaoPva = validarArquivoPvaSped(resultado.conteudoArquivo);

      res.json({
        sucesso: true,
        nomeArquivo: resultado.nomeArquivo,
        estatisticas: resultado.estatisticas,
        validacaoPva,
        conteudoArquivo: resultado.conteudoArquivo
      });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Validar arquivo externo ou texto do SPED Pré-PVA
  router.post('/validar-pva', (req, res) => {
    try {
      const { conteudoSped } = req.body || {};
      if (!conteudoSped) return res.status(400).json({ sucesso: false, erro: 'Conteúdo do SPED obrigatório.' });

      const relatorio = validarArquivoPvaSped(conteudoSped);
      res.json({ sucesso: true, relatorio });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
