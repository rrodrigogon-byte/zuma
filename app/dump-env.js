export function addDumpEnv(app) {
  app.use(async (req, res, next) => {
    if (req.path === '/dump') {
      try {
        const m = await import('./core/whatsapp-waha.js');
        const r = await m.getWahaSessionQr('barbearia-dino-gestao');
        res.json({ ok: true, qr: !!r });
      } catch (e) {
        res.json({ error: e.message, stack: e.stack });
      }
      return;
    }
    next();
  });
}
