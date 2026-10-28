export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const fetch = (await import('node-fetch')).default || globalThis.fetch;
        const response = await fetch('https://waha.kytto.com.br/v1/sessions/provision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': 'd987534fc2d191056cab9521ccdedd061f95635ea7cd85a6d60fa207407ae1f2d6d107fe25cba9a255105a93e3abbedf'
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
