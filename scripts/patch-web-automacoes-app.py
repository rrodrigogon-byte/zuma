with open('web/src/App.jsx', 'r', encoding='utf8') as f:
    code = f.read()

lazy_marker = "const CerebroIA = lazy(() => import('./pages/admin/dino/CerebroIA'))"
lazy_addition = """const CerebroIA = lazy(() => import('./pages/admin/dino/CerebroIA'))
const Automacoes = lazy(() => import('./pages/admin/Automacoes'))"""

if "import('./pages/admin/Automacoes')" not in code:
    code = code.replace(lazy_marker, lazy_addition, 1)

route_marker = '<Route path="/admin/cerebro-ia"     element={<Layout><CerebroIA /></Layout>} />'
route_addition = """<Route path="/admin/cerebro-ia"     element={<Layout><CerebroIA /></Layout>} />
          <Route path="/admin/automacoes"     element={<Layout><Automacoes /></Layout>} />"""

if '/admin/automacoes' not in code:
    code = code.replace(route_marker, route_addition, 1)

with open('web/src/App.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print("web/src/App.jsx atualizado com rota de Automacoes!")
