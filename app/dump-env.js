export function addDumpEnv(app) {
  app.get('/api/bypass/test-env', (req, res) => {
    res.json({
       instance: process.env.EVOLUTION_INSTANCE,
       all: Object.keys(process.env).filter(k => k.includes('EVOL') || k.includes('WAHA')).reduce((acc, k) => ({...acc, [k]: process.env[k]}), {})
    });
  });
}
