with open('web/src/components/Sidebar.jsx', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Adicionar em NAV_PLATFORM
plat_target = """const NAV_PLATFORM = [
  { to: '/admin/plataforma', icon: '🏢', label: 'Empresas e Módulos' },
  { to: '/admin/plataforma/conciliacao-financeira', icon: '⚖️', label: 'Conciliação financeira' },"""

plat_replacement = """const NAV_PLATFORM = [
  { to: '/admin/plataforma', icon: '🏢', label: 'Empresas e Módulos' },
  { to: '/admin/plataforma/conciliacao-financeira', icon: '⚖️', label: 'Conciliação financeira' },
  { to: '/admin/licenciamento', icon: '🛡️', label: 'Licenciamento & Instâncias' },
  { to: '/admin/ia-advisor', icon: '✦', label: 'Kytto Advisor (Copilot IA)' },"""

if plat_target in c:
    c = c.replace(plat_target, plat_replacement, 1)
    print("NAV_PLATFORM atualizado!")
else:
    print("NAV_PLATFORM target não encontrado!")

# 2. Adicionar em NAV_DINO_GROUPS
dino_target = "{ to: '/admin/automacoes', icon: '⚡', label: 'Automações & Robôs' },"
dino_replacement = """{ to: '/admin/automacoes', icon: '⚡', label: 'Automações & Robôs' },
      { to: '/admin/ia-advisor', icon: '✦', label: 'Kytto Advisor (IA)' },
      { to: '/admin/licenciamento', icon: '🛡️', label: 'Licenças & Instâncias' },"""

if dino_target in c:
    c = c.replace(dino_target, dino_replacement, 1)
    print("NAV_DINO_GROUPS atualizado!")
else:
    print("dino_target não encontrado!")

with open('web/src/components/Sidebar.jsx', 'w', encoding='utf8') as f:
    f.write(c)
print("web/src/components/Sidebar.jsx gravado com sucesso!")
