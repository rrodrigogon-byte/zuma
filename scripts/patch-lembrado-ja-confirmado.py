with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """  const pendentes = todosValidos.filter((item) => !['concluido', 'confirmado'].includes(String(item.status)));
  const lembradoId = context?.session?.estado?.ultimoAgendamentoLembradoId;

  // Se já estiver confirmado e o cliente confirmou de novo:
  if (!pendentes.length) {"""

replacement = """  const lembradoId = context?.session?.estado?.ultimoAgendamentoLembradoId;

  // Se o agendamento específico que recebeu o lembrete já foi confirmado, responde imediatamente com tranquilidade
  if (lembradoId) {
    const jaConfirmadoLembrado = todosValidos.find((item) => item.id === lembradoId && String(item.status) === 'confirmado');
    if (jaConfirmadoLembrado) {
      const quando = new Date(jaConfirmadoLembrado.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const primeiroNome = context.customerName ? `, ${context.customerName.split(' ')[0]}` : '';
      return {
        text: `Tudo certo${primeiroNome}! Seu horário de ${jaConfirmadoLembrado.servico?.nome || 'atendimento'} com ${jaConfirmadoLembrado.profissional?.nome || 'a equipe'}, ${quando}, já está 100% confirmado na régua! Te esperamos na Dino Barbearia! 💈`,
        kind: 'presence_confirmed',
      };
    }
  }

  const pendentes = todosValidos.filter((item) => !['concluido', 'confirmado'].includes(String(item.status)));

  // Se já estiver confirmado e o cliente confirmou de novo:
  if (!pendentes.length) {"""

assert target in c, "target não encontrado em whatsapp-ai.js!"
c = c.replace(target, replacement, 1)

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(c)

print("whatsapp-ai.js atualizado com prioridade de lembradoId já confirmado!")
