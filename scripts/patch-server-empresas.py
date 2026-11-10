#!/usr/bin/env python3

with open('app/server.js', 'r', encoding='utf8') as f:
    content = f.read()

target = "const empresasRouter = createEmpresasAdminRouter({ db: clubeDb });"
replacement = """const empresasRouter = createEmpresasAdminRouter({
    db: clubeDb,
    isPlatformAdmin: (user) => isPlatformAdminUser(user) || isMainAdminUser(user),
    obterEmpresaIdDoUsuario: (req) => {
      if (isPlatformAdminUser(req.user) || isMainAdminUser(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : null;
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || null);
    }
  });"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(content)
    print("app/server.js atualizado com sucesso!")
else:
    print("ERRO: Alvo não encontrado em app/server.js")
