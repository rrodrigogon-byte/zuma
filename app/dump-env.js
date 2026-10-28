export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        res.json({ secret: process.env.WAHA_CONTROL_BRIDGE_SECRET });
      } catch(e) {
        res.json({ error: String(e) });
      }
      return;
    }
    next();
  });
}
