const { db } = require('./app/core/database.js');
async function test() {
  try {
    const res = await db.queryRead("SELECT column_name FROM information_schema.columns WHERE table_name = 'servicos'");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
test();
