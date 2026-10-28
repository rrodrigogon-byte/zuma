const { apurarDesempenhoEquipe } = require('./app/dino-metas-gamificacao.js');
const stats = apurarDesempenhoEquipe('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', { dataIso: '2026-10-28' });
console.log(JSON.stringify(stats.profissionais, null, 2));
