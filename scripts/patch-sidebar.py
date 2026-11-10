#!/usr/bin/env python3

with open('web/src/components/Sidebar.jsx', 'r', encoding='utf8') as f:
    content = f.read()

# No grupo de Dino (NAV_DINO_GROUPS):
# Substituir:
#       { to: '/admin/empresas', icon: '🏢', label: 'Empresas' },
#       { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },
# Por:
#       { to: '/admin/empresas', icon: '🏢', label: 'Minha Barbearia' },

dino_old = """      { to: '/admin/empresas', icon: '🏢', label: 'Empresas' },
      { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },"""
dino_new = """      { to: '/admin/empresas', icon: '🏢', label: 'Minha Barbearia' },"""

if dino_old in content:
    content = content.replace(dino_old, dino_new, 1)
    print("Dino menu atualizado com sucesso!")
else:
    print("AVISO: Trecho dino_old não encontrado exatamente")

# No grupo de Stallone (NAV_STALLONE_GROUPS):
# Substituir:
#       { to: '/admin/empresas', icon: '🏢', label: 'Empresas' },
#       { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },
# Por:
#       { to: '/admin/empresas', icon: '🏢', label: 'Minha Empresa' },

stallone_old = """      { to: '/admin/empresas', icon: '🏢', label: 'Empresas' },
      { to: '/admin/consolidacao-grupo', icon: '🏛️', label: 'Consolidação Holding' },"""
stallone_new = """      { to: '/admin/empresas', icon: '🏢', label: 'Minha Empresa' },"""

if stallone_old in content:
    content = content.replace(stallone_old, stallone_new, 1)
    print("Stallone menu atualizado com sucesso!")
else:
    print("AVISO: Trecho stallone_old não encontrado exatamente")

with open('web/src/components/Sidebar.jsx', 'w', encoding='utf8') as f:
    f.write(content)
print("web/src/components/Sidebar.jsx gravado com sucesso!")
