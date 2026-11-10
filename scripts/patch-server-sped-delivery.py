with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Imports no topo
target_import = "import { createBoletosRouter } from './routes/boletos-routes.js';"
novos_imports = """import { createBoletosRouter } from './routes/boletos-routes.js';
import { createSpedAdminRouter } from './routes/sped-routes.js';
import { createDeliveryAdminRouter } from './routes/delivery-routes.js';"""

if target_import in code:
    code = code.replace(target_import, novos_imports, 1)
    print('Imports adicionados com sucesso!')
else:
    print('target_import não encontrado')

# 2. Adicionar 'sped', 'delivery' no TENANT_ADMIN_MODULES
old_set = "'fiscal-avancado'"
new_set = "'fiscal-avancado', 'sped', 'delivery'"
if old_set in code:
    code = code.replace(old_set, new_set, 1)
    print('TENANT_ADMIN_MODULES atualizado com sucesso!')
else:
    print('old_set não encontrado')

# 3. Montar rotas
target_mount = "app.use('/api/admin/fiscal-avancado', auth, requireStaff, fiscalAvancadoRouter);"
novas_rotas = """app.use('/api/admin/fiscal-avancado', auth, requireStaff, fiscalAvancadoRouter);

  // [kytto-sped] EFD ICMS/IPI & EFD Contribuições Avançado com Bloco C, E, H e Pré-PVA
  const spedRouter = createSpedAdminRouter({
    obterEmpresaIdDoUsuario: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/sped', auth, requireStaff, spedRouter);

  // [kytto-delivery] Central de Entregas, Motoboys, Roteirização e Régua WhatsApp
  const deliveryRouter = createDeliveryAdminRouter({
    obterEmpresaIdDoUsuario: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/delivery', auth, requireStaff, deliveryRouter);"""

if target_mount in code:
    code = code.replace(target_mount, novas_rotas, 1)
    print('Rotas montadas com sucesso!')
else:
    print('target_mount não encontrado')

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(code)
print('server.js gravado com sucesso!')
