import { db } from './db.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-test', async (req, res) => {
    res.json({ db: Object.keys(db().empresas['d0d0ac01-8e50-4b61-8c79-de4aaa916da6'].lojas || {}) });
  });
}
