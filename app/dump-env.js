export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const start = Date.now();
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://waha.kytto.com.br/v1/sessions/barbearia-dino-gestao/qr', {
          headers: { 'X-Kytto-Waha-Bridge-Secret': 'd987534fc2d191056cab9521ccdedd061f95635ea7cd85a6d60fa207407ae1f2d6d107fe25cba9a255105a93e3abbedf' }
        });
        const ms = Date.now() - start;
        res.json({ ok: response.ok, status: response.status, ms });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
