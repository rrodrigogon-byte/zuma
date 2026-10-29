import { db } from './db.js';
import * as clientesContas from './clientes-contas-kytto.js';
import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const dbObj = db();
      const c = clientesContas.clientesPersistidos("dino");
      const cCount = Object.keys(c.clientes || {}).length;
      
      const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais("dino", { lojaId: null });
      res.json({ ok: true, dinoCount: cCount, resumo });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
