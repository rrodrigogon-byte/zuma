with open('app/server.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Importações dos novos routers
import_target = "import { createAutomacoesRouter } from './routes/automacoes-routes.js';"
import_replacement = """import { createAutomacoesRouter } from './routes/automacoes-routes.js';
import { createLicenciamentoRouter } from './routes/licenciamento-routes.js';
import { createIaAdvisorRouter } from './routes/ia-advisor-routes.js';"""

if import_target in c:
    c = c.replace(import_target, import_replacement, 1)
    print("Imports adicionados com sucesso!")
else:
    print("Target de import não encontrado!")

# 2. Adicionar 'licenciamento' e 'ia-advisor' em TENANT_ADMIN_MODULES
tenant_target = "'automacoes', 'eventos']);"
tenant_replacement = "'automacoes', 'eventos', 'licenciamento', 'ia-advisor']);"

if tenant_target in c:
    c = c.replace(tenant_target, tenant_replacement, 1)
    print("TENANT_ADMIN_MODULES atualizado!")
else:
    print("Target de TENANT_ADMIN_MODULES não encontrado!")

# 3. Montagem dos routers no express
router_target = "  app.use('/api/admin/automacoes', auth, requireStaff, automacoesRouter);"
router_replacement = """  app.use('/api/admin/automacoes', auth, requireStaff, automacoesRouter);

  // [kytto-licenciamento] Módulo de Licenciamento, Planos e Gestão de Instâncias Multi-Business (SaaS e On-Premise)
  const licenciamentoRouter = createLicenciamentoRouter({
    obterEmpresaId: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    },
    isPlatformAdmin: (req) => isAdminGlobal(req.user)
  });
  app.use('/api/admin/licenciamento', auth, requireStaff, licenciamentoRouter);

  // [kytto-ia-advisor] Copilot de IA Executiva e Operacional Kytto Advisor
  const iaAdvisorRouter = createIaAdvisorRouter({
    obterEmpresaId: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/ia-advisor', auth, requireStaff, iaAdvisorRouter);"""

if router_target in c:
    c = c.replace(router_target, router_replacement, 1)
    print("Routers montados no Express com sucesso!")
else:
    print("Target de montagem de router não encontrado!")

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(c)
print("app/server.js gravado com sucesso!")
