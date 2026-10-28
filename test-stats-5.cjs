const { apurarDesempenhoEquipe } = require('./app/dino-metas-gamificacao.js');
const { criarAgendamento, alterarStatusAgendamento } = require('./app/barbearia-erp-kytto.js');

const a = criarAgendamento('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', {
  clienteNome: 'Teste',
  profissionalId: 'prof-mvsbkhyl-002',
  dataHora: '2026-10-28T10:00:00.000Z',
  dataAgenda: '2026-10-28',
  servicoNome: 'Sobrancelha', // extra
  valor: 50
});
alterarStatusAgendamento('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', a.id, 'concluido');

const stats = apurarDesempenhoEquipe('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', { dataIso: '2026-10-28' });
console.log(stats.profissionais.find(p => p.nome.includes('Bruno')).dia);
