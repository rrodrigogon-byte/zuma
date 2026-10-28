export function addDumpEnv(app) {
  // express middleware to bypass auth just for this
  app.use((req, res, next) => {
    if (req.path === '/dump') return res.json(process.env);
    next();
  });
}
