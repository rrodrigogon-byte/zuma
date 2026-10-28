export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const { config } = await import('./core/whatsapp-waha.js');
        res.json({ secret: config().secret });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
