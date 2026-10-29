const dinoMetasGamificacao = require('./app/dino-metas-gamificacao.js');
const { legacyDb } = require('./app/server.js'); // just to ensure db is loaded
setTimeout(() => {
  const result = dinoMetasGamificacao.avaliarMetasESincronizarGiros('emp-kytto-001', { dataIso: '2026-10-28' });
  console.log(JSON.stringify(result, null, 2));
}, 1000);
