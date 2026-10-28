const { db } = require('../app/core/database.js');
async function clear() {
  await db.query(`UPDATE whatsapp_ai_sessions SET status = 'ativa', data_atualizacao = CURRENT_TIMESTAMP WHERE status = 'humano'`);
  console.log('Handoffs removed.');
  process.exit();
}
clear();
