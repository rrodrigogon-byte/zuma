import express from 'express';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

/**
 * /api/admin/empresas — Gerenciamento completo de empresas da plataforma Kytto.
 */
export function createEmpresasAdminRouter({ db }) {
  if (!db) throw new Error('createEmpresasAdminRouter: db é obrigatório');
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  const executar = (fn, status = 200) => async (req, res) => {
    try {
      const resultado = await fn({ req, res });
      return res.status(status).json(resultado);
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // Listar todas as empresas
  router.get('/', executar(async ({ req }) => {
    const empresas = await svc.listarEmpresas(db, {
      incluirInativas: req.query.incluir_inativas === 'true' || req.query.incluirInativas === 'true'
    });
    return { empresas, total: empresas.length };
  }));

  // Diagnóstico Consolidado da Holding Kytto por IA
  router.get('/diagnostico-holding', executar(async () => {
    return await svc.gerarDiagnosticoHoldingIa(db);
  }));

  // Consulta Inteligente de CNPJ Público com inferência de segmento por IA
  router.get('/consulta-cnpj/:cnpj', executar(async ({ req }) => {
    const dados = await svc.consultarCnpjPublicoComIa(req.params.cnpj);
    return { ok: true, dados };
  }));

  // Diagnóstico Executivo de Saúde por IA da Empresa
  router.get('/:id/diagnostico-ia', executar(async ({ req }) => {
    const diagnostico = await svc.gerarDiagnosticoIaEmpresa(db, req.params.id);
    return { ok: true, diagnostico };
  }));

  // Buscar uma empresa por ID
  router.get('/:id', executar(async ({ req }) => {
    return { empresa: await svc.obterEmpresaPorId(db, req.params.id) };
  }));

  // Criar nova empresa com todos os dados
  router.post('/', executar(async ({ req }) => {
    const empresa = await svc.criarEmpresa(db, req.body || {}, req.user);
    return { ok: true, empresa };
  }, 201));

  // Atualizar dados da empresa (PATCH ou PUT)
  router.patch('/:id', executar(async ({ req }) => {
    const empresa = await svc.atualizarEmpresa(db, req.params.id, req.body || {});
    return { ok: true, empresa };
  }));

  router.put('/:id', executar(async ({ req }) => {
    const empresa = await svc.atualizarEmpresa(db, req.params.id, req.body || {});
    return { ok: true, empresa };
  }));

  // Inativar / excluir empresa
  router.delete('/:id', executar(async ({ req }) => {
    return await svc.excluirOuInativarEmpresa(db, req.params.id);
  }));

  return router;
}
