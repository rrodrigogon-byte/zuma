export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const conexaoKytto = await import('./whatsapp-conexao-kytto.js');
        const result = await conexaoKytto.gerarQr('emp-kytto-001', { tipoCanal: 'gestao', registrarHistorico: false });
        res.json({ result });
      } catch (e) {
        res.json({ error: String(e) });
      }
      return;
    }
    next();
  });
}
