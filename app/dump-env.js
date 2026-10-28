export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const fetch = (await import('node-fetch')).default || globalThis.fetch;
        const response = await fetch(process.env.WAHA_CONTROL_URL + '/v1/sessions/provision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': process.env.WAHA_CONTROL_BRIDGE_SECRET
          },
          body: JSON.stringify({ session: 'barbearia-dino-gestao' })
        });
        const text = await response.text();
        res.json({ status: response.status, text });
      } catch (e) {
        res.json({ error: e.message });
      }
      return;
    }
    next();
  });
}
