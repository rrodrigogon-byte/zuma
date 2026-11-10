# 1. Atualizar App.jsx
with open('web/src/App.jsx', 'r', encoding='utf8') as f:
    code = f.read()

target_lazy = "const InteligenciaVendasPage = lazy(() => import('./pages/admin/InteligenciaVendas'))"
novo_lazy = """const InteligenciaVendasPage = lazy(() => import('./pages/admin/InteligenciaVendas'))
const DeliveryHub = lazy(() => import('./pages/admin/DeliveryHub'))"""

if target_lazy in code and 'const DeliveryHub' not in code:
    code = code.replace(target_lazy, novo_lazy, 1)

target_route = '<Route path="/admin/omnichannel"      element={<Layout><CanaisFidelidade /></Layout>} />'
nova_rota = """<Route path="/admin/delivery"         element={<Layout><DeliveryHub /></Layout>} />
          <Route path="/admin/omnichannel"      element={<Layout><CanaisFidelidade /></Layout>} />"""

if target_route in code and '/admin/delivery' not in code:
    code = code.replace(target_route, nova_rota, 1)

with open('web/src/App.jsx', 'w', encoding='utf8') as f:
    f.write(code)
print('App.jsx atualizado com DeliveryHub!')

# 2. Atualizar Sidebar.jsx
with open('web/src/components/Sidebar.jsx', 'r', encoding='utf8') as f:
    sb = f.read()

target_sb = "{ to: '/admin/omnichannel', icon: '🔄', label: 'Canais, Delivery & Fidelidade' },"
novo_sb = """{ to: '/admin/delivery', icon: '🛵', label: 'Central Delivery & Motoboys' },
      { to: '/admin/omnichannel', icon: '🔄', label: 'Canais, Delivery & Fidelidade' },"""

if target_sb in sb and '/admin/delivery' not in sb:
    sb = sb.replace(target_sb, novo_sb, 1)

with open('web/src/components/Sidebar.jsx', 'w', encoding='utf8') as f:
    f.write(sb)
print('Sidebar.jsx atualizado com Central Delivery & Motoboys!')
