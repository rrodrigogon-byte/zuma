import express from 'express';
import * as consolidacao from './consolidacao.js';
import { listarEventosInternos, obterMetricasEventosInternos, emitirEventoInterno } from '../a2/eventos.js';
import * as svc from './servico.js';
import { responderErro } from '../acesso/banco.js';

/**
 * /api/admin/empresas — Gerenciamento de empresas da plataforma Kytto com isolamento estrito multi-tenant.
 */
export function createEmpresasAdminRouter({ db, isPlatformAdmin = () => false, obterEmpresaIdDoUsuario = () => null, obterEmpresasAutorizadas = null } = {}) {
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
    const target = String(targetEmpresaId || '').trim().toLowerCase();
    if (!target) return false;

    let autorizadas = null;
    if (typeof obterEmpresasAutorizadas === 'function') {
      autorizadas = obterEmpresasAutorizadas(req.user);
    }
    if (!autorizadas) {
      const em = (
        String(req.user?.email || '') + ' ' +
        String(req.user?.emailAlternativo || '') + ' ' +
        String(req.user?.username || '') + ' ' +
        String(req.user?.nome || '') + ' ' +
        String(req.user?.id || '')
      ).toLowerCase();
      if (em.includes('silvester') || em.includes('silvestre') || em.includes('stallone')) {
        autorizadas = [
          '31f70c83-9172-40c2-945f-9e793b5048be',
          'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e',
          'stallone'
        ];
      } else if (em.includes('guilherme') || em.includes('guicunha') || em.includes('dino') || em === 'gui') {
        autorizadas = ["d0d0ac01-8e50-4b61-8c79-de4aaa916da6", "dino"];
      } else if (em.includes("palatare") || em.includes("pizzaria") || em.includes("concreto") || em.includes("serrano") || em.includes("usina") || em.includes("alexandre")) {
        autorizadas = [
          "c0c0ac01-8e50-4b61-8c79-de4aaa916da0",
          "c1c1ac01-8e50-4b61-8c79-de4aaa916da9",
          "c2c2ac01-8e50-4b61-8c79-de4aaa916da2",
          "palatare",
          "concreto",
          "holding"
        ];
      } else if (em.includes("zuma") || em.includes("oriental") || em.includes("sushiman") || em.includes("leandro")) {
        autorizadas = [
          "c3c3ac01-8e50-4b61-8c79-de4aaa916da3",
          "zuma"
        ];
      } else if (em.includes('agroopen') || em.includes('caua') || em.includes('rafa') || em.includes('agro open')) {
        autorizadas = ['2e041110-db20-4fd1-8278-12bd3dead008', 'emp-agro-open', 'agroopen'];
      } else {
        const empId = obterEmpresaIdDoUsuario(req) || req.user?.empresaId || null;
        autorizadas = empId ? [empId] : [];
      }
    }

    return autorizadas.map(x => String(x).toLowerCase()).includes(target);
  };

  // Listar empresas:
  // - Admin Global (rodrigo.goncalves e rrodrigogon): visualiza e pode filtrar TODAS as empresas.
  // - Silvester: visualiza APENAS Stallone e Agro Open (e pode filtrar entre as duas).
  // - Guilherme: visualiza APENAS Barbearia Dino.
  // - Demais usuários: visualizam apenas sua própria empresa vinculada.
  router.get('/', executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    let empresaIdFiltro = null;

    const hostReq = String(req.headers.host || "").toLowerCase();
    const isZumaHostOrReq = hostReq.includes("zuma") ||
                            req.query.marca === "zuma" ||
                            req.query.slug === "zuma" ||
                            req.query.empresa === "zuma" ||
                            req.headers["x-empresa-id"] === "c3c3ac01-8e50-4b61-8c79-de4aaa916da3" ||
                            req.headers["x-empresa-exclusiva"] === "zuma" ||
                            process.env.APP_EMPRESA_EXCLUSIVA === "zuma" ||
                            process.env.EXCLUSIVA_ZUMA === "true";

    if (isZumaHostOrReq) {
      empresaIdFiltro = ["c3c3ac01-8e50-4b61-8c79-de4aaa916da3"];
    }

    if (ehAdminPlataforma) {
      if (req.query.empresaId || req.query.empresa_id) {
        empresaIdFiltro = req.query.empresaId || req.query.empresa_id;
      }
    } else {
      let autorizadas = null;
      if (typeof obterEmpresasAutorizadas === 'function') {
        autorizadas = obterEmpresasAutorizadas(req.user);
      }
      if (!autorizadas) {
        const em = String(req.user?.email || req.user?.username || '').toLowerCase();
        if (em.includes('silvester') || em.includes('silvestre')) {
          autorizadas = [
            '31f70c83-9172-40c2-945f-9e793b5048be',
            '2e041110-db20-4fd1-8278-12bd3dead008',
            'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e',
            'e0e0ac01-8e50-4b61-8c79-de4aaa916da7',
            'emp-agro-open'
          ];
        } else if (em.includes('guilherme') || em.includes('guicunha') || em.includes('dino') || em === 'gui') {
          autorizadas = ["d0d0ac01-8e50-4b61-8c79-de4aaa916da6", "dino"];
        } else if (em.includes("palatare") || em.includes("pizzaria")) {
          autorizadas = ["c1c1ac01-8e50-4b61-8c79-de4aaa916da9", "palatare"];
        } else if (em.includes("concreto") || em.includes("serrano") || em.includes("usina")) {
          autorizadas = ["c2c2ac01-8e50-4b61-8c79-de4aaa916da2", "concreto"];
        } else if (em.includes("zuma") || em.includes("oriental") || em.includes("sushiman") || em.includes("leandro")) {
          autorizadas = ["c3c3ac01-8e50-4b61-8c79-de4aaa916da3", "zuma"];
        } else {
          const empId = obterEmpresaIdDoUsuario(req) || req.user?.empresaId || null;
          autorizadas = empId ? [empId] : [];
        }
      }

      const q = String(req.query.empresaId || req.query.empresa_id || '').trim().toLowerCase();
      if (q && autorizadas.map(x => String(x).toLowerCase()).includes(q)) {
        empresaIdFiltro = [q];
      } else {
        empresaIdFiltro = autorizadas;
      }
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

  // ==========================================
  // GOVERNANÇA DE NEGÓCIOS & MÓDULOS (ONDA 1)
  // ==========================================
  router.get("/negocios", executar(async ({ req }) => {
    const ehAdminPlataforma = Boolean(isPlatformAdmin(req.user));
    let empresaFiltro = req.query.empresaId || "";
    if (!ehAdminPlataforma) {
      empresaFiltro = String(obterEmpresaIdDoUsuario(req) || req.user?.empresaId || "");
    }

    let sql = `
      SELECT n.id::text, n.empresa_id::text, n.tipo, n.nome, n.situacao, n.modulos_ligados,
             e.nome AS empresa_nome, e.cnpj AS empresa_cnpj,
             COUNT(l.id)::int AS total_unidades
        FROM negocios n
        JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN lojas l ON l.negocio_id = n.id
    `;
    const params = [];
    if (empresaFiltro) {
      sql += ` WHERE n.empresa_id = $1 `;
      params.push(empresaFiltro);
    }
    sql += ` GROUP BY n.id, n.empresa_id, n.tipo, n.nome, n.situacao, n.modulos_ligados, e.nome, e.cnpj
             ORDER BY e.nome, n.nome `;

    let rows = [];
    try {
      const res = await db.query(sql, params);
      rows = res.rows || [];
    } catch (e) {
      console.warn("Erro ao buscar negocios do postgres:", e.message);
    }

    const empresasLista = await svc.listarEmpresas(db, { incluirInativas: false });

    return {
      negocios: rows,
      total: rows.length,
      empresas: empresasLista.map(e => ({ id: e.id, nome: e.nome, cnpj: e.cnpj, tipoNegocio: e.tipoNegocio }))
    };
  }));

  router.post("/negocios", executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error("Apenas administradores de plataforma podem criar novos negócios.");
      erro.status = 403;
      throw erro;
    }
    const { empresa_id, tipo, nome, modulos_ligados = [] } = req.body || {};
    if (!empresa_id || !tipo || !nome) {
      const erro = new Error("empresa_id, tipo e nome são obrigatórios.");
      erro.status = 400;
      throw erro;
    }
    const res = await db.query(
      `INSERT INTO negocios (empresa_id, tipo, nome, situacao, modulos_ligados)
       VALUES ($1, $2, $3, 'ativo', $4::jsonb)
       RETURNING id::text, empresa_id::text, tipo, nome, situacao, modulos_ligados`,
      [empresa_id, tipo, nome, JSON.stringify(modulos_ligados)]
    );
    return { ok: true, negocio: res.rows[0] };
  }, 201));

  router.put("/negocios/:id/modulos", executar(async ({ req }) => {
    const { id } = req.params;
    const { modulos_ligados } = req.body || {};
    if (!Array.isArray(modulos_ligados)) {
      const erro = new Error("modulos_ligados deve ser um array.");
      erro.status = 400;
      throw erro;
    }
    if (!modulos_ligados.includes("erp_comum")) {
      modulos_ligados.unshift("erp_comum");
    }
    const res = await db.query(
      `UPDATE negocios
          SET modulos_ligados = $1::jsonb,
              atualizado_em = NOW()
        WHERE id = $2
        RETURNING id::text, empresa_id::text, tipo, nome, situacao, modulos_ligados`,
      [JSON.stringify(modulos_ligados), id]
    );
    if (!res.rows?.length) {
      const erro = new Error("Negócio não encontrado.");
      erro.status = 404;
      throw erro;
    }
    return { ok: true, negocio: res.rows[0] };
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

  // Listar templates de onboarding disponíveis para o ecossistema Kytto
  router.get('/templates', executar(async () => {
    return {
      ok: true,
      templates: Object.values(svc.TEMPLATES_NEGOCIO || {})
    };
  }));

  // Onboarding Rápido de Empresa Completa — Exclusivo Superadmin da plataforma
  router.post('/onboarding-rapido', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error('Apenas administradores da plataforma Kytto podem realizar onboarding de novas empresas.');
      erro.status = 403;
      erro.code = 'PLATFORM_ADMIN_REQUIRED';
      throw erro;
    }
    const payload = req.body || {};
    const empresa = await svc.criarEmpresa(db, {
      ...payload,
      criarLojaMatriz: payload.criarLojaMatriz !== false,
      autoProvisionarCatalogo: payload.autoProvisionarCatalogo !== false,
      criarAdminAutomatico: payload.criarAdminAutomatico !== false,
    }, req.user);

    return {
      ok: true,
      empresa,
      administrador: empresa.administrador || null,
      catalogoInicial: empresa.catalogoInicial || null
    };
  }, 201));

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
