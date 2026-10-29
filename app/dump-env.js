import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais("d0d0ac01-8e50-4b61-8c79-de4aaa916da6", { lojaId: null });
      res.json({ ok: true, resumo });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
