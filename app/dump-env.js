import { db as pgDb } from './core/database.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/test-canais', async (req, res) => {
    try {
      const result = await pgDb.query("SELECT * FROM canais_integracao WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'");
      res.json({ ok: true, rows: result.rows });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
