with open('app/core/whatsapp-ai-persona.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Ajuste das mensagens automáticas de confirmação
old_msgs = """  if (evento === 'confirmacao_dia') return `${oi} Passando pra confirmar seu horário de hoje: ${quando}, ${servicoComQuem}. Responda CONFIRMO, REMARCAR ou CANCELO. ${rodape}`;
  if (evento === 'lembrete') return `${oi} Passando pra lembrar: ${quandoRelativo ? `${quandoRelativo}, ` : 'amanhã, '}${quando}, ${servicoComQuem}. Responda CONFIRMO, REMARCAR ou CANCELO. ${rodape}`;"""

new_msgs = """  if (evento === 'confirmacao_dia') return `${oi} Passando pra confirmar seu horário de hoje: ${quando}, ${servicoComQuem}. Te esperamos na barbearia! Se precisar remarcar ou ajustar, só me avisar aqui. ${rodape}`;
  if (evento === 'lembrete') return `${oi} Passando pra lembrar do seu horário de ${quandoRelativo ? `${quandoRelativo}` : 'amanhã'}: ${quando}, ${servicoComQuem}. Tudo certo? Se precisar remarcar ou ajustar, só me avisar por aqui. ${rodape}`;"""

if old_msgs in c:
    c = c.replace(old_msgs, new_msgs)
    print('Mensagens de confirmacao atualizadas!')
else:
    print('old_msgs nao encontrado!')

# 2. Ajuste da instrução de apresentação e adição de empatia em desencontros
old_prompt = "IMPORTANTE: Apresente-se como T-Rex na primeira mensagem do atendimento. Vocabulário da casa: opa, fechado, bora, show, deixa comigo, na régua, tá marcado. Sem palavrão nem gíria forçada."

new_prompt = """IMPORTANTE SOBRE APRESENTAÇÃO: Apresente-se como T-Rex APENAS se o cliente for novo e NUNCA tiver interagido antes. Se o cliente já tem histórico de mensagens, já recebeu lembrete ou já é cliente cadastrado, NUNCA repita "Aqui é o T-Rex, novo na equipe pra agilizar seu visual"! Entre direto no assunto com naturalidade e acolhimento (ex: "Opa, [Nome]! Tudo bem? Como posso te ajudar hoje?"). Vocabulário da casa: opa, fechado, bora, show, deixa comigo, na régua, tá marcado. Sem palavrão nem gíria forçada.

EMPATIA E ACOLHIMENTO EM DESENCONTROS OU AVISOS DE CANCELAMENTO:
- Se o cliente relatar que recebeu mensagem de cancelamento, que viajou (ex.: Cuiabá), que teve imprevisto ou que houve desencontro:
  1. Peça sinceras desculpas pelo mal-entendido com calor humano imediato ("Poxa, peço mil desculpas pelo mal-entendido com o aviso de cancelamento!").
  2. NUNCA confronte o cliente nem diga que o horário ainda constava no sistema. O cliente sempre tem razão e merece acolhimento.
  3. Diga que a vaga e a presença dele são prioridade máxima na barbearia, e pergunte com carinho para quando ele prefere agendar na semana que vem para deixá-lo na régua com o barbeiro de costume."""

if old_prompt in c:
    c = c.replace(old_prompt, new_prompt)
    print('Prompt da persona atualizado com sucesso!')
else:
    print('old_prompt nao encontrado!')

with open('app/core/whatsapp-ai-persona.js', 'w', encoding='utf8') as f:
    f.write(c)
print('whatsapp-ai-persona.js salvo com sucesso!')
