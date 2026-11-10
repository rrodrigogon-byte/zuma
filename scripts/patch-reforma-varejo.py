# -*- coding: utf-8 -*-
with open('app/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Imports no topo
antigo_import = "import { createSupplyChainRoutes } from './routes/supply-chain-routes.js';"
novo_import = """import { createSupplyChainRoutes } from './routes/supply-chain-routes.js';
import { createReformaTributariaRouter } from './routes/reforma-tributaria-routes.js';
import { createVarejoMulticanalRouter } from './routes/varejo-multicanal-routes.js';"""

if antigo_import in c:
    c = c.replace(antigo_import, novo_import)
    print("Imports adicionados com sucesso!")
else:
    print("antigo_import não encontrado!")

# 2. TENANT_ADMIN_MODULES
antigo_modules = "'dimp-auditoria', 'supply-chain'"
novo_modules = "'dimp-auditoria', 'supply-chain', 'reforma-tributaria', 'varejo-multicanal'"

if antigo_modules in c:
    c = c.replace(antigo_modules, novo_modules)
    print("TENANT_ADMIN_MODULES atualizado com sucesso!")
else:
    print("antigo_modules não encontrado!")

# 3. Montagem das rotas
antiga_montagem = "app.use('/api/admin/supply-chain', auth, requireStaff, supplyChainRouter);"
nova_montagem = """app.use('/api/admin/supply-chain', auth, requireStaff, supplyChainRouter);
  app.use('/api/admin/fiscal/reforma-tributaria', auth, requireStaff, createReformaTributariaRouter());
  app.use('/api/admin/varejo', auth, requireStaff, createVarejoMulticanalRouter());"""

if antiga_montagem in c:
    c = c.replace(antiga_montagem, nova_montagem)
    print("Rotas montadas com sucesso!")
else:
    print("antiga_montagem não encontrada!")

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("app/server.js salvo!")
