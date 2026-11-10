#!/usr/bin/env python3

with open('app/modules/empresas/rotas.js', 'r', encoding='utf8') as f:
    content = f.read()

header_old = "export function createEmpresasAdminRouter({ db, isPlatformAdmin = () => false, obterEmpresaIdDoUsuario = () => null } = {}) {"
header_new = "export function createEmpresasAdminRouter({ db, isPlatformAdmin = () => false, obterEmpresaIdDoUsuario = () => null, obterEmpresasAutorizadas = null } = {}) {"

content = content.replace(header_old, header_new, 1)

helpers_old = """  // Helper para verificar se usuário tem acesso à empresa
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
  }));"""

helpers_new = """  // Helper para verificar se usuário tem acesso à empresa
  const verificarAcessoEmpresa = (req, targetEmpresaId) => {
    if (isPlatformAdmin(req.user)) return true;
    const target = String(targetEmpresaId || '').trim().toLowerCase();
    if (!target) return false;

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
        autorizadas = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'dino'];
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
          autorizadas = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'dino'];
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
  }));"""

if helpers_old in content:
    content = content.replace(helpers_old, helpers_new, 1)
    with open('app/modules/empresas/rotas.js', 'w', encoding='utf8') as f:
        f.write(content)
    print("app/modules/empresas/rotas.js atualizado com sucesso!")
else:
    print("ERRO: helpers_old não encontrado em app/modules/empresas/rotas.js")
