#!/usr/bin/env python3

with open('app/modules/empresas/rotas.js', 'r', encoding='utf8') as f:
    code = f.read()

target = "  // Detalhes da empresa por ID — Permitido apenas se o usuário pertencer a esta empresa ou for platform admin\n  router.get('/:id',"

novas_rotas = """  // Listar templates de onboarding disponíveis para o ecossistema Kytto
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
      mensagem: `Empresa "${empresa.nomeFantasia || empresa.nome}" provisionada com sucesso no ERP Kytto!`,
      empresa,
      administrador: empresa.administrador || null,
      catalogoInicial: empresa.catalogoInicial || null
    };
  }, 201));

  // Detalhes da empresa por ID — Permitido apenas se o usuário pertencer a esta empresa ou for platform admin
  router.get('/:id',"""

if target in code:
    code = code.replace(target, novas_rotas, 1)
    with open('app/modules/empresas/rotas.js', 'w', encoding='utf8') as f:
        f.write(code)
    print("Rotas /templates e /onboarding-rapido adicionadas com sucesso em rotas.js!")
else:
    print("ERRO: target não encontrado em rotas.js")
