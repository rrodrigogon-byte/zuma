with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Import
old_import = "import { createIaAdvisorRouter } from './routes/ia-advisor-routes.js';"
new_import = "import { createIaAdvisorRouter } from './routes/ia-advisor-routes.js';\nimport { createTefRouter } from './routes/tef-routes.js';"
code = code.replace(old_import, new_import, 1)

# 2. TENANT_ADMIN_MODULES
old_tenant = "'inteligencia-vendas', 'vender-mais']);"
new_tenant = "'inteligencia-vendas', 'vender-mais', 'tef']);"
code = code.replace(old_tenant, new_tenant, 1)

# 3. Montagem da rota
target_router = "app.use('/api/admin/ia-advisor', auth, requireStaff, iaAdvisorRouter);"
new_router = """app.use('/api/admin/ia-advisor', auth, requireStaff, iaAdvisorRouter);

  // [kytto-tef] Módulo Oficial TEF Multi-Maquininhas do Brasil (Stone, PagBank, Cielo, Rede, Getnet, SafraPay, Vero/Sicredi, SiTef)
  const tefRouter = createTefRouter({
    obterEmpresaId: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/tef', auth, requireStaff, tefRouter);"""

code = code.replace(target_router, new_router, 1)

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(code)

print("server.js atualizado com o módulo TEF com sucesso!")
