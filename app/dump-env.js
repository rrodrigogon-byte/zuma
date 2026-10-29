import { db } from './db.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-test', async (req, res) => {
    res.json({ empresas: Object.keys(db().empresas || {}) });
  });
}
