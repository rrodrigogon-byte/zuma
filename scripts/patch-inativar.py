#!/usr/bin/env python3

with open('web/src/pages/admin/Empresas.jsx', 'r', encoding='utf8') as f:
    content = f.read()

target = "{emp.id !== 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' && ("
replacement = "{isPlatformAdmin && emp.id !== 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' && ("

if target in content:
    content = content.replace(target, replacement, 1)
    with open('web/src/pages/admin/Empresas.jsx', 'w', encoding='utf8') as f:
        f.write(content)
    print("Inativar condicionado a isPlatformAdmin com sucesso!")
else:
    print("AVISO: target de inativar não encontrado exatamente")
