export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const https = await import('https');
        const options = {
          hostname: 'waha.kytto.com.br',
          port: 443,
          path: '/v1/sessions/barbearia-dino-gestao/qr',
          method: 'GET',
          headers: {
            'X-Kytto-Waha-Bridge-Secret': 'd987534fc2d191056cab9521ccdedd061f95635ea7cd85a6d60fa207407ae1f2d6d107fe25cba9a2551052de44c330c9a'
          }
        };
        const req2 = https.request(options, (res2) => {
          res.json({ statusCode: res2.statusCode, headers: res2.headers });
        });
        req2.on('error', (e) => {
          res.json({ error: String(e) });
        });
        req2.end();
      } catch (e) {
        res.json({ error: String(e) });
      }
      return;
    }
    next();
  });
}
