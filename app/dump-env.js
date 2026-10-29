export function addDumpEnv(app) {
  app.get('/api/bypass/test-env', (req, res) => {
    res.json({ instance: process.env.EVOLUTION_INSTANCE });
  });
}
