const { excluirPlano } = require('./app/barbearia-erp-kytto.js');
try {
  const p = excluirPlano('emp-kytto-001', 'plano-mvsudned-001');
  console.log('Deleted:', p);
} catch (e) {
  console.error('Error:', e.message);
}
