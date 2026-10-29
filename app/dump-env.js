export function addDumpEnv(app) {
  app.get('/api/bypass/test-trex', async (req, res) => {
    try {
      const wa = await import('./core/whatsapp-waha.js');
      const send = await wa.sendWahaText('barbearia-dino-gestao', '5514997462929@g.us', 'Teste do T-Rex');
      res.json({ ok: true, send });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
