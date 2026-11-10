#!/usr/bin/env python3

rotas_code = '''import express from 'express';
import * as consolidacao from './consolidacao.js';
import { listarEventosInternos, obterMetricasEventosInternos, emitirEventoInterno } from '../a2/eventos.js';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

/**
 * /api/admin/empresas — Gerenciamento de empresas da plataforma Kytto com isolamento estrito multi-tenant.
 */
export function createEmpresasAdminRouter({ db, isPlatformAdmin = () => false, obterEmpresaIdDoUsuario = () => null } = {}) {
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

  // Helper para verificar se usuário tem acesso à empresa
  const verificarAcessoEmpresa = (req, targetEmpresaId) => {
    if (isPlatformAdmin(req.user)) return true;
    const empresaUsuario = String(obterEmpresaIdDoUsuario(req) || req.user?.empresaId || '').trim();
    const target = String(targetEmpresaId || '').trim();
    if (!empresaUsuario || !target) return false;
    if (empresaUsuario === target) return true;
    // Vínculo legado Dino
    if ((empresaUsuario === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || empresaUsuario === 'dino') && (target === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || target === 'dino')) {
      return true;
    }
    return false;
  };

  // Listar empresas — Inquilino vê APENAS a sua própria empresa. Administrador da plataforma vê todas.
  router.get('/', executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    let empresaIdFiltro = null;
    if (!ehAdminPlataforma) {
      empresaIdFiltro = obterEmpresaIdDoUsuario(req) || req.user?.empresaId || null;
    } else if (req.query.empresaId || req.query.empresa_id) {
      empresaIdFiltro = req.query.empresaId || req.query.empresa_id;
    }

    const empresas = await svc.listarEmpresas(db, {
      incluirInativas: req.query.incluir_inativas === 'true' || req.query.incluirInativas === 'true',
      empresaIdFiltro
    });
    return { empresas, total: empresas.length, ehAdminPlataforma };
  }));

  // Consolidação de Empresas do Mesmo Grupo — EXCLUSIVO da Diretoria da Holding Kytto (Superadmin)
  router.get('/consolidacao-grupo', executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    if (!ehAdminPlataforma) {
      const erro = new Error('Acesso restrito à Diretoria Corporativa da Holding Kytto. Como gestor de unidade, seus dados estão seguros e isolados no painel de sua empresa.');
      erro.status = 403;
      erro.code = 'HOLDING_ADMIN_REQUIRED';
      throw erro;
    }
    const grupoId = req.query.grupoId || req.query.grupo_id || '';
    const periodo = req.query.periodo || 'mes_atual';
    return await consolidacao.obterConsolidacaoGrupo(db, { grupoId, periodo });
  }));

  // Listar Grupos Empresariais / Holdings — Filtrado se não for admin de plataforma
  router.get('/grupos', executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    const grupos = await consolidacao.listarGruposEmpresariais(db);
    if (ehAdminPlataforma) {
      return { grupos, total: grupos.length };
    }
    const empresaUsuario = String(obterEmpresaIdDoUsuario(req) || req.user?.empresaId || '').trim();
    // Filtra empresas dentro do grupo para não vazar terceiros
    const gruposFiltrados = grupos.map(g => ({
      ...g,
      empresas: (g.empresas || []).filter(e => e.id === empresaUsuario || (empresaUsuario === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' && e.id === 'dino'))
    })).filter(g => (g.empresas || []).length > 0);
    return { grupos: gruposFiltrados, total: gruposFiltrados.length };
  }));

  // Log e Auditoria da Sincronização por Evento Interno
  router.get('/eventos-internos', executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    let empresaFiltro = req.query.empresaId || '';
    if (!ehAdminPlataforma) {
      empresaFiltro = String(obterEmpresaIdDoUsuario(req) || req.user?.empresaId || '');
    }
    const eventos = listarEventosInternos({
      empresaId: empresaFiltro,
      tipo: req.query.tipo || '',
      limite: req.query.limite || 50
    });
    return { eventos, total: eventos.length };
  }));

  // Métricas do Barramento de Eventos Internos
  router.get('/metricas-eventos-internos', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      return { totalEventos: 0, taxaSucesso: '100%', filas: [] };
    }
    return obterMetricasEventosInternos();
  }));

  // Disparar sincronização manual entre Nossa Gente e Ultra
  router.post('/sincronizar-eventos', executar(async ({ req }) => {
    const { tipo = 'cadastro_atualizado', acao = 'sincronizar', id = 'todas', payload = {} } = req.body || {};
    let empresaId = req.body?.empresaId || '';
    if (!isPlatformAdmin(req.user)) {
      empresaId = String(obterEmpresaIdDoUsuario(req) || req.user?.empresaId || '');
    }
    const evento = emitirEventoInterno({ origem: 'Nossa Gente', destino: 'Ultra', tipo, acao, empresaId, id, payload });
    return { ok: true, mensagem: 'Sincronização por evento interno disparada com sucesso', evento };
  }));

  // Diagnóstico Consolidado da Holding Kytto por IA — Exclusivo Superadmin
  router.get('/diagnostico-holding', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error('Diagnóstico de holding disponível apenas para a administração da plataforma.');
      erro.status = 403;
      erro.code = 'HOLDING_ADMIN_REQUIRED';
      throw erro;
    }
    return await svc.gerarDiagnosticoHoldingIa(db);
  }));

  // Consulta Inteligente de CNPJ Público com inferência de segmento por IA
  router.get('/consulta-cnpj/:cnpj', executar(async ({ req }) => {
    const dados = await svc.consultarCnpjPublicoComIa(req.params.cnpj);
    return { ok: true, dados };
  }));

  // Diagnóstico Executivo de Saúde por IA da Empresa (Permitido para o dono da própria empresa)
  router.get('/:id/diagnostico-ia', executar(async ({ req }) => {
    if (!verificarAcessoEmpresa(req, req.params.id)) {
      const erro = new Error('Acesso negado: você não tem permissão para visualizar o diagnóstico de outra empresa.');
      erro.status = 403;
      erro.code = 'ACCESS_DENIED';
      throw erro;
    }
    const diagnostico = await svc.gerarDiagnosticoIaEmpresa(db, req.params.id);
    return { ok: true, diagnostico };
  }));

  // Buscar uma empresa por ID — Com bloqueio contra acesso a empresas alheias
  router.get('/:id', executar(async ({ req }) => {
    if (!verificarAcessoEmpresa(req, req.params.id)) {
      const erro = new Error('Acesso negado: você não tem permissão para visualizar dados de outra empresa.');
      erro.status = 403;
      erro.code = 'ACCESS_DENIED';
      throw erro;
    }
    return { empresa: await svc.obterEmpresaPorId(db, req.params.id) };
  }));

  // Criar nova empresa — Exclusivo Superadmin da plataforma
  router.post('/', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error('Apenas administradores da plataforma Kytto podem cadastrar novas empresas.');
      erro.status = 403;
      erro.code = 'PLATFORM_ADMIN_REQUIRED';
      throw erro;
    }
    const empresa = await svc.criarEmpresa(db, req.body || {}, req.user);
    return { ok: true, empresa };
  }, 201));

  // Atualizar dados da empresa (PATCH ou PUT) — Permitido apenas para a própria empresa
  router.patch('/:id', executar(async ({ req }) => {
    if (!verificarAcessoEmpresa(req, req.params.id)) {
      const erro = new Error('Acesso negado: você não tem permissão para alterar dados de outra empresa.');
      erro.status = 403;
      erro.code = 'ACCESS_DENIED';
      throw erro;
    }
    const empresa = await svc.atualizarEmpresa(db, req.params.id, req.body || {});
    return { ok: true, empresa };
  }));

  router.put('/:id', executar(async ({ req }) => {
    if (!verificarAcessoEmpresa(req, req.params.id)) {
      const erro = new Error('Acesso negado: você não tem permissão para alterar dados de outra empresa.');
      erro.status = 403;
      erro.code = 'ACCESS_DENIED';
      throw erro;
    }
    const empresa = await svc.atualizarEmpresa(db, req.params.id, req.body || {});
    return { ok: true, empresa };
  }));

  // Inativar / excluir empresa — Exclusivo Superadmin
  router.delete('/:id', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error('Apenas administradores da plataforma Kytto podem inativar ou excluir empresas.');
      erro.status = 403;
      erro.code = 'PLATFORM_ADMIN_REQUIRED';
      throw erro;
    }
    return await svc.excluirOuInativarEmpresa(db, req.params.id);
  }));

  return router;
}
'''

with open('app/modules/empresas/rotas.js', 'w', encoding='utf8') as f:
    f.write(rotas_code)
print("app/modules/empresas/rotas.js reescrito com isolamento multiempresa e controle de acesso estrito!")
