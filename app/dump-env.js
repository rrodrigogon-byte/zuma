export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const fetch = (await import('node-fetch')).default || globalThis.fetch;
        const response = await fetch(process.env.WAHA_CONTROL_URL + '/v1/sessions/barbearia-dino-gestao/qr', {
          headers: {
            'X-Kytto-Waha-Bridge-Secret': process.env.WAHA_CONTROL_BRIDGE_SECRET
          }
        });
        const contentType = response.headers.get('content-type');
        const buffer = await response.arrayBuffer();
        res.json({ status: response.status, contentType, length: buffer.byteLength });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
