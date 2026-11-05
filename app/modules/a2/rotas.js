import express from 'express';
import * as svc from './servico.js';
import { mapearClienteNoViralgram, mapearTodosClientesViralgram, statusIntegracaoViralgram } from '../../core/viralgram-connector.js';
import { responderErro } from '../acesso/banco.js';

export function createA2AdminRouter({ db, empresaDaRequisicao, operadorDaRequisicao = null }) {
  if (!db || typeof empresaDaRequisicao !== 'function') throw new Error('createA2AdminRouter: db e empresaDaRequisicao são obrigatórios');
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const executar = (fn, status = 200) => async (req, res) => {
    try {
      const empresaId = await empresaDaRequisicao(req);
      const operador = operadorDaRequisicao ? operadorDaRequisicao(req) : null;
      return res.status(status).json(await fn({ req, res, empresaId, operador }));
    } catch (error) {
      return responderErro(res, error);
    }
  };

  router.get('/empresa-ativa', executar(async ({ empresaId }) => ({ empresa: await svc.obterEmpresa(db, empresaId) })));

  router.get('/clientes', executar(async ({ empresaId }) => ({ clientes: await svc.listarClientes(db, empresaId) })));
  router.post('/clientes', executar(({ empresaId, req }) => svc.salvarCliente(db, empresaId, req.body || {}), 201));
  router.get('/clientes/viralgram/status', executar(({ empresaId }) => statusIntegracaoViralgram(empresaId)));
  router.post('/clientes/viralgram/mapear-todos', executar(({ empresaId }) => mapearTodosClientesViralgram(empresaId)));
  router.post('/clientes/:id/mapear-viralgram', executar(({ empresaId, req }) => mapearClienteNoViralgram(empresaId, req.params.id)));
  router.patch('/clientes/:id', executar(({ empresaId, req }) => svc.salvarCliente(db, empresaId, req.body || {}, req.params.id)));
  router.delete('/clientes/:id', executar(({ empresaId, req }) => svc.excluirCliente(db, empresaId, req.params.id)));
  router.get('/servicos', executar(({ empresaId }) => svc.listarServicosMestres(empresaId).then((servicos) => ({ servicos }))));
  router.post('/servicos', executar(({ empresaId, req }) => svc.salvarServicoMestre(empresaId, req.body || {}), 201));
  router.patch('/servicos/:id', executar(({ empresaId, req }) => svc.salvarServicoMestre(empresaId, req.body || {}, req.params.id)));
  router.delete('/servicos/:id', executar(({ empresaId, req }) => svc.excluirServicoMestre(empresaId, req.params.id)));
  router.get('/produtos', executar(({ empresaId }) => svc.listarProdutosMestres(empresaId).then((produtos) => ({ produtos }))));
  router.post('/produtos', executar(({ empresaId, req }) => svc.salvarProdutoMestre(empresaId, req.body || {}), 201));
  router.patch('/produtos/:id', executar(({ empresaId, req }) => svc.salvarProdutoMestre(empresaId, req.body || {}, req.params.id)));
  router.delete('/produtos/:id', executar(({ empresaId, req }) => svc.excluirProdutoMestre(empresaId, req.params.id)));

  router.get('/contas-receber', executar(async ({ empresaId, req }) => ({ contas: await svc.listarContas(db, empresaId, req.query) })));
  router.post('/contas-receber', executar(({ empresaId, req, operador }) => svc.criarConta(db, empresaId, req.body || {}, operador), 201));
  router.patch('/contas-receber/:id', executar(({ empresaId, req }) => svc.baixarConta(db, empresaId, req.params.id, req.body?.dataPagamento || new Date())));
  router.delete('/contas-receber/:id', executar(({ empresaId, req }) => svc.excluirConta(db, empresaId, req.params.id)));
  router.post('/contas-receber/expurgar-testes', executar(({ empresaId }) => svc.expurgarContasTeste(db, empresaId)));
  router.get('/alertas-vencimento', executar(async ({ empresaId }) => ({ alertas: await svc.listarAlertas(db, empresaId) })));

  router.get('/fechamento-diario', executar(async ({ empresaId }) => ({ fechamentos: await svc.listarFechamentos(db, empresaId) })));
  router.post('/fechamento-diario', executar(({ empresaId, req, operador }) => svc.criarFechamento(db, empresaId, req.body?.observacao, req.user?.nome || req.user?.nome_completo || req.user?.email || operador || 'Sistema'), 201));

  for (const tipo of ['funcionarios', 'fornecedores']) {
    router.get(`/${tipo}`, executar(({ empresaId }) => svc.listarCadastros(db, empresaId, tipo).then((registros) => ({ [tipo]: registros }))));
    router.post(`/${tipo}`, executar(({ empresaId, req }) => svc.salvarCadastro(db, empresaId, tipo, req.body || {}), 201));
    router.patch(`/${tipo}/:id`, executar(({ empresaId, req }) => svc.salvarCadastro(db, empresaId, tipo, req.body || {}, req.params.id)));
    router.delete(`/${tipo}/:id`, executar(({ empresaId, req }) => svc.excluirCadastro(db, empresaId, tipo, req.params.id)));
  }
  router.get('/usuarios-mestres', executar(({ empresaId }) => svc.listarUsuariosMestres(db, empresaId).then((usuarios) => ({ usuarios }))));
  router.post('/usuarios-mestres', executar(({ empresaId, req }) => svc.salvarUsuarioMestre(db, empresaId, req.body || {}), 201));
  router.patch('/usuarios-mestres/:id', executar(({ empresaId, req }) => svc.salvarUsuarioMestre(db, empresaId, req.body || {}, req.params.id)));
  router.delete('/usuarios-mestres/:id', executar(({ empresaId, req }) => svc.excluirUsuarioMestre(db, empresaId, req.params.id)));

  // Empresas da plataforma para alternancia rapida
  router.get('/empresas-plataforma', executar(async () => ({ empresas: await svc.listarEmpresasPlataforma(db) })));

  // Formas de Pagamento & Contas Financeiras
  router.get('/formas-pagamento', executar(async ({ empresaId }) => ({ formasPagamento: await svc.listarFormasPagamento(db, empresaId) })));
  router.post('/formas-pagamento', executar(({ empresaId, req }) => svc.salvarFormaPagamento(db, empresaId, req.body || {}), 201));
  router.patch('/formas-pagamento/:id', executar(({ empresaId, req }) => svc.salvarFormaPagamento(db, empresaId, req.body || {}, req.params.id)));
  router.delete('/formas-pagamento/:id', executar(({ empresaId, req }) => svc.excluirFormaPagamento(db, empresaId, req.params.id)));

  // Unidades & Lojas da Empresa
  router.get('/unidades', executar(async ({ empresaId }) => ({ unidades: await svc.listarUnidadesMestres(db, empresaId) })));
  router.post('/unidades', executar(({ empresaId, req }) => svc.salvarUnidadeMestre(db, empresaId, req.body || {}), 201));
  router.patch('/unidades/:id', executar(({ empresaId, req }) => svc.salvarUnidadeMestre(db, empresaId, req.body || {}, req.params.id)));
  router.delete('/unidades/:id', executar(({ empresaId, req }) => svc.excluirUnidadeMestre(db, empresaId, req.params.id)));

  return router;
}
