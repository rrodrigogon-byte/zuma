export function addDumpEnv(app) {
  app.get('/api/admin/dump-env-gcp', (req, res) => {
    res.json(process.env);
  });
}
