with open('web/src/components/Sidebar.jsx', 'r', encoding='utf8') as f:
    code = f.read()

target1 = "      { to: '/admin/cerebro-ia', icon: '◈', label: 'Cérebro do atendente' },"
replacement1 = """      { to: '/admin/cerebro-ia', icon: '◈', label: 'Cérebro do atendente' },
      { to: '/admin/automacoes', icon: '⚡', label: 'Automações & Robôs' },"""

code = code.replace(target1, replacement1)

with open('web/src/components/Sidebar.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print("web/src/components/Sidebar.jsx atualizado com menu de Automacoes!")
