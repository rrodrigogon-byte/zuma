with open('scripts/gerar-prints-evidencias.cjs', 'r', encoding='utf8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'if (!authData.ok || !authData.token)' in line or 'if (!authData.token)' in line:
        new_lines.append('  if (!authData.token) {\n')
        new_lines.append("    throw new Error('Falha no login da API: ' + JSON.stringify(authData));\n")
        new_lines.append('  }\n')
        new_lines.append('  const usuario = authData.user || authData.usuario;\n')
        new_lines.append('  const sessao = authData.sessao || {};\n')
        new_lines.append("  console.log('[Puppeteer] Login autenticado com sucesso! Usuário:', usuario?.nome);\n")
        continue
    if "console.log('[Puppeteer] Login autenticado com sucesso! Usuário:', authData.usuario?.nome);" in line:
        continue
    if "throw new Error('Falha no login da API: ' + JSON.stringify(authData));" in line and len(new_lines) > 2 and 'Falha no login da API' in new_lines[-1]:
        continue
    new_lines.append(line)

with open('scripts/gerar-prints-evidencias.cjs', 'w', encoding='utf8') as f:
    f.writelines(new_lines)

print('Arquivo corrigido com sucesso!')
