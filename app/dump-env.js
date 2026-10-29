export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    res.json({ ok: true, DB_PATH: process.env.DB_PATH });
  });
}
