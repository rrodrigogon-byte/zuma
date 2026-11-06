with open('app/core/whatsapp-ai-tools.js', 'r', encoding='utf8') as f:
    c = f.read()

antigo = "instrucao: 'Se o horário pedido não estiver em slots, ofereça os 3 horários livres mais próximos dele, com o valor de cada um. Não pergunte período.',"
novo = "instrucao: 'Se o horário pedido ESTIVER livre nos slots, chame preparar_agendamento IMEDIATAMENTE nesta mesma resposta para apresentar o resumo ao cliente sem enrolação. Se o horário pedido não estiver em slots, ofereça os 3 horários livres mais próximos dele, com o valor de cada um. Não pergunte período.',"

if antigo in c:
    c = c.replace(antigo, novo)
    with open('app/core/whatsapp-ai-tools.js', 'w', encoding='utf8') as f:
        f.write(c)
    print("app/core/whatsapp-ai-tools.js atualizado com sucesso!")
else:
    print("AVISO: trecho antigo não encontrado!")
