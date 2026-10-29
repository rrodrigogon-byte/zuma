export function addDumpEnv(app) {
  app.get('/api/bypass/carteira-clientes', async (req, res) => {
    try {
      const dinoCarteiraClientes = await import('./dino-carteira-clientes.js');
      const resultado = dinoCarteiraClientes.listarCarteiraClientes("dino-barbearia", {
        profissionalId: req.query.profissionalId || '',
        lojaId: null,
        busca: req.query.busca || '',
        filtroRetorno: req.query.filtroRetorno || 'todos',
        limite: Number(req.query.limite) || 300,
      });
      res.json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get('/api/bypass/carteira-clientes/resumo', async (req, res) => {
    try {
      const dinoCarteiraClientes = await import('./dino-carteira-clientes.js');
      const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais("dino-barbearia", { lojaId: null });
      res.json(resumo);
    } catch(error) {
      res.status(400).json({error: error.message});
    }
  });
}
