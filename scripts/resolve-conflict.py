with open('app/core/barbershop-agenda.js', 'r', encoding='utf8') as f:
    c = f.read()

conflict_marker = """<<<<<<< HEAD
    // Nota: O lembrete oficial de véspera (1 dia antes) e de dia (manhã) é gerenciado deterministicamente
    // pelo dino-confirmacao-diaria.js e pelo agendamento da fila. Nunca disparar lembrete imediato no mesmo minuto da confirmação no WhatsApp.
=======
    // NÃO dispara lembrete imediato aqui: o agendamento acabou de ser confirmado no chat com o código.
    // Lembretes da véspera e do dia são enfileirados pelo cron diário de lembretes.
>>>>>>> a506e509 (fix(whatsapp-ai): blindagem definitiva de confirmacao de presenca e resolucao de agendamentos no T-Rex)"""

resolved = """    // NÃO dispara lembrete imediato aqui: o agendamento acabou de ser confirmado no chat com o código.
    // O lembrete oficial de véspera e de dia é gerenciado pelo dino-confirmacao-diaria.js e pelo agendamento da fila."""

assert conflict_marker in c, "Marcador de conflito não encontrado!"
c = c.replace(conflict_marker, resolved, 1)

with open('app/core/barbershop-agenda.js', 'w', encoding='utf8') as f:
    f.write(c)

print("Conflito em barbershop-agenda.js resolvido com sucesso!")
