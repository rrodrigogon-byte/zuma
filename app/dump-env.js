export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const dns = await import('dns');
        dns.resolve4('waha.kytto.com.br', (err, addresses) => {
          res.json({ err: err?.message, addresses });
        });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
