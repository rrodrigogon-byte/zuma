export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const { db } = await import('./core/database.js');
        res.json({ keys: Object.keys(db().whatsappConexaoKytto.empresas) });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
