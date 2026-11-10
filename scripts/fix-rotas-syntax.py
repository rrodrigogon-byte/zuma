#!/usr/bin/env python3

with open('app/modules/empresas/rotas.js', 'r', encoding='utf8') as f:
    code = f.read()

bad = """  // Onboarding Rápido de Empresa Completa — Exclusivo Superadmin da plataforma
  router.post('/onboarding-rapido', executar(async ({ req }) => {
      const erro = new Error('Apenas administradores da plataforma Kytto podem realizar onboarding de novas empresas.');
      erro.status = 403;
      erro.code = 'PLATFORM_ADMIN_REQUIRED';
      throw erro;
    }"""

good = """  // Onboarding Rápido de Empresa Completa — Exclusivo Superadmin da plataforma
  router.post('/onboarding-rapido', executar(async ({ req }) => {
    if (!isPlatformAdmin(req.user)) {
      const erro = new Error('Apenas administradores da plataforma Kytto podem realizar onboarding de novas empresas.');
      erro.status = 403;
      erro.code = 'PLATFORM_ADMIN_REQUIRED';
      throw erro;
    }"""

if bad in code:
    code = code.replace(bad, good, 1)
    with open('app/modules/empresas/rotas.js', 'w', encoding='utf8') as f:
        f.write(code)
    print("Corrigido com sucesso!")
else:
    print("bad nao encontrado")
