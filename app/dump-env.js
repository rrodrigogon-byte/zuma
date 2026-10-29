import { db } from './db.js';
import * as server from './server.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/get-user', (req, res) => {
    try {
      const u = (db().usuarios || []).find(u => u.email === 'rrodrigogon@gmail.com');
      res.json({ ok: true, user: u });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
