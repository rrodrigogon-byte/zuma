export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://waha.kytto.com.br/v1/sessions/barbearia-dino-gestao/qr', {
          headers: { 'X-Kytto-Waha-Bridge-Secret': process.env.WAHA_CONTROL_BRIDGE_SECRET }
        });
        const headers = Object.fromEntries(response.headers.entries());
        const text = await response.text();
        res.json({ ok: response.ok, status: response.status, headers, text: text.slice(0, 100) });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
