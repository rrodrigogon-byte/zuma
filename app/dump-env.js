import { db } from './db.js';
import * as clientesContas from './clientes-contas-kytto.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const dbObj = db();
      const keys = Object.keys(dbObj.clientesKytto?.empresas || {});
      const counts = {};
      for (const k of keys) {
        const c = clientesContas.clientesPersistidos(k);
        counts[k] = Object.keys(c.clientes || {}).length;
      }
      res.json({ ok: true, counts, keys });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
