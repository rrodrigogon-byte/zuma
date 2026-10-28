export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const result = await import('./whatsapp-conexao-kytto.js').then(m => m.gerarQr('emp-kytto-001', { tipoCanal: 'gestao' }));
        res.json({ result });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
