export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      res.json({ ok: true, waha_url: process.env.WAHA_CONTROL_URL });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
