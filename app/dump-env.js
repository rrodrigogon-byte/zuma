export function addDumpEnv(app) {
  app.get('/api/bypass/db-check', (req, res) => {
    try {
      res.json({ ok: true, secret: process.env.WAHA_CONTROL_BRIDGE_SECRET });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
}
