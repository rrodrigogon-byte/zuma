import * as dinoCarteiraClientes from './dino-carteira-clientes.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/carteira-clientes', (req, res) => {
    try {
      const resultado = dinoCarteiraClientes.listarCarteiraClientes("dino-barbearia", {
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
  app.get('/api/bypass/carteira-clientes/resumo', (req, res) => {
    try {
      const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais("dino-barbearia", { lojaId: null });
      res.json({ result: resumo });
    } catch(error) {
      res.status(400).json({error: String(error)});
    }
  });
}
