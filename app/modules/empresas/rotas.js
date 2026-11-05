import express from 'express';
import * as consolidacao from './consolidacao.js';
import { listarEventosInternos, obterMetricasEventosInternos, emitirEventoInterno } from '../a2/eventos.js';
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

  // Consolidação de Empresas do Mesmo Grupo e Multi-Business
  router.get('/consolidacao-grupo', executar(async ({ req }) => {
    const grupoId = req.query.grupoId || req.query.grupo_id || '';
    const periodo = req.query.periodo || 'mes_atual';
    return await consolidacao.obterConsolidacaoGrupo(db, { grupoId, periodo });
  }));

  // Listar Grupos Empresariais / Holdings
  router.get('/grupos', executar(async () => {
    const grupos = await consolidacao.listarGruposEmpresariais(db);
    return { grupos, total: grupos.length };
  }));

  // Log e Auditoria da Sincronização por Evento Interno (Nossa Gente × Ultra)
  router.get('/eventos-internos', executar(async ({ req }) => {
    const eventos = listarEventosInternos({
      empresaId: req.query.empresaId || '',
      tipo: req.query.tipo || '',
      limite: req.query.limite || 50
    });
    return { eventos, total: eventos.length };
  }));

  // Métricas do Barramento de Eventos Internos
  router.get('/metricas-eventos-internos', executar(async () => {
    return obterMetricasEventosInternos();
  }));

  // Disparar sincronização manual entre Nossa Gente e Ultra
  router.post('/sincronizar-eventos', executar(async ({ req }) => {
    const { tipo = 'cadastro_atualizado', acao = 'sincronizar', empresaId = '', id = 'todas', payload = {} } = req.body || {};
    const evento = emitirEventoInterno({ origem: 'Nossa Gente', destino: 'Ultra', tipo, acao, empresaId, id, payload });
    return { ok: true, mensagem: 'Sincronização por evento interno disparada com sucesso', evento };
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
