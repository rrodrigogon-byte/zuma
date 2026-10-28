export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      res.json({ url: process.env.WAHA_CONTROL_URL });
      return;
    }
    next();
  });
}
