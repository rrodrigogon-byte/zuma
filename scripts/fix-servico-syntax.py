import sys

with open('/home/ubuntu/agro-open/app/modules/empresas/servico.js', 'r', encoding='utf8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '// Garante a presença canônica das 4 empresas do ecossistema' in line:
        new_lines.append('  // Garante a presença canônica das 4 empresas do ecossistema\n')
        new_lines.append('  for (const empCanonica of EMPRESAS_CANONICAS_PADRAO) {\n')
        new_lines.append('    const jaTem = empresas.find(e => e.id === empCanonica.id || e.cnpjNormalizado === empCanonica.cnpjNormalizado);\n')
        new_lines.append('    if (!jaTem) {\n')
        new_lines.append('      empresas.push({ ...empCanonica });\n')
        new_lines.append('    }\n')
        new_lines.append('  }\n\n')
        new_lines.append('  return empresas;\n')
        new_lines.append('}\n')
        skip = True
    elif skip:
        if line.strip().startswith('/**') or line.strip().startswith('export async function obterEmpresaPorId'):
            new_lines.append(line)
            skip = False
    else:
        new_lines.append(line)

with open('/home/ubuntu/agro-open/app/modules/empresas/servico.js', 'w', encoding='utf8') as f:
    f.writelines(new_lines)

print('Ajuste de servico.js concluído!')
