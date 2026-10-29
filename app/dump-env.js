import { db as pgDb } from './core/database.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const result = await pgDb.query("SELECT * FROM canais_integracao WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'");
      res.json({ canais: result.rows });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
