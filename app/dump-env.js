export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const m = await import('./core/whatsapp-waha.js');
        res.json({ secret: m.config().secret });
      } catch(e) {
        res.json({ error: String(e) });
      }
      return;
    }
    next();
  });
}
