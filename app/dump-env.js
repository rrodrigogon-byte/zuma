import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais("dino", { lojaId: null });
      res.json({ ok: true, resumo });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
