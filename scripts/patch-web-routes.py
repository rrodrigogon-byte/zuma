with open('web/src/App.jsx', 'r', encoding='utf8') as f:
    c = f.read()

import_target = "const Automacoes = lazy(() => import('./pages/admin/Automacoes'))"
import_replacement = """const Automacoes = lazy(() => import('./pages/admin/Automacoes'))
const IaAdvisor = lazy(() => import('./pages/admin/IaAdvisor'))
const LicenciamentoInstancias = lazy(() => import('./pages/admin/LicenciamentoInstancias'))"""

if import_target in c:
    c = c.replace(import_target, import_replacement, 1)
    print("Imports adicionados em App.jsx!")
else:
    print("Import target não encontrado!")

route_target = '          <Route path="/admin/automacoes"     element={<Layout><Automacoes /></Layout>} />'
route_replacement = """          <Route path="/admin/automacoes"     element={<Layout><Automacoes /></Layout>} />
          <Route path="/admin/ia-advisor"     element={<Layout><IaAdvisor /></Layout>} />
          <Route path="/admin/licenciamento"  element={<Layout><LicenciamentoInstancias /></Layout>} />"""

if route_target in c:
    c = c.replace(route_target, route_replacement, 1)
    print("Rotas adicionadas em App.jsx!")
else:
    print("Route target não encontrado!")

with open('web/src/App.jsx', 'w', encoding='utf8') as f:
    f.write(c)
print("web/src/App.jsx gravado com sucesso!")
