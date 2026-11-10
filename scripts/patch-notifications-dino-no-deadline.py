caminho = 'app/core/barbershop-appointment-notifications.js'
with open(caminho, 'r', encoding='utf8') as f:
    conteudo = f.read()

antigo = """      const leadMs = dataHora.valueOf() - now.valueOf();
      if (autoConfirm && String(agendamento.status) === 'agendado' && leadMs >= 0 && leadMs <= 36 * 60 * 60 * 1000) {"""

novo = """      const leadMs = dataHora.valueOf() - now.valueOf();
      const isDinoEmp = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(legacyEmpresaId || '').toLowerCase());
      // Na Barbearia Dino: NUNCA usar prazos de cancelamento nem descartar horários por timeout
      if (!isDinoEmp && autoConfirm && String(agendamento.status) === 'agendado' && leadMs >= 0 && leadMs <= 36 * 60 * 60 * 1000) {"""

if antigo in conteudo:
    conteudo = conteudo.replace(antigo, novo)
    with open(caminho, 'w', encoding='utf8') as f:
        f.write(conteudo)
    print("app/core/barbershop-appointment-notifications.js atualizado com sucesso!")
else:
    print("Aviso: trecho exato nao encontrado em barbershop-appointment-notifications.js")
