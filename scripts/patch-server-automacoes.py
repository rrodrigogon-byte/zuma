with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Import
import_marker = "import { createEmpresasAdminRouter } from './modules/empresas/rotas.js';"
import_addition = """import { createEmpresasAdminRouter } from './modules/empresas/rotas.js';
import { createAutomacoesRouter } from './routes/automacoes-routes.js';"""

if "automacoes-routes.js" not in code:
    code = code.replace(import_marker, import_addition, 1)

# 2. TENANT_ADMIN_MODULES
old_tenant_modules = "'crm', 'financeiro'"
new_tenant_modules = "'crm', 'financeiro', 'automacoes', 'eventos'"
if "'automacoes'" not in code:
    code = code.replace(old_tenant_modules, new_tenant_modules, 1)

# 3. Montagem do router
mount_marker = "  app.use('/api/admin/empresas', auth, requireStaff, empresasRouter);"
mount_addition = """  app.use('/api/admin/empresas', auth, requireStaff, empresasRouter);

  // [kytto-automacoes] Motor corporativo de automações e barramento central de eventos internos
  const automacoesRouter = createAutomacoesRouter({
    obterEmpresaIdDoUsuario: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    },
    isPlatformAdmin: (req) => isAdminGlobal(req.user)
  });
  app.use('/api/admin/automacoes', auth, requireStaff, automacoesRouter);"""

if "automacoesRouter" not in code:
    code = code.replace(mount_marker, mount_addition, 1)

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(code)

print("server.js atualizado com automacoesRouter com sucesso!")
