with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """  validarCalendarioAgendamento(estado, agendamento, agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null);
  if (verificarConflito(estado, agendamento, atual.id)) {
    if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
    agendamento.encaixe = true;
  } else {
    agendamento.encaixe = false;
  }"""

replacement = """  const mudouHorarioOuProf = ['dataHora', 'dataAgenda', 'horaLocal', 'profissionalId'].some((campo) => String(antes[campo] || '') !== String(agendamento[campo] || ''));
  if (mudouHorarioOuProf) {
    validarCalendarioAgendamento(estado, agendamento, agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null);
    if (verificarConflito(estado, agendamento, atual.id)) {
      if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
      agendamento.encaixe = true;
    } else {
      agendamento.encaixe = false;
    }
  }"""

assert target in c, "target não encontrado em barbearia-erp-kytto.js!"
c = c.replace(target, replacement, 1)

with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
    f.write(c)

print("barbearia-erp-kytto.js atualizado com condicional em mudouHorarioOuProf!")
