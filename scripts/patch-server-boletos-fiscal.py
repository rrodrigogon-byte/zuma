import re

with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Imports
import_statement = """import { createBoletosRouter } from './routes/boletos-routes.js';
import { createFiscalAvancadoRouter } from './routes/fiscal-avancado-routes.js';
"""
if "createBoletosRouter" not in code:
    code = import_statement + code

# 2. TENANT_ADMIN_MODULES
if "'boletos'" not in code:
    code = code.replace(
        "'inteligencia-vendas', 'vender-mais', 'tef'",
        "'inteligencia-vendas', 'vender-mais', 'tef', 'boletos', 'fiscal-avancado'"
    )

# 3. Router mounting
mount_statement = """
  // [kytto-boletos] Boleto Bancário Registrado & Pix Cobrança Híbrido (Sicredi, Sicoob, Itaú, BB, Bradesco)
  const boletosRouter = createBoletosRouter({
    obterEmpresaId: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/boletos', auth, requireStaff, boletosRouter);

  // [kytto-fiscal-avancado] ICMS-ST MT & Manifestação do Destinatário (MD-e)
  const fiscalAvancadoRouter = createFiscalAvancadoRouter({
    obterEmpresaId: (req) => {
      if (isAdminGlobal(req.user)) {
        return req.headers['x-empresa-id'] ? String(req.headers['x-empresa-id']).trim() : 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      }
      return req.user?.empresaId ? String(req.user.empresaId).trim() : (legacyEmpresaId(req) || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    }
  });
  app.use('/api/admin/fiscal-avancado', auth, requireStaff, fiscalAvancadoRouter);
"""

target = "app.use('/api/admin/tef', auth, requireStaff, tefRouter);"
if "boletosRouter" not in code and target in code:
    code = code.replace(target, target + mount_statement)

with open('app/server.js', 'w', encoding='utf8') as f:
    f.write(code)

print('app/server.js atualizado com sucesso!')
