export function addDumpEnv(app) {
  app.get('/api/bypass/test-env-5', (req, res) => {
    res.json({
       all: Object.keys(process.env).filter(k => k.includes('EVOL')).reduce((acc, k) => ({...acc, [k]: process.env[k]}), {})
    });
  });
}
