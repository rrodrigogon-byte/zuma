#!/usr/bin/env python3

# 1. Resolver app/public/index.html
with open('app/public/index.html', 'r', encoding='utf8') as f:
    h = f.read()

import re
h = re.sub(r'<<<<<<< HEAD\n.*?\n=======\n(.*?)\n>>>>>>> [a-f0-9]+', r'\1', h, flags=re.DOTALL)
with open('app/public/index.html', 'w', encoding='utf8') as f:
    f.write(h)
print("index.html resolvido!")

# 2. Resolver app/server.js
with open('app/server.js', 'r', encoding='utf8') as f:
    s = f.read()

conflict_block = """<<<<<<< HEAD
    // Administradores globais e gestores autorizados recebem todas as empresas ativas da plataforma
    if (isPlatformAdminUser(user) || isMainAdminUser(user)) {
=======
    // 1. Admin Global (rodrigo.goncalves e rrodrigogon): todas as empresas ativas da plataforma
    if (isAdminGlobal(user)) {
>>>>>>> 7b1a12b4 (feat(multitenant): regras estritas por perfil - Admin Global, Guilherme (Dino) e Silvester (Stallone & Agro Open))"""

resolved_block = """    // 1. Admin Global (rodrigo.goncalves e rrodrigogon): todas as empresas ativas da plataforma
    if (isAdminGlobal(user)) {"""

if conflict_block in s:
    s = s.replace(conflict_block, resolved_block, 1)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(s)
    print("app/server.js conflito resolvido!")
else:
    print("AVISO: conflict_block não encontrado exatamente no server.js")
    # Tenta regex se houver pequenas diferenças
    s = re.sub(r'<<<<<<< HEAD\n\s*// Administradores globais.*?\n=======\n(.*?)\n>>>>>>> [a-f0-9]+', r'\1', s, flags=re.DOTALL)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(s)
    print("app/server.js regex aplicado!")
