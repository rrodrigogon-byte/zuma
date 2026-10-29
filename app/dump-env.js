import { db } from './db.js';
import * as wa from './core/whatsapp.js';

export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const canais = Object.values(db().canais || {}).filter(c => c.status === 'ativo').map(c => ({ id: c.id, nome: c.nome, instance: c.configuracao?.instance, api: c.api_base_url }));
      res.json({ canais });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
