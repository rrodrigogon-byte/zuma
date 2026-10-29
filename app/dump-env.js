import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/carteira-clientes', (req, res) => {
    try {
      const resultado = dinoCarteiraClientes.listarCarteiraClientes("d0d0ac01-8e50-4b61-8c79-de4aaa916da6", {
        profissionalId: req.query.profissionalId || '',
        lojaId: null,
        busca: req.query.busca || '',
        filtroRetorno: req.query.filtroRetorno || 'todos',
        limite: Number(req.query.limite) || 300,
      });
      res.json({ ok: true, data: resultado });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
