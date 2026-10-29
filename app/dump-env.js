export function addDumpEnv(app) {
  app.get('/api/bypass/send-test', async (req, res) => {
    res.json({ ok: "Test bypassed entirely" });
  });
}
