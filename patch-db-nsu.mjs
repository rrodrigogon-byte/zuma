import { db } from './app/core/database.js';
async function patch() {
  try {
    await db.query('ALTER TABLE fiscal_configuracoes ADD COLUMN ult_nsu VARCHAR(15) DEFAULT \'000000000000000\'');
    console.log('Column added');
  } catch (e) {
    console.log(e.message);
  }
  process.exit(0);
}
patch();
