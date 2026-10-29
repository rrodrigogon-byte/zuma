const { db } = require('./app/core/database.js');
async function patch() {
  const pool = db.getPool();
  try {
    await pool.query('ALTER TABLE fiscal_configuracoes ADD COLUMN ult_nsu VARCHAR(15) DEFAULT \'000000000000000\'');
    console.log('Column added');
  } catch (e) {
    console.log(e.message);
  }
  process.exit(0);
}
patch();
