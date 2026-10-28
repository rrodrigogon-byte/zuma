const { db } = require('../app/db-pg.js');

async function run() {
  const num = process.argv[2];
  if (!num) {
    console.error('Forneça um número');
    process.exit(1);
  }
  await db.query(`UPDATE whatsapp_ai_sessions SET status = 'ativo' WHERE remote_jid LIKE $1`, [`%${num}%`]);
  console.log('Handoff limpo para', num);
  process.exit(0);
}
run();
