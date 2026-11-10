# -*- coding: utf-8 -*-
with open('app/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Import
antigo_imp = "import { createVarejoMulticanalRouter } from './routes/varejo-multicanal-routes.js';"
novo_imp = """import { createVarejoMulticanalRouter } from './routes/varejo-multicanal-routes.js';
import { createOficinaAdminRouter } from './routes/oficina-routes.js';"""

if antigo_imp in c:
    c = c.replace(antigo_imp, novo_imp)
    print("Import da oficina adicionado!")

# 2. TENANT_ADMIN_MODULES
antigo_mod = "'reforma-tributaria', 'varejo-multicanal'"
novo_mod = "'reforma-tributaria', 'varejo-multicanal', 'oficina'"

if antigo_mod in c:
    c = c.replace(antigo_mod, novo_mod)
    print("TENANT_ADMIN_MODULES atualizado com oficina!")

# 3. Montagem
antiga_mont = "app.use('/api/admin/varejo', auth, requireStaff, createVarejoMulticanalRouter());"
nova_mont = """app.use('/api/admin/varejo', auth, requireStaff, createVarejoMulticanalRouter());
  app.use('/api/admin/oficina', auth, requireStaff, createOficinaAdminRouter());"""

if antiga_mont in c:
    c = c.replace(antiga_mont, nova_mont)
    print("app.use('/api/admin/oficina') montado com sucesso!")

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("app/server.js salvo com oficina!")
