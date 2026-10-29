const { criarPlano, atualizarPlano } = require('./app/barbearia-erp-kytto.js');
const { db } = require('./app/core/database.js'); // Assuming db initialization if needed, wait Kytto uses db.json
try {
  const p = criarPlano('emp-kytto-001', { nome: 'Plano Zero Teste', preco: 0, sessoesIncluidas: 1, validadeDias: 30, servicosIds: [] });
  console.log('Created:', p);
  const u = atualizarPlano('emp-kytto-001', p.id, { preco: 0 });
  console.log('Updated:', u);
} catch (e) {
  console.error('Error:', e.message);
}
