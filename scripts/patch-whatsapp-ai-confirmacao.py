with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Atualizar withPrivacyNotice para não injetar introdução se for confirmação de presença
target_notice = """async function withPrivacyNotice(session, channel, text) {
  if (!text || session.privacy_notice_at) return text;"""

replacement_notice = """async function withPrivacyNotice(session, channel, text) {
  if (!text || session.privacy_notice_at) return text;
  // Se for confirmação de agendamento ou resposta objetiva a lembrete, não injeta introdução de apresentação
  if (/^(confirmad[oa]s?|tudo certo|show|fechado|hor[aá]rio)/i.test(text.trim())) {
    await db.query(
      `UPDATE whatsapp_ai_sessions
          SET privacy_notice_at = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND privacy_notice_at IS NULL`,
      [session.id, session.empresa_id, session.loja_id],
    ).catch(() => null);
    return text;
  }"""

assert target_notice in c, "target_notice não encontrado!"
c = c.replace(target_notice, replacement_notice, 1)

# 2. Atualizar confirmNextAppointment
target_confirm = """export async function confirmNextAppointment(context) {
  const run = createWhatsappAiToolExecutor({ ...context, toolResults: undefined, toolLinks: undefined });
  const lista = await run('consultar_meus_agendamentos', { limit: 10 });
  const agora = Date.now();
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora));
  const pendentes = (lista?.agendamentos || [])
    .filter((item) => item?.id && (item.dataAgenda === diaHoje || new Date(item.dataHora).valueOf() > agora - 60 * 60 * 1000) && !['cancelado', 'concluido', 'nao_compareceu', 'confirmado'].includes(String(item.status)))
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  if (!pendentes.length) return null;

  // Confirma todos os agendamentos do cliente no mesmo dia (ex.: barba + corte em sequência)
  const primeiroDia = pendentes[0].dataAgenda || (new Date(pendentes[0].dataHora).toISOString().split('T')[0]);
  const doDia = pendentes.filter((item) => (item.dataAgenda || new Date(item.dataHora).toISOString().split('T')[0]) === primeiroDia);

  const confirmados = [];
  for (const ag of doDia) {
    const res = await run('confirmar_presenca', { appointmentId: ag.id }).catch(() => null);
    if (res?.ok) confirmados.push(ag);
  }
  if (!confirmados.length) return null;

  if (confirmados.length === 1) {
    const proximo = confirmados[0];
    const quando = new Date(proximo.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return { text: `Confirmado! ${proximo.servico?.nome || 'Seu horário'} com ${proximo.profissional?.nome || 'a equipe'}, ${quando}. Te esperamos!`, kind: 'presence_confirmed' };
  }

  const itensTexto = confirmados.map((item) => {
    const hora = item.horaLocal || new Date(item.dataHora).toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
    return `${item.servico?.nome || 'Serviço'} às ${hora}`;
  }).join(' e ');
  const primeiro = confirmados[0];
  const diaTexto = new Date(primeiro.dataHora).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit' });
  const profNome = primeiro.profissional?.nome || 'a equipe';
  return {
    text: `Confirmados! Seus ${confirmados.length} horários com ${profNome}, ${diaTexto}: ${itensTexto}. Te esperamos!`,
    kind: 'presence_confirmed',
  };
}"""

