const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/app/barbearia-erp-kytto.js', 'utf8');

const oldUpdate = `  agendamento.duracaoMinutos = dados.duracaoMinutos
    ? Math.max(5, Math.min(480, Math.round(Number(dados.duracaoMinutos))))
    : duracaoAtendimentoProfissional(servico, profissional, obterCalendarioLoja(estado, agendamento.lojaId));`;

const newUpdate = `  if (dados.duracaoMinutos) {
    agendamento.duracaoMinutos = Math.max(5, Math.min(480, Math.round(Number(dados.duracaoMinutos))));
  } else if (agendamento.servicoId === atual.servicoId && agendamento.profissionalId === atual.profissionalId && atual.duracaoMinutos) {
    agendamento.duracaoMinutos = atual.duracaoMinutos;
  } else {
    agendamento.duracaoMinutos = duracaoAtendimentoProfissional(servico, profissional, obterCalendarioLoja(estado, agendamento.lojaId));
  }`;

code = code.replace(oldUpdate, newUpdate);
fs.writeFileSync('/home/ubuntu/agro-open/app/barbearia-erp-kytto.js', code, 'utf8');
console.log('Patched atualizarAgendamento');
