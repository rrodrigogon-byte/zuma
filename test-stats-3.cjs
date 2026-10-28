const { apurarDesempenhoEquipe } = require('./app/dino-metas-gamificacao.js');
const { criarAgendamento } = require('./app/barbearia-erp-kytto.js');

criarAgendamento('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', {
  profissionalId: 'prof-mvsbkhyl-002',
  dataAgenda: '2026-10-28',
  servicoNome: 'Sobrancelha', // extra
  status: 'concluido',
  valor: 50
});

const stats = apurarDesempenhoEquipe('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', { dataIso: '2026-10-28' });
console.log(stats.profissionais.find(p => p.nome.includes('Bruno')).dia);
