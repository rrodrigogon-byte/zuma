/**
 * Rotas da API para Licenciamento, Planos e Gestão de Instâncias Multi-Business
 * 
 * Kytto ERP - Arquitetura Multi-Tenant
 */

import { Router } from 'express';
import { 
  obterStatusLicenca, 
  ativarChaveLicenca, 
  obterUsoInstancias, 
  gerarChaveLicenca, 
  PLANOS_CATALOGO 
} from '../core/licenciamento-kytto.js';
import { EMPRESA_DINO_ID } from '../modules/empresas/servico.js';

export function createLicenciamentoRouter({ isPlatformAdmin = () => false, obterEmpresaId = () => EMPRESA_DINO_ID } = {}) {
  const router = Router();

  // Consulta status atual da licença do tenant
  router.get('/status', (req, res) => {
    try {
      const empresaId = req.query.empresaId || obterEmpresaId(req) || EMPRESA_DINO_ID;
      const status = obterStatusLicenca(empresaId);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'LICENSE_STATUS_ERROR' });
    }
  });

  // Consulta catálogo de planos disponíveis
  router.get('/planos', (_req, res) => {
    res.json({
      planos: Object.values(PLANOS_CATALOGO)
    });
  });

  // Consulta uso detalhado de cotas e instâncias (WhatsApp, Lojas, PDVs)
  router.get('/instancias', (req, res) => {
    try {
      const empresaId = req.query.empresaId || obterEmpresaId(req) || EMPRESA_DINO_ID;
      const dados = obterUsoInstancias(empresaId);
      res.json(dados);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'INSTANCES_USAGE_ERROR' });
    }
  });

  // Ativação de chave de licença (SaaS ou On-Premise)
  router.post('/ativar', (req, res) => {
    try {
      const empresaId = req.body.empresaId || obterEmpresaId(req) || EMPRESA_DINO_ID;
      const chave = req.body.chave;

      if (!chave) {
        return res.status(400).json({ error: 'Chave de licença obrigatória.', code: 'KEY_REQUIRED' });
      }

      const licencaAtivada = ativarChaveLicenca(empresaId, chave);
      res.json({
        sucesso: true,
        mensagem: 'Licença ativada com sucesso.',
        licenca: licencaAtivada
      });
    } catch (err) {
      res.status(400).json({ error: err.message, code: 'LICENSE_ACTIVATION_ERROR' });
    }
  });

  // Liberação ou alocação de nova instância (sujeito à cota do plano)
  router.post('/instancias/liberar', (req, res) => {
    try {
      const empresaId = req.body.empresaId || obterEmpresaId(req) || EMPRESA_DINO_ID;
      const { tipo, finalidade, nome } = req.body;

      const uso = obterUsoInstancias(empresaId);
      const cotaTipo = uso.cotas[tipo === 'whatsapp' ? 'whatsapp' : (tipo === 'loja' ? 'lojas' : 'pdv')];

      if (cotaTipo && cotaTipo.disponivel <= 0 && !isPlatformAdmin(req)) {
        return res.status(403).json({
          error: `Cota de instâncias excedida para o tipo ${tipo}. Limite do plano: ${cotaTipo.limite}. Faça upgrade do plano.`,
          code: 'QUOTA_EXCEEDED',
          cota: cotaTipo
        });
      }

      res.json({
        sucesso: true,
        mensagem: `Nova instância de ${tipo} autorizada com sucesso.`,
        instancia: {
          id: `${tipo}-${Date.now().toString(36)}`,
          tipo,
          finalidade: finalidade || 'operacao',
          nome: nome || `Instância ${tipo.toUpperCase()}`,
          status: 'autorizada',
          criadaEm: new Date().toISOString()
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'INSTANCE_ALLOCATION_ERROR' });
    }
  });

  // Emissão de nova chave de licença (Exclusivo Superadmin Global)
  router.post('/gerar-chave', (req, res) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ error: 'Acesso restrito ao Superadmin Global da Kytto.', code: 'FORBIDDEN' });
      }

      const dados = req.body || {};
      const resultado = gerarChaveLicenca(dados);
      res.json({
        sucesso: true,
        chave: resultado.chave,
        payload: resultado.payload
      });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'GENERATE_KEY_ERROR' });
    }
  });

  return router;
}
