export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const m = await import('./core/whatsapp-waha.js');
        const qr = await m.getWahaSessionQr('barbearia-dino-gestao');
        res.json({ ok: true, qrLength: qr.dataUrl.length, dataUrl: qr.dataUrl.slice(0, 50) });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
