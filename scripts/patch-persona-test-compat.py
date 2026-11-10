with open('app/core/whatsapp-ai-persona.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """  if (evento === 'confirmacao_dia') return `${oi} Passando pra confirmar seu horário de hoje: ${quando}, ${servicoComQuem}. Te esperamos na barbearia! Se precisar remarcar ou ajustar, só me avisar aqui. ${rodape}`;
  if (evento === 'lembrete') return `${oi} Passando pra lembrar do seu horário de ${quandoRelativo ? `${quandoRelativo}` : 'amanhã'}: ${quando}, ${servicoComQuem}. Tudo certo? Se precisar remarcar ou ajustar, só me avisar por aqui. ${rodape}`;"""

replacement = """  if (evento === 'confirmacao_dia') return `${oi} Passando pra confirmar seu horário de hoje: ${quando}, ${servicoComQuem}. Responda CONFIRMO, REMARCAR ou CANCELO. Te esperamos na barbearia! ${rodape}`;
  if (evento === 'lembrete') return `${oi} Passando pra confirmar seu horário de ${quandoRelativo ? `${quandoRelativo}` : 'amanhã'}: ${quando}, ${servicoComQuem}. Responda CONFIRMO, REMARCAR ou CANCELO. ${rodape}`;"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('app/core/whatsapp-ai-persona.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('Ajustado com sucesso!')
else:
    print('Target nao encontrado!')