replacement_confirm = """export async function confirmNextAppointment(context) {
  const run = createWhatsappAiToolExecutor({ ...context, toolResults: undefined, toolLinks: undefined });
  const lista = await run('consultar_meus_agendamentos', { limit: 10 });
  const agora = Date.now();
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora));
  const todosValidos = (lista?.agendamentos || [])
    .filter((item) => item?.id && (item.dataAgenda === diaHoje || new Date(item.dataHora).valueOf() > agora - 60 * 60 * 1000) && !['cancelado', 'nao_compareceu'].includes(String(item.status)))
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  const pendentes = todosValidos.filter((item) => !['concluido', 'confirmado'].includes(String(item.status)));
  const lembradoId = context?.session?.estado?.ultimoAgendamentoLembradoId;

  // Se já estiver confirmado e o cliente confirmou de novo:
  if (!pendentes.length) {
    const jaConfirmado = todosValidos.find((item) => String(item.status) === 'confirmado');
    if (jaConfirmado) {
      const quando = new Date(jaConfirmado.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const primeiroNome = context.customerName ? `, ${context.customerName.split(' ')[0]}` : '';
      return {
        text: `Tudo certo${primeiroNome}! Seu horário de ${jaConfirmado.servico?.nome || 'atendimento'} com ${jaConfirmado.profissional?.nome || 'a equipe'}, ${quando}, já está 100% confirmado na régua! Te esperamos na Dino Barbearia! 💈`,
        kind: 'presence_confirmed',
      };
    }
    return null;
  }

  // Prioriza o agendamento específico que recebeu o lembrete, se houver
  let doDia;
  if (lembradoId && pendentes.some((item) => item.id === lembradoId)) {
    const alvo = pendentes.find((item) => item.id === lembradoId);
    const diaAlvo = alvo.dataAgenda || (new Date(alvo.dataHora).toISOString().split('T')[0]);
    doDia = pendentes.filter((item) => (item.dataAgenda || new Date(item.dataHora).toISOString().split('T')[0]) === diaAlvo);
  } else {
    // Confirma todos os agendamentos do cliente no mesmo dia mais próximo (ex.: barba + corte em sequência)
    const primeiroDia = pendentes[0].dataAgenda || (new Date(pendentes[0].dataHora).toISOString().split('T')[0]);
    doDia = pendentes.filter((item) => (item.dataAgenda || new Date(item.dataHora).toISOString().split('T')[0]) === primeiroDia);
  }

  const confirmados = [];
  for (const ag of doDia) {
    const res = await run('confirmar_presenca', { appointmentId: ag.id }).catch(() => null);
    if (res?.ok || res?.presenca) confirmados.push(ag);
  }
  if (!confirmados.length) return null;

  const primeiroNome = context.customerName ? `, ${context.customerName.split(' ')[0]}` : '';

  if (confirmados.length === 1) {
    const proximo = confirmados[0];
    const quando = new Date(proximo.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return {
      text: `Confirmado${primeiroNome}! ${proximo.servico?.nome || 'Seu horário'} com ${proximo.profissional?.nome || 'a equipe'}, ${quando}. Te esperamos na Dino Barbearia! 💈`,
      kind: 'presence_confirmed',
    };
  }

  const itensTexto = confirmados.map((item) => {
    const hora = item.horaLocal || new Date(item.dataHora).toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
    return `${item.servico?.nome || 'Serviço'} às ${hora}`;
  }).join(' e ');
  const primeiro = confirmados[0];
  const diaTexto = new Date(primeiro.dataHora).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit' });
  const profNome = primeiro.profissional?.nome || 'a equipe';
  return {
    text: `Confirmados${primeiroNome}! Seus ${confirmados.length} horários com ${profNome}, ${diaTexto}: ${itensTexto}. Te esperamos na Dino Barbearia! 💈`,
    kind: 'presence_confirmed',
  };
}"""

assert target_confirm in c, "target_confirm não encontrado!"
c = c.replace(target_confirm, replacement_confirm, 1)

# 3. Interceptação determinística da confirmação na linha 1680
target_intercept = """  if (!session.assigned_to && !session.acao_pendente && (explicitPresenceConfirm || (ultimoEnvioEraLembrete && presenceConfirmIntent(message.text)))) {
    const confirmado = await confirmNextAppointment(context).catch(() => null);
    if (confirmado) return confirmado;
  }"""

replacement_intercept = """  const ehIntencaoConfirmacao = presenceConfirmIntent(message.text) || explicitPresenceConfirm;
  const temLembreteAtivo = ultimoEnvioEraLembrete || Boolean(session.estado?.ultimoAgendamentoLembradoId);

  if (!session.assigned_to && !session.acao_pendente && (ehIntencaoConfirmacao || temLembreteAtivo)) {
    const confirmado = await confirmNextAppointment(context).catch(() => null);
    if (confirmado) return confirmado;
  }"""

assert target_intercept in c, "target_intercept não encontrado!"
c = c.replace(target_intercept, replacement_intercept, 1)

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(c)

print("whatsapp-ai.js atualizado com sucesso!")
