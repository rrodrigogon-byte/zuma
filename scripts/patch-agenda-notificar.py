with open('app/core/barbershop-agenda.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Remover disparo imediato de lembrete em notificarDepois (evita Print 6)
target1 = """function notificarDepois(contexto, agendamento, evento) {
  setImmediate(async () => {
    // Aviso no celular do profissional (app do barbeiro) também para ações feitas pela IA.
    const legado = contexto.legacyEmpresaId || contexto.empresaId;
    const servicoNome = agendamento.servicoNome || barbearia.listarServicos(legado, { incluirInativos: true }).find((s) => s.id === agendamento.servicoId)?.nome || '';
    await notificarEquipe(legado, agendamento, evento, { servicoNome }).catch(() => null);
    if (evento === 'remarcado' || evento === 'cancelado') await cancelPendingAppointmentNotifications(contexto, agendamento.id).catch(() => null);
    if (evento !== 'cancelado') await queueAppointmentNotifications(contexto, agendamento, 'lembrete').catch(() => null);
  });
}"""

replacement1 = """function notificarDepois(contexto, agendamento, evento) {
  setImmediate(async () => {
    // Aviso no celular do profissional (app do barbeiro) para ações da agenda/IA.
    const legado = contexto.legacyEmpresaId || contexto.empresaId;
    const servicoNome = agendamento.servicoNome || barbearia.listarServicos(legado, { incluirInativos: true }).find((s) => s.id === agendamento.servicoId)?.nome || '';
    await notificarEquipe(legado, agendamento, evento, { servicoNome }).catch(() => null);
    if (evento === 'remarcado' || evento === 'cancelado') await cancelPendingAppointmentNotifications(contexto, agendamento.id).catch(() => null);
    // NÃO dispara lembrete imediato aqui: o agendamento acabou de ser confirmado no chat com o código.
    // Lembretes da véspera e do dia são enfileirados pelo cron diário de lembretes.
  });
}"""

# 2. Corrigir agendamentosDoTelefone para não descartar agendamentos sem lojaId explícito
target2 = """function agendamentosDoTelefone(empresa, phone, { includePast = false, lojaId, toleranceHours = 4 } = {}) {
  const chave = phoneMatchKey(phone);
  const unidade = limpo(lojaId, 120);
  if (!chave || !unidade) return [];
  const agora = Date.now();
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora));
  const limitePassado = includePast ? 0 : agora - (Number(toleranceHours) || 0) * 3600000;
  return barbearia.listarAgendamentos(empresa, {})
    .filter((item) => String(item.lojaId || '') === unidade)
    .filter((item) => phoneMatchKey(item.clienteTelefone) === chave)
    .filter((item) => !['cancelado', 'nao_compareceu'].includes(item.status))
    .filter((item) => includePast || item.dataAgenda === diaHoje || instanteAgendamento(item) >= limitePassado);
}"""

replacement2 = """function agendamentosDoTelefone(empresa, phone, { includePast = false, lojaId, toleranceHours = 4 } = {}) {
  const chave = phoneMatchKey(phone);
  const unidade = limpo(lojaId, 120);
  if (!chave) return [];
  const agora = Date.now();
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora));
  const limitePassado = includePast ? 0 : agora - (Number(toleranceHours) || 0) * 3600000;
  return barbearia.listarAgendamentos(empresa, {})
    .filter((item) => !unidade || !item.lojaId || String(item.lojaId) === unidade)
    .filter((item) => phoneMatchKey(item.clienteTelefone) === chave)
    .filter((item) => !['cancelado', 'nao_compareceu'].includes(item.status))
    .filter((item) => includePast || item.dataAgenda === diaHoje || instanteAgendamento(item) >= limitePassado);
}"""

assert target1 in c, "target1 não encontrado!"
assert target2 in c, "target2 não encontrado!"

c = c.replace(target1, replacement1, 1).replace(target2, replacement2, 1)

with open('app/core/barbershop-agenda.js', 'w', encoding='utf8') as f:
    f.write(c)

print("barbershop-agenda.js atualizado com sucesso!")
