import { db } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { empresasEquivalentes } from './core/legacy-commerce-scope.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const root = db();
      const empresas = empresasEquivalentes("dino-barbearia");
      let count = 0;
      const counts = {};
      for (const emp of empresas) {
         counts[emp] = Object.keys(root.clientesKytto?.empresas?.[emp]?.clientes || {}).length;
         count += counts[emp];
      }
      res.json({ ok: true, empresas, count, counts });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
