import { db } from './db.js';
import * as clientesContas from './clientes-contas-kytto.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const dbObj = db();
      const keys = Object.keys(dbObj.clientesKytto?.empresas || {});
      const c = clientesContas.clientesPersistidos("dino-barbearia");
      const cCount = Object.keys(c.clientes).length;
      res.json({ ok: true, keys, dinoBarbeariaCount: cCount, allEmpresas: Object.keys(dbObj.barbearias || {}) });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
